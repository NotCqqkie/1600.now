import json
import re

json_path = "src/data/questions.json"
test_name_pattern = "December 2024 International Form B SAT Math Module 1"

print(f"Searching for test: {test_name_pattern} in {json_path}")

try:
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    found_tests = set()
    matches = []
    
    for q in data:
        targ = q.get("test_name", "")
        if "December 2024" in targ and "International Form B" in targ and "Math" in targ:
            found_tests.add(targ)
            if targ == test_name_pattern:
                matches.append(q['question_number'])
                
    print("\nFound Tests matching broad criteria:")
    for t in sorted(list(found_tests)):
        print(f" - {t}")
        
    print(f"\nExact matches for '{test_name_pattern}': {len(matches)} questions found.")
    print(f"Question Numbers: {sorted(matches)}")

except Exception as e:
    print(e)
