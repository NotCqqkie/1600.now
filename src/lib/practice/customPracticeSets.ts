import type { NavigateFunction } from "react-router-dom";
import {
  getAllBankQuestions,
  type BankQuestion,
  type BankSourceId,
  type BankSubject,
} from "@/data/questionBank";
import { questionSimilarityGroupsById } from "@/lib/generated/questionSimilarity.generated";

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
}

const CUSTOM_PRACTICE_SETS_KEY = "custom-practice-sets:v1";
const MIN_CUSTOM_PRACTICE_SET_QUESTIONS = 5;
const MAX_CUSTOM_PRACTICE_SET_QUESTIONS = 20;

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

const saveCustomPracticeSets = (sets: CustomPracticeSet[]) => {
  writeJson(CUSTOM_PRACTICE_SETS_KEY, sets);
};

const allBankQuestionsByStableId = () => {
  const questions = [
    ...getAllBankQuestions("math", "all"),
    ...getAllBankQuestions("reading", "all"),
  ];
  return new Map(questions.map((question) => [question.stableId, question]));
};

const isPracticeSetSize = (count: number) =>
  count >= MIN_CUSTOM_PRACTICE_SET_QUESTIONS && count <= MAX_CUSTOM_PRACTICE_SET_QUESTIONS;

const methodTitleOverrides: Record<string, string> = {
  "linear equation solve": "Solving Linear Equations",
  "solve linear system": "Solving Linear Systems",
  "linear systems": "Solving Linear Systems",
  "solution count linear equation": "Linear Equation Solution Counts",
  "system solution count": "System Solution Counts",
  "rewrite equivalent expression": "Rewriting Equivalent Expressions",
  "linear equation two variables": "Two-Variable Linear Equations",
  "linear function model": "Linear Function Modeling",
  "scatterplot model": "Scatterplot Modeling",
  "nonlinear equation": "Solving Nonlinear Equations",
  "nonlinear equation roots": "Finding Nonlinear Roots",
  "nonlinear system": "Solving Nonlinear Systems",
  "quadratic vertex": "Finding Quadratic Vertices",
  "triangle angle chasing": "Triangle Angle Chasing",
  "line slope": "Finding Slope",
  "line intercept": "Finding Intercepts",
  "linear intercept": "Finding Linear Intercepts",
  "line graph": "Reading Line Graphs",
  "linear graph": "Interpreting Linear Graphs",
  "slope rate of change": "Slope and Rate of Change",
  "percent applied amount": "Finding Percent Amounts",
  "percent change": "Percent Change",
  "ratio proportion": "Ratios and Proportions",
  "unit conversion": "Unit Conversion",
  "pythagorean theorem": "Pythagorean Theorem",
  "similar triangles": "Similar Triangles",
  "congruent triangles": "Congruent Triangles",
  "parallel line angles": "Parallel-Line Angles",
  "parallel perpendicular lines": "Parallel and Perpendicular Lines",
  "circle equation": "Circle Equations",
  "circle geometry": "Circle Geometry",
  "area volume": "Area and Volume",
  "solid volume area": "Solid Volume and Surface Area",
  "prism volume area": "Prism Volume and Surface Area",
  "cylinder volume area": "Cylinder Volume and Surface Area",
  "colon boundaries punctuation": "Colon Boundaries",
  "comma boundaries punctuation": "Comma Boundaries",
  "dash boundaries punctuation": "Dash Boundaries",
  "semicolon boundaries punctuation": "Semicolon Boundaries",
  "subject verb agreement": "Subject-Verb Agreement",
  "pronoun agreement": "Pronoun Agreement",
  "logical completion": "Logical Completion",
  "logical transition": "Logical Transitions",
  "meaning in context": "Words in Context",
  "textual quotation evidence": "Textual Quotation Evidence",
  "quantitative evidence": "Quantitative Evidence",
  "cross text relationship": "Cross-Text Connections",
};

const toTitleCase = (value: string) =>
  value
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const formatMethodTitle = (archetype: string) =>
  methodTitleOverrides[archetype] ?? toTitleCase(archetype);

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
  const group = set.similarityGroupId ? questionSimilarityGroupsById[set.similarityGroupId] : null;
  return Boolean(group && set.title === group.label) || set.title === `${set.skill} practice`;
};

const buildPracticeSetTitle = (
  questions: BankQuestion[],
  summary: Pick<CustomPracticeSet, "subject" | "domain" | "skill">,
  similarityGroupId?: string | null,
) => {
  const groupIds = new Set(questions.map((question) => question.similarityGroupId).filter(Boolean));
  const groupId = similarityGroupId || (groupIds.size === 1 ? [...groupIds][0] : null);
  const group = groupId ? questionSimilarityGroupsById[groupId] : null;
  if (group?.archetype && group.archetype !== "mixed practice") {
    return formatMethodTitle(group.archetype);
  }
  if (group?.skill) return group.skill;
  if (summary.skill && !summary.skill.endsWith(" skills")) return summary.skill;
  if (summary.domain && !summary.domain.endsWith(" domains")) return summary.domain;
  if (summary.subject === "math") return "Math Practice";
  if (summary.subject === "reading") return "Reading & Writing Practice";
  return "Mixed SAT Practice";
};

export const getQuestionsForSimilarityGroup = (groupId: string | null | undefined) => {
  if (!groupId) return [];
  const group = questionSimilarityGroupsById[groupId];
  if (!group) return [];
  const byStableId = allBankQuestionsByStableId();
  return group.questionKeys
    .map((stableId) => byStableId.get(stableId))
    .filter((question): question is BankQuestion => Boolean(question));
};

const getUniquePracticeSetQuestions = (questions: BankQuestion[]) => {
  const seen = new Set<string>();
  return questions
    .filter((item) => {
      if (seen.has(item.stableId)) return false;
      seen.add(item.stableId);
      return true;
    })
    .slice(0, MAX_CUSTOM_PRACTICE_SET_QUESTIONS);
};

export const getSimilarQuestionsForQuestion = (question: BankQuestion) => {
  const similarQuestions = getQuestionsForSimilarityGroup(question.similarityGroupId);
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
  const needsQuestionRefresh = set.questionCount !== set.items.length || !isPracticeSetSize(set.items.length);
  const refreshedQuestions = needsQuestionRefresh && originQuestion
    ? getSimilarQuestionsForQuestion(originQuestion)
    : needsQuestionRefresh
      ? getQuestionsForSimilarityGroup(set.similarityGroupId)
      : storedQuestions;
  const practiceSetQuestions = getUniquePracticeSetQuestions(refreshedQuestions);
  if (!isPracticeSetSize(practiceSetQuestions.length)) return null;
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
  };
};

export const getCustomPracticeSets = (): CustomPracticeSet[] => {
  const storedSets = readJson<CustomPracticeSet[]>(CUSTOM_PRACTICE_SETS_KEY, []);
  const needsRefresh = storedSets.some(
    (set) =>
      set.questionCount !== set.items.length ||
      !isPracticeSetSize(set.items.length) ||
      shouldRegeneratePracticeSetTitle(set),
  );
  const byStableId = needsRefresh ? allBankQuestionsByStableId() : null;
  const sets = needsRefresh
    ? storedSets
        .map((set) => refreshCustomPracticeSet(set, byStableId!))
        .filter((set): set is CustomPracticeSet => Boolean(set))
    : storedSets;
  if (needsRefresh) saveCustomPracticeSets(sets);
  return sets.sort((left, right) => right.updatedAt - left.updatedAt);
};

export const getCustomPracticeSet = (setId: string): CustomPracticeSet | null =>
  getCustomPracticeSets().find((set) => set.id === setId) ?? null;

export const deleteCustomPracticeSet = (setId: string) => {
  saveCustomPracticeSets(getCustomPracticeSets().filter((set) => set.id !== setId));
};

export const createCustomPracticeSetFromQuestions = ({
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
  const uniqueQuestions = getUniquePracticeSetQuestions(questions);
  if (!isPracticeSetSize(uniqueQuestions.length)) {
    throw new Error("Practice sets require 5-20 questions.");
  }
  const items = toCustomPracticeSetItems(uniqueQuestions);
  const summary = summarizeQuestions(uniqueQuestions);
  const setId = id ?? `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const existingSets = getCustomPracticeSets();
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
  };
  saveCustomPracticeSets([
    nextSet,
    ...existingSets.filter((set) => set.id !== setId),
  ]);
  return nextSet;
};

export const createCustomPracticeSetForQuestion = (question: BankQuestion): CustomPracticeSet =>
  createCustomPracticeSetFromQuestions({
    questions: getSimilarQuestionsForQuestion(question),
    id: `similar-${question.stableId}`,
    similarityGroupId: question.similarityGroupId ?? null,
    originQuestionStableId: question.stableId,
  });

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
  navigate(
    `/bank/${target.subject}/${target.sourceId}?bankType=${target.bankType}&practice=true&idx=${targetIndex + 1}&customPractice=${set.id}`,
  );
  return true;
};
