import pastQuestionDifficultyMapRaw from "./pastQuestionDifficultyMap.json";

export type CanonicalDifficulty = "Easy" | "Medium" | "Hard";

const pastQuestionDifficultyMap = pastQuestionDifficultyMapRaw as Record<string, CanonicalDifficulty | undefined>;

export const getPastQuestionDifficulty = (sourceId: string | number | null | undefined): CanonicalDifficulty | null =>
  sourceId == null ? null : pastQuestionDifficultyMap[String(sourceId)] ?? null;

export { pastQuestionDifficultyMap };
