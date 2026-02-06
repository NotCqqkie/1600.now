import re
import sys

def analyze_questions(file_path):
    print(f"Reading {file_path}...")
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    token_pattern = re.compile(r'(id:\s*"?[\w\d]+"?)|(text:\s*"((?:[^"\\]|\\.)*)")')
    current_question_id = "Unknown"
    questions_using_8_slash = []
    questions_using_4_slash = []
    issues = []
    
    # Store found texts count
    found_count = 0

    for match in token_pattern.finditer(content):
        full_str = match.group(0)
        
        if full_str.startswith("id:"):
            parts = full_str.split(":")
            val = parts[1].strip().strip('"\'') 
            if val.isdigit():
                current_question_id = val

        elif full_str.startswith("text:"):
            found_count += 1
            val = match.group(3)
            if val is None: continue 

            line_num = content.count('\n', 0, match.start()) + 1
            
            val_no_esc_bs = val.replace('\\\\', '__')
            dollars = [m.start() for m in re.finditer(r'(?<!\\)\$', val_no_esc_bs)]
            if len(dollars) % 2 != 0:
                issues.append({
                    'id': current_question_id,
                    'line': line_num,
                    'issue': f"Unbalanced '$' delimiters (found {len(dollars)}).",
                    'snippet': val[:60]
                })

            if '\\\\\\\\' in val:
                questions_using_8_slash.append(current_question_id)
            elif '\\\\\\' in val:
                issues.append({
                    'id': current_question_id,
                    'line': line_num,
                    'issue': "Odd number of backslashes (6) sequence found.",
                    'snippet': val[:60]
                })
            elif '\\\\' in val:
                questions_using_4_slash.append(current_question_id)

            val_clean = val.replace('\\\\', '') 
            
            suspicious_map = {
                'f': 'Form Feed (\\f) - likely \\frac?',
                'b': 'Backspace (\\b) - likely \\beta?',
                't': 'Tab (\\t) - likely \\tan or \\theta?',
                'v': 'Vertical Tab (\\v)',
                'r': 'Carriage Return',
            }
            
            escapes = re.findall(r'\\(.)', val_clean)
            for esc in escapes:
                if esc in suspicious_map:
                    issues.append({
                        'id': current_question_id,
                        'line': line_num,
                        'issue': f"Suspicious escape: \\{esc} -> {suspicious_map[esc]}",
                        'snippet': val[:60]
                    })

            if '\ufffd' in val:
                issues.append({
                    'id': current_question_id,
                    'line': line_num,
                    'issue': "Contains replacement character.",
                    'snippet': val[:60]
                })

            if re.search(r'\\[ \t]', val_clean):
                 issues.append({
                    'id': current_question_id,
                    'line': line_num,
                    'issue': "Backslash followed by whitespace (broken command or escape?).",
                    'snippet': val[:60]
                })
            
            if re.search(r'\\\\[ \t]', val):
                 issues.append({
                    'id': current_question_id,
                    'line': line_num,
                    'issue': "Double backslash followed by whitespace.",
                    'snippet': val[:60]
                })

    q_8 = sorted(list(set(questions_using_8_slash)), key=lambda x: int(x) if x.isdigit() else 9999)
    q_4 = sorted(list(set(questions_using_4_slash)), key=lambda x: int(x) if x.isdigit() else 9999)

    print(f"Reviewed {found_count} text fragments.")
    print("\n--- Issues Found ---")
    if not issues:
        print("No specific formatting errors found.")
    else:
        for i in issues:
            print(f"Question {i['id']} (Line {i['line']}): {i['issue']}\n  Snippet: \"{i['snippet']}...\"")

    print("\n--- Backslash Style Report ---")
    print(f"Questions using 8-backslash style (\\\\\\\\) [{len(q_8)}]:")
    print(", ".join(q_8))
    
    print(f"\nQuestions using 4-backslash style (\\\\) [{len(q_4)}]:")
    print(", ".join(q_4))

if __name__ == "__main__":
    analyze_questions(r'c:\Users\303da\Documents\GitHub\1600-prep-hub\src\data\questions.ts')
