#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { collectActivePracticeQuestionKeys } from "./practice-data-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const readJson = (filePath) => JSON.parse(readFileSync(path.join(root, filePath), "utf8"));

const readUnofficialQuestions = () => {
  const text = readFileSync(path.join(root, "src/data/unofficialQuestions.ts"), "utf8");
  const marker = "export const questions: SourceQuestion[] = ";
  const start = text.indexOf(marker);
  if (start === -1) throw new Error("Could not find unofficial question export");
  const arrayStart = start + marker.length;
  const arrayEnd = text.lastIndexOf("];");
  if (arrayEnd === -1) throw new Error("Could not find unofficial question array end");
  return JSON.parse(text.slice(arrayStart, arrayEnd + 1));
};

const readGeneratedMap = (filePath, marker) => {
  const text = readFileSync(path.join(root, filePath), "utf8");
  const start = text.indexOf(marker);
  if (start === -1) throw new Error(`Could not find map export in ${filePath}`);
  const objectStart = start + marker.length;
  let objectEnd = text.indexOf("\n};", objectStart);
  if (objectEnd === -1) objectEnd = text.lastIndexOf("};");
  if (objectEnd === -1) throw new Error(`Could not find map end in ${filePath}`);
  return JSON.parse(text.slice(objectStart, objectEnd + 2));
};

const officialImageMap = readGeneratedMap(
  "src/data/questionImageMap.ts",
  "export const questionImageMap: Record<string, QuestionImageMapEntry> = ",
);

const unofficialImageMap = readGeneratedMap(
  "src/data/unofficialQuestionImageMap.ts",
  "export const questionImageMap: Record<string, UnofficialQuestionImageEntry> = ",
);

const questionImageEntry = (questionId) =>
  officialImageMap[questionId] ?? unofficialImageMap[questionId] ?? null;

const imageHash = (src) => {
  const localPath = path.join(root, "public", decodeURIComponent(src).replace(/^\//, ""));
  if (!existsSync(localPath)) return `missing:${src}`;
  return createHash("sha1").update(readFileSync(localPath)).digest("hex");
};

const imageSignature = (question) => {
  const entry = questionImageEntry(String(question.id));
  if (!entry) return "none";
  const parts = [];
  for (const image of entry.questionImages ?? []) {
    parts.push(`q:${imageHash(image.src)}`);
  }
  for (const [choiceId, src] of Object.entries(entry.choiceImages ?? {}).sort()) {
    parts.push(`${choiceId}:${imageHash(src)}`);
  }
  return parts.join("|") || "none";
};

const choiceHasMappedImage = (questionId, choiceId) =>
  Boolean(questionImageEntry(String(questionId))?.choiceImages?.[choiceId]);

const hasRenderableStem = (question) => Boolean(question.text?.trim() || question.image?.trim());

const looksLikeImageDescription = (text) => {
  if (!text) return false;
  const trimmed = String(text).trim();
  if (!trimmed) return false;
  if (/\$[^$]+\$/.test(trimmed)) return false;
  if (/^\s*•/.test(trimmed)) return true;
  return /(comma\s+(negative\s+)?\d|open parenthesis|close parenthesis|y\s*-\s*intercept|x\s*-\s*intercept|parabola opens|the graph|the line passes through|left to right|quadrant\s+\d)/i.test(trimmed);
};

const hasUnsalvageableChoices = (question) => {
  if (question.type !== "multiple-choice" || !question.choices?.length) return false;
  const anyChoiceImage = question.choices.some((choice) =>
    Boolean(choice.image) || choiceHasMappedImage(question.id, choice.id),
  );
  if (anyChoiceImage) return false;
  return question.choices.every((choice) => !choice.text?.trim() || looksLikeImageDescription(choice.text));
};

const normalizeSubject = (question) => {
  const categorySubject = question.category?.subject;
  if (categorySubject === "Math") return "math";
  if (categorySubject === "English") return "reading";
  const section = (question.section || "").toLowerCase();
  return section === "math" ? "math" : "reading";
};

const bankQuestionKey = (record) =>
  `bank-${record.bankType}-${normalizeSubject(record.question)}-${String(record.question.id)}`;

const decodeEntities = (value) =>
  String(value || "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&mdash;|&#8212;/g, " - ")
    .replace(/&ndash;|&#8211;/g, " - ")
    .replace(/&deg;|&#176;/g, " degrees ");

const stripForNormalize = (value) =>
  decodeEntities(value)
    .replace(/<sup>(.*?)<\/sup>/gi, " ^ $1 ")
    .replace(/<sub>(.*?)<\/sub>/gi, " _ $1 ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\\(?:left|right|displaystyle|mathrm|mathbf|operatorname|emph)\b/g, " ")
    .replace(/\\text\s*\{([^{}]*)\}/g, " $1 ")
    .replace(/\\(?:frac|dfrac|tfrac)\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, " ( $1 ) / ( $2 ) ")
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, " sqrt ( $1 ) ")
    .replace(/\\cdot|\\times/g, " * ")
    .replace(/\\leq?|≤/g, " <= ")
    .replace(/\\geq?|≥/g, " >= ")
    .replace(/\\neq|≠/g, " != ")
    .replace(/\\approx|≈/g, " ~= ")
    .replace(/\\angle/g, " angle ")
    .replace(/\\triangle/g, " triangle ")
    .replace(/\\circ/g, " degrees ")
    .replace(/\\pi/g, " pi ")
    .replace(/\\(?:sin|cos|tan)\b/g, (match) => match.slice(1))
    .replace(/[{}_$]/g, " ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, " ");

const fullQuestionText = (question) => {
  const choices = Array.isArray(question.choices)
    ? ` ${question.choices.map((choice) => choice.text || "").join(" ")}`
    : "";
  return `${question.text || ""}${choices}`;
};

const STOP_WORDS = new Set(
  "a an and are as at be by can choice does each for from given has have if in is it its let of on or represents shown that the then this to value what where which with was were will would most best one two three four five six seven eight nine ten into shape measure measures answer choices following text question based according student wants use uses information relevant effective effectively while research researching topic notes taken complete completes logical precise word phrase of".split(/\s+/),
);

const tolerantTemplateSignature = (question) => {
  let text = stripForNormalize(fullQuestionText(question)).toLowerCase().replace(/[−–—]/g, "-");
  text = text.replace(/(?<![a-z])[-+]?\d[\d,]*(?:\.\d+)?(?:\s*\/\s*[-+]?\d[\d,]*(?:\.\d+)?)?/g, " # ");
  text = text.replace(/([=+\-*\/^()<>!~])/g, " $1 ");
  text = text.replace(/[^a-z0-9#=+\-*\/^()<>!~]+/g, " ");
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((token) => token && !STOP_WORDS.has(token))
    .join(" ");
};

const activePracticeQuestionKeys = collectActivePracticeQuestionKeys(root);

const keepPriority = (record) => [
  record.bankType === "past" ? 0 : 1,
  record.question.inPracticeTests === true ||
  activePracticeQuestionKeys.has(`${record.bankType}:${normalizeSubject(record.question)}:${String(record.question.id)}`)
    ? 0
    : 1,
  String(record.question.id),
];

const compareRecords = (left, right) => {
  const leftPriority = keepPriority(left);
  const rightPriority = keepPriority(right);
  for (let i = 0; i < leftPriority.length; i += 1) {
    const leftValue = leftPriority[i];
    const rightValue = rightPriority[i];
    if (leftValue === rightValue) continue;
    if (typeof leftValue === "number" && typeof rightValue === "number") return leftValue - rightValue;
    return String(leftValue).localeCompare(String(rightValue));
  }
  return 0;
};

const sourceRecords = [
  ...readUnofficialQuestions().map((question) => ({ bankType: "unofficial", question })),
  ...readJson("src/data/questions/math_past.json").map((question) => ({ bankType: "past", question })),
  ...readJson("src/data/questions/reading_past.json").map((question) => ({ bankType: "past", question })),
].filter(({ question }) => hasRenderableStem(question) && !hasUnsalvageableChoices(question));

const buckets = new Map();
for (const record of sourceRecords) {
  const key = [
    normalizeSubject(record.question),
    record.question.type || "unknown",
    tolerantTemplateSignature(record.question),
  ].join("\u001f");
  if (!key || key.length < 20) continue;
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push(record);
}

const hiddenIds = new Set();
let safeClusterCount = 0;
let safeClusterMemberCount = 0;

for (const records of buckets.values()) {
  if (records.length < 2) continue;
  const imageSignatures = new Set(records.map((record) => imageSignature(record.question)));
  if (imageSignatures.size !== 1) continue;

  safeClusterCount += 1;
  safeClusterMemberCount += records.length;

  const [, ...hide] = [...records].sort(compareRecords);
  for (const record of hide) hiddenIds.add(bankQuestionKey(record));
}

const sortedHiddenIds = [...hiddenIds].sort();
const outputPath = path.join(root, "src/lib/generated/hiddenBankQuestions.generated.ts");
const output = `// AUTO-GENERATED by scripts/generate-hidden-bank-questions.mjs — do not edit.

export const hiddenBankQuestionCoverage = ${JSON.stringify(
  {
    policy: "text-template tolerant duplicate clusters with identical image signatures; keep one representative",
    hiddenCount: sortedHiddenIds.length,
    duplicateClusterCount: safeClusterCount,
    duplicateClusterMemberCount: safeClusterMemberCount,
  },
  null,
  2,
)} as const;

export const HIDDEN_BANK_QUESTION_IDS = ${JSON.stringify(sortedHiddenIds, null, 2)} as const;
`;

writeFileSync(outputPath, output);

console.log(
  `generate-hidden-bank-questions: hid ${sortedHiddenIds.length} bank questions ` +
    `from ${safeClusterCount} duplicate clusters`,
);
