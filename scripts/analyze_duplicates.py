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
        parts.append(normalize_text(q['passage']))
    
    # Question text
    if q.get('question_text'):
        parts.append(normalize_text(q['question_text']))
        
    # Choices
    choices = q.get('choices', [])
    if choices:
        # Sort choices by label to ensure order doesn't matter? 
        # Or usually A,B,C,D. Let's just normalize text.
        for c in choices:
            parts.append(normalize_text(c.get('text', '')))
            
    return "\n".join(parts)

def main():
    with open(r'c:\Users\303da\Documents\GitHub\1600-prep-hub\src\data\questions.json', 'r', encoding='utf-8') as f:
        questions = json.load(f)
        
    print(f"Total questions: {len(questions)}")
    
    hashes = collections.defaultdict(list)
    
    for i, q in enumerate(questions):
        norm = normalize_question(q)
        if not norm: # Empty?
            continue
        hashes[norm].append(i)
        
    duplicates = {k: v for k, v in hashes.items() if len(v) > 1}
    
    print(f"Found {len(duplicates)} groups of potential duplicates (normalized same text).")
    
    # Analyze a few
    count = 0
    for k, idxs in duplicates.items():
        if count >= 10: break
        print(f"\nGroup {count+1}: {len(idxs)} items")
        
        test_names = []
        ids = []
        for idx in idxs:
            q = questions[idx]
            test_names.append(q.get('test_name', 'Unknown'))
            ids.append(q.get('id'))
            
        unique_tests = set(test_names)
        print(f"  Distinct Tests: {len(unique_tests)}")
        if len(unique_tests) == 1:
            print(f"  ALL FROM SAME TEST: {test_names[0]}")
        else:
            print(f"  Tests: {unique_tests}")
            
        print(f"  IDs: {ids}")
        print(f"  Text: {k[:100]}...")
        count += 1

if __name__ == "__main__":
    main()
