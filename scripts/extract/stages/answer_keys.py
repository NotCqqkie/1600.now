from __future__ import annotations
import json
from pathlib import Path
from ..utils.claude_client import RateLimitedClient, parse_json_response

ANSWER_KEY_PROMPT = """Extract the answer key from these SAT practice test answer pages.

For EVERY question listed, extract:
- section: "Reading and Writing" or "Math"
- module: 1 or 2 (integer)
- question_number: integer
- correct_answer: the correct answer letter (A/B/C/D) or numeric value for student-produced response (grid-in)
- domain: the domain listed (exact text as printed)
- skill: the skill/description listed (exact text as printed)
- difficulty: "Easy", "Medium", or "Hard" if listed, otherwise null

Return a JSON array. Example:
[
  {"section": "Reading and Writing", "module": 1, "question_number": 1, "correct_answer": "C", "domain": "Craft and Structure", "skill": "Words in Context", "difficulty": "Medium"},
  {"section": "Math", "module": 2, "question_number": 15, "correct_answer": "7/2", "domain": "Advanced Math", "skill": "Nonlinear functions", "difficulty": "Hard"}
]

Be exhaustive — extract EVERY question from the answer key. Do not skip any."""


def extract_answer_keys(metadata: dict, sections: list[dict],
                        client: RateLimitedClient, work_dir: Path) -> list[dict]:
    """Extract answer keys from the answer key section pages."""
    ak_section = next((s for s in sections if s["section_id"] == "answer_key"), None)
    if not ak_section:
        print("WARNING: No answer key section detected. Answers must come from question extraction.")
        (work_dir / "answer_keys.json").write_text("[]")
        return []

    ak_pages = [
        p for p in metadata["pages"]
        if ak_section["start_page"] <= p["page_num"] <= ak_section["end_page"]
    ]

    print(f"Extracting answer keys from {len(ak_pages)} pages...")

    all_answers = []
    # Process in batches of 4 pages
    batch_size = 4
    for i in range(0, len(ak_pages), batch_size):
        batch = ak_pages[i:i + batch_size]
        image_paths = [p["image_path"] for p in batch]
        page_range = f"{batch[0]['page_num']}-{batch[-1]['page_num']}"
        print(f"  Processing answer key pages {page_range}...")

        response = client.call_with_images(
            system="You are a precise data extractor. Return only valid JSON.",
            text=ANSWER_KEY_PROMPT,
            image_paths=image_paths,
        )

        try:
            answers = parse_json_response(response)
            all_answers.extend(answers)
            print(f"    Extracted {len(answers)} answers")
        except json.JSONDecodeError as e:
            print(f"    ERROR parsing answer key response: {e}")
            print(f"    Raw response: {response[:500]}")

    # Deduplicate by (section, module, question_number)
    seen = set()
    deduped = []
    for a in all_answers:
        key = (a["section"], a["module"], a["question_number"])
        if key not in seen:
            seen.add(key)
            deduped.append(a)

    ak_path = work_dir / "answer_keys.json"
    ak_path.write_text(json.dumps(deduped, indent=2))
    print(f"Total unique answers extracted: {len(deduped)}")
    return deduped
