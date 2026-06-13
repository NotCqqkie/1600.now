import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const slicePath = "tmp/audit-slices/bank-3.json";
const sourcePath = "src/data/questions/reading_past.json";
const port = Number.parseInt(process.argv.find((arg) => arg.startsWith("--port="))?.split("=")[1] ?? "5193", 10);
const baseUrl = `http://127.0.0.1:${port}`;

const slice = JSON.parse(fs.readFileSync(slicePath, "utf8"));
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const ownedIds = new Set(slice.map((entry) => entry.id));
const issues = [];

const add = (entry, type, field, excerpt = "") => {
  issues.push({
    id: entry.id,
    index: entry.index,
    type,
    field,
    excerpt: String(excerpt ?? "").replace(/\s+/g, " ").slice(0, 260),
  });
};

const unescapedDollarCount = (value) => {
  let count = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "$") continue;
    let slashCount = 0;
    for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
      slashCount += 1;
    }
    if (slashCount % 2 === 0) count += 1;
  }
  return count;
};

const duplicateLongFragment = (value) => {
  const chunks = value
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.split(/\s+/).length >= 8);
  const seen = new Set();
  for (const chunk of chunks) {
    if (seen.has(chunk)) return chunk;
    seen.add(chunk);
  }
  return "";
};

const hasRawComparatorInMath = (value) =>
  /\$[^$]*(?:<|>)[^$]*\$/.test(value);

const hasPunctuationGluedToNextToken = (value) =>
  /(?:[a-z0-9]\.(?=[A-Z][a-z])|;(?=[a-zA-Z])|,(?=[a-z])|:(?=[A-Za-z]))/.test(value);

const fieldChecks = (entry, field, value) => {
  if (typeof value !== "string") {
    add(entry, "non-string field", field, value);
    return;
  }
  if (!value.trim()) add(entry, "blank field", field, value);
  if (value !== value.trim()) add(entry, "leading/trailing field whitespace", field, value);
  if (/\r/.test(value)) add(entry, "carriage return", field, value);
  if (/\t/.test(value)) add(entry, "tab character", field, value);
  if (/�/.test(value)) add(entry, "replacement character", field, value);
  if (unescapedDollarCount(value) % 2 === 1) add(entry, "unmatched dollar delimiter", field, value);
  if (/\\\(|\\\)|\\\[|\\\]/.test(value)) add(entry, "raw TeX delimiter", field, value);
  if (/\\(?:frac|sqrt|left|right|text|begin|end|cdot|times|div|le|ge|neq|approx|pi|theta)\b/.test(value)) {
    add(entry, "raw LaTeX command in reading field", field, value);
  }
  if (hasRawComparatorInMath(value)) add(entry, "raw comparator inside dollar math", field, value);
  if (/<\/?b\b[^>]*>/i.test(value)) add(entry, "unsupported <b> tag", field, value);
  if (/<\/?m(?:ath|row|frac|sqrt|n|i|o|sup|sub|table|tr|td)\b[^>]*>/i.test(value)) add(entry, "MathML fragment", field, value);
  if (/<(?!\/?(?:em|strong|u|table|thead|tbody|tfoot|tr|td|th|colgroup|col|caption|br|ol|ul|li|p)\b|!--)[^>]*>/.test(value)) {
    add(entry, "unsupported or raw HTML tag", field, value);
  }
  if (/<(?:em|strong|u)\b[^>]*>\s*<\/(?:em|strong|u)>/i.test(value)) add(entry, "empty inline HTML tag", field, value);
  if (/<(?:em|strong|u)\b[^>]*>[^<]*\s<\/(?:em|strong|u)>[A-Za-z0-9]/i.test(value)) {
    add(entry, "inline HTML swallowed following space", field, value);
  }
  if (/[A-Za-z0-9]<(?:em|strong|u)\b[^>]*>\s[^<]*<\/(?:em|strong|u)>/i.test(value)) {
    add(entry, "inline HTML swallowed preceding space", field, value);
  }
  if (/[A-Za-z0-9]<(?:em|strong|u)\b[^>]*>[^<]/i.test(value)) add(entry, "inline tag glued to previous token", field, value);
  if (/<\/(?:em|strong|u)>[A-Za-z0-9]/i.test(value)) add(entry, "inline tag glued to next token", field, value);
  if (/conversations of Standard English/i.test(value)) add(entry, "Standard English typo", field, value);
  if (hasPunctuationGluedToNextToken(value)) add(entry, "punctuation glued to next token", field, value);
  if (/\b[A-Z]\d+_\d+\b/.test(value)) add(entry, "artifact id with underscore", field, value);
  if (/\b(?:question id|answer explanation|correct answer:|choice [A-D]:|option [A-D]:|difficulty:|domain:|skill:)\b/i.test(value)) {
    add(entry, "extraction metadata text", field, value);
  }
  const duplicate = duplicateLongFragment(value);
  if (duplicate) add(entry, "duplicate prompt fragment", field, duplicate);
};

for (const entry of slice) {
  const q = source[entry.index];
  if (!q) {
    add(entry, "missing source record at slice index", "record");
    continue;
  }
  if (q.id !== entry.id) add(entry, "slice/source id mismatch", "id", `${q.id} !== ${entry.id}`);
  if (q.type !== "multiple-choice") add(entry, "wrong type", "type", q.type);
  if (!["A", "B", "C", "D"].includes(q.correctAnswer)) add(entry, "bad correctAnswer", "correctAnswer", q.correctAnswer);
  fieldChecks(entry, "text", q.text);
  if (!Array.isArray(q.choices) || q.choices.length !== 4) add(entry, "bad choices array", "choices", q.choices?.length);
  const choiceIds = new Set();
  const exactChoiceTexts = new Map();
  for (const choice of q.choices ?? []) {
    if (!choice || typeof choice !== "object") {
      add(entry, "malformed choice", "choices", choice);
      continue;
    }
    if (!["A", "B", "C", "D"].includes(choice.id)) add(entry, "bad choice id", "choices", choice.id);
    if (choiceIds.has(choice.id)) add(entry, "duplicate choice id", "choices", choice.id);
    choiceIds.add(choice.id);
    if (typeof choice.text !== "string" || !choice.text.trim()) add(entry, "missing choice text", `choice ${choice.id}`, choice.text);
    else fieldChecks(entry, `choice ${choice.id}`, choice.text);
    if (choice.image) add(entry, "unexpected source choice image", `choice ${choice.id}`, choice.image);
    const normalizedChoiceText = typeof choice.text === "string"
      ? choice.text.replace(/\s+/g, " ").trim().toLowerCase()
      : "";
    if (normalizedChoiceText && !/\d/.test(normalizedChoiceText)) {
      const previous = exactChoiceTexts.get(normalizedChoiceText);
      if (previous) add(entry, "duplicate nonnumeric choice text", `choice ${choice.id}`, `${previous}/${choice.id}: ${choice.text}`);
      exactChoiceTexts.set(normalizedChoiceText, choice.id);
    }
  }
  if (q.correctAnswer && !choiceIds.has(q.correctAnswer)) add(entry, "correctAnswer not present in choices", "correctAnswer", q.correctAnswer);
  if (q.image) add(entry, "unexpected source question image", "image", q.image);
}

const publicFiles = new Set();
const collectPublic = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) collectPublic(full);
    else publicFiles.add(`/${full.replace(/^public\//, "")}`);
  }
};
collectPublic("public/images");

const questionImageMapText = fs.existsSync("src/data/questionImageMap.ts")
  ? fs.readFileSync("src/data/questionImageMap.ts", "utf8")
  : "";
for (const entry of slice) {
  const idIndex = questionImageMapText.indexOf(JSON.stringify(entry.id));
  if (idIndex === -1) continue;
  const blockEnd = questionImageMapText.indexOf("\n  },", idIndex);
  const block = questionImageMapText.slice(idIndex, blockEnd === -1 ? idIndex + 2000 : blockEnd);
  for (const match of block.matchAll(/"src":\s*"([^"]+)"/g)) {
    const decoded = decodeURIComponent(match[1]).replace(/^\/images\/SAT-Style Questions\//, "/images/SAT-Style Questions/");
    if (!publicFiles.has(decoded)) add(entry, "missing supplemental image asset", "questionImageMap", match[1]);
  }
}

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

const runRenderAudit = async () => {
  const puppeteer = await import("puppeteer");
  const vite = await startVite();
  const browser = await puppeteer.default.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    await page.goto(baseUrl, { waitUntil: "networkidle0" });
    const renderResult = await page.evaluate(async ({ ownedIds }) => {
      const [{ loadAllSourceBankQuestions }, { renderMixedContent }, { normalizeReadingDisplayText }] = await Promise.all([
        import("/src/data/questionBank.ts"),
        import("/src/lib/text/mathRendering.ts"),
        import("/src/lib/text/readingTextNormalization.ts"),
      ]);
      const owned = new Set(ownedIds);
      const questions = (await loadAllSourceBankQuestions("reading", "past")).filter((q) => owned.has(q.sourceId));
      const parser = new DOMParser();
      const textFromHtml = (html) => {
        const document = parser.parseFromString(`<div>${html}</div>`, "text/html");
        document.querySelectorAll(".katex-mathml").forEach((node) => node.remove());
        document.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
        return (document.body.textContent ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      };
      const rawDollarMath = (text) => {
        let cursor = 0;
        while (cursor < text.length) {
          if (text[cursor] !== "$") {
            cursor += 1;
            continue;
          }
          const closing = text.indexOf("$", cursor + 1);
          if (closing === -1) return false;
          const candidate = text.slice(cursor + 1, closing).trim();
          const startsCurrency = /\d/.test(text[cursor + 1] ?? "");
          const proseWords = candidate.match(/[A-Za-z]{3,}/g) ?? [];
          if (startsCurrency && proseWords.length > 0) {
            cursor = closing + 1;
            continue;
          }
          if (/\\|[=<>^_{}]|\d+\s*[+*/-]\s*\d+/.test(candidate)) return true;
          cursor = closing + 1;
        }
        return false;
      };
      const renderIssues = [];
      const auditField = (question, field, value) => {
        if (!value) return;
        const html = renderMixedContent(normalizeReadingDisplayText(value), { normalizeMath: false });
        const text = textFromHtml(html);
        if (/\bkatex-error\b/i.test(html)) renderIssues.push({ id: question.sourceId, field, type: "KaTeX render error", excerpt: text });
        if (rawDollarMath(text)) renderIssues.push({ id: question.sourceId, field, type: "visible raw dollar math after render", excerpt: text });
        if (/&(?:lt|gt|amp|quot|apos|nbsp);/i.test(text)) renderIssues.push({ id: question.sourceId, field, type: "visible escaped HTML entity after render", excerpt: text });
        if (/\b[A-Z]\d+(?:<em>|<i>|_)\d+\b/i.test(html) || /\b[A-Z]\d+\s+\d+\b/.test(text)) {
          renderIssues.push({ id: question.sourceId, field, type: "artifact id emphasis/render mutation", excerpt: html });
        }
      };
      for (const question of questions) {
        auditField(question, "prompt", question.prompt);
        auditField(question, "passage", question.passage);
        auditField(question, "questionText", question.questionText);
        for (const choice of question.choices ?? []) auditField(question, `choice ${choice.id}`, choice.text);
      }
      return {
        loadedOwnedQuestions: questions.length,
        missingIds: ownedIds.filter((id) => !questions.some((q) => q.sourceId === id)),
        renderIssues,
      };
    }, { ownedIds: [...ownedIds] });
    renderResult.browserErrors = browserErrors;
    return renderResult;
  } finally {
    await browser.close();
    await stopVite(vite);
  }
};

const renderResult = await runRenderAudit();
for (const issue of renderResult.renderIssues) {
  const entry = slice.find((item) => item.id === issue.id) ?? { id: issue.id, index: null };
  add(entry, issue.type, issue.field, issue.excerpt);
}
for (const error of renderResult.browserErrors ?? []) {
  issues.push({ id: "", index: null, type: "browser error", field: "browser", excerpt: error });
}
if (renderResult.loadedOwnedQuestions !== ownedIds.size) {
  issues.push({
    id: "",
    index: null,
    type: "loadAllSourceBankQuestions missing owned records",
    field: "loader",
    excerpt: JSON.stringify(renderResult),
  });
}

const byType = new Map();
for (const issue of issues) byType.set(issue.type, (byType.get(issue.type) ?? 0) + 1);

console.log(JSON.stringify({
  checkedSourceRecords: slice.length,
  loadedViaLoadAllSourceBankQuestions: renderResult.loadedOwnedQuestions,
  issueCount: issues.length,
  issueTypes: Object.fromEntries([...byType.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
  issues,
}, null, 2));

if (issues.length) process.exitCode = 1;
