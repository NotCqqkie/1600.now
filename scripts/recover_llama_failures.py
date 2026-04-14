#!/usr/bin/env python3.11
"""
Recovery pass for questions where Llama3 returned no answer.

Reads double_pass_results.json, finds the 86 questions with llama_answer=None,
re-runs them with Google Gemma 4 31B via OpenRouter, then re-arbitrates and
updates all output files.

Run:  python3.11 scripts/recover_llama_failures.py
Resume: just re-run — checkpoint auto-loaded.
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

OPENROUTER_URL   = "https://openrouter.ai/api/v1"
OPENROUTER_KEY   = os.environ.get("OPENROUTER_API_KEY", "")
GEMMA_MODEL      = "google/gemma-4-31b-it:free"

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE   = os.path.join(SCRIPT_DIR, "math_review.json")
RESULTS_FILE = os.path.join(SCRIPT_DIR, "double_pass_results.json")
CKPT_FILE    = os.path.join(SCRIPT_DIR, "recovery_checkpoint.json")

OUTPUT_RESULTS  = os.path.join(SCRIPT_DIR, "double_pass_results.json")
OUTPUT_RESOLVED = os.path.join(SCRIPT_DIR, "auto_resolved.json")
OUTPUT_REVIEW   = os.path.join(SCRIPT_DIR, "human_review.json")
OUTPUT_SUSPECTS = os.path.join(SCRIPT_DIR, "answer_key_suspects.json")

WORKERS          = 1   # 1 worker to respect Google AI Studio per-minute RPM limit
MAX_RETRIES      = 6
CHECKPOINT_EVERY = 5
REQUEST_DELAY    = 6   # seconds between requests (stay under ~10 RPM free tier)

# ── Prompt — same as main script ─────────────────────────────────────────────

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
    return {"gemma": {}}

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

# ── Gemma call via OpenRouter ─────────────────────────────────────────────────

def call_gemma(question, client, retries=0):
    try:
        response = client.chat.completions.create(
            model=GEMMA_MODEL,
            max_tokens=1800,
            temperature=0,
            messages=[
                {"role": "system", "content": VERIFY_SYSTEM},
                {"role": "user",   "content": json.dumps(slim(question), ensure_ascii=False)},
            ],
        )
        text = response.choices[0].message.content
        result = extract_json(text)
        if result:
            return result, None
        return None, f"parse_fail: {text[:300]}"
    except Exception as e:
        err_str = str(e)
        if retries < MAX_RETRIES:
            # 429 rate limit: back off aggressively — 60, 120, 180, 240, 300, 360s
            if "429" in err_str or "rate" in err_str.lower():
                wait = 60 * (retries + 1)
                sys.stdout.write(f"\n  ⏳ 429 rate-limit — waiting {wait}s (retry {retries+1}/{MAX_RETRIES})...\n")
                sys.stdout.flush()
            else:
                wait = 2 ** retries
            time.sleep(wait)
            return call_gemma(question, client, retries + 1)
        return None, err_str

# ── Arbitration (same logic as main script) ──────────────────────────────────

def arbitrate(index, question, qwen_answer, qwen_calc, llama_answer, llama_calc,
              gemma_result, cot_result, original_category):
    """
    4-way arbitration: Qwen vs Llama vs Gemma (recovery) vs answer key.
    Gemma is used as an additional voice when Llama originally failed.
    """
    answer_key  = normalize_answer(question.get("correctAnswer"))
    qwen_ans    = normalize_answer(qwen_answer)
    llama_ans   = normalize_answer(llama_answer)
    gemma_ans   = normalize_answer((gemma_result or {}).get("model_answer"))
    cot_ans     = normalize_answer((cot_result or {}).get("model_answer"))

    gemma_confidence   = (gemma_result or {}).get("confidence", "high")
    gemma_needs_review = (gemma_result or {}).get("needs_review", False)
    gemma_calc         = (gemma_result or {}).get("calc", "")

    base = {
        "index":             index,
        "id":                question.get("id"),
        "testName":          question.get("testName"),
        "original_category": original_category,
        "answer_key":        answer_key,
        "previous_answer":   answer_key,
        "qwen_answer":       qwen_ans,
        "llama_answer":      llama_ans,
        "gemma_answer":      gemma_ans,
        "qwen_cot_answer":   cot_ans,
        "qwen_confidence":   "high",
        "llama_confidence":  "high" if llama_ans else None,
        "gemma_confidence":  gemma_confidence,
        "qwen_calc":         qwen_calc or "",
        "llama_calc":        llama_calc or "",
        "gemma_calc":        gemma_calc,
        "qwen_cot_calc":     (cot_result or {}).get("calc", ""),
        "qwen_cot_reasoning": (cot_result or {}).get("reasoning", ""),
    }

    # Collect all available model answers
    available = {k: v for k, v in [
        ("Qwen2.5", qwen_ans), ("Llama3", llama_ans), ("Gemma", gemma_ans)
    ] if v is not None}

    if not available:
        return {**base, "verdict": "human_review",
                "decision": "All model calls failed", "new_answer": None}

    # Count votes
    from collections import Counter
    votes = Counter(available.values())
    top_ans, top_count = votes.most_common(1)[0]
    total_models = len(available)

    # Majority agrees with key
    key_votes = sum(1 for a in available.values() if a == answer_key)
    if key_votes > total_models / 2:
        confirmers = [name for name, a in available.items() if a == answer_key]
        dissenters = [name for name, a in available.items() if a != answer_key]
        verdict = f"accept_key_{'_'.join(c.lower() for c in confirmers)}_confirms"
        return {**base, "verdict": verdict,
                "decision": (f"{'+'.join(confirmers)} confirm key={answer_key}"
                             + (f"; {'+'.join(dissenters)} said {votes.most_common()[-1][0]}"
                                if dissenters else "")),
                "new_answer": answer_key}

    # All available models agree on something OTHER than key → use CoT
    if top_count == total_models and top_ans != answer_key:
        if cot_ans == answer_key:
            return {**base, "verdict": "accept_key_cot_confirms",
                    "decision": f"All models said {top_ans} but CoT confirms key={answer_key}",
                    "new_answer": answer_key}
        if cot_ans == top_ans:
            return {**base, "verdict": "flag_answer_key",
                    "decision": (f"All model passes ({'+'.join(available.keys())}={top_ans}, "
                                 f"CoT={cot_ans}) agree — key ({answer_key}) likely wrong"),
                    "new_answer": top_ans}
        if cot_ans is None:
            return {**base, "verdict": "flag_answer_key",
                    "decision": (f"All available models ({'+'.join(available.keys())}) "
                                 f"agree on {top_ans} vs key={answer_key}"),
                    "new_answer": top_ans}

    # Majority disagrees with key (but not unanimous)
    if top_count > key_votes and top_ans != answer_key:
        dissenters = [n for n, a in available.items() if a != answer_key]
        return {**base, "verdict": "human_review",
                "decision": (f"Majority ({'+'.join(dissenters)}) say {top_ans} "
                             f"vs key={answer_key} — no CoT confirmation"),
                "new_answer": None}

    # Genuine split
    return {**base, "verdict": "human_review",
            "decision": (f"Split: {', '.join(f'{n}={a}' for n, a in available.items())}, "
                         f"key={answer_key}"),
            "new_answer": None}

def _progress(label, done, total):
    pct = done / total * 100 if total else 0
    sys.stdout.write(f"\r  {label} [{done}/{total}] {pct:.0f}%   ")
    sys.stdout.flush()

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if not OPENROUTER_KEY:
        print("OPENROUTER_API_KEY is required")
        return

    questions_list = load_json(INPUT_FILE)
    questions = {i: q for i, q in enumerate(questions_list)}
    results   = load_json(RESULTS_FILE)
    ckpt      = load_checkpoint()

    # Find questions where Llama3 had no answer
    failed = [r for r in results if r.get("llama_answer") is None]
    print(f"Questions with Llama3=None : {len(failed)}")

    gemma_cache = {int(k): v for k, v in ckpt.get("gemma", {}).items()}
    to_run      = [r for r in failed if r["index"] not in gemma_cache]
    print(f"Gemma already cached       : {len(gemma_cache)}")
    print(f"Gemma to run               : {len(to_run)}")
    print(f"Model                      : {GEMMA_MODEL}\n")

    if to_run:
        client   = OpenAI(base_url=OPENROUTER_URL, api_key=OPENROUTER_KEY)
        lock     = threading.Lock()
        done_ctr = [len(gemma_cache)]

        def worker(result_entry):
            idx = result_entry["index"]
            q   = questions[idx]
            res, err = call_gemma(q, client)
            with lock:
                gemma_cache[idx] = {"result": res, "error": err}
                done_ctr[0] += 1
                status = "✓" if (res and res.get("model_answer")) else "✗"
                _progress(f"Gemma {status}", done_ctr[0], len(failed))
                if done_ctr[0] % CHECKPOINT_EVERY == 0:
                    ckpt["gemma"] = {str(k): v for k, v in gemma_cache.items()}
                    save_json(CKPT_FILE, ckpt)
            time.sleep(REQUEST_DELAY)  # rate-limit buffer between sequential requests

        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = [pool.submit(worker, r) for r in to_run]
            for f in as_completed(futures):
                f.result()

        ckpt["gemma"] = {str(k): v for k, v in gemma_cache.items()}
        save_json(CKPT_FILE, ckpt)

        ok = sum(1 for v in gemma_cache.values()
                 if v.get("result") and v["result"].get("model_answer"))
        errs = sum(1 for v in gemma_cache.values() if v.get("error"))
        print(f"\n  Got answers: {ok}/{len(failed)}  |  errors: {errs}\n")
    else:
        print("All Gemma results cached — skipping to arbitration\n")

    # ── Re-arbitrate all 200 ──────────────────────────────────────────────────
    print("Re-arbitrating all 200 questions...")

    by_index = {r["index"]: r for r in results}
    new_results = []

    for r in results:
        idx = r["index"]
        q   = questions[idx]

        # If Llama3 had an answer, keep original result (no Gemma needed)
        if r.get("llama_answer") is not None:
            new_results.append(r)
            continue

        # Llama failed — re-arbitrate with Gemma filling in
        gemma_entry = gemma_cache.get(idx, {})
        gemma_res   = gemma_entry.get("result")

        new_verdict = arbitrate(
            index=idx,
            question=q,
            qwen_answer=r.get("qwen_answer"),
            qwen_calc=r.get("qwen_calc", ""),
            llama_answer=r.get("llama_answer"),   # still None
            llama_calc=r.get("llama_calc", ""),
            gemma_result=gemma_res,
            cot_result={"model_answer": r.get("qwen_cot_answer"),
                        "calc": r.get("qwen_cot_calc", ""),
                        "reasoning": r.get("qwen_cot_reasoning", "")},
            original_category=r.get("original_category", "unknown"),
        )
        new_results.append(new_verdict)

    new_results.sort(key=lambda x: x["index"])

    # ── Bucket & save ─────────────────────────────────────────────────────────
    RESOLVED_VERDICTS = {
        "unanimous", "flag_answer_key",
        "accept_key_llama_confirms", "accept_key_llama3_confirms",
        "accept_key_qwen_confirms", "accept_key_cot_confirms",
        "accept_key_qwen2.5_confirms",
    }
    # Also dynamically accept any "accept_key_*_confirms" pattern
    def is_resolved(v):
        return v in RESOLVED_VERDICTS or \
               (v.startswith("accept_key_") and v.endswith("_confirms")) or \
               v == "flag_answer_key"

    auto_resolved = [r for r in new_results if is_resolved(r["verdict"])]
    human_review  = [r for r in new_results if r["verdict"] == "human_review"]
    image_dep     = [r for r in new_results if r["verdict"] == "image_dependent"]
    key_suspects  = [r for r in new_results if r["verdict"] == "flag_answer_key"]

    save_json(OUTPUT_RESULTS,  new_results)
    save_json(OUTPUT_RESOLVED, auto_resolved)
    save_json(OUTPUT_REVIEW,   human_review + image_dep)
    save_json(OUTPUT_SUSPECTS, key_suspects)

    if os.path.exists(CKPT_FILE):
        os.remove(CKPT_FILE)

    # ── Summary ───────────────────────────────────────────────────────────────
    from collections import Counter
    verdicts = Counter(r["verdict"] for r in new_results)

    print(f"\n{'='*60}")
    print(f"RECOVERY COMPLETE — 200 questions re-arbitrated")
    print(f"{'='*60}\n")
    for v, n in verdicts.most_common():
        bar = "█" * n
        print(f"  {v:<40} {n:3d}  {bar}")
    print(f"\n  ✅ Auto-resolved   : {len(auto_resolved)} ({len(auto_resolved)/200*100:.0f}%)")
    print(f"  🔍 Human review    : {len(human_review)} ({len(human_review)/200*100:.0f}%)")
    print(f"  🖼  Image-dependent : {len(image_dep)}")
    print(f"  ⚠  Key suspects    : {len(key_suspects)}")

    if key_suspects:
        print(f"\n⚠  Answer key suspects:")
        for s in key_suspects:
            print(f"  [{s['index']:4d}] Key={s['answer_key']}  "
                  f"Qwen={s['qwen_answer']}  Llama={s['llama_answer']}  "
                  f"Gemma={s.get('gemma_answer')}  CoT={s['qwen_cot_answer']}")
            print(f"         {s['decision']}")

    print(f"\n  → {OUTPUT_RESULTS}")
    print(f"  → {OUTPUT_RESOLVED}")
    print(f"  → {OUTPUT_REVIEW}")
    print(f"  → {OUTPUT_SUSPECTS}")


if __name__ == "__main__":
    main()
