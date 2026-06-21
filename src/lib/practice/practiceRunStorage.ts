export const PRACTICE_RUN_STORAGE_KEY = "practiceRunId";
export const PRACTICE_EXIT_TO_STORAGE_KEY = "practiceExitTo";
export const PRACTICE_SET_STORAGE_KEY = "practiceSet";
export const PRACTICE_SET_TOTAL_STORAGE_KEY = "practiceSetTotal";
export const PRACTICE_MODULES_EXIT_PATH = "/modules";

export const buildPracticeRunId = (scope: string): string =>
  `${scope}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const writePracticeLaunchStorage = (
  practiceSet: unknown,
  exitTo = PRACTICE_MODULES_EXIT_PATH,
): void => {
  sessionStorage.setItem(PRACTICE_EXIT_TO_STORAGE_KEY, exitTo);
  sessionStorage.setItem(PRACTICE_SET_STORAGE_KEY, JSON.stringify(practiceSet));
};
