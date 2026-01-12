import re

def analyze_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex to find question blocks is hard because it's nested JSON-like.
    # However, we can iterate over lines or try to extract strings.
    # But context matters (is it inside 'text': "..."?).
    
    # Let's try to extract all "text": "..." and "choices": [ ... { "text": "..." } ... ]
    # This is rough parsing.
    
    lines = content.splitlines()
    
    current_id = None
    
    for i, line in enumerate(lines):
        # valid identifying of ID
        id_match = re.search(r'id:\s*(\d+),', line)
        if id_match:
            current_id = id_match.group(1)
            
        # Check for text fields
        text_matches = re.finditer(r'text:\s*"(.*?)",', line)
        for match in text_matches:
            text_content = match.group(1)
            check_text(current_id, i+1, text_content)

def check_text(qid, line_num, text):
    # Check for HTML entities for dollar
    if '&dollar;' in text or '&#36;' in text:
        print(f"[Q{qid} L{line_num}] Found HTML dollar entity: {text}")

    # Check for LaTeX outside $...$
    # We strip out everything inside $...$ and see if any LaTeX remains.
    # Pattern for $...$: \$[^$]*\$
    # But we need to handle escaped $. 
    # Let's assume $...$ are the delimiters.
    
    # Remove math segments
    non_math_text = re.sub(r'\$.*?\$', '', text)
    
    # Check for common LaTeX commands in the remaining text
    latex_cmds = [r'\\frac', r'\\pi', r'\\sqrt', r'\^', r'_', r'\\times', r'\\le', r'\\ge', r'\\cdot']
    for cmd in latex_cmds:
        if re.search(cmd, non_math_text):
            # Exception: `\\` is used for newlines, so we shouldn't flag it unless it's a specific command
            # But cmd is specific.
            # However `^` might be used in text? Unlikely in this context.
            # `_` might be used in text? Maybe.
            print(f"[Q{qid} L{line_num}] Potential LaTeX outside $: Found '{cmd}' in '{non_math_text}'")

    # Check for {,}
    if '{,}' in non_math_text:
        print(f"[Q{qid} L{line_num}] Found comma formatting outside $: {text}")

if __name__ == "__main__":
    analyze_file(r"src\data\questions.ts")
