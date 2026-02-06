import json
import os
import re
import random
from pathlib import Path

# Configuration
WORKSPACE_ROOT = Path("c:/Users/303da/Documents/GitHub/1600-prep-hub")
QUESTIONS_JSON = WORKSPACE_ROOT / "src/data/questions.json"
OUTPUT_MAP = WORKSPACE_ROOT / "src/data/category_map.json"
MATH_ROOT = Path("c:/Users/303da/Downloads/Math")
RW_ROOT = Path("c:/Users/303da/Downloads/Reading and Writing")

def get_categories(root, subject):
    categories = []
    if not root.exists():
        if subject == "Math":
             return [
                {"subject": "Math", "domain": "Geometry and Trigonometry", "skill": "Circles"},
                {"subject": "Math", "domain": "Geometry and Trigonometry", "skill": "Area and Volume"},
                {"subject": "Math", "domain": "Geometry and Trigonometry", "skill": "Right Triangles and Trigonometry"},
                {"subject": "Math", "domain": "Geometry and Trigonometry", "skill": "Lines, Angles, and Triangles"},
                {"subject": "Math", "domain": "Problem-Solving and Data Analysis", "skill": "Probability"},
                {"subject": "Math", "domain": "Problem-Solving and Data Analysis", "skill": "Percentages"},
                {"subject": "Math", "domain": "Problem-Solving and Data Analysis", "skill": "Two-Variable Data"},
                {"subject": "Math", "domain": "Problem-Solving and Data Analysis", "skill": "One-Variable Data"},
                {"subject": "Math", "domain": "Problem-Solving and Data Analysis", "skill": "Evaluating Statistical Claims"},
                {"subject": "Math", "domain": "Problem-Solving and Data Analysis", "skill": "Sample Statistics and Margin of Error"},
                {"subject": "Math", "domain": "Problem-Solving and Data Analysis", "skill": "Ratios, Rates, Proportions, and Units"},
                {"subject": "Math", "domain": "Algebra", "skill": "Linear Equations in One Variable"},
                {"subject": "Math", "domain": "Algebra", "skill": "Systems of Linear Equations"},
                {"subject": "Math", "domain": "Algebra", "skill": "Linear Inequalities"},
                {"subject": "Math", "domain": "Algebra", "skill": "Linear Functions"},
                {"subject": "Math", "domain": "Advanced Math", "skill": "Equivalent Expressions"},
                {"subject": "Math", "domain": "Advanced Math", "skill": "Nonlinear Functions"},
                {"subject": "Math", "domain": "Advanced Math", "skill": "Nonlinear Equations and Systems"},
            ]
        else:
             return [
                {"subject": "English", "domain": "Craft and Structure", "skill": "Cross-Text Connections"},
                {"subject": "English", "domain": "Craft and Structure", "skill": "Words in Context"},
                {"subject": "English", "domain": "Craft and Structure", "skill": "Text Structure and Purpose"},
                {"subject": "English", "domain": "Information and Ideas", "skill": "Central Ideas and Details"},
                {"subject": "English", "domain": "Information and Ideas", "skill": "Command of Evidence"},
                {"subject": "English", "domain": "Information and Ideas", "skill": "Inferences"},
                {"subject": "English", "domain": "Expression of Ideas", "skill": "Transitions"},
                {"subject": "English", "domain": "Expression of Ideas", "skill": "Rhetorical Synthesis"},
                {"subject": "English", "domain": "Standard English Conventions", "skill": "Boundaries"},
                {"subject": "English", "domain": "Standard English Conventions", "skill": "Form, Structure, and Sense"},
             ]

    for r, d, f in os.walk(root):
        rel = Path(r).relative_to(root)
        if len(rel.parts) == 2: # Domain/Skill
            categories.append({
                "subject": subject,
                "domain": rel.parts[0],
                "skill": rel.parts[1]
            })
    return categories

math_cats = get_categories(MATH_ROOT, "Math")
eng_cats = get_categories(RW_ROOT, "English")
all_cats = math_cats + eng_cats

print(f"Found {len(all_cats)} categories.")

def match_score(question, category):
    text = (question.get('passage', '') or '') + " " + (question.get('question_text', '') or '')
    text_lower = text.lower()
    choices = question.get('choices', [])
    choices_text = " ".join([c.get('text', '') for c in choices]).lower()
    
    cat_skill = category['skill']
    cat_domain = category['domain']
    subject = category['subject']
    
    score = 0

    # Guard: Standard English Conventions should not be Confused with Reading check
    if "conventions of standard english" in text_lower:
        if category['domain'] != "Standard English Conventions":
            return -100

    # --- READING & WRITING RULES ---
    if subject == "English":
        
        if cat_skill == "Cross-Text Connections":
            if "text 1" in text_lower and "text 2" in text_lower: score += 10
            elif "both texts" in text_lower: score += 5
            
        elif cat_skill == "Words in Context":
            if "most nearly mean" in text_lower: score += 10
            elif "replace" in text_lower and "word" in text_lower: score += 5
            elif "logical and precise word" in text_lower: score += 10
            elif "____" in text_lower or "_" in text_lower: 
                if "transition" not in text_lower: score += 3

        elif cat_skill == "Text Structure and Purpose":
            if "main purpose" in text_lower: score += 8
            elif "function" in text_lower and ("sentence" in text_lower or "part" in text_lower): score += 8
            elif "overall structure" in text_lower: score += 10
            elif "best describes the function" in text_lower: score += 10

        elif cat_skill == "Central Ideas and Details":
            if "main idea" in text_lower: score += 10
            elif "conclusion" in text_lower and "best" in text_lower: score += 3
            elif "best summarizes" in text_lower: score += 10
            
        elif cat_skill == "Command of Evidence":
            if "support" in text_lower and ("claim" in text_lower or "hypothesis" in text_lower): score += 8
            elif "weaken" in text_lower or "undermine" in text_lower: score += 10
            elif "illustrate" in text_lower and "claim" in text_lower: score += 8
            elif "table" in text_lower or "graph" in text_lower or "data" in text_lower: score += 5

        elif cat_skill == "Inferences":
            if "most logical inference" in text_lower: score += 10
            elif "suggests that" in text_lower: score += 5
            elif "logically completes" in text_lower: score += 5

        elif cat_skill == "Transitions":
            if "most logical transition" in text_lower: score += 12
            elif "transition" in text_lower: score += 10

        elif cat_skill == "Rhetorical Synthesis":
            if "student" in text_lower and "notes" in text_lower: score += 10
            elif "synthesize" in text_lower: score += 10
            elif "bullet" in text_lower: score += 5

        elif cat_skill == "Boundaries":
            semicolons = choices_text.count(";")
            colons = choices_text.count(":")
            if semicolons > 0 or colons > 0: score += 8
            elif "run-on" in text_lower: score += 10 

        elif cat_skill == "Form, Structure, and Sense":
            if "conventions of standard english" in text_lower: score += 5

    # --- MATH RULES ---
    elif subject == "Math":
        
        # Geometry
        if cat_domain == "Geometry and Trigonometry":
            if cat_skill == "Circles":
                if "circle" in text_lower: score += 12
                elif "radius" in text_lower or "diameter" in text_lower: score += 10
                elif "(x" in text_lower and ")^2" in text_lower and "+ (y" in text_lower: score += 12
            elif cat_skill == "Area and Volume":
                if "volume" in text_lower: score += 12
                elif "area" in text_lower and "surface" not in text_lower: score += 8
                elif "cylinder" in text_lower or "prism" in text_lower or "rectangle" in text_lower: score += 8
            elif cat_skill == "Right Triangles and Trigonometry":
                if "right triangle" in text_lower: score += 10
                elif bool(re.search(r"\b(sin|cos|tan)\b", text_lower)): score += 12
                # Reduced triangle score here so generic triangles can go to Lines...
                elif "triangle" in text_lower and "right" in text_lower: score += 8 
            elif cat_skill == "Lines, Angles, and Triangles":
                if "parallel" in text_lower: score += 12
                elif "perpendicular" in text_lower: score += 12
                elif "angle" in text_lower and "measure" in text_lower: score += 8
                elif "triangle" in text_lower: score += 5 # Catch generic triangles
                
        # Statistics
        elif cat_domain == "Problem-Solving and Data Analysis":
            if cat_skill == "Probability":
                if "probability" in text_lower: score += 15
                elif "random" in text_lower and ("selected" in text_lower or "chosen" in text_lower): score += 12
                elif "chance" in text_lower or "likelihood" in text_lower: score += 10
                elif "expected value" in text_lower: score += 12
                elif "proportion" in text_lower and "random" in text_lower: score += 10 # Careful with Ratios

            elif cat_skill == "Percentages":
                if "percent" in text_lower or "%" in text_lower: score += 15
                elif "interest" in text_lower and ("compound" in text_lower or "simple" in text_lower): score += 15
                elif "discount" in text_lower or "tax" in text_lower or "population" in text_lower: 
                    if "increase" in text_lower or "decrease" in text_lower or "growth" in text_lower: score += 10
                elif "investment" in text_lower or "depreciat" in text_lower: score += 10
                elif bool(re.search(r"\b(0\.\d+|1\.\d+)\s*[xy]", text_lower)): score += 8 # Detect decimal multipliers like 0.10x

            elif cat_skill == "Two-Variable Data":
                if "scatterplot" in text_lower: score += 20
                elif "line of best fit" in text_lower or "best fit" in text_lower: score += 15
                elif "linear model" in text_lower: score += 12
                elif "relationship between" in text_lower and ("graph" in text_lower or "data" in text_lower): score += 10
                elif "predict" in text_lower and "value" in text_lower: score += 8
                elif "correlation" in text_lower: score += 10
                
            elif cat_skill == "One-Variable Data":
                if "median" in text_lower or "mean" in text_lower or "standard deviation" in text_lower: score += 15
                elif "average" in text_lower and "arithmetic" in text_lower: score += 15
                elif "range" in text_lower and ("data" in text_lower or "set" in text_lower): score += 10
                elif "histogram" in text_lower or "dot plot" in text_lower or "box plot" in text_lower: score += 15
                elif "frequency" in text_lower and "table" in text_lower: score += 10
                elif "outlier" in text_lower: score += 10
                elif "measure of center" in text_lower: score += 15

            elif cat_skill == "Evaluating Statistical Claims":
                if "survey" in text_lower or "study" in text_lower or "experiment" in text_lower: score += 8
                elif "control group" in text_lower or "treatment" in text_lower: score += 10
                elif "random assignment" in text_lower or "bias" in text_lower: score += 10
                elif "valid conclusion" in text_lower or "generalize" in text_lower: score += 10
                elif "representative" in text_lower and "sample" in text_lower: score += 10

            elif cat_skill == "Sample Statistics and Margin of Error":
                if "margin of error" in text_lower: score += 20
                elif "confidence interval" in text_lower: score += 15
                elif "sample mean" in text_lower or "sample proportion" in text_lower: score += 10
                elif "standard error" in text_lower: score += 10
                elif "population" in text_lower and "sample" in text_lower and "estimate" in text_lower: score += 10

            elif cat_skill == "Ratios, Rates, Proportions, and Units":
                if bool(re.search(r"\bratios?\b", text_lower)): score += 15
                elif "proportional" in text_lower: score += 15
                elif "rate" in text_lower and ("change" not in text_lower): score += 8 # Avoid rate of change (slope)
                elif "constant rate" in text_lower: score += 10
                elif "speed" in text_lower and ("distance" in text_lower or "time" in text_lower): score += 8
                elif "per" in text_lower: score += 5
                elif "density" in text_lower: score += 10
                elif "unit" in text_lower and ("convert" in text_lower or "square" not in text_lower): score += 5 # Avoid unit square
                elif "miles" in text_lower or "gallons" in text_lower or "kilometers" in text_lower: score += 3 # Slight boost for unit heavy problems
                elif "scale" in text_lower and ("drawing" in text_lower or "map" in text_lower): score += 10

        # Algebra / Advanced Math
        else:
            # Simple Algebra matching
            has_eq = "=" in text_lower
            
            # Robust var detection
            has_x = bool(re.search(r"\bx\b", text_lower))
            has_y = bool(re.search(r"\by\b", text_lower))
            
            # Smart square detection
            is_unit_square = "square" in text_lower and ("meter" in text_lower or "foot" in text_lower or "inch" in text_lower or "mile" in text_lower)
            has_sq_symbol = bool(re.search(r"\^\{?2\}?", text_lower))
            has_sq = has_sq_symbol or ("square" in text_lower and not is_unit_square)
            
            # Detect x^2 missing caret context like 'x 2' or ') 2'
            if not has_sq:
                 has_sq = bool(re.search(r"[\)xytvnkp]\s*2\b", text_lower)) # added p for p^2

            # Detect general exponent with variable
            has_exponent_var = bool(re.search(r"\^\{?[a-z0-9\+\-\/\s]*[xntk]", text_lower))

            is_function = "f(x)" in text_lower or "g(x)" in text_lower or "function" in text_lower

            if cat_skill == "Linear Equations in One Variable":
                if has_eq and has_x and not has_y and not has_sq and not is_function: score += 10
                elif "value of" in text_lower and "satisfies" in text_lower and not has_y: score += 8
                elif "solution to the given equation" in text_lower and not has_y: score += 8
                
            elif cat_skill == "Systems of Linear Equations":
                if "system" in text_lower: score += 20
                elif "solution (x, y)" in text_lower: score += 12
                elif has_x and has_y and has_eq and not has_sq and not "function" in text_lower and ("intersect" in text_lower or "solution" in text_lower): score += 8
                
            elif cat_skill == "Linear Inequalities":
                if "inequalit" in text_lower: score += 15
                elif "<" in text_lower or ">" in text_lower: score += 8
                elif "maximum possible value" in text_lower or "minimum possible value" in text_lower: score += 5
                
            elif cat_skill == "Linear Functions":
                if "linear function" in text_lower: score += 20
                elif "slope" in text_lower or "y-intercept" in text_lower or "x-intercept" in text_lower: score += 12
                elif is_function and not has_sq and not has_exponent_var and not "quadratic" in text_lower and not "exponential" in text_lower: score += 12
                elif has_y and has_x and not has_sq and not has_exponent_var and "system" not in text_lower and has_eq: score += 5 # y=mx+b fallback
            
            # Advanced
            elif cat_skill == "Equivalent Expressions":
                if "equivalent" in text_lower: score += 20
                elif "rewrite" in text_lower: score += 10
                elif "expression" in text_lower and not has_eq: score += 5
                
            elif cat_skill == "Nonlinear Functions":
                if "quadratic" in text_lower or "exponential" in text_lower: score += 20
                elif "parabola" in text_lower: score += 15
                elif "rational" in text_lower: score += 10
                elif (has_sq or has_exponent_var) and is_function: score += 15
                elif "vertex" in text_lower: score += 15
                elif "maximum" in text_lower or "minimum" in text_lower: score += 5
                elif "|" in text_lower: score += 8 # Absolute value 
                
            elif cat_skill == "Nonlinear Equations and Systems":
                if "system" in text_lower and has_sq: score += 20
                elif "discriminant" in text_lower: score += 15
                elif "number of solutions" in text_lower and has_sq: score += 15
                elif has_eq and has_sq and not is_function: score += 10
    
    return score

def main():
    if not QUESTIONS_JSON.exists():
        print("Questions file not found.")
        return

    print("Loading questions...")
    with open(QUESTIONS_JSON, 'r', encoding='utf-8') as f:
        questions = json.load(f)
        
    category_map = {}
    
    counts = { "Math": 0, "English": 0, "Unmapped": 0 }
    skill_counts = {}
    
    for q in questions:
        # Determine Subject
        test_name = (q.get('test_name') or "").lower()
        subject = None
        if "math" in test_name: subject = "Math"
        elif "english" in test_name or "reading" in test_name or "writing" in test_name: subject = "English"
        else:
            if re.search(r"\bx\b", (q.get('question_text') or "").lower()): subject = "Math"
            else: subject = "English"
            
        relevant_cats = [c for c in all_cats if c['subject'] == subject]
        
        best_cat = None
        best_score = 0
        
        for cat in relevant_cats:
            score = match_score(q, cat)
            if score > best_score:
                best_score = score
                best_cat = cat
        
        if best_cat and best_score > 0:
            category_map[q['id']] = {
                "subject": best_cat['subject'],
                "domain": best_cat['domain'],
                "skill": best_cat['skill'],
                "confidence": "medium" if best_score < 8 else "high"
            }
            key = f"{best_cat['domain']} - {best_cat['skill']}"
            skill_counts[key] = skill_counts.get(key, 0) + 1
            counts[best_cat['subject']] += 1
        else:
            counts["Unmapped"] += 1
            
    print("\nCategorization Results:")
    print(f"Total Questions: {len(questions)}")
    print(f"Math: {counts['Math']}")
    print(f"English: {counts['English']}")
    print(f"Unmapped: {counts['Unmapped']}")
    
    print("\nSkill Distribution:")
    for k, v in sorted(skill_counts.items()):
        print(f"  {k}: {v}")
        
    with open(OUTPUT_MAP, 'w', encoding='utf-8') as f:
        json.dump(category_map, f, indent=2)
    print(f"\nSaved map to {OUTPUT_MAP}")

    # Random Sampling for Verification
    print("\n--- Verification Sampling (1 Question per Skill) ---")
    
    # Organize IDs by skill
    skill_to_ids = {}
    for qid, data in category_map.items():
        key = f"{data['domain']} - {data['skill']}"
        if key not in skill_to_ids:
            skill_to_ids[key] = []
        skill_to_ids[key].append(qid)
        
    # Map back to questions for printing
    q_lookup = {q['id']: q for q in questions}
    
    for skill, ids in sorted(skill_to_ids.items()):
        sample_id = random.choice(ids)
        q = q_lookup[sample_id]
        print(f"\n[Category: {skill}]")
        print(f"ID: {sample_id}")
        passage = (q.get('passage') or "")
        q_text = (q.get('question_text') or "")
        print(f"Text: {(passage + ' ' + q_text)[:200]}...")

if __name__ == "__main__":
    main()
