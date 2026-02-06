import json
import re
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).parent.parent
QUESTIONS_JSON = WORKSPACE_ROOT / "src/data/questions.json"
OUTPUT_JSON = WORKSPACE_ROOT / "src/data/questions.json" # Overwrite

QUESTION_TO_DELETE_ID = "555c176c-fa9a-40e0-b8a8-cb40b47c9ee3_17" # Confirmed via read_file

def fix_content(text):
    if not text:
        return text
    
    # 1. Fix raw exponents x^2, (x-1)^2 that are NOT in latex
    # Negative lookbehind/ahead for $ is tricky, so simplified approach:
    # We will identify math segments and wrap them if they look like math.
    
    # Helper to wrap in $ if not already wrapped
    # This is complex. Safer to use specific replacements.
    
    # Replace "x^2" -> "$x^2$" if not surrounded by non-whitespace (or $).
    # But checking if inside $...$ is hard with regex alone.
    # We will trust that "x^2" with spaces around it is likely raw text.
    
    # Pattern: Space, x or y or number, ^, number, Space
    # re.sub(r'(\s)([a-zA-Z0-9\(\)]+\^\d+)(\s)', r'\1$\2$\3', text)
    
    # Actually, let's target specific reported issues first.
    
    # Raw equal signs in equations: "y = 3x + 2"
    # Matches a line that looks like an equation but has no $
    lines = text.split('\n')
    new_lines = []
    for line in lines:
        # Check if line has unescaped equal sign and variables
        if "=" in line and "$" not in line:
            # Check for equation-like structure
            if re.search(r"[xy]|\d", line) and re.search(r"[\+\-\*\/]|\d[xy]", line):
                # This line is likely a raw equation. Wrap it.
                # Heuristic: if it's short-ish and contains =, wrap the whole thing?
                # Or try to identify the math part.
                # e.g. "The equation y = 2x + 1 is..." -> "The equation $y = 2x + 1$ is..."
                
                # Regex for an equation: [variable/number/ops/spaces]* = [variable/number/ops/spaces]*
                # We catch the longest chain of math-chars around the =
                
                # Math chars: a-z, A-Z, 0-9, +, -, *, /, ^, (, ), ., space
                # But we don't want to capture words.
                
                # Simplification: Look for `y = ...` or `f(x) = ...` or `... = ...`
                # Pattern:  (start) (math content) = (math content) (end)
                
                # Only apply if we see typical math variables or numbers
                match = re.search(r'(?<!\$)(?<!\\)(\b[a-z0-9\.\(\)\+\-\s]+\s*=\s*[a-z0-9\.\(\)\+\-\s]+)', line, re.IGNORECASE)
                if match:
                    eq = match.group(1).strip()
                    # Verify it has digits or math symbols to avoid "Answer = B"
                    if re.search(r"[\d\+\-\*\/]|\b[xy]\b", eq):
                         # Wrap in $
                         # Use replace for the exact string found
                         line = line.replace(eq, f"${eq}$")

        # Fix raw x^2
        if "x^2" in line and "$" not in line:
            line = line.replace("x^2", "$x^2$")
        if "y^2" in line and "$" not in line:
            line = line.replace("y^2", "$y^2$")
            
        # Fix raw "linears" typo seen in that deleted question (but might be elsewhere)
        line = line.replace("linears function", "linear function")
        
        # Consistent LaTeX for common terms
        if " pi " in line and "$" not in line:
            line = line.replace(" pi ", " $\\pi$ ")
            
        new_lines.append(line)
        
    return "\n".join(new_lines)


def main():
    print("Loading questions...")
    with open(QUESTIONS_JSON, "r", encoding="utf-8") as f:
        questions = json.load(f)
        
    new_questions = []
    deleted_count = 0
    fixed_count = 0
    
    for q in questions:
        if q.get("id") == QUESTION_TO_DELETE_ID:
            deleted_count += 1
            continue
            
        # Only process Math? No, process all, but be careful.
        # Check test_name
        test_name = q.get("test_name", "")
        if "Math" not in test_name:
            new_questions.append(q)
            continue
            
        # Fix Passage
        orig_passage = q.get("passage") or ""
        new_passage = fix_content(orig_passage)
        
        # Fix Choices
        choices = q.get("choices") or []
        new_choices = []
        choices_changed = False
        for c in choices:
            orig_text = c.get("text") or ""
            new_text = fix_content(orig_text)
            new_c = c.copy()
            new_c["text"] = new_text
            new_choices.append(new_c)
            if new_text != orig_text:
                choices_changed = True
                
        if new_passage != orig_passage or choices_changed:
            fixed_count += 1
            
        q["passage"] = new_passage
        q["choices"] = new_choices
        new_questions.append(q)
        
    print(f"Deleted {deleted_count} questions.")
    print(f"Fixed formatting in {fixed_count} questions.")
    
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(new_questions, f, indent=2)

if __name__ == "__main__":
    main()
