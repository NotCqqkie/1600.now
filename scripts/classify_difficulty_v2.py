#!/usr/bin/env python3.11
"""
Difficulty reclassification v2 — distribution-aware.

Key improvement over v1:
  - Embeds per-skill target distribution in every prompt
    ("For Circles, ~66% Hard, ~28% Medium, ~6% Easy")
  - Shows 3 Hard + 2 Medium + 1 Easy calibration examples
    to counter the model's conservative bias toward Medium
  - Distribution targets come directly from the unofficial bank
    so they're grounded in objective data, not guesswork

Run:    nohup python3.11 -u scripts/classify_difficulty_v2.py > scripts/classify_difficulty_v2.log 2>&1 &
Resume: checkpoint auto-loaded.
"""

import json, os, re, sys, threading, random
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI
from collections import defaultdict, Counter

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
CKPT_FILE    = os.path.join(SCRIPT_DIR,  "classify_v2_checkpoint.json")
LOG_FILE     = os.path.join(SCRIPT_DIR,  "classify_v2_log.json")
MODS_DIR     = os.path.join(PROJECT_ROOT, "src/data/Modules")

WORKERS          = 20
MAX_RETRIES      = 3
CHECKPOINT_EVERY = 100
VALID            = {"Easy", "Medium", "Hard"}

# ── Build calibration lookup ───────────────────────────────────────────────────

def build_calibration(calib_qs):
    by_skill  = defaultdict(lambda: defaultdict(list))
    by_domain = defaultdict(lambda: defaultdict(list))
    skill_dist  = defaultdict(Counter)   # skill  → {Easy:n, Medium:n, Hard:n}
    domain_dist = defaultdict(Counter)   # domain → {Easy:n, Medium:n, Hard:n}

    for q in calib_qs:
        skill  = (q.get("skill")  or "").strip()
        domain = (q.get("domain") or "").strip()
        diff   = (q.get("difficulty") or "").strip()
        if not diff or diff not in VALID:
            continue
        if skill:
            by_skill[skill][diff].append(q)
            skill_dist[skill][diff] += 1
        if domain:
            by_domain[domain][diff].append(q)
            domain_dist[domain][diff] += 1

    return dict(by_skill), dict(by_domain), dict(skill_dist), dict(domain_dist)


def pct_str(dist):
    """'~50% Easy, ~33% Medium, ~17% Hard'"""
    total = sum(dist.values()) or 1
    parts = []
    for tier in ("Easy", "Medium", "Hard"):
        n = dist.get(tier, 0)
        if n:
            parts.append(f"~{round(n/total*100)}% {tier}")
    return ", ".join(parts)


def pick_examples(skill, domain, by_skill, by_domain):
    """3 Hard + 2 Medium + 1 Easy from same skill (or domain fallback)."""
    source = by_skill.get(skill) or by_domain.get(domain) or {}
    result = {}
    counts = {"Hard": 3, "Medium": 2, "Easy": 1}
    for tier, n in counts.items():
        pool = source.get(tier, [])
        result[tier] = random.sample(pool, min(n, len(pool)))
    return result


def fmt_example(q, max_text=200):
    text = (q.get("text") or "").replace("\n", " ").strip()[:max_text]
    ans  = q.get("correctAnswer", "")
    return f'"{text}" → answer: {ans}'


# ── Prompt builder ─────────────────────────────────────────────────────────────

def make_prompt(q, examples, skill_dist, domain_dist):
    skill  = (q.get("skill")  or "").strip()
    domain = (q.get("domain") or "").strip()
    text   = (q.get("text")   or "").replace("\n", " ").strip()[:350]
    choices = q.get("choices") or []
    choice_str = "  ".join(
        f"{c.get('id','')}) {(c.get('text') or '')[:80]}" for c in choices[:4]
    )
    ans = q.get("correctAnswer", "")

    # Distribution hint — skill first, domain fallback
    dist = skill_dist.get(skill) or domain_dist.get(domain) or {}
    dist_hint = f"For '{skill}': {pct_str(dist)}" if dist else ""

    lines = [
        f"Skill: {skill}  |  Domain: {domain}",
    ]
    if dist_hint:
        lines.append(f"Target distribution → {dist_hint}")

    lines += ["", "=== Calibration examples ==="]
    for tier in ("Hard", "Medium", "Easy"):
        exs = examples.get(tier, [])
        if exs:
            lines.append(f"\n{tier.upper()} ({len(exs)}):")
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
        "\nUsing the calibration examples and the target distribution above as your guide, "
        "classify this question. Hard questions require multi-step reasoning, advanced concept "
        "application, or non-obvious insight — don't reserve Hard only for the most extreme cases.\n"
        "Reply with EXACTLY one word: Easy, Medium, or Hard"
    )
    return "\n".join(lines)


SYSTEM = (
    "You are an expert SAT question difficulty classifier. "
    "You will be given the expected difficulty distribution for a skill, calibration examples, "
    "and a question to classify. Use the distribution as a real guide — if ~30% of questions "
    "for this skill are Hard, you should classify roughly that share as Hard. "
    "Reply with exactly one word: Easy, Medium, or Hard."
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
            model=model, max_tokens=10, temperature=0,
            messages=[
                {"role": "system", "content": SYSTEM},
                {"role": "user",   "content": prompt},
            ],
        )
        raw    = resp.choices[0].message.content
        result = parse_difficulty(raw)
        if result: return result, None
        return None, f"bad_output: {(raw or '')[:80]}"
    except Exception as e:
        err = str(e)
        if retries < MAX_RETRIES:
            wait = 25*(retries+1) if ("429" in err or "rate" in err.lower()) else 2**retries
            if "429" in err or "rate" in err.lower():
                sys.stdout.write(f"\n  ⏳ 429 — wait {wait}s...\n"); sys.stdout.flush()
            time.sleep(wait)
            return call_model(prompt, client, model, retries+1)
        return None, err[:150]


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    random.seed(42)

    calib_qs = load_json(CALIB_FILE)
    math_qs  = load_json(MATH_FILE)
    read_qs  = load_json(READ_FILE)
    all_qs   = [("math", i, q) for i, q in enumerate(math_qs)] + \
               [("read", i, q) for i, q in enumerate(read_qs)]
    checkpoint = load_checkpoint()

    by_skill, by_domain, skill_dist, domain_dist = build_calibration(calib_qs)

    targets   = [(b,i,q) for b,i,q in all_qs if f"{b}_{i}" not in checkpoint]
    cached    = len(all_qs) - len(targets)
    total     = len(all_qs)

    print(f"Total questions  : {total}")
    print(f"Already cached   : {cached}")
    print(f"To classify      : {len(targets)}")
    print(f"Model            : {REMOTE_MODEL}  (fallback: {LOCAL_MODEL})")
    print(f"Workers          : {WORKERS}\n")

    # Print target distribution summary
    print("Target distribution from unofficial bank:")
    print(f"  Overall: Easy {sum(1 for q in calib_qs if q.get('difficulty')=='Easy')/len(calib_qs):.0%}"
          f"  Medium {sum(1 for q in calib_qs if q.get('difficulty')=='Medium')/len(calib_qs):.0%}"
          f"  Hard {sum(1 for q in calib_qs if q.get('difficulty')=='Hard')/len(calib_qs):.0%}\n")

    if targets:
        remote = OpenAI(base_url=OPENROUTER_URL, api_key=OPENROUTER_KEY)
        local  = OpenAI(base_url=OLLAMA_URL,     api_key="ollama")
        lock   = threading.Lock()
        done   = [cached]

        def worker(biq):
            bank, idx, q = biq
            skill  = (q.get("skill")  or "").strip()
            domain = (q.get("domain") or "").strip()
            examples = pick_examples(skill, domain, by_skill, by_domain)
            prompt   = make_prompt(q, examples, skill_dist, domain_dist)

            result, err = call_model(prompt, remote, REMOTE_MODEL)
            model_used  = REMOTE_MODEL
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
                pct     = done[0] / total * 100
                changed = "→" if result and result != q.get("difficulty") else "="
                label   = result or "ERR"
                sys.stdout.write(f"\r  [{done[0]}/{total}] {pct:.0f}%  {label:<6}  {changed}  ")
                sys.stdout.flush()
                if done[0] % CHECKPOINT_EVERY == 0:
                    save_json(CKPT_FILE, checkpoint)

        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = [pool.submit(worker, t) for t in targets]
            for f in as_completed(futures):
                try: f.result()
                except Exception as e: sys.stdout.write(f"\n  exc: {e}\n")

        save_json(CKPT_FILE, checkpoint)

    # ── Apply ─────────────────────────────────────────────────────────────────
    print("\n\nApplying new difficulty labels...")
    changed_math = changed_read = errors = same = 0
    log = []

    for key, entry in checkpoint.items():
        bank  = entry["bank"]
        idx   = entry["idx"]
        new_d = entry.get("new_difficulty")
        old_d = entry.get("old_difficulty")
        err   = entry.get("error")

        if err or not new_d:
            errors += 1
            log.append({**entry, "applied": False})
            continue

        target = math_qs[idx] if bank == "math" else read_qs[idx]
        target["difficulty"] = new_d
        if new_d != old_d:
            if bank == "math": changed_math += 1
            else:              changed_read  += 1
        else:
            same += 1
        log.append({**entry, "applied": True})

    save_json(MATH_FILE, math_qs)
    save_json(READ_FILE, read_qs)
    save_json(LOG_FILE,  log)

    # Summary
    math_dist = Counter(q["difficulty"] for q in math_qs)
    read_dist = Counter(q["difficulty"] for q in read_qs)
    print(f"  math changed    : {changed_math}")
    print(f"  reading changed : {changed_read}")
    print(f"  same as before  : {same}")
    print(f"  errors          : {errors}")
    print(f"\n  Math    Easy={math_dist['Easy']} ({math_dist['Easy']/len(math_qs):.0%})"
          f"  Medium={math_dist['Medium']} ({math_dist['Medium']/len(math_qs):.0%})"
          f"  Hard={math_dist['Hard']} ({math_dist['Hard']/len(math_qs):.0%})")
    print(f"  Reading Easy={read_dist['Easy']} ({read_dist['Easy']/len(read_qs):.0%})"
          f"  Medium={read_dist['Medium']} ({read_dist['Medium']/len(read_qs):.0%})"
          f"  Hard={read_dist['Hard']} ({read_dist['Hard']/len(read_qs):.0%})")
    print(f"\n  Target  Easy~36%  Medium~33%  Hard~31%")

    # ── Update modules ────────────────────────────────────────────────────────
    print("\nUpdating module JSON files...")
    lookup = {}
    for q in math_qs: lookup[q["id"]] = q["difficulty"]
    for q in read_qs: lookup[q["id"]] = q["difficulty"]

    mod_files    = sorted(f for f in os.listdir(MODS_DIR) if f.endswith(".json") and "manifest" not in f)
    mods_updated = 0
    for fname in mod_files:
        path = os.path.join(MODS_DIR, fname)
        with open(path, encoding="utf-8") as f: mod = json.load(f)
        changed = False
        for mq in mod:
            if not isinstance(mq, dict): continue
            new_d = lookup.get(mq.get("id"))
            if new_d and mq.get("difficulty") != new_d:
                mq["difficulty"] = new_d; changed = True
        if changed:
            tmp = path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(mod, f, indent=2, ensure_ascii=False)
            os.replace(tmp, path); mods_updated += 1

    print(f"  Module files updated: {mods_updated}/{len(mod_files)}")

    if os.path.exists(CKPT_FILE):
        os.remove(CKPT_FILE)
    print("\n✓ Done.")

if __name__ == "__main__":
    main()
