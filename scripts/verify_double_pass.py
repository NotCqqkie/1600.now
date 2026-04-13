#!/usr/bin/env python3.11
"""
Double-pass verification for SAT math problem questions.

Processes the ~200 questions that had errors, mismatches, or needed review
from the first pass (verify_math.py).

Three phases:
  1. Re-run Qwen3 (local) for the 79 parse_fail errors — fixed prompt,
     higher token budget, more explicit format constraint.
  2. Independent solve via Llama3 (remote Ollama at 100.85.13.87) for ALL problem questions.
  3. Arbitration — 3-way compare: Qwen vs Llama3 vs answer key.
       - Both agree with key          → unanimous accept
       - Llama3 alone confirms key    → accept key (Qwen outlier)
       - Qwen alone confirms key      → accept key (Llama3 outlier)
       - Both DISAGREE with key       → Qwen CoT tiebreaker
           CoT sides with key         → accept key
           CoT sides with models      → flag answer key as suspect
           CoT splits three ways      → human review
       - Llama3 can't solve           → image_dependent / human review

Each result includes: verdict, decision, previous_answer, new_answer,
plus full calc and answer from every model pass — so you can audit
every decision.

Run:  python3.11 scripts/verify_double_pass.py
Resume: just re-run — checkpoint auto-loaded

Outputs (in scripts/):
  double_pass_results.json     — full per-question audit trail
  auto_resolved.json           — confidently resolved (apply to corrected)
  human_review.json            — needs human eyes
  answer_key_suspects.json     — both models + CoT disagree with key
"""

import json
import os
import re
import sys
import threading
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

from openai import OpenAI

# ── Config ────────────────────────────────────────────────────────────────────

OLLAMA_URL      = "http://localhost:11434/api/chat"
QWEN_MODEL      = "qwen3:32b"

# Remote Ollama instance (OpenAI-compatible endpoint)
LLAMA_BASE_URL  = "http://100.85.13.87:11434/v1"
LLAMA_API_KEY   = "ollama"   # ignored by Ollama, required by SDK
LLAMA_MODEL     = "llama3"

SCRIPT_DIR      = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE      = os.path.join(SCRIPT_DIR, "math_review.json")
LOG_FILE        = os.path.join(SCRIPT_DIR, "verification_log.json")
CORRECTED_FILE  = os.path.join(SCRIPT_DIR, "math_corrected.json")
CKPT_FILE       = os.path.join(SCRIPT_DIR, "double_pass_checkpoint.json")

OUTPUT_RESULTS  = os.path.join(SCRIPT_DIR, "double_pass_results.json")
OUTPUT_RESOLVED = os.path.join(SCRIPT_DIR, "auto_resolved.json")
OUTPUT_REVIEW   = os.path.join(SCRIPT_DIR, "human_review.json")
OUTPUT_SUSPECTS = os.path.join(SCRIPT_DIR, "answer_key_suspects.json")

WORKERS_CLAUDE = 5   # parallel Claude API requests
WORKERS_QWEN   = 2   # Qwen re-runs (GPU limited)
MAX_RETRIES    = 4
CHECKPOINT_EVERY = 25

OLLAMA_HEADERS = {"Content-Type": "application/json"}

# ── Prompts ───────────────────────────────────────────────────────────────────

# Used for Qwen re-runs of parse_fail questions.
# Key changes vs original:
#   - "IMPORTANT" block at top for emphasis
#   - More explicit about NOT returning a "corrected" key
#   - Higher num_predict (2000) so output isn't truncated
QWEN_RERUN_SYSTEM = """\
IMPORTANT: Return ONLY the JSON schema shown below. Do NOT return a "corrected" object \
or any other structure. Only the exact keys shown.

Fix and verify a SAT math question. Input has: text, choices, correctAnswer, type.

FIX in "text" and choice "text" fields only:
- Asterisk italics: "*x*"→"$x$", "*x**2*"→"$x^2$", "*f*(*x*)"→"$f(x)$"
- Bare math: "y=2x+3"→"$y=2x+3$", "x2+5"→"$x^2+5$"
- Bare symbols: ≤ ≥ ≠ π → wrap in $...$
- Obvious typos in English prose only

SOLVE it. Compare to correctAnswer.

Return ONLY this exact JSON (no markdown fences, no extra keys):
{
  "fixes": {"text": "corrected text", "choices": [{"id":"A","text":"corrected"}]},
  "changes": ["text:old→new"],
  "calc": "brief step-by-step",
  "model_answer": "D",
  "answer_matches": true,
  "needs_review": false
}

Rules:
- "fixes" contains ONLY fields that changed. If nothing changed, use "fixes": {}
- "needs_review": true ONLY if question is genuinely incoherent or requires an unseen image/table
- Do NOT add a "corrected" key. Do NOT wrap in markdown.\
"""

# Used for Claude API — independent verification of all problem questions.
CLAUDE_SYSTEM = """\
You are verifying SAT math questions. Given a question JSON, solve it carefully.

FIX in "text" and choice "text" fields only (if needed):
- Asterisk italics: "*x*"→"$x$", "*x**2*"→"$x^2$", "*f*(*x*)"→"$f(x)$"
- Bare math: "y=2x+3"→"$y=2x+3$"
- Bare symbols: ≤ ≥ ≠ π → wrap in $...$

SOLVE the question completely. If unsolvable due to a missing image, table, or \
context that is not in the JSON, set needs_review to true.

Return ONLY this JSON (no markdown fences):
{
  "fixes": {"text": "...", "choices": [{"id":"A","text":"..."}]},
  "changes": ["description of each fix"],
  "calc": "complete step-by-step solution",
  "model_answer": "A",
  "confidence": "high",
  "needs_review": false,
  "review_reason": ""
}

- "fixes": only changed fields. If nothing changed, use "fixes": {}
- "confidence": "high" (certain), "medium" (some ambiguity), "low" (guessing)
- "needs_review": true only if question requires unseen content or is incoherent
- "review_reason": brief note if needs_review is true, else empty string\
"""

# Used for the CoT tiebreaker when Qwen + Claude both disagree with the answer key.
# Enables Qwen3's extended reasoning chain.
QWEN_COT_SYSTEM = """\
Carefully re-examine this SAT math question. Show all work step by step.

Context: The official answer key says {answer_key}. \
Another model solved it and got {models_answer}. \
One of them is wrong. Re-examine the question carefully — answer keys can have errors.

Return ONLY this JSON (no markdown fences):
{
  "calc": "detailed step-by-step solution showing all work",
  "model_answer": "A",
  "reasoning": "brief explanation of why this is the correct answer"
}\
"""

# ── I/O ───────────────────────────────────────────────────────────────────────

def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)

def save_json(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)

def load_checkpoint():
    if os.path.exists(CKPT_FILE):
        return load_json(CKPT_FILE)
    return {"qwen_rerun": {}, "claude": {}}

def save_checkpoint(ckpt):
    save_json(CKPT_FILE, ckpt)

# Only send fields the model needs — avoids leaking immutable metadata
_SEND_FIELDS = {"text", "prompt", "passage", "choices", "correctAnswer", "type", "questionImages"}

def slim(question):
    return {k: v for k, v in question.items() if k in _SEND_FIELDS and v is not None}

# ── JSON extraction ───────────────────────────────────────────────────────────

def extract_json(text):
    """Extract the first valid JSON object from a model response."""
    if not text:
        return None
    # Strip Qwen3 thinking tags
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    # Strip markdown fences
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text.strip()).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Find the outermost { } block
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    in_str = esc = False
    for i, ch in enumerate(text[start:], start):
        if esc:        esc = False;  continue
        if ch == "\\":  esc = True;  continue
        if ch == '"':  in_str = not in_str; continue
        if in_str:     continue
        if ch == "{":  depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:    return json.loads(text[start:i + 1])
                except: return None
    return None

def normalize_answer(ans):
    if ans is None:
        return None
    return str(ans).strip().upper().rstrip(".")

# ── Phase 1: Qwen re-run for parse_fail errors ───────────────────────────────

def call_qwen_rerun(question, retries=0):
    payload = {
        "model": QWEN_MODEL,
        "think": False,
        "stream": False,
        "messages": [
            {"role": "system", "content": QWEN_RERUN_SYSTEM},
            {"role": "user",   "content": json.dumps(slim(question), ensure_ascii=False)},
        ],
        "options": {
            "temperature": 0,
            "num_predict": 2000,   # higher than original 1200 — avoids truncation
            "repeat_penalty": 1.0,
        },
    }
    try:
        r = requests.post(OLLAMA_URL, headers=OLLAMA_HEADERS, json=payload, timeout=300)
        if r.status_code != 200:
            if retries < MAX_RETRIES:
                time.sleep(2 ** retries)
                return call_qwen_rerun(question, retries + 1)
            return None, f"HTTP {r.status_code}"
        return r.json()["message"]["content"], None
    except requests.exceptions.Timeout:
        if retries < MAX_RETRIES:
            time.sleep(2 ** retries)
            return call_qwen_rerun(question, retries + 1)
        return None, "Timeout"
    except Exception as e:
        if retries < MAX_RETRIES:
            time.sleep(2 ** retries)
            return call_qwen_rerun(question, retries + 1)
        return None, str(e)

# ── Phase 2: Llama3 via remote Ollama (OpenAI-compatible) ────────────────────

def call_llama3(question, client, retries=0):
    try:
        response = client.chat.completions.create(
            model=LLAMA_MODEL,
            max_tokens=1800,
            messages=[
                {"role": "system", "content": CLAUDE_SYSTEM},
                {"role": "user",   "content": json.dumps(slim(question), ensure_ascii=False)},
            ],
        )
        text = response.choices[0].message.content
        result = extract_json(text)
        if result:
            return result, None
        return None, f"parse_fail: {text[:200]}"
    except Exception as e:
        if retries < MAX_RETRIES:
            time.sleep(2 ** retries)
            return call_llama3(question, client, retries + 1)
        return None, str(e)

# ── Phase 3: Qwen CoT tiebreaker ─────────────────────────────────────────────

def call_qwen_cot(question, answer_key, models_answer, retries=0):
    """Qwen3 with extended reasoning enabled — used when both models disagree with key."""
    system = QWEN_COT_SYSTEM.format(answer_key=answer_key, models_answer=models_answer)
    payload = {
        "model": QWEN_MODEL,
        "think": True,    # enable Qwen3 chain-of-thought
        "stream": False,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": json.dumps(slim(question), ensure_ascii=False)},
        ],
        "options": {
            "temperature": 0,
            "num_predict": 4000,   # CoT output can be very long
            "repeat_penalty": 1.0,
        },
    }
    try:
        r = requests.post(OLLAMA_URL, headers=OLLAMA_HEADERS, json=payload, timeout=600)
        if r.status_code != 200:
            if retries < MAX_RETRIES:
                time.sleep(2 ** retries)
                return call_qwen_cot(question, answer_key, models_answer, retries + 1)
            return None, f"HTTP {r.status_code}"
        return r.json()["message"]["content"], None
    except requests.exceptions.Timeout:
        if retries < MAX_RETRIES:
            time.sleep(2 ** retries)
            return call_qwen_cot(question, answer_key, models_answer, retries + 1)
        return None, "Timeout"
    except Exception as e:
        if retries < MAX_RETRIES:
            time.sleep(2 ** retries)
            return call_qwen_cot(question, answer_key, models_answer, retries + 1)
        return None, str(e)

# ── Arbitration ───────────────────────────────────────────────────────────────

def arbitrate(index, question, qwen_answer, qwen_calc, claude_result, cot_result, original_category):
    """
    3-way arbitration: Qwen vs Claude vs answer key.

    Returns a dict with:
      verdict        — one of the VERDICT_* constants below
      decision       — human-readable explanation of the ruling
      previous_answer — what we had before (always the answer key)
      new_answer     — what to use now (None = don't auto-change, keep key)
      + all model outputs for auditing
    """
    answer_key   = normalize_answer(question.get("correctAnswer"))
    qwen_ans     = normalize_answer(qwen_answer)
    claude_ans   = normalize_answer((claude_result or {}).get("model_answer"))
    cot_ans      = normalize_answer((cot_result or {}).get("model_answer"))

    llama_confidence   = (claude_result or {}).get("confidence", "high")
    llama_needs_review = (claude_result or {}).get("needs_review", False)
    llama_review_reason = (claude_result or {}).get("review_reason", "")
    llama_calc   = (claude_result or {}).get("calc", "")
    cot_calc     = (cot_result or {}).get("calc", "")
    cot_reasoning = (cot_result or {}).get("reasoning", "")

    base = {
        "index":             index,
        "id":                question.get("id"),
        "testName":          question.get("testName"),
        "original_category": original_category,
        "answer_key":        answer_key,
        "previous_answer":   answer_key,   # before this pass we always used the key
        "qwen_answer":       qwen_ans,
        "claude_answer":     claude_ans,
        "qwen_cot_answer":   cot_ans,
        "llama_confidence":  llama_confidence,
        "llama_calc":        llama_calc,
        "qwen_calc":         qwen_calc or "",
        "qwen_cot_calc":     cot_calc,
        "qwen_cot_reasoning": cot_reasoning,
    }

    # ── Cannot solve (missing image/table) ───────────────────────────────────
    if llama_needs_review:
        return {**base,
                "verdict":    "image_dependent",
                "decision":   f"Llama3: {llama_review_reason or 'requires unseen content'}",
                "new_answer": None}

    # ── Llama3 call failed entirely ───────────────────────────────────────────
    if claude_result is None:
        return {**base,
                "verdict":    "human_review",
                "decision":   "Llama3 call failed — cannot verify",
                "new_answer": None}

    # ── Llama3 returned low confidence ────────────────────────────────────────
    if llama_confidence == "low":
        return {**base,
                "verdict":    "human_review",
                "decision":   f"Llama3 low confidence ({claude_ans}) — needs human check",
                "new_answer": None}

    # ── Unanimous: all three agree ────────────────────────────────────────────
    if qwen_ans == answer_key and claude_ans == answer_key:
        return {**base,
                "verdict":    "unanimous",
                "decision":   f"All agree: {answer_key}",
                "new_answer": answer_key}

    # ── Llama3 confirms key, Qwen was wrong ──────────────────────────────────
    if claude_ans == answer_key and qwen_ans != answer_key:
        return {**base,
                "verdict":    "accept_key_llama_confirms",
                "decision":   f"Llama3 confirms key={answer_key}; Qwen was wrong ({qwen_ans})",
                "new_answer": answer_key}

    # ── Qwen confirms key, Llama3 disagrees ───────────────────────────────────
    if qwen_ans == answer_key and claude_ans != answer_key:
        return {**base,
                "verdict":    "accept_key_qwen_confirms",
                "decision":   f"Qwen confirms key={answer_key}; Llama3 disagrees ({claude_ans}) — accepting key",
                "new_answer": answer_key}

    # ── Both models DISAGREE with key ─────────────────────────────────────────
    # Requires CoT tiebreaker (should already be populated)
    if qwen_ans and claude_ans and qwen_ans == claude_ans and qwen_ans != answer_key:
        models_agree_on = qwen_ans

        if cot_result is None:
            # CoT wasn't run or failed
            return {**base,
                    "verdict":    "human_review",
                    "decision":   (f"Qwen={qwen_ans} and Claude={claude_ans} both disagree with "
                                   f"key={answer_key} — CoT tiebreaker failed/not run"),
                    "new_answer": None}

        if cot_ans == answer_key:
            return {**base,
                    "verdict":    "accept_key_cot_confirms",
                    "decision":   (f"Qwen+Claude both said {models_agree_on} but "
                                   f"Qwen-CoT sided with key={answer_key}"),
                    "new_answer": answer_key}

        if cot_ans == models_agree_on:
            return {**base,
                    "verdict":    "flag_answer_key",
                    "decision":   (f"All three model passes (Qwen={qwen_ans}, Claude={claude_ans}, "
                                   f"Qwen-CoT={cot_ans}) agree on {models_agree_on} — "
                                   f"answer key ({answer_key}) is likely wrong"),
                    "new_answer": models_agree_on}

        # CoT gives a third answer — three-way split
        return {**base,
                "verdict":    "human_review",
                "decision":   (f"Three-way split: Qwen={qwen_ans}, Claude={claude_ans}, "
                               f"Qwen-CoT={cot_ans}, Key={answer_key}"),
                "new_answer": None}

    # ── Qwen has no answer (re-run also failed) ───────────────────────────────
    if qwen_ans is None and claude_ans == answer_key:
        return {**base,
                "verdict":    "accept_key_llama_confirms",
                "decision":   f"Llama3 confirms key={answer_key}; Qwen re-run also failed",
                "new_answer": answer_key}

    if qwen_ans is None and claude_ans and claude_ans != answer_key:
        return {**base,
                "verdict":    "human_review",
                "decision":   f"Qwen failed; Llama3 says {claude_ans} vs key {answer_key}",
                "new_answer": None}

    # ── Full disagreement (Qwen≠Claude≠Key, all different) ───────────────────
    return {**base,
            "verdict":    "human_review",
            "decision":   (f"No consensus: Qwen={qwen_ans}, Claude={claude_ans}, Key={answer_key}"),
            "new_answer": None}

# ── Helpers ───────────────────────────────────────────────────────────────────

def _original_category(log_entry):
    if log_entry.get("error"):
        return "error"
    if not log_entry.get("answer_matches", True):
        return "mismatch"
    if log_entry.get("needs_review"):
        return "needs_review"
    return "unknown"

def _print_progress(label, done, total, extra=""):
    pct = done / total * 100 if total else 0
    sys.stdout.write(f"\r  {label} [{done}/{total}] {pct:.0f}%  {extra}   ")
    sys.stdout.flush()

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    questions = load_json(INPUT_FILE)
    log       = load_json(LOG_FILE)
    ckpt      = load_checkpoint()

    # ── Identify problem questions ────────────────────────────────────────────
    all_problem_idxs = set()
    for e in log:
        if e.get("error") or not e.get("answer_matches", True) or e.get("needs_review"):
            all_problem_idxs.add(e["index"])

    log_by_idx = {e["index"]: e for e in log}

    # Build ordered list, deduped
    problem_entries = [log_by_idx[i] for i in sorted(all_problem_idxs)]
    error_entries   = [e for e in problem_entries if e.get("error") == "parse_fail"]

    print(f"Problem questions : {len(problem_entries)}")
    print(f"  Parse-fail errors  : {len(error_entries)}  (need Qwen re-run)")
    print(f"  Already have Qwen  : {len(problem_entries) - len(error_entries)}")
    print()

    # ── Phase 1: Qwen re-runs for parse_fail errors ───────────────────────────
    qwen_rerun_cache: dict = {int(k): v for k, v in ckpt.get("qwen_rerun", {}).items()}
    errors_to_rerun = [e for e in error_entries if e["index"] not in qwen_rerun_cache]

    if errors_to_rerun:
        print(f"Phase 1 — Qwen re-run: {len(errors_to_rerun)} errors "
              f"({len(qwen_rerun_cache)} already cached)")
        lock     = threading.Lock()
        done_ctr = [len(qwen_rerun_cache)]
        total_p1 = len(error_entries)

        def rerun_worker(log_entry):
            idx = log_entry["index"]
            raw, err = call_qwen_rerun(questions[idx])
            result = extract_json(raw) if raw else None
            entry = {
                "model_answer":   None,
                "calc":           "",
                "changes":        [],
                "answer_matches": None,
                "needs_review":   False,
                "error":          err,
            }
            if result and "fixes" in result:
                entry["model_answer"]   = result.get("model_answer")
                entry["calc"]           = result.get("calc", "")
                entry["changes"]        = result.get("changes", [])
                entry["needs_review"]   = result.get("needs_review", False)
                entry["error"]          = None
                ans_key = normalize_answer(questions[idx].get("correctAnswer"))
                entry["answer_matches"] = (
                    normalize_answer(result.get("model_answer")) == ans_key
                )
            elif result:
                # Returned unexpected structure — still try to get model_answer
                entry["model_answer"] = result.get("model_answer") or result.get("answer")
                if entry["model_answer"]:
                    ans_key = normalize_answer(questions[idx].get("correctAnswer"))
                    entry["answer_matches"] = (
                        normalize_answer(entry["model_answer"]) == ans_key
                    )
            with lock:
                qwen_rerun_cache[idx] = entry
                done_ctr[0] += 1
                _print_progress("Qwen re-run", done_ctr[0], total_p1)
                if done_ctr[0] % CHECKPOINT_EVERY == 0:
                    ckpt["qwen_rerun"] = {str(k): v for k, v in qwen_rerun_cache.items()}
                    save_checkpoint(ckpt)

        with ThreadPoolExecutor(max_workers=WORKERS_QWEN) as pool:
            futures = [pool.submit(rerun_worker, e) for e in errors_to_rerun]
            for f in as_completed(futures):
                f.result()

        ckpt["qwen_rerun"] = {str(k): v for k, v in qwen_rerun_cache.items()}
        save_checkpoint(ckpt)

        success = sum(1 for v in qwen_rerun_cache.values() if v.get("model_answer"))
        print(f"\n  Recovered: {success}/{len(error_entries)} errors now have a Qwen answer\n")
    else:
        print(f"Phase 1 — Qwen re-run: all {len(error_entries)} cached, skipping\n")

    # ── Phase 2: Claude API for all problem questions ─────────────────────────
    claude_cache: dict = {int(k): v for k, v in ckpt.get("claude", {}).items()}
    to_verify = [e for e in problem_entries if e["index"] not in claude_cache]

    if to_verify:
        client   = OpenAI(base_url=LLAMA_BASE_URL, api_key=LLAMA_API_KEY)
        lock     = threading.Lock()
        done_ctr = [len(claude_cache)]
        total_p2 = len(problem_entries)

        print(f"Phase 2 — Llama3 (remote Ollama): {len(to_verify)} questions "
              f"({len(claude_cache)} already cached)")

        def claude_worker(log_entry):
            idx = log_entry["index"]
            result, err = call_llama3(questions[idx], client)
            with lock:
                claude_cache[idx] = {"result": result, "error": err}
                done_ctr[0] += 1
                _print_progress("Llama3", done_ctr[0], total_p2)
                if done_ctr[0] % CHECKPOINT_EVERY == 0:
                    ckpt["claude"] = {str(k): v for k, v in claude_cache.items()}
                    save_checkpoint(ckpt)

        with ThreadPoolExecutor(max_workers=WORKERS_CLAUDE) as pool:
            futures = [pool.submit(claude_worker, e) for e in to_verify]
            for f in as_completed(futures):
                f.result()

        ckpt["claude"] = {str(k): v for k, v in claude_cache.items()}
        save_checkpoint(ckpt)

        errs = sum(1 for v in claude_cache.values() if v.get("error"))
        print(f"\n  Done — Llama3 errors: {errs}/{len(problem_entries)}\n")
    else:
        print(f"Phase 2 — Llama3: all {len(problem_entries)} cached, skipping\n")

    # ── Phase 3a: Find questions needing CoT tiebreaker ──────────────────────
    #   Condition: Qwen answer == Claude answer AND both disagree with key
    #              AND Claude is not needs_review AND Claude confidence != low

    def get_qwen_answer(log_entry):
        idx = log_entry["index"]
        if log_entry.get("error") == "parse_fail":
            rerun = qwen_rerun_cache.get(idx, {})
            return rerun.get("model_answer"), rerun.get("calc", "")
        return log_entry.get("model_answer"), log_entry.get("calc", "")

    needs_cot = []
    for e in problem_entries:
        idx        = e["index"]
        q          = questions[idx]
        answer_key = normalize_answer(q.get("correctAnswer"))
        qwen_ans, _  = get_qwen_answer(e)
        qwen_ans   = normalize_answer(qwen_ans)
        c_entry    = claude_cache.get(idx, {})
        claude_res = c_entry.get("result")
        claude_ans = normalize_answer((claude_res or {}).get("model_answer"))

        if (qwen_ans and claude_ans
                and qwen_ans == claude_ans
                and qwen_ans != answer_key
                and not (claude_res or {}).get("needs_review")
                and (claude_res or {}).get("confidence", "high") != "low"):
            needs_cot.append(e)

    cot_cache: dict = {int(k): v for k, v in ckpt.get("cot", {}).items()}
    cot_to_run = [e for e in needs_cot if e["index"] not in cot_cache]

    print(f"Phase 3a — CoT tiebreaker: {len(needs_cot)} questions "
          f"({len(cot_cache)} cached, {len(cot_to_run)} to run)")

    if cot_to_run:
        done_ctr = [len(cot_cache)]
        for e in cot_to_run:
            idx        = e["index"]
            q          = questions[idx]
            answer_key = normalize_answer(q.get("correctAnswer"))
            qwen_ans, _ = get_qwen_answer(e)
            qwen_ans   = normalize_answer(qwen_ans)

            raw, err = call_qwen_cot(q, answer_key, qwen_ans)
            cot_result = extract_json(raw) if raw else None
            cot_cache[idx] = {"result": cot_result, "error": err}

            done_ctr[0] += 1
            _print_progress("Qwen CoT", done_ctr[0], len(needs_cot),
                            f"idx={idx}")

        ckpt["cot"] = {str(k): v for k, v in cot_cache.items()}
        save_checkpoint(ckpt)
        print()

    print()

    # ── Phase 3b: Arbitrate all ───────────────────────────────────────────────
    print("Phase 3b — Arbitrating...")
    all_results = []

    for e in problem_entries:
        idx        = e["index"]
        q          = questions[idx]
        qwen_ans, qwen_calc = get_qwen_answer(e)
        c_entry    = claude_cache.get(idx, {})
        cot_entry  = cot_cache.get(idx, {})

        verdict = arbitrate(
            index=idx,
            question=q,
            qwen_answer=qwen_ans,
            qwen_calc=qwen_calc,
            claude_result=c_entry.get("result"),
            cot_result=cot_entry.get("result") if cot_entry else None,
            original_category=_original_category(e),
        )
        all_results.append(verdict)

    all_results.sort(key=lambda x: x["index"])

    # ── Bucket results ────────────────────────────────────────────────────────
    RESOLVED_VERDICTS = {
        "unanimous",
        "accept_key_claude_confirms",
        "accept_key_qwen_confirms",
        "accept_key_cot_confirms",
        "flag_answer_key",
    }

    auto_resolved  = [r for r in all_results if r["verdict"] in RESOLVED_VERDICTS]
    human_review   = [r for r in all_results if r["verdict"] == "human_review"]
    image_dep      = [r for r in all_results if r["verdict"] == "image_dependent"]
    key_suspects   = [r for r in all_results if r["verdict"] == "flag_answer_key"]

    # ── Save outputs ──────────────────────────────────────────────────────────
    save_json(OUTPUT_RESULTS,  all_results)
    save_json(OUTPUT_RESOLVED, auto_resolved)
    save_json(OUTPUT_REVIEW,   human_review + image_dep)
    save_json(OUTPUT_SUSPECTS, key_suspects)

    # Cleanup checkpoint
    if os.path.exists(CKPT_FILE):
        os.remove(CKPT_FILE)

    # ── Summary ───────────────────────────────────────────────────────────────
    from collections import Counter
    verdict_counts = Counter(r["verdict"] for r in all_results)

    print(f"\n{'='*60}")
    print(f"DOUBLE PASS COMPLETE — {len(all_results)} problem questions")
    print()
    print(f"  Verdict breakdown:")
    for v, n in verdict_counts.most_common():
        print(f"    {v:<40} {n}")
    print()
    print(f"  Auto-resolved      : {len(auto_resolved)}")
    print(f"  Human review       : {len(human_review)}")
    print(f"  Image-dependent    : {len(image_dep)}")
    print(f"  Answer key suspects: {len(key_suspects)}")
    print()
    print(f"  → {OUTPUT_RESULTS}")
    print(f"  → {OUTPUT_RESOLVED}")
    print(f"  → {OUTPUT_REVIEW}")
    print(f"  → {OUTPUT_SUSPECTS}")

    if key_suspects:
        print(f"\n⚠  Answer key suspects (all model passes disagree with key):")
        for r in key_suspects[:15]:
            print(f"  [{r['index']:4d}] Key={r['answer_key']}  "
                  f"Qwen={r['qwen_answer']}  Claude={r['claude_answer']}  "
                  f"CoT={r['qwen_cot_answer']}  |  {r.get('testName','')[:50]}")
        if len(key_suspects) > 15:
            print(f"  ...+{len(key_suspects) - 15} more — see answer_key_suspects.json")


if __name__ == "__main__":
    main()
