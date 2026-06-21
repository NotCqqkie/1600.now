import { readFileSync } from "node:fs";
import path from "node:path";

export const readBankBackedPracticeSets = (root) => {
  const filePath = path.join(root, "src/lib/generated/bankPractice.generated.ts");
  const text = readFileSync(filePath, "utf8");
  const marker = "export const BANK_BACKED_PRACTICE_SETS: GeneratedPracticeSet[] = ";
  const start = text.indexOf(marker);
  if (start === -1) throw new Error("Could not find BANK_BACKED_PRACTICE_SETS");
  const bodyStart = start + marker.length;
  const bodyEnd = text.indexOf(";\n", bodyStart);
  if (bodyEnd === -1) throw new Error("Could not parse BANK_BACKED_PRACTICE_SETS");
  return JSON.parse(text.slice(bodyStart, bodyEnd));
};

export const collectActivePracticeQuestionKeys = (root) => {
  const keys = new Set();
  for (const practiceSet of readBankBackedPracticeSets(root)) {
    for (const module of practiceSet.modules ?? []) {
      for (const entry of module.questions ?? []) {
        const question = entry.bankQuestion;
        if (!question?.bankType || !question?.subject || !question?.sourceId) continue;
        keys.add(`${question.bankType}:${question.subject}:${question.sourceId}`);
      }
    }
  }
  return keys;
};

export const collectActivePastQuestionSourceIds = (root) => {
  const ids = new Set();
  for (const key of collectActivePracticeQuestionKeys(root)) {
    const [bankType, , sourceId] = key.split(":");
    if (bankType !== "past" || !sourceId) continue;
    ids.add(sourceId);
  }
  return ids;
};
