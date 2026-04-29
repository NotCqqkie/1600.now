#!/usr/bin/env python3
"""Trial explanation generator using Claude Haiku via Claude Code subscription.

Reads a single question JSON from stdin or --file, writes the generated
explanation JSON to stdout (or --out). Used for iterative trial-and-error
prompt tuning before running the full 9700-question batch.

If the question has an `images` array, each image is remapped from its
`local` path (e.g. `images_labeled/Foo_Q3_1.png`) to the actual on-disk
file (e.g. `public/images/SAT-Style Questions/Foo_Q3.png`) and attached
to the Haiku call via `@<absolute-path>` so the vision model can see it.

Usage:
    python scripts/gen_explanation_trial.py --file /tmp/expl-trial/math.json
    python scripts/gen_explanation_trial.py --file /tmp/expl-trial/reading.json --out /tmp/expl-trial/reading-out.json
"""
import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

PROMPT_MATH = """You are an expert SAT tutor. Generate a JSON array of 2-5 explanation steps teaching the FASTEST method to solve this SAT Math problem.

SOLVE FORWARD. Reason through the problem as if solving it for the first time. Do NOT say "the answer is X, let's see why". Never reveal the answer before your reasoning arrives there.
(Verification only — expected answer: {correct}. Never mention this in output.)

MATH APPROACH — use the FASTEST method. Check these triggers in order:

TRIGGER → SHORTCUT (use this instead of full algebra):
- "one/two/no real solution(s)" or "tangent to" → CHECK DISCRIMINANT: b²-4ac > 0 (two), = 0 (one), < 0 (none). Do NOT solve the full equation.
- "sum of solutions" / "sum of roots" → Vieta's: sum = -b/a. Write the answer directly.
- "product of solutions" / "product of roots" → Vieta's: product = c/a. Write the answer directly.
- Vertex form y = a(x-h)²+k → vertex is (h, k). Use directly. Do NOT expand.
- Parabola intersects horizontal line y = c → compare c to vertex value k. If a < 0 and c > k: zero intersections. If c = k: one. If c < k: two.
- Choices are simple integers or fractions → BACKSOLVE: start with the middle alphabetical choice. Begin that step with exactly "Backsolving — testing choice [X] ([value]):" and show the check. If it fails, write "Fails. Testing choice [Y] ([value]):" and continue. Never assume a value without this explicit label.
- Scale factor k between similar figures → area scales by k², volume by k³.
- sin A = cos B → A + B = 90°. Write directly.
- Parallel lines → same slope. Perpendicular → slopes are negative reciprocals.
- (a - b) or (x + y) repeats → substitute u = (a - b) or u = (x + y).

GRAPHING (include "desmosExpressions" array when the reasoning IS graphical):
- Intersection of two curves → list both equations in desmosExpressions, state where they meet visually.
- Stats: mean, median, standard deviation → use Desmos built-in functions in desmosExpressions.
- Comparing multiple choice equations graphically → use "desmosGraphs" with one entry per choice.
- For purely algebraic steps (substituting, expanding, factoring) → NO desmosExpressions needed.

Table/data lookup: EXACTLY 1 step. State row + column + value in one sentence. Never split into "find row" then "read value."

FORBIDDEN (these will fail audit):
- Hedging: "may", "might", "appears to", "seems", "suggests", "it looks like", "possibly"
- Doubt: "let's re-examine", "wait", "on second thought", "actually let me reconsider", "hmm"
- Repeating the same equation on consecutive display-math lines
- Re-listing already-eliminated choices in the final step
- Restating what a previous step already said
- LaTeX / math symbols inside "title" strings — titles must be plain text only
- Duplicating the "formula" field content inside the step's "content" field (redundant)

STRUCTURE:
- 2-5 steps. Fewer is better. Each step moves reasoning forward.
- Do NOT add a standalone "Confirm the answer" or "Verify" step that just restates prior work. Tie the choice letter to the END of the step where you actually compute/derive the result.
- The tie-in is its OWN final sentence in that step. Write the derivation, then in a new sentence use EXACTLY this form:
  "That matches choice B — <strong>B</strong> is correct."
  (Always include the word "choice" followed by the letter, and bold the letter.)
- Use <strong>, <br/>, <ul><li>, <div class="callout">...</div> for readability. Do not use <p> tags.
- Every equation in its own $$...$$ display block. Inline math with $...$.
- "formula" field is OPTIONAL. Only include it if the content is a formula the student should memorize. If you include it, the exact LaTeX must NOT appear elsewhere in the same step's content.

JSON SCHEMA per step:
{{"title": "Short plain text, NO LaTeX, NO $", "content": "HTML+LaTeX", "formula": "$$optional — do not duplicate in content$$", "desmosExpressions": ["optional"], "desmosGraphs": [{{"label":"Choice A","expressions":["..."]}}]}}

Return ONLY the JSON array. No markdown fences, no commentary.

CRITICAL JSON ESCAPING:
- Every backslash inside a JSON string must be doubled: "\\\\frac", "\\\\quad", "\\\\sqrt", "\\\\cdot", "\\\\text" — never bare "\\frac".
- The ONLY double-quote characters (") allowed in your output are the ones delimiting JSON keys and string values. NEVER put a " inside a content string. If you need to reference passage text, wrap the phrase in <em>...</em> tags (e.g., <em>verdant sheen</em>) — do NOT put quote marks around it. If you absolutely must show a quotation character, use curly quotes \u201c and \u201d, never straight ".

QUESTION:
Domain: {domain} | Skill: {skill} | Difficulty: {difficulty}
{text}
{image_note}
CHOICES:
{choices}
"""

PROMPT_READING = """You are an expert SAT tutor. Generate a JSON array of 2-4 explanation steps teaching how to solve this SAT Reading/Writing problem.

SOLVE FORWARD. Reason through the problem as if solving it for the first time. Do NOT say "the answer is X, let's see why".
(Verification only — expected answer: {correct}. Never mention this in output.)

READING APPROACH (answer-first, NOT elimination-first):
- Step 1: identify the ONE strongest clue/signal in the passage (a single phrase, contrast word, or claim). Don't list 3-4 clues — pick the decisive one.
- Step 2: state directly why the correct answer fits that clue, then dismiss the other three COLLECTIVELY in one short sentence (e.g., "The other three either contradict this, describe something not discussed, or reverse the relationship."). One bullet per wrong choice only if two or more are genuine close calls.
- For vocab-in-context: name the target meaning first, then say why the correct word expresses it. Only contrast against wrong choices if one is a close call.

CONVENTIONS OF STANDARD ENGLISH (punctuation/grammar) — special rules:
- These questions test a SPECIFIC punctuation or grammar rule. Name the actual rule directly (e.g., "A semicolon separates two independent clauses", "A colon introduces a list or elaboration", "A comma + coordinating conjunction joins two independent clauses"). Do NOT invent rule names.
- Step 1: identify ONLY the grammatical structure on each side of the blank (independent clause? dependent clause? participial phrase? gerund phrase as subject?). Be precise. Do NOT mention what punctuation is needed in step 1 — save the rule for step 2.
- Step 2: (a) name the ONE rule that applies and pick the correct choice, (b) one sentence dismissing the wrong choices by naming what they violate. NEVER repeat the structural observation from step 1.
- Common traps: "though"/"however"/"therefore" as transitional words vs. conjunctive adverbs have different punctuation. "Though" mid-sentence as a parenthetical = comma…though, OR though…comma, NOT semicolon before it. A comma after a participial phrase (e.g., "Titled 'Three Women,'") is always a comma, not a period.
- SAT preferred pattern for conjunctive adverbs (however/therefore/moreover/thus/consequently): `IC; however, IC` (semicolon before, comma after). When both `IC; however, IC` and `IC. However, IC` are offered as choices, the SAT answer is ALWAYS the semicolon version unless the question specifically tests sentence boundaries requiring a full stop.

FORBIDDEN (these will fail audit):
- Hedging: "may", "might", "appears to", "seems", "suggests/suggesting", "it looks like", "possibly", "something specific about", "we need a word meaning"
- Doubt: "let's re-examine", "wait", "on second thought", "actually let me reconsider"
- Re-listing already-eliminated choices in the final step
- Restating what a previous step already said
- Repeating passage quotes or specific examples in a concluding sentence
- Filler: "Great question!", "Let's dive in!"
- Academic or grammar-textbook jargon a high-school student wouldn't know: "modal element", "postpositive adverb", "cataphoric reference", "appositive NP", etc. Name things in plain terms: "contrast word", "comma before the second clause", "independent clause", "transition word".
- LaTeX / math symbols inside "title" strings — titles must be plain text only

STRUCTURE:
- EXACTLY 2 STEPS. Never 3, never 4. If you feel tempted to add a third step, the second step isn't tight enough — rewrite it instead. The only rare exception is a two-text compare-and-contrast question, which may use 3.
- Step 1 title: something like "Find the key signal" or "Identify the contrast" or "Spot the defining claim". One specific, decisive clue only.
- Step 2 title: something like "Match the meaning" or "Apply the signal to the choices". State the winner's logic, dismiss the others collectively, then close with the tie-in.
- Do NOT start step 2 by restating anything from step 1. Jump straight to the correct answer's logic.
- The closing tie-in sentence must be its own final sentence in step 2: (a) state what the winner does, (b) one sentence dismissing the losers, (c) the tie-in. Never write the tie-in mid-sentence after a wrong-choice dismissal.
- End step 2 with EXACTLY this form as its own sentence (begin with "That matches choice..." or "This matches choice..."), and nothing after:
  "That matches choice C — <strong>C</strong> is correct."
  (Always include the word "choice" followed by the letter, and bold the letter.)
- Use <strong>, <br/>, <em> for readability. Avoid <ul><li> for enumerating wrong choices. Do not use <p> tags.

JSON SCHEMA per step:
{{"title": "Short plain text, NO LaTeX, NO $", "content": "HTML with <strong>, <br/>, <ul>"}}

Return ONLY the JSON array. No markdown fences, no commentary.

CRITICAL JSON ESCAPING:
- Do NOT put straight double quotes (") inside string values. If you quote text from the passage, use curly quotes (\u201c \u201d) — they render fine and do not break JSON.
- If you use any LaTeX inline (rare for reading), every backslash must be doubled: "\\\\textit" not "\\textit".

QUESTION:
Domain: {domain} | Skill: {skill} | Difficulty: {difficulty}
{text}
{image_note}
CHOICES:
{choices}
"""


# Image search roots, in priority order. Each path is relative to repo root.
IMAGE_ROOTS = [
    Path(".claude/worktrees/sweet-yonath/public/images/SAT-Style Questions"),
    Path(".claude/worktrees/cool-sammet/public/images/SAT-Style Questions"),
    Path(".claude/worktrees/compassionate-ishizaka/public/images/SAT-Style Questions"),
    Path("public/images/SAT-Style Questions"),
    Path("public/images/1600.now questions"),
]


def resolve_image(local: str, repo_root: Path) -> Path | None:
    """Map the JSON `local` field to an on-disk path, or None if not found."""
    if not local:
        return None
    name = os.path.basename(local)
    # Try the name as-is, and also with `_\d+.ext` suffix stripped
    stem_no_suffix = re.sub(r"_\d+(\.[a-z]+)$", r"\1", name)
    for root in IMAGE_ROOTS:
        for candidate_name in {name, stem_no_suffix}:
            p = repo_root / root / candidate_name
            if p.exists():
                return p.resolve()
    return None


def build_prompt(q: dict, image_paths: list[Path]) -> str:
    choices_str = "\n".join(f"{c['id']}) {c['text']}" for c in q.get("choices", []))
    tpl = PROMPT_MATH if q["section"] == "Math" else PROMPT_READING
    # Inject a note pointing the model at the attached image(s). The actual
    # image data is delivered via `@path` on the CLI, not embedded here.
    image_note = ""
    if image_paths:
        image_note = (
            "\nATTACHED IMAGE(S): The figure/table/graph referenced in the question "
            "is attached. Read values directly from it. Do NOT say "
            "\u201cthe image shows\u201d in your output — just use the information.\n"
        )
    return tpl.format(
        correct=q["correctAnswer"],
        domain=q.get("domain", "N/A"),
        skill=q.get("skill", "N/A"),
        difficulty=q.get("difficulty", "N/A"),
        text=q["text"],
        choices=choices_str,
        image_note=image_note,
    )


def call_openrouter(prompt: str, api_key: str, model: str = "nvidia/nemotron-3-super-120b-a12b:free") -> str:
    import urllib.request, time as _time
    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()
    for attempt in range(4):
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data=payload,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                data = json.loads(resp.read())
            if "choices" in data:
                return data["choices"][0]["message"]["content"].strip()
            err = data.get("error", {})
            # 524/502 = provider timeout/error — retryable
            if err.get("code") in (502, 524, 529) or attempt < 3:
                wait = 10 * (2 ** attempt)
                sys.stderr.write(f"OpenRouter {err.get('code','?')} attempt {attempt+1}/4, retrying in {wait}s\n")
                _time.sleep(wait)
                continue
            sys.stderr.write(f"OpenRouter bad response: {json.dumps(data)}\n")
            sys.exit(1)
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            is_daily = "per-day" in body or "per_day" in body
            if e.code == 429 and is_daily:
                # Daily limit exhausted — signal pool to switch providers
                sys.stderr.write(f"OpenRouter daily limit: {body[:120]}\n")
                sys.exit(2)
            if e.code in (429, 502, 524) and attempt < 3:
                wait = 10 * (2 ** attempt)
                sys.stderr.write(f"OpenRouter HTTP {e.code} attempt {attempt+1}/4, retrying in {wait}s\n")
                _time.sleep(wait)
                continue
            sys.stderr.write(f"OpenRouter HTTP {e.code}: {body}\n")
            sys.exit(1)
        except Exception as e:
            sys.stderr.write(f"OpenRouter call failed: {e}\n")
            sys.exit(1)
    sys.stderr.write("OpenRouter: all retries exhausted\n")
    sys.exit(1)


def call_local_ollama(prompt: str, model: str, base_url: str = "http://localhost:11434") -> str:
    import urllib.request, time as _time
    # /no_think disables qwen3's chain-of-thought mode — ~3x faster, same output quality
    content = "/no_think\n" + prompt if "qwen3" in model else prompt
    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "stream": False,
    }).encode()
    for attempt in range(3):
        req = urllib.request.Request(
            f"{base_url}/v1/chat/completions",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=560) as resp:
                data = json.loads(resp.read())
            if "choices" in data:
                return data["choices"][0]["message"]["content"].strip()
            sys.stderr.write(f"Ollama bad response: {json.dumps(data)[:200]}\n")
            sys.exit(1)
        except Exception as e:
            if attempt < 2:
                sys.stderr.write(f"Ollama attempt {attempt+1}/3 failed: {e}, retrying...\n")
                _time.sleep(5)
                continue
            sys.stderr.write(f"Ollama call failed: {e}\n")
            sys.exit(1)
    sys.exit(1)


def call_haiku(prompt: str, image_paths: list[Path]) -> str:
    # Claude Code CLI: attach images by appending `@<absolute-path>` tokens to
    # the prompt. The CLI detects image mime types and sends as vision content.
    full_prompt = prompt
    for p in image_paths:
        full_prompt += f"\n@{p}"
    result = subprocess.run(
        ["claude", "-p", "--model", "haiku", "--no-session-persistence", full_prompt],
        capture_output=True,
        text=True,
        timeout=300,
    )
    if result.returncode != 0:
        err = result.stderr.lower()
        is_rate_limit = (
            not err.strip()  # silent failure = almost always rate limit
            or any(x in err for x in ("rate limit", "429", "too many requests", "overloaded"))
        )
        if is_rate_limit:
            sys.stderr.write(f"claude CLI rate-limited (or silent fail): {result.stderr[:120]}\n")
            sys.exit(2)
        sys.stderr.write(f"claude CLI failed: {result.stderr}\n")
        sys.exit(1)
    return result.stdout.strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True, help="Question JSON file")
    ap.add_argument("--out", help="Output file (default: stdout)")
    ap.add_argument("--raw", action="store_true", help="Print raw model output without JSON parsing")
    ap.add_argument("--repo-root", default=".", help="Repo root for resolving image paths")
    args = ap.parse_args()

    q = json.loads(Path(args.file).read_text())

    # Resolve image attachments, if any
    repo_root = Path(args.repo_root).resolve()
    image_paths: list[Path] = []
    unresolved: list[str] = []
    for im in q.get("images") or []:
        resolved = resolve_image(im.get("local", ""), repo_root)
        if resolved:
            image_paths.append(resolved)
        else:
            unresolved.append(im.get("local", ""))
    if unresolved:
        sys.stderr.write(f"WARNING: {len(unresolved)} image(s) not found on disk: {unresolved}\n")

    prompt = build_prompt(q, image_paths)

    sys.stderr.write(f"Prompt length: {len(prompt)} chars (~{len(prompt)//4} tokens)\n")

    or_key = os.environ.get("OPENROUTER_API_KEY")
    ollama_model = os.environ.get("OLLAMA_MODEL")
    if or_key:
        sys.stderr.write(f"Calling Nemotron for {q['id']} ({q['section']})...\n")
        raw = call_openrouter(prompt, or_key)
    elif ollama_model:
        sys.stderr.write(f"Calling Ollama/{ollama_model} for {q['id']} ({q['section']})...\n")
        raw = call_local_ollama(prompt, ollama_model)
    else:
        sys.stderr.write(f"Calling Haiku for {q['id']} ({q['section']})"
                         f"{f' with {len(image_paths)} image(s)' if image_paths else ''}...\n")
        raw = call_haiku(prompt, image_paths)

    if args.raw:
        output = raw
    else:
        # Strip markdown fences if present
        cleaned = raw
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        if cleaned.startswith("json\n"):
            cleaned = cleaned[5:]
        def try_parse(s):
            return json.loads(s)

        def _fix_backslashes(s):
            # Walk once, preserving valid escapes; double any lone backslash.
            out, i, n = [], 0, len(s)
            while i < n:
                c = s[i]
                if c == '\\' and i + 1 < n:
                    nxt = s[i + 1]
                    if nxt in '"\\/bfnrtu':
                        out.append(s[i:i + 2]); i += 2; continue
                    if nxt == 'u' and i + 5 < n:
                        out.append(s[i:i + 6]); i += 6; continue
                    out.append('\\\\'); i += 1; continue
                out.append(c); i += 1
            return ''.join(out)

        parsed = None
        try:
            parsed = try_parse(cleaned)
        except json.JSONDecodeError:
            # Salvage: double lone backslashes not part of a valid JSON escape
            salvaged = _fix_backslashes(cleaned)
            try:
                parsed = try_parse(salvaged)
                sys.stderr.write("Salvaged via backslash-escape fix.\n")
            except json.JSONDecodeError:
                # Second salvage: convert unescaped inner straight-quotes to curly quotes.
                def _fix_quotes(src):
                    out = []
                    i, n = 0, len(src)
                    in_value = False
                    while i < n:
                        ch = src[i]
                        if not in_value:
                            out.append(ch)
                            if ch == ':' and i + 1 < n:
                                j = i + 1
                                while j < n and src[j] in ' \t':
                                    j += 1
                                if j < n and src[j] == '"':
                                    out.append(src[i+1:j+1])
                                    i = j + 1
                                    in_value = True
                                    continue
                            i += 1
                        else:
                            if ch == '\\' and i + 1 < n:
                                out.append(src[i:i+2])
                                i += 2
                                continue
                            if ch == '"':
                                j = i + 1
                                while j < n and src[j] in ' \t':
                                    j += 1
                                if j < n and src[j] in ',}]\n':
                                    out.append('"')
                                    i += 1
                                    in_value = False
                                    continue
                                else:
                                    prev = out[-1] if out else ''
                                    if prev in (' ', '\t', '>', '(', '\n'):
                                        out.append('\u201c')
                                    else:
                                        out.append('\u201d')
                                    i += 1
                                    continue
                            out.append(ch)
                            i += 1
                    return ''.join(out)
                candidate = _fix_quotes(salvaged)
                try:
                    parsed = try_parse(candidate)
                    sys.stderr.write("Salvaged via curly-quote substitution.\n")
                except json.JSONDecodeError as e:
                    sys.stderr.write(f"JSON parse failed: {e}\nRaw output:\n{raw}\n")
                    output = raw

        if parsed is not None:
            output = json.dumps({
                "questionId": q["id"],
                "correctAnswer": q["correctAnswer"],
                "section": q["section"],
                "steps": parsed,
            }, indent=2)

    if args.out:
        Path(args.out).write_text(output)
        sys.stderr.write(f"Written to {args.out}\n")
    else:
        print(output)


if __name__ == "__main__":
    main()
