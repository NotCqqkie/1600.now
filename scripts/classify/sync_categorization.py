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

def build_categorization_map():
    """Build a map of question ID -> categorization from module files."""
    cat_map = {}
    json_files = list(glob.glob(str(MODULES_DIR / "*.json")))
    
    for filepath in json_files:
        with open(filepath, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except:
                continue
        
        if not isinstance(data, list):
            continue
        
        for q in data:
            if not isinstance(q, dict):
                continue
                
            q_id = q.get('id')
            if q_id:
                cat_map[str(q_id)] = {
                    'section': q.get('section'),
                    'domain': q.get('domain'),
                    'skill': q.get('skill'),
                    'difficulty': q.get('difficulty'),
                    'rationale': q.get('rationale')
                }
    
    return cat_map

def sync_all_questions_ts(cat_map):
    """Sync categorization in all_questions.ts with module files."""
    with open(ALL_QUESTIONS_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern to match question objects
    pattern = re.compile(r'^  \{$(.*?)^  \},?$', re.MULTILINE | re.DOTALL)
    
    modified = False
    changes = []
    
    def replacer(match):
        nonlocal modified
        full_match = match.group(0)
        body = match.group(1)
        
        # Extract id
        # Try numeric id first (id: 2)
        id_match = re.search(r'\bid:\s*(\d+)', body)
        if id_match:
            q_id = id_match.group(1)
        else:
            # Try UUID id (id: "uuid")
            id_match = re.search(r'\bid:\s*"([^"]+)"', body)
            if id_match:
                q_id = id_match.group(1)
            else:
                return full_match
        
        # Look up categorization
        cat = cat_map.get(str(q_id))
        if not cat:
            return full_match
        
        # Extract current values
        current_section = re.search(r'section:\s*"([^"]+)"', body)
        current_domain = re.search(r'domain:\s*(?:"([^"]+)"|null)', body)
        current_skill = re.search(r'skill:\s*(?:"([^"]+)"|null)', body)
        current_difficulty = re.search(r'difficulty:\s*(?:"([^"]+)"|null)', body)
        current_rationale = re.search(r'rationale:\s*(?:"([^"]+)"|null)', body)
        
        current_section_val = current_section.group(1) if current_section else None
        current_domain_val = current_domain.group(1) if current_domain and current_domain.group(1) else None
        current_skill_val = current_skill.group(1) if current_skill and current_skill.group(1) else None
        current_difficulty_val = current_difficulty.group(1) if current_difficulty and current_difficulty.group(1) else None
        current_rationale_val = current_rationale.group(1) if current_rationale and current_rationale.group(1) else None
        
        needs_update = False
        new_body = body
        
        # Check and update section
        if cat['section'] and current_section_val != cat['section']:
            new_body = re.sub(r'section:\s*"[^"]*"', f'section: "{cat["section"]}"', new_body)
            needs_update = True
            changes.append(f"ID {q_id}: section {current_section_val} -> {cat['section']}")
        
        # Check and update domain
        target_domain = f'"{cat["domain"]}"' if cat['domain'] else 'null'
        current_domain_str = f'"{current_domain_val}"' if current_domain_val else 'null'
        if current_domain_str != target_domain:
            new_body = re.sub(r'domain:\s*(?:"[^"]*"|null)', f'domain: {target_domain}', new_body)
            needs_update = True
            changes.append(f"ID {q_id}: domain {current_domain_val} -> {cat['domain']}")
        
        # Check and update skill
        target_skill = f'"{cat["skill"]}"' if cat['skill'] else 'null'
        current_skill_str = f'"{current_skill_val}"' if current_skill_val else 'null'
        if current_skill_str != target_skill:
            new_body = re.sub(r'skill:\s*(?:"[^"]*"|null)', f'skill: {target_skill}', new_body)
            needs_update = True
            changes.append(f"ID {q_id}: skill {current_skill_val} -> {cat['skill']}")
        
        # Check and update difficulty
        target_difficulty = f'"{cat["difficulty"]}"' if cat['difficulty'] else 'null'
        current_difficulty_str = f'"{current_difficulty_val}"' if current_difficulty_val else 'null'
        if current_difficulty_str != target_difficulty:
            new_body = re.sub(r'difficulty:\s*(?:"[^"]*"|null)', f'difficulty: {target_difficulty}', new_body)
            needs_update = True
        
        # Check and update rationale
        target_rationale = f'"{cat["rationale"]}"' if cat['rationale'] else 'null'
        current_rationale_str = f'"{current_rationale_val}"' if current_rationale_val else 'null'
        if current_rationale_str != target_rationale:
            new_body = re.sub(r'rationale:\s*(?:"[^"]*"|null)', f'rationale: {target_rationale}', new_body)
            needs_update = True
        
        if needs_update:
            modified = True
            suffix = ',' if full_match.strip().endswith(',') else ''
            return f'  {{{new_body}  }}{suffix}'
        
        return full_match
    
    new_content = pattern.sub(replacer, content)
    
    if modified:
        with open(ALL_QUESTIONS_PATH, 'w', encoding='utf-8') as f:
            f.write(new_content)
    
    return modified, changes

def main():
    print("Building categorization map from module files...")
    cat_map = build_categorization_map()
    print(f"Found {len(cat_map)} question categorizations.")
    
    print("\nSyncing all_questions.ts...")
    modified, changes = sync_all_questions_ts(cat_map)
    
    if modified:
        print(f"Updated all_questions.ts with {len(changes)} changes.")
        if changes and len(changes) <= 50:
            print("\nChanges:")
            for change in changes[:50]:
                print(f"  {change}")
            if len(changes) > 50:
                print(f"  ... and {len(changes) - 50} more")
    else:
        print("No changes needed - categorization already synced!")

if __name__ == "__main__":
    main()
