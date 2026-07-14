import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const explanationDir = path.join(root, "public/explanations");

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

const readPositiveInteger = (key, fallback) => {
  const raw = args.get(key);
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw) || Number(raw) <= 0 || !Number.isSafeInteger(Number(raw))) {
    throw new Error(`--${key} must be a positive integer: ${raw}`);
  }
  return Number(raw);
};

const reportLimit = readPositiveInteger("limit", 40);
const jsonOutput = args.get("format") === "json";
const includeCovered = args.has("include-covered");

const readText = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(readText(relativePath));

const stripHtml = (value) =>
  String(value ?? "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\\(?:left|right|text|mathrm|operatorname)\b/g, " ")
    .replace(/[{}$]/g, " ")
    .replace(/\\[a-z]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const isMathQuestion = (question) => {
  if (question?.section) return question.section === "Math";
  const subject = question?.category?.subject;
  if (subject) return subject === "Math";
  return false;
};

const sourceQuestions = () => {
  const questions = [];
  for (const question of readJson("src/data/questions/math_past.json")) {
    questions.push({ bank: "past", question });
  }
  for (const question of readJson("src/data/questions/unofficial_math.json")) {
    if (isMathQuestion(question)) questions.push({ bank: "unofficial", question });
  }
  return questions;
};

const asRecord = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : null;
const asString = (value) => typeof value === "string" ? value : "";

const asStringArray = (value) =>
  Array.isArray(value)
    ? value
        .map((item) => {
          if (typeof item === "string") return item;
          const record = asRecord(item);
          return record ? asString(record.latex) || asString(record.expression) : "";
        })
        .filter(Boolean)
    : [];

const asBoolean = (value) => typeof value === "boolean" ? value : undefined;
const asFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value) ? value : undefined;

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
          const latex = column ? asString(column.latex) : "";
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

const normalizeDesmosConfig = ({ expressions, tables, bounds, degreeMode, defaultLogModeRegressions, preserveSquareUnits, showGraphpaper }) => ({
  expressions: asStringArray(expressions),
  tables: normalizeDesmosTables(tables),
  bounds: normalizeDesmosBounds(bounds),
  degreeMode: asBoolean(degreeMode),
  defaultLogModeRegressions: asBoolean(defaultLogModeRegressions),
  preserveSquareUnits: asBoolean(preserveSquareUnits),
  showGraphpaper: asBoolean(showGraphpaper),
});

const normalizeStep = (step) => {
  if (typeof step === "string") return { title: "", content: step, desmosExpressions: [], desmosTables: [] };
  const record = asRecord(step);
  if (!record) return { title: "", content: "", desmosExpressions: [], desmosTables: [] };
  const configs = [
    normalizeDesmosConfig({
      expressions: record.desmosExpressions,
      tables: record.desmosTables,
      bounds: record.desmosBounds,
      degreeMode: record.desmosDegreeMode,
      defaultLogModeRegressions: record.desmosDefaultLogModeRegressions,
      preserveSquareUnits: record.desmosPreserveSquareUnits,
      showGraphpaper: record.desmosShowGraphpaper,
    }),
    ...(Array.isArray(record.desmosGraphs)
      ? record.desmosGraphs
          .map(asRecord)
          .filter(Boolean)
          .map((graph) => normalizeDesmosConfig(graph))
      : []),
  ];
  return {
    title: asString(record.title) || asString(record.heading) || asString(record.label),
    content:
      asString(record.content) ||
      asString(record.text) ||
      asString(record.step) ||
      asString(record.explanation) ||
      asString(record.explanationHtml),
    desmosExpressions: configs.flatMap((config) => config.expressions),
    desmosTables: configs.flatMap((config) => config.tables),
    desmosConfigs: configs,
  };
};

const desmosTableText = (tables) =>
  tables.flatMap((table) => table.columns.flatMap((column) => [column.latex, ...column.values]));

const readExplanation = (id) => {
  const filePath = path.join(explanationDir, `${id}.json`);
  if (!existsSync(filePath)) return null;
  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  const steps = Array.isArray(raw.steps) ? raw.steps.map(normalizeStep) : [];
  const topLevelConfig = normalizeDesmosConfig({
    expressions: raw.desmosExpressions,
    tables: raw.desmosTables,
    bounds: raw.desmosBounds,
    degreeMode: raw.desmosDegreeMode,
    defaultLogModeRegressions: raw.desmosDefaultLogModeRegressions,
    preserveSquareUnits: raw.desmosPreserveSquareUnits,
    showGraphpaper: raw.desmosShowGraphpaper,
  });
  const text = [
    raw.correctAnswer,
    raw.explanation,
    raw.explanationHtml,
    raw.choiceElimination,
    raw.choiceEliminations,
    raw.choiceAnalysis,
    raw.eliminationHtml,
    ...steps.flatMap((step) => [step.title, step.content, ...step.desmosExpressions, ...desmosTableText(step.desmosTables)]),
    ...topLevelConfig.expressions,
    ...desmosTableText(topLevelConfig.tables),
  ]
    .filter(Boolean)
    .join(" ");
  return {
    steps,
    text,
    desmosExpressions: [...steps.flatMap((step) => step.desmosExpressions), ...topLevelConfig.expressions],
    desmosTables: [...steps.flatMap((step) => step.desmosTables), ...topLevelConfig.tables],
  };
};

const choiceText = (question) => (question.choices ?? []).map((choice) => choice.text ?? "").join(" ");
const combinedQuestionText = (question) => `${question.text ?? ""} ${choiceText(question)} ${question.rationale ?? ""}`;

const scoreQuestion = ({ bank, question }) => {
  const id = String(question.id ?? "").trim();
  const rawQuestionText = combinedQuestionText(question);
  const cleanQuestionText = stripHtml(rawQuestionText);
  const lower = cleanQuestionText.toLowerCase();
  const choices = question.choices ?? [];
  const explanation = readExplanation(id);
  const explanationText = stripHtml(explanation?.text ?? "").toLowerCase();
  const expressions = explanation?.desmosExpressions ?? [];
  const tables = explanation?.desmosTables ?? [];
  const expressionText = expressions.join(" ");

  const signals = [];
  let score = 0;

  if (/<table\b/i.test(rawQuestionText) || /\b(?:table|data table|values? in the table)\b/i.test(lower)) {
    signals.push("table/data values in stem");
    score += 4;
  }
  if (/\b(?:scatterplot|scatter plot|line of best fit|data set|data points)\b/i.test(lower)) {
    signals.push("scatter/data modeling language");
    score += 5;
  }
  if (/\b(?:linear|quadratic|exponential)\s+(?:function|model|equation|relationship)\b/i.test(lower)) {
    signals.push("named model family");
    score += 3;
  }
  if (/\b(?:best represents|best models|models the relationship|represents the relationship|which equation|which function)\b/i.test(lower)) {
    signals.push("asks for model/equation choice");
    score += 3;
  }
  if (/\b(?:constant|coefficient|parameter|value of [a-z]|what is [a-z])\b/i.test(lower) && /\b(?:function|equation|model|data|table)\b/i.test(lower)) {
    signals.push("asks for a model parameter");
    score += 2;
  }

  const equationChoiceCount = choices.filter((choice) =>
    /(?:[xy]|f\s*\(|g\s*\(|h\s*\()\s*(?:=|\^)|(?:=|\\frac|\/).*(?:[xy]|f\s*\(|g\s*\(|h\s*\()/i.test(choice.text ?? ""),
  ).length;
  if (equationChoiceCount >= 2) {
    signals.push(`${equationChoiceCount} equation/function choices`);
    score += Math.min(4, equationChoiceCount);
  }

  const hasRegressionMethod = /\b(?:regression|custom regression|fit|fits|table|l_?1|l_?2|x_?1|y_?1)\b/i.test(explanationText) ||
    /(?:\\sim|~)|L_\{?[12]\}?|x_\{?1\}?|y_\{?1\}?/i.test(expressionText);
  const hasDesmos = /\bdesmos\b/i.test(explanationText) || expressions.length > 0 || tables.length > 0;
  const hasTableMethod = tables.length > 0 || /\b(?:enter|put|type|create)\b.{0,60}\b(?:table|points?|values?)\b/i.test(explanationText);

  if (!explanation) {
    signals.push("missing explanation file");
    score += 4;
  } else if (!hasDesmos) {
    signals.push("no Desmos support in explanation");
    score += 3;
  } else if (!hasRegressionMethod && !hasTableMethod) {
    signals.push("Desmos present but no table/regression method");
    score += 2;
  }

  if (/\b(?:slope|intercept|rate of change|initial value)\b/i.test(explanationText) && !hasRegressionMethod && signals.length >= 2) {
    signals.push("uses manual slope/intercept language instead of table fit");
    score += 1;
  }

  if ((hasRegressionMethod || hasTableMethod) && !includeCovered) return null;
  if (!id || score < 7) return null;

  return {
    id,
    bank,
    score,
    domain: question.domain ?? question.category?.domain ?? "",
    skill: question.skill ?? question.category?.skill ?? "",
    answer: question.correctAnswer ?? "",
    hasExplanation: Boolean(explanation),
    desmosExpressionCount: expressions.length,
    desmosTableCount: tables.length,
    signals,
    prompt: cleanQuestionText.slice(0, 300),
  };
};

const candidates = sourceQuestions()
  .map(scoreQuestion)
  .filter(Boolean)
  .sort((a, b) => b.score - a.score || a.bank.localeCompare(b.bank) || a.id.localeCompare(b.id));

const summary = {
  candidates: candidates.length,
  byBank: candidates.reduce((counts, candidate) => {
    counts[candidate.bank] = (counts[candidate.bank] ?? 0) + 1;
    return counts;
  }, {}),
  reportLimit,
};

if (jsonOutput) {
  console.log(JSON.stringify({ summary, candidates: candidates.slice(0, reportLimit) }, null, 2));
} else {
  console.log("Regression/table opportunity audit");
  console.log(`Candidates: ${summary.candidates}`);
  console.log(`Past: ${summary.byBank.past ?? 0}`);
  console.log(`Unofficial: ${summary.byBank.unofficial ?? 0}`);
  for (const candidate of candidates.slice(0, reportLimit)) {
    console.log(`\n${candidate.id} [${candidate.bank}] score ${candidate.score}`);
    console.log(`  Domain: ${candidate.domain || "(unknown)"}`);
    console.log(`  Skill: ${candidate.skill || "(unknown)"}`);
    console.log(`  Answer: ${candidate.answer || "(missing)"}`);
    console.log(`  Desmos expressions: ${candidate.desmosExpressionCount}`);
    console.log(`  Desmos tables: ${candidate.desmosTableCount}`);
    console.log(`  Signals: ${candidate.signals.join("; ")}`);
    console.log(`  Prompt: ${candidate.prompt}`);
  }
}
