#!/usr/bin/env node
// Picks 3 stable sample questions per SAT skill out of the question bank and
// writes them to src/lib/generated/skillSampleQuestions.generated.ts. The skill pages
// import the generated file so the full 15MB bank never ships to a user who
// only lands on a skill SEO page.
//
// Selection rules:
//   - match questions where `skill` equals the SatSkill.officialSkill value
//   - prefer Easy, fall back to Medium, then Hard
//   - prefer shorter `text` length so the SEO card stays compact
//   - sort by id to make the pick deterministic across builds

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const SAMPLES_PER_SKILL = 3;
const MAX_TEXT_LEN_READING = 900; // reading passages skew long; keep cards readable
const MAX_TEXT_LEN_MATH = 500;

const skillsSrc = readFileSync(path.join(root, "src/lib/seo-data/satSkillsData.ts"), "utf8");

const skillEntries = [];
{
  const blockRegex = /\{\s*slug:\s*"([^"]+)",[\s\S]*?officialSkill:\s*\n?\s*"([^"]+)",/g;
  for (const m of skillsSrc.matchAll(blockRegex)) {
    skillEntries.push({ slug: m[1], officialSkill: m[2] });
  }
}

if (skillEntries.length === 0) {
  console.error("generate-skill-samples: no skill entries found in satSkillsData.ts");
  process.exit(1);
}

const mathBank = JSON.parse(readFileSync(path.join(root, "src/data/questions/math_past.json"), "utf8"));
const readingBank = JSON.parse(readFileSync(path.join(root, "src/data/questions/reading_past.json"), "utf8"));

// Parse unofficial bank (TS file with `export const questions: SourceQuestion[] = [...];`).
// We only need to count, so extract the JSON array and split by section.
let unofficialMathCount = 0;
let unofficialReadingCount = 0;
let unofficialQuestions = [];
try {
  const unofficialSrc = readFileSync(path.join(root, "src/data/unofficialQuestions.ts"), "utf8");
  const eqIdx = unofficialSrc.indexOf("=");
  const arrStart = eqIdx >= 0 ? unofficialSrc.indexOf("[", eqIdx) : -1;
  const arrEnd = unofficialSrc.lastIndexOf("]");
  if (arrStart >= 0 && arrEnd > arrStart) {
    unofficialQuestions = JSON.parse(unofficialSrc.slice(arrStart, arrEnd + 1));
    for (const q of unofficialQuestions) {
      const section = (q?.section || "").toLowerCase();
      if (section === "math") unofficialMathCount++;
      else if (section.startsWith("reading")) unofficialReadingCount++;
    }
  }
} catch (err) {
  console.warn("generate-skill-samples: could not count unofficial bank —", err.message);
}

const difficultyRank = { Easy: 0, Medium: 1, Hard: 2 };

// Skip questions that reference images/graphs/tables — the SEO page has no way
// to render those, and the question reads as broken without the visual.
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
    const da = difficultyRank[a.difficulty] ?? 3;
    const db = difficultyRank[b.difficulty] ?? 3;
    if (da !== db) return da - db;
    if (a.text.length !== b.text.length) return a.text.length - b.text.length;
    return a.id.localeCompare(b.id);
  });

  // Dedupe by normalized text so near-duplicates (same template, different numbers)
  // don't fill all three slots with the same phrasing.
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
    difficulty: q.difficulty,
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
  const isMath = mathBank.some((q) => q.skill === officialSkill);
  const bank = isMath ? mathBank : readingBank;
  const maxLen = isMath ? MAX_TEXT_LEN_MATH : MAX_TEXT_LEN_READING;
  const picked = pickSamples(bank, officialSkill, maxLen);
  samplesBySlug[slug] = picked;
  totalPicked += picked.length;
  if (picked.length === 0) skillsWithoutSamples++;
}

const header = `// AUTO-GENERATED by scripts/generate-skill-samples.mjs — do not edit.
// Re-run \`npm run build\` (or \`node scripts/generate-skill-samples.mjs\`) to refresh.

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

// Also emit a tiny static totals file the home page can import synchronously
// so the rendered question counts don't drift from the bank as it grows.
const skillTotals = {};
for (const q of [...mathBank, ...readingBank]) {
  if (!q.skill) continue;
  skillTotals[q.skill] = (skillTotals[q.skill] || 0) + 1;
}

const totalsHeader = `// AUTO-GENERATED by scripts/generate-skill-samples.mjs — do not edit.
// Counts the past-bank questions; Home.tsx uses these so the displayed totals
// track the real bank without needing to load the full bank chunk.

export const BANK_TOTAL_PAST_MATH = ${mathBank.length};
export const BANK_TOTAL_PAST_READING = ${readingBank.length};
export const BANK_TOTAL_PAST = ${mathBank.length + readingBank.length};

export const BANK_TOTAL_UNOFFICIAL_MATH = ${unofficialMathCount};
export const BANK_TOTAL_UNOFFICIAL_READING = ${unofficialReadingCount};
export const BANK_TOTAL_UNOFFICIAL = ${unofficialMathCount + unofficialReadingCount};

export const BANK_TOTAL_ALL = ${mathBank.length + readingBank.length + unofficialMathCount + unofficialReadingCount};

export const BANK_COUNT_BY_OFFICIAL_SKILL: Record<string, number> = `;

writeFileSync(
  path.join(root, "src/lib/generated/bankTotals.generated.ts"),
  totalsHeader + JSON.stringify(skillTotals, null, 2) + ";\n",
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

const normalizeSubject = (q) => {
  const categorySubject = q?.category?.subject;
  if (categorySubject === "Math") return "math";
  if (categorySubject === "English") return "reading";
  const section = (q?.section || "").toLowerCase();
  if (section === "math") return "math";
  return "reading";
};

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

const makeBankQuestionMetaRow = (bankType, q) => {
  const subject = normalizeSubject(q);
  const sourceId = String(q.id);
  const domain = q?.category?.domain ?? q.domain ?? "Unassigned";
  const skill = q?.category?.skill ?? q.skill ?? "Unassigned";
  const active = q.inPracticeTests === true || (bankType === "past" && activePastQuestionSourceIds.has(sourceId));
  return [
    `bank-${bankType}-${subject}-${sourceId}`,
    sourceId,
    bankType,
    subject,
    domain,
    skill,
    normalizeDifficultyLabel(q.difficulty),
    active,
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
    `(${skillsWithoutSamples} with zero matches); bank total = ${mathBank.length + readingBank.length}`,
);
