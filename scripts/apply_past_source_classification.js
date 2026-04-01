import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildPastQuestionMetadataMap } from "../src/data/pastQuestionClassification.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const MODULES_DIR = path.join(ROOT, "src", "data", "Modules");
const ALL_QUESTIONS_PATH = path.join(ROOT, "src", "data", "all_questions.ts");

const escapeForTs = (value) => {
  if (value == null) return null;
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
};

const getQuestionText = (question) => question.passage ?? question.question_text ?? "";

const getChoiceId = (choice) => choice.label ?? choice.id ?? "";

const toClassifierInput = (question) => ({
  id: question.id,
  section: question.section,
  domain: question.domain,
  skill: question.skill,
  testName: question.test_name,
  text: getQuestionText(question),
  choices: (question.choices ?? []).map((choice) => ({ text: choice.text ?? "" })),
});

const listModuleJsonFiles = async () => {
  const entries = await fs.readdir(MODULES_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(MODULES_DIR, entry.name))
    .sort();
};

const loadModuleQuestions = async (filePath) => {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : null;
};

const writeModuleQuestions = async (filePath, questions) => {
  await fs.writeFile(filePath, `${JSON.stringify(questions, null, 2)}\n`, "utf8");
};

const updateModuleJsonSources = async () => {
  const files = await listModuleJsonFiles();
  const loaded = [];

  for (const filePath of files) {
    const questions = await loadModuleQuestions(filePath);
    if (!questions) continue;
    loaded.push({ filePath, questions });
  }

  const metadata = buildPastQuestionMetadataMap(
    loaded.flatMap(({ questions }) => questions.map(toClassifierInput)),
  );

  let changedFiles = 0;
  let changedQuestions = 0;

  for (const file of loaded) {
    let fileChanged = false;

    for (const question of file.questions) {
      const next = metadata.get(String(question.id));
      if (!next) continue;

      const nextSection = next.category.subject === "Math" ? "Math" : "Reading and Writing";
      const nextDomain = next.category.domain;
      const nextSkill = next.category.skill;
      const nextDifficulty = next.difficulty;

      if (
        question.section !== nextSection ||
        question.domain !== nextDomain ||
        question.skill !== nextSkill ||
        question.difficulty !== nextDifficulty
      ) {
        question.section = nextSection;
        question.domain = nextDomain;
        question.skill = nextSkill;
        question.difficulty = nextDifficulty;
        fileChanged = true;
        changedQuestions += 1;
      }
    }

    if (fileChanged) {
      await writeModuleQuestions(file.filePath, file.questions);
      changedFiles += 1;
    }
  }

  return { files, loaded, changedFiles, changedQuestions };
};

const rebuildAllQuestionsTs = async (loadedFiles) => {
  const current = await fs.readFile(ALL_QUESTIONS_PATH, "utf8");
  const headerMatch = current.match(/^[\s\S]*?export const questions: Question\[\] = \[/);
  if (!headerMatch) {
    throw new Error("Could not locate all_questions.ts header");
  }

  const allQuestions = loadedFiles.flatMap(({ questions }) => questions);
  const lines = [headerMatch[0], ""];

  allQuestions.forEach((question, index) => {
    lines.push("  {");

    if ("section" in question) {
      lines.push(`    section: "${escapeForTs(question.section)}",`);
    }
    if ("domain" in question) {
      lines.push(
        `    domain: ${question.domain ? `"${escapeForTs(question.domain)}"` : "null"},`,
      );
    }
    if ("skill" in question) {
      lines.push(
        `    skill: ${question.skill ? `"${escapeForTs(question.skill)}"` : "null"},`,
      );
    }
    if ("difficulty" in question) {
      lines.push(
        `    difficulty: ${question.difficulty ? `"${escapeForTs(question.difficulty)}"` : "null"},`,
      );
    }
    if ("rationale" in question) {
      lines.push(
        `    rationale: ${question.rationale ? `"${escapeForTs(question.rationale)}"` : "null"},`,
      );
    }

    if (typeof question.id === "string") {
      lines.push(`    id: "${escapeForTs(question.id)}",`);
    } else {
      lines.push(`    id: ${question.id},`);
    }

    lines.push(`    testName: "${escapeForTs(question.test_name ?? "")}",`);
    lines.push(`    text: "${escapeForTs(getQuestionText(question))}",`);

    const choices = Array.isArray(question.choices) ? question.choices : [];
    if (choices.length > 0) {
      lines.push("    choices: [");
      for (const choice of choices) {
        lines.push(
          `      { id: "${escapeForTs(getChoiceId(choice))}", text: "${escapeForTs(choice.text ?? "")}" },`,
        );
      }
      lines.push("    ],");
    } else {
      lines.push("    choices: [],");
    }

    lines.push(`    correctAnswer: "${escapeForTs(question.correct_answer ?? "")}",`);
    lines.push(`    type: "${question.is_fill_in_blank ? "free-response" : "multiple-choice"}",`);

    if (question.category) {
      lines.push("    category: {");
      if (question.category.subject) {
        lines.push(`      "subject": "${escapeForTs(question.category.subject)}",`);
      }
      if (question.category.domain) {
        lines.push(`      "domain": "${escapeForTs(question.category.domain)}",`);
      }
      if (question.category.skill) {
        lines.push(`      "skill": "${escapeForTs(question.category.skill)}",`);
      }
      if (question.category.confidence) {
        lines.push(`      "confidence": "${escapeForTs(question.category.confidence)}"`);
      }
      lines.push("    },");
    }

    lines.push(index < allQuestions.length - 1 ? "  }," : "  }");
  });

  lines.push("];");
  await fs.writeFile(ALL_QUESTIONS_PATH, `${lines.join("\n")}\n`, "utf8");

  return allQuestions.length;
};

const main = async () => {
  const { loaded, changedFiles, changedQuestions } = await updateModuleJsonSources();
  const rebuiltCount = await rebuildAllQuestionsTs(loaded);

  console.log(
    JSON.stringify(
      {
        changedFiles,
        changedQuestions,
        rebuiltQuestions: rebuiltCount,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
