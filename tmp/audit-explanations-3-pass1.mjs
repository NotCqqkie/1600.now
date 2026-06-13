import fs from "node:fs";
import path from "node:path";
import katex from "katex";

const slicePath = "tmp/audit-slices/explanations-3.json";
const sourcePaths = [
  "src/data/questions/math_past.json",
  "src/data/questions/reading_past.json",
  "src/data/questions/unofficial_math.json",
  "src/data/questions/unofficial_reading.json",
];

const slice = JSON.parse(fs.readFileSync(slicePath, "utf8")).map((entry) => entry.file || entry.path || entry);

const sourceById = new Map();
for (const sourcePath of sourcePaths) {
  const questions = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  for (const question of questions) {
    sourceById.set(String(question.id), { ...question, sourcePath });
  }
}

const asRecord = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : null;

const asString = (value) => (typeof value === "string" ? value : undefined);

const normalizeStep = (rawStep, index) => {
  if (typeof rawStep === "string") return { title: `Step ${index + 1}`, content: rawStep };
  const step = asRecord(rawStep);
  if (!step) return null;
  const content =
    asString(step.content) ??
    asString(step.text) ??
    asString(step.step) ??
    asString(step.explain) ??
    asString(step.explanation) ??
    asString(step.explanationHtml) ??
    asString(step.body) ??
    asString(step.reason);
  if (content === undefined) return null;
  return {
    title: asString(step.title) ?? asString(step.heading) ?? asString(step.label) ?? `Step ${index + 1}`,
    content,
    formula: asString(step.formula),
    desmosExpressions: Array.isArray(step.desmosExpressions) ? step.desmosExpressions.filter((item) => typeof item === "string") : [],
    desmosGraphs: Array.isArray(step.desmosGraphs) ? step.desmosGraphs : [],
  };
};

const normalizeExplanation = (data) => {
  const record = asRecord(data);
  if (!record) return null;
  const steps = Array.isArray(record.steps)
    ? record.steps.map((step, index) => normalizeStep(step, index)).filter(Boolean)
    : [];
  const legacyExplanation = asString(record.explanation);
  const explanationHtml = asString(record.explanationHtml) ?? legacyExplanation;
  if (!steps.length && explanationHtml) steps.push({ title: "Explanation", content: explanationHtml });
  const choiceElimination =
    asString(record.choiceElimination) ??
    asString(record.choiceEliminations) ??
    asString(record.choiceAnalysis) ??
    asString(record.eliminationHtml);
  if (choiceElimination && !steps.some((step) => step.content.includes(choiceElimination.slice(0, 120)))) {
    steps.push({ title: "Check the choices", content: choiceElimination });
  }
  return {
    questionId: asString(record.questionId) ?? asString(record.qid) ?? "",
    correctAnswer: asString(record.correctAnswer) ?? "",
    section: asString(record.section) ?? "",
    steps,
  };
};

const collectStrings = (value, out = [], keyPath = "$") => {
  if (typeof value === "string") {
    out.push({ path: keyPath, value });
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, out, `${keyPath}[${index}]`));
    return out;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) collectStrings(item, out, `${keyPath}.${key}`);
  }
  return out;
};

const isEscaped = (text, index) => {
  let count = 0;
  for (let i = index - 1; i >= 0 && text[i] === "\\"; i--) count += 1;
  return count % 2 === 1;
};

const dollarSegments = (text) => {
  const segments = [];
  const unmatched = [];
  let cursor = 0;
  while (cursor < text.length) {
    if (text[cursor] !== "$" || isEscaped(text, cursor)) {
      cursor += 1;
      continue;
    }
    const display = text[cursor + 1] === "$" && !isEscaped(text, cursor + 1);
    const len = display ? 2 : 1;
    let closing = cursor + len;
    while (closing < text.length) {
      if (text[closing] === "$" && !isEscaped(text, closing)) {
        if (!display || (text[closing + 1] === "$" && !isEscaped(text, closing + 1))) break;
      }
      closing += 1;
    }
    if (closing >= text.length) {
      unmatched.push(cursor);
      cursor += len;
      continue;
    }
    segments.push({ value: text.slice(cursor + len, closing), display, start: cursor });
    cursor = closing + len;
  }
  return { segments, unmatched };
};

const stripTags = (text) => text.replace(/<[^>]+>/g, " ");
const snippet = (text, index) => text.slice(Math.max(0, index - 70), Math.min(text.length, index + 180)).replace(/\s+/g, " ");

const issues = [];
const push = (file, code, detail) => issues.push({ file, code, detail });

const allowedTags = new Set(["br", "div", "em", "li", "strong", "sup", "u", "ul"]);
const caveatPatterns = [
  /source marks/i,
  /displays without/i,
  /inconsistent with the problem/i,
  /if choice/i,
  /display inconsistency/i,
  /source question/i,
];
const generatedPatterns = [
  /as an ai language model/i,
  /i cannot/i,
  /i'm unable/i,
  /let me know if/i,
  /hope this helps/i,
  /here'?s a concise explanation/i,
  /draft explanation/i,
];
const awkwardPatterns = [
  /graph all of the answers/i,
  /plug(?:ged)? into desmos without/i,
  /use desmos because/i,
];

let parsed = 0;
let sourceMatched = 0;
let missingSource = 0;
let renderedMathSegments = 0;

for (const file of slice) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (error) {
    push(file, "missing-file", error.message);
    continue;
  }

  let data;
  try {
    data = JSON.parse(raw);
    parsed += 1;
  } catch (error) {
    push(file, "malformed-json", error.message);
    continue;
  }

  const idFromFile = path.basename(file, ".json");
  const normalized = normalizeExplanation(data);
  if (!normalized) {
    push(file, "unusable-schema", "Could not normalize explanation data");
    continue;
  }
  if (!normalized.questionId) push(file, "missing-question-id", "Missing questionId/qid");
  if (normalized.questionId && normalized.questionId !== idFromFile) {
    push(file, "question-id-mismatch", `${normalized.questionId} != ${idFromFile}`);
  }
  if (!normalized.correctAnswer) push(file, "missing-correct-answer", "Missing correctAnswer");
  if (!normalized.steps.length) push(file, "missing-steps", "No normalized steps");

  const source = sourceById.get(normalized.questionId || idFromFile);
  if (source) {
    sourceMatched += 1;
    const sourceAnswer = String(source.correctAnswer ?? "").trim();
    if (sourceAnswer && normalized.correctAnswer && sourceAnswer !== normalized.correctAnswer.trim()) {
      push(file, "source-answer-mismatch", `explanation=${normalized.correctAnswer}; source=${sourceAnswer}; sourcePath=${source.sourcePath}`);
    }
  } else {
    missingSource += 1;
  }

  const allStrings = collectStrings(data);
  const fullText = allStrings.map((entry) => entry.value).join("\n");
  const plain = stripTags(fullText);

  for (const pattern of caveatPatterns) {
    if (pattern.test(fullText)) push(file, "question-bug-caveat", `Matched ${pattern}`);
  }
  for (const pattern of generatedPatterns) {
    if (pattern.test(fullText)) push(file, "generated-artifact", `Matched ${pattern}`);
  }
  for (const pattern of awkwardPatterns) {
    if (pattern.test(fullText)) push(file, "awkward-desmos-wording", `Matched ${pattern}`);
  }

  const claimRegexes = [
    /\bchoice\s+([A-D])\s+(?:is|was)\s+(?:the\s+)?(?:correct|right|answer)\b/gi,
    /\bmatches\s+choice\s+([A-D])\b/gi,
    /\banswer\s+(?:is|:)\s*([A-D])\b/gi,
  ];
  if (/^[A-D]$/.test(normalized.correctAnswer)) {
    for (const re of claimRegexes) {
      let match;
      while ((match = re.exec(plain))) {
        const context = plain.slice(Math.max(0, match.index - 35), match.index + 90).toLowerCase();
        if (/\b(?:not|isn't|incorrect|eliminated|wrong|too|but)\b/.test(context)) continue;
        if (match[1].toUpperCase() !== normalized.correctAnswer) {
          push(file, "claimed-answer-mismatch", `${match[0]} but correctAnswer=${normalized.correctAnswer}`);
        }
      }
    }
  }

  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g;
  let tagMatch;
  while ((tagMatch = tagRegex.exec(raw))) {
    const tag = tagMatch[1].toLowerCase();
    if (!allowedTags.has(tag)) push(file, "unsupported-tag", tagMatch[0]);
  }

  for (const { path: stringPath, value } of allStrings) {
    if (/\\[([]/.test(value) || /\\[\])]/.test(value)) push(file, "raw-tex-delimiter", `${stringPath}: ${value.match(/\\[()[\]]/)?.[0]}`);
    const emptyTag = value.match(/<(u|em|strong|b)\b[^>]*>\s*<\/\1>/i);
    if (emptyTag) push(file, "empty-inline-tag", `${stringPath}: ${emptyTag[0]}`);
    const escapedTag = value.match(/&lt;\/?(?:ul|li|strong|em|u|br|table|math|b)\b/i);
    if (escapedTag) push(file, "escaped-html-tag", `${stringPath}: ${escapedTag[0]}`);
    const splitTag = value.match(/[A-Za-z0-9]<(?:em|strong|u)\b[^>]*>|<\/(?:em|strong|u)>[A-Za-z0-9]/i);
    if (splitTag) push(file, "glued-inline-tag", `${stringPath}: ${snippet(value, splitTag.index)}`);
    const textWithoutEntities = value.replace(/&(?:#[0-9]+|#x[0-9a-f]+|[a-z]+);/gi, " ");
    const punctuationGlue = textWithoutEntities.match(/\b(?:[A-Za-z]{4,}|[0-9]{3,})[.;:,][A-Za-z]{2,}\b/);
    if (punctuationGlue) push(file, "punctuation-glue", `${stringPath}: ${punctuationGlue[0]}`);
    const ocrSplit = value.match(/\b(?:myria d|Margarett a|inter species|intra species)\b/i);
    if (ocrSplit) push(file, "ocr-or-hyphen-split", `${stringPath}: ${ocrSplit[0]}`);
    const { segments, unmatched } = dollarSegments(value);
    if (unmatched.length) push(file, "unmatched-dollar", `${stringPath}: ${snippet(value, unmatched[0])}`);
    for (const segment of segments) {
      renderedMathSegments += 1;
      if (/[<>]/.test(segment.value)) push(file, "raw-comparator-in-math", `${stringPath}: $${segment.value}$`);
      const entity = segment.value.match(/&(?:#[0-9]+|#x[0-9a-f]+|[a-z]+);/i);
      if (entity) push(file, "html-entity-in-math", `${stringPath}: $${segment.value}$`);
      if (/\{\\?\)\}\^/.test(segment.value)) push(file, "exponent-base-artifact", `${stringPath}: $${segment.value}$`);
      if (/\bt\^\*/.test(segment.value)) push(file, "literal-asterisk-exponent", `${stringPath}: $${segment.value}$`);
      try {
        katex.renderToString(segment.value, {
          displayMode: segment.display,
          throwOnError: true,
          trust: false,
          strict: false,
          output: "html",
        });
      } catch (error) {
        push(file, "katex-render-error", `${stringPath}: ${error.message}; $${segment.value}$`);
      }
    }
  }

  const stepWords = normalized.steps.map((step) => stripTags(step.content).trim().split(/\s+/).filter(Boolean).length);
  if (normalized.steps.length === 1 && stepWords[0] < 45) push(file, "weak-single-step", `Only ${stepWords[0]} words`);
  if (normalized.steps.length > 0 && stepWords.every((count) => count < 12)) push(file, "weak-steps", `Step word counts: ${stepWords.join(",")}`);

  for (const step of normalized.steps) {
    const desmosCount =
      (Array.isArray(step.desmosExpressions) ? step.desmosExpressions.length : 0) +
      (Array.isArray(step.desmosGraphs) ? step.desmosGraphs.reduce((sum, graph) => sum + (Array.isArray(graph?.expressions) ? graph.expressions.length : 0), 0) : 0);
    if (desmosCount && !/\b(?:desmos|graph|plot|check|verify|intersection|calculator|table)\b/i.test(`${step.title} ${step.content}`)) {
      push(file, "desmos-without-context", `${step.title}: ${desmosCount} expressions`);
    }
  }
}

issues.sort((a, b) => a.file.localeCompare(b.file) || a.code.localeCompare(b.code));
const grouped = issues.reduce((acc, issue) => {
  acc[issue.code] = (acc[issue.code] || 0) + 1;
  return acc;
}, {});

console.log(JSON.stringify({
  checked: slice.length,
  parsed,
  sourceMatched,
  missingSource,
  renderedMathSegments,
  issueCount: issues.length,
  grouped,
  issues,
}, null, 2));

if (issues.length) process.exitCode = 1;
