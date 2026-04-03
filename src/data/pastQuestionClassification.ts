import {
  classifyQuestion,
  normalizeCategoryFromSource,
  type QuestionCategory,
} from "./questionCategories.ts";
import { questions as unofficialQuestionsData } from "./unofficialQuestions.ts";

export type QuestionDifficulty = "Easy" | "Medium" | "Hard";

export interface PastQuestionLike {
  id: string | number;
  section?: string | null;
  domain?: string | null;
  skill?: string | null;
  testName?: string | null;
  text: string;
  choices?: Array<{ text?: string | null }> | null;
}

export interface PastQuestionMetadata {
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
}

interface DifficultyTaggedPastQuestionLike extends PastQuestionLike {
  difficulty?: string | null;
}

const MATH_LINE_SKILL: QuestionCategory = {
  subject: "Math",
  domain: "Algebra",
  skill: "Linear equations in two variables",
  confidence: "high",
};

const MATH_FUNCTION_SKILL: QuestionCategory = {
  subject: "Math",
  domain: "Algebra",
  skill: "Linear functions",
  confidence: "high",
};

const MATH_SYSTEMS_SKILL: QuestionCategory = {
  subject: "Math",
  domain: "Algebra",
  skill: "Systems of two linear equations in two variables",
  confidence: "high",
};

const ENGLISH_DOMAIN_SKILLS = new Set([
  "Cross-Text Connections",
  "Text Structure and Purpose",
  "Words in Context",
  "Rhetorical Synthesis",
  "Transitions",
  "Central Ideas and Details",
  "Command of Evidence",
  "Inferences",
  "Boundaries",
  "Form, Structure, and Sense",
]);

const MATH_DOMAIN_SKILLS = new Set([
  "Linear equations in one variable",
  "Linear functions",
  "Linear equations in two variables",
  "Systems of two linear equations in two variables",
  "Linear inequalities in one or two variables",
  "Equivalent expressions",
  "Nonlinear equations in one variable and systems of equations in two variables",
  "Nonlinear functions",
  "Ratios, rates, proportional relationships, and units",
  "Percentages",
  "One-variable data: Distributions and measures of center and spread",
  "Two-variable data: Models and scatterplots",
  "Probability and conditional probability",
  "Inference from sample statistics and margin of error",
  "Evaluating statistical claims: Observational studies and experiments",
  "Area and volume",
  "Lines, angles, and triangles",
  "Right triangles and trigonometry",
  "Circles",
]);

const QUESTION_WRAPPER_PATTERNS = [
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
  /^which best describes\b/i,
  /^which choice best\b/i,
  /^it can most reasonably be inferred\b/i,
  /^the student wants\b/i,
];

const extractQuestionNumber = (id: string | number): number | null => {
  const sourceId = String(id);
  const suffixMatch = sourceId.match(/_(\d+)$/);
  if (suffixMatch) {
    const parsed = Number.parseInt(suffixMatch[1], 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const numeric = Number.parseInt(sourceId, 10);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeText = (value: string | null | undefined): string =>
  (value ?? "")
    .replace(/\\\\/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeDifficulty = (
  value: string | null | undefined,
): QuestionDifficulty | null => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "easy") return "Easy";
  if (normalized === "medium") return "Medium";
  if (normalized === "hard") return "Hard";
  return null;
};

const buildCategoryKey = (
  question: Pick<PastQuestionLike, "section" | "domain" | "skill" | "testName">,
  categoryOverride?: QuestionCategory | null,
): string => {
  const normalizedCategory =
    categoryOverride ??
    normalizeCategoryFromSource({
      section: question.section,
      testName: question.testName,
      domain: question.domain,
      skill: question.skill,
    }) ??
    null;

  if (normalizedCategory) {
    return [
      normalizedCategory.subject,
      normalizedCategory.domain,
      normalizedCategory.skill,
    ]
      .join(" | ")
      .toLowerCase();
  }

  return [question.section ?? "", question.domain ?? "", question.skill ?? ""]
    .map((part) => String(part).trim().toLowerCase())
    .join(" | ");
};

const extractCoreQuestionText = (text: string | null | undefined): string => {
  const parts = (text ?? "")
    .replace(/\\\\/g, "\n")
    .split(/\n+/)
    .map((part) => normalizeText(part).toLowerCase())
    .filter(Boolean)
    .filter(
      (part) => !QUESTION_WRAPPER_PATTERNS.some((pattern) => pattern.test(part)),
    );

  return parts.join(" ");
};

const normalizeChoiceTextForDifficultyMatch = (
  value: string | null | undefined,
): string =>
  normalizeText(value)
    .toLowerCase()
    .replace(/\s*([,;:.!?—-])\s*/g, "$1");

const buildDifficultyMatchSignature = (
  question: PastQuestionLike,
  categoryOverride?: QuestionCategory | null,
): string | null => {
  const coreQuestionText = extractCoreQuestionText(question.text);
  if (!coreQuestionText) return null;

  const choiceBag = (question.choices ?? [])
    .map((choice) => normalizeChoiceTextForDifficultyMatch(choice.text))
    .filter(Boolean)
    .sort()
    .join(" || ");

  return [
    coreQuestionText,
    buildCategoryKey(question, categoryOverride),
    choiceBag,
  ].join(" ### ");
};

const buildUnofficialDifficultyMap = (): Map<string, QuestionDifficulty> => {
  const difficultiesBySignature = new Map<string, Set<QuestionDifficulty>>();

  for (const question of unofficialQuestionsData as DifficultyTaggedPastQuestionLike[]) {
    const signature = buildDifficultyMatchSignature(question);
    const difficulty = normalizeDifficulty(question.difficulty);
    if (!signature || !difficulty) continue;

    if (!difficultiesBySignature.has(signature)) {
      difficultiesBySignature.set(signature, new Set<QuestionDifficulty>());
    }

    difficultiesBySignature.get(signature)!.add(difficulty);
  }

  const resolved = new Map<string, QuestionDifficulty>();

  for (const [signature, difficulties] of difficultiesBySignature.entries()) {
    if (difficulties.size !== 1) continue;
    resolved.set(signature, [...difficulties][0]);
  }

  return resolved;
};

const UNOFFICIAL_DIFFICULTY_BY_SIGNATURE = buildUnofficialDifficultyMap();

const getFullText = (question: PastQuestionLike): string =>
  [question.text, ...(question.choices ?? []).map((choice) => choice.text ?? "")]
    .filter(Boolean)
    .map((part) => normalizeText(part))
    .join(" ");

const isReadingSection = (section: string | null | undefined): boolean =>
  /reading|writing|english/i.test(section ?? "");

const isMathSection = (section: string | null | undefined): boolean =>
  /math/i.test(section ?? "");

const isEnglishCategory = (category: QuestionCategory | null): boolean =>
  Boolean(category && ENGLISH_DOMAIN_SKILLS.has(category.skill));

const isMathCategory = (category: QuestionCategory | null): boolean =>
  Boolean(category && MATH_DOMAIN_SKILLS.has(category.skill));

const classifySecSkill = (choiceTexts: string[]): QuestionCategory => {
  const joined = choiceTexts.join(" ");
  const punctuationHeavy =
    choiceTexts.filter((choice) => /[,;:.!?—-]/.test(choice)).length >= 2;
  const punctuationNormalized = new Set(
    choiceTexts
      .map((choice) => choice.replace(/[,;:.!?—-]/g, "").replace(/\s+/g, " ").trim().toLowerCase())
      .filter(Boolean),
  );

  if (
    punctuationHeavy ||
    punctuationNormalized.size <= Math.max(1, Math.ceil(choiceTexts.length / 2))
  ) {
    return {
      subject: "English",
      domain: "Standard English Conventions",
      skill: "Boundaries",
      confidence: "high",
    };
  }

  if (
    /\b(is|are|was|were|has|have|had|its|it's|their|there|they're|who|whom|than|then)\b/i.test(joined)
  ) {
    return {
      subject: "English",
      domain: "Standard English Conventions",
      skill: "Form, Structure, and Sense",
      confidence: "high",
    };
  }

  return {
    subject: "English",
    domain: "Standard English Conventions",
    skill: "Form, Structure, and Sense",
    confidence: "medium",
  };
};

const classifyPastEnglishQuestion = (
  fullText: string,
  choiceTexts: string[],
  sourceCategory: QuestionCategory | null,
): QuestionCategory => {
  const lower = fullText.toLowerCase();

  if ((/text 1\b/i.test(fullText) && /text 2\b/i.test(fullText)) || /\bboth texts\b/i.test(fullText)) {
    return {
      subject: "English",
      domain: "Craft and Structure",
      skill: "Cross-Text Connections",
      confidence: "high",
    };
  }

  if (
    /while researching a topic\b/i.test(fullText) ||
    /student wants to\b/i.test(fullText) ||
    (/\bnotes\b/i.test(fullText) && /relevant information/i.test(fullText))
  ) {
    return {
      subject: "English",
      domain: "Expression of Ideas",
      skill: "Rhetorical Synthesis",
      confidence: "high",
    };
  }

  if (/most logical transition/i.test(fullText) || /\btransition\b/i.test(fullText)) {
    return {
      subject: "English",
      domain: "Expression of Ideas",
      skill: "Transitions",
      confidence: "high",
    };
  }

  if (
    /most logical and precise word or phrase/i.test(fullText) ||
    /most nearly mean/i.test(fullText) ||
    /as used in the text/i.test(fullText)
  ) {
    return {
      subject: "English",
      domain: "Craft and Structure",
      skill: "Words in Context",
      confidence: "high",
    };
  }

  if (
    /overall structure/i.test(fullText) ||
    /main purpose/i.test(fullText) ||
    /function of the underlined/i.test(fullText) ||
    /best describes the function/i.test(fullText)
  ) {
    return {
      subject: "English",
      domain: "Craft and Structure",
      skill: "Text Structure and Purpose",
      confidence: "high",
    };
  }

  if (/conventions of standard english/i.test(fullText) || /standard english/i.test(fullText)) {
    return classifySecSkill(choiceTexts);
  }

  if (
    /quotation .*illustrates/i.test(fullText) ||
    /most effectively uses data/i.test(fullText) ||
    /data from the (?:table|graph)/i.test(fullText) ||
    /according to the (?:table|graph|figure)/i.test(fullText) ||
    /\bclaim\b/i.test(fullText) ||
    /\bhypothesis\b/i.test(fullText) ||
    /\bsupport\b/i.test(fullText) ||
    /\bweaken\b/i.test(fullText) ||
    /\bundermine\b/i.test(fullText) ||
    /\bchallenge\b/i.test(fullText)
  ) {
    return {
      subject: "English",
      domain: "Information and Ideas",
      skill: "Command of Evidence",
      confidence: "high",
    };
  }

  if (
    /most reasonably infer/i.test(fullText) ||
    /what can be concluded/i.test(fullText) ||
    /most logical conclusion/i.test(fullText) ||
    /suggests that/i.test(fullText) ||
    /logically completes the text/i.test(fullText)
  ) {
    return {
      subject: "English",
      domain: "Information and Ideas",
      skill: "Inferences",
      confidence: "high",
    };
  }

  if (
    /according to the text/i.test(fullText) ||
    /based on the text/i.test(fullText) ||
    /main idea/i.test(fullText) ||
    /best summarizes/i.test(fullText) ||
    /best states the main idea/i.test(fullText)
  ) {
    return {
      subject: "English",
      domain: "Information and Ideas",
      skill: "Central Ideas and Details",
      confidence: "high",
    };
  }

  if (isEnglishCategory(sourceCategory)) {
    return sourceCategory!;
  }

  return (
    classifyQuestion(fullText, false) ?? {
      subject: "English",
      domain: "Information and Ideas",
      skill: "Central Ideas and Details",
      confidence: "low",
    }
  );
};

const classifyLinearBucket = (
  fullText: string,
  sourceCategory: QuestionCategory | null,
  ruleCategory: QuestionCategory | null,
): QuestionCategory => {
  const lower = fullText.toLowerCase();
  const hasFunctionNotation =
    /\b[a-z]\s*\(\s*x\s*\)/i.test(fullText) ||
    /\bfunction\b/i.test(fullText) ||
    /\brate of change\b/i.test(fullText) ||
    /\binitial value\b/i.test(fullText) ||
    /\bconstant rate\b/i.test(fullText);

  if (
    /\bsystem\b/i.test(fullText) ||
    /\bsolution\s*\(\s*x\s*,\s*y\s*\)/i.test(fullText) ||
    /\bordered pair\b/i.test(fullText) ||
    /\binfinitely many solutions\b/i.test(fullText) ||
    /\bno solution\b/i.test(fullText)
  ) {
    return MATH_SYSTEMS_SKILL;
  }

  if (hasFunctionNotation) {
    return MATH_FUNCTION_SKILL;
  }

  if (
    /\bwhich equation defines line\b/i.test(fullText) ||
    /\bequation of line\b/i.test(fullText) ||
    /\bpasses through the point\b/i.test(fullText) ||
    /\bperpendicular to line\b/i.test(fullText) ||
    /\bparallel to line\b/i.test(fullText) ||
    /\bslope of line\b/i.test(fullText) ||
    /\bline\b.*\bslope\b/i.test(fullText) ||
    /\bxy-?plane\b/i.test(fullText) ||
    /\bthere is a linear relationship between x and y\b/i.test(fullText) ||
    /\bthe equation\b.*\bx\b.*\by\b/i.test(fullText) ||
    /[0-9a-z)\]]\s*[+\-]\s*[0-9a-z(\[]*y\s*=\s*[-0-9a-z(]/i ||
    /\bx\s*[+\-]\s*y\s*=/i.test(lower)
  ) {
    return MATH_LINE_SKILL;
  }

  if (
    ruleCategory?.subject === "Math" &&
    (ruleCategory.skill === "Linear equations in two variables" ||
      ruleCategory.skill === "Linear functions" ||
      ruleCategory.skill === "Systems of two linear equations in two variables") &&
    ruleCategory.confidence !== "low"
  ) {
    return ruleCategory;
  }

  return sourceCategory ?? MATH_FUNCTION_SKILL;
};

const classifyExplicitLinearMathContext = (
  fullText: string,
  ruleCategory: QuestionCategory | null,
): QuestionCategory | null => {
  const hasFunctionNotation =
    /\b[a-z]\s*\(\s*x\s*\)/i.test(fullText) ||
    /\bfunction\b/i.test(fullText);

  const hasGeometryContext =
    /\bcircle\b/i.test(fullText) ||
    /\btangent\b/i.test(fullText) ||
    /\btriangle\b/i.test(fullText) ||
    /\bangle\b/i.test(fullText);

  if (
    /\bsystem\b/i.test(fullText) ||
    /\bsolution\s*\(\s*x\s*,\s*y\s*\)/i.test(fullText) ||
    /\bordered pair\b/i.test(fullText)
  ) {
    return MATH_SYSTEMS_SKILL;
  }

  if (
    !hasGeometryContext &&
    !hasFunctionNotation &&
    (
      /\bwhich equation defines line\b/i.test(fullText) ||
      /\bequation of (?:the )?line\b/i.test(fullText) ||
      /\bline\b.*\bpasses through\b/i.test(fullText) ||
      /\bparallel to the line\b/i.test(fullText) ||
      /\bperpendicular to the line\b/i.test(fullText) ||
      /\bline\b.*\bparallel\b/i.test(fullText) ||
      /\bline\b.*\bperpendicular\b/i.test(fullText) ||
      /\bslope of line\b/i.test(fullText) ||
      /\bthe equation\b.*\bx\b.*\by\b/i.test(fullText) ||
      /\bx\s*[+\-]\s*y\s*=/i.test(fullText)
    )
  ) {
    return MATH_LINE_SKILL;
  }

  if (
    hasFunctionNotation &&
    ruleCategory?.subject === "Math" &&
    ruleCategory.skill === "Linear functions"
  ) {
    return MATH_FUNCTION_SKILL;
  }

  return null;
};

const classifyPastMathQuestion = (
  fullText: string,
  sourceCategory: QuestionCategory | null,
): QuestionCategory => {
  const ruleCategory = classifyQuestion(fullText, true);
  const explicitLinearCategory = classifyExplicitLinearMathContext(fullText, ruleCategory);

  if (explicitLinearCategory) {
    return explicitLinearCategory;
  }

  if (!isMathCategory(sourceCategory)) {
    return (
      ruleCategory ?? {
        subject: "Math",
        domain: "Algebra",
        skill: "Linear equations in one variable",
        confidence: "low",
      }
    );
  }

  if (sourceCategory!.skill === "Linear functions") {
    return classifyLinearBucket(fullText, sourceCategory, ruleCategory);
  }

  if (
    sourceCategory!.skill === "Lines, angles, and triangles" &&
    ruleCategory?.subject === "Math" &&
    ruleCategory.confidence === "high" &&
    ["Circles", "Area and volume", "Right triangles and trigonometry"].includes(ruleCategory.skill)
  ) {
    return ruleCategory;
  }

  return sourceCategory!;
};

const classifyPastCategory = (question: PastQuestionLike): QuestionCategory => {
  const sourceCategory =
    normalizeCategoryFromSource({
      section: question.section,
      testName: question.testName,
      domain: question.domain,
      skill: question.skill,
    }) ?? null;

  const fullText = getFullText(question);
  const choiceTexts = (question.choices ?? []).map((choice) => normalizeText(choice.text));
  const shouldBeEnglish = isReadingSection(question.section) || isEnglishCategory(sourceCategory);
  const shouldBeMath = isMathSection(question.section) || isMathCategory(sourceCategory);

  if (shouldBeEnglish && !isEnglishCategory(sourceCategory)) {
    return classifyPastEnglishQuestion(fullText, choiceTexts, sourceCategory);
  }

  if (shouldBeMath && !isMathCategory(sourceCategory)) {
    return classifyPastMathQuestion(fullText, sourceCategory);
  }

  if (shouldBeEnglish) {
    return classifyPastEnglishQuestion(fullText, choiceTexts, sourceCategory);
  }

  return classifyPastMathQuestion(fullText, sourceCategory);
};

const inferPastDifficulty = (
  question: PastQuestionLike,
  category: QuestionCategory,
  questionNumber: number | null,
  totalQuestions: number,
  testName: string | null | undefined,
): QuestionDifficulty => {
  const unofficialDifficulty = UNOFFICIAL_DIFFICULTY_BY_SIGNATURE.get(
    buildDifficultyMatchSignature(question, category) ?? "",
  );
  if (unofficialDifficulty) {
    return unofficialDifficulty;
  }

  if (!questionNumber || totalQuestions <= 1) {
    return /module 2/i.test(testName ?? "") ? "Medium" : "Easy";
  }

  const percentile = (questionNumber - 1) / Math.max(1, totalQuestions - 1);
  const isModuleTwo = /module 2/i.test(testName ?? "");

  if (isModuleTwo) {
    if (percentile < 0.16) return "Easy";
    if (percentile < 0.55) return "Medium";
    return "Hard";
  }

  if (percentile < 0.36) return "Easy";
  if (percentile < 0.76) return "Medium";
  return "Hard";
};

export const buildPastQuestionMetadataMap = (
  questions: PastQuestionLike[],
): Map<string, PastQuestionMetadata> => {
  const countsByTestName = new Map<string, number>();

  for (const question of questions) {
    const testName = question.testName ?? "Past SAT-based";
    countsByTestName.set(testName, (countsByTestName.get(testName) ?? 0) + 1);
  }

  const result = new Map<string, PastQuestionMetadata>();

  for (const question of questions) {
    const sourceId = String(question.id);
    const testName = question.testName ?? "Past SAT-based";
    const questionNumber = extractQuestionNumber(question.id);
    const totalQuestions = countsByTestName.get(testName) ?? 0;
    const category = classifyPastCategory(question);

    result.set(sourceId, {
      category,
      difficulty: inferPastDifficulty(
        question,
        category,
        questionNumber,
        totalQuestions,
        testName,
      ),
    });
  }

  return result;
};
