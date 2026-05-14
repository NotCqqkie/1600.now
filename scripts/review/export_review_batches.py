#!/usr/bin/env python3
"""Export unofficialQuestions.ts as JSON batches for Haiku review swarm.

Each batch is a small JSON array (~75 questions) with only the fields the
reviewer needs: id, section, type, text, choices, correctAnswer, rationale.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path("/Users/lukefinigan/Documents/1600-prep-hub")
SRC  = ROOT / "src/data/unofficialQuestions.ts"
OUT  = ROOT / "scripts/_data/review_batches"
OUT.mkdir(exist_ok=True)

BATCH_SIZE = 75

raw = SRC.read_text()
start = raw.index("= [") + 2
end   = raw.rindex("]") + 1
arr_text = re.sub(r",\s*([\]}])", r"\1", raw[start:end])
questions = json.loads(arr_text)
print(f"Loaded {len(questions)} questions", file=sys.stderr)

# Compute global index (1-based) and split section-aware so URLs work.
math = [(i + 1, q) for i, q in enumerate(q for q in questions if q.get("section") == "Math")]
read = [(i + 1, q) for i, q in enumerate(q for q in questions if q.get("section") == "Reading and Writing")]

def trim(q):
    out = {k: q.get(k) for k in ("id", "type", "text", "correctAnswer", "rationale")}
    if q.get("choices"):
        out["choices"] = [{"id": c.get("id"), "text": c.get("text"), "image": c.get("image")} for c in q["choices"]]
    return out

def write_batches(items, subject_slug):
    n = 0
    for batch_start in range(0, len(items), BATCH_SIZE):
        chunk = items[batch_start:batch_start + BATCH_SIZE]
        out_items = []
        for section_idx, q in chunk:
            entry = trim(q)
            entry["section_idx"] = section_idx
            entry["url"] = f"/bank/{subject_slug}/{section_idx}?bankType=unofficial"
            out_items.append(entry)
        path = OUT / f"{subject_slug}_batch_{n:03d}.json"
        path.write_text(json.dumps(out_items))
        n += 1
    return n

m_n = write_batches(math, "math")
r_n = write_batches(read, "reading")
print(f"Wrote {m_n} math batches and {r_n} reading batches to {OUT}", file=sys.stderr)
