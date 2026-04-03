import { questions as pastSatQuestionsData, type Question as SourceQuestion } from "./all_questions";
import { questions as unofficialQuestionsData } from "./unofficialQuestions";
import { resolveSatChoiceImage, resolveSatQuestionImages } from "./satQuestionImages";
import { unofficialCompositePrimaryImageIndex } from "./unofficialCompositeImageSelection";
import { normalizeTextForMathRendering } from "@/lib/utils";
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

export type BankSubject = "math" | "reading";
export type BankSourceId = "past" | "unofficial";
export type BankSourceFilter = BankSourceId | "all";

export const BANK_SOURCE_LABELS: Record<BankSourceFilter, string> = {
  unofficial: "Unofficial Bank",
  past: "Past SAT-based",
  all: "Both Banks",
};

export const DEFAULT_BANK_SOURCE: BankSourceId = "unofficial";

interface RawBankSource {
  bankType: BankSourceId;
  bankLabel: string;
  questions: SourceQuestion[];
}

const rawSources: RawBankSource[] = [
  {
    bankType: "unofficial",
    bankLabel: BANK_SOURCE_LABELS.unofficial,
    questions: unofficialQuestionsData as SourceQuestion[],
  },
  {
    bankType: "past",
    bankLabel: BANK_SOURCE_LABELS.past,
    questions: pastSatQuestionsData,
  },
];

const rawSourceMap: Record<BankSourceId, RawBankSource> = Object.fromEntries(
  rawSources.map((source) => [source.bankType, source]),
) as Record<BankSourceId, RawBankSource>;

export interface BankChoice {
  id: string;
  text?: string;
  image?: string;
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
  questionImages?: { src: string; alt: string }[];
  difficulty?: "Easy" | "Medium" | "Hard" | null;
  /** Category classification */
  category: QuestionCategory;
}

// Re-export category types for consumers
export type { QuestionCategory, MathDomain, EnglishDomain, MathSkill, EnglishSkill };
export { mathDomainSkills, englishDomainSkills, allMathDomains, allEnglishDomains };

export const normalizeBankSource = (value: string | null | undefined): BankSourceFilter => {
  if (value === "all") return "all";
  if (value === "past") return "past";
  if (value === "unofficial") return "unofficial";
  return DEFAULT_BANK_SOURCE;
};

export const buildBankQuestionKey = (
  bankType: BankSourceId,
  subject: BankSubject,
  sourceId: string,
): string => `bank-${bankType}-${subject}-${sourceId}`;

const normalizeDifficulty = (value: string | null | undefined): "Easy" | "Medium" | "Hard" | null => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "easy") return "Easy";
  if (normalized === "medium") return "Medium";
  if (normalized === "hard") return "Hard";
  return null;
};

const sanitizeCurrency = (text: string | null | undefined): string => {
  return normalizeTextForMathRendering(text);
};

const CORRECT_ANSWER_MARKER_REGEX = /(?:Choice [A-D] is correct\.|The correct answer is\b)/g;

const trimCompositeMathStem = (text: string): string => {
  const firstQuestionMark = text.indexOf("?");
  if (firstQuestionMark === -1) return text.trim();
  return text.slice(0, firstQuestionMark + 1).trim();
};

const trimCompositeRationale = (rationale: string): string => {
  const markers = [...rationale.matchAll(CORRECT_ANSWER_MARKER_REGEX)];
  if (markers.length < 2) return rationale.trim();
  const secondMarkerIndex = markers[1].index ?? -1;
  if (secondMarkerIndex <= 0) return rationale.trim();
  return rationale.slice(0, secondMarkerIndex).trim();
};

const pickPrimaryCompositeQuestionImages = (
  sourceId: string,
  images: { src: string; alt: string }[] | undefined,
): { src: string; alt: string }[] | undefined => {
  if (!images || images.length <= 1) return images;
  const preferredIndex = unofficialCompositePrimaryImageIndex[sourceId] ?? 0;
  return [images[Math.min(preferredIndex, images.length - 1)]];
};

const getCompositeMathQuestionMetadata = (
  source: RawBankSource,
  subject: BankSubject,
  text: string,
  rationale?: string | null,
  correctAnswer?: string | null,
  choices?: SourceQuestion["choices"],
) => {
  if (source.bankType !== "unofficial" || subject !== "math" || !rationale) {
    return {
      isComposite: false,
      text,
      rationale,
      typeOverride: undefined as SourceQuestion["type"] | undefined,
      choicesOverride: undefined as SourceQuestion["choices"] | undefined,
    };
  }

  const questionMarkCount = (text.match(/\?/g) || []).length;
  const correctAnswerMarkerCount = [...rationale.matchAll(CORRECT_ANSWER_MARKER_REGEX)].length;

  if (questionMarkCount < 2 || correctAnswerMarkerCount < 2) {
    return {
      isComposite: false,
      text,
      rationale,
      typeOverride: undefined as SourceQuestion["type"] | undefined,
      choicesOverride: undefined as SourceQuestion["choices"] | undefined,
    };
  }

  const trimmedText = trimCompositeMathStem(text);
  const trimmedRationale = trimCompositeRationale(rationale);
  const normalizedCorrectAnswer = (correctAnswer ?? "").trim();
  const choiceIds = new Set((choices ?? []).map((choice) => choice.id));
  const isFirstQuestionFreeResponse =
    /^\s*The correct answer is\b/i.test(trimmedRationale) ||
    (normalizedCorrectAnswer.length > 0 && !choiceIds.has(normalizedCorrectAnswer));

  return {
    isComposite: true,
    text: trimmedText,
    rationale: trimmedRationale,
    typeOverride: isFirstQuestionFreeResponse ? "free-response" : undefined,
    choicesOverride: isFirstQuestionFreeResponse ? undefined : choices,
  };
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

const mapImages = (q: SourceQuestion) => resolveSatQuestionImages(q.id, q.image);

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
  /^what is true\b/i,
  /^what can be concluded\b/i,
  /^what can reasonably be inferred\b/i,
  /^what does the text most strongly suggest\b/i,
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

const splitQuestionFirstStem = (raw: string): { passage?: string; questionText?: string } => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      passage: undefined,
      questionText: undefined,
    };
  }

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
        passage: sanitizeCurrency(rest),
        questionText: sanitizeCurrency(firstLine),
      };
    }
  }

  const sentenceMatch = trimmed.match(/^(.+?\?)(?:\s+|$)([\s\S]*)$/);
  if (!sentenceMatch) {
    return {
      passage: sanitizeCurrency(trimmed),
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
      passage: sanitizeCurrency(remainder),
      questionText: sanitizeCurrency(questionSentence),
    };
  }

  return {
    passage: sanitizeCurrency(trimmed),
    questionText: undefined,
  };
};

const splitEnglishStem = (raw: string): { passage?: string; questionText?: string } => {
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
      passage: sanitizeCurrency(first),
      questionText: sanitizeCurrency(rest),
    };
  }

  if ((firstLooksLikeQuestion || firstEndsWithQuestion) && (restLooksLikePassage || !restLooksLikeQuestion)) {
    return {
      passage: sanitizeCurrency(rest),
      questionText: sanitizeCurrency(first),
    };
  }

  if (firstLooksLikePassage && !restLooksLikePassage) {
    return {
      passage: sanitizeCurrency(first),
      questionText: sanitizeCurrency(rest),
    };
  }

  if (restLooksLikePassage && !firstLooksLikePassage) {
    return {
      passage: sanitizeCurrency(rest),
      questionText: sanitizeCurrency(first),
    };
  }

  return {
    passage: sanitizeCurrency(rest),
    questionText: sanitizeCurrency(first),
  };
};

const normalizeQuestion = (source: RawBankSource, q: SourceQuestion): Omit<BankQuestion, "id"> => {
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
  const normalizedSource = getCompositeMathQuestionMetadata(
    source,
    subject,
    q.text,
    q.rationale,
    q.correctAnswer,
    q.choices,
  );
  const normalizedText = normalizedSource.text;
  const normalizedRationale = normalizedSource.rationale ? sanitizeCurrency(normalizedSource.rationale) : normalizedSource.rationale;
  const normalizedType = normalizedSource.typeOverride ?? q.type;
  const normalizedChoices = normalizedSource.choicesOverride ?? q.choices;
  const normalizedQuestionImages = normalizedSource.isComposite
    ? pickPrimaryCompositeQuestionImages(String(q.id), mapImages(q))
    : mapImages(q);

  const prompt = sanitizeCurrency(normalizedText);
  let passage: string | undefined;
  let questionText: string | undefined = sanitizeCurrency(normalizedText);

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

  return {
    stableId: buildBankQuestionKey(source.bankType, subject, sourceId),
    bankType: source.bankType,
    bankLabel: source.bankLabel,
    subject,
    sourceId,
    questionNumber: source.bankType === "past" ? extractLegacyQuestionNumber(sourceId) : sourceId,
    testName: q.testName || source.bankLabel,
    prompt,
    passage,
    questionText,
    choices: normalizedType === "multiple-choice"
      ? (normalizedChoices
        ? normalizedChoices.map((choice) => ({
            id: choice.id,
            text: choice.text ? sanitizeCurrency(choice.text) : undefined,
            image: resolveSatChoiceImage(q.id, choice.id, choice.image),
          }))
        : undefined)
      : undefined,
    type: normalizedType,
    correctAnswer: q.correctAnswer,
    rationale: normalizedRationale,
    questionImages: normalizedQuestionImages,
    difficulty: normalizeDifficulty(q.difficulty),
    category,
  };
};

const poolCache = new Map<string, BankQuestion[]>();
const rawSourceSubjectCache = new Map<string, SourceQuestion[]>();
const normalizedSourceSubjectCache = new Map<string, Omit<BankQuestion, "id">[]>();

const makeSourceSubjectCacheKey = (sourceId: BankSourceId, subject: BankSubject) =>
  `${sourceId}:${subject}`;

const getRawSourceSubjectQuestions = (
  sourceId: BankSourceId,
  subject: BankSubject,
): SourceQuestion[] => {
  const cacheKey = makeSourceSubjectCacheKey(sourceId, subject);
  const cached = rawSourceSubjectCache.get(cacheKey);
  if (cached) return cached;

  const source = rawSourceMap[sourceId];
  const questions = source.questions.filter((question) => {
    if (!hasRenderableStem(question)) return false;
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
  });

  rawSourceSubjectCache.set(cacheKey, questions);
  return questions;
};

const getNormalizedSourceSubjectQuestions = (
  sourceId: BankSourceId,
  subject: BankSubject,
): Omit<BankQuestion, "id">[] => {
  const cacheKey = makeSourceSubjectCacheKey(sourceId, subject);
  const cached = normalizedSourceSubjectCache.get(cacheKey);
  if (cached) return cached;

  const source = rawSourceMap[sourceId];
  const normalized = getRawSourceSubjectQuestions(sourceId, subject).map((question) =>
    normalizeQuestion(source, question),
  );

  normalizedSourceSubjectCache.set(cacheKey, normalized);
  return normalized;
};

const getSourceIdsForFilter = (bankSource: BankSourceFilter): BankSourceId[] => {
  if (bankSource === "all") return ["unofficial", "past"];
  return [bankSource];
};

const makePoolCacheKey = (subject: BankSubject, bankSource: BankSourceFilter) => `${subject}:${bankSource}`;

export const getBankPool = (
  subject: BankSubject,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
): BankQuestion[] => {
  const cacheKey = makePoolCacheKey(subject, bankSource);
  const cached = poolCache.get(cacheKey);
  if (cached) return cached;

  const pool = getSourceIdsForFilter(bankSource)
    .flatMap((sourceId) => getNormalizedSourceSubjectQuestions(sourceId, subject))
    .map((question, index) => ({
      ...question,
      id: index + 1,
    }));

  poolCache.set(cacheKey, pool);
  return pool;
};

export const getAllBankQuestions = getBankPool;

export const getBankQuestion = (
  subject: BankSubject,
  questionIndex: number,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
): BankQuestion | null => getBankPool(subject, bankSource)[questionIndex - 1] || null;

export const getBankCounts = (
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
): Record<BankSubject, number> => ({
  math: getSourceIdsForFilter(bankSource).reduce(
    (total, sourceId) => total + getRawSourceSubjectQuestions(sourceId, "math").length,
    0,
  ),
  reading: getSourceIdsForFilter(bankSource).reduce(
    (total, sourceId) => total + getRawSourceSubjectQuestions(sourceId, "reading").length,
    0,
  ),
});

export const bankCounts = getBankCounts("all");

export const getQuestionsByDomain = (
  subject: BankSubject,
  domain: MathDomain | EnglishDomain,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
): BankQuestion[] => getBankPool(subject, bankSource).filter((question) => question.category.domain === domain);

export const getQuestionsBySkill = (
  subject: BankSubject,
  skill: MathSkill | EnglishSkill,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
): BankQuestion[] => getBankPool(subject, bankSource).filter((question) => question.category.skill === skill);

export const getDomainCounts = (
  subject: BankSubject,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const question of getBankPool(subject, bankSource)) {
    counts[question.category.domain] = (counts[question.category.domain] || 0) + 1;
  }
  return counts;
};

export const getSkillCounts = (
  subject: BankSubject,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const question of getBankPool(subject, bankSource)) {
    counts[question.category.skill] = (counts[question.category.skill] || 0) + 1;
  }
  return counts;
};

export const getLowConfidenceQuestions = (
  subject: BankSubject,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
): BankQuestion[] => getBankPool(subject, bankSource).filter((question) => question.category.confidence === "low");
