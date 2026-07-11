import type { StudyPlanDocumentV2 } from "@/lib/studyPlan/studyPlanDocument";
import type {
  DeleteStudyPlanResult,
  StudyPlanSyncResult,
} from "@/lib/studyPlan/studyPlanStorage";

export type StudyPlanSaveUiStatus = "idle" | "saving" | "error";
export type StudyPlanSyncUiStatus = "local" | "syncing" | "synced" | "error" | "unsaved";

const contentFingerprint = (document: StudyPlanDocumentV2) => JSON.stringify({
  ...document,
  updatedAt: 0,
});

export const sameStudyPlanDocumentContent = (
  first: StudyPlanDocumentV2,
  second: StudyPlanDocumentV2,
) => contentFingerprint(first) === contentFingerprint(second);

export const isStudyPlanDeletionDurable = (
  result: DeleteStudyPlanResult,
  retainedDocument: StudyPlanDocumentV2 | null,
) => result.deleted && retainedDocument === null;

export const durableStudyPlanSaveDocument = ({
  result,
  submitted,
  uid,
  localDocument,
}: {
  result: StudyPlanSyncResult;
  submitted: StudyPlanDocumentV2;
  uid: string | null;
  localDocument: StudyPlanDocumentV2 | null;
}) => {
  if (result.cloudStatus !== "error") return result.document;
  if (!uid || !localDocument) return null;
  return sameStudyPlanDocumentContent(localDocument, submitted)
    ? localDocument
    : null;
};

export const studyPlanSyncStatusForSaveResult = (options: {
  result: StudyPlanSyncResult;
  submitted: StudyPlanDocumentV2;
  uid: string | null;
  localDocument: StudyPlanDocumentV2 | null;
}): StudyPlanSyncUiStatus => {
  if (options.result.cloudStatus === "synced") return options.result.document ? "synced" : "unsaved";
  if (options.result.cloudStatus !== "error") return options.result.document ? "local" : "unsaved";
  return durableStudyPlanSaveDocument(options) ? "error" : "unsaved";
};

export const studyPlanPersistenceStatusText = ({
  uid,
  persistenceEnabled,
  saveStatus,
  syncStatus,
}: {
  uid: string | null;
  persistenceEnabled: boolean;
  saveStatus: StudyPlanSaveUiStatus;
  syncStatus: StudyPlanSyncUiStatus;
}) => {
  if (saveStatus === "saving") {
    return uid ? "Saving and syncing plan…" : "Saving plan on this device…";
  }
  if (saveStatus === "error") {
    return persistenceEnabled
      ? "Latest changes are not saved. Retry before leaving."
      : "Plan not saved. Retry before leaving.";
  }
  if (!persistenceEnabled) return "Not saved yet";
  if (syncStatus === "unsaved") return "Latest changes are not saved. Retry before leaving.";
  if (!uid) {
    return syncStatus === "error"
      ? "Latest changes are not saved. Retry before leaving."
      : "Saved anonymously on this device";
  }
  if (syncStatus === "syncing") return "Syncing plan…";
  if (syncStatus === "synced") return "Plan synced to your account";
  if (syncStatus === "error") return "Saved locally; account sync will retry";
  return "Saved locally";
};
