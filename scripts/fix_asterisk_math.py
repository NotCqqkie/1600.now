import re
import os

file_path = r'src/data/all_questions.ts'
# using absolute path for safety in script execution verified by tool use
abs_path = os.path.abspath(file_path)

if not os.path.exists(abs_path):
    print(f"File not found: {abs_path}")
    # Fallback to absolute assumption if running from root
    abs_path = os.path.join(os.getcwd(), 'src', 'data', 'all_questions.ts')
    if not os.path.exists(abs_path):
        print("Cannot find file.")
        exit(1)

print(f"Processing {abs_path}...")

with open(abs_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Blacklist of common 2-letter words that should remain text italics
blacklist = {
    'is', 'it', 'at', 'on', 'of', 'to', 'in', 'no', 'go', 'do', 
    'up', 'by', 'my', 'he', 'we', 'me', 'be', 'as', 'an', 'or', 
    'if', 'am', 'so', 'us', 'hi', 'oh', 'ok', 'id', 'Id', 'ID'
}

def replacement(match):
    text = match.group(1)
    if text.lower() in blacklist:
        return match.group(0) # Keep as *text*
    return f"${text}$"

# Regex for *word* where word is 1 or 2 alphanumeric chars
# We use [a-zA-Z0-9] to include numbers like *20* -> $20$ (valid)
pattern = r'\*([a-zA-Z0-9]{1,2})\*'

new_content, count = re.subn(pattern, replacement, content)

print(f"Replaced {count} occurrences of asterisk-italics with latex-math.")

with open(abs_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Done.")
