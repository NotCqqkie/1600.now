#!/usr/bin/env python3.11
"""
Double-pass verification for SAT math problem questions.

Both models run on the REMOTE Ollama instance at 100.85.13.87 — no local
inference. Two different model families for independent verification:

  Model A: qwen2.5:14b  (Qwen family — re-runs + CoT tiebreaker)
  Model B: llama3        (Llama family — independent verification)

Three phases:
  1. Re-run Qwen2.5 for the 79 parse_fail errors.
  2. Independent solve via Llama3 for ALL 200 problem questions.
  3. Arbitration — 3-way compare: Qwen vs Llama vs answer key.
       - Both agree with key        → unanimous
       - One confirms key           → accept key
       - Both DISAGREE with key     → Qwen2.5 CoT tiebreaker
       - Full split                 → human review

Run:  python3.11 scripts/verify_double_pass.py
Resume: just re-run — checkpoint auto-loaded.

Outputs (in scripts/):
  double_pass_results.json     — full per-question audit trail
  auto_resolved.json           — confidently resolved
  human_review.json            — needs human eyes
  answer_key_suspects.json     — both models + CoT disagree with key
"""

import json
import os
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from openai import OpenAI

# ── Config ────────────────────────────────────────────────────────────────────

REMOTE_BASE_URL = "http://100.85.13.87:11434/v1"
REMOTE_API_KEY  = "ollama"

QWEN_MODEL  = "qwen2.5:14b"
LLAMA_MODEL = "llama3:latest"

SCRIPT_DIR      = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE      = os.path.join(SCRIPT_DIR, "math_review.json")
LOG_FILE        = os.path.join(SCRIPT_DIR, "verification_log.json")
CKPT_FILE       = os.path.join(SCRIPT_DIR, "double_pass_checkpoint.json")

OUTPUT_RESULTS  = os.path.join(SCRIPT_DIR, "double_pass_results.json")
OUTPUT_RESOLVED = os.path.join(SCRIPT_DIR, "auto_resolved.json")
OUTPUT_REVIEW   = os.path.join(SCRIPT_DIR, "human_review.json")
OUTPUT_SUSPECTS = os.path.join(SCRIPT_DIR, "answer_key_suspects.json")

WORKERS_QWEN  = 2    # share one GPU — keep modest
WORKERS_LLAMA = 2
MAX_RETRIES    = 4
CHECKPOINT_EVERY = 10  # save often — no more 25-question gaps

# ── Prompts ───────────────────────────────────────────────────────────────────

VERIFY_SYSTEM = """\
IMPORTANT: Return ONLY the JSON schema shown below. No other structure.

Fix and verify a SAT math question. Input is JSON with: text, choices, correctAnswer, type.

FIX in "text" and choice "text" fields only:
- Asterisk italics: "*x*"→"$x$", "*x**2*"→"$x^2$", "*f*(*x*)"→"$f(x)$"
- Bare math: "y=2x+3"→"$y=2x+3$", "x2+5"→"$x^2+5$"
- Bare symbols: ≤ ≥ ≠ π → wrap in $...$
- Obvious typos in English prose only

SOLVE the question completely. If unsolvable (missing image/table/context), \
set needs_review to true.

Return ONLY this exact JSON (no markdown fences, no extra keys):
{
  "fixes": {"text": "corrected text", "choices": [{"id":"A","text":"corrected"}]},
  "changes": ["text:old→new"],
  "calc": "complete step-by-step solution",
  "model_answer": "D",
  "confidence": "high",
  "needs_review": false,
  "review_reason": ""
}

Rules:
- "fixes" contains ONLY fields that changed. If nothing changed: "fixes": {}
- "confidence": "high" (certain), "medium" (ambiguous), "low" (guessing)
- "needs_review": true ONLY if question requires unseen image/table or is incoherent
- Do NOT add a "corrected" key. Do NOT wrap in markdown fences.\
"""

COT_SYSTEM = """\
Carefully re-examine this SAT math question. Show ALL work step by step.

Context: The official answer key says {answer_key}. \
Two different models both solved it and got {models_answer} instead. \
Re-examine from scratch — the answer key may be wrong, or both models may share a mistake.

Think through the problem very carefully. Show every step of your work.

Return ONLY this JSON (no markdown fences):
{{
  "calc": "detailed step-by-step solution showing ALL work",
  "model_answer": "A",
  "reasoning": "brief explanation of why this is the correct answer"
}}\
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
    return {"qwen": {}, "llama": {}, "cot": {}}

def save_checkpoint(ckpt):
    save_json(CKPT_FILE, ckpt)

_SEND_FIELDS = {"text", "prompt", "passage", "choices", "correctAnswer", "type", "questionImages"}

def slim(question):
    return {k: v for k, v in question.items() if k in _SEND_FIELDS and v is not None}

# ── JSON extraction ───────────────────────────────────────────────────────────

def extract_json(text):
    if not text:
        return None
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text.strip()).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
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

# ── Model calls (all remote) ─────────────────────────────────────────────────

def call_model(question, client, model, system_prompt, max_tokens=1800, retries=0):
    """Generic call to any model on the remote Ollama via OpenAI-compat endpoint."""
    try:
        response = client.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            temperature=0,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": json.dumps(slim(question), ensure_ascii=False)},
            ],
        )
        text = response.choices[0].message.content
        result = extract_json(text)
        if result:
            return result, None
        return None, f"parse_fail: {text[:300]}"
    except Exception as e:
        if retries < MAX_RETRIES:
            time.sleep(2 ** retries)
            return call_model(question, client, model, system_prompt, max_tokens, retries + 1)
        return None, str(e)

def call_cot(question, client, answer_key, models_answer, retries=0):
    """Qwen2.5 CoT tiebreaker — detailed step-by-step re-examination."""
    system = COT_SYSTEM.format(answer_key=answer_key, models_answer=models_answer)
    try:
        response = client.chat.completions.create(
            model=QWEN_MODEL,
            max_tokens=3000,
            temperature=0,
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": json.dumps(slim(question), ensure_ascii=False)},
            ],
        )
        text = response.choices[0].message.content
        result = extract_json(text)
        if result:
            return result, None
        return None, f"parse_fail: {text[:300]}"
    except Exception as e:
        if retries < MAX_RETRIES:
            time.sleep(2 ** retries)
            return call_cot(question, client, answer_key, models_answer, retries + 1)
        return None, str(e)

# ── Arbitration ───────────────────────────────────────────────────────────────

def arbitrate(index, question, qwen_result, llama_result, cot_result, original_category):
    answer_key = normalize_answer(question.get("correctAnswer"))
    qwen_ans   = normalize_answer((qwen_result or {}).get("model_answer"))
    llama_ans  = normalize_answer((llama_result or {}).get("model_answer"))
    cot_ans    = normalize_answer((cot_result or {}).get("model_answer"))

    qwen_confidence  = (qwen_result or {}).get("confidence", "high")
    llama_confidence = (llama_result or {}).get("confidence", "high")
    llama_needs_review = (llama_result or {}).get("needs_review", False)
    qwen_needs_review  = (qwen_result or {}).get("needs_review", False)

    base = {
        "index":             index,
        "id":                question.get("id"),
        "testName":          question.get("testName"),
        "original_category": original_category,
        "answer_key":        answer_key,
        "previous_answer":   answer_key,
        "qwen_answer":       qwen_ans,
        "llama_answer":      llama_ans,
        "qwen_cot_answer":   cot_ans,
        "qwen_confidence":   qwen_confidence,
        "llama_confidence":  llama_confidence,
        "qwen_calc":         (qwen_result or {}).get("calc", ""),
        "llama_calc":        (llama_result or {}).get("calc", ""),
        "qwen_cot_calc":     (cot_result or {}).get("calc", ""),
        "qwen_cot_reasoning": (cot_result or {}).get("reasoning", ""),
    }

    # ── Cannot solve (missing image/table) ────────────────────────────────────
    if llama_needs_review and qwen_needs_review:
        reason = (llama_result or {}).get("review_reason", "") or \
                 (qwen_result or {}).get("review_reason", "requires unseen content")
        return {**base, "verdict": "image_dependent",
                "decision": f"Both models: {reason}", "new_answer": None}

    if llama_needs_review or qwen_needs_review:
        working = "Qwen" if llama_needs_review else "Llama3"
        working_ans = qwen_ans if llama_needs_review else llama_ans
        if working_ans == answer_key:
            return {**base, "verdict": f"accept_key_{working.lower()}_confirms",
                    "decision": f"{working} confirms key={answer_key}; other model can't solve",
                    "new_answer": answer_key}
        return {**base, "verdict": "human_review",
                "decision": f"One model can't solve; {working} says {working_ans} vs key={answer_key}",
                "new_answer": None}

    # ── Both calls failed ─────────────────────────────────────────────────────
    if qwen_result is None and llama_result is None:
        return {**base, "verdict": "human_review",
                "decision": "Both model calls failed", "new_answer": None}

    # ── Low confidence ────────────────────────────────────────────────────────
    if llama_confidence == "low" and qwen_confidence == "low":
        return {**base, "verdict": "human_review",
                "decision": "Both models low confidence", "new_answer": None}

    # ── Unanimous ─────────────────────────────────────────────────────────────
    if qwen_ans == answer_key and llama_ans == answer_key:
        return {**base, "verdict": "unanimous",
                "decision": f"All agree: {answer_key}", "new_answer": answer_key}

    # ── Llama confirms key, Qwen was wrong ────────────────────────────────────
    if llama_ans == answer_key and qwen_ans != answer_key:
        return {**base, "verdict": "accept_key_llama_confirms",
                "decision": f"Llama3 confirms key={answer_key}; Qwen said {qwen_ans}",
                "new_answer": answer_key}

    # ── Qwen confirms key, Llama was wrong ────────────────────────────────────
    if qwen_ans == answer_key and llama_ans != answer_key:
        return {**base, "verdict": "accept_key_qwen_confirms",
                "decision": f"Qwen confirms key={answer_key}; Llama3 said {llama_ans}",
                "new_answer": answer_key}

    # ── Both DISAGREE with key (same answer) → CoT tiebreaker ─────────────────
    if qwen_ans and llama_ans and qwen_ans == llama_ans and qwen_ans != answer_key:
        models_agree_on = qwen_ans
        if cot_result is None:
            return {**base, "verdict": "human_review",
                    "decision": (f"Qwen={qwen_ans} + Llama3={llama_ans} disagree with "
                                 f"key={answer_key} — CoT tiebreaker failed"),
                    "new_answer": None}
        if cot_ans == answer_key:
            return {**base, "verdict": "accept_key_cot_confirms",
                    "decision": (f"Qwen+Llama3 both said {models_agree_on} but "
                                 f"Qwen-CoT sided with key={answer_key}"),
                    "new_answer": answer_key}
        if cot_ans == models_agree_on:
            return {**base, "verdict": "flag_answer_key",
                    "decision": (f"All 3 passes (Qwen={qwen_ans}, Llama3={llama_ans}, "
                                 f"CoT={cot_ans}) agree on {models_agree_on} — "
                                 f"answer key ({answer_key}) likely wrong"),
                    "new_answer": models_agree_on}
        return {**base, "verdict": "human_review",
                "decision": (f"Three-way split: Qwen={qwen_ans}, Llama3={llama_ans}, "
                             f"CoT={cot_ans}, Key={answer_key}"),
                "new_answer": None}

    # ── Both disagree with key (different answers) ────────────────────────────
    if qwen_ans and llama_ans and qwen_ans != llama_ans and \
       qwen_ans != answer_key and llama_ans != answer_key:
        return {**base, "verdict": "human_review",
                "decision": (f"Full split: Qwen={qwen_ans}, Llama3={llama_ans}, "
                             f"Key={answer_key}"),
                "new_answer": None}

    # ── One model failed, other confirms key ──────────────────────────────────
    if qwen_ans is None and llama_ans == answer_key:
        return {**base, "verdict": "accept_key_llama_confirms",
                "decision": f"Llama3 confirms key={answer_key}; Qwen failed",
                "new_answer": answer_key}
    if llama_ans is None and qwen_ans == answer_key:
        return {**base, "verdict": "accept_key_qwen_confirms",
                "decision": f"Qwen confirms key={answer_key}; Llama3 failed",
                "new_answer": answer_key}

    # ── Fallback ──────────────────────────────────────────────────────────────
    return {**base, "verdict": "human_review",
            "decision": f"Unhandled: Qwen={qwen_ans}, Llama3={llama_ans}, Key={answer_key}",
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

def _progress(label, done, total, extra=""):
    pct = done / total * 100 if total else 0
    sys.stdout.write(f"\r  {label} [{done}/{total}] {pct:.0f}%  {extra}   ")
    sys.stdout.flush()

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    questions = load_json(INPUT_FILE)
    log       = load_json(LOG_FILE)
    ckpt      = load_checkpoint()

    client = OpenAI(base_url=REMOTE_BASE_URL, api_key=REMOTE_API_KEY)

    # Quick connectivity check
    print(f"Remote: {REMOTE_BASE_URL}")
    print(f"Models: {QWEN_MODEL} + {LLAMA_MODEL}")
    try:
        models = client.models.list()
        available = [m.id for m in models.data]
        print(f"Available: {available}")
        for needed in (QWEN_MODEL, LLAMA_MODEL):
            if needed not in available:
                print(f"\n✗ Model '{needed}' not found on remote! Pull it first:")
                print(f"  curl http://100.85.13.87:11434/api/pull -d '{{\"name\":\"{needed}\"}}'")
                return
    except Exception as e:
        print(f"\n✗ Cannot connect to remote Ollama: {e}")
        return
    print()

    # ── Identify problem questions ────────────────────────────────────────────
    all_problem_idxs = set()
    for e in log:
        if e.get("error") or not e.get("answer_matches", True) or e.get("needs_review"):
            all_problem_idxs.add(e["index"])

    log_by_idx = {e["index"]: e for e in log}
    problem_entries = [log_by_idx[i] for i in sorted(all_problem_idxs)]
    error_entries   = [e for e in problem_entries if e.get("error") == "parse_fail"]

    print(f"Problem questions : {len(problem_entries)}")
    print(f"  Parse-fail errors  : {len(error_entries)}  (need Qwen re-run)")
    print(f"  Already have Qwen  : {len(problem_entries) - len(error_entries)}")
    print()

    # ── Phase 1: Qwen2.5 re-runs for parse_fail errors ──────────────────────
    qwen_cache: dict = {int(k): v for k, v in ckpt.get("qwen", {}).items()}
    errors_to_rerun = [e for e in error_entries if e["index"] not in qwen_cache]

    if errors_to_rerun:
        print(f"Phase 1 — Qwen2.5 re-run: {len(errors_to_rerun)} errors "
              f"({len(qwen_cache)} cached)")
        lock     = threading.Lock()
        done_ctr = [len(qwen_cache)]
        total_p1 = len(error_entries)

        def qwen_rerun_worker(log_entry):
            idx = log_entry["index"]
            result, err = call_model(questions[idx], client, QWEN_MODEL, VERIFY_SYSTEM)
            entry = {"result": result, "error": err}
            with lock:
                qwen_cache[idx] = entry
                done_ctr[0] += 1
                _progress("Qwen re-run", done_ctr[0], total_p1)
                if done_ctr[0] % CHECKPOINT_EVERY == 0:
                    ckpt["qwen"] = {str(k): v for k, v in qwen_cache.items()}
                    save_checkpoint(ckpt)

        with ThreadPoolExecutor(max_workers=WORKERS_QWEN) as pool:
            futures = [pool.submit(qwen_rerun_worker, e) for e in errors_to_rerun]
            for f in as_completed(futures):
                f.result()

        ckpt["qwen"] = {str(k): v for k, v in qwen_cache.items()}
        save_checkpoint(ckpt)

        success = sum(1 for v in qwen_cache.values()
                      if v.get("result", {}) and v["result"].get("model_answer"))
        print(f"\n  Recovered: {success}/{len(error_entries)}\n")
    else:
        print(f"Phase 1 — Qwen re-run: all {len(error_entries)} cached, skipping\n")

    # ── Phase 2: Llama3 for ALL problem questions ────────────────────────────
    llama_cache: dict = {int(k): v for k, v in ckpt.get("llama", {}).items()}
    to_verify = [e for e in problem_entries if e["index"] not in llama_cache]

    if to_verify:
        lock     = threading.Lock()
        done_ctr = [len(llama_cache)]
        total_p2 = len(problem_entries)

        print(f"Phase 2 — Llama3: {len(to_verify)} questions "
              f"({len(llama_cache)} cached)")

        def llama_worker(log_entry):
            idx = log_entry["index"]
            result, err = call_model(questions[idx], client, LLAMA_MODEL, VERIFY_SYSTEM)
            with lock:
                llama_cache[idx] = {"result": result, "error": err}
                done_ctr[0] += 1
                _progress("Llama3", done_ctr[0], total_p2)
                if done_ctr[0] % CHECKPOINT_EVERY == 0:
                    ckpt["llama"] = {str(k): v for k, v in llama_cache.items()}
                    save_checkpoint(ckpt)

        with ThreadPoolExecutor(max_workers=WORKERS_LLAMA) as pool:
            futures = [pool.submit(llama_worker, e) for e in to_verify]
            for f in as_completed(futures):
                f.result()

        ckpt["llama"] = {str(k): v for k, v in llama_cache.items()}
        save_checkpoint(ckpt)

        errs = sum(1 for v in llama_cache.values() if v.get("error"))
        print(f"\n  Llama3 errors: {errs}/{len(problem_entries)}\n")
    else:
        print(f"Phase 2 — Llama3: all {len(problem_entries)} cached, skipping\n")

    # ── Build answer maps ─────────────────────────────────────────────────────

    def get_qwen_result(log_entry):
        """Get Qwen result — from re-run cache if parse_fail, else from original log."""
        idx = log_entry["index"]
        if log_entry.get("error") == "parse_fail":
            cached = qwen_cache.get(idx, {})
            return cached.get("result")
        # Non-error entries: reconstruct from original log
        return {
            "model_answer": log_entry.get("model_answer"),
            "calc":         log_entry.get("calc", ""),
            "confidence":   "high",
            "needs_review": log_entry.get("needs_review", False),
        }

    # ── Phase 3a: Find CoT tiebreaker candidates ────────────────────────────
    needs_cot = []
    for e in problem_entries:
        idx = e["index"]
        q   = questions[idx]
        answer_key = normalize_answer(q.get("correctAnswer"))

        qwen_res  = get_qwen_result(e)
        llama_res = (llama_cache.get(idx) or {}).get("result")
        qwen_ans  = normalize_answer((qwen_res or {}).get("model_answer"))
        llama_ans = normalize_answer((llama_res or {}).get("model_answer"))

        if (qwen_ans and llama_ans
                and qwen_ans == llama_ans
                and qwen_ans != answer_key
                and not (llama_res or {}).get("needs_review")
                and not (qwen_res or {}).get("needs_review")):
            needs_cot.append(e)

    cot_cache: dict = {int(k): v for k, v in ckpt.get("cot", {}).items()}
    cot_to_run = [e for e in needs_cot if e["index"] not in cot_cache]

    print(f"Phase 3a — CoT tiebreaker: {len(needs_cot)} questions "
          f"({len(cot_cache)} cached, {len(cot_to_run)} to run)")

    if cot_to_run:
        done_ctr = [len(cot_cache)]
        for e in cot_to_run:
            idx = e["index"]
            q   = questions[idx]
            answer_key = normalize_answer(q.get("correctAnswer"))
            qwen_res   = get_qwen_result(e)
            models_ans = normalize_answer((qwen_res or {}).get("model_answer"))

            result, err = call_cot(q, client, answer_key, models_ans)
            cot_cache[idx] = {"result": result, "error": err}

            done_ctr[0] += 1
            _progress("Qwen CoT", done_ctr[0], len(needs_cot), f"idx={idx}")

            if done_ctr[0] % CHECKPOINT_EVERY == 0:
                ckpt["cot"] = {str(k): v for k, v in cot_cache.items()}
                save_checkpoint(ckpt)

        ckpt["cot"] = {str(k): v for k, v in cot_cache.items()}
        save_checkpoint(ckpt)
        print()

    print()

    # ── Phase 3b: Arbitrate ──────────────────────────────────────────────────
    print("Phase 3b — Arbitrating...")
    all_results = []

    for e in problem_entries:
        idx = e["index"]
        q   = questions[idx]

        qwen_res  = get_qwen_result(e)
        llama_res = (llama_cache.get(idx) or {}).get("result")
        cot_res   = (cot_cache.get(idx) or {}).get("result") if idx in cot_cache else None

        verdict = arbitrate(idx, q, qwen_res, llama_res, cot_res, _original_category(e))
        all_results.append(verdict)

    all_results.sort(key=lambda x: x["index"])

    # ── Bucket & save ─────────────────────────────────────────────────────────
    RESOLVED_VERDICTS = {
        "unanimous", "accept_key_llama_confirms", "accept_key_llama3_confirms",
        "accept_key_qwen_confirms", "accept_key_cot_confirms", "flag_answer_key",
    }

    auto_resolved = [r for r in all_results if r["verdict"] in RESOLVED_VERDICTS]
    human_review  = [r for r in all_results if r["verdict"] == "human_review"]
    image_dep     = [r for r in all_results if r["verdict"] == "image_dependent"]
    key_suspects  = [r for r in all_results if r["verdict"] == "flag_answer_key"]

    save_json(OUTPUT_RESULTS,  all_results)
    save_json(OUTPUT_RESOLVED, auto_resolved)
    save_json(OUTPUT_REVIEW,   human_review + image_dep)
    save_json(OUTPUT_SUSPECTS, key_suspects)

    if os.path.exists(CKPT_FILE):
        os.remove(CKPT_FILE)

    # ── Summary ───────────────────────────────────────────────────────────────
    from collections import Counter
    verdict_counts = Counter(r["verdict"] for r in all_results)

    print(f"\n{'='*60}")
    print(f"DOUBLE PASS COMPLETE — {len(all_results)} problem questions")
    print()
    for v, n in verdict_counts.most_common():
        print(f"  {v:<40} {n}")
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
                  f"Qwen={r['qwen_answer']}  Llama3={r['llama_answer']}  "
                  f"CoT={r['qwen_cot_answer']}  |  {r.get('testName','')[:50]}")
        if len(key_suspects) > 15:
            print(f"  ...+{len(key_suspects) - 15} more")


if __name__ == "__main__":
    main()
