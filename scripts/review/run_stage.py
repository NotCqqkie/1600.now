#!/usr/bin/env python3
"""Stage runner: generate explanations for a bank of questions.

Resumable. Writes one output per question to `out_dir/<question-id>.json`.
Skips any question whose output file already exists and is valid JSON.

Providers rotate round-robin: haiku → ollama → openrouter keys → repeat.
Rate-limited providers cool down 15 min before being tried again.

Usage:
    OPENROUTER_KEY_0=sk-or-... OLLAMA_MODEL_0=qwen3:32b \\
        python scripts/review/run_stage.py \\
        --bank src/data/questions/math_past.json \\
        --out /tmp/expl-stage1/math --workers 8
"""
import argparse
import json
import os
import re
import subprocess
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# With --no-session-persistence on claude CLI, no session-file conflicts; no lock needed
_COOLDOWN = 900  # 15 min cooldown per provider after rate-limit


# ── Image index ──────────────────────────────────────────────────────────────

def build_image_index() -> dict[str, list[str]]:
    """Read questionImageMap.ts and resolve image srcs to on-disk paths."""
    import urllib.parse
    roots = [
        Path("public/images/SAT-Style Questions"),
        Path(".claude/worktrees/sweet-yonath/public/images/SAT-Style Questions"),
    ]
    idx: dict[str, list[str]] = {}
    map_path = Path("src/data/questionImageMap.ts")
    if not map_path.exists():
        return idx
    content = map_path.read_text()
    for m in re.finditer(r'"([^"]+)":\s*\{[^{}]*?"questionImages":\s*\[(.*?)\]', content, re.S):
        qid = m.group(1)
        srcs = re.findall(r'"src":\s*"([^"]+)"', m.group(2))
        resolved = []
        for src in srcs:
            name = os.path.basename(urllib.parse.unquote(src))
            for root in roots:
                p = root / name
                if p.exists():
                    resolved.append(str(p.resolve()))
                    break
        if resolved:
            idx[qid] = resolved
    return idx


def enrich_question(q: dict, idx: dict[str, list[str]]) -> dict:
    q = dict(q)
    paths = idx.get(q["id"])
    if paths:
        q["images"] = [{"local": os.path.basename(p)} for p in paths]
    return q


# ── Model pool ────────────────────────────────────────────────────────────────

class ModelPool:
    """Round-robin across all providers. Rate-limited ones cool down 15 min."""

    def __init__(self, or_keys: list[str], ollama_models: list[str] = None):
        self._lock = threading.Lock()
        self._providers: list[dict] = []
        self._providers.append({"type": "haiku", "limited_until": 0.0,
                                 "sem": threading.Semaphore(16)})
        for m in (ollama_models or []):
            self._providers.append({"type": "ollama", "model": m,
                                    "limited_until": 0.0, "sem": threading.Semaphore(1)})
        for k in or_keys:
            self._providers.append({"type": "openrouter", "key": k,
                                    "limited_until": 0.0, "sem": None})
        self._rr = 0

    def _label(self, p: dict) -> str:
        if p["type"] == "haiku":   return "haiku"
        if p["type"] == "ollama":  return f"ollama/{p['model']}"
        return f"openrouter {p['key'][:12]}…"

    def _mark_limited(self, p: dict):
        with self._lock:
            p["limited_until"] = time.time() + _COOLDOWN
        print(f"  [{self._label(p)}] rate-limited, retrying in {_COOLDOWN//60}min", flush=True)

    def _soonest_reset(self) -> float:
        with self._lock:
            return max(0.0, min(p["limited_until"] for p in self._providers) - time.time())

    def run(self, qpath: str, out_path: str) -> str:
        cmd = ["python3", "scripts/generate/gen_explanation_trial.py",
               "--file", qpath, "--out", out_path]
        while True:
            chosen = None
            sem_acquired = False

            with self._lock:
                now = time.time()
                n = len(self._providers)
                for i in range(n):
                    p = self._providers[(self._rr + i) % n]
                    if now < p["limited_until"]:
                        continue
                    sem = p.get("sem")
                    if sem is not None:
                        if not sem.acquire(blocking=False):
                            continue  # in use by another worker
                        sem_acquired = True
                    chosen = p
                    self._rr = (self._providers.index(p) + 1) % n
                    break

            if chosen is None:
                wait = self._soonest_reset()
                print(f"  All providers busy/limited — waiting {wait:.0f}s", flush=True)
                time.sleep(min(max(wait, 1) + 2, 60))
                continue

            try:
                env = os.environ.copy()
                env.pop("OPENROUTER_API_KEY", None)
                env.pop("OLLAMA_MODEL", None)
                if chosen["type"] == "openrouter":
                    env["OPENROUTER_API_KEY"] = chosen["key"]
                elif chosen["type"] == "ollama":
                    env["OLLAMA_MODEL"] = chosen["model"]

                timeout = 600 if chosen["type"] == "ollama" else 400
                result = subprocess.run(cmd, capture_output=True, text=True,
                                        timeout=timeout, env=env)
            finally:
                if sem_acquired:
                    chosen["sem"].release()

            if result.returncode == 2:
                self._mark_limited(chosen)
                continue

            if result.returncode != 0 or not Path(out_path).exists():
                return f"fail: {result.stderr[-400:]}"
            return "ok"


# ── Per-question worker ───────────────────────────────────────────────────────

def generate_one(q: dict, out_dir: Path, pool: ModelPool) -> tuple[str, str]:
    out_path = out_dir / f"{q['id']}.json"
    if out_path.exists():
        try:
            json.loads(out_path.read_text())
            return (q["id"], "skip")
        except json.JSONDecodeError:
            pass

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tf:
        json.dump(q, tf)
        qpath = tf.name
    try:
        status = pool.run(qpath, str(out_path))
        return (q["id"], status)
    except subprocess.TimeoutExpired:
        return (q["id"], "timeout")
    finally:
        try:
            os.unlink(qpath)
        except FileNotFoundError:
            pass


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bank", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Loading bank {args.bank}...", flush=True)
    questions: list[dict] = json.loads(Path(args.bank).read_text())
    if args.limit:
        questions = questions[: args.limit]
    print(f"  {len(questions)} questions", flush=True)

    print("Building image index from questionImageMap.ts...", flush=True)
    idx = build_image_index()
    print(f"  {len(idx)} question ids have resolved images", flush=True)

    enriched = [enrich_question(q, idx) for q in questions]
    with_images = sum(1 for q in enriched if q.get("images"))
    print(f"  {with_images} / {len(enriched)} in this bank have attachable images", flush=True)

    done = sum(1 for q in enriched if (out_dir / f"{q['id']}.json").exists())
    print(f"Already done: {done} / {len(enriched)} — {len(enriched) - done} remaining", flush=True)

    or_keys = [v for k, v in sorted(os.environ.items()) if k.startswith("OPENROUTER_KEY_")]
    ollama_models = [v for k, v in sorted(os.environ.items()) if k.startswith("OLLAMA_MODEL_")]
    pool = ModelPool(or_keys, ollama_models)
    providers_str = " → ".join(
        ["haiku"] + [f"ollama/{m}" for m in ollama_models] + [f"or/{k[:8]}…" for k in or_keys]
    )
    print(f"Providers (round-robin, 15min cooldown): {providers_str}", flush=True)

    start = time.time()
    ok = skip = fail = 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(generate_one, q, out_dir, pool): q for q in enriched}
        for i, fut in enumerate(as_completed(futs), 1):
            qid, status = fut.result()
            if status == "ok":
                ok += 1
            elif status == "skip":
                skip += 1
            else:
                fail += 1
                print(f"  FAIL {qid}: {status}", flush=True)
            if i % 50 == 0:
                elapsed = time.time() - start
                rate = i / elapsed if elapsed else 0
                remaining = (len(enriched) - i) / rate if rate else 0
                print(f"[{i}/{len(enriched)}] ok={ok} skip={skip} fail={fail} "
                      f"rate={rate:.2f}/s eta={remaining/60:.1f}min", flush=True)

    print(f"\nDONE: ok={ok} skip={skip} fail={fail} "
          f"total={len(enriched)} elapsed={(time.time()-start)/60:.1f}min", flush=True)


if __name__ == "__main__":
    main()
