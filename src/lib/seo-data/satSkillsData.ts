import type { MathSkill, EnglishSkill } from "@/data/questionCategories";

export interface SatSkill {
  slug: string;
  name: string;
  section: "Math" | "Reading & Writing";
  domain: string;
  officialSkill: MathSkill | EnglishSkill;
  shortDescription: string;
  description: string;
  keyTips: string[];
}

export const satSkills: SatSkill[] = [
  {
    slug: "linear-equations-one-variable",
    name: "Linear Equations in One Variable",
    section: "Math",
    domain: "Algebra",
    officialSkill: "Linear equations in one variable",
    shortDescription:
      "Solve, simplify, and manipulate single-variable linear equations on the SAT.",
    description:
      "Linear equations in one variable show up repeatedly on the Digital SAT Math section and are the foundation of the Algebra domain. Mastering this skill means being able to isolate variables, distribute, combine like terms, and solve equations that include fractions or decimals in under 40 seconds.",
    keyTips: [
      "Clear fractions early by multiplying both sides by the common denominator.",
      "Combine like terms before distributing when possible — it reduces errors.",
      "Double-check by substituting your solution back into the original equation.",
    ],
  },
  {
    slug: "linear-functions",
    name: "Linear Functions",
    section: "Math",
    domain: "Algebra",
    officialSkill: "Linear functions",
    shortDescription:
      "Interpret slope, intercepts, and rate of change for linear function models.",
    description:
      "Linear functions are the most common Algebra topic on the Digital SAT. You need to read slope and y-intercept out of tables, graphs, and verbal descriptions, and translate between those forms fluently — especially under word-problem pressure.",
    keyTips: [
      "Slope = change in output / change in input — use two clean points from a table or graph.",
      "y-intercept is the value of the function when the input variable equals zero.",
      "In word problems, label units on the slope and intercept before you solve.",
    ],
  },
  {
    slug: "linear-equations-two-variables",
    name: "Linear Equations in Two Variables",
    section: "Math",
    domain: "Algebra",
    officialSkill: "Linear equations in two variables",
    shortDescription:
      "Slope, intercepts, and lines in standard, slope-intercept, and point-slope form.",
    description:
      "Two-variable linear equations are everywhere on the Digital SAT. You need to move fluidly between slope-intercept, standard, and point-slope form, and be comfortable finding slopes and intercepts directly from an equation or a graph.",
    keyTips: [
      "Memorize all three forms and how to convert between them.",
      "Perpendicular slopes are negative reciprocals — missing this costs easy points.",
      "When a question gives you two points, write out slope before touching y-intercept.",
    ],
  },
  {
    slug: "systems-of-linear-equations",
    name: "Systems of Linear Equations",
    section: "Math",
    domain: "Algebra",
    officialSkill: "Systems of two linear equations in two variables",
    shortDescription:
      "Solve two-equation systems with substitution, elimination, or graphing.",
    description:
      "Systems of linear equations questions on the Digital SAT often involve solving for one variable or identifying when a system has no solution or infinitely many solutions.",
    keyTips: [
      "Pick elimination when coefficients line up cleanly, substitution when one variable is already isolated.",
      "Parallel lines (same slope, different intercepts) = no solution.",
      "Same line (proportional coefficients and constant) = infinite solutions.",
    ],
  },
  {
    slug: "linear-inequalities",
    name: "Linear Inequalities",
    section: "Math",
    domain: "Algebra",
    officialSkill: "Linear inequalities in one or two variables",
    shortDescription:
      "Solve and interpret one- and two-variable linear inequalities.",
    description:
      "Linear inequality questions test the same algebra muscles as equations, but require careful attention to inequality flips when multiplying or dividing by negatives.",
    keyTips: [
      "Flip the inequality sign when you multiply or divide by a negative number.",
      "Graphing a system of inequalities = overlap of shaded half-planes.",
      "Always re-read to see whether the boundary line is included (≤, ≥) or excluded (<, >).",
    ],
  },
  {
    slug: "nonlinear-equations-and-systems",
    name: "Nonlinear Equations and Systems",
    section: "Math",
    domain: "Advanced Math",
    officialSkill:
      "Nonlinear equations in one variable and systems of equations in two variables",
    shortDescription:
      "Solve quadratic, radical, and absolute-value equations, plus mixed systems.",
    description:
      "Nonlinear equation questions ask you to find real solutions to quadratics, radicals, absolute value, and rational equations — and to handle systems where one equation is linear and the other is nonlinear. The Digital SAT likes to hide these as graph intersections.",
    keyTips: [
      "For quadratics, try factoring first; use the quadratic formula only when factoring stalls.",
      "Always check radical-equation solutions — extraneous roots are common.",
      "Linear-plus-nonlinear systems usually solve fastest by substitution.",
    ],
  },
  {
    slug: "nonlinear-functions",
    name: "Nonlinear Functions",
    section: "Math",
    domain: "Advanced Math",
    officialSkill: "Nonlinear functions",
    shortDescription:
      "Quadratic, exponential, and polynomial functions on the Digital SAT.",
    description:
      "Nonlinear function questions — especially quadratics and exponentials — appear at the top of the hard Module 2. You need to be able to factor, complete the square, use the vertex form, and interpret growth or decay rates.",
    keyTips: [
      "Memorize the vertex form: y = a(x − h)² + k lets you read the vertex directly.",
      "For exponential growth, identify the initial value and the growth/decay factor.",
      "Factor quickly: if a quadratic has ac with integer factor pairs, it factors.",
    ],
  },
  {
    slug: "equivalent-expressions",
    name: "Equivalent Expressions",
    section: "Math",
    domain: "Advanced Math",
    officialSkill: "Equivalent expressions",
    shortDescription:
      "Rewrite algebraic expressions without changing their value.",
    description:
      "Equivalent-expression questions test whether you can manipulate polynomial, rational, or radical expressions into a form that reveals a key feature (like a vertex, factor, or asymptote).",
    keyTips: [
      "Factor numerator and denominator of rational expressions before simplifying.",
      "Complete the square to expose a vertex; factor to expose roots.",
      "Test with a small integer if you're stuck choosing between equivalent forms.",
    ],
  },
  {
    slug: "ratios-rates-proportions",
    name: "Ratios, Rates, and Proportions",
    section: "Math",
    domain: "Problem-Solving and Data Analysis",
    officialSkill: "Ratios, rates, proportional relationships, and units",
    shortDescription:
      "Work with ratios, unit conversions, and proportional relationships.",
    description:
      "Ratios, rates, and proportions appear in word problems throughout both modules. The skill is about setting up a clean proportion and carefully tracking units.",
    keyTips: [
      "Write units beside every number — cancel units like variables.",
      "Cross-multiply only after you've verified the two ratios compare the same quantities.",
      "For percent change, use (new − old) / old × 100.",
    ],
  },
  {
    slug: "percentages",
    name: "Percentages",
    section: "Math",
    domain: "Problem-Solving and Data Analysis",
    officialSkill: "Percentages",
    shortDescription:
      "Percent of a value, percent change, and percent word problems.",
    description:
      "Percent questions on the Digital SAT are rarely hard mathematically but become hard when they layer percentages on percentages, or mix percent change with ratio language.",
    keyTips: [
      "Treat 'x percent of y' as (x/100) × y every time.",
      "Stacking discounts: apply each discount sequentially, not by summing percents.",
      "For percent change, watch carefully for 'from' vs 'to' — the base matters.",
    ],
  },
  {
    slug: "one-variable-data",
    name: "One-Variable Data: Distributions and Measures",
    section: "Math",
    domain: "Problem-Solving and Data Analysis",
    officialSkill:
      "One-variable data: Distributions and measures of center and spread",
    shortDescription:
      "Mean, median, range, standard deviation, and interpreting data displays.",
    description:
      "One-variable data questions test whether you can compute summary statistics and interpret histograms, box plots, and dot plots without over-computing.",
    keyTips: [
      "Median is resistant to outliers; mean is not.",
      "Standard deviation increases as data points spread farther from the mean.",
      "Read the axes and scale carefully before answering any chart-based question.",
    ],
  },
  {
    slug: "two-variable-data",
    name: "Two-Variable Data: Models and Scatterplots",
    section: "Math",
    domain: "Problem-Solving and Data Analysis",
    officialSkill: "Two-variable data: Models and scatterplots",
    shortDescription:
      "Lines and curves of best fit, scatterplot interpretation, predictions.",
    description:
      "Two-variable data questions expect you to fit a linear or exponential model to a scatterplot and make predictions from the model while understanding when a prediction is unreliable.",
    keyTips: [
      "Predictions outside the sampled x-range (extrapolation) are unreliable.",
      "A residual plot with clear pattern means the linear model is wrong.",
      "Always interpret slope and y-intercept in the context of the units.",
    ],
  },
  {
    slug: "probability",
    name: "Probability and Conditional Probability",
    section: "Math",
    domain: "Problem-Solving and Data Analysis",
    officialSkill: "Probability and conditional probability",
    shortDescription:
      "Compute probabilities from two-way tables and basic experiments.",
    description:
      "Digital SAT probability questions usually involve reading a two-way table and computing a conditional probability. The challenge is understanding which row or column total to divide by.",
    keyTips: [
      "Probability = favorable outcomes / total outcomes.",
      "Conditional probability restricts the sample space to the given row or column.",
      "Independent events multiply; mutually exclusive events add.",
    ],
  },
  {
    slug: "sample-statistics-margin-of-error",
    name: "Inference from Sample Statistics and Margin of Error",
    section: "Math",
    domain: "Problem-Solving and Data Analysis",
    officialSkill: "Inference from sample statistics and margin of error",
    shortDescription:
      "Use sample results and margins of error to estimate population values.",
    description:
      "These questions give you a sample statistic (mean or proportion) with a margin of error and ask what that implies for the full population. You need to build confidence intervals and interpret them in plain English.",
    keyTips: [
      "Confidence interval = point estimate ± margin of error.",
      "A larger sample shrinks the margin of error — tests love this relationship.",
      "Beware answers that extend conclusions beyond the sampled population.",
    ],
  },
  {
    slug: "evaluating-statistical-claims",
    name: "Evaluating Statistical Claims",
    section: "Math",
    domain: "Problem-Solving and Data Analysis",
    officialSkill:
      "Evaluating statistical claims: Observational studies and experiments",
    shortDescription:
      "Judge when study results support causation, correlation, or generalization.",
    description:
      "You'll see short descriptions of studies and need to decide what can and cannot be concluded. The Digital SAT tests whether you know the gap between correlation and causation and when a sample is representative.",
    keyTips: [
      "Only randomized experiments can support causal conclusions.",
      "Only random samples justify generalization to the whole population.",
      "Observational studies can show association but never prove cause and effect.",
    ],
  },
  {
    slug: "area-and-volume",
    name: "Area and Volume",
    section: "Math",
    domain: "Geometry and Trigonometry",
    officialSkill: "Area and volume",
    shortDescription:
      "Apply area and volume formulas from the SAT reference sheet.",
    description:
      "Area and volume questions lean on the SAT-provided reference sheet. The test rewards knowing when to use volume versus surface area and how to handle composite shapes.",
    keyTips: [
      "Use the reference sheet — it is always there on the Digital SAT.",
      "Break composite shapes into known pieces and add or subtract areas.",
      "Watch for unit conversions (inches to feet, etc.) inside the question.",
    ],
  },
  {
    slug: "lines-angles-triangles",
    name: "Lines, Angles, and Triangles",
    section: "Math",
    domain: "Geometry and Trigonometry",
    officialSkill: "Lines, angles, and triangles",
    shortDescription:
      "Parallel lines, angle relationships, congruence, and similar triangles.",
    description:
      "These questions test the core angle-chase toolkit: vertical angles, linear pairs, triangle sum, parallel-line relationships, and similar-triangle proportions. The work is mostly geometric reasoning, not calculation.",
    keyTips: [
      "Interior angles of any triangle sum to 180°; any quadrilateral sums to 360°.",
      "Parallel lines cut by a transversal create equal corresponding and alternate angles.",
      "Similar triangles have proportional sides — set up the ratio before solving.",
    ],
  },
  {
    slug: "right-triangles-and-trig",
    name: "Right Triangles and Trigonometry",
    section: "Math",
    domain: "Geometry and Trigonometry",
    officialSkill: "Right triangles and trigonometry",
    shortDescription:
      "Pythagorean theorem, SOH-CAH-TOA, and similar triangles.",
    description:
      "Right-triangle and trig questions combine Pythagorean logic with sine, cosine, and tangent ratios. They also often hide a similar-triangles shortcut.",
    keyTips: [
      "Recognize 3-4-5, 5-12-13, 8-15-17, and 7-24-25 Pythagorean triples.",
      "Use SOH-CAH-TOA to set up a ratio, not to memorize triangles.",
      "Similar triangles share angles — use proportional sides to solve.",
    ],
  },
  {
    slug: "circles",
    name: "Circles",
    section: "Math",
    domain: "Geometry and Trigonometry",
    officialSkill: "Circles",
    shortDescription:
      "Circle equations, arcs, sectors, inscribed angles, and tangent lines.",
    description:
      "Digital SAT circle questions include the equation of a circle in the coordinate plane, arc length and sector area in radians, and inscribed-angle relationships.",
    keyTips: [
      "The equation (x−h)² + (y−k)² = r² gives center and radius directly.",
      "Complete the square to convert a general circle equation into center-radius form.",
      "Arc length = rθ and sector area = ½r²θ, both with θ in radians.",
    ],
  },
  {
    slug: "words-in-context",
    name: "Words in Context",
    section: "Reading & Writing",
    domain: "Craft and Structure",
    officialSkill: "Words in Context",
    shortDescription:
      "Choose the word whose meaning best fits an academic passage.",
    description:
      "Words-in-Context is one of the most common Digital SAT question types. You read a short academic passage and choose the word that fits the blank based on meaning and tone. These questions reward vocabulary breadth plus careful reading.",
    keyTips: [
      "Predict a word in your own language before looking at the choices.",
      "Eliminate choices that are close but carry the wrong connotation.",
      "Build your vocabulary from our free SAT vocabulary list.",
    ],
  },
  {
    slug: "text-structure-and-purpose",
    name: "Text Structure and Purpose",
    section: "Reading & Writing",
    domain: "Craft and Structure",
    officialSkill: "Text Structure and Purpose",
    shortDescription:
      "Identify how a passage is organized and why the author wrote it.",
    description:
      "Text Structure and Purpose questions ask about the overall function of a passage or a specific sentence within it. You need to recognize rhetorical moves — introducing, contrasting, supporting, qualifying — and name them precisely.",
    keyTips: [
      "State the author's job in one verb before looking at choices (e.g. 'contrasts').",
      "A sentence's function is about what it does for the passage, not what it says.",
      "Eliminate choices that describe content accurately but miss the rhetorical role.",
    ],
  },
  {
    slug: "cross-text-connections",
    name: "Cross-Text Connections",
    section: "Reading & Writing",
    domain: "Craft and Structure",
    officialSkill: "Cross-Text Connections",
    shortDescription:
      "Compare how two passages treat the same topic or claim.",
    description:
      "Cross-Text Connections questions pair two short passages and ask how one author would respond to the other, or where the two agree or disagree. The answer is always anchored in text, not opinion.",
    keyTips: [
      "Summarize each author's core claim in one sentence before reading choices.",
      "Watch for tone and modal verbs (would, might, must) — they signal stance.",
      "Eliminate choices that require agreement or disagreement the texts don't state.",
    ],
  },
  {
    slug: "central-ideas-and-details",
    name: "Central Ideas and Details",
    section: "Reading & Writing",
    domain: "Information and Ideas",
    officialSkill: "Central Ideas and Details",
    shortDescription:
      "Identify the main idea or a specific detail in a short passage.",
    description:
      "Central-ideas-and-details questions ask you to either find the main point of a passage or the specific detail that answers a prompt. The passages are short — 25 to 100 words — and the right answer is always directly supported by the text.",
    keyTips: [
      "Paraphrase the passage in your own words before reading answer choices.",
      "Eliminate answers that are true in the real world but not supported by this passage.",
      "Central idea = author's claim; details = support for the claim.",
    ],
  },
  {
    slug: "command-of-evidence",
    name: "Command of Evidence",
    section: "Reading & Writing",
    domain: "Information and Ideas",
    officialSkill: "Command of Evidence",
    shortDescription:
      "Select the evidence that best supports a claim or completes an argument.",
    description:
      "Command-of-Evidence questions give you a claim or hypothesis and ask you to pick the data point, quote, or finding that most directly supports or weakens it. On the Digital SAT, these often involve tables or figures.",
    keyTips: [
      "State exactly what the claim is in your own words before evaluating choices.",
      "Match specific numbers from tables to specific wording in the claim.",
      "Eliminate answers that are off-topic or that support a different claim.",
    ],
  },
  {
    slug: "inference",
    name: "Inferences",
    section: "Reading & Writing",
    domain: "Information and Ideas",
    officialSkill: "Inferences",
    shortDescription:
      "Draw the most logical conclusion from a short passage.",
    description:
      "Inference questions ask 'which choice best completes the text?' The right answer is the logical continuation of the passage's argument — not a leap beyond the evidence.",
    keyTips: [
      "The correct answer is the tightest logical extension of the given text.",
      "If a choice requires outside information, it is wrong.",
      "Beware of opposite-direction answers that mirror the passage structure but flip meaning.",
    ],
  },
  {
    slug: "transitions",
    name: "Transitions",
    section: "Reading & Writing",
    domain: "Expression of Ideas",
    officialSkill: "Transitions",
    shortDescription:
      "Pick the transition word or phrase that matches the logical relationship between sentences.",
    description:
      "Transition questions test whether you can identify the logical relationship between sentences — contrast, cause and effect, addition, example, or sequence — and pick the transition that signals it.",
    keyTips: [
      "Label the relationship between the two sentences before looking at choices.",
      "'However' and 'therefore' are almost never both correct — read carefully.",
      "Subtle connectives (hence, accordingly, nevertheless) matter more than you think.",
    ],
  },
  {
    slug: "rhetorical-synthesis",
    name: "Rhetorical Synthesis",
    section: "Reading & Writing",
    domain: "Expression of Ideas",
    officialSkill: "Rhetorical Synthesis",
    shortDescription:
      "Use a set of research notes to accomplish a specific rhetorical goal.",
    description:
      "Rhetorical Synthesis gives you a bulleted list of notes and a goal (for example, 'emphasize a similarity' or 'introduce the study to an unfamiliar audience'). You pick the sentence that accomplishes that exact goal using the notes.",
    keyTips: [
      "Read the goal twice — it is the single most important part of the question.",
      "Eliminate answers that are true but do not accomplish the stated rhetorical goal.",
      "Answers that use the most notes aren't always right; the best answer is focused.",
    ],
  },
  {
    slug: "boundaries-punctuation",
    name: "Boundaries (Punctuation and Sentence Structure)",
    section: "Reading & Writing",
    domain: "Standard English Conventions",
    officialSkill: "Boundaries",
    shortDescription:
      "Commas, semicolons, colons, dashes, and proper sentence structure.",
    description:
      "Boundaries questions test punctuation that divides or joins clauses. You need to know exactly when to use a comma, a semicolon, a colon, and a dash — and when using any of them creates a comma splice or run-on.",
    keyTips: [
      "Semicolons join two independent clauses — both sides must stand alone.",
      "Colons introduce a list or an explanation, not a restart of the sentence.",
      "Dashes can replace commas or colons for emphasis but must come in pairs if non-terminal.",
    ],
  },
  {
    slug: "form-structure-sense",
    name: "Form, Structure, and Sense",
    section: "Reading & Writing",
    domain: "Standard English Conventions",
    officialSkill: "Form, Structure, and Sense",
    shortDescription:
      "Subject-verb agreement, pronoun agreement, verb tense, and parallel structure.",
    description:
      "Form-structure-and-sense questions are grammar in the strict sense: subject-verb agreement, pronoun-antecedent agreement, verb tense consistency, and parallel structure in lists.",
    keyTips: [
      "Find the true subject — don't be tricked by prepositional phrases.",
      "Keep verb tenses consistent with time markers (by 2024, last year, etc.).",
      "Parallel lists: every item must share the same grammatical form.",
    ],
  },
];

export const satSkillBySlug = new Map(satSkills.map((skill) => [skill.slug, skill]));
