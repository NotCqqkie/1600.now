// Local dev only: OpenRouter API key is read from the env at build time and
// used to generate explanations directly from the browser. The final shipped
// build will have all explanations pre-generated, so this key will not be
// present in production.
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const CACHE_PREFIX = "explanation_v1_";

export interface ExplanationStep {
  title: string;
  content: string; // HTML content with LaTeX math
  highlights?: { text: string; color: "green" | "red" | "yellow" | "blue" }[];
  formula?: string; // LaTeX formula to display prominently
  eliminationChoices?: {
    label: string;
    text: string;
    eliminated: boolean;
    reason?: string;
  }[];
  desmosExpressions?: string[]; // LaTeX expressions to graph in an inline Desmos calculator
  desmosGraphs?: { label?: string; expressions: string[] }[]; // Multiple graphs rendered side-by-side (e.g., one per answer choice)
}

export interface ExplanationData {
  questionId: string;
  correctAnswer: string;
  steps: ExplanationStep[];
  generatedAt: number;
}

function getCacheKey(questionId: string): string {
  return `${CACHE_PREFIX}${questionId}`;
}

export function getCachedExplanation(_questionId: string): ExplanationData | null {
  // Caching disabled during development — always regenerate fresh
  return null;
}

function cacheExplanation(_data: ExplanationData): void {
  // Caching disabled during development
}

function buildPrompt(question: {
  section: string;
  passage: string;
  questionText?: string | null;
  choices?: { label: string; text: string }[];
  correctAnswer: string;
  domain?: string;
  skill?: string;
  difficulty?: string;
  isFillInBlank?: boolean;
}, hasImages = false): string {
  const choicesStr = question.choices
    ?.map(c => `${c.label}) ${c.text}`)
    .join("\n") ?? "(Free response)";

  const isMath = question.section === "Math";

  const mathMethodGuidance = isMath ? `
METHOD HIERARCHY (pick the FIRST one that applies — not "mention Desmos at the end"):
1. **Desmos graph** — quadratics, systems, inequalities, "for what x", exponential/log, word-problem equations. Graph it, read the answer off the graph.
2. **Desmos built-in stat functions** — any data set or list: $\\operatorname{mean}([...])$, $\\operatorname{median}([...])$, $\\operatorname{stdev}([...])$, $\\operatorname{stdevp}([...])$, $\\operatorname{var}([...])$, $\\operatorname{total}([...])$, $\\operatorname{length}([...])$, $\\operatorname{min}/\\operatorname{max}([...])$, $\\operatorname{quartile}([...], 1/3)$, $\\operatorname{sort}([...])$. IQR = $\\operatorname{quartile}([...],3) - \\operatorname{quartile}([...],1)$. **Inline the list literal** — never define a named list $L=[...]$ and reference it in a separate expression (each step's Desmos is isolated).
3. **Desmos custom regression** — unknown constants in an identity / "infinitely many solutions" / "true for all x" / coefficient matching. Recipe: $x_1=[1...100]$, rewrite the equation with $x_1$ for $x$ and "$\\sim$" for "$=$". Desmos solves every unknown parameter at once. Example: $\\frac{12x+28}{4} - \\frac{s}{13} = r(x-8)$ → desmosExpressions: ["x_1=[1...100]", "\\\\frac{12x_1+28}{4}-\\\\frac{s}{13}\\\\sim r(x_1-8)"] → Desmos returns $r$, $s$ directly.
4. **Desmos table regression** — points given in a table / "line through (a,b) and (c,d)" / "which function passes through these points". Recipe: $x_1=[...]$, $y_1=[...]$, $y_1 \\sim mx_1+b$ (line) or $\\sim ax_1^2+bx_1+c$ (parabola) or $\\sim a \\cdot b^{x_1}$ (exponential). Read coefficients.
5. **Shortcut from the index below** — apply the named shortcut as THE primary method.
6. **Smart substitution** — if a grouped expression like $(8x)$ or $(x+y)$ repeats, let $u=$ that group. Often the question asks for the group itself — you don't need individual values.
7. **Backsolving / picking numbers** — only when 1-6 don't fit.
8. **Algebraic method** — last resort, OR as a brief "Alternate (no calculator)" step AFTER a Desmos step.

Never lead with algebra if 1-4 applies. Never present Desmos as an afterthought ("we could also use Desmos"). The desmosExpressions array must appear in the FIRST computational step when Desmos applies.

EXPLANATION FLOW — pick whichever fits:
- **Find-first** (preferred for Desmos problems): find the answer directly, then briefly note mismatches on wrong choices.
- **Eliminate-then-confirm**: good for reading questions or when no single method finds the answer directly.

SAT MATH SHORTCUT INDEX (name the shortcut when you invoke it so the student learns the pattern):

**1. Discriminant** — "exactly one solution / tangent / intersects at one point" → $b^2-4ac=0$. "No real solutions" → $b^2-4ac<0$. Rearrange to $ax^2+bx+c=0$ and write discriminant immediately. Example: $7x^2+3=nx-4$ → $7x^2-nx+7=0$ → $n^2-196=0$ → $n=\\pm14$.

**2. Vertex symmetry** — vertex x is the midpoint of the two x-intercepts: $x_v=(x_1+x_2)/2$. Given vertex and one intercept: other intercept $=2x_v-x_{known}$. $f(a)=f(b)$ ⟹ axis of symmetry at $(a+b)/2$.

**3. Vieta's** — for $ax^2+bx+c=0$: sum of roots $=-b/a$, product $=c/a$. Don't solve the quadratic if the question asks for sum or product.

**4. Dimension scaling** — linear factor $k$ → lengths $\\times k$, areas $\\times k^2$, volumes $\\times k^3$. Similar figures, scale models, resized solids.

**5. Complementary angles** — $\\sin A=\\cos B$ ⟹ $A+B=90°$. $\\cos x=\\sin(90°-x)$. $(\\cos A)(\\sin B)+(\\sin A)(\\cos B)=\\sin(A+B)$.

**6. Circle equation** — $(x-h)^2+(y-k)^2=r^2$: center $(h,k)$, radius $r$. General form → complete the square on $x$ and $y$ separately. Trap: $(x+k)^2$ means center x is $-k$.

**7. Percent** — "$X$ is $m\\%$ of $Y$" → $m=100X/Y$. "$m\\%$ less/more" → $m=100(Y-X)/Y$ or $100(X-Y)/Y$. Exponential $A \\cdot b^x$: per-unit $\\%$ change $=(b-1)\\times100$. "$g$ increases $m\\%$ when $x$ increases by $n$" → $b^n=1+m/100$.

**8. Grouped expression** — if $(a-b)$, $(x+y)$, etc. repeats, let $u=$ that expression. Often the question asks for $u$ directly. Also: $(x+y)^2=x^2+2xy+y^2$ — if you know $x^2+y^2$ and $xy$, plug in.

**9. Absolute value** — $|\\text{expr}|\\geq0$ always. $|\\text{expr}|=$negative → no solution. $|\\text{expr}|=0$ → one solution.

**10. Unit conversion** — squared units: factor squared ($\\text{ft}^2\\to\\text{mi}^2$: $\\div 5280^2$). Cubic: factor cubed.

**11. Exponent rules** — "each increase of $1/k$ in $x$ multiplies by $c$" → exponent coefficient must be $1/k$ and base must be $c$. $a^{1/n}=b^m$ → $a=b^{mn}$.

**12. No-solution system** — same slope + different intercept = parallel = no solution. Or: ratio of $x$-coeffs = ratio of $y$-coeffs ≠ ratio of constants.

**13. Polygon angles** — interior sum $=(n-2)\\times180°$. Regular polygon each angle $=(n-2)\\times180°/n$.

**14. Equilateral triangle** — height $=s\\sqrt{3}/2$, circumradius $=s/\\sqrt{3}$, side from height $=2h/\\sqrt{3}$.

**15. Right triangle + circle** — inscribed in semicircle (diameter as side) → opposite angle is $90°$. Altitude to hypotenuse → three similar triangles.

**16. Exponential decay** — half-life: $f(t)=A(1/2)^{t/h}$. Match time units. Horizontal asymptote of $A\\cdot r^t+k$ is $k$.

**17. Backsolving** — factor problems: "has factor $(x-6)$" → plug $x=6$, check expr$=0$. "Which value satisfies" → test each choice.

**18. Mixture** — $A_1C_1+A_2C_2=A_{total}C_{total}$. One equation.

**19. Weighted mean** — $(n_1m_1+n_2m_2)/(n_1+n_2)$. Don't just average the means.

**20. Word-problem translation** — "$P$ dollars per $Q$ items" → rate $P/Q$. "$h$ hours at $R_1$ first-hour then $R_2$ per hour" → $R_2 h + (R_1-R_2)$.

**21. Cone slant height** — base area $=\\pi r^2$ → solve $r$; volume $=\\frac{1}{3}\\pi r^2 h$ → solve $h$; slant $=\\sqrt{r^2+h^2}$.

**22. Parallel lines + transversal** — 4 acute (equal) + 4 obtuse (equal), acute+obtuse $=180°$. Sum of all 8 = $1440°$. $k$ acute + $(8-k)$ obtuse simplifies with $a+(180-a)$.

**23. Three-point table → linear** — slope from any two rows, then substitute one point for $b$. Don't set up a system. For "$A/B$" in $Ax+By=C$: $A/B=-$slope.

**24. Exponential equivalent forms** — "displays factor $c$ per interval $k$" → exponent is $x/k$ with base $c$. Rewrite: $a^{bx}=(a^b)^x=(a^{1/n})^{nx}$.

**25. Infinitely many solutions** — coefficient matching: $a=c$ AND $b=d$ in $ax+b=cx+d$. Systems: one equation is a scalar multiple of the other. Or use Desmos custom regression (method 3 above).

**26. Sum/evaluate at special x** — need $a+b+c$? Plug $x=1$. $a-b+c$? Plug $x=-1$. $c$ alone? Plug $x=0$.

**27. Rational expressions** — common denominator. Parallel-resistor pattern: $1/R=1/a+1/b+1/c$ → $R=abc/(bc+ac+ab)$. Factor $x^2-y^2=(x+y)(x-y)$ first.

**28. Quadratic min/max** — at $x=-b/(2a)$, value $=c-b^2/(4a)$. Vertex form $a(x-h)^2+k$ displays min/max as $k$.

**29. Graph shifts** — $f(x-h)$: right by $h$. $f(x)+k$: up by $k$. Horizontal shifts are OPPOSITE sign from inside parens.

**30. Fraction coefficients** — multiply through by LCD first.

**31. Exponential per-unit multiplier** — $z(w)=b^{2w}$: when $w$ goes up by 1, $z$ multiplies by $b^2$, not $b$. Per-unit multiplier $=\\text{base}^{\\text{coeff of }w}$.

**32. Similar figures SA/volume** — linear factor $k$ → SA factor $k^2$, volume factor $k^3$. Given SA ratio: $k=\\sqrt{\\text{ratio}}$. Given volume ratio: $k=\\sqrt[3]{\\text{ratio}}$.

**33. Perpendicular slope** — $-1/m$.

**34. $\\tan B=$opp/adj** — given $\\tan B=1/k$ and opposite side $AC$: adjacent $BC=AC\\cdot k$.

**35. Max of $ac$** — for $ax^2+bx+c$ with real roots, $b^2-4ac\\geq0$ ⟹ $ac\\leq b^2/4$.` : "";


  const readingGuidance = !isMath ? `
READING/WRITING APPROACH:

**Step 1 — name the question type** (one line in the first step). Different types have different recipes:
- **Central idea / main purpose** — what is the passage *doing* (arguing, describing, comparing, qualifying)? Prioritize the claim in the last sentence of argumentative passages.
- **Inference / "most strongly suggests"** — the answer must be DIRECTLY supported by the text. If it requires outside knowledge or a logical leap, it's wrong.
- **Evidence-support pair (Command of Evidence)** — name the claim being supported, then check which quote most DIRECTLY establishes that claim. Reject quotes that are merely topical.
- **Text-completion / logical conclusion** — the blank must follow from the premises. Identify the transition word ("however", "because", "thus") — it dictates the logical relationship.
- **Words in context** — plug each choice into the sentence and check fit with tone AND precise meaning. Eliminate near-synonyms that have wrong connotation.
- **Transitions** — find the relationship between the two sentences (contrast, cause, example, addition, concession). Only one transition word matches.
- **Rhetorical synthesis / notes questions** — the bullet points are the ONLY evidence. Match the goal stated in the prompt (e.g. "emphasize a similarity"). Eliminate answers that use bullets but don't meet the goal.
- **Grammar (boundaries, agreement, modifiers)** — apply the rule mechanically: subject-verb agreement, pronoun antecedent, comma-splice test, modifier-noun proximity. Name the rule.

**Step 2 — quote the text**. Every claim about the passage must include a short quoted phrase (use \`"..."\` quotes). Never paraphrase-as-proof. Point to the exact words.

**Step 3 — find the answer directly from that quote**, OR walk through all four choices when no single phrase nails it. Use whichever path is cleaner.

**Step 4 — eliminate the other three with one crisp reason each**:
- **Out of scope** — introduces something the passage never discusses.
- **Opposite** — says the reverse of what the text says.
- **Too extreme / absolute** — "always", "never", "must" when the text hedges.
- **Partially true / half-right** — one clause correct, another contradicts the passage.
- **Distortion** — uses the passage's words to make a different claim.
Name the flaw type when you eliminate — students learn to spot the pattern.

**Common traps to flag explicitly**:
- Tempting answer that restates a DETAIL when the question asks for the MAIN idea.
- Answer that would be true in real life but is not supported by THIS passage.
- Answer that matches the tone but overstates the claim.` : "";

  const imageAnalysis = !hasImages ? "" : `

**IMAGE ANALYSIS — CRITICAL INSTRUCTIONS:**
The attached image(s) ARE part of the question and are ESSENTIAL to solving it. You MUST analyze them thoroughly.

STEP-BY-STEP IMAGE READING PROTOCOL:
1. **Identify the image type**: geometric figure, graph/chart, data table, coordinate plane diagram, or annotated figure.
2. **Extract EVERY labeled value**: angles, side lengths, variables, coordinates, axis labels, data points, cell values. Miss nothing — every number and label was placed deliberately.
3. **Identify special markings**: right angle symbols (square corner = 90 degrees, use Pythagorean theorem), tick marks (equal lengths), parallel arrows (use alternate interior / corresponding angle theorems), dashed lines (auxiliary constructions).
4. **State what you see** before solving: "The figure shows a right triangle with legs A and B, hypotenuse 56, and an angle x degrees at..."

COMMON SAT IMAGE TYPES AND HOW TO HANDLE THEM:
- **Right triangles**: Look for the right angle symbol. Extract all labeled sides/angles. Check for altitude to hypotenuse (creates similar triangles). Apply Pythagorean theorem or trig ratios.
- **Parallel lines cut by transversal**: Identify which lines are parallel (arrow markings). Use alternate interior angles (equal), corresponding angles (equal), co-interior angles (sum to 180).
- **Circles**: Check for diameter (angle inscribed in semicircle = 90 degrees), chords, tangent lines, central vs. inscribed angles. Extract radius, center, and any labeled arc measures.
- **Coordinate plane graphs**: Read intercepts, vertices, intersection points precisely. Note the scale of each axis.
- **Frequency/data tables**: Extract EVERY cell value. Compute statistics carefully. When tables appear in answer choices, you must analyze each one.
- **Bar charts / scatter plots**: Read axis scales carefully. Estimate data point values precisely.

CRITICAL WARNINGS:
- Do NOT assume values that aren't labeled — if a side isn't labeled, don't guess its length.
- Do NOT confuse which angle or side a label refers to — trace the label to its exact location.
- Geometric figures are NOT drawn to scale unless stated. Use labeled values, not visual estimates.
- If answer choices contain images (like tables), analyze EACH choice image systematically.`

  return `You are an expert SAT tutor creating a thorough, practical step-by-step explanation. Your goal is to teach the FASTEST and EASIEST method AND explain WHY it works so the student truly understands.

SOLVE FORWARD, NOT BACKWARD:
Reason through this problem as if solving it for the first time. Arrive at the answer through genuine step-by-step reasoning. Never write "the correct answer is X, let's see why", "start with choice X", or anything that reveals/assumes the answer before your reasoning produces it. If your reasoning produces an answer that is NOT ${question.correctAnswer}, your reasoning is wrong — silently fix it and produce a clean forward explanation. Never mention this instruction or the expected answer in the output.

QUESTION DETAILS:
- Section: ${question.section}
- Domain: ${question.domain || "N/A"}
- Skill: ${question.skill || "N/A"}
- Difficulty: ${question.difficulty || "N/A"}

PASSAGE/QUESTION:
${question.passage}
${question.questionText ? `\nQuestion: ${question.questionText}` : ""}

ANSWER CHOICES:
${choicesStr}
${mathMethodGuidance}${readingGuidance}${imageAnalysis}

Create a step-by-step walkthrough. Return ONLY valid JSON (no markdown fences, no commentary) as an array of step objects.

RULES:
1. **2-5 steps, never padded**. As FEW as the problem needs. Simple problem (parallel lines → no solution) = 2 steps. Complex multi-part = 5. Each step introduces NEW information — never restate a prior step's fact, conclusion, or observation. If Step 1 says "slopes are equal", Step 2 must not repeat it. The student reads every step.
2. LaTeX: $...$ inline, $$...$$ display. Never put LaTeX in title strings. Never use \\textbf.
3. **Step titles** = short plain-text action phrases ("Set Up the Equation", "Graph in Desmos", "Read the Answer from the Graph").
4. **FORWARD-ONLY EXPLANATION — no backtracking, no re-derivation, no second-guessing.** One confident path. If mid-solution something doesn't line up, resolve it silently — never write "let me re-examine", "wait, let's re-check", "actually, reconsider", "on second thought", "hmm, that doesn't match", "it seems there might have been a misreading/miscalculation", or "there may be an error in the answer choices". Once a choice is eliminated, do NOT re-list, re-test, re-plot, or re-mention it. Never hedge: no "suggests", "may", "might", "could", "appears to", "seems to", "it looks like", "possibly", "potentially". State facts directly.
5. **FINAL STEP = CONFIRMATION ONLY.** Addresses the correct answer only — never revisits incorrect choices. Tie result to the label: "The answer is 3, which matches choice C — <strong>C</strong> is correct." For free-response, state the value.
6. ${isMath ? "Use the formula field for the key equation when one applies." : "Use HTML emphasis (<strong>, <em>) on key words/phrases from the passage."}
7. **Elimination inline**: put choice elimination reasoning in the step content as a bullet list, not in a separate step.
8. **Tone**: direct, precise, tutor-like. No emojis, no filler ("Great question!", "Let's dive in!"), no cheerleading. Name the shortcut explicitly ("This is a Discriminant Shortcut problem").
9. **DEPTH — WHY not just WHAT**. Bad: "Solve for $x$ to get $x=3$." Good: "The x-intercept is where $y=0$, so the graph crossing at $x=3$ means $x=3$ satisfies the original equation."
10. **DESMOS IS MANDATORY FOR MATH.** Whenever the problem involves equations, functions, systems, inequalities, quadratics, polynomials, statistics, or data sets — include a "desmosExpressions" array. The calculator renders inline. Quadratic: graph $y=x^2-5x+6$ and read zeros (don't factor). System: graph both sides and read the intersection. Statistics: use built-ins with inline list literals — $\\operatorname{mean}([3,7,11,15,20])$, $\\operatorname{median}([...])$, $\\operatorname{stdev}([...])$, $\\operatorname{quartile}([...],1)$. PASS THE LIST LITERAL DIRECTLY — never define a named list $L=[...]$ and reference it separately (each step's Desmos is isolated; named lists do NOT carry across steps). Tell the student what to look for ("the x-intercepts", "the intersection point"). Treat the Desmos answer as definitive — no hedging.
11. **MULTIPLE DESMOS GRAPHS (desmosGraphs)** — use ONE GRAPH PER CHOICE when evaluating 2+ answer choices that each consist of equations. Short labels ("Choice A", "Choice B"). Use desmosGraphs OR desmosExpressions per step, not both:
"desmosGraphs": [
  {"label": "Choice A", "expressions": ["8x+4y=32", "-10x-4y=-64"]},
  {"label": "Choice B", "expressions": ["8x-4y=32", "-10x+4y=-64"]}
]
12. **TERSE CHOICE EVALUATION.** When comparing choices to a graph, DO NOT write a paragraph per choice — the graphs already show it. Bullet list, ≤15 words per wrong choice:
<ul>
<li><strong>A</strong>: y-intercepts (8, 16) — don't match (3.2, 6.4). Eliminate.</li>
<li><strong>B</strong>: y-intercepts negative — don't match. Eliminate.</li>
<li><strong>D</strong>: y-intercepts 3.2 and 6.4, x-intercept 8. <strong>Matches.</strong></li>
</ul>
13. **NO DUPLICATE FORMULAS**: if a formula is in the "formula" field, do NOT also write it in "content". Reference it conceptually ("using the probability formula below").
14. **NO IMAGES IN EXPLANATION**: don't reference, describe, or re-include question images — the student already sees them.

15. **VISUAL FORMATTING — NO WALLS OF TEXT.** Content renders as HTML:
- **Display math per manipulation**: every algebraic step on its own $$...$$ line. Each consecutive line must be the RESULT of a concrete operation (substitute, expand, combine). NEVER output the same equation twice in a row, and never restate an equation in prose AND in display math — pick one.
- **Short lines**: 1-2 sentences, then <br/><br/>. Never 3+ sentences without a break.
- **Bullet lists** (<ul><li>...</li></ul>) for observations, conditions, choice comparisons.
- **Callouts** for key insights: \`<div class="callout"><strong>Key Insight:</strong> ...</div>\` or \`<div class="callout-tip"><strong>SAT Shortcut:</strong> ...</div>\`.
- **Arrows** for flow: \`<span class="arrow">→</span>\` or \`<span class="arrow">⟹</span>\`.
- **<hr/>** between distinct logical blocks. **<strong>** liberally for key terms and final values.
- **Show, don't tell**: final numeric answer goes in a display-math block or callout, never buried in prose.

16. **BATCH CHECKING.** When testing multiple values (points against an inequality, plugging in choices), group into a single compact bulleted block — never one paragraph per value. Mark results with [PASS]/[FAIL]. Example:
<ul>
<li>$(440, 0)$: $2(440) - 0 = 880$ <span class='arrow'>→</span> $880 < 883$ [FAIL]</li>
<li>$(441, -2)$: $2(441) + 2 = 884$ <span class='arrow'>→</span> $884 > 883$ [PASS]</li>
<li>$(442, -4)$: $2(442) + 4 = 888$ <span class='arrow'>→</span> $888 > 883$ [PASS]</li>
</ul>
<strong>Not all points pass</strong> <span class='arrow'>→</span> eliminate Choice A. When multiple choices need checking, one compact block per choice — don't sprawl each point into its own paragraph or step.

JSON SCHEMA for each step:
{
  "title": "Short descriptive title (plain text, no LaTeX)",
  "content": "Explanation using HTML. Use <strong> for emphasis, <br/> for line breaks. Use $...$ for inline math and $$...$$ for display math. Be thorough but clear.",
  "formula": "$$key equation$$ (optional — do NOT repeat this formula in the content field)",
  "desmosExpressions": ["y=2x+3", "y=-x+9"] (optional — Desmos LaTeX expressions to graph in a single calculator. Use this whenever the step involves graphing, visualizing equations, systems, inequalities, parabolas, or any function. Use Desmos-compatible LaTeX: e.g. "y=2x+3", "x^2+y^2=25", "y=\\sin(x)", "y\\ge 2x-1". Do NOT wrap in $...$ delimiters — just the raw Desmos LaTeX.),
  "desmosGraphs": [{"label": "Choice A", "expressions": ["8x+4y=32","-10x-4y=-64"]}, {"label": "Choice B", "expressions": ["8x-4y=32","-10x+4y=-64"]}] (optional — multiple side-by-side Desmos calculators. Use this INSTEAD of desmosExpressions when comparing 2+ answer choices that each consist of equations. One graph per choice. Keep labels short.)
}

FEW-SHOT EXAMPLE (2-step response — matches the tone, density, and Desmos-first approach expected):
[
  {
    "title": "Recognize the Discriminant Shortcut",
    "content": "The system $f(x) = 7x^2 + 3$ and $g(x) = nx - 4$ intersects at <strong>exactly one point</strong> — classic <strong>discriminant shortcut</strong>.<br/><br/>Set the equations equal and collect to one side:<br/>$$7x^2 + 3 = nx - 4$$<br/>$$7x^2 - nx + 7 = 0$$<br/><br/>One solution <span class='arrow'>⟹</span> discriminant $= 0$.",
    "formula": "$$b^2 - 4ac = 0$$"
  },
  {
    "title": "Graph in Desmos and Confirm",
    "content": "Plotting $7x^2 - nx + 7 = 0$ as a function of $n$, the parabola is tangent to the x-axis at $n = \\pm 14$ — so the discriminant vanishes at exactly those two values.<br/><br/>Algebraically: $(-n)^2 - 4(7)(7) = 0$ <span class='arrow'>⟹</span> $n^2 = 196$ <span class='arrow'>⟹</span> $n = \\pm 14$.<br/><br/><div class='callout'>The answer is <strong>$n = \\pm 14$</strong>, which matches choice <strong>C</strong>.</div>",
    "desmosExpressions": ["y=7x^2-nx+7", "n=14"]
  }
]

Notice: no hedging, no backtracking, shortcut named explicitly, Desmos used on first computational step, final step confirms only the correct answer, display math for each manipulation, visible HTML structure.

Return the JSON array directly: [{ step1 }, { step2 }, ...]`;
}

async function imageToBase64(url: string): Promise<string> {
  const absoluteUrl = url.startsWith("http") ? url : `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
  const response = await fetch(absoluteUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob).catch(() => null);
  if (!bitmap) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  // Upscale small images so the vision model sees more pixels (helps OCR of axis labels / intercepts).
  const TARGET_MIN = 1600;
  const longSide = Math.max(bitmap.width, bitmap.height);
  const scale = longSide < TARGET_MIN ? Math.min(3, TARGET_MIN / longSide) : 1;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/png");
}

const TEXT_MODEL = "qwen/qwen3-235b-a22b";
const VISION_MODEL = "google/gemini-2.5-pro";

export async function generateExplanation(
  questionId: string,
  question: {
    section: string;
    passage: string;
    questionText?: string | null;
    choices?: { label: string; text: string }[];
    correctAnswer: string;
    domain?: string;
    skill?: string;
    difficulty?: string;
    isFillInBlank?: boolean;
  },
  imageUrls?: string[],
): Promise<ExplanationData> {
  const hasImages = imageUrls && imageUrls.length > 0;
  const prompt = buildPrompt(question, !!hasImages);

  if (!OPENROUTER_API_KEY) {
    throw new Error("OpenRouter API key not configured. Set VITE_OPENROUTER_API_KEY in .env.");
  }

  // Build message content — multimodal if images exist, plain text otherwise
  let messageContent: string | { type: string; text?: string; image_url?: { url: string } }[];

  if (hasImages) {
    const parts: { type: string; text?: string; image_url?: { url: string } }[] = [
      { type: "text", text: prompt },
    ];
    for (const imgUrl of imageUrls) {
      try {
        const base64 = await imageToBase64(imgUrl);
        parts.push({ type: "image_url", image_url: { url: base64 } });
      } catch {
        // If image fails to load, skip it
      }
    }
    messageContent = parts;
  } else {
    messageContent = prompt + "\n\n/no_think";
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: hasImages ? VISION_MODEL : TEXT_MODEL,
      messages: [
        { role: "user", content: messageContent },
      ],
      temperature: 0.3,
      // Gemini 2.5 Pro burns output tokens on internal reasoning before emitting JSON,
      // so vision calls need a much higher ceiling than the text-only path.
      max_tokens: hasImages ? 16000 : 6000,
      stream: false,
      ...(hasImages ? { reasoning: { effort: "low" } } : {}),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content ?? "";

  // Parse JSON from response — handle thinking blocks, markdown fences, etc.
  let jsonStr = rawContent.trim();
  // Strip <think>...</think> blocks from reasoning models (greedy — can span many lines)
  jsonStr = jsonStr.replace(/<think>[\s\S]*?<\/think>/gi, "");
  // Strip orphaned <think> or </think> tags (unclosed blocks)
  jsonStr = jsonStr.replace(/<\/?think>/gi, "");
  // Strip markdown code fences if present
  jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  jsonStr = jsonStr.trim();

  // Fix LaTeX commands that LLMs fail to double-escape for JSON.
  // \frac → JSON sees \f (form feed) + "rac"; \text → \t (tab) + "ext"; \quad → invalid \q.
  // Any backslash followed by 2+ letters is a LaTeX command — double-escape it.
  jsonStr = jsonStr.replace(/(?<!\\)\\([a-zA-Z]{2,})/g, '\\\\$1');

  let steps: ExplanationStep[];
  // First, try to extract the JSON array from anywhere in the response
  const arrayMatch = jsonStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
  const toParse = arrayMatch ? arrayMatch[0] : jsonStr;

  // Multi-stage JSON repair
  function repairAndParse(input: string): ExplanationStep[] {
    // Stage 1: direct parse
    try { return JSON.parse(input); } catch { /* continue */ }

    // Stage 2: basic cleanup — trailing commas, control chars
    let s = input
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/[\x00-\x1f]/g, (c) => c === "\n" ? "\\n" : c === "\t" ? "\\t" : c === "\r" ? "" : "");
    try { return JSON.parse(s); } catch { /* continue */ }

    // Stage 3: fix unescaped quotes inside string values
    // Walk through and escape quotes that appear inside JSON string values
    s = input;
    const chars: string[] = [];
    let inString = false;
    let escaped = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (escaped) {
        chars.push(c);
        escaped = false;
        continue;
      }
      if (c === '\\') {
        chars.push(c);
        escaped = true;
        continue;
      }
      if (c === '"') {
        if (!inString) {
          inString = true;
          chars.push(c);
        } else {
          // Check if this quote ends the string or is embedded
          // Look ahead: after optional whitespace, should see : , } ] or end
          const rest = s.slice(i + 1).trimStart();
          if (!rest || /^[,:}\]]/.test(rest)) {
            inString = false;
            chars.push(c);
          } else {
            // Embedded quote — escape it
            chars.push('\\"');
          }
        }
      } else {
        if (inString && (c === '\n' || c === '\r' || c === '\t')) {
          chars.push(c === '\n' ? '\\n' : c === '\r' ? '' : '\\t');
        } else {
          chars.push(c);
        }
      }
    }
    const repaired = chars.join('').replace(/,\s*([}\]])/g, "$1");
    try { return JSON.parse(repaired); } catch { /* continue */ }

    // Stage 4: extract individual step objects and rebuild array
    const stepMatches = [...input.matchAll(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g)];
    if (stepMatches.length > 0) {
      const stepsArr: ExplanationStep[] = [];
      for (const m of stepMatches) {
        try {
          const step = JSON.parse(m[0].replace(/,\s*([}\]])/g, "$1"));
          if (step.title && step.content) stepsArr.push(step);
        } catch { /* skip malformed step */ }
      }
      if (stepsArr.length > 0) return stepsArr;
    }

    throw new Error(`Failed to parse explanation JSON after all repair attempts`);
  }

  steps = repairAndParse(toParse);

  const explanationData: ExplanationData = {
    questionId,
    correctAnswer: question.correctAnswer,
    steps,
    generatedAt: Date.now(),
  };

  cacheExplanation(explanationData);
  return explanationData;
}

export function clearExplanationCache(questionId?: string): void {
  if (questionId) {
    localStorage.removeItem(getCacheKey(questionId));
  } else {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  }
}
