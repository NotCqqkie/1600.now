#!/usr/bin/env python3
"""Re-extract specific question numbers we lost from a previous run.

When the question extraction stage hits a JSON parse error, that batch's questions
are lost. This script targets a specific (section, [question_numbers]) pair, re-renders
only the relevant pages, and merges the recovered questions back into the section's
results JSON. Useful for filling holes without re-running the entire pipeline.

Usage:
    python -m scripts.extract.recover_lost_questions \
        --work-dir scripts/extract/_runs/test4/work \
        --section-id rw_module2 \
        --question-numbers 24 25 26
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path

from .stages.questions import (
    QUESTION_EXTRACTION_PROMPT,
    QUESTION_EXTRACTION_SYSTEM,
)
from .utils.cli_client import RateLimitedClient, parse_json_response


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--work-dir", required=True)
    parser.add_argument("--section-id", required=True, help="e.g. rw_module2")
    parser.add_argument("--question-numbers", nargs="+", type=int, required=True,
                        help="Space-separated list of question numbers to recover")
    parser.add_argument("--model", default=os.environ.get("EXTRACTION_MODEL", "default"))
    args = parser.parse_args()

    work = Path(args.work_dir)
    metadata = json.loads((work / "page_metadata.json").read_text())
    sections = json.loads((work / "sections.json").read_text())
    section = next(s for s in sections if s["section_id"] == args.section_id)

    # Find pages containing the target question numbers via raw text
    import re
    target_pages = set()
    for p in metadata["pages"]:
        if not (section["start_page"] <= p["page_num"] <= section["end_page"]):
            continue
        for q_num in args.question_numbers:
            # Match either a "Question N" header or a standalone bold-style question marker
            if re.search(rf"\bQuestion\s+{q_num}\b", p["raw_text"]) \
                    or re.search(rf"^\s*{q_num}\s*$", p["raw_text"], re.M):
                target_pages.add(p["page_num"])

    if not target_pages:
        # Fall back: include the page range that likely has them
        # (heuristic: first occurrence of the lowest missing number)
        for p in metadata["pages"]:
            if section["start_page"] <= p["page_num"] <= section["end_page"]:
                if str(min(args.question_numbers)) in p["raw_text"]:
                    target_pages.add(p["page_num"])
                    target_pages.add(p["page_num"] + 1)  # include adjacent in case of split

    target_page_list = sorted(target_pages)
    print(f"Target pages: {target_page_list}")
    if not target_page_list:
        print("No pages found! Aborting.")
        return

    # Get the page metadata entries
    page_metas = [p for p in metadata["pages"] if p["page_num"] in target_pages]
    image_paths = [p["image_path"] for p in page_metas]

    client = RateLimitedClient(model=args.model, rpm=30)
    print(f"Processing {len(image_paths)} pages...")
    response = client.call_with_images(
        system=QUESTION_EXTRACTION_SYSTEM,
        text=QUESTION_EXTRACTION_PROMPT,
        image_paths=image_paths,
    )

    questions = parse_json_response(response)
    print(f"Got {len(questions)} questions from response")

    # Filter to only the target question numbers
    target_set = set(args.question_numbers)
    recovered = [q for q in questions if q.get("question_number") in target_set]
    print(f"Filtered to {len(recovered)} target questions: {sorted(q['question_number'] for q in recovered)}")

    # Merge into existing section file
    section_file = work / "raw_questions" / f"{args.section_id}.json"
    existing = json.loads(section_file.read_text())
    existing_nums = {q["question_number"] for q in existing}
    to_add = [q for q in recovered if q["question_number"] not in existing_nums]
    if not to_add:
        print("All target questions already exist — nothing to merge.")
        return

    merged = existing + to_add
    merged.sort(key=lambda q: q["question_number"])
    section_file.write_text(json.dumps(merged, indent=2))

    # Also update checkpoint
    cp_path = work / "checkpoint.json"
    cp = json.loads(cp_path.read_text())
    sd = cp["stage_data"].setdefault("questions", {})
    sd[f"questions_{args.section_id}_results"] = merged
    sd[f"questions_{args.section_id}_final"] = merged
    cp_path.write_text(json.dumps(cp, indent=2))

    print(f"\nMerged {len(to_add)} recovered questions into {section_file.name}")
    print(f"Section now has {len(merged)} total questions")
    print(f"\nCost: {client.cost_summary()}")


if __name__ == "__main__":
    main()
