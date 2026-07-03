import type { Question as SourceQuestion } from "./all_questions";
import mathPastJsonUrl from "./questions/math_past.json?url";
import readingPastJsonUrl from "./questions/reading_past.json?url";
import unofficialMathJsonUrl from "./questions/unofficial_math.json?url";
import unofficialReadingJsonUrl from "./questions/unofficial_reading.json?url";
import pastQuestionDifficultyMapJsonUrl from "./pastQuestionDifficultyMap.json?url";
import {
  getSatImageDisplaySize,
  getSatImageAssetMetadata,
  resolveSatChoiceImage,
  resolveSatQuestionImages,
  type ResolvedSatImage,
} from "./satQuestionImages";
import type { QuestionImageDisplaySize } from "./questionImageSizing.generated";
import { normalizeTextForMathRendering } from "@/lib/text/mathTextNormalization";
import { normalizeReadingText } from "@/lib/text/readingTextNormalization";
import {
  classifyQuestion,
  inferSubjectFromSource,
  normalizeCategoryFromSource,
  type QuestionCategory,
  type MathDomain,
  type EnglishDomain,
  type MathSkill,
  type EnglishSkill,
  mathDomainSkills,
  englishDomainSkills,
  allMathDomains,
  allEnglishDomains,
} from "./questionCategories";
import { BANK_COUNT_INDEX } from "@/lib/generated/bankCountIndex.generated";
import { BANK_DATA_VERSION } from "@/lib/generated/bankDataVersion.generated";
import {
  BANK_SOURCE_LABELS,
  DEFAULT_BANK_SOURCE,
  buildBankQuestionKey,
  normalizeBankSource,
  type BankSourceFilter,
  type BankSourceId,
  type BankSubject,
} from "./bankTypes";

interface RawBankSource {
  bankType: BankSourceId;
  bankLabel: string;
  questions: SourceQuestion[];
}

type CanonicalDifficulty = "Easy" | "Medium" | "Hard";

type QuestionSimilarityGroupRecord = {
  label: string;
  questionKeys: string[];
};

interface QuestionBankMetadata {
  hiddenBankQuestionIds: Set<string>;
  pastQuestionDifficultyMap: Record<string, CanonicalDifficulty | undefined> | null;
  questionSimilarityGroupByQuestion: Record<string, string> | null;
  questionSimilarityGroupsById: Record<string, QuestionSimilarityGroupRecord> | null;
}

export interface QuestionBankLoadOptions {
  includeSimilarity?: boolean;
}

export type BankQuestionSimilarityMeta = Pick<
  BankQuestion,
  "similarityTag" | "similarityGroupId" | "similarityGroupLabel" | "similarityGroupSize"
>;

// Question data is fetched as static JSON assets (?url imports) instead of
// being bundled into multi-MB JS chunks: fetch + JSON.parse keeps the data off
// the main-thread JS parse/eval path and the hashed /assets/ URL gets
// immutable caching. The error message mimics a dynamic-import failure so
// isChunkLoadError-based reload recovery still handles stale-deploy 404s.
const fetchJsonAsset = <T,>(url: string): Promise<T> =>
  fetch(url).then((response) => {
    // A stale-deploy asset URL is rewritten to /index.html by Firebase
    // hosting (200 + text/html), so the content-type check is what actually
    // catches redeploys — not the status check.
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("json")) {
      throw new Error(`Failed to fetch dynamically imported module data: ${url} (status ${response.status})`);
    }
    return response.json() as Promise<T>;
  });

const rawQuestionLoaders: Record<BankSourceId, Record<BankSubject, () => Promise<SourceQuestion[]>>> = {
  past: {
    math: () => fetchJsonAsset<SourceQuestion[]>(mathPastJsonUrl),
    reading: () => fetchJsonAsset<SourceQuestion[]>(readingPastJsonUrl),
  },
  unofficial: {
    math: () => fetchJsonAsset<SourceQuestion[]>(unofficialMathJsonUrl),
    reading: () => fetchJsonAsset<SourceQuestion[]>(unofficialReadingJsonUrl),
  },
};

const rawSourcePromiseCache = new Map<string, Promise<RawBankSource>>();
let hiddenBankQuestionIdsPromise: Promise<Set<string>> | null = null;
let pastQuestionDifficultyMapPromise: Promise<Record<string, CanonicalDifficulty | undefined>> | null = null;
let questionSimilarityPromise: Promise<Pick<QuestionBankMetadata, "questionSimilarityGroupByQuestion" | "questionSimilarityGroupsById">> | null = null;

type BankRouteIndexRow = readonly [
  id: number,
  stableId: string,
  sourceId: string,
  bankType: BankSourceId,
  difficulty: "Easy" | "Medium" | "Hard" | null,
  detailShard: number,
];

const bankRouteIndexLoaders = {
  past: {
    math: () => import("@/lib/generated/bank-route-index/past-math.generated").then((mod) => mod.BANK_ROUTE_INDEX_ROWS as readonly BankRouteIndexRow[]),
    reading: () => import("@/lib/generated/bank-route-index/past-reading.generated").then((mod) => mod.BANK_ROUTE_INDEX_ROWS as readonly BankRouteIndexRow[]),
  },
  unofficial: {
    math: () => import("@/lib/generated/bank-route-index/unofficial-math.generated").then((mod) => mod.BANK_ROUTE_INDEX_ROWS as readonly BankRouteIndexRow[]),
    reading: () => import("@/lib/generated/bank-route-index/unofficial-reading.generated").then((mod) => mod.BANK_ROUTE_INDEX_ROWS as readonly BankRouteIndexRow[]),
  },
  all: {
    math: () => import("@/lib/generated/bank-route-index/all-math.generated").then((mod) => mod.BANK_ROUTE_INDEX_ROWS as readonly BankRouteIndexRow[]),
    reading: () => import("@/lib/generated/bank-route-index/all-reading.generated").then((mod) => mod.BANK_ROUTE_INDEX_ROWS as readonly BankRouteIndexRow[]),
  },
} satisfies Record<BankSourceFilter, Record<BankSubject, () => Promise<readonly BankRouteIndexRow[]>>>;

const bankRouteIndexRowsPromiseCache = new Map<string, Promise<readonly BankRouteIndexRow[]>>();
const bankQuestionDetailShardCache = new Map<string, Promise<readonly BankQuestion[]>>();
const bankQuestionDetailShardBaseUrl = "/generated/bank-question-shards";

// Memoize in-flight/resolved loads but evict on rejection, so a transient
// network failure or stale-deploy 404 doesn't cache the rejection forever and
// leave the question page stuck on a permanent loading spinner.
const cachePromiseWithEviction = <K, V>(
  cache: Map<K, Promise<V>>,
  key: K,
  create: () => Promise<V>,
): Promise<V> => {
  const cached = cache.get(key);
  if (cached) return cached;
  const promise = create().catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, promise);
  return promise;
};

const makeSourceSubjectCacheKey = (sourceId: BankSourceId, subject: BankSubject) =>
  `${sourceId}:${subject}`;

const loadHiddenBankQuestionIds = () => {
  hiddenBankQuestionIdsPromise ??= import("@/lib/generated/hiddenBankQuestions.generated").then(
    (mod) => new Set<string>(mod.HIDDEN_BANK_QUESTION_IDS),
  );
  return hiddenBankQuestionIdsPromise;
};

const loadPastQuestionDifficultyMap = () => {
  pastQuestionDifficultyMapPromise ??= fetchJsonAsset<Record<string, CanonicalDifficulty | undefined>>(
    pastQuestionDifficultyMapJsonUrl,
  ).catch((error: unknown) => {
    pastQuestionDifficultyMapPromise = null;
    throw error;
  });
  return pastQuestionDifficultyMapPromise;
};

const loadQuestionSimilarity = () => {
  questionSimilarityPromise ??= import("@/lib/generated/questionSimilarity.generated").then((mod) => ({
    questionSimilarityGroupByQuestion: mod.questionSimilarityGroupByQuestion as Record<string, string>,
    questionSimilarityGroupsById: mod.questionSimilarityGroupsById as Record<string, QuestionSimilarityGroupRecord>,
  }));
  return questionSimilarityPromise;
};

const loadBankRouteIndexRows = (
  subject: BankSubject,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
): Promise<readonly BankRouteIndexRow[]> => {
  const cacheKey = `${bankSource}:${subject}`;
  return cachePromiseWithEviction(bankRouteIndexRowsPromiseCache, cacheKey, () =>
    bankRouteIndexLoaders[bankSource][subject](),
  );
};

export const loadQuestionSimilarityMeta = async (
  stableId: string,
): Promise<BankQuestionSimilarityMeta> => {
  const similarity = await loadQuestionSimilarity();
  const similarityGroupId = similarity.questionSimilarityGroupByQuestion[stableId] ?? null;
  const similarityGroup = similarityGroupId
    ? similarity.questionSimilarityGroupsById[similarityGroupId]
    : null;

  return {
    similarityTag: similarityGroupId,
    similarityGroupId,
    similarityGroupLabel: similarityGroup?.label ?? null,
    similarityGroupSize: similarityGroup?.questionKeys.length ?? null,
  };
};

const loadQuestionBankMetadata = async (
  sourceIds: BankSourceId[],
  options: QuestionBankLoadOptions = {},
): Promise<QuestionBankMetadata> => {
  const [hiddenBankQuestionIds, pastQuestionDifficultyMap, similarity] = await Promise.all([
    loadHiddenBankQuestionIds(),
    sourceIds.includes("past") ? loadPastQuestionDifficultyMap() : Promise.resolve(null),
    options.includeSimilarity ? loadQuestionSimilarity() : Promise.resolve(null),
  ]);

  return {
    hiddenBankQuestionIds,
    pastQuestionDifficultyMap,
    questionSimilarityGroupByQuestion: similarity?.questionSimilarityGroupByQuestion ?? null,
    questionSimilarityGroupsById: similarity?.questionSimilarityGroupsById ?? null,
  };
};

const loadRawSource = (
  sourceId: BankSourceId,
  subject: BankSubject,
): Promise<RawBankSource> => {
  const cacheKey = makeSourceSubjectCacheKey(sourceId, subject);
  return cachePromiseWithEviction(rawSourcePromiseCache, cacheKey, () =>
    rawQuestionLoaders[sourceId][subject]().then((questions) => ({
      bankType: sourceId,
      bankLabel: BANK_SOURCE_LABELS[sourceId],
      questions,
    })),
  );
};

export interface BankChoice {
  id: string;
  text?: string;
  image?: string;
  imageDisplaySize?: QuestionImageDisplaySize;
  imageWidth?: number;
  imageHeight?: number;
  imageHasTransparency?: boolean;
  imageOptimizedSrc?: string;
  imageOptimizedWidth?: number;
  imageOptimizedHeight?: number;
  imageSrcSet?: string;
  imageSizes?: string;
}

export interface BankQuestion {
  /** 1-based index within the active bank source + subject pool */
  id: number;
  /** stable unique id for progress and storage */
  stableId: string;
  bankType: BankSourceId;
  bankLabel: string;
  subject: BankSubject;
  /** original unique id from the source dataset */
  sourceId: string;
  questionNumber: number | string;
  testName: string;
  prompt: string;
  passage?: string;
  questionText?: string;
  choices?: BankChoice[];
  type: "multiple-choice" | "free-response";
  correctAnswer?: string | null;
  rationale?: string | null;
  questionImages?: ResolvedSatImage[];
  difficulty?: "Easy" | "Medium" | "Hard" | null;
  /** Whether this question is currently used in practice tests. Does NOT control visibility in the question bank. */
  inPracticeTests?: boolean | null;
  /** Source question is retained for practice/test resolution but omitted from browseable bank pools. */
  hiddenFromBank?: boolean | null;
  /** Category classification */
  category: QuestionCategory;
  /** Fine-grained whole-bank similar-question group tag */
  similarityTag?: string | null;
  similarityGroupId?: string | null;
  similarityGroupLabel?: string | null;
  similarityGroupSize?: number | null;
}

export interface BankQuestionRouteRef {
  id: number;
  stableId: string;
  sourceId: string;
  bankType: BankSourceId;
  difficulty?: "Easy" | "Medium" | "Hard" | null;
  detailShard: number;
}

// Re-export category types for consumers
export type { QuestionCategory, MathDomain, EnglishDomain, MathSkill, EnglishSkill };
export type { SourceQuestion };
export type { BankSubject, BankSourceId, BankSourceFilter };
export { mathDomainSkills, englishDomainSkills, allMathDomains, allEnglishDomains };
export { BANK_SOURCE_LABELS, DEFAULT_BANK_SOURCE, buildBankQuestionKey, normalizeBankSource };

const normalizeDifficulty = (value: string | null | undefined): "Easy" | "Medium" | "Hard" | null => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "easy") return "Easy";
  if (normalized === "medium") return "Medium";
  if (normalized === "hard") return "Hard";
  return null;
};

const resolveDifficulty = (
  source: RawBankSource,
  q: SourceQuestion,
  metadata: QuestionBankMetadata,
): "Easy" | "Medium" | "Hard" | null =>
  source.bankType === "past"
    ? metadata.pastQuestionDifficultyMap?.[String(q.id)] ?? normalizeDifficulty(q.difficulty)
    : normalizeDifficulty(q.difficulty);

const sanitizeMathText = (text: string | null | undefined): string => {
  return normalizeTextForMathRendering(text);
};

const sanitizeReadingText = (text: string | null | undefined): string => {
  return normalizeReadingText(text);
};

const inferQuestionSubject = (q: SourceQuestion): QuestionCategory["subject"] | null =>
  inferSubjectFromSource({
    section: q.section,
    subject: q.category?.subject,
    domain: q.category?.domain ?? q.domain,
    skill: q.category?.skill ?? q.skill,
    testName: q.testName,
  });

const isMathQuestion = (q: SourceQuestion): boolean => {
  const sourceSubject = inferQuestionSubject(q);
  if (sourceSubject) return sourceSubject === "Math";

  if (q.image && (q.image.includes("Math") || q.image.includes("_Math_"))) return true;
  if (q.image && (q.image.includes("Eng") || q.image.includes("_Eng_"))) return false;

  if (q.text.includes("$")) return true;
  if (/\\(frac|sqrt|sum|int|theta|pi|infty|approx|ne|le|ge|cdot|angle|triangle)/.test(q.text)) return true;

  const lower = q.text.toLowerCase();
  const englishKeywords = [
    "choice completes the text",
    "most logical and precise",
    "main purpose of the text",
    "based on the text",
    "function of the underlined part",
  ];
  if (englishKeywords.some((keyword) => lower.includes(keyword))) return false;

  const mathKeywords = [
    "equation",
    "function",
    "triangle",
    "circle",
    "graph",
    "xy-plane",
    "value of",
    "x-axis",
    "y-axis",
    "integer",
    "constant",
  ];
  if (mathKeywords.some((keyword) => lower.includes(keyword))) return true;

  if (/[0-9]=/.test(q.text)) return true;
  return false;
};

const hasRenderableStem = (q: SourceQuestion): boolean => {
  const hasText = Boolean(q.text?.trim());
  const hasImage = Boolean(q.image?.trim());
  return hasText || hasImage;
};

// Detects choice text that's actually a screen-reader / TTS description of a
// graph or figure (typically emitted as bullet lists or with phrases like
// "comma", "open parenthesis"). Used to suppress these when an image is
// available, since they otherwise duplicate or contradict the image.
const looksLikeImageDescription = (text: string | null | undefined): boolean => {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Has actual math? Then it's not a pure description.
  if (/\$[^$]+\$/.test(trimmed)) return false;
  if (/^\s*•/.test(trimmed)) return true;
  if (/(comma\s+(negative\s+)?\d|open parenthesis|close parenthesis|y\s*-\s*intercept|x\s*-\s*intercept|parabola opens|the graph|the line passes through|left to right|quadrant\s+\d)/i.test(trimmed)) return true;
  return false;
};

const looksLikeInvisiblePlaceholder = (text: string | null | undefined): boolean => {
  if (!text) return false;
  return text.replace(/(?:&#8203;|&ZeroWidthSpace;|\u200b|\s)+/g, "").length === 0;
};

// Detects choice sets that are entirely TTS bullet noise with no choice images
// available — these questions are unsalvageable until choice art is restored.
const hasUnsalvageableChoices = (q: SourceQuestion): boolean => {
  if (q.type !== "multiple-choice" || !q.choices?.length) return false;
  const anyChoiceImage = q.choices.some((c) => Boolean(resolveSatChoiceImage(q.id, c.id, c.image)));
  if (anyChoiceImage) return false;
  const allEmptyOrDescriptive = q.choices.every(
    (c) => !c.text?.trim() || looksLikeImageDescription(c.text),
  );
  return allEmptyOrDescriptive;
};

const mapImages = (q: SourceQuestion) => resolveSatQuestionImages(q.id, q.image);

const hasGeneratedTable = (q: SourceQuestion): boolean => /<table\b/i.test(q.text ?? "");

const extractLegacyQuestionNumber = (sourceId: string): number | string => {
  const match = sourceId.match(/_(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : sourceId;
};

const QUESTION_PROMPT_PATTERNS = [
  /^which choice\b/i,
  /^based on the two texts\b/i,
  /^based on both texts\b/i,
  /^based on these notes\b/i,
  /^based on the text\b/i,
  /^based on the texts\b/i,
  /^according to the text\b/i,
  /^according to the texts\b/i,
  /^according to the table\b/i,
  /^according to the graph\b/i,
  /^according to the figure\b/i,
  /^what does the text\b/i,
  /^what do the texts\b/i,
  /^what does the passage\b/i,
  /^what does the graph\b/i,
  /^what is the main idea\b/i,
  /^what is the main purpose\b/i,
  /^what choice\b/i,
  /^what is true\b/i,
  /^what can be concluded\b/i,
  /^what can reasonably be inferred\b/i,
  /^what does the text most strongly suggest\b/i,
  /^as used in the text\b/i,
  /^which finding\b/i,
  /^which statement\b/i,
  /^how would the author\b/i,
  /^how does the author\b/i,
  /^how does the text\b/i,
  /^which quotation\b/i,
  /^which choice best\b/i,
  /^it can most reasonably be inferred\b/i,
  /^the student wants\b/i,
];

const PASSAGE_MARKER_PATTERNS = [
  /^text 1\b/i,
  /^text 2\b/i,
  /^while researching a topic\b/i,
  /^the (?:table|graph|figure|chart)\b/i,
  /^for each data category\b/i,
  /^•\s/m,
];

const isLikelyQuestionPrompt = (text: string): boolean => {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return QUESTION_PROMPT_PATTERNS.some((pattern) => pattern.test(trimmed));
};

const isLikelyPassageBlock = (text: string): boolean => {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (PASSAGE_MARKER_PATTERNS.some((pattern) => pattern.test(trimmed))) return true;
  if (/^text\s+\d+\b/im.test(trimmed)) return true;
  if (trimmed.includes("\n")) return true;
  if (!trimmed.endsWith("?") && trimmed.split(/\s+/).length >= 25) return true;
  return false;
};

const splitLeadingQuestionBeforePassageMarker = (raw: string): { passage?: string; questionText?: string } | null => {
  const trimmed = raw.trim();
  const match = trimmed.match(/^([\s\S]+?\?)\s+(Text\s+[1-4]\b[\s\S]*)$/i);
  if (!match) return null;

  const questionText = match[1].trim();
  const passage = match[2].trim();
  if (!isLikelyQuestionPrompt(questionText) || !isLikelyPassageBlock(passage)) return null;

  return {
    passage: sanitizeReadingText(passage),
    questionText: sanitizeReadingText(questionText),
  };
};

const splitInlinePromptByPattern = (raw: string): { passage?: string; questionText?: string } | null => {
  const trimmed = raw.trim();
  if (!trimmed.endsWith("?")) return null;

  let bestIdx = -1;
  for (const pattern of QUESTION_PROMPT_PATTERNS) {
    const body = pattern.source.replace(/^\^/, "");
    const inline = new RegExp(`(?:[.!?:_]|_{2,}|\\s)\\s*(${body})`, pattern.flags);
    const found = inline.exec(trimmed);
    if (found && found.index >= 0) {
      const promptStart = found.index + found[0].length - found[1].length;
      if (promptStart > 20 && (bestIdx === -1 || promptStart < bestIdx)) {
        bestIdx = promptStart;
      }
    }
  }

  if (bestIdx === -1) return null;

  const passage = trimmed.slice(0, bestIdx).trim();
  const questionText = trimmed.slice(bestIdx).trim();
  if (!passage || !questionText) return null;
  if (!questionText.endsWith("?")) return null;
  if (questionText.length < 8) return null;

  return {
    passage: sanitizeReadingText(passage),
    questionText: sanitizeReadingText(questionText),
  };
};

const splitQuestionFirstStem = (raw: string): { passage?: string; questionText?: string } => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      passage: undefined,
      questionText: undefined,
    };
  }

  const inlineSplit = splitInlinePromptByPattern(trimmed);
  if (inlineSplit) return inlineSplit;

  const leadingQuestionBeforeMarkerSplit = splitLeadingQuestionBeforePassageMarker(trimmed);
  if (leadingQuestionBeforeMarkerSplit) return leadingQuestionBeforeMarkerSplit;

  const newlineIndex = trimmed.indexOf("\n");
  if (newlineIndex !== -1) {
    const firstLine = trimmed.slice(0, newlineIndex).trim();
    const rest = trimmed.slice(newlineIndex + 1).trim();
    if (
      firstLine &&
      rest &&
      (isLikelyQuestionPrompt(firstLine) || firstLine.endsWith("?")) &&
      (isLikelyPassageBlock(rest) || !isLikelyQuestionPrompt(rest))
    ) {
      return {
        passage: sanitizeReadingText(rest),
        questionText: sanitizeReadingText(firstLine),
      };
    }
  }

  const sentenceMatch = trimmed.match(/^(.+?\?)(?:\s+|$)([\s\S]*)$/);
  if (!sentenceMatch) {
    return {
      passage: sanitizeReadingText(trimmed),
      questionText: undefined,
    };
  }

  const questionSentence = sentenceMatch[1].trim();
  const remainder = (sentenceMatch[2] || "").trim();
  if (
    questionSentence &&
    remainder &&
    isLikelyQuestionPrompt(questionSentence) &&
    (isLikelyPassageBlock(remainder) || !isLikelyQuestionPrompt(remainder))
  ) {
    return {
      passage: sanitizeReadingText(remainder),
      questionText: sanitizeReadingText(questionSentence),
    };
  }

  return {
    passage: sanitizeReadingText(trimmed),
    questionText: undefined,
  };
};

const splitTrailingQuestionPrompt = (raw: string): { passage?: string; questionText?: string } | null => {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return null;

  const lastLine = lines[lines.length - 1];
  const passageLines = lines.slice(0, -1);
  const passageText = passageLines.join("\n").trim();

  if (!isLikelyQuestionPrompt(lastLine) || !isLikelyPassageBlock(passageText)) {
    return null;
  }

  return {
    passage: sanitizeReadingText(passageText),
    questionText: sanitizeReadingText(lastLine),
  };
};

const splitEnglishStem = (raw: string): { passage?: string; questionText?: string } => {
  const trailingPromptSplit = splitTrailingQuestionPrompt(raw);
  if (trailingPromptSplit) {
    return trailingPromptSplit;
  }

  if (!raw.includes("\\\\")) {
    return splitQuestionFirstStem(raw);
  }

  const parts = raw.split("\\\\");
  let first = parts[0]?.trim() || "";
  let rest = parts.slice(1).join("\n\n").trim();

  if (first.endsWith("Text 1")) {
    first = first.substring(0, first.lastIndexOf("Text 1")).trim();
    rest = `Text 1\n\n${rest}`.trim();
  }

  const firstLooksLikeQuestion = isLikelyQuestionPrompt(first);
  const restLooksLikeQuestion = isLikelyQuestionPrompt(rest);
  const firstLooksLikePassage = isLikelyPassageBlock(first);
  const restLooksLikePassage = isLikelyPassageBlock(rest);

  const firstEndsWithQuestion = first.endsWith("?");
  const restEndsWithQuestion = rest.endsWith("?");

  if ((restLooksLikeQuestion || restEndsWithQuestion) && (firstLooksLikePassage || !firstLooksLikeQuestion)) {
    return {
      passage: sanitizeReadingText(first),
      questionText: sanitizeReadingText(rest),
    };
  }

  if ((firstLooksLikeQuestion || firstEndsWithQuestion) && (restLooksLikePassage || !restLooksLikeQuestion)) {
    return {
      passage: sanitizeReadingText(rest),
      questionText: sanitizeReadingText(first),
    };
  }

  if (firstLooksLikePassage && !restLooksLikePassage) {
    return {
      passage: sanitizeReadingText(first),
      questionText: sanitizeReadingText(rest),
    };
  }

  if (restLooksLikePassage && !firstLooksLikePassage) {
    return {
      passage: sanitizeReadingText(rest),
      questionText: sanitizeReadingText(first),
    };
  }

  const fallbackSplit = {
    passage: sanitizeReadingText(rest),
    questionText: sanitizeReadingText(first),
  };

  return splitTrailingQuestionPrompt(fallbackSplit.passage ?? "") ?? fallbackSplit;
};

const normalizeQuestion = (
  source: RawBankSource,
  q: SourceQuestion,
  metadata: QuestionBankMetadata,
): Omit<BankQuestion, "id"> => {
  const sourceCategory = normalizeCategoryFromSource({
    section: q.section,
    testName: q.testName,
    subject: q.category?.subject,
    domain: q.category?.domain ?? q.domain,
    skill: q.category?.skill ?? q.skill,
    confidence: q.category?.confidence,
  });

  const isMath = sourceCategory
    ? sourceCategory.subject === "Math"
    : isMathQuestion(q);

  const fullText = `${q.text} ${(q.choices?.map((choice) => choice.text || "").join(" ")) || ""}`;
  const category =
    sourceCategory ||
    classifyQuestion(fullText, isMath) || {
      subject: isMath ? "Math" : "English",
      domain: isMath ? "Algebra" : "Information and Ideas",
      skill: isMath ? "Linear equations in one variable" : "Central Ideas and Details",
      confidence: "low" as const,
    };

  const subject: BankSubject = category.subject === "Math" ? "math" : "reading";
  const sanitizeText = subject === "math" ? sanitizeMathText : sanitizeReadingText;
  const normalizedQuestionImages = hasGeneratedTable(q) ? undefined : mapImages(q);
  const normalizedText = q.text;
  const normalizedRationale = q.rationale ? sanitizeText(q.rationale) : q.rationale;
  const normalizedType = q.type;
  const normalizedChoices = q.choices;
  const normalizedCorrectAnswer = q.correctAnswer;

  const prompt = sanitizeText(normalizedText);
  let passage: string | undefined;
  let questionText: string | undefined = sanitizeText(normalizedText);

  if (!isMath) {
    const isRhetorical = category.skill === "Rhetorical Synthesis";

    if (isRhetorical) {
      passage = prompt;
      questionText = undefined;
    } else {
      const splitStem = splitEnglishStem(normalizedText);
      passage = splitStem.passage;
      questionText = splitStem.questionText;
    }
  }

  const sourceId = String(q.id);
  const testName = source.bankType === "past" ? source.bankLabel : q.testName || source.bankLabel;
  const stableId = buildBankQuestionKey(source.bankType, subject, sourceId);
  const hiddenFromBank = metadata.hiddenBankQuestionIds.has(stableId);
  const similarityGroupId = metadata.questionSimilarityGroupByQuestion?.[stableId] ?? null;
  const similarityGroup = similarityGroupId
    ? metadata.questionSimilarityGroupsById?.[similarityGroupId]
    : null;

  return {
    stableId,
    bankType: source.bankType,
    bankLabel: source.bankLabel,
    subject,
    sourceId,
    questionNumber: source.bankType === "past" ? extractLegacyQuestionNumber(sourceId) : sourceId,
    testName,
    prompt,
    passage,
    questionText,
    choices: normalizedType === "multiple-choice"
      ? (normalizedChoices
        ? normalizedChoices.map((choice) => {
            const resolvedImage = resolveSatChoiceImage(q.id, choice.id, choice.image);
            const imageMetadata = getSatImageAssetMetadata(resolvedImage);
            const rawText = choice.text;
            const suppressText = Boolean(resolvedImage) && (looksLikeImageDescription(rawText) || looksLikeInvisiblePlaceholder(rawText));
            return {
              id: choice.id,
              text: suppressText ? undefined : (rawText ? sanitizeText(rawText) : undefined),
              image: resolvedImage,
              imageDisplaySize: imageMetadata?.displaySize ?? getSatImageDisplaySize(resolvedImage),
              imageWidth: imageMetadata?.optimizedWidth ?? imageMetadata?.width,
              imageHeight: imageMetadata?.optimizedHeight ?? imageMetadata?.height,
              imageHasTransparency: imageMetadata?.hasTransparentPixel,
              imageOptimizedSrc: imageMetadata?.optimizedSrc,
              imageOptimizedWidth: imageMetadata?.optimizedWidth,
              imageOptimizedHeight: imageMetadata?.optimizedHeight,
              imageSrcSet: imageMetadata?.srcSet,
              imageSizes: imageMetadata?.sizes,
            };
          })
        : undefined)
      : undefined,
    type: normalizedType,
    correctAnswer: normalizedCorrectAnswer,
    rationale: normalizedRationale,
    questionImages: normalizedQuestionImages,
    difficulty: resolveDifficulty(source, q, metadata),
    inPracticeTests: q.inPracticeTests ?? null,
    hiddenFromBank,
    category,
    similarityTag: similarityGroupId,
    similarityGroupId,
    similarityGroupLabel: similarityGroup?.label ?? null,
    similarityGroupSize: similarityGroup?.questionKeys.length ?? null,
  };
};

const poolCache = new Map<string, Promise<BankQuestion[]>>();
const sourcePoolCache = new Map<string, Promise<BankQuestion[]>>();
const resolvedPoolCache = new Map<string, BankQuestion[]>();
const resolvedSourcePoolCache = new Map<string, BankQuestion[]>();
const rawSourceSubjectCache = new Map<string, Promise<SourceQuestion[]>>();
const normalizedSourceSubjectCache = new Map<string, Promise<Omit<BankQuestion, "id">[]>>();

const getRawSourceSubjectQuestions = async (
  sourceId: BankSourceId,
  subject: BankSubject,
): Promise<SourceQuestion[]> => {
  const cacheKey = makeSourceSubjectCacheKey(sourceId, subject);
  const cached = rawSourceSubjectCache.get(cacheKey);
  if (cached) return cached;

  const promise = loadRawSource(sourceId, subject).then((source) =>
    source.questions.filter((question) => {
      if (!hasRenderableStem(question)) return false;
      if (hasUnsalvageableChoices(question)) return false;
      const sourceCategory = normalizeCategoryFromSource({
        section: question.section,
        testName: question.testName,
        subject: question.category?.subject,
        domain: question.category?.domain ?? question.domain,
        skill: question.category?.skill ?? question.skill,
        confidence: question.category?.confidence,
      });

      const questionSubject: BankSubject =
        (sourceCategory ? sourceCategory.subject === "Math" : isMathQuestion(question))
          ? "math"
          : "reading";

      return questionSubject === subject;
    }),
  );

  rawSourceSubjectCache.set(cacheKey, promise);
  return promise;
};

const getNormalizedSourceSubjectQuestions = (
  sourceId: BankSourceId,
  subject: BankSubject,
  metadata: QuestionBankMetadata,
  options: QuestionBankLoadOptions = {},
): Promise<Omit<BankQuestion, "id">[]> => {
  const cacheKey = `${makeSourceSubjectCacheKey(sourceId, subject)}:${options.includeSimilarity ? "similarity" : "base"}`;
  const cached = normalizedSourceSubjectCache.get(cacheKey);
  if (cached) return cached;

  const promise = Promise.all([
    loadRawSource(sourceId, subject),
    getRawSourceSubjectQuestions(sourceId, subject),
  ]).then(([source, questions]) =>
    questions.map((question) => normalizeQuestion(source, question, metadata)),
  );

  normalizedSourceSubjectCache.set(cacheKey, promise);
  return promise;
};

const getSourceIdsForFilter = (bankSource: BankSourceFilter): BankSourceId[] => {
  if (bankSource === "all") return ["unofficial", "past"];
  return [bankSource];
};

const makePoolCacheKey = (
  subject: BankSubject,
  bankSource: BankSourceFilter,
  options: QuestionBankLoadOptions = {},
) => `${subject}:${bankSource}:${options.includeSimilarity ? "similarity" : "base"}`;

const nearDuplicateSignature = (question: Record<string, unknown>): string => {
  const raw =
    (typeof question.prompt === "string" && question.prompt) ||
    (typeof question.questionText === "string" && question.questionText) ||
    (typeof question.text === "string" && question.text) ||
    "";
  return raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[-+]?\d[\d,]*(?:\.\d+)?/g, "N")
    .trim();
};

export const spaceOutNearDuplicates = <T extends Record<string, unknown>>(items: T[]): T[] => {
  if (items.length < 2) return items;
  const result = [...items];
  for (let i = 1; i < result.length; i++) {
    if (nearDuplicateSignature(result[i]) !== nearDuplicateSignature(result[i - 1])) continue;
    let swapIdx = -1;
    for (let j = i + 1; j < result.length; j++) {
      const sj = nearDuplicateSignature(result[j]);
      if (sj === nearDuplicateSignature(result[i - 1])) continue;
      const nextSig = i + 1 < result.length ? nearDuplicateSignature(result[i + 1]) : null;
      if (nextSig !== null && sj === nextSig) continue;
      swapIdx = j;
      break;
    }
    if (swapIdx !== -1) {
      [result[i], result[swapIdx]] = [result[swapIdx], result[i]];
    }
  }
  return result;
};

export const loadBankPool = async (
  subject: BankSubject,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
  options: QuestionBankLoadOptions = {},
): Promise<BankQuestion[]> => {
  const cacheKey = makePoolCacheKey(subject, bankSource, options);
  const cached = poolCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    const sourceIds = getSourceIdsForFilter(bankSource);
    const metadata = await loadQuestionBankMetadata(sourceIds, options);
    const rawPool = (
      await Promise.all(
        sourceIds.map((sourceId) =>
          getNormalizedSourceSubjectQuestions(sourceId, subject, metadata, options),
        ),
      )
    ).flat();

    const visiblePool = rawPool.filter((question) => !question.hiddenFromBank);

    const questions = spaceOutNearDuplicates(visiblePool).map((question, index) => ({
      ...question,
      id: index + 1,
    }));
    resolvedPoolCache.set(cacheKey, questions);
    return questions;
  })();

  poolCache.set(cacheKey, promise);
  return promise;
};

export const loadAllBankQuestions = loadBankPool;

export const getResolvedBankPool = (
  subject: BankSubject,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
  options: QuestionBankLoadOptions = {},
): BankQuestion[] | null => resolvedPoolCache.get(makePoolCacheKey(subject, bankSource, options)) ?? null;

export const loadAllSourceBankQuestions = async (
  subject: BankSubject,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
  options: QuestionBankLoadOptions = {},
): Promise<BankQuestion[]> => {
  const cacheKey = makePoolCacheKey(subject, bankSource, options);
  const cached = sourcePoolCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    const sourceIds = getSourceIdsForFilter(bankSource);
    const metadata = await loadQuestionBankMetadata(sourceIds, options);
    const sourcePool = (
      await Promise.all(
        sourceIds.map((sourceId) =>
          getNormalizedSourceSubjectQuestions(sourceId, subject, metadata, options),
        ),
      )
    ).flat();

    const questions = sourcePool.map((question, index) => ({
      ...question,
      id: index + 1,
    }));
    resolvedSourcePoolCache.set(cacheKey, questions);
    return questions;
  })();

  sourcePoolCache.set(cacheKey, promise);
  return promise;
};

export const getResolvedAllSourceBankQuestions = (
  subject: BankSubject,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
  options: QuestionBankLoadOptions = {},
): BankQuestion[] | null => resolvedSourcePoolCache.get(makePoolCacheKey(subject, bankSource, options)) ?? null;

const routeRefsCache = new Map<string, Promise<BankQuestionRouteRef[]>>();
const routeRefBySourceIdCache = new Map<string, Promise<Map<string, BankQuestionRouteRef>>>();
const routeIndexedQuestionCache = new Map<string, Promise<BankQuestion | null>>();

const loadBankQuestionDetailShard = (
  sourceId: BankSourceId,
  subject: BankSubject,
  shardIndex: number,
): Promise<readonly BankQuestion[]> => {
  const cacheKey = `${sourceId}:${subject}:${shardIndex}`;
  return cachePromiseWithEviction(bankQuestionDetailShardCache, cacheKey, () =>
    fetchJsonAsset<readonly BankQuestion[]>(
      `${bankQuestionDetailShardBaseUrl}/${sourceId}-${subject}-${shardIndex}.json?v=${BANK_DATA_VERSION}`,
    ),
  );
};

const routeRowToRef = (row: BankRouteIndexRow): BankQuestionRouteRef => ({
  id: row[0],
  stableId: row[1],
  sourceId: row[2],
  bankType: row[3],
  difficulty: row[4],
  detailShard: row[5],
});

export const loadBankQuestionRouteRefs = (
  subject: BankSubject,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
): Promise<BankQuestionRouteRef[]> => {
  const cacheKey = `${subject}:${bankSource}`;
  return cachePromiseWithEviction(routeRefsCache, cacheKey, () =>
    loadBankRouteIndexRows(subject, bankSource).then((rows) => rows.map(routeRowToRef)),
  );
};

export const loadBankQuestionRouteRef = async (
  subject: BankSubject,
  idParam: string,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
): Promise<BankQuestionRouteRef | null> => {
  const refs = await loadBankQuestionRouteRefs(subject, bankSource);
  if (/^\d+$/.test(idParam)) {
    const questionNumber = Number.parseInt(idParam, 10);
    return refs[questionNumber - 1] ?? null;
  }

  const cacheKey = `${subject}:${bankSource}`;
  let sourceIdIndex = routeRefBySourceIdCache.get(cacheKey);
  if (!sourceIdIndex) {
    sourceIdIndex = Promise.resolve(new Map(refs.map((ref) => [ref.sourceId, ref])));
    routeRefBySourceIdCache.set(cacheKey, sourceIdIndex);
  }

  return (await sourceIdIndex).get(idParam) ?? null;
};

export const loadRouteIndexedBankQuestion = (
  subject: BankSubject,
  idParam: string,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
  options: QuestionBankLoadOptions = {},
): Promise<BankQuestion | null> => {
  const cacheKey = `${makePoolCacheKey(subject, bankSource, options)}:${idParam}`;
  return cachePromiseWithEviction(routeIndexedQuestionCache, cacheKey, async () => {
    const routeRef = await loadBankQuestionRouteRef(subject, idParam, bankSource);
    if (!routeRef) return null;

    const detailShard = await loadBankQuestionDetailShard(
      routeRef.bankType,
      subject,
      routeRef.detailShard,
    );
    const question = detailShard.find((candidate) => candidate.sourceId === routeRef.sourceId);
    if (!question) return null;

    const similarityMeta = options.includeSimilarity
      ? await loadQuestionSimilarityMeta(routeRef.stableId)
      : null;

    return {
      ...question,
      ...(similarityMeta ?? {}),
      id: routeRef.id,
    };
  });
};

export const loadBankQuestion = async (
  subject: BankSubject,
  questionIndex: number,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
  options: QuestionBankLoadOptions = {},
): Promise<BankQuestion | null> => (await loadBankPool(subject, bankSource, options))[questionIndex - 1] || null;

const sourceIdIndexCache = new Map<string, Promise<Map<string, BankQuestion>>>();
const sourceQuestionIdIndexCache = new Map<string, Promise<Map<string, BankQuestion>>>();

export const loadBankQuestionBySourceId = async (
  subject: BankSubject,
  sourceId: string,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
  options: QuestionBankLoadOptions = {},
): Promise<BankQuestion | null> => {
  const cacheKey = makePoolCacheKey(subject, bankSource, options);
  let index = sourceIdIndexCache.get(cacheKey);
  if (!index) {
    index = loadBankPool(subject, bankSource, options).then((questions) =>
      new Map(questions.map((q) => [q.sourceId, q])),
    );
    sourceIdIndexCache.set(cacheKey, index);
  }
  return (await index).get(sourceId) ?? null;
};

export const loadSourceBankQuestionBySourceId = async (
  subject: BankSubject,
  sourceId: string,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
  options: QuestionBankLoadOptions = {},
): Promise<BankQuestion | null> => {
  const cacheKey = makePoolCacheKey(subject, bankSource, options);
  let index = sourceQuestionIdIndexCache.get(cacheKey);
  if (!index) {
    index = loadAllSourceBankQuestions(subject, bankSource, options).then((questions) =>
      new Map(questions.map((q) => [q.sourceId, q])),
    );
    sourceQuestionIdIndexCache.set(cacheKey, index);
  }
  return (await index).get(sourceId) ?? null;
};

export const getBankCounts = (
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
): Record<BankSubject, number> => ({
  math: BANK_COUNT_INDEX[bankSource].math.total,
  reading: BANK_COUNT_INDEX[bankSource].reading.total,
});

export const bankCounts = getBankCounts("all");

const loadFilteredBankPool = async (
  subject: BankSubject,
  bankSource: BankSourceFilter,
  options: QuestionBankLoadOptions,
  predicate: (question: BankQuestion) => boolean,
): Promise<BankQuestion[]> =>
  (await loadBankPool(subject, bankSource, options)).filter(predicate);

export const loadQuestionsByDomain = async (
  subject: BankSubject,
  domain: MathDomain | EnglishDomain,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
  options: QuestionBankLoadOptions = {},
): Promise<BankQuestion[]> =>
  loadFilteredBankPool(
    subject,
    bankSource,
    options,
    (question) => question.category.domain === domain,
  );

export const loadQuestionsBySkill = async (
  subject: BankSubject,
  skill: MathSkill | EnglishSkill,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
  options: QuestionBankLoadOptions = {},
): Promise<BankQuestion[]> =>
  loadFilteredBankPool(
    subject,
    bankSource,
    options,
    (question) => question.category.skill === skill,
  );

export const loadDomainCounts = async (
  subject: BankSubject,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
  options: QuestionBankLoadOptions = {},
): Promise<Record<string, number>> => {
  const counts: Record<string, number> = {};
  for (const question of await loadBankPool(subject, bankSource, options)) {
    counts[question.category.domain] = (counts[question.category.domain] || 0) + 1;
  }
  return counts;
};

export const loadSkillCounts = async (
  subject: BankSubject,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
  options: QuestionBankLoadOptions = {},
): Promise<Record<string, number>> => {
  const counts: Record<string, number> = {};
  for (const question of await loadBankPool(subject, bankSource, options)) {
    counts[question.category.skill] = (counts[question.category.skill] || 0) + 1;
  }
  return counts;
};

export const loadLowConfidenceQuestions = async (
  subject: BankSubject,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
  options: QuestionBankLoadOptions = {},
): Promise<BankQuestion[]> =>
  (await loadBankPool(subject, bankSource, options)).filter((question) => question.category.confidence === "low");
