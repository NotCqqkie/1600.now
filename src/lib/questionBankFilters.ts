export const MAX_TIME_SPENT_FILTER_SECONDS = 180;

const DIFFICULTY_FILTER_VALUES = ["easy", "medium", "hard"] as const;
const ACTIVE_QUESTION_FILTER_VALUES = ["all", "active", "exclude-active"] as const;
const TRI_STATE_FILTER_VALUES = ["all", "yes", "no"] as const;
const DEFAULT_TIME_SPENT_RANGE: [number, number] = [0, MAX_TIME_SPENT_FILTER_SECONDS];

type DifficultyFilterValue = typeof DIFFICULTY_FILTER_VALUES[number];
type ActiveQuestionFilterValue = typeof ACTIVE_QUESTION_FILTER_VALUES[number];
type TriStateFilterValue = typeof TRI_STATE_FILTER_VALUES[number];

export interface QuestionBankFilters {
  difficulty: DifficultyFilterValue[];
  timeSpentRange: [number, number];
  activeQuestions: ActiveQuestionFilterValue;
  markedForReview: TriStateFilterValue;
  solved: TriStateFilterValue;
  answeredIncorrectly: TriStateFilterValue;
}

export const createDefaultQuestionBankFilters = (): QuestionBankFilters => ({
  difficulty: [],
  timeSpentRange: [...DEFAULT_TIME_SPENT_RANGE],
  activeQuestions: "all",
  markedForReview: "all",
  solved: "all",
  answeredIncorrectly: "all",
});

export const defaultFilters: QuestionBankFilters = createDefaultQuestionBankFilters();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeListValue = <T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fallback: T,
): T => typeof value === "string" && allowedValues.includes(value as T)
  ? value as T
  : fallback;

const normalizeDifficulty = (
  value: unknown,
  fallback: DifficultyFilterValue[],
): DifficultyFilterValue[] => Array.isArray(value)
  ? value.filter((item): item is DifficultyFilterValue =>
    typeof item === "string" && DIFFICULTY_FILTER_VALUES.includes(item as DifficultyFilterValue),
  )
  : [...fallback];

const normalizeTimeSpentRange = (
  value: unknown,
  fallback: [number, number],
): [number, number] => {
  if (!Array.isArray(value) || value.length !== 2) return [...fallback];

  const [rawMin, rawMax] = value;
  if (
    typeof rawMin !== "number" ||
    typeof rawMax !== "number" ||
    !Number.isFinite(rawMin) ||
    !Number.isFinite(rawMax)
  ) {
    return [...fallback];
  }

  const min = Math.max(0, Math.min(MAX_TIME_SPENT_FILTER_SECONDS, rawMin));
  const max = Math.max(0, Math.min(MAX_TIME_SPENT_FILTER_SECONDS, rawMax));
  return min <= max ? [min, max] : [max, min];
};

export const normalizeQuestionBankFilters = (
  value: unknown,
  fallback: QuestionBankFilters = defaultFilters,
): QuestionBankFilters => {
  const source = isRecord(value) ? value : {};
  return {
    difficulty: normalizeDifficulty(source.difficulty, fallback.difficulty),
    timeSpentRange: normalizeTimeSpentRange(source.timeSpentRange, fallback.timeSpentRange),
    activeQuestions: normalizeListValue(
      source.activeQuestions,
      ACTIVE_QUESTION_FILTER_VALUES,
      fallback.activeQuestions,
    ),
    markedForReview: normalizeListValue(
      source.markedForReview,
      TRI_STATE_FILTER_VALUES,
      fallback.markedForReview,
    ),
    solved: normalizeListValue(source.solved, TRI_STATE_FILTER_VALUES, fallback.solved),
    answeredIncorrectly: normalizeListValue(
      source.answeredIncorrectly,
      TRI_STATE_FILTER_VALUES,
      fallback.answeredIncorrectly,
    ),
  };
};

export const hasActiveQuestionBankFilters = (filters: QuestionBankFilters): boolean =>
  filters.difficulty.length > 0 ||
  filters.timeSpentRange[0] !== DEFAULT_TIME_SPENT_RANGE[0] ||
  filters.timeSpentRange[1] !== DEFAULT_TIME_SPENT_RANGE[1] ||
  filters.activeQuestions !== "all" ||
  filters.markedForReview !== "all" ||
  filters.solved !== "all" ||
  filters.answeredIncorrectly !== "all";
