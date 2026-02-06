import re
import os

file_path = r'src/data/questions.ts'

if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
    exit(1)

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Look for asterisks not part of standard things (like imports or comments logic if any)
# But mostly just strictly look for *word* patterns.

pattern = r'\*([^\s\*]+)\*'
matches = re.finditer(pattern, content)

print(f"Inspecting {file_path} for single-word italics *word*...")

count = 0
for m in matches:
    count += 1
    # Check context around it
    start = max(0, m.start() - 20)
    end = min(len(content), m.end() + 20)
    context = content[start:end].replace('\n', ' ')
    print(f"Match: {m.group(0)} | Context: ...{context}...")

print(f"Total matches: {count}")

# Check for multi-word italics too, just in case
pattern_multi = r'\*([^\*]+)\*'
matches_multi = re.finditer(pattern_multi, content)
print("\nMulti-word Check (First 10):")
c = 0
for m in matches_multi:
    # Filter out the single word ones we just saw
    if ' ' in m.group(1):
        c += 1
        start = max(0, m.start() - 20)
        end = min(len(content), m.end() + 20)
        context = content[start:end].replace('\n', ' ')
        print(f"Match: {m.group(0)} | Context: ...{context}...")
        if c >= 10: break
