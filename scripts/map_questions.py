import json
import os
import re
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
        print(f"Warning: {root} not found. Skipping {subject}.")
        return categories
        
    for r, d, f in os.walk(root):
        rel = Path(r).relative_to(root)
        if len(rel.parts) == 2: # Domain/Skill
            categories.append({
                "subject": subject,
                "domain": rel.parts[0],
                "skill": rel.parts[1]
            })
    return categories

def match_score(question, category):
    text = (question.get('passage', '') or '') + " " + (question.get('question_text', '') or '')
    text_lower = text.lower()
    choices = question.get('choices', [])
    choices_text = " ".join([c.get('text', '') for c in choices]).lower()
    
    cat_skill = category['skill']
    cat_domain = category['domain']
    subject = category['subject']
    
    score = 0
    
    # --- READING & WRITING RULES ---
    if subject == "English":
        
        # Craft and Structure
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

        # Information and Ideas
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

        # Expression of Ideas
        elif cat_skill == "Transitions":
            if "transition" in text_lower: score += 10
            elif "logical transition" in text_lower: score += 10
            else:
                trans_words = ["however", "therefore", "furthermore", "consequently", "nevertheless", "in contrast", "similarly"]
                count = sum(1 for w in trans_words if w in choices_text)
                if count > 1: score += 8

        elif cat_skill == "Rhetorical Synthesis":
            if "student" in text_lower and "notes" in text_lower: score += 10
            elif "synthesize" in text_lower: score += 10
            elif "bullet" in text_lower: score += 5

        # Standard English Conventions
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
                if "circle" in text_lower: score += 10
                elif "radius" in text_lower or "diameter" in text_lower: score += 8
                elif "(x" in text_lower and ")^2" in text_lower and "+ (y" in text_lower: score += 10
            elif cat_skill == "Area and Volume":
                if "volume" in text_lower: score += 10
                elif "area" in text_lower and "surface" not in text_lower: score += 5
                elif "cylinder" in text_lower or "prism" in text_lower or "rectangle" in text_lower: score += 5
            elif cat_skill == "Right Triangles and Trigonometry":
                if "triangle" in text_lower: score += 5
                elif "sin" in text_lower or "cos" in text_lower or "tan" in text_lower: score += 10
                elif "angle" in text_lower and "degree" in text_lower: score += 5
            elif cat_skill == "Lines, Angles, and Triangles":
                if "parallel" in text_lower: score += 5
                elif "perpendicular" in text_lower: score += 5
                elif "angle" in text_lower and "measure" in text_lower: score += 5
                
        # Statistics
        elif cat_domain == "Problem-Solving and Data Analysis":
            if cat_skill == "Probability":
                if "probability" in text_lower: score += 15
                elif "random" in text_lower and ("selected" in text_lower or "chosen" in text_lower): score += 12
                elif "chance" in text_lower or "likelihood" in text_lower: score += 10
                elif "expected value" in text_lower: score += 12
                elif "proportion" in text_lower and "random" in text_lower: score += 10

            elif cat_skill == "Percentages":
                if "percent" in text_lower or "%" in text_lower: score += 15
                elif "interest" in text_lower and ("compound" in text_lower or "simple" in text_lower): score += 15
                elif "discount" in text_lower or "tax" in text_lower or "population" in text_lower: 
                    if "increase" in text_lower or "decrease" in text_lower or "growth" in text_lower: score += 10
                elif "investment" in text_lower or "depreciat" in text_lower: score += 10
                elif bool(re.search(r"\b(0\.\d+|1\.\d+)\s*[xy]", text_lower)): score += 8

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
                elif "rate" in text_lower and ("change" not in text_lower): score += 8
                elif "constant rate" in text_lower: score += 10
                elif "speed" in text_lower and ("distance" in text_lower or "time" in text_lower): score += 8
                elif "per" in text_lower: score += 5
                elif "density" in text_lower: score += 10
                elif "unit" in text_lower and ("convert" in text_lower or "square" not in text_lower): score += 5
                elif "miles" in text_lower or "gallons" in text_lower or "kilometers" in text_lower: score += 3
                elif "scale" in text_lower and ("drawing" in text_lower or "map" in text_lower): score += 10

        # Algebra / Advanced Math
        else:
            has_eq = "=" in text_lower
            has_x = "x" in text_lower
            has_y = "y" in text_lower
            has_sq = "^2" in text_lower or "square" in text_lower
            
            if cat_skill == "Linear Equations in One Variable":
                if has_eq and has_x and not has_y and not has_sq: score += 5
                elif "value of" in text_lower and "satisfies" in text_lower: score += 3
            elif cat_skill == "Systems of Linear Equations":
                if "system" in text_lower: score += 10
                elif has_x and has_y and has_eq and not has_sq: score += 5
                elif "solution (x, y)" in text_lower: score += 5
            elif cat_skill == "Linear Inequalities":
                if "inequalit" in text_lower: score += 10
                elif "<" in text_lower or ">" in text_lower: score += 5
            elif cat_skill == "Linear Functions":
                if "linear function" in text_lower: score += 10
                elif "slope" in text_lower or "intercept" in text_lower: score += 8
                elif "f(x)" in text_lower and not has_sq: score += 3
            
            # Advanced
            elif cat_skill == "Equivalent Expressions":
                if "equivalent" in text_lower: score += 10
                elif "rewrite" in text_lower: score += 5
            elif cat_skill == "Nonlinear Functions":
                if "quadratic" in text_lower or "exponential" in text_lower: score += 5
                elif has_sq and "function" in text_lower: score += 5
                elif "vertex" in text_lower: score += 8
            elif cat_skill == "Nonlinear Equations and Systems":
                if "system" in text_lower and has_sq: score += 10
                elif "number of solutions" in text_lower: score += 5
                elif has_eq and has_sq and not "function" in text_lower: score += 4
    
    return score

def main():
    if not QUESTIONS_JSON.exists():
        print("Questions file not found.")
        return
        
    math_cats = get_categories(MATH_ROOT, "Math")
    eng_cats = get_categories(RW_ROOT, "English")
    all_cats = math_cats + eng_cats
    
    print(f"Found {len(all_cats)} categories from folders.")

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
            if "x" in (q.get('question_text') or ""): subject = "Math"
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

if __name__ == "__main__":
    main()
