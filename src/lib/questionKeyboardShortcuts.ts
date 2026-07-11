interface QuestionShortcutEventState {
  defaultPrevented: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}

export const shouldIgnoreQuestionShortcut = (event: QuestionShortcutEventState) =>
  event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey;
