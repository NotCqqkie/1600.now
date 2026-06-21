import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const ROOT = process.cwd();
export const DIFFICULTIES = ["Easy", "Medium", "Hard"];
export const PAST_MAP_PATH = "src/data/pastQuestionDifficultyMap.json";

export const readJson = (filePath) =>
  JSON.parse(readFileSync(path.join(ROOT, filePath), "utf8"));

export const readPastMap = () =>
  existsSync(path.join(ROOT, PAST_MAP_PATH)) ? readJson(PAST_MAP_PATH) : {};

export const normalizeDifficulty = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "easy") return "Easy";
  if (normalized === "medium") return "Medium";
  if (normalized === "hard") return "Hard";
  return null;
};

export const normalizeSubject = (q) => {
  const categorySubject = q?.category?.subject;
  if (categorySubject === "Math") return "math";
  if (categorySubject === "English") return "reading";
  const section = String(q?.section ?? "").toLowerCase();
  if (section === "math") return "math";
  return "reading";
};

export const normalizeText = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/&[^;]+;/g, " ")
    .replace(/\$[^$]*\$/g, " MATH ")
    .replace(/[-+]?\d[\d,]*(?:\.\d+)?/g, "#")
    .replace(/\b[a-z]\b/g, "v")
    .replace(/\s+/g, " ")
    .trim();

export const choiceText = (q) =>
  Array.isArray(q.choices)
    ? q.choices.map((choice) => choice?.text ?? "").join(" ")
    : "";

export const strictClusterKey = (record) =>
  [
    record.subject,
    record.domain,
    record.skill,
    record.type,
    normalizeText(record.text).slice(0, 240),
    normalizeText(choiceText(record)).slice(0, 160),
  ].join("\u001f");

export const readUnofficialQuestions = () => {
  const text = readFileSync(path.join(ROOT, "src/data/unofficialQuestions.ts"), "utf8");
  const marker = "export const questions: SourceQuestion[] = ";
  const start = text.indexOf(marker);
  const end = text.lastIndexOf("];");
  if (start === -1 || end === -1) throw new Error("Could not parse unofficialQuestions.ts");
  return JSON.parse(text.slice(start + marker.length, end + 1));
};

export const getPastBankFiles = () => [
  "src/data/questions/math_past.json",
  "src/data/questions/reading_past.json",
];

export const getModuleFiles = () =>
  existsSync(path.join(ROOT, "src/data/modules"))
    ? readdirSync(path.join(ROOT, "src/data/modules"))
      .filter((fileName) => fileName.endsWith(".json"))
      .sort()
      .map((fileName) => `src/data/modules/${fileName}`)
    : [];

export const readPastBankRecords = () =>
  getPastBankFiles().flatMap((filePath) =>
    readJson(filePath).map((q) => ({
      id: String(q.id),
      source: "past-bank",
      filePath,
      subject: normalizeSubject(q),
      section: q.section,
      domain: q?.category?.domain ?? q.domain,
      skill: q?.category?.skill ?? q.skill,
      type: q.type,
      text: q.text,
      choices: q.choices ?? [],
      difficulty: normalizeDifficulty(q.difficulty),
    })),
  );

export const readModuleRecords = () =>
  getModuleFiles().flatMap((filePath) =>
    readJson(filePath).map((q) => ({
      id: String(q.id),
      source: "module",
      filePath,
      subject: normalizeSubject(q),
      section: q.section,
      domain: q.domain,
      skill: q.skill,
      type: q.is_fill_in_blank ? "free-response" : "multiple-choice",
      text: [q.passage, q.question_text].filter(Boolean).join("\n"),
      choices: (q.choices ?? []).map((choice) => ({ text: choice.text ?? "" })),
      difficulty: normalizeDifficulty(q.difficulty),
    })),
  );

export const readUnofficialRecords = () =>
  readUnofficialQuestions().map((q) => ({
    id: String(q.id),
    source: "unofficial",
    subject: normalizeSubject(q),
    section: q.section,
    domain: q?.category?.domain ?? q.domain,
    skill: q?.category?.skill ?? q.skill,
    type: q.type,
    text: q.text,
    choices: q.choices ?? [],
    difficulty: normalizeDifficulty(q.difficulty),
  }));

export const readPastTargetRecords = () => {
  const records = [];
  const seen = new Set();
  for (const record of readPastBankRecords()) {
    records.push(record);
    seen.add(record.id);
  }
  for (const record of readModuleRecords()) {
    if (seen.has(record.id)) continue;
    records.push({ ...record, source: "module-only" });
    seen.add(record.id);
  }
  return records;
};

export const groupByStrictCluster = (records) => {
  const groups = new Map();
  for (const record of records) {
    const key = strictClusterKey(record);
    const items = groups.get(key) ?? [];
    items.push(record);
    groups.set(key, items);
  }
  return groups;
};

export const difficultyCounts = (records, getDifficulty = (record) => record.difficulty) => {
  const counts = { Easy: 0, Medium: 0, Hard: 0 };
  for (const record of records) {
    const difficulty = normalizeDifficulty(getDifficulty(record));
    if (difficulty) counts[difficulty] += 1;
  }
  return counts;
};

export const majorityDifficulty = (counts) => {
  const ranked = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1] || DIFFICULTIES.indexOf(left[0]) - DIFFICULTIES.indexOf(right[0]));
  if (ranked.length === 0) return "Medium";
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return "Medium";
  return ranked[0][0];
};

export const loadClassificationOverrides = (filePath) => {
  if (!filePath) return {};
  const value = JSON.parse(readFileSync(path.resolve(ROOT, filePath), "utf8"));
  const rows = Array.isArray(value) ? value : value?.classifications;
  if (!Array.isArray(rows)) throw new Error("Classification override file must be an array or { classifications: [] }");
  return Object.fromEntries(
    rows
      .map((row) => [row.clusterId, normalizeDifficulty(row.proposedDifficulty ?? row.difficulty)])
      .filter(([, difficulty]) => difficulty),
  );
};
