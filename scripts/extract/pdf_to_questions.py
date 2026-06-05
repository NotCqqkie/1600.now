#!/usr/bin/env python3
from __future__ import annotations
"""
SAT Practice Test PDF → Question Bank JSON Pipeline

Usage:
    # Single PDF
    python -m scripts.extract.pdf_to_questions \
        --pdf /path/to/sat_practice_test_4.pdf \
        --test-number 4

    # Batch mode
    python -m scripts.extract.pdf_to_questions \
        --pdf-dir /path/to/pdfs/ \
        --test-map tests.json \
        --batch

    # Resume interrupted run
    python -m scripts.extract.pdf_to_questions \
        --pdf /path/to/test.pdf --test-number 4 --resume

Environment:
    ANTHROPIC_API_KEY must be set (or pass --api-key)
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

from .stages.render import render_pdf_pages
from .stages.sections import detect_sections
from .stages.answer_keys import extract_answer_keys
from .stages.answers_pdf import extract_answer_pdf
from .stages.questions import extract_all_questions
from .stages.figures import extract_figures
from .stages.classify import classify_and_enrich
from .stages.validate import validate_and_output
from .utils.cli_client import RateLimitedClient
from .utils.checkpoint import Checkpoint


def get_project_root() -> Path:
    """Walk up from this file to find the project root (has src/ and public/)."""
    p = Path(__file__).resolve().parent
    while p != p.parent:
        if (p / "src").is_dir() and (p / "public").is_dir():
            return p
        p = p.parent
    return Path(__file__).resolve().parent.parent.parent


def process_single_pdf(
    pdf_path: str,
    test_number: int,
    client: RateLimitedClient,
    output_dir: Path,
    work_dir: Path,
    project_root: Path,
    dpi: int = 200,
    batch_size: int = 2,
    resume: bool = False,
    answers_pdf_path: str | None = None,
):
    """Run the full 7-stage pipeline on a single PDF."""
    work_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    checkpoint = Checkpoint(work_dir)
    if not resume:
        checkpoint.reset()

    start_time = time.time()

    # Stage 1: Render PDF pages
    if checkpoint.is_done("render"):
        print("Stage 1 (Render): cached")
        metadata = json.loads((work_dir / "page_metadata.json").read_text())
    else:
        print("\n=== Stage 1: Rendering PDF pages ===")
        metadata = render_pdf_pages(pdf_path, work_dir, dpi)
        checkpoint.mark_done("render")

    # Stage 2: Section detection
    if checkpoint.is_done("sections"):
        print("Stage 2 (Sections): cached")
        sections = json.loads((work_dir / "sections.json").read_text())
    else:
        print("\n=== Stage 2: Detecting sections ===")
        sections = detect_sections(metadata, work_dir)
        checkpoint.mark_done("sections")

    # Stage 3: Answer key extraction
    if checkpoint.is_done("answer_keys"):
        print("Stage 3 (Answer Keys): cached")
        ak_path = work_dir / "answer_keys.json"
        answer_keys = json.loads(ak_path.read_text()) if ak_path.exists() else []
    else:
        print("\n=== Stage 3: Extracting answer keys ===")
        answer_keys = extract_answer_keys(metadata, sections, client, work_dir)
        checkpoint.mark_done("answer_keys")

    # Stage 4: Question extraction
    if checkpoint.is_done("questions"):
        print("Stage 4 (Questions): cached")
        raw_questions = {}
        raw_dir = work_dir / "raw_questions"
        if raw_dir.exists():
            for f in raw_dir.glob("*.json"):
                raw_questions[f.stem] = json.loads(f.read_text())
    else:
        print("\n=== Stage 4: Extracting questions ===")
        raw_questions = extract_all_questions(
            metadata, sections, client, work_dir, checkpoint, batch_size
        )
        checkpoint.mark_done("questions")

    # Stage 3b: Answer PDF processing (rationales)
    explanations = []
    if answers_pdf_path:
        if checkpoint.is_done("answers_pdf"):
            print("Stage 3b (Answer PDF): cached")
            explanations_path = work_dir / "answer_explanations.json"
            if explanations_path.exists():
                explanations = json.loads(explanations_path.read_text())
        else:
            print(f"\n=== Stage 3b: Processing answer PDF ===")
            explanations = extract_answer_pdf(
                answers_pdf_path, work_dir, client, dpi, batch_size, checkpoint=checkpoint
            )
            checkpoint.mark_done("answers_pdf")

    # Stage 6: Classification & enrichment (before figures, to generate IDs)
    if checkpoint.is_done("classify"):
        print("Stage 6 (Classify): cached")
        enriched = {}
        enriched_dir = work_dir / "enriched"
        if enriched_dir.exists():
            for f in enriched_dir.glob("*.json"):
                enriched[f.stem] = json.loads(f.read_text())
    else:
        print("\n=== Stage 6: Classification & enrichment ===")
        enriched = classify_and_enrich(raw_questions, answer_keys, test_number, work_dir, explanations)
        checkpoint.mark_done("classify")

    # Stage 5: Figure extraction (needs question IDs from stage 6)
    if checkpoint.is_done("figures"):
        print("Stage 5 (Figures): cached")
    else:
        print("\n=== Stage 5: Extracting figures ===")
        question_ids_path = work_dir / "question_ids.json"
        if question_ids_path.exists():
            question_ids = json.loads(question_ids_path.read_text())
            # Convert string keys back to int
            question_ids = {
                sid: {int(k): v for k, v in mapping.items()}
                for sid, mapping in question_ids.items()
            }
        else:
            question_ids = {}

        has_figures = any(
            q.get("has_figure") or q.get("choice_has_figure")
            for qs in raw_questions.values() for q in qs
        )
        if has_figures:
            extract_figures(
                pdf_path, metadata, raw_questions, client,
                output_dir, question_ids, dpi=300,
            )
        else:
            print("  No figures detected, skipping")
        checkpoint.mark_done("figures")

    # Stage 7: Validation & output
    print("\n=== Stage 7: Validation & output ===")
    data_dir = project_root / "src" / "data" / "questions"
    report = validate_and_output(enriched, data_dir, output_dir, test_number)

    elapsed = time.time() - start_time
    cost = client.cost_summary()

    print(f"\n=== Pipeline Complete ===")
    print(f"Time: {elapsed:.1f}s")
    print(f"API calls: {cost['calls']}")
    print(f"Estimated cost: ${cost['estimated_cost_usd']:.4f}")

    report["timing_seconds"] = round(elapsed, 1)
    report["api_cost"] = cost
    report_path = output_dir / f"practice_test_{test_number}_report.json"
    report_path.write_text(json.dumps(report, indent=2))

    return report


def main():
    parser = argparse.ArgumentParser(description="Extract SAT questions from PDFs")
    parser.add_argument("--pdf", type=str, help="Path to a single question PDF file")
    parser.add_argument("--answers-pdf", type=str, default=None,
                        help="Path to the matching answer/explanation PDF (optional but recommended)")
    parser.add_argument("--pdf-dir", type=str, help="Directory of PDFs (batch mode)")
    parser.add_argument("--test-number", type=int, help="Practice test number (e.g., 4)")
    parser.add_argument("--test-map", type=str, help="JSON mapping filenames to test numbers (batch mode)")
    parser.add_argument("--output-dir", type=str, default="./output", help="Output directory")
    parser.add_argument("--work-dir", type=str, default="./work", help="Working directory for intermediate files")
    parser.add_argument("--api-key", type=str, default=None, help="Reserved for compatibility")
    parser.add_argument("--model", type=str, default=os.environ.get("EXTRACTION_MODEL", "default"), help="Model alias for the extraction CLI")
    parser.add_argument("--dpi", type=int, default=200, help="DPI for page rendering")
    parser.add_argument("--batch-size", type=int, default=2, help="Pages per API call")
    parser.add_argument("--rpm", type=int, default=20, help="API requests per minute limit")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint")
    parser.add_argument("--batch", action="store_true", help="Batch mode (process all PDFs in --pdf-dir)")

    args = parser.parse_args()

    project_root = get_project_root()
    client = RateLimitedClient(model=args.model, rpm=args.rpm)

    if args.batch and args.pdf_dir:
        # Batch mode — auto-pair question and answer PDFs by test number
        pdf_dir = Path(args.pdf_dir)
        import re

        question_pdfs = {}  # test_num -> path
        answer_pdfs = {}    # test_num -> path
        for f in sorted(pdf_dir.glob("*.pdf")):
            stem = f.stem
            num_match = re.search(r"test[-_]?(\d+)", stem, re.I)
            if not num_match:
                continue
            test_num = int(num_match.group(1))
            if "answer" in stem.lower():
                answer_pdfs[test_num] = f
            else:
                question_pdfs[test_num] = f

        if args.test_map:
            tm = json.loads(Path(args.test_map).read_text())
            question_pdfs = {int(v): pdf_dir / k for k, v in tm.items() if "answer" not in k.lower()}

        print(f"Batch mode: {len(question_pdfs)} question PDFs, {len(answer_pdfs)} answer PDFs")
        for test_num in sorted(question_pdfs.keys()):
            qpdf = question_pdfs[test_num]
            apdf = answer_pdfs.get(test_num)

            print(f"\n{'='*60}")
            print(f"Test #{test_num}: {qpdf.name}")
            if apdf:
                print(f"  + answers: {apdf.name}")
            print(f"{'='*60}")

            process_single_pdf(
                str(qpdf), test_num, client,
                Path(args.output_dir) / f"test_{test_num}",
                Path(args.work_dir) / f"test_{test_num}",
                project_root,
                args.dpi, args.batch_size, args.resume,
                answers_pdf_path=str(apdf) if apdf else None,
            )

        total_cost = client.cost_summary()
        print(f"\n{'='*60}")
        print(f"BATCH COMPLETE")
        print(f"Total API calls: {total_cost['calls']}")
        print(f"Total estimated cost: ${total_cost['estimated_cost_usd']:.4f}")

    elif args.pdf and args.test_number:
        # Single PDF mode
        process_single_pdf(
            args.pdf, args.test_number, client,
            Path(args.output_dir),
            Path(args.work_dir),
            project_root,
            args.dpi, args.batch_size, args.resume,
            answers_pdf_path=args.answers_pdf,
        )
    else:
        parser.print_help()
        print("\nError: Provide either --pdf + --test-number, or --pdf-dir + --batch")
        sys.exit(1)


if __name__ == "__main__":
    main()
