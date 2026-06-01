# Practice Set Audit Findings

Generated: 2026-06-01T15:49:01.643Z

Audited 34 practice sets, 136 modules, 3332 displayed questions. Deployed 68 mini-model subagents in waves of 6.

## Systemic Issues

- **High:** 396 questions (398 image refs) have local image paths that normalize to missing /images/SAT-Style-Questions/... URLs while the files exist under public/images/SAT-Style Questions/.... See automated_findings.json and consolidated_findings.json for the full list.
- **High:** 13 image refs use remote sat.oly.st URLs; a sample request returned HTTP 403 Cloudflare challenge.

## Confirmed Item Findings

| Severity | Set | Subject | Module File | Slot | Source ID | Issue | Evidence |
|---|---:|---|---|---:|---|---|---|
| high | 1 | math | oct25-int-formA-math-m2.json | 8 | 1dcc132a-2f7c-417a-91cd-108d7cd9c930_8 | missing_equation_or_graph | Prompt starts with "$y$ Which point $(x,y)$ is a solution..." and has no inequality/graph image. |
| low | 3 | reading | nov25-int-formC-eng-m2.json | 25 | 13cfe765-425a-44bc-b085-25d580925451_25 | duplicated_visible_text | The 1959 Alfred Lansing note appears twice. |
| medium | 6 | reading | oct25-us-formA-eng-m2.json | 17 | 9419dcb9-3471-4777-be13-1ee14db6d1bc_17 | corrupt_text | Passage contains `Spanish word / azo` where a Spanish word should render. |
| high | 11 | math | mar25-int-formD-math-m1.json | 9 | 6bfd0c2e-65a8-46f9-a800-10203b4c8d45_9 | missing_equation | Prompt says "In the given equation" but no equation is present. |
| high | 14 | reading | aug25-us-formB-eng-m2.json | 12 | 75e07a4d | missing_table_data | Prompt asks to use data from a table, but no table/image/data is present. |
| medium | 15 | math | dec24-int-formA-math-m2.json | 11 | 2c72a9c0-5ef0-4e68-883c-a0e6698dbfb6_11 | malformed_choice | Choice A text is only `only`. |
| low | 16 | math | dec24-us-formB-math-m1.json | 17 | 9f6c3595-ed0e-41a0-8889-7d3730d37b4c_17 | leading_blank_line | Prompt starts with a newline before the equation. |
| high | 16 | math | dec24-int-formC-math-m2.json | 20 | 8a096929-9162-4ef5-b1c5-1da19c60ea8c_20 | malformed_latex_or_equation | Expression contains `\alpha` despite later referring to constants a, b, and c, and has an unmatched closing parenthesis. |
| high | 17 | math | dec24-us-formA-math-m2.json | 7 | 3f5a3602 | missing_graph_image | Prompt asks for the system represented by "the lines shown" but there is no image. |
| high | 17 | math | dec24-us-formC-math-m1.json | 21 | 9c1847da-e82b-4814-a0ec-0b4f99891322_21 | malformed_latex | Second equation starts `\$2x...` and final `$w?` has no closing dollar delimiter. |
| high | 19 | math | nov24-int-formD-math-m1.json | 21 | 68b576c1-9de8-41d3-9840-538d4edcd113_21 | missing_equation | Prompt says one equation is given, but no equation is present before the question. |
| low | 9 | math | may25-int-formB-math-m1.json | 3 | bd71c8f3-94e3-411f-929a-013a2ca9a277_3 | odd_punctuation | Prompt ends with a full-width question mark `？`. |
| low | 27 | math | aug24-int-formA-math-m1.json | 3 | c9e1513f-58d1-4e6c-8574-b9662226959f_3 | leading_blank_line | Prompt starts with a newline before `$\sqrt{w} + 34 = 40$`. |
| low | 30 | math | aug24-int-formA-math-m2.json | 22 | 6acacde7-ed77-4956-a395-7f7392d6ba20_22 | leading_blank_line | Prompt starts with a newline before the circuit equation. |
