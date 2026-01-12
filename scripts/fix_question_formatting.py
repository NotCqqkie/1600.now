
import json
import re

def fix_latex_spacing(text):
    if not text:
        return text

    # Apply fixes
    
    # 1. Separate Equation from following text
    
    # Heuristic 1: Add newline after display-style equation.
    # An equation is likely "display style" if it contains an equals sign "=" 
    # and isn't just a variable reference like "$x$".
    
    # Case: $eq$Text -> $eq$\nText
    # Only if Text starts with Capital letter?
    text = re.sub(r'(\$[^\$]+=[^\$]+\$)\s*([A-Z])', r'\1\n\2', text)
    
    # Case: Text$eq$ -> Text\n$eq$
    # If Text ends with . or we are strictly enforcing newlines
    text = re.sub(r'([a-z]\.)\s*(\$[^\$]+=[^\$]+\$)', r'\1\n\2', text)
    
    # Case: multiple equations $eq1$ $eq2$ -> $eq1$\n$eq2$
    text = re.sub(r'(\$[^\$]+=[^\$]+\$)\s+(\$[^\$]+=[^\$]+\$)', r'\1\n\2', text)

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
            
            # Sub-function to wrap match
            def wrap_match(m):
                # Ensure we don't double wrap if something weird happens
                return f"${m.group(0)}$"

            # 1. Linear eq: Ax + By = C (and similar)
            # Use stricter number pattern: \d+(?:\.\d+)?
            # Allow optional space around ops
            # Allow optional parens on RHS
            
            # Regex Explanation:
            # (?:\b-?\d+(?:\.\d+)?)\s*[x-z]  -> Number followed by x-z
            # \s*[+\-]\s*                   -> Operator
            # (?:-?\d+(?:\.\d+)?)\s*[x-z]?  -> Number followed by optional x-z
            # \s*=\s*                       -> Equals
            # (?:...)                       -> RHS (Number or Number(Expression))
            
            p1 = r'(?:\b-?\d+(?:\.\d+)?)\s*[x-z]\s*[+\-]\s*(?:-?\d+(?:\.\d+)?)\s*[x-z]?\s*=\s*(?:-?\d+(?:\.\d+)?(?:\([^\)]+\))?|-?\d+(?:\.\d+)?)'
            
            part = re.sub(p1, wrap_match, part, flags=re.IGNORECASE)
            
            # 2. Simple equality: 11x=50
            p2 = r'\b-?\d+(?:\.\d+)?\s*[x-z]\s*=\s*-?\d+(?:\.\d+)?\b'
            part = re.sub(p2, wrap_match, part, flags=re.IGNORECASE)

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
                
                # Store modification for review
                modifications.append({
                    'id': q.get('id'),
                    'original': original,
                    'modified': modified
                })

    print(f"Total modified: {count}")

    # Print a few examples of modifications
    print("\n--- Example Modifications ---")
    for mod in modifications[:10]:
         print(f"--- Q {mod['id']} ---")
         print("OLD:", mod['original'])
         print("NEW:", mod['modified'])
         print("-" * 20)

    # Print specific Q11 checks if modified
    print("\n--- Question 11 Modifications ---")
    found_11 = False
    for mod in modifications:
        if "_11" in str(mod['id']):
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
