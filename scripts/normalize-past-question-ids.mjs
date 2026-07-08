#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const files = {
  math: "src/data/questions/math_past.json",
  reading: "src/data/questions/reading_past.json",
};
const aliasPath = "src/data/questions/past_id_aliases.json";
const difficultyPath = "src/data/pastQuestionDifficultyMap.json";
const imageMapPath = "src/data/questionImageMap.ts";
const explanationsDir = "public/explanations";
const generatedPracticePaths = [
  "src/lib/generated/bankPractice.generated.ts",
  ...(
    existsSync(path.join(root, "src/lib/generated/bank-practice-sets"))
      ? readdirSync(path.join(root, "src/lib/generated/bank-practice-sets"))
        .filter((name) => name.endsWith(".generated.ts"))
        .map((name) => `src/lib/generated/bank-practice-sets/${name}`)
      : []
  ),
];

const readJson = (filePath) => JSON.parse(readFileSync(path.join(root, filePath), "utf8"));
const writeJson = (filePath, value) => writeFileSync(path.join(root, filePath), `${JSON.stringify(value, null, 2)}\n`);

const isCanonicalId = (value) => /^[0-9a-f]{8}$/.test(String(value));
const legacyParts = (legacyId) => {
  const match = String(legacyId).match(/^(.+)_(\d+)$/);
  return {
    legacyTestId: match ? match[1] : String(legacyId),
    legacyQuestionNumber: match ? Number.parseInt(match[2], 10) : null,
  };
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const existingAliasRows = existsSync(path.join(root, aliasPath))
  ? readJson(aliasPath)
  : [];
const existingAliasByLegacyId = new Map(existingAliasRows.map((row) => [row.legacyId, row]));

const unofficialIds = new Set(
  [
    ...readJson("src/data/questions/unofficial_math.json"),
    ...readJson("src/data/questions/unofficial_reading.json"),
  ].map((question) => String(question.id)),
);

const sourceBySubject = Object.fromEntries(
  Object.entries(files).map(([subject, filePath]) => [subject, readJson(filePath)]),
);
const usedCanonicalIds = new Set(unofficialIds);
const aliasRows = [];

const makeCanonicalId = (subject, legacyId) => {
  const existing = existingAliasByLegacyId.get(legacyId)?.id;
  if (existing) return existing;

  for (let salt = 0; ; salt += 1) {
    const seed = salt === 0 ? `past:${subject}:${legacyId}` : `past:${subject}:${legacyId}:${salt}`;
    const candidate = createHash("sha256").update(seed).digest("hex").slice(0, 8);
    if (!usedCanonicalIds.has(candidate)) return candidate;
  }
};

for (const [subject, questions] of Object.entries(sourceBySubject)) {
  for (const question of questions) {
    const legacyId = String(question.legacyId ?? question.id);
    const canonicalId = isCanonicalId(question.id) && question.legacyId
      ? String(question.id)
      : makeCanonicalId(subject, legacyId);
    if (usedCanonicalIds.has(canonicalId) && !aliasRows.some((row) => row.id === canonicalId)) {
      throw new Error(`canonical id collision: ${canonicalId}`);
    }
    usedCanonicalIds.add(canonicalId);
    const { legacyTestId, legacyQuestionNumber } = legacyParts(legacyId);
    aliasRows.push({
      id: canonicalId,
      legacyId,
      subject,
      legacyTestId,
      legacyQuestionNumber,
    });
  }
}

const canonicalByLegacyId = new Map(aliasRows.map((row) => [row.legacyId, row.id]));
const aliasByCanonicalId = new Map(aliasRows.map((row) => [row.id, row]));
const aliasByLegacyId = new Map(aliasRows.map((row) => [row.legacyId, row]));

for (const [subject, filePath] of Object.entries(files)) {
  const normalized = sourceBySubject[subject].map((question) => {
    const legacyId = String(question.legacyId ?? question.id);
    const alias = aliasByLegacyId.get(legacyId);
    const { id, legacyId: _legacyId, legacyTestId: _legacyTestId, legacyQuestionNumber: _legacyQuestionNumber, ...rest } = question;
    return {
      id: alias.id,
      legacyId: alias.legacyId,
      legacyTestId: alias.legacyTestId,
      legacyQuestionNumber: alias.legacyQuestionNumber,
      ...rest,
    };
  });
  writeJson(filePath, normalized);
}

writeJson(aliasPath, aliasRows);

if (existsSync(path.join(root, difficultyPath))) {
  const difficulty = readJson(difficultyPath);
  const nextDifficulty = {};
  for (const [key, value] of Object.entries(difficulty)) {
    nextDifficulty[canonicalByLegacyId.get(key) ?? key] = value;
  }
  writeJson(
    difficultyPath,
    Object.fromEntries(Object.entries(nextDifficulty).sort(([left], [right]) => left.localeCompare(right))),
  );
}

const rewriteTsRecordKeys = (filePath, marker) => {
  const fullPath = path.join(root, filePath);
  if (!existsSync(fullPath)) return 0;
  const text = readFileSync(fullPath, "utf8");
  const start = text.indexOf(marker);
  if (start === -1) return 0;
  const objectStart = start + marker.length;
  const objectEnd = text.indexOf("\n};", objectStart);
  if (objectEnd === -1) return 0;
  const record = JSON.parse(text.slice(objectStart, objectEnd + 2));
  let changed = 0;
  const nextRecord = {};
  for (const [key, value] of Object.entries(record)) {
    const nextKey = canonicalByLegacyId.get(key) ?? key;
    if (nextKey !== key) changed += 1;
    nextRecord[nextKey] = value;
  }
  if (changed > 0) {
    writeFileSync(
      fullPath,
      `${text.slice(0, objectStart)}${JSON.stringify(nextRecord, null, 2)};\n${text.slice(objectEnd + 3)}`,
    );
  }
  return changed;
};

const imageMapRewrites = rewriteTsRecordKeys(
  imageMapPath,
  "export const questionImageMap: Record<string, QuestionImageMapEntry> = ",
);

let explanationRenames = 0;
let explanationUpdates = 0;
const explanationRoot = path.join(root, explanationsDir);
if (existsSync(explanationRoot)) {
  for (const row of aliasRows) {
    const legacyPath = path.join(explanationRoot, `${row.legacyId}.json`);
    const canonicalPath = path.join(explanationRoot, `${row.id}.json`);
    const sourcePath = existsSync(legacyPath) ? legacyPath : existsSync(canonicalPath) ? canonicalPath : null;
    if (!sourcePath) continue;

    let raw = readFileSync(sourcePath, "utf8");
    try {
      const json = JSON.parse(raw);
      if (json && typeof json === "object" && json.questionId !== row.id) {
        json.questionId = row.id;
        raw = `${JSON.stringify(json, null, 2)}\n`;
        explanationUpdates += 1;
      }
    } catch {
      raw = raw.replaceAll(row.legacyId, row.id);
    }

    writeFileSync(sourcePath, raw);
    if (sourcePath !== canonicalPath) {
      if (existsSync(canonicalPath)) unlinkSync(canonicalPath);
      renameSync(sourcePath, canonicalPath);
      explanationRenames += 1;
    }
  }
}

const rewriteGeneratedPracticeText = (filePath) => {
  const fullPath = path.join(root, filePath);
  if (!existsSync(fullPath)) return 0;
  let text = readFileSync(fullPath, "utf8");
  const before = text;
  text = text.replace(
    /bank-past-(math|reading)-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_\d+)/g,
    (match, subject, legacyId) => {
      const canonicalId = canonicalByLegacyId.get(legacyId);
      return canonicalId ? `bank-past-${subject}-${canonicalId}` : match;
    },
  );
  text = text.replace(
    /"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_\d+)"/g,
    (match, legacyId) => {
      const canonicalId = canonicalByLegacyId.get(legacyId);
      return canonicalId ? `"${canonicalId}"` : match;
    },
  );
  if (text !== before) writeFileSync(fullPath, text);
  return text === before ? 0 : 1;
};

const practiceFilesChanged = generatedPracticePaths.reduce(
  (count, filePath) => count + rewriteGeneratedPracticeText(filePath),
  0,
);

console.log(
  `normalize-past-question-ids: ${aliasRows.length} aliases, ` +
    `${explanationRenames} explanation renames, ${explanationUpdates} explanation updates, ` +
    `${imageMapRewrites} image map keys, ${practiceFilesChanged} practice files changed`,
);
