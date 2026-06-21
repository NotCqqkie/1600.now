import type { NavigateFunction } from "react-router-dom";
import type { PracticeModule } from "@/data/modulePracticeBank";
import {
  clearModulePracticeSession,
  createModulePracticeSession,
  saveModulePracticeSession,
  type ModulePracticeSessionMeta,
  type ModulePracticeSettings,
} from "@/lib/practice/modulePracticeSession";
import { buildModulePracticeQuestionRoute } from "@/lib/practice/practiceBankRoutes";
import { writePracticeLaunchStorage } from "@/lib/practice/practiceRunStorage";

const buildModulePracticeSetFromModule = (module: PracticeModule) =>
  module.questions.map((entry, index) => ({
    subject: module.subject,
    id: entry.bankQuestion.id,
    sourceId: entry.bankQuestion.sourceId,
    bankType: entry.bankQuestion.bankType,
    storageId: entry.bankQuestion.stableId,
    index,
  }));

type LaunchModulePracticeArgs = Readonly<{
  module: PracticeModule;
  navigate: NavigateFunction;
}> & (
  Readonly<{
    resumeExisting: true;
    savedSession: ModulePracticeSessionMeta;
    settings?: ModulePracticeSettings;
  }> | Readonly<{
    resumeExisting: false;
    savedSession: ModulePracticeSessionMeta | null;
    settings: ModulePracticeSettings;
  }>
);

export const launchModulePractice = ({
  module,
  navigate,
  resumeExisting,
  savedSession,
  settings,
}: LaunchModulePracticeArgs): void => {
  const practiceSet = buildModulePracticeSetFromModule(module);
  if (!practiceSet.length) return;

  const shouldResume = resumeExisting && savedSession !== null;

  if (!shouldResume && savedSession) {
    clearModulePracticeSession(module.slug);
  }

  const session = shouldResume
    ? { ...savedSession, status: "active" as const }
    : createModulePracticeSession(module, settings);

  if (shouldResume) {
    saveModulePracticeSession(session);
  }

  writePracticeLaunchStorage(practiceSet);

  const targetIndex = shouldResume ? session.currentIndex : 0;
  const targetQuestion = practiceSet[targetIndex];
  if (!targetQuestion) return;

  navigate(buildModulePracticeQuestionRoute({
    subject: targetQuestion.subject,
    sourceId: targetQuestion.sourceId,
    bankType: targetQuestion.bankType,
    idx: targetIndex + 1,
    moduleSlug: module.slug,
    moduleSessionId: session.sessionId,
  }));
};
