from __future__ import annotations
import json
import re
from pathlib import Path


def normalize_for_hash(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def load_existing_hashes(data_dir: Path) -> set[str]:
    hashes = set()
    for fname in ["math_past.json", "reading_past.json"]:
        path = data_dir / fname
        if not path.exists():
            continue
        questions = json.loads(path.read_text())
        for q in questions:
            h = normalize_for_hash(q.get("text", ""))
            if h:
                hashes.add(h)
    return hashes


def find_duplicates(new_questions: list[dict], existing_hashes: set[str]) -> list[dict]:
    dupes = []
    for q in new_questions:
        h = normalize_for_hash(q.get("text", ""))
        if h and h in existing_hashes:
            dupes.append(q)
    return dupes
