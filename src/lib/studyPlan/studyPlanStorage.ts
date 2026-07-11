import {
  STUDY_PLAN_SCHEMA_VERSION,
  migrateLegacyStudyPlanData,
  sanitizeStudyPlanDocument,
  type StudyPlanDocumentV2,
} from "@/lib/studyPlan/studyPlanDocument";

const STORAGE_KEY_PREFIX = "1600now-study-plan:v2:";
const BACKUP_KEY_PREFIX = "1600now-study-plan-backup:v2:";
const DELETION_KEY_PREFIX = "1600now-study-plan-deleted:v2:";
const ANONYMOUS_CLAIM_STORAGE_KEY = "1600now-study-plan-anonymous-claim:v2";
const ANONYMOUS_MIGRATION_LOCK_NAME = "1600now-study-plan-anonymous-migration:v2";
const ANONYMOUS_SUFFIX = "anon";
const LEGACY_SETTINGS_KEY = "1600now-study-plan-lab";
const LEGACY_PROGRESS_KEY = "1600now-study-plan-progress";
const LEGACY_SCORE_REPORT_KEY = "1600now-study-plan-score-report";
const LEGACY_SNAPSHOT_KEY = "1600now-study-plan-snapshot";

export const ANONYMOUS_STUDY_PLAN_STORAGE_KEY = `${STORAGE_KEY_PREFIX}${ANONYMOUS_SUFFIX}`;

export interface StudyPlanStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StudyPlanMigrationLockManager {
  request<T>(name: string, callback: () => T): Promise<T>;
}

export interface StudyPlanBackupV2 {
  schemaVersion: typeof STUDY_PLAN_SCHEMA_VERSION;
  savedAt: number;
  reason: "anonymous-migration" | "local-cloud-conflict";
  document: StudyPlanDocumentV2;
  alternateDocuments?: StudyPlanDocumentV2[];
}

export interface StudyPlanCloudResolution {
  document: StudyPlanDocumentV2 | null;
  losingDocument?: StudyPlanDocumentV2;
  deletionApplied?: boolean;
}

export interface StudyPlanCloudAdapter {
  sync(
    uid: string,
    document: StudyPlanDocumentV2 | null,
    deletedAt?: number,
  ): Promise<StudyPlanCloudResolution>;
  delete(uid: string): Promise<void>;
}

export interface StudyPlanPersistenceOptions {
  uid?: string | null;
  storage?: StudyPlanStorageLike | null;
  syncCloud?: boolean;
  cloudAdapter?: StudyPlanCloudAdapter | null;
  cloudTimeoutMs?: number;
  migrationLockManager?: StudyPlanMigrationLockManager | null;
  now?: () => number;
}

export interface StudyPlanSyncResult {
  document: StudyPlanDocumentV2 | null;
  cloudStatus: "synced" | "skipped" | "error";
  backup?: StudyPlanBackupV2;
  error?: unknown;
}

export interface DeleteStudyPlanResult {
  deleted: boolean;
  cloudStatus: "deleted" | "pending" | "skipped";
  error?: unknown;
}

const defaultStorage = (): StudyPlanStorageLike | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const validUid = (uid: string) => uid.length > 0 && uid.length <= 128 && !uid.includes("/");

const DEFAULT_CLOUD_TIMEOUT_MS = 5_000;

const withCloudTimeout = <T>(operation: Promise<T>, timeoutMs = DEFAULT_CLOUD_TIMEOUT_MS) => {
  const boundedTimeout = Number.isFinite(timeoutMs) ? Math.max(1, timeoutMs) : DEFAULT_CLOUD_TIMEOUT_MS;
  return new Promise<T>((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      reject(new Error("Study plan account sync timed out."));
    }, boundedTimeout);
    operation.then(resolve, reject).finally(() => globalThis.clearTimeout(timeout));
  });
};

const suffixFor = (uid?: string | null) => uid ?? ANONYMOUS_SUFFIX;

export const studyPlanStorageKey = (uid?: string | null) =>
  `${STORAGE_KEY_PREFIX}${suffixFor(uid)}`;

export const studyPlanBackupStorageKey = (uid?: string | null) =>
  `${BACKUP_KEY_PREFIX}${suffixFor(uid)}`;

const studyPlanDeletionStorageKey = (uid: string) => `${DELETION_KEY_PREFIX}${uid}`;

const parseJson = (value: string | null): unknown => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const readStorageValue = (storage: StudyPlanStorageLike, key: string) => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const removeStorageValue = (storage: StudyPlanStorageLike, key: string) => {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};

const readAnonymousClaim = (storage: StudyPlanStorageLike) => {
  const value = parseJson(readStorageValue(storage, ANONYMOUS_CLAIM_STORAGE_KEY));
  if (!value || typeof value !== "object") return null;
  const claim = value as { uid?: unknown; claimedAt?: unknown };
  return typeof claim.uid === "string"
    && validUid(claim.uid)
    && Number.isInteger(claim.claimedAt)
    && Number(claim.claimedAt) > 0
    ? { uid: claim.uid, claimedAt: Number(claim.claimedAt) }
    : null;
};

const claimAnonymousSource = (
  storage: StudyPlanStorageLike,
  uid: string,
  claimedAt: number,
) => {
  const current = readAnonymousClaim(storage);
  if (current) return current.uid === uid;
  try {
    storage.setItem(ANONYMOUS_CLAIM_STORAGE_KEY, JSON.stringify({ uid, claimedAt }));
  } catch {
    return false;
  }
  return readAnonymousClaim(storage)?.uid === uid;
};

const releaseAnonymousClaim = (storage: StudyPlanStorageLike, uid?: string) => {
  const current = readAnonymousClaim(storage);
  if (uid && current?.uid !== uid) return false;
  return removeStorageValue(storage, ANONYMOUS_CLAIM_STORAGE_KEY);
};

const removeAnonymousSource = (
  storage: StudyPlanStorageLike,
  uid?: string,
) => {
  const claim = readAnonymousClaim(storage);
  if (claim && (!uid || claim.uid !== uid)) return false;
  if (!removeStorageValue(storage, ANONYMOUS_STUDY_PLAN_STORAGE_KEY)) return false;
  if (readStorageValue(storage, ANONYMOUS_STUDY_PLAN_STORAGE_KEY) !== null) return false;
  return releaseAnonymousClaim(storage, claim?.uid);
};

const consumeClaimedAnonymousSource = (
  storage: StudyPlanStorageLike,
  uid: string,
) => {
  if (readAnonymousClaim(storage)?.uid !== uid) return false;
  return removeAnonymousSource(storage, uid);
};

const inMemoryMigrationLocks = new WeakMap<StudyPlanStorageLike, Promise<void>>();

const withInMemoryMigrationLock = async <T>(
  storage: StudyPlanStorageLike,
  callback: () => T,
): Promise<T> => {
  const previous = inMemoryMigrationLocks.get(storage) ?? Promise.resolve();
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const queued = previous.then(() => gate);
  inMemoryMigrationLocks.set(storage, queued);
  await previous;
  try {
    return callback();
  } finally {
    release();
    if (inMemoryMigrationLocks.get(storage) === queued) inMemoryMigrationLocks.delete(storage);
  }
};

const browserMigrationLockManager = (): StudyPlanMigrationLockManager | null => {
  if (typeof navigator === "undefined" || !navigator.locks) return null;
  return {
    request: <T>(name: string, callback: () => T) =>
      navigator.locks.request(name, callback) as Promise<T>,
  };
};

const withAnonymousMigrationLock = async <T>(
  storage: StudyPlanStorageLike | null,
  configuredLockManager: StudyPlanMigrationLockManager | null | undefined,
  callback: (allowUnclaimedMigration: boolean) => T,
): Promise<T> => {
  if (!storage) return callback(false);
  if (configuredLockManager !== undefined) {
    return configuredLockManager
      ? configuredLockManager.request(ANONYMOUS_MIGRATION_LOCK_NAME, () => callback(true))
      : callback(false);
  }
  const browserLockManager = browserMigrationLockManager();
  if (browserLockManager) {
    return browserLockManager.request(ANONYMOUS_MIGRATION_LOCK_NAME, () => callback(true));
  }
  if (typeof window === "undefined") {
    return withInMemoryMigrationLock(storage, () => callback(true));
  }
  return callback(false);
};

const documentFingerprint = (document: StudyPlanDocumentV2 | null) =>
  document ? JSON.stringify(document) : "";

const writeDocument = (
  storage: StudyPlanStorageLike,
  uid: string | null | undefined,
  document: StudyPlanDocumentV2,
  preferCandidateOnTie = false,
) => {
  const current = sanitizeStudyPlanDocument(parseJson(readStorageValue(storage, studyPlanStorageKey(uid))));
  if (current && (
    current.updatedAt > document.updatedAt
    || (current.updatedAt === document.updatedAt && !preferCandidateOnTie)
  )) return current;
  storage.setItem(studyPlanStorageKey(uid), JSON.stringify(document));
  return document;
};

const tryWriteDocument = (
  storage: StudyPlanStorageLike,
  uid: string | null | undefined,
  document: StudyPlanDocumentV2,
  preferCandidateOnTie = false,
) => {
  try {
    return writeDocument(storage, uid, document, preferCandidateOnTie);
  } catch {
    return null;
  }
};

const readDeletion = (storage: StudyPlanStorageLike, uid: string) => {
  const value = parseJson(readStorageValue(storage, studyPlanDeletionStorageKey(uid)));
  return value && typeof value === "object"
    && Number.isInteger((value as { deletedAt?: unknown }).deletedAt)
    && Number((value as { deletedAt: number }).deletedAt) > 0
    ? Number((value as { deletedAt: number }).deletedAt)
    : undefined;
};

const writeDeletion = (storage: StudyPlanStorageLike, uid: string, deletedAt: number) => {
  storage.setItem(studyPlanDeletionStorageKey(uid), JSON.stringify({ deletedAt }));
};

const tryWriteDeletion = (storage: StudyPlanStorageLike, uid: string, deletedAt: number) => {
  try {
    writeDeletion(storage, uid, deletedAt);
    return true;
  } catch {
    return false;
  }
};

const readLegacy = (storage: StudyPlanStorageLike, now: number) => {
  const settings = parseJson(readStorageValue(storage, LEGACY_SETTINGS_KEY));
  if (!settings) return null;
  const migrated = migrateLegacyStudyPlanData({
    settings,
    progress: parseJson(readStorageValue(storage, LEGACY_PROGRESS_KEY)),
    scoreReport: parseJson(readStorageValue(storage, LEGACY_SCORE_REPORT_KEY)),
    snapshot: parseJson(readStorageValue(storage, LEGACY_SNAPSHOT_KEY)),
  }, now);
  if (!migrated) return null;
  try {
    releaseAnonymousClaim(storage);
    storage.setItem(ANONYMOUS_STUDY_PLAN_STORAGE_KEY, JSON.stringify(migrated));
    storage.removeItem(LEGACY_SETTINGS_KEY);
    storage.removeItem(LEGACY_PROGRESS_KEY);
    storage.removeItem(LEGACY_SCORE_REPORT_KEY);
    storage.removeItem(LEGACY_SNAPSHOT_KEY);
  } catch {
    return migrated;
  }
  return migrated;
};

const removeLegacyStudyPlanData = (storage: StudyPlanStorageLike) => {
  for (const key of [LEGACY_SETTINGS_KEY, LEGACY_PROGRESS_KEY, LEGACY_SCORE_REPORT_KEY, LEGACY_SNAPSHOT_KEY]) {
    removeStorageValue(storage, key);
  }
};

export const readStudyPlanDocument = (
  uid?: string | null,
  storage: StudyPlanStorageLike | null = defaultStorage(),
  now = Date.now(),
): StudyPlanDocumentV2 | null => {
  if (!storage) return null;
  if (uid == null && readAnonymousClaim(storage)) return null;
  const document = sanitizeStudyPlanDocument(parseJson(readStorageValue(storage, studyPlanStorageKey(uid))));
  if (document) return document;
  return uid == null ? readLegacy(storage, now) : null;
};

const readAnonymousSourceForOwner = (
  storage: StudyPlanStorageLike,
  uid: string,
  now: number,
) => {
  const claim = readAnonymousClaim(storage);
  if (claim && claim.uid !== uid) return null;
  const document = sanitizeStudyPlanDocument(parseJson(
    readStorageValue(storage, ANONYMOUS_STUDY_PLAN_STORAGE_KEY),
  ));
  if (document) return document;
  if (claim) {
    releaseAnonymousClaim(storage, uid);
    return null;
  }
  return readLegacy(storage, now);
};

const readBackupValue = (value: unknown): StudyPlanBackupV2 | null => {
  if (!value || typeof value !== "object") return null;
  const backup = value as Partial<StudyPlanBackupV2>;
  if (backup.schemaVersion !== STUDY_PLAN_SCHEMA_VERSION) return null;
  if (!Number.isInteger(backup.savedAt) || Number(backup.savedAt) <= 0) return null;
  if (backup.reason !== "anonymous-migration" && backup.reason !== "local-cloud-conflict") return null;
  const document = sanitizeStudyPlanDocument(backup.document);
  if (!document) return null;
  const alternateDocuments = Array.isArray(backup.alternateDocuments)
    ? backup.alternateDocuments
      .map(sanitizeStudyPlanDocument)
      .filter((candidate): candidate is StudyPlanDocumentV2 => candidate !== null)
      .filter((candidate) => documentFingerprint(candidate) !== documentFingerprint(document))
      .slice(0, 2)
    : [];
  return {
    schemaVersion: STUDY_PLAN_SCHEMA_VERSION,
    savedAt: Number(backup.savedAt),
    reason: backup.reason,
    document,
    ...(alternateDocuments.length ? { alternateDocuments } : {}),
  };
};

export const readStudyPlanBackup = (
  uid?: string | null,
  storage: StudyPlanStorageLike | null = defaultStorage(),
): StudyPlanBackupV2 | null => {
  if (!storage) return null;
  return readBackupValue(parseJson(readStorageValue(storage, studyPlanBackupStorageKey(uid))));
};

const saveBackup = (
  storage: StudyPlanStorageLike,
  uid: string,
  document: StudyPlanDocumentV2 | null | undefined,
  winner: StudyPlanDocumentV2 | null,
  reason: StudyPlanBackupV2["reason"],
  now: number,
) => {
  if (!document || documentFingerprint(document) === documentFingerprint(winner)) return undefined;
  const current = readStudyPlanBackup(uid, storage);
  const byFingerprint = new Map<string, StudyPlanDocumentV2>();
  for (const candidate of [
    document,
    current?.document,
    ...(current?.alternateDocuments ?? []),
  ]) {
    if (!candidate || documentFingerprint(candidate) === documentFingerprint(winner)) continue;
    byFingerprint.set(documentFingerprint(candidate), candidate);
  }
  const documents = [...byFingerprint.values()]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, 3);
  if (!documents.length) return undefined;
  const backup: StudyPlanBackupV2 = {
    schemaVersion: STUDY_PLAN_SCHEMA_VERSION,
    savedAt: now,
    reason,
    document: documents[0],
    ...(documents.length > 1 ? { alternateDocuments: documents.slice(1) } : {}),
  };
  storage.setItem(studyPlanBackupStorageKey(uid), JSON.stringify(backup));
  return backup;
};

const latestDocument = (
  first: StudyPlanDocumentV2 | null,
  second: StudyPlanDocumentV2 | null,
) => {
  if (!first) return second;
  if (!second) return first;
  return first.updatedAt >= second.updatedAt ? first : second;
};

const firestorePayload = (uid: string, document: StudyPlanDocumentV2) => ({
  user_id: uid,
  schemaVersion: document.schemaVersion,
  settings: document.settings,
  ...(document.scoreSummary ? { scoreSummary: document.scoreSummary } : {}),
  tasks: document.tasks,
  progress: document.progress,
  updatedAt: document.updatedAt,
});

const importCloudDependencies = async () => {
  const [firebaseDb, firebaseAuth, firestore] = await Promise.all([
    import("@/lib/firebase/firebaseDb"),
    import("@/lib/firebase/firebaseAuth"),
    import("firebase/firestore"),
  ]);
  firebaseDb.initializeFirebaseAppCheck();
  return {
    db: firebaseDb.db,
    auth: firebaseAuth.auth,
    doc: firestore.doc,
    runTransaction: firestore.runTransaction,
    deleteDoc: firestore.deleteDoc,
  };
};

let cloudDependenciesPromise: Promise<Awaited<ReturnType<typeof importCloudDependencies>>> | null = null;

const loadCloudDependencies = () => {
  cloudDependenciesPromise ??= importCloudDependencies().catch((error) => {
    cloudDependenciesPromise = null;
    throw error;
  });
  return cloudDependenciesPromise;
};

const defaultCloudAdapter = async (uid: string): Promise<StudyPlanCloudAdapter | null> => {
  const dependencies = await loadCloudDependencies();
  if (!dependencies.db
      || dependencies.auth?.currentUser?.uid !== uid
      || dependencies.auth.currentUser.emailVerified !== true) return null;
  const { db, doc, runTransaction, deleteDoc } = dependencies;
  const reference = doc(db, "study_plans", uid);
  return {
    sync: async (_uid, candidate, deletedAt) => runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(reference);
      const remote = sanitizeStudyPlanDocument(snapshot.data());
      const local = candidate && (!deletedAt || candidate.updatedAt > deletedAt) ? candidate : null;

      if (deletedAt && !local) {
        if (snapshot.exists()) transaction.delete(reference);
        return { document: null, ...(remote ? { losingDocument: remote } : {}), deletionApplied: true };
      }
      if (!remote && !local) return { document: null };
      if (!remote && local) {
        transaction.set(reference, firestorePayload(uid, local));
        return { document: local };
      }
      if (remote && !local) return { document: remote };
      if (remote!.updatedAt >= local!.updatedAt) {
        return {
          document: remote,
          ...(documentFingerprint(remote) === documentFingerprint(local) ? {} : { losingDocument: local! }),
        };
      }
      transaction.set(reference, firestorePayload(uid, local!));
      return { document: local!, losingDocument: remote! };
    }),
    delete: async () => deleteDoc(reference),
  };
};

const resolveCloudAdapter = async (
  uid: string,
  provided: StudyPlanCloudAdapter | null | undefined,
) => provided === undefined ? defaultCloudAdapter(uid) : provided;

export const saveStudyPlanDocument = async (
  value: StudyPlanDocumentV2,
  options: StudyPlanPersistenceOptions = {},
): Promise<StudyPlanSyncResult> => {
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const sanitized = sanitizeStudyPlanDocument(value);
  if (!sanitized) throw new Error("Invalid study plan document.");
  const uid = options.uid ?? null;
  if (uid && !validUid(uid)) throw new Error("Invalid study plan user ID.");
  const now = options.now?.() ?? Date.now();
  if (!uid && storage) {
    const claim = readAnonymousClaim(storage);
    if (claim && readStorageValue(storage, ANONYMOUS_STUDY_PLAN_STORAGE_KEY) !== null) {
      const error = new Error("This anonymous study plan is being recovered by a signed-in account.");
      return { document: sanitized, cloudStatus: "error", error };
    }
    if (claim) releaseAnonymousClaim(storage, claim.uid);
  }
  const current = storage ? readStudyPlanDocument(uid, storage, now) : null;
  const creatingFreshAnonymousSource = !uid && storage && current === null;
  const deletedAt = uid && storage ? readDeletion(storage, uid) : undefined;
  const next: StudyPlanDocumentV2 = {
    ...sanitized,
    updatedAt: Math.max(now, sanitized.updatedAt, (current?.updatedAt ?? 0) + 1, (deletedAt ?? 0) + 1),
  };
  let localWriteError: unknown;
  if (storage) {
    try {
      writeDocument(storage, uid, next, true);
      if (uid) removeStorageValue(storage, studyPlanDeletionStorageKey(uid));
      else if (creatingFreshAnonymousSource) releaseAnonymousClaim(storage);
    } catch (error) {
      localWriteError = error;
    }
  }
  if (!uid || options.syncCloud === false) {
    if (!storage) {
      const error = new Error("Study plan storage is unavailable.");
      return { document: next, cloudStatus: "error", error };
    }
    return localWriteError
      ? { document: next, cloudStatus: "error", error: localWriteError }
      : { document: next, cloudStatus: "skipped" };
  }

  try {
    const adapter = await resolveCloudAdapter(uid, options.cloudAdapter);
    if (!adapter) {
      if (!storage) {
        const error = new Error("Study plan storage is unavailable.");
        return { document: next, cloudStatus: "error", error };
      }
      return localWriteError
        ? { document: next, cloudStatus: "error", error: localWriteError }
        : { document: next, cloudStatus: "skipped" };
    }
    const resolution = await withCloudTimeout(adapter.sync(uid, next), options.cloudTimeoutMs);
    if (!resolution.document) throw new Error("Cloud study-plan sync returned no saved document.");
    const winner = resolution.document;
    let backup: StudyPlanBackupV2 | undefined;
    let document = winner;
    if (storage) {
      try {
        for (const losingDocument of [resolution.losingDocument, next]) {
          backup = saveBackup(
            storage,
            uid,
            losingDocument,
            winner,
            "local-cloud-conflict",
            now,
          ) ?? backup;
        }
        document = writeDocument(storage, uid, winner, true);
      } catch {
        document = winner;
      }
    }
    const cloudStatus = documentFingerprint(document) === documentFingerprint(winner)
      ? "synced"
      : "skipped";
    return { document, cloudStatus, ...(backup ? { backup } : {}) };
  } catch (error) {
    return {
      document: storage ? readStudyPlanDocument(uid, storage, now) ?? next : next,
      cloudStatus: "error",
      error,
    };
  }
};

export const syncStudyPlanDocument = async (
  uid: string,
  options: Omit<StudyPlanPersistenceOptions, "uid"> = {},
): Promise<StudyPlanSyncResult> => {
  if (!validUid(uid)) throw new Error("Invalid study plan user ID.");
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const now = options.now?.() ?? Date.now();
  const prepared = await withAnonymousMigrationLock(
    storage,
    options.migrationLockManager,
    (allowUnclaimedMigration) => {
      const userDocument = storage ? readStudyPlanDocument(uid, storage, now) : null;
      const existingClaim = storage ? readAnonymousClaim(storage) : null;
      const canReadAnonymousSource = allowUnclaimedMigration || existingClaim?.uid === uid;
      const availableAnonymousDocument = storage && canReadAnonymousSource
        ? readAnonymousSourceForOwner(storage, uid, now)
        : null;
      const anonymousDocument = storage
        && availableAnonymousDocument
        && (existingClaim?.uid === uid || claimAnonymousSource(storage, uid, now))
        ? availableAnonymousDocument
        : null;
      const deletedAt = storage ? readDeletion(storage, uid) : undefined;
      let localWinner = latestDocument(
        userDocument && (!deletedAt || userDocument.updatedAt > deletedAt) ? userDocument : null,
        anonymousDocument && (!deletedAt || anonymousDocument.updatedAt > deletedAt) ? anonymousDocument : null,
      );
      let backup: StudyPlanBackupV2 | undefined;
      let localBackupFailed = false;
      if (storage && anonymousDocument && localWinner) {
        try {
          for (const losingDocument of [userDocument, anonymousDocument]) {
            if (!losingDocument || documentFingerprint(losingDocument) === documentFingerprint(localWinner)) continue;
            const saved = saveBackup(
              storage,
              uid,
              losingDocument,
              localWinner,
              losingDocument === anonymousDocument ? "anonymous-migration" : "local-cloud-conflict",
              now,
            );
            if (!saved) throw new Error("Anonymous study-plan backup could not be saved.");
            backup = saved;
          }
        } catch {
          localBackupFailed = true;
        }
      }
      if (storage && localWinner && !localBackupFailed) {
        const written = tryWriteDocument(storage, uid, localWinner, true);
        if (written) localWinner = written;
      }
      if (storage && anonymousDocument && !localBackupFailed) {
        const durableDocument = readStudyPlanDocument(uid, storage, now);
        if (durableDocument && durableDocument.updatedAt >= (localWinner?.updatedAt ?? 0)) {
          let backupFailed = false;
          try {
            for (const losingDocument of [userDocument, anonymousDocument]) {
              if (!losingDocument || documentFingerprint(losingDocument) === documentFingerprint(durableDocument)) continue;
              const saved = saveBackup(
                storage,
                uid,
                losingDocument,
                durableDocument,
                losingDocument === anonymousDocument ? "anonymous-migration" : "local-cloud-conflict",
                now,
              );
              if (!saved) throw new Error("Anonymous study-plan backup could not be saved.");
              backup = saved;
            }
          } catch {
            backupFailed = true;
          }
          localWinner = durableDocument;
          if (!backupFailed) consumeClaimedAnonymousSource(storage, uid);
        }
      }
      return { userDocument, anonymousDocument, deletedAt, localWinner, backup };
    },
  );
  const { userDocument, anonymousDocument, deletedAt, localWinner } = prepared;
  let { backup } = prepared;

  try {
    const adapter = await resolveCloudAdapter(uid, options.cloudAdapter);
    if (!adapter) {
      if (!storage) {
        const error = new Error("Study plan storage is unavailable.");
        return { document: localWinner, cloudStatus: "error", error };
      }
      return { document: localWinner, cloudStatus: "skipped", ...(backup ? { backup } : {}) };
    }
    const resolution = await withCloudTimeout(
      adapter.sync(uid, localWinner, deletedAt),
      options.cloudTimeoutMs,
    );
    if (!resolution.document && localWinner && !resolution.deletionApplied) {
      throw new Error("Cloud study-plan sync returned no saved document.");
    }
    const winner = resolution.document;
    let cloudBackupFailed = false;
    if (storage && !resolution.deletionApplied) {
      try {
        for (const losingDocument of [resolution.losingDocument, userDocument, anonymousDocument]) {
          backup = saveBackup(
            storage,
            uid,
            losingDocument,
            winner,
            anonymousDocument && losingDocument === anonymousDocument
              ? "anonymous-migration"
              : "local-cloud-conflict",
            now,
          ) ?? backup;
        }
      } catch {
        cloudBackupFailed = true;
      }
    }

    let document: StudyPlanDocumentV2 | null = winner;
    if (storage) {
      try {
        if (winner && !cloudBackupFailed) {
          document = writeDocument(storage, uid, winner, true);
        } else if (winner) {
          document = readStudyPlanDocument(uid, storage, now) ?? winner;
        } else {
          removeStorageValue(storage, studyPlanStorageKey(uid));
        }
      } catch {
        document = winner;
      }
      if (!deletedAt || resolution.deletionApplied || (winner && winner.updatedAt > deletedAt)) {
        removeStorageValue(storage, studyPlanDeletionStorageKey(uid));
      }
      if (anonymousDocument && !cloudBackupFailed) consumeClaimedAnonymousSource(storage, uid);
    }
    const cloudStatus = documentFingerprint(document) === documentFingerprint(winner)
      ? "synced"
      : "skipped";
    return { document, cloudStatus, ...(backup ? { backup } : {}) };
  } catch (error) {
    return { document: localWinner, cloudStatus: "error", ...(backup ? { backup } : {}), error };
  }
};

export const restoreStudyPlanBackup = async (
  uid: string,
  options: Omit<StudyPlanPersistenceOptions, "uid"> = {},
) => {
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  if (!storage) return { document: null, cloudStatus: "skipped" } as StudyPlanSyncResult;
  const backup = readStudyPlanBackup(uid, storage);
  if (!backup) return { document: null, cloudStatus: "skipped" } as StudyPlanSyncResult;
  return saveStudyPlanDocument(backup.document, { ...options, uid });
};

export const deleteStudyPlanDocument = async (
  options: StudyPlanPersistenceOptions & { includeBackup?: boolean; includeAnonymous?: boolean } = {},
): Promise<DeleteStudyPlanResult> => {
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const uid = options.uid ?? null;
  if (uid && !validUid(uid)) throw new Error("Invalid study plan user ID.");
  if (!uid) {
    if (!storage) return { deleted: false, cloudStatus: "skipped" };
    const deleted = removeAnonymousSource(storage);
    removeLegacyStudyPlanData(storage);
    if (options.includeBackup !== false) removeStorageValue(storage, studyPlanBackupStorageKey(null));
    return { deleted, cloudStatus: "skipped" };
  }

  const now = options.now?.() ?? Date.now();
  let deletedLocally = false;
  let tombstoneWritten = false;
  if (storage) {
    tombstoneWritten = tryWriteDeletion(storage, uid, now);
    deletedLocally = removeStorageValue(storage, studyPlanStorageKey(uid));
    if (options.includeBackup !== false) removeStorageValue(storage, studyPlanBackupStorageKey(uid));
    if (options.includeAnonymous !== false) {
      removeAnonymousSource(storage, uid);
    }
    removeLegacyStudyPlanData(storage);
  }
  if (options.syncCloud === false) {
    return {
      deleted: deletedLocally && tombstoneWritten,
      cloudStatus: deletedLocally && tombstoneWritten ? "pending" : "skipped",
      ...(!tombstoneWritten ? { error: new Error("Cloud deletion could not be queued.") } : {}),
    };
  }

  try {
    const adapter = await resolveCloudAdapter(uid, options.cloudAdapter);
    if (!adapter) {
      return {
        deleted: deletedLocally && tombstoneWritten,
        cloudStatus: deletedLocally && tombstoneWritten ? "pending" : "skipped",
        ...(!tombstoneWritten ? { error: new Error("Cloud deletion could not be queued.") } : {}),
      };
    }
    await withCloudTimeout(adapter.delete(uid), options.cloudTimeoutMs);
    if (storage) removeStorageValue(storage, studyPlanDeletionStorageKey(uid));
    return { deleted: true, cloudStatus: "deleted" };
  } catch (error) {
    return {
      deleted: deletedLocally && tombstoneWritten,
      cloudStatus: deletedLocally && tombstoneWritten ? "pending" : "skipped",
      error,
    };
  }
};
