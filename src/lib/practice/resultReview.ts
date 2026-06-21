import type { BankSubject } from "@/data/bankTypes";
import { renderMixedContent } from "@/lib/text/mathRendering";
import { normalizeReadingDisplayText } from "@/lib/text/readingTextNormalization";

export const SECTION_LABEL_CLASS = "text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground";
export const REVIEW_HTML_CLASS = "question-html mt-2 break-words prose prose-stone max-w-none text-sm leading-7 text-foreground dark:prose-invert [&_img]:my-3 [&_img]:block [&_img]:max-w-full [&_img]:h-auto [&_img]:mx-auto [&_img]:object-contain";
export const RESULT_REVIEW_QUESTION_IMAGE_CLASS = "w-auto rounded-[10px] border border-border object-contain";
export const RESULT_REVIEW_CHOICE_HTML_CLASS = "question-html mt-1 break-words prose prose-stone max-w-none leading-6 text-muted-foreground dark:prose-invert [&_img]:my-2 [&_img]:block [&_img]:max-w-full [&_img]:h-auto [&_img]:mx-auto [&_img]:object-contain";
export const RESULT_REVIEW_CHOICE_IMAGE_CLASS = "w-auto max-w-full rounded-[10px] object-contain";
export const RESULT_REVIEW_FREE_RESPONSE_CLASS = "rounded-xl bg-muted/25 px-3 py-3 text-sm text-muted-foreground ring-1 ring-border/60";
export const RESULT_REVIEW_ANSWER_REVEAL_BUTTON_CLASS = "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors";
export const RESULT_REVIEW_ANSWER_CHOICE_BASE_CLASS = "rounded-xl px-3 py-3 text-sm";
export const RESULT_REVIEW_ANSWER_CHOICE_CORRECT_CLASS = "bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/30";
export const RESULT_REVIEW_ANSWER_CHOICE_CHOSEN_CLASS = "bg-rose-500/10 text-foreground ring-1 ring-rose-500/30";
export const RESULT_REVIEW_ANSWER_CHOICE_DEFAULT_CLASS = "bg-muted/25 text-foreground ring-1 ring-border/60";

type PracticeResultQuestionOutcome = Readonly<{
  isAnswered: boolean;
  isCorrect: boolean;
}>;
type PracticeResultSortDirection = "asc" | "desc";

export const stripBankPrefix = (id: string): string => {
  const parts = id.split("-");
  return parts[0] === "bank" && parts.length > 3 ? parts.slice(3).join("-") : id;
};

export const statusLabel = (question: PracticeResultQuestionOutcome): string => {
  if (!question.isAnswered) return "Unanswered";
  return question.isCorrect ? "Correct" : "Incorrect";
};

export const statusClasses = (question: PracticeResultQuestionOutcome): string => {
  if (!question.isAnswered) return "border-border bg-muted/30 text-muted-foreground";
  return question.isCorrect
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
};

export const answerLabel = (answer: string | null | undefined): string =>
  answer?.trim() ? answer : "No answer";

export const getChoiceReviewClassName = (
  showCorrect: boolean,
  isCorrect: boolean,
  isChosen: boolean,
): string => {
  if (showCorrect && isCorrect) return RESULT_REVIEW_ANSWER_CHOICE_CORRECT_CLASS;
  return isChosen
    ? RESULT_REVIEW_ANSWER_CHOICE_CHOSEN_CLASS
    : RESULT_REVIEW_ANSWER_CHOICE_DEFAULT_CLASS;
};

export const getQuestionCorrectnessRank = (
  question: PracticeResultQuestionOutcome,
  direction: PracticeResultSortDirection,
): number => {
  if (question.isCorrect) return 2;
  if (question.isAnswered) return direction === "asc" ? 0 : 1;
  return direction === "asc" ? 1 : 0;
};

export const getRenderedContentHtml = (
  subject: BankSubject,
  content: string | null | undefined,
): string => {
  if (!content) return "";
  const formattedContent =
    subject === "reading" ? normalizeReadingDisplayText(content) : content;
  return renderMixedContent(formattedContent, {
    normalizeMath: subject === "math",
  });
};
