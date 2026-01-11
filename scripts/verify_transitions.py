
import json
from pathlib import Path

WORKSPACE_ROOT = Path("c:/Users/303da/Documents/GitHub/1600-prep-hub")
QUESTIONS_JSON = WORKSPACE_ROOT / "src/data/questions.json"
OUTPUT_MAP = WORKSPACE_ROOT / "src/data/category_map.json"

with open(OUTPUT_MAP, "r", encoding="utf-8") as f:
    category_map = json.load(f)

# Find "Transitions"
transitions_ids = []
# The map structure: { subject: { domain: { skill: [ids...] } } }
# Or maybe lists? The script suggests:
# categories = [{subject, domain, skill}, ...]
# But the output map structure depends on how it was saved.
# Let's assume the map keys are flattened or hierarchical.
# Checking categorize_questions_rules.py output format would be better, but I'll inspecting the loaded json.

def find_transitions(data):
    if isinstance(data, dict):
        for k, v in data.items():
            if k == "Transitions":
                return v
            elif isinstance(v, (dict, list)):
                res = find_transitions(v)
                if res: return res
    return None

# Actually let's just inspect the structure by printing keys
# But first let's try to locate the IDs.

with open(QUESTIONS_JSON, "r", encoding="utf-8") as f:
    questions = json.load(f)
    q_lookup = {q["id"]: q for q in questions}

# Let's traverse the map to find IDs for 'Transitions'
# Based on common patterns in this project, likely structure: {"Math": { "Algebra": { "Linear Equations": ["id1", "id2"] } } }

transitions_ids = []
if "English" in category_map:
    if "Expression of Ideas" in category_map["English"]:
        if "Transitions" in category_map["English"]["Expression of Ideas"]:
             transitions_ids = category_map["English"]["Expression of Ideas"]["Transitions"]

if not transitions_ids:
    print("Could not find Transitions category in map.")
    # key dump
    print(json.dumps(category_map, indent=2)[:500])
else:
    print(f"Found {len(transitions_ids)} transition questions.")
    for i, qid in enumerate(transitions_ids[:30]):
        q = q_lookup.get(qid)
        if q:
            print(f"\n--- Question {i+1} ---")
            print(f"Passage: {q.get('passage', '')[:100]}...")
            print(f"Choices: {[c.get('text') for c in q.get('choices', [])]}")
