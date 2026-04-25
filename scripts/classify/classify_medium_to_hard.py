#!/usr/bin/env python3.11
"""
Binary re-pass: asks "Medium or Hard?" only for current Medium-labeled questions.

The previous full 3-way pass under-assigned Hard because the model hedged to
Medium when uncertain. This binary pass forces a two-way decision, using:
  - 4 Hard + 2 Medium calibration examples (Hard-biased)
  - Explicit per-skill target Hard% embedded in the prompt
  - "Of the Medium candidates for this skill, ~X% should be Hard"

~$0.25 total (4259 questions, short output).

Run:    nohup python3.11 -u scripts/classify_medium_to_hard.py > scripts/classify_mth.log 2>&1 &
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
CKPT_FILE    = os.path.join(SCRIPT_DIR,  "classify_mth_checkpoint.json")
MODS_DIR     = os.path.join(PROJECT_ROOT, "src/data/Modules")

WORKERS          = 20
MAX_RETRIES      = 3
CHECKPOINT_EVERY = 100

SYSTEM = (
    "You are an expert SAT question difficulty classifier. "
    "You will see calibration examples of Hard and Medium questions for a specific skill, "
    "along with the expected proportion that should be Hard. "
    "Your job: decide whether the given question is Medium or Hard. "
    "Do NOT default to Medium — if the question requires multi-step reasoning, "
    "careful reading, or non-obvious insight, classify it Hard. "
    "Reply with exactly one word: Medium or Hard."
)

def load_json(p):
    with open(p, encoding="utf-8") as f: return json.load(f)

def save_json(p, d):
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f: json.dump(d, f, indent=2, ensure_ascii=False)
    os.replace(tmp, p)

def load_ckpt():
    return load_json(CKPT_FILE) if os.path.exists(CKPT_FILE) else {}

def parse_result(raw):
    if not raw: return None
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
    for word in raw.split():
        w = word.strip(".,!?\"'").capitalize()
        if w in ("Medium", "Hard"): return w
    return None

def call_model(prompt, client, model, retries=0):
    import time
    try:
        resp = client.chat.completions.create(
            model=model, max_tokens=10, temperature=0,
            messages=[{"role":"system","content":SYSTEM},
                      {"role":"user","content":prompt}],
        )
        raw = resp.choices[0].message.content
        r   = parse_result(raw)
        return (r, None) if r else (None, f"bad: {(raw or '')[:60]}")
    except Exception as e:
        err = str(e)
        if retries < MAX_RETRIES:
            wait = 25*(retries+1) if ("429" in err or "rate" in err.lower()) else 2**retries
            if "429" in err or "rate" in err.lower():
                sys.stdout.write(f"\n  ⏳ 429 — wait {wait}s...\n"); sys.stdout.flush()
            time.sleep(wait)
            return call_model(prompt, client, model, retries+1)
        return None, err[:120]

def make_prompt(q, hard_exs, med_exs, flip_pct):
    skill  = (q.get("skill")  or "").strip()
    domain = (q.get("domain") or "").strip()
    text   = (q.get("text")   or "").replace("\n"," ").strip()[:350]
    choices = q.get("choices") or []
    choice_str = "  ".join(f"{c.get('id','')}) {(c.get('text') or '')[:80]}" for c in choices[:4])
    ans    = q.get("correctAnswer","")

    lines = [
        f"Skill: {skill}  |  Domain: {domain}",
        f"Target: ~{flip_pct:.0%} of Medium questions at this skill level should be Hard.",
        "",
        "HARD examples:",
    ]
    for ex in hard_exs:
        t = (ex.get("text") or "").replace("\n"," ").strip()[:180]
        lines.append(f'  • "{t}" → {ex.get("correctAnswer","")}')
    lines += ["", "MEDIUM examples:"]
    for ex in med_exs:
        t = (ex.get("text") or "").replace("\n"," ").strip()[:180]
        lines.append(f'  • "{t}" → {ex.get("correctAnswer","")}')
    lines += [
        "",
        "=== Classify this question: Medium or Hard? ===",
        f"Text: {text}",
    ]
    if choice_str:
        lines.append(f"Choices: {choice_str}")
    lines.append(f"Correct answer: {ans}")
    lines.append("\nReply with EXACTLY one word: Medium or Hard")
    return "\n".join(lines)

def main():
    random.seed(42)

    calib_qs = load_json(CALIB_FILE)
    math_qs  = load_json(MATH_FILE)
    read_qs  = load_json(READ_FILE)
    ckpt     = load_ckpt()

    # Per-skill: Hard% target and calibration pools
    skill_hard_pct = {}
    skill_hard_pool = defaultdict(list)
    skill_med_pool  = defaultdict(list)
    domain_hard_pct = {}
    domain_hard_pool = defaultdict(list)
    domain_med_pool  = defaultdict(list)

    by_skill = defaultdict(Counter)
    by_dom   = defaultdict(Counter)
    for q in calib_qs:
        sk = (q.get("skill")  or "").strip()
        dm = (q.get("domain") or "").strip()
        d  = (q.get("difficulty") or "").strip()
        if not d: continue
        if sk: by_skill[sk][d] += 1
        if dm: by_dom[dm][d] += 1
        if d == "Hard":
            if sk: skill_hard_pool[sk].append(q)
            if dm: domain_hard_pool[dm].append(q)
        elif d == "Medium":
            if sk: skill_med_pool[sk].append(q)
            if dm: domain_med_pool[dm].append(q)

    for sk, cnt in by_skill.items():
        total = sum(cnt.values()) or 1
        skill_hard_pct[sk] = cnt.get("Hard", 0) / total
    for dm, cnt in by_dom.items():
        total = sum(cnt.values()) or 1
        domain_hard_pct[dm] = cnt.get("Hard", 0) / total

    # Collect all Medium-labeled questions
    targets_raw = [(i,"math",q) for i,q in enumerate(math_qs) if q.get("difficulty")=="Medium"] + \
                  [(i,"read",q) for i,q in enumerate(read_qs)  if q.get("difficulty")=="Medium"]
    targets = [(i,b,q) for i,b,q in targets_raw if f"{b}_{i}" not in ckpt]
    cached  = len(targets_raw) - len(targets)

    print(f"Medium questions : {len(targets_raw)}")
    print(f"Already cached   : {cached}")
    print(f"To classify      : {len(targets)}")
    print(f"Model            : {REMOTE_MODEL}  (fallback: {LOCAL_MODEL})")
    print(f"Workers          : {WORKERS}\n")

    if targets:
        remote = OpenAI(base_url=OPENROUTER_URL, api_key=OPENROUTER_KEY)
        local  = OpenAI(base_url=OLLAMA_URL,     api_key="ollama")
        lock   = threading.Lock()
        done   = [cached]
        total  = len(targets_raw)
        flips  = [0]

        def worker(ibq):
            idx, bank, q = ibq
            sk = (q.get("skill")  or "").strip()
            dm = (q.get("domain") or "").strip()

            # Pick calibration examples — skill first, domain fallback
            hp = skill_hard_pool.get(sk) or domain_hard_pool.get(dm) or []
            mp = skill_med_pool.get(sk)  or domain_med_pool.get(dm)  or []
            hard_exs = random.sample(hp, min(4, len(hp)))
            med_exs  = random.sample(mp, min(2, len(mp)))

            # Flip % = Hard% / (Medium% + Hard%) — fraction of M+H that should be Hard
            h_pct = skill_hard_pct.get(sk) or domain_hard_pct.get(dm) or 0.31
            # proportion of current M+H pool that should be hard
            # approximate: treat as fraction of Mediums to flip
            flip_pct = h_pct  # use raw target; model sees it as guidance

            prompt = make_prompt(q, hard_exs, med_exs, flip_pct)
            result, err = call_model(prompt, remote, REMOTE_MODEL)
            model_used  = REMOTE_MODEL
            if not result:
                result, err2 = call_model(prompt, local, LOCAL_MODEL)
                model_used = LOCAL_MODEL
                if not result:
                    err = f"remote: {err} | local: {err2}"

            with lock:
                key = f"{bank}_{idx}"
                ckpt[key] = {"bank": bank, "idx": idx, "result": result, "error": None if result else err}
                done[0] += 1
                if result == "Hard": flips[0] += 1
                pct = done[0] / total * 100
                arrow = "→Hard" if result == "Hard" else "  ="
                sys.stdout.write(f"\r  [{done[0]}/{total}] {pct:.0f}%  {arrow}  flips={flips[0]}  ")
                sys.stdout.flush()
                if done[0] % CHECKPOINT_EVERY == 0:
                    save_json(CKPT_FILE, ckpt)

        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = [pool.submit(worker, t) for t in targets]
            for f in as_completed(futures):
                try: f.result()
                except Exception as e: sys.stdout.write(f"\n  exc: {e}\n")

        save_json(CKPT_FILE, ckpt)

    # ── Apply ─────────────────────────────────────────────────────────────────
    print("\n\nApplying Hard upgrades...")
    flipped = kept = errors = 0
    for key, entry in ckpt.items():
        bank  = entry["bank"]
        idx   = entry["idx"]
        result = entry.get("result")
        err    = entry.get("error")
        if err or not result:
            errors += 1; continue
        target = math_qs[idx] if bank == "math" else read_qs[idx]
        if result == "Hard" and target.get("difficulty") == "Medium":
            target["difficulty"] = "Hard"
            flipped += 1
        else:
            kept += 1

    save_json(MATH_FILE, math_qs)
    save_json(READ_FILE, read_qs)

    math_dist = Counter(q["difficulty"] for q in math_qs)
    read_dist = Counter(q["difficulty"] for q in read_qs)
    total_m = len(math_qs); total_r = len(read_qs)
    print(f"  Flipped to Hard : {flipped}")
    print(f"  Kept Medium     : {kept}")
    print(f"  Errors          : {errors}")
    print(f"\n  Math    Easy={math_dist['Easy']} ({math_dist['Easy']/total_m:.0%})"
          f"  Medium={math_dist['Medium']} ({math_dist['Medium']/total_m:.0%})"
          f"  Hard={math_dist['Hard']} ({math_dist['Hard']/total_m:.0%})")
    print(f"  Reading Easy={read_dist['Easy']} ({read_dist['Easy']/total_r:.0%})"
          f"  Medium={read_dist['Medium']} ({read_dist['Medium']/total_r:.0%})"
          f"  Hard={read_dist['Hard']} ({read_dist['Hard']/total_r:.0%})")
    print(f"\n  Target  Easy~36%  Medium~33%  Hard~31%")

    # Update module files
    print("\nUpdating module JSON files...")
    lookup = {}
    for q in math_qs: lookup[q["id"]] = q["difficulty"]
    for q in read_qs: lookup[q["id"]] = q["difficulty"]
    mod_files = sorted(f for f in os.listdir(MODS_DIR) if f.endswith(".json") and "manifest" not in f)
    upd = 0
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
            with open(tmp, "w", encoding="utf-8") as f: json.dump(mod, f, indent=2, ensure_ascii=False)
            os.replace(tmp, path); upd += 1
    print(f"  Module files updated: {upd}/{len(mod_files)}")
    if os.path.exists(CKPT_FILE): os.remove(CKPT_FILE)
    print("\n✓ Done.")

if __name__ == "__main__":
    main()
