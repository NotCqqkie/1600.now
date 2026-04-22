#!/usr/bin/env python3
"""Judge every explanation in a stage output dir; write consolidated grades.json.

Usage:
    python scripts/judge_stage.py \
        --bank src/data/questions/math_past.json \
        --out /tmp/expl-stage1/math \
        --grades /tmp/expl-stage1/math-grades.json \
        --workers 8
"""
import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# Reuse llm_judge helpers
sys.path.insert(0, str(Path(__file__).parent))
from llm_judge import grade_one  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bank", required=True)
    ap.add_argument("--out", required=True, help="Stage output dir with <id>.json files")
    ap.add_argument("--grades", required=True, help="Output grades JSON path")
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()

    bank = json.loads(Path(args.bank).read_text())
    out_dir = Path(args.out)
    grades_path = Path(args.grades)

    existing: dict[str, dict] = {}
    if grades_path.exists():
        try:
            existing = {g["questionId"]: g for g in json.loads(grades_path.read_text())}
        except Exception:
            existing = {}

    # Write each question as a temp file for grade_one (it expects a path)
    import tempfile, os

    def grade_task(q: dict) -> dict | None:
        qid = q["id"]
        if qid in existing and "error" not in existing[qid]:
            return existing[qid]  # already graded cleanly
        epath = out_dir / f"{qid}.json"
        if not epath.exists():
            return {"questionId": qid, "section": q["section"],
                    "difficulty": q.get("difficulty", "?"),
                    "error": "no explanation file"}
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tf:
            json.dump(q, tf)
            qpath = tf.name
        try:
            return grade_one(Path(qpath), epath)
        finally:
            os.unlink(qpath)

    results: list[dict] = []
    todo = [q for q in bank if q["id"] not in existing or "error" in existing[q["id"]]]
    print(f"Grading {len(todo)} (skipping {len(existing) - len(todo) + len(todo)} already graded)...", flush=True)

    # Also carry forward already-clean grades
    for qid, g in existing.items():
        if "error" not in g:
            results.append(g)

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(grade_task, q): q["id"] for q in todo}
        for i, fut in enumerate(as_completed(futs), 1):
            g = fut.result()
            if g:
                results.append(g)
            if i % 50 == 0:
                # Incremental checkpoint
                grades_path.write_text(json.dumps(results, indent=2))
                print(f"[{i}/{len(todo)}] checkpointed", flush=True)

    grades_path.write_text(json.dumps(results, indent=2))

    # Stats
    valid = [g for g in results if "error" not in g]
    flagged = [g for g in valid
               if g.get("correctness", 5) < 5
               or (g.get("correctness", 5) + g.get("efficiency", 5)
                   + g.get("confidence", 5) + g.get("non_redundancy", 5)
                   + g.get("readability", 5)) / 5 < 4.5]
    print(f"\nTotal graded: {len(results)}")
    print(f"  valid: {len(valid)}")
    print(f"  errors: {len(results) - len(valid)}")
    print(f"  flagged for Codex review: {len(flagged)} ({100*len(flagged)/max(len(valid),1):.1f}%)")
    for dim in ["correctness", "efficiency", "confidence", "non_redundancy", "readability"]:
        avg = sum(g[dim] for g in valid) / max(len(valid), 1)
        print(f"  {dim:18} avg={avg:.2f}")


if __name__ == "__main__":
    main()
