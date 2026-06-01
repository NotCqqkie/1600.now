export type DifficultyFilterValue = "easy" | "medium" | "hard";

export const MAX_TIME_SPENT_FILTER_SECONDS = 180;
export const DEFAULT_TIME_SPENT_RANGE: [number, number] = [0, MAX_TIME_SPENT_FILTER_SECONDS];

export interface QuestionBankFilters {
  difficulty: DifficultyFilterValue[];
  timeSpentRange: [number, number];
  activeQuestions: "all" | "active" | "exclude-active";
  markedForReview: "all" | "yes" | "no";
  solved: "all" | "yes" | "no";
  answeredIncorrectly: "all" | "yes" | "no";
}

export const defaultFilters: QuestionBankFilters = {
  difficulty: [],
  timeSpentRange: DEFAULT_TIME_SPENT_RANGE,
  activeQuestions: "all",
  markedForReview: "all",
  solved: "all",
  answeredIncorrectly: "all",
};

export const hasActiveQuestionBankFilters = (filters: QuestionBankFilters): boolean =>
  filters.difficulty.length > 0 ||
  filters.timeSpentRange[0] !== DEFAULT_TIME_SPENT_RANGE[0] ||
  filters.timeSpentRange[1] !== DEFAULT_TIME_SPENT_RANGE[1] ||
  filters.activeQuestions !== defaultFilters.activeQuestions ||
  filters.markedForReview !== defaultFilters.markedForReview ||
  filters.solved !== defaultFilters.solved ||
  filters.answeredIncorrectly !== defaultFilters.answeredIncorrectly;
