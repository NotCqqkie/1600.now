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

def escape_for_ts(text):
    """Properly escape text for TypeScript string."""
    if text is None:
        return None
    # Order matters: backslash first, then others
    text = str(text)
    text = text.replace('\\', '\\\\')  # Escape backslashes
    text = text.replace('"', '\\"')    # Escape quotes
    text = text.replace('\n', '\\n')   # Escape newlines
    text = text.replace('\r', '\\r')   # Escape carriage returns
    text = text.replace('\t', '\\t')   # Escape tabs
    return text

def rebuild_all_questions_ts():
    """Rebuild all_questions.ts from module files."""
    
    # Read current file to get header
    with open(ALL_QUESTIONS_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract header (everything before 'export const questions')
    match = re.search(r'(.*?)(export const questions: Question\[\] = \[)', content, re.DOTALL)
    if not match:
        print("Error: Could not find header in all_questions.ts")
        return False
    
    header = match.group(1) + match.group(2)
    
    # Collect all questions from modules
    all_questions = []
    json_files = sorted(glob.glob(str(MODULES_DIR / "*.json")))
    
    for filepath in json_files:
        with open(filepath, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except:
                continue
        
        if not isinstance(data, list):
            continue
        
        for q in data:
            if isinstance(q, dict) and q.get('id'):
                all_questions.append(q)
    
    print(f"Collected {len(all_questions)} questions from {len(json_files)} modules")
    
    # Build TypeScript content
    lines = [header + "\n"]
    
    for i, q in enumerate(all_questions):
        lines.append("  {")
        
        # Add fields in order
        if 'section' in q:
            lines.append(f'    section: "{escape_for_ts(q["section"])}",')
        if 'domain' in q:
            val = q['domain']
            lines.append(f'    domain: {f"{chr(34)}{escape_for_ts(val)}{chr(34)}" if val else "null"},')
        if 'skill' in q:
            val = q['skill']
            lines.append(f'    skill: {f"{chr(34)}{escape_for_ts(val)}{chr(34)}" if val else "null"},')
        if 'difficulty' in q:
            val = q['difficulty']
            lines.append(f'    difficulty: {f"{chr(34)}{escape_for_ts(val)}{chr(34)}" if val else "null"},')
        if 'rationale' in q:
            val = q['rationale']
            lines.append(f'    rationale: {f"{chr(34)}{escape_for_ts(val)}{chr(34)}" if val else "null"},')
        
        # ID
        q_id = q['id']
        if isinstance(q_id, str):
            lines.append(f'    id: "{q_id}",')
        else:
            lines.append(f'    id: {q_id},')
        
        # Test name
        if 'test_name' in q:
            lines.append(f'    testName: "{escape_for_ts(q["test_name"])}",')
        
        # Text (from passage or question_text)
        text = q.get('passage') or q.get('question_text') or ''
        lines.append(f'    text: "{escape_for_ts(text)}",')
        
        # Choices
        choices = q.get('choices', [])
        if choices:
            lines.append("    choices: [")
            for choice in choices:
                choice_id = choice.get('label') or choice.get('id', '')
                choice_text = choice.get('text', '')
                choice_img = choice.get('image')
                
                if choice_img:
                    lines.append(f'      {{ id: "{choice_id}", image: "{escape_for_ts(choice_img)}" }},')
                else:
                    lines.append(f'      {{ id: "{choice_id}", text: "{escape_for_ts(choice_text)}" }},')
            lines.append("    ],")
        else:
            lines.append("    choices: [],")
        
        # Correct answer
        ans = q.get('correct_answer', '')
        lines.append(f'    correctAnswer: "{escape_for_ts(ans)}",')
        
        # Type
        q_type = "free-response" if q.get('is_fill_in_blank') else "multiple-choice"
        lines.append(f'    type: "{q_type}",')
        
        # Category (if exists)
        if 'category' in q and q['category']:
            cat = q['category']
            lines.append('    category: {')
            if 'subject' in cat:
                lines.append(f'      "subject": "{cat["subject"]}",')
            if 'domain' in cat:
                lines.append(f'      "domain": "{cat["domain"]}",')
            if 'skill' in cat:
                lines.append(f'      "skill": "{cat["skill"]}",')
            if 'confidence' in cat:
                lines.append(f'      "confidence": "{cat["confidence"]}"')
            lines.append("    },")
        
        # Close object
        if i < len(all_questions) - 1:
            lines.append("  },")
        else:
            lines.append("  }")
    
    lines.append("];")
    
    # Write file
    with open(ALL_QUESTIONS_PATH, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    
    print(f"Successfully rebuilt all_questions.ts with {len(all_questions)} questions")
    return True

if __name__ == "__main__":
    rebuild_all_questions_ts()
