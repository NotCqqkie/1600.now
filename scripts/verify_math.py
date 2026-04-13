#!/usr/bin/python3
"""
Verify and fix SAT math questions using qwen3:32b via local Ollama.

Run: python3 scripts/verify_math.py
Resume: just re-run — checkpoint auto-loaded

Outputs:
  scripts/math_corrected.json    — fixed questions (same structure as math_review.json)
  scripts/verification_log.json  — per-question audit: changes, solution, flags
  scripts/checkpoint.json        — progress state (auto-resume on interrupt)
"""

import json
import os
import re
import sys
import threading
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

# ── Config ────────────────────────────────────────────────────────────────────

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "qwen3:32b"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE  = os.path.join(SCRIPT_DIR, "math_review.json")
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "math_corrected.json")
LOG_FILE    = os.path.join(SCRIPT_DIR, "verification_log.json")
CKPT_FILE   = os.path.join(SCRIPT_DIR, "checkpoint.json")

WORKERS            = 2    # 2 is optimal for single-GPU bandwidth sharing
CHECKPOINT_EVERY   = 20
MAX_RETRIES        = 4

HEADERS = {"Content-Type": "application/json"}

# ── Prompt ────────────────────────────────────────────────────────────────────
# Concise — no prose. The model should make fixes silently, not explain them.

SYSTEM_PROMPT = """\
Fix and verify a SAT math question. Input has: text, choices, correctAnswer, type.

FIX in "text" and choice "text" fields only:
- Asterisk italics: "* x *"→"$x$", "* x ** 2 *"→"$x^2$", "* f *(* x *)"→"$f(x)$"
- Bare math: "y=2x+3"→"$y=2x+3$", "x2+5"→"$x^2+5$"
- Bare symbols: ≤ ≥ ≠ π → wrap in $...$
- Obvious typos in English prose only

SOLVE it. Compare to correctAnswer.

Return ONLY this JSON (no fences):
{
  "fixes": {
    "text": "corrected text here",
    "choices": [{"id":"A","text":"corrected"}]
  },
  "changes": ["text:old→new"],
  "calc": "brief calc e.g. 50+4(5)=70",
  "model_answer": "D",
  "answer_matches": true,
  "needs_review": false
}

IMPORTANT: "fixes" contains ONLY fields/choices that actually changed. Omit unchanged fields. If nothing changed, use "fixes": {}.
"needs_review": true only if question is genuinely incoherent.\
"""

# ── I/O helpers ───────────────────────────────────────────────────────────────

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
        cp = load_json(CKPT_FILE)
        return {int(k): v for k, v in cp.get("results", {}).items()}
    return {}

def save_checkpoint(results):
    save_json(CKPT_FILE, {"completed": len(results),
                          "results": {str(k): v for k, v in results.items()}})

# ── API call ──────────────────────────────────────────────────────────────────

_SEND_FIELDS = {"text", "prompt", "passage", "choices", "correctAnswer", "type", "questionImages"}

def _slim_question(question):
    """Strip immutable verbose fields before sending — reduces input tokens ~30%."""
    return {k: v for k, v in question.items() if k in _SEND_FIELDS and v is not None}

def call_ollama(question, retries=0):
    payload = {
        "model": MODEL,
        "think": False,   # disable Qwen3 extended reasoning chain (much faster)
        "stream": False,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": json.dumps(_slim_question(question), ensure_ascii=False)},
        ],
        "options": {
            "temperature": 0,
            "num_predict": 1200,  # diffs-only output is much shorter
            "repeat_penalty": 1.0,
        },
    }
    try:
        r = requests.post(OLLAMA_URL, headers=HEADERS, json=payload, timeout=300)
        if r.status_code != 200:
            if retries < MAX_RETRIES:
                time.sleep(2 ** retries)
                return call_ollama(question, retries + 1)
            return None, f"HTTP {r.status_code}: {r.text[:120]}"
        return r.json()["message"]["content"], None
    except requests.exceptions.Timeout:
        if retries < MAX_RETRIES:
            time.sleep(2 ** retries)
            return call_ollama(question, retries + 1)
        return None, "Timeout"
    except Exception as e:
        return None, str(e)

# ── JSON extraction ───────────────────────────────────────────────────────────

def extract_json(text):
    if not text:
        return None
    # Strip Qwen thinking tags
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    # Strip fences
    text = re.sub(r"^```(?:json)?", "", text.strip())
    text = re.sub(r"```$", "", text.strip()).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Find outermost { }
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    in_str = esc = False
    for i, ch in enumerate(text[start:], start):
        if esc:        esc = False;  continue
        if ch == "\\": esc = True;  continue
        if ch == '"':  in_str = not in_str; continue
        if in_str:     continue
        if ch == "{":  depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:    return json.loads(text[start:i+1])
                except: return None
    return None

# ── Process one question ──────────────────────────────────────────────────────

def process(index, question):
    q_id   = question.get("id", f"idx-{index}")
    q_test = question.get("testName", "?")

    raw, err = call_ollama(question)

    if err:
        return index, question, {
            "index": index, "id": q_id, "testName": q_test,
            "error": err, "changes": [], "answer_matches": None, "needs_review": True,
        }

    result = extract_json(raw)
    if not result or "fixes" not in result:
        return index, question, {
            "index": index, "id": q_id, "testName": q_test,
            "error": "parse_fail", "raw": (raw or "")[:300],
            "changes": [], "answer_matches": None, "needs_review": True,
        }

    # Merge diffs onto original — only changed fields are in result["fixes"]
    cq = dict(question)
    fixes = result.get("fixes") or {}
    if "text" in fixes:
        cq["text"] = fixes["text"]
    if "prompt" in fixes:
        cq["prompt"] = fixes["prompt"]
    if "passage" in fixes:
        cq["passage"] = fixes["passage"]
    if "choices" in fixes:
        choice_map = {c["id"]: dict(c) for c in cq.get("choices", [])}
        for fc in fixes["choices"]:
            if fc["id"] in choice_map:
                choice_map[fc["id"]].update(fc)
        cq["choices"] = list(choice_map.values())
    # Always enforce immutable fields from original (model never touches these)
    for k in ("id","section","domain","skill","difficulty",
               "rationale","testName","correctAnswer","type","category"):
        if k in question:
            cq[k] = question[k]

    return index, cq, {
        "index": index, "id": q_id, "testName": q_test,
        "changes":        result.get("changes", []),
        "calc":           result.get("calc", ""),
        "model_answer":   result.get("model_answer", ""),
        "answer_matches": result.get("answer_matches", True),
        "needs_review":   result.get("needs_review", False),
    }

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    questions = load_json(INPUT_FILE)
    total     = len(questions)
    print(f"Loaded {total} questions  |  model: {MODEL}  |  workers: {WORKERS}")

    done_map = load_checkpoint()
    if done_map:
        print(f"Resuming: {len(done_map)}/{total} already done")

    work = [(i, questions[i]) for i in range(total) if i not in done_map]
    print(f"Remaining: {len(work)}\n")

    if not work:
        _finalize(questions, done_map, total)
        return

    lock     = threading.Lock()
    start_t  = time.time()
    last_ckpt = len(done_map)

    stats = {"fixed": 0, "mismatch": 0, "review": 0, "err": 0,
             "done": len(done_map)}
    # seed stats from checkpoint
    for r in done_map.values():
        lg = r.get("log", {})
        if lg.get("changes"):    stats["fixed"]   += 1
        if not lg.get("answer_matches", True): stats["mismatch"] += 1
        if lg.get("needs_review"):  stats["review"]  += 1
        if lg.get("error"):      stats["err"]     += 1

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(process, i, q): i for i, q in work}

        for fut in as_completed(futures):
            try:
                idx, cq, lg = fut.result()
            except Exception as exc:
                idx = futures[fut]
                cq  = questions[idx]
                lg  = {"index": idx, "id": questions[idx].get("id"),
                       "error": str(exc), "changes": [],
                       "answer_matches": None, "needs_review": True}

            with lock:
                done_map[idx] = {"corrected": cq, "log": lg}
                stats["done"] += 1
                if lg.get("changes"):            stats["fixed"]   += 1
                if not lg.get("answer_matches", True): stats["mismatch"] += 1
                if lg.get("needs_review"):       stats["review"]  += 1
                if lg.get("error"):              stats["err"]     += 1

                n   = stats["done"]
                pct = n / total * 100
                ela = time.time() - start_t
                rate = (n - last_ckpt) / ela if ela else 0
                eta  = (total - n) / rate / 60 if rate else 0

                sys.stdout.write(
                    f"\r[{n}/{total}] {pct:.1f}%  "
                    f"fixed={stats['fixed']}  mismatch={stats['mismatch']}  "
                    f"review={stats['review']}  err={stats['err']}  "
                    f"| {rate:.2f}q/s  ~{eta:.0f}m left   "
                )
                sys.stdout.flush()

                if not lg.get("answer_matches", True):
                    sys.stdout.write(
                        f"\n  ⚠ MISMATCH [{idx}] {lg.get('id','?')[:50]} "
                        f"model={lg.get('model_answer')} "
                        f"expected={questions[idx].get('correctAnswer')}\n"
                    )
                if lg.get("error") and lg["error"] not in ("parse_fail",):
                    sys.stdout.write(f"\n  ✗ ERR [{idx}] {lg['error'][:80]}\n")

                if stats["done"] - last_ckpt >= CHECKPOINT_EVERY:
                    save_checkpoint(done_map)
                    last_ckpt = stats["done"]

    save_checkpoint(done_map)
    _finalize(questions, done_map, total)


def _finalize(questions, done_map, total):
    corrected_out = []
    log_out       = []
    for i in range(total):
        if i in done_map:
            corrected_out.append(done_map[i]["corrected"])
            log_out.append(done_map[i]["log"])
        else:
            corrected_out.append(questions[i])
            log_out.append({"index": i, "id": questions[i].get("id"),
                            "error": "not_processed", "changes": [], "needs_review": True})

    save_json(OUTPUT_FILE, corrected_out)
    save_json(LOG_FILE,    log_out)

    fixed     = sum(1 for e in log_out if e.get("changes"))
    mismatches = [e for e in log_out if not e.get("answer_matches", True)]
    review     = [e for e in log_out if e.get("needs_review")]
    errors     = [e for e in log_out if e.get("error")]

    print(f"\n\n{'='*60}")
    print(f"DONE — {total} questions")
    print(f"  Formatting fixed : {fixed}")
    print(f"  Answer mismatches: {len(mismatches)}")
    print(f"  Needs review     : {len(review)}")
    print(f"  Errors           : {len(errors)}")
    print(f"\n  → {OUTPUT_FILE}")
    print(f"  → {LOG_FILE}")

    if mismatches:
        print(f"\n⚠ Mismatches:")
        for m in mismatches[:20]:
            print(f"  [{m['index']}] {m.get('id','?')[:45]}  model={m.get('model_answer')}  expected=???")
        if len(mismatches) > 20:
            print(f"  ...+{len(mismatches)-20} more in log")

    if os.path.exists(CKPT_FILE):
        os.remove(CKPT_FILE)


if __name__ == "__main__":
    main()
