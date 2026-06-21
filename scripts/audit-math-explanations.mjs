import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const explanationDir = path.join(root, "public/explanations");
const minExplanationWords = Number.parseInt(process.env.MIN_EXPLANATION_WORDS ?? "35", 10);
const reportLimit = Number.parseInt(process.env.AUDIT_LIMIT ?? "30", 10);

const failures = {
  parse: [],
  sourceAnswerConflicts: [],
  missingExplanations: [],
  missingSteps: [],
  rawTexDelimiters: [],
  unmatchedDollars: [],
  shortExplanations: [],
  correctAnswerMismatches: [],
  strongClaimedAnswerMismatches: [],
};

const addFailure = (type, id, message, file = "") => {
  failures[type].push({ id, file, message });
};

const readText = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");

const readJson = (relativePath) => {
  const file = path.join(root, relativePath);
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    addFailure("parse", relativePath, error.message, relativePath);
    return null;
  }
};

const extractUnofficialQuestions = () => {
  const relativePath = "src/data/unofficialQuestions.ts";
  let text;
  try {
    text = readText(relativePath);
  } catch (error) {
    addFailure("parse", relativePath, error.message, relativePath);
    return [];
  }

  const marker = "export const questions";
  const markerIndex = text.indexOf(marker);
  const equalsIndex = text.indexOf("=", markerIndex);
  const start = text.indexOf("[", equalsIndex);
  const end = text.lastIndexOf("]");
  if (markerIndex === -1 || equalsIndex === -1 || start === -1 || end === -1 || end <= start) {
    addFailure("parse", relativePath, "Could not locate exported questions array", relativePath);
    return [];
  }

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (error) {
    addFailure("parse", relativePath, error.message, relativePath);
    return [];
  }
};

const answerValue = (question) => {
  if (!question || typeof question !== "object") return "";
  return String(question.correctAnswer ?? question.correct_answer ?? "").trim();
};

const normalizeAnswerToken = (value) =>
  String(value)
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/−/g, "-")
    .replace(/^[$]+|[$]+$/g, "")
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\\left|\\right/g, "")
    .replace(/\s+/g, "")
    .replace(/,/g, "")
    .toUpperCase();

const splitAnswerOptions = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return [];
  const isThousandsNumber = /^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(text);
  const withoutEither = text.replace(/^either\s+/i, "").trim();
  const pieces = /\bor\b/i.test(withoutEither)
    ? withoutEither.split(/\s+or\s+/i)
    : !isThousandsNumber && text.includes(",")
      ? text.split(",")
      : [text];
  return pieces.map(normalizeAnswerToken).filter(Boolean);
};

const answersMatch = (expected, actual) => {
  const expectedSet = splitAnswerOptions(expected);
  const actualSet = splitAnswerOptions(actual);
  if (!expectedSet.length || !actualSet.length) return false;
  return expectedSet.some((answer) => actualSet.includes(answer));
};

const sourceQuestionRecord = (question, source) => ({
  id: String(question.id ?? "").trim(),
  answer: answerValue(question),
  type: String(question.type ?? (question.is_fill_in_blank ? "free-response" : "multiple-choice")),
  source,
});

const addSourceQuestion = (sourceIndex, question, source) => {
  if (!question || typeof question !== "object") return;
  if (question.section && question.section !== "Math") return;
  const record = sourceQuestionRecord(question, source);
  if (!record.id || !record.answer) return;

  const existing = sourceIndex.get(record.id);
  if (!existing) {
    sourceIndex.set(record.id, {
      ...record,
      answers: [record.answer],
      sources: [record.source],
    });
    return;
  }

  if (!existing.answers.includes(record.answer)) existing.answers.push(record.answer);
  if (!existing.sources.includes(record.source)) existing.sources.push(record.source);
};

const buildSourceIndex = () => {
  const sourceIndex = new Map();

  const mathPast = readJson("src/data/questions/math_past.json");
  if (Array.isArray(mathPast)) {
    for (const question of mathPast) addSourceQuestion(sourceIndex, question, "src/data/questions/math_past.json");
  }

  for (const question of extractUnofficialQuestions()) {
    addSourceQuestion(sourceIndex, question, "src/data/unofficialQuestions.ts");
  }

  const moduleDir = path.join(root, "src/data/modules");
  let moduleFiles = [];
  try {
    moduleFiles = readdirSync(moduleDir).filter((file) => /math.*\.json$/i.test(file)).sort();
  } catch (error) {
    if (error.code !== "ENOENT") {
      addFailure("parse", "src/data/modules", error.message, "src/data/modules");
    }
  }

  for (const file of moduleFiles) {
    const relativePath = `src/data/modules/${file}`;
    const questions = readJson(relativePath);
    if (!Array.isArray(questions)) continue;
    for (const question of questions) {
      const id = String(question?.id ?? "").trim();
      if (!sourceIndex.has(id)) continue;
      addSourceQuestion(sourceIndex, question, relativePath);
    }
  }

  return sourceIndex;
};

const asRecord = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : null;
const asString = (value) => typeof value === "string" ? value : undefined;
const asStringArray = (value) =>
  Array.isArray(value)
    ? value
        .map((item) => {
          if (typeof item === "string") return item;
          const record = asRecord(item);
          return record ? asString(record.latex) ?? asString(record.expression) : undefined;
        })
        .filter(Boolean)
    : [];

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
    desmosExpressions: asStringArray(step.desmosExpressions),
    desmosGraphs: Array.isArray(step.desmosGraphs) ? step.desmosGraphs : [],
  };
};

const normalizeExplanation = (raw) => {
  const data = asRecord(raw);
  if (!data) return null;

  const steps = Array.isArray(data.steps)
    ? data.steps.map(normalizeStep).filter(Boolean)
    : [];

  const explanationHtml = asString(data.explanationHtml);
  if (!steps.length && explanationHtml) steps.push({ title: "Explanation", content: explanationHtml });

  const choiceElimination =
    asString(data.choiceElimination) ??
    asString(data.choiceAnalysis) ??
    asString(data.eliminationHtml);
  let appendedChoiceElimination = false;
  if (choiceElimination) {
    const existingText = stripHtml(steps.map((step) => step.content).join(" ")).toLowerCase();
    const choiceText = stripHtml(choiceElimination).toLowerCase();
    if (!existingText.includes(choiceText.slice(0, 120))) {
      steps.push({
        title: "Check the choices",
        content: choiceElimination,
        desmosExpressions: asStringArray(data.desmosExpressions),
        desmosGraphs: [],
      });
      appendedChoiceElimination = true;
    }
  }

  if (!appendedChoiceElimination && steps.length) {
    const desmosExpressions = asStringArray(data.desmosExpressions);
    if (desmosExpressions.length) {
      steps[steps.length - 1] = {
        ...steps[steps.length - 1],
        desmosExpressions,
      };
    }
  }

  if (!steps.length) return null;

  return {
    questionId: asString(data.questionId) ?? asString(data.qid) ?? "",
    correctAnswer: asString(data.correctAnswer) ?? "",
    section: asString(data.section) ?? "",
    steps,
  };
};

const parseExplanationFiles = () => {
  const parsed = new Map();
  let files = [];
  try {
    files = readdirSync(explanationDir).filter((file) => file.endsWith(".json")).sort();
  } catch (error) {
    addFailure("parse", "public/explanations", error.message, "public/explanations");
    return parsed;
  }

  for (const file of files) {
    const id = file.replace(/\.json$/i, "");
    const relativePath = `public/explanations/${file}`;
    try {
      parsed.set(id, JSON.parse(readFileSync(path.join(explanationDir, file), "utf8")));
    } catch (error) {
      addFailure("parse", id, error.message, relativePath);
    }
  }

  return parsed;
};

const stripHtml = (value) =>
  String(value ?? "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const countWords = (value) => {
  const text = stripHtml(value);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
};

const stepTexts = (explanation) => {
  const values = [];
  for (const step of explanation.steps) {
    values.push(step.title, step.content, step.formula);
    for (const expression of step.desmosExpressions ?? []) values.push(expression);
    for (const graph of step.desmosGraphs ?? []) {
      const record = asRecord(graph);
      if (!record) continue;
      values.push(record.label);
      if (Array.isArray(record.expressions)) {
        for (const expression of asStringArray(record.expressions)) values.push(expression);
      }
    }
  }
  return values.filter((value) => typeof value === "string" && value.length > 0);
};

const firstRawTexDelimiter = (value) => {
  const match = String(value).match(/\\[()[\]]/);
  return match ? match[0] : "";
};

const findUnmatchedDollar = (value) => {
  const text = String(value);
  let cursor = 0;

  while (cursor < text.length) {
    if (text[cursor] !== "$" || isEscaped(text, cursor)) {
      cursor += 1;
      continue;
    }

    if (isCurrencyStart(text, cursor)) {
      cursor += 1;
      continue;
    }

    const delimiterLength = text[cursor + 1] === "$" && !isEscaped(text, cursor + 1) ? 2 : 1;
    let closing = cursor + delimiterLength;
    while (closing < text.length) {
      if (
        text[closing] === "$" &&
        !isEscaped(text, closing) &&
        (delimiterLength === 2 ? text[closing + 1] === "$" && !isEscaped(text, closing + 1) : text[closing + 1] !== "$")
      ) {
        break;
      }
      closing += 1;
    }

    if (closing >= text.length) return text.slice(Math.max(0, cursor - 20), Math.min(text.length, cursor + 40));
    cursor = closing + delimiterLength;
  }

  return "";
};

const isCurrencyStart = (text, index) => {
  if (text[index] !== "$" || !/[0-9]/.test(text[index + 1] ?? "")) return false;
  if (hasNearbyClosingDollar(text, index)) return false;
  let cursor = index + 1;
  while (/[0-9,.]/.test(text[cursor] ?? "")) cursor += 1;
  const afterNumber = text.slice(cursor);
  if (/^\s*(?:[=+\-*/^<>\\$×÷≤≥]|&(?:lt|gt|le|ge);|:\d)/i.test(afterNumber)) return false;
  return /^(?:\s|[<&.,;:)]|$)/.test(afterNumber);
};

const hasNearbyClosingDollar = (text, index) => {
  for (let cursor = index + 1; cursor < text.length; cursor += 1) {
    if (text[cursor] === "$" && !isEscaped(text, cursor)) return true;
    if (text[cursor] === "<" || text[cursor] === "\n") return false;
    if (/[.!?;]/.test(text[cursor])) {
      const previous = text[cursor - 1] ?? "";
      const next = text[cursor + 1] ?? "";
      if (!/\d/.test(previous) || !/\d/.test(next)) return false;
    }
  }
  return false;
};

const isEscaped = (text, index) => {
  let count = 0;
  for (let i = index - 1; i >= 0 && text[i] === "\\"; i -= 1) count += 1;
  return count % 2 === 1;
};

const unique = (values) => [...new Set(values.filter(Boolean))];

const extractStrongClaims = (html) => {
  const claims = [];
  const text = String(html);
  const patterns = [
    /\bmatches\s+choice\s+(?:<strong>\s*)?([A-D])(?:\s*<\/strong>)?\b/gi,
    /(?:choice\s+)?<strong>\s*([A-D])\s*<\/strong>\s+(?:is\s+)?\b(?:correct|right|the\s+answer)\b/gi,
    /\bchoice\s+([A-D])\s+(?:is\s+)?\b(?:correct|right|the\s+answer)\b/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) claims.push(match[1].toUpperCase());
  }
  return unique(claims);
};

const auditExplanation = (id, source, raw) => {
  const relativePath = `public/explanations/${id}.json`;
  const explanation = normalizeExplanation(raw);

  if (!explanation) {
    addFailure("missingSteps", id, "No usable explanation steps", relativePath);
    return;
  }

  if (!source.answers.some((answer) => answersMatch(answer, explanation.correctAnswer))) {
    addFailure(
      "correctAnswerMismatches",
      id,
      `source ${source.answers.join(" / ")}; explanation ${explanation.correctAnswer || "(missing)"}`,
      relativePath,
    );
  }

  const texts = stepTexts(explanation);
  for (const value of texts) {
    const rawTexDelimiter = firstRawTexDelimiter(value);
    if (rawTexDelimiter) {
      addFailure("rawTexDelimiters", id, `Found ${rawTexDelimiter}`, relativePath);
      break;
    }
  }

  for (const value of texts) {
    const unmatched = findUnmatchedDollar(value);
    if (unmatched) {
      addFailure("unmatchedDollars", id, unmatched, relativePath);
      break;
    }
  }

  const explanationWords = countWords(explanation.steps.map((step) => step.content).join(" "));
  if (explanationWords < minExplanationWords) {
    addFailure(
      "shortExplanations",
      id,
      `${explanationWords} words; minimum ${minExplanationWords}`,
      relativePath,
    );
  }

  const expectedLetters = unique(source.answers.map(normalizeAnswerToken));
  if (expectedLetters.length > 0 && expectedLetters.every((answer) => /^[A-D]$/.test(answer))) {
    const strongClaims = extractStrongClaims(texts.join("\n"));
    const mismatches = strongClaims.filter((claim) => !expectedLetters.includes(claim));
    if (mismatches.length) {
      addFailure(
        "strongClaimedAnswerMismatches",
        id,
        `source ${expectedLetters.join(" / ")}; strong claim(s) ${unique(mismatches).join(", ")}`,
        relativePath,
      );
    }
  }
};

const sourceIndex = buildSourceIndex();
const explanations = parseExplanationFiles();

for (const [id, source] of sourceIndex) {
  if (!existsSync(path.join(explanationDir, `${id}.json`))) {
    addFailure("missingExplanations", id, `Missing public/explanations/${id}.json`, source.sources.join(", "));
    continue;
  }

  if (explanations.has(id)) auditExplanation(id, source, explanations.get(id));
}

const totalFailures = Object.values(failures).reduce((sum, entries) => sum + entries.length, 0);

console.log("Math explanation audit");
console.log(`Expected math questions: ${sourceIndex.size}`);
console.log(`Explanation files parsed: ${explanations.size}`);
console.log(`Minimum explanation length: ${minExplanationWords} words`);
console.log(`Failures: ${totalFailures}`);

for (const [type, entries] of Object.entries(failures)) {
  if (!entries.length) continue;
  console.log(`\n${type}: ${entries.length}`);
  for (const entry of entries.slice(0, reportLimit)) {
    const location = entry.file ? ` (${entry.file})` : "";
    console.log(`  - ${entry.id}${location}: ${entry.message}`);
  }
  if (entries.length > reportLimit) {
    console.log(`  ... ${entries.length - reportLimit} more`);
  }
}

process.exit(totalFailures > 0 ? 1 : 0);
