#!/usr/bin/env python3.11
"""
Retry pass for the 83 parse-fail questions from format_pass_v2.
Strategy:
  Round 1 — qwen/qwen-2.5-72b-instruct with max_tokens=3000 (fixes truncation)
  Round 2 — local qwen2.5:14b via ollama for any still failing
  Writes fixes directly to math_past.json + all 101 module JSONs.
"""

import json, os, re, sys, threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI

OPENROUTER_URL = "https://openrouter.ai/api/v1"
OPENROUTER_KEY = "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"
REMOTE_MODEL   = "qwen/qwen-2.5-72b-instruct"

OLLAMA_URL     = "http://localhost:11434/v1"
LOCAL_MODEL    = "qwen2.5:14b"

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_FILE    = os.path.join(PROJECT_ROOT, "src/data/questions/math_past.json")
LOG_FILE     = os.path.join(SCRIPT_DIR, "format_pass_v2_log.json")
RETRY_LOG    = os.path.join(SCRIPT_DIR, "format_retry_log.json")

WORKERS      = 10
MAX_RETRIES  = 3

SYSTEM = """\
You are a copy-editor for SAT math questions. Review the question and choices \
and apply ONLY these fixes — do not alter math, numbers, or answer logic.

FORMATTING FIXES:
1. Wrap bare math in $...$:
   - Bare equations: "y=2x+3" → "$y=2x+3$"
   - Superscripts as text: "x2" → "$x^2$", "25x2" → "$25x^2$", "n3" → "$n^3$"
   - "xy-plane" → "$xy$-plane"; "x-axis", "y-axis" are fine as-is
   - Bare symbols: ≤ → $\\leq$, ≥ → $\\geq$, ≠ → $\\neq$, π → $\\pi$
   - Inline expressions like "t=0.01×(p−40000)" → "$t=0.01 \\times (p-40000)$"
   - Lone math variable as subject: "x is a positive integer" → "$x$ is a positive integer"
2. Fix OCR / typo errors:
   - Run-together words: "bestinterpretation" → "best interpretation"
   - "l" (ell) as digit "1" in numeric contexts: "l0" → "10"
3. Fix incomplete / broken choice text

DO NOT change math content, variable names, numeric values, or correct $...$ LaTeX.

Input JSON: { "text": "...", "choices": [{"id":"A","text":"..."},...] }

Return ONLY valid JSON (no markdown fences, no extra text):
{
  "text": "corrected text or null if unchanged",
  "choices": [{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}],
  "changes": ["brief description of each change made"]
}
If nothing needed fixing: {"text": null, "choices": null, "changes": []}
Always return all choices (or [] for free-response).\
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

def call_api(q, client, model, max_tokens, retries=0):
    payload = {
        "text": q.get("text", ""),
        "choices": [{"id": c["id"], "text": c.get("text", "")}
                    for c in (q.get("choices") or [])],
    }
    try:
        resp = client.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
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
        return None, f"parse_fail: {(raw or '')[:200]}"
    except Exception as e:
        err = str(e)
        if retries < MAX_RETRIES:
            import time
            wait = 20 * (retries + 1) if ("429" in err or "rate" in err.lower()) else 2 ** retries
            if "429" in err or "rate" in err.lower():
                sys.stdout.write(f"\n  ⏳ 429 — wait {wait}s...\n"); sys.stdout.flush()
            import time; time.sleep(wait)
            return call_api(q, client, model, max_tokens, retries + 1)
        return None, err[:200]

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    # Load failed indices from previous log
    log     = load_json(LOG_FILE)
    failed  = {e["index"] for e in log if e.get("error")}
    print(f"Failed indices from v2: {len(failed)}")

    questions = load_json(DATA_FILE)
    targets   = [(i, questions[i]) for i in sorted(failed)]

    # ── Round 1: remote qwen-2.5-72b with max_tokens=3000 ─────────────────────
    print(f"\nRound 1 — {REMOTE_MODEL} (max_tokens=3000), {WORKERS} workers")
    remote  = OpenAI(base_url=OPENROUTER_URL, api_key=OPENROUTER_KEY)
    lock    = threading.Lock()
    results = {}   # idx → (result, err, model_used)
    done    = [0]

    def r1_worker(idx_q):
        idx, q = idx_q
        result, err = call_api(q, remote, REMOTE_MODEL, max_tokens=3000)
        with lock:
            results[idx] = (result, err, REMOTE_MODEL)
            done[0] += 1
            ok = "✓" if (result and not err) else "✗"
            sys.stdout.write(f"\r  R1 [{done[0]}/{len(targets)}]  {ok}   "); sys.stdout.flush()

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for f in as_completed([pool.submit(r1_worker, t) for t in targets]):
            try: f.result()
            except Exception as e: sys.stdout.write(f"\n  exc: {e}\n")

    r1_fixed  = sum(1 for r,e,_ in results.values() if r and not e and r.get("changes"))
    r1_errors = [idx for idx,(r,e,_) in results.items() if not r or e]
    print(f"\n  Round 1: {r1_fixed} fixed, {len(r1_errors)} still failing")

    # ── Round 2: local qwen2.5:14b for remaining failures ─────────────────────
    if r1_errors:
        print(f"\nRound 2 — local {LOCAL_MODEL} for {len(r1_errors)} remaining failures")
        local = OpenAI(base_url=OLLAMA_URL, api_key="ollama")
        done[0] = 0
        r2_targets = [(i, questions[i]) for i in r1_errors]

        def r2_worker(idx_q):
            idx, q = idx_q
            result, err = call_api(q, local, LOCAL_MODEL, max_tokens=2000)
            with lock:
                results[idx] = (result, err, LOCAL_MODEL)
                done[0] += 1
                ok = "✓" if (result and not err) else "✗"
                sys.stdout.write(f"\r  R2 [{done[0]}/{len(r2_targets)}]  {ok}   "); sys.stdout.flush()

        # Local model — fewer workers to avoid memory pressure
        with ThreadPoolExecutor(max_workers=4) as pool:
            for f in as_completed([pool.submit(r2_worker, t) for t in r2_targets]):
                try: f.result()
                except Exception as e: sys.stdout.write(f"\n  exc: {e}\n")

        r2_fixed  = sum(1 for idx,(r,e,m) in results.items() if idx in r1_errors and r and not e and r.get("changes"))
        r2_errors = [idx for idx in r1_errors if not results[idx][0] or results[idx][1]]
        print(f"\n  Round 2: {r2_fixed} fixed, {len(r2_errors)} still failing")

    # ── Apply fixes ─────────────────────────────────────────────────────────────
    print("\nApplying fixes...")
    applied = skipped = still_failed = 0
    retry_log = []

    for idx, (result, err, model_used) in sorted(results.items()):
        q = questions[idx]
        if err or not result:
            still_failed += 1
            retry_log.append({"index": idx, "id": q.get("id"), "model": model_used, "error": err, "changes": []})
            continue
        changes = result.get("changes", [])
        if not changes:
            skipped += 1
            retry_log.append({"index": idx, "id": q.get("id"), "model": model_used, "changes": []})
            continue
        if result.get("text"):
            q["text"] = result["text"]
        if result.get("choices"):
            orig_map = {c["id"]: dict(c) for c in (q.get("choices") or [])}
            new_choices = []
            for fc in result["choices"]:
                merged = dict(orig_map.get(fc["id"], {}))
                if fc.get("text") is not None:
                    merged["text"] = fc["text"]
                new_choices.append(merged)
            if new_choices:
                q["choices"] = new_choices
        applied += 1
        retry_log.append({"index": idx, "id": q.get("id"), "model": model_used, "changes": changes})

    save_json(DATA_FILE, questions)
    save_json(RETRY_LOG, retry_log)

    # Update module JSONs
    print("Updating module files...")
    lookup   = {q["id"]: q for q in questions}
    mods_dir = os.path.join(PROJECT_ROOT, "src/data/Modules")
    mod_files = sorted(f for f in os.listdir(mods_dir) if "Math" in f and f.endswith(".json"))
    mods_upd = 0
    for fname in mod_files:
        path = os.path.join(mods_dir, fname)
        with open(path, encoding="utf-8") as f: mod = json.load(f)
        changed = False
        for mq in mod:
            fix = lookup.get(mq.get("id"))
            if not fix: continue
            if fix.get("text") and mq.get("passage") != fix["text"]:
                mq["passage"] = fix["text"]; changed = True
            for mc in mq.get("choices") or []:
                label = mc.get("label")
                match = next((c for c in fix.get("choices",[]) if c["id"]==label), None)
                if match and mc.get("text") != match.get("text",""):
                    mc["text"] = match["text"]; changed = True
        if changed:
            tmp = path + ".tmp"
            with open(tmp,"w",encoding="utf-8") as f: json.dump(mod,f,indent=2,ensure_ascii=False)
            os.replace(tmp, path); mods_upd += 1

    print(f"\n{'='*50}")
    print(f"DONE")
    print(f"  Applied fixes   : {applied}")
    print(f"  Nothing to fix  : {skipped}")
    print(f"  Still failed    : {still_failed}")
    print(f"  Modules updated : {mods_upd}/{len(mod_files)}")
    print(f"\n→ {RETRY_LOG}")

    if sample := [e for e in retry_log if e.get("changes")][:6]:
        print(f"\n── Sample fixes ──")
        for e in sample:
            print(f"  [{e['index']}] ({e['model'].split('/')[-1]})")
            for c in e["changes"][:2]: print(f"    • {c}")

if __name__ == "__main__":
    main()
