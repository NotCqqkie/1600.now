#!/usr/bin/env python3
"""Stage runner: generate explanations for a bank of questions.

Resumable. Writes one output per question to `out_dir/<question-id>.json`.
Skips any question whose output file already exists and is valid JSON.

Usage:
    python scripts/run_stage.py --bank src/data/questions/math_past.json --out /tmp/expl-stage1/math --workers 8
    python scripts/run_stage.py --bank src/data/questions/reading_past.json --out /tmp/expl-stage1/reading --workers 8
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# id -> list of absolute image paths, lazily built once per process
_IMAGE_INDEX: dict[str, list[str]] | None = None


def build_image_index() -> dict[str, list[str]]:
    """Scan Modules/*.json once and resolve images to on-disk paths."""
    import glob
    mods = glob.glob(".claude/worktrees/sweet-yonath/src/data/Modules/*.json")
    roots = [
        Path(".claude/worktrees/sweet-yonath/public/images/SAT-Style Questions"),
        Path("public/images/SAT-Style Questions"),
    ]
    idx: dict[str, list[str]] = {}
    for m in mods:
        try:
            data = json.loads(Path(m).read_text())
        except Exception:
            continue
        qs = data if isinstance(data, list) else data.get("questions", [])
        for q in qs:
            imgs = q.get("images") or []
            if not imgs:
                continue
            resolved: list[str] = []
            for im in imgs:
                name = os.path.basename(im.get("local", ""))
                stem = re.sub(r"_\d+(\.[a-z]+)$", r"\1", name)
                for root in roots:
                    found = False
                    for cand in {name, stem}:
                        p = root / cand
                        if p.exists():
                            resolved.append(str(p.resolve()))
                            found = True
                            break
                    if found:
                        break
            if len(resolved) == len(imgs):
                idx[q["id"]] = resolved
    return idx


def enrich_question(q: dict, idx: dict[str, list[str]]) -> dict:
    """If the question id has resolved images, attach them under `images`."""
    q = dict(q)
    paths = idx.get(q["id"])
    if paths:
        q["images"] = [{"local": os.path.basename(p)} for p in paths]
    return q


def generate_one(q: dict, out_dir: Path) -> tuple[str, str]:
    out_path = out_dir / f"{q['id']}.json"
    if out_path.exists():
        try:
            json.loads(out_path.read_text())
            return (q["id"], "skip")
        except json.JSONDecodeError:
            pass  # fall through and regenerate
    # Write enriched question to a temp file and invoke the generator
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tf:
        json.dump(q, tf)
        qpath = tf.name
    try:
        result = subprocess.run(
            ["python3", "scripts/gen_explanation_trial.py",
             "--file", qpath, "--out", str(out_path)],
            capture_output=True, text=True, timeout=360,
        )
        if result.returncode != 0 or not out_path.exists():
            return (q["id"], f"fail: {result.stderr[-200:]}")
        return (q["id"], "ok")
    except subprocess.TimeoutExpired:
        return (q["id"], "timeout")
    finally:
        os.unlink(qpath)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bank", required=True, help="Path to question bank JSON")
    ap.add_argument("--out", required=True, help="Output directory")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--limit", type=int, default=0, help="Only process first N (0 = all)")
    args = ap.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Loading bank {args.bank}...", flush=True)
    questions: list[dict] = json.loads(Path(args.bank).read_text())
    if args.limit:
        questions = questions[: args.limit]
    print(f"  {len(questions)} questions", flush=True)

    print("Building image index from Modules/...", flush=True)
    idx = build_image_index()
    print(f"  {len(idx)} question ids have resolved images", flush=True)

    enriched = [enrich_question(q, idx) for q in questions]
    with_images = sum(1 for q in enriched if q.get("images"))
    print(f"  {with_images} / {len(enriched)} in this bank have attachable images", flush=True)

    done = sum(1 for q in enriched if (out_dir / f"{q['id']}.json").exists())
    print(f"Already done: {done} / {len(enriched)} — {len(enriched) - done} remaining", flush=True)

    start = time.time()
    ok = skip = fail = 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(generate_one, q, out_dir): q for q in enriched}
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
