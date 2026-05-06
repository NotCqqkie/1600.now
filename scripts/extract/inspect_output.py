#!/usr/bin/env python3
"""Quick-look at extracted question output.

Usage:
    python -m scripts.extract.inspect_output \
        --output-dir scripts/extract/_runs/test4/output \
        [--show 3]            # show 3 sample questions per file
        [--rationales]        # show rationale lengths/snippets
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path


def summary_for(path: Path, show: int, rationales: bool):
    if not path.exists():
        print(f"  (missing: {path.name})")
        return
    data = json.loads(path.read_text())
    print(f"\n=== {path.name} — {len(data)} questions ===")
    if not data:
        return

    # Counts
    types = {}
    domains = {}
    has_rationale = 0
    has_answer = 0
    diff = {}
    for q in data:
        types[q.get("type", "?")] = types.get(q.get("type", "?"), 0) + 1
        domains[q.get("domain", "?")] = domains.get(q.get("domain", "?"), 0) + 1
        diff[q.get("difficulty") or "?"] = diff.get(q.get("difficulty") or "?", 0) + 1
        if q.get("rationale"):
            has_rationale += 1
        if q.get("correctAnswer"):
            has_answer += 1

    print(f"  types: {types}")
    print(f"  has_answer: {has_answer}/{len(data)}")
    print(f"  has_rationale: {has_rationale}/{len(data)}")
    print(f"  difficulties: {diff}")
    print(f"  domains: {domains}")

    # Test name distribution
    test_names = {}
    for q in data:
        t = q.get("testName", "?")
        test_names[t] = test_names.get(t, 0) + 1
    print(f"  testNames: {test_names}")

    # Sample questions
    if show:
        for q in data[:show]:
            print(f"\n  --- Q{q.get('id', '?').split('_')[-1]} ({q.get('domain')} / {q.get('skill')}) ---")
            print(f"  text: {q.get('text', '')[:300]}")
            choices = q.get("choices", [])
            if choices:
                for c in choices[:4]:
                    marker = "*" if c.get("id") == q.get("correctAnswer") else " "
                    print(f"  {marker} {c.get('id')}) {c.get('text', '')[:80]}")
            else:
                print(f"  (free-response, answer: {q.get('correctAnswer')})")
            if rationales and q.get("rationale"):
                print(f"  rationale ({len(q['rationale'])} chars): {q['rationale'][:200]}...")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--show", type=int, default=2)
    parser.add_argument("--rationales", action="store_true")
    args = parser.parse_args()

    out = Path(args.output_dir)
    print(f"Inspecting: {out}")

    # Find report
    reports = list(out.glob("*_report.json"))
    if reports:
        report = json.loads(reports[0].read_text())
        print(f"\nReport: {reports[0].name}")
        print(f"  Math: {report.get('math_questions')}, R&W: {report.get('rw_questions')}, Total: {report.get('total')}")
        print(f"  Warnings: {len(report.get('warnings', []))}, Errors: {len(report.get('errors', []))}")
        if report.get("api_cost"):
            print(f"  API cost: ${report['api_cost'].get('estimated_cost_usd', 0)}")

    for path in sorted(out.glob("*.json")):
        if "report" in path.stem or "duplicates" in path.stem:
            continue
        summary_for(path, args.show, args.rationales)


if __name__ == "__main__":
    main()
