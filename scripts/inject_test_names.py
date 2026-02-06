import json
import re
import os

BASE_DIR = r"c:\Users\303da\Documents\GitHub\1600-prep-hub"
DATA_PATH = os.path.join(BASE_DIR, "src", "data", "questions_data.ts")
ALL_QUESTIONS_PATH = os.path.join(BASE_DIR, "src", "data", "all_questions.ts")

def extract_test_names():
    print("Scanning questions_data.ts for test names...")
    
    mapping = {}
    
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        content = f.read()
        
    chunks = content.split('"question_number":')
    for chunk in chunks[1:]:
        m_num = re.match(r'\s*(\d+),', chunk)
        if not m_num: continue
        q_num = int(m_num.group(1))
        
        m_name = re.search(r'"test_name":\s*"(.*?)",', chunk)
        if m_name:
            mapping[q_num] = m_name.group(1)
            
    print(f"Found {len(mapping)} mappings.")
    return mapping

def inject_test_names():
    mapping = extract_test_names()
    
    print("Reading all_questions.ts...")
    with open(ALL_QUESTIONS_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    new_lines = []
    
    re_id = re.compile(r'^\s*id:\s*(\d+),')
    
    matches = 0
    interface_patched = False
    
    for line in lines:
        # Patch Interface
        if "text: string;" in line and not interface_patched:
            # Check if this is inside "export interface Question"
            # Just look for context or blindly insert if it looks like the interface
            # The tool call creates file so we can't see context easily in loop
            # But we saw file structure earlier.
            # line 13 is text: string;
            new_lines.append("  testName?: string;\n")
            interface_patched = True
            
        m_id = re_id.match(line)
        if m_id:
            current_id = int(m_id.group(1))
            new_lines.append(line)
            
            if current_id in mapping:
                t_name = mapping[current_id]
                t_name_safe = t_name.replace('"', '\\"')
                indent = "    "
                new_lines.append(f'{indent}testName: "{t_name_safe}",\n')
                matches += 1
        else:
            new_lines.append(line)

    print(f"Injected testName for {matches} questions.")
    
    with open(ALL_QUESTIONS_PATH, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

if __name__ == "__main__":
    inject_test_names()
