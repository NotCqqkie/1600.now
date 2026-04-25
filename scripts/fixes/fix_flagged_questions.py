#!/usr/bin/env python3.11
"""
Fix formatting/text issues in the 38 flagged questions using qwen/qwen3.6-plus.

For each question:
  - Sets correctAnswer to qwen_plus_answer (already verified correct)
  - Sends full question to Qwen3.6-plus to fix: LaTeX formatting, typos,
    malformed choice text, broken math expressions
  - Merges fixes into math_corrected.json to produce final_questions.json

Run:    python3.11 scripts/fix_flagged_questions.py
Resume: re-run — checkpoint auto-loaded
"""

import json
import os
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI

OPENROUTER_URL  = "https://openrouter.ai/api/v1"
OPENROUTER_KEY  = "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"
MODEL           = "qwen/qwen3.6-plus"

SCRIPT_DIR      = os.path.dirname(os.path.abspath(__file__))
CORRECTED_FILE  = os.path.join(SCRIPT_DIR, "math_corrected.json")
RESULTS_FILE    = os.path.join(SCRIPT_DIR, "double_pass_results_final.json")
REVIEW_FILE     = os.path.join(SCRIPT_DIR, "human_review.json")
SUSPECTS_FILE   = os.path.join(SCRIPT_DIR, "answer_key_suspects.json")
CKPT_FILE       = os.path.join(SCRIPT_DIR, "fix_flagged_checkpoint.json")
OUTPUT_FILE     = os.path.join(SCRIPT_DIR, "final_questions.json")
FIX_LOG_FILE    = os.path.join(SCRIPT_DIR, "fix_flagged_log.json")

WORKERS          = 6
MAX_RETRIES      = 4
CHECKPOINT_EVERY = 5
REQUEST_DELAY    = 0.5

FIX_SYSTEM = """\
You are fixing a SAT math question for publication. The correct answer is already known — do NOT change it.

Your job: fix ALL formatting and text quality issues in the question.

FIX these issues:
1. LaTeX math formatting:
   - Bare math not in $...$: "y=2x+3" → "$y=2x+3$", "x2" → "$x^2$"
   - Broken asterisk italics: "*x*" → "$x$", "*f*(*x*)" → "$f(x)$"
   - Bare symbols: ≤ ≥ ≠ π ² → wrap in $...$
   - Superscripts written as text: "x2" → "$x^2$", "n2" → "$n^2$"
2. Choice text issues:
   - Incomplete choices (e.g. choice A says "1 day after" but is missing "The company's estimated stock price is")
   - Choices that are clearly fragments — complete them to match the question context
   - Fix math in choices too
3. Typos and OCR errors: "l" for "1", "0" for "O", run-together words like "bestinterpretation" → "best interpretation"
4. Broken line breaks or missing spaces

Input JSON: { "text": "...", "choices": [...], "correctAnswer": "X", "type": "..." }

Return ONLY this JSON (no markdown fences):
{
  "text": "full corrected question text",
  "choices": [{"id": "A", "text": "full corrected choice text"}, ...],
  "changes": ["description of each change made"]
}

Rules:
- Return ALL choices (even unchanged ones) with their full corrected text
- If nothing changed in a field, return it unchanged
- For free-response questions with no choices, return "choices": []
- Do NOT change correctAnswer, domain, difficulty, id, or any metadata\
"""

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
    return {}

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
        if esc:         esc = False; continue
        if ch == "\\": esc = True;  continue
        if ch == '"':  in_str = not in_str; continue
        if in_str:     continue
        if ch == "{":   depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:    return json.loads(text[start:i + 1])
                except: return None
    return None

def call_fix(question, client, retries=0):
    # Send only the editable fields
    payload = {
        "text": question.get("text", ""),
        "choices": question.get("choices", []),
        "correctAnswer": question.get("correctAnswer", ""),
        "type": question.get("type", ""),
    }
    try:
        response = client.chat.completions.create(
            model=MODEL,
            max_tokens=2000,
            temperature=0,
            messages=[
                {"role": "system", "content": FIX_SYSTEM},
                {"role": "user",   "content": json.dumps(payload, ensure_ascii=False)},
            ],
        )
        raw = response.choices[0].message.content
        result = extract_json(raw)
        if result and ("text" in result or "choices" in result):
            return result, None
        return None, f"parse_fail: {(raw or '')[:300]}"
    except Exception as e:
        err = str(e)
        if retries < MAX_RETRIES:
            wait = 30 * (retries + 1) if "429" in err else 2 ** retries
            if "429" in err:
                sys.stdout.write(f"\n  ⏳ 429 — waiting {wait}s...\n"); sys.stdout.flush()
            time.sleep(wait)
            return call_fix(question, client, retries + 1)
        return None, err

def main():
    corrected   = load_json(CORRECTED_FILE)
    results     = load_json(RESULTS_FILE)
    review      = load_json(REVIEW_FILE)
    suspects    = load_json(SUSPECTS_FILE)
    checkpoint  = load_checkpoint()

    all_flagged = review + suspects
    flagged_indices = {r["index"] for r in all_flagged}

    # Build lookup: index → qwen_plus_answer
    plus_answers = {r["index"]: r.get("qwen_plus_answer") for r in results if r["index"] in flagged_indices}

    to_fix = [r for r in all_flagged if str(r["index"]) not in checkpoint]
    cached = len(checkpoint)

    print(f"Flagged questions : {len(all_flagged)}")
    print(f"Already cached    : {cached}")
    print(f"To fix            : {len(to_fix)}")
    print(f"Model             : {MODEL}\n")

    if to_fix:
        client   = OpenAI(base_url=OPENROUTER_URL, api_key=OPENROUTER_KEY)
        lock     = threading.Lock()
        done_ctr = [cached]

        def worker(entry):
            idx  = entry["index"]
            q    = dict(corrected[idx])  # work on already-corrected version
            # Apply the verified qwen+ answer first
            plus_ans = plus_answers.get(idx)
            if plus_ans:
                q["correctAnswer"] = plus_ans

            fix, err = call_fix(q, client)
            with lock:
                checkpoint[str(idx)] = {"fix": fix, "error": err, "plus_answer": plus_ans}
                done_ctr[0] += 1
                status = f"✓" if (fix and not err) else f"✗"
                pct    = done_ctr[0] / len(all_flagged) * 100
                changes = len(fix.get("changes", [])) if fix else 0
                sys.stdout.write(f"\r  [{done_ctr[0]}/{len(all_flagged)}] {pct:.0f}%  {status}  changes={changes}   ")
                sys.stdout.flush()
                if done_ctr[0] % CHECKPOINT_EVERY == 0:
                    save_json(CKPT_FILE, checkpoint)
            time.sleep(REQUEST_DELAY)

        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = [pool.submit(worker, r) for r in to_fix]
            for f in as_completed(futures):
                f.result()

        save_json(CKPT_FILE, checkpoint)

    # ── Apply all fixes to corrected questions ────────────────────────────────
    print("\n\nApplying fixes...")

    final     = list(corrected)  # copy
    fix_log   = []
    ok = err_count = no_change = 0

    for entry in all_flagged:
        idx      = entry["index"]
        cached_e = checkpoint.get(str(idx), {})
        fix      = cached_e.get("fix")
        err      = cached_e.get("error")
        plus_ans = cached_e.get("plus_answer") or plus_answers.get(idx)

        q = dict(final[idx])

        # Always apply the verified answer
        if plus_ans:
            q["correctAnswer"] = plus_ans

        if fix and not err:
            # Apply text fix
            if "text" in fix and fix["text"]:
                q["text"] = fix["text"]
            # Apply choice fixes (full replacement — all choices returned)
            if "choices" in fix and fix["choices"]:
                # Preserve any fields not touched by Qwen (e.g. image)
                orig_map = {c["id"]: c for c in q.get("choices", [])}
                new_choices = []
                for fc in fix["choices"]:
                    merged = dict(orig_map.get(fc["id"], {}))
                    merged.update(fc)
                    new_choices.append(merged)
                q["choices"] = new_choices
            changes = fix.get("changes", [])
            ok += 1
        else:
            changes = []
            if err:
                err_count += 1
            else:
                no_change += 1

        final[idx] = q
        fix_log.append({
            "index":      idx,
            "id":         q.get("id"),
            "plus_answer": plus_ans,
            "changes":    changes,
            "error":      err,
        })

    save_json(OUTPUT_FILE,   final)
    save_json(FIX_LOG_FILE,  fix_log)

    # ── Verify changes were actually applied ──────────────────────────────────
    print(f"\n{'='*60}")
    print(f"DONE — {len(all_flagged)} flagged questions processed")
    print(f"  Fixed + formatted : {ok}")
    print(f"  Errors            : {err_count}")
    print(f"  No changes needed : {no_change}")
    print(f"\n→ {OUTPUT_FILE}")
    print(f"→ {FIX_LOG_FILE}")

    # Show a sample diff
    print(f"\n── Sample fixes ──")
    shown = 0
    for entry in fix_log:
        if entry["changes"] and shown < 5:
            print(f"\n  [{entry['index']}] {entry['id'][:45]}")
            print(f"  Answer → {entry['plus_answer']}")
            for c in entry["changes"][:3]:
                print(f"    • {c}")
            shown += 1

    # Verify answer keys were updated
    changed_answers = sum(
        1 for e in fix_log
        if e["plus_answer"] and corrected[e["index"]].get("correctAnswer") != e["plus_answer"]
    )
    print(f"\n  Answer keys updated: {changed_answers}")
    print(f"  Total questions in output: {len(final)}")

    if os.path.exists(CKPT_FILE):
        os.remove(CKPT_FILE)

if __name__ == "__main__":
    main()
