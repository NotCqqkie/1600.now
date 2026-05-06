from __future__ import annotations
import json
import uuid
from pathlib import Path
from ..utils.taxonomy import (
    normalize_math_skill, normalize_english_skill,
    normalize_math_domain, normalize_english_domain,
    get_domain_for_math_skill, get_domain_for_english_skill,
)


def _build_answer_lookup(answer_keys: list[dict]) -> dict[tuple, dict]:
    lookup = {}
    for ak in answer_keys:
        section_key = "math" if "math" in ak["section"].lower() else "rw"
        key = (section_key, ak["module"], ak["question_number"])
        lookup[key] = ak
    return lookup


def _section_id_to_lookup_key(section_id: str) -> tuple[str, int]:
    parts = section_id.split("_module")
    section = parts[0]  # "rw" or "math"
    module = int(parts[1])
    return section, module


def _build_explanation_lookup(explanations: list[dict]) -> dict[tuple, dict]:
    lookup = {}
    for e in explanations or []:
        section_key = "math" if "math" in e["section"].lower() else "rw"
        key = (section_key, e["module"], e["question_number"])
        lookup[key] = e
    return lookup


def classify_and_enrich(
    raw_questions: dict[str, list[dict]],
    answer_keys: list[dict],
    test_number: int,
    work_dir: Path,
    explanations: list[dict] | None = None,
) -> dict[str, list[dict]]:
    """Merge answer keys with extracted questions, classify, and assign IDs."""
    ak_lookup = _build_answer_lookup(answer_keys)
    exp_lookup = _build_explanation_lookup(explanations or [])
    enriched = {}
    question_ids = {}  # section_id -> {q_num: q_id}

    for section_id, questions in raw_questions.items():
        section_key, module_num = _section_id_to_lookup_key(section_id)
        is_math = section_key == "math"

        section_label = "Math" if is_math else "Reading and Writing"
        test_name = f"SAT Practice Test {test_number} {section_label} Module {module_num}"
        module_uuid = str(uuid.uuid4())

        enriched_qs = []
        question_ids[section_id] = {}

        for q in questions:
            q_num = q["question_number"]
            q_id = f"{module_uuid}_{q_num}"
            question_ids[section_id][q_num] = q_id

            # Look up answer key and explanation
            ak = ak_lookup.get((section_key, module_num, q_num))
            exp = exp_lookup.get((section_key, module_num, q_num))

            # Determine correct answer (prefer answer key, fall back to explanation)
            correct_answer = None
            if ak:
                correct_answer = ak.get("correct_answer")
            if not correct_answer and exp:
                correct_answer = exp.get("correct_answer")

            # Determine domain/skill from answer key first, then fallback
            domain = None
            skill = None
            difficulty = None

            if ak:
                difficulty = ak.get("difficulty")
                raw_domain = ak.get("domain", "")
                raw_skill = ak.get("skill", "")

                if is_math:
                    skill = normalize_math_skill(raw_skill)
                    domain = normalize_math_domain(raw_domain)
                    if skill and not domain:
                        domain = get_domain_for_math_skill(skill)
                else:
                    skill = normalize_english_skill(raw_skill)
                    domain = normalize_english_domain(raw_domain)
                    if skill and not domain:
                        domain = get_domain_for_english_skill(skill)

            # Fallback defaults
            if not domain:
                domain = "Algebra" if is_math else "Information and Ideas"
            if not skill:
                skill = "Linear equations in one variable" if is_math else "Central Ideas and Details"

            # Build output question
            rationale = exp.get("rationale") if exp else None

            enriched_q = {
                "section": section_label,
                "domain": domain,
                "skill": skill,
                "difficulty": difficulty,
                "rationale": rationale,
                "id": q_id,
                "testName": test_name,
                "text": q.get("text", ""),
                "choices": q.get("choices", []),
                "correctAnswer": correct_answer,
                "type": q.get("type", "multiple-choice"),
            }

            # Attach incorrect-choice explanations as a sidecar (used to build explanation JSON later)
            if exp and exp.get("incorrect_explanations"):
                enriched_q["_incorrect_explanations"] = exp["incorrect_explanations"]

            enriched_qs.append(enriched_q)

        enriched[section_id] = enriched_qs
        print(f"  {section_id}: enriched {len(enriched_qs)} questions as '{test_name}'")

    # Save enriched results
    enriched_dir = work_dir / "enriched"
    enriched_dir.mkdir(exist_ok=True)
    for section_id, qs in enriched.items():
        path = enriched_dir / f"{section_id}.json"
        path.write_text(json.dumps(qs, indent=2))

    # Save question ID mapping for figure extraction
    ids_path = work_dir / "question_ids.json"
    ids_path.write_text(json.dumps(question_ids, indent=2))

    return enriched
