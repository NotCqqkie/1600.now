import {
  getAllBankQuestions,
  type BankQuestion,
  type BankSubject,
} from "@/data/questionBank";

const rawModuleImports = import.meta.glob("./Modules/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

const monthOrder = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const monthRank = Object.fromEntries(monthOrder.map((month, index) => [month, index])) as Record<string, number>;

const EXPECTED_COUNTS: Record<BankSubject, number> = {
  reading: 27,
  math: 22,
};

type ModuleSubjectLabel = "Math" | "Reading & Writing";
type ReplacementOrigin = "borrowed";

interface RawModuleChoice {
  label: string;
  text?: string;
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
  month: string;
  year: number;
  region: string | null;
  form: string | null;
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
  month: string;
  year: number;
  region: string | null;
  form: string | null;
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

const parseModulePath = (modulePath: string): ParsedModuleMetadata | null => {
  const match = modulePath.match(
    /\.\/Modules\/([A-Za-z]+)_(\d{4})(?:_(US|International))?(?:_Form_([A-Z0-9]+))?_SAT_(English|Math)_Module_(1|2)\.json$/,
  );

  if (!match) return null;

  const [, month, yearText, region, form, rawSubject, moduleNumberText] = match;
  const year = Number.parseInt(yearText, 10);
  const moduleNumber = Number.parseInt(moduleNumberText, 10) as 1 | 2;
  const subject = rawSubject === "Math" ? "math" : "reading";
  const subjectLabel: ModuleSubjectLabel = subject === "math" ? "Math" : "Reading & Writing";
  const slug = `${month}-${year}-${region ?? "global"}-${form ?? "na"}-${rawSubject}-module-${moduleNumber}`
    .replace(/[^a-z0-9-]/gi, "-")
    .toLowerCase();

  return {
    month,
    year,
    region: region ?? null,
    form: form ?? null,
    subject,
    subjectLabel,
    moduleNumber,
    id: `${month}_${year}_${region ?? "Global"}_${form ?? "NA"}_${rawSubject}_Module_${moduleNumber}`,
    slug,
  };
};

const sortPracticeModules = (left: PracticeModule, right: PracticeModule) => {
  if (left.year !== right.year) return right.year - left.year;
  if (left.month !== right.month) return (monthRank[right.month] ?? -1) - (monthRank[left.month] ?? -1);
  if (left.subject !== right.subject) return left.subject.localeCompare(right.subject);
  if (left.moduleNumber !== right.moduleNumber) return left.moduleNumber - right.moduleNumber;
  return left.testName.localeCompare(right.testName);
};

const pastMathBank = getAllBankQuestions("math", "past");
const pastReadingBank = getAllBankQuestions("reading", "past");

const bankQuestionIndexBySubject: Record<BankSubject, Map<string, BankQuestion>> = {
  math: new Map(pastMathBank.map((question) => [question.sourceId, question])),
  reading: new Map(pastReadingBank.map((question) => [question.sourceId, question])),
};

const rawModuleSources = Object.entries(rawModuleImports)
  .map(([modulePath, value]) => {
    const questions = normalizeModuleRecords(value);
    const metadata = parseModulePath(modulePath);
    if (!questions || !metadata) return null;

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

const usedPastQuestionIds = new Set(
  rawModuleSources.flatMap((moduleSource) => moduleSource.questions.map((question) => question.id)),
);

const unusedPastQuestions = [...pastMathBank, ...pastReadingBank].filter(
  (question) => !usedPastQuestionIds.has(question.sourceId),
);

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

        const type: BankQuestion["type"] = question.is_fill_in_blank ? "free-response" : "multiple-choice";
        const key = `${question.skill}|||${question.domain}|||${type}`;
        const current = patternCounts.get(key);

        if (current) {
          current.support += 1;
        } else {
          patternCounts.set(key, {
            skill: question.skill,
            domain: question.domain,
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
  const bankIndex = bankQuestionIndexBySubject[moduleSource.subject];

  for (const question of moduleSource.questions) {
    const bankQuestion = bankIndex.get(question.id);
    if (!bankQuestion) continue;

    candidateRecordsBySubject[moduleSource.subject].push({
      sourceId: question.id,
      moduleId: moduleSource.metadata.slug,
      moduleNumber: moduleSource.moduleNumber,
      questionNumber: question.question_number,
      skill: question.skill,
      domain: question.domain,
      type: question.is_fill_in_blank ? "free-response" : "multiple-choice",
      difficulty: question.difficulty ?? null,
      bankQuestion,
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
    note: `Slot ${missingSlot} is usually ${pattern.skill} in ${moduleSource.metadata.subjectLabel} Module ${moduleSource.moduleNumber}, so this module borrows a matching past-bank question.`,
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
    const takenSourceIds = new Set(moduleSource.questions.map((question) => question.id));
    const practiceQuestions: PracticeModuleQuestion[] = [];
    const replacements: ModuleReplacement[] = [];

    for (let slot = 1; slot <= targetCount; slot += 1) {
      const rawQuestion = questionsBySlot.get(slot);

      if (rawQuestion) {
        const bankQuestion = bankQuestionIndexBySubject[moduleSource.subject].get(rawQuestion.id);
        if (bankQuestion) {
          practiceQuestions.push({
            slot,
            bankQuestion,
            isReplacement: false,
          });
        }
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
      month: moduleSource.metadata.month,
      year: moduleSource.metadata.year,
      region: moduleSource.metadata.region,
      form: moduleSource.metadata.form,
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

    return {
      ...module,
      setNumber: nextIndex,
      publicTitle: `${module.subjectLabel} Module ${module.moduleNumber}`,
      publicSubtitle: `Practice Set ${nextIndex}`,
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
    id: `practice-set-${setNumber}`,
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

export const activePastQuestionSourceIds = new Set(
  getPracticeModules().flatMap((module) => module.questions.map((entry) => entry.bankQuestion.sourceId)),
);
