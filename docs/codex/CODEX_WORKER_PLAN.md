# Codex Background Bot — Work Plan

Four tracks, ordered by priority. Each track has an input file so workers can take batches.

## 1. LaTeX fixes (ongoing)

Already running via existing `[codex] LaTeX audit worker N` pattern. No changes.

## 2. Concatenation corruption — unofficial bank

Goal: questions in `src/data/unofficialQuestions.ts` whose `text` or answer-choice `text` has an alien prefix/suffix glued on from a neighbor.

Pattern categories (70+ fixed so far in this pass):
- **Orphan prefix** — leading formula/sentence not referenced by the question's answer or rationale.
- **Orphan suffix** — trailing sentence from a later question's passage.
- **Middle-glued** — legitimate question sandwiched by an orphan prefix AND a "…shown above?" suffix.

Worker prompt per id:
- Load question `id` from `src/data/unofficialQuestions.ts`.
- Decode text; split on `\n`. For each segment, verify it is referenced by the rationale, correct answer choice, or internal symbols of the stem.
- Drop segments that are orphaned. Apply the same check to each `choice.text`.
- Preserve untouched segments exactly (no LaTeX rewriting).
- Commit: `[codex] Concat fix id:<id> (unofficialQuestions)`.

Also check the JSON Modules (`src/data/Modules/*.json`) for the same pattern.

## 3. Missing images

Input: `scripts/missing_image_suspects.json` (7 current suspects, `scripts/find_missing_images.mjs` regenerates).

Worker prompt per suspect:
1. Inspect the question text — decide whether it truly requires a visual (table/figure/graph/etc.).
2. If not required → mark false-positive in a separate log, skip.
3. If required → search for the source SAT form/module artwork:
   - For `*_past.json` ids, the prefix is the test UUID + `_N` question number. Source images live in the SAT archive (CB data dumps). Cross-check via `src/data/questionImageMap.ts` siblings from the same UUID.
   - If image file exists under `public/images/` or `cb_data/`, add the mapping to `src/data/questionImageMap.ts` (or `src/data/unofficialQuestionImageMap.ts`).
   - If no image can be located, leave a TODO note — do NOT fabricate.
4. Commit per id: `[codex] Image map id:<id>`.

The heuristic is deliberately tight; workers should expand it by finding more patterns during the sweep and re-running the finder.

## 4. Numeric-template rewrites — **PAST bank only**

Input: `scripts/numeric_template_work.json` (307 targets, `scripts/find_numeric_templates.mjs` regenerates).

Hard rules:
- **Only rewrite questions in `math_past.json` or `reading_past.json`.** Never rewrite `unofficialQuestions.ts`.
- Never rewrite a question that has an image (group member or self).
- Never change numeric values or the correct-answer mapping.

Worker prompt per id: see `scripts/numeric_template_rewrite_plan.md`.

## Runtime adjacency guard (already shipped)

`spaceOutNearDuplicates` in `src/data/questionBank.ts` reorders `getBankPool` output and is applied to all shuffle paths in `BankBrowse.tsx` and `BankIndex.tsx` so two number-variant questions never sit adjacent.
