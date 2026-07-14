import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import puppeteer from "puppeteer";

const ROOT = process.cwd();
const EXPLANATION_DIR = path.join(ROOT, "public", "explanations");
const DESMOS_SRC = "https://www.desmos.com/api/v1.11/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6";
const DESMOS_CACHE_PATH = path.join(os.tmpdir(), "1600now-desmos-calculator-v1.11.js");
const MAX_ERROR_OUTPUT = 200;

const parseArgs = (argv) => {
  const known = new Set(["limit", "groups-per-page", "include-orphans", "id", "ids"]);
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const equalsIndex = token.indexOf("=");
    const key = token.slice(2, equalsIndex === -1 ? undefined : equalsIndex);
    if (!known.has(key)) throw new Error(`Unknown option: --${key}`);
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
  return values;
};

const readPositiveInteger = (values, key, fallback) => {
  const raw = values.get(key)?.at(-1);
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw) || Number(raw) <= 0 || !Number.isSafeInteger(Number(raw))) {
    throw new Error(`--${key} must be a positive integer: ${raw}`);
  }
  return Number(raw);
};

const readBooleanFlag = (values, key) => {
  const raw = values.get(key)?.at(-1);
  if (raw === undefined) return false;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`--${key} must be true or false: ${raw}`);
};

const args = parseArgs(process.argv.slice(2));
const limit = readPositiveInteger(args, "limit", Number.POSITIVE_INFINITY);
const groupsPerPage = readPositiveInteger(args, "groups-per-page", 25);
const includeOrphans = readBooleanFlag(args, "include-orphans");
const requestedIds = new Set(
  [...(args.get("id") ?? []), ...(args.get("ids") ?? [])]
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean),
);

const asRecord = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : null;
const asString = (value) => typeof value === "string" ? value : undefined;
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
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
const unique = (values) => [...new Set(values.filter(Boolean))];

const isMathQuestion = (question) =>
  question?.section === "Math" || question?.category?.subject === "Math";

const canonicalMathIds = new Set([
  ...readJson("src/data/questions/math_past.json").filter(isMathQuestion).map((question) => String(question.id)),
  ...readJson("src/data/questions/unofficial_math.json").filter(isMathQuestion).map((question) => String(question.id)),
]);

const normalizeExpression = (value) => {
  if (typeof value === "string") return { latex: value };
  const record = asRecord(value);
  if (!record) return { latex: "" };
  const latex = asString(record.latex) ?? asString(record.expression) ?? "";
  return {
    latex,
    ...(asString(record.id) ? { id: record.id } : {}),
    ...(asString(record.color) ? { color: record.color } : {}),
    ...(asString(record.label) ? { label: record.label } : {}),
    ...(asBoolean(record.showLabel) !== undefined ? { showLabel: record.showLabel } : {}),
    ...(asBoolean(record.hidden) !== undefined ? { hidden: record.hidden } : {}),
    ...(asRecord(record.sliderBounds) ? { sliderBounds: record.sliderBounds } : {}),
    ...(asBoolean(record.playing) !== undefined ? { playing: record.playing } : {}),
  };
};

const expressionMetadataErrors = (value, expressionIndex) => {
  const prefix = `expression ${expressionIndex + 1}`;
  if (typeof value === "string") return value.trim() ? [] : [`${prefix} must not be empty`];
  const record = asRecord(value);
  if (!record) return [`${prefix} must be a string or expression object`];
  const errors = [];
  const latex = asString(record.latex) ?? asString(record.expression);
  if (!latex?.trim()) errors.push(`${prefix} needs a nonempty latex/expression string`);
  for (const key of ["id", "color", "label"]) {
    if (record[key] !== undefined && typeof record[key] !== "string") {
      errors.push(`${prefix} ${key} must be a string`);
    }
  }
  for (const key of ["showLabel", "hidden"]) {
    if (record[key] !== undefined && typeof record[key] !== "boolean") {
      errors.push(`${prefix} ${key} must be a boolean`);
    }
  }
  if (record.playing !== undefined && typeof record.playing !== "boolean") {
    errors.push(`${prefix} playing must be a boolean`);
  }
  if (record.playing === true) errors.push(`${prefix} slider auto-play is not allowed`);
  if (record.playing !== undefined && record.sliderBounds === undefined) {
    errors.push(`${prefix} playing requires explicit sliderBounds`);
  }
  if (record.sliderBounds !== undefined) {
    if (record.playing !== false) errors.push(`${prefix} sliderBounds require explicit playing false`);
    const bounds = asRecord(record.sliderBounds);
    if (!bounds || Object.keys(bounds).sort().join(",") !== "max,min,step") {
      errors.push(`${prefix} sliderBounds must contain exactly min, max, and step`);
    } else {
      const parsed = Object.fromEntries(
        ["min", "max", "step"].map((key) => [key, typeof bounds[key] === "string" ? parseExactRational(bounds[key]) : null]),
      );
      if (!parsed.min || !parsed.max || !parsed.step) {
        errors.push(`${prefix} sliderBounds must be exact numeric strings`);
      } else if (compareExactRationals(parsed.min, parsed.max) >= 0 || compareExactRationals(parsed.step, parseExactRational("0")) <= 0) {
        errors.push(`${prefix} sliderBounds require min < max and a positive step`);
      }
    }
    const assignment = latex?.match(/^\s*([A-Za-z](?:_\{[^}]+\}|_[A-Za-z0-9])?)\s*=\s*.+$/);
    if (!assignment || ["x", "y"].includes(canonicalSymbol(assignment[1]))) {
      errors.push(`${prefix} sliderBounds require a single non-x/y parameter assignment`);
    }
  }
  if (typeof record.id === "string" && !record.id.trim()) errors.push(`${prefix} id must not be empty`);
  if (typeof record.color === "string" && !record.color.trim()) errors.push(`${prefix} color must not be empty`);
  if (typeof record.label === "string" && record.label.trim().toLowerCase() === "undefined") {
    errors.push(`${prefix} label must not be the literal string "undefined"`);
  }
  return errors;
};

const normalizeExpressions = (value) =>
  Array.isArray(value) ? value.map(normalizeExpression) : [];

const normalizeTables = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((rawTable) => {
    const table = asRecord(rawTable);
    const columns = Array.isArray(table?.columns)
      ? table.columns.map((rawColumn) => {
          const column = asRecord(rawColumn);
          return {
            latex: asString(column?.latex) ?? "",
            values: Array.isArray(column?.values)
              ? column.values.map((item) => typeof item === "string" || typeof item === "number" ? String(item) : "")
              : [],
          };
        })
      : [];
    return { columns };
  });
};

const normalizeBounds = (value) => {
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

const normalizeConfig = (record, kind, location) => {
  const isGraph = kind === "graph";
  const fields = isGraph
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
  const expressions = normalizeExpressions(record[fields.expressions]);
  const tables = normalizeTables(record[fields.tables]);
  const sourceIssues = Array.isArray(record[fields.expressions])
    ? record[fields.expressions].flatMap(expressionMetadataErrors)
    : record[fields.expressions] === undefined
      ? []
      : [`${location} expressions must be an array`];
  const hasRawConfig =
    (Array.isArray(record[fields.expressions]) && record[fields.expressions].length > 0) ||
    (Array.isArray(record[fields.tables]) && record[fields.tables].length > 0);
  if (!hasRawConfig) return null;
  return {
    location,
    expressions,
    tables,
    bounds: normalizeBounds(record[fields.bounds]),
    degreeMode: asBoolean(record[fields.degreeMode]) ?? true,
    defaultLogModeRegressions: asBoolean(record[fields.defaultLogModeRegressions]) ?? false,
    preserveSquareUnits: asBoolean(record[fields.preserveSquareUnits]) ?? false,
    showGraphpaper: asBoolean(record[fields.showGraphpaper]) ?? true,
    sourceIssues,
  };
};

const canonicalSymbol = (value) =>
  String(value ?? "")
    .replace(/\\(?:left|right)/g, "")
    .replace(/_\{([^{}]+)\}/g, "_$1")
    .replace(/[{}\s]/g, "")
    .toLowerCase();

const extractSymbols = (value) => {
  const withoutFunctions = String(value ?? "")
    .replace(/\\operatorname\s*\{[^}]+\}/gi, " ")
    .replace(/\b(?:sqrt|sin|cos|tan|ln|log|exp|mean|median|total|max|min|stdevp|quartile|distance|midpoint|polygon)\b/gi, " ")
    .replace(/\\[A-Za-z]+/g, " ");
  return unique(
    [...withoutFunctions.matchAll(/([A-Za-z](?:_\{?[A-Za-z0-9]+\}?)?)/g)]
      .map((match) => canonicalSymbol(match[1]))
      .filter((symbol) => symbol && symbol !== "e"),
  );
};

const regressionParameters = (config) => {
  const tableSymbols = new Set(
    config.tables.flatMap((table) => table.columns.map((column) => canonicalSymbol(column.latex))),
  );
  const listSymbols = new Set(
    config.expressions
      .filter((expression) => !/(?:\\sim|~)/.test(expression.latex))
      .map((expression) => expression.latex.match(/^\s*([A-Za-z](?:_\{?[A-Za-z0-9]+\}?)?)\s*=\s*(?:\\left)?\[/)?.[1])
      .map(canonicalSymbol)
      .filter(Boolean),
  );
  return unique(
    config.expressions
      .filter((expression) => /(?:\\sim|~)/.test(expression.latex))
      .flatMap((expression) => extractSymbols(expression.latex))
      .filter((symbol) => !tableSymbols.has(symbol) && !listSymbols.has(symbol) && !/_[0-9]+$/.test(symbol)),
  );
};

const extractConfigGroups = () => {
  const groups = [];
  const failures = [];
  const seenFiles = new Set();
  const parsedIds = new Set();
  for (const fileName of fs.readdirSync(EXPLANATION_DIR).filter((file) => file.endsWith(".json")).sort()) {
    const id = fileName.replace(/\.json$/, "");
    if (requestedIds.size && !requestedIds.has(id)) continue;
    if (!canonicalMathIds.has(id) && !includeOrphans) continue;
    seenFiles.add(id);
    const filePath = path.join(EXPLANATION_DIR, fileName);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      parsedIds.add(id);
    } catch (error) {
      failures.push({
        file: fileName,
        questionId: id,
        location: "file",
        reason: `invalid explanation JSON: ${error.message}`,
      });
      continue;
    }
    if (!canonicalMathIds.has(id) && data?.section !== "Math") continue;

    const steps = Array.isArray(data.steps) ? data.steps : [];
    steps.forEach((step, stepIndex) => {
      const record = asRecord(step);
      if (!record) return;
      const inline = normalizeConfig(record, "step", `step ${stepIndex + 1} inline`);
      if (inline) groups.push({ file: fileName, questionId: id, stepIndex, ...inline });
      if (Array.isArray(record.desmosGraphs)) {
        record.desmosGraphs.forEach((graph, graphIndex) => {
          const graphRecord = asRecord(graph);
          if (!graphRecord) return;
          const config = normalizeConfig(graphRecord, "graph", `step ${stepIndex + 1} graph ${graphIndex + 1}`);
          if (config) groups.push({ file: fileName, questionId: id, stepIndex, graphIndex, ...config });
        });
      }
    });

    const topLevel = normalizeConfig(data, "root", "top-level");
    if (topLevel) groups.push({ file: fileName, questionId: id, stepIndex: "top-level", ...topLevel });
  }
  for (const id of requestedIds) {
    if (!canonicalMathIds.has(id) && !includeOrphans) {
      failures.push({ file: `${id}.json`, questionId: id, location: "selection", reason: "unknown canonical math question ID" });
    } else if (!seenFiles.has(id)) {
      failures.push({ file: `${id}.json`, questionId: id, location: "selection", reason: "missing explanation file" });
    }
  }

  const selectedGroups = groups.slice(0, limit).map((group) => ({
    ...group,
    regressionParameters: regressionParameters(group),
  }));
  for (const id of requestedIds) {
    if (!parsedIds.has(id)) continue;
    if (!selectedGroups.some((group) => group.questionId === id)) {
      failures.push({
        file: `${id}.json`,
        questionId: id,
        location: "selection",
        reason: "requested question has no selected Desmos config to audit",
      });
    }
  }
  return { groups: selectedGroups, failures };
};

const staticExpressionErrors = (expression) => {
  expression = String(expression ?? "").trim();
  const errors = [];
  if (!expression) errors.push("empty expression");
  if (/<\/?[a-z][\s\S]*>/i.test(expression)) errors.push("contains HTML");
  if (/\$/.test(expression)) errors.push("contains math delimiters");
  if (/\\(?:text|quad|qquad|begin|end)\b/.test(expression)) errors.push("contains prose-only LaTeX command");
  if (/[₀-₉₁₂₃₄₅₆₇₈₉]|…/.test(expression)) errors.push("contains unicode subscript or ellipsis");
  if (/(?<!\\)\bsum\s*\(/.test(expression)) errors.push("uses sum(...); use total(...) for Desmos list sums");
  if (/(?<!\\)\b(?:mean|median|total|max|min|stdevp)\s*\(/.test(expression)) {
    errors.push("uses plaintext list/stat function; use \\operatorname{...}\\left(...\\right) for Desmos API LaTeX");
  }
  if (/(?<!\\)(?:\b|[A-Za-z0-9.])(?:sqrt|abs|frac)\s*\(/.test(expression)) {
    errors.push("uses plaintext function syntax");
  }
  return errors;
};

const staticGroupFailures = (group) => {
  const failures = group.sourceIssues.map((reason) => ({ ...group, reason }));
  const expressionIds = group.expressions.map((expression, index) => expression.id ?? `expr-${index}`);
  const tableIds = group.tables.map((_, index) => `table-${index}`);
  const ids = [...expressionIds, ...tableIds];
  if (new Set(ids).size !== ids.length) {
    failures.push({ ...group, reason: "duplicate expression/table ids" });
  }
  group.expressions.forEach((expression, expressionIndex) => {
    const errors = staticExpressionErrors(expression.latex);
    if (errors.length) failures.push({ ...group, expressionIndex, expression: expression.latex, reason: errors.join("; ") });
  });
  group.tables.forEach((table, tableIndex) => {
    if (table.columns.length < 2) {
      failures.push({ ...group, tableIndex, reason: "table needs at least two columns" });
      return;
    }
    const rowCounts = table.columns.map((column) => column.values.length);
    if (rowCounts.some((count) => count === 0) || new Set(rowCounts).size !== 1) {
      failures.push({ ...group, tableIndex, reason: "table columns need equal nonzero row counts" });
    }
    for (const column of table.columns) {
      if (!column.latex || !column.values.some((value) => value.trim().length > 0)) {
        failures.push({ ...group, tableIndex, reason: "table columns need latex and at least one populated value" });
        break;
      }
    }
  });
  const regressionRows = group.expressions.filter((expression) => /(?:\\sim|~)/.test(expression.latex));
  if (regressionRows.length && !group.regressionParameters.length) {
    failures.push({ ...group, reason: "regression row has no identifiable fitted parameters" });
  }
  for (const regression of regressionRows) {
    const symbols = new Set(extractSymbols(regression.latex));
    const referencedColumns = group.tables.flatMap((table) =>
      table.columns.filter((column) => symbols.has(canonicalSymbol(column.latex))));
    if (referencedColumns.length < 2) continue;
    const physicalRows = Math.max(...referencedColumns.map((column) => column.values.length));
    const pairedRows = Array.from({ length: physicalRows }, (_, rowIndex) =>
      referencedColumns.every((column) => (column.values[rowIndex] ?? "").trim().length > 0))
      .filter(Boolean).length;
    if (!pairedRows) {
      failures.push({ ...group, reason: "regression table has no fully populated paired rows" });
    }
  }
  return failures;
};

const loadDesmosSource = async () => {
  if (fs.existsSync(DESMOS_CACHE_PATH)) {
    const cached = fs.readFileSync(DESMOS_CACHE_PATH, "utf8");
    if (cached.includes("Desmos")) return cached;
  }

  const response = await fetch(DESMOS_SRC);
  if (!response.ok) throw new Error(`Failed to fetch Desmos API: ${response.status}`);
  const source = await response.text();
  fs.writeFileSync(DESMOS_CACHE_PATH, source);
  return source;
};

const normalizedMathText = (value) => String(value ?? "")
  .replace(/\\(?:left|right)/g, "")
  .replace(/\s+/g, "")
  .trim();

const normalizedLabelText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const validateInDesmos = async (groups, initialFailures = []) => {
  const failures = [...initialFailures, ...groups.flatMap(staticGroupFailures)];
  if (!groups.length) return failures;
  const desmosSource = (await loadDesmosSource()).replaceAll("</script", "<\\/script");
  const launchBrowser = () => puppeteer.launch({
    headless: "new",
    protocolTimeout: 300000,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const failedGroups = new Set(failures.map((failure) => `${failure.file}:${failure.location}`));
  const runtimeGroups = groups.filter((group) => !failedGroups.has(`${group.file}:${group.location}`));

  for (let chunkStart = 0; chunkStart < runtimeGroups.length; chunkStart += groupsPerPage) {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(120000);
      page.setDefaultNavigationTimeout(120000);
      const browserErrors = [];
      page.on("pageerror", (error) => browserErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(message.text());
      });

      await page.setContent(
        `<!doctype html><html><head><meta charset="utf-8"><script>${desmosSource}</script></head><body><div id="calculator" style="width:800px;height:600px"></div></body></html>`,
        { waitUntil: "load", timeout: 120000 },
      );
      await page.waitForFunction(() => Boolean(window.Desmos), { timeout: 120000 });

      await page.evaluate(() => {
        window.calculator = window.Desmos.GraphingCalculator(document.getElementById("calculator"), {
          graphpaper: true,
          expressions: true,
          expressionsTopbar: false,
          settingsMenu: false,
          zoomButtons: false,
          border: false,
        });
      });

      for (const group of runtimeGroups.slice(chunkStart, chunkStart + groupsPerPage)) {
        let result;
        try {
          result = await page.evaluate(async (config) => {
            const calc = window.calculator;
            const waitFor = async (predicate, timeout = 2500) => {
              const start = performance.now();
              while (performance.now() - start < timeout) {
                if (predicate()) return true;
                await new Promise((resolve) => setTimeout(resolve, 25));
              }
              return false;
            };
            const existingIds = calc.getExpressions?.().map((item) => item.id).filter(Boolean) ?? [];
            calc.removeExpressions?.(existingIds.map((id) => ({ id })));
            calc.updateSettings?.({
              graphpaper: config.showGraphpaper,
              degreeMode: config.degreeMode,
              defaultLogModeRegressions: config.defaultLogModeRegressions,
            });
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

            const tableStates = config.tables.map((table, tableIndex) => ({
              id: `table-${tableIndex}`,
              type: "table",
              columns: table.columns.map((column) => ({ latex: column.latex, values: column.values })),
            }));
            const expressionStates = config.expressions.map((expression, expressionIndex) => ({
              id: expression.id ?? `expr-${expressionIndex}`,
              latex: expression.latex,
              ...(expression.color !== undefined ? { color: expression.color } : {}),
              ...((expression.label?.trim() || expression.showLabel === true)
                ? { label: expression.label?.trim() ? expression.label : expression.latex }
                : {}),
              ...(expression.showLabel !== undefined ? { showLabel: expression.showLabel } : {}),
              ...(expression.hidden !== undefined ? { hidden: expression.hidden } : {}),
              ...(expression.sliderBounds !== undefined ? { sliderBounds: expression.sliderBounds } : {}),
              ...(expression.playing !== undefined ? { playing: expression.playing } : {}),
            }));
            calc.setExpressions(tableStates);
            calc.setExpressions(expressionStates);

            let appliedBounds = config.bounds;
            if (config.bounds && config.preserveSquareUnits) {
              const element = document.getElementById("calculator");
              const graphpaper = element.querySelector(".dcg-graph-inner");
              const width = graphpaper?.clientWidth ?? element.clientWidth;
              const height = graphpaper?.clientHeight ?? element.clientHeight;
              if (width > 0 && height > 0) {
                const centerX = (config.bounds.left + config.bounds.right) / 2;
                const centerY = (config.bounds.bottom + config.bounds.top) / 2;
                let rangeX = config.bounds.right - config.bounds.left;
                let rangeY = config.bounds.top - config.bounds.bottom;
                const targetRatio = width / height;
                if (rangeX / rangeY < targetRatio) rangeX = rangeY * targetRatio;
                else rangeY = rangeX / targetRatio;
                appliedBounds = {
                  left: centerX - rangeX / 2,
                  right: centerX + rangeX / 2,
                  bottom: centerY - rangeY / 2,
                  top: centerY + rangeY / 2,
                };
              }
            }
            if (appliedBounds) calc.setMathBounds(appliedBounds);

            const expectedIds = expressionStates.map((expression) => expression.id);
            await waitFor(() => expectedIds.every((id) => calc.expressionAnalysis?.[id]));
            const helpers = config.regressionParameters.map((parameter) => ({
              parameter,
              helper: calc.HelperExpression({ latex: parameter }),
            }));
            if (helpers.length) {
              await waitFor(() => helpers.every(({ helper }) => Number.isFinite(helper.numericValue)));
            }
            await new Promise((resolve) => setTimeout(resolve, 80));

            const analysis = Object.fromEntries(expectedIds.map((id) => {
              const value = calc.expressionAnalysis?.[id];
              const evaluation = value?.evaluation;
              return [id, {
                present: Boolean(value),
                isError: Boolean(value?.isError),
                errorMessage: typeof value?.errorMessage === "string" ? value.errorMessage : "",
                evaluation: evaluation ? { type: evaluation.type, value: evaluation.value } : null,
              }];
            }));
            const publicExpressionStates = new Map(
              (calc.getExpressions?.() ?? []).map((item) => [item.id, item]),
            );
            const renderedExpressionStates = Object.fromEntries(
              (calc.getState?.()?.expressions?.list ?? [])
                .filter((item) => expectedIds.includes(item.id))
                .map((item) => [item.id, {
                  id: item.id,
                  latex: item.latex,
                  color: item.color,
                  label: item.label,
                  showLabel: item.showLabel,
                  hidden: item.hidden,
                  sliderBounds: publicExpressionStates.get(item.id)?.sliderBounds,
                  playing: publicExpressionStates.get(item.id)?.playing,
                }]),
            );
            const regressionOutputs = helpers.map(({ parameter, helper }) => ({
              parameter,
              value: Number.isFinite(helper.numericValue) ? helper.numericValue : null,
            }));
            helpers.forEach(({ helper }) => helper.destroy?.());

            const errorNodes = Array.from(
              document.querySelectorAll(
                ".dcg-expressionitem.dcg-error, .dcg-error, .dcg-invalid, .dcg-icon-error, .dcg-error-message",
              ),
            );
            const visibleErrorText = errorNodes
              .map((node) => node.textContent?.trim())
              .filter(Boolean)
              .join(" ")
              .trim();
            const calculatorText = document.getElementById("calculator")?.textContent ?? "";
            const sliderExpressionIds = Array.from(
              document.querySelectorAll("#calculator .dcg-expressionitem.dcg-hasSlider"),
            )
              .filter((item) => item.querySelector(
                '[aria-label^="Play "][aria-label$=" Animation"], '
                + '[aria-label^="Pause "][aria-label$=" Animation"]',
              ))
              .map((item) => item.getAttribute("expr-id"))
              .filter(Boolean);
            const visibleSliderText = /Add Slider|Add slider/i.test(calculatorText)
              ? "expression prompts for an undefined slider"
              : "";
            const actualBounds = calc.graphpaperBounds?.mathCoordinates ?? null;
            return {
              analysis,
              renderedExpressionStates,
              regressionOutputs,
              visibleErrorText,
              visibleSliderText,
              sliderExpressionIds,
              appliedBounds,
              actualBounds,
            };
          }, group);
        } catch (error) {
          failures.push({ ...group, reason: `runtime error: ${error.name}: ${error.message}` });
          break;
        }

        if (browserErrors.length) {
          failures.push({ ...group, reason: `browser error: ${browserErrors.shift()}` });
          continue;
        }
        if (result.visibleErrorText) {
          failures.push({ ...group, reason: result.visibleErrorText });
          continue;
        }
        if (result.visibleSliderText) {
          failures.push({ ...group, reason: result.visibleSliderText });
          continue;
        }
        const expectedSliderIds = group.expressions.flatMap((expression, expressionIndex) =>
          expression.sliderBounds ? [expression.id ?? `expr-${expressionIndex}`] : []);
        if ([...result.sliderExpressionIds].sort().join("\0") !== [...expectedSliderIds].sort().join("\0")) {
          failures.push({
            ...group,
            reason: `rendered slider rows ${result.sliderExpressionIds.join(",") || "none"}; expected ${expectedSliderIds.join(",") || "none"}`,
          });
          continue;
        }

        group.expressions.forEach((expression, expressionIndex) => {
          const expressionId = expression.id ?? `expr-${expressionIndex}`;
          const actual = result.renderedExpressionStates[expressionId];
          if (!actual) return;
          const metadataErrors = [];
          if (normalizedMathText(actual.latex) !== normalizedMathText(expression.latex)) metadataErrors.push("latex");
          if (expression.color !== undefined && String(actual.color ?? "").toLowerCase() !== expression.color.toLowerCase()) {
            metadataErrors.push("color");
          }
          const actualLabel = normalizedLabelText(actual.label);
          const expectedLabel = expression.label?.trim()
            ? normalizedLabelText(expression.label)
            : expression.showLabel === true
              ? normalizedLabelText(expression.latex)
              : undefined;
          if (actualLabel.toLowerCase() === "undefined") metadataErrors.push("literal undefined label");
          if (expectedLabel !== undefined && actualLabel !== expectedLabel) metadataErrors.push("label");
          if (expression.showLabel !== undefined && Boolean(actual.showLabel) !== expression.showLabel) {
            metadataErrors.push("showLabel");
          }
          if (expression.hidden !== undefined && Boolean(actual.hidden) !== expression.hidden) metadataErrors.push("hidden");
          if (expression.sliderBounds !== undefined && ["min", "max", "step"].some((key) =>
            normalizedMathText(actual.sliderBounds?.[key]) !== normalizedMathText(expression.sliderBounds[key]))) {
            metadataErrors.push("sliderBounds");
          }
          if (expression.playing !== undefined && Boolean(actual.playing) !== expression.playing) {
            metadataErrors.push("playing");
          }
          if (metadataErrors.length) {
            failures.push({
              ...group,
              expressionId,
              reason: `rendered expression metadata mismatch: ${metadataErrors.join(", ")}`,
            });
          }
        });

        for (const [expressionId, analysis] of Object.entries(result.analysis)) {
          if (!analysis.present) {
            failures.push({ ...group, expressionId, reason: "Desmos expressionAnalysis did not resolve" });
          } else if (analysis.isError) {
            failures.push({ ...group, expressionId, reason: analysis.errorMessage || "Desmos expression analysis error" });
          } else if (analysis.evaluation) {
            const values = Array.isArray(analysis.evaluation.value)
              ? analysis.evaluation.value
              : [analysis.evaluation.value];
            if (values.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
              failures.push({ ...group, expressionId, reason: "expression evaluation is not finite" });
            }
          }
        }
        for (const output of result.regressionOutputs) {
          if (!Number.isFinite(output.value)) {
            failures.push({ ...group, parameter: output.parameter, reason: "regression parameter did not resolve to a finite value" });
          }
        }
        if (result.appliedBounds && result.actualBounds) {
          const tolerance = Math.max(
            result.appliedBounds.right - result.appliedBounds.left,
            result.appliedBounds.top - result.appliedBounds.bottom,
          ) * 0.01;
          if (
            result.actualBounds.left > result.appliedBounds.left + tolerance ||
            result.actualBounds.right < result.appliedBounds.right - tolerance ||
            result.actualBounds.bottom > result.appliedBounds.bottom + tolerance ||
            result.actualBounds.top < result.appliedBounds.top - tolerance
          ) {
            failures.push({ ...group, reason: "applied viewport does not contain the authored bounds" });
          }
        }
      }
    } finally {
      await browser.close().catch(() => undefined);
    }
  }

  return failures;
};

const extraction = extractConfigGroups();
const groups = extraction.groups;
const checkedExpressions = groups.reduce((total, group) => total + group.expressions.length, 0);
const checkedTables = groups.reduce((total, group) => total + group.tables.length, 0);
const checkedRegressionRows = groups.reduce(
  (total, group) => total + group.expressions.filter((expression) => /(?:\\sim|~)/.test(expression.latex)).length,
  0,
);
const failures = await validateInDesmos(groups, extraction.failures);
const summary = {
  canonicalMathQuestions: canonicalMathIds.size,
  checkedGroups: groups.length,
  checkedExpressions,
  checkedTables,
  checkedRegressionRows,
  includeOrphans,
  requestedIds: [...requestedIds],
  failures: failures.length,
};

console.log(JSON.stringify({ summary, failures: failures.slice(0, MAX_ERROR_OUTPUT) }, null, 2));

if (failures.length) process.exitCode = 1;
