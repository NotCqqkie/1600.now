import type { Question as SourceQuestion } from "./all_questions";
import mathPastRaw from "./questions/math_past.json";
import readingPastRaw from "./questions/reading_past.json";

const pastSatQuestionsData = [...mathPastRaw, ...readingPastRaw] as SourceQuestion[];
import { questions as unofficialQuestionsData } from "./unofficialQuestions";
import { resolveSatChoiceImage, resolveSatQuestionImages } from "./satQuestionImages";
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
import {
  questionSimilarityGroupByQuestion,
  questionSimilarityGroupsById,
} from "@/lib/generated/questionSimilarity.generated";
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
  /** Whether this question is currently used in practice tests. Does NOT control visibility in the question bank — all questions show. */
  inPracticeTests?: boolean | null;
  /** Category classification */
  category: QuestionCategory;
  /** Fine-grained whole-bank similar-question group tag */
  similarityTag?: string | null;
  similarityGroupId?: string | null;
  similarityGroupLabel?: string | null;
  similarityGroupSize?: number | null;
}

// Re-export category types for consumers
export type { QuestionCategory, MathDomain, EnglishDomain, MathSkill, EnglishSkill };
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
  if (/(comma\s+(negative\s+)?\d|open parenthesis|close parenthesis|y\s*-\s*intercept|x\s*-\s*intercept|parabola opens|the curve|the graph|the line passes through|left to right|quadrant\s+\d)/i.test(trimmed)) return true;
  return false;
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

// When a question already has an image of its table/figure, the source text
// often contains the same content as inline HTML (typically a leading <table>).
// Rendering both produces a duplicated visual. Strip the leading HTML block in
// that case. Uses depth tracking so nested <table>s are removed correctly.
const stripLeadingHtmlTable = (text: string): string => {
  const leadingWs = text.match(/^\s*/)?.[0] ?? "";
  const rest = text.slice(leadingWs.length);
  if (!/^<table\b/i.test(rest)) return text;

  let depth = 0;
  let i = 0;
  while (i < rest.length) {
    const openIdx = rest.toLowerCase().indexOf("<table", i);
    const closeIdx = rest.toLowerCase().indexOf("</table", i);
    if (closeIdx === -1) return text;

    if (openIdx !== -1 && openIdx < closeIdx) {
      const gt = rest.indexOf(">", openIdx);
      if (gt === -1) return text;
      depth++;
      i = gt + 1;
    } else {
      const gt = rest.indexOf(">", closeIdx);
      if (gt === -1) return text;
      depth--;
      i = gt + 1;
      if (depth === 0) return rest.slice(i).replace(/^\s+/, "");
    }
  }
  return text;
};

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
  const sanitizeText = subject === "math" ? sanitizeMathText : sanitizeReadingText;
  const normalizedQuestionImages = mapImages(q);
  const normalizedText = normalizedQuestionImages?.length
    ? stripLeadingHtmlTable(q.text)
    : q.text;
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
  const stableId = buildBankQuestionKey(source.bankType, subject, sourceId);
  const similarityGroupId = questionSimilarityGroupByQuestion[stableId] ?? null;
  const similarityGroup = similarityGroupId
    ? questionSimilarityGroupsById[similarityGroupId]
    : null;

  return {
    stableId,
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
        ? normalizedChoices.map((choice) => {
            const resolvedImage = resolveSatChoiceImage(q.id, choice.id, choice.image);
            const rawText = choice.text;
            const suppressText = Boolean(resolvedImage) && looksLikeImageDescription(rawText);
            return {
              id: choice.id,
              text: suppressText ? undefined : (rawText ? sanitizeText(rawText) : undefined),
              image: resolvedImage,
            };
          })
        : undefined)
      : undefined,
    type: normalizedType,
    correctAnswer: normalizedCorrectAnswer,
    rationale: normalizedRationale,
    questionImages: normalizedQuestionImages,
    difficulty: normalizeDifficulty(q.difficulty),
    inPracticeTests: q.inPracticeTests ?? null,
    category,
    similarityTag: similarityGroupId,
    similarityGroupId,
    similarityGroupLabel: similarityGroup?.label ?? null,
    similarityGroupSize: similarityGroup?.questionKeys.length ?? null,
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

export const getBankPool = (
  subject: BankSubject,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
): BankQuestion[] => {
  const cacheKey = makePoolCacheKey(subject, bankSource);
  const cached = poolCache.get(cacheKey);
  if (cached) return cached;

  const rawPool = getSourceIdsForFilter(bankSource)
    .flatMap((sourceId) => getNormalizedSourceSubjectQuestions(sourceId, subject));

  const pool = spaceOutNearDuplicates(rawPool).map((question, index) => ({
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

const sourceIdIndexCache = new Map<string, Map<string, BankQuestion>>();

export const getBankQuestionBySourceId = (
  subject: BankSubject,
  sourceId: string,
  bankSource: BankSourceFilter = DEFAULT_BANK_SOURCE,
): BankQuestion | null => {
  const cacheKey = makePoolCacheKey(subject, bankSource);
  let index = sourceIdIndexCache.get(cacheKey);
  if (!index) {
    index = new Map(getBankPool(subject, bankSource).map((q) => [q.sourceId, q]));
    sourceIdIndexCache.set(cacheKey, index);
  }
  return index.get(sourceId) ?? null;
};

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
