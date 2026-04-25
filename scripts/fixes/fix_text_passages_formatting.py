import json
import re
import os

def format_questions(file_path):
    print(f"Processing {file_path}...")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    modified_count = 0
    
    # Regex patterns
    # Text 1 header: Preceded by start or punctuation, followed by Capital letter
    # We want to replace it with: \1\nText 1\n
    # Note: we kept the punctuation in \1. We assume \s+ matches the spaces we want to remove.
    p1 = re.compile(r'(^|(?<=[.?!:"]))\s+Text 1\s+(?=[A-Z"\'“])')
    
    # Text 2 header: Same but we want \n\n before it.
    p2 = re.compile(r'(^|(?<=[.?!:"]))\s+Text 2\s+(?=[A-Z"\'“])')

    for item in data:
        if 'passage' in item and item['passage']:
            original_passage = item['passage']
            
            # Check if it has Text 1 and Text 2 to avoid unnecessary processing
            if "Text 1" not in original_passage or "Text 2" not in original_passage:
                continue
                
            new_passage = original_passage
            
            # Apply Text 1 formatting
            # We use a lambda or function to handle the replacement string dynamically if needed, 
            # but simple backreference should work.
            # However, looking at the regex:
            # (^|(?<=[.?!:"])) is a lookbehind or start match. 
            # Wait, Python re lookbehind (?<=...) must be fixed width. '[.?!:"]' is fixed width 1.
            # But (^|...) is variable width? No, ^ is zero width.
            # Actually pattern `(^|(?<=[.?!:"]))\s+Text 1`
            # Mixing ^ and lookbehind might be tricky in one group if not supported.
            # Let's split or just use a capturing group for the preceding character if it exists.
            
            # Robust matching:
            # We want to match: [Boundary/Punctuation] [Spaces] "Text 1" [Spaces] [Lookahead Capital]
            
            # Let's simple capture the punctuation if present.
            # But if it's start of string, there is no punctuation.
            
            # Alternative Pattern:
            # Match literal "Text 1" and check context in callback.
            
            def replace_text1(match):
                # match.group(0) is the whole match including preceding spaces if we matched them?
                # Let's verify what we match.
                
                # We want to ensure we don't match "(Text 1)"
                start, end = match.span()
                prev_char = new_passage[start-1] if start > 0 else ""
                
                # If preceded by (, ignore
                if prev_char == '(':
                    return match.group(0)
                
                # If preceded by alphanumeric (e.g. "Reference Text 1"), ignore?
                # Usually header is sentence start.
                
                return "\nText 1\n"

            # Simpler approach assuming standard structure:
            # "Text 1" is a header if matched by `\sText 1\s` and followed by Caps.
            # And preceded by `.` `?` `!` or Start.
            
            # pattern = r'(?:^|(?<=[.?!:"]))\s+Text 1\s+(?=[A-Z])'
            # Python lookbehind must be fixed width. (?<=a|b) works if a and b same length.
            # (?<=^|.) is not allowed if ^ matches 0 width.
            
            # So let's match the punctuation in a group.
            # r'([.?!:"]|^)\s+Text 1\s+(?=[A-Z"\'“])'
            # This captures the punctuation in group 1.
            
            new_passage = re.sub(r'([.?!:"])\s+Text 1\s+(?=[A-Z"\'“])', r'\1\nText 1\n', new_passage)
            new_passage = re.sub(r'^\s*Text 1\s+(?=[A-Z"\'“])', r'Text 1\n', new_passage) # Start of string case
            
            # For Text 2 (Double newline before)
            new_passage = re.sub(r'([.?!:"])\s+Text 2\s+(?=[A-Z"\'“])', r'\1\n\nText 2\n', new_passage)
            new_passage = re.sub(r'^\s*Text 2\s+(?=[A-Z"\'“])', r'\n\nText 2\n', new_passage) # Start of string?? Unlikely for Text 2 but safe.

            if new_passage != original_passage:
                item['passage'] = new_passage
                modified_count += 1

    print(f"Modified {modified_count} questions.")
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    format_questions(r"c:\Users\303da\Documents\GitHub\1600-prep-hub\src\data\questions.json")
