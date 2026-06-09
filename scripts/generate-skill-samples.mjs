#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const readGeneratedArray = (filePath, marker) => {
  const fullPath = path.join(root, filePath);
  if (!existsSync(fullPath)) return [];
  const text = readFileSync(fullPath, "utf8");
  const start = text.indexOf(marker);
  if (start === -1) return [];
  const arrayStart = start + marker.length;
  const arrayEnd = text.indexOf(" as const", arrayStart);
  if (arrayEnd === -1) return [];
  return JSON.parse(text.slice(arrayStart, arrayEnd));
};

const readGeneratedMap = (filePath, marker) => {
  const text = readFileSync(path.join(root, filePath), "utf8");
  const start = text.indexOf(marker);
  if (start === -1) return {};
  const objectStart = start + marker.length;
  let objectEnd = text.indexOf("\n};", objectStart);
  if (objectEnd === -1) objectEnd = text.lastIndexOf("};");
  if (objectEnd === -1) return {};
  return JSON.parse(text.slice(objectStart, objectEnd + 2));
};

const hiddenBankQuestionIds = new Set(
  readGeneratedArray(
    "src/lib/generated/hiddenBankQuestions.generated.ts",
    "export const HIDDEN_BANK_QUESTION_IDS = ",
  ),
);

const officialImageMap = readGeneratedMap(
  "src/data/questionImageMap.ts",
  "export const questionImageMap: Record<string, QuestionImageMapEntry> = ",
);

const unofficialImageMap = readGeneratedMap(
  "src/data/unofficialQuestionImageMap.ts",
  "export const questionImageMap: Record<string, UnofficialQuestionImageEntry> = ",
);

const SAMPLES_PER_SKILL = 3;
const MAX_TEXT_LEN_READING = 900;
const MAX_TEXT_LEN_MATH = 500;

const skillsSrc = readFileSync(path.join(root, "src/lib/seo-data/satSkillsData.ts"), "utf8");

const skillEntries = [];
{
  const blockRegex = /\{\s*slug:\s*"([^"]+)",[\s\S]*?officialSkill:\s*\n?\s*"([^"]+)",/g;
  for (const m of skillsSrc.matchAll(blockRegex)) {
    skillEntries.push({ slug: m[1], officialSkill: m[2] });
  }
}

const officialSkillNameByKey = Object.fromEntries(
  skillEntries.map(({ officialSkill }) => [officialSkill.trim().toLowerCase(), officialSkill]),
);

if (skillEntries.length === 0) {
  console.error("generate-skill-samples: no skill entries found in satSkillsData.ts");
  process.exit(1);
}

const mathBank = JSON.parse(readFileSync(path.join(root, "src/data/questions/math_past.json"), "utf8"));
const readingBank = JSON.parse(readFileSync(path.join(root, "src/data/questions/reading_past.json"), "utf8"));
const pastQuestionDifficultyMap = JSON.parse(
  readFileSync(path.join(root, "src/data/pastQuestionDifficultyMap.json"), "utf8"),
);
let unofficialQuestions = [];
try {
  const unofficialSrc = readFileSync(path.join(root, "src/data/unofficialQuestions.ts"), "utf8");
  const eqIdx = unofficialSrc.indexOf("=");
  const arrStart = eqIdx >= 0 ? unofficialSrc.indexOf("[", eqIdx) : -1;
  const arrEnd = unofficialSrc.lastIndexOf("]");
  if (arrStart >= 0 && arrEnd > arrStart) {
    unofficialQuestions = JSON.parse(unofficialSrc.slice(arrStart, arrEnd + 1));
  }
} catch (err) {
  console.warn("generate-skill-samples: could not count unofficial bank —", err.message);
}

const imageMapEntry = (questionId) => officialImageMap[questionId] ?? unofficialImageMap[questionId] ?? null;

const choiceHasMappedImage = (questionId, choiceId) =>
  Boolean(imageMapEntry(String(questionId))?.choiceImages?.[choiceId]);

const hasRenderableStem = (question) => Boolean(question.text?.trim() || question.image?.trim());

const looksLikeImageDescription = (text) => {
  if (!text) return false;
  const trimmed = String(text).trim();
  if (!trimmed) return false;
  if (/\$[^$]+\$/.test(trimmed)) return false;
  if (/^\s*•/.test(trimmed)) return true;
  return /(comma\s+(negative\s+)?\d|open parenthesis|close parenthesis|y\s*-\s*intercept|x\s*-\s*intercept|parabola opens|the curve|the graph|the line passes through|left to right|quadrant\s+\d)/i.test(trimmed);
};

const hasUnsalvageableChoices = (question) => {
  if (question.type !== "multiple-choice" || !question.choices?.length) return false;
  const anyChoiceImage = question.choices.some((choice) =>
    Boolean(choice.image) || choiceHasMappedImage(question.id, choice.id),
  );
  if (anyChoiceImage) return false;
  return question.choices.every((choice) => !choice.text?.trim() || looksLikeImageDescription(choice.text));
};

const normalizeSubject = (q) => {
  const categorySubject = q?.category?.subject;
  if (categorySubject === "Math") return "math";
  if (categorySubject === "English") return "reading";
  const section = (q?.section || "").toLowerCase();
  return section === "math" ? "math" : "reading";
};

const stableQuestionId = (bankType, q) =>
  `bank-${bankType}-${normalizeSubject(q)}-${String(q.id)}`;

const isBankVisibleQuestion = (bankType, q) =>
  hasRenderableStem(q) &&
  !hasUnsalvageableChoices(q) &&
  !hiddenBankQuestionIds.has(stableQuestionId(bankType, q));

const visibleMathBank = mathBank.filter((q) => isBankVisibleQuestion("past", q));
const visibleReadingBank = readingBank.filter((q) => isBankVisibleQuestion("past", q));
const visibleUnofficialQuestions = unofficialQuestions.filter((q) => isBankVisibleQuestion("unofficial", q));
const unofficialMathCount = visibleUnofficialQuestions.filter((q) => normalizeSubject(q) === "math").length;
const unofficialReadingCount = visibleUnofficialQuestions.filter((q) => normalizeSubject(q) === "reading").length;

const difficultyRank = { Easy: 0, Medium: 1, Hard: 2 };

const normalizeDifficultyKey = (difficulty) => {
  const normalized = String(difficulty ?? "").trim().toLowerCase();
  if (normalized === "easy" || normalized === "medium" || normalized === "hard") return normalized;
  return null;
};

const normalizeDifficultyLabel = (difficulty) => {
  const normalized = normalizeDifficultyKey(difficulty);
  if (normalized === "easy") return "Easy";
  if (normalized === "medium") return "Medium";
  if (normalized === "hard") return "Hard";
  return null;
};

const getPastQuestionDifficulty = (q) =>
  normalizeDifficultyLabel(pastQuestionDifficultyMap[String(q.id)]) ?? normalizeDifficultyLabel(q.difficulty);
const VISUAL_REFERENCE = /\b(shown|the graph|the figure|the table|scatterplot|histogram|box plot|diagram|pictured|depicted|illustration)\b/i;

function normalizeTextKey(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\d+/g, "#")
    .trim()
    .toLowerCase();
}

function pickSamples(bank, officialSkill, maxLen) {
  const matches = bank.filter(
    (q) =>
      q.skill === officialSkill &&
      q.type === "multiple-choice" &&
      Array.isArray(q.choices) &&
      q.choices.length === 4 &&
      typeof q.text === "string" &&
      q.text.trim().length >= 40 &&
      q.text.length <= maxLen &&
      !VISUAL_REFERENCE.test(q.text) &&
      q.choices.every((c) => typeof c.text === "string" && c.text.trim().length > 0),
  );

  matches.sort((a, b) => {
    const da = difficultyRank[getPastQuestionDifficulty(a)] ?? 3;
    const db = difficultyRank[getPastQuestionDifficulty(b)] ?? 3;
    if (da !== db) return da - db;
    if (a.text.length !== b.text.length) return a.text.length - b.text.length;
    return a.id.localeCompare(b.id);
  });
  const seen = new Set();
  const picked = [];
  for (const q of matches) {
    const key = normalizeTextKey(q.text);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(q);
    if (picked.length >= SAMPLES_PER_SKILL) break;
  }

  return picked.map((q) => ({
    id: q.id,
    difficulty: getPastQuestionDifficulty(q),
    testName: q.testName,
    text: q.text,
    choices: q.choices.map((c) => ({ id: c.id, text: c.text })),
    correctAnswer: q.correctAnswer,
  }));
}

const samplesBySlug = {};
let totalPicked = 0;
let skillsWithoutSamples = 0;

for (const { slug, officialSkill } of skillEntries) {
  const isMath = visibleMathBank.some((q) => q.skill === officialSkill);
  const bank = isMath ? visibleMathBank : visibleReadingBank;
  const maxLen = isMath ? MAX_TEXT_LEN_MATH : MAX_TEXT_LEN_READING;
  const picked = pickSamples(bank, officialSkill, maxLen);
  samplesBySlug[slug] = picked;
  totalPicked += picked.length;
  if (picked.length === 0) skillsWithoutSamples++;
}

const header = `// AUTO-GENERATED by scripts/generate-skill-samples.mjs — do not edit.

export interface SampleChoice {
  id: string;
  text: string;
}

export interface SampleQuestion {
  id: string;
  difficulty: string;
  testName: string;
  text: string;
  choices: SampleChoice[];
  correctAnswer: string;
}

export const skillSampleQuestions: Record<string, SampleQuestion[]> = `;

const body = JSON.stringify(samplesBySlug, null, 2) + ";\n";

writeFileSync(
  path.join(root, "src/lib/generated/skillSampleQuestions.generated.ts"),
  header + body,
);
const skillTotals = {};
for (const q of [...visibleMathBank, ...visibleReadingBank]) {
  if (!q.skill) continue;
  skillTotals[q.skill] = (skillTotals[q.skill] || 0) + 1;
}

const rawAllSkillTotals = {};
for (const q of [...visibleMathBank, ...visibleReadingBank, ...visibleUnofficialQuestions]) {
  const skill = q?.skill ?? q?.category?.skill;
  if (!skill) continue;
  rawAllSkillTotals[skill] = (rawAllSkillTotals[skill] || 0) + 1;
}

const allSkillTotals = {};
for (const [skill, count] of Object.entries(rawAllSkillTotals)) {
  const normalizedSkill = officialSkillNameByKey[String(skill).trim().toLowerCase()] ?? skill;
  allSkillTotals[normalizedSkill] = (allSkillTotals[normalizedSkill] || 0) + count;
}

const totalsHeader = `// AUTO-GENERATED by scripts/generate-skill-samples.mjs — do not edit.

export const BANK_TOTAL_PAST_MATH = ${visibleMathBank.length};
export const BANK_TOTAL_PAST_READING = ${visibleReadingBank.length};
export const BANK_TOTAL_PAST = ${visibleMathBank.length + visibleReadingBank.length};

export const BANK_TOTAL_UNOFFICIAL_MATH = ${unofficialMathCount};
export const BANK_TOTAL_UNOFFICIAL_READING = ${unofficialReadingCount};
export const BANK_TOTAL_UNOFFICIAL = ${unofficialMathCount + unofficialReadingCount};

export const BANK_TOTAL_ALL = ${visibleMathBank.length + visibleReadingBank.length + unofficialMathCount + unofficialReadingCount};

export const BANK_COUNT_BY_OFFICIAL_SKILL: Record<string, number> = `;

writeFileSync(
  path.join(root, "src/lib/generated/bankTotals.generated.ts"),
  totalsHeader +
    JSON.stringify(skillTotals, null, 2) +
    ";\n\nexport const BANK_COUNT_BY_ALL_SKILL: Record<string, number> = " +
    JSON.stringify(allSkillTotals, null, 2) +
    ";\n",
);

const activePastQuestionSourceIds = new Set();
try {
  const moduleDir = path.join(root, "src/data/modules");
  for (const fileName of readdirSync(moduleDir)) {
    if (!fileName.endsWith(".json")) continue;
    const moduleQuestions = JSON.parse(readFileSync(path.join(moduleDir, fileName), "utf8"));
    if (!Array.isArray(moduleQuestions)) continue;
    for (const q of moduleQuestions) {
      if (typeof q?.id === "string" && q.id) activePastQuestionSourceIds.add(q.id);
    }
  }
} catch (err) {
  console.warn("generate-skill-samples: could not collect active module ids —", err.message);
}

const makeBankQuestionMetaRow = (bankType, q) => {
  const subject = normalizeSubject(q);
  const sourceId = String(q.id);
  const domain = q?.category?.domain ?? q.domain ?? "Unassigned";
  const skill = q?.category?.skill ?? q.skill ?? "Unassigned";
  const active = q.inPracticeTests === true || (bankType === "past" && activePastQuestionSourceIds.has(sourceId));
  const bankVisible = isBankVisibleQuestion(bankType, q);
  return [
    `bank-${bankType}-${subject}-${sourceId}`,
    sourceId,
    bankType,
    subject,
    domain,
    skill,
    bankType === "past" ? getPastQuestionDifficulty(q) : normalizeDifficultyLabel(q.difficulty),
    active,
    bankVisible,
  ];
};

const bankQuestionMetaRows = [
  ...mathBank.map((q) => makeBankQuestionMetaRow("past", q)),
  ...readingBank.map((q) => makeBankQuestionMetaRow("past", q)),
  ...unofficialQuestions.map((q) => makeBankQuestionMetaRow("unofficial", q)),
];

const emptyCountSummary = () => ({
  total: 0,
  domains: {},
  skills: {},
  difficulties: { easy: 0, medium: 0, hard: 0 },
});

const makeEmptyCountIndex = () => ({
  math: emptyCountSummary(),
  reading: emptyCountSummary(),
});

const bankCountIndex = {
  past: makeEmptyCountIndex(),
  unofficial: makeEmptyCountIndex(),
  all: makeEmptyCountIndex(),
};

const addCountRow = (summary, row) => {
  const [, , , , domain, skill, difficulty] = row;
  summary.total += 1;
  summary.domains[domain] = (summary.domains[domain] || 0) + 1;
  summary.skills[skill] = (summary.skills[skill] || 0) + 1;
  const difficultyKey = normalizeDifficultyKey(difficulty);
  if (difficultyKey) summary.difficulties[difficultyKey] += 1;
};

for (const row of bankQuestionMetaRows) {
  const [, , bankType, subject] = row;
  const bankVisible = row[8];
  if (!bankVisible) continue;
  addCountRow(bankCountIndex[bankType][subject], row);
  addCountRow(bankCountIndex.all[subject], row);
}

const metadataHeader = `// AUTO-GENERATED by scripts/generate-skill-samples.mjs — do not edit.

export type BankGeneratedSubject = "math" | "reading";
export type BankGeneratedSource = "past" | "unofficial" | "all";
export type BankGeneratedDifficulty = "easy" | "medium" | "hard";
export type BankQuestionMetaRow = readonly [
  stableId: string,
  sourceId: string,
  bankType: Exclude<BankGeneratedSource, "all">,
  subject: BankGeneratedSubject,
  domain: string,
  skill: string,
  difficulty: "Easy" | "Medium" | "Hard" | null,
  active: boolean,
  bankVisible: boolean,
];

export interface BankCountSummary {
  total: number;
  domains: Record<string, number>;
  skills: Record<string, number>;
  difficulties: Record<BankGeneratedDifficulty, number>;
}

export type BankCountIndex = Record<BankGeneratedSource, Record<BankGeneratedSubject, BankCountSummary>>;

`;

writeFileSync(
  path.join(root, "src/lib/generated/bankMetadata.generated.ts"),
  `${metadataHeader}export const BANK_COUNT_INDEX: BankCountIndex = ${JSON.stringify(bankCountIndex)};\n\n` +
    `export const BANK_QUESTION_META_ROWS = ${JSON.stringify(bankQuestionMetaRows)} satisfies BankQuestionMetaRow[];\n`,
);

console.log(
  `generate-skill-samples: wrote ${totalPicked} samples across ${skillEntries.length} skills ` +
    `(${skillsWithoutSamples} with zero matches); visible bank total = ${
      visibleMathBank.length + visibleReadingBank.length + unofficialMathCount + unofficialReadingCount
    }`,
);
