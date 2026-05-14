import type { PracticeModule } from "@/data/modulePracticeBank";
import type { BankQuestion } from "@/data/questionBank";
import { answersEquivalent } from "@/lib/text/answerEquivalence";

export type ModulePracticeQuestionStatus =
  | "unanswered"
  | "answered"
  | "incorrect"
  | "correct-first"
  | "correct-later";

export interface ModulePracticeSettings {
  timed: boolean;
  timeLimitSeconds: number | null;
  allowCheckingAnswers: boolean;
}

export interface ModulePracticeSessionMeta {
  version: 1;
  sessionId: string;
  moduleSlug: string;
  moduleTitle: string;
  moduleSubtitle: string;
  subject: "math" | "reading";
  questionCount: number;
  currentIndex: number;
  startedAt: number;
  status: "active" | "paused" | "submitted";
  settings: ModulePracticeSettings;
  elapsedSeconds: number;
  remainingSeconds: number | null;
}

export interface ModulePracticeQuestionState {
  answer: string;
  freeResponseAnswer: string;
  checkedAnswers: Record<string, boolean>;
  attemptCount: number;
  status: ModulePracticeQuestionStatus;
  struckOutChoiceIds: string[];
  isMarkedForReview: boolean;
  timeSpentSeconds: number;
}

export interface ModulePracticeQuestionResult {
  questionNumber: number;
  storageId: string;
  prompt: string;
  userAnswer: string;
  correctAnswer: string;
  isAnswered: boolean;
  isCorrect: boolean;
  status: ModulePracticeQuestionStatus;
  isMarkedForReview: boolean;
  timeSpentSeconds: number;
  domain: string;
  skill: string;
}

export interface ModulePracticeSkillResult {
  skill: string;
  domain: string;
  attempted: number;
  correct: number;
  accuracy: number;
  totalTimeSeconds: number;
  averageTimeSeconds: number;
}

export interface ModulePracticeResult {
  version: 1;
  sessionId: string;
  moduleSlug: string;
  moduleTitle: string;
  moduleSubtitle: string;
  subject: "math" | "reading";
  questionCount: number;
  submittedAt: number;
  elapsedSeconds: number;
  timeLimitSeconds: number | null;
  allowCheckingAnswers: boolean;
  answeredCount: number;
  unansweredCount: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  counts: {
    correct: number;
    incorrect: number;
    correctAfterReview: number;
  };
  questions: ModulePracticeQuestionResult[];
  skills: ModulePracticeSkillResult[];
  longestQuestion: ModulePracticeQuestionResult | null;
  shortestQuestion: ModulePracticeQuestionResult | null;
}

const ACTIVE_SESSION_PREFIX = "module-practice:session:";
const SESSION_STATE_PREFIX = "module-practice:state:";
const SESSION_NOTE_PREFIX = "module-practice:note:";
const SESSION_ANNOTATION_PREFIX = "module-practice:annotation:";
const RESULT_PREFIX = "module-practice:result:";
const LATEST_RESULT_PREFIX = "module-practice:latest-result:";

const readJson = <T>(storage: Storage, key: string): T | null => {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeJson = (storage: Storage, key: string, value: unknown) => {
  storage.setItem(key, JSON.stringify(value));
};

const getSessionKey = (moduleSlug: string) => `${ACTIVE_SESSION_PREFIX}${moduleSlug}`;

export const getModulePracticeSessionStateKey = (sessionId: string, storageId: string) =>
  `${SESSION_STATE_PREFIX}${sessionId}:${storageId}`;

export const getModulePracticeNoteStorageKey = (sessionId: string, storageId: string) =>
  `${SESSION_NOTE_PREFIX}${sessionId}:${storageId}`;

export const getModulePracticeAnnotationStorageKey = (sessionId: string, storageId: string) =>
  `${SESSION_ANNOTATION_PREFIX}${sessionId}:${storageId}`;

export const getModulePracticeDefaultTimeMinutes = (subject: "math" | "reading") =>
  subject === "reading" ? 32 : 35;

export const getModulePracticeMaximumTimeMinutes = (subject: "math" | "reading") =>
  getModulePracticeDefaultTimeMinutes(subject) * 2;

const buildSessionId = (moduleSlug: string) =>
  `${moduleSlug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const createModulePracticeSession = (
  module: PracticeModule,
  settings: ModulePracticeSettings,
): ModulePracticeSessionMeta => {
  const session: ModulePracticeSessionMeta = {
    version: 1,
    sessionId: buildSessionId(module.slug),
    moduleSlug: module.slug,
    moduleTitle: module.publicTitle,
    moduleSubtitle: module.publicSubtitle,
    subject: module.subject,
    questionCount: module.questionCount,
    currentIndex: 0,
    startedAt: Date.now(),
    status: "active",
    settings,
    elapsedSeconds: 0,
    remainingSeconds: settings.timed ? settings.timeLimitSeconds : null,
  };

  writeJson(sessionStorage, getSessionKey(module.slug), session);
  return session;
};

export const getModulePracticeSession = (
  moduleSlug: string,
): ModulePracticeSessionMeta | null => readJson<ModulePracticeSessionMeta>(sessionStorage, getSessionKey(moduleSlug));

export const saveModulePracticeSession = (session: ModulePracticeSessionMeta) => {
  writeJson(sessionStorage, getSessionKey(session.moduleSlug), session);
};

export const clearModulePracticeSessionArtifacts = (sessionId: string) => {
  const keysToRemove: string[] = [];

  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index);
    if (!key) continue;
    if (
      key.startsWith(`${SESSION_STATE_PREFIX}${sessionId}:`) ||
      key.startsWith(`${SESSION_NOTE_PREFIX}${sessionId}:`) ||
      key.startsWith(`${SESSION_ANNOTATION_PREFIX}${sessionId}:`)
    ) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => sessionStorage.removeItem(key));
};

export const clearModulePracticeSession = (moduleSlug: string) => {
  const existing = getModulePracticeSession(moduleSlug);
  if (existing) {
    clearModulePracticeSessionArtifacts(existing.sessionId);
  }
  sessionStorage.removeItem(getSessionKey(moduleSlug));
};

export const getModulePracticeQuestionState = (
  sessionId: string,
  storageId: string,
): ModulePracticeQuestionState => {
  const stored = readJson<ModulePracticeQuestionState>(
    sessionStorage,
    getModulePracticeSessionStateKey(sessionId, storageId),
  );

  return (
    stored ?? {
      answer: "",
      freeResponseAnswer: "",
      checkedAnswers: {},
      attemptCount: 0,
      status: "unanswered",
      struckOutChoiceIds: [],
      isMarkedForReview: false,
      timeSpentSeconds: 0,
    }
  );
};

export const saveModulePracticeQuestionState = (
  sessionId: string,
  storageId: string,
  state: ModulePracticeQuestionState,
) => {
  writeJson(
    sessionStorage,
    getModulePracticeSessionStateKey(sessionId, storageId),
    state,
  );
};

const getQuestionPrompt = (question: BankQuestion) =>
  question.questionText?.trim() || question.prompt?.trim() || question.passage?.trim() || `Question ${question.id}`;

const resolveQuestionStatus = (
  questionState: ModulePracticeQuestionState,
  question: BankQuestion,
  allowCheckingAnswers: boolean,
): ModulePracticeQuestionStatus => {
  const answer =
    question.type === "free-response"
      ? questionState.freeResponseAnswer
      : questionState.answer;
  const isAnswered = Boolean(answer);

  if (!isAnswered) return "unanswered";

  if (allowCheckingAnswers) {
    if (
      questionState.status === "correct-first" ||
      questionState.status === "correct-later" ||
      questionState.status === "incorrect"
    ) {
      return questionState.status;
    }

    const isCorrect = answersEquivalent(answer, question.correctAnswer);
    if (isCorrect) {
      return questionState.attemptCount > 1 ? "correct-later" : "correct-first";
    }

    return "incorrect";
  }

  return "answered";
};

export const buildModulePracticeResult = (
  module: PracticeModule,
  session: ModulePracticeSessionMeta,
): ModulePracticeResult => {
  const questions: ModulePracticeQuestionResult[] = module.questions.map((entry) => {
    const question = entry.bankQuestion;
    const state = getModulePracticeQuestionState(session.sessionId, question.stableId);
    const userAnswer =
      question.type === "free-response" ? state.freeResponseAnswer : state.answer;
    const isAnswered = Boolean(userAnswer);
    const isCorrect = isAnswered && answersEquivalent(userAnswer, question.correctAnswer);
    const status = resolveQuestionStatus(state, question, session.settings.allowCheckingAnswers);

    return {
      questionNumber: entry.slot,
      storageId: question.stableId,
      prompt: getQuestionPrompt(question),
      userAnswer,
      correctAnswer: question.correctAnswer ?? "",
      isAnswered,
      isCorrect,
      status,
      isMarkedForReview: state.isMarkedForReview,
      timeSpentSeconds: state.timeSpentSeconds,
      domain: question.category.domain,
      skill: question.category.skill,
    };
  });

  const answeredCount = questions.filter((question) => question.isAnswered).length;
  const correctCount = questions.filter((question) => question.isCorrect).length;
  const incorrectCount = answeredCount - correctCount;
  const unansweredCount = questions.length - answeredCount;
  const counts = questions.reduce(
    (acc, question) => {
      if (question.status === "correct-first") acc.correct += 1;
      if (question.status === "correct-later") acc.correctAfterReview += 1;
      if (question.status === "incorrect") acc.incorrect += 1;
      return acc;
    },
    { correct: 0, incorrect: 0, correctAfterReview: 0 },
  );

  const skillMap = new Map<string, ModulePracticeSkillResult>();
  questions.forEach((question) => {
    if (!question.isAnswered) return;
    const key = `${question.domain}:::${question.skill}`;
    const current = skillMap.get(key) ?? {
      skill: question.skill,
      domain: question.domain,
      attempted: 0,
      correct: 0,
      accuracy: 0,
      totalTimeSeconds: 0,
      averageTimeSeconds: 0,
    };
    current.attempted += 1;
    current.totalTimeSeconds += question.timeSpentSeconds;
    if (question.isCorrect) current.correct += 1;
    skillMap.set(key, current);
  });

  const skills = [...skillMap.values()]
    .map((skill) => ({
      ...skill,
      accuracy: skill.attempted ? Math.round((skill.correct / skill.attempted) * 100) : 0,
      averageTimeSeconds: skill.attempted
        ? Math.round(skill.totalTimeSeconds / skill.attempted)
        : 0,
    }))
    .sort((left, right) => right.attempted - left.attempted || left.skill.localeCompare(right.skill));

  const timedQuestions = questions.filter((question) => question.timeSpentSeconds > 0);
  const longestQuestion = timedQuestions.length
    ? timedQuestions.reduce((best, question) =>
        question.timeSpentSeconds > best.timeSpentSeconds ? question : best,
      )
    : null;
  const shortestQuestion = timedQuestions.length
    ? timedQuestions.reduce((best, question) =>
        question.timeSpentSeconds < best.timeSpentSeconds ? question : best,
      )
    : null;

  return {
    version: 1,
    sessionId: session.sessionId,
    moduleSlug: module.slug,
    moduleTitle: session.moduleTitle,
    moduleSubtitle: session.moduleSubtitle,
    subject: module.subject,
    questionCount: module.questionCount,
    submittedAt: Date.now(),
    elapsedSeconds: session.elapsedSeconds,
    timeLimitSeconds: session.settings.timeLimitSeconds,
    allowCheckingAnswers: session.settings.allowCheckingAnswers,
    answeredCount,
    unansweredCount,
    correctCount,
    incorrectCount,
    accuracy: questions.length ? Math.round((correctCount / questions.length) * 100) : 0,
    counts,
    questions,
    skills,
    longestQuestion,
    shortestQuestion,
  };
};

export const saveModulePracticeResult = (result: ModulePracticeResult) => {
  writeJson(localStorage, `${RESULT_PREFIX}${result.sessionId}`, result);
  localStorage.setItem(`${LATEST_RESULT_PREFIX}${result.moduleSlug}`, result.sessionId);
};

export const getModulePracticeResult = (sessionId: string): ModulePracticeResult | null =>
  readJson<ModulePracticeResult>(localStorage, `${RESULT_PREFIX}${sessionId}`);

export const getLatestModulePracticeResult = (
  moduleSlug: string,
): ModulePracticeResult | null => {
  const sessionId = localStorage.getItem(`${LATEST_RESULT_PREFIX}${moduleSlug}`);
  if (!sessionId) return null;
  return getModulePracticeResult(sessionId);
};

