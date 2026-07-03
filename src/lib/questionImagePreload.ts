import { normalizePublicAssetPath } from "@/lib/utils";

type QuestionImageLike = {
  src?: string;
  optimizedSrc?: string;
};

type ChoiceImageLike = {
  image?: string;
  imageOptimizedSrc?: string;
};

type QuestionWithImages = {
  questionImages?: QuestionImageLike[];
  choices?: ChoiceImageLike[];
};

type ImagePreloadPriority = "high" | "low" | "auto";

const preloadedUrls = new Set<string>();

const normalizeImageUrl = (url: string | undefined) =>
  url ? normalizePublicAssetPath(url) : undefined;

export const collectQuestionImageUrls = (question: QuestionWithImages | null | undefined): string[] => {
  if (!question) return [];

  const urls = new Set<string>();
  question.questionImages?.forEach((image) => {
    const url = normalizeImageUrl(image.optimizedSrc ?? image.src);
    if (url) urls.add(url);
  });
  question.choices?.forEach((choice) => {
    const url = normalizeImageUrl(choice.imageOptimizedSrc ?? choice.image);
    if (url) urls.add(url);
  });

  return [...urls];
};

export const preloadQuestionImages = (
  urls: readonly string[],
  priority: ImagePreloadPriority = "auto",
) => {
  if (typeof window === "undefined") return;

  urls.forEach((url) => {
    if (!url || preloadedUrls.has(url)) return;
    preloadedUrls.add(url);

    const image = new Image();
    image.decoding = "async";
    if ("fetchPriority" in image) {
      image.fetchPriority = priority;
    }
    image.src = url;
  });
};
