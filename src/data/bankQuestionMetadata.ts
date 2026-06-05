import {
  BANK_COUNT_INDEX,
  BANK_QUESTION_META_ROWS,
  type BankQuestionMetaRow,
} from "@/lib/generated/bankMetadata.generated";
import {
  defaultFilters,
  MAX_TIME_SPENT_FILTER_SECONDS,
  type QuestionBankFilters,
} from "@/components/question/questionBankFilterModel";
import type { BankSourceFilter, BankSubject } from "@/data/bankTypes";

export interface BankQuestionMeta {
  stableId: string;
  sourceId: string;
  bankType: "past" | "unofficial";
  subject: BankSubject;
  category: {
    domain: string;
    skill: string;
  };
  difficulty: "Easy" | "Medium" | "Hard" | null;
  active: boolean;
  bankVisible: boolean;
}

export interface BankQuestionProgressSnapshot {
  questionId: string;
  isMarkedForReview: boolean;
  attempts: Array<{ result: "correct" | "incorrect" }>;
  totalTimeSpentSeconds: number;
}

export type BankQuestionProgressLookup = (question: BankQuestionMeta) => BankQuestionProgressSnapshot;

export interface QuestionCountBucket {
  total: number;
  correct: number;
  domains: Record<string, { total: number; correct: number }>;
  skills: Record<string, { total: number; correct: number }>;
}

export interface QuestionCountTree {
  math: QuestionCountBucket;
  reading: QuestionCountBucket;
}

const EMPTY_PROGRESS: BankQuestionProgressSnapshot = {
  questionId: "",
  isMarkedForReview: false,
  attempts: [],
  totalTimeSpentSeconds: 0,
};

const toMeta = (row: BankQuestionMetaRow): BankQuestionMeta => ({
  stableId: row[0],
  sourceId: row[1],
  bankType: row[2],
  subject: row[3],
  category: {
    domain: row[4],
    skill: row[5],
  },
  difficulty: row[6],
  active: row[7],
  bankVisible: row[8],
});

const metaRows = BANK_QUESTION_META_ROWS.map(toMeta);

export const activePastQuestionSourceIds = new Set(
  metaRows
    .filter((question) => question.bankType === "past" && question.active)
    .map((question) => question.sourceId),
);

const emptyBucket = (): QuestionCountBucket => ({
  total: 0,
  correct: 0,
  domains: {},
  skills: {},
});

const emptyTree = (): QuestionCountTree => ({
  math: emptyBucket(),
  reading: emptyBucket(),
});

const isSolved = (progress: BankQuestionProgressSnapshot) =>
  progress.attempts.some((attempt) => attempt.result === "correct");

const isAnsweredIncorrectly = (progress: BankQuestionProgressSnapshot) =>
  progress.attempts.length > 0 && !isSolved(progress);

const matchesBankSource = (question: BankQuestionMeta, bankSource: BankSourceFilter) =>
  bankSource === "all" || question.bankType === bankSource;

const matchesDifficulty = (question: BankQuestionMeta, filters: QuestionBankFilters) => {
  if (filters.difficulty.length === 0) return true;
  const difficulty = (question.difficulty ?? "").toLowerCase();
  return filters.difficulty.includes(difficulty as QuestionBankFilters["difficulty"][number]);
};

const matchesActiveFilter = (question: BankQuestionMeta, filters: QuestionBankFilters) => {
  if (filters.activeQuestions === "all") return true;
  if (filters.activeQuestions === "active") return question.active;
  return !question.active;
};

export const questionMetaPassesFilters = (
  question: BankQuestionMeta,
  filters: QuestionBankFilters,
  getProgress: BankQuestionProgressLookup,
) => {
  if (!matchesDifficulty(question, filters)) return false;
  if (!matchesActiveFilter(question, filters)) return false;

  const progress = getProgress(question);

  if (filters.markedForReview !== "all") {
    if (filters.markedForReview === "yes" && !progress.isMarkedForReview) return false;
    if (filters.markedForReview === "no" && progress.isMarkedForReview) return false;
  }

  if (filters.solved !== "all") {
    const solved = isSolved(progress);
    if (filters.solved === "yes" && !solved) return false;
    if (filters.solved === "no" && solved) return false;
  }

  if (filters.answeredIncorrectly !== "all") {
    const incorrect = isAnsweredIncorrectly(progress);
    if (filters.answeredIncorrectly === "yes" && !incorrect) return false;
    if (filters.answeredIncorrectly === "no" && incorrect) return false;
  }

  const [minTimeSpent, maxTimeSpent] = filters.timeSpentRange;
  if (progress.totalTimeSpentSeconds < minTimeSpent) return false;
  if (
    maxTimeSpent < MAX_TIME_SPENT_FILTER_SECONDS &&
    progress.totalTimeSpentSeconds > maxTimeSpent
  ) {
    return false;
  }

  return true;
};

const addQuestion = (
  bucket: QuestionCountBucket,
  question: BankQuestionMeta,
  progress: BankQuestionProgressSnapshot,
) => {
  const correct = isSolved(progress) ? 1 : 0;
  const { domain, skill } = question.category;

  bucket.total += 1;
  bucket.correct += correct;

  const domainBucket = bucket.domains[domain] ?? { total: 0, correct: 0 };
  domainBucket.total += 1;
  domainBucket.correct += correct;
  bucket.domains[domain] = domainBucket;

  const skillBucket = bucket.skills[skill] ?? { total: 0, correct: 0 };
  skillBucket.total += 1;
  skillBucket.correct += correct;
  bucket.skills[skill] = skillBucket;
};

const hasProgressFilters = (filters: QuestionBankFilters) =>
  filters.markedForReview !== defaultFilters.markedForReview ||
  filters.solved !== defaultFilters.solved ||
  filters.answeredIncorrectly !== defaultFilters.answeredIncorrectly ||
  filters.timeSpentRange[0] !== defaultFilters.timeSpentRange[0] ||
  filters.timeSpentRange[1] !== defaultFilters.timeSpentRange[1];

const hasQuestionFilters = (filters: QuestionBankFilters) =>
  filters.difficulty.length > 0 ||
  filters.activeQuestions !== defaultFilters.activeQuestions ||
  hasProgressFilters(filters);

export const getBankQuestionMetaRows = (
  subject: BankSubject,
  bankSource: BankSourceFilter,
) => metaRows.filter(
  (question) => question.bankVisible && question.subject === subject && matchesBankSource(question, bankSource),
);

export const getQuestionCountTree = (
  bankSource: BankSourceFilter,
  filters: QuestionBankFilters,
  getProgress: BankQuestionProgressLookup,
): QuestionCountTree => {
  const tree = emptyTree();

  if (!hasQuestionFilters(filters) && getProgress === getEmptyProgress) {
    for (const subject of ["math", "reading"] as const) {
      const generated = BANK_COUNT_INDEX[bankSource][subject];
      const bucket = tree[subject];
      bucket.total = generated.total;
      for (const [domain, total] of Object.entries(generated.domains)) {
        bucket.domains[domain] = { total, correct: 0 };
      }
      for (const [skill, total] of Object.entries(generated.skills)) {
        bucket.skills[skill] = { total, correct: 0 };
      }
    }
    return tree;
  }

  for (const question of metaRows) {
    if (!question.bankVisible) continue;
    if (!matchesBankSource(question, bankSource)) continue;
    if (!questionMetaPassesFilters(question, filters, getProgress)) continue;
    addQuestion(tree[question.subject], question, getProgress(question));
  }

  return tree;
};

export const getFilteredQuestionMetaCount = (
  subject: BankSubject,
  bankSource: BankSourceFilter,
  filters: QuestionBankFilters,
  getProgress: BankQuestionProgressLookup,
  options: {
    domain?: string;
    skill?: string;
  } = {},
) => {
  let total = 0;
  for (const question of metaRows) {
    if (!question.bankVisible) continue;
    if (question.subject !== subject) continue;
    if (!matchesBankSource(question, bankSource)) continue;
    if (options.domain && question.category.domain !== options.domain) continue;
    if (options.skill && question.category.skill !== options.skill) continue;
    if (!questionMetaPassesFilters(question, filters, getProgress)) continue;
    total += 1;
  }
  return total;
};

export const getEmptyProgress: BankQuestionProgressLookup = (question) => ({
  ...EMPTY_PROGRESS,
  questionId: question.stableId,
});
