import json
import os

def main():
    print("Script started")
    print("CWD:", os.getcwd())
    try:
        if not os.path.exists('src/data/category_map.json'):
            print("category_map.json not found")
            return
            
        with open('src/data/category_map.json', 'r', encoding='utf-8') as f:
            print("Reading map...")
            map_data = json.load(f)
            print("Map read.")
        
        with open('src/data/questions.json', 'r', encoding='utf-8') as f:
            print("Reading questions...")
            questions = json.load(f)
            print("Questions read.")
            
        q_dict = {q['id']: q for q in questions}
        
        # Sort by ID or whatever order they might naturally appear to replicate "first 26" if it's not simply the list order
        # But category_map is a dict, so order is insertion order (in modern python)
        transitions = [k for k, v in map_data.items() if v.get('skill') == 'Transitions']
        
        print(f'Found {len(transitions)} transition questions')

        suspicious_count = 0
        for i, tid in enumerate(transitions):
            q = q_dict.get(tid)
            if q:
                passage = (q.get("passage", "") or "")
                q_text = (q.get("question_text", "") or "")
                combined = (passage + " " + q_text).lower()
                
                if "most logical transition" not in combined and "logical transition" not in combined:
                    suspicious_count += 1
                    if suspicious_count <= 30:
                        print(f'\n--- Suspicious Question {suspicious_count} ---')
                        print(f'ID: {tid}')
                        print(f'Passage: {passage[:200]}...')
                        choices = [c.get("text") for c in q.get("choices", [])]
                        print(f'Choices: {choices}')
                        print(f'Question Text: {q_text}')

        print(f"Total suspicious questions found: {suspicious_count}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
