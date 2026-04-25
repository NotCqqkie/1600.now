#!/usr/bin/env python3
"""LLM judge: read a generated explanation and grade it.

Uses Claude Haiku to audit quality beyond what regex can catch:
- Is the reasoning genuinely forward (no backward rationalization)?
- Is every step necessary and non-redundant?
- Would a confused student walk away understanding the method?
- Is the math/logic correct?
- Is the explanation actually efficient (shortest reasonable path)?

Usage:
    python scripts/llm_judge.py <question.json> <explanation.json>
    python scripts/llm_judge.py --batch /tmp/expl-trial/batch/
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

JUDGE_PROMPT = """You are a strict SAT tutor grader. Read this question, its correct answer, and a generated explanation. Grade the explanation on 5 dimensions, each 1-5:

1. CORRECTNESS — does the reasoning actually arrive at the correct answer via valid logic? (5 = yes, clean; 1 = wrong or hand-waved)
2. EFFICIENCY — is this the fastest/shortest reasonable path? (5 = optimal shortcut used; 1 = slow/long/indirect)
3. CONFIDENCE — does the explanation sound confident, no hedging or doubt? (5 = direct throughout; 1 = tentative/backtracking)
4. NON-REDUNDANCY — does every step add new information? (5 = zero repetition; 1 = steps repeat each other)
5. READABILITY — can a student scan this and understand it? (5 = clear structure, good formatting; 1 = wall of text)

IMPORTANT FORMAT NOTES (do NOT penalize):
- Every explanation ends with the phrase "That matches choice X — <strong>X</strong> is correct." (or "which matches choice..."). This is a REQUIRED project format for UI consistency. Do not score it as awkward, circular, or redundant.
- The bolded choice letter (<strong>X</strong>) repeating after "choice X" is also required formatting; don't call it circular.
- Do penalize when the tie-in has a genuinely ambiguous antecedent (e.g., reads as if a wrong choice matches the correct letter) — that is a real clarity issue.

Return ONLY a JSON object, no other text:
{{"correctness": N, "efficiency": N, "confidence": N, "non_redundancy": N, "readability": N, "issues": ["brief issue 1", ...]}}

List specific issues ONLY for scores below 4. If everything is 5/5 with no issues, use "issues": [].

QUESTION:
Section: {section}
Skill: {skill}
Difficulty: {difficulty}
Text: {text}

CHOICES:
{choices}

CORRECT ANSWER: {correct}

EXPLANATION (JSON):
{explanation}
"""


def build_prompt(q: dict, expl: dict) -> str:
    choices_str = "\n".join(f"{c['id']}) {c['text']}" for c in q.get("choices", []))
    return JUDGE_PROMPT.format(
        section=q["section"],
        skill=q.get("skill", "N/A"),
        difficulty=q.get("difficulty", "N/A"),
        text=q["text"],
        choices=choices_str,
        correct=q["correctAnswer"],
        explanation=json.dumps(expl.get("steps", []), indent=2),
    )


def call_haiku(prompt: str) -> str:
    try:
        result = subprocess.run(
            ["claude", "-p", "--model", "haiku", prompt],
            capture_output=True, text=True, timeout=180,
        )
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        return ""


def parse_grade(raw: str) -> dict:
    # Strip fences if any
    s = raw
    if s.startswith("```"):
        s = s.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    if s.startswith("json\n"):
        s = s[5:]
    # Find first { ... }
    start = s.find("{")
    end = s.rfind("}")
    if start < 0 or end < 0:
        return {"error": "no JSON found", "raw": raw[:200]}
    try:
        return json.loads(s[start:end + 1])
    except json.JSONDecodeError as e:
        return {"error": f"parse failed: {e}", "raw": s[start:end + 1][:200]}


def grade_one(q_path: Path, e_path: Path) -> dict:
    q = json.loads(q_path.read_text())
    try:
        expl = json.loads(e_path.read_text())
    except json.JSONDecodeError:
        return {"error": "explanation file is not valid JSON (model likely refused)",
                "questionId": q["id"], "section": q["section"],
                "difficulty": q.get("difficulty", "?")}
    try:
        raw = call_haiku(build_prompt(q, expl))
    except Exception as e:
        return {"error": f"judge call failed: {e}",
                "questionId": q["id"], "section": q["section"],
                "difficulty": q.get("difficulty", "?")}
    if not raw:
        return {"error": "judge timeout or empty response",
                "questionId": q["id"], "section": q["section"],
                "difficulty": q.get("difficulty", "?")}
    grade = parse_grade(raw)
    grade["questionId"] = q["id"]
    grade["section"] = q["section"]
    grade["difficulty"] = q.get("difficulty", "?")
    return grade


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("question", nargs="?")
    ap.add_argument("explanation", nargs="?")
    ap.add_argument("--batch", help="Directory containing qNN.json + qNN-out.json pairs")
    args = ap.parse_args()

    grades = []
    if args.batch:
        batch = Path(args.batch)
        pairs = []
        for q_path in sorted(batch.glob("q*.json")):
            if "-out" in q_path.name:
                continue
            e_path = q_path.parent / f"{q_path.stem}-out.json"
            if e_path.exists():
                pairs.append((q_path, e_path))
        from concurrent.futures import ThreadPoolExecutor, as_completed
        with ThreadPoolExecutor(max_workers=8) as ex:
            futures = {ex.submit(grade_one, q, e): (q, e) for q, e in pairs}
            for fut in as_completed(futures):
                g = fut.result()
                grades.append(g)
                if "error" in g:
                    print(f"  {g['questionId']}: ERROR — {g['error']}", flush=True)
                else:
                    avg = (g["correctness"] + g["efficiency"] + g["confidence"] + g["non_redundancy"] + g["readability"]) / 5
                    flag = "*" if avg < 4.5 or g.get("correctness", 5) < 5 else " "
                    print(f"{flag} {g['questionId'][:20]:20} {g['section'][:4]:4} {g['difficulty']:6} "
                          f"C{g['correctness']} E{g['efficiency']} Cf{g['confidence']} "
                          f"NR{g['non_redundancy']} R{g['readability']} "
                          f"avg={avg:.1f} {'; '.join(g.get('issues', []))[:80]}", flush=True)
    else:
        g = grade_one(Path(args.question), Path(args.explanation))
        print(json.dumps(g, indent=2))
        grades.append(g)

    if grades and "error" not in grades[0]:
        valid = [g for g in grades if "error" not in g]
        if valid:
            print(f"\nSUMMARY: {len(valid)} graded")
            for dim in ["correctness", "efficiency", "confidence", "non_redundancy", "readability"]:
                avg = sum(g[dim] for g in valid) / len(valid)
                print(f"  {dim:18} avg={avg:.2f}")
            wrong = [g for g in valid if g.get("correctness", 5) < 5]
            if wrong:
                print(f"\n  {len(wrong)} with correctness < 5:")
                for g in wrong:
                    print(f"    {g['questionId']}: {'; '.join(g.get('issues', []))}")


if __name__ == "__main__":
    main()
