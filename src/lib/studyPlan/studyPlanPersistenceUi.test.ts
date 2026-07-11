import { describe, expect, it } from "vitest";

import { createStudyPlanDocument } from "@/lib/studyPlan/studyPlanDocument";
import {
  createDefaultStudyPlanSettings,
  generateStudyPlan,
} from "@/lib/studyPlan/studyPlanEngine";
import {
  durableStudyPlanSaveDocument,
  isStudyPlanDeletionDurable,
  studyPlanPersistenceStatusText,
  studyPlanSyncStatusForSaveResult,
} from "@/lib/studyPlan/studyPlanPersistenceUi";

const today = "2026-07-09";

const buildDocument = (updatedAt: number, targetScore = 1450) => {
  const settings = {
    ...createDefaultStudyPlanSettings(today),
    setupComplete: true,
    startDate: today,
    satDate: "2026-08-22",
    targetScore,
  };
  return createStudyPlanDocument({
    settings,
    tasks: generateStudyPlan(settings, { today }),
    progress: {},
    updatedAt,
  });
};

describe("study-plan persistence UI", () => {
  it("rejects an anonymous error result even when it carries the submitted document", () => {
    const submitted = buildDocument(100);

    expect(durableStudyPlanSaveDocument({
      result: { document: submitted, cloudStatus: "error" },
      submitted,
      uid: null,
      localDocument: submitted,
    })).toBeNull();
  });

  it("accepts a matching durable account-local copy when cloud sync fails", () => {
    const submitted = buildDocument(100);
    const localDocument = buildDocument(200);

    expect(durableStudyPlanSaveDocument({
      result: { document: localDocument, cloudStatus: "error" },
      submitted,
      uid: "user-1",
      localDocument,
    })).toEqual(localDocument);
  });

  it("rejects a stale account-local copy after local and cloud persistence fail", () => {
    const submitted = buildDocument(100, 1500);
    const staleDocument = buildDocument(200, 1400);

    expect(durableStudyPlanSaveDocument({
      result: { document: submitted, cloudStatus: "error" },
      submitted,
      uid: "user-1",
      localDocument: staleDocument,
    })).toBeNull();
  });

  it("distinguishes cloud-only failure from loss of both signed-in persistence paths", () => {
    const submitted = buildDocument(100, 1500);
    const matchingLocalDocument = buildDocument(200, 1500);
    const staleLocalDocument = buildDocument(200, 1400);
    const errorResult = { document: submitted, cloudStatus: "error" as const };

    expect(studyPlanSyncStatusForSaveResult({
      result: errorResult,
      submitted,
      uid: "user-1",
      localDocument: matchingLocalDocument,
    })).toBe("error");
    expect(studyPlanSyncStatusForSaveResult({
      result: errorResult,
      submitted,
      uid: "user-1",
      localDocument: staleLocalDocument,
    })).toBe("unsaved");
  });

  it("does not label a fresh or failed anonymous plan as saved", () => {
    expect(studyPlanPersistenceStatusText({
      uid: null,
      persistenceEnabled: false,
      saveStatus: "idle",
      syncStatus: "local",
    })).toBe("Not saved yet");
    expect(studyPlanPersistenceStatusText({
      uid: null,
      persistenceEnabled: false,
      saveStatus: "error",
      syncStatus: "error",
    })).toBe("Plan not saved. Retry before leaving.");
    expect(studyPlanPersistenceStatusText({
      uid: "user-1",
      persistenceEnabled: true,
      saveStatus: "idle",
      syncStatus: "unsaved",
    })).toBe("Latest changes are not saved. Retry before leaving.");
  });

  it("requires both a successful deletion result and no retained local document", () => {
    const retainedDocument = buildDocument(100);

    expect(isStudyPlanDeletionDurable({ deleted: false, cloudStatus: "skipped" }, null)).toBe(false);
    expect(isStudyPlanDeletionDurable({ deleted: true, cloudStatus: "deleted" }, retainedDocument)).toBe(false);
    expect(isStudyPlanDeletionDurable({ deleted: true, cloudStatus: "deleted" }, null)).toBe(true);
  });
});
