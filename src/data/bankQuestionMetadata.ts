import { BANK_COUNT_INDEX } from "@/lib/generated/bankCountIndex.generated";
import {
  hasActiveQuestionBankFilters,
  MAX_TIME_SPENT_FILTER_SECONDS,
  MIN_SCORE_BAND,
  MAX_SCORE_BAND,
  type QuestionBankFilters,
} from "@/lib/questionBankFilters";
import type { BankSourceFilter, BankSubject } from "@/data/bankTypes";

type BankQuestionMetaRow = [
  stableId: string,
  sourceId: string,
  bankType: "past" | "unofficial",
  subject: BankSubject,
  domain: string,
  skill: string,
  difficulty: "Easy" | "Medium" | "Hard" | null,
  active: boolean,
  bankVisible: boolean,
  scoreBand: number | null,
];

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
  scoreBand: number | null;
}

interface BankQuestionProgressSnapshot {
  questionId: string;
  isMarkedForReview: boolean;
  attempts: Array<{ result: "correct" | "incorrect" }>;
  totalTimeSpentSeconds: number;
}

export type BankQuestionProgressLookup = (question: BankQuestionMeta) => BankQuestionProgressSnapshot;

interface QuestionCountBucket {
  total: number;
  correct: number;
  domains: Record<string, { total: number; correct: number }>;
  skills: Record<string, { total: number; correct: number }>;
}

interface QuestionCountTree {
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
  scoreBand: row[9],
});

let metaRowsPromise: Promise<BankQuestionMeta[]> | null = null;

const loadMetaRows = () => {
  metaRowsPromise ??= import("@/lib/generated/bankMetadata.generated").then((mod) =>
    (mod.BANK_QUESTION_META_ROWS as BankQuestionMetaRow[]).map(toMeta),
  );
  return metaRowsPromise;
};

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

const matchesScoreBand = (question: BankQuestionMeta, filters: QuestionBankFilters) => {
  const [minBand, maxBand] = filters.scoreBandRange;
  if (minBand <= MIN_SCORE_BAND && maxBand >= MAX_SCORE_BAND) return true;
  if (question.scoreBand == null) return false;
  return question.scoreBand >= minBand && question.scoreBand <= maxBand;
};

const matchesActiveFilter = (question: BankQuestionMeta, filters: QuestionBankFilters) => {
  if (filters.activeQuestions === "all") return true;
  if (filters.activeQuestions === "active") return question.active;
  return !question.active;
};

const questionMetaPassesFilters = (
  question: BankQuestionMeta,
  filters: QuestionBankFilters,
  getProgress: BankQuestionProgressLookup,
) => {
  if (!matchesScoreBand(question, filters)) return false;
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

const addCountEntry = (
  counts: QuestionCountBucket["domains"],
  key: string,
  total: number,
  correct: number,
) => {
  const entry = counts[key] ?? { total: 0, correct: 0 };
  entry.total += total;
  entry.correct += correct;
  counts[key] = entry;
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
  addCountEntry(bucket.domains, domain, 1, correct);
  addCountEntry(bucket.skills, skill, 1, correct);
};

export const loadBankQuestionMetaRows = async (
  subject: BankSubject,
  bankSource: BankSourceFilter,
): Promise<BankQuestionMeta[]> =>
  (await loadMetaRows()).filter(
    (question) => question.bankVisible && question.subject === subject && matchesBankSource(question, bankSource),
  );

export const getDefaultQuestionCountTree = (
  bankSource: BankSourceFilter,
): QuestionCountTree => {
  const tree = emptyTree();
  for (const subject of ["math", "reading"] as const) {
    const generated = BANK_COUNT_INDEX[bankSource][subject];
    const bucket = tree[subject];
    bucket.total = generated.total;
    for (const [domain, total] of Object.entries(generated.domains)) {
      addCountEntry(bucket.domains, domain, total, 0);
    }
    for (const [skill, total] of Object.entries(generated.skills)) {
      addCountEntry(bucket.skills, skill, total, 0);
    }
  }
  return tree;
};

export const loadQuestionCountTree = async (
  bankSource: BankSourceFilter,
  filters: QuestionBankFilters,
  getProgress: BankQuestionProgressLookup,
): Promise<QuestionCountTree> => {
  const tree = emptyTree();

  if (!hasActiveQuestionBankFilters(filters) && getProgress === getEmptyProgress) {
    return getDefaultQuestionCountTree(bankSource);
  }

  const metaRows = await loadMetaRows();
  for (const question of metaRows) {
    if (!question.bankVisible) continue;
    if (!matchesBankSource(question, bankSource)) continue;
    if (!questionMetaPassesFilters(question, filters, getProgress)) continue;
    addQuestion(tree[question.subject], question, getProgress(question));
  }

  return tree;
};

export const loadFilteredQuestionMetaRows = async (
  subject: BankSubject,
  bankSource: BankSourceFilter,
  filters: QuestionBankFilters,
  getProgress: BankQuestionProgressLookup,
  options: {
    domain?: string;
    skill?: string;
  } = {},
): Promise<BankQuestionMeta[]> => {
  const metaRows = await loadMetaRows();
  return metaRows.filter((question) => {
    if (!question.bankVisible) return false;
    if (question.subject !== subject) return false;
    if (!matchesBankSource(question, bankSource)) return false;
    if (options.domain && question.category.domain !== options.domain) return false;
    if (options.skill && question.category.skill !== options.skill) return false;
    return questionMetaPassesFilters(question, filters, getProgress);
  });
};

export const loadFilteredQuestionMetaCount = async (
  subject: BankSubject,
  bankSource: BankSourceFilter,
  filters: QuestionBankFilters,
  getProgress: BankQuestionProgressLookup,
  options: {
    domain?: string;
    skill?: string;
  } = {},
) => (await loadFilteredQuestionMetaRows(subject, bankSource, filters, getProgress, options)).length;

export const getEmptyProgress: BankQuestionProgressLookup = (question) => ({
  ...EMPTY_PROGRESS,
  questionId: question.stableId,
});
