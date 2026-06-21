import type { NavigateFunction } from "react-router-dom";
import type { PracticeSet, PracticeTestQuestionItem } from "@/data/modulePracticeBank";
import {
  clearPracticeTestSession,
  createPracticeTestSession,
  savePracticeTestSession,
  type PracticeTestSettings,
  type PracticeTestSessionMeta,
} from "@/lib/practice/practiceTestSession";
import { buildPracticeTestQuestionRoute } from "@/lib/practice/practiceBankRoutes";
import { writePracticeLaunchStorage } from "@/lib/practice/practiceRunStorage";

const buildPracticeTestQuestionSetFromSet = (
  practiceSet: PracticeSet,
): PracticeTestQuestionItem[] => {
  let globalQuestionNumber = 0;

  return practiceSet.modules.flatMap((module) =>
    module.questions.map((entry) => {
      globalQuestionNumber += 1;

      return {
        subject: module.subject,
        id: entry.bankQuestion.id,
        sourceId: entry.bankQuestion.sourceId,
        bankType: entry.bankQuestion.bankType,
        storageId: entry.bankQuestion.stableId,
        practiceSetId: practiceSet.id,
        practiceSetNumber: practiceSet.setNumber,
        moduleSlug: module.slug,
        moduleNumber: module.moduleNumber,
        moduleTitle: module.publicTitle,
        moduleQuestionNumber: entry.slot,
        globalQuestionNumber,
      };
    }),
  );
};

type LaunchPracticeTestArgs = Readonly<{
  practiceSet: PracticeSet;
  navigate: NavigateFunction;
}> & (
  Readonly<{
    resumeExisting: true;
    savedSession: PracticeTestSessionMeta;
    settings?: PracticeTestSettings;
  }> | Readonly<{
    resumeExisting: false;
    savedSession: PracticeTestSessionMeta | null;
    settings: PracticeTestSettings;
  }>
);

export const launchPracticeTest = ({
  practiceSet,
  navigate,
  resumeExisting,
  savedSession,
  settings,
}: LaunchPracticeTestArgs): void => {
  const questionSet = buildPracticeTestQuestionSetFromSet(practiceSet);
  if (!questionSet.length) return;

  const shouldResume = resumeExisting && savedSession !== null;

  if (!shouldResume && savedSession) {
    clearPracticeTestSession(practiceSet.id);
  }

  const session = shouldResume
    ? { ...savedSession, status: "active" as const }
    : createPracticeTestSession(practiceSet, settings);

  if (shouldResume) {
    savePracticeTestSession(session);
  }

  writePracticeLaunchStorage(questionSet);

  if (shouldResume && savedSession.phase === "review") {
    navigate(`/practice-tests/${practiceSet.id}/review?session=${savedSession.sessionId}`);
    return;
  }

  const targetIndex = shouldResume ? session.currentIndex : 0;
  const targetQuestion = questionSet[targetIndex];
  if (!targetQuestion) return;

  navigate(buildPracticeTestQuestionRoute({
    subject: targetQuestion.subject,
    sourceId: targetQuestion.sourceId,
    bankType: targetQuestion.bankType,
    idx: targetIndex + 1,
    practiceSetId: practiceSet.id,
    practiceTestSessionId: session.sessionId,
  }));
};
