"""
Flag question fields that may contain screen-reader-style spelled-out math.

Looks across:
  - src/data/modules/*.json
  - src/data/unofficialQuestions.ts

Emits a JSON report at scripts/audit/screen_reader_math_candidates.json with one
record per flagged field. Each record has enough info to be reviewed by a
downstream agent (Haiku) which decides whether the value is genuinely broken.

This script does NOT modify any data.

Heuristic: a field is flagged if it contains any of these signals (outside of
existing $...$ math blocks):
  - "equals" (whole word)                  -> very strong signal
  - "open parenthesis" / "close parenthesis"
  - "the fraction with numerator"
  - "to the <word> power" / "raised to the"
  - " plus ", " minus " surrounded by short tokens (variables/digits) on both
    sides — i.e. arithmetic-looking, not prose-looking
  - "Equation 1:" / "Equation 2:"
  - "f of x", "P of t", etc.
  - " and, " between equation-like fragments
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[2]
MODULES_DIR = ROOT / "src" / "data" / "Modules"
UNOFFICIAL = ROOT / "src" / "data" / "unofficialQuestions.ts"
OUT = ROOT / "scripts" / "audit" / "screen_reader_math_candidates.json"

LATEX_BLOCK = re.compile(r"\$[^$]+\$")

# Strong signals (high precision)
SIG_EQUALS = re.compile(r"\bequals\b")
SIG_OPEN_PAREN = re.compile(r"\bopen parenthesis\b")
SIG_CLOSE_PAREN = re.compile(r"\bclose parenthesis\b")
SIG_FRACTION = re.compile(r"\bthe fraction (with numerator|over|a, over)\b")
SIG_POWER = re.compile(r"\bto the\s+\w+(?:\s+\w+){0,3}\s+power\b|\braised to the\b")
SIG_EQUATION_PREFIX = re.compile(r"\bEquation\s+1:\s|\bEquation\s+2:\s|^This answer choice consists of two equations\.?", re.I)
SIG_FN_OF_VAR = re.compile(r"\b[a-zA-Z]\s+of\s+[a-z]\s+equals\b")
SIG_AND_SEPARATOR = re.compile(r",\s*and,\s*")
# "negative N" pattern preceded by mathy surroundings
SIG_NEGATIVE = re.compile(r",\s*negative\s+\d|^negative\s+\d|\(negative\s+\d")
# "plus or minus"
SIG_PLUS_OR_MINUS = re.compile(r"\bplus or minus\b")
# "X point Y" decimal screen-reader pattern (e.g., "0 point 1 5")
SIG_DECIMAL = re.compile(r"\b\d+\s+point\s+\d(?:\s+\d){1,}\b")
# arithmetic-looking " plus " / " minus " (digit/var on both sides)
SIG_ARITH_PLUS = re.compile(
    r"(?:\b\d+|\b[a-zA-Z])\s+plus\s+(?:\d+|\b[a-zA-Z])"
)
SIG_ARITH_MINUS = re.compile(
    r"(?:\b\d+|\b[a-zA-Z])\s+minus\s+(?:\d+|\b[a-zA-Z])"
)
# squared/cubed in math context
SIG_SQUARED = re.compile(r"[a-zA-Z\)\]]\s*,?\s*squared\b|[a-zA-Z\)\]]\s*,?\s*cubed\b")
# "comma" used as TTS noise
SIG_COMMA_WORD = re.compile(r",\s*comma,\s*")

SIGNAL_PATTERNS = [
    ("equals", SIG_EQUALS),
    ("open_parenthesis", SIG_OPEN_PAREN),
    ("close_parenthesis", SIG_CLOSE_PAREN),
    ("fraction_words", SIG_FRACTION),
    ("power_words", SIG_POWER),
    ("equation_prefix", SIG_EQUATION_PREFIX),
    ("fn_of_var", SIG_FN_OF_VAR),
    ("and_separator", SIG_AND_SEPARATOR),
    ("negative_word", SIG_NEGATIVE),
    ("plus_or_minus", SIG_PLUS_OR_MINUS),
    ("decimal_words", SIG_DECIMAL),
    ("arith_plus", SIG_ARITH_PLUS),
    ("arith_minus", SIG_ARITH_MINUS),
    ("squared_cubed", SIG_SQUARED),
    ("comma_word", SIG_COMMA_WORD),
]


def find_signals(text: str) -> list[str]:
    """Return list of signals found, ignoring text inside $...$."""
    if not text:
        return []
    stripped = LATEX_BLOCK.sub(" ", text)
    found = []
    for name, pattern in SIGNAL_PATTERNS:
        if pattern.search(stripped):
            found.append(name)
    return found


def yield_fields_from_question(q: dict, file_path: Path, idx: int):
    """Yield (field_path, text_value) tuples for a question's text-bearing fields."""
    qid = q.get("id", f"idx{idx}")

    text = q.get("text") or ""
    if text:
        yield (qid, "text", text)

    rationale = q.get("rationale") or q.get("explanation") or ""
    if rationale:
        yield (qid, "rationale", rationale)

    for c in q.get("choices") or []:
        cid = c.get("id", "?")
        ct = c.get("text") or ""
        if ct:
            yield (qid, f"choices[{cid}].text", ct)


def flatten_questions(data) -> list[dict]:
    """A module file is a single object containing a 'questions' array.
    unofficialQuestions.ts is an array of question objects directly.
    Handle both."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        if "questions" in data and isinstance(data["questions"], list):
            return data["questions"]
        if "data" in data and isinstance(data["data"], list):
            return data["data"]
    return []


def load_json_file(path: Path):
    raw = path.read_text(encoding="utf-8")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def load_unofficial_ts(path: Path):
    """unofficialQuestions.ts -> array of questions."""
    raw = path.read_text(encoding="utf-8")
    try:
        start = raw.index("= [") + 2
        end = raw.rindex("]") + 1
    except ValueError:
        return None
    body = raw[start:end]
    body = re.sub(r",\s*([\]}])", r"\1", body)
    try:
        return json.loads(body)
    except json.JSONDecodeError as e:
        print(f"Failed to parse {path}: {e}", file=sys.stderr)
        return None


def iter_module_files() -> Iterable[Path]:
    yield from sorted(MODULES_DIR.glob("*.json"))


def main():
    candidates: list[dict] = []

    for path in iter_module_files():
        data = load_json_file(path)
        if data is None:
            continue
        questions = flatten_questions(data)
        rel = path.relative_to(ROOT)
        for idx, q in enumerate(questions):
            for qid, field, value in yield_fields_from_question(q, path, idx):
                signals = find_signals(value)
                if signals:
                    candidates.append({
                        "file": str(rel),
                        "question_idx": idx,
                        "question_id": qid,
                        "field": field,
                        "signals": signals,
                        "value": value,
                    })

    if UNOFFICIAL.exists():
        questions = load_unofficial_ts(UNOFFICIAL)
        if questions:
            rel = UNOFFICIAL.relative_to(ROOT)
            for idx, q in enumerate(questions):
                for qid, field, value in yield_fields_from_question(q, UNOFFICIAL, idx):
                    signals = find_signals(value)
                    if signals:
                        candidates.append({
                            "file": str(rel),
                            "question_idx": idx,
                            "question_id": qid,
                            "field": field,
                            "signals": signals,
                            "value": value,
                        })

    OUT.write_text(json.dumps(candidates, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    by_signal: dict[str, int] = {}
    for c in candidates:
        for s in c["signals"]:
            by_signal[s] = by_signal.get(s, 0) + 1
    by_file: dict[str, int] = {}
    for c in candidates:
        by_file[c["file"]] = by_file.get(c["file"], 0) + 1

    print(f"Total candidate fields: {len(candidates)}")
    print(f"Distinct files with candidates: {len(by_file)}")
    print("Signals:")
    for k, v in sorted(by_signal.items(), key=lambda kv: -kv[1]):
        print(f"  {k:>20}: {v}")
    print(f"\nReport: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
