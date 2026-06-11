import {
  buildBankQuestionKey,
  getAllSourceBankQuestions,
  type BankQuestion,
  type BankSubject,
} from "@/data/questionBank";
import { getSatImageDisplaySize } from "@/data/satQuestionImages";
import { getPastQuestionDifficulty } from "@/data/pastQuestionDifficulty";
import type { QuestionCategory } from "@/data/questionCategories";
import {
  questionSimilarityGroupByQuestion,
  questionSimilarityGroupsById,
} from "@/lib/generated/questionSimilarity.generated";

const rawModuleImports = import.meta.glob("./modules/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

const EXPECTED_COUNTS: Record<BankSubject, number> = {
  reading: 27,
  math: 22,
};

type ModuleSubjectLabel = "Math" | "English";
type ReplacementOrigin = "borrowed";

interface RawModuleChoice {
  label: string;
  text?: string;
  image?: string;
}

interface RawModuleImage {
  src: string;
  alt?: string;
  local?: string;
}

interface RawModuleQuestion {
  section: string;
  domain: string;
  skill: string;
  difficulty?: string | null;
  question_number: number;
  test_name: string;
  passage: string;
  question_text: string | null;
  choices: RawModuleChoice[];
  is_fill_in_blank: boolean;
  correct_answer: string;
  rationale?: string | null;
  id: string;
  images?: RawModuleImage[];
}

interface PositionPattern {
  skill: string;
  domain: string;
  type: BankQuestion["type"];
  confidence: number;
  support: number;
  alternatives: Array<{
    skill: string;
    domain: string;
    type: BankQuestion["type"];
    support: number;
  }>;
}

interface CandidateQuestionRecord {
  sourceId: string;
  moduleId: string;
  moduleNumber: 1 | 2;
  questionNumber: number;
  skill: string;
  domain: string;
  type: BankQuestion["type"];
  difficulty: string | null;
  bankQuestion: BankQuestion;
}

interface ParsedModuleMetadata {
  sourceIndex: number;
  subject: BankSubject;
  subjectLabel: ModuleSubjectLabel;
  moduleNumber: 1 | 2;
  id: string;
  slug: string;
}

export interface ModuleReplacement {
  slot: number;
  expectedSkill: string;
  expectedDomain: string;
  expectedType: BankQuestion["type"];
  profileConfidence: number;
  sourceId: string;
  sourceTestName: string;
  sourceQuestionNumber: number | string;
  origin: ReplacementOrigin;
  note: string;
}

export interface PracticeModuleQuestion {
  slot: number;
  bankQuestion: BankQuestion;
  isReplacement: boolean;
  replacement?: ModuleReplacement;
}

export interface PracticeModule {
  id: string;
  slug: string;
  fileName: string;
  testName: string;
  sourceIndex: number;
  subject: BankSubject;
  subjectLabel: ModuleSubjectLabel;
  moduleNumber: 1 | 2;
  targetCount: number;
  originalCount: number;
  questionCount: number;
  missingQuestionNumbers: number[];
  repairedSlots: number;
  questions: PracticeModuleQuestion[];
  replacements: ModuleReplacement[];
  setNumber: number;
  publicTitle: string;
  publicSubtitle: string;
}

export interface ModulePracticeBankSummary {
  totalPracticeSets: number;
  removedModules: number;
}

export interface PracticeSet {
  id: string;
  setNumber: number;
  modules: PracticeModule[];
}

export interface PracticeTestQuestionItem {
  id: number;
  subject: BankSubject;
  bankType: "past";
  sourceId: string;
  storageId: string;
  practiceSetId: string;
  practiceSetNumber: number;
  moduleSlug: string;
  moduleNumber: 1 | 2;
  moduleTitle: string;
  moduleQuestionNumber: number;
  globalQuestionNumber: number;
}

const isRawModuleQuestion = (value: unknown): value is RawModuleQuestion =>
  Boolean(
    value &&
      typeof value === "object" &&
      "question_number" in value &&
      "test_name" in value &&
      "id" in value,
  );

const normalizeModuleRecords = (value: unknown): RawModuleQuestion[] | null => {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!isRawModuleQuestion(value[0])) return null;
  return value.filter(isRawModuleQuestion);
};

const parseModuleTestName = (testName: string): ParsedModuleMetadata | null => {
  const match = testName.match(/^Module Source (\d+) (Eng|Math) M([12])$/);

  if (!match) return null;

  const [, sourceIndexText, rawSubject, moduleNumberText] = match;
  const sourceIndex = Number.parseInt(sourceIndexText, 10);
  const moduleNumber = Number.parseInt(moduleNumberText, 10) as 1 | 2;
  const subject = rawSubject === "Math" ? "math" : "reading";
  const subjectLabel: ModuleSubjectLabel = subject === "math" ? "Math" : "English";
  const sourceCode = String(sourceIndex).padStart(3, "0");
  const subjectSlug = subject === "reading" ? "eng" : "math";
  const slug = `module-source-${sourceCode}-${subjectSlug}-m${moduleNumber}`;

  return {
    sourceIndex,
    subject,
    subjectLabel,
    moduleNumber,
    id: `module_source_${sourceCode}_${subjectSlug}_m${moduleNumber}`,
    slug,
  };
};

const sortPracticeModules = (left: PracticeModule, right: PracticeModule) => {
  if (left.sourceIndex !== right.sourceIndex) return left.sourceIndex - right.sourceIndex;
  if (left.subject !== right.subject) return left.subject.localeCompare(right.subject);
  if (left.moduleNumber !== right.moduleNumber) return left.moduleNumber - right.moduleNumber;
  return left.testName.localeCompare(right.testName);
};

const pastMathBank = getAllSourceBankQuestions("math", "past");
const pastReadingBank = getAllSourceBankQuestions("reading", "past");

const synthesizedBankQuestions: Record<BankSubject, Map<string, BankQuestion>> = {
  math: new Map(),
  reading: new Map(),
};

export const getSynthesizedPracticeQuestion = (
  subject: BankSubject,
  sourceId: string,
): BankQuestion | null => synthesizedBankQuestions[subject].get(sourceId) ?? null;

const synthesizeBankQuestion = (
  rawQuestion: RawModuleQuestion,
  subject: BankSubject,
  baseQuestion?: BankQuestion,
): BankQuestion => {
  if (baseQuestion) {
    return {
      ...baseQuestion,
      inPracticeTests: true,
    };
  }

  const type: BankQuestion["type"] = rawQuestion.is_fill_in_blank ? "free-response" : "multiple-choice";
  const category: QuestionCategory = {
    subject: subject === "math" ? "Math" : "English",
    domain: rawQuestion.domain as QuestionCategory["domain"],
    skill: rawQuestion.skill as QuestionCategory["skill"],
    confidence: "high",
  };
  const moduleDifficulty: BankQuestion["difficulty"] = (() => {
    const d = (rawQuestion.difficulty ?? "").trim().toLowerCase();
    if (d === "easy") return "Easy";
    if (d === "medium") return "Medium";
    if (d === "hard") return "Hard";
    return null;
  })();
  const rawPrompt = rawQuestion.question_text ?? rawQuestion.passage ?? baseQuestion?.prompt ?? "";
  const stableId = baseQuestion?.stableId ?? buildBankQuestionKey("past", subject, rawQuestion.id);
  const similarityGroupId =
    baseQuestion?.similarityGroupId ?? questionSimilarityGroupByQuestion[stableId] ?? null;
  const similarityGroup = similarityGroupId
    ? questionSimilarityGroupsById[similarityGroupId]
    : null;
  return {
    id: baseQuestion?.id ?? 0,
    stableId,
    bankType: "past",
    bankLabel: "Official Bluebook",
    subject,
    sourceId: rawQuestion.id,
    questionNumber: rawQuestion.question_number,
    testName: rawQuestion.test_name,
    prompt: rawPrompt,
    passage: subject === "reading" ? rawQuestion.passage ?? baseQuestion?.passage : baseQuestion?.passage,
    questionText: rawQuestion.question_text ?? (subject === "math" ? rawPrompt : baseQuestion?.questionText),
    choices: type === "multiple-choice"
      ? rawQuestion.choices?.map((c) => ({
        id: c.label,
        text: c.text ?? "",
        image: c.image,
        imageDisplaySize: getSatImageDisplaySize(c.image),
      })) ?? baseQuestion?.choices
      : undefined,
    type,
    correctAnswer: rawQuestion.correct_answer ?? baseQuestion?.correctAnswer ?? null,
    rationale: rawQuestion.rationale ?? baseQuestion?.rationale ?? null,
    questionImages: rawQuestion.images?.map((img) => ({
      src: img.src,
      alt: img.alt ?? "",
      displaySize: getSatImageDisplaySize(img.src),
    })) ?? baseQuestion?.questionImages,
    difficulty: getPastQuestionDifficulty(rawQuestion.id) ?? moduleDifficulty ?? baseQuestion?.difficulty ?? null,
    inPracticeTests: true,
    category,
    similarityTag: similarityGroupId,
    similarityGroupId,
    similarityGroupLabel: baseQuestion?.similarityGroupLabel ?? similarityGroup?.label ?? null,
    similarityGroupSize: baseQuestion?.similarityGroupSize ?? similarityGroup?.questionKeys.length ?? null,
  };
};

const bankQuestionIndexBySubject: Record<BankSubject, Map<string, BankQuestion>> = {
  math: new Map(pastMathBank.map((question) => [question.sourceId, question])),
  reading: new Map(pastReadingBank.map((question) => [question.sourceId, question])),
};

const getModuleBankQuestion = (
  moduleSource: { subject: BankSubject },
  rawQuestion: RawModuleQuestion,
): BankQuestion | null => bankQuestionIndexBySubject[moduleSource.subject].get(rawQuestion.id) ?? null;

const rawModuleSources = Object.entries(rawModuleImports)
  .map(([modulePath, value]) => {
    const questions = normalizeModuleRecords(value);
    if (!questions) return null;
    const testName = questions[0]?.test_name;
    if (!testName) return null;
    const metadata = parseModuleTestName(testName);
    if (!metadata) return null;

    return {
      modulePath,
      fileName: modulePath.split("/").pop() ?? modulePath,
      metadata,
      testName: questions[0]?.test_name ?? metadata.id,
      subject: metadata.subject,
      moduleNumber: metadata.moduleNumber,
      questions: questions
        .slice()
        .sort((left, right) => left.question_number - right.question_number),
    };
  })
  .filter((value): value is NonNullable<typeof value> => Boolean(value));

const positionPatterns = new Map<string, PositionPattern>();

for (const subject of ["reading", "math"] as const) {
  for (const moduleNumber of [1, 2] as const) {
    const relevantModules = rawModuleSources.filter(
      (moduleSource) => moduleSource.subject === subject && moduleSource.moduleNumber === moduleNumber,
    );
    const targetCount = EXPECTED_COUNTS[subject];

    for (let slot = 1; slot <= targetCount; slot += 1) {
      const patternCounts = new Map<
        string,
        {
          skill: string;
          domain: string;
          type: BankQuestion["type"];
          support: number;
        }
      >();

      for (const moduleSource of relevantModules) {
        const question = moduleSource.questions.find((entry) => entry.question_number === slot);
        if (!question) continue;

        const bankQuestion = getModuleBankQuestion(moduleSource, question);
        const skill = String(bankQuestion?.category.skill ?? question.skill);
        const domain = String(bankQuestion?.category.domain ?? question.domain);
        const type = bankQuestion?.type ?? (question.is_fill_in_blank ? "free-response" : "multiple-choice");
        const key = `${skill}|||${domain}|||${type}`;
        const current = patternCounts.get(key);

        if (current) {
          current.support += 1;
        } else {
          patternCounts.set(key, {
            skill,
            domain,
            type,
            support: 1,
          });
        }
      }

      const rankedPatterns = [...patternCounts.values()].sort((left, right) => {
        if (left.support !== right.support) return right.support - left.support;
        if (left.skill !== right.skill) return left.skill.localeCompare(right.skill);
        if (left.domain !== right.domain) return left.domain.localeCompare(right.domain);
        return left.type.localeCompare(right.type);
      });

      const topPattern = rankedPatterns[0];
      if (!topPattern) continue;

      positionPatterns.set(`${subject}:${moduleNumber}:${slot}`, {
        skill: topPattern.skill,
        domain: topPattern.domain,
        type: topPattern.type,
        confidence: topPattern.support / relevantModules.length,
        support: topPattern.support,
        alternatives: rankedPatterns.slice(0, 3).map((pattern) => ({
          skill: pattern.skill,
          domain: pattern.domain,
          type: pattern.type,
          support: pattern.support,
        })),
      });
    }
  }
}

const candidateRecordsBySubject: Record<BankSubject, CandidateQuestionRecord[]> = {
  math: [],
  reading: [],
};

for (const moduleSource of rawModuleSources) {
  for (const question of moduleSource.questions) {
    const bankQuestion = getModuleBankQuestion(moduleSource, question);
    const moduleQuestion = synthesizeBankQuestion(question, moduleSource.subject, bankQuestion ?? undefined);
    synthesizedBankQuestions[moduleSource.subject].set(moduleQuestion.sourceId, moduleQuestion);

    candidateRecordsBySubject[moduleSource.subject].push({
      sourceId: moduleQuestion.sourceId,
      moduleId: moduleSource.metadata.slug,
      moduleNumber: moduleSource.moduleNumber,
      questionNumber: question.question_number,
      skill: String(moduleQuestion.category.skill),
      domain: String(moduleQuestion.category.domain),
      type: moduleQuestion.type,
      difficulty: moduleQuestion.difficulty ?? null,
      bankQuestion: moduleQuestion,
    });
  }
}

const replacementUsageCount = new Map<string, number>();

const buildReplacement = (
  moduleSource: (typeof rawModuleSources)[number],
  missingSlot: number,
  takenSourceIds: Set<string>,
): PracticeModuleQuestion | null => {
  const pattern =
    positionPatterns.get(`${moduleSource.subject}:${moduleSource.moduleNumber}:${missingSlot}`) ??
    {
      skill: moduleSource.subject === "math" ? "Equivalent expressions" : "Command of Evidence",
      domain: moduleSource.subject === "math" ? "Advanced Math" : "Information and Ideas",
      type: "multiple-choice" as const,
      confidence: 0,
      support: 0,
      alternatives: [],
    };

  const candidates = candidateRecordsBySubject[moduleSource.subject]
    .filter((candidate) => candidate.moduleId !== moduleSource.metadata.slug)
    .filter((candidate) => !takenSourceIds.has(candidate.sourceId))
    .map((candidate) => {
      const usagePenalty = replacementUsageCount.get(candidate.sourceId) ?? 0;
      let score = 0;

      if (candidate.skill === pattern.skill) score += 120;
      if (candidate.domain === pattern.domain) score += 60;
      if (candidate.type === pattern.type) score += 45;
      if (candidate.questionNumber === missingSlot) score += 25;
      if (candidate.moduleNumber === moduleSource.moduleNumber) score += 15;
      score -= usagePenalty * 1000;

      return {
        candidate,
        score,
      };
    })
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      const leftUsage = replacementUsageCount.get(left.candidate.sourceId) ?? 0;
      const rightUsage = replacementUsageCount.get(right.candidate.sourceId) ?? 0;
      if (leftUsage !== rightUsage) return leftUsage - rightUsage;
      return left.candidate.sourceId.localeCompare(right.candidate.sourceId);
    });

  const best = candidates[0]?.candidate;
  if (!best) return null;

  replacementUsageCount.set(best.sourceId, (replacementUsageCount.get(best.sourceId) ?? 0) + 1);
  takenSourceIds.add(best.sourceId);

  const replacement: ModuleReplacement = {
    slot: missingSlot,
    expectedSkill: pattern.skill,
    expectedDomain: pattern.domain,
    expectedType: pattern.type,
    profileConfidence: pattern.confidence,
    sourceId: best.sourceId,
    sourceTestName: best.bankQuestion.testName,
    sourceQuestionNumber: best.bankQuestion.questionNumber,
    origin: "borrowed",
    note: `Slot ${missingSlot} is usually ${pattern.skill} in ${moduleSource.metadata.subjectLabel} Module ${moduleSource.moduleNumber}, so this module borrows a comparable unused past-bank question.`,
  };

  return {
    slot: missingSlot,
    bankQuestion: best.bankQuestion,
    isReplacement: true,
    replacement,
  };
};

const practiceModules = rawModuleSources
  .map((moduleSource): PracticeModule => {
    const targetCount = EXPECTED_COUNTS[moduleSource.subject];
    const questionsBySlot = new Map(moduleSource.questions.map((question) => [question.question_number, question]));
    const missingQuestionNumbers: number[] = [];
    const takenSourceIds = new Set(
      moduleSource.questions
        .map((question) => question.id)
        .filter(Boolean),
    );
    const practiceQuestions: PracticeModuleQuestion[] = [];
    const replacements: ModuleReplacement[] = [];

    for (let slot = 1; slot <= targetCount; slot += 1) {
      const rawQuestion = questionsBySlot.get(slot);

      if (rawQuestion) {
        const baseBankQuestion = getModuleBankQuestion(moduleSource, rawQuestion);
        const bankQuestion = synthesizeBankQuestion(rawQuestion, moduleSource.subject, baseBankQuestion ?? undefined);
        synthesizedBankQuestions[moduleSource.subject].set(bankQuestion.sourceId, bankQuestion);
        practiceQuestions.push({
          slot,
          bankQuestion,
          isReplacement: false,
        });
        continue;
      }

      missingQuestionNumbers.push(slot);

      const replacementQuestion = buildReplacement(moduleSource, slot, takenSourceIds);
      if (!replacementQuestion) continue;

      practiceQuestions.push(replacementQuestion);
      if (replacementQuestion.replacement) {
        replacements.push(replacementQuestion.replacement);
      }
    }

    practiceQuestions.sort((left, right) => left.slot - right.slot);

    return {
      id: moduleSource.metadata.id,
      slug: moduleSource.metadata.slug,
      fileName: moduleSource.fileName,
      testName: moduleSource.testName,
      sourceIndex: moduleSource.metadata.sourceIndex,
      subject: moduleSource.subject,
      subjectLabel: moduleSource.metadata.subjectLabel,
      moduleNumber: moduleSource.moduleNumber,
      targetCount,
      originalCount: moduleSource.questions.length,
      questionCount: practiceQuestions.length,
      missingQuestionNumbers,
      repairedSlots: replacements.length,
      questions: practiceQuestions,
      replacements,
      setNumber: 0,
      publicTitle: `${moduleSource.metadata.subjectLabel} Module ${moduleSource.moduleNumber}`,
      publicSubtitle: "",
    };
  })
  .sort(sortPracticeModules);

const questionCountByModule = new Map(practiceModules.map((module) => [module.slug, module.questionCount]));

const duplicateIndex = new Map<string, string[]>();

for (const module of practiceModules) {
  for (const question of module.questions) {
    const existing = duplicateIndex.get(question.bankQuestion.sourceId);
    if (existing) {
      existing.push(module.slug);
    } else {
      duplicateIndex.set(question.bankQuestion.sourceId, [module.slug]);
    }
  }
}

const adjacency = new Map<string, Set<string>>();

for (const module of practiceModules) {
  adjacency.set(module.slug, new Set());
}

for (const owners of duplicateIndex.values()) {
  if (owners.length < 2) continue;
  for (let leftIndex = 0; leftIndex < owners.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < owners.length; rightIndex += 1) {
      const left = owners[leftIndex];
      const right = owners[rightIndex];
      adjacency.get(left)?.add(right);
      adjacency.get(right)?.add(left);
    }
  }
}

const compareSelection = (
  leftSlugs: string[],
  leftQuestions: number,
  rightSlugs: string[],
  rightQuestions: number,
) => {
  if (leftSlugs.length !== rightSlugs.length) return leftSlugs.length - rightSlugs.length;
  if (leftQuestions !== rightQuestions) return leftQuestions - rightQuestions;
  return rightSlugs.join("|").localeCompare(leftSlugs.join("|"));
};

const connectedComponents = () => {
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const module of practiceModules) {
    if (visited.has(module.slug)) continue;

    const stack = [module.slug];
    const component: string[] = [];
    visited.add(module.slug);

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      component.push(current);

      for (const neighbor of adjacency.get(current) ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        stack.push(neighbor);
      }
    }

    components.push(component);
  }

  return components;
};

const solveMaximumIndependentSet = (component: string[]) => {
  let bestSlugs: string[] = [];
  let bestQuestionCount = -1;

  const recurse = (remaining: Set<string>, chosenSlugs: string[], chosenQuestionCount: number) => {
    if (remaining.size === 0) {
      if (compareSelection(chosenSlugs, chosenQuestionCount, bestSlugs, bestQuestionCount) > 0) {
        bestSlugs = chosenSlugs.slice().sort();
        bestQuestionCount = chosenQuestionCount;
      }
      return;
    }

    const optimisticQuestionCount =
      chosenQuestionCount +
      [...remaining].reduce((total, slug) => total + (questionCountByModule.get(slug) ?? 0), 0);

    if (
      chosenSlugs.length + remaining.size < bestSlugs.length ||
      (
        chosenSlugs.length + remaining.size === bestSlugs.length &&
        optimisticQuestionCount <= bestQuestionCount
      )
    ) {
      return;
    }

    const candidate = [...remaining].sort((left, right) => {
      const degreeLeft = [...(adjacency.get(left) ?? [])].filter((neighbor) => remaining.has(neighbor)).length;
      const degreeRight = [...(adjacency.get(right) ?? [])].filter((neighbor) => remaining.has(neighbor)).length;
      if (degreeLeft !== degreeRight) return degreeRight - degreeLeft;
      return left.localeCompare(right);
    })[0];

    if (!candidate) return;

    const includeRemaining = new Set(remaining);
    includeRemaining.delete(candidate);
    for (const neighbor of adjacency.get(candidate) ?? []) {
      includeRemaining.delete(neighbor);
    }

    recurse(
      includeRemaining,
      [...chosenSlugs, candidate],
      chosenQuestionCount + (questionCountByModule.get(candidate) ?? 0),
    );

    const excludeRemaining = new Set(remaining);
    excludeRemaining.delete(candidate);
    recurse(excludeRemaining, chosenSlugs, chosenQuestionCount);
  };

  recurse(new Set(component), [], 0);
  return bestSlugs;
};

const visibleModuleSlugSet = new Set(
  connectedComponents().flatMap((component) =>
    component.length === 1 ? component : solveMaximumIndependentSet(component),
  ),
);

const visiblePracticeModulesBase = practiceModules
  .filter((module) => visibleModuleSlugSet.has(module.slug))
  .sort(sortPracticeModules);

const visiblePracticeModules = (() => {
  const groupCounts = new Map<string, number>();

  return visiblePracticeModulesBase.map((module) => {
    const groupKey = `${module.subject}:${module.moduleNumber}`;
    const nextIndex = (groupCounts.get(groupKey) ?? 0) + 1;
    groupCounts.set(groupKey, nextIndex);
    const publicSubjectSlug = module.subject === "reading" ? "eng" : "math";
    const publicTitle = `${module.subjectLabel} Module ${module.moduleNumber}`;
    const publicSubtitle = `Practice Test ${nextIndex}`;
    const publicTestName = `${publicSubtitle} ${publicTitle}`;
    const publicSlug = `practice-test-${nextIndex}-${publicSubjectSlug}-m${module.moduleNumber}`;
    const questions = module.questions.map((entry) => ({
      ...entry,
      bankQuestion: {
        ...entry.bankQuestion,
        testName: publicTestName,
      },
      replacement: entry.replacement
        ? {
          ...entry.replacement,
          sourceTestName: "Practice Bank",
        }
        : undefined,
    }));

    for (const entry of questions) {
      synthesizedBankQuestions[module.subject].set(entry.bankQuestion.sourceId, entry.bankQuestion);
    }

    return {
      ...module,
      id: `practice_test_${nextIndex}_${publicSubjectSlug}_m${module.moduleNumber}`,
      slug: publicSlug,
      testName: publicTestName,
      setNumber: nextIndex,
      publicTitle,
      publicSubtitle,
      questions,
      replacements: questions
        .map((entry) => entry.replacement)
        .filter((replacement): replacement is ModuleReplacement => Boolean(replacement)),
    };
  });
})();

const visibleModulesByGroup = {
  reading1: visiblePracticeModules.filter((module) => module.subject === "reading" && module.moduleNumber === 1),
  reading2: visiblePracticeModules.filter((module) => module.subject === "reading" && module.moduleNumber === 2),
  math1: visiblePracticeModules.filter((module) => module.subject === "math" && module.moduleNumber === 1),
  math2: visiblePracticeModules.filter((module) => module.subject === "math" && module.moduleNumber === 2),
};

const totalPracticeSets = Math.min(
  visibleModulesByGroup.reading1.length,
  visibleModulesByGroup.reading2.length,
  visibleModulesByGroup.math1.length,
  visibleModulesByGroup.math2.length,
);

const visiblePracticeSetModules = new Set<string>();

export const practiceSets: PracticeSet[] = Array.from({ length: totalPracticeSets }, (_, index) => {
  const setNumber = index + 1;
  const modules = [
    visibleModulesByGroup.reading1[index],
    visibleModulesByGroup.reading2[index],
    visibleModulesByGroup.math1[index],
    visibleModulesByGroup.math2[index],
  ];

  for (const module of modules) {
    visiblePracticeSetModules.add(module.slug);
  }

  return {
    id: `practice-test-${setNumber}`,
    setNumber,
    modules,
  };
});

const duplicateCheck = new Map<string, string>();
for (const practiceSet of practiceSets) {
  for (const module of practiceSet.modules) {
  for (const question of module.questions) {
    const existingOwner = duplicateCheck.get(question.bankQuestion.sourceId);
    if (existingOwner) {
      throw new Error(`Duplicate question ${question.bankQuestion.sourceId} found in ${existingOwner} and ${module.slug}`);
    }
    duplicateCheck.set(question.bankQuestion.sourceId, module.slug);
  }
  }
}

export const modulePracticeBankSummary: ModulePracticeBankSummary = {
  totalPracticeSets,
  removedModules: practiceModules.length - visiblePracticeSetModules.size,
};

export const getPracticeSets = (): PracticeSet[] => practiceSets;

export const getPracticeSet = (setIdOrNumber: string | number): PracticeSet | null => {
  const normalized =
    typeof setIdOrNumber === "number"
      ? setIdOrNumber
      : Number.parseInt(String(setIdOrNumber).replace(/^practice-(?:set|test)-/, ""), 10);

  return practiceSets.find((practiceSet) =>
    practiceSet.id === String(setIdOrNumber) || practiceSet.setNumber === normalized,
  ) ?? null;
};

export const getPracticeModules = (): PracticeModule[] =>
  practiceSets.flatMap((practiceSet) => practiceSet.modules);

export const getPracticeModule = (moduleIdOrSlug: string): PracticeModule | null =>
  visiblePracticeModules.find((module) => module.id === moduleIdOrSlug || module.slug === moduleIdOrSlug) ?? null;

export const buildModulePracticeSet = (moduleIdOrSlug: string) => {
  const module = getPracticeModule(moduleIdOrSlug);
  if (!module) return null;

  return module.questions.map((entry, index) => ({
    subject: module.subject,
    id: entry.bankQuestion.id,
    sourceId: entry.bankQuestion.sourceId,
    bankType: "past" as const,
    storageId: entry.bankQuestion.stableId,
    index,
  }));
};

export const buildPracticeTestQuestionSet = (
  setIdOrNumber: string | number,
): PracticeTestQuestionItem[] | null => {
  const practiceSet = getPracticeSet(setIdOrNumber);
  if (!practiceSet) return null;

  let globalQuestionNumber = 0;

  return practiceSet.modules.flatMap((module) =>
    module.questions.map((entry) => {
      globalQuestionNumber += 1;

      return {
        subject: module.subject,
        id: entry.bankQuestion.id,
        sourceId: entry.bankQuestion.sourceId,
        bankType: "past" as const,
        storageId: entry.bankQuestion.stableId,
        practiceSetId: practiceSet.id,
        practiceSetNumber: practiceSet.setNumber,
        moduleSlug: module.slug,
        moduleNumber: module.moduleNumber,
        moduleTitle: module.publicTitle,
        moduleQuestionNumber: entry.slot,
        globalQuestionNumber,
      };
    }),
  );
};

export const activePastQuestionSourceIds = new Set(
  getPracticeModules().flatMap((module) => module.questions.map((entry) => entry.bankQuestion.sourceId)),
);
