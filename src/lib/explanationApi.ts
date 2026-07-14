
import type {
  DesmosBounds,
  DesmosExpression,
  DesmosExpressionInput,
  DesmosGraphConfig,
  DesmosTable,
} from "@/lib/desmosEmbed";

interface ExplanationStep {
  title: string;
  content: string;
  formula?: string;
  desmosExpressions?: DesmosExpressionInput[];
  desmosTables?: DesmosTable[];
  desmosBounds?: DesmosBounds;
  desmosDegreeMode?: boolean;
  desmosDefaultLogModeRegressions?: boolean;
  desmosPreserveSquareUnits?: boolean;
  desmosShowGraphpaper?: boolean;
  desmosGraphs?: DesmosGraphConfig[];
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

const asDesmosExpressionArray = (value: unknown): DesmosExpressionInput[] | undefined =>
  Array.isArray(value)
    ? value
        .map((item) => {
          if (typeof item === "string") return item;
          const record = asRecord(item);
          const latex = record ? asString(record.latex) ?? asString(record.expression) : undefined;
          if (!record || !latex) return undefined;
          const id = asString(record.id);
          const color = asString(record.color);
          const showLabel = asBoolean(record.showLabel);
          const explicitLabel = asString(record.label);
          const label = explicitLabel?.trim()
            ? explicitLabel
            : showLabel === true
              ? latex
              : undefined;
          const hidden = asBoolean(record.hidden);
          const sliderBounds = normalizeSliderBounds(record.sliderBounds);
          const playing = asBoolean(record.playing);
          return {
            latex,
            ...(id ? { id } : {}),
            ...(color ? { color } : {}),
            ...(label !== undefined ? { label } : {}),
            ...(showLabel !== undefined ? { showLabel } : {}),
            ...(hidden !== undefined ? { hidden } : {}),
            ...(sliderBounds ? { sliderBounds } : {}),
            ...(playing !== undefined ? { playing } : {}),
          };
        })
        .filter((item): item is DesmosExpressionInput => Boolean(item))
    : undefined;

const asBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const asFiniteNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const normalizeSliderBounds = (value: unknown): NonNullable<DesmosExpression["sliderBounds"]> | undefined => {
  const bounds = asRecord(value);
  if (!bounds) return undefined;
  const min = asString(bounds.min)?.trim();
  const max = asString(bounds.max)?.trim();
  const step = asString(bounds.step)?.trim();
  return min && max && step ? { min, max, step } : undefined;
};

function normalizeDesmosBounds(value: unknown): DesmosBounds | undefined {
  const bounds = asRecord(value);
  if (!bounds) return undefined;
  const left = asFiniteNumber(bounds.left);
  const right = asFiniteNumber(bounds.right);
  const bottom = asFiniteNumber(bounds.bottom);
  const top = asFiniteNumber(bounds.top);
  if (left === undefined || right === undefined || bottom === undefined || top === undefined) return undefined;
  if (left >= right || bottom >= top) return undefined;
  return { left, right, bottom, top };
}

function normalizeDesmosTables(value: unknown): DesmosTable[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const tables = value
    .map((rawTable) => {
      const table = asRecord(rawTable);
      if (!table || !Array.isArray(table.columns)) return null;
      const columns = table.columns
        .map((rawColumn) => {
          const column = asRecord(rawColumn);
          const latex = column ? asString(column.latex) : undefined;
          if (!column || !latex || !Array.isArray(column.values)) return null;
          const values = column.values.map((item) => {
            if (typeof item === "string") return item;
            if (typeof item === "number" && Number.isFinite(item)) return String(item);
            return "";
          });
          if (!values.some((item) => item.trim().length > 0)) return null;
          return { latex, values };
        })
        .filter((column): column is DesmosTable["columns"][number] => Boolean(column));
      return columns.length >= 2 ? { columns } : null;
    })
    .filter((table): table is DesmosTable => Boolean(table));
  return tables.length ? tables : undefined;
}

function normalizeDesmosGraph(value: unknown): DesmosGraphConfig | null {
  const graph = asRecord(value);
  if (!graph) return null;
  const expressions = asDesmosExpressionArray(graph.expressions) ?? [];
  const tables = normalizeDesmosTables(graph.tables);
  if (!expressions.length && !tables?.length) return null;
  const label = asString(graph.label);
  const bounds = normalizeDesmosBounds(graph.bounds);
  const degreeMode = asBoolean(graph.degreeMode);
  const defaultLogModeRegressions = asBoolean(graph.defaultLogModeRegressions);
  const preserveSquareUnits = asBoolean(graph.preserveSquareUnits);
  const showGraphpaper = asBoolean(graph.showGraphpaper);
  return {
    ...(label ? { label } : {}),
    expressions,
    ...(tables ? { tables } : {}),
    ...(bounds ? { bounds } : {}),
    ...(degreeMode !== undefined ? { degreeMode } : {}),
    ...(defaultLogModeRegressions !== undefined ? { defaultLogModeRegressions } : {}),
    ...(preserveSquareUnits !== undefined ? { preserveSquareUnits } : {}),
    ...(showGraphpaper !== undefined ? { showGraphpaper } : {}),
  };
}

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

  const desmosExpressions = asDesmosExpressionArray(step.desmosExpressions);
  if (desmosExpressions?.length) normalized.desmosExpressions = desmosExpressions;

  const desmosTables = normalizeDesmosTables(step.desmosTables);
  if (desmosTables?.length) normalized.desmosTables = desmosTables;

  const desmosBounds = normalizeDesmosBounds(step.desmosBounds);
  if (desmosBounds) normalized.desmosBounds = desmosBounds;

  const desmosDegreeMode = asBoolean(step.desmosDegreeMode);
  if (desmosDegreeMode !== undefined) normalized.desmosDegreeMode = desmosDegreeMode;

  const desmosDefaultLogModeRegressions = asBoolean(step.desmosDefaultLogModeRegressions);
  if (desmosDefaultLogModeRegressions !== undefined) {
    normalized.desmosDefaultLogModeRegressions = desmosDefaultLogModeRegressions;
  }

  const desmosPreserveSquareUnits = asBoolean(step.desmosPreserveSquareUnits);
  if (desmosPreserveSquareUnits !== undefined) {
    normalized.desmosPreserveSquareUnits = desmosPreserveSquareUnits;
  }

  const desmosShowGraphpaper = asBoolean(step.desmosShowGraphpaper);
  if (desmosShowGraphpaper !== undefined) normalized.desmosShowGraphpaper = desmosShowGraphpaper;

  if (Array.isArray(step.desmosGraphs)) {
    const desmosGraphs: DesmosGraphConfig[] = [];
    step.desmosGraphs.forEach((graph) => {
      const normalizedGraph = normalizeDesmosGraph(graph);
      if (normalizedGraph) desmosGraphs.push(normalizedGraph);
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
  const rootDesmosExpressions = asDesmosExpressionArray(data.desmosExpressions);
  const rootDesmosTables = normalizeDesmosTables(data.desmosTables);
  const rootDesmosBounds = normalizeDesmosBounds(data.desmosBounds);
  const rootDesmosDegreeMode = asBoolean(data.desmosDegreeMode);
  const rootDesmosDefaultLogModeRegressions = asBoolean(data.desmosDefaultLogModeRegressions);
  const rootDesmosPreserveSquareUnits = asBoolean(data.desmosPreserveSquareUnits);
  const rootDesmosShowGraphpaper = asBoolean(data.desmosShowGraphpaper);

  if (shouldAppendChoiceElimination) {
    steps.push({
      title: "Check the choices",
      content: choiceElimination,
      desmosExpressions: rootDesmosExpressions,
      desmosTables: rootDesmosTables,
      desmosBounds: rootDesmosBounds,
      desmosDegreeMode: rootDesmosDegreeMode,
      desmosDefaultLogModeRegressions: rootDesmosDefaultLogModeRegressions,
      desmosPreserveSquareUnits: rootDesmosPreserveSquareUnits,
      desmosShowGraphpaper: rootDesmosShowGraphpaper,
    });
  } else if (steps.length) {
    if (rootDesmosExpressions?.length || rootDesmosTables?.length) {
      steps[steps.length - 1] = {
        ...steps[steps.length - 1],
        desmosExpressions: rootDesmosExpressions,
        desmosTables: rootDesmosTables,
        desmosBounds: rootDesmosBounds,
        desmosDegreeMode: rootDesmosDegreeMode,
        desmosDefaultLogModeRegressions: rootDesmosDefaultLogModeRegressions,
        desmosPreserveSquareUnits: rootDesmosPreserveSquareUnits,
        desmosShowGraphpaper: rootDesmosShowGraphpaper,
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
