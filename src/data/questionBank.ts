import allQuestionsData from "./questions.json";
// @ts-ignore
import categoryMap from "./category_map.json";
import { Question as RawQuestion, Choice as RawChoice } from "./types";

const allQuestions = allQuestionsData as unknown as RawQuestion[];
const questionCategoryMap = categoryMap as Record<string, { subject: string; domain: string; skill: string; confidence: string }>;

const skillMapping: Record<string, string> = {
  // Math Mappings
  "Linear Equations in One Variable": "Linear equations in one variable",
  "Linear Functions": "Linear functions",
  "Linear Equations in Two Variables": "Linear equations in two variables",
  "Systems of Linear Equations": "Systems of two linear equations in two variables",
  "Linear Inequalities": "Linear inequalities in one or two variables",
  "Equivalent Expressions": "Equivalent expressions",
  "Nonlinear Equations and Systems": "Nonlinear equations in one variable and systems of equations in two variables",
  "Nonlinear Functions": "Nonlinear functions",
  "Ratios, Rates, Proportions, and Units": "Ratios, rates, proportional relationships, and units",
  "Percentages": "Percentages",
  "One-Variable Data": "One-variable data: Distributions and measures of center and spread",
  "Two-Variable Data": "Two-variable data: Models and scatterplots",
  "Probability": "Probability and conditional probability",
  "Sample Statistics and Margin of Error": "Inference from sample statistics and margin of error",
  "Evaluating Statistical Claims": "Evaluating statistical claims: Observational studies and experiments",
  "Area and Volume": "Area and volume",
  "Lines, Angles, and Triangles": "Lines, angles, and triangles",
  "Right Triangles and Trigonometry": "Right triangles and trigonometry",
  "Circles": "Circles",
  
  // English Mappings (Ensure exact match)
  "Cross-Text Connections": "Cross-Text Connections",
  "Text Structure and Purpose": "Text Structure and Purpose",
  "Words in Context": "Words in Context",
  "Rhetorical Synthesis": "Rhetorical Synthesis",
  "Transitions": "Transitions",
  "Central Ideas and Details": "Central Ideas and Details",
  "Command of Evidence": "Command of Evidence",
  "Inferences": "Inferences",
  "Boundaries": "Boundaries",
  "Form, Structure, and Sense": "Form, Structure, and Sense"
};

const normalizeSkill = (folderSkill: string): string => {
  return skillMapping[folderSkill] || folderSkill;
};


import {
  classifyQuestion,
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
  questionNumber: number;
  testName: string;
  prompt: string;
  passage?: string;
  questionText?: string;
  choices?: BankChoice[];
  type: "multiple-choice" | "free-response";
  correctAnswer?: string | null;
  questionImages?: { src: string; alt: string }[];
  /** Category classification */
  category: QuestionCategory;
}

// Re-export category types for consumers
export type { QuestionCategory, MathDomain, EnglishDomain, MathSkill, EnglishSkill };
export { mathDomainSkills, englishDomainSkills, allMathDomains, allEnglishDomains };

// Prefer the SAT-style images directory for all bank assets
const SAT_IMAGE_BASE = "/images/SAT-Style%20Questions/";

const ensureSatImagePath = (path: string) => {
  if (!path) return path;
  // If already pointing to SAT-Style Questions, keep it
  if (path.includes("SAT-Style")) return path;
  // If it already uses /images/ with a subfolder, keep it
  if (path.startsWith("/images/")) return path;
  const parts = path.split("/");
  const file = parts[parts.length - 1];
  return `${SAT_IMAGE_BASE}${file}`;
};

// Heuristic: preserve real math $...$ pairs; escape lone/likely-currency dollars.
const sanitizeCurrency = (text: string | null | undefined): string => {
  if (!text) return text || "";
  let result = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch !== "$") {
      result += ch;
      i += 1;
      continue;
    }

    // Find the next dollar sign
    const next = text.indexOf("$", i + 1);
    if (next === -1) {
      result += "&dollar;";
      i += 1;
      continue;
    }

    const between = text.slice(i + 1, next);
    const hasMathTokens = /\\|\^|_|\{|\}|=|\//.test(between);
    const isShortPair = between.length <= 6; // covers $2$, $-2$, $x+5$

    if (hasMathTokens || isShortPair) {
      // Treat as math delimiter pair; keep both dollars
      result += "$" + between + "$";
      i = next + 1;
    } else {
      // Likely currency (e.g., $ 2.50) — escape current and keep scanning
      result += "&dollar;";
      i += 1;
    }
  }
  return result;
};

const isMathQuestion = (q: RawQuestion) => q.test_name.toLowerCase().includes("math");

const mapImages = (images?: RawQuestion["images"]) => {
  if (!images) return undefined;
  return images.map((img) => {
    const raw = img.local || img.src;
    return {
      src: ensureSatImagePath(raw),
      alt: img.alt || "Question image",
    };
  });
};

const mapChoices = (choices: RawChoice[]) =>
  choices.map((choice) => {
    const rawImage = choice.images?.[0]?.local || choice.images?.[0]?.src;
    return {
      id: choice.label,
      text: choice.text ? sanitizeCurrency(choice.text) : undefined,
      image: rawImage ? ensureSatImagePath(rawImage) : undefined,
    } satisfies BankChoice;
  });

const buildPrompt = (q: RawQuestion) => {
  const rawPassage = q.passage || "";
  const rawQuestion = q.question_text || "";

  // Check if passage starts with question text (common in English questions)
  if (rawQuestion && rawPassage.startsWith(rawQuestion)) {
    const restOfPassage = rawPassage.slice(rawQuestion.length).trim();
    const parts = [sanitizeCurrency(rawQuestion), sanitizeCurrency(restOfPassage)].filter(Boolean);
    return parts.join("\n\n");
  }

  // For Math questions, try to split the question from the context
  // Heuristic: If it ends with '?', assume the last sentence is the question
  if (isMathQuestion(q) && !rawQuestion && rawPassage.trim().endsWith('?')) {
    const text = rawPassage.trim();
    // Find the last sentence boundary (punctuation followed by space and capital letter/number)
    const matches = [...text.matchAll(/[.!?]\s+(?=[A-Z0-9])/g)];
    
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const splitIndex = lastMatch.index! + lastMatch[0].length;
      
      const context = text.slice(0, splitIndex).trim();
      const questionPart = text.slice(splitIndex).trim();
      
      // User requested FLIP: Question Text THEN Passage/Context
      // The previous logic was Question \n\n Context (which is what line 186 did)
      // But let's check the general case below.
      
      const parts = [sanitizeCurrency(questionPart), sanitizeCurrency(context)].filter(Boolean);
      return parts.join("\n\n");
    }
  }

  // General Case:
  // Math: Question \n\n Passage
  // English: Passage \n\n Question
  if (isMathQuestion(q)) {
      const parts = [rawQuestion, rawPassage].filter(Boolean).map((p) => sanitizeCurrency(p));
      return parts.join("\n\n");
  }

  const parts = [rawPassage, rawQuestion].filter(Boolean).map((p) => sanitizeCurrency(p));
  return parts.join("\n\n");
};

const getCleanPassage = (q: RawQuestion): string | undefined => {
  const rawPassage = q.passage || "";
  const rawQuestion = q.question_text || "";

  // If passage starts with question text, strip it to avoid duplication
  // The rendering layer will show question_text separately
  if (rawQuestion && rawPassage.startsWith(rawQuestion)) {
    const clean = rawPassage.slice(rawQuestion.length).trim();
    // Return the cleaned passage (even if empty, to signal "stripped")
    return sanitizeCurrency(clean);
  }
  
  return rawPassage ? sanitizeCurrency(rawPassage) : undefined;
};

const normalizeQuestion = (q: RawQuestion, idx: number): BankQuestion => {
  const type: BankQuestion["type"] = q.is_fill_in_blank ? "free-response" : "multiple-choice";
  const isMath = isMathQuestion(q);
  const fullText = [q.passage, q.question_text, ...(q.choices?.map(c => c.text) || [])].filter(Boolean).join(" ");
  
  let category: QuestionCategory;
  
  const mapped = questionCategoryMap[q.id];
  if (mapped) {
    category = {
      subject: mapped.subject as "Math" | "English",
      domain: mapped.domain as MathDomain | EnglishDomain,
      skill: normalizeSkill(mapped.skill) as MathSkill | EnglishSkill,
      confidence: mapped.confidence as "high" | "medium" | "low",
    };
  } else {
    category = classifyQuestion(fullText, isMath) || {
      subject: isMath ? "Math" : "English",
      domain: isMath ? "Algebra" : "Information and Ideas",
      skill: isMath ? "Linear equations in one variable" : "Central Ideas and Details",
      confidence: "low" as const,
    };
  }
  
  return {
    id: idx + 1,
    sourceId: q.id,
    questionNumber: q.question_number,
    testName: q.test_name,
    prompt: buildPrompt(q),
    passage: getCleanPassage(q),
    questionText: q.question_text ? sanitizeCurrency(q.question_text) : undefined,
    choices: type === "multiple-choice" ? mapChoices(q.choices) : undefined,
    type,
    correctAnswer: q.correct_answer,
    questionImages: mapImages(q.images),
    category,
  };
};

const rawMathQuestions = allQuestions.filter(isMathQuestion);
const rawReadingQuestions = allQuestions.filter((q) => !isMathQuestion(q));

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
