import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MIN_GROUP_SIZE = 5;
const MAX_GROUP_SIZE = 20;

const readJson = (filePath) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, filePath), "utf8"));

const readUnofficialQuestions = () => {
  const text = fs.readFileSync(path.join(ROOT, "src/data/unofficialQuestions.ts"), "utf8");
  const marker = "export const questions: SourceQuestion[] = ";
  const start = text.indexOf(marker);
  if (start === -1) throw new Error("Could not find unofficial question export");
  const arrayStart = start + marker.length;
  const arrayEnd = text.lastIndexOf("];");
  if (arrayEnd === -1) throw new Error("Could not find unofficial question array end");
  return JSON.parse(text.slice(arrayStart, arrayEnd + 1));
};

const slugify = (value, fallback = "group") => {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return slug || fallback;
};

const stableHash = (value) => {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const signatureKey = (value, fallback = "signature") =>
  `${slugify(value, fallback)}-${stableHash(value)}`;

const normalizeWhitespace = (value) => String(value || "").replace(/\s+/g, " ").trim();

const stripHtml = (value) =>
  normalizeWhitespace(
    String(value || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">"),
  );

const normalizeForTokens = (value) =>
  stripHtml(value)
    .toLowerCase()
    .replace(/\\(?:left|right|text|mathrm|frac|sqrt|cdot|times|angle|triangle|circ|pi|sin|cos|tan)\b/g, " ")
    .replace(/\$+/g, " ")
    .replace(/[-+]?\d[\d,]*(?:\.\d+)?/g, " n ")
    .replace(/[a-z]\([^)]*\)/g, " function ")
    .replace(/\b[a-z]\b/g, " v ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "can",
  "choice",
  "does",
  "each",
  "following",
  "for",
  "from",
  "given",
  "has",
  "have",
  "if",
  "in",
  "is",
  "it",
  "its",
  "let",
  "of",
  "on",
  "or",
  "represents",
  "shown",
  "that",
  "the",
  "then",
  "this",
  "to",
  "value",
  "what",
  "where",
  "which",
  "with",
]);

const signatureTokens = (value, count = 8) =>
  normalizeForTokens(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    .slice(0, count)
    .join("-");

const choicesText = (question) =>
  Array.isArray(question.choices)
    ? question.choices.map((choice) => choice.text || "").join(" ")
    : "";

const punctuationSignature = (question) => {
  if (!Array.isArray(question.choices) || question.choices.length === 0) return "no-choices";
  const marks = question.choices
    .map((choice) =>
      String(choice.text || "")
        .replace(/<[^>]*>/g, "")
        .replace(/[A-Za-z0-9\s]/g, "")
        .replace(/\$|\\|{|}|\(|\)|\[|\]/g, "")
        .slice(0, 18),
    )
    .join("|");
  return slugify(marks, "punctuation");
};

const mathPatternShape = (value) => {
  const raw = stripHtml(value).toLowerCase();
  const formulas = [...raw.matchAll(/\$([^$]+)\$/g)].map((match) => match[1]).join(" ") || raw;
  const count = (pattern) => Math.min((formulas.match(pattern) || []).length, 4);
  const flags = [
    /factor/.test(raw) ? "factor" : "equiv",
    /sum of/.test(raw) ? "sum" : "",
    /product of|\\times/.test(raw) ? "product" : "",
    /\\frac/.test(formulas) ? "frac" : "",
    /\\sqrt|sqrt/.test(formulas) ? "sqrt" : "",
    /\^\s*\{?\s*\\frac|\^\s*\{?\s*\d+\s*\/\s*\d+/.test(formulas) ? "fracexp" : "",
    /where/.test(raw) ? "constraint" : "",
    `pow${count(/\^/g)}`,
    `paren${count(/\(/g)}`,
    `pm${count(/[+\-]/g)}`,
    `eq${count(/=/g)}`,
  ].filter(Boolean);
  return flags.join("-");
};

const mathDomainSkills = {
  "Algebra": [
    "Linear equations in one variable",
    "Linear functions",
    "Linear equations in two variables",
    "Systems of two linear equations in two variables",
    "Linear inequalities in one or two variables",
  ],
  "Advanced Math": [
    "Equivalent expressions",
    "Nonlinear equations in one variable and systems of equations in two variables",
    "Nonlinear functions",
  ],
  "Problem-Solving and Data Analysis": [
    "Ratios, rates, proportional relationships, and units",
    "Percentages",
    "One-variable data: Distributions and measures of center and spread",
    "Two-variable data: Models and scatterplots",
    "Probability and conditional probability",
    "Inference from sample statistics and margin of error",
    "Evaluating statistical claims: Observational studies and experiments",
  ],
  "Geometry and Trigonometry": [
    "Area and volume",
    "Lines, angles, and triangles",
    "Right triangles and trigonometry",
    "Circles",
  ],
};

const englishDomainSkills = {
  "Craft and Structure": [
    "Cross-Text Connections",
    "Text Structure and Purpose",
    "Words in Context",
  ],
  "Expression of Ideas": [
    "Rhetorical Synthesis",
    "Transitions",
  ],
  "Information and Ideas": [
    "Central Ideas and Details",
    "Command of Evidence",
    "Inferences",
  ],
  "Standard English Conventions": [
    "Boundaries",
    "Form, Structure, and Sense",
  ],
};

const normalizeKey = (value) => String(value || "").trim().toLowerCase();

const canonicalSkillByKey = new Map(
  [...Object.values(mathDomainSkills), ...Object.values(englishDomainSkills)]
    .flat()
    .map((skill) => [normalizeKey(skill), skill]),
);

const skillDomainByKey = new Map(
  [...Object.entries(mathDomainSkills), ...Object.entries(englishDomainSkills)]
    .flatMap(([domain, skills]) => skills.map((skill) => [normalizeKey(skill), domain])),
);

const domainByKey = new Map(
  [...Object.keys(mathDomainSkills), ...Object.keys(englishDomainSkills)]
    .map((domain) => [normalizeKey(domain), domain]),
);

const canonicalSkillAliases = new Map([
  ["cross-text connections", "Cross-Text Connections"],
  ["command of evidence (textual)", "Command of Evidence"],
  ["command of evidence (quantitative)", "Command of Evidence"],
  ["command of evidence - textual", "Command of Evidence"],
  ["command of evidence - quantitative", "Command of Evidence"],
  ["ratios, rates, proportions, and units", "Ratios, rates, proportional relationships, and units"],
  ["ratios, rates, and proportional relationships", "Ratios, rates, proportional relationships, and units"],
  ["nonlinear equations and systems", "Nonlinear equations in one variable and systems of equations in two variables"],
  ["systems of linear equations", "Systems of two linear equations in two variables"],
  ["systems of two linear equations", "Systems of two linear equations in two variables"],
]);

const getSubject = (question) => {
  const sourceSubject = question.category?.subject || question.section || "";
  return /math/i.test(sourceSubject) ? "math" : "reading";
};

const getSkill = (question) => {
  const rawSkill = question.category?.skill || question.skill || "Uncategorized";
  const key = normalizeKey(rawSkill);
  const skill = canonicalSkillByKey.get(key) || canonicalSkillAliases.get(key) || rawSkill;
  if (getSubject(question) !== "reading") {
    const text = stripHtml(question.text).toLowerCase();
    if (
      skill === "Systems of two linear equations in two variables" &&
      /linear equation and a quadratic equation|quadratic|parabola|[xy]\s*\^\s*\{?2|\^\s*\{?2\s*[+-]\s*[xy]|\([^)]+\)\s*\^\s*\{?2/.test(text)
    ) {
      return "Nonlinear equations in one variable and systems of equations in two variables";
    }
    if (skill === "Linear functions" && /\\sqrt|sqrt|square root|\|[^|]*x[^|]*\||absolute value/.test(text)) {
      return "Nonlinear functions";
    }
    if (
      skill === "Systems of two linear equations in two variables" &&
      /inequalit|at least|at most|no more than|no fewer than|greater than|less than/.test(text)
    ) {
      return "Linear inequalities in one or two variables";
    }
    return skill;
  }

  const text = stripHtml(question.text).toLowerCase();
  if (/logical transition|transition word or phrase|transition word|transition phrase/.test(text)) {
    return "Transitions";
  }
  if (/main idea|main topic|central idea|summary|summarize|what claim does the text make|which claim about/.test(text)) {
    return "Central Ideas and Details";
  }
  if (
    /most likely believe|most likely mean|would most likely (?:agree|disagree)|most strongly suggest|most strongly imply|reasonably infer|can be inferred|most logically completes/.test(text)
  ) {
    return "Inferences";
  }
  if (
    /which quotation|uses? a quotation|quotation from|which finding|which detail, if true|which potential finding|potential study design|produce evidence|information in the text best supports|text best supports|best supported by the text|would most directly support|would most directly strengthen|would most directly weaken|would most directly undermine|would most directly challenge|data in the (?:graph|table)|information from the (?:graph|table|figure)|from the table|from the graph|the graph best support|the table best support/.test(text)
  ) {
    return "Command of Evidence";
  }
  return skill;
};

const getDomain = (question) => {
  const skillDomain = skillDomainByKey.get(normalizeKey(getSkill(question)));
  if (skillDomain) return skillDomain;
  const rawDomain = question.category?.domain || question.domain || "Uncategorized";
  return domainByKey.get(normalizeKey(rawDomain)) || rawDomain;
};

const mathTemplateClassifier = (question, archetype) => {
  const raw = stripHtml(question.text).toLowerCase();
  const text = normalizeForTokens(question.text);

  if (archetype === "rewrite equivalent expression") {
    const shape = mathPatternShape(question.text);
    if (/\bif\s+\$?a\s*=/.test(raw) && /\bb\s*=/.test(raw) && /a\s*-\s*b/.test(raw)) {
      return `combine-defined-expressions-${shape}`;
    }
    if (/\\sqrt|sqrt|square root/.test(raw)) return `radical-expression-${shape}`;
    if (/\^\s*\{?\s*\\frac|\^\s*\{?\s*\d+\s*\/\s*\d+/.test(raw)) return `fractional-exponent-expression-${shape}`;
    if (hasFractionNotation(raw) && /[a-z]\s*[+\-]\s*\d|\d\s*[a-z]|denominator/.test(raw)) return `rational-expression-simplification-${shape}`;
    if (/factor/.test(raw)) return `factor-polynomial-${shape}`;
    if (/sum of/.test(raw)) return `polynomial-sum-${shape}`;
    if (/product of|\\times/.test(raw)) return `polynomial-product-${shape}`;
    if (/\)\s*\^\s*\{?2|\([^)]*\)\s*\^\s*\{?2/.test(raw)) return `square-binomial-expansion-${shape}`;
    if (/\)\s*\(/.test(raw)) return `binomial-product-expansion-${shape}`;
    if (/\)\s*-\s*\(/.test(raw)) return `polynomial-subtraction-${shape}`;
    if (/\([^)]+\)\s*[+\-]\s*\d*\s*\(/.test(raw)) return `polynomial-addition-${shape}`;
    if (/\^\s*\{?\d/.test(raw) && /where\s+[a-z]\s*>/.test(raw)) return `power-expression-with-domain-${shape}`;
    if (/\^\s*\{?\d/.test(raw)) return `polynomial-power-expression-${shape}`;
    return `basic-equivalent-expression-${shape}-${signatureTokens(raw, 12)}`;
  }

  if (archetype === "linear equation solve") {
    const shape = mathPatternShape(question.text);
    if (/\\sqrt|sqrt|square root/.test(raw)) return `radical-linear-equation-${shape}-${signatureTokens(raw, 10)}`;
    if (/\^\s*\{?2|quadratic/.test(raw)) return `quadratic-equation-${shape}-${signatureTokens(raw, 10)}`;
    if (hasFractionNotation(raw)) return `fraction-linear-equation-${shape}-${signatureTokens(raw, 10)}`;
    if (/for what value of/.test(raw)) return `solve-for-variable-${shape}-${signatureTokens(raw, 8)}`;
    if (/what is the value of\s+\$?x\b/.test(raw)) return "direct-linear-equation";
    if (/what is the value of/.test(raw)) return `transformed-linear-value-${shape}-${signatureTokens(raw, 12)}`;
    return `linear-equation-${shape}-${signatureTokens(raw, 12)}`;
  }

  if (archetype === "solution count linear equation") {
    const shape = mathPatternShape(question.text);
    if (hasFractionNotation(raw)) return `fraction-solution-count-${shape}-${signatureTokens(raw, 10)}`;
    return `linear-solution-count-${shape}-${signatureTokens(raw, 10)}`;
  }

  if (archetype === "linear function model") {
    const shape = mathPatternShape(question.text);
    if (/\\sqrt|sqrt|square root/.test(raw)) return `square-root-function-${shape}-${signatureTokens(raw, 10)}`;
    if (/\|x\||absolute value/.test(raw)) return `absolute-value-function-evaluation-${shape}`;
    if (/x\s*\^\s*\{?-?1|reciprocal/.test(raw)) return `reciprocal-function-evaluation-${shape}`;
    if (/for what value of/.test(raw)) return `linear-function-solve-${shape}-${signatureTokens(raw, 10)}`;
    if (/what is the value of/.test(raw) && /[a-z]\s*\(/.test(raw)) return `linear-function-evaluation-${shape}-${signatureTokens(raw, 10)}`;
    return `linear-function-model-${shape}-${signatureTokens(raw, 12)}`;
  }

  if (archetype === "line graph") {
    if (/quadratic|parabola|vertex|firework|\^\s*\{?2/.test(raw)) return `quadratic-graph-${signatureTokens(raw, 10)}`;
    return `linear-graph-${signatureTokens(raw, 10)}`;
  }

  if (archetype === "linear inequality") {
    if (/\\sqrt|sqrt|square root/.test(raw)) return `radical-rearrangement-${signatureTokens(raw, 10)}`;
    if (/system/.test(raw)) return "linear-inequality-system";
    if (/solution set|which point/.test(raw)) return `inequality-solution-set-${signatureTokens(raw, 10)}`;
    return `linear-inequality-${signatureTokens(raw, 12)}`;
  }

  if (archetype === "solve linear system" || archetype === "linear systems") {
    const shape = mathPatternShape(question.text);
    if (/\\sqrt|sqrt|square root|\^\s*\{?2|\bxy\b|quadratic|parabola/.test(raw)) {
      return `nonlinear-system-${shape}-${signatureTokens(raw, 10)}`;
    }
    if (/\b[xy]\s*=/.test(raw)) return `system-with-fixed-variable-${shape}-${signatureTokens(raw, 10)}`;
    if (/what is the solution/.test(raw)) return `system-solution-pair-${shape}-${signatureTokens(raw, 10)}`;
    return `linear-system-value-${shape}-${signatureTokens(raw, 12)}`;
  }

  if (archetype === "scatterplot model") {
    const shape = mathPatternShape(question.text);
    if (/exponential/.test(raw)) return `exponential-model-selection-${shape}-${signatureTokens(raw, 10)}`;
    if (/slope/.test(raw)) return `scatterplot-slope-${shape}-${signatureTokens(raw, 10)}`;
    if (/equation|linear model|model for the data|represents the line/.test(raw)) return `scatterplot-model-equation-${shape}-${signatureTokens(raw, 10)}`;
    if (/how many|greater than|less than|actual .* predicted|predicted .* actual|residual/.test(raw)) return `scatterplot-residual-count-${shape}-${signatureTokens(raw, 10)}`;
    if (/\bat\s+\$?x\s*=|predicted|estimate/.test(raw)) return `scatterplot-prediction-${shape}-${signatureTokens(raw, 10)}`;
    if (/association|relationship/.test(raw)) return `scatterplot-association-${shape}-${signatureTokens(raw, 10)}`;
    return `scatterplot-${shape}-${signatureTokens(raw, 12)}`;
  }

  if (archetype === "algebraic equivalence") {
    if (/directly varies|varies directly/.test(raw)) return "direct-variation";
    if (/radical|sqrt|square root|\\sqrt/.test(raw)) return `radical-expression-${signatureTokens(raw, 10)}`;
    if (/exponent|power|\^[{(]?\d|\\\^/.test(raw)) return `exponent-expression-${signatureTokens(raw, 10)}`;
    if (/which expression|equivalent to/.test(raw)) return `equivalent-expression-${signatureTokens(raw, 10)}`;
    if (/minimum|maximum|vertex/.test(raw)) return `quadratic-extrema-${signatureTokens(raw, 10)}`;
    if (/zero|root|x-intercept/.test(raw)) return `zeros-roots-${signatureTokens(raw, 10)}`;
    if (/y-intercept|initial value/.test(raw)) return `intercept-coefficient-${signatureTokens(raw, 10)}`;
    if (/value of/.test(raw)) return `value-evaluation-${signatureTokens(raw, 10)}`;
    return `algebraic-${signatureTokens(raw, 12)}`;
  }

  if (archetype === "nonlinear equation") {
    if (/complete.*square|completing.*square/.test(raw)) return `complete-square-${signatureTokens(raw, 10)}`;
    if (/radical|sqrt|square root|\\sqrt/.test(raw)) return `radical-equation-${signatureTokens(raw, 10)}`;
    if (/reciprocal/.test(raw)) return `reciprocal-equation-${signatureTokens(raw, 10)}`;
    if (/quadratic/.test(raw)) return `quadratic-equation-${signatureTokens(raw, 10)}`;
    return `nonlinear-${signatureTokens(raw, 12)}`;
  }

  if (archetype === "linear equation two variables") {
    if (/exponential/.test(raw)) return `exponential-table-${signatureTokens(raw, 10)}`;
    if (/quadratic|parabola/.test(raw)) return `quadratic-coordinate-${signatureTokens(raw, 10)}`;
    if (/table/.test(raw)) return `linear-table-${signatureTokens(raw, 10)}`;
    if (/formula|equation/.test(raw)) return `two-variable-equation-${signatureTokens(raw, 10)}`;
    return `two-variable-${signatureTokens(raw, 12)}`;
  }

  if (archetype === "line intercept") {
    if (/x-intercept/.test(raw)) return `x-intercept-${signatureTokens(raw, 10)}`;
    if (/y-intercept/.test(raw)) {
      if (/exponential/.test(raw)) return `exponential-y-intercept-${signatureTokens(raw, 10)}`;
      if (/rational/.test(raw)) return `rational-y-intercept-${signatureTokens(raw, 10)}`;
      return `linear-y-intercept-${signatureTokens(raw, 10)}`;
    }
    return `intercept-${signatureTokens(raw, 12)}`;
  }

  if (archetype === "triangle angle chasing") {
    if (/radian|degree measure|convert/.test(raw)) return `angle-conversion-${signatureTokens(raw, 10)}`;
    if (/perimeter/.test(raw)) return `triangle-perimeter-${signatureTokens(raw, 10)}`;
    if (/height|length|side/.test(raw) && !/measure of angle|angle .* measure/.test(raw)) {
      return `triangle-length-${signatureTokens(raw, 10)}`;
    }
    if (/proof|sufficient|additional piece/.test(raw)) return `triangle-proof-${signatureTokens(raw, 10)}`;
    if (/intersect|vertical angle|line/.test(raw) && !/triangle/.test(raw)) return `intersecting-lines-${signatureTokens(raw, 10)}`;
    return `triangle-angle-${signatureTokens(raw, 10)}`;
  }

  return slugify(`${archetype}-${signatureTokens(text, 10)}`);
};

const stableIdFor = (bankType, question) =>
  `bank-${bankType}-${getSubject(question)}-${String(question.id)}`;

const startsWithAny = (text, phrases) => phrases.some((phrase) => text.startsWith(phrase));

const hasFractionNotation = (value) => /\\frac|\/|\bfraction\b/.test(value);

const englishArchetype = (question) => {
  const skill = getSkill(question);
  const text = stripHtml(question.text).toLowerCase();
  const full = `${text} ${stripHtml(choicesText(question)).toLowerCase()}`;

  if (skill === "Rhetorical Synthesis") {
    const looksLikeRhetoricalPrompt =
      /(?:the student wants to|which choice most effectively uses|while researching|taken the following notes|given sentences)/.test(text);
    if (!looksLikeRhetoricalPrompt) return `rhetorical outlier ${signatureTokens(text, 6)}`;
    const wants = text.match(/(?:the student wants to|which choice most effectively)\s+([^?.]+)/);
    const directive = wants?.[1] || text;
    if (/emphasiz\w+ (?:a )?similarity|shared|both\b/.test(directive)) return "emphasize similarity";
    if (/emphasiz\w+ (?:a )?difference|contrast|differ/.test(directive)) return "emphasize difference";
    if (/make and support a claim|support a claim|claim about/.test(directive)) return "support a claim";
    if (/provide an example|give an example|illustrate/.test(directive)) return "provide an example";
    if (/recount|sequence|chronolog|timeline/.test(directive)) return "sequence events";
    if (/introduce|background/.test(directive)) return "introduce topic";
    if (/describe|explain/.test(directive)) return "describe or explain";
    if (/identify|accomplishment|finding|aim|goal|purpose/.test(directive)) return "identify target detail";
    if (/compare/.test(directive)) return "compare items";
    return `rhetorical ${signatureTokens(directive, 5)}`;
  }

  if (skill === "Words in Context") {
    if (/most logical and precise word or phrase|logical and precise/.test(text)) return "choose precise word";
    if (/as used in the text|most nearly means|means in context/.test(text)) return "meaning in context";
    if (/completes the text/.test(text)) return "complete vocabulary blank";
    return `vocabulary outlier ${signatureTokens(text, 6)}`;
  }

  if (skill === "Transitions") {
    if (/logical transition/.test(text)) return "logical transition";
    if (/transition word or phrase/.test(text)) return "transition word";
    return `transition outlier ${signatureTokens(text, 6)}`;
  }

  if (skill === "Boundaries") {
    if (/apostrophe|possessive/.test(full)) return "possessives";
    if (/semicolon|;/.test(full)) return `semicolon boundaries ${punctuationSignature(question)}`;
    if (/colon|:/.test(full)) return `colon boundaries ${punctuationSignature(question)}`;
    if (/dash|—|--/.test(full)) return `dash boundaries ${punctuationSignature(question)}`;
    if (/comma|,/.test(full)) return `comma boundaries ${punctuationSignature(question)}`;
    return `sentence boundaries ${punctuationSignature(question)}`;
  }

  if (skill === "Form, Structure, and Sense") {
    if (
      /^(according to|based on|what does|which statement|which finding|which quotation|what can|what is the main|the text|which choice best describes)/.test(text)
    ) {
      return `sentence form outlier ${signatureTokens(text, 6)}`;
    }
    if (/\b(is|are|was|were|has|have|had)\b/.test(full)) return "subject verb agreement";
    if (/\b(they|them|their|it|its|this|these|those|which|that)\b/.test(full)) return "pronoun agreement";
    if (/\b(more|most|less|least|better|best|than)\b/.test(full)) return "comparison";
    if (/\bwhile|when|after|before|because|although|if\b/.test(full)) return "modifier clause form";
    return `sentence form ${signatureTokens(choicesText(question), 5)}`;
  }

  if (skill === "Command of Evidence") {
    const isWeakening = /undermine|weaken|challenge/.test(text);
    const isSupport = /would most (?:directly|strongly) support|would most directly strengthen|support the hypothesis|support the claim|provide evidence|would most directly illustrate/.test(text);
    const isQuotation = /which quotation|uses? a quotation|quotation from|best illustrates/.test(text);
    const isQuantitative = /data in the (?:graph|table)|information from the (?:table|graph|figure)|from the table|from the graph|the graph best support|the table best support|best supported by data|percentages? of|survey data|rows in table/.test(text);
    const isFinding = /which finding|which detail, if true|which potential finding|potential study design|produce evidence/.test(text);
    if (isQuotation && isWeakening) return "textual quotation weakening evidence";
    if (isQuotation) return "textual quotation evidence";
    if (isQuantitative && isWeakening) return "quantitative weakening evidence";
    if (isQuantitative && isSupport) return "quantitative supporting evidence";
    if (isQuantitative) return "quantitative evidence";
    if (isFinding && isWeakening) return "finding weakening evidence";
    if (isFinding && isSupport) return "finding supporting evidence";
    if (isWeakening) return "weakening evidence";
    if (isSupport) return "supporting evidence";
    if (isFinding) return "finding evidence";
    if (/information in the text best supports|best supported by the text|text best supports/.test(text)) return "textual support evidence";
    return "textual evidence";
  }

  if (skill === "Inferences") {
    if (/most logically completes/.test(text)) return "logical completion";
    if (/most likely believe|most likely mean|would most likely (?:agree|disagree)|most strongly suggest|most strongly imply/.test(text)) return "draw inference";
    if (/most strongly suggest|reasonably infer|most likely|can be inferred/.test(text)) return "draw inference";
    if (/based on the text/.test(text)) return "text-based inference";
    return "inference";
  }

  if (skill === "Central Ideas and Details") {
    if (/main idea|main purpose|central idea|summary/.test(text)) return "main idea";
    if (/according to|which statement|which choice best states/.test(text)) return "detail retrieval";
    return "central detail";
  }

  if (skill === "Text Structure and Purpose") {
    if (/main purpose|overall purpose/.test(text)) return "main purpose";
    if (/function of the underlined|function of the sentence|primarily serves to/.test(text)) return "function of part";
    if (/structure|organized/.test(text)) return "text structure";
    return "purpose and structure";
  }

  if (skill === "Cross-Text Connections") {
    if (/would most likely respond|how would.*respond/.test(text)) return "author response";
    if (/both texts|two texts|text 1 and text 2/.test(text)) return "compare two texts";
    if (/agree|disagree/.test(text)) return "agreement across texts";
    return "cross text relationship";
  }

  return signatureTokens(text, 6) || "reading practice";
};

const mathArchetype = (question) => {
  const skill = getSkill(question);
  const text = normalizeForTokens(question.text);
  const raw = stripHtml(question.text).toLowerCase();

  if (skill === "Linear equations in one variable") {
    if (/no solution|how many solutions|infinitely many/.test(raw)) return "solution count linear equation";
    if (/what is the value of [a-z]/.test(raw)) return "solve linear equation";
    return "linear equation solve";
  }

  if (skill === "Linear functions") {
    if (/slope|rate of change/.test(raw)) return "slope rate of change";
    if (/y-intercept|intercept/.test(raw)) return "linear intercept";
    if (/table|values/.test(raw)) return "linear function table";
    if (/graph/.test(raw)) return "linear graph";
    return "linear function model";
  }

  if (skill === "Linear equations in two variables") {
    if (/slope/.test(raw)) return "line slope";
    if (/intercept/.test(raw)) return "line intercept";
    if (/parallel|perpendicular/.test(raw)) return "parallel perpendicular lines";
    if (/xy-plane|graph/.test(raw)) return "line graph";
    return "linear equation two variables";
  }

  if (skill === "Systems of two linear equations in two variables") {
    if (/no solution|infinitely many|one solution/.test(raw)) return "system solution count";
    if (/value of [a-z]|solution/.test(raw)) return "solve linear system";
    return "linear systems";
  }

  if (skill === "Linear inequalities in one or two variables") {
    if (/system/.test(raw)) return "system of linear inequalities";
    if (/solution set|which point/.test(raw)) return "inequality solution set";
    return "linear inequality";
  }

  if (skill === "Equivalent expressions") {
    if (/factor|equivalent to|which expression/.test(raw)) return "rewrite equivalent expression";
    if (/polynomial|quadratic/.test(raw)) return "polynomial equivalent form";
    if (/rational|fraction|denominator/.test(raw)) return "rational expression";
    return "algebraic equivalence";
  }

  if (skill === "Nonlinear equations in one variable and systems of equations in two variables") {
    if (/system/.test(raw)) return "nonlinear system";
    if (/solution|root|zero/.test(raw)) return "nonlinear equation roots";
    if (/quadratic/.test(raw)) return "quadratic equation";
    return "nonlinear equation";
  }

  if (skill === "Nonlinear functions") {
    if (/exponential|percent|growth|decay/.test(raw)) return "exponential function";
    if (/vertex|maximum|minimum/.test(raw)) return "quadratic vertex";
    if (/x-intercept|y-intercept|zero/.test(raw)) return "nonlinear intercepts";
    if (/graph/.test(raw)) return "nonlinear graph";
    return "nonlinear function model";
  }

  if (skill === "Ratios, rates, proportional relationships, and units") {
    if (/unit|convert|conversion/.test(raw)) return "unit conversion";
    if (/rate|speed|per/.test(raw)) return "rate problem";
    if (/ratio|proportion/.test(raw)) return "ratio proportion";
    return "proportional relationship";
  }

  if (skill === "Percentages") {
    if (/increase|decrease|greater|less/.test(raw)) return "percent change";
    if (/discount|tax|interest/.test(raw)) return "percent applied amount";
    return "percentage calculation";
  }

  if (skill === "One-variable data: Distributions and measures of center and spread") {
    if (/mean|average/.test(raw)) return "mean";
    if (/median/.test(raw)) return "median";
    if (/range|standard deviation|spread/.test(raw)) return "spread";
    if (/histogram|dot plot|box plot/.test(raw)) return "distribution graph";
    return "one variable data";
  }

  if (skill === "Two-variable data: Models and scatterplots") {
    if (/line of best fit|scatterplot|association/.test(raw)) return "scatterplot model";
    if (/slope|intercept/.test(raw)) return "linear model interpretation";
    return "two variable data";
  }

  if (skill === "Probability and conditional probability") {
    if (/conditional|given that/.test(raw)) return "conditional probability";
    if (/probability/.test(raw)) return "probability";
    return "counting probability";
  }

  if (skill === "Inference from sample statistics and margin of error") {
    if (/margin of error/.test(raw)) return "margin of error";
    if (/sample|survey|population/.test(raw)) return "sample inference";
    return "statistical inference";
  }

  if (skill === "Evaluating statistical claims: Observational studies and experiments") {
    if (/random|experiment|treatment|control/.test(raw)) return "experiment design";
    if (/association|caus/.test(raw)) return "correlation causation";
    return "statistical claim";
  }

  if (skill === "Area and volume") {
    if (/cylinder/.test(raw)) return "cylinder volume area";
    if (/cone|sphere/.test(raw)) return "solid volume area";
    if (/circle/.test(raw)) return "circle area";
    if (/triangle/.test(raw)) return "triangle area";
    if (/rectangle|square/.test(raw)) return "rectangle square area";
    if (/prism|box/.test(raw)) return "prism volume area";
    return "area volume";
  }

  if (skill === "Lines, angles, and triangles") {
    if (/similar/.test(raw)) return "similar triangles";
    if (/congruent/.test(raw)) return "congruent triangles";
    if (/parallel|transversal/.test(raw)) return "parallel line angles";
    if (/angle|degree/.test(raw)) return "triangle angle chasing";
    if (/perimeter/.test(raw)) return "triangle perimeter";
    return "triangles and lines";
  }

  if (skill === "Right triangles and trigonometry") {
    if (/sine|sin/.test(raw)) return "sine ratio";
    if (/cosine|cos/.test(raw)) return "cosine ratio";
    if (/tangent|tan/.test(raw)) return "tangent ratio";
    if (/pythagorean|hypotenuse/.test(raw)) return "pythagorean theorem";
    return "right triangle";
  }

  if (skill === "Circles") {
    if (/arc|sector/.test(raw)) return "arc sector";
    if (/circumference/.test(raw)) return "circumference";
    if (/area/.test(raw)) return "circle area";
    if (/equation/.test(raw)) return "circle equation";
    return "circle geometry";
  }

  return signatureTokens(text, 6) || "math practice";
};

const getArchetype = (question) =>
  getSubject(question) === "math" ? mathArchetype(question) : englishArchetype(question);

const getTemplateSignature = (question, bankType) => {
  const skill = getSkill(question);
  const archetype = getArchetype(question);
  const text = question.text || "";
  if (getSubject(question) === "reading") {
    if (skill === "Rhetorical Synthesis") return signatureKey(archetype);
    if (skill === "Boundaries" || skill === "Form, Structure, and Sense") {
      return signatureKey(`${archetype}-${signatureTokens(choicesText(question), 5)}`);
    }
    return signatureKey(`${archetype}-${signatureTokens(text, 5)}`);
  }
  return signatureKey(`${archetype}-${mathTemplateClassifier(question, archetype)}`);
};

const TEMPLATE_SEPARATE_READING_SKILLS = new Set([
  "Boundaries",
  "Central Ideas and Details",
  "Command of Evidence",
  "Form, Structure, and Sense",
  "Inferences",
  "Text Structure and Purpose",
  "Transitions",
]);

const sourceRecords = [
  ...readUnofficialQuestions().map((question) => ({ bankType: "unofficial", question })),
  ...readJson("src/data/questions/math_past.json").map((question) => ({ bankType: "past", question })),
  ...readJson("src/data/questions/reading_past.json").map((question) => ({ bankType: "past", question })),
];

const buckets = new Map();

for (const record of sourceRecords) {
  const { question } = record;
  const subject = getSubject(question);
  const domain = getDomain(question);
  const skill = getSkill(question);
  const archetype = getArchetype(question);
  const type = question.type || "unknown";
  const key = [subject, domain, skill].join("\u001f");
  const item = {
    stableId: stableIdFor(record.bankType, question),
    bankType: record.bankType,
    subject,
    domain,
    skill,
    type,
    difficulty: question.difficulty || null,
    archetype,
    templateSignature: getTemplateSignature(question, record.bankType),
    sourceId: String(question.id),
  };
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push(item);
}

const sortQuestionItems = (left, right) =>
  left.archetype.localeCompare(right.archetype) ||
  left.templateSignature.localeCompare(right.templateSignature) ||
  String(left.difficulty || "").localeCompare(String(right.difficulty || "")) ||
  left.bankType.localeCompare(right.bankType) ||
  left.sourceId.localeCompare(right.sourceId);

const uniqueValues = (items, key) => [...new Set(items.map((item) => item[key]))];

const splitEvenly = (items) => {
  if (items.length <= MAX_GROUP_SIZE) return [items];
  const chunkCount = Math.ceil(items.length / MAX_GROUP_SIZE);
  const baseSize = Math.floor(items.length / chunkCount);
  const extra = items.length % chunkCount;
  const chunks = [];
  let offset = 0;
  for (let index = 0; index < chunkCount; index += 1) {
    const size = baseSize + (index < extra ? 1 : 0);
    chunks.push(items.slice(offset, offset + size));
    offset += size;
  }
  return chunks;
};

const buildContentChunks = (items) => {
  const byArchetype = new Map();
  for (const item of items.sort(sortQuestionItems)) {
    if (!byArchetype.has(item.archetype)) byArchetype.set(item.archetype, []);
    byArchetype.get(item.archetype).push(item);
  }

  const chunks = [];
  const smallArchetypeItems = [];
  for (const archetypeItems of [...byArchetype.values()].sort((left, right) =>
    sortQuestionItems(left[0], right[0]),
  )) {
    if (archetypeItems.length >= MIN_GROUP_SIZE) {
      chunks.push(...splitEvenly(archetypeItems));
    } else {
      smallArchetypeItems.push(...archetypeItems);
    }
  }

  if (smallArchetypeItems.length >= MIN_GROUP_SIZE) {
    chunks.push(...splitEvenly(smallArchetypeItems.sort(sortQuestionItems)));
  } else if (smallArchetypeItems.length > 0 && chunks.length > 0) {
    const target = chunks
      .slice()
      .sort((left, right) => left.length - right.length)
      .find((chunk) => chunk.length + smallArchetypeItems.length <= MAX_GROUP_SIZE);
    if (target) {
      target.push(...smallArchetypeItems);
      target.sort(sortQuestionItems);
    } else {
      const last = chunks.pop();
      chunks.push(...splitEvenly([...last, ...smallArchetypeItems].sort(sortQuestionItems)));
    }
  } else if (smallArchetypeItems.length > 0) {
    chunks.push(smallArchetypeItems.sort(sortQuestionItems));
  }

  return chunks;
};

const groups = [];
let groupSequence = 1;

for (const [bucketKey, items] of [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const [subject, domain, skill] = bucketKey.split("\u001f");
  const chunks = buildContentChunks(items);

  chunks.forEach((chunk, index) => {
    const archetypes = uniqueValues(chunk, "archetype");
    const types = uniqueValues(chunk, "type");
    const archetype = archetypes.length === 1 ? archetypes[0] : "mixed practice";
    const type = types.length === 1 ? types[0] : "mixed";
    const baseId = [
      subject,
      slugify(skill),
      slugify(archetype),
      String(groupSequence).padStart(4, "0"),
    ].join("-");
    groupSequence += 1;
    groups.push({
      id: `sim-${baseId}`,
      label: `${skill}: ${archetype}${chunks.length > 1 ? ` ${index + 1}` : ""}`,
      subject,
      domain,
      skill,
      archetype,
      type,
      questionKeys: chunk.map((item) => item.stableId),
    });
  });
}

const undersizedGroups = groups.filter((group) => group.questionKeys.length < MIN_GROUP_SIZE);
const oversizedGroups = groups.filter((group) => group.questionKeys.length > MAX_GROUP_SIZE);
if (undersizedGroups.length || oversizedGroups.length) {
  throw new Error(
    `Similarity group size invariant failed: ${undersizedGroups.length} under ${MIN_GROUP_SIZE}, ${oversizedGroups.length} over ${MAX_GROUP_SIZE}`,
  );
}

const groupIdByStableId = Object.fromEntries(
  groups.flatMap((group) => group.questionKeys.map((stableId) => [stableId, group.id])),
);

const coverage = {
  totalQuestions: sourceRecords.length,
  groupedQuestions: Object.keys(groupIdByStableId).length,
  groupCount: groups.length,
  maxGroupSize: Math.max(...groups.map((group) => group.questionKeys.length)),
  minGroupSize: Math.min(...groups.map((group) => group.questionKeys.length)),
  maxConfiguredGroupSize: MAX_GROUP_SIZE,
  minConfiguredGroupSize: MIN_GROUP_SIZE,
  sourceCounts: sourceRecords.reduce((counts, record) => {
    counts[record.bankType] = (counts[record.bankType] || 0) + 1;
    return counts;
  }, {}),
};

if (coverage.totalQuestions !== coverage.groupedQuestions) {
  throw new Error(`Similarity coverage mismatch: ${coverage.groupedQuestions}/${coverage.totalQuestions}`);
}

const outputPath = path.join(ROOT, "src/lib/generated/questionSimilarity.generated.ts");
const output = `// Auto-generated by scripts/generate-question-similarity.mjs. Do not edit manually.

export interface QuestionSimilarityGroup {
  id: string;
  label: string;
  subject: "math" | "reading";
  domain: string;
  skill: string;
  archetype: string;
  type: string;
  questionKeys: string[];
}

export const questionSimilarityCoverage = ${JSON.stringify(coverage, null, 2)} as const;

export const questionSimilarityGroups = ${JSON.stringify(groups, null, 2)} as QuestionSimilarityGroup[];

export const questionSimilarityGroupsById = Object.fromEntries(
  questionSimilarityGroups.map((group) => [group.id, group]),
) as Record<string, QuestionSimilarityGroup>;

export const questionSimilarityGroupByQuestion = ${JSON.stringify(groupIdByStableId, null, 2)} as Record<string, string>;
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output);

console.log(
  `Generated ${groups.length} similarity groups for ${coverage.groupedQuestions}/${coverage.totalQuestions} questions. Max group size: ${coverage.maxGroupSize}.`,
);
