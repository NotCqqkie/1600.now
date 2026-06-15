import type { NavigateFunction } from "react-router-dom";
import {
  buildPracticeTestQuestionSet,
  getPracticeSet,
  type PracticeSet,
} from "@/data/modulePracticeBank";
import {
  clearPracticeTestSession,
  createPracticeTestSession,
  getPracticeTestSession,
  savePracticeTestSession,
  type PracticeTestSettings,
  type PracticeTestSessionMeta,
} from "@/lib/practice/practiceTestSession";

type LaunchPracticeTestArgs = {
  practiceSet: PracticeSet;
  navigate: NavigateFunction;
  resumeExisting: boolean;
  savedSession: PracticeTestSessionMeta | null;
  settings: PracticeTestSettings;
};

export const launchPracticeTest = ({
  practiceSet,
  navigate,
  resumeExisting,
  savedSession,
  settings,
}: LaunchPracticeTestArgs) => {
  const questionSet = buildPracticeTestQuestionSet(practiceSet.id);
  if (!questionSet?.length) return;

  if (!resumeExisting && savedSession) {
    clearPracticeTestSession(practiceSet.id);
  }

  const session = resumeExisting && savedSession
    ? { ...savedSession, status: "active" as const }
    : createPracticeTestSession(practiceSet, settings);

  if (resumeExisting && savedSession) {
    savePracticeTestSession(session);
  }

  sessionStorage.setItem("practiceExitTo", "/modules");
  sessionStorage.setItem("practiceSet", JSON.stringify(questionSet));

  if (resumeExisting && savedSession?.phase === "review") {
    navigate(`/practice-tests/${practiceSet.id}/review?session=${savedSession.sessionId}`);
    return;
  }

  const targetIndex = resumeExisting ? session.currentIndex : 0;
  const targetQuestion = questionSet[targetIndex];
  if (!targetQuestion) return;

  navigate(
    `/bank/${targetQuestion.subject}/${targetQuestion.sourceId}?bankType=past&practice=true&idx=${targetIndex + 1}&practiceTest=${practiceSet.id}&practiceTestSession=${session.sessionId}`,
  );
};

export const resumePracticeTestFromRoute = (
  practiceSetId: string,
  navigate: NavigateFunction,
) => {
  const practiceSet = getPracticeSet(practiceSetId);
  if (!practiceSet) return;

  const questionSet = buildPracticeTestQuestionSet(practiceSet.id);
  if (!questionSet?.length) return;

  const session = getPracticeTestSession(practiceSet.id);
  if (!session) return;

  sessionStorage.setItem("practiceExitTo", "/modules");
  sessionStorage.setItem("practiceSet", JSON.stringify(questionSet));

  const targetQuestion = questionSet[session.currentIndex];
  if (!targetQuestion) return;

  navigate(
    `/bank/${targetQuestion.subject}/${targetQuestion.sourceId}?bankType=past&practice=true&idx=${session.currentIndex + 1}&practiceTest=${practiceSet.id}&practiceTestSession=${session.sessionId}`,
  );
};
