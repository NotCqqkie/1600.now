import fs from "node:fs";
import path from "node:path";

const slice = JSON.parse(fs.readFileSync("tmp/audit-slices/bank-3.json", "utf8"));
const sources = new Map();
const issues = [];

const sourceFor = (file) => {
  if (!sources.has(file)) {
    sources.set(file, JSON.parse(fs.readFileSync(file, "utf8")));
  }
  return sources.get(file);
};

const add = (entry, type, field, excerpt = "") => {
  issues.push({
    key: entry.key,
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
  const sentences = value
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.split(/\s+/).length >= 8);
  const seen = new Set();
  for (const sentence of sentences) {
    const normalized = sentence.toLowerCase();
    if (seen.has(normalized)) return sentence;
    seen.add(normalized);
  }
  return "";
};

const fieldChecks = (entry, field, value) => {
  if (typeof value !== "string") {
    add(entry, "non-string field", field, value);
    return;
  }
  if (!value.trim()) {
    add(entry, "blank field", field, value);
    return;
  }
  if (value !== value.trim()) add(entry, "leading/trailing field whitespace", field, value);
  if (/\r/.test(value)) add(entry, "carriage return", field, value);
  if (/\t/.test(value)) add(entry, "tab character", field, value);
  if (/�/.test(value)) add(entry, "replacement character", field, value);
  if (/[ \t]+\n/.test(value)) add(entry, "trailing whitespace before newline", field, value);
  if (/\n{4,}/.test(value)) add(entry, "excessive blank lines", field, value);
  if (/\s+(?:[,;:!?]|\.(?!\d))/.test(value)) add(entry, "space before punctuation", field, value);
  if (/\(\s+/.test(value) || /\[\s+/.test(value) || /\{\s+/.test(value)) add(entry, "space after opening punctuation", field, value);
  if (/\s+\)/.test(value) || /\s+\]/.test(value) || /\s+\}/.test(value)) add(entry, "space before closing punctuation", field, value);
  if (/ {3,}/.test(value.replace(/\u00a0/g, " "))) add(entry, "repeated spaces", field, value);
  if (unescapedDollarCount(value) % 2 === 1) add(entry, "unmatched dollar delimiter", field, value);
  if (/\\\(|\\\)|\\\[|\\\]/.test(value)) add(entry, "raw TeX delimiter", field, value);
  if (/\\(?:frac|sqrt|left|right|text|begin|end|cdot|times|div|le|ge|neq|approx|pi|theta)\b/.test(value)) add(entry, "raw LaTeX command in reading field", field, value);
  if (/&(?:lt|gt|amp|quot|apos|nbsp);/i.test(value)) add(entry, "escaped HTML entity", field, value);
  if (/<(?!\/?(?:em|strong|u|table|thead|tbody|tfoot|tr|td|th|colgroup|col|caption|br|ol|ul|li|p)\b|!--)[^>]*>/.test(value)) add(entry, "unsupported or raw HTML tag", field, value);
  for (const tag of ["em", "strong", "u", "table", "tr", "td", "th", "ol", "ul", "li"]) {
    const open = value.match(new RegExp(`<${tag}\\b[^>]*>`, "gi"))?.length ?? 0;
    const close = value.match(new RegExp(`</${tag}>`, "gi"))?.length ?? 0;
    if (open !== close) add(entry, `unbalanced <${tag}> tag`, field, value);
  }
  if (/<(?:em|strong|u)\b[^>]*>\s*<\/(?:em|strong|u)>/i.test(value)) add(entry, "empty inline HTML tag", field, value);
  if (/<(?:em|strong|u)\b[^>]*>[^<]*\s<\/(?:em|strong|u)>[A-Za-z0-9]/i.test(value)) add(entry, "inline HTML swallowed following space", field, value);
  if (/[A-Za-z0-9]<(?:em|strong|u)\b[^>]*>\s[^<]*<\/(?:em|strong|u)>/i.test(value)) add(entry, "inline HTML swallowed preceding space", field, value);
  if (/\b(?:question id|answer explanation|correct answer:|choice [A-D]:|option [A-D]:|difficulty:|domain:|skill:)\b/i.test(value)) add(entry, "extraction metadata text", field, value);
  if (/\b(?:This choice is incorrect because|This choice is correct because)\b/i.test(value)) add(entry, "answer-rationale text in question field", field, value);
  const duplicate = duplicateLongFragment(value);
  if (duplicate) add(entry, "duplicate prompt fragment", field, duplicate);
};

const publicFiles = new Set();
const collectPublic = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) collectPublic(full);
    else publicFiles.add(`/${full.replace(/^public\//, "")}`);
  }
};
collectPublic("public/images");

const mapText = fs.existsSync("src/data/questionImageMap.ts")
  ? fs.readFileSync("src/data/questionImageMap.ts", "utf8")
  : "";

for (const entry of slice) {
  const data = sourceFor(entry.file);
  const q = data[entry.index];
  if (!q) {
    add(entry, "missing source record at slice index", "record", "");
    continue;
  }
  if (q.id !== entry.id) add(entry, "slice/source id mismatch", "id", `${q.id} !== ${entry.id}`);
  if (q.type !== "multiple-choice") add(entry, "incorrect type", "type", q.type);
  if (typeof q.correctAnswer !== "string" || !q.correctAnswer.trim()) add(entry, "missing correctAnswer", "correctAnswer", q.correctAnswer);
  if (q.text === undefined) add(entry, "missing text", "text", "");
  else fieldChecks(entry, "text", q.text);

  if (!Array.isArray(q.choices)) {
    add(entry, "missing choices array", "choices", "");
  } else {
    if (q.choices.length !== 4) add(entry, "choice count is not 4", "choices", q.choices.length);
    const ids = q.choices.map((choice) => choice?.id);
    const idSet = new Set(ids);
    if (idSet.size !== ids.length) add(entry, "duplicate choice id", "choices", ids.join(", "));
    for (const expected of ["A", "B", "C", "D"]) {
      if (!idSet.has(expected)) add(entry, "missing expected choice id", "choices", ids.join(", "));
    }
    if (typeof q.correctAnswer === "string" && q.correctAnswer.trim() && !idSet.has(q.correctAnswer.trim())) {
      add(entry, "correctAnswer not present in choices", "correctAnswer", q.correctAnswer);
    }
    const choiceTexts = new Map();
    for (const choice of q.choices) {
      if (!choice || typeof choice !== "object") {
        add(entry, "malformed choice object", "choices", choice);
        continue;
      }
      if (typeof choice.id !== "string" || !choice.id.trim()) add(entry, "choice missing id", "choices", JSON.stringify(choice));
      if (choice.text === undefined) {
        add(entry, "choice missing text", `choice ${choice.id ?? "?"}`, "");
      } else {
        fieldChecks(entry, `choice ${choice.id ?? "?"}`, choice.text);
        if (/^\s*[A-D][.)]\s+/.test(choice.text)) add(entry, "choice text includes choice label", `choice ${choice.id ?? "?"}`, choice.text);
        const normalizedChoiceText = choice.text.replace(/\s+/g, " ").trim().toLowerCase();
        if (normalizedChoiceText) {
          const previous = choiceTexts.get(normalizedChoiceText);
          if (previous) add(entry, "duplicate choice text", `choice ${choice.id ?? "?"}`, `${previous} and ${choice.id}: ${choice.text}`);
          choiceTexts.set(normalizedChoiceText, choice.id);
        }
      }
      if (choice.image) add(entry, "unexpected source choice image in reading slice", `choice ${choice.id ?? "?"}`, choice.image);
    }
  }

  if (q.image) add(entry, "unexpected source question image in reading slice", "image", q.image);

  const idIndex = mapText.indexOf(JSON.stringify(entry.id));
  if (idIndex !== -1) {
    const blockEnd = mapText.indexOf("\n  },", idIndex);
    const block = mapText.slice(idIndex, blockEnd === -1 ? idIndex + 2000 : blockEnd);
    for (const match of block.matchAll(/"src":\s*"([^"]+)"/g)) {
      const decoded = decodeURIComponent(match[1]).replace(/^\/images\/SAT-Style Questions\//, "/images/SAT-Style Questions/");
      if (!publicFiles.has(decoded)) add(entry, "missing supplemental image asset", "questionImageMap", match[1]);
    }
  }
}

const byType = new Map();
for (const issue of issues) byType.set(issue.type, (byType.get(issue.type) ?? 0) + 1);

console.log(JSON.stringify({
  checked: slice.length,
  issueCount: issues.length,
  issueTypes: Object.fromEntries([...byType.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
  issues,
}, null, 2));

if (issues.length) process.exitCode = 1;
