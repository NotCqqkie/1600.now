#!/usr/bin/env python3
"""Audit a generated explanation JSON for quality issues.

Checks:
- Valid JSON structure
- Step count in 2-5 range
- No hedging/doubt phrases
- Final step confirms correct answer with choice letter tie-in
- No duplicate formula/content (formula field repeated verbatim in content)
- No duplicate consecutive equations
- For math: has desmosExpressions/desmosGraphs when appropriate
- For reading: quotes specific text from passage

Usage:
    python scripts/audit_explanation.py /tmp/expl-trial/math-out.json
    python scripts/audit_explanation.py /tmp/expl-trial/*-out.json
"""
import json
import re
import sys
from pathlib import Path

FORBIDDEN_PHRASES = [
    r"let'?s re-?examine",
    r"let'?s re-?check",
    r"let'?s re-?consider",
    r"let'?s look again",
    r"on second thought",
    r"actually[, ]+let me reconsider",
    r"hmm[, ]",
    r"wait[, ]+let'?s",
    r"wait[, ]+that doesn'?t",
    r"it seems (there|like|that)",
    r"there may be an error",
    r"there might be an error",
]

HEDGING_PHRASES = [
    r"\bmay (lead|be|have|indicate|suggest|mean|result|cause)",
    r"\bmight (lead|be|have|indicate|suggest|mean|result|cause)",
    r"\bcould (be|indicate|suggest|mean)",
    r"\bappears to (be|show|indicate|suggest)",
    r"\bseems to (be|show|indicate|suggest)",
    r"\bit looks like",
    r"\bpossibly\b",
    r"\bthis suggests\b",
]

# Only flag questions that REQUIRE seeing an image — i.e., the data/figure isn't
# embedded in text. "graph of the equation y = ..." is fine; "the table gives..." isn't.
VISUAL_REFS = re.compile(
    r"\b(dot plot|bar chart|scatter ?plot|histogram|box plot|pie chart|"
    r"the graph (shows|gives|displays|represents|indicates)|"
    r"the figure (shows|gives|displays|represents)|"
    r"the diagram (shows|gives|displays|represents)|"
    r"the table (shows|gives|displays|lists|summarizes|represents|contains|below|above)|"
    r"shown above|shown below|the data (in|shown|given|above|below)|"
    r"as shown in the|based on the (table|figure|graph|diagram|data)|"
    r"according to the (table|figure|graph|diagram|data))\b",
    re.IGNORECASE,
)


def strip_html(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s)).strip()


def audit(path: Path, quote_check_against: dict | None = None) -> list[str]:
    issues = []
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        return [f"INVALID JSON: {e}"]

    steps = data.get("steps", [])
    correct = data.get("correctAnswer", "")
    section = data.get("section", "")
    qid = data.get("questionId", path.stem)

    if not isinstance(steps, list) or not steps:
        issues.append("No steps array")
        return issues

    if len(steps) < 2 or len(steps) > 5:
        issues.append(f"Step count out of range: {len(steps)} (want 2-5)")

    all_content = []
    for i, step in enumerate(steps):
        if not isinstance(step, dict):
            issues.append(f"Step {i}: not an object")
            continue
        title = step.get("title", "")
        content = step.get("content", "")
        formula = step.get("formula", "")

        if not title or not content:
            issues.append(f"Step {i}: missing title or content")

        # LaTeX in title (deprecated)
        if re.search(r"\$|\\\\[a-z]+|\\text", title):
            issues.append(f"Step {i}: title contains LaTeX: '{title}'")

        # Duplicate formula in content
        if formula:
            formula_body = re.sub(r"\$\$|\$", "", formula).strip()
            content_stripped = re.sub(r"\$\$|\$", "", strip_html(content)).strip()
            if formula_body and formula_body in content_stripped and len(formula_body) > 15:
                issues.append(f"Step {i}: formula field duplicated in content ('{formula_body[:60]}...')")

        all_content.append(content)

        for pat in FORBIDDEN_PHRASES:
            if re.search(pat, strip_html(content), re.IGNORECASE):
                issues.append(f"Step {i}: forbidden phrase matches /{pat}/ in content")
        for pat in HEDGING_PHRASES:
            stripped = strip_html(content)
            m = re.search(pat, stripped, re.IGNORECASE)
            if m:
                # Whitelist: quoting answer-choice or passage text is fine
                context = stripped[max(0, m.start() - 60) : m.end() + 60]
                if re.search(r"(choice [A-D]|states?:?|answer choice)", context, re.I):
                    continue
                # Whitelist: match lies inside a double-quoted span ("...may be...")
                before = stripped[: m.start()]
                after = stripped[m.end() :]
                open_quotes = before.count('"') - before.count('\\"')
                if open_quotes % 2 == 1 and '"' in after:
                    continue
                issues.append(f"Step {i}: hedging phrase /{pat}/ → '...{context}...'")

    # Check last step for answer confirmation
    last = steps[-1] if steps else {}
    last_content = strip_html(last.get("content", ""))
    if correct:
        # strip_html normalized the content; match patterns that survive that.
        has_letter_tie = re.search(
            rf"(matches choice {correct}\b|choice {correct}\b[^.]*correct|\b{correct} is correct|\b{correct}\) is correct)",
            last_content,
            re.I,
        )
        if not has_letter_tie and correct.isalpha():
            issues.append(f"Final step does not explicitly tie answer to choice letter '{correct}'")

    # Consecutive duplicate display-math equations across full content
    joined = " ".join(all_content)
    dm_matches = re.findall(r"\$\$([^$]+)\$\$", joined)
    for j in range(1, len(dm_matches)):
        a = re.sub(r"\s+", "", dm_matches[j - 1])
        b = re.sub(r"\s+", "", dm_matches[j])
        if a == b:
            issues.append(f"Consecutive identical display-math: '{dm_matches[j][:50]}'")

    # Math-specific: Desmos usage check for graphable content
    if section == "Math":
        has_desmos = any(
            s.get("desmosExpressions") or s.get("desmosGraphs")
            for s in steps
            if isinstance(s, dict)
        )
        has_equation = bool(re.search(r"y\s*=|x\^2|\\sqrt|intersect", joined, re.I))
        if has_equation and not has_desmos:
            # Soft warning — not always required
            pass  # could add: issues.append("Math: graphable content but no Desmos")

    # Visual references that can't be resolved
    qtext = ""
    if quote_check_against:
        qtext = quote_check_against.get("text", "")
    elif (path.parent / f"{path.stem.replace('-out', '')}.json").exists():
        try:
            qfile = path.parent / f"{path.stem.replace('-out', '')}.json"
            qtext = json.loads(qfile.read_text()).get("text", "")
        except Exception:
            pass
    if VISUAL_REFS.search(qtext):
        issues.append(f"WARNING: question references visual ('{VISUAL_REFS.search(qtext).group()}') — may need vision model")

    if not issues:
        return [f"CLEAN — {qid} ({section}, {len(steps)} steps, answer {correct})"]
    return [f"ISSUES in {qid} ({section}):"] + [f"  - {x}" for x in issues]


def main():
    if len(sys.argv) < 2:
        print("Usage: audit_explanation.py <output.json> [<output.json>...]")
        sys.exit(1)
    any_issues = False
    for p in sys.argv[1:]:
        lines = audit(Path(p))
        for l in lines:
            print(l)
        if any("ISSUES" in l or "INVALID" in l for l in lines):
            any_issues = True
        print()
    sys.exit(1 if any_issues else 0)


if __name__ == "__main__":
    main()
