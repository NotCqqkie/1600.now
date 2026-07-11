import type { LoadedPracticeModule, PracticeModule } from "@/data/modulePracticeBank";
import type { BankQuestion } from "@/data/questionBank";
import { getDesmosStoragePrefix } from "@/lib/practice/desmosSessionState";
import { answersEquivalent } from "@/lib/text/answerEquivalence";

type ModulePracticeQuestionStatus =
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
  ownerUid: string | null;
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
  timerRemainderMs?: number;
  timerUpdatedAt?: number;
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

interface ModulePracticeSkillResult {
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

const LEGACY_ACTIVE_SESSION_PREFIX = "module-practice:session:";
const SCOPED_ACTIVE_SESSION_PREFIX = "module-practice:session:v1:";
const SESSION_STATE_PREFIX = "module-practice:state:";
const SESSION_NOTE_PREFIX = "module-practice:note:";
const SESSION_ANNOTATION_PREFIX = "module-practice:annotation:";
const RESULT_PREFIX = "module-practice:result:";
const LATEST_RESULT_PREFIX = "module-practice:latest-result:";
const SCOPED_RESULT_PREFIX = "module-practice:result:v1:";
const SCOPED_LATEST_RESULT_PREFIX = "module-practice:latest-result:v1:";
const ANON_SUFFIX = "anon";

export interface ModulePracticeSessionStorageLike {
  readonly length: number;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
}

const defaultSessionStorage = (): ModulePracticeSessionStorageLike | null =>
  typeof window === "undefined" ? null : window.sessionStorage;

const readJson = <T>(storage: Pick<Storage, "getItem">, key: string): T | null => {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeJson = (storage: Pick<Storage, "setItem">, key: string, value: unknown) => {
  storage.setItem(key, JSON.stringify(value));
};

const getResultScope = (uid?: string | null) => uid ?? ANON_SUFFIX;
const legacySessionKey = (moduleSlug: string) => `${LEGACY_ACTIVE_SESSION_PREFIX}${moduleSlug}`;
const scopedSessionKey = (moduleSlug: string, ownerUid: string | null) =>
  `${SCOPED_ACTIVE_SESSION_PREFIX}${getResultScope(ownerUid)}:${moduleSlug}`;
const scopedResultKey = (sessionId: string, uid?: string | null) =>
  `${SCOPED_RESULT_PREFIX}${getResultScope(uid)}:${sessionId}`;
const scopedLatestResultKey = (moduleSlug: string, uid?: string | null) =>
  `${SCOPED_LATEST_RESULT_PREFIX}${getResultScope(uid)}:${moduleSlug}`;

const getTimerRemainderMs = (value: number | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(999, Math.floor(value)))
    : 0;

const getModulePracticeSessionStateKey = (sessionId: string, storageId: string) =>
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

const isValidOwnerUid = (value: unknown): value is string | null =>
  value === null || (typeof value === "string" && value.length > 0 && value.length <= 128 && !value.includes("/"));

const normalizeModulePracticeSession = (
  value: unknown,
  moduleSlug: string,
  ownerUid: string | null,
  allowMissingAnonymousOwner = false,
): ModulePracticeSessionMeta | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<ModulePracticeSessionMeta>;
  const hasOwner = Object.prototype.hasOwnProperty.call(candidate, "ownerUid");
  const storedOwner = hasOwner ? candidate.ownerUid : allowMissingAnonymousOwner ? null : undefined;
  if (!isValidOwnerUid(storedOwner) || storedOwner !== ownerUid) return null;
  if (candidate.version !== 1
      || typeof candidate.sessionId !== "string"
      || candidate.sessionId.length === 0
      || candidate.sessionId.length > 300
      || candidate.moduleSlug !== moduleSlug
      || typeof candidate.moduleTitle !== "string"
      || typeof candidate.moduleSubtitle !== "string"
      || (candidate.subject !== "math" && candidate.subject !== "reading")
      || !Number.isInteger(candidate.questionCount)
      || Number(candidate.questionCount) <= 0
      || !Number.isInteger(candidate.currentIndex)
      || Number(candidate.currentIndex) < 0
      || Number(candidate.currentIndex) >= Number(candidate.questionCount)
      || typeof candidate.startedAt !== "number"
      || !Number.isFinite(candidate.startedAt)
      || (candidate.status !== "active" && candidate.status !== "paused" && candidate.status !== "submitted")
      || !candidate.settings
      || typeof candidate.settings.timed !== "boolean"
      || typeof candidate.settings.allowCheckingAnswers !== "boolean"
      || (candidate.settings.timeLimitSeconds !== null
        && (typeof candidate.settings.timeLimitSeconds !== "number"
          || !Number.isFinite(candidate.settings.timeLimitSeconds)
          || candidate.settings.timeLimitSeconds <= 0))
      || typeof candidate.elapsedSeconds !== "number"
      || !Number.isFinite(candidate.elapsedSeconds)
      || candidate.elapsedSeconds < 0
      || (candidate.remainingSeconds !== null
        && (typeof candidate.remainingSeconds !== "number"
          || !Number.isFinite(candidate.remainingSeconds)
          || candidate.remainingSeconds < 0))
      || (candidate.timerRemainderMs !== undefined
        && (typeof candidate.timerRemainderMs !== "number"
          || !Number.isFinite(candidate.timerRemainderMs)
          || candidate.timerRemainderMs < 0))
      || (candidate.timerUpdatedAt !== undefined
        && (typeof candidate.timerUpdatedAt !== "number"
          || !Number.isFinite(candidate.timerUpdatedAt)
          || candidate.timerUpdatedAt < 0))) return null;

  return { ...candidate, ownerUid: storedOwner } as ModulePracticeSessionMeta;
};

export const createModulePracticeSession = (
  module: PracticeModule,
  settings: ModulePracticeSettings,
  ownerUid: string | null = null,
  storage: ModulePracticeSessionStorageLike | null = defaultSessionStorage(),
): ModulePracticeSessionMeta => {
  if (!isValidOwnerUid(ownerUid)) throw new Error("Invalid module practice owner.");
  const startedAt = Date.now();
  const session: ModulePracticeSessionMeta = {
    version: 1,
    ownerUid,
    sessionId: buildSessionId(module.slug),
    moduleSlug: module.slug,
    moduleTitle: module.publicTitle,
    moduleSubtitle: module.publicSubtitle,
    subject: module.subject,
    questionCount: module.questionCount,
    currentIndex: 0,
    startedAt,
    status: "active",
    settings,
    elapsedSeconds: 0,
    remainingSeconds: settings.timed ? settings.timeLimitSeconds : null,
    timerRemainderMs: 0,
    timerUpdatedAt: startedAt,
  };

  if (storage) writeJson(storage, scopedSessionKey(module.slug, ownerUid), session);
  return session;
};

export const getModulePracticeSession = (
  moduleSlug: string,
  ownerUid: string | null = null,
  storage: ModulePracticeSessionStorageLike | null = defaultSessionStorage(),
): ModulePracticeSessionMeta | null => {
  if (!storage) return null;
  if (!isValidOwnerUid(ownerUid)) return null;
  const scoped = normalizeModulePracticeSession(
    readJson<unknown>(storage, scopedSessionKey(moduleSlug, ownerUid)),
    moduleSlug,
    ownerUid,
  );
  if (scoped || ownerUid !== null) return scoped;

  const legacyKey = legacySessionKey(moduleSlug);
  const legacy = normalizeModulePracticeSession(
    readJson<unknown>(storage, legacyKey),
    moduleSlug,
    null,
    true,
  );
  if (!legacy) return null;
  try {
    writeJson(storage, scopedSessionKey(moduleSlug, null), legacy);
    storage.removeItem(legacyKey);
  } catch {
    return legacy;
  }
  return legacy;
};

export const saveModulePracticeSession = (
  session: ModulePracticeSessionMeta,
  storage: ModulePracticeSessionStorageLike | null = defaultSessionStorage(),
) => {
  if (!storage) return;
  if (!isValidOwnerUid(session.ownerUid)) throw new Error("Invalid module practice owner.");
  writeJson(storage, scopedSessionKey(session.moduleSlug, session.ownerUid), session);
};

export const resumeModulePracticeSession = (
  session: ModulePracticeSessionMeta,
  resumedAt = Date.now(),
): ModulePracticeSessionMeta => session.status === "paused"
  ? { ...session, status: "active", timerUpdatedAt: resumedAt }
  : session;

export const advanceModulePracticeSessionTimer = (
  session: ModulePracticeSessionMeta,
  elapsedMs: number,
  advancedAt = Date.now(),
): ModulePracticeSessionMeta => {
  const safeElapsedMs = Math.max(0, Math.floor(elapsedMs));
  if (!safeElapsedMs) return session;
  if (session.settings.timed && session.remainingSeconds === 0) {
    return session.timerRemainderMs ? { ...session, timerRemainderMs: 0 } : session;
  }

  const totalMs = getTimerRemainderMs(session.timerRemainderMs) + safeElapsedMs;
  const elapsedWholeSeconds = Math.floor(totalMs / 1000);
  const timerRemainderMs = totalMs % 1000;

  if (!elapsedWholeSeconds) {
    return { ...session, timerRemainderMs, timerUpdatedAt: advancedAt };
  }

  const hasCountdown = session.settings.timed && session.remainingSeconds !== null;
  const elapsedSeconds = hasCountdown
    ? Math.min(elapsedWholeSeconds, session.remainingSeconds)
    : elapsedWholeSeconds;
  const remainingSeconds = hasCountdown
    ? Math.max(0, session.remainingSeconds - elapsedSeconds)
    : null;

  return {
    ...session,
    elapsedSeconds: session.elapsedSeconds + elapsedSeconds,
    remainingSeconds,
    timerRemainderMs: remainingSeconds === 0 ? 0 : timerRemainderMs,
    timerUpdatedAt: advancedAt,
  };
};

const clearModulePracticeSessionArtifacts = (
  sessionId: string,
  storage: ModulePracticeSessionStorageLike,
) => {
  const keysToRemove: string[] = [];
  const desmosPrefix = getDesmosStoragePrefix(`module-practice:${sessionId}`);
  const artifactPrefixes = [
    `${SESSION_STATE_PREFIX}${sessionId}:`,
    `${SESSION_NOTE_PREFIX}${sessionId}:`,
    `${SESSION_ANNOTATION_PREFIX}${sessionId}:`,
    desmosPrefix,
  ];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;
    if (artifactPrefixes.some((prefix) => key.startsWith(prefix))) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => storage.removeItem(key));
};

export const clearModulePracticeSession = (
  moduleSlug: string,
  ownerUid: string | null = null,
  storage: ModulePracticeSessionStorageLike | null = defaultSessionStorage(),
) => {
  if (!storage) return;
  if (!isValidOwnerUid(ownerUid)) return;
  const existing = getModulePracticeSession(moduleSlug, ownerUid, storage);
  if (existing) {
    clearModulePracticeSessionArtifacts(existing.sessionId, storage);
  }
  storage.removeItem(scopedSessionKey(moduleSlug, ownerUid));
  if (ownerUid === null) storage.removeItem(legacySessionKey(moduleSlug));
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
  module: LoadedPracticeModule,
  session: ModulePracticeSessionMeta,
): ModulePracticeResult => {
  const questions: ModulePracticeQuestionResult[] = module.questions.map((entry) => {
    const question = entry.bankQuestion;
    const state = getModulePracticeQuestionState(session.sessionId, question.stableId);
    const userAnswer =
      question.type === "free-response" ? state.freeResponseAnswer : state.answer;
    const checkedAnswerValues = Object.values(state.checkedAnswers);
    const hasCheckedAnswer = checkedAnswerValues.length > 0;
    const hasCheckedCorrectAnswer = checkedAnswerValues.some(Boolean);
    const isAnswered =
      Boolean(userAnswer) ||
      (session.settings.allowCheckingAnswers && hasCheckedAnswer);
    const isCorrect =
      session.settings.allowCheckingAnswers && hasCheckedCorrectAnswer
        ? true
        : answersEquivalent(userAnswer, question.correctAnswer);
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

  let answeredCount = 0;
  let correctCount = 0;
  let longestQuestion: ModulePracticeQuestionResult | null = null;
  let shortestQuestion: ModulePracticeQuestionResult | null = null;
  const counts = { correct: 0, incorrect: 0, correctAfterReview: 0 };
  const skillMap = new Map<string, ModulePracticeSkillResult>();

  for (const question of questions) {
    if (question.isAnswered) {
      answeredCount += 1;
      if (question.isCorrect) correctCount += 1;

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
    }

    if (question.status === "correct-first") counts.correct += 1;
    if (question.status === "correct-later") counts.correctAfterReview += 1;
    if (question.status === "incorrect") counts.incorrect += 1;

    if (question.timeSpentSeconds > 0) {
      if (!longestQuestion || question.timeSpentSeconds > longestQuestion.timeSpentSeconds) {
        longestQuestion = question;
      }
      if (!shortestQuestion || question.timeSpentSeconds < shortestQuestion.timeSpentSeconds) {
        shortestQuestion = question;
      }
    }
  }

  const incorrectCount = answeredCount - correctCount;
  const unansweredCount = questions.length - answeredCount;

  const skills = [...skillMap.values()]
    .map((skill) => ({
      ...skill,
      accuracy: skill.attempted ? Math.round((skill.correct / skill.attempted) * 100) : 0,
      averageTimeSeconds: skill.attempted
        ? Math.round(skill.totalTimeSeconds / skill.attempted)
        : 0,
    }))
    .sort((left, right) => right.attempted - left.attempted || left.skill.localeCompare(right.skill));

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

export const saveModulePracticeResult = (
  result: ModulePracticeResult,
  uid?: string | null,
) => {
  writeJson(localStorage, scopedResultKey(result.sessionId, uid), result);
  localStorage.setItem(scopedLatestResultKey(result.moduleSlug, uid), result.sessionId);
};

export const getModulePracticeResult = (
  sessionId: string,
  uid?: string | null,
): ModulePracticeResult | null =>
  readJson<ModulePracticeResult>(localStorage, scopedResultKey(sessionId, uid)) ??
  (uid == null
    ? readJson<ModulePracticeResult>(localStorage, `${RESULT_PREFIX}${sessionId}`)
    : null);

export const getLatestModulePracticeResult = (
  moduleSlug: string,
  uid?: string | null,
): ModulePracticeResult | null => {
  const sessionId =
    localStorage.getItem(scopedLatestResultKey(moduleSlug, uid)) ??
    (uid == null ? localStorage.getItem(`${LATEST_RESULT_PREFIX}${moduleSlug}`) : null);
  if (!sessionId) return null;
  return getModulePracticeResult(sessionId, uid);
};

export const getAllModulePracticeResults = (
  uid?: string | null,
): ModulePracticeResult[] => {
  const results: ModulePracticeResult[] = [];
  const scopedPrefix = `${SCOPED_RESULT_PREFIX}${getResultScope(uid)}:`;
  const appendResult = (key: string) => {
    const result = readJson<ModulePracticeResult>(localStorage, key);
    if (result) results.push(result);
  };

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) continue;
    if (key.startsWith(scopedPrefix)) {
      appendResult(key);
      continue;
    }
    if (uid != null || !key.startsWith(RESULT_PREFIX)) continue;
    appendResult(key);
  }
  return results.sort((leftResult, rightResult) => rightResult.submittedAt - leftResult.submittedAt);
};
