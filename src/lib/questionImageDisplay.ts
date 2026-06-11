import type { QuestionImageDisplaySize } from "@/data/questionImageSizing.generated";

type QuestionImageSubject = "math" | "reading";

const questionImageClassNames: Record<QuestionImageSubject, Record<QuestionImageDisplaySize, string>> = {
  math: {
    compact: "question-image-size question-image-bank question-image-math question-image-compact",
    standard: "question-image-size question-image-bank question-image-math question-image-standard",
    wide: "question-image-size question-image-bank question-image-math question-image-wide",
    large: "question-image-size question-image-bank question-image-math question-image-large",
    tall: "question-image-size question-image-bank question-image-math question-image-tall",
    xlarge: "question-image-size question-image-bank question-image-math question-image-xlarge",
  },
  reading: {
    compact: "question-image-size question-image-bank question-image-reading question-image-compact",
    standard: "question-image-size question-image-bank question-image-reading question-image-standard",
    wide: "question-image-size question-image-bank question-image-reading question-image-wide",
    large: "question-image-size question-image-bank question-image-reading question-image-large",
    tall: "question-image-size question-image-bank question-image-reading question-image-tall",
    xlarge: "question-image-size question-image-bank question-image-reading question-image-xlarge",
  },
};

const relaxedQuestionImageClassNames: Record<QuestionImageSubject, Record<QuestionImageDisplaySize, string>> = {
  math: {
    compact: "question-image-size question-image-relaxed question-image-math question-image-compact",
    standard: "question-image-size question-image-relaxed question-image-math question-image-standard",
    wide: "question-image-size question-image-relaxed question-image-math question-image-wide",
    large: "question-image-size question-image-relaxed question-image-math question-image-large",
    tall: "question-image-size question-image-relaxed question-image-math question-image-tall",
    xlarge: "question-image-size question-image-relaxed question-image-math question-image-xlarge",
  },
  reading: {
    compact: "question-image-size question-image-relaxed question-image-reading question-image-compact",
    standard: "question-image-size question-image-relaxed question-image-reading question-image-standard",
    wide: "question-image-size question-image-relaxed question-image-reading question-image-wide",
    large: "question-image-size question-image-relaxed question-image-reading question-image-large",
    tall: "question-image-size question-image-relaxed question-image-reading question-image-tall",
    xlarge: "question-image-size question-image-relaxed question-image-reading question-image-xlarge",
  },
};

const reviewQuestionImageClassNames: Record<QuestionImageDisplaySize, string> = {
  compact: "question-image-size question-image-review question-image-compact",
  standard: "question-image-size question-image-review question-image-standard",
  wide: "question-image-size question-image-review question-image-wide",
  large: "question-image-size question-image-review question-image-large",
  tall: "question-image-size question-image-review question-image-tall",
  xlarge: "question-image-size question-image-review question-image-xlarge",
};

const choiceImageClassNames: Record<QuestionImageDisplaySize, string> = {
  compact: "question-image-size question-choice-image question-choice-image-compact",
  standard: "question-image-size question-choice-image question-choice-image-standard",
  wide: "question-image-size question-choice-image question-choice-image-wide",
  large: "question-image-size question-choice-image question-choice-image-large",
  tall: "question-image-size question-choice-image question-choice-image-tall",
  xlarge: "question-image-size question-choice-image question-choice-image-xlarge",
};

const reviewChoiceImageClassNames: Record<QuestionImageDisplaySize, string> = {
  compact: "question-image-size question-choice-image-review question-choice-image-compact",
  standard: "question-image-size question-choice-image-review question-choice-image-standard",
  wide: "question-image-size question-choice-image-review question-choice-image-wide",
  large: "question-image-size question-choice-image-review question-choice-image-large",
  tall: "question-image-size question-choice-image-review question-choice-image-tall",
  xlarge: "question-image-size question-choice-image-review question-choice-image-xlarge",
};

export const getQuestionImageClassName = (
  displaySize: QuestionImageDisplaySize | undefined,
  subject: QuestionImageSubject,
  reduced: boolean,
) => {
  const sizes = reduced ? questionImageClassNames : relaxedQuestionImageClassNames;
  return sizes[subject][displaySize ?? "standard"];
};

export const getReviewQuestionImageClassName = (
  displaySize: QuestionImageDisplaySize | undefined,
) => reviewQuestionImageClassNames[displaySize ?? "standard"];

export const getChoiceImageClassName = (
  displaySize: QuestionImageDisplaySize | undefined,
) => choiceImageClassNames[displaySize ?? "standard"];

export const getReviewChoiceImageClassName = (
  displaySize: QuestionImageDisplaySize | undefined,
) => reviewChoiceImageClassNames[displaySize ?? "standard"];
