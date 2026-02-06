import { officialQuestions as allQuestionsData } from "./official_questions";
import { Question as SourceQuestion } from "./all_questions";
// @ts-ignore
// import categoryMap from "./category_map.json"; // IDs don't match anymore
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

const isMathQuestion = (q: SourceQuestion): boolean => {
    // 0. Trust source category if available
    if (q.category) {
        return q.category.subject === "Math";
    }

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

const mapImages = (image?: string) => {
  if (!image) return undefined;
  return [{
      src: ensureSatImagePath(image),
      alt: "Question image",
  }];
};

const mapChoices = (choices: SourceQuestion["choices"]) => {
  if (!choices) return undefined;
  return choices.map((choice) => {
    return {
      id: choice.id,
      text: choice.text ? sanitizeCurrency(choice.text) : undefined,
      image: choice.image ? ensureSatImagePath(choice.image) : undefined,
    } satisfies BankChoice;
  });
};

const normalizeQuestion = (q: SourceQuestion, idx: number): BankQuestion => {
  const type: BankQuestion["type"] = q.type || "multiple-choice";
  const isMath = isMathQuestion(q);
  // Full text for classification
  const fullText = q.text + " " + (q.choices?.map(c => c.text).join(" ") || "");
  
  let category: QuestionCategory;

  if (q.category) {
    category = q.category as QuestionCategory;
  } else {
    // Fallback to classifier if not mapped
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
       // Standard English: Split into Question (First part) and Passage (Remaining)
       // The dataset typically uses "\\" (double backslash) to separate the question prompt from the passage
       const raw = q.text;
       // Check for double backslash (represented as \\\\ in literal string matches)
       if (raw.includes("\\\\")) {
         const parts = raw.split("\\\\");
         // Part 0 is usually the question: "Which choice..."
         let qText = parts[0];
         let pText = parts.slice(1).join("\n\n");
         
         // Fix for "Text 1" leaking into the Question Prompt (Right side)
         // Often appears as "...questions? Text 1"
         if (qText.trim().endsWith("Text 1")) {
            // Strip "Text 1" from the end of the question text
            qText = qText.substring(0, qText.lastIndexOf("Text 1"));
            // Prepend "Text 1" to the passage text
            pText = "Text 1\n\n" + pText;
         }

         questionText = sanitizeCurrency(qText);
         passage = sanitizeCurrency(pText);
       } else {
         // Fallback: If we can't split, put everything in passage to avoid duplication
         // (Or keep as undefined passage + full questionText? No, user complained about duplication)
         // If we set passage, Left View uses it. Right View uses questionText.
         // If we set passage=prompt, questionText=undefined -> Left has content, Right has none.
         passage = prompt;
         questionText = undefined;
       }
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
    questionImages: mapImages(q.image),
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
