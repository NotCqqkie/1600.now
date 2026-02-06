from pathlib import Path
import json, sys

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "raw" / "high_words.json"

if DATA_PATH.exists():
    with DATA_PATH.open('r', encoding='utf-8') as f:
        try:
            data = json.load(f)
        except Exception:
            data = []
else:
    data = []

text = sys.stdin.read()
for line in text.splitlines():
    if '...syn' in line:
        word=line.split('...syn')[0].strip()
        if word:
            data.append(word)

# Ensure target directory exists before writing
DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
with DATA_PATH.open('w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print('stored', len(data))
