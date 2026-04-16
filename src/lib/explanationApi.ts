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
CRITICAL — DESMOS-FIRST APPROACH:
Your DEFAULT method for ANY math problem involving equations, functions, or expressions is to GRAPH IT IN DESMOS. Do NOT solve algebraically when Desmos can find the answer visually. The student has an interactive Desmos calculator embedded right in this explanation — use it.

**DESMOS IS MANDATORY** for these problem types (do NOT use algebra instead):
- Quadratics / polynomials → Graph the function, find zeros (x-intercepts) visually. Do NOT use the quadratic formula or factoring if you can just graph $y = ax^2 + bx + c$ and read the x-intercepts.
- Systems of equations → Graph both equations, find the intersection point. Do NOT solve by substitution/elimination.
- Linear equations → Graph to find x-intercepts, y-intercepts, slope visually.
- Inequalities → Graph both sides and show where one is above/below the other.
- "For what value of x..." → Graph the expression and find the relevant point (zero, max, min, intersection).
- Exponential/logarithmic → Graph and read key values off the graph.
- Word problems with equations → Translate to an equation, graph it, read the answer.
- Statistics (mean, median, quartiles) → Use Desmos built-in functions! Pass the list DIRECTLY as an argument: $\\operatorname{median}([3,7,11,15,20])$, $\\operatorname{mean}([3,7,11,15,20])$, $\\operatorname{stdev}([3,7,11,15,20])$, $\\operatorname{quartile}([3,7,11,15,20], 1)$. No intermediate variable required. These compute instantly — no manual calculation needed.

**DESMOS BUILT-IN STATISTICS FUNCTIONS (use these AGGRESSIVELY for data/stats problems):**
Desmos has built-in functions that make statistics problems trivial. Whenever a problem gives you a data set, list of values, or table of numbers, PASS THE LIST LITERAL DIRECTLY AS THE ARGUMENT — do NOT define a named list first. The functions accept a bracketed list argument:
   - $\\operatorname{mean}([1,2,3,4,5])$ — arithmetic mean (average)
   - $\\operatorname{median}([1,2,3,4,5])$ — median value
   - $\\operatorname{stdev}([1,2,3,4,5])$ — standard deviation
   - $\\operatorname{stdevp}([1,2,3,4,5])$ — population standard deviation
   - $\\operatorname{var}([1,2,3,4,5])$ — variance
   - $\\operatorname{total}([1,2,3,4,5])$ — sum of all values
   - $\\operatorname{length}([1,2,3,4,5])$ — count of values
   - $\\operatorname{min}([1,2,3,4,5])$, $\\operatorname{max}([1,2,3,4,5])$ — minimum and maximum
   - $\\operatorname{quartile}([1,2,3,4,5], 1)$ — first quartile (Q1)
   - $\\operatorname{quartile}([1,2,3,4,5], 3)$ — third quartile (Q3)
   - IQR = $\\operatorname{quartile}([\\ldots], 3) - \\operatorname{quartile}([\\ldots], 1)$
   - $\\operatorname{sort}([1,2,3,4,5])$ — sorted list

CRITICAL RULES FOR STATISTICS EXPRESSIONS:
1. **DO NOT define a named list like $L = [\\ldots]$ and then call $\\operatorname{median}(L)$ in a separate expression.** Each desmosExpressions array renders in an ISOLATED Desmos instance — one per step. A named list defined in an earlier step does NOT carry over to a later step, and even within a step it adds clutter. Always inline the list: $\\operatorname{median}([1,2,3])$.
2. **If you must introduce a named list** (e.g., you reference it in 3+ separate function calls in the same step), the list definition AND every expression that uses it MUST be in the SAME step's desmosExpressions array — never split across steps.
3. Tell the student exactly what to type. Example: "Type $\\operatorname{median}([12, 15, 18, 22, 25, 30])$ into Desmos — it instantly shows 20."
4. Include the desmosExpressions array with the inlined function call so the student sees it computed inline.
Do NOT manually calculate mean, median, standard deviation, or quartiles when Desmos can do it instantly. This is a HUGE time-saver on the SAT.

**TRUST DESMOS — IT IS YOUR PRIMARY SOLVER:**
When Desmos shows the answer (intersection point, x-intercept, computed value), that IS the answer. State it definitively: "The lines intersect at $(3, 5)$, so $x = 3$." Do NOT hedge with "this suggests", "this appears to show", or "this may indicate". Desmos is exact. After stating the Desmos answer, present an algebraic solution as an **alternate method** the student can use without a calculator — not because the Desmos answer needs verification, but to teach a second approach.

**How to present Desmos steps:**
1. Tell the student EXACTLY what to type into Desmos (e.g., "Type $y = x^2 - 5x + 6$ into Desmos")
2. Include the "desmosExpressions" array so the graph renders inline automatically
3. Explain WHAT to look for on the graph: "Look at where the curve crosses the x-axis — those are your solutions" or "Click on the intersection point — the x-coordinate is your answer"
4. Explain WHY this works: e.g., "The x-intercepts are where $y = 0$, which means $x^2 - 5x + 6 = 0$ — exactly what we need to solve"
5. After Desmos gives the answer, add a follow-up step: "Alternate method (without calculator):" and show the algebraic approach

**SMART VARIABLE SUBSTITUTION:**
Before doing any heavy algebra, look for grouped expressions you can treat as a single variable. For example, if you see $2(8x) + 4(7y) = 12$ and $-2(8x) + 4(7y) = 12$, notice that $8x$ and $7y$ appear as units everywhere. Let $a = 8x$ and $b = 7y$ — the system becomes $2a + 4b = 12$ and $-2a + 4b = 12$, which is trivially solvable by adding the equations. ALWAYS look for this kind of simplification before diving into complex algebra. The question often asks for the value of the grouped expression itself (e.g., "What is $8x + 7y$?"), so you may not even need to find $x$ and $y$ individually.

**Other methods (use only when Desmos doesn't apply):**
- **Plugging in answer choices (backsolving)** — For problems where graphing doesn't directly show the answer
- **Picking smart numbers** — For abstract/variable-heavy problems
- **Algebraic/traditional method** — Only when none of the above methods work

APPROACH VARIETY — DO NOT ALWAYS ELIMINATE:
You have TWO valid explanation flows. Choose whichever is more natural:
1. **Find-first**: Find the correct answer directly (e.g., via Desmos graph), confirm it works, then briefly note why other choices don't match.
2. **Eliminate-then-confirm**: Rule out wrong answers, then confirm the remaining one.
Use find-first whenever the answer can be found directly (which is most Desmos problems). Elimination is great for reading questions and problems where no single method finds the answer.

SAT MATH SHORTCUTS — YOU MUST USE THESE WHENEVER APPLICABLE (NON-NEGOTIABLE):
CRITICAL: Before solving ANY math problem, scan the list below. If a shortcut applies, you MUST use it as your PRIMARY method — not as an afterthought or "tip" at the end. Present the shortcut as THE way to solve the problem. Tell the student: "Here's the shortcut for this type of problem" and show them the fast path. The whole point of these explanations is to teach students the FASTEST approach. Never solve a problem the long way when a shortcut exists.

**1. DISCRIMINANT SHORTCUT (one solution / no solution / intersects at one point):**
If the problem says "exactly one solution", "intersects at one point", or "tangent to" → set discriminant = 0: $b^2 - 4ac = 0$.
If "no real solutions" → $b^2 - 4ac < 0$.
Do NOT solve the full quadratic. Rearrange into standard form $ax^2 + bx + c = 0$ and immediately write the discriminant equation. This is the FASTEST path for any problem about number of solutions or intersection conditions.
Example: "f(x) = 7x^2 + 3 and g(x) = nx - 4 intersect at one point" → 7x^2 - nx + 7 = 0, discriminant n^2 - 196 = 0, n = ±14.

**2. VERTEX SYMMETRY SHORTCUT (parabola x-intercepts):**
The vertex x-coordinate is the MIDPOINT of the two x-intercepts: $x_v = (x_1 + x_2) / 2$.
If you know the vertex x and one intercept, the other intercept = $2 \\cdot x_v - x_{known}$.
Also: $f(a) = f(b)$ means the axis of symmetry is at $x = (a + b) / 2$, which is also the midpoint of the x-intercepts.
Example: vertex at x=9, one intercept at x=41 → other intercept = 2(9) - 41 = -23. Done in one step.

**3. VIETA'S FORMULAS (sum/product of roots — NO solving needed):**
For $ax^2 + bx + c = 0$: Sum of roots = $-b/a$, Product of roots = $c/a$.
If the question asks "what is the sum/product of the solutions" — DO NOT use the quadratic formula. Just read off the coefficients.
If the question says "the product of the solutions is [expression]" — set $c/a$ equal to that expression and solve.
Example: $-25x^2 + 5ab \\cdot x + 25 = 0$, sum of solutions = $-5ab / -25 = ab/5$.

**4. DIMENSION SCALING SHORTCUT (similar figures, models, resized shapes):**
When linear dimensions scale by factor $k$:
- All lengths multiply by $k$
- All areas multiply by $k^2$
- All volumes multiply by $k^3$
This applies to similar figures, scale models, and resized cylinders/spheres/pyramids.
Example: "each side is 1/10 the length" → area is $(1/10)^2 = 1/100$ of the original.
Example: cylinder with "twice the radius and half the height" → $V = \\pi r^2 h$ scales by $2^2 \\times (1/2) = 2$.

**5. COMPLEMENTARY ANGLE SHORTCUT (sin/cos relationships):**
$\\sin(A) = \\cos(B)$ means $A + B = 90°$. Period. Just add the angle expressions and set equal to 90.
Also: $\\cos(x) = \\sin(90° - x)$ and vice versa.
Also: $(\\cos A)(\\sin B) + (\\sin A)(\\cos B) = \\sin(A + B)$. If A + B = 90°, this equals 1.
Do NOT solve trig equations — this identity gives the answer instantly.

**6. CIRCLE EQUATION SHORTCUTS:**
Standard form: $(x-h)^2 + (y-k)^2 = r^2$ → center $(h,k)$, radius $r$.
To convert general form $x^2 + y^2 + ax + by + c = 0$: complete the square on x terms and y terms separately.
To check if point lies on circle: substitute coordinates, verify equals $r^2$.
Key trap: $(x + k)^2$ means center x-coordinate is $-k$, not $k$.

**7. PERCENT SHORTCUTS:**
- "X is m% of Y" → $m = 100X / Y$
- "X is m% less than Y" → $m = 100(Y - X) / Y$
- "X is m% more than Y" → $m = 100(X - Y) / Y$
- Exponential $g(x) = A \\cdot b^x$: each unit increase in x multiplies by $b$, so the percent increase per unit = $(b - 1) \\times 100$%.
- "g(x) increases by m% when x increases by n" → $b^n = 1 + m/100$.
Example: $g(x) = 67(1.21)^x$ → each increase of 1 in x gives $1.21 - 1 = 0.21 = 21$% increase.

**8. GROUPED EXPRESSION / SUBSTITUTION SHORTCUT:**
If $(a-b)$, $(x+y)$, or any grouped expression appears multiple times, let $u =$ that expression and solve for $u$ directly.
CRITICAL: Often the question ASKS for the grouped expression itself — you don't need individual values.
Also: $(x+y)^2 = x^2 + 2xy + y^2$. If you know $x^2 + y^2$ and $xy$ separately, just plug in — don't solve for x and y.
Example: $x^2 + y^2 = c$ and $xy = 2c + 5$ → $(x+y)^2 = c + 2(2c + 5) = 5c + 10$.

**9. ABSOLUTE VALUE PROPERTIES:**
$|\\text{expr}| \\geq 0$ ALWAYS. So:
- $|\\text{expr}| = \\text{negative}$ → NO solution
- $|\\text{expr}| = 0$ → exactly ONE solution (the expr itself equals 0)
- $a - b|\\text{expr}| = c$ with $b > 0$: isolate $|\\text{expr}|$ first, check if result is negative
Example: $|x+7|/63 = m$ has one solution only when $m = 0$ (so $63m = 0$).

**10. UNIT CONVERSION FOR AREA AND VOLUME:**
- Square units: conversion factor SQUARED. $\\text{ft}^2$ to $\\text{mi}^2$ → divide by $5280^2$.
- Cubic units: conversion factor CUBED. $\\text{ft}^3$ to $\\text{yd}^3$ → divide by $3^3 = 27$.
- Convert BEFORE computing when possible — smaller numbers are easier.

**11. EXPONENT RULES FOR EQUIVALENT FORMS:**
- "Each increase of $1/k$ in x multiplies g(x) by factor c" → rewrite so the exponent has coefficient $1/k$, and the base IS $c$.
- $a^{1/n} = b^m$ → raise both sides to power $n$: $a = b^{mn}$.
- Convert between forms freely: $(b^2)^{x/2} = b^x$, $(b^3)^{x/3} = b^x$, etc.

**12. NO-SOLUTION SYSTEM SHORTCUT:**
Same slope + different intercept = no solution (parallel lines).
Quick check: write both equations as $y = mx + b$. If same $m$, different $b$ → no solution.
Or: if the ratio of x-coefficients equals ratio of y-coefficients but does NOT equal ratio of constants → no solution.

**13. POLYGON INTERIOR ANGLES:**
Sum of interior angles = $(n - 2) \\times 180°$.
Each angle of a REGULAR polygon = $(n - 2) \\times 180° / n$.

**14. EQUILATERAL TRIANGLE QUICK FACTS:**
Height $= (s\\sqrt{3}) / 2$ where $s$ is the side length.
Circumscribed circle radius $= s / \\sqrt{3} = s\\sqrt{3} / 3$.
Given height, side $= 2h / \\sqrt{3} = 2h\\sqrt{3} / 3$.

**15. RIGHT TRIANGLE & CIRCLE SHORTCUTS:**
- Triangle inscribed in semicircle (diameter is one side) → angle opposite the diameter is ALWAYS 90°.
- Altitude from right angle to hypotenuse creates two smaller triangles that are SIMILAR to each other and to the original.
- Pythagorean theorem: know any two sides → third side instantly.

**16. EXPONENTIAL GROWTH/DECAY TIME CONVERSION:**
Half-life problems: $f(t) = A(1/2)^{t/h}$ where $h$ is the half-life period.
CRITICAL: Match time units! If half-life is 6 hours but $t$ is in days → $t$ in days = $4$ half-lives per day → $(1/2)^{4n}$.
The "+k" constant in exponential decay (e.g., $60(0.97)^t + 22$) is the horizontal asymptote — the value approached as $t \\to \\infty$.

**17. BACKSOLVING (PLUG IN ANSWER CHOICES):**
When answer choices are simple numbers: try them. Start with B or C to narrow direction.
Especially powerful for:
- Factor problems: "has factor $(x-6)$" → plug in $x = 6$ and check if expression = 0.
- "Which value satisfies..." → just test each choice.
- Equations that are hard to solve algebraically but easy to verify.

**18. MIXTURE PROBLEMS:**
$A_1 C_1 + A_2 C_2 = A_{total} \\times C_{total}$
where $A$ = amount and $C$ = concentration.
Set up this single equation and solve — don't overthink the word problem.

**19. WEIGHTED MEAN:**
Mean of combined data = $(n_1 \\times m_1 + n_2 \\times m_2) / (n_1 + n_2)$.
Don't just average the two means — weight by sample size.

**20. WORD PROBLEM → EQUATION TRANSLATION:**
"$P$ dollars for every $Q$ items" → rate = $P/Q$ per item.
"Total cost for $h$ hours at first-hour rate $R_1$ and additional rate $R_2$" → $R_2 \\cdot h + (R_1 - R_2)$ for $h \\geq 1$.

**21. CONE SLANT HEIGHT (common 3-step recipe):**
Given volume and base area of a right circular cone:
Step 1: Base area $= \\pi r^2$ → solve for $r$.
Step 2: Volume $= \\frac{1}{3}\\pi r^2 h$ → solve for $h$.
Step 3: Slant height $= \\sqrt{r^2 + h^2}$.
This exact 3-step pattern appears repeatedly. Don't overthink it — just follow the recipe.

**22. PARALLEL LINES + TRANSVERSAL ANGLE SHORTCUT:**
When a transversal crosses two parallel lines, it forms 8 angles: 4 acute (all equal) and 4 obtuse (all equal).
Key facts:
- Any acute + any obtuse = 180°
- Sum of all 8 angles = 1440° (NOT 360° — that's only the angles around a single point)
- If acute angle = $a$, obtuse = $180 - a$
- "Sum of one acute + three obtuse" = $a + 3(180 - a) = 540 - 2a$
- "Sum of two acute + two obtuse" = $360°$ always
Don't set up angle equations — just use these identities directly.

**23. TABLE WITH THREE VALUES → LINEAR RELATIONSHIP:**
When a table shows three $(x, y)$ pairs and asks for slope, equation, or constants:
Fastest method: slope $= (y_2 - y_1)/(x_2 - x_1)$ from any two rows. Then plug one point into $y = mx + b$ to get $b$.
Do NOT set up a system of two equations — one slope calculation + one substitution is faster.
For "value of $A/B$" where $Ax + By = C$: $A/B = -\\text{slope}$.

**24. EXPONENTIAL "DISPLAYS VALUE AS BASE/COEFFICIENT":**
When asked "which equivalent form displays factor $c$ as base/coefficient":
- "Increases by factor $c$ every $k$ units of $x$" → the correct form has exponent $x/k$ and base $c$.
- Example: $f(x) = 2(8)^{3x}$. "Increases by factor $c$ every $1/3$ unit" → need exponent with coefficient $3$, so base $8$ is the answer. But "every $1$ unit" → need base $8^3 = 512$.
- Rewrite rule: $a^{bx} = (a^b)^x = (a^{1/n})^{nx}$. Match the exponent coefficient to $1/(\\text{interval})$.

**25. INFINITELY MANY SOLUTIONS (coefficient matching):**
For $ax + b = cx + d$ to have infinitely many solutions: $a = c$ AND $b = d$.
For systems: both equations must be scalar multiples of each other.
Method: expand both sides fully, then match coefficients on $x$ AND match constant terms. This gives two equations to solve for the unknown constant.
Common trap: equations like $a(7x - 14) + 5a = 7(ax - 2a) - 35$. Expand both sides, collect terms, match $x$-coefficients AND constant terms.

**26. "VALUE OF a + b + c" SHORTCUT (plug in x = 1):**
If expression $= \\frac{a}{k}x^2 + \\frac{b}{k}x + \\frac{c}{k}$ and you need $a + b + c$:
Plug $x = 1$ into the ORIGINAL expression, multiply by $k$. This gives $a + b + c$ directly without expanding.
Similarly: $a - b + c$ → plug in $x = -1$. And $c$ alone → plug in $x = 0$.
This avoids ALL expansion and simplification — just arithmetic.

**27. RATIONAL EXPRESSION SIMPLIFICATION (common denominator):**
For $\\frac{A}{X} - \\frac{B}{Y}$: multiply first fraction by $Y/Y$ and second by $X/X$.
Key pattern: $\\frac{1}{R} = \\frac{1}{a} + \\frac{1}{b} + \\frac{1}{c}$ (parallel resistors) → $R = \\frac{abc}{bc + ac + ab}$.
For difference of squares in denominator: $\\frac{A}{x^2 - y^2} = \\frac{A}{(x+y)(x-y)}$. Factor FIRST, then simplify.

**28. QUADRATIC MINIMUM/MAXIMUM (completing the square or vertex formula):**
Minimum of $ax^2 + bx + c$ (when $a > 0$): occurs at $x = -b/(2a)$, value $= c - b^2/(4a)$.
Maximum (when $a < 0$): same formulas.
Vertex form $a(x - h)^2 + k$: min/max value is $k$.
"Which form displays minimum as constant?" → the vertex form (completed square).

**29. GRAPH SHIFT / TRANSLATION RULES:**
$f(x - h)$: shifts RIGHT by $h$. $f(x + h)$: shifts LEFT by $h$.
$f(x) + k$: shifts UP by $k$. $f(x) - k$: shifts DOWN by $k$.
For circles: $(x + 6a)^2$ shifted right by $12a$ → $(x + 6a - 12a)^2 = (x - 6a)^2$.
Common trap: horizontal shifts are OPPOSITE sign from what's inside the parentheses.

**30. FRACTION COEFFICIENT EQUATIONS (clear fractions first):**
When an equation has fractions like $\\frac{3}{19}rx + \\frac{s}{8} = 10 - \\frac{5}{57}x$:
Multiply EVERYTHING by the LCD to clear all fractions BEFORE solving.
This turns messy fraction arithmetic into clean integer arithmetic.
For "no solution": after clearing fractions, $x$-coefficients must be equal (so $x$ cancels) but constants must differ.

**31. EXPONENTIAL PERCENT DECREASE:**
$z(w) = (b)^{2w}$ decreases by $p$% per unit increase in $w$:
When $w$ increases by 1: $z$ multiplies by $b^2$.
So decrease $= 1 - b^2$ and $p = (1 - b^2) \\times 100$.
Common mistake: using $b$ instead of $b^2$ when the exponent has a coefficient.
Rule: effective per-unit multiplier = $\\text{base}^{\\text{coefficient of } w}$.

**32. SIMILAR FIGURES → SURFACE AREA AND VOLUME RATIOS:**
If linear scale factor is $k$ (ratio of corresponding lengths):
- Surface area ratio = $k^2$
- Volume ratio = $k^3$
If only surface areas given: $k = \\sqrt{SA_2 / SA_1}$, then volume ratio $= k^3$.
If only volumes given: $k = \\sqrt[3]{V_2 / V_1}$, then surface area ratio $= k^2$.
This is a multi-step version of shortcut #4 — very common in harder problems.

**33. PERPENDICULAR SLOPES:**
If line A has slope $m$, a perpendicular line has slope $-1/m$.
Slope from two points: $m = (y_2 - y_1)/(x_2 - x_1)$.
After finding perpendicular slope, use point-slope form with the intersection point.

**34. RIGHT TRIANGLE: tan B = opposite/adjacent:**
When given "tan B = 1/k" and side AC (opposite to B):
- BC (adjacent to B) = AC × k (since tan B = AC/BC, so BC = AC/tan B = AC × k).
- Or: BC = AC / tan B.
This pattern appears repeatedly with tan B = 1/3, 1/9, etc. Just divide/multiply.

**35. QUADRATIC WITH PARAMETER: "greatest possible value of ac":**
For $ax^2 + bx + c$ with $px + q$ as a factor ($p, q$ positive):
If $px + q$ is a factor, other factor = $rx + s$ where $pr = a$, $qs = c$, $ps + qr = b$.
Maximize $ac = pr \\times qs$. Use AM-GM or test factor pairs of $b$.
Key insight: $ac$ is maximized when the two roots are as close together as possible (discriminant near 0), so $b^2 - 4ac \\geq 0$ gives $ac \\leq b^2/4$, greatest integer value = $\\lfloor b^2/4 \\rfloor$.` : "";

  const readingGuidance = !isMath ? `
APPROACH FOR READING/WRITING:
1. Start by identifying what the question is really asking (main idea, inference, evidence, vocabulary in context, etc.)
2. Point to SPECIFIC lines/phrases from the passage as evidence — use the highlights field
3. Show why the correct answer is supported by the text
4. Eliminate wrong answers by showing how they contradict or aren't supported by the passage
5. For vocabulary-in-context questions, show how substituting the answer word into the sentence makes sense` : "";

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

CRITICAL INSTRUCTION — SOLVE FORWARD, NOT BACKWARD:
You must reason through this problem as if you are solving it for the first time. Work through the logic step by step and ARRIVE at the answer through genuine reasoning. Do NOT:
- Say "the correct answer is X, let's see why"
- Say "Start with choice X since it's correct"
- Assume or reveal which answer is correct before your reasoning leads there
- Work backwards from the answer to justify it

Instead, solve the problem naturally. At the end, after your reasoning identifies the answer, confirm it.
(For verification only — the expected answer is ${question.correctAnswer}. If your reasoning leads elsewhere, re-examine your work. NEVER mention this verification note in the explanation.)

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
1. Use 2-5 steps — as FEW as the problem naturally requires. Do NOT pad to hit a minimum. A simple problem (e.g., two parallel lines → no solution) might need only 2 steps. A complex multi-part problem might need 5. Let the problem's complexity determine the step count. Each step must introduce NEW information or reasoning — never repeat what a previous step already said.
2. **ZERO REPETITION**: Never restate the same fact, conclusion, or observation across multiple steps. If Step 1 says "the slopes are equal", Step 2 must NOT say "since the slopes are equal" again. Each step moves the reasoning FORWARD. If you find yourself writing something a previous step already covered, skip it and move on. The student reads every step — they remember what you said.
3. Use LaTeX math: $...$ for inline, $$...$$ for display math. Make sure LaTeX renders correctly — do NOT put LaTeX inside title strings unless necessary, and never use raw LaTeX commands like \\textbf in titles.
4. Step titles should be SHORT and descriptive plain text (e.g., "Set Up the Equation", "Graph in Desmos", "Read the Answer from the Graph"). Avoid LaTeX in titles.
5. The final step must clearly confirm the correct answer AND explain why it's correct — not just state it. **THE FINAL STEP IS CONFIRMATION ONLY — IT MUST ONLY ADDRESS THE CORRECT ANSWER.** Never re-check, re-examine, re-graph, or re-mention the incorrect choices in the final step. Once a choice has been eliminated in an earlier step, it is DONE — do not revisit it. The final step's job is to show why the correct choice works, full stop.
5a. **NO BACKTRACKING, NO RE-DERIVATION**: If midway through solving you realize something doesn't line up, DO NOT write a "let me re-examine", "let me re-evaluate", "wait, let's look again", or "re-graph the original choices" passage. Resolve the confusion silently — only the correct reasoning path appears in the final explanation. The student must never see you second-guess yourself or re-walk choices you already eliminated. Treat each step as immutable: once written, its conclusions stand. Never produce a step whose purpose is to redo what an earlier step did.
5b. **NO REPEATED ELIMINATION PASSES**: You eliminate each incorrect choice AT MOST ONCE, in the step where it is first ruled out. You never re-list, re-test, or re-plot an already-eliminated choice in a later step. If you find yourself about to write "Let's check the answer choices again" — STOP. That is forbidden. Move directly to confirming the correct answer.
6. ${isMath ? "Include a formula field with key equations when relevant." : "Include text highlights showing key evidence from the passage."}
7. Answer elimination: put any elimination reasoning directly in the step content using HTML lists. Do NOT use the "eliminationChoices" field — it is deprecated.
8. Write for a student who needs to learn the fastest approach, not the most formal one. Be direct and precise. No emojis. No filler phrases. No encouragement or cheerfulness. No "Great question!" or "Let's dive in!" or "You've got this!" — just explain the method and the reasoning. **ALWAYS lead with the shortcut when one applies** — name the shortcut explicitly (e.g., "This is a Discriminant Shortcut problem" or "Use Desmos's built-in median() function here") so the student learns to recognize the pattern. If a Desmos built-in function (mean, median, stdev, quartile, total, etc.) can solve or simplify the problem, you MUST show it.
8. When showing math work, show each algebraic step on its own line using $$...$$ display math so it's easy to follow.
9. **DEPTH IS CRITICAL**: Every step must explain WHY, not just WHAT. Bad: "Solve for x to get x = 3." Good: "Since the x-intercept is where the graph crosses the x-axis (where $y = 0$), we can read directly from the graph that $x = 3$. This means when we plug 3 into the original equation, the output is zero — exactly what the question asks for."
10. **DESMOS IS MANDATORY FOR MATH**: Whenever the problem involves equations, functions, systems, inequalities, quadratics, polynomials, statistics, data sets, or anything graphable/computable — include a "desmosExpressions" array. An interactive Desmos calculator renders inline automatically. The student can interact with it. Use this AGGRESSIVELY. For a quadratic like $x^2 - 5x + 6 = 0$, do NOT factor — graph $y = x^2 - 5x + 6$ and find the zeros. For a system, graph both lines and find the intersection. For statistics, enter the data as a list and use mean()/median()/stdev()/quartile(). Examples: ["y=2x+3","y=-x+9"], ["y=x^2-4x+3"], ["y\\ge 2x-1","y\\le -x+5"], ["\\operatorname{mean}([3,7,11,15,20])","\\operatorname{median}([3,7,11,15,20])"]. For statistics, PASS THE LIST LITERAL DIRECTLY — never define a named list like L=[...] in one expression and reference L in another; each step is an isolated Desmos instance, and named lists do NOT carry across steps.
11. When using Desmos, explicitly tell the student what to look for: "Look at the x-intercepts", "Click the intersection point", "Find where the curve is below the x-axis", etc.
12. **TRUST THE DESMOS ANSWER**: When Desmos shows an answer (intersection point, x-intercept, value), state it as fact. Do NOT hedge with "this suggests", "this may indicate", "it appears that", etc. The graph IS the answer — state it definitively: "The intersection is at $(3, 5)$, so $x = 3$." After presenting the Desmos solution, you may OPTIONALLY show the algebraic method as an **alternate approach** in a later step, clearly labeled (e.g., "Alternate: Algebraic Method"). But the Desmos answer comes first and is treated as definitive.
13. **NO VAGUE OR HEDGING LANGUAGE — EVER**: Never use words like "suggests", "may", "might", "could", "appears to", "seems to", "it looks like", "possibly", "potentially", "this indicates that". State facts directly. BAD: "This suggests the system has no solution." GOOD: "The lines are parallel — the system has no solution." BAD: "The graph appears to show the answer is 5." GOOD: "The graph shows the answer is 5."
14. **NO DUPLICATE FORMULAS**: If you include a "formula" field for a step, do NOT also write that same formula in the "content" field. The formula field renders as a nicely formatted display block — writing it again in content is redundant. The content should reference the formula conceptually (e.g., "Using the probability formula below...") but never repeat it verbatim.
15. **NO IMAGES IN EXPLANATION**: Do NOT reference, describe, or re-include any images from the question in your explanation. The student can already see the question images — focus purely on the solution logic.
16. **NO HIGHLIGHTS**: Do not include the "highlights" field. It is deprecated and will be ignored.

17. **VISUAL FORMATTING — THIS IS CRITICAL. DO NOT WRITE WALLS OF TEXT.**
Your content is rendered as HTML inside a styled container. Use these formatting tools aggressively to break up text:

- **Display math for EVERY equation**: Never write equations inline when they represent a step. Put every equation/computation on its own display line with $$...$$. Each algebraic manipulation = its own $$ block. Example:
  $$2x + 5 = 17$$
  $$2x = 12$$
  $$x = 6$$

- **Short lines, not paragraphs**: Each idea = 1-2 sentences max, then a <br/><br/>. NEVER write 3+ sentences in a row without a visual break.

- **Use bullet lists** (<ul><li>...</li></ul>) when listing observations, conditions, or things to notice. Lists are much easier to scan than prose.

- **Use callout boxes** for key insights or shortcuts:
  <div class="callout"><strong>Key Insight:</strong> The discriminant tells us the number of solutions without solving.</div>
  <div class="callout-tip"><strong>SAT Shortcut:</strong> When a problem says "exactly one solution", jump straight to $b^2 - 4ac = 0$.</div>

- **Use arrows** to show logical flow: <span class="arrow">→</span> or <span class="arrow">⟹</span>

- **Use <hr/> separators** between distinct logical blocks within a step.

- **Use <strong> liberally** for key terms, answer values, and important words.

- **Show, don't tell**: If the answer is a number, put it in a prominent display-math block, not buried in a sentence. If there's a formula, show it in a formula box, don't just describe it.

BAD content example (wall of text):
"We need to find the value of x. The equation is 2x + 5 = 17. First we subtract 5 from both sides to get 2x = 12. Then we divide both sides by 2 to get x = 6. So the answer is 6."

GOOD content example (visual, scannable):
"We need to find $x$.<br/><br/>Subtract 5 from both sides:<br/>$$2x + 5 = 17$$<br/>$$2x = 12$$<br/><br/>Divide by 2:<br/>$$x = 6$$<br/><br/><div class='callout'>The answer is <strong>6</strong>.</div>"

18. **BATCH CHECKING — GROUP COMPUTATIONS TOGETHER:**
When testing multiple values (e.g., checking if points satisfy an inequality, plugging in answer choices), do NOT check each value in its own separate paragraph. Instead, group them into a single compact block using a list or aligned display math. Show all checks at once so the student sees the pattern.

BAD (one-at-a-time checking):
"For (440, 0): 2(440) - 0 = 880. Since 880 < 883, this does not satisfy the inequality.
For (441, -2): 2(441) - (-2) = 884. Since 884 > 883, this satisfies the inequality.
For (442, -4): 2(442) - (-4) = 888. Since 888 > 883, this satisfies the inequality."

GOOD (grouped checking):
"Check all points in Choice A:<br/>
<ul>
<li>$(440, 0)$: $2(440) - 0 = 880$ <span class='arrow'>→</span> $880 < 883$ [FAIL]</li>
<li>$(441, -2)$: $2(441) + 2 = 884$ <span class='arrow'>→</span> $884 > 883$ [PASS]</li>
<li>$(442, -4)$: $2(442) + 4 = 888$ <span class='arrow'>→</span> $888 > 883$ [PASS]</li>
</ul>
<strong>Not all points pass</strong> <span class='arrow'>→</span> eliminate Choice A."

This is much faster to scan. Use [PASS]/[FAIL] to mark results. When multiple answer choices need checking, dedicate one compact block per choice — don't sprawl each point into its own step or paragraph.

19. **NATURAL FLOW — NO PADDING STEPS:**
The explanation should feel like a concise tutor explaining the fastest path, not a textbook padding to fill pages. BAD 4-step example for "how many intersection points?":
  Step 1: "Graph both equations" → Step 2: "Both have slope 5 but different intercepts" → Step 3: "Same slope means parallel, parallel means no intersection" → Step 4: "Zero intersections, answer is A."
That's 4 steps saying ONE thing: same slope = parallel = 0 intersections. GOOD version (2 steps):
  Step 1: "Graph in Desmos" (with desmosExpressions) + "Both lines have slope 5 but different y-intercepts (10 vs -2). Same slope, different intercept = parallel lines."
  Step 2: "Parallel lines never intersect. The answer is 0."
Merge related observations into single steps. If a step's only content is restating the previous step's conclusion in different words, delete it.

JSON SCHEMA for each step:
{
  "title": "Short descriptive title (plain text, no LaTeX)",
  "content": "Explanation using HTML. Use <strong> for emphasis, <br/> for line breaks. Use $...$ for inline math and $$...$$ for display math. Be thorough but clear.",
  "formula": "$$key equation$$ (optional — do NOT repeat this formula in the content field)",
  "desmosExpressions": ["y=2x+3", "y=-x+9"] (optional — Desmos LaTeX expressions to graph. An interactive Desmos calculator will render inline with these expressions pre-loaded. Use this whenever the step involves graphing, visualizing equations, systems, inequalities, parabolas, or any function. Use Desmos-compatible LaTeX: e.g. "y=2x+3", "x^2+y^2=25", "y=\\sin(x)", "y\\ge 2x-1". Do NOT wrap in $...$ delimiters — just the raw Desmos LaTeX.)
}

Return the JSON array directly: [{ step1 }, { step2 }, ...]`;
}

async function imageToBase64(url: string): Promise<string> {
  const absoluteUrl = url.startsWith("http") ? url : `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
  const response = await fetch(absoluteUrl);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const TEXT_MODEL = "qwen/qwen3-235b-a22b";
const VISION_MODEL = "google/gemini-2.5-flash";

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
    throw new Error("OpenRouter API key not configured. Add VITE_OPENROUTER_API_KEY to .env");
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
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "1600 Prep Hub",
    },
    body: JSON.stringify({
      model: hasImages ? VISION_MODEL : TEXT_MODEL,
      messages: [
        { role: "user", content: messageContent },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      stream: false,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} — ${err}`);
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
