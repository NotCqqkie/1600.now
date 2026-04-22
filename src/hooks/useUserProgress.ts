import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  applyPersonalizationPreferences,
  getPersonalizationPreferences,
  type PersonalizationPreferences,
} from '@/lib/personalization';

const VOCAB_STORAGE_KEY = 'vocab-progress';

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

// Storage key for user progress
const STORAGE_KEY = 'userProgress';

// Helper to get initial progress from localStorage
const getStoredProgress = (): Record<string, QuestionProgress> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to parse user progress:', error);
  }
  return {};
};

// Static methods for getting progress without using the hook
export const getUserProgressStatic = (): Record<string, QuestionProgress> => {
  return getStoredProgress();
};

export const getQuestionProgressStatic = (questionId: string): QuestionProgress => {
  const progress = getStoredProgress();
  return progress[questionId] || {
    questionId,
    isMarkedForReview: false,
    attempts: [],
    totalTimeSpentSeconds: 0
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

const readVocabLocal = (): Record<string, unknown> => {
  try {
    const raw = localStorage.getItem(VOCAB_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
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
  const [progress, setProgress] = useState<Record<string, QuestionProgress>>(getStoredProgress);

  // Sync with localStorage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setProgress(JSON.parse(e.newValue));
        } catch (error) {
          console.error('Failed to sync user progress:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Sync with Firestore on user login
  useEffect(() => {
    if (!user || !db) return;

    const fetchProgress = async () => {
      try {
        const progressRef = doc(db, 'user_progress', user.id);
        const progressSnap = await getDoc(progressRef);
        const remote = progressSnap.data() as
          | {
              data?: Record<string, QuestionProgress>;
              vocab?: Record<string, unknown>;
              personalization?: PersonalizationPreferences;
            }
          | undefined;

        const localProgress = getStoredProgress();
        const remoteProgress = remote?.data ?? {};
        const mergedProgress = mergeProgress(localProgress, remoteProgress);

        const localVocab = readVocabLocal();
        const remoteVocab = remote?.vocab ?? {};
        const mergedVocab = { ...remoteVocab, ...localVocab };

        const localPers = getPersonalizationPreferences();
        const remotePers = remote?.personalization;
        // Personalization is small + last-write-wins; prefer remote if present.
        const mergedPers = remotePers ?? localPers;

        setProgress(mergedProgress);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedProgress));
        localStorage.setItem(VOCAB_STORAGE_KEY, JSON.stringify(mergedVocab));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const persist = useCallback(async (newProgress: Record<string, QuestionProgress>) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newProgress));
    if (user && db) {
      const progressRef = doc(db, 'user_progress', user.id);
      await setDoc(progressRef, { user_id: user.id, data: newProgress }, { merge: true });
    }
  }, [user]);

  const saveProgress = useCallback((newProgress: Record<string, QuestionProgress>) => {
    setProgress(newProgress);
    persist(newProgress);
  }, [persist]);

  const resetProgress = useCallback(async () => {
    const empty = {};
    setProgress(empty);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(empty));
    if (user && db) {
        const progressRef = doc(db, 'user_progress', user.id);
        await setDoc(progressRef, { user_id: user.id, data: empty }, { merge: true });
    }
  }, [user]);

  const addAttempt = useCallback((
    questionId: string,
    result: "correct" | "incorrect",
    durationSeconds: number,
    answer: string,
    explanation?: string
  ) => {
    setProgress(prev => {
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
      
      persist(updated);
      return updated;
    });
  }, [persist]);

  const addTimeSpent = useCallback((questionId: string, seconds: number) => {
    setProgress(prev => {
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
      
      persist(updated);
      return updated;
    });
  }, [persist]);

  const toggleReview = useCallback((questionId: string) => {
    setProgress(prev => {
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
      
      persist(updated);
      return updated;
    });
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
