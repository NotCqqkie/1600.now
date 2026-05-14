#!/usr/bin/env python3
"""Apply double-pass confirmed fixes to unofficialQuestions.ts."""

import json
import re
import sys
from pathlib import Path

ROOT = Path("/Users/lukefinigan/Documents/1600-prep-hub")
SRC  = ROOT / "src/data/unofficialQuestions.ts"
CONFIRMED = ROOT / "scripts/_data/fix_proposals/actionable_confirmed.json"

raw = SRC.read_text()
header_end = raw.index("= [") + 2
footer_start = raw.rindex("]") + 1
header = raw[:header_end]
footer = raw[footer_start:]
arr_text = re.sub(r",\s*([\]}])", r"\1", raw[header_end:footer_start])
questions = json.loads(arr_text)

confirmed = json.load(open(CONFIRMED))

# Build uuid-prefix → question index map
uuid_map = {}
for i, q in enumerate(questions):
    uid = q.get("id", "")
    if uid:
        uuid_map[uid[:8]] = i

changes = 0

# ── Duplicate choices ─────────────────────────────────────────────────────────
for fix in confirmed.get("duplicate_choices", []):
    if fix.get("verdict") != "APPLY":
        continue
    uid = fix["id"][:8]
    idx = uuid_map.get(uid)
    if idx is None:
        print(f"[WARN] uuid not found: {uid}", file=sys.stderr)
        continue
    q = questions[idx]
    for choice_id, new_text in (fix.get("fixes") or {}).items():
        for c in q.get("choices", []):
            if c.get("id") == choice_id:
                print(f"  dup_fix  {uid} choice {choice_id}: {c.get('text','')!r} → {new_text!r}")
                c["text"] = new_text
                changes += 1

# ── Spoken math (text field) ──────────────────────────────────────────────────
for fix in confirmed.get("spoken_math", []):
    if fix.get("verdict") != "APPLY":
        continue
    uid = fix["id"][:8]
    idx = uuid_map.get(uid)
    if idx is None:
        print(f"[WARN] uuid not found: {uid}", file=sys.stderr)
        continue
    field = fix.get("field", "text")
    proposed = fix.get("proposed", "")
    q = questions[idx]
    if field == "text":
        print(f"  spoken   {uid} text: {q.get('text','')[:60]!r} →")
        print(f"           {proposed[:60]!r}")
        q["text"] = proposed
        changes += 1
    elif field.startswith("choice_"):
        choice_id = field.split("_", 1)[1].upper()
        for c in q.get("choices", []):
            if c.get("id") == choice_id:
                print(f"  spoken   {uid} choice {choice_id}: {c.get('text','')!r} → {proposed!r}")
                c["text"] = proposed
                changes += 1

# ── Mixed choice format ───────────────────────────────────────────────────────
for fix in confirmed.get("mixed_choice_format", []):
    if fix.get("verdict") not in ("APPLY",):
        continue
    uid = fix["id"][:8]
    idx = uuid_map.get(uid)
    if idx is None:
        print(f"[WARN] uuid not found: {uid}", file=sys.stderr)
        continue
    q = questions[idx]
    for choice_id, new_text in (fix.get("proposed_choice_fixes") or {}).items():
        for c in q.get("choices", []):
            if c.get("id") == choice_id:
                print(f"  mixed    {uid} choice {choice_id}: {c.get('text','')!r} → {new_text!r}")
                c["text"] = new_text
                changes += 1

print(f"\nTotal field changes: {changes}", file=sys.stderr)

# Serialize back — match existing 2-space indent, double-quoted keys
serialized = json.dumps(questions, indent=2, ensure_ascii=False)
# json.dumps uses double quotes by default — matches existing TS file
new_content = header + serialized + footer
SRC.write_text(new_content)
print(f"Written to {SRC}", file=sys.stderr)
