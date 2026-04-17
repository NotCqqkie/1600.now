# Codex Autonomous Agent Rules

You are an autonomous maintenance agent for the 1600-prep-hub repo.
On every scheduled run:

1. Read this file (CODEX_RULES.md) first.
2. Read CODEX_QUEUE.md.
3. Pick the FIRST unchecked `- [ ]` task.
4. Complete it fully in a new branch.
5. Open a PR that:
   - Does the work.
   - Edits CODEX_QUEUE.md to check the box for the task you completed.
   - Has a clear title prefixed with `[codex]`.
6. If fewer than 3 unchecked items remain in CODEX_QUEUE.md after checking your box, append 5 new tasks using the "Task Generation Priorities" below.

## Task Generation Priorities (in order of importance)

### Priority 1 — Question bank audit (MOST IMPORTANT)
The question bank is the core product. Question data lives in:
- `src/data/questions/math_past.json`
- `src/data/questions/reading_past.json`
- `src/data/Modules/*.json` (~492 files, one per SAT module)
- `src/data/unofficialQuestions.ts` (~115k lines)
- `src/data/official_questions.ts` / `official_questions.json`
- `src/data/officialQuestionBank.ts`
- `src/data/questionBank.ts`
- `src/data/modulePracticeBank.ts`

Question shape (example):
```
{
  "section": "Math" | "Reading and Writing",
  "domain": string,
  "skill": string,
  "difficulty": "Easy" | "Medium" | "Hard",
  "rationale": string | null,
  "id": string,
  "testName": string,
  "text": string,               // LaTeX via $...$, may contain newlines
  "choices": [{"id": "A"|"B"|"C"|"D", "text": string}],
  "correctAnswer": "A"|"B"|"C"|"D",
  "type": "multiple-choice" | "student-produced-response"
}
```

Audit for:
- Mathematically wrong answers or wrong correctAnswer labels
- Broken LaTeX: unclosed `$`, mismatched `{}`, bad escapes, `\\` vs `\`, unmatched `\left`/`\right`
- Malformed HTML/JSX inside `text` or `rationale`
- Duplicate questions (same `text` or near-duplicates across files)
- Missing required fields (no `correctAnswer`, no `choices` for MC, empty `text`)
- Inconsistent formatting: trailing whitespace, smart quotes vs straight quotes, double spaces
- Answer choices where `correctAnswer` doesn't align with `rationale`
- For MC: fewer than 4 choices, duplicate choice text, choices not labeled A/B/C/D

When auditing, work in batches of ~20 questions per PR. Always include a summary comment in the PR body listing the question IDs reviewed and the issues found/fixed.

### Priority 2 — Test coverage
Write vitest tests for untested files in `src/components/` and `src/pages/`. Use React Testing Library (already likely installed; if not, add as devDependency in the same PR). One component per PR.

### Priority 3 — Type safety
Remove `any` and implicit `any` in `src/lib/` and `src/components/`. Tighten types. One file per PR.

### Priority 4 — Accessibility
Add missing `aria-*` labels, fix keyboard navigation, fix obvious color contrast issues in `src/pages/` and `src/components/`.

### Priority 5 — Dead code
Remove unused exports, unused imports, and unreferenced components.

## Hard rules
- NEVER modify `CODEX_RULES.md` itself.
- NEVER touch `.env`, `.env.*`, secrets, `netlify.toml`, `vercel.json`, `supabase-proxy/`, or CI config.
- NEVER change `package.json` dependencies except to add a clearly-needed devDependency (testing libs).
- NEVER run destructive git operations (force push, reset --hard, etc.).
- One PR per task. Do not bundle unrelated work.
- If a task is ambiguous or you cannot complete it safely, skip it: leave the box unchecked, add a short comment line `<!-- codex-skipped: reason -->` below the task, and move to the next.
- Run `npm run build` before opening a PR to catch type errors. If it fails because of the change, fix it; if it fails for an unrelated reason, note that in the PR.
- Keep diffs small and focused. A PR touching >20 files for a single task is too big — split it.

## Commit / PR format
- Branch name: `codex/<short-slug>`
- PR title: `[codex] <short description>`
- PR body must contain a `## Summary` section and, for bank-audit PRs, a `## Questions reviewed` section listing IDs.
