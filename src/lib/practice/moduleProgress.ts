import type { PracticeModule } from "@/data/modulePracticeBank";
import { getLatestModulePracticeResult } from "@/lib/practice/modulePracticeSession";
import { getQuestionUiStates } from "@/lib/practice/questionUiState";

const UNANSWERED_STATUS = "unanswered";
const NOT_STARTED_STATUS = "not-started";
const IN_PROGRESS_STATUS = "in-progress";
const COMPLETED_STATUS = "completed";

export type ModuleCompletionStatus =
  | typeof NOT_STARTED_STATUS
  | typeof IN_PROGRESS_STATUS
  | typeof COMPLETED_STATUS;

const getModuleAnsweredCount = (
  module: PracticeModule,
  uid?: string | null,
): number => {
  const latestResult = getLatestModulePracticeResult(module.slug, uid);
  if (latestResult) {
    return latestResult.answeredCount;
  }

  const storageIds = module.questions.map((entry) => entry.bankQuestion.stableId);
  const questionStates = getQuestionUiStates(storageIds, uid);

  return storageIds.reduce(
    (answeredCount, storageId) => {
      const status = questionStates[storageId]?.status || UNANSWERED_STATUS;
      return status !== UNANSWERED_STATUS ? answeredCount + 1 : answeredCount;
    },
    0,
  );
};

const classifyModuleCompletion = (
  answeredCount: number,
  questionCount: number,
): ModuleCompletionStatus => {
  if (answeredCount === 0) return NOT_STARTED_STATUS;
  if (answeredCount >= questionCount) return COMPLETED_STATUS;
  return IN_PROGRESS_STATUS;
};

export const getModuleCompletionStatus = (
  module: PracticeModule,
  uid?: string | null,
): ModuleCompletionStatus =>
  classifyModuleCompletion(getModuleAnsweredCount(module, uid), module.questionCount);
