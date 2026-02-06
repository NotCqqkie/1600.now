import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

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

  // Sync with Supabase on user login
  useEffect(() => {
    if (!user) return;

    const fetchProgress = async () => {
      try {
        const { data, error } = await supabase
          .from('user_progress')
          .select('data')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching progress:', error);
          return;
        }

        if (data?.data) {
          // Check if we have local data that needs to be merged or if we should just take server data
          // For now, simple strategy: If server has data, use it. 
          // If server is empty but we have local data (first sync), upload local.
          
          if (Object.keys(data.data).length > 0) {
              setProgress(data.data);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(data.data));
          } else if (Object.keys(progress).length > 0) {
             // Server empty, upload current local
             await supabase
              .from('user_progress')
              .upsert({ user_id: user.id, data: progress });
          }
        } else if (Object.keys(progress).length > 0) {
           // No row exists, upload local data
            await supabase
              .from('user_progress')
              .upsert({ user_id: user.id, data: progress });
        }
      } catch (err) {
        console.error('Failed to sync progress:', err);
      }
    };

    fetchProgress();
  }, [user]);

  const persist = useCallback(async (newProgress: Record<string, QuestionProgress>) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newProgress));
    if (user) {
      await supabase.from('user_progress').upsert({ user_id: user.id, data: newProgress });
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
    if (user) {
        await supabase.from('user_progress').upsert({ user_id: user.id, data: empty });
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
