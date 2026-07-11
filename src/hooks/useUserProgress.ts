import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  applyPersonalizationPreferences,
  getPersonalizationPreferences,
  type PersonalizationPreferences,
} from '@/lib/personalization';
import {
  getQuestionUiStateMap,
  mergeQuestionUiStateMaps,
  migrateLegacyQuestionUiState,
  questionUiStateStorageKey,
  saveQuestionUiStateMap,
  type QuestionUiStateMap,
} from '@/lib/practice/questionUiState';
import { resolvePastStableId } from '@/data/pastIdAliases';
import type { CustomPracticeSet } from '@/lib/practice/customPracticeSets';

const PROGRESS_KEY_PREFIX = 'userProgress:';
const VOCAB_KEY_PREFIX = 'vocabProgress:';
const LEGACY_PROGRESS_KEY = 'userProgress';
const LEGACY_VOCAB_KEY = 'vocab-progress';
const ANON_SUFFIX = 'anon';
const SCHEMA_VERSION = 1;
// Cap stored attempts per question so a heavy long-term user's single
// user_progress doc cannot grow past Firestore's 1 MiB document limit.
const MAX_ATTEMPTS_PER_QUESTION = 50;

const importFirestoreDependencies = async () => {
  const [firebaseDb, firestore] = await Promise.all([
    import('@/lib/firebase/firebaseDb'),
    import('firebase/firestore'),
  ]);
  firebaseDb.initializeFirebaseAppCheck();
  return {
    db: firebaseDb.db,
    doc: firestore.doc,
    getDoc: firestore.getDoc,
    setDoc: firestore.setDoc,
    runTransaction: firestore.runTransaction,
  };
};

let firestoreDependenciesPromise: Promise<Awaited<ReturnType<typeof importFirestoreDependencies>>> | null = null;

const loadFirestoreDependencies = () => {
  if (!firestoreDependenciesPromise) {
    firestoreDependenciesPromise = importFirestoreDependencies().catch((error) => {
      // Don't cache the rejection — let a later call retry the chunk import so
      // one flaky load doesn't disable cloud sync for the whole session.
      firestoreDependenciesPromise = null;
      throw error;
    });
  }
  return firestoreDependenciesPromise;
};

let lastSyncErrorToastAt = 0;
const notifyCloudSyncError = () => {
  const now = Date.now();
  if (now - lastSyncErrorToastAt < 10000) return;
  lastSyncErrorToastAt = now;
  toast.error("Couldn't save to the cloud", {
    description: 'Your progress is saved on this device and will sync when your connection recovers.',
  });
};

const progressStorageKey = (uid: string | null | undefined) =>
  `${PROGRESS_KEY_PREFIX}${uid ?? ANON_SUFFIX}`;
export const vocabStorageKey = (uid: string | null | undefined) =>
  `${VOCAB_KEY_PREFIX}${uid ?? ANON_SUFFIX}`;

export interface Attempt {
  timestamp: number;
  durationSeconds: number;
  result: "correct" | "incorrect";
  answer: string;
  explanation?: string;
}

export interface QuestionProgress {
  questionId: string;
  isMarkedForReview: boolean;
  attempts: Attempt[];
  totalTimeSpentSeconds: number;
}
let legacyMigrationDone = false;
const migrateLegacyKeysOnce = () => {
  if (legacyMigrationDone) return;
  legacyMigrationDone = true;
  if (typeof window === 'undefined') return;
  try {
    const legacyProg = localStorage.getItem(LEGACY_PROGRESS_KEY);
    if (legacyProg) {
      if (!localStorage.getItem(progressStorageKey(null))) {
        localStorage.setItem(progressStorageKey(null), legacyProg);
      }
      localStorage.removeItem(LEGACY_PROGRESS_KEY);
    }
    const legacyVocab = localStorage.getItem(LEGACY_VOCAB_KEY);
    if (legacyVocab) {
      if (!localStorage.getItem(vocabStorageKey(null))) {
        localStorage.setItem(vocabStorageKey(null), legacyVocab);
      }
      localStorage.removeItem(LEGACY_VOCAB_KEY);
    }
    migrateLegacyQuestionUiState(null);
  } catch (error) {
    console.error('Failed to migrate legacy progress:', error);
  }
};

if (typeof window !== 'undefined') migrateLegacyKeysOnce();

const readProgressFor = (uid: string | null | undefined): Record<string, QuestionProgress> => {
  if (typeof window === 'undefined') return {};
  const key = progressStorageKey(uid);
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    let changed = false;
    const normalized: Record<string, QuestionProgress> = {};
    for (const [questionId, progress] of Object.entries(parsed) as Array<[string, QuestionProgress]>) {
      const canonicalId = resolvePastStableId(questionId);
      const current = normalized[canonicalId];
      const nextProgress = { ...progress, questionId: canonicalId };
      normalized[canonicalId] = current
        ? {
            questionId: canonicalId,
            isMarkedForReview: current.isMarkedForReview || nextProgress.isMarkedForReview,
            attempts: [...(current.attempts ?? []), ...(nextProgress.attempts ?? [])],
            totalTimeSpentSeconds: Math.max(
              current.totalTimeSpentSeconds ?? 0,
              nextProgress.totalTimeSpentSeconds ?? 0,
            ),
          }
        : nextProgress;
      changed ||= canonicalId !== questionId;
    }
    if (changed) localStorage.setItem(key, JSON.stringify(normalized));
    return normalized;
  } catch (error) {
    console.error('Failed to parse user progress:', error);
    return {};
  }
};

const readVocabFor = (uid: string | null | undefined): Record<string, unknown> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(vocabStorageKey(uid));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};
const mergeProgress = (
  local: Record<string, QuestionProgress>,
  remote: Record<string, QuestionProgress>,
  resetAt = 0,
  preferLocalReview = false,
): Record<string, QuestionProgress> => {
  const merged: Record<string, QuestionProgress> = {};
  const ids = new Set<string>([...Object.keys(remote), ...Object.keys(local)]);
  for (const id of ids) {
    const l = local[id];
    const r = remote[id];
    const combined = [
      ...(Array.isArray(r?.attempts) ? r.attempts : []),
      ...(Array.isArray(l?.attempts) ? l.attempts : []),
    ];
    const hadAttempts = combined.some((a) => a && typeof a.timestamp === 'number');
    const seen = new Set<number>();
    let attempts: Attempt[] = [];
    for (const a of combined) {
      if (!a || typeof a.timestamp !== 'number') continue;
      // Tombstone: drop attempts made before a reset so a stale device can't
      // resurrect cleared progress on merge.
      if (a.timestamp < resetAt) continue;
      if (seen.has(a.timestamp)) continue;
      seen.add(a.timestamp);
      attempts.push(a);
    }
    attempts.sort((a, b) => a.timestamp - b.timestamp);
    if (attempts.length > MAX_ATTEMPTS_PER_QUESTION) {
      attempts = attempts.slice(attempts.length - MAX_ATTEMPTS_PER_QUESTION);
    }
    // On the persist path the local snapshot is this device's authoritative
    // intent (so an un-mark propagates); on the mount merge we union across
    // devices/anon so a mark made elsewhere isn't dropped.
    const isMarkedForReview = preferLocalReview
      ? Boolean(l?.isMarkedForReview)
      : Boolean(l?.isMarkedForReview) || Boolean(r?.isMarkedForReview);
    const totalTimeSpentSeconds = Math.max(
      typeof l?.totalTimeSpentSeconds === 'number' ? l.totalTimeSpentSeconds : 0,
      typeof r?.totalTimeSpentSeconds === 'number' ? r.totalTimeSpentSeconds : 0,
    );
    if (attempts.length === 0) {
      // If the question once had attempts but none survived, they all predated
      // a reset — drop it (including its time) so cleared progress can't come
      // back. Keep genuinely attempt-less entries only when they still carry a
      // review flag or accumulated viewing time.
      if (hadAttempts) continue;
      if (!isMarkedForReview && totalTimeSpentSeconds === 0) continue;
    }
    merged[id] = {
      questionId: id,
      isMarkedForReview,
      attempts,
      totalTimeSpentSeconds,
    };
  }
  return merged;
};

const vocabEntryUpdatedAt = (value: unknown): number =>
  value && typeof value === 'object' && typeof (value as { updatedAt?: unknown }).updatedAt === 'number'
    ? (value as { updatedAt: number }).updatedAt
    : 0;

const vocabEntryConfirmations = (value: unknown): number =>
  value && typeof value === 'object' && typeof (value as { confirmations?: unknown }).confirmations === 'number'
    ? (value as { confirmations: number }).confirmations
    : 0;

const mergeVocab = (
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
): Record<string, unknown> => {
  const merged: Record<string, unknown> = { ...remote };
  for (const word of Object.keys(local)) {
    const l = local[word];
    const r = merged[word];
    if (r === undefined) {
      merged[word] = l;
      continue;
    }
    const lt = vocabEntryUpdatedAt(l);
    const rt = vocabEntryUpdatedAt(r);
    if (lt !== rt) {
      // The most recently edited entry wins. A genuinely stale device has an
      // older updatedAt and loses; a device the user actually interacted with
      // last legitimately reflects their latest state (including a downgrade).
      merged[word] = lt > rt ? l : r;
    } else {
      // Legacy entries without a timestamp — keep the more-progressed one so a
      // stale copy can't silently reduce a word's confirmation count.
      merged[word] = vocabEntryConfirmations(l) >= vocabEntryConfirmations(r) ? l : r;
    }
  }
  return merged;
};
export const isQuestionSolved = (progress: QuestionProgress): boolean => {
  return progress.attempts.some(a => a.result === 'correct');
};

export const isQuestionAnsweredIncorrectly = (progress: QuestionProgress): boolean => {
  return progress.attempts.length > 0 && !isQuestionSolved(progress);
};

const createEmptyQuestionProgress = (questionId: string): QuestionProgress => ({
  questionId,
  isMarkedForReview: false,
  attempts: [],
  totalTimeSpentSeconds: 0,
});

export const useUserProgress = () => {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [progress, setProgress] = useState<Record<string, QuestionProgress>>(() =>
    readProgressFor(uid),
  );
  const lastUidRef = useRef<string | null | undefined>(undefined);
  const migratedAnonRef = useRef<Set<string>>(new Set());
  const progressSnapshotRef = useRef(progress);
  useEffect(() => {
    progressSnapshotRef.current = progress;
  }, [progress]);
  useEffect(() => {
    if (lastUidRef.current === uid) return;
    lastUidRef.current = uid;
    setProgress(readProgressFor(uid));
  }, [uid]);
  useEffect(() => {
    const key = progressStorageKey(uid);
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          setProgress(JSON.parse(e.newValue));
        } catch (error) {
          console.error('Failed to sync user progress:', error);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [uid]);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchProgress = async () => {
      try {
        const { db, doc, getDoc, setDoc } = await loadFirestoreDependencies();
        if (cancelled || !db) return;
        const customSets = await import('@/lib/practice/customPracticeSets');
        if (cancelled) return;
        const progressRef = doc(db, 'user_progress', user.id);
        const progressSnap = await getDoc(progressRef);
        if (cancelled) return;
        const remote = progressSnap.data() as
          | {
              data?: Record<string, QuestionProgress>;
              vocab?: Record<string, unknown>;
              personalization?: PersonalizationPreferences;
              questionState?: QuestionUiStateMap;
              customPracticeSets?: CustomPracticeSet[];
              resetAt?: number;
              schemaVersion?: number;
            }
          | undefined;

        const userLocalProgress = readProgressFor(user.id);
        const userLocalVocab = readVocabFor(user.id);
        const userLocalQuestionState = getQuestionUiStateMap(user.id);
        const userLocalCustomSets = customSets.getAllCustomPracticeSetsForSync(user.id);
        const sessionFlagKey = `userProgress:migrated:${user.id}`;
        const alreadyMigrated =
          migratedAnonRef.current.has(user.id) ||
          sessionStorage.getItem(sessionFlagKey) === '1';

        let migratedProgress = userLocalProgress;
        let migratedVocab = userLocalVocab;
        let migratedQuestionState = userLocalQuestionState;
        let migratedCustomSets = userLocalCustomSets;

        if (!alreadyMigrated) {
          const anonProgress = readProgressFor(null);
          const anonVocab = readVocabFor(null);
          const anonQuestionState = getQuestionUiStateMap(null);
          const anonCustomSets = customSets.getAllCustomPracticeSetsForSync(null);
          if (Object.keys(anonProgress).length > 0) {
            migratedProgress = mergeProgress(userLocalProgress, anonProgress);
          }
          if (Object.keys(anonVocab).length > 0) {
            migratedVocab = mergeVocab(userLocalVocab, anonVocab);
          }
          if (Object.keys(anonQuestionState).length > 0) {
            migratedQuestionState = mergeQuestionUiStateMaps(userLocalQuestionState, anonQuestionState);
          }
          if (anonCustomSets.length > 0) {
            migratedCustomSets = customSets.mergeCustomPracticeSets(userLocalCustomSets, anonCustomSets);
          }
          try {
            localStorage.removeItem(progressStorageKey(null));
            localStorage.removeItem(vocabStorageKey(null));
            localStorage.removeItem(questionUiStateStorageKey(null));
            localStorage.removeItem(customSets.customPracticeSetsStorageKey(null));
          } catch (error) {
            console.error('Failed to remove anonymous progress after migration:', error);
          }
          sessionStorage.setItem(sessionFlagKey, '1');
          migratedAnonRef.current.add(user.id);
        }

        const remoteProgress = remote?.data ?? {};
        const resetAt = remote?.resetAt ?? 0;
        const mergedProgress = mergeProgress(migratedProgress, remoteProgress, resetAt);

        const remoteVocab = remote?.vocab ?? {};
        const mergedVocab = mergeVocab(migratedVocab, remoteVocab);
        const remoteQuestionState = remote?.questionState ?? {};
        const mergedQuestionState = mergeQuestionUiStateMaps(migratedQuestionState, remoteQuestionState);
        const remoteCustomSets = remote?.customPracticeSets ?? [];
        const mergedCustomSets = customSets.mergeCustomPracticeSets(migratedCustomSets, remoteCustomSets);

        const localPers = getPersonalizationPreferences();
        const remotePers = remote?.personalization;
        const mergedPers = remotePers ?? localPers;

        setProgress(mergedProgress);
        localStorage.setItem(progressStorageKey(user.id), JSON.stringify(mergedProgress));
        localStorage.setItem(vocabStorageKey(user.id), JSON.stringify(mergedVocab));
        saveQuestionUiStateMap(user.id, mergedQuestionState, { notify: false });
        customSets.saveCustomPracticeSets(mergedCustomSets, user.id, { notify: false });
        if (remotePers) applyPersonalizationPreferences(remotePers);

        await setDoc(
          progressRef,
          {
            user_id: user.id,
            schemaVersion: SCHEMA_VERSION,
            data: mergedProgress,
            vocab: mergedVocab,
            personalization: mergedPers,
            questionState: mergedQuestionState,
            customPracticeSets: mergedCustomSets,
            ...(resetAt ? { resetAt } : {}),
          },
          { merge: true },
        );
      } catch (err) {
        console.error('Failed to sync progress:', err);
      }
    };

    fetchProgress();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const persist = useCallback(async (newProgress: Record<string, QuestionProgress>) => {
    localStorage.setItem(progressStorageKey(uid), JSON.stringify(newProgress));
    if (!user) return;
    try {
      const { db, doc, runTransaction } = await loadFirestoreDependencies();
      if (!db) return;
      const progressRef = doc(db, 'user_progress', user.id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(progressRef);
        const remote = snap.data() as
          | { data?: Record<string, QuestionProgress>; resetAt?: number }
          | undefined;
        const resetAt = remote?.resetAt ?? 0;
        // Read-merge-write so a concurrent write from another device/tab isn't
        // clobbered (Firestore merge replaces arrays wholesale). We intentionally
        // do NOT write the merged result back into local React state here: an
        // older in-flight transaction resolving after a newer optimistic update
        // would otherwise overwrite the newer state. Other devices' attempts are
        // picked up on the next mount/storage sync instead.
        const mergedProgress = mergeProgress(newProgress, remote?.data ?? {}, resetAt, true);
        tx.set(
          progressRef,
          { user_id: user.id, schemaVersion: SCHEMA_VERSION, data: mergedProgress },
          { merge: true },
        );
      });
    } catch (error) {
      console.error('Failed to persist progress to Firestore:', error);
      notifyCloudSyncError();
    }
  }, [user, uid]);

  const saveProgress = useCallback(async (newProgress: Record<string, QuestionProgress>) => {
    setProgress(newProgress);
    await persist(newProgress);
  }, [persist]);

  const resetProgress = useCallback(async () => {
    // Clear the cloud copy first (with a reset tombstone) so a failed remote
    // write doesn't let another device resurrect the data on next merge.
    if (user) {
      try {
        const { db, doc, runTransaction } = await loadFirestoreDependencies();
        if (db) {
          const progressRef = doc(db, 'user_progress', user.id);
          const resetAt = Date.now();
          await runTransaction(db, async (tx) => {
            tx.set(
              progressRef,
              { user_id: user.id, schemaVersion: SCHEMA_VERSION, data: {}, questionState: {}, resetAt },
              { merge: true },
            );
          });
        }
      } catch (error) {
        console.error('Failed to reset progress in Firestore:', error);
        notifyCloudSyncError();
        // Keep local data intact so the user can retry the reset.
        return;
      }
    }
    const empty = {};
    setProgress(empty);
    progressSnapshotRef.current = empty;
    localStorage.setItem(progressStorageKey(uid), JSON.stringify(empty));
    saveQuestionUiStateMap(uid, {}, { notify: true });
  }, [user, uid]);

  const addAttempt = useCallback(async (
    questionId: string,
    result: "correct" | "incorrect",
    durationSeconds: number,
    answer: string,
    explanation?: string
  ) => {
    const prev = progressSnapshotRef.current;
    const current = prev[questionId] || createEmptyQuestionProgress(questionId);

    const newAttempt: Attempt = {
      timestamp: Date.now(),
      durationSeconds,
      result,
      answer,
      explanation
    };

    const updated = {
      ...prev,
      [questionId]: {
        ...current,
        attempts: [...current.attempts, newAttempt],
        totalTimeSpentSeconds: current.totalTimeSpentSeconds + durationSeconds
      }
    };

    setProgress(updated);
    progressSnapshotRef.current = updated;
    await persist(updated);
  }, [persist]);

  const addTimeSpent = useCallback(async (questionId: string, seconds: number) => {
    const prev = progressSnapshotRef.current;
    const current = prev[questionId] || createEmptyQuestionProgress(questionId);

    const updated = {
      ...prev,
      [questionId]: {
        ...current,
        totalTimeSpentSeconds: current.totalTimeSpentSeconds + seconds
      }
    };

    setProgress(updated);
    progressSnapshotRef.current = updated;
    await persist(updated);
  }, [persist]);

  const toggleReview = useCallback(async (questionId: string) => {
    const prev = progressSnapshotRef.current;
    const current = prev[questionId] || createEmptyQuestionProgress(questionId);

    const updated = {
      ...prev,
      [questionId]: {
        ...current,
        isMarkedForReview: !current.isMarkedForReview
      }
    };

    setProgress(updated);
    progressSnapshotRef.current = updated;
    await persist(updated);
  }, [persist]);

  const getProgress = useCallback((questionId: string): QuestionProgress => {
    return progress[questionId] || createEmptyQuestionProgress(questionId);
  }, [progress]);
  const isSolved = useCallback((questionId: string): boolean => {
    return isQuestionSolved(getProgress(questionId));
  }, [getProgress]);

  const isAnsweredIncorrectly = useCallback((questionId: string): boolean => {
    return isQuestionAnsweredIncorrectly(getProgress(questionId));
  }, [getProgress]);

  const isMarkedForReview = useCallback((questionId: string): boolean => {
    return getProgress(questionId).isMarkedForReview;
  }, [getProgress]);

  const getTimeSpent = useCallback((questionId: string): number => {
    return getProgress(questionId).totalTimeSpentSeconds;
  }, [getProgress]);

  return {
    progress,
    addAttempt,
    addTimeSpent,
    toggleReview,
    getProgress,
    isSolved,
    isAnsweredIncorrectly,
    isMarkedForReview,
    getTimeSpent,
    saveProgress,
    resetProgress
  };
};
