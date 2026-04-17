# Codex Queue

Rules for how this file is used live in CODEX_RULES.md.
Pick the FIRST unchecked task. One PR per task. Refill when fewer than 3 remain.

## Active tasks

### Bootstrap
- [ ] Create `CODEX_BANK_MAP.md` at the repo root. Document every question-bank source file: path, format (JSON/TS), number of questions, schema/shape, and how it's imported/consumed in the app. Do NOT modify any question data in this task. This map will be referenced by all future audit tasks.

### Bank audit — LaTeX / formatting pass (fast wins, low risk)
- [ ] Scan `src/data/questions/math_past.json` for LaTeX issues: unclosed `$`, mismatched `{}`, unmatched `\left`/`\right`, stray backslashes. Fix up to 20 and PR. List IDs in the PR body.
- [ ] Scan `src/data/questions/reading_past.json` for malformed HTML/JSX in question `text` or `rationale` fields. Fix up to 20 and PR.
- [ ] Scan the first 50 files in `src/data/Modules/` (alphabetical) for LaTeX delimiter issues. Fix up to 20 questions across those files and PR.
- [ ] Scan `src/data/Modules/` for questions with trailing whitespace in `text`, `rationale`, or `choices[].text`. Trim up to 30 and PR.
- [ ] Scan `src/data/Modules/` for smart quotes (`"`, `"`, `'`, `'`) that should be straight ASCII quotes inside code-like contexts, and for inconsistent apostrophe use within a single question. Fix up to 20 and PR.

### Bank audit — structural integrity (higher impact)
- [ ] Find multiple-choice questions in `src/data/Modules/*.json` that have fewer than 4 choices. Report all findings in a PR that adds `BANK_ISSUES_CHOICES.md` listing the question IDs and files.
- [ ] Find questions across all sources where `correctAnswer` is not one of the `choices[].id` values. Report in a PR adding `BANK_ISSUES_INVALID_ANSWER.md`.
- [ ] Find questions with empty or missing `text`, or MC questions with no `choices`. Report in a PR adding `BANK_ISSUES_MISSING.md`.
- [ ] Find duplicate `id` values across all bank sources. Report in a PR adding `BANK_ISSUES_DUPLICATE_IDS.md`.
- [ ] Find near-duplicate question text (same first 80 chars, case-insensitive) across `src/data/Modules/*.json`. Report in `BANK_ISSUES_DUPLICATES.md`.

### Bank audit — correctness (highest value, slower)
- [ ] Audit 20 Easy-difficulty Math questions from `src/data/questions/math_past.json` for mathematical correctness: verify the `correctAnswer` by solving the problem. Fix any wrong answers and update `rationale` if present. PR with IDs reviewed and issues found.
- [ ] Audit 20 Medium-difficulty Math questions from `src/data/Modules/` for correctness. PR.
- [ ] Audit 20 Reading and Writing questions from `src/data/questions/reading_past.json` for answer-key/rationale alignment (does the stated correct answer actually match the rationale's reasoning?). PR.

### Test coverage
- [ ] Write vitest + React Testing Library tests for `src/components/DesmosDialog.tsx`. Add `vitest` and `@testing-library/react` as devDependencies if missing.
- [ ] Write vitest tests for `src/components/InlineDesmos.tsx`.
- [ ] Write vitest tests for `src/components/StepByStepExplanation.tsx`.
- [ ] Write vitest tests for `src/components/TransparentAwareImage.tsx`.
- [ ] Write vitest tests for `src/components/QuestionBankFilterPanel.tsx`.

### Type safety
- [ ] Remove all `any` and implicit `any` from `src/lib/explanationApi.ts`. Replace with precise types.
- [ ] Audit `src/components/QuestionBankFilterPanel.tsx` for loose types and tighten.

### Accessibility
- [ ] Audit `src/pages/Question.tsx` for missing `aria-*` labels, keyboard nav gaps, focus management. Fix and PR.
- [ ] Audit `src/pages/Home.tsx` for accessibility issues. Fix and PR.
- [ ] Audit `src/pages/PracticeTestResults.tsx` for accessibility issues. Fix and PR.

### Dead code
- [ ] Find unused exports across `src/components/` using `ts-prune` or manual analysis. Remove safely. PR.
- [ ] Find unused imports across `src/pages/`. Remove. PR.
