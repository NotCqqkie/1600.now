import type { NavigateFunction } from "react-router-dom";
import type { BankSourceId, BankSubject } from "@/data/bankTypes";
import type { BankQuestion } from "@/data/questionBank";
import {
  buildPracticeRunId,
  PRACTICE_RUN_STORAGE_KEY,
  PRACTICE_SET_TOTAL_STORAGE_KEY,
  writePracticeLaunchStorage,
} from "@/lib/practice/practiceRunStorage";
import { buildCustomPracticeQuestionRoute } from "@/lib/practice/practiceBankRoutes";

type QuestionSimilarityGroupRecord = {
  questionKeys: string[];
};

let questionSimilarityGroupsByIdPromise: Promise<Record<string, QuestionSimilarityGroupRecord>> | null = null;
let allBankQuestionsByStableIdPromise: Promise<Map<string, BankQuestion>> | null = null;

const loadQuestionSimilarityGroupsById = () => {
  questionSimilarityGroupsByIdPromise ??= import("@/lib/generated/questionSimilarity.generated").then(
    (mod) => mod.questionSimilarityGroupsById as Record<string, QuestionSimilarityGroupRecord>,
  );
  return questionSimilarityGroupsByIdPromise;
};

interface CustomPracticeSetItem {
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
const ANON_SUFFIX = "anon";
const MIN_CUSTOM_PRACTICE_SET_QUESTIONS = 5;
const MAX_CUSTOM_PRACTICE_SET_QUESTIONS = 20;
const CUSTOM_PRACTICE_SETS_EVENT = "app-custom-practice-sets-change";

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

export const saveCustomPracticeSets = (
  sets: CustomPracticeSet[],
  uid?: string | null,
  options: { notify?: boolean } = {},
): void => {
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

const migrateLegacyCustomPracticeSets = (uid?: string | null) => {
  const storage = getStorage();
  if (!storage) return;
  const legacy = readJson<CustomPracticeSet[]>(LEGACY_CUSTOM_PRACTICE_SETS_KEY, []);
  if (legacy.length === 0) return;
  const scoped = readJson<CustomPracticeSet[]>(customPracticeSetsStorageKey(uid), []);
  saveCustomPracticeSets(mergeCustomPracticeSets(scoped, legacy), uid, { notify: false });
  storage.removeItem(LEGACY_CUSTOM_PRACTICE_SETS_KEY);
};

if (typeof window !== "undefined") migrateLegacyCustomPracticeSets(null);

const allBankQuestionsByStableId = () => {
  allBankQuestionsByStableIdPromise ??= import("@/data/questionBank")
    .then(({ loadAllBankQuestions }) =>
      Promise.all([
        loadAllBankQuestions("math", "all", { includeSimilarity: true }),
        loadAllBankQuestions("reading", "all", { includeSimilarity: true }),
      ]),
    )
    .then(([mathQuestions, readingQuestions]) =>
      new Map(
        [...mathQuestions, ...readingQuestions].map((question) => [question.stableId, question]),
      ),
    );
  return allBankQuestionsByStableIdPromise;
};

const isValidPracticeSetSize = (count: number, sourceType?: CustomPracticeSet["sourceType"]) =>
  count >= MIN_CUSTOM_PRACTICE_SET_QUESTIONS &&
  (sourceType === "bank-selection" || count <= MAX_CUSTOM_PRACTICE_SET_QUESTIONS);

const isPersistentPracticeSet = (set: CustomPracticeSet) =>
  set.sourceType === "related-question" || (!set.sourceType && set.id.startsWith("similar-"));

const isGenericPracticeSetTitle = (title: string | undefined) =>
  !title || /^\d+\s+questions?\s+practice set$/i.test(title.trim());

const buildPracticeSetTitle = (
  summary: Pick<CustomPracticeSet, "subject" | "domain" | "skill">,
) => {
  if (summary.skill && !summary.skill.endsWith(" skills")) return summary.skill;
  if (summary.domain && !summary.domain.endsWith(" domains")) return summary.domain;
  if (summary.subject === "math") return "Math Practice";
  if (summary.subject === "reading") return "Reading & Writing Practice";
  return "Mixed SAT Practice";
};

const getQuestionsForSimilarityGroup = async (groupId: string | null | undefined) => {
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

const getSimilarQuestionsForQuestion = async (question: BankQuestion) => {
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

const buildCustomPracticeSet = ({
  uniqueQuestions,
  title,
  id,
  similarityGroupId,
  originQuestionStableId,
  sourceType,
  createdAt,
  now,
}: {
  uniqueQuestions: BankQuestion[];
  title?: string;
  id: string;
  similarityGroupId: string | null;
  originQuestionStableId?: string;
  sourceType?: CustomPracticeSet["sourceType"];
  createdAt: number;
  now: number;
}): CustomPracticeSet => {
  const items = toCustomPracticeSetItems(uniqueQuestions);
  const summary = summarizeQuestions(uniqueQuestions);
  return {
    version: 1,
    id,
    title: isGenericPracticeSetTitle(title)
      ? buildPracticeSetTitle(summary)
      : title!,
    createdAt,
    updatedAt: now,
    subject: summary.subject,
    domain: summary.domain,
    skill: summary.skill,
    similarityGroupId,
    originQuestionStableId: originQuestionStableId ?? uniqueQuestions[0]?.stableId ?? "",
    questionCount: items.length,
    items,
    ...(sourceType ? { sourceType } : {}),
  };
};

export const getCustomPracticeSets = (uid?: string | null): CustomPracticeSet[] => {
  const storedSets = readJson<CustomPracticeSet[]>(customPracticeSetsStorageKey(uid), []);
  const savedSets = storedSets.filter(isPersistentPracticeSet);
  const needsPrune = savedSets.length !== storedSets.length;
  if (needsPrune) saveCustomPracticeSets(savedSets, uid, { notify: false });
  return savedSets.sort((left, right) => right.updatedAt - left.updatedAt);
};

export const deleteCustomPracticeSet = (setId: string, uid?: string | null): void => {
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
  const setId = id ?? `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const existingSets = getCustomPracticeSets(uid);
  const existingSet = existingSets.find((set) => set.id === setId);
  const now = Date.now();
  const nextSet = buildCustomPracticeSet({
    uniqueQuestions,
    title,
    id: setId,
    similarityGroupId,
    originQuestionStableId,
    sourceType,
    createdAt: existingSet?.createdAt ?? now,
    now,
  });
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
  const now = Date.now();
  return buildCustomPracticeSet({
    uniqueQuestions,
    title,
    id: id ?? `bank-session-${now}-${Math.random().toString(36).slice(2, 8)}`,
    similarityGroupId,
    originQuestionStableId,
    createdAt: now,
    now,
  });
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

export const subscribeToCustomPracticeSets = (callback: () => void): (() => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CUSTOM_PRACTICE_SETS_EVENT, callback);
  return () => window.removeEventListener(CUSTOM_PRACTICE_SETS_EVENT, callback);
};

export const launchCustomPracticeSet = (
  set: CustomPracticeSet,
  navigate: NavigateFunction,
  exitTo = "/my-practice-sets",
  startIndex = 0,
): boolean => {
  if (!set.items.length) return false;
  const targetIndex = Math.min(Math.max(startIndex, 0), set.items.length - 1);
  const target = set.items[targetIndex];
  writePracticeLaunchStorage(set.items, exitTo);
  sessionStorage.setItem(PRACTICE_SET_TOTAL_STORAGE_KEY, String(set.items.length));
  sessionStorage.setItem(PRACTICE_RUN_STORAGE_KEY, buildPracticeRunId(set.id));
  navigate(buildCustomPracticeQuestionRoute({
    subject: target.subject,
    sourceId: target.sourceId,
    bankType: target.bankType,
    idx: targetIndex + 1,
    setId: set.id,
  }));
  return true;
};
