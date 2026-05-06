from __future__ import annotations
import re
import json
from pathlib import Path


# Strong section-start markers — these only fire on a real module title page
# Patterns require "Module N" + "Math" or "Reading and Writing" near the start of the text
MODULE_START_PATTERNS = {
    ("rw", 1): re.compile(
        r"(?:Reading\s+and\s+Writing.*?Module\s*\n?\s*1)|(?:Module\s*\n?\s*1\s*\n.*?Reading\s+and\s+Writing)",
        re.I | re.S,
    ),
    ("rw", 2): re.compile(
        r"(?:Reading\s+and\s+Writing.*?Module\s*\n?\s*2)|(?:Module\s*\n?\s*2\s*\n.*?Reading\s+and\s+Writing)",
        re.I | re.S,
    ),
    ("math", 1): re.compile(
        r"(?:Module\s*\n?\s*1\s*\n.*?Math.*?DIRECTIONS)|(?:Math\s*\n.*?Module\s*\n?\s*1.*?DIRECTIONS)",
        re.I | re.S,
    ),
    ("math", 2): re.compile(
        r"(?:Module\s*\n?\s*2\s*\n.*?Math.*?DIRECTIONS)|(?:Math\s*\n.*?Module\s*\n?\s*2.*?DIRECTIONS)",
        re.I | re.S,
    ),
}

# Answer-key section markers — STRICT: require explicit "Answer Explanations" / "Answer Key"
ANSWER_KEY_PATTERNS = [
    re.compile(r"answer\s+explanations?", re.I),
    re.compile(r"answers?\s+and\s+explanations?", re.I),
    re.compile(r"answer\s+key", re.I),
]

NO_TEST_MATERIAL_RE = re.compile(r"no\s+test\s+material", re.I)


def _looks_like_module_start(text: str, section: str, module: int) -> bool:
    """A page is a module-start page if it has the section header and 'DIRECTIONS' or 'X QUESTIONS'."""
    head = text[:600]  # check just the top of the page
    if section == "math":
        if not re.search(r"\bMath\b", head):
            return False
    else:
        if not re.search(r"Reading\s+and\s+Writing", head, re.I):
            return False
    if not re.search(rf"Module\s*\n?\s*{module}\b", head, re.I):
        return False
    return bool(re.search(r"DIRECTIONS|\d+\s+QUESTIONS?", head, re.I))


def _is_answer_key_page(text: str) -> bool:
    head = text[:600]
    return any(p.search(head) for p in ANSWER_KEY_PATTERNS)


def detect_sections(metadata: dict, work_dir: Path) -> list[dict]:
    """Detect section boundaries from page raw text. Returns list of section defs.

    Strategy:
    - Find each module's start page by matching strict (section + module + directions/QUESTIONS) patterns.
    - End each section on the page before the next module's start.
    - If an "Answer Explanations" marker appears, end the last section before it and add an answer_key section.
    - The question PDF typically has NO answer key (answer keys live in a separate PDF).
    """
    pages = metadata["pages"]

    # Find module starts in the expected order
    expected_order = [("rw", 1), ("rw", 2), ("math", 1), ("math", 2)]
    module_starts = {}  # (section, module) -> page_num

    last_found_idx = -1
    for section, module in expected_order:
        for i, p in enumerate(pages):
            if i <= last_found_idx:
                continue
            if _looks_like_module_start(p["raw_text"], section, module):
                module_starts[(section, module)] = p["page_num"]
                last_found_idx = i
                break

    # Find answer key start (if any)
    answer_key_start = None
    for p in pages:
        if _is_answer_key_page(p["raw_text"]):
            answer_key_start = p["page_num"]
            break

    # Build ordered list of (section_id, start_page)
    ordered = []
    for section, module in expected_order:
        if (section, module) in module_starts:
            ordered.append({
                "section": section,
                "module": module,
                "section_id": f"{section}_module{module}",
                "start_page": module_starts[(section, module)],
            })

    # Compute end pages
    sections = []
    for i, s in enumerate(ordered):
        if i + 1 < len(ordered):
            end = ordered[i + 1]["start_page"] - 1
        elif answer_key_start:
            end = answer_key_start - 1
        else:
            # End before trailing "No Test Material" pages
            end = metadata["page_count"]
            for p in pages:
                if p["page_num"] > s["start_page"] and NO_TEST_MATERIAL_RE.search(p["raw_text"]):
                    end = p["page_num"] - 1
                    break
        s["end_page"] = end
        sections.append(s)

    if answer_key_start:
        sections.append({
            "section_id": "answer_key",
            "section": "answer_key",
            "module": None,
            "start_page": answer_key_start,
            "end_page": metadata["page_count"],
        })

    sections_path = work_dir / "sections.json"
    sections_path.write_text(json.dumps(sections, indent=2))
    print(f"Detected {len(sections)} sections:")
    for s in sections:
        print(f"  {s['section_id']}: pages {s['start_page']}-{s['end_page']}")
    return sections


def get_section_pages(sections: list[dict], section_id: str, metadata: dict) -> list[dict]:
    for s in sections:
        if s["section_id"] == section_id:
            return [
                p for p in metadata["pages"]
                if s["start_page"] <= p["page_num"] <= s["end_page"]
            ]
    return []
