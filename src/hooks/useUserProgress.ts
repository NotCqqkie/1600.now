import { useState, useEffect, useCallback, useRef } from 'react';
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
import type { CustomPracticeSet } from '@/lib/practice/customPracticeSets';

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
            }
          | undefined;

        const userLocalProgress = readProgressFor(user.id);
        const userLocalVocab = readVocabFor(user.id);
        const userLocalQuestionState = getQuestionUiStateMap(user.id);
        const userLocalCustomSets = customSets.getCustomPracticeSets(user.id);
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
          const anonCustomSets = customSets.getCustomPracticeSets(null);
          if (Object.keys(anonProgress).length > 0) {
            migratedProgress = mergeProgress(userLocalProgress, anonProgress);
          }
          if (Object.keys(anonVocab).length > 0) {
            migratedVocab = { ...userLocalVocab, ...anonVocab };
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
        const mergedProgress = mergeProgress(migratedProgress, remoteProgress);

        const remoteVocab = remote?.vocab ?? {};
        const mergedVocab = { ...remoteVocab, ...migratedVocab };
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
            data: mergedProgress,
            vocab: mergedVocab,
            personalization: mergedPers,
            questionState: mergedQuestionState,
            customPracticeSets: mergedCustomSets,
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
    saveQuestionUiStateMap(uid, {}, { notify: true });
    if (user) {
        const { db, doc, setDoc } = await loadFirestoreDependencies();
        if (!db) return;
        const progressRef = doc(db, 'user_progress', user.id);
        await setDoc(progressRef, { user_id: user.id, data: empty, questionState: {} }, { merge: true });
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
