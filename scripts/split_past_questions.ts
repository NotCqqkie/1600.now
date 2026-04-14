/**
 * Splits all_questions.ts into subject-specific JSON files.
 *
 * Run with:
 *   node --experimental-strip-types scripts/split_past_questions.ts
 *
 * Outputs:
 *   src/data/questions/math_past.json       — math questions (app use, compact)
 *   src/data/questions/reading_past.json    — reading questions (app use, compact)
 *   scripts/math_review.json               — math questions (pretty-printed, AI review)
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { questions } from "../src/data/all_questions.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const mathQuestions = questions.filter((q) => q.section !== "Reading and Writing");
const readingQuestions = questions.filter((q) => q.section === "Reading and Writing");

const questionsDir = join(root, "src/data/questions");
mkdirSync(questionsDir, { recursive: true });

// Compact JSON for the app bundle
writeFileSync(join(questionsDir, "math_past.json"), JSON.stringify(mathQuestions));
writeFileSync(join(questionsDir, "reading_past.json"), JSON.stringify(readingQuestions));

// Pretty-printed for the AI review workflow
writeFileSync(join(__dirname, "math_review.json"), JSON.stringify(mathQuestions, null, 2));

console.log(`✓ Math questions:    ${mathQuestions.length}`);
console.log(`✓ Reading questions: ${readingQuestions.length}`);
console.log(`✓ Total:             ${questions.length}`);
console.log("");
console.log("Files written:");
console.log("  src/data/questions/math_past.json");
console.log("  src/data/questions/reading_past.json");
console.log("  scripts/math_review.json");
