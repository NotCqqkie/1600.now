#!/usr/bin/env python3
"""Export unofficialQuestions.ts to a JSON file usable by run_stage.py.

Also merges image references from unofficialQuestionImageMap.ts.
Images live at: public/images/SAT-Style Questions/<id>_q_01.png

Usage:
    python scripts/export_unofficial_bank.py --out /tmp/unofficial_questions.json
"""
import argparse
import json
import os
import re
from pathlib import Path

IMAGE_ROOTS = [
    Path("public/images/SAT-Style Questions"),
    Path(".claude/worktrees/sweet-yonath/public/images/SAT-Style Questions"),
]


def fix_backslashes(s: str) -> str:
    out, i, n = [], 0, len(s)
    while i < n:
        c = s[i]
        if c == '\\' and i + 1 < n:
            nxt = s[i + 1]
            if nxt in '"\\/bfnrtu':
                out.append(s[i:i + 2]); i += 2; continue
            if nxt == 'u' and i + 5 < n:
                out.append(s[i:i + 6]); i += 6; continue
            out.append('\\\\'); i += 1; continue
        out.append(c); i += 1
    return ''.join(out)


def parse_ts_array(path: Path) -> list:
    content = path.read_text()
    start = content.index('= [') + 2
    end = content.rindex(']') + 1
    return json.loads(fix_backslashes(content[start:end]))


def parse_image_map(path: Path) -> dict[str, list[str]]:
    """Returns {question_id: [resolved_abs_path, ...]}"""
    content = path.read_text()
    result: dict[str, list[str]] = {}
    for m in re.finditer(
        r'"([0-9a-f]{8})":\s*\{[^{}]*?"questionImages":\s*\[(.*?)\]',
        content, re.S
    ):
        qid = m.group(1)
        srcs = re.findall(r'"src":\s*"([^"]+)"', m.group(2))
        resolved = []
        for src in srcs:
            name = os.path.basename(src)
            for root in IMAGE_ROOTS:
                p = root / name
                if p.exists():
                    resolved.append(str(p.resolve()))
                    break
        if len(resolved) == len(srcs):
            result[qid] = resolved
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--unofficial-ts", default="src/data/unofficialQuestions.ts")
    ap.add_argument("--image-map-ts", default="src/data/unofficialQuestionImageMap.ts")
    args = ap.parse_args()

    print("Parsing unofficialQuestions.ts...", flush=True)
    questions = parse_ts_array(Path(args.unofficial_ts))
    print(f"  {len(questions)} questions", flush=True)

    print("Parsing image map...", flush=True)
    img_map = parse_image_map(Path(args.image_map_ts))
    print(f"  {len(img_map)} questions with resolved images", flush=True)

    # Enrich questions with images field
    enriched = 0
    for q in questions:
        qid = str(q["id"])
        if qid in img_map:
            q["images"] = [{"local": os.path.basename(p)} for p in img_map[qid]]
            enriched += 1

    print(f"  {enriched} questions enriched with images", flush=True)

    Path(args.out).write_text(json.dumps(questions, indent=2))
    print(f"Written to {args.out}", flush=True)


if __name__ == "__main__":
    main()
