import { describe, expect, it } from "vitest";

import { createStudyPlanDocument } from "@/lib/studyPlan/studyPlanDocument";
import {
  createDefaultStudyPlanSettings,
  generateStudyPlan,
} from "@/lib/studyPlan/studyPlanEngine";
import {
  ANONYMOUS_STUDY_PLAN_STORAGE_KEY,
  deleteStudyPlanDocument,
  readStudyPlanBackup,
  readStudyPlanDocument,
  saveStudyPlanDocument,
  studyPlanBackupStorageKey,
  studyPlanStorageKey,
  syncStudyPlanDocument,
  type StudyPlanCloudAdapter,
  type StudyPlanCloudResolution,
  type StudyPlanMigrationLockManager,
  type StudyPlanStorageLike,
} from "@/lib/studyPlan/studyPlanStorage";

class MemoryStorage implements StudyPlanStorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

class MemoryMigrationLockManager implements StudyPlanMigrationLockManager {
  private readonly tails = new Map<string, Promise<void>>();

  async request<T>(name: string, callback: () => T): Promise<T> {
    const previous = this.tails.get(name) ?? Promise.resolve();
    let release = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const queued = previous.then(() => gate);
    this.tails.set(name, queued);
    await previous;
    try {
      return callback();
    } finally {
      release();
      if (this.tails.get(name) === queued) this.tails.delete(name);
    }
  }
}

const tabStorageFor = (storage: MemoryStorage): StudyPlanStorageLike => ({
  getItem: (key) => storage.getItem(key),
  setItem: (key, value) => storage.setItem(key, value),
  removeItem: (key) => storage.removeItem(key),
});

const waitFor = async (predicate: () => boolean) => {
  for (let attempt = 0; attempt < 20 && !predicate(); attempt += 1) {
    await Promise.resolve();
  }
};

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

describe("study-plan storage", () => {
  it("keeps anonymous and account-local documents under separate keys", async () => {
    const storage = new MemoryStorage();
    await saveStudyPlanDocument(buildDocument(100, 1400), {
      storage,
      syncCloud: false,
      now: () => 100,
    });
    await saveStudyPlanDocument(buildDocument(200, 1500), {
      uid: "user-1",
      storage,
      syncCloud: false,
      now: () => 200,
    });

    expect(readStudyPlanDocument(null, storage)?.settings.targetScore).toBe(1400);
    expect(readStudyPlanDocument("user-1", storage)?.settings.targetScore).toBe(1500);
    expect(studyPlanStorageKey(null)).not.toBe(studyPlanStorageKey("user-1"));
  });

  it("keeps signed-in cloud save, load, and delete available without localStorage", async () => {
    const cloudDocument = buildDocument(300, 1500);
    let saved = false;
    let deleted = false;
    const cloudAdapter: StudyPlanCloudAdapter = {
      sync: async (_uid, document) => {
        saved ||= document !== null;
        return { document: document ?? cloudDocument };
      },
      delete: async () => { deleted = true; },
    };

    const saveResult = await saveStudyPlanDocument(buildDocument(100, 1400), {
      uid: "user-1",
      storage: null,
      cloudAdapter,
      now: () => 200,
    });
    const syncResult = await syncStudyPlanDocument("user-1", {
      storage: null,
      cloudAdapter,
      now: () => 300,
    });
    const deleteResult = await deleteStudyPlanDocument({
      uid: "user-1",
      storage: null,
      cloudAdapter,
      now: () => 400,
    });

    expect(saved).toBe(true);
    expect(saveResult.cloudStatus).toBe("synced");
    expect(syncResult.document).toEqual(cloudDocument);
    expect(deleteResult).toMatchObject({ deleted: true, cloudStatus: "deleted" });
    expect(deleted).toBe(true);
  });

  it("reports an error when neither local nor cloud persistence is available", async () => {
    const anonymous = await saveStudyPlanDocument(buildDocument(100), {
      storage: null,
      syncCloud: false,
      now: () => 200,
    });
    const signedIn = await syncStudyPlanDocument("user-1", {
      storage: null,
      cloudAdapter: null,
      now: () => 200,
    });

    expect(anonymous.cloudStatus).toBe("error");
    expect(signedIn.cloudStatus).toBe("error");
  });

  it("returns the local plan when account sync does not settle", async () => {
    const storage = new MemoryStorage();
    const localDocument = buildDocument(100, 1500);
    await saveStudyPlanDocument(localDocument, {
      uid: "user-1",
      storage,
      syncCloud: false,
      now: () => 100,
    });
    const cloudAdapter: StudyPlanCloudAdapter = {
      sync: () => new Promise(() => undefined),
      delete: async () => undefined,
    };

    const result = await syncStudyPlanDocument("user-1", {
      storage,
      cloudAdapter,
      cloudTimeoutMs: 5,
      now: () => 200,
    });

    expect(result.cloudStatus).toBe("error");
    expect(result.document?.settings.targetScore).toBe(1500);
    expect(result.error).toEqual(new Error("Study plan account sync timed out."));
  });

  it("migrates an anonymous plan after cloud persistence succeeds", async () => {
    const storage = new MemoryStorage();
    const anonymous = buildDocument(100, 1400);
    const olderAccountCopy = buildDocument(50, 1500);
    storage.setItem(ANONYMOUS_STUDY_PLAN_STORAGE_KEY, JSON.stringify(anonymous));
    storage.setItem(studyPlanStorageKey("user-1"), JSON.stringify(olderAccountCopy));
    let syncedDocument = null;
    const cloudAdapter: StudyPlanCloudAdapter = {
      sync: async (_uid, document) => {
        syncedDocument = document;
        return { document };
      },
      delete: async () => undefined,
    };

    const result = await syncStudyPlanDocument("user-1", {
      storage,
      cloudAdapter,
      now: () => 200,
    });

    expect(result.cloudStatus).toBe("synced");
    expect(syncedDocument).toEqual(anonymous);
    expect(readStudyPlanDocument("user-1", storage)).toEqual(anonymous);
    expect(storage.getItem(ANONYMOUS_STUDY_PLAN_STORAGE_KEY)).toBeNull();
    expect(readStudyPlanBackup("user-1", storage)?.document).toEqual(olderAccountCopy);
  });

  it("consumes the anonymous source after a durable account-local copy when cloud is unavailable", async () => {
    const storage = new MemoryStorage();
    const anonymous = buildDocument(100, 1400);
    storage.setItem(ANONYMOUS_STUDY_PLAN_STORAGE_KEY, JSON.stringify(anonymous));

    const result = await syncStudyPlanDocument("user-1", {
      storage,
      cloudAdapter: null,
      now: () => 200,
    });

    expect(result.cloudStatus).toBe("skipped");
    expect(readStudyPlanDocument("user-1", storage)).toEqual(anonymous);
    expect(readStudyPlanDocument(null, storage)).toBeNull();

    const otherUser = await syncStudyPlanDocument("user-2", {
      storage,
      cloudAdapter: null,
      now: () => 201,
    });
    expect(otherUser.document).toBeNull();
    expect(readStudyPlanDocument("user-2", storage)).toBeNull();
  });

  it("does not expose a consumed anonymous plan to another user after a cloud error", async () => {
    const storage = new MemoryStorage();
    const anonymous = buildDocument(100, 1400);
    storage.setItem(ANONYMOUS_STUDY_PLAN_STORAGE_KEY, JSON.stringify(anonymous));
    const offlineAdapter: StudyPlanCloudAdapter = {
      sync: async () => { throw new Error("offline"); },
      delete: async () => undefined,
    };

    const failed = await syncStudyPlanDocument("user-1", {
      storage,
      cloudAdapter: offlineAdapter,
      now: () => 200,
    });
    const otherUser = await syncStudyPlanDocument("user-2", {
      storage,
      cloudAdapter: null,
      now: () => 201,
    });

    expect(failed.cloudStatus).toBe("error");
    expect(failed.document).toEqual(anonymous);
    expect(readStudyPlanDocument("user-1", storage)).toEqual(anonymous);
    expect(readStudyPlanDocument(null, storage)).toBeNull();
    expect(otherUser.document).toBeNull();

    let retriedDocument = null;
    const retryAdapter: StudyPlanCloudAdapter = {
      sync: async (_uid, document) => {
        retriedDocument = document;
        return { document };
      },
      delete: async () => undefined,
    };
    const retried = await syncStudyPlanDocument("user-1", {
      storage,
      cloudAdapter: retryAdapter,
      now: () => 202,
    });
    expect(retried.cloudStatus).toBe("synced");
    expect(retriedDocument).toEqual(anonymous);
  });

  it("allows only one user to consume an anonymous plan when syncs overlap", async () => {
    const storage = new MemoryStorage();
    const anonymous = buildDocument(100, 1400);
    storage.setItem(ANONYMOUS_STUDY_PLAN_STORAGE_KEY, JSON.stringify(anonymous));
    let firstCandidate = null;
    let secondCandidate = null;
    let resolveFirst: ((resolution: StudyPlanCloudResolution) => void) | undefined;
    let resolveSecond: ((resolution: StudyPlanCloudResolution) => void) | undefined;
    const firstAdapter: StudyPlanCloudAdapter = {
      sync: async (_uid, document) => {
        firstCandidate = document;
        return new Promise((resolve) => { resolveFirst = resolve; });
      },
      delete: async () => undefined,
    };
    const secondAdapter: StudyPlanCloudAdapter = {
      sync: async (_uid, document) => {
        secondCandidate = document;
        return new Promise((resolve) => { resolveSecond = resolve; });
      },
      delete: async () => undefined,
    };

    const firstSync = syncStudyPlanDocument("user-1", {
      storage,
      cloudAdapter: firstAdapter,
      now: () => 200,
    });
    const secondSync = syncStudyPlanDocument("user-2", {
      storage,
      cloudAdapter: secondAdapter,
      now: () => 201,
    });
    await waitFor(() => resolveFirst !== undefined && resolveSecond !== undefined);

    expect(firstCandidate).toEqual(anonymous);
    expect(secondCandidate).toBeNull();
    resolveFirst?.({ document: anonymous });
    resolveSecond?.({ document: null });
    const [firstResult, secondResult] = await Promise.all([firstSync, secondSync]);

    expect(firstResult.document).toEqual(anonymous);
    expect(secondResult.document).toBeNull();
    expect(readStudyPlanDocument("user-1", storage)).toEqual(anonymous);
    expect(readStudyPlanDocument("user-2", storage)).toBeNull();
    expect(readStudyPlanDocument(null, storage)).toBeNull();
  });

  it("serializes anonymous migration across distinct tab storage objects", async () => {
    const backingStorage = new MemoryStorage();
    const anonymous = buildDocument(100, 1400);
    backingStorage.setItem(ANONYMOUS_STUDY_PLAN_STORAGE_KEY, JSON.stringify(anonymous));
    const lockManager = new MemoryMigrationLockManager();
    const firstTab = tabStorageFor(backingStorage);
    const secondTab = tabStorageFor(backingStorage);

    const [firstResult, secondResult] = await Promise.all([
      syncStudyPlanDocument("user-1", {
        storage: firstTab,
        cloudAdapter: null,
        migrationLockManager: lockManager,
        now: () => 200,
      }),
      syncStudyPlanDocument("user-2", {
        storage: secondTab,
        cloudAdapter: null,
        migrationLockManager: lockManager,
        now: () => 201,
      }),
    ]);

    const migrated = [firstResult.document, secondResult.document].filter(Boolean);
    expect(migrated).toEqual([anonymous]);
    expect([
      readStudyPlanDocument("user-1", backingStorage),
      readStudyPlanDocument("user-2", backingStorage),
    ].filter(Boolean)).toEqual([anonymous]);
    expect(readStudyPlanDocument(null, backingStorage)).toBeNull();
  });

  it("fails closed instead of migrating an unclaimed source without a cross-tab lock", async () => {
    const storage = new MemoryStorage();
    const anonymous = buildDocument(100, 1400);
    storage.setItem(ANONYMOUS_STUDY_PLAN_STORAGE_KEY, JSON.stringify(anonymous));

    const result = await syncStudyPlanDocument("user-1", {
      storage,
      cloudAdapter: null,
      migrationLockManager: null,
      now: () => 200,
    });

    expect(result.document).toBeNull();
    expect(readStudyPlanDocument("user-1", storage)).toBeNull();
    expect(readStudyPlanDocument(null, storage)).toEqual(anonymous);
  });

  it("binds an unconsumed anonymous plan to the first user when the account-local write fails", async () => {
    const storage = new MemoryStorage();
    const anonymous = buildDocument(100, 1400);
    storage.setItem(ANONYMOUS_STUDY_PLAN_STORAGE_KEY, JSON.stringify(anonymous));
    let failAccountWrite = true;
    const failingStorage: StudyPlanStorageLike = {
      getItem: (key) => storage.getItem(key),
      setItem: (key, value) => {
        if (failAccountWrite && key === studyPlanStorageKey("user-1")) throw new Error("quota");
        storage.setItem(key, value);
      },
      removeItem: (key) => storage.removeItem(key),
    };

    const firstAttempt = await syncStudyPlanDocument("user-1", {
      storage: failingStorage,
      cloudAdapter: null,
      now: () => 200,
    });
    const otherUser = await syncStudyPlanDocument("user-2", {
      storage: failingStorage,
      cloudAdapter: null,
      now: () => 201,
    });

    expect(firstAttempt.document).toEqual(anonymous);
    expect(readStudyPlanDocument("user-1", storage)).toBeNull();
    expect(readStudyPlanDocument(null, storage)).toBeNull();
    expect(storage.getItem(ANONYMOUS_STUDY_PLAN_STORAGE_KEY)).toBe(JSON.stringify(anonymous));
    expect(otherUser.document).toBeNull();
    expect(readStudyPlanDocument("user-2", storage)).toBeNull();

    await deleteStudyPlanDocument({
      uid: "user-2",
      storage: failingStorage,
      syncCloud: false,
      now: () => 202,
    });
    expect(readStudyPlanDocument(null, storage)).toBeNull();
    expect(storage.getItem(ANONYMOUS_STUDY_PLAN_STORAGE_KEY)).toBe(JSON.stringify(anonymous));

    const signedOutDelete = await deleteStudyPlanDocument({
      storage: failingStorage,
      syncCloud: false,
      now: () => 202,
    });
    const signedOutSave = await saveStudyPlanDocument(buildDocument(202, 1600), {
      storage: failingStorage,
      syncCloud: false,
      now: () => 202,
    });
    expect(signedOutDelete.deleted).toBe(false);
    expect(signedOutSave.cloudStatus).toBe("error");
    expect(storage.getItem(ANONYMOUS_STUDY_PLAN_STORAGE_KEY)).toBe(JSON.stringify(anonymous));

    failAccountWrite = false;
    const retry = await syncStudyPlanDocument("user-1", {
      storage: failingStorage,
      cloudAdapter: null,
      now: () => 203,
    });
    expect(retry.document).toEqual(anonymous);
    expect(readStudyPlanDocument("user-1", storage)).toEqual(anonymous);
    expect(readStudyPlanDocument(null, storage)).toBeNull();
  });

  it("keeps a failed anonymous-source removal bound to the first user", async () => {
    const storage = new MemoryStorage();
    const anonymous = buildDocument(100, 1400);
    storage.setItem(ANONYMOUS_STUDY_PLAN_STORAGE_KEY, JSON.stringify(anonymous));
    let failAnonymousRemoval = true;
    const failingStorage: StudyPlanStorageLike = {
      getItem: (key) => storage.getItem(key),
      setItem: (key, value) => storage.setItem(key, value),
      removeItem: (key) => {
        if (failAnonymousRemoval && key === ANONYMOUS_STUDY_PLAN_STORAGE_KEY) {
          throw new Error("storage unavailable");
        }
        storage.removeItem(key);
      },
    };

    const firstAttempt = await syncStudyPlanDocument("user-1", {
      storage: failingStorage,
      cloudAdapter: null,
      now: () => 200,
    });
    const otherUser = await syncStudyPlanDocument("user-2", {
      storage: failingStorage,
      cloudAdapter: null,
      now: () => 201,
    });

    expect(firstAttempt.document).toEqual(anonymous);
    expect(readStudyPlanDocument("user-1", storage)).toEqual(anonymous);
    expect(readStudyPlanDocument(null, storage)).toBeNull();
    expect(storage.getItem(ANONYMOUS_STUDY_PLAN_STORAGE_KEY)).toBe(JSON.stringify(anonymous));
    expect(otherUser.document).toBeNull();
    expect(readStudyPlanDocument("user-2", storage)).toBeNull();

    failAnonymousRemoval = false;
    await syncStudyPlanDocument("user-1", {
      storage: failingStorage,
      cloudAdapter: null,
      now: () => 202,
    });
    expect(readStudyPlanDocument(null, storage)).toBeNull();
  });

  it("does not overwrite an account-local loser until its backup is durable", async () => {
    const storage = new MemoryStorage();
    const accountLocal = buildDocument(100, 1400);
    const anonymous = buildDocument(200, 1500);
    storage.setItem(studyPlanStorageKey("user-1"), JSON.stringify(accountLocal));
    storage.setItem(ANONYMOUS_STUDY_PLAN_STORAGE_KEY, JSON.stringify(anonymous));
    let failBackupWrite = true;
    const failingStorage: StudyPlanStorageLike = {
      getItem: (key) => storage.getItem(key),
      setItem: (key, value) => {
        if (failBackupWrite && key === studyPlanBackupStorageKey("user-1")) throw new Error("quota");
        storage.setItem(key, value);
      },
      removeItem: (key) => storage.removeItem(key),
    };

    const firstAttempt = await syncStudyPlanDocument("user-1", {
      storage: failingStorage,
      cloudAdapter: null,
      now: () => 300,
    });
    const otherUser = await syncStudyPlanDocument("user-2", {
      storage: failingStorage,
      cloudAdapter: null,
      now: () => 301,
    });

    expect(firstAttempt.document).toEqual(anonymous);
    expect(readStudyPlanDocument("user-1", storage)).toEqual(accountLocal);
    expect(readStudyPlanDocument(null, storage)).toBeNull();
    expect(storage.getItem(ANONYMOUS_STUDY_PLAN_STORAGE_KEY)).toBe(JSON.stringify(anonymous));
    expect(otherUser.document).toBeNull();

    failBackupWrite = false;
    const retry = await syncStudyPlanDocument("user-1", {
      storage: failingStorage,
      cloudAdapter: null,
      now: () => 302,
    });
    expect(retry.document).toEqual(anonymous);
    expect(readStudyPlanDocument("user-1", storage)).toEqual(anonymous);
    expect(readStudyPlanBackup("user-1", storage)?.document).toEqual(accountLocal);
    expect(readStudyPlanDocument(null, storage)).toBeNull();
  });

  it("backs up an older account-local plan before consuming a newer anonymous plan offline", async () => {
    const storage = new MemoryStorage();
    const accountLocal = buildDocument(100, 1400);
    const anonymous = buildDocument(200, 1500);
    storage.setItem(studyPlanStorageKey("user-1"), JSON.stringify(accountLocal));
    storage.setItem(ANONYMOUS_STUDY_PLAN_STORAGE_KEY, JSON.stringify(anonymous));

    const result = await syncStudyPlanDocument("user-1", {
      storage,
      cloudAdapter: null,
      now: () => 300,
    });

    expect(result.document).toEqual(anonymous);
    expect(result.backup?.document).toEqual(accountLocal);
    expect(readStudyPlanBackup("user-1", storage)?.document).toEqual(accountLocal);
    expect(readStudyPlanDocument(null, storage)).toBeNull();
  });

  it("backs up an older anonymous plan before consuming it into a newer account-local plan offline", async () => {
    const storage = new MemoryStorage();
    const accountLocal = buildDocument(200, 1500);
    const anonymous = buildDocument(100, 1400);
    storage.setItem(studyPlanStorageKey("user-1"), JSON.stringify(accountLocal));
    storage.setItem(ANONYMOUS_STUDY_PLAN_STORAGE_KEY, JSON.stringify(anonymous));

    const result = await syncStudyPlanDocument("user-1", {
      storage,
      cloudAdapter: null,
      now: () => 300,
    });

    expect(result.document).toEqual(accountLocal);
    expect(result.backup?.document).toEqual(anonymous);
    expect(readStudyPlanBackup("user-1", storage)?.document).toEqual(anonymous);
    expect(readStudyPlanDocument(null, storage)).toBeNull();
  });

  it("chooses the newest cloud document and retains the local loser as a backup", async () => {
    const storage = new MemoryStorage();
    const local = buildDocument(100, 1400);
    const remote = buildDocument(300, 1500);
    storage.setItem(studyPlanStorageKey("user-1"), JSON.stringify(local));
    const cloudAdapter: StudyPlanCloudAdapter = {
      sync: async () => ({ document: remote, losingDocument: local }),
      delete: async () => undefined,
    };

    const result = await syncStudyPlanDocument("user-1", {
      storage,
      cloudAdapter,
      now: () => 400,
    });

    expect(result.document?.settings.targetScore).toBe(1500);
    expect(readStudyPlanBackup("user-1", storage)?.document.settings.targetScore).toBe(1400);
  });

  it("retains both distinct local losers in a three-way cloud conflict", async () => {
    const storage = new MemoryStorage();
    const accountLocal = buildDocument(100, 1400);
    const anonymous = buildDocument(200, 1450);
    const remote = buildDocument(300, 1500);
    storage.setItem(studyPlanStorageKey("user-1"), JSON.stringify(accountLocal));
    storage.setItem(ANONYMOUS_STUDY_PLAN_STORAGE_KEY, JSON.stringify(anonymous));
    const cloudAdapter: StudyPlanCloudAdapter = {
      sync: async () => ({ document: remote, losingDocument: anonymous }),
      delete: async () => undefined,
    };

    await syncStudyPlanDocument("user-1", { storage, cloudAdapter, now: () => 400 });

    const backup = readStudyPlanBackup("user-1", storage)!;
    expect([
      backup.document.settings.targetScore,
      ...(backup.alternateDocuments ?? []).map((document) => document.settings.targetScore),
    ]).toEqual([1450, 1400]);
  });

  it("does not let a delayed cloud response overwrite a newer local save", async () => {
    const storage = new MemoryStorage();
    let resolveCloud: ((value: { document: ReturnType<typeof buildDocument> }) => void) | undefined;
    const cloudAdapter: StudyPlanCloudAdapter = {
      sync: async () => new Promise((resolve) => {
        resolveCloud = resolve;
      }),
      delete: async () => undefined,
    };
    const older = buildDocument(100, 1400);
    const pending = saveStudyPlanDocument(older, {
      uid: "user-1",
      storage,
      cloudAdapter,
      now: () => 100,
    });
    await Promise.resolve();
    await saveStudyPlanDocument(buildDocument(200, 1500), {
      uid: "user-1",
      storage,
      syncCloud: false,
      now: () => 200,
    });
    resolveCloud?.({ document: older });
    await pending;

    expect(readStudyPlanDocument("user-1", storage)?.settings.targetScore).toBe(1500);
  });

  it("keeps a deletion tombstone until a later cloud sync applies it", async () => {
    const storage = new MemoryStorage();
    const deletedDocument = buildDocument(100);
    storage.setItem(studyPlanStorageKey("user-1"), JSON.stringify(deletedDocument));
    await deleteStudyPlanDocument({
      uid: "user-1",
      storage,
      syncCloud: false,
      now: () => 500,
    });
    let receivedDeletedAt: number | undefined;
    const cloudAdapter: StudyPlanCloudAdapter = {
      sync: async (_uid, _document, deletedAt) => {
        receivedDeletedAt = deletedAt;
        return { document: null, losingDocument: deletedDocument, deletionApplied: true };
      },
      delete: async () => undefined,
    };

    const result = await syncStudyPlanDocument("user-1", {
      storage,
      cloudAdapter,
      now: () => 600,
    });
    expect(receivedDeletedAt).toBe(500);
    expect(result.document).toBeNull();
    expect(readStudyPlanBackup("user-1", storage)).toBeNull();

    receivedDeletedAt = 1;
    await syncStudyPlanDocument("user-1", { storage, cloudAdapter, now: () => 700 });
    expect(receivedDeletedAt).toBeUndefined();
  });

  it("does not promise a retry when the deletion tombstone could not be written", async () => {
    const storage = new MemoryStorage();
    storage.values.set(studyPlanStorageKey("user-1"), JSON.stringify(buildDocument(100)));
    const failingStorage: StudyPlanStorageLike = {
      getItem: (key) => storage.getItem(key),
      setItem: (key, value) => {
        if (key.includes("study-plan-deleted")) throw new Error("quota");
        storage.setItem(key, value);
      },
      removeItem: (key) => storage.removeItem(key),
    };
    const cloudAdapter: StudyPlanCloudAdapter = {
      sync: async () => ({ document: null }),
      delete: async () => { throw new Error("offline"); },
    };

    const result = await deleteStudyPlanDocument({
      uid: "user-1",
      storage: failingStorage,
      cloudAdapter,
      now: () => 500,
    });

    expect(result.deleted).toBe(false);
    expect(result.cloudStatus).toBe("skipped");
  });

  it("migrates legacy local keys only after writing a valid V2 document", () => {
    const storage = new MemoryStorage();
    storage.setItem("1600now-study-plan-lab", JSON.stringify({
      ...createDefaultStudyPlanSettings(today),
      setupComplete: true,
      startDate: today,
      satDate: "2026-08-22",
    }));
    storage.setItem("1600now-study-plan-progress", JSON.stringify({
      completed: { "legacy-completed": true },
      confidence: { "legacy-completed": "okay" },
    }));
    storage.setItem("1600now-study-plan-snapshot", JSON.stringify([{
      id: "legacy-completed",
      date: "2026-07-08",
      title: "Completed Algebra bank set",
      minutes: 30,
      focus: "Algebra",
      type: "drill",
      detail: "Legacy completed work",
      action: { kind: "bank-set" },
    }]));

    const migrated = readStudyPlanDocument(null, storage, Date.parse("2026-07-09T12:00:00.000Z"));
    expect(migrated?.schemaVersion).toBe(2);
    expect(migrated?.updatedAt).toBe(1);
    expect(migrated?.tasks.find((task) => task.id === "legacy-completed")).toMatchObject({
      action: { kind: "checklist" },
      locked: true,
    });
    expect(migrated?.progress["legacy-completed"]).toEqual({ completed: true, confidence: "okay" });
    expect(storage.getItem(ANONYMOUS_STUDY_PLAN_STORAGE_KEY)).not.toBeNull();
    expect(storage.getItem("1600now-study-plan-lab")).toBeNull();
    expect(storage.getItem("1600now-study-plan-snapshot")).toBeNull();
  });
});
