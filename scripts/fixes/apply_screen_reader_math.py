"""Apply Haiku-confirmed screen-reader-math fixes to data files.

Reads scripts/audit/screen_reader_chunks/results_*.json (each entry has
needs_fix, original_value, corrected_value, file, question_id, field).

For each entry where needs_fix=true:
  - If file is a JSON module: parse JSON, locate the question by id (or index),
    locate the field, replace the value, save.
  - If file is unofficialQuestions.ts: do text-level replacement of the
    JSON-encoded value (precise, surgical).

This script is idempotent — applying twice is a no-op.
"""

from __future__ import annotations

import glob
import json
import re
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[2]


def load_results():
    fixes = []
    for f in sorted(glob.glob(str(ROOT / "scripts/audit/screen_reader_chunks/results_*.json"))):
        data = json.loads(Path(f).read_text(encoding="utf-8"))
        for entry in data:
            if entry.get("needs_fix") and entry.get("corrected_value") and entry.get("original_value"):
                if entry["original_value"] != entry["corrected_value"]:
                    fixes.append(entry)
    return fixes


def _matches_with_denorm(stored: str, target: str) -> bool:
    if stored == target:
        return True
    for variant in _denorm_variants(target):
        if stored == variant:
            return True
    return False


def apply_to_json_module(path: Path, entries: list[dict]) -> int:
    raw = path.read_text(encoding="utf-8")
    data = json.loads(raw)
    if not isinstance(data, list):
        print(f"  SKIP non-list JSON: {path.name}")
        return 0

    by_id = {q.get("id"): q for q in data if isinstance(q, dict)}
    applied = 0
    for entry in entries:
        qid = entry["question_id"]
        field = entry["field"]
        original = entry["original_value"]
        corrected = entry["corrected_value"]
        q = by_id.get(qid)
        if not q:
            print(f"  WARN: no question with id={qid} in {path.name}")
            continue
        m = re.match(r"choices\[(.+?)\]\.text", field)
        if m:
            cid = m.group(1)
            choice = next(
                (c for c in q.get("choices", []) if c.get("id") == cid or c.get("label") == cid),
                None,
            )
            if not choice:
                # field captured "?" — fall back to matching by text content
                choice = next(
                    (c for c in q.get("choices", [])
                     if _matches_with_denorm(c.get("text", ""), original)),
                    None,
                )
            if not choice:
                if any(c.get("text") == corrected for c in q.get("choices", [])):
                    continue
                print(f"  WARN: no choice {cid} in q={qid} ({path.name})")
                continue
            if not _matches_with_denorm(choice.get("text", ""), original):
                if choice.get("text") == corrected:
                    continue
                print(f"  WARN: text mismatch for q={qid} {field} in {path.name}")
                continue
            choice["text"] = corrected
            applied += 1
        elif field in ("text", "rationale", "passage", "question_text", "explanation"):
            if not _matches_with_denorm(q.get(field, "") or "", original):
                if q.get(field) == corrected:
                    continue
                print(f"  WARN: {field} mismatch for q={qid} in {path.name}")
                continue
            q[field] = corrected
            applied += 1
        else:
            print(f"  WARN: unknown field {field} for q={qid}")

    if applied:
        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    return applied


def _denorm_variants(text: str) -> list[str]:
    """Generate variants of text with common Unicode characters un-normalized
    (Haiku tends to ASCII-ify quotes, dashes, etc.)."""
    variants = [text]
    # ASCII apostrophe -> Unicode right single quote
    if "'" in text:
        variants.append(text.replace("'", "’"))
    # ASCII double quote -> curly quotes
    if '"' in text:
        variants.append(text.replace('"', "”"))
    # Hyphen -> em/en dash variants
    if " - " in text:
        variants.append(text.replace(" - ", " — "))
        variants.append(text.replace(" - ", " – "))
    # ... -> ellipsis
    if "..." in text:
        variants.append(text.replace("...", "…"))
    return variants


def apply_to_unofficial_ts(path: Path, entries: list[dict]) -> int:
    """Apply fixes to unofficialQuestions.ts via direct text replacement.

    The TS file is one huge JSON-ish array; each "text": "..." or
    "rationale": "..." occurrence can be found and replaced based on
    the JSON-encoded original value.
    """
    raw = path.read_text(encoding="utf-8")
    applied = 0
    for entry in entries:
        original = entry["original_value"]
        corrected = entry["corrected_value"]

        orig_encoded = None
        for variant in _denorm_variants(original):
            cand = json.dumps(variant, ensure_ascii=False)
            if cand in raw:
                orig_encoded = cand
                # carry the same normalization into the corrected version
                # by applying the same diff (unicode for unicode)
                if variant != original:
                    # find which substitution worked and apply to corrected
                    diff_pairs = [
                        ("'", "’"),
                        ('"', "”"),
                        (" - ", " — "),
                        (" - ", " – "),
                        ("...", "…"),
                    ]
                    for ascii_form, unicode_form in diff_pairs:
                        if unicode_form in variant and ascii_form in original:
                            corrected = corrected.replace(ascii_form, unicode_form)
                break
        new_encoded = json.dumps(corrected, ensure_ascii=False)
        if orig_encoded is None:
            if new_encoded in raw:
                continue
            print(f"  WARN: value not found for q={entry['question_id']} {entry['field']}")
            continue
        # Replace only first occurrence to be safe (values can repeat)
        # Actually each unique value may legitimately appear once; but if it
        # appears multiple times, we'd need to disambiguate. For now assume
        # uniqueness and replace all.
        count = raw.count(orig_encoded)
        if count > 1:
            # try to disambiguate by looking for nearby question id
            qid = entry["question_id"]
            qid_str = f'"id":"{qid}"'
            # find nearest qid occurrence and replace within that question
            qid_pos = raw.find(qid_str)
            if qid_pos == -1:
                qid_str_sp = f'"id": "{qid}"'
                qid_pos = raw.find(qid_str_sp)
            if qid_pos == -1:
                print(f"  WARN: ambiguous value for q={qid}, no qid found")
                continue
            # search for orig_encoded around qid_pos (both directions, narrow window)
            window = 20000
            start = max(0, qid_pos - window)
            end = min(len(raw), qid_pos + window)
            local_pos = raw.find(orig_encoded, start, end)
            if local_pos == -1:
                print(f"  WARN: ambiguous value for q={qid}, not in window")
                continue
            raw = raw[:local_pos] + new_encoded + raw[local_pos + len(orig_encoded):]
            applied += 1
        else:
            raw = raw.replace(orig_encoded, new_encoded, 1)
            applied += 1

    if applied:
        path.write_text(raw, encoding="utf-8")
    return applied


def main():
    fixes = load_results()
    print(f"Loaded {len(fixes)} fixes (excluding no-op)")

    by_file: dict[str, list[dict]] = defaultdict(list)
    for f in fixes:
        by_file[f["file"]].append(f)

    total_applied = 0
    for file_rel, entries in sorted(by_file.items()):
        path = ROOT / file_rel
        if not path.exists():
            print(f"MISSING: {path}")
            continue
        if path.name == "unofficialQuestions.ts":
            applied = apply_to_unofficial_ts(path, entries)
        elif path.suffix == ".json":
            applied = apply_to_json_module(path, entries)
        else:
            print(f"  SKIP unsupported: {path}")
            continue
        print(f"{file_rel}: {applied}/{len(entries)} applied")
        total_applied += applied
    print(f"\nTotal applied: {total_applied}")


if __name__ == "__main__":
    main()
