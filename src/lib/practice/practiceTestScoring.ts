type Subject = "reading" | "math";
type Difficulty = "Easy" | "Medium" | "Hard" | string | null | undefined;

export type PracticeTestScoringQuestion = {
  isAnswered: boolean;
  isCorrect: boolean;
  difficulty?: Difficulty;
};

export type PracticeTestScoringModule = {
  moduleSlug: string;
  subject: Subject;
  moduleNumber: 1 | 2;
  questions: PracticeTestScoringQuestion[];
};

type ModuleEstimate = {
  moduleSlug: string;
  subject: Subject;
  moduleNumber: 1 | 2;
  questionCount: number;
  weightedAccuracy: number;
  rawAccuracy: number;
  hardness: number;
  easyMissRate: number;
  hardCorrectRate: number;
};

type SectionEstimate = {
  sectionScore: number;
  moduleScores: Record<string, number>;
};

export type PracticeTestScoreEstimate = {
  readingWritingScore: number;
  mathScore: number;
  totalScore: number;
  moduleScores: Record<string, number>;
};

const sectionConfig: Record<Subject, { lowCeiling: number; highFloor: number }> = {
  reading: { lowCeiling: 620, highFloor: 390 },
  math: { lowCeiling: 650, highFloor: 420 },
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const lerp = (start: number, end: number, amount: number) =>
  start + (end - start) * amount;

const smoothstep = (value: number) => {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
};

const roundToTen = (value: number) =>
  clamp(Math.round(value / 10) * 10, 200, 800);

const normalizeDifficulty = (difficulty: Difficulty) => {
  const normalized = String(difficulty ?? "").trim().toLowerCase();
  if (normalized === "easy") return "easy";
  if (normalized === "hard") return "hard";
  return "medium";
};

const difficultyWeight = (difficulty: Difficulty) => {
  const normalized = normalizeDifficulty(difficulty);
  if (normalized === "easy") return 0.82;
  if (normalized === "hard") return 1.28;
  return 1;
};

const missPenalty = (difficulty: Difficulty) => {
  const normalized = normalizeDifficulty(difficulty);
  if (normalized === "easy") return 0.18;
  if (normalized === "hard") return 0.04;
  return 0.1;
};

const estimateModule = (module: PracticeTestScoringModule): ModuleEstimate => {
  let possible = 0;
  let evidence = 0;
  let easyCount = 0;
  let easyMisses = 0;
  let hardCount = 0;
  let hardCorrect = 0;
  let correctCount = 0;
  let hardnessTotal = 0;

  module.questions.forEach((question) => {
    const difficulty = normalizeDifficulty(question.difficulty);
    const weight = difficultyWeight(question.difficulty);
    possible += weight;
    hardnessTotal += weight;

    if (difficulty === "easy") {
      easyCount += 1;
      if (!question.isCorrect) easyMisses += 1;
    }

    if (difficulty === "hard") {
      hardCount += 1;
      if (question.isCorrect) hardCorrect += 1;
    }

    if (question.isCorrect) {
      evidence += weight;
      correctCount += 1;
    } else if (question.isAnswered) {
      evidence -= missPenalty(question.difficulty);
    } else {
      evidence -= weight * 0.22;
    }
  });

  return {
    moduleSlug: module.moduleSlug,
    subject: module.subject,
    moduleNumber: module.moduleNumber,
    questionCount: module.questions.length,
    weightedAccuracy: possible ? clamp(evidence / possible, 0, 1) : 0,
    rawAccuracy: module.questions.length ? correctCount / module.questions.length : 0,
    hardness: module.questions.length ? hardnessTotal / module.questions.length : 1,
    easyMissRate: easyCount ? easyMisses / easyCount : 0,
    hardCorrectRate: hardCount ? hardCorrect / hardCount : 0,
  };
};

const distributeModuleScores = (sectionScore: number, modules: ModuleEstimate[]) => {
  if (modules.length === 0) return {};
  if (modules.length === 1) return { [modules[0].moduleSlug]: sectionScore };

  const variableScore = Math.max(0, sectionScore - 200);
  const weights = modules.map((module) =>
    Math.max(0.05, module.weightedAccuracy * Math.max(1, module.questionCount)),
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || modules.length;
  const moduleScores: Record<string, number> = {};
  let assigned = 0;

  modules.forEach((module, index) => {
    if (index === modules.length - 1) {
      moduleScores[module.moduleSlug] = sectionScore - assigned;
      return;
    }

    const score = Math.round((100 + variableScore * (weights[index] / totalWeight)) / 10) * 10;
    moduleScores[module.moduleSlug] = score;
    assigned += score;
  });

  return moduleScores;
};

const estimateSection = (subject: Subject, modules: PracticeTestScoringModule[]): SectionEstimate => {
  const estimates = modules
    .map(estimateModule)
    .sort((left, right) => left.moduleNumber - right.moduleNumber);

  if (estimates.length === 0) {
    return {
      sectionScore: 200,
      moduleScores: {},
    };
  }

  const weightedCorrect = estimates.reduce(
    (sum, module) => sum + module.weightedAccuracy * Math.max(1, module.questionCount),
    0,
  );
  const weightedPossible = estimates.reduce((sum, module) => sum + Math.max(1, module.questionCount), 0);
  const weightedAccuracy = weightedPossible ? weightedCorrect / weightedPossible : 0;
  const baseScore = 200 + 600 * smoothstep(weightedAccuracy);
  const moduleOne = estimates.find((module) => module.moduleNumber === 1) ?? estimates[0];
  const moduleTwo = estimates.find((module) => module.moduleNumber === 2);
  const routeByModuleOne = smoothstep((moduleOne.weightedAccuracy - 0.52) / 0.26);
  const moduleTwoHardness = moduleTwo ? clamp((moduleTwo.hardness - 0.84) / 0.44, 0, 1) : routeByModuleOne;
  const adaptiveStrength = clamp(routeByModuleOne * 0.72 + moduleTwoHardness * 0.28, 0, 1);
  const config = sectionConfig[subject];
  const adaptiveFloor = lerp(200, config.highFloor, adaptiveStrength);
  const adaptiveCeiling = lerp(config.lowCeiling, 800, adaptiveStrength);
  const inconsistencyPenalty = estimates.reduce((penalty, module) => {
    if (module.hardCorrectRate <= 0.45 || module.easyMissRate <= 0.25) return penalty;
    return penalty + (module.hardCorrectRate - 0.45) * module.easyMissRate * 35;
  }, 0);
  const sectionScore = roundToTen(clamp(baseScore - inconsistencyPenalty, adaptiveFloor, adaptiveCeiling));

  return {
    sectionScore,
    moduleScores: distributeModuleScores(sectionScore, estimates),
  };
};

export const calculatePracticeTestScores = (
  modules: PracticeTestScoringModule[],
): PracticeTestScoreEstimate => {
  const reading = estimateSection("reading", modules.filter((module) => module.subject === "reading"));
  const math = estimateSection("math", modules.filter((module) => module.subject === "math"));
  const moduleScores = {
    ...reading.moduleScores,
    ...math.moduleScores,
  };

  return {
    readingWritingScore: reading.sectionScore,
    mathScore: math.sectionScore,
    totalScore: reading.sectionScore + math.sectionScore,
    moduleScores,
  };
};
