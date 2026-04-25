#!/usr/bin/env python3.11
"""
Confirmation pass for flagged SAT math questions using qwen/qwen3-6-plus via OpenRouter.

Targets: verdict in {human_review, flag_answer_key} — 99 questions.
Adds Qwen3.6-plus as a third opinion, re-arbitrates, outputs final files.

Run:    nohup python3.11 -u scripts/qwen_confirm_pass.py > scripts/qwen_confirm.log 2>&1 &
Resume: just re-run — checkpoint auto-loaded.
"""

import json
import os
import re
import sys
import threading
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI

# ── Config ────────────────────────────────────────────────────────────────────

OPENROUTER_URL = "https://openrouter.ai/api/v1"
OPENROUTER_KEY = "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"
QWEN_PLUS_MODEL = "qwen/qwen3.6-plus"

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE   = os.path.join(SCRIPT_DIR, "math_review.json")
RESULTS_FILE = os.path.join(SCRIPT_DIR, "double_pass_results.json")
CKPT_FILE    = os.path.join(SCRIPT_DIR, "qwen_confirm_checkpoint.json")

OUTPUT_RESULTS  = os.path.join(SCRIPT_DIR, "double_pass_results_final.json")
OUTPUT_RESOLVED = os.path.join(SCRIPT_DIR, "auto_resolved.json")
OUTPUT_REVIEW   = os.path.join(SCRIPT_DIR, "human_review.json")
OUTPUT_SUSPECTS = os.path.join(SCRIPT_DIR, "answer_key_suspects.json")

WORKERS          = 8
MAX_RETRIES      = 4
CHECKPOINT_EVERY = 10
REQUEST_DELAY    = 0.3  # seconds between requests

TARGET_VERDICTS = {"human_review", "flag_answer_key"}

# Patterns that indicate the question needs an image/table/graph not in the text
_EXT_RE = re.compile(
    r'(based on|refer(s)? to|according to|use the|shown in|from the|in the|as shown|depicted)'
    r'.{0,35}(table|graph|chart|figure|diagram|image|plot|data|survey|scatter|histogram)',
    re.I,
)

def needs_external(question):
    """True if question requires an image, table, or graph the model can't see."""
    if question.get("questionImages"):
        return True
    text = (question.get("text") or "") + " " + (question.get("prompt") or "")
    return bool(_EXT_RE.search(text))

RESOLVED_VERDICTS = {
    "unanimous",
    "accept_key_llama3_confirms",
    "accept_key_llama_confirms",
    "accept_key_qwen_confirms",
    "accept_key_qwen_plus_confirms",
    "accept_key_cot_confirms",
    "accept_key_multi_confirms",
    "flag_answer_key",
    "image_dependent",
}

# ── Prompt ────────────────────────────────────────────────────────────────────

VERIFY_SYSTEM = """\
You are a precise SAT math verifier. Solve the question and identify the correct answer.

Input JSON has: text, choices, correctAnswer, type.

SOLVE it completely. Show your working in "calc".

Return ONLY this exact JSON (no markdown fences, no extra keys):
{
  "calc": "complete step-by-step solution",
  "model_answer": "A",
  "confidence": "high",
  "needs_review": false,
  "review_reason": ""
}

Rules:
- "model_answer": single letter A/B/C/D or a numeric value for grid-in
- "confidence": "high" (certain), "medium" (one approach checked), "low" (guessing)
- "needs_review": true ONLY if question requires an unseen image/table or is incoherent
- Do NOT include "fixes" or "corrected" keys
- Do NOT wrap in markdown fences\
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
    return {"results": {}}

_SEND_FIELDS = {"text", "prompt", "passage", "choices", "correctAnswer", "type"}

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
    depth, in_str, esc = 0, False, False
    for i, ch in enumerate(text[start:], start):
        if esc:        esc = False; continue
        if ch == "\\": esc = True;  continue
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

# ── Model call ────────────────────────────────────────────────────────────────

def call_qwen_plus(question, client, retries=0):
    try:
        response = client.chat.completions.create(
            model=QWEN_PLUS_MODEL,
            max_tokens=1200,
            temperature=0,
            messages=[
                {"role": "system", "content": VERIFY_SYSTEM},
                {"role": "user",   "content": json.dumps(slim(question), ensure_ascii=False)},
            ],
        )
        text = response.choices[0].message.content
        result = extract_json(text)
        if result and result.get("model_answer"):
            return result, None
        return None, f"parse_fail: {(text or '')[:300]}"
    except Exception as e:
        err_str = str(e)
        if retries < MAX_RETRIES:
            if "429" in err_str or "rate" in err_str.lower():
                wait = 30 * (retries + 1)
                sys.stdout.write(f"\n  ⏳ 429 — waiting {wait}s (retry {retries+1}/{MAX_RETRIES})...\n")
                sys.stdout.flush()
            else:
                wait = 2 ** retries
            time.sleep(wait)
            return call_qwen_plus(question, client, retries + 1)
        return None, err_str

# ── Arbitration ───────────────────────────────────────────────────────────────

def arbitrate(index, question, original_result, qwen_plus_result):
    answer_key    = normalize_answer(question.get("correctAnswer"))
    qwen_ans      = normalize_answer(original_result.get("qwen_answer"))
    llama_ans     = normalize_answer(original_result.get("llama_answer"))
    qwen_plus_ans = normalize_answer((qwen_plus_result or {}).get("model_answer"))
    cot_ans       = normalize_answer(original_result.get("qwen_cot_answer"))

    base = {
        "index":              index,
        "id":                 original_result.get("id"),
        "testName":           original_result.get("testName"),
        "original_category":  original_result.get("original_category"),
        "answer_key":         answer_key,
        "previous_answer":    original_result.get("previous_answer", answer_key),
        "qwen_answer":        qwen_ans,
        "llama_answer":       llama_ans,
        "qwen_plus_answer":   qwen_plus_ans,
        "qwen_cot_answer":    cot_ans,
        "qwen_calc":          original_result.get("qwen_calc", ""),
        "llama_calc":         original_result.get("llama_calc", ""),
        "qwen_plus_calc":     (qwen_plus_result or {}).get("calc", ""),
        "qwen_cot_calc":      original_result.get("qwen_cot_calc", ""),
        "qwen_plus_confidence": (qwen_plus_result or {}).get("confidence", ""),
    }

    # Collect available model answers
    available = {k: v for k, v in [
        ("Qwen2.5", qwen_ans),
        ("Llama3",  llama_ans),
        ("QwenPlus", qwen_plus_ans),
    ] if v is not None}

    if not available:
        return {**base, "verdict": "human_review",
                "decision": "All models failed", "new_answer": None}

    votes = Counter(available.values())
    top_ans, top_count = votes.most_common(1)[0]
    total_models = len(available)
    key_votes = sum(1 for a in available.values() if a == answer_key)

    # Majority confirms key
    if key_votes > total_models / 2:
        confirmers = [n for n, a in available.items() if a == answer_key]
        dissenters = [n for n, a in available.items() if a != answer_key]
        verdict = "accept_key_multi_confirms" if len(confirmers) > 1 else f"accept_key_{confirmers[0].lower()}_confirms"
        decision = f"{'+'.join(confirmers)} confirm key={answer_key}"
        if dissenters:
            dissent_ans = [a for n, a in available.items() if n in dissenters]
            decision += f"; {'+'.join(dissenters)} said {dissent_ans[0]}"
        return {**base, "verdict": verdict, "decision": decision, "new_answer": answer_key}

    # All available agree on something other than key
    if top_count == total_models and top_ans != answer_key:
        if cot_ans == answer_key:
            return {**base, "verdict": "accept_key_cot_confirms",
                    "decision": f"All models said {top_ans} but CoT confirms key={answer_key}",
                    "new_answer": answer_key}
        verdict = "flag_answer_key"
        decision = (f"All models ({'+'.join(available.keys())}={top_ans}"
                    + (f", CoT={cot_ans}" if cot_ans else "")
                    + f") disagree with key={answer_key} — likely wrong key")
        return {**base, "verdict": verdict, "decision": decision, "new_answer": top_ans}

    # Majority disagrees with key
    if top_count > key_votes and top_ans != answer_key:
        dissenters = [n for n, a in available.items() if a == top_ans]
        return {**base, "verdict": "human_review",
                "decision": (f"Majority ({'+'.join(dissenters)}) say {top_ans} "
                             f"vs key={answer_key}"),
                "new_answer": None}

    # Split
    return {**base, "verdict": "human_review",
            "decision": (f"Split: {', '.join(f'{n}={a}' for n, a in available.items())}, "
                         f"key={answer_key}"),
            "new_answer": None}

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    questions_list = load_json(INPUT_FILE)
    questions = {i: q for i, q in enumerate(questions_list)}
    results   = load_json(RESULTS_FILE)
    ckpt      = load_checkpoint()
    cache     = {int(k): v for k, v in ckpt.get("results", {}).items()}

    # Target only flagged questions
    flagged     = [r for r in results if r.get("verdict") in TARGET_VERDICTS]
    ext_indices = {r["index"] for r in flagged if needs_external(questions[r["index"]])}
    solvable    = [r for r in flagged if r["index"] not in ext_indices]
    to_run      = [r for r in solvable if r["index"] not in cache]

    print(f"Flagged questions : {len(flagged)}")
    print(f"Skipped (external): {len(ext_indices)}  — image/table/graph dependent")
    print(f"Solvable          : {len(solvable)}")
    print(f"Already cached    : {len(cache)}")
    print(f"To run            : {len(to_run)}")
    print(f"Model             : {QWEN_PLUS_MODEL}")
    print(f"Workers           : {WORKERS}\n")

    if to_run:
        client   = OpenAI(base_url=OPENROUTER_URL, api_key=OPENROUTER_KEY)
        lock     = threading.Lock()
        done_ctr = [len(cache)]

        def worker(result_entry):
            idx = result_entry["index"]
            q   = questions[idx]
            res, err = call_qwen_plus(q, client)
            with lock:
                cache[idx] = {"result": res, "error": err}
                done_ctr[0] += 1
                status = f"✓ {res.get('model_answer','?')}" if (res and res.get("model_answer")) else f"✗ {err[:40] if err else ''}"
                pct = done_ctr[0] / len(flagged) * 100
                sys.stdout.write(f"\r  [{done_ctr[0]}/{len(flagged)}] {pct:.0f}%  last={status}   ")
                sys.stdout.flush()
                if done_ctr[0] % CHECKPOINT_EVERY == 0:
                    ckpt["results"] = {str(k): v for k, v in cache.items()}
                    save_json(CKPT_FILE, ckpt)
            time.sleep(REQUEST_DELAY)

        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = [pool.submit(worker, r) for r in to_run]
            for f in as_completed(futures):
                f.result()

        ckpt["results"] = {str(k): v for k, v in cache.items()}
        save_json(CKPT_FILE, ckpt)

        ok   = sum(1 for v in cache.values() if v.get("result") and v["result"].get("model_answer"))
        errs = sum(1 for v in cache.values() if v.get("error"))
        print(f"\n  ✓ answers: {ok}/{len(flagged)}  |  errors: {errs}\n")
    else:
        print("All cached — proceeding to re-arbitration\n")

    # ── Re-arbitrate ──────────────────────────────────────────────────────────
    print("Re-arbitrating...")

    flagged_indices = {r["index"] for r in flagged}
    new_results = []

    for r in results:
        idx = r["index"]
        if idx not in flagged_indices:
            new_results.append(r)
            continue

        # Questions needing external material — mark and skip
        if idx in ext_indices:
            new_results.append({**r, "verdict": "image_dependent",
                                 "decision": "Requires image/table/graph not available to model"})
            continue

        entry     = cache.get(idx, {})
        qwen_plus = entry.get("result")
        new_r     = arbitrate(idx, questions[idx], r, qwen_plus)
        new_results.append(new_r)

    # ── Write outputs ─────────────────────────────────────────────────────────
    save_json(OUTPUT_RESULTS, new_results)

    resolved = [r for r in new_results if r.get("verdict") in RESOLVED_VERDICTS]
    review   = [r for r in new_results if r.get("verdict") == "human_review"]
    suspects = [r for r in new_results if r.get("verdict") == "flag_answer_key"]

    save_json(OUTPUT_RESOLVED, resolved)
    save_json(OUTPUT_REVIEW,   review)
    save_json(OUTPUT_SUSPECTS, suspects)

    # ── Summary ───────────────────────────────────────────────────────────────
    verdict_counts = Counter(r.get("verdict") for r in new_results)
    print(f"\n{'='*55}")
    print(f"DONE — {len(new_results)} questions processed")
    print(f"\nVerdict breakdown:")
    for v, c in verdict_counts.most_common():
        resolved_mark = "✓" if v in RESOLVED_VERDICTS else "⚠"
        print(f"  {resolved_mark} {v}: {c}")
    print(f"\nResolved  : {len(resolved)}")
    print(f"Review    : {len(review)}")
    print(f"Key flags : {len(suspects)}")
    print(f"\n→ {OUTPUT_RESULTS}")
    print(f"→ {OUTPUT_RESOLVED}")
    print(f"→ {OUTPUT_REVIEW}")
    print(f"→ {OUTPUT_SUSPECTS}")

    if suspects:
        print(f"\n⚠ Likely wrong answer keys:")
        for s in suspects:
            models = []
            for k in ("qwen_answer", "llama_answer", "qwen_plus_answer"):
                if s.get(k): models.append(f"{k.split('_')[0]}={s[k]}")
            print(f"  [{s['index']}] {s.get('id','?')[:40]}  key={s['answer_key']}  {', '.join(models)}")

    if os.path.exists(CKPT_FILE):
        os.remove(CKPT_FILE)


if __name__ == "__main__":
    main()
