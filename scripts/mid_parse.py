from pathlib import Path
import sys, json

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "raw" / "mid_words.json"

data = sys.stdin.read()
trans = {0x2019:"'", 0x201c:'"', 0x201d:'"', 0x2013:'-', 0x2014:'-', 0x0060:"'", 0x2026:'...'}
existing = []
if DATA_PATH.exists():
    with DATA_PATH.open('r', encoding='utf-8') as f:
        existing = json.load(f)
words = {w['word'].lower(): w for w in existing}
for line in data.splitlines():
    line = line.strip()
    if not line or line.lower().startswith('lesson'):
        continue
    if '...syn' not in line:
        continue
    head, tail = line.split('...syn', 1)
    word = head.strip()
    rest = tail
    if ':' in rest:
        rest = rest.split(':', 1)[1]
    rest = rest.strip()
        definition = rest.translate(trans)
        if word:
            words[word.lower()] = {'word': word, 'definition': definition}

# Ensure target directory exists before writing
DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
with DATA_PATH.open('w', encoding='utf-8') as f:
    json.dump(list(words.values()), f, ensure_ascii=False, indent=2)
print('stored', len(words))
