
interface ExplanationStep {
  title: string;
  content: string;
  formula?: string;
  desmosExpressions?: string[];
  desmosGraphs?: { label?: string; expressions: string[] }[];
}

interface ExplanationData {
  questionId: string;
  correctAnswer: string;
  steps: ExplanationStep[];
  generatedAt: number;
}

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value)
    ? value
        .map((item) => {
          if (typeof item === "string") return item;
          const record = asRecord(item);
          return record ? asString(record.latex) ?? asString(record.expression) : undefined;
        })
        .filter((item): item is string => Boolean(item))
    : undefined;

const normalizeComparableHtml = (value: string): string =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:#[0-9]+|#x[0-9a-f]+|[a-z]+);/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

function normalizeStep(rawStep: unknown, index: number): ExplanationStep | null {
  const defaultTitle = `Step ${index + 1}`;
  if (typeof rawStep === "string") {
    return { title: defaultTitle, content: rawStep };
  }

  const step = asRecord(rawStep);
  if (!step) return null;

  const content =
    asString(step.content) ??
    asString(step.text) ??
    asString(step.step) ??
    asString(step.explain) ??
    asString(step.explanation) ??
    asString(step.explanationHtml) ??
    asString(step.body) ??
    asString(step.reason);

  if (content === undefined) return null;

  const title =
    asString(step.title) ??
    asString(step.heading) ??
    asString(step.label) ??
    defaultTitle;

  const normalized: ExplanationStep = {
    title,
    content,
  };

  const formula = asString(step.formula);
  if (formula !== undefined) normalized.formula = formula;

  const desmosExpressions = asStringArray(step.desmosExpressions);
  if (desmosExpressions?.length) normalized.desmosExpressions = desmosExpressions;

  if (Array.isArray(step.desmosGraphs)) {
    const desmosGraphs: { label?: string; expressions: string[] }[] = [];
    step.desmosGraphs.forEach((graph) => {
      const record = asRecord(graph);
      const expressions = record ? asStringArray(record.expressions) : undefined;
      if (!record || !expressions?.length) return;
      const label = asString(record.label);
      desmosGraphs.push(label ? { label, expressions } : { expressions });
    });
    if (desmosGraphs.length) normalized.desmosGraphs = desmosGraphs;
  }

  return normalized;
}

export function normalizeExplanationData(raw: unknown): ExplanationData | null {
  const data = asRecord(raw);
  if (!data) return null;

  const steps = Array.isArray(data.steps)
    ? data.steps
        .map((step, index) => normalizeStep(step, index))
        .filter((step): step is ExplanationStep => Boolean(step))
    : [];

  const legacyExplanation = asString(data.explanation);
  const explanationHtml = asString(data.explanationHtml) ?? legacyExplanation;
  if (!steps.length && explanationHtml) {
    steps.push({ title: "Explanation", content: explanationHtml });
  }

  const choiceElimination =
    asString(data.choiceElimination) ??
    asString(data.choiceEliminations) ??
    asString(data.choiceAnalysis) ??
    asString(data.eliminationHtml) ??
    (steps.length ? legacyExplanation : undefined);
  const existingStepContent = normalizeComparableHtml(steps.map((step) => step.content).join(" "));
  const shouldAppendChoiceElimination =
    choiceElimination &&
    !existingStepContent.includes(normalizeComparableHtml(choiceElimination).slice(0, 120));
  const rootDesmosExpressions = asStringArray(data.desmosExpressions);

  if (shouldAppendChoiceElimination) {
    steps.push({
      title: "Check the choices",
      content: choiceElimination,
      desmosExpressions: rootDesmosExpressions,
    });
  } else if (steps.length) {
    if (rootDesmosExpressions?.length) {
      steps[steps.length - 1] = {
        ...steps[steps.length - 1],
        desmosExpressions: rootDesmosExpressions,
      };
    }
  }

  if (!steps.length) return null;

  return {
    questionId: asString(data.questionId) ?? asString(data.qid) ?? "",
    correctAnswer: asString(data.correctAnswer) ?? "",
    steps,
    generatedAt: typeof data.generatedAt === "number" ? data.generatedAt : 0,
  };
}
