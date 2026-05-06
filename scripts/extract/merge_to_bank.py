#!/usr/bin/env python3
"""Merge validated output JSON into the project's question bank files.

Usage:
    python -m scripts.extract.merge_to_bank \
        --output-dir scripts/extract/_runs/test4/output \
        [--dry-run]

Reads `practice_test_{N}_math.json` and `practice_test_{N}_reading.json` from the
output dir, dedupes against the existing banks, and appends new questions to
`src/data/questions/math_past.json` / `reading_past.json`.
"""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path

from .utils.dedup import normalize_for_hash


def get_project_root() -> Path:
    p = Path(__file__).resolve().parent
    while p != p.parent:
        if (p / "src").is_dir() and (p / "public").is_dir():
            return p
        p = p.parent
    return Path(__file__).resolve().parent.parent.parent


def merge_one(new_path: Path, existing_path: Path, dry_run: bool) -> dict:
    if not new_path.exists():
        return {"new_path": str(new_path), "status": "missing"}

    new_questions = json.loads(new_path.read_text())
    existing = json.loads(existing_path.read_text()) if existing_path.exists() else []

    existing_hashes = {normalize_for_hash(q.get("text", "")) for q in existing}
    existing_ids = {q.get("id") for q in existing}

    to_add = []
    skipped_dupes = 0
    skipped_id_collision = 0
    for q in new_questions:
        h = normalize_for_hash(q.get("text", ""))
        if h in existing_hashes:
            skipped_dupes += 1
            continue
        if q.get("id") in existing_ids:
            skipped_id_collision += 1
            continue
        # Strip our private sidecar before merging
        q.pop("_incorrect_explanations", None)
        to_add.append(q)
        existing_hashes.add(h)
        existing_ids.add(q.get("id"))

    summary = {
        "file": str(existing_path),
        "existing": len(existing),
        "new_to_add": len(to_add),
        "skipped_text_dupes": skipped_dupes,
        "skipped_id_collisions": skipped_id_collision,
    }

    if not dry_run and to_add:
        merged = existing + to_add
        existing_path.write_text(json.dumps(merged, indent=2))
        summary["written"] = True
    else:
        summary["written"] = False

    return summary


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True, help="Pipeline output dir for one test")
    parser.add_argument("--dry-run", action="store_true", help="Print plan, don't write")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    project_root = get_project_root()
    bank_dir = project_root / "src" / "data" / "questions"

    # Locate the math/reading output files
    math_files = list(output_dir.glob("*_math.json"))
    reading_files = list(output_dir.glob("*_reading.json"))

    if not math_files and not reading_files:
        print(f"No math/reading output files found in {output_dir}")
        return

    summaries = []
    if math_files:
        summaries.append(merge_one(math_files[0], bank_dir / "math_past.json", args.dry_run))
    if reading_files:
        summaries.append(merge_one(reading_files[0], bank_dir / "reading_past.json", args.dry_run))

    print(json.dumps(summaries, indent=2))
    if args.dry_run:
        print("\n(dry run — no files written)")


if __name__ == "__main__":
    main()
