# Codex Autonomous Agent Rules

## One job: LaTeX audit

Your only task is to audit every question in the bank for LaTeX issues and fix them.
State is tracked in `CODEX_LATEX_STATE.md`. Read it at the start of every run.

---

## Every run — exact steps

1. Read `CODEX_LATEX_STATE.md` to get `source`, `offset`, and `batch_size`.
2. Load questions `[offset]` through `[offset + batch_size - 1]` (0-indexed) from the current source.
3. Check each question's `text`, `rationale`, and `choices[].text` for LaTeX issues (see below).
4. Fix every issue you find in the source file.
5. Update `CODEX_LATEX_STATE.md`:
   - Add a line to "Completed batches": `source | offset | offset+batch_size-1 | N issues fixed`
   - Advance `offset` by `batch_size`.
   - If `offset` >= total questions in that source, mark the source as `done` in the table and move to the next source (reset offset to 0).
   - If all sources are done, write `AUDIT COMPLETE` at the top of the file.
6. Do NOT commit or push — the orchestrating Claude session handles git operations after the audit batches finish. Just leave the working tree dirty with your edits.

---

## Source loading instructions

**JSON files** (`math_past.json`, `reading_past.json`, `Modules/*.json`):
- Parse the JSON array. Questions are 0-indexed in the array.
- For `Modules/*.json`, process files alphabetically. Treat the combined list of all questions across all files as one flat sequence. Track which file + index you're in via the offset.

**TypeScript files** (`official_questions.ts`, `unofficialQuestions.ts`):
- The exported array is the question list. Extract the array literal directly from the file.
- Edit the source `.ts` file in place.

---

## LaTeX issues to fix

Fix ALL of the following:

### Delimiter errors (highest priority)
- Unclosed `$` (odd number of unescaped `$` in a field)
- Unclosed `$$` pairs
- Mixed delimiters: `$...$` and `\(...\)` used inconsistently within the same question — standardize to `$...$`
- `$$...$$` display math — standardize to `\[...\]`

### Brace errors
- Unmatched `{` or `}` inside a math expression
- Missing `{}` argument for commands that require one: `\frac{}{}`, `\sqrt{}`, `\text{}`, `\overline{}`, `\underline{}`

### Escape errors
- `\left` without a matching `\right` (or vice versa) in the same expression
- `\\` used where `\` is needed for a command, e.g. `\\frac` instead of `\frac`
- Bare `\` at end of a math expression with no command following

### Text content inside math
- Plain English words inside `$...$` without `\text{}`, e.g. `$price = 5$` should be `$\text{price} = 5$`
- Exception: single letters used as variables are fine (e.g. `$x$`, `$n$`)

### Word-form math (IMPORTANT — high priority)
Some questions have mathematical content written out in plain English words instead of LaTeX. Convert these to proper LaTeX expressions.

Patterns to detect and fix:
- Equations written as words: `"negative x plus y, equals negative 3 point 5"` → `$-x + y = -3.5$`
- Coordinates written as words: `"x comma y"` → `$(x, y)$`
- Fractions written as words: `"3 point 5"` → `$3.5$`, `"one half"` → `$\frac{1}{2}$`
- Variables written as words mixed with math: `"the value of y"` → `"the value of $y$"`
- Ordered pairs as words: `"ordered pair x comma y"` → `"ordered pair $(x, y)$"`
- Function notation as words: `"f of x"` → `$f(x)$`
- Common word patterns to search for: `"equals negative"`, `"equals positive"`, `"x comma y"`, `"y comma x"`, `"point 5"`, `"point 2 5"`, `"point 7 5"`, `"negative x"`, `"plus y"`, `"minus y"`

These are a separate class of error from broken LaTeX — the math was never LaTeXified in the first place.

### Stray characters
- HTML entities inside math: `&lt;` → `<`, `&gt;` → `>`, `&amp;` → `&`
- Literal `<br>` or `<br/>` inside math expressions

### Verbal graph descriptions (NEW — added 2026-04-23)
Some questions have an accessibility-style bullet description of a graph instead of an actual image, e.g.:

```
• The line slants sharply up from left to right.
• The line passes through the following points:
• (0, 0)
• (2, 80)
• (4, 160)
• (6, 240)
According to the graph, what is the estimated number of candy bars...
```

For each occurrence:
1. If the points/lines describe a single line or a system of lines that can be expressed as a clean equation, REPLACE the bullet description with the equivalent equation in `$...$` (e.g. `$y = 40x$\nAccording to the graph, ...`).
2. If the description is for a curve, scatterplot, bar chart, or anything not reducible to one or two equations, LEAVE the description in place — it is the only information the student has.
3. NEVER strip the description without replacing the information.
4. Look for these patterns: `slants sharply`, `slants gradually`, `passes through the following points`, `bars labeled`, `data points are clustered`, `the curve`, `scatterplot shows`.

### Residual single-fragment images (NEW — added 2026-04-23)
Skip — image audits are handled by a separate vision-capable worker. Do not modify `src/data/unofficialQuestionImageMap.ts`.

---

## Hard rules

- NEVER change the mathematical content or meaning of a question.
- NEVER change `correctAnswer` values.
- NEVER change `rationale` content beyond fixing LaTeX syntax.
- NEVER modify `CODEX_RULES.md` or `CODEX_LATEX_STATE.md` except the state update in step 5.
- NEVER touch `.env`, secrets, CI config, `package.json`, or any file outside the question data files and the two CODEX_ files.
- Process every batch the orchestrator asks for in a single run; do not stop between batches.
- If a source file is malformed and cannot be parsed, log the error in the state file and stop.
- Run `git diff --stat` (read-only) at the end so the orchestrator can verify what changed.
