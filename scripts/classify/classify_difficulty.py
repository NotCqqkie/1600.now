#!/usr/bin/env python3.11
"""
Reclassify ALL question difficulties in math_past.json + reading_past.json
using few-shot calibration from the unofficial question bank.

Method:
  - For each question, find 2 Easy + 2 Medium + 2 Hard examples from the SAME
    skill in the unofficial bank → gives the model skill-relative anchors
  - qwen/qwen-2.5-72b-instruct (cloud, primary)
  - qwen2.5:14b via ollama (local, fallback for any cloud failures)
  - Output: single word (Easy / Medium / Hard) → minimal tokens, ~$0.85 total

Updates: math_past.json, reading_past.json, all 492 Module JSON files.

Run:    nohup python3.11 -u scripts/classify_difficulty.py > scripts/classify_difficulty.log 2>&1 &
Resume: checkpoint auto-loaded.
"""

import json, os, re, sys, threading, random
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI
from collections import defaultdict

OPENROUTER_URL = "https://openrouter.ai/api/v1"
OPENROUTER_KEY = "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"
REMOTE_MODEL   = "qwen/qwen-2.5-72b-instruct"
OLLAMA_URL     = "http://localhost:11434/v1"
LOCAL_MODEL    = "qwen2.5:14b"

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
MATH_FILE    = os.path.join(PROJECT_ROOT, "src/data/questions/math_past.json")
READ_FILE    = os.path.join(PROJECT_ROOT, "src/data/questions/reading_past.json")
CALIB_FILE   = os.path.join(SCRIPT_DIR,  "unofficial_questions_cache.json")
CKPT_FILE    = os.path.join(SCRIPT_DIR,  "classify_difficulty_checkpoint.json")
LOG_FILE     = os.path.join(SCRIPT_DIR,  "classify_difficulty_log.json")
MODS_DIR     = os.path.join(PROJECT_ROOT, "src/data/Modules")

WORKERS          = 20
MAX_RETRIES      = 3
CHECKPOINT_EVERY = 100
VALID            = {"Easy", "Medium", "Hard"}
EXAMPLES_PER_TIER = 2   # 2×3 = 6 calibration shots per request

# ── Build calibration lookup ───────────────────────────────────────────────────

def build_calibration(calib_qs):
    """skill → { 'Easy': [...], 'Medium': [...], 'Hard': [...] }"""
    by_skill = defaultdict(lambda: defaultdict(list))
    by_domain = defaultdict(lambda: defaultdict(list))
    for q in calib_qs:
        skill  = (q.get("skill") or "").strip()
        domain = (q.get("domain") or "").strip()
        diff   = (q.get("difficulty") or "").strip()
        if skill and diff in VALID:
            by_skill[skill][diff].append(q)
        if domain and diff in VALID:
            by_domain[domain][diff].append(q)
    return dict(by_skill), dict(by_domain)

def pick_examples(skill, domain, by_skill, by_domain, n=EXAMPLES_PER_TIER):
    """Pick n examples per tier for the given skill (falls back to domain)."""
    source = by_skill.get(skill) or by_domain.get(domain) or {}
    result = {}
    for tier in ("Easy", "Medium", "Hard"):
        pool = source.get(tier, [])
        result[tier] = random.sample(pool, min(n, len(pool)))
    return result

def fmt_example(q, max_text=220):
    text = (q.get("text") or "").replace("\n", " ").strip()[:max_text]
    ans  = q.get("correctAnswer", "")
    return f'"{text}" → answer: {ans}'

# ── Prompt builder ─────────────────────────────────────────────────────────────

def make_prompt(q, examples):
    skill  = q.get("skill", "")
    domain = q.get("domain", "")
    text   = (q.get("text") or "").replace("\n", " ").strip()[:350]
    choices = q.get("choices") or []
    choice_str = "  ".join(
        f"{c.get('id','')}) {(c.get('text') or '')[:80]}" for c in choices[:4]
    )
    ans = q.get("correctAnswer", "")

    lines = [
        f"Skill: {skill}  |  Domain: {domain}",
        "",
        "=== Difficulty calibration examples for this skill ===",
    ]
    for tier in ("Easy", "Medium", "Hard"):
        exs = examples.get(tier, [])
        if exs:
            lines.append(f"\n{tier.upper()} ({len(exs)} example{'s' if len(exs)>1 else ''}):")
            for ex in exs:
                lines.append(f"  • {fmt_example(ex)}")

    lines += [
        "",
        "=== Question to classify ===",
        f"Text: {text}",
    ]
    if choice_str:
        lines.append(f"Choices: {choice_str}")
    lines.append(f"Correct answer: {ans}")
    lines.append(
        "\nBased ONLY on the calibration examples above, classify this question's difficulty."
        "\nReply with EXACTLY one word: Easy, Medium, or Hard"
    )
    return "\n".join(lines)

SYSTEM = (
    "You are an expert SAT question difficulty classifier. "
    "You will be shown calibration examples for a specific skill, then asked to classify "
    "one question relative to those examples. Reply with exactly one word: Easy, Medium, or Hard."
)

# ── API helpers ────────────────────────────────────────────────────────────────

def load_json(path):
    with open(path, encoding="utf-8") as f: return json.load(f)

def save_json(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)

def load_checkpoint():
    if os.path.exists(CKPT_FILE):
        return load_json(CKPT_FILE)
    return {}

def parse_difficulty(raw):
    if not raw: return None
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
    for word in raw.split():
        w = word.strip(".,!?\"'").capitalize()
        if w in VALID:
            return w
    return None

def call_model(prompt, client, model, retries=0):
    import time
    try:
        resp = client.chat.completions.create(
            model=model,
            max_tokens=10,
            temperature=0,
            messages=[
                {"role": "system", "content": SYSTEM},
                {"role": "user",   "content": prompt},
            ],
        )
        raw = resp.choices[0].message.content
        result = parse_difficulty(raw)
        if result:
            return result, None
        return None, f"bad_output: {(raw or '')[:80]}"
    except Exception as e:
        err = str(e)
        if retries < MAX_RETRIES:
            wait = 25 * (retries+1) if ("429" in err or "rate" in err.lower()) else 2**retries
            if "429" in err or "rate" in err.lower():
                sys.stdout.write(f"\n  ⏳ 429 — wait {wait}s...\n"); sys.stdout.flush()
            time.sleep(wait)
            return call_model(prompt, client, model, retries+1)
        return None, err[:150]

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    random.seed(42)

    # Load data
    calib_qs  = load_json(CALIB_FILE)
    math_qs   = load_json(MATH_FILE)
    read_qs   = load_json(READ_FILE)
    all_qs    = [("math", i, q) for i, q in enumerate(math_qs)] + \
                [("read", i, q) for i, q in enumerate(read_qs)]
    checkpoint = load_checkpoint()

    by_skill, by_domain = build_calibration(calib_qs)
    print(f"Calibration skills: {len(by_skill)}")
    print(f"Math questions   : {len(math_qs)}")
    print(f"Reading questions: {len(read_qs)}")

    # Targets: all questions not yet in checkpoint
    targets = [(bank, i, q) for bank, i, q in all_qs
               if f"{bank}_{i}" not in checkpoint]
    cached  = len(all_qs) - len(targets)
    total   = len(all_qs)

    print(f"Already cached   : {cached}")
    print(f"To classify      : {len(targets)}")
    print(f"Remote model     : {REMOTE_MODEL}")
    print(f"Local fallback   : {LOCAL_MODEL}")
    print(f"Workers          : {WORKERS}\n")

    if targets:
        remote = OpenAI(base_url=OPENROUTER_URL, api_key=OPENROUTER_KEY)
        local  = OpenAI(base_url=OLLAMA_URL,    api_key="ollama")
        lock   = threading.Lock()
        done   = [cached]

        def worker(bank_i_q):
            bank, idx, q = bank_i_q
            skill  = (q.get("skill") or "").strip()
            domain = (q.get("domain") or "").strip()
            examples = pick_examples(skill, domain, by_skill, by_domain)
            prompt   = make_prompt(q, examples)

            # Try remote first
            result, err = call_model(prompt, remote, REMOTE_MODEL)
            model_used = REMOTE_MODEL

            # Fallback to local if remote failed
            if not result:
                result, err2 = call_model(prompt, local, LOCAL_MODEL)
                model_used = LOCAL_MODEL
                if not result:
                    err = f"remote: {err} | local: {err2}"

            with lock:
                key = f"{bank}_{idx}"
                checkpoint[key] = {
                    "bank": bank, "idx": idx,
                    "old_difficulty": q.get("difficulty"),
                    "new_difficulty": result,
                    "model": model_used,
                    "error": None if result else err,
                }
                done[0] += 1
                pct  = done[0] / total * 100
                changed = "→" if result and result != q.get("difficulty") else "="
                label = result or "ERR"
                sys.stdout.write(
                    f"\r  [{done[0]}/{total}] {pct:.0f}%  {label:<6}  {changed}  "
                )
                sys.stdout.flush()
                if done[0] % CHECKPOINT_EVERY == 0:
                    save_json(CKPT_FILE, checkpoint)

        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = [pool.submit(worker, t) for t in targets]
            for f in as_completed(futures):
                try: f.result()
                except Exception as e: sys.stdout.write(f"\n  exc: {e}\n")

        save_json(CKPT_FILE, checkpoint)

    # ── Apply new difficulties ──────────────────────────────────────────────────
    print("\n\nApplying new difficulty labels...")
    changed_math = changed_read = errors = skipped = 0
    log = []

    for key, entry in checkpoint.items():
        bank   = entry["bank"]
        idx    = entry["idx"]
        new_d  = entry.get("new_difficulty")
        old_d  = entry.get("old_difficulty")
        err    = entry.get("error")

        if err or not new_d:
            errors += 1
            log.append({**entry, "applied": False})
            continue

        target = math_qs[idx] if bank == "math" else read_qs[idx]
        target["difficulty"] = new_d
        if bank == "math":
            changed_math += (1 if new_d != old_d else 0)
        else:
            changed_read += (1 if new_d != old_d else 0)
        skipped += (1 if new_d == old_d else 0)
        log.append({**entry, "applied": True})

    save_json(MATH_FILE, math_qs)
    save_json(READ_FILE, read_qs)
    save_json(LOG_FILE, log)
    print(f"  math_past.json  : {changed_math} difficulty labels changed")
    print(f"  reading_past.json: {changed_read} difficulty labels changed")
    print(f"  Same as before  : {skipped}")
    print(f"  Errors (kept old): {errors}")

    # New distribution
    from collections import Counter
    print(f"\n  New math distribution  : {dict(Counter(q['difficulty'] for q in math_qs))}")
    print(f"  New reading distribution: {dict(Counter(q['difficulty'] for q in read_qs))}")

    # ── Update module files ─────────────────────────────────────────────────────
    print("\nUpdating module JSON files...")
    lookup = {}
    for q in math_qs:   lookup[q["id"]] = q["difficulty"]
    for q in read_qs:   lookup[q["id"]] = q["difficulty"]

    mod_files = sorted(f for f in os.listdir(MODS_DIR) if f.endswith(".json") and "manifest" not in f)
    mods_updated = 0
    for fname in mod_files:
        path = os.path.join(MODS_DIR, fname)
        with open(path, encoding="utf-8") as f: mod = json.load(f)
        changed = False
        for mq in mod:
            if not isinstance(mq, dict): continue
            new_d = lookup.get(mq.get("id"))
            if new_d and mq.get("difficulty") != new_d:
                mq["difficulty"] = new_d
                changed = True
        if changed:
            tmp = path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(mod, f, indent=2, ensure_ascii=False)
            os.replace(tmp, path)
            mods_updated += 1

    print(f"  Module files updated: {mods_updated}/{len(mod_files)}")

    # Sample changes
    changes = [e for e in log if e.get("applied") and e.get("new_difficulty") != e.get("old_difficulty")]
    if changes[:8]:
        print(f"\n── Sample reclassifications ──")
        for e in changes[:8]:
            bank  = e["bank"]
            idx   = e["idx"]
            q     = math_qs[idx] if bank == "math" else read_qs[idx]
            skill = q.get("skill","")[:40]
            print(f"  [{bank}:{idx}] {e['old_difficulty']:6s} → {e['new_difficulty']:6s}  ({skill})")

    if os.path.exists(CKPT_FILE):
        os.remove(CKPT_FILE)
    print("\n✓ Done.")

if __name__ == "__main__":
    main()
