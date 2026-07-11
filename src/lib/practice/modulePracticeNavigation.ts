import type { NavigateFunction } from "react-router-dom";
import type { PracticeModule } from "@/data/modulePracticeBank";
import {
  clearModulePracticeSession,
  createModulePracticeSession,
  resumeModulePracticeSession,
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
  ownerUid: string | null;
}> & (
  Readonly<{
    resumeExisting: true;
    savedSession: ModulePracticeSessionMeta;
    settings?: ModulePracticeSettings;
  }> | Readonly<{
    resumeExisting: false;
    savedSession: ModulePracticeSessionMeta | null;
    settings: ModulePracticeSettings;
    restartConfirmed?: boolean;
  }>
);

export const launchModulePractice = ({
  module,
  navigate,
  ownerUid,
  resumeExisting,
  savedSession,
  settings,
  ...launchOptions
}: LaunchModulePracticeArgs): boolean => {
  const practiceSet = buildModulePracticeSetFromModule(module);
  if (!practiceSet.length) return false;

  const shouldResume = resumeExisting && savedSession !== null;
  if (shouldResume && savedSession.ownerUid !== ownerUid) return false;

  if (!shouldResume && savedSession) {
    if (!("restartConfirmed" in launchOptions) || !launchOptions.restartConfirmed) {
      return false;
    }
    clearModulePracticeSession(module.slug, ownerUid);
  }

  const session = shouldResume
    ? resumeModulePracticeSession(savedSession)
    : createModulePracticeSession(module, settings, ownerUid);

  if (shouldResume) {
    saveModulePracticeSession(session);
  }

  writePracticeLaunchStorage(practiceSet);

  const targetIndex = shouldResume ? session.currentIndex : 0;
  const targetQuestion = practiceSet[targetIndex];
  if (!targetQuestion) return false;

  navigate(buildModulePracticeQuestionRoute({
    subject: targetQuestion.subject,
    sourceId: targetQuestion.sourceId,
    bankType: targetQuestion.bankType,
    idx: targetIndex + 1,
    moduleSlug: module.slug,
    moduleSessionId: session.sessionId,
  }));
  return true;
};
