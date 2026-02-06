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

def clean_directions_text(text):
    """Remove student-produced response directions from text."""
    if not text:
        return text
    
    # Remove various patterns of directions and examples
    patterns_to_remove = [
        # Full "Student-produced response directions" block
        r'Student-produced response directions[^\n]*(?:\n•[^\n]*)*',
        # Examples block with table headers
        r'Examples\s*\n\s*Answer\s+Acceptable ways to enter answer\s+Unacceptable[^\n]*(?:\n[^\n]*(?:3\.5|7/2|31/2|3 1/2)[^\n]*)*',
        # Standalone remnants at start of line: "7/2 31/2" or "3 1/2"
        r'^(?:7/2\s+31/2|3\s+1/2)\s*\n',
        # Unacceptable format lines
        r'Unacceptable[^\n]*\n',
        # Any line that's just "7/2 31/2" or variations
        r'(?:^|\n)(?:7/2\s*31/2|31/2|3\s*1/2)(?:\n|$)',
    ]
    
    cleaned = text
    for pattern in patterns_to_remove:
        cleaned = re.sub(pattern, '', cleaned, flags=re.MULTILINE)
    
    # Clean up extra newlines and whitespace
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    cleaned = re.sub(r'^\s+', '', cleaned, flags=re.MULTILINE)  # Remove leading whitespace from each line
    cleaned = cleaned.strip()
    
    return cleaned

def clean_module_files():
    """Clean all module JSON files."""
    json_files = list(glob.glob(str(MODULES_DIR / "*.json")))
    
    fixed_count = 0
    
    for filepath in json_files:
        with open(filepath, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except:
                continue
        
        if not isinstance(data, list):
            continue
        
        modified = False
        
        for q in data:
            if not isinstance(q, dict):
                continue
            
            # Clean passage field
            if 'passage' in q and q['passage']:
                original = q['passage']
                cleaned = clean_directions_text(original)
                if cleaned != original:
                    q['passage'] = cleaned
                    modified = True
            
            # Clean question_text field
            if 'question_text' in q and q['question_text']:
                original = q['question_text']
                cleaned = clean_directions_text(original)
                if cleaned != original:
                    q['question_text'] = cleaned
                    modified = True
        
        if modified:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            fixed_count += 1
            print(f"Cleaned: {os.path.basename(filepath)}")
    
    return fixed_count

def clean_all_questions_ts():
    """Clean the all_questions.ts file."""
    with open(ALL_QUESTIONS_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find and clean text fields with directions
    def clean_text_field(match):
        field_content = match.group(1)
        
        # Unescape the content for processing (convert TS escapes to actual characters)
        # Handle \\n -> newline, \\" -> quote, \\\\ -> backslash
        unescaped = field_content.replace('\\\\n', '\n').replace('\\\\', '\x00').replace('\\"', '"').replace('\x00', '\\')
        
        # Clean the directions
        cleaned = clean_directions_text(unescaped)
        
        # Re-escape for TypeScript
        escaped = cleaned.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\\\n')
        
        return f'text: "{escaped}"'
    
    # Pattern to match text: "..." with escaped content
    pattern = r'text:\s*"((?:[^"\\]|\\.)*)"'
    
    original_content = content
    content = re.sub(pattern, clean_text_field, content)
    
    if content != original_content:
        with open(ALL_QUESTIONS_PATH, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    
    return False

def main():
    print("Cleaning student-produced response directions from module files...")
    fixed_count = clean_module_files()
    print(f"\nCleaned {fixed_count} module files.")
    
    print("\nCleaning all_questions.ts...")
    if clean_all_questions_ts():
        print("Cleaned all_questions.ts")
    else:
        print("No changes needed in all_questions.ts")

if __name__ == "__main__":
    main()
