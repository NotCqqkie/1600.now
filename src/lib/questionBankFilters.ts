export const MAX_TIME_SPENT_FILTER_SECONDS = 180;
export const MIN_SCORE_BAND = 1;
export const MAX_SCORE_BAND = 10;

const ACTIVE_QUESTION_FILTER_VALUES = ["all", "active", "exclude-active"] as const;
const TRI_STATE_FILTER_VALUES = ["all", "yes", "no"] as const;
const DEFAULT_TIME_SPENT_RANGE: [number, number] = [0, MAX_TIME_SPENT_FILTER_SECONDS];
const DEFAULT_SCORE_BAND_RANGE: [number, number] = [MIN_SCORE_BAND, MAX_SCORE_BAND];

type ActiveQuestionFilterValue = typeof ACTIVE_QUESTION_FILTER_VALUES[number];
type TriStateFilterValue = typeof TRI_STATE_FILTER_VALUES[number];

export interface QuestionBankFilters {
  scoreBandRange: [number, number];
  timeSpentRange: [number, number];
  activeQuestions: ActiveQuestionFilterValue;
  markedForReview: TriStateFilterValue;
  solved: TriStateFilterValue;
  answeredIncorrectly: TriStateFilterValue;
}

export const createDefaultQuestionBankFilters = (): QuestionBankFilters => ({
  scoreBandRange: [...DEFAULT_SCORE_BAND_RANGE],
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

const normalizeScoreBandRange = (
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

  const clamp = (n: number) => Math.max(MIN_SCORE_BAND, Math.min(MAX_SCORE_BAND, Math.round(n)));
  const min = clamp(rawMin);
  const max = clamp(rawMax);
  return min <= max ? [min, max] : [max, min];
};

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
    scoreBandRange: normalizeScoreBandRange(source.scoreBandRange, fallback.scoreBandRange),
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
  filters.scoreBandRange[0] !== DEFAULT_SCORE_BAND_RANGE[0] ||
  filters.scoreBandRange[1] !== DEFAULT_SCORE_BAND_RANGE[1] ||
  filters.timeSpentRange[0] !== DEFAULT_TIME_SPENT_RANGE[0] ||
  filters.timeSpentRange[1] !== DEFAULT_TIME_SPENT_RANGE[1] ||
  filters.activeQuestions !== "all" ||
  filters.markedForReview !== "all" ||
  filters.solved !== "all" ||
  filters.answeredIncorrectly !== "all";
