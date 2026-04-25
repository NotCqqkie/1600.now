#!/usr/bin/env python3

import argparse
import json
import os
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib import error, request

OPENROUTER_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"
DEFAULT_INPUT = os.path.join("scripts", "math_review.json")
DEFAULT_PREFIX = os.path.join("scripts", "nemotron_bank_review")

VERIFY_SYSTEM = """\
IMPORTANT: Return ONLY the JSON schema shown below. No other structure.

Fix and verify a SAT math question. Input is JSON with: text, choices, correctAnswer, type.

FIX in "text" and choice "text" fields only:
- Asterisk italics: "*x*"→"$x$", "*x**2*"→"$x^2$", "*f*(*x*)"→"$f(x)$"
- Bare math: "y=2x+3"→"$y=2x+3$", "x2+5"→"$x^2+5$"
- Bare symbols: ≤ ≥ ≠ π → wrap in $...$
- Obvious typos in English prose only

SOLVE the question completely. If unsolvable (missing image/table/context), set needs_review to true.

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

SEND_FIELDS = {"text", "prompt", "passage", "choices", "correctAnswer", "type", "questionImages"}


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)


def extract_json(text):
    if not text:
        return None
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    in_str = False
    esc = False
    for i, ch in enumerate(text[start:], start):
        if esc:
            esc = False
            continue
        if ch == "\\":
            esc = True
            continue
        if ch == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start : i + 1])
                except json.JSONDecodeError:
                    return None
    return None


def normalize_answer(answer):
    if answer is None:
        return None
    return str(answer).strip().upper().rstrip(".")


def slim(question):
    return {k: v for k, v in question.items() if k in SEND_FIELDS and v is not None}


def create_chat_completion(api_key, model, question, max_tokens):
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "temperature": 0,
        "messages": [
            {"role": "system", "content": VERIFY_SYSTEM},
            {"role": "user", "content": json.dumps(slim(question), ensure_ascii=False)},
        ],
    }
    req = request.Request(
        f"{OPENROUTER_URL}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with request.urlopen(req, timeout=180) as response:
        body = json.loads(response.read().decode("utf-8"))
    return body["choices"][0]["message"]["content"]


def call_model(api_key, model, question, max_tokens, retries):
    attempt = 0
    while True:
        try:
            text = create_chat_completion(api_key, model, question, max_tokens)
            result = extract_json(text)
            if result:
                return result, None
            return None, f"parse_fail: {text[:300]}"
        except error.HTTPError as exc:
            message = exc.read().decode("utf-8", errors="replace")
            err_text = f"HTTP {exc.code}: {message}"
            if attempt >= retries:
                return None, err_text
            wait_seconds = 60 * (attempt + 1) if exc.code == 429 else 2 ** attempt
            time.sleep(wait_seconds)
            attempt += 1
        except Exception as exc:
            if attempt >= retries:
                return None, str(exc)
            wait_seconds = 60 * (attempt + 1) if "429" in str(exc) else 2 ** attempt
            time.sleep(wait_seconds)
            attempt += 1


def build_record(index, question, result, error):
    source_index = question.get("originalIndex", index)
    answer_key = normalize_answer(question.get("correctAnswer"))
    model_answer = normalize_answer((result or {}).get("model_answer"))
    fixes = (result or {}).get("fixes") or {}
    changes = (result or {}).get("changes") or []
    needs_review = bool((result or {}).get("needs_review"))
    return {
        "index": source_index,
        "input_index": index,
        "id": question.get("id"),
        "testName": question.get("testName"),
        "answer_key": answer_key,
        "model_answer": model_answer,
        "answer_matches": model_answer == answer_key if model_answer is not None else None,
        "confidence": (result or {}).get("confidence"),
        "needs_review": needs_review,
        "review_reason": (result or {}).get("review_reason", ""),
        "has_fixes": bool(fixes),
        "fixes": fixes,
        "changes": changes,
        "calc": (result or {}).get("calc", ""),
        "error": error,
    }


def progress(done, total):
    pct = (done / total * 100) if total else 0
    sys.stdout.write(f"\rProcessed [{done}/{total}] {pct:.0f}%")
    sys.stdout.flush()


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=DEFAULT_INPUT)
    parser.add_argument("--output-prefix", default=DEFAULT_PREFIX)
    parser.add_argument("--model", default=os.environ.get("OPENROUTER_MODEL", DEFAULT_MODEL))
    parser.add_argument("--workers", type=int, default=int(os.environ.get("BANK_REVIEW_WORKERS", "1")))
    parser.add_argument("--delay", type=float, default=float(os.environ.get("BANK_REVIEW_DELAY", "2")))
    parser.add_argument("--max-tokens", type=int, default=int(os.environ.get("BANK_REVIEW_MAX_TOKENS", "1800")))
    parser.add_argument("--max-retries", type=int, default=int(os.environ.get("BANK_REVIEW_MAX_RETRIES", "5")))
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--limit", type=int, default=None)
    return parser.parse_args()


def main():
    args = parse_args()
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        print("OPENROUTER_API_KEY is required")
        return 1

    checkpoint_path = f"{args.output_prefix}_checkpoint.json"
    results_path = f"{args.output_prefix}_results.json"
    findings_path = f"{args.output_prefix}_findings.json"
    summary_path = f"{args.output_prefix}_summary.json"

    questions = load_json(args.input)
    selected = list(enumerate(questions))[args.start :]
    if args.limit is not None:
        selected = selected[: args.limit]

    checkpoint = load_json(checkpoint_path) if os.path.exists(checkpoint_path) else {}
    cached = {int(k): v for k, v in checkpoint.get("results", {}).items()}
    pending = [(idx, question) for idx, question in selected if idx not in cached]

    print(f"Input: {args.input}")
    print(f"Model: {args.model}")
    print(f"Selected questions: {len(selected)}")
    print(f"Cached: {len(cached)}")
    print(f"Pending: {len(pending)}")

    lock = threading.Lock()
    done = [len(cached)]

    def worker(item):
        idx, question = item
        result, error = call_model(api_key, args.model, question, args.max_tokens, args.max_retries)
        record = build_record(idx, question, result, error)
        with lock:
            cached[idx] = record
            done[0] += 1
            checkpoint["results"] = {str(k): v for k, v in cached.items()}
            save_json(checkpoint_path, checkpoint)
            progress(done[0], len(selected))
        if args.delay > 0:
            time.sleep(args.delay)

    if pending:
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
            futures = [pool.submit(worker, item) for item in pending]
            for future in as_completed(futures):
                future.result()
        print()

    ordered = [cached[idx] for idx, _ in selected if idx in cached]
    findings = [
        record
        for record in ordered
        if record["error"]
        or record["needs_review"]
        or record["has_fixes"]
        or record["answer_matches"] is False
    ]

    summary = {
        "input": args.input,
        "model": args.model,
        "selected_count": len(selected),
        "completed_count": len(ordered),
        "error_count": sum(1 for record in ordered if record["error"]),
        "needs_review_count": sum(1 for record in ordered if record["needs_review"]),
        "fix_count": sum(1 for record in ordered if record["has_fixes"]),
        "answer_mismatch_count": sum(1 for record in ordered if record["answer_matches"] is False),
    }

    save_json(results_path, ordered)
    save_json(findings_path, findings)
    save_json(summary_path, summary)

    print(json.dumps(summary, indent=2))
    print(results_path)
    print(findings_path)
    print(summary_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
