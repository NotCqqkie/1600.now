import { spawn } from "node:child_process";
import fs from "node:fs";

const slicePath = "tmp/audit-slices/explanations-3.json";
const port = Number.parseInt(process.argv.find((arg) => arg.startsWith("--port="))?.split("=")[1] ?? "5194", 10);
const baseUrl = `http://127.0.0.1:${port}`;

const asRecord = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : null;
const asString = (value) => typeof value === "string" ? value : undefined;
const asStringArray = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];

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
    steps,
  };
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const startVite = async () => {
  const child = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, BROWSER: "none" },
  });
  let recent = "";
  child.stdout.on("data", (chunk) => recent = `${recent}${chunk.toString()}`.slice(-4000));
  child.stderr.on("data", (chunk) => recent = `${recent}${chunk.toString()}`.slice(-4000));
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite exited early: ${recent}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return child;
    } catch {}
    await wait(250);
  }
  child.kill("SIGTERM");
  throw new Error(`Timed out waiting for ${baseUrl}: ${recent}`);
};

const stopVite = async (child) => {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await wait(500);
  if (child.exitCode === null) child.kill("SIGKILL");
};

const rawDollarMathInText = (text) => {
  const hits = [];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== "$") continue;
    const close = text.indexOf("$", i + 1);
    if (close === -1) continue;
    const body = text.slice(i + 1, close).trim();
    const before = text.slice(Math.max(0, i - 20), i);
    const after = text.slice(close + 1, close + 21);
    const proseCurrency =
      /^\d[\d,.]*(?:\.\d+)?(?:\s*(?:per|each|total|million|billion|thousand|dollars?|cents?|percent|%|B|M|K))?\b/i.test(body) &&
      !/[=<>^_{}\\]|[A-Za-z]\s*[+*/=-]|[+*/=-]\s*[A-Za-z]/.test(body);
    if (!proseCurrency && /[=<>^_{}\\]|[A-Za-z]\s*[+*/=-]|[+*/=-]\s*[A-Za-z]|\d\s*[A-Za-z(]|\d\s*[+*/-]\s*\d/.test(body)) {
      hits.push(`${before}$${body}$${after}`.replace(/\s+/g, " "));
    }
    i = close;
  }
  return hits;
};

const slice = JSON.parse(fs.readFileSync(slicePath, "utf8")).map((entry) => entry.file || entry.path || entry);
const records = slice.map((file) => ({
  file,
  data: normalizeExplanation(JSON.parse(fs.readFileSync(file, "utf8"))),
}));

const puppeteer = await import("puppeteer");
const vite = await startVite();
const browser = await puppeteer.default.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const issues = [];
try {
  const page = await browser.newPage();
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto(baseUrl, { waitUntil: "networkidle0" });
  const renderIssues = await page.evaluate(({ records }) => {
    return import("/src/lib/text/mathRendering.ts").then(({ renderMixedContent }) => {
      const parser = new DOMParser();
      const textFromHtml = (html) => {
        const document = parser.parseFromString(`<div>${html}</div>`, "text/html");
        document.querySelectorAll(".katex-mathml").forEach((node) => node.remove());
        document.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
        return (document.body.textContent ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      };
      const cleanStepContent = (raw) => {
        let s = typeof raw === "string" ? raw : "";
        s = s.replace(/<think>[\s\S]*?<\/think>/gi, "");
        s = s.replace(/<\/?think>/gi, "");
        s = s.replace(/(?:^|\n)>\s*(?:Reasoning|Think|Note to self|Internal)[^\n]*/gi, "");
        s = s.replace(/\*\*(?:Reasoning|Internal note)\*\*:?[^\n]*/gi, "");
        s = s.replace(/\s*[—–-]+\s*<strong>[A-Z]<\/strong>\s+is\s+(?:correct|the\s+answer|right)\.?/gi, ".");
        s = s.replace(/\s*[—–-]+\s*[A-Z]\s+is\s+(?:correct|the\s+answer|right)\.?/g, ".");
        s = s.replace(/(<\/strong>)\s*[—–-]+\s*[^<.]{1,30}?\s+is\s+(?:correct|the\s+answer|right)\.?/gi, "$1.");
        s = s.replace(/\b(matches\s+choice\s+)([A-Z])\b(?!<\/strong>)/gi, "$1<strong>$2</strong>");
        return s.trim();
      };
      const rawDollarMathInText = (text) => {
        const hits = [];
        for (let i = 0; i < text.length; i += 1) {
          if (text[i] !== "$") continue;
          const close = text.indexOf("$", i + 1);
          if (close === -1) continue;
          const body = text.slice(i + 1, close).trim();
          const before = text.slice(Math.max(0, i - 20), i);
          const after = text.slice(close + 1, close + 21);
          const proseCurrency =
            /^\d[\d,.]*(?:\.\d+)?(?:\s*(?:per|each|total|million|billion|thousand|dollars?|cents?|percent|%|B|M|K))?\b/i.test(body) &&
            !/[=<>^_{}\\]|[A-Za-z]\s*[+*/=-]|[+*/=-]\s*[A-Za-z]/.test(body);
          if (!proseCurrency && /[=<>^_{}\\]|[A-Za-z]\s*[+*/=-]|[+*/=-]\s*[A-Za-z]|\d\s*[A-Za-z(]|\d\s*[+*/-]\s*\d/.test(body)) {
            hits.push(`${before}$${body}$${after}`.replace(/\s+/g, " "));
          }
          i = close;
        }
        return hits;
      };
      const issues = [];
      for (const record of records) {
        const explanation = record.data;
        if (!explanation) {
          issues.push({ file: record.file, type: "unusable explanation data", field: "record", excerpt: "" });
          continue;
        }
        explanation.steps.forEach((step, index) => {
          const fields = [
            ["title", step.title],
            ["content", cleanStepContent(step.content)],
            ["formula", step.formula],
          ];
          for (const [field, value] of fields) {
            if (!value) continue;
            const html = renderMixedContent(value, { convertTexLineBreaks: false });
            const text = textFromHtml(html);
            if (/\bkatex-error\b/i.test(html)) {
              issues.push({ file: record.file, type: "KaTeX render error", field: `steps[${index}].${field}`, excerpt: text.slice(0, 240) });
            }
            const rawHits = rawDollarMathInText(text);
            for (const hit of rawHits) {
              issues.push({ file: record.file, type: "visible raw dollar math after render", field: `steps[${index}].${field}`, excerpt: hit.slice(0, 240) });
            }
            if (/&(?:lt|gt|deg|amp|quot|apos|nbsp);/i.test(text)) {
              issues.push({ file: record.file, type: "visible html entity after render", field: `steps[${index}].${field}`, excerpt: text.slice(0, 240) });
            }
          }
        });
      }
      return issues;
    });
  }, { records });
  issues.push(...renderIssues);
  for (const error of browserErrors) issues.push({ file: "", type: "browser error", field: "browser", excerpt: error });
} finally {
  await browser.close();
  await stopVite(vite);
}

const grouped = issues.reduce((acc, issue) => {
  acc[issue.type] = (acc[issue.type] ?? 0) + 1;
  return acc;
}, {});

console.log(JSON.stringify({
  checked: records.length,
  issueCount: issues.length,
  grouped,
  issues,
}, null, 2));

if (issues.length) process.exitCode = 1;
