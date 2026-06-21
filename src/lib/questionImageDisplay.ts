import type { QuestionImageDisplaySize } from "@/data/questionImageSizing.generated";

type QuestionImageSubject = "math" | "reading";
const questionImageSubjects = ["math", "reading"] as const;
const questionImageDisplaySizes: QuestionImageDisplaySize[] = [
  "compact",
  "standard",
  "wide",
  "large",
  "tall",
  "xlarge",
];
const defaultQuestionImageDisplaySize: QuestionImageDisplaySize = "standard";

const buildSubjectImageClassNames = (layoutClassName: string) =>
  Object.fromEntries(
    questionImageSubjects.map((subject) => [
      subject,
      Object.fromEntries(
        questionImageDisplaySizes.map((size) => [
          size,
          `question-image-size ${layoutClassName} question-image-${subject} question-image-${size}`,
        ]),
      ),
    ]),
  ) as Record<QuestionImageSubject, Record<QuestionImageDisplaySize, string>>;

const buildSizeImageClassNames = (baseClassName: string, sizePrefix: string) =>
  Object.fromEntries(
    questionImageDisplaySizes.map((size) => [
      size,
      `question-image-size ${baseClassName} ${sizePrefix}-${size}`,
    ]),
  ) as Record<QuestionImageDisplaySize, string>;

const questionImageClassNames = buildSubjectImageClassNames("question-image-bank");

const relaxedQuestionImageClassNames = buildSubjectImageClassNames("question-image-relaxed");

const reviewQuestionImageClassNames = buildSizeImageClassNames("question-image-review", "question-image");

const choiceImageClassNames = buildSizeImageClassNames("question-choice-image", "question-choice-image");

const reviewChoiceImageClassNames = buildSizeImageClassNames(
  "question-choice-image-review",
  "question-choice-image",
);

export const getQuestionImageClassName = (
  displaySize: QuestionImageDisplaySize | undefined,
  subject: QuestionImageSubject,
  reduced: boolean,
) => {
  const sizes = reduced ? questionImageClassNames : relaxedQuestionImageClassNames;
  return sizes[subject][displaySize ?? defaultQuestionImageDisplaySize];
};

export const getReviewQuestionImageClassName = (
  displaySize: QuestionImageDisplaySize | undefined,
) => reviewQuestionImageClassNames[displaySize ?? defaultQuestionImageDisplaySize];

export const getChoiceImageClassName = (
  displaySize: QuestionImageDisplaySize | undefined,
) => choiceImageClassNames[displaySize ?? defaultQuestionImageDisplaySize];

export const getReviewChoiceImageClassName = (
  displaySize: QuestionImageDisplaySize | undefined,
) => reviewChoiceImageClassNames[displaySize ?? defaultQuestionImageDisplaySize];
