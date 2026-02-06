import json
import os
import glob
import re

# Paths
BASE_DIR = r"c:/Users/303da/Documents/GitHub/1600-prep-hub"
DATA_DIR = os.path.join(BASE_DIR, "src", "data")
MODULES_DIR = os.path.join(DATA_DIR, "Modules")
ALL_QUESTIONS_PATH = os.path.join(DATA_DIR, "all_questions.ts")
CATEGORY_MAP_PATH = os.path.join(DATA_DIR, "category_map.json")

def load_category_map():
    if not os.path.exists(CATEGORY_MAP_PATH):
        print("Category map not found.")
        return {}
    with open(CATEGORY_MAP_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def get_section_from_filename(filename):
    lower = filename.lower()
    if "english" in lower or "reading" in lower or "writing" in lower:
        return "Reading and Writing"
    if "math" in lower:
        return "Math"
    return "Math" 

def update_modules(category_map):
    json_files = glob.glob(os.path.join(MODULES_DIR, "*.json"))
    print(f"Found {len(json_files)} module files.")

    for filepath in json_files:
        filename = os.path.basename(filepath)
        
        with open(filepath, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                print(f"Error decoding {filename}, skipping.")
                continue

        if not isinstance(data, list):
            continue

        updated = False
        default_section = get_section_from_filename(filename)

        for q in data:
            q_id = str(q.get("id", ""))
            
            cat_info = category_map.get(q_id, {})
            
            c_subject = cat_info.get("subject")
            c_domain = cat_info.get("domain")
            c_skill = cat_info.get("skill")
            
            if c_subject == "English":
                section = "Reading and Writing"
            elif c_subject == "Math":
                section = "Math"
            else:
                section = default_section

            # Update existing or add new
            q["section"] = section
            # Only set domain/skill if not present? User implies adding specific default or mapped.
            # If map has it, use it. If not, use None (null in json).
            q["domain"] = c_domain if c_domain else None
            q["skill"] = c_skill if c_skill else None
            q["difficulty"] = "null"
            if "rationale" not in q:
                q["rationale"] = None
                
            updated = True
            
        if updated:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
    
    print("Modules updated.")

def update_all_questions_ts(category_map):
    print("Updating all_questions.ts...")
    
    with open(ALL_QUESTIONS_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Regex matches object block:
    # Starts with exactly 2 spaces + { at start of line
    # Ends with exactly 2 spaces + }, (or just }) at start of line
    pattern = re.compile(r'^  \{$(.*?)^  \},?$', re.MULTILINE | re.DOTALL)
    
    def replacer(match):
        full_match = match.group(0)
        body = match.group(1)
        
        # Avoid double insertion
        if 'difficulty: "null"' in body and 'section:' in body:
             return full_match
        
        # Analyze body
        section = "Math"
        domain = "null"
        skill = "null"
        
        # Check category
        cat_match = re.search(r'category:\s*\{(.*?)\}', body, re.DOTALL)
        if cat_match:
            cat_body = cat_match.group(1)
            # Find subject
            m_sub = re.search(r'"subject":\s*"([^"]+)"', cat_body)
            # Find domain
            m_dom = re.search(r'"domain":\s*"([^"]+)"', cat_body)
            # Find skill
            m_skill = re.search(r'"skill":\s*"([^"]+)"', cat_body)
            
            if m_sub:
                if m_sub.group(1) == "English": section = "Reading and Writing"
                elif m_sub.group(1) == "Math": section = "Math"
            
            if m_dom: domain = f'"{m_dom.group(1)}"'
            if m_skill: skill = f'"{m_skill.group(1)}"'
            
        else:
            # Fallback testName
            m_tn = re.search(r'testName:\s*"([^"]+)"', body)
            if m_tn:
                 tn = m_tn.group(1).lower()
                 if "english" in tn or "reading" in tn or "writing" in tn:
                     section = "Reading and Writing"
                 elif "math" in tn:
                     section = "Math"
        
        insertion = f'    section: "{section}",\n    domain: {domain},\n    skill: {skill},\n    difficulty: "null",\n    rationale: null,'
        
        if body.startswith('\n'):
             # Format: \n<insertion>\n...
             new_body = '\n' + insertion + body
        else:
             new_body = '\n' + insertion + '\n' + body
             
        # Check if original had comma
        suffix = ',' if full_match.strip().endswith(',') else ''
        return f'  {{{new_body}  }}{suffix}' 

    new_content = pattern.sub(replacer, content)
    
    with open(ALL_QUESTIONS_PATH, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Updated all_questions.ts")

def main():
    cat_map = load_category_map()
    update_modules(cat_map)
    # update_all_questions_ts(cat_map) # Disabled for safety check first? No, enabling it.
    update_all_questions_ts(cat_map)

if __name__ == "__main__":
    main()
