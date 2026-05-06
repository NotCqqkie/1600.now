import type { NavigateFunction } from "react-router-dom";
import {
  buildModulePracticeSet,
  type PracticeModule,
} from "@/data/modulePracticeBank";
import {
  clearModulePracticeSession,
  createModulePracticeSession,
  saveModulePracticeSession,
  type ModulePracticeSessionMeta,
  type ModulePracticeSettings,
} from "@/lib/modulePracticeSession";

type LaunchModulePracticeArgs = {
  module: PracticeModule;
  navigate: NavigateFunction;
  resumeExisting: boolean;
  savedSession: ModulePracticeSessionMeta | null;
  settings: ModulePracticeSettings;
};

export const launchModulePractice = ({
  module,
  navigate,
  resumeExisting,
  savedSession,
  settings,
}: LaunchModulePracticeArgs) => {
  const practiceSet = buildModulePracticeSet(module.slug);
  if (!practiceSet?.length) return;

  if (!resumeExisting && savedSession) {
    clearModulePracticeSession(module.slug);
  }

  const session = resumeExisting && savedSession
    ? { ...savedSession, status: "active" as const }
    : createModulePracticeSession(module, settings);

  if (resumeExisting && savedSession) {
    saveModulePracticeSession(session);
  }

  sessionStorage.setItem("practiceExitTo", `/modules/${module.slug}`);
  sessionStorage.setItem("practiceSet", JSON.stringify(practiceSet));

  const targetIndex = resumeExisting ? session.currentIndex : 0;
  const targetQuestion = practiceSet[targetIndex];
  if (!targetQuestion) return;

  navigate(
    `/bank/${targetQuestion.subject}/${targetQuestion.sourceId}?bankType=past&practice=true&idx=${targetIndex + 1}&modulePractice=${module.slug}&moduleSession=${session.sessionId}`,
  );
};
