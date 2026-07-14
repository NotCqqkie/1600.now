import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = path.join(ROOT, "tmp", "desmos-audit", "render-qa");
const REPORT_PATH = path.join(OUTPUT_DIR, "report.json");
const DEFAULT_BASE_URL = "http://127.0.0.1:8080";
const READY_TIMEOUT_MS = 90_000;
const NAVIGATION_TIMEOUT_MS = 60_000;
const PIXEL_TOLERANCE = 2;
const NUMBER_TOLERANCE = 1e-7;
const SURROGATE_BANK = "past";
const SURROGATE_ID = "f2c59cee";
const SURROGATE_ROUTE = `/bank/math/${SURROGATE_ID}?bankType=${SURROGATE_BANK}`;
const SURROGATE_EXPLANATION_PATH = `/explanations/${SURROGATE_ID}.json`;
const SURROGATE_DETAIL_PATH = "/generated/bank-question-shards/past-math-0.json";
const UNROUTABLE_MATH_IDS = new Set(["bf0e4735"]);
const HIDDEN_BANK_QUESTIONS_FILE = path.join(
  ROOT,
  "src",
  "lib",
  "generated",
  "hiddenBankQuestions.generated.ts",
);
const SURROGATE_DETAIL_FILE = path.join(
  ROOT,
  "public",
  "generated",
  "bank-question-shards",
  "past-math-0.json",
);
const DESMOS_EXPRESSION_COLORS = [
  "#2d70b3",
  "#388c46",
  "#fa7e19",
  "#c74440",
  "#6042a6",
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 950, isMobile: false, hasTouch: false },
  { name: "mobile", width: 390, height: 844, isMobile: true, hasTouch: true },
];

const BANK_INPUTS = [
  {
    bank: "past",
    file: path.join(ROOT, "src", "data", "questions", "math_past.json"),
  },
  {
    bank: "unofficial",
    file: path.join(ROOT, "src", "data", "questions", "unofficial_math.json"),
  },
];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const readHiddenBankQuestionIds = () => {
  const source = fs.readFileSync(HIDDEN_BANK_QUESTIONS_FILE, "utf8");
  const fileLabel = path.relative(ROOT, HIDDEN_BANK_QUESTIONS_FILE).split(path.sep).join("/");
  const match = source.match(/HIDDEN_BANK_QUESTION_IDS\s*=\s*(\[[\s\S]*?\])\s*as const/);
  if (!match) throw new Error(`Could not parse ${fileLabel}`);
  const ids = JSON.parse(match[1]);
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) {
    throw new Error(`${fileLabel} has an invalid hidden-ID array`);
  }
  return new Set(ids);
};

const HIDDEN_BANK_QUESTION_IDS = readHiddenBankQuestionIds();

const limitedRequestedIds = (ids, limit) => Number.isFinite(limit) ? ids.slice(0, limit) : ids;

const parseArgs = (argv) => {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const equalsIndex = token.indexOf("=");
    const key = token.slice(2, equalsIndex === -1 ? undefined : equalsIndex);
    let value = equalsIndex === -1 ? undefined : token.slice(equalsIndex + 1);
    if (value === undefined && argv[index + 1] && !argv[index + 1].startsWith("--")) {
      value = argv[index + 1];
      index += 1;
    }
    if (value === undefined) value = "true";
    const existing = values.get(key) ?? [];
    existing.push(value);
    values.set(key, existing);
  }

  const known = new Set(["base-url", "ids", "limit", "help"]);
  for (const key of values.keys()) {
    if (!known.has(key)) throw new Error(`Unknown option: --${key}`);
  }

  if (values.has("help")) {
    console.log([
      "Usage: node scripts/verify-desmos-previews.mjs [options]",
      "",
      `  --base-url <url>  App origin (default ${DEFAULT_BASE_URL})`,
      "  --ids <id,...>    Only verify the listed canonical math question IDs",
      "  --limit <number>  Verify at most this many selected questions",
    ].join("\n"));
    process.exit(0);
  }

  const rawBaseUrl = values.get("base-url")?.at(-1) ?? DEFAULT_BASE_URL;
  let baseUrl;
  try {
    baseUrl = new URL(rawBaseUrl);
  } catch {
    throw new Error(`Invalid --base-url: ${rawBaseUrl}`);
  }
  if (!/^https?:$/.test(baseUrl.protocol)) {
    throw new Error(`--base-url must use http or https: ${rawBaseUrl}`);
  }
  baseUrl.pathname = baseUrl.pathname.replace(/\/+$/, "") || "/";
  baseUrl.search = "";
  baseUrl.hash = "";

  const ids = (values.get("ids") ?? [])
    .flatMap((value) => value.split(/[\s,]+/))
    .map((value) => value.trim())
    .filter(Boolean);
  const uniqueIds = [...new Set(ids)];

  const rawLimit = values.get("limit")?.at(-1);
  const limit = rawLimit === undefined ? Number.POSITIVE_INFINITY : Number.parseInt(rawLimit, 10);
  if (!(limit > 0)) throw new Error(`--limit must be a positive integer: ${rawLimit}`);
  const effectiveIds = limitedRequestedIds(uniqueIds, limit);

  return {
    baseUrl: baseUrl.href.replace(/\/$/, ""),
    ids: effectiveIds,
    requestedIds: uniqueIds,
    limit,
  };
};

const asRecord = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : null;

const hasArrayItems = (value) => Array.isArray(value) && value.length > 0;

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

const relativeToRoot = (file) => path.relative(ROOT, file).split(path.sep).join("/");

const stableMathQuestionId = (bank, id) => `bank-${bank}-math-${id}`;

const requiresSurrogateRoute = (bank, id) =>
  HIDDEN_BANK_QUESTION_IDS.has(stableMathQuestionId(bank, id)) || UNROUTABLE_MATH_IDS.has(id);

const makeSurrogateDetailPayload = (correctAnswer) => {
  const rows = readJson(SURROGATE_DETAIL_FILE);
  if (!Array.isArray(rows)) throw new Error(`${relativeToRoot(SURROGATE_DETAIL_FILE)} must contain an array`);
  let patched = false;
  const payload = rows.map((row) => {
    if (asRecord(row)?.sourceId !== SURROGATE_ID) return row;
    patched = true;
    return { ...row, correctAnswer };
  });
  if (!patched) throw new Error(`${SURROGATE_ID} is absent from ${relativeToRoot(SURROGATE_DETAIL_FILE)}`);
  return `${JSON.stringify(payload)}\n`;
};

const sanitizeFilePart = (value) => String(value).replace(/[^A-Za-z0-9._-]+/g, "-");

const normalizeBounds = (value) => {
  const record = asRecord(value);
  if (!record) return null;
  const bounds = {
    left: record.left,
    right: record.right,
    bottom: record.bottom,
    top: record.top,
  };
  if (!Object.values(bounds).every((number) => typeof number === "number" && Number.isFinite(number))) {
    return null;
  }
  if (bounds.left >= bounds.right || bounds.bottom >= bounds.top) return null;
  return bounds;
};

const normalizeExpressions = (value) => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string" && item.trim()) return [{ latex: item }];
    const record = asRecord(item);
    const latex = typeof record?.latex === "string"
      ? record.latex
      : typeof record?.expression === "string"
        ? record.expression
        : "";
    if (!latex.trim()) return [];
    return [{
      latex,
      ...(typeof record.id === "string" && record.id ? { id: record.id } : {}),
      ...(typeof record.color === "string" && record.color ? { color: record.color } : {}),
      ...(typeof record.label === "string" && record.label ? { label: record.label } : {}),
      ...(typeof record.showLabel === "boolean" ? { showLabel: record.showLabel } : {}),
      ...(typeof record.hidden === "boolean" ? { hidden: record.hidden } : {}),
      ...(asRecord(record.sliderBounds)
        && ["min", "max", "step"].every((key) => typeof record.sliderBounds[key] === "string")
        ? { sliderBounds: {
            min: record.sliderBounds.min,
            max: record.sliderBounds.max,
            step: record.sliderBounds.step,
          } }
        : {}),
      ...(typeof record.playing === "boolean" ? { playing: record.playing } : {}),
    }];
  });
};

const normalizeTables = (value) => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rawTable) => {
    const table = asRecord(rawTable);
    if (!Array.isArray(table?.columns)) return [];
    const columns = table.columns.flatMap((rawColumn) => {
      const column = asRecord(rawColumn);
      if (typeof column?.latex !== "string" || !column.latex.trim() || !Array.isArray(column.values)) {
        return [];
      }
      const values = column.values
        .map((item) => typeof item === "string" || typeof item === "number" ? String(item) : "");
      return values.length ? [{ latex: column.latex, values }] : [];
    });
    return columns.length >= 2 ? [{ columns }] : [];
  });
};

const parseLatexNumber = (rawValue) => {
  let value = String(rawValue ?? "")
    .replace(/[−–]/g, "-")
    .replace(/\\(?:left|right)/g, "")
    .replace(/\\[,!;]/g, "")
    .replace(/\s+/g, "");
  if (!value) return null;
  while (value.startsWith("{") && value.endsWith("}")) value = value.slice(1, -1);
  const direct = Number(value);
  if (Number.isFinite(direct)) return direct;
  if (value.startsWith("-")) {
    const nested = parseLatexNumber(value.slice(1));
    return nested === null ? null : -nested;
  }
  const fraction = value.match(/^\\frac\{(.+)\}\{(.+)\}$/);
  if (fraction) {
    const numerator = parseLatexNumber(fraction[1]);
    const denominator = parseLatexNumber(fraction[2]);
    return numerator === null || denominator === null || denominator === 0
      ? null
      : numerator / denominator;
  }
  const slashIndex = value.indexOf("/");
  if (slashIndex > 0 && slashIndex === value.lastIndexOf("/")) {
    const numerator = parseLatexNumber(value.slice(0, slashIndex));
    const denominator = parseLatexNumber(value.slice(slashIndex + 1));
    return numerator === null || denominator === null || denominator === 0
      ? null
      : numerator / denominator;
  }
  const squareRoot = value.match(/^\\sqrt\{(.+)\}$/);
  if (squareRoot) {
    const radicand = parseLatexNumber(squareRoot[1]);
    return radicand === null || radicand < 0 ? null : Math.sqrt(radicand);
  }
  return null;
};

const parseExactSliderBound = (rawValue) => {
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
  let value = String(rawValue ?? "")
    .replace(/[−–—]/g, "-")
    .replace(/\\(?:left|right)/g, "")
    .replace(/\s+/g, "");
  value = stripBalancedOuter(value);
  const decimal = (raw) => /^[+-]?\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : null;
  const direct = decimal(value);
  if (direct !== null && Number.isFinite(direct)) return direct;
  const latexFraction = value.match(/^\\frac\{([+-]?\d+(?:\.\d+)?)\}\{([+-]?\d+(?:\.\d+)?)\}$/);
  const slashFraction = value.match(/^([+-]?\d+(?:\.\d+)?)\/([+-]?\d+(?:\.\d+)?)$/);
  const fraction = latexFraction ?? slashFraction;
  if (!fraction) return null;
  const numerator = Number(fraction[1]);
  const denominator = Number(fraction[2]);
  const result = numerator / denominator;
  return denominator !== 0 && Number.isFinite(result) ? result : null;
};

const parseLabeledPoint = (expression) => {
  const record = asRecord(expression);
  if (!record || record.showLabel !== true) return null;
  const latex = typeof record.latex === "string"
    ? record.latex
    : typeof record.expression === "string"
      ? record.expression
      : "";
  const normalized = latex
    .replace(/\\(?:left|right)/g, "")
    .replace(/\\[,!;]/g, "")
    .replace(/\s+/g, "");
  if (!normalized.startsWith("(") || !normalized.endsWith(")")) return null;
  const interior = normalized.slice(1, -1);
  let braceDepth = 0;
  let commaIndex = -1;
  for (let index = 0; index < interior.length; index += 1) {
    if (interior[index] === "{") braceDepth += 1;
    if (interior[index] === "}") braceDepth -= 1;
    if (interior[index] === "," && braceDepth === 0) {
      commaIndex = index;
      break;
    }
  }
  if (commaIndex === -1) return null;
  const x = parseLatexNumber(interior.slice(0, commaIndex));
  const y = parseLatexNumber(interior.slice(commaIndex + 1));
  if (x === null || y === null) return null;
  return {
    x,
    y,
    latex,
    label: typeof record.label === "string" ? record.label : latex,
  };
};

const makeFailure = (details) => ({
  phase: details.phase,
  code: details.code,
  message: details.message,
  ...(details.bank ? { bank: details.bank } : {}),
  ...(details.id ? { id: details.id } : {}),
  ...(Number.isInteger(details.stepIndex) ? { stepIndex: details.stepIndex } : {}),
  ...(Number.isInteger(details.embedIndex) ? { embedIndex: details.embedIndex } : {}),
  ...(details.viewport ? { viewport: details.viewport } : {}),
  ...(details.sourcePath ? { sourcePath: details.sourcePath } : {}),
});

const hasOwn = (record, key) => Object.prototype.hasOwnProperty.call(record, key);

const collectAuthoredTypeErrors = ({
  record,
  expressionsKey,
  tablesKey,
  boundsKey,
  degreeKey,
  logKey,
  squareKey,
  graphpaperKey,
}) => {
  const errors = [];
  const add = (field, expected) => errors.push(`${field} must be ${expected}`);

  if (hasOwn(record, expressionsKey)) {
    if (!Array.isArray(record[expressionsKey])) {
      add(expressionsKey, "an array");
    } else {
      record[expressionsKey].forEach((item, expressionIndex) => {
        const field = `${expressionsKey}[${expressionIndex}]`;
        if (typeof item === "string") return;
        const expression = asRecord(item);
        if (!expression) {
          add(field, "a string or object");
          return;
        }
        for (const key of ["latex", "expression", "id", "color", "label"]) {
          if (hasOwn(expression, key) && typeof expression[key] !== "string") {
            add(`${field}.${key}`, "a string");
          }
        }
        for (const key of ["showLabel", "hidden"]) {
          if (hasOwn(expression, key) && typeof expression[key] !== "boolean") {
            add(`${field}.${key}`, "a boolean");
          }
        }
        if (hasOwn(expression, "playing") && typeof expression.playing !== "boolean") {
          add(`${field}.playing`, "a boolean");
        }
        if (hasOwn(expression, "sliderBounds")) {
          const sliderBounds = asRecord(expression.sliderBounds);
          if (!sliderBounds) {
            add(`${field}.sliderBounds`, "an object");
          } else {
            const keys = Object.keys(sliderBounds).sort().join(",");
            if (keys !== "max,min,step") add(`${field}.sliderBounds`, "an object containing exactly min, max, and step");
            for (const key of ["min", "max", "step"]) {
              if (typeof sliderBounds[key] !== "string" || !sliderBounds[key].trim()) {
                add(`${field}.sliderBounds.${key}`, "a nonempty string");
              }
            }
          }
        }
      });
    }
  }

  if (hasOwn(record, tablesKey)) {
    if (!Array.isArray(record[tablesKey])) {
      add(tablesKey, "an array");
    } else {
      record[tablesKey].forEach((item, tableIndex) => {
        const tableField = `${tablesKey}[${tableIndex}]`;
        const table = asRecord(item);
        if (!table) {
          add(tableField, "an object");
          return;
        }
        if (!Array.isArray(table.columns)) {
          add(`${tableField}.columns`, "an array");
          return;
        }
        table.columns.forEach((itemColumn, columnIndex) => {
          const columnField = `${tableField}.columns[${columnIndex}]`;
          const column = asRecord(itemColumn);
          if (!column) {
            add(columnField, "an object");
            return;
          }
          if (typeof column.latex !== "string") add(`${columnField}.latex`, "a string");
          if (!Array.isArray(column.values)) {
            add(`${columnField}.values`, "an array");
            return;
          }
          column.values.forEach((value, valueIndex) => {
            const validValue = typeof value === "string"
              || (typeof value === "number" && Number.isFinite(value));
            if (!validValue) add(`${columnField}.values[${valueIndex}]`, "a string or finite number");
          });
        });
      });
    }
  }

  if (hasOwn(record, boundsKey)) {
    const bounds = asRecord(record[boundsKey]);
    if (!bounds) {
      add(boundsKey, "an object");
    } else {
      for (const key of ["left", "right", "bottom", "top"]) {
        if (typeof bounds[key] !== "number" || !Number.isFinite(bounds[key])) {
          add(`${boundsKey}.${key}`, "a finite number");
        }
      }
    }
  }

  for (const key of [degreeKey, logKey, squareKey, graphpaperKey]) {
    if (hasOwn(record, key) && typeof record[key] !== "boolean") add(key, "a boolean");
  }
  return errors;
};

const makeEmbedConfig = ({ raw, kind, sourcePath, stepIndex, embedIndex, keyPrefix }) => {
  const record = asRecord(raw) ?? {};
  const expressionsKey = keyPrefix ? `${keyPrefix}Expressions` : "expressions";
  const tablesKey = keyPrefix ? `${keyPrefix}Tables` : "tables";
  const boundsKey = keyPrefix ? `${keyPrefix}Bounds` : "bounds";
  const degreeKey = keyPrefix ? `${keyPrefix}DegreeMode` : "degreeMode";
  const logKey = keyPrefix ? `${keyPrefix}DefaultLogModeRegressions` : "defaultLogModeRegressions";
  const squareKey = keyPrefix ? `${keyPrefix}PreserveSquareUnits` : "preserveSquareUnits";
  const graphpaperKey = keyPrefix ? `${keyPrefix}ShowGraphpaper` : "showGraphpaper";
  const authoredTypeErrors = collectAuthoredTypeErrors({
    record,
    expressionsKey,
    tablesKey,
    boundsKey,
    degreeKey,
    logKey,
    squareKey,
    graphpaperKey,
  });
  const rawExpressions = record[expressionsKey];
  const rawTables = record[tablesKey];
  const expressions = normalizeExpressions(rawExpressions);
  const tables = normalizeTables(rawTables);
  const bounds = normalizeBounds(record[boundsKey]);
  const explicitDegreeMode = typeof record[degreeKey] === "boolean";
  const explicitLogMode = typeof record[logKey] === "boolean";
  const explicitSquareMode = typeof record[squareKey] === "boolean";
  const explicitShowGraphpaper = typeof record[graphpaperKey] === "boolean";
  const degreeMode = explicitDegreeMode ? record[degreeKey] : true;
  const defaultLogModeRegressions = explicitLogMode ? record[logKey] : false;
  const showGraphpaper = explicitShowGraphpaper ? record[graphpaperKey] : true;
  const preserveSquareUnits = explicitSquareMode ? record[squareKey] : false;
  const labeledPoints = Array.isArray(rawExpressions)
    ? rawExpressions.map(parseLabeledPoint).filter(Boolean)
    : [];

  return {
    kind,
    sourcePath,
    stepIndex,
    embedIndex,
    expressions,
    tables,
    bounds,
    degreeMode,
    defaultLogModeRegressions,
    preserveSquareUnits,
    showGraphpaper,
    labeledPoints,
    sourceMeta: {
      authoredExpressionCount: Array.isArray(rawExpressions) ? rawExpressions.length : 0,
      authoredTableCount: Array.isArray(rawTables) ? rawTables.length : 0,
      explicitDegreeMode,
      explicitLogMode,
      explicitSquareMode,
      explicitShowGraphpaper,
      authoredTypeErrors,
      authoredBounds: record[boundsKey] ?? null,
    },
  };
};

const directStepBearing = (step) => {
  const record = asRecord(step);
  return Boolean(record && (hasArrayItems(record.desmosExpressions) || hasArrayItems(record.desmosTables)));
};

const graphBearing = (graph) => {
  const record = asRecord(graph);
  return Boolean(record && (hasArrayItems(record.expressions) || hasArrayItems(record.tables)));
};

const rootBearing = (explanation) => {
  const record = asRecord(explanation);
  return Boolean(record && (hasArrayItems(record.desmosExpressions) || hasArrayItems(record.desmosTables)));
};

const collectStepConfigs = (explanation) => {
  const rawSteps = Array.isArray(explanation.steps) ? explanation.steps : [];
  const steps = rawSteps.map((rawStep, stepIndex) => {
    const embeds = [];
    if (directStepBearing(rawStep)) {
      embeds.push(makeEmbedConfig({
        raw: rawStep,
        kind: "step",
        sourcePath: `steps[${stepIndex}]`,
        stepIndex,
        embedIndex: embeds.length,
        keyPrefix: "desmos",
      }));
    }
    const record = asRecord(rawStep);
    if (Array.isArray(record?.desmosGraphs)) {
      record.desmosGraphs.forEach((graph, graphIndex) => {
        if (!graphBearing(graph)) return;
        embeds.push(makeEmbedConfig({
          raw: graph,
          kind: "graph",
          sourcePath: `steps[${stepIndex}].desmosGraphs[${graphIndex}]`,
          stepIndex,
          embedIndex: embeds.length,
          keyPrefix: "",
        }));
      });
    }
    return { stepIndex, embeds };
  });

  if (rootBearing(explanation) && steps.length) {
    const lastStep = steps.at(-1);
    lastStep.embeds = lastStep.embeds.filter((embed) => embed.kind !== "step");
    lastStep.embeds.unshift(makeEmbedConfig({
      raw: explanation,
      kind: "root",
      sourcePath: "root",
      stepIndex: lastStep.stepIndex,
      embedIndex: 0,
      keyPrefix: "desmos",
    }));
    lastStep.embeds.forEach((embed, embedIndex) => { embed.embedIndex = embedIndex; });
  }

  return steps;
};

const validateEmbedSource = (question, embed) => {
  const failures = [];
  const base = {
    phase: "source",
    bank: question.bank,
    id: question.id,
    stepIndex: embed.stepIndex,
    embedIndex: embed.embedIndex,
    sourcePath: embed.sourcePath,
  };
  const add = (code, message) => failures.push(makeFailure({ ...base, code, message }));

  for (const typeError of embed.sourceMeta.authoredTypeErrors) {
    add("wrong-authored-field-type", typeError);
  }

  if (!embed.expressions.length && !embed.tables.length) {
    add("empty-embed", "Desmos config has no valid expressions or tables after normalization");
  }
  if (embed.expressions.length !== embed.sourceMeta.authoredExpressionCount) {
    add("invalid-expression", "One or more authored Desmos expressions are invalid or empty");
  }
  if (embed.tables.length !== embed.sourceMeta.authoredTableCount) {
    add("invalid-table", "One or more authored Desmos tables are invalid");
  }
  if (!embed.sourceMeta.explicitDegreeMode) {
    add("missing-degree-mode", "Desmos degree mode must be an explicit boolean");
  }
  if (!embed.sourceMeta.explicitLogMode) {
    add("missing-log-mode", "Desmos default regression log mode must be an explicit boolean");
  }
  if (!embed.sourceMeta.explicitSquareMode) {
    add("missing-square-mode", "Desmos square-unit preservation must be an explicit boolean");
  }
  if (!embed.sourceMeta.explicitShowGraphpaper) {
    add("missing-graphpaper-mode", "Desmos graphpaper visibility must be an explicit boolean");
  }
  if (!embed.bounds) {
    add("invalid-bounds", "Every Desmos embed requires finite, ordered authored bounds");
  }

  const expectedExpressionIds = new Set();
  const expectedTableIds = new Set(embed.tables.map((_, tableIndex) => `table-${tableIndex}`));
  for (const [expressionIndex, expression] of embed.expressions.entries()) {
    const expressionId = expression.id ?? `expr-${expressionIndex}`;
    if (expectedExpressionIds.has(expressionId) || expectedTableIds.has(expressionId)) {
      add("duplicate-expression-id", `Expression ${expressionIndex + 1} uses a duplicate or table-reserved id: ${expressionId}`);
    }
    expectedExpressionIds.add(expressionId);
    if (expression.label?.trim().toLowerCase() === "undefined") {
      add("invalid-expression-label", `Expression ${expressionIndex + 1} has the literal label "undefined"`);
    }
    if (expression.playing === true) {
      add("slider-autoplay", `Expression ${expressionIndex + 1} enables slider autoplay`);
    }
    if (expression.playing !== undefined && !expression.sliderBounds) {
      add("slider-playing-without-bounds", `Expression ${expressionIndex + 1} sets playing without slider bounds`);
    }
    if (expression.sliderBounds) {
      if (expression.playing !== false) {
        add("slider-playing-not-explicitly-false", `Expression ${expressionIndex + 1} needs playing: false`);
      }
      const min = parseExactSliderBound(expression.sliderBounds.min);
      const max = parseExactSliderBound(expression.sliderBounds.max);
      const step = parseExactSliderBound(expression.sliderBounds.step);
      if (![min, max, step].every((value) => value !== null)) {
        add("invalid-slider-bounds", `Expression ${expressionIndex + 1} slider bounds must be numeric`);
      } else if (min >= max || step <= 0) {
        add("unordered-slider-bounds", `Expression ${expressionIndex + 1} needs min < max and a positive step`);
      }
      const assignment = expression.latex.match(/^\s*([A-Za-z](?:_\{[^}]+\}|_[A-Za-z0-9])?)\s*=\s*.+$/);
      const parameter = assignment?.[1]?.replace(/[{}\s]/g, "").toLowerCase();
      if (!assignment || parameter === "x" || parameter === "y") {
        add("invalid-slider-parameter", `Expression ${expressionIndex + 1} must assign one non-x/y slider parameter`);
      }
    }
  }

  for (const [tableIndex, table] of embed.tables.entries()) {
    if (table.columns.length < 2) {
      add("invalid-table-columns", `Table ${tableIndex + 1} has fewer than two columns`);
      continue;
    }
    const rowCounts = table.columns.map((column) => column.values.length);
    if (!rowCounts.length || rowCounts.some((rowCount) => rowCount < 1)) {
      add("invalid-table-rows", `Table ${tableIndex + 1} has no data rows`);
    }
    if (new Set(rowCounts).size !== 1) {
      add("uneven-table-rows", `Table ${tableIndex + 1} columns have different row counts`);
    }
  }

  if (embed.showGraphpaper && embed.bounds) {
    for (const point of embed.labeledPoints) {
      const inside = point.x >= embed.bounds.left && point.x <= embed.bounds.right
        && point.y >= embed.bounds.bottom && point.y <= embed.bounds.top;
      if (!inside) {
        add("target-outside-authored-bounds", `Labeled point ${point.label} is outside authored bounds`);
      }
    }
  }

  return failures;
};

const collectQuestions = (cli) => {
  const failures = [];
  const questions = [];
  const inputSummary = [];
  const seenBankIds = new Set();
  const desmosIds = new Set();
  const invalidExplanations = new Map();

  for (const input of BANK_INPUTS) {
    const rows = readJson(input.file);
    if (!Array.isArray(rows)) throw new Error(`${relativeToRoot(input.file)} must contain an array`);
    inputSummary.push({ bank: input.bank, file: relativeToRoot(input.file), questions: rows.length });
    for (const rawQuestion of rows) {
      const question = asRecord(rawQuestion);
      const id = typeof question?.id === "string" ? question.id : "";
      if (!id) continue;
      seenBankIds.add(id);
      if (cli.ids.length && !cli.ids.includes(id)) continue;
      const explanationFile = path.join(ROOT, "public", "explanations", `${id}.json`);
      if (!fs.existsSync(explanationFile)) continue;
      let explanation;
      let explanationPayload;
      try {
        explanationPayload = fs.readFileSync(explanationFile, "utf8");
        explanation = JSON.parse(explanationPayload);
      } catch (error) {
        invalidExplanations.set(id, makeFailure({
          phase: "source",
          code: "invalid-explanation-json",
          message: error.message,
          bank: input.bank,
          id,
        }));
        continue;
      }
      const steps = collectStepConfigs(explanation);
      if (!steps.some((step) => step.embeds.length)) continue;
      desmosIds.add(id);
      const targetRoute = `/bank/math/${encodeURIComponent(id)}?bankType=${input.bank}`;
      const surrogateRoute = requiresSurrogateRoute(input.bank, id);
      const correctAnswer = question?.correctAnswer;
      const selected = {
        bank: input.bank,
        id,
        route: surrogateRoute ? SURROGATE_ROUTE : targetRoute,
        targetRoute,
        routeMode: surrogateRoute ? "surrogate" : "direct",
        candidatePayload: explanationPayload,
        candidatePayloadHash: sha256(explanationPayload),
        correctAnswer: typeof correctAnswer === "string" || typeof correctAnswer === "number"
          ? String(correctAnswer)
          : "",
        explanationFile: relativeToRoot(explanationFile),
        stepCount: steps.length,
        steps,
        sourceFailures: [],
      };
      questions.push(selected);
    }
  }

  for (const id of cli.ids) {
    if (!seenBankIds.has(id)) {
      failures.push(makeFailure({
        phase: "selection",
        code: "unknown-id",
        message: `Requested ID is absent from both current math banks: ${id}`,
        id,
      }));
    } else if (invalidExplanations.has(id)) {
      failures.push(invalidExplanations.get(id));
    } else if (!desmosIds.has(id)) {
      failures.push(makeFailure({
        phase: "selection",
        code: "no-desmos-preview",
        message: `Requested ID has no Desmos-bearing canonical explanation: ${id}`,
        id,
      }));
    }
  }

  if (cli.ids.length) {
    const requestedOrder = new Map(cli.ids.map((id, index) => [id, index]));
    questions.sort((a, b) => requestedOrder.get(a.id) - requestedOrder.get(b.id)
      || a.bank.localeCompare(b.bank));
  }

  const selectedQuestions = questions.slice(0, cli.limit);
  for (const question of selectedQuestions) {
    question.sourceFailures = question.steps.flatMap((step) =>
      step.embeds.flatMap((embed) => validateEmbedSource(question, embed)));
    failures.push(...question.sourceFailures);
  }
  if (!selectedQuestions.length) {
    failures.push(makeFailure({
      phase: "selection",
      code: "empty-selection",
      message: "No Desmos-bearing canonical math explanations were selected",
    }));
  }

  return { questions: selectedQuestions, failures, inputSummary };
};

const nearlyEqual = (left, right, tolerance = NUMBER_TOLERANCE) =>
  typeof left === "number" && Number.isFinite(left)
  && typeof right === "number" && Number.isFinite(right)
  && Math.abs(left - right) <= tolerance * Math.max(1, Math.abs(left), Math.abs(right));

const boundsEqual = (left, right) => Boolean(left && right
  && nearlyEqual(left.left, right.left)
  && nearlyEqual(left.right, right.right)
  && nearlyEqual(left.bottom, right.bottom)
  && nearlyEqual(left.top, right.top));

const validBounds = (bounds) => Boolean(bounds
  && [bounds.left, bounds.right, bounds.bottom, bounds.top]
    .every((value) => typeof value === "number" && Number.isFinite(value))
  && bounds.left < bounds.right
  && bounds.bottom < bounds.top);

const boundsContain = (outer, inner) => Boolean(validBounds(outer) && validBounds(inner)
  && outer.left <= inner.left + NUMBER_TOLERANCE
  && outer.right >= inner.right - NUMBER_TOLERANCE
  && outer.bottom <= inner.bottom + NUMBER_TOLERANCE
  && outer.top >= inner.top - NUMBER_TOLERANCE);

const normalizedMathText = (value) => String(value ?? "")
  .replace(/[−–]/g, "-")
  .replace(/\\(?:left|right)/g, "")
  .replace(/\s+/g, "")
  .trim();

const normalizedLabelText = (value) => String(value ?? "")
  .replace(/\s+/g, " ")
  .trim();

const expectedExpressionStates = (embed) => embed.expressions.map((expression, index) => ({
  id: expression.id ?? `expr-${index}`,
  latex: expression.latex,
  color: (expression.color ?? DESMOS_EXPRESSION_COLORS[index % DESMOS_EXPRESSION_COLORS.length]).toLowerCase(),
  ...(typeof expression.label === "string" ? { label: expression.label } : {}),
  ...(typeof expression.showLabel === "boolean" ? { showLabel: expression.showLabel } : {}),
  ...(typeof expression.hidden === "boolean" ? { hidden: expression.hidden } : {}),
  ...(expression.sliderBounds ? { sliderBounds: expression.sliderBounds } : {}),
  ...(typeof expression.playing === "boolean" ? { playing: expression.playing } : {}),
}));

const compareExpressionStates = (embed, actualItems) => {
  const expected = expectedExpressionStates(embed);
  const actualExpressions = actualItems.filter((item) => item.type !== "table");
  const actualById = new Map(actualExpressions.map((item) => [item.id, item]));
  const failures = [];

  for (const expression of expected) {
    const actual = actualById.get(expression.id);
    if (!actual) {
      failures.push(`missing ${expression.id}`);
      continue;
    }
    if (normalizedMathText(actual.latex) !== normalizedMathText(expression.latex)) {
      failures.push(`${expression.id} latex`);
    }
    if (String(actual.color ?? "").toLowerCase() !== expression.color) {
      failures.push(`${expression.id} color`);
    }
    const actualLabel = normalizedLabelText(actual.label);
    if (actualLabel.toLowerCase() === "undefined") {
      failures.push(`${expression.id} literal undefined label`);
    }
    if (typeof expression.label === "string"
      && actualLabel !== normalizedLabelText(expression.label)) {
      failures.push(`${expression.id} label`);
    }
    if (typeof expression.showLabel === "boolean"
      && Boolean(actual.showLabel) !== expression.showLabel) {
      failures.push(`${expression.id} showLabel`);
    }
    if (expression.showLabel === true && !actualLabel) {
      failures.push(`${expression.id} empty visible label`);
    }
    if (typeof expression.hidden === "boolean"
      && Boolean(actual.hidden) !== expression.hidden) {
      failures.push(`${expression.id} hidden`);
    }
    if (expression.sliderBounds && ["min", "max", "step"].some((key) =>
      normalizedMathText(actual.sliderBounds?.[key]) !== normalizedMathText(expression.sliderBounds[key]))) {
      failures.push(`${expression.id} sliderBounds`);
    }
    if (typeof expression.playing === "boolean"
      && Boolean(actual.playing) !== expression.playing) {
      failures.push(`${expression.id} playing`);
    }
  }

  if (actualExpressions.length !== expected.length) {
    failures.push(`expression count ${actualExpressions.length}/${expected.length}`);
  }
  return failures;
};

const isRegressionLatex = (latex) => /\\sim|~/.test(String(latex ?? ""));

const siblingListDefinitionNames = (embed) => new Set(embed.expressions.flatMap((expression) => {
  if (isRegressionLatex(expression.latex)) return [];
  const match = normalizedMathText(expression.latex)
    .match(/^([A-Za-z](?:_(?:\{[^}]+\}|[A-Za-z0-9]))?)=\[/);
  return match ? [match[1]] : [];
}));

const regressionParameterNames = (embed, expression) => {
  const latex = String(expression.latex ?? "");
  const split = latex.split(/\\sim|~/);
  if (split.length < 2) return [];
  const knownNames = new Set(embed.tables.flatMap((table) =>
    table.columns.flatMap((column) => normalizedMathText(column.latex)
      .match(/[A-Za-z](?:_(?:\{[^}]+\}|[A-Za-z0-9]))?/g) ?? [])));
  for (const name of siblingListDefinitionNames(embed)) knownNames.add(name);
  const commandsRemoved = split.slice(1).join("~")
    .replace(/\\operatorname\{[^}]+\}/g, "")
    .replace(/\\[A-Za-z]+/g, "");
  const tokens = commandsRemoved.match(/[A-Za-z](?:_(?:\{[^}]+\}|[A-Za-z0-9]))?/g) ?? [];
  const constants = new Set(["e", "i"]);
  return [...new Set(tokens.filter((token) => !knownNames.has(token) && !constants.has(token)))];
};

const requiresExactRegressionFit = (embed) => embed.tables.length === 0;

const escapedRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parameterTextPattern = (parameter) => {
  const plain = parameter.replace(/_\{?([^}]+)\}?/g, "$1");
  const subscript = parameter.includes("_")
    ? escapedRegex(parameter[0]) + "(?:\\s*(?:_|subscript)\\s*)?" + escapedRegex(plain.slice(1))
    : escapedRegex(plain);
  return new RegExp(`(?:^|[^A-Za-z0-9])${subscript}\\s*(?:=|equals|is)\\s*(?:negative\\s*)?[-+−]?\\s*\\d`, "i");
};

const evaluateRegressions = (embed, inspection) => {
  const expected = expectedExpressionStates(embed).filter((expression) => isRegressionLatex(expression.latex));
  if (!expected.length) return { expected: 0, failures: [], results: [] };
  const failures = [];
  const results = expected.map((expression) => {
    const stateIndex = inspection.stateItems.findIndex((item) => item.id === expression.id);
    const dom = stateIndex >= 0 ? inspection.expressionDomItems[stateIndex] : null;
    const analysis = inspection.expressionAnalysis.find((item) => item.id === expression.id) ?? null;
    const combinedText = [dom?.text, ...(dom?.accessibleText ?? []), analysis?.summary]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ");
    const parameters = regressionParameterNames(embed, expression);
    const numericPaths = analysis?.numericPaths ?? [];
    const matchedParameters = parameters.filter((parameter) => {
      const flattened = parameter.replace(/[{}_]/g, "").toLowerCase();
      return parameterTextPattern(parameter).test(combinedText)
        || numericPaths.some(({ path }) => path.replace(/[^A-Za-z0-9]/g, "").toLowerCase().endsWith(flattened));
    });
    const assignmentCount = (combinedText.match(/(?:=|equals)\s*(?:negative\s*)?[-+−]?\s*\d/gi) ?? []).length;
    const parameterOutputs = parameters.length
      ? matchedParameters.length === parameters.length || assignmentCount >= parameters.length
      : assignmentCount > 0 || numericPaths.some(({ path }) => /parameter/i.test(path));
    const fitText = /(?:r\s*(?:\^\s*2|²|squared)|r_?2|rmse|r\.?m\.?s\.?e|root mean square)/i.test(combinedText);
    const fitPath = numericPaths.some(({ path }) => /(?:r.?squared|r2|rmse|root.?mean)/i.test(path));
    const exactFit = /(?:exact fit|r\s*(?:\^\s*2|²|squared|_?2)\s*(?:=|equals)\s*1(?:\.0+)?\b|rmse\s*(?:=|equals)\s*0(?:\.0+)?\b)/i.test(combinedText)
      || numericPaths.some(({ path, value }) => /(?:r.?squared|r2)/i.test(path) && nearlyEqual(value, 1))
      || numericPaths.some(({ path, value }) => /(?:rmse|root.?mean|residual)/i.test(path) && nearlyEqual(value, 0));
    const fitStatistic = fitText || fitPath;
    const exactFitRequired = requiresExactRegressionFit(embed);
    const result = {
      id: expression.id,
      parameters,
      matchedParameters,
      parameterOutputs,
      fitStatistic,
      exactFit,
      exactFitRequired,
      analysisError: Boolean(analysis?.isError),
    };
    if (analysis?.isError) failures.push(`${expression.id} analysis error: ${analysis.errorMessage ?? "unknown"}`);
    if (!parameterOutputs) failures.push(`${expression.id} missing fitted parameter output`);
    if (exactFitRequired && !exactFit) {
      failures.push(`${expression.id} table-free custom regression is not proven exact (exact fit, R^2=1, or RMSE=0)`);
    } else if (!exactFitRequired && !fitStatistic) {
      failures.push(`${expression.id} missing R^2 or RMSE output`);
    }
    return result;
  });
  return { expected: expected.length, failures, results };
};

const runTargetedProbes = () => {
  const checks = [];
  const assert = (condition, name, detail) => {
    if (!condition) throw new Error(`Harness probe failed (${name}): ${detail}`);
    checks.push(name);
  };

  const malformed = makeEmbedConfig({
    raw: {
      desmosExpressions: [{
        latex: "y=x",
        id: 7,
        color: false,
        label: [],
        showLabel: "true",
        hidden: 0,
      }],
      desmosTables: [{
        columns: [
          { latex: "x_1", values: [1, null] },
          { latex: "y_1", values: [2, 3] },
        ],
      }],
      desmosBounds: { left: "-1", right: 1, bottom: -1, top: 1 },
      desmosDegreeMode: "false",
      desmosDefaultLogModeRegressions: 1,
      desmosPreserveSquareUnits: null,
      desmosShowGraphpaper: "true",
    },
    kind: "probe",
    sourcePath: "probe",
    stepIndex: 0,
    embedIndex: 0,
    keyPrefix: "desmos",
  });
  const expectedMalformedFields = [
    ".id",
    ".color",
    ".label",
    ".showLabel",
    ".hidden",
    ".values[1]",
    "desmosBounds.left",
    "desmosDegreeMode",
    "desmosDefaultLogModeRegressions",
    "desmosPreserveSquareUnits",
    "desmosShowGraphpaper",
  ];
  assert(
    expectedMalformedFields.every((field) =>
      malformed.sourceMeta.authoredTypeErrors.some((error) => error.includes(field))),
    "wrong-typed-rich-metadata",
    malformed.sourceMeta.authoredTypeErrors.join(" | "),
  );
  const malformedFailures = validateEmbedSource(
    { bank: "probe", id: "wrong-types" },
    malformed,
  );
  assert(
    malformedFailures.filter((failure) => failure.code === "wrong-authored-field-type").length
      >= expectedMalformedFields.length,
    "wrong-types-survive-normalization",
    JSON.stringify(malformedFailures),
  );

  const listRegressionEmbed = {
    expressions: [
      { latex: "x_1=[1,2,3]" },
      { latex: "y_1=[2,4,6]" },
      { latex: "y_1\\sim mx_1+b" },
    ],
    tables: [],
  };
  const parameters = regressionParameterNames(listRegressionEmbed, listRegressionEmbed.expressions[2]);
  assert(
    parameters.length === 2 && parameters.includes("m") && parameters.includes("b"),
    "list-definitions-not-parameters",
    `inferred ${JSON.stringify(parameters)}`,
  );
  assert(
    requiresExactRegressionFit(listRegressionEmbed)
      && !requiresExactRegressionFit({ ...listRegressionEmbed, tables: [{ columns: [] }] }),
    "table-free-regression-exact-policy",
    "table-free and table-backed policies were not distinguished",
  );
  const approximateInspection = {
    stateItems: listRegressionEmbed.expressions.map((_, index) => ({
      id: `expr-${index}`,
      type: "expression",
    })),
    expressionDomItems: [
      { text: "", accessibleText: [] },
      { text: "", accessibleText: [] },
      { text: "m=2 b=0 R2=0.9", accessibleText: [] },
    ],
    expressionAnalysis: [],
  };
  const exactConditionEvaluation = evaluateRegressions(listRegressionEmbed, approximateInspection);
  assert(
    exactConditionEvaluation.failures.some((failure) => /not proven exact/.test(failure)),
    "table-free-approximate-fit-rejected",
    JSON.stringify(exactConditionEvaluation),
  );
  const approximateTableEvaluation = evaluateRegressions({
    ...listRegressionEmbed,
    tables: [{
      columns: [
        { latex: "x_1", values: ["1", "2", "3"] },
        { latex: "y_1", values: ["2", "4", "6"] },
      ],
    }],
  }, approximateInspection);
  assert(
    approximateTableEvaluation.failures.length === 0,
    "table-backed-fit-statistic-accepted",
    JSON.stringify(approximateTableEvaluation),
  );
  const limitedCli = parseArgs(["--ids=third,first,second", "--limit=2"]);
  assert(
    JSON.stringify(limitedCli.ids) === JSON.stringify(["third", "first"])
      && JSON.stringify(limitedCli.requestedIds) === JSON.stringify(["third", "first", "second"]),
    "requested-id-limit-order",
    "requested ID order changed before limit application",
  );
  const hiddenMathCount = [...HIDDEN_BANK_QUESTION_IDS].filter((id) => id.includes("-math-")).length;
  assert(
    hiddenMathCount === 490
      && !requiresSurrogateRoute(SURROGATE_BANK, SURROGATE_ID)
      && requiresSurrogateRoute("past", "bf0e4735"),
    "surrogate-route-classification",
    `hidden math=${hiddenMathCount}, surrogate=${requiresSurrogateRoute(SURROGATE_BANK, SURROGATE_ID)}`,
  );

  return { passed: true, checks };
};

const waitForVisibleExplanationButton = (page) => page.waitForFunction(() => {
  const visibleInViewport = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0
      && rect.width > 0 && rect.height > 0
      && rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight;
  };
  return [...document.querySelectorAll("button")].some((button) => {
    const label = button.getAttribute("aria-label") || button.textContent?.trim();
    return label === "Explanation" && !button.closest('[data-window-id="explanation"]')
      && visibleInViewport(button);
  });
}, { timeout: NAVIGATION_TIMEOUT_MS });

const clickVisibleExplanationButton = (page) => page.evaluate(() => {
  const visibleInViewport = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0
      && rect.width > 0 && rect.height > 0
      && rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight;
  };
  const button = [...document.querySelectorAll("button")].find((candidate) => {
    const label = candidate.getAttribute("aria-label") || candidate.textContent?.trim();
    return label === "Explanation" && !candidate.closest('[data-window-id="explanation"]')
      && visibleInViewport(candidate);
  });
  button?.click();
  return Boolean(button);
});

const waitForActiveStep = (page, stepIndex, expectedEmbeds) => page.waitForFunction(
  ({ stepIndex, expectedEmbeds }) => {
    const root = document.querySelector('[data-window-id="explanation"]');
    const active = root?.querySelector(
      `button[aria-label="Go to explanation step ${stepIndex + 1}"][aria-current="step"]`,
    );
    const embeds = root?.querySelectorAll('[data-desmos-inline="true"]') ?? [];
    if (!active || embeds.length !== expectedEmbeds) return false;
    return expectedEmbeds === 0 || [...embeds].every((embed) =>
      embed.getAttribute("data-desmos-ready") === "true" && embed.__desmosCalculator);
  },
  { timeout: expectedEmbeds ? READY_TIMEOUT_MS : NAVIGATION_TIMEOUT_MS },
  { stepIndex, expectedEmbeds },
);

const clickNextExplanationStep = (page, nextStepIndex) => page.evaluate((nextStepIndex) => {
  const root = document.querySelector('[data-window-id="explanation"]');
  const candidates = [...(root?.querySelectorAll("button") ?? [])];
  const button = candidates.find((candidate) => {
    const text = candidate.textContent?.trim();
    return !candidate.disabled && (text === "Next Step" || text === "Next");
  });
  button?.click();
  return {
    clicked: Boolean(button),
    nextStepIndex,
    label: button?.textContent?.trim() ?? null,
  };
}, nextStepIndex);

const scrollEmbedIntoView = (page, embedIndex, viewportName) => page.evaluate(async ({ embedIndex, viewportName }) => {
  const root = document.querySelector('[data-window-id="explanation"]');
  const embed = root?.querySelectorAll('[data-desmos-inline="true"]')[embedIndex];
  if (!embed) return false;
  const scrollableAncestors = [];
  let ancestor = embed.parentElement;
  while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {
    const style = getComputedStyle(ancestor);
    if (/(?:auto|scroll)/.test(style.overflowY) && ancestor.scrollHeight > ancestor.clientHeight + 1) {
      scrollableAncestors.push(ancestor);
    }
    ancestor = ancestor.parentElement;
  }
  const primaryScroller = scrollableAncestors[0];
  if (primaryScroller) {
    const scrollerRect = primaryScroller.getBoundingClientRect();
    const embedRect = embed.getBoundingClientRect();
    const targetTop = primaryScroller.scrollTop + embedRect.top - scrollerRect.top - 8;
    primaryScroller.scrollTo({ top: Math.max(0, targetTop), behavior: "instant" });
  } else {
    embed.scrollIntoView({
      block: viewportName === "mobile" ? "start" : "nearest",
      inline: "nearest",
      behavior: "instant",
    });
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await new Promise((resolve) => setTimeout(resolve, 300));
  return true;
}, { embedIndex, viewportName });

const inspectEmbed = (page, embedIndex, expectedStateItems, graphlessMustFit) => page.evaluate(
  async ({ embedIndex, expectedStateItems, graphlessMustFit }) => {
    const root = document.querySelector('[data-window-id="explanation"]');
    const embed = root?.querySelectorAll('[data-desmos-inline="true"]')[embedIndex];
    if (!embed) return { missing: true };
    const calculator = embed.__desmosCalculator;
    const parseJson = (value) => {
      try { return value ? JSON.parse(value) : null; } catch { return null; }
    };
    const rectOf = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    const intersectionRatio = (rect, clip) => {
      if (!rect || !clip || rect.width <= 0 || rect.height <= 0) return 0;
      const width = Math.max(0, Math.min(rect.right, clip.right) - Math.max(rect.left, clip.left));
      const height = Math.max(0, Math.min(rect.bottom, clip.bottom) - Math.max(rect.top, clip.top));
      return (width * height) / (rect.width * rect.height);
    };
    const intersectRects = (left, right) => {
      if (!left || !right) return null;
      const intersection = {
        left: Math.max(left.left, right.left),
        right: Math.min(left.right, right.right),
        top: Math.max(left.top, right.top),
        bottom: Math.min(left.bottom, right.bottom),
      };
      intersection.width = Math.max(0, intersection.right - intersection.left);
      intersection.height = Math.max(0, intersection.bottom - intersection.top);
      return intersection;
    };
    const visible = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0
        && rect.width > 0 && rect.height > 0;
    };

    const state = calculator?.getState?.() ?? null;
    const publicStateById = new Map(
      (calculator?.getExpressions?.() ?? []).map((item) => [item.id, item]),
    );
    const stateItems = (state?.expressions?.list ?? []).map((item) => ({
      ...item,
      sliderBounds: publicStateById.get(item.id)?.sliderBounds,
      playing: publicStateById.get(item.id)?.playing,
    }));
    const expressionPanel = embed.querySelector(".dcg-exppanel");
    const graphpaper = embed.querySelector(".dcg-graph-inner");
    const expressionItems = [...embed.querySelectorAll(".dcg-expressionitem")].slice(0, expectedStateItems);
    const sliderExpressionIds = [...embed.querySelectorAll(".dcg-expressionitem.dcg-hasSlider")]
      .filter((item) => item.querySelector(
        '[aria-label^="Play "][aria-label$=" Animation"], '
        + '[aria-label^="Pause "][aria-label$=" Animation"]',
      ))
      .map((item) => item.getAttribute("expr-id"))
      .filter(Boolean);
    const expressionDomItems = expressionItems.map((item) => ({
      text: (item.innerText || item.textContent || "").trim(),
      accessibleText: [...item.querySelectorAll("[aria-label], [title]")]
        .flatMap((node) => [node.getAttribute("aria-label"), node.getAttribute("title")])
        .map((value) => value?.trim())
        .filter(Boolean),
    }));
    const expressionAnalysis = Object.entries(calculator?.expressionAnalysis ?? {}).map(([id, analysis]) => {
      const numericPaths = [];
      const stringPaths = [];
      const seen = new WeakSet();
      const visit = (value, currentPath, depth) => {
        if (depth > 6 || value === null || value === undefined) return;
        if (typeof value === "number" && Number.isFinite(value)) {
          numericPaths.push({ path: currentPath, value });
          return;
        }
        if (typeof value === "string" && value.trim()) {
          stringPaths.push({ path: currentPath, value: value.trim().slice(0, 500) });
          return;
        }
        if (typeof value !== "object" || seen.has(value)) return;
        seen.add(value);
        if (Array.isArray(value)) {
          value.slice(0, 50).forEach((item, index) => visit(item, `${currentPath}[${index}]`, depth + 1));
          return;
        }
        Object.entries(value).slice(0, 100).forEach(([key, item]) => {
          visit(item, currentPath ? `${currentPath}.${key}` : key, depth + 1);
        });
      };
      visit(analysis, "", 0);
      return {
        id,
        isError: Boolean(analysis?.isError),
        errorMessage: typeof analysis?.errorMessage === "string" ? analysis.errorMessage : null,
        numericPaths,
        stringPaths,
        summary: [
          ...numericPaths.map(({ path: numberPath, value }) => `${numberPath}=${value}`),
          ...stringPaths.map(({ path: stringPath, value }) => `${stringPath}=${value}`),
        ].join(" "),
      };
    });
    const panelRectBefore = rectOf(expressionPanel);
    const itemVisibilityBefore = expressionItems.map((item) => ({
      rect: rectOf(item),
      intersectionRatio: intersectionRatio(rectOf(item), panelRectBefore),
    }));

    const itemVisibilityAfterScroll = [];
    if (!graphlessMustFit) {
      const findLiveExpressionItem = (itemId, itemIndex) => {
        const liveItems = [...embed.querySelectorAll(".dcg-expressionitem")];
        return liveItems.find((item) => item.getAttribute("expr-id") === itemId)
          ?? liveItems[itemIndex]
          ?? null;
      };
      for (let itemIndex = 0; itemIndex < expectedStateItems; itemIndex += 1) {
        const maximumScrollTop = Math.max(
          0,
          (expressionPanel?.scrollHeight ?? 0) - (expressionPanel?.clientHeight ?? 0),
        );
        const estimatedScrollTop = expectedStateItems > 1
          ? maximumScrollTop * itemIndex / (expectedStateItems - 1)
          : 0;
        expressionPanel?.scrollTo({ top: estimatedScrollTop, behavior: "instant" });
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const itemId = stateItems[itemIndex]?.id;
        let liveItem = findLiveExpressionItem(itemId, itemIndex);
        liveItem?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        liveItem = findLiveExpressionItem(itemId, itemIndex);
        const itemRect = rectOf(liveItem);
        const panelRect = rectOf(expressionPanel);
        itemVisibilityAfterScroll.push({
          rect: itemRect,
          intersectionRatio: intersectionRatio(itemRect, panelRect),
        });
      }
      expressionPanel?.scrollTo({ top: 0, behavior: "instant" });
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    const errorNodes = [...embed.querySelectorAll(
      ".dcg-expressionitem.dcg-error, .dcg-error-message, .dcg-invalid, .dcg-icon-error",
    )].filter(visible);
    const errorText = errorNodes.map((node) => node.textContent?.trim()).filter(Boolean);
    const calculatorText = embed.textContent ?? "";
    const mathCoordinates = calculator?.graphpaperBounds?.mathCoordinates ?? null;
    const viewport = state?.graph?.viewport ?? null;
    const settings = calculator?.settings ?? calculator?.graphSettings ?? null;
    const embedRect = rectOf(embed);
    const windowRect = rectOf(root);
    const viewportRect = { left: 0, right: innerWidth, top: 0, bottom: innerHeight, width: innerWidth, height: innerHeight };
    const computed = getComputedStyle(embed);
    let effectiveClip = viewportRect;
    const clippingAncestors = [];
    let ancestor = embed.parentElement;
    while (ancestor && ancestor !== document.documentElement) {
      const style = getComputedStyle(ancestor);
      const clipsX = /(?:auto|scroll|hidden|clip)/.test(style.overflowX);
      const clipsY = /(?:auto|scroll|hidden|clip)/.test(style.overflowY);
      if (clipsX || clipsY) {
        const ancestorRect = rectOf(ancestor);
        const axisClip = {
          left: clipsX ? ancestorRect.left : effectiveClip.left,
          right: clipsX ? ancestorRect.right : effectiveClip.right,
          top: clipsY ? ancestorRect.top : effectiveClip.top,
          bottom: clipsY ? ancestorRect.bottom : effectiveClip.bottom,
        };
        axisClip.width = Math.max(0, axisClip.right - axisClip.left);
        axisClip.height = Math.max(0, axisClip.bottom - axisClip.top);
        effectiveClip = intersectRects(effectiveClip, axisClip);
        clippingAncestors.push({
          tag: ancestor.tagName.toLowerCase(),
          className: typeof ancestor.className === "string" ? ancestor.className.slice(0, 300) : "",
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          rect: ancestorRect,
          clientWidth: ancestor.clientWidth,
          clientHeight: ancestor.clientHeight,
          scrollWidth: ancestor.scrollWidth,
          scrollHeight: ancestor.scrollHeight,
          horizontalOverflow: Math.max(0, ancestor.scrollWidth - ancestor.clientWidth),
        });
      }
      ancestor = ancestor.parentElement;
    }
    const visibleEmbedRect = intersectRects(embedRect, effectiveClip);
    const hitTest = { samples: 0, unobscured: 0, blockers: [] };
    if (visibleEmbedRect?.width > 0 && visibleEmbedRect?.height > 0) {
      for (const xFraction of [0.1, 0.5, 0.9]) {
        for (const yFraction of [0.03, 0.5, 0.97]) {
          const x = visibleEmbedRect.left + visibleEmbedRect.width * xFraction;
          const y = visibleEmbedRect.top + visibleEmbedRect.height * yFraction;
          if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) continue;
          const hit = document.elementFromPoint(x, y);
          hitTest.samples += 1;
          if (hit && (hit === embed || embed.contains(hit))) {
            hitTest.unobscured += 1;
          } else if (hit) {
            hitTest.blockers.push({
              tag: hit.tagName.toLowerCase(),
              className: typeof hit.className === "string" ? hit.className.slice(0, 200) : "",
              text: hit.textContent?.trim().slice(0, 120) ?? "",
            });
          }
        }
      }
    }
    const tableStates = stateItems.filter((item) => item.type === "table").map((table) => ({
      id: table.id,
      columns: Array.isArray(table.columns) ? table.columns.map((column) => ({
        latex: column.latex,
        values: Array.isArray(column.values) ? column.values.map(String) : [],
      })) : [],
    }));

    return {
      missing: false,
      ready: embed.dataset.desmosReady === "true" && Boolean(calculator),
      dataset: {
        authoredBounds: parseJson(embed.dataset.desmosBounds),
        appliedBounds: parseJson(embed.dataset.desmosAppliedBounds),
        degreeMode: embed.dataset.desmosDegreeMode ?? null,
        logMode: embed.dataset.desmosLogMode ?? null,
        squareUnits: embed.dataset.desmosSquareUnits ?? null,
        graphpaper: embed.dataset.desmosGraphpaper ?? null,
      },
      settings: settings ? {
        degreeMode: settings.degreeMode,
        defaultLogModeRegressions: settings.defaultLogModeRegressions,
        graphpaper: settings.graphpaper,
      } : null,
      stateItems: stateItems.map((item) => ({
        id: item.id,
        type: item.type,
        latex: item.latex,
        color: item.color,
        showLabel: item.showLabel,
        label: item.label,
        hidden: item.hidden,
        sliderBounds: item.sliderBounds,
        playing: item.playing,
      })),
      expressionDomItems,
      sliderExpressionIds,
      expressionAnalysis,
      tableStates,
      viewport: viewport ? {
        left: viewport.xmin,
        right: viewport.xmax,
        bottom: viewport.ymin,
        top: viewport.ymax,
      } : null,
      mathCoordinates: mathCoordinates ? {
        left: mathCoordinates.left,
        right: mathCoordinates.right,
        bottom: mathCoordinates.bottom,
        top: mathCoordinates.top,
      } : null,
      errors: errorText,
      addSlider: /Add Slider|Add slider/i.test(calculatorText),
      layout: {
        embed: embedRect,
        window: windowRect,
        graphpaper: rectOf(graphpaper),
        expressionPanel: rectOf(expressionPanel),
        embedViewportIntersection: intersectionRatio(embedRect, viewportRect),
        embedEffectiveIntersection: intersectionRatio(embedRect, effectiveClip),
        effectiveClip,
        effectiveAvailableHeight: effectiveClip?.height ?? 0,
        embedFitsAvailableHeight: Boolean(embedRect && effectiveClip
          && embedRect.height <= effectiveClip.height + 2),
        clippingAncestors,
        maxAncestorHorizontalOverflow: clippingAncestors.reduce(
          (maximum, item) => Math.max(maximum, item.horizontalOverflow),
          0,
        ),
        hitTest: {
          ...hitTest,
          coverage: hitTest.samples ? hitTest.unobscured / hitTest.samples : 0,
          blockers: hitTest.blockers.slice(0, 10),
        },
        opacity: Number(computed.opacity),
        visibility: computed.visibility,
        display: computed.display,
        bodyHorizontalOverflow: document.documentElement.scrollWidth - innerWidth,
        expressionItemCount: expressionItems.length,
        itemVisibilityBefore,
        itemVisibilityAfterScroll,
        expressionPanelClientHeight: expressionPanel?.clientHeight ?? 0,
        expressionPanelScrollHeight: expressionPanel?.scrollHeight ?? 0,
      },
    };
  },
  { embedIndex, expectedStateItems, graphlessMustFit },
);

const compareTables = (expectedTables, actualTables) => {
  if (actualTables.length !== expectedTables.length) return false;
  return expectedTables.every((expectedTable, tableIndex) => {
    const actualTable = actualTables[tableIndex];
    if (!actualTable || actualTable.columns.length !== expectedTable.columns.length) return false;
    return expectedTable.columns.every((expectedColumn, columnIndex) => {
      const actualColumn = actualTable.columns[columnIndex];
      if (!actualColumn) return false;
      if (normalizedMathText(actualColumn.latex) !== normalizedMathText(expectedColumn.latex)) return false;
      return expectedColumn.values.length === actualColumn.values.length
        && expectedColumn.values.every((value, rowIndex) =>
          normalizedMathText(value) === normalizedMathText(actualColumn.values[rowIndex]));
    });
  });
};

const evaluateEmbedChecks = (question, viewport, embed, inspection) => {
  const failures = [];
  const base = {
    phase: "runtime",
    bank: question.bank,
    id: question.id,
    stepIndex: embed.stepIndex,
    embedIndex: embed.embedIndex,
    viewport: viewport.name,
    sourcePath: embed.sourcePath,
  };
  const add = (code, message) => failures.push(makeFailure({ ...base, code, message }));
  if (inspection.missing) {
    add("missing-embed", "Expected Desmos embed is missing from the active explanation step");
    return { failures, checks: { present: false } };
  }

  const expressionStateFailures = compareExpressionStates(embed, inspection.stateItems);
  const regressionEvaluation = evaluateRegressions(embed, inspection);
  const expectedSliderIds = embed.expressions
    .flatMap((expression, index) => expression.sliderBounds
      ? [expression.id ?? `expr-${index}`]
      : [])
    .sort();
  const actualSliderIds = [...inspection.sliderExpressionIds].sort();

  const checks = {
    present: true,
    ready: inspection.ready,
    noDesmosErrors: inspection.errors.length === 0,
    noAddSlider: !inspection.addSlider,
    degreeMode: inspection.dataset.degreeMode === (embed.degreeMode ? "degrees" : "radians")
      && inspection.settings?.degreeMode === embed.degreeMode,
    logMode: inspection.dataset.logMode === String(embed.defaultLogModeRegressions)
      && inspection.settings?.defaultLogModeRegressions === embed.defaultLogModeRegressions,
    squareMode: inspection.dataset.squareUnits === String(embed.preserveSquareUnits),
    graphpaperMode: inspection.dataset.graphpaper === String(embed.showGraphpaper)
      && inspection.settings?.graphpaper === embed.showGraphpaper,
    tables: compareTables(embed.tables, inspection.tableStates),
    expressions: expressionStateFailures.length === 0,
    sliders: JSON.stringify(actualSliderIds) === JSON.stringify(expectedSliderIds),
    regressions: regressionEvaluation.expected
      ? regressionEvaluation.failures.length === 0
      : "skipped",
    regressionResults: regressionEvaluation.results,
    stateItemCount: inspection.stateItems.length === embed.expressions.length + embed.tables.length,
    layoutVisible: false,
    expressionListNotClipped: false,
    bounds: false,
    viewport: embed.showGraphpaper ? false : "skipped",
    labeledTargets: embed.showGraphpaper ? false : "skipped",
  };

  if (!checks.ready) add("embed-not-ready", "Desmos embed did not expose one ready calculator instance");
  if (!checks.noDesmosErrors) add("desmos-error", `Visible Desmos error: ${inspection.errors.join(" | ")}`);
  if (!checks.noAddSlider) add("add-slider", "Desmos shows an Add Slider prompt");
  if (!checks.degreeMode) add("degree-mode-mismatch", "Rendered Desmos degree mode does not match the authored mode");
  if (!checks.logMode) add("log-mode-mismatch", "Rendered Desmos regression log mode does not match the authored mode");
  if (!checks.squareMode) add("square-mode-mismatch", "Rendered Desmos square-unit mode does not match the authored mode");
  if (!checks.graphpaperMode) add("graphpaper-mode-mismatch", "Rendered graphpaper mode does not match the authored mode");
  if (!checks.tables) add("table-state-mismatch", "Rendered Desmos table rows or columns do not match the authored table");
  if (!checks.expressions) {
    add("expression-state-mismatch", `Rendered expression state differs from authored config: ${expressionStateFailures.join(" | ")}`);
  }
  if (!checks.sliders) {
    add("slider-state-mismatch", `Rendered slider rows ${actualSliderIds.join(",") || "none"}; expected ${expectedSliderIds.join(",") || "none"}`);
  }
  if (checks.regressions === false) {
    add("regression-output-missing", `Rendered regression output is incomplete: ${regressionEvaluation.failures.join(" | ")}`);
  }
  if (!checks.stateItemCount) {
    add("state-item-count", `Desmos state has ${inspection.stateItems.length} authored items; expected ${embed.expressions.length + embed.tables.length}`);
  }

  const layout = inspection.layout;
  const embedRect = layout.embed;
  const expressionPanel = layout.expressionPanel;
  const horizontallyInside = embedRect
    && embedRect.left >= -PIXEL_TOLERANCE
    && embedRect.right <= viewport.width + PIXEL_TOLERANCE;
  const expectedMinimumHeight = viewport.isMobile
    ? (embed.tables.length || embed.showGraphpaper ? 300 : 1)
    : embed.tables.length
      ? (embed.showGraphpaper ? 520 : 480)
      : embed.showGraphpaper
        ? 300
        : 1;
  const graphpaperVisible = !embed.showGraphpaper || Boolean(layout.graphpaper
    && layout.graphpaper.width > 100 && layout.graphpaper.height > 80);
  const graphpaperHidden = embed.showGraphpaper || !layout.graphpaper
    || layout.graphpaper.width === 0 || layout.graphpaper.height === 0;
  checks.layoutVisible = Boolean(
    embedRect && embedRect.width > 250 && embedRect.height >= expectedMinimumHeight
    && layout.embedViewportIntersection >= 0.98
    && layout.embedEffectiveIntersection >= 0.98
    && layout.embedFitsAvailableHeight
    && horizontallyInside
    && layout.opacity >= 0.99
    && layout.visibility !== "hidden"
    && layout.display !== "none"
    && expressionPanel && expressionPanel.width > 200 && expressionPanel.height > 80
    && graphpaperVisible && graphpaperHidden
    && layout.bodyHorizontalOverflow <= PIXEL_TOLERANCE
    && layout.maxAncestorHorizontalOverflow <= PIXEL_TOLERANCE
    && layout.hitTest.samples >= 6
    && layout.hitTest.coverage >= 0.88
  );
  if (!checks.layoutVisible) {
    add(
      "layout-not-visible",
      "Desmos layout is clipped by the viewport or modal ancestor, obscured by modal chrome, horizontally overflowing, too tall for the available pane, hidden, or undersized",
    );
  }

  const itemVisibility = embed.showGraphpaper || embed.tables.length
    ? layout.itemVisibilityAfterScroll
    : layout.itemVisibilityBefore;
  checks.expressionListNotClipped = layout.expressionItemCount === embed.expressions.length + embed.tables.length
    && itemVisibility.length === layout.expressionItemCount
    && itemVisibility.every((item) => item.intersectionRatio >= 0.98);
  if (!checks.expressionListNotClipped) {
    add(
      "expression-list-clipped",
      embed.showGraphpaper || embed.tables.length
        ? "One or more authored expression/table items cannot be fully scrolled into view"
        : "Graphless expression/table panel does not show every authored item in full",
    );
  }

  const tableStateIndexes = inspection.stateItems.flatMap((item, index) =>
    item.type === "table" ? [index] : []);
  checks.tableRowsVisible = embed.tables.length
    ? checks.tables && tableStateIndexes.length === embed.tables.length
      && tableStateIndexes.every((index) => itemVisibility[index]?.intersectionRatio >= 0.98)
    : "skipped";
  if (checks.tableRowsVisible === false) {
    add("table-rows-not-visible", "An authored Desmos table cannot be scrolled into a fully visible state with all expected rows intact");
  }

  checks.regressionOutputsVisible = regressionEvaluation.expected
    ? regressionEvaluation.results.every((result) => {
        const index = inspection.stateItems.findIndex((item) => item.id === result.id);
        return index >= 0
          && itemVisibility[index]?.intersectionRatio >= 0.98
          && result.parameterOutputs
          && (result.exactFitRequired ? result.exactFit : result.fitStatistic);
      })
    : "skipped";
  if (checks.regressionOutputsVisible === false) {
    add("regression-output-not-visible", "Fitted parameters and fit statistics cannot be scrolled into a fully visible rendered state");
  }

  const authoredMatches = boundsEqual(inspection.dataset.authoredBounds, embed.bounds);
  const applied = inspection.dataset.appliedBounds;
  const appliedValid = validBounds(applied);
  const appliedMatches = embed.preserveSquareUnits
    ? boundsContain(applied, embed.bounds)
    : boundsEqual(applied, embed.bounds);
  checks.bounds = authoredMatches && appliedValid && appliedMatches;
  if (!checks.bounds) add("bounds-mismatch", "Authored or applied Desmos bounds are missing, invalid, unordered, or changed unexpectedly");

  if (embed.showGraphpaper) {

    checks.viewport = appliedValid
      && boundsEqual(inspection.viewport, applied)
      && boundsEqual(inspection.mathCoordinates, applied);
    if (!checks.viewport) add("viewport-mismatch", "Desmos state and graphpaper viewport do not match the applied bounds");

    checks.labeledTargets = embed.labeledPoints.every((point) => appliedValid
      && point.x >= applied.left && point.x <= applied.right
      && point.y >= applied.bottom && point.y <= applied.top);
    if (!checks.labeledTargets) add("target-outside-applied-bounds", "A labeled target point is outside the applied Desmos bounds");
  }

  return { failures, checks };
};

const takeScreenshot = async (page, file) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage: false });
  return relativeToRoot(file);
};

const runQuestionViewport = async (page, cli, question, viewport) => {
  const runtimeFailures = [];
  const surrogateMode = question.routeMode === "surrogate";
  const surrogateDetailPayload = surrogateMode
    ? makeSurrogateDetailPayload(question.correctAnswer)
    : null;
  const fixtureState = {
    mode: question.routeMode,
    targetRoute: question.targetRoute,
    renderedRoute: question.route,
    ...(surrogateMode ? {
      surrogateId: SURROGATE_ID,
      surrogateBank: SURROGATE_BANK,
      explanationRequestPath: SURROGATE_EXPLANATION_PATH,
      detailRequestPath: SURROGATE_DETAIL_PATH,
    } : {}),
    candidatePayloadHash: `sha256:${question.candidatePayloadHash}`,
    candidatePayloadBytes: Buffer.byteLength(question.candidatePayload),
    explanationHits: 0,
    detailHits: 0,
    servedCandidateHashes: [],
    cacheDisabled: true,
    noStoreResponses: surrogateMode,
    expectedCorrectAnswer: question.correctAnswer,
    renderedCorrectAnswerHeader: null,
    passed: false,
    failures: [],
  };
  const result = {
    viewport: viewport.name,
    width: viewport.width,
    height: viewport.height,
    route: question.route,
    passed: false,
    steps: [],
    browserEvents: [],
    fixture: fixtureState,
  };
  const addRouteFailure = (code, message, stepIndex) => {
    const failure = makeFailure({
      phase: "runtime",
      code,
      message,
      bank: question.bank,
      id: question.id,
      viewport: viewport.name,
      stepIndex,
    });
    runtimeFailures.push(failure);
    return failure;
  };
  let fixtureEvidenceValidated = false;
  const validateFixtureEvidence = () => {
    if (fixtureEvidenceValidated) return;
    fixtureEvidenceValidated = true;
    const fail = (code, message) => {
      fixtureState.failures.push({ code, message });
      addRouteFailure(code, message);
    };
    if (fixtureErrors.length) {
      fail("surrogate-interception-error", [...new Set(fixtureErrors)].join(" | "));
    }
    if (surrogateMode) {
      const expectedHash = `sha256:${question.candidatePayloadHash}`;
      if (fixtureState.explanationHits < 2) {
        fail(
          "surrogate-explanation-hit-count",
          `Expected both ${SURROGATE_EXPLANATION_PATH} requests to be intercepted; observed ${fixtureState.explanationHits}`,
        );
      }
      if (fixtureState.detailHits < 1) {
        fail(
          "surrogate-detail-hit-count",
          `Expected ${SURROGATE_DETAIL_PATH} to be intercepted at least once; observed ${fixtureState.detailHits}`,
        );
      }
      if (fixtureState.servedCandidateHashes.length !== fixtureState.explanationHits
        || fixtureState.servedCandidateHashes.some((hash) => hash !== expectedHash)) {
        fail("surrogate-payload-hash", "An intercepted explanation response did not use the exact target payload bytes");
      }
    }
    const expectedHeader = question.correctAnswer
      ? `Correct answer: ${question.correctAnswer}`.replace(/\s+/g, " ").trim()
      : null;
    if (expectedHeader && fixtureState.renderedCorrectAnswerHeader !== expectedHeader) {
      fail(
        "correct-answer-header-mismatch",
        `Rendered header ${JSON.stringify(fixtureState.renderedCorrectAnswerHeader)}; expected ${JSON.stringify(expectedHeader)}`,
      );
    }
    fixtureState.passed = fixtureState.failures.length === 0;
  };

  const browserEvents = [];
  const fixtureErrors = [];
  const onRequest = async (request) => {
    try {
      const requestUrl = new URL(request.url());
      if (surrogateMode && requestUrl.pathname === SURROGATE_EXPLANATION_PATH) {
        fixtureState.explanationHits += 1;
        fixtureState.servedCandidateHashes.push(`sha256:${sha256(question.candidatePayload)}`);
        await request.respond({
          status: 200,
          contentType: "application/json; charset=utf-8",
          headers: {
            "cache-control": "no-store, no-cache, must-revalidate",
            pragma: "no-cache",
            expires: "0",
          },
          body: question.candidatePayload,
        });
        return;
      }
      if (surrogateMode && requestUrl.pathname === SURROGATE_DETAIL_PATH) {
        fixtureState.detailHits += 1;
        await request.respond({
          status: 200,
          contentType: "application/json; charset=utf-8",
          headers: {
            "cache-control": "no-store, no-cache, must-revalidate",
            pragma: "no-cache",
            expires: "0",
          },
          body: surrogateDetailPayload,
        });
        return;
      }
      await request.continue();
    } catch (error) {
      fixtureErrors.push(error.message);
      if (!request.isInterceptResolutionHandled?.()) await request.continue().catch(() => undefined);
    }
  };
  const onPageError = (error) => {
    if (/desmos/i.test(error.message)) browserEvents.push(`pageerror: ${error.message}`);
  };
  const onConsole = (message) => {
    if (message.type() === "error" && /desmos/i.test(message.text())) {
      browserEvents.push(`console: ${message.text()}`);
    }
  };
  const onRequestFailed = (request) => {
    if (/desmos\.com/i.test(request.url())) {
      browserEvents.push(`requestfailed: ${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
    }
  };
  page.on("pageerror", onPageError);
  page.on("console", onConsole);
  page.on("requestfailed", onRequestFailed);

  try {
    await page.setCacheEnabled(false);
    if (surrogateMode) {
      await page.setRequestInterception(true);
      page.on("request", onRequest);
    }
    await page.setViewport({
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      isMobile: viewport.isMobile,
      hasTouch: viewport.hasTouch,
    });
    const url = `${cli.baseUrl}${question.route}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAVIGATION_TIMEOUT_MS });
    await waitForVisibleExplanationButton(page);
    if (!(await clickVisibleExplanationButton(page))) {
      throw new Error("Visible Explanation button could not be clicked");
    }
    await page.waitForSelector('[data-window-id="explanation"]', {
      visible: true,
      timeout: NAVIGATION_TIMEOUT_MS,
    });

    for (const step of question.steps) {
      const stepResult = {
        stepIndex: step.stepIndex,
        expectedEmbeds: step.embeds.length,
        passed: false,
        embeds: [],
        failures: [],
      };
      result.steps.push(stepResult);
      try {
        await waitForActiveStep(page, step.stepIndex, step.embeds.length);
      } catch (error) {
        stepResult.failures.push(addRouteFailure(
          "step-render-timeout",
          `Step ${step.stepIndex + 1} did not render ${step.embeds.length} ready embed(s): ${error.message}`,
          step.stepIndex,
        ));
      }

      for (const embed of step.embeds) {
        await scrollEmbedIntoView(page, embed.embedIndex, viewport.name).catch(() => false);
        const expectedStateItems = embed.expressions.length + embed.tables.length;
        let inspection;
        try {
          inspection = await inspectEmbed(
            page,
            embed.embedIndex,
            expectedStateItems,
            !embed.showGraphpaper && !embed.tables.length,
          );
        } catch (error) {
          const failure = addRouteFailure(
            "embed-inspection-error",
            `Could not inspect Desmos embed: ${error.message}`,
            step.stepIndex,
          );
          stepResult.failures.push(failure);
          inspection = { missing: true };
        }

        const evaluation = evaluateEmbedChecks(question, viewport, embed, inspection);
        runtimeFailures.push(...evaluation.failures);
        stepResult.failures.push(...evaluation.failures);
        const screenshotFile = path.join(
          OUTPUT_DIR,
          "screenshots",
          `${sanitizeFilePart(question.bank)}-${sanitizeFilePart(question.id)}`,
          `${viewport.name}-${viewport.width}x${viewport.height}-step-${step.stepIndex + 1}-embed-${embed.embedIndex + 1}.png`,
        );
        let screenshot = null;
        try {
          screenshot = await takeScreenshot(page, screenshotFile);
        } catch (error) {
          const failure = addRouteFailure(
            "screenshot-error",
            `Could not write screenshot: ${error.message}`,
            step.stepIndex,
          );
          stepResult.failures.push(failure);
        }
        stepResult.embeds.push({
          embedIndex: embed.embedIndex,
          kind: embed.kind,
          sourcePath: embed.sourcePath,
          showGraphpaper: embed.showGraphpaper,
          screenshot,
          passed: evaluation.failures.length === 0,
          checks: evaluation.checks,
          metrics: inspection.missing ? null : {
            dataset: inspection.dataset,
            settings: inspection.settings,
            viewport: inspection.viewport,
            mathCoordinates: inspection.mathCoordinates,
            stateItems: inspection.stateItems,
            tableStates: inspection.tableStates,
            sliderExpressionIds: inspection.sliderExpressionIds,
            expressionDomItems: inspection.expressionDomItems,
            expressionAnalysis: inspection.expressionAnalysis,
            layout: inspection.layout,
          },
          failures: evaluation.failures,
        });
      }

      stepResult.passed = stepResult.failures.length === 0;
      if (step.stepIndex < question.steps.length - 1) {
        const advance = await clickNextExplanationStep(page, step.stepIndex + 1);
        if (!advance.clicked) {
          stepResult.failures.push(addRouteFailure(
            "next-step-missing",
            `Could not advance from explanation step ${step.stepIndex + 1}`,
            step.stepIndex,
          ));
          break;
        }
      }
    }

    fixtureState.renderedCorrectAnswerHeader = await page.evaluate(() => {
      const root = document.querySelector('[data-window-id="explanation"]');
      const candidate = [...(root?.querySelectorAll("*") ?? [])].find((element) =>
        /^Correct answer:/i.test(element.textContent?.trim() ?? "")
        && ![...element.children].some((child) => /^Correct answer:/i.test(child.textContent?.trim() ?? "")));
      return candidate?.textContent?.replace(/\s+/g, " ").trim() ?? null;
    });

    validateFixtureEvidence();

    result.browserEvents = [...new Set(browserEvents)];
    for (const event of result.browserEvents) {
      addRouteFailure("desmos-browser-event", event);
    }
  } catch (error) {
    addRouteFailure("route-error", error.message);
    const screenshotFile = path.join(
      OUTPUT_DIR,
      "screenshots",
      `${sanitizeFilePart(question.bank)}-${sanitizeFilePart(question.id)}`,
      `${viewport.name}-${viewport.width}x${viewport.height}-route-failure.png`,
    );
    try {
      result.failureScreenshot = await takeScreenshot(page, screenshotFile);
    } catch {
      result.failureScreenshot = null;
    }
  } finally {
    page.off("pageerror", onPageError);
    page.off("console", onConsole);
    page.off("requestfailed", onRequestFailed);
    if (surrogateMode) page.off("request", onRequest);
  }

  validateFixtureEvidence();

  result.passed = runtimeFailures.length === 0
    && result.steps.length === question.stepCount
    && result.steps.every((step) => step.passed);
  result.failures = runtimeFailures;
  return result;
};

const verifyServer = async (baseUrl) => {
  let response;
  try {
    response = await fetch(baseUrl, { signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    throw new Error(`Cannot reach ${baseUrl}: ${error.message}`);
  }
  if (!response.ok) throw new Error(`${baseUrl} returned HTTP ${response.status}`);
};

const buildReport = (cli, selection) => ({
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  command: {
    baseUrl: cli.baseUrl,
    ids: cli.requestedIds,
    effectiveIds: cli.ids,
    limit: Number.isFinite(cli.limit) ? cli.limit : null,
  },
  outputDirectory: relativeToRoot(OUTPUT_DIR),
  inputs: selection.inputSummary,
  selection: {
    questions: selection.questions.length,
    steps: selection.questions.reduce((total, question) => total + question.stepCount, 0),
    desmosSteps: selection.questions.reduce(
      (total, question) => total + question.steps.filter((step) => step.embeds.length).length,
      0,
    ),
    embeds: selection.questions.reduce(
      (total, question) => total + question.steps.reduce((stepTotal, step) => stepTotal + step.embeds.length, 0),
      0,
    ),
    directRoutes: selection.questions.filter((question) => question.routeMode === "direct").length,
    surrogateRoutes: selection.questions.filter((question) => question.routeMode === "surrogate").length,
  },
  passed: false,
  summary: null,
  failures: [...selection.failures],
  results: [],
});

const writeReport = (report) => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
};

const main = async () => {
  const cli = parseArgs(process.argv.slice(2));
  const probes = runTargetedProbes();
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const selection = collectQuestions(cli);
  const report = buildReport(cli, selection);
  report.probes = probes;
  let browser = null;

  try {
    await verifyServer(cli.baseUrl);
    if (selection.questions.length) {
      browser = await puppeteer.launch({
        headless: "new",
        protocolTimeout: 300_000,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      for (const question of selection.questions) {
        const questionResult = {
          bank: question.bank,
          id: question.id,
          route: question.route,
          targetRoute: question.targetRoute,
          routeMode: question.routeMode,
          candidatePayloadHash: `sha256:${question.candidatePayloadHash}`,
          explanationFile: question.explanationFile,
          stepCount: question.stepCount,
          sourcePassed: question.sourceFailures.length === 0,
          sourceFailures: question.sourceFailures,
          viewports: [],
          passed: false,
        };
        report.results.push(questionResult);
        for (const viewport of VIEWPORTS) {
          const page = await browser.newPage();
          page.setDefaultTimeout(READY_TIMEOUT_MS);
          page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
          try {
            questionResult.viewports.push(await runQuestionViewport(page, cli, question, viewport));
          } finally {
            await page.close().catch(() => undefined);
          }
        }
        questionResult.passed = questionResult.sourcePassed
          && questionResult.viewports.length === VIEWPORTS.length
          && questionResult.viewports.every((viewport) => viewport.passed);
        report.failures.push(...questionResult.viewports.flatMap((viewport) => viewport.failures));
      }
    }
  } catch (error) {
    report.failures.push(makeFailure({
      phase: "harness",
      code: "fatal",
      message: error.message,
    }));
  } finally {
    await browser?.close().catch(() => undefined);
    const sourceFailures = report.failures.filter((failure) => failure.phase === "source").length;
    const runtimeFailures = report.failures.filter((failure) => failure.phase === "runtime").length;
    const otherFailures = report.failures.length - sourceFailures - runtimeFailures;
    const screenshots = report.results.reduce(
      (total, question) => total + question.viewports.reduce(
        (viewportTotal, viewport) => viewportTotal + viewport.steps.reduce(
          (stepTotal, step) => stepTotal + step.embeds.filter((embed) => embed.screenshot).length,
          0,
        ),
        0,
      ),
      0,
    );
    report.passed = report.failures.length === 0
      && report.results.length === selection.questions.length
      && report.results.every((result) => result.passed);
    report.summary = {
      passed: report.passed,
      questions: selection.questions.length,
      viewportRuns: report.results.reduce((total, question) => total + question.viewports.length, 0),
      screenshots,
      sourceFailures,
      runtimeFailures,
      otherFailures,
      totalFailures: report.failures.length,
    };
    writeReport(report);
    console.log(JSON.stringify({
      report: relativeToRoot(REPORT_PATH),
      ...report.summary,
    }, null, 2));
    if (!report.passed) process.exitCode = 1;
  }
};

await main();
