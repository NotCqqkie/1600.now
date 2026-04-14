#!/usr/bin/env python3.11
"""
Formatting-only pass over all SAT math questions using qwen3-next-80b (free).

Fixes:
  - Bare math not wrapped in $...$ (equations, variables, expressions)
  - xy-plane / xy plane → $xy$-plane
  - Superscripts written as text: x2 → $x^2$
  - Bare symbols: ≤ ≥ ≠ π → wrap in $...$
  - OCR/typo errors: run-together words, missing spaces
  - Broken LaTeX outside dollar signs

Does NOT touch: correctAnswer, domain, skill, difficulty, id, testName, rationale.

Run:    nohup python3.11 -u scripts/format_pass.py > scripts/format_pass.log 2>&1 &
Resume: re-run — checkpoint auto-loaded.
"""

import json, os, re, sys, threading, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI

OPENROUTER_URL = "https://openrouter.ai/api/v1"
OPENROUTER_KEY = "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"
MODEL          = "google/gemma-4-26b-a4b-it:free"

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE   = os.path.join(os.path.dirname(SCRIPT_DIR), "src/data/questions/math_past.json")
OUTPUT_FILE  = os.path.join(os.path.dirname(SCRIPT_DIR), "src/data/questions/math_past.json")
CKPT_FILE    = os.path.join(SCRIPT_DIR, "format_pass_checkpoint.json")
LOG_FILE     = os.path.join(SCRIPT_DIR, "format_pass_log.json")

WORKERS          = 1     # free tier: strict RPM limits
MAX_RETRIES      = 5
CHECKPOINT_EVERY = 20
REQUEST_DELAY    = 12.0  # seconds between requests (~5 RPM, well under limit)

# ── Issue detection ───────────────────────────────────────────────────────────

def needs_fix(q):
    all_text = (q.get("text") or "") + " " + " ".join(
        c.get("text", "") for c in (q.get("choices") or []))
    clean = re.sub(r"\$[^$\n]+\$", "MATH", all_text)
    return bool(
        re.search(r"(?<!\w)[a-z]=\d|(?<!\w)\d[a-z]=|\by=\d|\bx=\d", clean) or
        re.search(r"\bxy-plane\b|\bxy plane\b", clean) or
        re.search(r"[a-z]\d(?!\w)", clean) or
        re.search(r"[≤≥≠π]", clean) or
        re.search(r"\bl\d|\d\bl\b", clean) or
        re.search(r"[a-z][A-Z]", clean)
    )

# ── Prompt ────────────────────────────────────────────────────────────────────

SYSTEM = """\
You are fixing LaTeX formatting and text quality in SAT math questions. Apply ONLY the fixes below — change nothing else.

FIXES TO APPLY:
1. Wrap bare math in $...$:
   - Equations not in math: "y=2x+3" → "$y=2x+3$"
   - Variables alone: bare "x", "y", "n" used as math variables → "$x$", "$y$", "$n$"
   - "xy-plane" or "xy plane" → "$xy$-plane"
   - Superscripts as text: "x2" → "$x^2$", "n2" → "$n^2$", "25x2" → "$25x^2$"
   - Bare symbols: ≤ → $\\leq$, ≥ → $\\geq$, ≠ → $\\neq$, π → $\\pi$
2. Fix OCR/typo errors:
   - Run-together words: "bestinterpretation" → "best interpretation", "afterthe" → "after the"
   - "l" used as digit "1" in numeric contexts: "l0 fish" → "10 fish"
3. Do NOT change: the math/answer logic, correctAnswer, variable names, numbers, sentence meaning

Input: { "text": "...", "choices": [{"id":"A","text":"..."},...] }

Return ONLY this JSON (no markdown fences, no extra keys):
{
  "text": "corrected text",
  "choices": [{"id":"A","text":"corrected"},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}],
  "changes": ["short description of each change"]
}

If nothing needed fixing, return: {"text": null, "choices": null, "changes": []}
Return ALL choices (even unchanged), or empty array for free-response questions.\
"""

# ── Helpers ───────────────────────────────────────────────────────────────────

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
                try:    return json.loads(text[start:i+1])
                except: return None
    return None

# ── API call ──────────────────────────────────────────────────────────────────

def call_model(q, client, retries=0):
    payload = {
        "text": q.get("text", ""),
        "choices": [{"id": c["id"], "text": c.get("text", "")} for c in (q.get("choices") or [])],
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
        raw = resp.choices[0].message.content
        result = extract_json(raw)
        if result is not None:
            return result, None
        return None, f"parse_fail: {(raw or '')[:200]}"
    except Exception as e:
        err = str(e)
        if retries < MAX_RETRIES:
            if "429" in err or "rate" in err.lower():
                wait = 60 + 30 * retries   # 60s, 90s, 120s, 150s, 180s
                sys.stdout.write(f"\n  ⏳ 429 — wait {wait}s...\n"); sys.stdout.flush()
            else:
                wait = 2 ** retries
            time.sleep(wait)
            return call_model(q, client, retries + 1)
        return None, err

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    questions = load_json(INPUT_FILE)
    checkpoint = load_checkpoint()

    # Only process questions that need fixes and aren't cached
    targets = [(i, q) for i, q in enumerate(questions)
               if needs_fix(q) and i not in checkpoint]
    cached  = sum(1 for i in range(len(questions)) if i in checkpoint and needs_fix(questions[i]))

    print(f"Total questions   : {len(questions)}")
    print(f"Need fixes        : {sum(1 for q in questions if needs_fix(q))}")
    print(f"Already cached    : {cached}")
    print(f"To process        : {len(targets)}")
    print(f"Model             : {MODEL}\n")

    if targets:
        client   = OpenAI(base_url=OPENROUTER_URL, api_key=OPENROUTER_KEY)
        lock     = threading.Lock()
        done_ctr = [cached]
        total_need = cached + len(targets)

        def worker(idx_q):
            idx, q = idx_q
            result, err = call_model(q, client)
            with lock:
                checkpoint[idx] = {"result": result, "error": err}
                done_ctr[0] += 1
                changes = len(result.get("changes", [])) if result else 0
                status  = "✓" if (result and not err) else "✗"
                pct     = done_ctr[0] / total_need * 100
                sys.stdout.write(
                    f"\r  [{done_ctr[0]}/{total_need}] {pct:.0f}%  "
                    f"{status} changes={changes}   "
                )
                sys.stdout.flush()
                if done_ctr[0] % CHECKPOINT_EVERY == 0:
                    save_json(CKPT_FILE, {str(k): v for k, v in checkpoint.items()})
            time.sleep(REQUEST_DELAY)

        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = [pool.submit(worker, t) for t in targets]
            for f in as_completed(futures):
                f.result()

        save_json(CKPT_FILE, {str(k): v for k, v in checkpoint.items()})

    # ── Apply fixes ───────────────────────────────────────────────────────────
    print("\n\nApplying fixes...")

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
            log.append({"index": idx, "id": q.get("id"), "changes": []})
            continue

        # Apply text
        if result.get("text"):
            q["text"] = result["text"]
        # Apply choices
        if result.get("choices"):
            orig_map = {c["id"]: dict(c) for c in (q.get("choices") or [])}
            new_choices = []
            for fc in result["choices"]:
                merged = dict(orig_map.get(fc["id"], {}))
                if fc.get("text"):
                    merged["text"] = fc["text"]
                new_choices.append(merged)
            if new_choices:
                q["choices"] = new_choices

        changed += 1
        fixed   += 1
        log.append({"index": idx, "id": q.get("id"), "changes": changes})

    save_json(OUTPUT_FILE, questions)
    save_json(LOG_FILE, log)

    # Also update module JSON files
    print("Updating module JSON files...")
    lookup = {q["id"]: q for q in questions}
    modules_dir = os.path.join(os.path.dirname(SCRIPT_DIR), "src/data/Modules")
    mod_files   = [f for f in os.listdir(modules_dir) if "Math" in f and f.endswith(".json")]
    mods_updated = 0
    for fname in mod_files:
        path = os.path.join(modules_dir, fname)
        with open(path) as f:
            mod = json.load(f)
        mod_changed = False
        for mq in mod:
            fix = lookup.get(mq.get("id"))
            if not fix:
                continue
            new_text = fix.get("text", "")
            if new_text and mq.get("passage") != new_text:
                mq["passage"] = new_text
                mod_changed = True
            if fix.get("choices"):
                for mc in mq.get("choices") or []:
                    label = mc.get("label")
                    match = next((c for c in fix["choices"] if c["id"] == label), None)
                    if match and mc.get("text") != match.get("text",""):
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
    print(f"  Fixed           : {fixed}")
    print(f"  No changes      : {unchanged}")
    print(f"  Errors          : {errors}")
    print(f"  Module files    : {mods_updated}/{len(mod_files)} updated")
    print(f"\n→ {OUTPUT_FILE}")
    print(f"→ {LOG_FILE}")

    # Sample
    print(f"\n── Sample fixes ──")
    shown = 0
    for entry in log:
        if entry.get("changes") and shown < 6:
            print(f"  [{entry['index']}] {entry.get('id','')[:40]}")
            for c in entry["changes"][:2]:
                print(f"    • {c}")
            shown += 1

    if os.path.exists(CKPT_FILE):
        os.remove(CKPT_FILE)

if __name__ == "__main__":
    main()
