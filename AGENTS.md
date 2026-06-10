# Response Style

- No pleasantries, greetings, or filler phrases
- No restating the user's request before answering
- No trailing summaries of completed work
- Lead with the answer, skip the reasoning unless it's non-obvious
- Short answers for short questions
- Don't add comments, docstrings, or extra error handling unless asked
- Don't suggest improvements beyond what was asked

# Repo Conventions

- Use `npm`, not `pnpm` or `yarn`
- App stack: Vite + React + TypeScript
- Main source lives in `src/`; content/data scripts live in `scripts/`
- Treat `dist/`, `node_modules/`, and `.claude/` as non-source unless the user explicitly asks to inspect them
- Default local dev server is `npm run dev` on port `8080`
- `npm run preview` uses port `4173`

# Validation

- Prefer the smallest relevant check first
- Use `npm run lint:undef` for TS/TSX undefined-symbol checks
- Use `npm run lint` for broader linting
- `npm run build` also runs generated-content steps and prerendering, so use it when a full production check is actually needed

# Local GPU (Ollama on canadapc)

Luke has a Windows PC (`canadapc`) running Ollama over Tailscale.

- IP: `100.85.13.87`
- Port: `11434`
- Model: `llama3`
- OpenAI-compatible API at: `http://100.85.13.87:11434/v1`

## Shell functions (already in `~/.zshrc`)

```bash
codex-local "prompt"   # one-off: runs codex via llama3 on the PC
ollama-mode            # flips whole session to Ollama (aider, codex, etc.)
ollama-off             # restores normal OpenAI settings
```

## When to suggest using Ollama

Suggest `codex-local` or `ollama-mode` when Luke asks to:

- Summarize or process large files
- Generate boilerplate, tests, or docs
- Run repetitive or background tasks
- Do anything where speed matters more than quality and he does not want to burn API credits
