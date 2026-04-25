import json
import re
import collections
import os

def normalize_text(text):
    if not text:
        return ""
    # Replace integers and decimals with <NUM>
    # Handle decimals first
    text = re.sub(r'\d+\.\d+', '<NUM>', text)
    text = re.sub(r'\d+', '<NUM>', text)
    return text.strip()

def normalize_question(q):
    parts = []
    # Passage
    if q.get('passage'):
        parts.append(q['passage'])
    
    # Question text
    text = q.get('question_text') or ""
    parts.append(text)
        
    # Choices - EXCLUDED from normalization to catch MC vs Free Response duplicates
    # and duplicate prompts with mixed-up choices order.
    # choices = q.get('choices', [])
    # if choices:
    #    for c in choices:
    #        parts.append(c.get('text', ''))
            
    # Join all text
    full_text = "".join(parts)
    
    # Lowercase
    full_text = full_text.lower()
    
    # Remove all whitespace (spaces, tabs, newlines)
    full_text = re.sub(r'\s+', '', full_text)
    
    # Normalize numbers (integers and decimals) to <N>
    # Note: after removing spaces, "13less" becomes "13less". 
    # \d+ matches 13.
    # decimals: 3.14 -> <N>. careful with . being matched or not.
    # After removing spaces, "3. 14" becomes "3.14".
    full_text = re.sub(r'\d+(\.\d+)?', '<N>', full_text)
    
    # Normalize common math quirks if any (optional)
    
    return full_text

def main():
    questions_path = r'c:\Users\303da\Documents\GitHub\1600-prep-hub\src\data\questions.json'
    exclusions_path = r'c:\Users\303da\Documents\GitHub\1600-prep-hub\src\data\bank_exclusions.json'
    
    print(f"Reading {questions_path}...")
    with open(questions_path, 'r', encoding='utf-8') as f:
        questions = json.load(f)
        
    print(f"Total questions: {len(questions)}")
    
    hashes = collections.defaultdict(list)
    
    # Map normalized string to list of (index, ID)
    for i, q in enumerate(questions):
        norm = normalize_question(q)
        if not norm.strip(): 
            continue
        hashes[norm].append((i, q['id']))
        
    excluded_ids = []
    duplicate_groups = 0
    
    for norm, items in hashes.items():
        if len(items) > 1:
            duplicate_groups += 1
            # Keep the first one, exclude the rest
            # "Randomly" - first one encountered is arbitrary enough.
            # Assuming items are in order they appeared in file.
            
            # items[0] is kept.
            # items[1:] are excluded.
            for _, q_id in items[1:]:
                excluded_ids.append(q_id)
                
    print(f"Found {duplicate_groups} groups of duplicates.")
    print(f"Excluding {len(excluded_ids)} questions.")
    
    with open(exclusions_path, 'w', encoding='utf-8') as f:
        json.dump(excluded_ids, f, indent=2)
        
    print(f"Wrote exclusions to {exclusions_path}")

if __name__ == "__main__":
    main()
