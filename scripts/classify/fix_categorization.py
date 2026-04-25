import json
import os
import glob
import re
from pathlib import Path

# Paths
BASE_DIR = Path(r"c:/Users/303da/Documents/GitHub/1600-prep-hub")
DATA_DIR = BASE_DIR / "src" / "data"
MODULES_DIR = DATA_DIR / "Modules"
ALL_QUESTIONS_PATH = DATA_DIR / "all_questions.ts"
CATEGORY_SCRIPT = BASE_DIR / "scripts" / "categorize_questions_rules.py"

# Import categorization logic
import sys
sys.path.append(str(BASE_DIR / "scripts"))
from categorize_questions_rules import all_cats, match_score

def categorize_question(question):
    """Find the best category for a question using the existing categorization rules."""
    best_cat = None
    best_score = -1
    
    for cat in all_cats:
        score = match_score(question, cat)
        if score > best_score:
            best_score = score
            best_cat = cat
    
    return best_cat

def fix_module_file(filepath):
    """Fix a single module JSON file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        questions = json.load(f)
    
    # Skip if not a list (e.g., failed_images.json)
    if not isinstance(questions, list):
        return False
    
    filename = os.path.basename(filepath)
    is_math = "Math" in filename
    is_english = "English" in filename or "Reading" in filename
    
    # Determine section from filename
    expected_section = "Math" if is_math else "Reading and Writing" if is_english else None
    
    modified = False
    
    # Track Words in Context and Rhetorical Synthesis positions for English
    wic_indices = []
    rs_indices = []
    
    for idx, q in enumerate(questions):
        # Fix section
        if expected_section and q.get("section") != expected_section:
            q["section"] = expected_section
            modified = True
        
        # Categorize if null
        if q.get("domain") is None or q.get("skill") is None:
            # Create a question dict for categorization
            cat_q = {
                'passage': q.get('passage', ''),
                'question_text': q.get('question_text', ''),
                'choices': q.get('choices', [])
            }
            cat = categorize_question(cat_q)
            if cat:
                if q.get("domain") is None:
                    q["domain"] = cat["domain"]
                    modified = True
                if q.get("skill") is None:
                    q["skill"] = cat["skill"]
                    modified = True
        
        # Track positions for English questions
        if is_english:
            if q.get("skill") == "Words in Context":
                wic_indices.append(idx)
            elif q.get("skill") == "Rhetorical Synthesis":
                rs_indices.append(idx)
    
    # Fix Words in Context gaps at beginning for English modules
    if is_english and wic_indices:
        # Find the first WIC
        first_wic = wic_indices[0]
        # Find the last consecutive WIC from the start
        last_consecutive = first_wic
        for i in range(first_wic + 1, len(questions)):
            if i in wic_indices:
                if i == last_consecutive + 1:
                    last_consecutive = i
                else:
                    break
            else:
                # This is a gap - check if there's another WIC after
                if any(w > i for w in wic_indices):
                    # Fill the gap
                    questions[i]["skill"] = "Words in Context"
                    questions[i]["domain"] = "Craft and Structure"
                    modified = True
                else:
                    break
    
    # Fix Rhetorical Synthesis gaps at end for English modules
    if is_english and rs_indices:
        # Find the last RS
        last_rs = rs_indices[-1]
        # Find the first consecutive RS from the end
        first_consecutive = last_rs
        for i in range(last_rs - 1, -1, -1):
            if i in rs_indices:
                if i == first_consecutive - 1:
                    first_consecutive = i
                else:
                    break
            else:
                # This is a gap - check if there's another RS before
                if any(r < i for r in rs_indices):
                    # Fill the gap
                    questions[i]["skill"] = "Rhetorical Synthesis"
                    questions[i]["domain"] = "Expression of Ideas"
                    modified = True
                else:
                    break
    
    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(questions, f, indent=2, ensure_ascii=False)
        return True
    return False

def fix_all_questions_ts():
    """Fix the all_questions.ts file."""
    with open(ALL_QUESTIONS_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Parse objects using regex
    pattern = re.compile(r'^  \{$(.*?)^  \},?$', re.MULTILINE | re.DOTALL)
    
    modified = False
    
    def replacer(match):
        nonlocal modified
        full_match = match.group(0)
        body = match.group(1)
        
        # Check if domain or skill is null
        has_null_domain = 'domain: null' in body
        has_null_skill = 'skill: null' in body
        
        if not (has_null_domain or has_null_skill):
            # Check section vs testName consistency
            section_match = re.search(r'section: "([^"]+)"', body)
            testname_match = re.search(r'testName: "([^"]+)"', body)
            
            if section_match and testname_match:
                section = section_match.group(1)
                testname = testname_match.group(1).lower()
                
                expected_section = None
                if "math" in testname:
                    expected_section = "Math"
                elif "english" in testname or "reading" in testname:
                    expected_section = "Reading and Writing"
                
                if expected_section and section != expected_section:
                    new_body = re.sub(
                        r'section: "[^"]+"',
                        f'section: "{expected_section}"',
                        body
                    )
                    modified = True
                    suffix = ',' if full_match.strip().endswith(',') else ''
                    return f'  {{{new_body}  }}{suffix}'
            
            return full_match
        
        # Need to categorize
        # Extract question info
        passage_match = re.search(r'text: "((?:[^"\\]|\\.)*)"', body)
        passage = passage_match.group(1) if passage_match else ""
        
        # For categorization, create a simple dict
        cat_q = {
            'passage': passage,
            'question_text': passage,  # Use text as question_text
            'choices': []
        }
        
        cat = categorize_question(cat_q)
        
        if cat:
            new_body = body
            if has_null_domain:
                new_body = re.sub(r'domain: null', f'domain: "{cat["domain"]}"', new_body)
            if has_null_skill:
                new_body = re.sub(r'skill: null', f'skill: "{cat["skill"]}"', new_body)
            
            modified = True
            suffix = ',' if full_match.strip().endswith(',') else ''
            return f'  {{{new_body}  }}{suffix}'
        
        return full_match
    
    new_content = pattern.sub(replacer, content)
    
    if modified:
        with open(ALL_QUESTIONS_PATH, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    return False

def main():
    print("Fixing module files...")
    json_files = list(glob.glob(str(MODULES_DIR / "*.json")))
    
    fixed_count = 0
    for filepath in json_files:
        if fix_module_file(filepath):
            fixed_count += 1
            print(f"Fixed: {os.path.basename(filepath)}")
    
    print(f"\nFixed {fixed_count} module files.")
    
    print("\nFixing all_questions.ts...")
    if fix_all_questions_ts():
        print("Fixed all_questions.ts")
    else:
        print("No changes needed in all_questions.ts")

if __name__ == "__main__":
    main()
