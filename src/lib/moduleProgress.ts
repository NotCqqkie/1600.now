import type { PracticeModule } from "@/data/modulePracticeBank";
import { getLatestModulePracticeResult } from "@/lib/modulePracticeSession";

export interface ModuleProgressCounts {
  correct: number;
  incorrect: number;
  correctAfterReview: number;
}

export const getModuleProgressCounts = (module: PracticeModule): ModuleProgressCounts => {
  const latestResult = getLatestModulePracticeResult(module.slug);
  if (latestResult) {
    return latestResult.counts;
  }

  return module.questions.reduce(
    (counts, entry) => {
      const status = localStorage.getItem(`${entry.bankQuestion.stableId}-status`);
      if (status === "correct-first") counts.correct += 1;
      if (status === "incorrect") counts.incorrect += 1;
      if (status === "correct-later") counts.correctAfterReview += 1;
      return counts;
    },
    { correct: 0, incorrect: 0, correctAfterReview: 0 },
  );
};

export const classifyModuleCompletion = (
  counts: ModuleProgressCounts,
  questionCount: number,
): "not-started" | "in-progress" | "completed" => {
  const total = counts.correct + counts.incorrect + counts.correctAfterReview;
  if (total === 0) return "not-started";
  if (total >= questionCount) return "completed";
  return "in-progress";
};
