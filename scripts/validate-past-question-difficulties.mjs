#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  DIFFICULTIES,
  PAST_MAP_PATH,
  difficultyCounts,
  getModuleFiles,
  getPastBankFiles,
  groupByStrictCluster,
  normalizeDifficulty,
  readJson,
  readPastBankRecords,
  readPastMap,
  readPastTargetRecords,
  readUnofficialRecords,
  ROOT,
} from "./difficulty-utils.mjs";

const failures = [];
const fail = (message) => failures.push(message);
const pastMap = readPastMap();
const validDifficulties = new Set(DIFFICULTIES);
const targetRecords = readPastTargetRecords();
const targetIds = new Set(targetRecords.map((record) => record.id));
const unofficialIds = new Set(readUnofficialRecords().map((record) => record.id));

for (const [id, difficulty] of Object.entries(pastMap)) {
  if (!validDifficulties.has(difficulty)) fail(`${PAST_MAP_PATH}: ${id} has invalid difficulty ${difficulty}`);
  if (!targetIds.has(id)) fail(`${PAST_MAP_PATH}: ${id} is not a past/official question id`);
  if (unofficialIds.has(id) && !targetIds.has(id)) fail(`${PAST_MAP_PATH}: ${id} is unofficial-only`);
}

for (const id of targetIds) {
  if (!pastMap[id]) fail(`${PAST_MAP_PATH}: missing past/official id ${id}`);
}

const bankDifficultiesById = new Map();
for (const filePath of getPastBankFiles()) {
  for (const q of readJson(filePath)) {
    const id = String(q.id);
    const difficulty = normalizeDifficulty(q.difficulty);
    if (difficulty !== pastMap[id]) fail(`${filePath}: ${id} has ${difficulty}, expected ${pastMap[id]}`);
    bankDifficultiesById.set(id, difficulty);
  }
}

for (const filePath of getModuleFiles()) {
  for (const q of readJson(filePath)) {
    const id = String(q.id);
    const expected = pastMap[id];
    if (!expected) continue;
    const difficulty = normalizeDifficulty(q.difficulty);
    if (difficulty !== expected) fail(`${filePath}: ${id} has ${difficulty}, expected ${expected}`);
    const bankDifficulty = bankDifficultiesById.get(id);
    if (bankDifficulty && bankDifficulty !== difficulty) {
      fail(`${filePath}: ${id} module label ${difficulty} disagrees with bank label ${bankDifficulty}`);
    }
  }
}

for (const [key, items] of groupByStrictCluster(targetRecords).entries()) {
  const counts = difficultyCounts(items, (item) => pastMap[item.id]);
  const mixedLabels = Object.values(counts).filter((count) => count > 0).length;
  if (mixedLabels > 1) {
    fail(`strict cluster ${key.replace(/\u001f/g, " | ")} has mixed canonical labels ${JSON.stringify(counts)}`);
  }
}

try {
  const generated = readJsonLikeTsArray("src/lib/generated/bankMetadata.generated.ts");
  for (const row of generated) {
    const [, sourceId, bankType, , , , difficulty] = row;
    if (bankType !== "past") continue;
    if (normalizeDifficulty(difficulty) !== pastMap[sourceId]) {
      fail(`bankMetadata.generated.ts: ${sourceId} has ${difficulty}, expected ${pastMap[sourceId]}`);
    }
  }
} catch (error) {
  fail(`bankMetadata.generated.ts could not be checked: ${error.message}`);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      mappedQuestions: Object.keys(pastMap).length,
      pastBankQuestions: readPastBankRecords().length,
      strictClusters: groupByStrictCluster(targetRecords).size,
    },
    null,
    2,
  ),
);

function readJsonLikeTsArray(filePath) {
  const text = readFileSync(path.join(ROOT, filePath), "utf8");
  const match = text.match(/export const BANK_QUESTION_META_ROWS = (.+) satisfies BankQuestionMetaRow\[];/s);
  if (!match) throw new Error("could not find BANK_QUESTION_META_ROWS");
  return JSON.parse(match[1]);
}
