"""Stage 3b: Extract per-question rationales from the SAT answer-explanation PDF.

We use a custom delimited TEXT format instead of JSON because answer rationales contain
heavy LaTeX (`\\frac{}{}`, `$...$`, `\\sqrt{}`), which the model frequently fails to
escape correctly inside JSON strings — producing invalid JSON or causing the CLI to bail
with empty stderr. Plain text needs no escaping; LaTeX flows through verbatim, and we
parse on the Python side with simple regex.
"""
from __future__ import annotations
import json
import re
from pathlib import Path
from ..utils.cli_client import RateLimitedClient
from ..utils.cli_client import ContentFilterBlocked
from ..utils.checkpoint import Checkpoint
from .render import render_pdf_pages


SECTION_HEADER_RE = re.compile(
    r"(READING AND WRITING|MATH)\s*[:|]?\s*MODULE\s*(\d+)",
    re.I,
)
QUESTION_HEADER_RE = re.compile(r"QUESTION\s+(\d+)\b", re.I)


# Delimited prompt — no JSON escaping required
ANSWER_EXTRACTION_PROMPT = """Extract the SAT answer explanations from these pages.

Each "QUESTION N" block on the page has:
- A "Choice X is the best answer because..." paragraph (correct answer + rationale)
- "Choice Y is incorrect because..." paragraphs for each wrong choice

Return the result as PLAIN TEXT in this exact format. Do NOT use JSON. Do NOT use markdown code fences. Do NOT escape backslashes. LaTeX should flow through naturally.

===Q<NUMBER>===
ANSWER: <letter A/B/C/D, OR numeric value for grid-in like 60 or 3/5>
RATIONALE: <full explanation of why the correct answer is right; preserve LaTeX as-is using $...$ delimiters; use single newlines within paragraph, blank line between paragraphs>
WRONG_<LETTER>: <explanation of why this choice is wrong>
WRONG_<LETTER>: <explanation of why this choice is wrong>
WRONG_<LETTER>: <explanation of why this choice is wrong>

For free-response (grid-in) questions there are no WRONG_X lines, just RATIONALE.

EXAMPLE:
===Q1===
ANSWER: B
RATIONALE: In this context, "collected" means acquired and took away. The text indicates that although the boulders on the asteroid's surface caused some unforeseen problems, OSIRIS-REx was able to gather a sample to return to Earth.
WRONG_A: In this context "attached" means connected or affixed. The text doesn't suggest the spacecraft attached anything to the asteroid.
WRONG_C: In this context "followed" means tracked or traveled behind. The text describes a brief encounter, not tracking.
WRONG_D: In this context "replaced" means put back or returned. The text indicates pieces were taken from the asteroid, not returned to it.

===Q2===
ANSWER: 60
RATIONALE: Solve $|x - 50| = 10$. This means $x - 50 = \\pm 10$, so $x = 60$ or $x = 40$. The positive solution is 60.

IMPORTANT:
- Each RATIONALE must be a complete, well-formed paragraph that reads naturally on its own. It should START WITH A CAPITAL LETTER and read as a full sentence.
- Strip the leading phrase "Choice X is the best answer because" from RATIONALE, but capitalize whatever the next word becomes (e.g. "it most logically..." → "It most logically...").
- Same rule for WRONG_<LETTER>: strip "Choice Y is incorrect because" and capitalize the first remaining word.
- Extract EVERY question visible on the pages. Do not skip any.
- Preserve all math notation literally — do not double-escape backslashes. Use $...$ for inline math."""


def _detect_section_from_text(text: str):
    m = SECTION_HEADER_RE.search(text)
    if not m:
        return None, None
    section = "Reading and Writing" if m.group(1).upper().startswith("READING") else "Math"
    return section, int(m.group(2))


def _group_pages_by_section(metadata: dict) -> list[dict]:
    """Group pages into sections based on the running header at the top of each page."""
    groups = []
    current = None
    for p in metadata["pages"]:
        section, module = _detect_section_from_text(p.get("raw_text", ""))
        if section and module:
            key = (section, module)
            if not current or current["key"] != key:
                if current:
                    groups.append(current)
                current = {"key": key, "section": section, "module": module, "pages": []}
            current["pages"].append(p)
        elif current:
            current["pages"].append(p)
    if current:
        groups.append(current)
    return groups


# Parse the delimited response format
QUESTION_BLOCK_RE = re.compile(r"===Q(\d+)===\s*\n(.*?)(?=\n===Q\d+===|\Z)", re.S)
LINE_FIELD_RE = re.compile(r"^([A-Z_]+):\s*(.*?)(?=\n[A-Z_]+:|\Z)", re.S | re.M)


def _capitalize_first(s: str) -> str:
    """Capitalize the first alpha character without disturbing the rest of the string."""
    if not s:
        return s
    for i, ch in enumerate(s):
        if ch.isalpha():
            return s[:i] + ch.upper() + s[i + 1:]
    return s


def parse_delimited_response(text: str, section: str, module: int) -> list[dict]:
    """Parse the model's delimited text into structured explanation dicts."""
    results = []
    for m in QUESTION_BLOCK_RE.finditer(text):
        q_num = int(m.group(1))
        body = m.group(2).strip()

        fields = {}
        for fm in LINE_FIELD_RE.finditer(body):
            key = fm.group(1).strip()
            val = fm.group(2).strip()
            fields[key] = val

        rationale = _capitalize_first(fields.pop("RATIONALE", "").strip())
        answer = fields.pop("ANSWER", "").strip()
        # Anything left starting with WRONG_ is per-choice incorrect explanations
        incorrect = {}
        for key, val in fields.items():
            if key.startswith("WRONG_") and len(key) > 6:
                letter = key[6:].strip()
                if letter:
                    incorrect[letter] = _capitalize_first(val.strip())

        if not rationale and not answer:
            continue  # skip empty/malformed blocks

        results.append({
            "question_number": q_num,
            "section": section,
            "module": module,
            "correct_answer": answer or None,
            "rationale": rationale,
            "incorrect_explanations": incorrect,
        })
    return results


def extract_answer_pdf(
    answers_pdf_path: str,
    work_dir: Path,
    client: RateLimitedClient,
    dpi: int = 200,
    batch_size: int = 2,
    checkpoint: Checkpoint | None = None,
) -> list[dict]:
    """Process the SAT answer-explanation PDF and return per-question rationales."""
    answers_work_dir = work_dir / "answers_pdf"
    answers_work_dir.mkdir(parents=True, exist_ok=True)

    metadata_path = answers_work_dir / "page_metadata.json"
    if metadata_path.exists() and (answers_work_dir / "pages").exists():
        print("Reusing cached answer PDF render")
        metadata = json.loads(metadata_path.read_text())
    else:
        print(f"Rendering answer PDF: {answers_pdf_path}")
        metadata = render_pdf_pages(answers_pdf_path, answers_work_dir, dpi)

    groups = _group_pages_by_section(metadata)
    print(f"Found {len(groups)} section groups in answer PDF:")
    for g in groups:
        page_nums = [p["page_num"] for p in g["pages"]]
        print(f"  {g['section']} Module {g['module']}: pages {page_nums[0]}-{page_nums[-1]}")

    # Restore prior partial progress
    all_explanations = []
    completed_batches: set[tuple[str, int, int]] = set()
    if checkpoint:
        prior = checkpoint.get_partial("answers_pdf", "explanations", [])
        all_explanations.extend(prior)
        completed = checkpoint.get_partial("answers_pdf", "completed_batches", [])
        completed_batches = {tuple(b) for b in completed}
        if prior:
            print(f"Resuming with {len(prior)} prior explanations and {len(completed_batches)} completed batches")

    # Save raw responses for debugging
    raw_responses_dir = work_dir / "answers_raw"
    raw_responses_dir.mkdir(exist_ok=True)

    for group in groups:
        question_pages = [p for p in group["pages"] if QUESTION_HEADER_RE.search(p.get("raw_text", ""))]
        if not question_pages:
            continue

        section_label = group["section"]
        module = group["module"]
        print(f"\nProcessing {section_label} Module {module} ({len(question_pages)} pages)...")

        for i in range(0, len(question_pages), batch_size):
            batch_key = (section_label, module, i)
            if batch_key in completed_batches:
                continue

            batch = question_pages[i:i + batch_size]
            if i + batch_size < len(question_pages):
                batch.append(question_pages[i + batch_size])

            image_paths = [p["image_path"] for p in batch]
            page_range = f"{batch[0]['page_num']}-{batch[-1]['page_num']}"
            print(f"  Pages {page_range}...")

            def _call_and_parse(paths_to_send):
                response = client.call_with_images(
                    system="You are a precise extractor of SAT answer explanations. Output plain delimited text only.",
                    text=ANSWER_EXTRACTION_PROMPT,
                    image_paths=paths_to_send,
                )
                return response, parse_delimited_response(response, section_label, module)

            raw_path = raw_responses_dir / f"{section_label.lower().replace(' ', '_')}_m{module}_b{i}.txt"
            try:
                response, explanations = _call_and_parse(image_paths)
                raw_path.write_text(response)
                all_explanations.extend(explanations)
                print(f"    Parsed {len(explanations)} explanations (response saved to {raw_path.name})")
            except ContentFilterBlocked:
                # Content filter false-positive — retry one page at a time so the
                # offending page is isolated and the others still go through.
                print(f"    Content filter blocked the batch; retrying one page at a time...")
                per_page_results = []
                for one in image_paths:
                    try:
                        resp_one, exp_one = _call_and_parse([one])
                        per_page_results.extend(exp_one)
                        page_name = Path(one).stem
                        (raw_responses_dir / f"{raw_path.stem}_{page_name}.txt").write_text(resp_one)
                        print(f"      {page_name}: {len(exp_one)} explanations")
                    except ContentFilterBlocked:
                        print(f"      {Path(one).stem}: content filter still blocked — skipping")
                    except Exception as e2:
                        print(f"      {Path(one).stem}: ERROR {type(e2).__name__}: {str(e2)[:150]}")
                all_explanations.extend(per_page_results)
                print(f"    Recovered {len(per_page_results)} explanations from per-page fallback")
            except Exception as e:
                print(f"    ERROR (skipping batch): {type(e).__name__}: {str(e)[:200]}")

            completed_batches.add(batch_key)
            if checkpoint:
                checkpoint.set_partial("answers_pdf", "explanations", all_explanations)
                checkpoint.set_partial(
                    "answers_pdf",
                    "completed_batches",
                    [list(b) for b in completed_batches],
                )

    # Deduplicate by (section, module, question_number)
    seen = set()
    deduped = []
    for e in all_explanations:
        key = (e.get("section"), e.get("module"), e.get("question_number"))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(e)

    output_path = work_dir / "answer_explanations.json"
    output_path.write_text(json.dumps(deduped, indent=2))
    print(f"\nTotal answer explanations extracted: {len(deduped)}")
    return deduped
