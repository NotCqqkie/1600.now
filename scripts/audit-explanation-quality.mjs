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

const reportLimit = readPositiveInteger("limit", 80);
const jsonOutput = args.get("format") === "json";
const failOnIssues = args.get("fail") !== "false";
const typeFilter = args.get("type") ?? "";
const includeOrphans = args.has("include-orphans");

const readText = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(readText(relativePath));

const stripHtml = (value) =>
  String(value ?? "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|li|div|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|ndash|mdash);/gi, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalize = (value) =>
  stripHtml(value)
    .replace(/\\(?:left|right|text|mathrm|operatorname)\b/g, " ")
    .replace(/[{}$]/g, " ")
    .replace(/\\[a-z]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const isMathQuestion = (question) => {
  if (question?.section) return question.section === "Math";
  if (question?.category?.subject) return question.category.subject === "Math";
  return false;
};

const buildSourceIndex = () => {
  const index = new Map();
  for (const question of readJson("src/data/questions/math_past.json")) {
    if (isMathQuestion(question) && question.id) index.set(String(question.id), { bank: "past", question });
  }
  for (const question of readJson("src/data/questions/unofficial_math.json")) {
    if (isMathQuestion(question) && question.id) index.set(String(question.id), { bank: "unofficial", question });
  }
  return index;
};

const asRecord = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : null;
const asString = (value) => typeof value === "string" ? value : "";
const unique = (values) => [...new Set(values.filter(Boolean))];

const asFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value) ? value : undefined;
const hasOwn = (record, key) => Object.prototype.hasOwnProperty.call(record, key);
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

const normalizeDesmosExpressions = (value, location) => {
  const expressions = [];
  const issues = [];
  if (value === undefined) return { expressions, issues };
  if (!Array.isArray(value)) {
    return {
      expressions,
      issues: [{ type: "invalidDesmosExpressionList", message: `${location} expressions must be an array.` }],
    };
  }
  value.forEach((item, expressionIndex) => {
    if (typeof item === "string") {
      if (item.trim()) expressions.push(item);
      else issues.push({ type: "invalidDesmosExpressionList", message: `${location} expression ${expressionIndex + 1} is empty.` });
      return;
    }
    const record = asRecord(item);
    if (!record) {
      issues.push({ type: "invalidDesmosExpressionList", message: `${location} expression ${expressionIndex + 1} must be a string or object.` });
      return;
    }
    if (hasOwn(record, "latex") && typeof record.latex !== "string") {
      issues.push({ type: "invalidDesmosExpressionMetadata", message: `${location} expression ${expressionIndex + 1} latex must be a string.` });
    }
    if (hasOwn(record, "expression") && typeof record.expression !== "string") {
      issues.push({ type: "invalidDesmosExpressionMetadata", message: `${location} expression ${expressionIndex + 1} expression must be a string.` });
    }
    const latex = typeof record.latex === "string"
      ? record.latex
      : typeof record.expression === "string"
        ? record.expression
        : "";
    if (!latex.trim()) {
      issues.push({ type: "invalidDesmosExpressionList", message: `${location} expression ${expressionIndex + 1} needs a nonempty latex/expression string.` });
      return;
    }
    for (const key of ["id", "color", "label"]) {
      if (hasOwn(record, key) && typeof record[key] !== "string") {
        issues.push({ type: "invalidDesmosExpressionMetadata", message: `${location} expression ${expressionIndex + 1} ${key} must be a string.` });
      }
    }
    for (const key of ["showLabel", "hidden"]) {
      if (hasOwn(record, key) && typeof record[key] !== "boolean") {
        issues.push({ type: "invalidDesmosExpressionMetadata", message: `${location} expression ${expressionIndex + 1} ${key} must be a boolean.` });
      }
    }
    if (hasOwn(record, "playing") && typeof record.playing !== "boolean") {
      issues.push({ type: "invalidDesmosExpressionMetadata", message: `${location} expression ${expressionIndex + 1} playing must be a boolean.` });
    }
    if (record.playing === true) {
      issues.push({ type: "invalidDesmosExpressionMetadata", message: `${location} expression ${expressionIndex + 1} slider auto-play is not allowed.` });
    }
    if (hasOwn(record, "sliderBounds")) {
      if (record.playing !== false) {
        issues.push({ type: "invalidDesmosExpressionMetadata", message: `${location} expression ${expressionIndex + 1} sliderBounds require explicit playing false.` });
      }
      const sliderBounds = asRecord(record.sliderBounds);
      if (!sliderBounds || Object.keys(sliderBounds).sort().join(",") !== "max,min,step" ||
          !["min", "max", "step"].every((key) => typeof sliderBounds[key] === "string" && sliderBounds[key].trim())) {
        issues.push({ type: "invalidDesmosExpressionMetadata", message: `${location} expression ${expressionIndex + 1} sliderBounds must contain nonempty min, max, and step strings.` });
      } else {
        const parsed = Object.fromEntries(
          ["min", "max", "step"].map((key) => [key, parseExactRational(sliderBounds[key])]),
        );
        if (!parsed.min || !parsed.max || !parsed.step) {
          issues.push({ type: "invalidDesmosExpressionMetadata", message: `${location} expression ${expressionIndex + 1} sliderBounds must be exact numeric values.` });
        } else if (compareExactRationals(parsed.min, parsed.max) >= 0 || compareExactRationals(parsed.step, parseExactRational("0")) <= 0) {
          issues.push({ type: "invalidDesmosExpressionMetadata", message: `${location} expression ${expressionIndex + 1} sliderBounds require min < max and a positive step.` });
        }
      }
    }
    if (hasOwn(record, "playing") && !hasOwn(record, "sliderBounds")) {
      issues.push({ type: "invalidDesmosExpressionMetadata", message: `${location} expression ${expressionIndex + 1} playing requires explicit sliderBounds.` });
    }
    const sliderAssignment = latex.match(/^\s*([A-Za-z](?:_\{[^}]+\}|_[A-Za-z0-9])?)\s*=\s*.+$/);
    if (hasOwn(record, "sliderBounds") && (!sliderAssignment || ["x", "y"].includes(sliderAssignment[1].replace(/[{}\s]/g, "").toLowerCase()))) {
      issues.push({ type: "invalidDesmosExpressionMetadata", message: `${location} expression ${expressionIndex + 1} sliderBounds require a single parameter assignment.` });
    }
    if (typeof record.id === "string" && !record.id.trim()) {
      issues.push({ type: "invalidDesmosExpressionMetadata", message: `${location} expression ${expressionIndex + 1} id must not be empty.` });
    }
    if (typeof record.color === "string" && !record.color.trim()) {
      issues.push({ type: "invalidDesmosExpressionMetadata", message: `${location} expression ${expressionIndex + 1} color must not be empty.` });
    }
    if (typeof record.label === "string" && record.label.trim().toLowerCase() === "undefined") {
      issues.push({ type: "invalidDesmosExpressionMetadata", message: `${location} expression ${expressionIndex + 1} label must not be the literal string "undefined".` });
    }
    expressions.push(latex);
  });
  return { expressions, issues };
};

const normalizeDesmosBounds = (value) => {
  const bounds = asRecord(value);
  if (!bounds) return null;
  const left = asFiniteNumber(bounds.left);
  const right = asFiniteNumber(bounds.right);
  const bottom = asFiniteNumber(bounds.bottom);
  const top = asFiniteNumber(bounds.top);
  if (left === undefined || right === undefined || bottom === undefined || top === undefined) return null;
  if (left >= right || bottom >= top) return null;
  return { left, right, bottom, top };
};

const normalizeDesmosTables = (value, location) => {
  const issues = [];
  if (value === undefined) return { tables: [], issues };
  if (!Array.isArray(value)) {
    return {
      tables: [],
      issues: [{ type: "invalidDesmosTable", message: `${location} tables must be an array.` }],
    };
  }

  const tables = [];
  value.forEach((rawTable, tableIndex) => {
    const table = asRecord(rawTable);
    if (!table || !Array.isArray(table.columns)) {
      issues.push({
        type: "invalidDesmosTable",
        message: `${location} table ${tableIndex + 1} must contain a columns array.`,
      });
      return;
    }

    const columns = [];
    table.columns.forEach((rawColumn, columnIndex) => {
      const column = asRecord(rawColumn);
      const latex = column ? asString(column.latex).trim() : "";
      if (!column || !latex || !Array.isArray(column.values)) {
        issues.push({
          type: "invalidDesmosTable",
          message: `${location} table ${tableIndex + 1} column ${columnIndex + 1} needs latex and a values array.`,
        });
        return;
      }
      let hasInvalidValue = false;
      const values = column.values.map((item) => {
        if (typeof item === "number" && Number.isFinite(item)) return String(item);
        if (typeof item === "string") return item;
        hasInvalidValue = true;
        return "";
      });
      if (hasInvalidValue) {
        issues.push({
          type: "invalidDesmosTable",
          message: `${location} table ${tableIndex + 1} column ${latex} values must be strings or finite numbers.`,
        });
      }
      if (!values.length || !values.some((item) => item.trim().length > 0)) {
        issues.push({
          type: "invalidDesmosTable",
          message: `${location} table ${tableIndex + 1} column ${latex} needs at least one populated value.`,
        });
      }
      columns.push({ latex, values });
    });

    if (columns.length < 2) {
      issues.push({
        type: "invalidDesmosTable",
        message: `${location} table ${tableIndex + 1} needs at least two valid columns.`,
      });
      return;
    }

    const rowCounts = new Set(columns.map((column) => column.values.length));
    if (rowCounts.size > 1) {
      issues.push({
        type: "invalidDesmosTable",
        message: `${location} table ${tableIndex + 1} columns must have equal row counts.`,
      });
    }
    const columnNames = columns.map((column) => canonicalSymbol(column.latex));
    if (new Set(columnNames).size !== columnNames.length) {
      issues.push({
        type: "duplicateDesmosTableColumn",
        message: `${location} table ${tableIndex + 1} has duplicate column names.`,
      });
    }
    tables.push({ columns });
  });

  return { tables, issues };
};

const normalizeDesmosConfig = (record, kind, graphIndex = null) => {
  const isGraph = kind === "graph";
  const location = isGraph ? `Desmos graph ${graphIndex + 1}` : kind === "root" ? "Top-level Desmos config" : "Inline Desmos config";
  const keys = isGraph
    ? {
        expressions: "expressions",
        tables: "tables",
        bounds: "bounds",
        degreeMode: "degreeMode",
        defaultLogModeRegressions: "defaultLogModeRegressions",
        preserveSquareUnits: "preserveSquareUnits",
        showGraphpaper: "showGraphpaper",
      }
    : {
        expressions: "desmosExpressions",
        tables: "desmosTables",
        bounds: "desmosBounds",
        degreeMode: "desmosDegreeMode",
        defaultLogModeRegressions: "desmosDefaultLogModeRegressions",
        preserveSquareUnits: "desmosPreserveSquareUnits",
        showGraphpaper: "desmosShowGraphpaper",
      };
  const issues = [];
  const rawExpressions = record[keys.expressions];
  const normalizedExpressions = normalizeDesmosExpressions(rawExpressions, location);
  const expressions = normalizedExpressions.expressions;
  issues.push(...normalizedExpressions.issues);

  const normalizedTables = normalizeDesmosTables(record[keys.tables], location);
  issues.push(...normalizedTables.issues);
  const hasDesmos = expressions.length > 0 || normalizedTables.tables.length > 0 ||
    (Array.isArray(rawExpressions) && rawExpressions.length > 0) ||
    (Array.isArray(record[keys.tables]) && record[keys.tables].length > 0);
  const boundsProvided = hasOwn(record, keys.bounds);
  const bounds = normalizeDesmosBounds(record[keys.bounds]);
  if (boundsProvided && !bounds) {
    issues.push({
      type: "invalidDesmosBounds",
      message: `${location} bounds must contain finite left < right and bottom < top values.`,
    });
  }

  const readBoolean = (key, type, label) => {
    if (!hasOwn(record, key)) return undefined;
    if (typeof record[key] === "boolean") return record[key];
    issues.push({ type, message: `${location} ${label} must be a boolean.` });
    return undefined;
  };
  const degreeMode = readBoolean(keys.degreeMode, "invalidDesmosDegreeMode", keys.degreeMode);
  const defaultLogModeRegressions = readBoolean(
    keys.defaultLogModeRegressions,
    "invalidDesmosDefaultLogModeRegressions",
    keys.defaultLogModeRegressions,
  );
  const preserveSquareUnits = readBoolean(
    keys.preserveSquareUnits,
    "invalidDesmosPreserveSquareUnits",
    keys.preserveSquareUnits,
  );
  const showGraphpaper = readBoolean(
    keys.showGraphpaper,
    "invalidDesmosShowGraphpaper",
    keys.showGraphpaper,
  );

  if (hasDesmos && !boundsProvided) {
    issues.push({ type: "missingDesmosBounds", message: `${location} needs authored bounds.` });
  }
  if (hasDesmos && !hasOwn(record, keys.degreeMode)) {
    issues.push({ type: "missingDesmosDegreeMode", message: `${location} needs an explicit ${keys.degreeMode} boolean.` });
  }
  if (hasDesmos && !hasOwn(record, keys.defaultLogModeRegressions)) {
    issues.push({
      type: "missingDesmosDefaultLogModeRegressions",
      message: `${location} needs an explicit ${keys.defaultLogModeRegressions} boolean.`,
    });
  }
  if (hasDesmos && !hasOwn(record, keys.showGraphpaper)) {
    issues.push({
      type: "missingDesmosShowGraphpaper",
      message: `${location} needs an explicit ${keys.showGraphpaper} boolean.`,
    });
  }

  const misplacedKeys = isGraph
    ? ["desmosBounds", "desmosDegreeMode", "desmosDefaultLogModeRegressions", "desmosPreserveSquareUnits", "desmosShowGraphpaper"]
    : ["bounds", "degreeMode", "defaultLogModeRegressions", "preserveSquareUnits", "showGraphpaper"];
  if (misplacedKeys.some((key) => hasOwn(record, key))) {
    issues.push({
      type: "misplacedDesmosConfigField",
      message: `${location} uses a graph/step alias instead of the canonical field names.`,
    });
  }

  return {
    location,
    expressions,
    tables: normalizedTables.tables,
    bounds,
    degreeMode,
    defaultLogModeRegressions,
    preserveSquareUnits,
    showGraphpaper,
    hasDesmos,
    issues,
  };
};

const normalizeStep = (step, index) => {
  if (typeof step === "string") {
    return { title: `Step ${index + 1}`, content: step, formula: "", expressions: [], tables: [], configs: [] };
  }
  const record = asRecord(step);
  if (!record) return { title: `Step ${index + 1}`, content: "", formula: "", expressions: [], tables: [], configs: [] };
  const inlineConfig = normalizeDesmosConfig(record, "step");
  const graphConfigs = Array.isArray(record.desmosGraphs)
    ? record.desmosGraphs.map((graph, graphIndex) => {
        const graphRecord = asRecord(graph);
        const config = normalizeDesmosConfig(graphRecord ?? {}, "graph", graphIndex);
        if (!graphRecord) {
          config.issues.push({
            type: "invalidDesmosGraph",
            message: `Desmos graph ${graphIndex + 1} must be an object.`,
          });
        }
        return config;
      })
    : [];
  const configs = [inlineConfig, ...graphConfigs].filter((config) => config.hasDesmos || config.issues.length);
  return {
    title: asString(record.title) || asString(record.heading) || asString(record.label) || `Step ${index + 1}`,
    content:
      asString(record.content) ||
      asString(record.text) ||
      asString(record.step) ||
      asString(record.explanation) ||
      asString(record.explanationHtml),
    formula: asString(record.formula),
    expressions: configs.flatMap((config) => config.expressions),
    tables: configs.flatMap((config) => config.tables),
    configs,
  };
};

const choiceText = (question) => (question.choices ?? []).map((choice) => choice.text ?? "").join(" ");
const sourceText = (question) => [question.text, choiceText(question), question.rationale].filter(Boolean).join(" ");
const visiblePromptText = (question) => String(question.text ?? "");
const hasEquationLikeText = (text) =>
  /(?:[xy]|[fgh]\s*\(\s*[a-z]\s*\)|[fgh]\s*\()\s*(?:=|~)|(?:=|~)\s*(?:[xy]|[fgh]\s*\(|-?\d|\\frac)/i.test(text);
const hasGraphOnlyPrompt = (question) =>
  /\bgraph\b/i.test(question.text ?? "") &&
  /\bshown\b/i.test(question.text ?? "") &&
  !hasEquationLikeText(`${question.text ?? ""} ${choiceText(question)}`);
const DESMOS_CONTEXT_RE = /\b(?:desmos|graph|plot|row|table|calculator|regression|fit|model|overlay|overlap|confirm|check|verify|below|shown|touch|intersect|same)\b/i;
const REGRESSION_EXPRESSION_RE = /(?:\\sim|~)/;
const REGRESSION_CONTEXT_RE = /\b(?:desmos|regression|fit|model|table|residual|exact condition|solve the condition)\b/i;
const DESMOS_CLAIM_RE = /\bDesmos (?:gives|returns|reports)\b/i;
const AWKWARD_CALCULATOR_TEXT_RE =
  /\b(?:run The calculation|Type The calculation|Use The calculation|entering them in The calculation|direct calculation value|a the direct|run in Desmos|solving gives|type Desmos solves)\b/i;
const UNSUPPORTED_DESMOS_FUNCTION_RE =
  /(?:\bans\b|(?:\\operatorname\s*\{\s*)?(repeat|discretedist|area|perimeter|segment|angle|rotate)\s*\}?\s*(?:\\left\s*)?\()/i;
const EXACT_CUSTOM_METHOD_RE = /\b(?:custom regression|residual(?:s| list)?)\b/i;
const EXACT_CONDITION_CONTEXT_RE =
  /\b(?:exact condition(?:s)?|identity|identically equal|equivalent for all|infinitely many solutions)\b/i;
const SUBSTITUTION_CHECK_RE = /\b(?:substitut(?:e|ion)|plug(?:ging)?\b.{0,40}\bback|verify|check)\b/i;
const ZERO_RMSE_RE = /(?:\brmse\b.{0,32}\b(?:0|zero)\b|\b(?:0|zero)\b.{0,32}\brmse\b)/i;
const PROMPT_RESTRICTION_RE =
  /\b(?:positive|negative|nonnegative|nonpositive|greater than|less than|at least|at most|integer|domain|range|exponential|growth|decay)\b/i;
const CIRCLE_EXPRESSION_RE =
  /(?:\([^)]*x[^)]*\)|x(?:_\{?\d+\}?)?)\s*\^\s*\{?2\}?\s*\+\s*(?:\([^)]*y[^)]*\)|y(?:_\{?\d+\}?)?)\s*\^\s*\{?2\}?/i;
const DENSE_BULLET_RE = /(?:^|<br\s*\/?>|\n)\s*[•*-]\s+/;
const RAW_BULLET_RE = /•/;
const ESCAPED_HTML_TAG_RE =
  /\\lt\s*(?:\/\s*)?(?:br|li|ul|ol|strong|em|p|span|div|table|thead|tbody|tr|td|th)\b/i;
const FRAGILE_INTERVAL_MATH_IN_HTML_RE =
  /<(?:li|p|div)\b[^>]*>[^<]*\$\[[^$]+\)\$|Through\s+\$\[[^$]+\)\$/i;
const GRAPH_EQUATION_CONTENT_RE =
  /\b(?:equation|line|parabola|curve|function|model)\b[^.;:\n]{0,90}(?:[fgh]\s*\(\s*x\s*\)|y)\s*=\s*[^.;\n]*x/i;
const BROKEN_STYLE_RE =
  /\b(?:BecaUse|so Use the table points directly|Use the table points directly\. Use|fastest check is to fit)\b/;
const MALFORMED_TEX_RE =
  /(?:[0-9a-z]\s*cdot|\\\s+Rightarrow|(?<!\\)(?:left|right)\s*[\(\[]|(?<!\\)\bquad(?:\\text|\s+[a-z])|[\f\r])/i;
const HTML_ENTITY_IN_MATH_RE = /&(lt|gt|le|ge);/i;
const HTML_ARROW_ENTITY_RE = /&rArr;|&Rightarrow;/i;
const QUADRATIC_TOOL_RE = /\b(?:discriminant|quadratic formula)\b/i;
const QUADRATIC_TOOL_CONTEXT_RE =
  /\b(?:exactly one|one real|no real|two distinct|repeated|touch|tangent|intersect|solutions?|roots?|factor|does not factor|opens|crosses|parabola|because|tells us|means|how many real)\b/i;
const WEAK_DESMOS_CONTEXT_RE =
  /^(?:check(?: the (?:result|answer))?|confirm(?: with (?:a )?graph)?|desmos(?: graph)?(?: check)?|graph check)$/i;
const TOOL_FIRST_TITLE_RE = /^(?:use|apply) the (?:discriminant|quadratic formula)(?: test| condition)?$/i;

const hasRawLessThanInMath = (value) => {
  const text = String(value ?? "");
  for (let cursor = 0; cursor < text.length;) {
    const start = text.slice(cursor).search(/(?<!\\)\$/);
    if (start === -1) return false;
    const open = cursor + start;
    const delimiterLength = text[open + 1] === "$" && text[open] !== "\\" ? 2 : 1;
    let close = open + delimiterLength;
    while (close < text.length) {
      if (
        text[close] === "$" &&
        text[close - 1] !== "\\" &&
        (delimiterLength === 1 || text[close + 1] === "$")
      ) {
        const body = text.slice(open + delimiterLength, close);
        if (/(?<!\\)</.test(body)) return true;
        cursor = close + delimiterLength;
        break;
      }
      close += 1;
    }
    if (close >= text.length) return false;
  }
  return false;
};

const hasHtmlEntityInMath = (value) => {
  const text = String(value ?? "");
  for (let cursor = 0; cursor < text.length;) {
    const start = text.slice(cursor).search(/(?<!\\)\$/);
    if (start === -1) return false;
    const open = cursor + start;
    const delimiterLength = text[open + 1] === "$" && text[open] !== "\\" ? 2 : 1;
    let close = open + delimiterLength;
    while (close < text.length) {
      if (
        text[close] === "$" &&
        text[close - 1] !== "\\" &&
        (delimiterLength === 1 || text[close + 1] === "$")
      ) {
        const body = text.slice(open + delimiterLength, close);
        if (HTML_ENTITY_IN_MATH_RE.test(body)) return true;
        cursor = close + delimiterLength;
        break;
      }
      close += 1;
    }
    if (close >= text.length) return false;
  }
  return false;
};

const canonicalSymbol = (value) =>
  String(value ?? "")
    .replace(/\\(?:left|right)/g, "")
    .replace(/_\{([^{}]+)\}/g, "_$1")
    .replace(/[{}\s]/g, "")
    .toLowerCase();

const splitTopLevel = (value) => {
  const parts = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "(" || character === "[" || character === "{") depth += 1;
    if (character === ")" || character === "]" || character === "}") depth = Math.max(0, depth - 1);
    if (character === "," && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
};

const listItemCount = (value) => {
  const body = String(value ?? "").replace(/\\(?:left|right)/g, "").trim();
  const range = body.match(/^(-?\d+)\s*(?:\.\.\.|…)\s*(-?\d+)$/);
  if (range) return Math.abs(Number(range[2]) - Number(range[1])) + 1;
  return new Set(splitTopLevel(body).map(canonicalSymbol)).size;
};

const extractListDefinitions = (expressions) => {
  const definitions = new Map();
  for (const expression of expressions) {
    if (REGRESSION_EXPRESSION_RE.test(expression)) continue;
    const normalized = expression.replace(/\\(?:left|right)/g, "").trim();
    const match = normalized.match(/^([A-Za-z](?:_\{?[A-Za-z0-9]+\}?)?)\s*=\s*\[([\s\S]*)\]$/);
    if (match) definitions.set(canonicalSymbol(match[1]), listItemCount(match[2]));
  }
  return definitions;
};

const extractSymbols = (value) => {
  const withoutFunctions = String(value ?? "")
    .replace(/\\operatorname\s*\{[^}]+\}/gi, " ")
    .replace(/\\(?:left|right|frac|sqrt|sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|ln|log|exp|cdot|times|pi)\b/gi, " ")
    .replace(/\b(?:sqrt|sin|cos|tan|ln|log|exp|mean|median|total|max|min|stdevp|quartile|distance|midpoint|polygon)\b/gi, " ")
    .replace(/\\[A-Za-z]+/g, " ");
  return unique(
    [...withoutFunctions.matchAll(/([A-Za-z](?:_\{?[A-Za-z0-9]+\}?)?)/g)]
      .map((match) => canonicalSymbol(match[1]))
      .filter((symbol) => symbol && symbol !== "e"),
  );
};

const splitRegressionExpression = (expression) => {
  const match = String(expression).match(/^([\s\S]*?)(?:\\sim|~)([\s\S]*)$/);
  return match ? { left: match[1].trim(), right: match[2].trim() } : null;
};

const numericTargetCount = (value) => {
  const normalized = String(value ?? "").replace(/\\(?:left|right)/g, "").replace(/\s+/g, "");
  const list = normalized.match(/^\[([\s\S]*)\]$/);
  const numericValue = /^(?:[-+]?\d+(?:\.\d+)?|\\frac\{[-+]?\d+\}\{[-+]?\d+\})$/;
  if (list) {
    const items = splitTopLevel(list[1]);
    return items.length && items.every((item) => numericValue.test(item.replace(/\s+/g, ""))) ? items.length : 0;
  }
  return numericValue.test(normalized) ? 1 : 0;
};

const hasNonlinearFittedParameter = (expression, parameters) => {
  const normalized = canonicalSymbol(String(expression).replace(/\\sim|~/g, "="));
  const compact = String(expression)
    .replace(/\\(?:left|right)/g, "")
    .replace(/_\{([^{}]+)\}/g, "_$1")
    .replace(/\s+/g, "")
    .toLowerCase();
  const fractionDenominators = [...compact.matchAll(/\\frac\{[^{}]*\}\{([^{}]*)\}/g)]
    .map((match) => canonicalSymbol(match[1]));
  return parameters.some((parameter) => {
    const escaped = parameter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const token = `(?<![a-z0-9_])${escaped}(?![a-z0-9_])`;
    return [
      new RegExp(`${token}\\^`, "i"),
      new RegExp(`\\^[^,+\\-*/=~)]*${token}`, "i"),
      new RegExp(`(?:sqrt|sin|cos|tan|ln|log|exp)\\([^)]*${token}`, "i"),
      new RegExp(`/(?:${token}|\\([^)]*${token}[^)]*\\))`, "i"),
      new RegExp(`\\([^()]*${token}[^()]*\\)\\^`, "i"),
      new RegExp(`\\[[^\[\]]*${token}[^\[\]]*\\]\\^`, "i"),
      new RegExp(`\\|[^|]*${token}[^|]*\\|`, "i"),
    ].some((pattern) => pattern.test(normalized)) ||
      fractionDenominators.some((denominator) => new RegExp(token, "i").test(denominator));
  });
};

const auditRegressionConfig = ({ config, contentWithTitle, explanationContext, question }) => {
  const issues = [];
  const regressionExpressions = config.expressions.filter((expression) => REGRESSION_EXPRESSION_RE.test(expression));
  if (!regressionExpressions.length) return issues;

  if (!REGRESSION_CONTEXT_RE.test(contentWithTitle)) {
    issues.push({
      type: "regressionAbsentContext",
      message: `${config.location} has a regression row without nearby text explaining the table/model or exact-condition solve.`,
    });
  }
  if (config.defaultLogModeRegressions !== true) {
    issues.push({
      type: "unsafeRegressionLogMode",
      message: `${config.location} regression rows require defaultLogModeRegressions: true.`,
    });
  }

  const tableColumns = new Map();
  for (const table of config.tables) {
    for (const column of table.columns) tableColumns.set(canonicalSymbol(column.latex), column.values);
  }
  const listDefinitions = extractListDefinitions(config.expressions);

  for (const expression of regressionExpressions) {
    const regression = splitRegressionExpression(expression);
    if (!regression) continue;
    const symbols = extractSymbols(expression);
    const referencedTableColumns = symbols.filter((symbol) => tableColumns.has(symbol));
    const referencedLists = symbols.filter((symbol) => listDefinitions.has(symbol));
    const missingDataColumns = symbols.filter(
      (symbol) => /_[0-9]+$/.test(symbol) && !tableColumns.has(symbol) && !listDefinitions.has(symbol),
    );
    if (missingDataColumns.length) {
      issues.push({
        type: "missingRegressionTableColumn",
        message: `${config.location} regression references missing data column(s): ${missingDataColumns.join(", ")}.`,
      });
    }

    const dataSymbols = new Set([...referencedTableColumns, ...referencedLists, ...missingDataColumns]);
    const parameters = symbols.filter((symbol) => !dataSymbols.has(symbol));
    if (parameters.includes("x") || parameters.includes("y")) {
      issues.push({
        type: "regressionXYParameter",
        message: `${config.location} uses bare x or y as a fitted parameter; use table/list variables such as x_1 and y_1.`,
      });
    }

    if (!parameters.length) {
      issues.push({
        type: "unsupportedRegressionPattern",
        message: `${config.location} regression row has no identifiable fitted parameter.`,
      });
      continue;
    }

    let conditionCount = 0;
    if (config.tables.length) {
      if (referencedTableColumns.length < 2) {
        issues.push({
          type: "unsupportedRegressionPattern",
          message: `${config.location} table regression must reference at least two populated table columns.`,
        });
      } else {
        const rowCounts = referencedTableColumns.map((symbol) => tableColumns.get(symbol).length);
        if (new Set(rowCounts).size > 1) {
          issues.push({
            type: "invalidRegressionTableRows",
            message: `${config.location} referenced regression columns must have equal physical row counts.`,
          });
        }
        const comparableRows = Math.min(...rowCounts);
        const rowTuples = Array.from({ length: comparableRows }, (_, rowIndex) => {
          const values = referencedTableColumns.map((symbol) => tableColumns.get(symbol)[rowIndex] ?? "");
          return values.every((value) => value.trim().length > 0) ? values.join("\u0000") : null;
        }).filter(Boolean);
        if (!rowTuples.length) {
          issues.push({
            type: "invalidRegressionTableRows",
            message: `${config.location} regression needs at least one fully populated paired row.`,
          });
        }
        conditionCount = new Set(rowTuples).size;
      }
    } else {
      const targetCount = Math.max(numericTargetCount(regression.left), numericTargetCount(regression.right));
      const listCount = Math.max(0, ...referencedLists.map((symbol) => listDefinitions.get(symbol)));
      const residualListCounts = [regression.left, regression.right]
        .filter((side) => numericTargetCount(side) === 0 && /^\s*(?:\\left)?\[/.test(side))
        .map((side) => listItemCount(side.replace(/^\s*(?:\\left)?\[/, "").replace(/\](?:\\right)?\s*$/, "")));
      conditionCount = Math.max(listCount, ...(residualListCounts.length ? residualListCounts : [targetCount]));
      if (
        !targetCount ||
        !EXACT_CUSTOM_METHOD_RE.test(explanationContext) ||
        !EXACT_CONDITION_CONTEXT_RE.test(explanationContext)
      ) {
        issues.push({
          type: "unsupportedRegressionPattern",
          message: `${config.location} table-free regression must be an explicitly explained exact scalar/residual-list solve.`,
        });
      }
      if (!SUBSTITUTION_CHECK_RE.test(explanationContext)) {
        issues.push({
          type: "exactRegressionMissingCheck",
          message: `${config.location} exact custom solve needs a substitution or verification step.`,
        });
      }
      if (!ZERO_RMSE_RE.test(explanationContext)) {
        issues.push({
          type: "exactRegressionMissingZeroResidual",
          message: `${config.location} exact custom solve must state that RMSE/residual error is 0.`,
        });
      }
    }

    if (conditionCount < parameters.length) {
      issues.push({
        type: "underdeterminedRegression",
        message: `${config.location} has ${conditionCount} independent condition(s) for ${parameters.length} fitted parameter(s).`,
      });
    }

    if (
      hasNonlinearFittedParameter(expression, parameters) &&
      !PROMPT_RESTRICTION_RE.test(visiblePromptText(question))
    ) {
      issues.push({
        type: "ambiguousNonlinearRegression",
        message: `${config.location} has a nonlinear fitted parameter without a prompt-supplied restriction selecting a valid solution.`,
      });
    }
  }

  return issues;
};

const auditStep = ({ fileName, question, step, stepIndex, explanationContext }) => {
  const issues = [];
  const cleanContent = stripHtml(step.content);
  const contentWithTitle = `${step.title} ${cleanContent}`;
  const hasExpressions = step.expressions.length > 0;
  const hasDesmos = step.configs.some((config) => config.hasDesmos);
  const hasRegression = step.expressions.some((expression) => REGRESSION_EXPRESSION_RE.test(expression));

  for (const config of step.configs) {
    issues.push(...config.issues);
    for (const expression of config.expressions) {
      const unsupported = expression.match(UNSUPPORTED_DESMOS_FUNCTION_RE);
      if (unsupported) {
        issues.push({
          type: "unsupportedDesmosFunction",
          message: `${config.location} uses unsupported College Board Desmos function ${unsupported[1]}.`,
        });
      }
    }
    if (
      config.expressions.some((expression) => CIRCLE_EXPRESSION_RE.test(expression)) &&
      config.showGraphpaper !== false &&
      config.preserveSquareUnits !== true
    ) {
      issues.push({
        type: "missingDesmosPreserveSquareUnits",
        message: `${config.location} graphs a circle/coordinate shape and requires preserveSquareUnits: true.`,
      });
    }
    issues.push(...auditRegressionConfig({ config, contentWithTitle, explanationContext, question }));
  }

  if (hasDesmos && (!DESMOS_CONTEXT_RE.test(contentWithTitle) || (WEAK_DESMOS_CONTEXT_RE.test(step.title) && cleanContent.length < 120))) {
    issues.push({
      type: "contextlessDesmos",
      message: "Desmos expressions/tables appear without nearby text explaining what the graph, table, or regression is checking.",
      stepIndex,
    });
  }

  if (DESMOS_CLAIM_RE.test(contentWithTitle) && !hasRegression) {
    issues.push({
      type: "opaqueDesmosClaim",
      message: "Do not rely on 'Desmos gives/returns/reports' without showing the underlying math or visible check.",
      stepIndex,
    });
  }

  if (AWKWARD_CALCULATOR_TEXT_RE.test(contentWithTitle)) {
    issues.push({
      type: "awkwardCalculatorWording",
      message: "Generated calculator phrasing needs to be rewritten into direct, readable solution prose.",
      stepIndex,
    });
  }

  if (BROKEN_STYLE_RE.test(contentWithTitle)) {
    issues.push({
      type: "brokenGeneratedStyle",
      message: "Generated rewrite produced broken casing, duplicated instructions, or awkward fit wording.",
      stepIndex,
    });
  }

  if (MALFORMED_TEX_RE.test(step.content) || MALFORMED_TEX_RE.test(step.formula)) {
    issues.push({
      type: "malformedTeX",
      message: "Renderable content contains malformed TeX such as xcdot, wcdot, \\frac12, or spaced \\Rightarrow.",
      stepIndex,
    });
  }

  if (
    stepIndex === 0 &&
    QUADRATIC_TOOL_RE.test(contentWithTitle) &&
    (TOOL_FIRST_TITLE_RE.test(step.title) || !QUADRATIC_TOOL_CONTEXT_RE.test(cleanContent.slice(0, 280)))
  ) {
    issues.push({
      type: "formulaFirstNoContext",
      message: "First step should frame the solution goal before naming the discriminant or quadratic formula.",
      stepIndex,
    });
  }

  if (step.formula && !/(?:formula|discriminant|area|volume|slope|distance|use|apply|because|when|if)/i.test(contentWithTitle)) {
    issues.push({
      type: "orphanFormula",
      message: "Step has a formula card without enough context in the step text.",
      stepIndex,
    });
  }

  if (
    cleanContent.length > 280 &&
    (DENSE_BULLET_RE.test(step.content) || /\bcumulative counts?\b/i.test(cleanContent) || /\bhistogram\b/i.test(cleanContent)) &&
    !/<(?:ul|ol|table)\b/i.test(step.content)
  ) {
    issues.push({
      type: "denseDataParagraph",
      message: "Data-heavy explanation should use HTML list/table structure instead of a dense paragraph.",
      stepIndex,
    });
  }

  if (RAW_BULLET_RE.test(step.content) && !/<(?:ul|ol)\b/i.test(step.content)) {
    issues.push({
      type: "rawBulletList",
      message: "Use structured <ul>/<ol> list markup instead of raw bullet characters in renderable content.",
      stepIndex,
    });
  }

  if (hasRawLessThanInMath(step.content) || hasRawLessThanInMath(step.formula)) {
    issues.push({
      type: "rawLessThanInMath",
      message: "Use \\lt or &lt; instead of a raw < inside math content.",
      stepIndex,
    });
  }

  if (hasHtmlEntityInMath(step.content) || hasHtmlEntityInMath(step.formula)) {
    issues.push({
      type: "htmlEntityInMath",
      message: "Use TeX comparators such as \\lt and \\gt inside math spans instead of HTML entities.",
      stepIndex,
    });
  }

  if (HTML_ARROW_ENTITY_RE.test(step.content) || HTML_ARROW_ENTITY_RE.test(step.formula)) {
    issues.push({
      type: "htmlArrowEntity",
      message: "Use \\Rightarrow inside math content instead of an HTML arrow entity.",
      stepIndex,
    });
  }

  if (ESCAPED_HTML_TAG_RE.test(step.content) || ESCAPED_HTML_TAG_RE.test(step.formula)) {
    issues.push({
      type: "escapedHtmlTag",
      message: "Renderable content contains an escaped HTML tag such as \\lt li> or \\lt br/>.",
      stepIndex,
    });
  }

  if (FRAGILE_INTERVAL_MATH_IN_HTML_RE.test(step.content)) {
    issues.push({
      type: "fragileIntervalMathInHtml",
      message: "Interval notation inside HTML list/paragraph markup can leak tags in the rendered explanation; use plain text ranges or safer TeX.",
      stepIndex,
    });
  }

  if (hasGraphOnlyPrompt(question) && GRAPH_EQUATION_CONTENT_RE.test(step.content)) {
    issues.push({
      type: "inventedGraphEquationTextRisk",
      message: "Graph-only prompt has explanation text asserting an equation not given in the source.",
      stepIndex,
    });
  }

  if (hasGraphOnlyPrompt(question) && hasExpressions) {
    const source = normalize(sourceText(question));
    const invented = step.expressions.filter((expression) => {
      if (REGRESSION_EXPRESSION_RE.test(expression)) return false;
      if (/^\s*\(-?\d|^\s*\(?\s*-?\\frac/.test(expression)) return false;
      const plain = normalize(expression);
      return hasEquationLikeText(expression) && plain.length > 3 && !source.includes(plain.slice(0, Math.min(plain.length, 24)));
    });
    if (invented.length) {
      issues.push({
        type: "inventedGraphEquationRisk",
        message: `Graph-only prompt has Desmos equation rows not present in the source: ${invented.slice(0, 3).join("; ")}`,
        stepIndex,
      });
    }
  }

  return issues.map((issue) => ({
    file: `public/explanations/${fileName}`,
    questionId: fileName.replace(/\.json$/, ""),
    ...issue,
    stepIndex: issue.stepIndex ?? stepIndex,
  }));
};

const sourceIndex = buildSourceIndex();
const issues = [];

for (const fileName of readdirSync(explanationDir).filter((file) => file.endsWith(".json")).sort()) {
  const id = fileName.replace(/\.json$/, "");
  const source = sourceIndex.get(id);
  if (!source && !includeOrphans) continue;
  const filePath = path.join(explanationDir, fileName);
  if (!existsSync(filePath)) continue;
  let explanation;
  try {
    explanation = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    issues.push({
      type: "parse",
      file: `public/explanations/${fileName}`,
      questionId: id,
      stepIndex: null,
      message: error.message,
    });
    continue;
  }
  if (!source && explanation?.section !== "Math") continue;
  const steps = Array.isArray(explanation.steps)
    ? explanation.steps.map(normalizeStep)
    : [];
  const rootConfig = normalizeDesmosConfig(explanation, "root");
  if (rootConfig.hasDesmos || rootConfig.issues.length) {
    if (!steps.length) {
      steps.push({
        title: "Explanation",
        content: asString(explanation.explanationHtml) || asString(explanation.explanation),
        formula: "",
        expressions: rootConfig.expressions,
        tables: rootConfig.tables,
        configs: [rootConfig],
      });
    } else {
      const lastStep = steps[steps.length - 1];
      lastStep.configs.push(rootConfig);
      lastStep.expressions.push(...rootConfig.expressions);
      lastStep.tables.push(...rootConfig.tables);
    }
  }
  const explanationContext = stripHtml([
    explanation.explanation,
    explanation.explanationHtml,
    explanation.choiceElimination,
    explanation.choiceEliminations,
    explanation.choiceAnalysis,
    explanation.eliminationHtml,
    ...steps.flatMap((step) => [step.title, step.content]),
  ].filter(Boolean).join(" "));
  steps.forEach((step, stepIndex) => {
    issues.push(...auditStep({
      fileName,
      question: source?.question ?? {},
      step,
      stepIndex,
      explanationContext,
    }));
  });
}

const reportedIssues = typeFilter ? issues.filter((issue) => issue.type === typeFilter) : issues;

const summary = {
  issues: reportedIssues.length,
  totalIssues: issues.length,
  byType: reportedIssues.reduce((counts, issue) => {
    counts[issue.type] = (counts[issue.type] ?? 0) + 1;
    return counts;
  }, {}),
  reportLimit,
  typeFilter: typeFilter || null,
  includeOrphans,
};

if (jsonOutput) {
  console.log(JSON.stringify({ summary, issues: reportedIssues.slice(0, reportLimit) }, null, 2));
} else {
  console.log("Explanation quality audit");
  console.log(`Issues: ${summary.issues}`);
  for (const [type, count] of Object.entries(summary.byType)) console.log(`${type}: ${count}`);
  for (const issue of reportedIssues.slice(0, reportLimit)) {
    console.log(`- [${issue.type}] ${issue.file} step ${issue.stepIndex + 1}: ${issue.message}`);
  }
}

if (failOnIssues && reportedIssues.length) {
  process.exitCode = 1;
}
