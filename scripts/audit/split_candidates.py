"""Split scripts/audit/screen_reader_math_candidates.json into chunked files
for batch review by subagents.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "scripts" / "audit" / "screen_reader_math_candidates.json"
OUT_DIR = ROOT / "scripts" / "audit" / "screen_reader_chunks"
CHUNK_SIZE = 55

OUT_DIR.mkdir(exist_ok=True)
data = json.loads(SRC.read_text())
for i in range(0, len(data), CHUNK_SIZE):
    chunk = data[i:i + CHUNK_SIZE]
    out_path = OUT_DIR / f"chunk_{i // CHUNK_SIZE:02d}.json"
    out_path.write_text(json.dumps(chunk, ensure_ascii=False, indent=2) + "\n")
    print(f"Wrote {out_path.relative_to(ROOT)} ({len(chunk)} entries)")
print(f"\nTotal chunks: {(len(data) + CHUNK_SIZE - 1) // CHUNK_SIZE}")
