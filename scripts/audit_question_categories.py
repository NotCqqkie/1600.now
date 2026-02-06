#!/usr/bin/env python3
"""
Audit question category metadata consistency in src/data/all_questions.ts.

Outputs:
- data/category_audit_summary.json
- data/category_review_candidates.csv
"""

import csv
import json
import re
from pathlib import Path
from typing import Dict, List, Tuple


ROOT = Path(__file__).resolve().parents[1]
QUESTIONS_PATH = ROOT / "src" / "data" / "all_questions.ts"
SUMMARY_PATH = ROOT / "data" / "category_audit_summary.json"
CANDIDATES_PATH = ROOT / "data" / "category_review_candidates.csv"


MATH_DOMAINS = {
    "Algebra",
    "Advanced Math",
    "Problem-Solving and Data Analysis",
    "Geometry and Trigonometry",
}
ENGLISH_DOMAINS = {
    "Craft and Structure",
    "Expression of Ideas",
    "Information and Ideas",
    "Standard English Conventions",
}
MATH_SKILLS = {
    "Linear Equations in One Variable",
    "Linear Functions",
    "Systems of Linear Equations",
    "Linear Inequalities",
    "Equivalent Expressions",
    "Nonlinear Equations and Systems",
    "Nonlinear Functions",
    "Ratios, Rates, Proportions, and Units",
    "Percentages",
    "One-Variable Data",
    "Two-Variable Data",
    "Probability",
    "Sample Statistics and Margin of Error",
    "Evaluating Statistical Claims",
    "Area and Volume",
    "Lines, Angles, and Triangles",
    "Right Triangles and Trigonometry",
    "Circles",
}
ENGLISH_SKILLS = {
    "Cross-Text Connections",
    "Text Structure and Purpose",
    "Words in Context",
    "Rhetorical Synthesis",
    "Transitions",
    "Central Ideas and Details",
    "Command of Evidence",
    "Inferences",
    "Boundaries",
    "Form, Structure, and Sense",
}


def normalize_subject(raw: str) -> str:
    if raw == "Math":
        return "Math"
    return "English"


def extract_question_objects(ts_text: str) -> List[str]:
    pattern = re.compile(r"\n  \{\n    section:.*?\n  \}(?:,)?", flags=re.DOTALL)
    return [m.group(0) for m in pattern.finditer(ts_text)]


def first_match(patterns: List[str], text: str) -> str:
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.DOTALL)
        if match:
            return match.group(1)
    return ""


def parse_question_fields(question_obj: str) -> Dict[str, str]:
    return {
        "id": first_match([r'id:\s*"([^"]+)"', r'"id"\s*:\s*"([^"]+)"'], question_obj).strip(),
        "section": first_match([r'section:\s*"([^"]+)"', r'"section"\s*:\s*"([^"]+)"'], question_obj).strip(),
        "domain": first_match([r'domain:\s*"([^"]+)"', r'"domain"\s*:\s*"([^"]+)"'], question_obj).strip(),
        "skill": first_match([r'skill:\s*"([^"]+)"', r'"skill"\s*:\s*"([^"]+)"'], question_obj).strip(),
        "testName": first_match([r'testName:\s*"([^"]+)"', r'"testName"\s*:\s*"([^"]+)"'], question_obj).strip(),
        "text": first_match([r'text:\s*"((?:[^"\\]|\\.)*)"', r'"text"\s*:\s*"((?:[^"\\]|\\.)*)"'], question_obj).strip(),
    }


def get_issues(subject: str, domain: str, skill: str) -> List[str]:
    issues: List[str] = []
    if subject == "Math":
        if domain in ENGLISH_DOMAINS:
            issues.append("subject_domain_mismatch")
        if skill in ENGLISH_SKILLS:
            issues.append("subject_skill_mismatch")
        if domain in MATH_DOMAINS and skill in ENGLISH_SKILLS:
            issues.append("domain_skill_mismatch")
    else:
        if domain in MATH_DOMAINS:
            issues.append("subject_domain_mismatch")
        if skill in MATH_SKILLS:
            issues.append("subject_skill_mismatch")
        if domain in ENGLISH_DOMAINS and skill in MATH_SKILLS:
            issues.append("domain_skill_mismatch")
    return issues


def main() -> None:
    if not QUESTIONS_PATH.exists():
        raise SystemExit(f"Missing file: {QUESTIONS_PATH}")

    ts_text = QUESTIONS_PATH.read_text(encoding="utf-8")
    objects = extract_question_objects(ts_text)
    parsed = [parse_question_fields(obj) for obj in objects]
    parsed = [p for p in parsed if p["id"] and p["section"] and p["domain"] and p["skill"]]

    candidates: List[Tuple[str, str, str, str, str, str, str]] = []
    issue_counts: Dict[str, int] = {
        "subject_domain_mismatch": 0,
        "subject_skill_mismatch": 0,
        "domain_skill_mismatch": 0,
    }

    for p in parsed:
        subject = normalize_subject(p["section"])
        issues = get_issues(subject, p["domain"], p["skill"])
        if not issues:
            continue
        for issue in issues:
            issue_counts[issue] += 1
        text_preview = p["text"].replace("\\n", " ").replace("\\\\", " ")
        text_preview = re.sub(r"\s+", " ", text_preview).strip()[:220]
        candidates.append(
            (
                p["id"],
                p["section"],
                p["domain"],
                p["skill"],
                p["testName"],
                ";".join(sorted(set(issues))),
                text_preview,
            )
        )

    SUMMARY_PATH.parent.mkdir(parents=True, exist_ok=True)
    SUMMARY_PATH.write_text(
        json.dumps(
            {
                "total_questions": len(parsed),
                "total_candidates": len(candidates),
                "issue_counts": issue_counts,
                "output_csv": str(CANDIDATES_PATH),
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    CANDIDATES_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CANDIDATES_PATH.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "id",
                "section",
                "domain",
                "skill",
                "test_name",
                "issues",
                "text_preview",
            ]
        )
        writer.writerows(candidates)

    print(f"Wrote summary: {SUMMARY_PATH}")
    print(f"Wrote candidates: {CANDIDATES_PATH}")
    print(json.dumps({"total_candidates": len(candidates), "issue_counts": issue_counts}, indent=2))


if __name__ == "__main__":
    main()
