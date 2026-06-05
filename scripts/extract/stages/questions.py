from __future__ import annotations
import json
from pathlib import Path
from ..utils.cli_client import RateLimitedClient, parse_json_response
from ..utils.checkpoint import Checkpoint

QUESTION_EXTRACTION_SYSTEM = "You are extracting SAT practice test questions from official College Board PDFs. Return only valid JSON."

QUESTION_EXTRACTION_PROMPT = """Extract ALL questions visible on these pages from an official SAT practice test.

For each question, return a JSON object with:
1. "question_number": integer (as printed, e.g., 1, 2, 3...)
2. "text": The FULL question text including any passage or stimulus.
   - Use $...$ for inline LaTeX math (e.g., $x^2 + 3x - 5$, $\\frac{{1}}{{2}}$)
   - Use \\n for line breaks
   - If a passage is shared across multiple questions, include it with EACH question
   - For tables, use markdown pipe format:
     | Column1 | Column2 |
     |---------|---------|
     | val1    | val2    |
3. "choices": Array of {{"id": "A"|"B"|"C"|"D", "text": "choice text with $LaTeX$ if needed"}}
   - Empty array [] for free-response/student-produced response (grid-in) questions
4. "type": "multiple-choice" or "free-response"
5. "has_figure": true if the question has a graph, chart, diagram, or image that CANNOT be represented as text
6. "figure_description": Brief description of the figure for alt text (empty string if no figure)
7. "choice_has_figure": true if any answer choice contains a graph/image instead of text

IMPORTANT:
- Reading & Writing questions ALWAYS have 4 choices (A-D)
- Math questions are either multiple-choice (4 choices) or free-response (no choices, student enters numeric answer)
- Preserve ALL math using LaTeX: fractions \\frac{{}}{{}}, exponents ^{{}}, subscripts _{{}}, square roots \\sqrt{{}}, etc.
- Do NOT skip any questions. Extract every question on every page.
- If a question spans a page boundary, include the complete text.

Return a JSON array of question objects."""


def extract_questions_for_section(
    section_id: str,
    pages: list[dict],
    client: RateLimitedClient,
    checkpoint: Checkpoint,
    batch_size: int = 2,
) -> list[dict]:
    """Extract questions from page images for a single section/module."""
    completed_key = f"questions_{section_id}_completed_batches"
    completed_batches = checkpoint.get_partial("questions", completed_key, [])
    all_questions = checkpoint.get_partial("questions", f"questions_{section_id}_results", [])

    # Filter out non-question pages (reference sheets, directions pages at start)
    question_pages = []
    for p in pages:
        text = p.get("raw_text", "").lower()
        if "reference" in text and ("sheet" in text or "information" in text):
            continue
        if "directions" in text and p["page_num"] == pages[0]["page_num"]:
            # Directions page — might still have Question 1 on it, include it
            pass
        question_pages.append(p)

    if not question_pages:
        return all_questions

    print(f"\n  Extracting questions from {section_id} ({len(question_pages)} pages)...")

    # Process in batches with overlap for page-boundary questions
    for i in range(0, len(question_pages), batch_size):
        batch_idx = i // batch_size
        if batch_idx in completed_batches:
            continue

        batch = question_pages[i:i + batch_size]
        # Add one overlap page from next batch if available (catches split questions)
        if i + batch_size < len(question_pages):
            batch.append(question_pages[i + batch_size])

        image_paths = [p["image_path"] for p in batch]
        page_range = f"{batch[0]['page_num']}-{batch[-1]['page_num']}"
        print(f"    Pages {page_range} (batch {batch_idx + 1})...")

        response = client.call_with_images(
            system=QUESTION_EXTRACTION_SYSTEM,
            text=QUESTION_EXTRACTION_PROMPT,
            image_paths=image_paths,
        )

        try:
            questions = parse_json_response(response)
            # Deduplicate against already-extracted questions by question_number
            existing_nums = {q["question_number"] for q in all_questions}
            new_qs = [q for q in questions if q["question_number"] not in existing_nums]
            all_questions.extend(new_qs)
            print(f"      Extracted {len(new_qs)} new questions (total: {len(all_questions)})")
        except json.JSONDecodeError as e:
            print(f"      ERROR parsing response: {e}")
            print(f"      Raw: {response[:300]}")

        completed_batches.append(batch_idx)
        checkpoint.set_partial("questions", completed_key, completed_batches)
        checkpoint.set_partial("questions", f"questions_{section_id}_results", all_questions)

    # Sort by question number
    all_questions.sort(key=lambda q: q["question_number"])
    return all_questions


def extract_all_questions(
    metadata: dict,
    sections: list[dict],
    client: RateLimitedClient,
    work_dir: Path,
    checkpoint: Checkpoint,
    batch_size: int = 2,
) -> dict[str, list[dict]]:
    """Extract questions from all test sections. Returns {section_id: [questions]}."""
    results = {}
    question_sections = [s for s in sections if s["section_id"] != "answer_key"]

    for section in question_sections:
        section_id = section["section_id"]
        cached = checkpoint.get_partial("questions", f"questions_{section_id}_final")
        if cached:
            print(f"  {section_id}: using cached results ({len(cached)} questions)")
            results[section_id] = cached
            continue

        pages = [
            p for p in metadata["pages"]
            if section["start_page"] <= p["page_num"] <= section["end_page"]
        ]

        questions = extract_questions_for_section(
            section_id, pages, client, checkpoint, batch_size
        )
        results[section_id] = questions
        checkpoint.set_partial("questions", f"questions_{section_id}_final", questions)

    # Save raw results
    raw_dir = work_dir / "raw_questions"
    raw_dir.mkdir(exist_ok=True)
    for section_id, questions in results.items():
        path = raw_dir / f"{section_id}.json"
        path.write_text(json.dumps(questions, indent=2))

    total = sum(len(qs) for qs in results.values())
    print(f"\nTotal questions extracted: {total}")
    return results
