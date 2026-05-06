// Explanations are pre-generated at build time and shipped as static JSON
// under /public/explanations/{questionId}.json. The runtime path is
// fetch-only — there is no LLM call in the client.

export interface ExplanationStep {
  title: string;
  content: string;
  highlights?: { text: string; color: "green" | "red" | "yellow" | "blue" }[];
  formula?: string;
  eliminationChoices?: {
    label: string;
    text: string;
    eliminated: boolean;
    reason?: string;
  }[];
  desmosExpressions?: string[];
  desmosGraphs?: { label?: string; expressions: string[] }[];
}

export interface ExplanationData {
  questionId: string;
  correctAnswer: string;
  steps: ExplanationStep[];
  generatedAt: number;
}

export function getCachedExplanation(_questionId: string): ExplanationData | null {
  return null;
}
