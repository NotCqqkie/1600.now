/**
 * Source type definitions for raw SAT question data.
 *
 * The actual question data now lives in:
 *   src/data/questions/math_past.json
 *   src/data/questions/reading_past.json
 *
 * These types are kept here because they are imported by many Modules/*.ts files.
 * Do not add data back to this file — use the JSON files instead.
 */

export interface QuestionCategory {
  subject: "Math" | "English";
  domain: string;
  skill: string;
  confidence: "high" | "medium" | "low";
}

export interface Question {
  section?: string;
  domain?: string;
  skill?: string;
  difficulty?: string | null;
  /** Whether this question is currently used in practice tests. Does NOT control visibility in the question bank. */
  inPracticeTests?: boolean | null;
  rationale?: string | null;
  category?: QuestionCategory;
  id: number | string;
  testName?: string;
  text: string;
  image?: string;
  choices?: {
    id: string;
    text?: string;
    image?: string;
  }[];
  correctAnswer: string;
  type: "multiple-choice" | "free-response";
}
