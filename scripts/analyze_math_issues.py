import json
import re
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).parent.parent
QUESTIONS_JSON = WORKSPACE_ROOT / "src/data/questions.json"
OUTPUT_REPORT = WORKSPACE_ROOT / "scripts/reports/math_issues_report.txt"

def analyze_questions():
    OUTPUT_REPORT.parent.mkdir(parents=True, exist_ok=True)
    with open(QUESTIONS_JSON, "r", encoding="utf-8") as f:
        questions = json.load(f)

    issues = []
    questions_to_delete = []

    # Math specific regex patterns
    missing_image_patterns = [
        r"\[Image\]",
        r"\(refer to figure\)",
        r"shown above",
        r"shown below", # Use caution with this one, might refer to equation
        r"figure \d",
        r"graph shows"
    ]
    
    # Simple heuristic to detect raw math usage
    # Look for things like " x " (variable), " = " (operator), "^" (power) outside of $...$
    # We remove everything inside $...$ first to check the rest.
    
    math_context_indicators = [
        r"\s\d+x\s",           # 3x
        r"\sx\^2",            # x^2
        r"\s=\s",             # =
        r"\s\+\s",            # +
        r"\s-\s",             # -
        r"[0-9]+\/[0-9]+",    # fractions 1/2
        r"\s[xy]\s"           # variables x, y
    ]

    for q in questions:
        q_id = q.get("id")
        # Filter for Math
        test_name = q.get("test_name", "")
        if "Math" not in test_name:
            continue
            
        passage = q.get("passage") or ""
        choices = q.get("choices") or []
        
        full_text = passage
        for c in choices:
            full_text += " " + (c.get("text") or "")
            
        # Check for missing images/content
        has_missing_image = False
        lower_text = full_text.lower()
        if "[image]" in lower_text or "insert image" in lower_text:
             has_missing_image = True
        
        # Additional image checks - require more care as "shown below" could be a table or equation
        # But user said "referencing an image / content that it doesnt have"
        # We can flag these for review
        
        if has_missing_image:
            questions_to_delete.append(q_id)
            issues.append(f"DELETE [Images]: {q_id} - Explicit image placeholder found.")
            continue

        # Check for LaTeX issues
        # Remove valid LaTeX to analyze the rest
        clean_text = re.sub(r'\$.*?\$', '', full_text) # Remove inline latex
        clean_text = re.sub(r'\$\$.*?\$\$', '', clean_text) # Remove block latex
        
        potential_math_issues = []
        if re.search(r"\bx\^2", clean_text):
            potential_math_issues.append("Raw x^2 found")
        if re.search(r"\\frac\{", clean_text): # Latex command without $
            potential_math_issues.append("Unclosed or raw LaTeX command (\\frac)")
        if re.search(r"\s=\s", clean_text) and re.search(r"\d", clean_text) and ("equation" in lower_text or "function" in lower_text):
             # Equal sign in likely math context
             potential_math_issues.append("Raw equal sign in math context")

        if potential_math_issues:
            issues.append(f"FIX [LaTeX] {q_id}: {', '.join(potential_math_issues)}\nSnippet: {clean_text[:100]}...")

    # Write report
    with open(OUTPUT_REPORT, "w", encoding="utf-8") as f:
        f.write("--- Questions to Delete (Missing Images) ---\n")
        for qid in questions_to_delete:
            f.write(f"{qid}\n")
        
        f.write("\n--- Formatting / LaTeX Issues ---\n")
        for issue in issues:
            if "DELETE" not in issue:
                f.write(f"{issue}\n")
                
    print(f"Analysis complete. Found {len(questions_to_delete)} to delete and {len(issues) - len(questions_to_delete)} formatting issues.")

if __name__ == "__main__":
    analyze_questions()
