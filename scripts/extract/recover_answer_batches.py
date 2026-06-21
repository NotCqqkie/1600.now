#!/usr/bin/env python3
"""Re-run failed answer-PDF batches with the content-filter-aware client.

After a pipeline run, finds batches that didn't yield explanations (likely tripped
the content moderation filter) and re-extracts them, falling back to per-page calls
when the filter triggers. Merges the recovered explanations into the saved
`answer_explanations.json`.

Usage:
    python -m scripts.extract.recover_answer_batches \
        --work-dir scripts/extract/_runs/test4/work
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path

from .stages.answers_pdf import (
    ANSWER_EXTRACTION_PROMPT,
    QUESTION_HEADER_RE,
    _group_pages_by_section,
    parse_delimited_response,
)
from .utils.cli_client import ContentFilterBlocked, RateLimitedClient


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--work-dir", required=True)
    parser.add_argument("--model", default=os.environ.get("EXTRACTION_MODEL", "default"))
    parser.add_argument("--batch-size", type=int, default=2)
    args = parser.parse_args()

    work = Path(args.work_dir)
    answers_work = work / "answers_pdf"
    metadata = json.loads((answers_work / "page_metadata.json").read_text())
    groups = _group_pages_by_section(metadata)

    # Load existing explanations
    exp_path = work / "answer_explanations.json"
    existing = json.loads(exp_path.read_text()) if exp_path.exists() else []
    existing_keys = {(e.get("section"), e.get("module"), e.get("question_number")) for e in existing}
    print(f"Existing explanations: {len(existing)}")

    # Find expected (section, module, question_number) tuples by scanning raw_text
    expected_questions = []
    for group in groups:
        for p in group["pages"]:
            for m in QUESTION_HEADER_RE.finditer(p.get("raw_text", "")):
                expected_questions.append((group["section"], group["module"], int(m.group(1))))
    expected_keys = set(expected_questions)
    print(f"Expected explanations across all sections: {len(expected_keys)}")

    missing = expected_keys - existing_keys
    print(f"Missing explanations: {len(missing)}")
    if not missing:
        print("Nothing to recover.")
        return

    # Group missing question numbers by (section, module) and find pages they're on
    by_section_module = {}
    for s, m, q in missing:
        by_section_module.setdefault((s, m), set()).add(q)

    client = RateLimitedClient(model=args.model, rpm=12, timeout_seconds=420)
    raw_dir = work / "answers_raw_recovery"
    raw_dir.mkdir(exist_ok=True)

    # Running state — written to disk after every page so a hang can't lose progress
    merged = list(existing)
    seen = set(existing_keys)

    def save():
        merged.sort(key=lambda e: (e["section"], e["module"], e["question_number"]))
        exp_path.write_text(json.dumps(merged, indent=2))

    for (section, module), q_nums in by_section_module.items():
        print(f"\n{section} Module {module}: missing Q{sorted(q_nums)}")

        # Find pages that contain any of the missing questions
        target_pages = []
        for group in groups:
            if group["section"] != section or group["module"] != module:
                continue
            for p in group["pages"]:
                page_q_nums = {int(m.group(1)) for m in QUESTION_HEADER_RE.finditer(p["raw_text"])}
                if page_q_nums & q_nums:
                    target_pages.append(p)
        print(f"  Pages to retry: {[p['page_num'] for p in target_pages]}")

        for p in target_pages:
            # Skip if every question on this page is already saved
            page_q_nums = {int(m.group(1)) for m in QUESTION_HEADER_RE.finditer(p["raw_text"])}
            still_missing = {q for q in page_q_nums if (section, module, q) not in seen} & q_nums
            if not still_missing:
                print(f"  Page {p['page_num']}: already covered, skipping")
                continue

            print(f"  Page {p['page_num']}...")
            try:
                response = client.call_with_images(
                    system="You are a precise extractor of SAT answer explanations. Output plain delimited text only.",
                    text=ANSWER_EXTRACTION_PROMPT,
                    image_paths=[p["image_path"]],
                )
                # Persist raw response immediately
                raw_path = raw_dir / f"{section.lower().replace(' ', '_')}_m{module}_p{p['page_num']:03d}.txt"
                raw_path.write_text(response)

                explanations = parse_delimited_response(response, section, module)
                added = 0
                for e in explanations:
                    key = (e["section"], e["module"], e["question_number"])
                    if key not in seen:
                        seen.add(key)
                        merged.append(e)
                        added += 1
                save()  # incremental save after every page
                print(f"    Got {len(explanations)} parsed, {added} new (total saved: {len(merged)})")
            except ContentFilterBlocked:
                print(f"    Content filter STILL blocked — skipping page {p['page_num']}")
            except Exception as e:
                print(f"    ERROR: {type(e).__name__}: {str(e)[:150]}")

    save()
    print(f"\nFinal: {len(merged)} explanations ({len(merged) - len(existing)} added)")
    print(f"Cost: {client.cost_summary()}")


if __name__ == "__main__":
    main()
