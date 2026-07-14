import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const explanationDir = path.join(root, "public/explanations");
const cliArgs = process.argv.slice(2);
if (cliArgs.some((arg) => arg !== "--include-orphans")) {
  throw new Error(`Unknown option: ${cliArgs.find((arg) => arg !== "--include-orphans")}`);
}
const includeOrphans = cliArgs.includes("--include-orphans");
const readPositiveEnvironmentInteger = (name, fallback) => {
  const raw = process.env[name] ?? String(fallback);
  if (!/^\d+$/.test(raw) || Number(raw) <= 0 || !Number.isSafeInteger(Number(raw))) {
    throw new Error(`${name} must be a positive integer: ${raw}`);
  }
  return Number(raw);
};
const minExplanationWords = readPositiveEnvironmentInteger("MIN_EXPLANATION_WORDS", 35);
const reportLimit = readPositiveEnvironmentInteger("AUDIT_LIMIT", 30);

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
  invalidDesmosConfig: [],
};

const addFailure = (type, id, message, file = "") => {
  failures[type].push({ id, file, message });
};

const readJson = (relativePath) => {
  const file = path.join(root, relativePath);
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    addFailure("parse", relativePath, error.message, relativePath);
    return null;
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

  const unofficialMath = readJson("src/data/questions/unofficial_math.json");
  if (Array.isArray(unofficialMath)) {
    for (const question of unofficialMath) {
      addSourceQuestion(sourceIndex, question, "src/data/questions/unofficial_math.json");
    }
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

const asBoolean = (value) => typeof value === "boolean" ? value : undefined;
const asFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value) ? value : undefined;
const parseExactRational = (value) => {
  const stripBalancedOuter = (raw) => {
    let result = raw;
    while ((result[0] === "(" && result.at(-1) === ")")
      || (result[0] === "{" && result.at(-1) === "}")) {
      const opener = result[0];
      const closer = opener === "(" ? ")" : "}";
      let depth = 0;
      let enclosesAll = true;
      for (let index = 0; index < result.length; index += 1) {
        if (result[index] === opener) depth += 1;
        if (result[index] === closer) depth -= 1;
        if (depth === 0 && index < result.length - 1) {
          enclosesAll = false;
          break;
        }
        if (depth < 0) return result;
      }
      if (!enclosesAll || depth !== 0) break;
      result = result.slice(1, -1);
    }
    return result;
  };
  const parseDecimal = (raw) => {
    const match = String(raw).match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
    if (!match) return null;
    const scale = 10n ** BigInt(match[3]?.length ?? 0);
    const digits = BigInt(`${match[2]}${match[3] ?? ""}`);
    return { numerator: match[1] === "-" ? -digits : digits, denominator: scale };
  };
  let normalized = String(value ?? "")
    .replace(/[−–—]/g, "-")
    .replace(/\\(?:left|right)/g, "")
    .replace(/\s+/g, "");
  normalized = stripBalancedOuter(normalized);
  const latexFraction = normalized.match(/^\\frac\{([+-]?\d+(?:\.\d+)?)\}\{([+-]?\d+(?:\.\d+)?)\}$/);
  if (latexFraction) normalized = `${latexFraction[1]}/${latexFraction[2]}`;
  const parts = normalized.split("/");
  if (parts.length > 2) return null;
  const numerator = parseDecimal(parts[0]);
  const denominator = parts.length === 2 ? parseDecimal(parts[1]) : { numerator: 1n, denominator: 1n };
  if (!numerator || !denominator || denominator.numerator === 0n) return null;
  const sign = denominator.numerator < 0n ? -1n : 1n;
  return {
    numerator: numerator.numerator * denominator.denominator * sign,
    denominator: numerator.denominator * denominator.numerator * sign,
  };
};
const compareExactRationals = (left, right) =>
  left.numerator * right.denominator < right.numerator * left.denominator
    ? -1
    : left.numerator * right.denominator > right.numerator * left.denominator
      ? 1
      : 0;

const expressionMetadataErrors = (value, location) => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return [`${location} expressions must be an array`];
  return value.flatMap((item, expressionIndex) => {
    const prefix = `${location} expression ${expressionIndex + 1}`;
    if (typeof item === "string") return item.trim() ? [] : [`${prefix} must not be empty`];
    const record = asRecord(item);
    if (!record) return [`${prefix} must be a string or expression object`];
    const errors = [];
    const latex = asString(record.latex) ?? asString(record.expression);
    if (!latex?.trim()) errors.push(`${prefix} needs a nonempty latex/expression string`);
    for (const key of ["id", "color", "label"]) {
      if (record[key] !== undefined && typeof record[key] !== "string") errors.push(`${prefix} ${key} must be a string`);
    }
    for (const key of ["showLabel", "hidden"]) {
      if (record[key] !== undefined && typeof record[key] !== "boolean") errors.push(`${prefix} ${key} must be a boolean`);
    }
    if (record.playing !== undefined && typeof record.playing !== "boolean") {
      errors.push(`${prefix} playing must be a boolean`);
    }
    if (record.playing === true) errors.push(`${prefix} slider auto-play is not allowed`);
    if (record.sliderBounds !== undefined) {
      if (record.playing !== false) errors.push(`${prefix} sliderBounds require explicit playing false`);
      const sliderBounds = asRecord(record.sliderBounds);
      if (!sliderBounds || Object.keys(sliderBounds).sort().join(",") !== "max,min,step" ||
          !["min", "max", "step"].every((key) => typeof sliderBounds[key] === "string" && sliderBounds[key].trim())) {
        errors.push(`${prefix} sliderBounds must contain nonempty min, max, and step strings`);
      } else {
        const parsed = Object.fromEntries(
          ["min", "max", "step"].map((key) => [key, parseExactRational(sliderBounds[key])]),
        );
        if (!parsed.min || !parsed.max || !parsed.step) {
          errors.push(`${prefix} sliderBounds must be exact numeric values`);
        } else if (compareExactRationals(parsed.min, parsed.max) >= 0 || compareExactRationals(parsed.step, parseExactRational("0")) <= 0) {
          errors.push(`${prefix} sliderBounds require min < max and a positive step`);
        }
      }
    }
    if (record.playing !== undefined && record.sliderBounds === undefined) {
      errors.push(`${prefix} playing requires explicit sliderBounds`);
    }
    const sliderAssignment = latex?.match(/^\s*([A-Za-z](?:_\{[^}]+\}|_[A-Za-z0-9])?)\s*=\s*.+$/);
    if (record.sliderBounds !== undefined && (!sliderAssignment || ["x", "y"].includes(sliderAssignment[1].replace(/[{}\s]/g, "").toLowerCase()))) {
      errors.push(`${prefix} sliderBounds require a single parameter assignment`);
    }
    if (typeof record.id === "string" && !record.id.trim()) errors.push(`${prefix} id must not be empty`);
    if (typeof record.color === "string" && !record.color.trim()) errors.push(`${prefix} color must not be empty`);
    if (typeof record.label === "string" && record.label.trim().toLowerCase() === "undefined") {
      errors.push(`${prefix} label must not be the literal string "undefined"`);
    }
    return errors;
  });
};

const explanationExpressionMetadataErrors = (raw) => {
  const data = asRecord(raw);
  if (!data) return [];
  const errors = expressionMetadataErrors(data.desmosExpressions, "top-level Desmos config");
  if (!Array.isArray(data.steps)) return errors;
  data.steps.forEach((rawStep, stepIndex) => {
    const step = asRecord(rawStep);
    if (!step) return;
    errors.push(...expressionMetadataErrors(step.desmosExpressions, `step ${stepIndex + 1} inline Desmos config`));
    if (!Array.isArray(step.desmosGraphs)) return;
    step.desmosGraphs.forEach((rawGraph, graphIndex) => {
      const graph = asRecord(rawGraph);
      if (!graph) return;
      errors.push(...expressionMetadataErrors(graph.expressions, `step ${stepIndex + 1} Desmos graph ${graphIndex + 1}`));
    });
  });
  return errors;
};

const normalizeDesmosBounds = (value) => {
  const bounds = asRecord(value);
  if (!bounds) return undefined;
  const left = asFiniteNumber(bounds.left);
  const right = asFiniteNumber(bounds.right);
  const bottom = asFiniteNumber(bounds.bottom);
  const top = asFiniteNumber(bounds.top);
  if (left === undefined || right === undefined || bottom === undefined || top === undefined) return undefined;
  if (left >= right || bottom >= top) return undefined;
  return { left, right, bottom, top };
};

const normalizeDesmosTables = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((rawTable) => {
      const table = asRecord(rawTable);
      if (!table || !Array.isArray(table.columns)) return null;
      const columns = table.columns
        .map((rawColumn) => {
          const column = asRecord(rawColumn);
          const latex = column ? asString(column.latex) : undefined;
          if (!latex || !Array.isArray(column.values)) return null;
          const values = column.values
            .map((item) => typeof item === "string" || typeof item === "number" ? String(item) : "");
          return values.some((item) => item.trim().length > 0) ? { latex, values } : null;
        })
        .filter(Boolean);
      return columns.length >= 2 ? { columns } : null;
    })
    .filter(Boolean);
};

const normalizeDesmosGraph = (value) => {
  const graph = asRecord(value);
  if (!graph) return null;
  const expressions = asStringArray(graph.expressions);
  const tables = normalizeDesmosTables(graph.tables);
  if (!expressions.length && !tables.length) return null;
  return {
    label: asString(graph.label),
    expressions,
    tables,
    bounds: normalizeDesmosBounds(graph.bounds),
    degreeMode: asBoolean(graph.degreeMode),
    defaultLogModeRegressions: asBoolean(graph.defaultLogModeRegressions),
    preserveSquareUnits: asBoolean(graph.preserveSquareUnits),
    showGraphpaper: asBoolean(graph.showGraphpaper),
  };
};

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
    desmosTables: normalizeDesmosTables(step.desmosTables),
    desmosBounds: normalizeDesmosBounds(step.desmosBounds),
    desmosDegreeMode: asBoolean(step.desmosDegreeMode),
    desmosDefaultLogModeRegressions: asBoolean(step.desmosDefaultLogModeRegressions),
    desmosPreserveSquareUnits: asBoolean(step.desmosPreserveSquareUnits),
    desmosShowGraphpaper: asBoolean(step.desmosShowGraphpaper),
    desmosGraphs: Array.isArray(step.desmosGraphs)
      ? step.desmosGraphs.map(normalizeDesmosGraph).filter(Boolean)
      : [],
  };
};

const normalizeExplanation = (raw) => {
  const data = asRecord(raw);
  if (!data) return null;

  const steps = Array.isArray(data.steps)
    ? data.steps.map(normalizeStep).filter(Boolean)
    : [];

  const legacyExplanation = asString(data.explanation);
  const explanationHtml = asString(data.explanationHtml) ?? legacyExplanation;
  if (!steps.length && explanationHtml) steps.push({ title: "Explanation", content: explanationHtml });

  const choiceElimination =
    asString(data.choiceElimination) ??
    asString(data.choiceEliminations) ??
    asString(data.choiceAnalysis) ??
    asString(data.eliminationHtml) ??
    (steps.length ? legacyExplanation : undefined);
  const rootDesmosExpressions = asStringArray(data.desmosExpressions);
  const rootDesmosTables = normalizeDesmosTables(data.desmosTables);
  const rootDesmosConfig = {
    desmosExpressions: rootDesmosExpressions,
    desmosTables: rootDesmosTables,
    desmosBounds: normalizeDesmosBounds(data.desmosBounds),
    desmosDegreeMode: asBoolean(data.desmosDegreeMode),
    desmosDefaultLogModeRegressions: asBoolean(data.desmosDefaultLogModeRegressions),
    desmosPreserveSquareUnits: asBoolean(data.desmosPreserveSquareUnits),
    desmosShowGraphpaper: asBoolean(data.desmosShowGraphpaper),
  };
  let appendedChoiceElimination = false;
  if (choiceElimination) {
    const existingText = stripHtml(steps.map((step) => step.content).join(" ")).toLowerCase();
    const choiceText = stripHtml(choiceElimination).toLowerCase();
    if (!existingText.includes(choiceText.slice(0, 120))) {
      steps.push({
        title: "Check the choices",
        content: choiceElimination,
        ...rootDesmosConfig,
        desmosGraphs: [],
      });
      appendedChoiceElimination = true;
    }
  }

  if (!appendedChoiceElimination && steps.length) {
    if (rootDesmosExpressions.length || rootDesmosTables.length) {
      steps[steps.length - 1] = {
        ...steps[steps.length - 1],
        ...rootDesmosConfig,
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

const parseExplanationFiles = (canonicalIds) => {
  const parsed = new Map();
  let files = [];
  try {
    files = readdirSync(explanationDir)
      .filter((file) => file.endsWith(".json"))
      .filter((file) => includeOrphans || canonicalIds.has(file.replace(/\.json$/i, "")))
      .sort();
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
    for (const table of step.desmosTables ?? []) {
      for (const column of table.columns ?? []) values.push(column.latex, ...(column.values ?? []));
    }
    for (const graph of step.desmosGraphs ?? []) {
      values.push(graph.label);
      for (const expression of graph.expressions ?? []) values.push(expression);
      for (const table of graph.tables ?? []) {
        for (const column of table.columns ?? []) values.push(column.latex, ...(column.values ?? []));
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

  for (const message of explanationExpressionMetadataErrors(raw)) {
    addFailure("invalidDesmosConfig", id, message, relativePath);
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
const explanations = parseExplanationFiles(new Set(sourceIndex.keys()));

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
console.log(`Include orphan explanations: ${includeOrphans}`);
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
