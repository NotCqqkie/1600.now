import json
import re

def fix_latex_spacing(text):
    if not text:
        return text

    # 1. Separate Equation from following text
    # Break if $eq$ is followed by Capital Letter.
    text = re.sub(r'(\$[^\$]+=[^\$]+\$)\s+(?=[A-Z])', r'\1\n', text)
    
    # Break if Text ends with . and followed by $eq$ (display style?)
    text = re.sub(r'([a-z]\.)\s+(?=\$[^$]+=[^$]+\$)', r'\1\n', text)
    
    # Break between two display style equations
    text = re.sub(r'(\$[^\$]+=[^\$]+\$)\s+(?=\$[^$]+=[^$]+\$)', r'\1\n', text)

    return text

def fix_missing_latex(text):
    if not text:
        return text
    
    parts = text.split('$')
    new_parts = []
    
    for i, part in enumerate(parts):
        if i % 2 == 1:
            # This is Latex, keep it
            new_parts.append(part)
        else:
            # This is Text. Look for unformatted equations.
            p1 = r'(?:\b-?\d+(?:\.\d+)?)\s*[x-z]\s*[+\-]\s*(?:-?\d+(?:\.\d+)?)\s*[x-z]?\s*=\s*(?:-?\d+(?:\.\d+)?(?:\([^\)]+\))?|-?\d+(?:\.\d+)?)'
            p2 = r'\b-?\d+(?:\.\d+)?\s*[x-z]\s*=\s*-?\d+(?:\.\d+)?\b'
            combined_pattern = f"{p1}|{p2}"
            
            def wrap_match(m):
                return f"${m.group(0)}$"

            part = re.sub(combined_pattern, wrap_match, part, flags=re.IGNORECASE)
            new_parts.append(part)
            
    return '$'.join(new_parts)

def process_file(filepath):
    print(f"Reading {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    count = 0
    modifications = []

    for q in data:
        if 'passage' in q and q['passage']:
            original = q['passage']
            
            # Step 1: Detect and wrap missing latex
            modified = fix_missing_latex(original)
            
            # Step 2: Fix spacing/newlines
            modified = fix_latex_spacing(modified)
            
            if original != modified:
                q['passage'] = modified
                count += 1
                
                modifications.append({
                    'id': q.get('id'),
                    'original': original,
                    'modified': modified,
                    'is_11': (q.get('question_number') == 11)
                })

    print(f"Total modified: {count}")

    print("\n--- Example Modifications ---")
    for mod in modifications[:10]:
         print(f"--- Q {mod['id']} ---")
         print("OLD:", mod['original'])
         print("NEW:", mod['modified'])
         print("-" * 20)
    
    print("\n--- Question 11 Modifications ---")
    found_11 = False
    for mod in modifications:
        if mod['is_11']:
            print(f"--- Q {mod['id']} ---")
            print("OLD:", mod['original'])
            print("NEW:", mod['modified'])
            print("-" * 20)
            found_11 = True
    
    if not found_11:
        print("No Question 11s were modified.")

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

if __name__ == "__main__":
    process_file(r"c:\Users\303da\Documents\GitHub\1600-prep-hub\src\data\questions.json")
