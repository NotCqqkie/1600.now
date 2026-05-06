from __future__ import annotations
import json
from pathlib import Path
from ..utils.dedup import load_existing_hashes, find_duplicates, normalize_for_hash

VALID_MATH_DOMAINS = {"Algebra", "Advanced Math", "Problem-Solving and Data Analysis", "Geometry and Trigonometry"}
VALID_ENGLISH_DOMAINS = {"Craft and Structure", "Expression of Ideas", "Information and Ideas", "Standard English Conventions"}
REQUIRED_FIELDS = ["section", "domain", "skill", "difficulty", "rationale", "id", "testName", "text", "choices", "correctAnswer", "type"]


def validate_and_output(
    enriched: dict[str, list[dict]],
    data_dir: Path,
    output_dir: Path,
    test_number: int,
) -> dict:
    """Validate questions and write merge-ready output files."""
    output_dir.mkdir(parents=True, exist_ok=True)
    warnings = []
    errors = []

    math_questions = []
    rw_questions = []

    for section_id, questions in enriched.items():
        is_math = "math" in section_id
        target = math_questions if is_math else rw_questions

        for q in questions:
            # Field presence check
            for field in REQUIRED_FIELDS:
                if field not in q:
                    errors.append(f"{section_id} Q{q.get('question_number', '?')}: missing field '{field}'")

            # Type validation
            if q.get("type") == "multiple-choice":
                choices = q.get("choices", [])
                if len(choices) != 4:
                    warnings.append(f"{section_id} Q{q.get('id', '?')}: expected 4 choices, got {len(choices)}")
                if q.get("correctAnswer") not in ("A", "B", "C", "D"):
                    warnings.append(f"{section_id} Q{q.get('id', '?')}: invalid MC answer '{q.get('correctAnswer')}'")
            elif q.get("type") == "free-response":
                if q.get("choices"):
                    warnings.append(f"{section_id} Q{q.get('id', '?')}: free-response should have empty choices")

            # Domain validation
            section = q.get("section", "")
            domain = q.get("domain", "")
            if "Math" in section and domain not in VALID_MATH_DOMAINS:
                warnings.append(f"{section_id} Q{q.get('id', '?')}: invalid math domain '{domain}'")
            elif "Reading" in section and domain not in VALID_ENGLISH_DOMAINS:
                warnings.append(f"{section_id} Q{q.get('id', '?')}: invalid english domain '{domain}'")

            # Text presence
            if not q.get("text", "").strip():
                errors.append(f"{section_id} Q{q.get('id', '?')}: empty question text")

            # Missing answer
            if not q.get("correctAnswer"):
                warnings.append(f"{section_id} Q{q.get('id', '?')}: missing correct answer")

            target.append(q)

    # Question count check (full digital SAT: 33+33 R&W + 27+27 Math = 120)
    total = len(math_questions) + len(rw_questions)
    if total < 100:
        warnings.append(f"Low question count: {total} (expected ~120)")
    elif total > 130:
        warnings.append(f"High question count: {total} (expected ~120, possible duplicates)")

    # Dedup check
    existing_hashes = load_existing_hashes(data_dir)
    math_dupes = find_duplicates(math_questions, existing_hashes)
    rw_dupes = find_duplicates(rw_questions, existing_hashes)
    if math_dupes or rw_dupes:
        warnings.append(f"Found {len(math_dupes)} math and {len(rw_dupes)} R&W duplicate questions")

    # Also deduplicate within the new set
    seen_hashes = set()
    math_deduped = []
    for q in math_questions:
        h = normalize_for_hash(q.get("text", ""))
        if h not in seen_hashes:
            seen_hashes.add(h)
            math_deduped.append(q)
    rw_deduped = []
    for q in rw_questions:
        h = normalize_for_hash(q.get("text", ""))
        if h not in seen_hashes:
            seen_hashes.add(h)
            rw_deduped.append(q)

    internal_dupes = (len(math_questions) - len(math_deduped)) + (len(rw_questions) - len(rw_deduped))
    if internal_dupes:
        warnings.append(f"Removed {internal_dupes} internal duplicates (from page overlap batching)")

    math_questions = math_deduped
    rw_questions = rw_deduped

    # Write output
    slug = f"practice_test_{test_number}"
    math_path = output_dir / f"{slug}_math.json"
    rw_path = output_dir / f"{slug}_reading.json"
    math_path.write_text(json.dumps(math_questions, indent=2))
    rw_path.write_text(json.dumps(rw_questions, indent=2))

    # Write duplicate report
    if math_dupes or rw_dupes:
        dupes_path = output_dir / f"{slug}_duplicates.json"
        dupes_path.write_text(json.dumps({
            "math": [{"id": q["id"], "text": q["text"][:100]} for q in math_dupes],
            "reading": [{"id": q["id"], "text": q["text"][:100]} for q in rw_dupes],
        }, indent=2))

    # Summary report
    report = {
        "test_number": test_number,
        "math_questions": len(math_questions),
        "rw_questions": len(rw_questions),
        "total": len(math_questions) + len(rw_questions),
        "warnings": warnings,
        "errors": errors,
        "duplicates_vs_existing": len(math_dupes) + len(rw_dupes),
        "internal_duplicates_removed": internal_dupes,
        "output_files": {
            "math": str(math_path),
            "reading": str(rw_path),
        },
    }
    report_path = output_dir / f"{slug}_report.json"
    report_path.write_text(json.dumps(report, indent=2))

    print(f"\n=== Validation Report ===")
    print(f"Math: {len(math_questions)} questions")
    print(f"R&W:  {len(rw_questions)} questions")
    print(f"Total: {len(math_questions) + len(rw_questions)}")
    if warnings:
        print(f"\nWarnings ({len(warnings)}):")
        for w in warnings[:20]:
            print(f"  - {w}")
        if len(warnings) > 20:
            print(f"  ... and {len(warnings) - 20} more")
    if errors:
        print(f"\nErrors ({len(errors)}):")
        for e in errors:
            print(f"  - {e}")
    print(f"\nOutput: {output_dir}")

    return report
