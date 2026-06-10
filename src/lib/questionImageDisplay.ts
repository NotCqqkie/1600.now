import type { QuestionImageDisplaySize } from "@/data/questionImageSizing.generated";

type QuestionImageSubject = "math" | "reading";

const questionImageClassNames: Record<QuestionImageSubject, Record<QuestionImageDisplaySize, string>> = {
  math: {
    compact: "question-image-size min-w-[260px] max-w-full sm:max-w-[360px] max-h-[260px]",
    standard: "question-image-size max-w-full sm:max-w-[640px] max-h-[360px]",
    wide: "question-image-size max-w-full sm:max-w-[860px] max-h-[320px]",
    large: "question-image-size max-w-full sm:max-w-[760px] max-h-[420px]",
    tall: "question-image-size max-w-full max-h-[460px]",
    xlarge: "question-image-size max-w-full sm:max-w-[900px] max-h-[560px]",
  },
  reading: {
    compact: "question-image-size min-w-[260px] max-w-full sm:max-w-[360px] max-h-[260px]",
    standard: "question-image-size max-w-full sm:max-w-[640px] max-h-[360px]",
    wide: "question-image-size max-w-full sm:max-w-[860px] max-h-[320px]",
    large: "question-image-size max-w-full sm:max-w-[760px] max-h-[420px]",
    tall: "question-image-size max-w-full max-h-[500px]",
    xlarge: "question-image-size max-w-full sm:max-w-[900px] max-h-[560px]",
  },
};

const relaxedQuestionImageClassNames: Record<QuestionImageSubject, Record<QuestionImageDisplaySize, string>> = {
  math: {
    compact: "question-image-size min-w-[280px] max-w-full sm:max-w-[420px] max-h-[300px]",
    standard: "question-image-size max-w-full sm:max-w-[680px] max-h-[380px]",
    wide: "question-image-size max-w-full sm:max-w-[900px] max-h-[340px]",
    large: "question-image-size max-w-full sm:max-w-[820px] max-h-[460px]",
    tall: "question-image-size max-w-full max-h-[520px]",
    xlarge: "question-image-size max-w-full sm:max-w-[940px] max-h-[620px]",
  },
  reading: {
    compact: "question-image-size min-w-[280px] max-w-full sm:max-w-[420px] max-h-[300px]",
    standard: "question-image-size max-w-full sm:max-w-[680px] max-h-[420px]",
    wide: "question-image-size max-w-full sm:max-w-[900px] max-h-[360px]",
    large: "question-image-size max-w-full sm:max-w-[820px] max-h-[500px]",
    tall: "question-image-size max-w-full max-h-[560px]",
    xlarge: "question-image-size max-w-full sm:max-w-[940px] max-h-[640px]",
  },
};

const reviewQuestionImageClassNames: Record<QuestionImageDisplaySize, string> = {
  compact: "question-image-size min-w-[260px] max-h-[260px] max-w-full sm:max-w-[360px]",
  standard: "question-image-size max-h-[360px] max-w-full sm:max-w-[640px]",
  wide: "question-image-size max-h-[320px] max-w-full sm:max-w-[860px]",
  large: "question-image-size max-h-[420px] max-w-full sm:max-w-[760px]",
  tall: "question-image-size max-h-[500px] max-w-full",
  xlarge: "question-image-size max-h-[560px] max-w-full sm:max-w-[900px]",
};

const choiceImageClassNames: Record<QuestionImageDisplaySize, string> = {
  compact: "question-image-size w-[180px] max-w-full max-h-[180px]",
  standard: "question-image-size w-auto max-w-full max-h-[260px] sm:max-h-[300px]",
  wide: "question-image-size w-auto max-w-full sm:max-w-[420px] max-h-[150px]",
  large: "question-image-size w-auto max-w-full max-h-[300px] sm:max-h-[325px]",
  tall: "question-image-size w-auto max-w-full max-h-[300px] sm:max-h-[325px]",
  xlarge: "question-image-size w-auto max-w-full max-h-[325px] sm:max-h-[380px]",
};

const reviewChoiceImageClassNames: Record<QuestionImageDisplaySize, string> = {
  compact: "question-image-size w-[180px] max-w-full max-h-[156px]",
  standard: "question-image-size max-h-[220px]",
  wide: "question-image-size max-w-full sm:max-w-[420px] max-h-[150px]",
  large: "question-image-size max-h-[275px]",
  tall: "question-image-size max-h-[275px]",
  xlarge: "question-image-size max-h-[300px]",
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
