import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import puppeteer from "puppeteer";

const ROOT = process.cwd();
const EXPLANATION_DIR = path.join(ROOT, "public", "explanations");
const DESMOS_SRC = "https://www.desmos.com/api/v1.11/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6";
const DESMOS_CACHE_PATH = path.join(os.tmpdir(), "1600-prep-hub-desmos-calculator-v1.11.js");
const MAX_ERROR_OUTPUT = 200;

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

const limit = args.has("limit") ? Number.parseInt(args.get("limit"), 10) : Number.POSITIVE_INFINITY;
const groupsPerPage = args.has("groups-per-page")
  ? Number.parseInt(args.get("groups-per-page"), 10)
  : 25;

const asRecord = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : null;

const asString = (value) => (typeof value === "string" ? value : undefined);

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

const extractExpressionsFromStep = (step) => {
  const record = asRecord(step);
  if (!record) return [];
  const expressions = asStringArray(record.desmosExpressions);
  if (Array.isArray(record.desmosGraphs)) {
    for (const graph of record.desmosGraphs) {
      const graphRecord = asRecord(graph);
      expressions.push(...asStringArray(graphRecord?.expressions));
    }
  }
  return expressions;
};

const extractExpressionGroups = () => {
  const groups = [];
  for (const fileName of fs.readdirSync(EXPLANATION_DIR).filter((file) => file.endsWith(".json")).sort()) {
    const filePath = path.join(EXPLANATION_DIR, fileName);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      continue;
    }
    if (data?.section && data.section !== "Math") continue;
    const steps = Array.isArray(data.steps) ? data.steps : [];
    steps.forEach((step, stepIndex) => {
      const expressions = extractExpressionsFromStep(step);
      if (expressions.length) groups.push({ file: fileName, stepIndex, expressions });
    });
    const topLevelExpressions = asStringArray(data.desmosExpressions);
    if (topLevelExpressions.length) groups.push({ file: fileName, stepIndex: "top-level", expressions: topLevelExpressions });
  }
  return groups.slice(0, limit);
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

const validateInDesmos = async (groups) => {
  const desmosSource = (await loadDesmosSource()).replaceAll("</script", "<\\/script");
  const launchBrowser = () => puppeteer.launch({
    headless: "new",
    protocolTimeout: 300000,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const failures = [];
  for (let chunkStart = 0; chunkStart < groups.length; chunkStart += groupsPerPage) {
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
          expressions: true,
          expressionsTopbar: false,
          settingsMenu: false,
          zoomButtons: false,
          border: false,
        });
      });

      for (const group of groups.slice(chunkStart, chunkStart + groupsPerPage)) {
        for (const [expressionIndex, expression] of group.expressions.entries()) {
          const staticErrors = staticExpressionErrors(expression);
          if (staticErrors.length) {
            failures.push({ ...group, expressionIndex, expression, reason: staticErrors.join("; ") });
          }
        }
        if (failures.some((failure) => failure.file === group.file && failure.stepIndex === group.stepIndex)) {
          continue;
        }

        let result;
        try {
          result = await page.evaluate(async ({ expressions }) => {
            const calc = window.calculator;
            const existingIds = calc
              .getState?.()
              ?.expressions?.list?.map((item) => item.id)
              .filter(Boolean) ?? [];
            calc.removeExpressions?.(existingIds.map((id) => ({ id })));
            calc.setExpressions(expressions.map((expression, index) => ({ id: `audit-expression-${index}`, latex: expression })));
            await new Promise((resolve) => setTimeout(resolve, 120));
            const state = calc.getState?.();
            const expressionStates = state?.expressions?.list?.filter((item) => String(item.id ?? "").startsWith("audit-expression-")) ?? [];
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
            const visibleSliderText = /Add Slider|Add slider/i.test(calculatorText)
              ? "expression prompts for an undefined slider"
              : "";
            return {
              expressionStates,
              visibleErrorText,
              visibleSliderText,
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
      }
    } finally {
      await browser.close().catch(() => undefined);
    }
  }

  return failures;
};

const groups = extractExpressionGroups();
const checkedExpressions = groups.reduce((total, group) => total + group.expressions.length, 0);
const failures = await validateInDesmos(groups);
const summary = {
  checkedGroups: groups.length,
  checkedExpressions,
  failures: failures.length,
};

console.log(JSON.stringify({ summary, failures: failures.slice(0, MAX_ERROR_OUTPUT) }, null, 2));

if (failures.length) {
  process.exitCode = 1;
}
