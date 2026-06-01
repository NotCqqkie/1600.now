import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  applyPersonalizationPreferences,
  getPersonalizationPreferences,
  type PersonalizationPreferences,
} from '@/lib/personalization';

const PROGRESS_KEY_PREFIX = 'userProgress:';
const VOCAB_KEY_PREFIX = 'vocabProgress:';
const LEGACY_PROGRESS_KEY = 'userProgress';
const LEGACY_VOCAB_KEY = 'vocab-progress';
const ANON_SUFFIX = 'anon';

const importFirestoreDependencies = async () => {
  const [firebaseDb, firestore] = await Promise.all([
    import('@/lib/firebase/firebaseDb'),
    import('firebase/firestore'),
  ]);
  return {
    db: firebaseDb.db,
    doc: firestore.doc,
    getDoc: firestore.getDoc,
    setDoc: firestore.setDoc,
  };
};

let firestoreDependenciesPromise: Promise<Awaited<ReturnType<typeof importFirestoreDependencies>>> | null = null;

const loadFirestoreDependencies = () => {
  if (!firestoreDependenciesPromise) {
    firestoreDependenciesPromise = importFirestoreDependencies();
  }
  return firestoreDependenciesPromise;
};

export const progressStorageKey = (uid: string | null | undefined) =>
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

// One-time migration: move pre-update global keys ('userProgress', 'vocab-progress')
// into the anonymous slot so existing local data isn't lost. Old keys are removed
// after migration so they can't leak into a different user's account on login.
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
  } catch {
    // ignore
  }
};

if (typeof window !== 'undefined') migrateLegacyKeysOnce();

const readProgressFor = (uid: string | null | undefined): Record<string, QuestionProgress> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(progressStorageKey(uid));
    return raw ? JSON.parse(raw) : {};
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

// Static read-only accessors used outside hooks. Pass the active uid to scope
// to a specific user; omit (or pass null) to read the anonymous slot.
export const getUserProgressStatic = (
  uid?: string | null,
): Record<string, QuestionProgress> => readProgressFor(uid);

export const getQuestionProgressStatic = (
  questionId: string,
  uid?: string | null,
): QuestionProgress => {
  const all = readProgressFor(uid);
  return all[questionId] || {
    questionId,
    isMarkedForReview: false,
    attempts: [],
    totalTimeSpentSeconds: 0,
  };
};

// Merge two progress maps without losing data.
// - attempts: unioned and deduped by timestamp
// - totalTimeSpentSeconds: max (avoids losing time tracked without attempts,
//   avoids double-counting if attempts overlap)
// - isMarkedForReview: OR
const mergeProgress = (
  local: Record<string, QuestionProgress>,
  remote: Record<string, QuestionProgress>,
): Record<string, QuestionProgress> => {
  const merged: Record<string, QuestionProgress> = { ...remote };
  for (const id of Object.keys(local)) {
    const l = local[id];
    const r = merged[id];
    if (!r) {
      merged[id] = l;
      continue;
    }
    const seen = new Set<number>();
    const attempts: Attempt[] = [];
    for (const a of [...r.attempts, ...l.attempts]) {
      if (seen.has(a.timestamp)) continue;
      seen.add(a.timestamp);
      attempts.push(a);
    }
    attempts.sort((a, b) => a.timestamp - b.timestamp);
    merged[id] = {
      questionId: id,
      isMarkedForReview: l.isMarkedForReview || r.isMarkedForReview,
      attempts,
      totalTimeSpentSeconds: Math.max(
        l.totalTimeSpentSeconds,
        r.totalTimeSpentSeconds,
      ),
    };
  }
  return merged;
};

// Filter helpers
export const isQuestionSolved = (progress: QuestionProgress): boolean => {
  return progress.attempts.some(a => a.result === 'correct');
};

export const isQuestionAnsweredIncorrectly = (progress: QuestionProgress): boolean => {
  return progress.attempts.length > 0 && !isQuestionSolved(progress);
};

export const hasQuestionBeenAttempted = (progress: QuestionProgress): boolean => {
  return progress.attempts.length > 0;
};

export const getTimeSpentRange = (seconds: number): string => {
  if (seconds === 0) return 'none';
  if (seconds <= 20) return '0-20s';
  if (seconds <= 40) return '20-40s';
  if (seconds <= 60) return '40s-1m';
  if (seconds <= 120) return '1m-2m';
  if (seconds <= 180) return '2m-3m';
  if (seconds <= 300) return '3m-5m';
  return '5m+';
};

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

  // When the active user changes (login / logout / account switch), swap state
  // to that user's local cache so progress never bleeds across accounts.
  useEffect(() => {
    if (lastUidRef.current === uid) return;
    lastUidRef.current = uid;
    setProgress(readProgressFor(uid));
  }, [uid]);

  // Cross-tab sync — only react to the active user's storage key.
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

  // On login, sync with Firestore and (once per session per user) merge any
  // anonymous-session data into the account.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchProgress = async () => {
      try {
        const { db, doc, getDoc, setDoc } = await loadFirestoreDependencies();
        if (cancelled || !db) return;
        const progressRef = doc(db, 'user_progress', user.id);
        const progressSnap = await getDoc(progressRef);
        if (cancelled) return;
        const remote = progressSnap.data() as
          | {
              data?: Record<string, QuestionProgress>;
              vocab?: Record<string, unknown>;
              personalization?: PersonalizationPreferences;
            }
          | undefined;

        const userLocalProgress = readProgressFor(user.id);
        const userLocalVocab = readVocabFor(user.id);

        // First login on this device for this user: pull in anonymous-slot data,
        // then clear it so a different user signing in next won't inherit it.
        const sessionFlagKey = `userProgress:migrated:${user.id}`;
        const alreadyMigrated =
          migratedAnonRef.current.has(user.id) ||
          sessionStorage.getItem(sessionFlagKey) === '1';

        let migratedProgress = userLocalProgress;
        let migratedVocab = userLocalVocab;

        if (!alreadyMigrated) {
          const anonProgress = readProgressFor(null);
          const anonVocab = readVocabFor(null);
          if (Object.keys(anonProgress).length > 0) {
            migratedProgress = mergeProgress(userLocalProgress, anonProgress);
          }
          if (Object.keys(anonVocab).length > 0) {
            migratedVocab = { ...userLocalVocab, ...anonVocab };
          }
          try {
            localStorage.removeItem(progressStorageKey(null));
            localStorage.removeItem(vocabStorageKey(null));
          } catch {
            // ignore
          }
          sessionStorage.setItem(sessionFlagKey, '1');
          migratedAnonRef.current.add(user.id);
        }

        const remoteProgress = remote?.data ?? {};
        const mergedProgress = mergeProgress(migratedProgress, remoteProgress);

        const remoteVocab = remote?.vocab ?? {};
        const mergedVocab = { ...remoteVocab, ...migratedVocab };

        const localPers = getPersonalizationPreferences();
        const remotePers = remote?.personalization;
        // Personalization is small + last-write-wins; prefer remote if present.
        const mergedPers = remotePers ?? localPers;

        setProgress(mergedProgress);
        localStorage.setItem(progressStorageKey(user.id), JSON.stringify(mergedProgress));
        localStorage.setItem(vocabStorageKey(user.id), JSON.stringify(mergedVocab));
        if (remotePers) applyPersonalizationPreferences(remotePers);

        await setDoc(
          progressRef,
          {
            user_id: user.id,
            data: mergedProgress,
            vocab: mergedVocab,
            personalization: mergedPers,
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
    if (user) {
      const { db, doc, setDoc } = await loadFirestoreDependencies();
      if (!db) return;
      const progressRef = doc(db, 'user_progress', user.id);
      await setDoc(progressRef, { user_id: user.id, data: newProgress }, { merge: true });
    }
  }, [user, uid]);

  const saveProgress = useCallback(async (newProgress: Record<string, QuestionProgress>) => {
    setProgress(newProgress);
    await persist(newProgress);
  }, [persist]);

  const resetProgress = useCallback(async () => {
    const empty = {};
    setProgress(empty);
    localStorage.setItem(progressStorageKey(uid), JSON.stringify(empty));
    if (user) {
        const { db, doc, setDoc } = await loadFirestoreDependencies();
        if (!db) return;
        const progressRef = doc(db, 'user_progress', user.id);
        await setDoc(progressRef, { user_id: user.id, data: empty }, { merge: true });
    }
  }, [user, uid]);

  const addAttempt = useCallback(async (
    questionId: string,
    result: "correct" | "incorrect",
    durationSeconds: number,
    answer: string,
    explanation?: string
  ) => {
    const prev = progressSnapshotRef.current;
    const current = prev[questionId] || {
      questionId,
      isMarkedForReview: false,
      attempts: [],
      totalTimeSpentSeconds: 0
    };

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
    const current = prev[questionId] || {
      questionId,
      isMarkedForReview: false,
      attempts: [],
      totalTimeSpentSeconds: 0
    };

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
    const current = prev[questionId] || {
      questionId,
      isMarkedForReview: false,
      attempts: [],
      totalTimeSpentSeconds: 0
    };

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
    return progress[questionId] || {
      questionId,
      isMarkedForReview: false,
      attempts: [],
      totalTimeSpentSeconds: 0
    };
  }, [progress]);

  // Filter methods
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
