import { officialQuestions as allQuestionsData } from "./official_questions";
import { Question as SourceQuestion } from "./all_questions";
import { normalizeSatImagePath, resolveSatQuestionImages } from "./satQuestionImages";
import { normalizeTextForMathRendering } from "@/lib/mathTextNormalization";
// @ts-ignore
// import categoryMap from "./category_map.json"; // IDs don't match anymore
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

const allQuestions = allQuestionsData;
// const questionCategoryMap = categoryMap as Record<string, { subject: string; domain: string; skill: string; confidence: string }>;

export type BankSubject = "math" | "reading";

export interface BankChoice {
  id: string;
  text?: string;
  image?: string;
}

export interface BankQuestion {
  /** 1-based index within the filtered subject list */
  id: number;
  /** original unique id from the source dataset */
  sourceId: string;
  questionNumber: string | number;
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

const sanitizeCurrency = (text: string | null | undefined): string => {
  return normalizeTextForMathRendering(text);
};

const normalizeDifficulty = (value: string | null | undefined): "Easy" | "Medium" | "Hard" | null => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "easy") return "Easy";
  if (normalized === "medium") return "Medium";
  if (normalized === "hard") return "Hard";
  return null;
};

const inferQuestionSubject = (q: SourceQuestion): QuestionCategory["subject"] | null =>
  inferSubjectFromSource({
    section: q.section,
    subject: q.category?.subject,
    testName: q.testName,
  });

const isMathQuestion = (q: SourceQuestion): boolean => {
    // 0. Trust structured metadata when available
    const sourceSubject = inferQuestionSubject(q);
    if (sourceSubject) return sourceSubject === "Math";

    // 1. Check for Math in image path
    if (q.image && (q.image.includes("Math") || q.image.includes("_Math_"))) return true;
    if (q.image && (q.image.includes("Eng") || q.image.includes("_Eng_"))) return false;

    // 2. Check for Math Symbols in text
    // We ignore generic "\\" because it is used as a separator in English questions
    if (q.text.includes("$")) return true;
    // Check for specific LaTeX math indicators
    if (/\\(frac|sqrt|sum|int|theta|pi|infty|approx|ne|le|ge|cdot|angle|triangle)/.test(q.text)) return true;

    const lower = q.text.toLowerCase();

    // 3. Early exit for English indicators (prioritize over generic math keywords)
    const englishKeywords = ["choice completes the text", "most logical and precise", "main purpose of the text", "based on the text", "function of the underlined part"];
    if (englishKeywords.some(k => lower.includes(k))) return false;

    // 4. Check for specific keywords
    const mathKeywords = ["equation", "function", "triangle", "circle", "graph", "xy-plane", "value of", "x-axis", "y-axis", "integer", "constant"];
    if (mathKeywords.some(k => lower.includes(k))) return true;

    // Fallback: If it has numbers and symbols = Math? 
    if (/[0-9]=/.test(q.text)) return true;

    return false;
};

const hasRenderableStem = (q: SourceQuestion): boolean => {
  const hasText = Boolean(q.text?.trim());
  const hasImage = Boolean(q.image?.trim());
  return hasText || hasImage;
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

const mapImages = (questionId: string | number, image?: string) => resolveSatQuestionImages(questionId, image);

const mapChoices = (choices: SourceQuestion["choices"]) => {
  if (!choices) return undefined;
  return choices.map((choice) => {
    const resolvedChoiceImage = normalizeSatImagePath(choice.image);
    return {
      id: choice.id,
      text: choice.text ? sanitizeCurrency(choice.text) : undefined,
      image: resolvedChoiceImage,
    } satisfies BankChoice;
  });
};

const normalizeQuestion = (q: SourceQuestion, idx: number): BankQuestion => {
  const type: BankQuestion["type"] = q.type || "multiple-choice";
  const sourceSubject = inferQuestionSubject(q);
  const isMath = sourceSubject ? sourceSubject === "Math" : isMathQuestion(q);
  // Full text for classification
  const fullText = q.text + " " + (q.choices?.map((c) => c.text || "").join(" ") || "");
  
  let category: QuestionCategory;
  const sourceCategory = normalizeCategoryFromSource({
    section: q.section,
    testName: q.testName,
    subject: q.category?.subject,
    domain: q.category?.domain ?? q.domain,
    skill: q.category?.skill ?? q.skill,
    confidence: q.category?.confidence,
  });

  if (sourceCategory && (!sourceSubject || sourceCategory.subject === sourceSubject)) {
    category = sourceCategory;
  } else {
    // Fallback to classifier only when source metadata is missing/inconsistent
    category = classifyQuestion(fullText, isMath) || {
      subject: isMath ? "Math" : "English",
      domain: isMath ? "Algebra" : "Information and Ideas",
      skill: isMath ? "Linear equations in one variable" : "Central Ideas and Details",
      confidence: "low" as const,
    };
  }

  // Layout Logic for English Questions
  let prompt = sanitizeCurrency(q.text);
  let passage: string | undefined = undefined;
  let questionText: string | undefined = sanitizeCurrency(q.text);

  if (!isMath) {
    // English Logic
    const isRhetorical = category.skill === "Rhetorical Synthesis";

    if (isRhetorical) {
       // Rhetorical Synthesis: All content on left (Passage), nothing above choices
       passage = prompt;
       questionText = undefined;
    } else {
       const splitStem = splitEnglishStem(q.text);
       passage = splitStem.passage;
       questionText = splitStem.questionText;
    }
  }
  
  return {
    id: idx + 1,
    sourceId: q.id.toString(),
    questionNumber: q.id,
    testName: q.testName || "Practice Question", 
    prompt,
    passage, 
    questionText,
    choices: q.type === "multiple-choice" ? mapChoices(q.choices) : undefined,
    type,
    correctAnswer: q.correctAnswer,
    rationale: q.rationale ? sanitizeCurrency(q.rationale) : q.rationale,
    questionImages: mapImages(q.id, q.image),
    difficulty: normalizeDifficulty(q.difficulty),
    category,
  };
};

const rawMathQuestions = allQuestions.filter((q) => isMathQuestion(q) && hasRenderableStem(q));
const rawReadingQuestions = allQuestions.filter((q) => !isMathQuestion(q) && hasRenderableStem(q));

let _mathQuestions: BankQuestion[] | null = null;
let _readingQuestions: BankQuestion[] | null = null;

const getMathQuestions = () => {
  if (!_mathQuestions) {
    _mathQuestions = rawMathQuestions.map(normalizeQuestion);
  }
  return _mathQuestions;
};

const getReadingQuestions = () => {
  if (!_readingQuestions) {
    _readingQuestions = rawReadingQuestions.map(normalizeQuestion);
  }
  return _readingQuestions;
};

export const bankCounts = {
  math: rawMathQuestions.length,
  reading: rawReadingQuestions.length,
};

export const getBankQuestion = (subject: BankSubject, questionIndex: number): BankQuestion | null => {
  const pool = subject === "math" ? getMathQuestions() : getReadingQuestions();
  return pool[questionIndex - 1] || null;
};

export const getBankPool = (subject: BankSubject): BankQuestion[] =>
  subject === "math" ? getMathQuestions() : getReadingQuestions();

export const getAllBankQuestions = getBankPool;

// Filter by domain
export const getQuestionsByDomain = (
  subject: BankSubject,
  domain: MathDomain | EnglishDomain
): BankQuestion[] => {
  const pool = getBankPool(subject);
  return pool.filter((q) => q.category.domain === domain);
};

// Filter by skill
export const getQuestionsBySkill = (
  subject: BankSubject,
  skill: MathSkill | EnglishSkill
): BankQuestion[] => {
  const pool = getBankPool(subject);
  return pool.filter((q) => q.category.skill === skill);
};

// Get counts by domain
export const getDomainCounts = (subject: BankSubject): Record<string, number> => {
  const pool = getBankPool(subject);
  const counts: Record<string, number> = {};
  for (const q of pool) {
    counts[q.category.domain] = (counts[q.category.domain] || 0) + 1;
  }
  return counts;
};

// Get counts by skill
export const getSkillCounts = (subject: BankSubject): Record<string, number> => {
  const pool = getBankPool(subject);
  const counts: Record<string, number> = {};
  for (const q of pool) {
    counts[q.category.skill] = (counts[q.category.skill] || 0) + 1;
  }
  return counts;
};

// Get all questions with low confidence for review
export const getLowConfidenceQuestions = (subject: BankSubject): BankQuestion[] => {
  const pool = getBankPool(subject);
  return pool.filter((q) => q.category.confidence === "low");
};
