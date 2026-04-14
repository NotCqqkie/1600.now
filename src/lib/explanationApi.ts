const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const CACHE_PREFIX = "explanation_v1_";

export interface ExplanationStep {
  title: string;
  content: string; // HTML content with LaTeX math
  highlights?: { text: string; color: "green" | "red" | "yellow" | "blue" }[];
  formula?: string; // LaTeX formula to display prominently
  graph?: {
    type: "linear" | "quadratic" | "system" | "scatter" | "bar";
    equations?: string[];
    points?: { x: number; y: number; label?: string }[];
    xRange?: [number, number];
    yRange?: [number, number];
    xLabel?: string;
    yLabel?: string;
  };
  eliminationChoices?: {
    label: string;
    text: string;
    eliminated: boolean;
    reason?: string;
  }[];
}

export interface ExplanationData {
  questionId: string;
  correctAnswer: string;
  steps: ExplanationStep[];
  generatedAt: number;
}

function getCacheKey(questionId: string): string {
  return `${CACHE_PREFIX}${questionId}`;
}

export function getCachedExplanation(questionId: string): ExplanationData | null {
  try {
    const cached = localStorage.getItem(getCacheKey(questionId));
    if (cached) return JSON.parse(cached);
  } catch { /* ignore */ }
  return null;
}

function cacheExplanation(data: ExplanationData): void {
  try {
    localStorage.setItem(getCacheKey(data.questionId), JSON.stringify(data));
  } catch { /* localStorage full — ignore */ }
}

function buildPrompt(question: {
  section: string;
  passage: string;
  questionText?: string | null;
  choices?: { label: string; text: string }[];
  correctAnswer: string;
  domain?: string;
  skill?: string;
  difficulty?: string;
  isFillInBlank?: boolean;
}): string {
  const choicesStr = question.choices
    ?.map(c => `${c.label}) ${c.text}`)
    .join("\n") ?? "(Free response)";

  const isMath = question.section === "Math";

  return `You are an expert SAT tutor creating a step-by-step walkthrough explanation for a student.

QUESTION DETAILS:
- Section: ${question.section}
- Domain: ${question.domain || "N/A"}
- Skill: ${question.skill || "N/A"}
- Difficulty: ${question.difficulty || "N/A"}

PASSAGE/QUESTION:
${question.passage}
${question.questionText ? `\nQuestion: ${question.questionText}` : ""}

ANSWER CHOICES:
${choicesStr}

CORRECT ANSWER: ${question.correctAnswer}

Create a detailed step-by-step walkthrough. Return ONLY valid JSON (no markdown fences, no commentary) as an array of step objects.

RULES:
1. Break the solution into 3-6 clear steps
2. Each step should build on the previous one
3. Use LaTeX math notation wrapped in $ for inline and $$ for display math
4. For the final step, clearly state and confirm the correct answer
5. ${isMath ? "Include a formula field with key equations when relevant" : "Include text highlights showing key evidence from the passage"}
6. ${isMath ? 'If the problem involves graphable equations, include a graph object with plotable data points and equations' : 'Highlight key words/phrases from the passage that support the answer'}
7. For at least one step, show answer elimination — which choices are wrong and why
8. Keep explanations concise but thorough — imagine a student seeing this for the first time

JSON SCHEMA for each step:
{
  "title": "Step N: Short title",
  "content": "Explanation HTML. Use <strong> for emphasis, <br/> for line breaks. Use $...$ for inline math and $$...$$ for display math.",
  "highlights": [{"text": "quoted text from passage", "color": "green|red|yellow|blue"}],
  "formula": "$$LaTeX formula$$ (optional, for key equations)",
  "graph": { "type": "linear|quadratic|system|scatter", "equations": ["y = 2x + 1"], "points": [{"x": 0, "y": 1, "label": "intercept"}], "xRange": [-10, 10], "yRange": [-10, 10] } (optional),
  "eliminationChoices": [{"label": "A", "text": "choice text", "eliminated": true, "reason": "why wrong"}] (optional, use for one step)
}

Return the JSON array directly: [{ step1 }, { step2 }, ...]`;
}

export async function generateExplanation(
  questionId: string,
  question: {
    section: string;
    passage: string;
    questionText?: string | null;
    choices?: { label: string; text: string }[];
    correctAnswer: string;
    domain?: string;
    skill?: string;
    difficulty?: string;
    isFillInBlank?: boolean;
  },
  onStream?: (partial: string) => void
): Promise<ExplanationData> {
  // Check cache first
  const cached = getCachedExplanation(questionId);
  if (cached) return cached;

  const prompt = buildPrompt(question);

  // If no API key or key starts with "sk-or-v1-INVALID", use fallback
  if (!OPENROUTER_API_KEY) {
    throw new Error("OpenRouter API key not configured. Add VITE_OPENROUTER_API_KEY to .env");
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "1600 Prep Hub",
    },
    body: JSON.stringify({
      model: "qwen/qwen3-235b-a22b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 4000,
      stream: false,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content ?? "";

  // Parse JSON from response — handle possible markdown fences
  let jsonStr = rawContent.trim();
  // Strip markdown code fences if present
  jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  // Strip <think>...</think> blocks from reasoning models
  jsonStr = jsonStr.replace(/<think>[\s\S]*?<\/think>\s*/g, "");
  jsonStr = jsonStr.trim();

  let steps: ExplanationStep[];
  try {
    steps = JSON.parse(jsonStr);
  } catch {
    // Try to extract JSON array from the response
    const match = jsonStr.match(/\[[\s\S]*\]/);
    if (match) {
      steps = JSON.parse(match[0]);
    } else {
      throw new Error("Failed to parse explanation JSON from API response");
    }
  }

  const explanationData: ExplanationData = {
    questionId,
    correctAnswer: question.correctAnswer,
    steps,
    generatedAt: Date.now(),
  };

  cacheExplanation(explanationData);
  return explanationData;
}

export function clearExplanationCache(questionId?: string): void {
  if (questionId) {
    localStorage.removeItem(getCacheKey(questionId));
  } else {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  }
}
