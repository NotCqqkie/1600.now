# Codex Queue

There is one standing job: **LaTeX audit across every question in the bank.**

- [x] Audit `src/data/questions/math_past.json` questions 0-99

Rules and state are in:
- `CODEX_RULES.md` — what to do and how to do it
- `CODEX_LATEX_STATE.md` — current position (source file + offset)

Every run: read `CODEX_RULES.md`, then `CODEX_LATEX_STATE.md`, then execute.
No task list needed — the state file tracks everything.
