type QuestionViewModeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type QuestionViewModeSubject = "math" | "reading";
export type QuestionViewMode = "vertical" | "horizontal";

export const BANK_QUESTION_VIEW_MODE_SUBJECTS = ["math", "reading"] as const;

export const getDefaultQuestionViewMode = (
  subject: QuestionViewModeSubject,
  isBank: boolean,
): QuestionViewMode => {
  if (isBank) {
    return subject === "reading" ? "horizontal" : "vertical";
  }

  return "vertical";
};

export const getQuestionViewModeStorageKey = (
  subject: QuestionViewModeSubject,
  isBank: boolean,
): string => {
  if (isBank) return `question-view-mode:bank:${subject}`;
  return "question-view-mode:hard";
};

export const getStoredQuestionViewMode = (
  subject: QuestionViewModeSubject,
  isBank: boolean,
  storage: QuestionViewModeStorage = sessionStorage,
): QuestionViewMode => {
  const storedMode = storage.getItem(getQuestionViewModeStorageKey(subject, isBank));
  return storedMode === "horizontal" || storedMode === "vertical"
    ? storedMode
    : getDefaultQuestionViewMode(subject, isBank);
};

export const setStoredQuestionViewMode = (
  subject: QuestionViewModeSubject,
  isBank: boolean,
  mode: QuestionViewMode,
  storage: QuestionViewModeStorage = sessionStorage,
): void => {
  storage.setItem(getQuestionViewModeStorageKey(subject, isBank), mode);
};

export const clearBankQuestionViewModeStorage = (
  storage: QuestionViewModeStorage = sessionStorage,
): void => {
  for (const subject of BANK_QUESTION_VIEW_MODE_SUBJECTS) {
    storage.removeItem(getQuestionViewModeStorageKey(subject, true));
  }
};
