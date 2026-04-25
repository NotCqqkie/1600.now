#!/usr/bin/env python3.11
"""
Comprehensive formatting + sense-check pass over ALL 2157 SAT math questions.
Model : qwen/qwen2.5-72b-instruct  (paid, ~$0.40 total, no rate-limit drama)
Speed : 20 concurrent workers → ~3-5 min for full corpus

Fixes:
  - Bare math not in $...$  (equations, expressions, variables)
  - xy-plane → $xy$-plane,  x2 → $x^2$,  bare ≤ ≥ ≠ π
  - OCR errors: run-together words, "l" used as digit "1"
  - Incomplete / broken choice text
  - Questions that don't read correctly (fragment sentences, missing words)

Does NOT touch: correctAnswer, domain, skill, difficulty, id, rationale.

Run:    nohup python3.11 -u scripts/format_pass_v2.py > scripts/format_pass_v2.log 2>&1 &
Resume: re-run — checkpoint auto-loaded.
"""

import json, os, re, sys, threading, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI

OPENROUTER_URL = "https://openrouter.ai/api/v1"
OPENROUTER_KEY = "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"
MODEL          = "qwen/qwen-2.5-72b-instruct"

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
INPUT_FILE   = os.path.join(PROJECT_ROOT, "src/data/questions/math_past.json")
OUTPUT_FILE  = INPUT_FILE
CKPT_FILE    = os.path.join(SCRIPT_DIR, "format_pass_v2_checkpoint.json")
LOG_FILE     = os.path.join(SCRIPT_DIR, "format_pass_v2_log.json")

WORKERS          = 20    # paid model — no rate limit issues
MAX_RETRIES      = 4
CHECKPOINT_EVERY = 50

# ── Prompt ─────────────────────────────────────────────────────────────────────

SYSTEM = """\
You are a copy-editor for SAT math questions. Review the question and choices \
and apply ONLY these fixes — do not alter math, numbers, or answer logic.

FORMATTING FIXES:
1. Wrap bare math in $...$:
   - Bare equations: "y=2x+3" → "$y=2x+3$"
   - Superscripts written as text: "x2" → "$x^2$", "25x2" → "$25x^2$", "n3" → "$n^3$"
   - "xy-plane" → "$xy$-plane"; "x-axis", "y-axis" are fine as-is
   - Bare symbols outside $...$: ≤ → $\\leq$, ≥ → $\\geq$, ≠ → $\\neq$, π → $\\pi$
   - Inline expressions like "t=0.01×(p−40000)" → "$t=0.01 \\times (p-40000)$"
   - Lone math variable used as subject: "x is a positive integer" → "$x$ is a positive integer"

2. Fix OCR / typo errors:
   - Run-together words: "bestinterpretation" → "best interpretation"
   - "l" (letter ell) used as digit "1" in numeric contexts: "l0" → "10", "l5" → "15"
   - Missing spaces after punctuation in prose

3. Fix incomplete or broken text:
   - Choice text that is clearly truncated or starts mid-sentence
   - Question stem that is missing words and doesn't make sense as written

DO NOT change:
   - The mathematical content, variable names, or numeric values
   - Correctly formatted $...$ LaTeX — leave it alone
   - Grammar / phrasing that is correct even if informal

Input JSON: { "text": "...", "choices": [{"id":"A","text":"..."},...] }

Return ONLY this JSON (no markdown fences, no extra text):
{
  "text": "corrected text or null if unchanged",
  "choices": [{"id":"A","text":"corrected or original"},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}],
  "changes": ["brief description of each change made"]
}

If nothing needed fixing: {"text": null, "choices": null, "changes": []}
Always return all choices (or empty array [] for free-response).\
"""

# ── Helpers ────────────────────────────────────────────────────────────────────

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
        return {int(k): v for k, v in load_json(CKPT_FILE).items()}
    return {}

def extract_json(text):
    if not text:
        return None
    # strip <think>...</think> (Qwen CoT)
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    # strip markdown fences
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text.strip()).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # fallback: extract first {...} block
    start = text.find("{")
    if start == -1:
        return None
    depth, in_str, esc = 0, False, False
    for i, ch in enumerate(text[start:], start):
        if esc:          esc = False; continue
        if ch == "\\":   esc = True;  continue
        if ch == '"':    in_str = not in_str; continue
        if in_str:       continue
        if ch == "{":    depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:    return json.loads(text[start:i+1])
                except: return None
    return None

# ── API call ───────────────────────────────────────────────────────────────────

def call_model(q, client, retries=0):
    payload = {
        "text": q.get("text", ""),
        "choices": [{"id": c["id"], "text": c.get("text", "")}
                    for c in (q.get("choices") or [])],
    }
    try:
        resp = client.chat.completions.create(
            model=MODEL,
            max_tokens=1500,
            temperature=0,
            messages=[
                {"role": "system", "content": SYSTEM},
                {"role": "user",   "content": json.dumps(payload, ensure_ascii=False)},
            ],
        )
        raw    = resp.choices[0].message.content
        result = extract_json(raw)
        if result is not None:
            return result, None
        return None, f"parse_fail: {(raw or '')[:300]}"
    except Exception as e:
        err = str(e)
        if retries < MAX_RETRIES:
            if "429" in err or "rate" in err.lower():
                wait = 30 * (retries + 1)
                sys.stdout.write(f"\n  ⏳ 429 — wait {wait}s...\n"); sys.stdout.flush()
            else:
                wait = 2 ** retries
            time.sleep(wait)
            return call_model(q, client, retries + 1)
        return None, err[:200]

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    questions  = load_json(INPUT_FILE)
    checkpoint = load_checkpoint()

    # All questions not yet in checkpoint
    targets = [(i, q) for i, q in enumerate(questions) if i not in checkpoint]
    done_so_far = len(checkpoint)

    print(f"Total questions   : {len(questions)}")
    print(f"Already cached    : {done_so_far}")
    print(f"To process        : {len(targets)}")
    print(f"Model             : {MODEL}")
    print(f"Workers           : {WORKERS}\n")

    if targets:
        client   = OpenAI(base_url=OPENROUTER_URL, api_key=OPENROUTER_KEY)
        lock     = threading.Lock()
        done_ctr = [done_so_far]
        total    = len(questions)

        def worker(idx_q):
            idx, q = idx_q
            result, err = call_model(q, client)
            with lock:
                checkpoint[idx] = {"result": result, "error": err}
                done_ctr[0] += 1
                changes = len(result.get("changes", [])) if result else 0
                status  = "✓" if (result and not err) else "✗"
                pct     = done_ctr[0] / total * 100
                sys.stdout.write(
                    f"\r  [{done_ctr[0]}/{total}] {pct:.0f}%  "
                    f"{status} changes={changes}   "
                )
                sys.stdout.flush()
                if done_ctr[0] % CHECKPOINT_EVERY == 0:
                    save_json(CKPT_FILE, {str(k): v for k, v in checkpoint.items()})

        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = [pool.submit(worker, t) for t in targets]
            for f in as_completed(futures):
                try:
                    f.result()
                except Exception as e:
                    sys.stdout.write(f"\n  worker exception: {e}\n")

        save_json(CKPT_FILE, {str(k): v for k, v in checkpoint.items()})

    # ── Apply fixes ─────────────────────────────────────────────────────────────
    print("\n\nApplying fixes to math_past.json...")

    fixed = changed = errors = unchanged = 0
    log = []

    for idx, entry in sorted(checkpoint.items()):
        result = entry.get("result")
        err    = entry.get("error")
        q      = questions[idx]

        if err or not result:
            errors += 1
            log.append({"index": idx, "id": q.get("id"), "error": err, "changes": []})
            continue

        changes = result.get("changes", [])
        if not changes:
            unchanged += 1
            continue

        if result.get("text"):
            q["text"] = result["text"]

        if result.get("choices"):
            orig_map  = {c["id"]: dict(c) for c in (q.get("choices") or [])}
            new_choices = []
            for fc in result["choices"]:
                merged = dict(orig_map.get(fc["id"], {}))
                if fc.get("text") is not None:
                    merged["text"] = fc["text"]
                new_choices.append(merged)
            if new_choices:
                q["choices"] = new_choices

        changed += 1
        fixed   += 1
        log.append({"index": idx, "id": q.get("id"), "changes": changes})

    save_json(OUTPUT_FILE, questions)
    save_json(LOG_FILE, log)
    print(f"  Wrote {OUTPUT_FILE}")

    # ── Update module JSON files ─────────────────────────────────────────────────
    print("Updating module JSON files...")
    lookup    = {q["id"]: q for q in questions}
    mods_dir  = os.path.join(PROJECT_ROOT, "src/data/Modules")
    mod_files = sorted(f for f in os.listdir(mods_dir) if "Math" in f and f.endswith(".json"))
    mods_updated = 0

    for fname in mod_files:
        path = os.path.join(mods_dir, fname)
        with open(path, encoding="utf-8") as f:
            mod = json.load(f)
        mod_changed = False
        for mq in mod:
            fix = lookup.get(mq.get("id"))
            if not fix:
                continue
            if fix.get("text") and mq.get("passage") != fix["text"]:
                mq["passage"] = fix["text"]
                mod_changed = True
            for mc in mq.get("choices") or []:
                label = mc.get("label")
                match = next((c for c in fix.get("choices", []) if c["id"] == label), None)
                if match and mc.get("text") != match.get("text", ""):
                    mc["text"] = match["text"]
                    mod_changed = True
        if mod_changed:
            tmp = path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(mod, f, indent=2, ensure_ascii=False)
            os.replace(tmp, path)
            mods_updated += 1

    print(f"\n{'='*55}")
    print(f"DONE")
    print(f"  Questions fixed : {fixed}")
    print(f"  No changes      : {unchanged}")
    print(f"  Errors          : {errors}")
    print(f"  Module files    : {mods_updated}/{len(mod_files)} updated")

    # Sample
    sample = [e for e in log if e.get("changes")][:8]
    if sample:
        print(f"\n── Sample fixes ──")
        for entry in sample:
            print(f"  [{entry['index']}] {entry.get('id','')}")
            for c in entry["changes"][:2]:
                print(f"    • {c}")

    if os.path.exists(CKPT_FILE):
        os.remove(CKPT_FILE)
        print(f"\nCheckpoint cleaned up.")

if __name__ == "__main__":
    main()
