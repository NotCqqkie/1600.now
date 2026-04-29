#!/usr/bin/env python3
"""Mechanical audit of unofficial math questions.

Outputs a categorized JSON report of every math question with detectable
mechanical issues. Does not modify data."""

import json
import re
import sys
from pathlib import Path
from collections import defaultdict

ROOT = Path("/Users/lukefinigan/Documents/1600-prep-hub")
SRC  = ROOT / "src/data/unofficialQuestions.ts"
OUT  = ROOT / "scripts/audit_math_bank.report.json"

raw = SRC.read_text()
start = raw.index("= [") + 2
end   = raw.rindex("]") + 1
arr_text = raw[start:end]
# Strip JSON-incompatible trailing commas just in case.
arr_text = re.sub(r",\s*([\]}])", r"\1", arr_text)
questions = json.loads(arr_text)

math = [q for q in questions if q.get("section") == "Math"]
print(f"Loaded {len(questions)} total questions, {len(math)} math.", file=sys.stderr)

# Build math-only id list with index in math array (1-based, matches /bank/math/N route)
math_with_idx = [(i + 1, q) for i, q in enumerate(math)]

issues = defaultdict(list)

UUID_CLASS_RE      = re.compile(r'class="[^"]*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[^"]*"', re.I)
ESCAPED_DOLLAR_RE  = re.compile(r'\\\$')
HTML_ENTITY_RE     = re.compile(r'&(amp|lt|gt|nbsp|quot|#\d+);')
SUSPECT_TAG_RE     = re.compile(r'<(span|div|p|font)\b', re.I)
MATH_CONTAINER_RE  = re.compile(r'<span\s+class="math-container"', re.I)
NO_SPACE_PAREN_RE  = re.compile(r'\b[a-zA-Z]+\(\s*(are|or|s)\b', re.I)
DOUBLE_SPACE_RE    = re.compile(r'  +')
EMPTY_EM_RE        = re.compile(r'<em>\s*</em>|<strong>\s*</strong>', re.I)
WORD_NUM_RE        = re.compile(r'\b(negative|positive|comma|fraction|over|squared|cubed|times|plus|minus|divided)\b', re.I)
LATEX_PAREN_RE     = re.compile(r'\\\(|\\\)|\\\[|\\\]')

def strip_table_cells(text: str) -> str:
    """Remove text inside <td>/<th> so cell-level issues don't double-count."""
    return re.sub(r'<t[hd]\b[^>]*>[\s\S]*?</t[hd]>', '', text, flags=re.I)

def check(idx: int, q: dict):
    qid    = q.get("id", "?")
    text   = q.get("text", "") or ""
    rat    = q.get("rationale", "") or ""
    choices = q.get("choices", []) or []
    ctype  = q.get("type", "")
    outside_cells = strip_table_cells(text)

    def add(category: str, detail: str = ""):
        issues[category].append({
            "math_idx": idx,
            "uuid_short": qid,
            "url": f"/bank/math/{idx}?bankType=unofficial",
            "detail": detail[:160],
        })

    # --- Empty / missing fields ---
    if not text.strip():
        add("empty_text")
    if ctype == "multiple-choice":
        if not choices:
            add("missing_choices")
        else:
            empty = [c.get("id") for c in choices if not (c.get("text") or "").strip()]
            if empty:
                add("empty_choice", f"choices: {empty}")

    # --- HTML / sanitization issues ---
    if EMPTY_EM_RE.search(text) or any(EMPTY_EM_RE.search(c.get("text", "") or "") for c in choices):
        add("empty_em_strong_tag")
    if UUID_CLASS_RE.search(text):
        add("uuid_class_in_text")
    for c in choices:
        if UUID_CLASS_RE.search(c.get("text", "") or ""):
            add("uuid_class_in_choice", f"choice {c.get('id')}")
            break
    if MATH_CONTAINER_RE.search(text):
        add("legacy_math_container_span")
    if HTML_ENTITY_RE.search(text):
        add("unescaped_html_entity_in_text")
    if SUSPECT_TAG_RE.search(text) and not MATH_CONTAINER_RE.search(text):
        # Suspect spans/divs/fonts — flag if not the (already-known) math-container.
        # Filter out simple <span> wrapping inside KaTeX-input — we only care about raw.
        if re.search(r'<(div|font|p)\b', text, re.I):
            add("raw_block_html_tag")

    # --- LaTeX issues ---
    if ESCAPED_DOLLAR_RE.search(outside_cells):
        # We unescape inside table cells. Outside cells, \$...\$ won't be parsed
        # as math by splitTextAndMath.
        add("escaped_dollar_outside_table")
    if LATEX_PAREN_RE.search(outside_cells):
        # Source uses `$...$` — `\(...\)` style indicates a different exporter.
        add("latex_paren_delimiters")
    # Unmatched odd $ count outside cells
    plain = re.sub(r'\\\$', '', outside_cells)
    dollar_count = plain.count('$')
    if dollar_count % 2 != 0:
        add("unmatched_dollar", f"count={dollar_count}")

    # --- Spacing / typography ---
    if NO_SPACE_PAREN_RE.search(text):
        add("missing_space_before_paren", NO_SPACE_PAREN_RE.search(text).group(0))
    if "  " in text and not text.startswith("    "):
        # Allow indentation, not internal double-spaces.
        if DOUBLE_SPACE_RE.search(text):
            add("double_space_in_text")

    # --- Choice format consistency ---
    if ctype == "multiple-choice" and len(choices) >= 2:
        has_dollar = [bool(re.search(r'\$', c.get("text", "") or "")) for c in choices]
        has_words  = [bool(WORD_NUM_RE.search(c.get("text", "") or "")) for c in choices]
        # Some LaTeX, some pure prose with number-words
        if any(has_dollar) and not all(has_dollar):
            mismatched = [c.get("id") for c, d in zip(choices, has_dollar) if not d]
            if any(has_words[i] for i, c in enumerate(choices) if c.get("id") in mismatched):
                add("mixed_choice_format", f"prose ids: {mismatched}")

    # --- Suspicious bullet / list ---
    bullets = re.findall(r'(?:^|\n)\s*•\s+', text)
    if len(bullets) == 1:
        # Single bullet won't hit our list converter; flag as orphan.
        add("orphan_single_bullet")

    # --- Image references in text but no image map ---
    if re.search(r'<img\b', text, re.I):
        add("inline_img_in_text")

# Run all checks
for idx, q in math_with_idx:
    check(idx, q)

# Build summary
summary = {cat: len(items) for cat, items in sorted(issues.items(), key=lambda kv: -len(kv[1]))}
total_flagged = len({(it["math_idx"]) for items in issues.values() for it in items})

report = {
    "total_math_questions": len(math),
    "questions_with_issues": total_flagged,
    "category_counts": summary,
    "issues_by_category": dict(issues),
}

OUT.write_text(json.dumps(report, indent=2))
print(json.dumps(summary, indent=2))
print(f"\nTotal questions with at least one issue: {total_flagged} / {len(math)}", file=sys.stderr)
print(f"Report: {OUT}", file=sys.stderr)
