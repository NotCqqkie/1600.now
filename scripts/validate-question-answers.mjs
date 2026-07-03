#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHARD_DIR = path.join(ROOT, "public/generated/bank-question-shards");

// A single value written with a thousands separator (e.g. "3,540"). Legitimate
// multi-form free-response answers ("1/2,0.5,.5") contain non-digit characters
// and so never match this whole-string pattern.
const THOUSANDS_SEPARATOR = /^\d{1,3}(,\d{3})+$/;

const failures = [];
const fail = (message) => failures.push(message);

const shardFiles = readdirSync(SHARD_DIR)
  .filter((name) => name.endsWith(".json"))
  .sort();

let checked = 0;

for (const name of shardFiles) {
  const filePath = path.join(SHARD_DIR, name);
  const questions = JSON.parse(readFileSync(filePath, "utf8"));
  for (const q of questions) {
    checked += 1;
    const label = `${name}: question ${q.id ?? q.stableId}`;

    if (q.type === "free-response") {
      if (typeof q.correctAnswer === "string" && THOUSANDS_SEPARATOR.test(q.correctAnswer)) {
        fail(`${label}: free-response correctAnswer "${q.correctAnswer}" uses a thousands separator; remove the comma.`);
      }
      continue;
    }

    if (q.type === "multiple-choice") {
      const choiceIds = Array.isArray(q.choices) ? q.choices.map((c) => c.id) : [];
      if (!choiceIds.includes(q.correctAnswer)) {
        fail(`${label}: correctAnswer "${q.correctAnswer}" is not among choice ids [${choiceIds.join(", ")}].`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  console.error(`\n${failures.length} invalid question(s) across ${shardFiles.length} shard(s).`);
  process.exit(1);
}

console.log(`Validated ${checked} questions across ${shardFiles.length} shards. All answers OK.`);
