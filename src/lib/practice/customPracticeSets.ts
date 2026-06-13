import type { NavigateFunction } from "react-router-dom";
import {
  loadAllBankQuestions,
  type BankQuestion,
  type BankSourceId,
  type BankSubject,
} from "@/data/questionBank";

type QuestionSimilarityGroupRecord = {
  archetype: string;
  label: string;
  questionKeys: string[];
};

let questionSimilarityGroupsByIdPromise: Promise<Record<string, QuestionSimilarityGroupRecord>> | null = null;

const loadQuestionSimilarityGroupsById = () => {
  questionSimilarityGroupsByIdPromise ??= import("@/lib/generated/questionSimilarity.generated").then(
    (mod) => mod.questionSimilarityGroupsById as Record<string, QuestionSimilarityGroupRecord>,
  );
  return questionSimilarityGroupsByIdPromise;
};

export interface CustomPracticeSetItem {
  subject: BankSubject;
  id: number;
  sourceId: string;
  bankType: BankSourceId;
  storageId: string;
  index: number;
}

export interface CustomPracticeSet {
  version: 1;
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  subject: BankSubject | "mixed";
  domain: string;
  skill: string;
  similarityGroupId: string | null;
  originQuestionStableId: string;
  questionCount: number;
  items: CustomPracticeSetItem[];
  sourceType?: "related-question" | "bank-selection";
}

const LEGACY_CUSTOM_PRACTICE_SETS_KEY = "custom-practice-sets:v1";
const CUSTOM_PRACTICE_SETS_KEY_PREFIX = "custom-practice-sets:v1:";
const PRACTICE_RUN_STORAGE_KEY = "practiceRunId";
const ANON_SUFFIX = "anon";
const MIN_CUSTOM_PRACTICE_SET_QUESTIONS = 5;
const MAX_CUSTOM_PRACTICE_SET_QUESTIONS = 20;
export const CUSTOM_PRACTICE_SETS_EVENT = "app-custom-practice-sets-change";

export const customPracticeSetsStorageKey = (uid: string | null | undefined) =>
  `${CUSTOM_PRACTICE_SETS_KEY_PREFIX}${uid ?? ANON_SUFFIX}`;

const getStorage = () =>
  typeof window === "undefined" ? null : window.localStorage;

const readJson = <T>(key: string, fallback: T): T => {
  const storage = getStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(key, JSON.stringify(value));
};

const buildPracticeRunId = (setId: string) =>
  `${setId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const saveCustomPracticeSets = (
  sets: CustomPracticeSet[],
  uid?: string | null,
  options: { notify?: boolean } = {},
) => {
  writeJson(customPracticeSetsStorageKey(uid), sets);
  if (options.notify !== false && typeof window !== "undefined") {
    window.dispatchEvent(new Event(CUSTOM_PRACTICE_SETS_EVENT));
  }
};

export const mergeCustomPracticeSets = (
  local: CustomPracticeSet[],
  remote: CustomPracticeSet[],
): CustomPracticeSet[] => {
  const byId = new Map<string, CustomPracticeSet>();
  for (const set of remote) byId.set(set.id, set);
  for (const set of local) {
    const existing = byId.get(set.id);
    if (!existing || set.updatedAt >= existing.updatedAt) {
      byId.set(set.id, set);
    }
  }
  return [...byId.values()].sort((left, right) => right.updatedAt - left.updatedAt);
};

export const migrateLegacyCustomPracticeSets = (uid?: string | null) => {
  const storage = getStorage();
  if (!storage) return;
  const legacy = readJson<CustomPracticeSet[]>(LEGACY_CUSTOM_PRACTICE_SETS_KEY, []);
  if (legacy.length === 0) return;
  const scoped = readJson<CustomPracticeSet[]>(customPracticeSetsStorageKey(uid), []);
  saveCustomPracticeSets(mergeCustomPracticeSets(scoped, legacy), uid, { notify: false });
  storage.removeItem(LEGACY_CUSTOM_PRACTICE_SETS_KEY);
};

if (typeof window !== "undefined") migrateLegacyCustomPracticeSets(null);

const allBankQuestionsByStableId = async () => {
  const questions = [
    ...(await loadAllBankQuestions("math", "all", { includeSimilarity: true })),
    ...(await loadAllBankQuestions("reading", "all", { includeSimilarity: true })),
  ];
  return new Map(questions.map((question) => [question.stableId, question]));
};

const isValidPracticeSetSize = (count: number, sourceType?: CustomPracticeSet["sourceType"]) =>
  count >= MIN_CUSTOM_PRACTICE_SET_QUESTIONS &&
  (sourceType === "bank-selection" || count <= MAX_CUSTOM_PRACTICE_SET_QUESTIONS);

const isSavedCustomPracticeSet = (set: CustomPracticeSet) =>
  set.sourceType === "related-question" || (!set.sourceType && set.id.startsWith("similar-"));

const methodTitleOverrides: Record<string, string> = {
  "algebraic equivalence": "Algebraic Equivalence",
  "arc sector": "Arcs and Sectors",
  "author response": "Cross-Text Author Responses",
  "central detail": "Central Details",
  "choose precise word": "Words in Context",
  "circle area": "Circle Area",
  "linear equation solve": "Solving Linear Equations",
  "solve linear system": "Solving Linear Systems",
  "linear systems": "Solving Linear Systems",
  "solution count linear equation": "Linear Equation Solution Counts",
  "system solution count": "System Solution Counts",
  "rewrite equivalent expression": "Rewriting Equivalent Expressions",
  "linear equation two variables": "Two-Variable Linear Equations",
  "linear function model": "Linear Function Modeling",
  "linear function table": "Linear Function Tables",
  "linear inequality": "Linear Inequalities",
  "scatterplot model": "Scatterplot Modeling",
  "exponential function": "Exponential Functions",
  "nonlinear equation": "Solving Nonlinear Equations",
  "nonlinear equation roots": "Finding Nonlinear Roots",
  "nonlinear function model": "Nonlinear Function Modeling",
  "nonlinear graph": "Nonlinear Graphs",
  "nonlinear system": "Solving Nonlinear Systems",
  "quadratic vertex": "Finding Quadratic Vertices",
  "right triangle": "Right Triangles",
  "triangle angle chasing": "Triangle Angle Chasing",
  "triangle area": "Triangle Area",
  "triangles and lines": "Lines, Angles, and Triangles",
  "line slope": "Finding Slope",
  "line intercept": "Finding Intercepts",
  "linear intercept": "Finding Linear Intercepts",
  "line graph": "Reading Line Graphs",
  "linear graph": "Interpreting Linear Graphs",
  "slope rate of change": "Slope and Rate of Change",
  "percent applied amount": "Finding Percent Amounts",
  "percent change": "Percent Change",
  "percentage calculation": "Percentage Problems",
  "proportional relationship": "Proportional Relationships",
  "rate problem": "Rate Problems",
  "ratio proportion": "Ratios and Proportions",
  "unit conversion": "Unit Conversion",
  "pythagorean theorem": "Pythagorean Theorem",
  "similar triangles": "Similar Triangles",
  "congruent triangles": "Congruent Triangles",
  "parallel line angles": "Parallel-Line Angles",
  "parallel perpendicular lines": "Parallel and Perpendicular Lines",
  "sine ratio": "Sine Ratio",
  "cosine ratio": "Cosine Ratio",
  "tangent ratio": "Tangent Ratio",
  "circle equation": "Circle Equations",
  "circle geometry": "Circle Geometry",
  "circumference": "Circumference",
  "area volume": "Area and Volume",
  "rectangle square area": "Rectangle and Square Area",
  "solid volume area": "Solid Volume and Surface Area",
  "prism volume area": "Prism Volume and Surface Area",
  "cylinder volume area": "Cylinder Volume and Surface Area",
  "conditional probability": "Conditional Probability",
  "counting probability": "Counting and Probability",
  "probability": "Probability",
  "distribution graph": "Distribution Graphs",
  "margin of error": "Margin of Error",
  "mean": "Mean and Average",
  "median": "Median",
  "one variable data": "One-Variable Data",
  "spread": "Range and Spread",
  "two variable data": "Two-Variable Data",
  "experiment design": "Experiment Design",
  "statistical claim": "Statistical Claims",
  "system of linear inequalities": "Systems of Linear Inequalities",
  "colon boundaries punctuation": "Colon Boundaries",
  "comma boundaries punctuation": "Comma Boundaries",
  "dash boundaries punctuation": "Dash Boundaries",
  "semicolon boundaries punctuation": "Semicolon Boundaries",
  "subject verb agreement": "Subject-Verb Agreement",
  "pronoun agreement": "Pronoun Agreement",
  "compare items": "Comparing Ideas",
  "describe or explain": "Describing and Explaining Ideas",
  "detail retrieval": "Finding Details",
  "draw inference": "Inferences",
  "emphasize difference": "Emphasizing Differences",
  "emphasize similarity": "Emphasizing Similarities",
  "function of part": "Function of a Text Part",
  "identify target detail": "Identifying Key Details",
  "inference": "Inferences",
  "introduce topic": "Introducing a Topic",
  "logical completion": "Logical Completion",
  "logical transition": "Logical Transitions",
  "main idea": "Central Ideas",
  "main purpose": "Main Purpose",
  "meaning in context": "Words in Context",
  "mixed practice": "Mixed Practice",
  "provide an example": "Providing Examples",
  "purpose and structure": "Text Structure and Purpose",
  "rhetorical uses-information-sentences-emphasize-how": "Emphasizing How",
  "rhetorical uses-information-sentences-emphasize-location": "Emphasizing Location",
  "rhetorical uses-information-sentences-emphasize-when": "Emphasizing Timing",
  "support a claim": "Supporting a Claim",
  "supporting evidence": "Supporting Evidence",
  "text structure": "Text Structure",
  "textual evidence": "Textual Evidence",
  "textual quotation evidence": "Textual Quotation Evidence",
  "textual support evidence": "Textual Support Evidence",
  "quantitative evidence": "Quantitative Evidence",
  "quantitative weakening evidence": "Weakening Evidence from Data",
  "finding evidence": "Evidence from Findings",
  "finding supporting evidence": "Supporting Evidence from Findings",
  "finding weakening evidence": "Weakening Evidence from Findings",
  "cross text relationship": "Cross-Text Connections",
};

const toTitleCase = (value: string) =>
  value
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const formatMethodTitle = (archetype: string, skill?: string, subject?: BankSubject) =>
  methodTitleOverrides[archetype] ?? (subject === "reading" && skill ? skill : toTitleCase(archetype));

const isGenericPracticeSetTitle = (title: string | undefined) =>
  !title || /^\d+\s+questions?\s+practice set$/i.test(title.trim());

const isGeneratedSimilarityLabelTitle = (title: string | undefined) =>
  Boolean(title && /:\s+[a-z][a-z0-9\s-]+\s+\d+$/i.test(title.trim()));

const isGeneratedColonTitle = (title: string | undefined) =>
  Boolean(title && title.includes(":"));

const shouldRegeneratePracticeSetTitle = (set: CustomPracticeSet) => {
  if (isGenericPracticeSetTitle(set.title)) return true;
  if (isGeneratedSimilarityLabelTitle(set.title)) return true;
  if (isGeneratedColonTitle(set.title)) return true;
  return set.title === `${set.skill} practice`;
};

const buildPracticeSetTitle = (
  questions: BankQuestion[],
  summary: Pick<CustomPracticeSet, "subject" | "domain" | "skill">,
  similarityGroupId?: string | null,
) => {
  if (summary.skill && !summary.skill.endsWith(" skills")) return summary.skill;
  if (summary.domain && !summary.domain.endsWith(" domains")) return summary.domain;
  if (summary.subject === "math") return "Math Practice";
  if (summary.subject === "reading") return "Reading & Writing Practice";
  return "Mixed SAT Practice";
};

export const getQuestionsForSimilarityGroup = async (groupId: string | null | undefined) => {
  if (!groupId) return [];
  const questionSimilarityGroupsById = await loadQuestionSimilarityGroupsById();
  const group = questionSimilarityGroupsById[groupId];
  if (!group) return [];
  const byStableId = await allBankQuestionsByStableId();
  return group.questionKeys
    .map((stableId) => byStableId.get(stableId))
    .filter((question): question is BankQuestion => Boolean(question));
};

const getUniqueQuestions = (questions: BankQuestion[]) => {
  const seen = new Set<string>();
  return questions
    .filter((item) => {
      if (seen.has(item.stableId)) return false;
      seen.add(item.stableId);
      return true;
    });
};

const getUniquePracticeSetQuestions = (questions: BankQuestion[]) =>
  getUniqueQuestions(questions).slice(0, MAX_CUSTOM_PRACTICE_SET_QUESTIONS);

export const getSimilarQuestionsForQuestion = async (question: BankQuestion) => {
  const similarQuestions = await getQuestionsForSimilarityGroup(question.similarityGroupId);
  const orderedQuestions = similarQuestions.some((item) => item.stableId === question.stableId)
    ? [
        question,
        ...similarQuestions.filter((item) => item.stableId !== question.stableId),
      ]
    : [question, ...similarQuestions];
  return getUniquePracticeSetQuestions(orderedQuestions);
};

const toCustomPracticeSetItems = (questions: BankQuestion[]): CustomPracticeSetItem[] =>
  questions.map((question, index) => ({
    subject: question.subject,
    id: question.id,
    sourceId: question.sourceId,
    bankType: question.bankType,
    storageId: question.stableId,
    index: index + 1,
  }));

const summarizeQuestions = (questions: BankQuestion[]) => {
  const subjects = new Set(questions.map((question) => question.subject));
  const domains = new Set(questions.map((question) => question.category.domain));
  const skills = new Set(questions.map((question) => question.category.skill));
  return {
    subject: subjects.size === 1 ? questions[0]?.subject ?? "math" : "mixed",
    domain: domains.size === 1 ? questions[0]?.category.domain ?? "Mixed" : `${domains.size} domains`,
    skill: skills.size === 1 ? questions[0]?.category.skill ?? "Mixed" : `${skills.size} skills`,
  } satisfies Pick<CustomPracticeSet, "subject" | "domain" | "skill">;
};

const refreshCustomPracticeSet = (
  set: CustomPracticeSet,
  byStableId: Map<string, BankQuestion>,
): CustomPracticeSet | null => {
  const originQuestion = byStableId.get(set.originQuestionStableId);
  const storedQuestions = set.items
    .map((item) => byStableId.get(item.storageId))
    .filter((question): question is BankQuestion => Boolean(question));
  const sourceType = set.sourceType ?? "related-question";
  const needsQuestionRefresh = set.questionCount !== set.items.length || !isValidPracticeSetSize(set.items.length, sourceType);
  const refreshedQuestions = storedQuestions;
  const practiceSetQuestions = sourceType === "bank-selection"
    ? getUniqueQuestions(refreshedQuestions)
    : getUniquePracticeSetQuestions(refreshedQuestions);
  if (!isValidPracticeSetSize(practiceSetQuestions.length, sourceType)) return null;
  const items = toCustomPracticeSetItems(practiceSetQuestions);
  const summary = summarizeQuestions(practiceSetQuestions);
  const nextSimilarityGroupId = originQuestion?.similarityGroupId ?? set.similarityGroupId;
  return {
    ...set,
    title: shouldRegeneratePracticeSetTitle(set)
      ? buildPracticeSetTitle(practiceSetQuestions, summary, nextSimilarityGroupId)
      : set.title,
    subject: summary.subject,
    domain: summary.domain,
    skill: summary.skill,
    similarityGroupId: nextSimilarityGroupId,
    originQuestionStableId: originQuestion?.stableId ?? set.originQuestionStableId,
    questionCount: items.length,
    items,
    sourceType,
  };
};

export const getCustomPracticeSets = (uid?: string | null): CustomPracticeSet[] => {
  const storedSets = readJson<CustomPracticeSet[]>(customPracticeSetsStorageKey(uid), []);
  const savedSets = storedSets.filter(isSavedCustomPracticeSet);
  const needsPrune = savedSets.length !== storedSets.length;
  if (needsPrune) saveCustomPracticeSets(savedSets, uid, { notify: false });
  return savedSets.sort((left, right) => right.updatedAt - left.updatedAt);
};

export const getCustomPracticeSet = (
  setId: string,
  uid?: string | null,
): CustomPracticeSet | null =>
  getCustomPracticeSets(uid).find((set) => set.id === setId) ?? null;

export const deleteCustomPracticeSet = (setId: string, uid?: string | null) => {
  saveCustomPracticeSets(getCustomPracticeSets(uid).filter((set) => set.id !== setId), uid);
};

export const createCustomPracticeSetFromQuestions = ({
  questions,
  title,
  id,
  similarityGroupId = null,
  originQuestionStableId,
  uid,
  maxQuestions = MAX_CUSTOM_PRACTICE_SET_QUESTIONS,
  sourceType = "related-question",
}: {
  questions: BankQuestion[];
  title?: string;
  id?: string;
  similarityGroupId?: string | null;
  originQuestionStableId?: string;
  uid?: string | null;
  maxQuestions?: number | null;
  sourceType?: CustomPracticeSet["sourceType"];
}): CustomPracticeSet => {
  const uniqueQuestions = maxQuestions === null
    ? getUniqueQuestions(questions)
    : getUniqueQuestions(questions).slice(0, maxQuestions);
  if (!isValidPracticeSetSize(uniqueQuestions.length, sourceType)) {
    throw new Error(
      sourceType === "bank-selection"
        ? "Practice sets require at least 5 questions."
        : "Practice sets require 5-20 questions.",
    );
  }
  const items = toCustomPracticeSetItems(uniqueQuestions);
  const summary = summarizeQuestions(uniqueQuestions);
  const setId = id ?? `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const existingSets = getCustomPracticeSets(uid);
  const existingSet = existingSets.find((set) => set.id === setId);
  const now = Date.now();
  const nextSet: CustomPracticeSet = {
    version: 1,
    id: setId,
    title: isGenericPracticeSetTitle(title)
      ? buildPracticeSetTitle(uniqueQuestions, summary, similarityGroupId)
      : title!,
    createdAt: existingSet?.createdAt ?? now,
    updatedAt: now,
    subject: summary.subject,
    domain: summary.domain,
    skill: summary.skill,
    similarityGroupId,
    originQuestionStableId: originQuestionStableId ?? uniqueQuestions[0]?.stableId ?? "",
    questionCount: items.length,
    items,
    sourceType,
  };
  saveCustomPracticeSets([
    nextSet,
    ...existingSets.filter((set) => set.id !== setId),
  ], uid);
  return nextSet;
};

export const createBankPracticeSessionFromQuestions = ({
  questions,
  title,
  id,
  similarityGroupId = null,
  originQuestionStableId,
}: {
  questions: BankQuestion[];
  title?: string;
  id?: string;
  similarityGroupId?: string | null;
  originQuestionStableId?: string;
}): CustomPracticeSet => {
  const uniqueQuestions = getUniqueQuestions(questions);
  if (!uniqueQuestions.length) {
    throw new Error("Practice sessions require at least 1 question.");
  }
  const items = toCustomPracticeSetItems(uniqueQuestions);
  const summary = summarizeQuestions(uniqueQuestions);
  const now = Date.now();
  return {
    version: 1,
    id: id ?? `bank-session-${now}-${Math.random().toString(36).slice(2, 8)}`,
    title: isGenericPracticeSetTitle(title)
      ? buildPracticeSetTitle(uniqueQuestions, summary, similarityGroupId)
      : title!,
    createdAt: now,
    updatedAt: now,
    subject: summary.subject,
    domain: summary.domain,
    skill: summary.skill,
    similarityGroupId,
    originQuestionStableId: originQuestionStableId ?? uniqueQuestions[0]?.stableId ?? "",
    questionCount: items.length,
    items,
  };
};

export const createCustomPracticeSetForQuestion = async (
  question: BankQuestion,
  uid?: string | null,
): Promise<CustomPracticeSet> =>
  createCustomPracticeSetFromQuestions({
    questions: await getSimilarQuestionsForQuestion(question),
    id: `similar-${question.stableId}`,
    similarityGroupId: question.similarityGroupId ?? null,
    originQuestionStableId: question.stableId,
    uid,
    sourceType: "related-question",
  });

export const subscribeToCustomPracticeSets = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CUSTOM_PRACTICE_SETS_EVENT, callback);
  return () => window.removeEventListener(CUSTOM_PRACTICE_SETS_EVENT, callback);
};

export const launchCustomPracticeSet = (
  set: CustomPracticeSet,
  navigate: NavigateFunction,
  exitTo = "/my-practice-sets",
  startIndex = 0,
) => {
  if (!set.items.length) return false;
  const targetIndex = Math.min(Math.max(startIndex, 0), set.items.length - 1);
  const target = set.items[targetIndex];
  sessionStorage.setItem("practiceExitTo", exitTo);
  sessionStorage.setItem("practiceSet", JSON.stringify(set.items));
  sessionStorage.setItem("practiceSetTotal", String(set.items.length));
  sessionStorage.setItem(PRACTICE_RUN_STORAGE_KEY, buildPracticeRunId(set.id));
  navigate(
    `/bank/${target.subject}/${target.sourceId}?bankType=${target.bankType}&practice=true&idx=${targetIndex + 1}&customPractice=${set.id}`,
  );
  return true;
};
