import type { PracticeSet } from "@/data/modulePracticeBank";
import { answersEquivalent } from "@/lib/text/answerEquivalence";
import type { ModulePracticeQuestionState } from "@/lib/practice/modulePracticeSession";
import { calculatePracticeTestScores } from "@/lib/practice/practiceTestScoring";

export interface PracticeTestModuleSession {
  moduleSlug: string;
  moduleTitle: string;
  subject: "reading" | "math";
  moduleNumber: 1 | 2;
  questionCount: number;
  startIndex: number;
  endIndex: number;
  timeLimitSeconds: number | null;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  status: "pending" | "active" | "completed";
}

export interface PracticeTestSettings {
  timed: boolean;
  allowCheckingAnswers: boolean;
  moduleTimeLimitSeconds: Record<string, number | null>;
}

export interface PracticeTestSessionMeta {
  version: 1;
  sessionId: string;
  practiceSetId: string;
  practiceSetNumber: number;
  currentIndex: number;
  activeModuleIndex: number;
  startedAt: number;
  status: "active" | "paused" | "submitted";
  phase: "module" | "review";
  settings: PracticeTestSettings;
  modules: PracticeTestModuleSession[];
  breakStatus: "pending" | "active" | "completed" | "skipped";
  breakElapsedSeconds: number;
  breakRemainingSeconds: number;
}

export interface PracticeTestQuestionResult {
  globalQuestionNumber: number;
  moduleQuestionNumber: number;
  moduleSlug: string;
  moduleTitle: string;
  subject: "reading" | "math";
  storageId: string;
  prompt: string;
  userAnswer: string;
  correctAnswer: string;
  isAnswered: boolean;
  isCorrect: boolean;
  isMarkedForReview: boolean;
  timeSpentSeconds: number;
  domain: string;
  skill: string;
  difficulty?: "Easy" | "Medium" | "Hard" | null;
}

export interface PracticeTestModuleResult {
  moduleSlug: string;
  moduleTitle: string;
  subject: "reading" | "math";
  moduleNumber: 1 | 2;
  questionCount: number;
  answeredCount: number;
  unansweredCount: number;
  correctCount: number;
  incorrectCount: number;
  rawScore: number;
  scaledScore: number;
  accuracy: number;
  elapsedSeconds: number;
  timeLimitSeconds: number | null;
  questions: PracticeTestQuestionResult[];
}

export interface PracticeTestResult {
  version: 1;
  sessionId: string;
  practiceSetId: string;
  practiceSetNumber: number;
  submittedAt: number;
  elapsedSeconds: number;
  breakElapsedSeconds: number;
  skippedBreak: boolean;
  readingWritingScore: number;
  mathScore: number;
  totalScore: number;
  answeredCount: number;
  unansweredCount: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  modules: PracticeTestModuleResult[];
  questions: PracticeTestQuestionResult[];
}

const ACTIVE_SESSION_PREFIX = "practice-test:session:";
const QUESTION_STATE_PREFIX = "practice-test:state:";
const NOTE_PREFIX = "practice-test:note:";
const ANNOTATION_PREFIX = "practice-test:annotation:";
const RESULT_PREFIX = "practice-test:result:";
const LATEST_RESULT_PREFIX = "practice-test:latest-result:";

const BREAK_TIME_SECONDS = 10 * 60;
const MODULE_TIME_LIMITS: Record<`${"reading" | "math"}-${1 | 2}`, number> = {
  "reading-1": 32 * 60,
  "reading-2": 32 * 60,
  "math-1": 35 * 60,
  "math-2": 35 * 60,
};

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

const buildSessionId = (practiceSetId: string) =>
  `${practiceSetId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getSessionKey = (practiceSetId: string) => `${ACTIVE_SESSION_PREFIX}${practiceSetId}`;

const getQuestionPrompt = (question: {
  questionText?: string | null;
  prompt?: string | null;
  passage?: string | null;
  id: number;
}) =>
  question.questionText?.trim() || question.prompt?.trim() || question.passage?.trim() || `Question ${question.id}`;

export const getPracticeTestQuestionStateKey = (sessionId: string, storageId: string) =>
  `${QUESTION_STATE_PREFIX}${sessionId}:${storageId}`;

export const getPracticeTestNoteStorageKey = (sessionId: string, storageId: string) =>
  `${NOTE_PREFIX}${sessionId}:${storageId}`;

export const getPracticeTestAnnotationStorageKey = (sessionId: string, storageId: string) =>
  `${ANNOTATION_PREFIX}${sessionId}:${storageId}`;

export const getPracticeTestBreakTimeSeconds = () => BREAK_TIME_SECONDS;

export const getPracticeTestDefaultTimeLimitSeconds = (
  subject: "reading" | "math",
  moduleNumber: 1 | 2,
) => MODULE_TIME_LIMITS[`${subject}-${moduleNumber}`];

export const buildPracticeTestDefaultTiming = (practiceSet: PracticeSet) =>
  Object.fromEntries(
    practiceSet.modules.map((module) => [
      module.slug,
      getPracticeTestDefaultTimeLimitSeconds(module.subject, module.moduleNumber),
    ]),
  ) as Record<string, number>;

export const createPracticeTestSession = (
  practiceSet: PracticeSet,
  settings: PracticeTestSettings,
): PracticeTestSessionMeta => {
  let runningIndex = 0;

  const modules: PracticeTestModuleSession[] = practiceSet.modules.map((module, index) => {
    const questionCount = module.questions.length;
    const startIndex = runningIndex;
    const endIndex = runningIndex + questionCount - 1;
    runningIndex += questionCount;

    const timeLimitSeconds = settings.timed
      ? settings.moduleTimeLimitSeconds[module.slug] ?? getPracticeTestDefaultTimeLimitSeconds(module.subject, module.moduleNumber)
      : null;

    return {
      moduleSlug: module.slug,
      moduleTitle: module.publicTitle,
      subject: module.subject,
      moduleNumber: module.moduleNumber,
      questionCount,
      startIndex,
      endIndex,
      timeLimitSeconds,
      elapsedSeconds: 0,
      remainingSeconds: timeLimitSeconds,
      status: index === 0 ? "active" : "pending",
    };
  });

  const session: PracticeTestSessionMeta = {
    version: 1,
    sessionId: buildSessionId(practiceSet.id),
    practiceSetId: practiceSet.id,
    practiceSetNumber: practiceSet.setNumber,
    currentIndex: 0,
    activeModuleIndex: 0,
    startedAt: Date.now(),
    status: "active",
    phase: "module",
    settings,
    modules,
    breakStatus: "pending",
    breakElapsedSeconds: 0,
    breakRemainingSeconds: BREAK_TIME_SECONDS,
  };

  writeJson(sessionStorage, getSessionKey(practiceSet.id), session);
  return session;
};

export const getPracticeTestSession = (
  practiceSetId: string,
): PracticeTestSessionMeta | null => readJson<PracticeTestSessionMeta>(sessionStorage, getSessionKey(practiceSetId));

export const savePracticeTestSession = (session: PracticeTestSessionMeta) => {
  writeJson(sessionStorage, getSessionKey(session.practiceSetId), session);
};

export const tickPracticeTestActiveModule = (
  session: PracticeTestSessionMeta,
): PracticeTestSessionMeta => {
  const activeModule = session.modules[session.activeModuleIndex];
  if (!activeModule) return session;
  if (session.settings.timed && activeModule.remainingSeconds === 0) return session;

  const nextActiveModule = {
    ...activeModule,
    elapsedSeconds: activeModule.elapsedSeconds + 1,
    remainingSeconds:
      session.settings.timed && activeModule.remainingSeconds !== null
        ? Math.max(0, activeModule.remainingSeconds - 1)
        : null,
  };

  return {
    ...session,
    modules: session.modules.map((module, index) =>
      index === session.activeModuleIndex ? nextActiveModule : module,
    ),
  };
};

export const buildPracticeTestSessionAfterCurrentModuleSubmit = (
  session: PracticeTestSessionMeta,
): PracticeTestSessionMeta | null => {
  const currentModuleIndex = session.activeModuleIndex;
  const nextModuleIndex = currentModuleIndex + 1;
  const nextModule = session.modules[nextModuleIndex];

  if (!nextModule) return null;

  return {
    ...session,
    currentIndex: nextModule.startIndex,
    activeModuleIndex: nextModuleIndex,
    phase: "module",
    modules: session.modules.map((module, index) => {
      if (index === currentModuleIndex) {
        return { ...module, status: "completed" as const };
      }
      if (index === nextModuleIndex) {
        return { ...module, status: "active" as const };
      }
      return module;
    }),
    breakStatus:
      currentModuleIndex === 1
        ? "active" as const
        : session.breakStatus,
  };
};

export const clearPracticeTestSessionArtifacts = (sessionId: string) => {
  const keysToRemove: string[] = [];

  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index);
    if (!key) continue;
    if (
      key.startsWith(`${QUESTION_STATE_PREFIX}${sessionId}:`) ||
      key.startsWith(`${NOTE_PREFIX}${sessionId}:`) ||
      key.startsWith(`${ANNOTATION_PREFIX}${sessionId}:`)
    ) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => sessionStorage.removeItem(key));
};

export const clearPracticeTestSession = (practiceSetId: string) => {
  const existing = getPracticeTestSession(practiceSetId);
  if (existing) {
    clearPracticeTestSessionArtifacts(existing.sessionId);
  }
  sessionStorage.removeItem(getSessionKey(practiceSetId));
};

export const getPracticeTestQuestionState = (
  sessionId: string,
  storageId: string,
): ModulePracticeQuestionState => {
  const stored = readJson<ModulePracticeQuestionState>(
    sessionStorage,
    getPracticeTestQuestionStateKey(sessionId, storageId),
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

export const savePracticeTestQuestionState = (
  sessionId: string,
  storageId: string,
  state: ModulePracticeQuestionState,
) => {
  writeJson(
    sessionStorage,
    getPracticeTestQuestionStateKey(sessionId, storageId),
    state,
  );
};

export const buildPracticeTestResult = (
  practiceSet: PracticeSet,
  session: PracticeTestSessionMeta,
): PracticeTestResult => {
  const moduleResults = practiceSet.modules.map((module, moduleIndex) => {
    const questions = module.questions.map((entry) => {
      const question = entry.bankQuestion;
      const state = getPracticeTestQuestionState(session.sessionId, question.stableId);
      const userAnswer =
        question.type === "free-response" ? state.freeResponseAnswer : state.answer;
      const hasCheckedAnswer = Object.keys(state.checkedAnswers).length > 0;
      const hasCheckedCorrectAnswer = Object.values(state.checkedAnswers).some(Boolean);
      const isAnswered =
        Boolean(userAnswer) ||
        (session.settings.allowCheckingAnswers && hasCheckedAnswer);
      const isCorrect =
        session.settings.allowCheckingAnswers && hasCheckedCorrectAnswer
          ? true
          : Boolean(userAnswer) && answersEquivalent(userAnswer, question.correctAnswer);

      return {
        globalQuestionNumber: session.modules[moduleIndex].startIndex + entry.slot,
        moduleQuestionNumber: entry.slot,
        moduleSlug: module.slug,
        moduleTitle: module.publicTitle,
        subject: module.subject,
        storageId: question.stableId,
        prompt: getQuestionPrompt(question),
        userAnswer,
        correctAnswer: question.correctAnswer ?? "",
        isAnswered,
        isCorrect,
        isMarkedForReview: state.isMarkedForReview,
        timeSpentSeconds: state.timeSpentSeconds,
        domain: question.category.domain,
        skill: question.category.skill,
        difficulty: question.difficulty,
      } satisfies PracticeTestQuestionResult;
    });

    const answeredCount = questions.filter((question) => question.isAnswered).length;
    const correctCount = questions.filter((question) => question.isCorrect).length;
    const incorrectCount = answeredCount - correctCount;
    const unansweredCount = questions.length - answeredCount;

    return {
      moduleSlug: module.slug,
      moduleTitle: module.publicTitle,
      subject: module.subject,
      moduleNumber: module.moduleNumber,
      questionCount: questions.length,
      answeredCount,
      unansweredCount,
      correctCount,
      incorrectCount,
      rawScore: correctCount,
      scaledScore: 0,
      accuracy: questions.length ? Math.round((correctCount / questions.length) * 100) : 0,
      elapsedSeconds: session.modules[moduleIndex]?.elapsedSeconds ?? 0,
      timeLimitSeconds: session.modules[moduleIndex]?.timeLimitSeconds ?? 0,
      questions,
    } satisfies PracticeTestModuleResult;
  });

  const scoreEstimate = calculatePracticeTestScores(moduleResults.map((module) => ({
    moduleSlug: module.moduleSlug,
    subject: module.subject,
    moduleNumber: module.moduleNumber,
    questions: module.questions.map((question) => ({
      isAnswered: question.isAnswered,
      isCorrect: question.isCorrect,
      difficulty: question.difficulty,
    })),
  })));
  const scoredModuleResults = moduleResults.map((module) => ({
    ...module,
    scaledScore: scoreEstimate.moduleScores[module.moduleSlug] ?? module.scaledScore,
  }));
  const questions = scoredModuleResults.flatMap((module) => module.questions);
  const answeredCount = questions.filter((question) => question.isAnswered).length;
  const correctCount = questions.filter((question) => question.isCorrect).length;
  const incorrectCount = answeredCount - correctCount;
  const unansweredCount = questions.length - answeredCount;
  const elapsedSeconds =
    session.modules.reduce((sum, module) => sum + module.elapsedSeconds, 0) +
    session.breakElapsedSeconds;

  return {
    version: 1,
    sessionId: session.sessionId,
    practiceSetId: practiceSet.id,
    practiceSetNumber: practiceSet.setNumber,
    submittedAt: Date.now(),
    elapsedSeconds,
    breakElapsedSeconds: session.breakElapsedSeconds,
    skippedBreak: session.breakStatus === "skipped",
    readingWritingScore: scoreEstimate.readingWritingScore,
    mathScore: scoreEstimate.mathScore,
    totalScore: scoreEstimate.totalScore,
    answeredCount,
    unansweredCount,
    correctCount,
    incorrectCount,
    accuracy: questions.length ? Math.round((correctCount / questions.length) * 100) : 0,
    modules: scoredModuleResults,
    questions,
  };
};

export const savePracticeTestResult = (result: PracticeTestResult) => {
  writeJson(localStorage, `${RESULT_PREFIX}${result.sessionId}`, result);
  writeJson(localStorage, `${LATEST_RESULT_PREFIX}${result.practiceSetId}`, result);
};

export const getPracticeTestResult = (
  sessionId: string,
): PracticeTestResult | null => {
  const fromLocal = readJson<PracticeTestResult>(localStorage, `${RESULT_PREFIX}${sessionId}`);
  if (fromLocal) return fromLocal;
  return readJson<PracticeTestResult>(sessionStorage, `${RESULT_PREFIX}${sessionId}`);
};

export const getLatestPracticeTestResult = (
  practiceSetId: string,
): PracticeTestResult | null => {
  const fromLocal = readJson<PracticeTestResult>(localStorage, `${LATEST_RESULT_PREFIX}${practiceSetId}`);
  if (fromLocal) return fromLocal;
  return readJson<PracticeTestResult>(sessionStorage, `${LATEST_RESULT_PREFIX}${practiceSetId}`);
};

export const getAllPracticeTestResults = (): PracticeTestResult[] => {
  const results: PracticeTestResult[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith(RESULT_PREFIX)) continue;
    const result = readJson<PracticeTestResult>(localStorage, key);
    if (result) results.push(result);
  }
  return results.sort((a, b) => b.submittedAt - a.submittedAt);
};
