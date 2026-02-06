import json
import os
import re
from pathlib import Path

# Configuration
WORKSPACE_ROOT = Path(".")
QUESTIONS_JSON_PATH = WORKSPACE_ROOT / "src/data/questions.json"
IMAGES_DIR = WORKSPACE_ROOT / "public/images/SAT-Style Questions"

# Mappings
MONTH_MAP = {
    "Aug": "August", "Dec": "December", "Jun": "June", 
    "Mar": "March", "May": "May", "Nov": "November", 
    "Oct": "October", "Sep": "September"
}

import sys
# Add scripts folder to path to import converter
# sys.path.append(str(WORKSPACE_ROOT / "scripts"))
# Try importing, handling potential failure if script not found
try:
    from convert_to_typescript import convert_to_typescript
except ImportError:
    convert_to_typescript = None

def parse_filename(filename):
    # Split filename key parts (remove extension first)
    root, ext = os.path.splitext(filename)
    parts = root.split('_')
    
    # Expected structures:
    # 1. Mon_YrVar_Subj_Mod_QNum... (e.g. Aug_23A_Eng_M1_Q11) -> 5 parts base
    # 2. Mon_Yr_Var_Subj_Mod_QNum... (e.g. Aug_24_IntlA_Math_M2_Q8) -> 6 parts base
    
    if len(parts) < 5:
        return None
        
    mon = parts[0]
    
    # Check part 1 (Year/YearVar)
    p1 = parts[1]
    
    # Check if p1 ends with a digit (Year Only) or Letter (Year+Var)
    # Actually, simplistic check: Is parts[2] a Subject (Eng/Math)?
    subject_candidates = ["Eng", "Math"]
    
    yr = ""
    var = ""
    subj = ""
    mod_part = ""
    q_part = ""
    suffix = None
    
    if parts[2] in subject_candidates:
        # Schema 1: Mon_YrVar_Subj_Mod_QNum
        # p1 is YrVar e.g. "23A"
        match_yr = re.match(r"(\d+)([A-Za-z]+)", p1)
        if match_yr:
            yr = match_yr.group(1)
            var = match_yr.group(2)
        else:
            # Maybe just Year? "23_Eng"? Unlikely given schema 1 usually implies variant attached?
            # Or maybe p1 is just "23" and variant is implicit A?
            yr = p1
            var = "A" # Default? Or error?
            
        subj = parts[2]
        mod_part = parts[3]
        q_part = parts[4]
        if len(parts) > 5:
            suffix = "_".join(parts[5:])
            
    elif len(parts) > 3 and parts[3] in subject_candidates:
        # Schema 2: Mon_Yr_Var_Subj_Mod_QNum
        yr = parts[1]
        var = parts[2]
        subj = parts[3]
        mod_part = parts[4]
        q_part = parts[5]
        if len(parts) > 6:
            suffix = "_".join(parts[6:])
    else:
        # Fallback/Unrecognized
        return None
        
    # Validation
    if not mod_part.startswith("M") or not q_part.startswith("Q"):
        return None
        
    mod = mod_part[1:]
    qnum = q_part[1:]
    
    # Expand Metadata
    full_month = MONTH_MAP.get(mon, mon)
    full_year = f"20{yr}"
    
    if var.startswith("Intl"):
        form = var[4:] 
        full_variant = f"International Form {form}"
    elif var.startswith("US"):
        form = var[2:] 
        full_variant = f"US Form {form}"
    elif var.startswith("Form"): # edge case
        full_variant = var
    else:
        full_variant = f"Form {var}"
        
    full_subj = "English" if subj.lower() == "eng" else "Math"
    
    test_name = f"{full_month} {full_year} {full_variant} SAT {full_subj} Module {mod}"
    
    return {
        "test_name": test_name,
        "question_number": int(qnum),
        "suffix": suffix,
        "filename": filename
    }

def main():
    print("Loading questions.json...")
    with open(QUESTIONS_JSON_PATH, 'r', encoding='utf-8') as f:
        questions = json.load(f)
        
    # Create lookup map: (test_name, question_number) -> question object
    q_map = {}
    for q in questions:
        key = (q.get("test_name"), q.get("question_number"))
        q_map[key] = q
        
    print("Scanning images...")
    files = [f for f in os.listdir(IMAGES_DIR) if os.path.isfile(IMAGES_DIR / f)]
    
    matched_count = 0
    
    mismatch_count = 0
    for fname in files:
        meta = parse_filename(fname)
        if not meta:
            # print(f"Skipping {fname} (no match)")
            continue
            
        key = (meta["test_name"], meta["question_number"])
        
        if key in q_map:
            q = q_map[key]
            
            # Construct image object
            # Path must be URL encoded usually, but here we construct the logical path
            # The utils/renderer expects paths. 
            # Previous instructions used encoded paths.
            raw_path = f"/images/SAT-Style Questions/{fname}"
            # encoded_path = raw_path.replace(" ", "%20") 
            # Actually, let's keep it raw for now, or match existing style.
            # The previous turn we replaced spaces with %20 in the JSON.
            # So let's use %20.
            final_path = f"/images/SAT-Style%20Questions/{fname}"
            
            # Check if this image is already linked to avoid duplicates
            if "questionImages" not in q:
                q["questionImages"] = []
            
            exists = any(img["src"] == final_path for img in q["questionImages"])
            if not exists:
                q["questionImages"].append({
                    "src": final_path,
                    "alt": f"Question {q['question_number']} Image"
                })
                matched_count += 1
                # print(f"Linked {fname} to {key}")
        else:
           mismatch_count += 1
           if mismatch_count < 10:
               print(f"Mismatch: Image {fname} -> {meta['test_name']}")
    
    print(f"Total Mismatches: {mismatch_count}")
           
    print(f"Linked {matched_count} images to questions.")
    
    print("Saving updated questions.json...")
    with open(QUESTIONS_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(questions, f, indent=2)
        
    if convert_to_typescript:
        print("Converting back to TypeScript (questions_data.ts)...")
        convert_to_typescript(QUESTIONS_JSON_PATH, WORKSPACE_ROOT / "src/data/questions_data.ts")
    else:
        print("Warning: convert_to_typescript module not found. Skipping TS update.")
        
    print("Done.")

if __name__ == "__main__":
    main()
