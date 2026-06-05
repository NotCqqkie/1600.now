#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  PAST_MAP_PATH,
  ROOT,
  difficultyCounts,
  getModuleFiles,
  getPastBankFiles,
  groupByStrictCluster,
  loadClassificationOverrides,
  majorityDifficulty,
  normalizeDifficulty,
  readJson,
  readPastTargetRecords,
  strictClusterKey,
} from "./difficulty-utils.mjs";

const argValue = (name) => {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
};

const overrides = loadClassificationOverrides(argValue("--classifications"));
const records = readPastTargetRecords();
const clusters = groupByStrictCluster(records);
const clusterIdByKey = new Map(
  [...clusters.keys()].sort().map((key, index) => [key, `cluster-${String(index + 1).padStart(5, "0")}`]),
);
const flaggedIdByKey = new Map();
let flaggedSequence = 1;
for (const [key, items] of [...clusters.entries()].sort(([left], [right]) => left.localeCompare(right))) {
  const counts = difficultyCounts(items);
  const values = Object.values(counts).filter((count) => count > 0);
  const sortedCounts = Object.values(counts).sort((left, right) => right - left);
  const easyHard = counts.Easy > 0 && counts.Hard > 0;
  const tie = values.length > 1 && sortedCounts[0] === sortedCounts[1];
  if (easyHard || tie) {
    flaggedIdByKey.set(key, `flagged-${String(flaggedSequence).padStart(3, "0")}`);
    flaggedSequence += 1;
  }
}
const labelById = {};

for (const [key, items] of clusters) {
  const clusterId = clusterIdByKey.get(key);
  const flaggedId = flaggedIdByKey.get(key);
  const label = overrides[flaggedId] ?? overrides[clusterId] ?? majorityDifficulty(difficultyCounts(items));
  for (const item of items) labelById[item.id] = label;
}

const sortedLabelById = Object.fromEntries(
  Object.entries(labelById).sort(([left], [right]) => left.localeCompare(right)),
);

mkdirSync(path.dirname(path.join(ROOT, PAST_MAP_PATH)), { recursive: true });
writeFileSync(path.join(ROOT, PAST_MAP_PATH), `${JSON.stringify(sortedLabelById, null, 2)}\n`);

const updateQuestionArray = (filePath, getId) => {
  const fullPath = path.join(ROOT, filePath);
  const originalText = readFileSync(fullPath, "utf8");
  const data = JSON.parse(originalText);
  let changed = 0;
  for (const question of data) {
    const id = String(getId(question));
    const next = normalizeDifficulty(sortedLabelById[id]);
    if (!next) continue;
    if (question.difficulty !== next) {
      question.difficulty = next;
      changed += 1;
    }
  }
  const compact = !originalText.includes("\n");
  writeFileSync(fullPath, compact ? JSON.stringify(data) : `${JSON.stringify(data, null, 2)}\n`);
  return changed;
};

const bankChanges = getPastBankFiles().reduce(
  (total, filePath) => total + updateQuestionArray(filePath, (question) => question.id),
  0,
);

const moduleChanges = getModuleFiles().reduce(
  (total, filePath) => total + updateQuestionArray(filePath, (question) => question.id),
  0,
);

const mixedBefore = [...clusters.values()].filter((items) => {
  const counts = difficultyCounts(items);
  return Object.values(counts).filter((count) => count > 0).length > 1;
}).length;

console.log(
  JSON.stringify(
    {
      mapPath: PAST_MAP_PATH,
      mappedQuestions: Object.keys(sortedLabelById).length,
      strictClusters: clusters.size,
      mixedClustersBeforeSync: mixedBefore,
      flaggedClusters: flaggedIdByKey.size,
      classificationOverrides: Object.keys(overrides).length,
      bankChanges,
      moduleChanges,
    },
    null,
    2,
  ),
);
