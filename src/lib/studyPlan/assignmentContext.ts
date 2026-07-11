export const STUDY_PLAN_ASSIGNMENT_STORAGE_KEY = "study-plan:assignment:v1";
export const STUDY_PLAN_ASSIGNMENT_RESULT_STORAGE_KEY = "study-plan:assignment-result:v1";

export type StudyPlanAssignmentTimingMode =
  | Readonly<{ kind: "count-up" }>
  | Readonly<{ kind: "countdown"; timeLimitSeconds: number }>;

export interface StudyPlanAssignmentQuestionRef {
  subject: "math" | "reading";
  sourceId: string;
  bankType: "past" | "unofficial";
  storageId: string;
}

export type StudyPlanAssignmentSource =
  | Readonly<{
      kind: "practice-set";
      practiceRunId: string;
      questionRefs: StudyPlanAssignmentQuestionRef[];
    }>
  | Readonly<{ kind: "module"; moduleSlug: string; sessionId: string }>
  | Readonly<{ kind: "practice-test"; practiceSetId: string; sessionId: string }>;

export interface StudyPlanAssignmentContext {
  version: 1;
  ownerUid: string | null;
  assignmentId: string;
  plannedDate: string;
  returnPath: string;
  timingMode: StudyPlanAssignmentTimingMode;
  source: StudyPlanAssignmentSource;
  launchedAt: number;
}

export interface StudyPlanAssignmentQuestionResult {
  storageId: string;
  sourceId?: string;
  subject?: "math" | "reading";
  bankType?: "past" | "unofficial";
  domain?: string;
  skill?: string;
  attemptCount: number;
  firstAttemptCorrect: boolean;
  isCorrect: boolean;
  timeSpentSeconds: number;
}

export interface StudyPlanAssignmentSession {
  version: 1;
  context: StudyPlanAssignmentContext;
  status: "active" | "paused" | "completed";
  elapsedSeconds: number;
  remainingSeconds: number | null;
  timerRemainderMs: number;
  questionResults: Record<string, StudyPlanAssignmentQuestionResult>;
  updatedAt: number;
}

export interface StudyPlanAssignmentResult {
  version: 1;
  ownerUid: string | null;
  assignmentId: string;
  plannedDate: string;
  returnPath: string;
  source: StudyPlanAssignmentSource;
  sourceSessionId: string;
  completedAt: number;
  elapsedSeconds: number;
  questionCount: number;
  attemptedCount: number;
  correctCount: number;
  accuracy: number;
  missedQuestionIds: string[];
  missedSkills: string[];
  questionResults: StudyPlanAssignmentQuestionResult[];
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type AssignmentMatch = Readonly<{
  ownerUid: string | null;
  practiceRunId?: string | null;
  moduleSlug?: string | null;
  moduleSessionId?: string | null;
  practiceSetId?: string | null;
  practiceTestSessionId?: string | null;
}>;

type QuestionResultInput = Readonly<{
  storageId: string;
  sourceId?: string;
  subject?: "math" | "reading";
  bankType?: "past" | "unofficial";
  domain?: string;
  skill?: string;
  isCorrect: boolean;
  timeSpentSeconds?: number;
}>;

type CompletionSummary = Readonly<{
  sourceSessionId?: string;
  elapsedSeconds?: number;
  questionCount?: number;
  attemptedCount?: number;
  correctCount?: number;
  accuracy?: number;
  questionResults?: StudyPlanAssignmentQuestionResult[];
  missedQuestionIds?: string[];
  missedSkills?: string[];
}>;

type ModuleAssignmentResult = Readonly<{
  sessionId: string;
  moduleSlug: string;
  elapsedSeconds: number;
  questionCount: number;
  answeredCount: number;
  correctCount: number;
  accuracy: number;
  questions: ReadonlyArray<{
    storageId: string;
    isAnswered: boolean;
    isCorrect: boolean;
    status: string;
    timeSpentSeconds: number;
    domain: string;
    skill: string;
  }>;
}>;

const getDefaultStorage = (): StorageLike | null =>
  typeof window === "undefined" ? null : window.sessionStorage;

const readJson = <T>(storage: StorageLike, key: string): T | null => {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const isInternalPath = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//");

const isValidOwnerUid = (value: unknown): value is string | null =>
  value === null || (typeof value === "string" && value.length > 0 && value.length <= 128 && !value.includes("/"));

const isValidQuestionResult = (value: unknown): value is StudyPlanAssignmentQuestionResult => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<StudyPlanAssignmentQuestionResult>;
  return typeof candidate.storageId === "string"
    && candidate.storageId.length > 0
    && candidate.storageId.length <= 300
    && (candidate.sourceId === undefined || (typeof candidate.sourceId === "string" && candidate.sourceId.length <= 300))
    && (candidate.subject === undefined || candidate.subject === "math" || candidate.subject === "reading")
    && (candidate.bankType === undefined || candidate.bankType === "past" || candidate.bankType === "unofficial")
    && Number.isInteger(candidate.attemptCount)
    && Number(candidate.attemptCount) >= 0
    && typeof candidate.firstAttemptCorrect === "boolean"
    && typeof candidate.isCorrect === "boolean"
    && typeof candidate.timeSpentSeconds === "number"
    && Number.isFinite(candidate.timeSpentSeconds)
    && candidate.timeSpentSeconds >= 0;
};

const isValidSource = (source: unknown): source is StudyPlanAssignmentSource => {
  if (!source || typeof source !== "object" || !("kind" in source)) return false;
  if (source.kind === "practice-set") {
    return "practiceRunId" in source
      && typeof source.practiceRunId === "string"
      && source.practiceRunId.length <= 300
      && "questionRefs" in source
      && Array.isArray(source.questionRefs)
      && source.questionRefs.length > 0
      && source.questionRefs.length <= 1_000
      && source.questionRefs.every((reference) => {
        if (!reference || typeof reference !== "object") return false;
        const candidate = reference as Partial<StudyPlanAssignmentQuestionRef>;
        return (candidate.subject === "math" || candidate.subject === "reading")
          && typeof candidate.sourceId === "string"
          && candidate.sourceId.length > 0
          && candidate.sourceId.length <= 300
          && (candidate.bankType === "past" || candidate.bankType === "unofficial")
          && typeof candidate.storageId === "string"
          && candidate.storageId.length > 0
          && candidate.storageId.length <= 300;
      });
  }
  if (source.kind === "module") {
    return (
      "moduleSlug" in source &&
      typeof source.moduleSlug === "string" &&
      source.moduleSlug.length <= 300 &&
      "sessionId" in source &&
      typeof source.sessionId === "string" &&
      source.sessionId.length <= 300
    );
  }
  return (
    source.kind === "practice-test" &&
    "practiceSetId" in source &&
    typeof source.practiceSetId === "string" &&
    source.practiceSetId.length <= 300 &&
    "sessionId" in source &&
    typeof source.sessionId === "string" &&
    source.sessionId.length <= 300
  );
};

const isValidTimingMode = (timingMode: unknown): timingMode is StudyPlanAssignmentTimingMode => {
  if (!timingMode || typeof timingMode !== "object" || !("kind" in timingMode)) return false;
  if (timingMode.kind === "count-up") return true;
  return (
    timingMode.kind === "countdown" &&
    "timeLimitSeconds" in timingMode &&
    typeof timingMode.timeLimitSeconds === "number" &&
    Number.isFinite(timingMode.timeLimitSeconds) &&
    timingMode.timeLimitSeconds > 0
  );
};

const isValidContext = (context: unknown): context is StudyPlanAssignmentContext => {
  if (!context || typeof context !== "object") return false;
  const candidate = context as Partial<StudyPlanAssignmentContext>;
  return (
    candidate.version === 1 &&
    isValidOwnerUid(candidate.ownerUid) &&
    typeof candidate.assignmentId === "string" &&
    candidate.assignmentId.length > 0 &&
    candidate.assignmentId.length <= 300 &&
    typeof candidate.plannedDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(candidate.plannedDate) &&
    isInternalPath(candidate.returnPath) &&
    isValidTimingMode(candidate.timingMode) &&
    isValidSource(candidate.source) &&
    typeof candidate.launchedAt === "number" &&
    Number.isFinite(candidate.launchedAt) &&
    candidate.launchedAt > 0
  );
};

const isValidSession = (session: unknown): session is StudyPlanAssignmentSession => {
  if (!session || typeof session !== "object") return false;
  const candidate = session as Partial<StudyPlanAssignmentSession>;
  return (
    candidate.version === 1 &&
    isValidContext(candidate.context) &&
    (candidate.status === "active" || candidate.status === "paused" || candidate.status === "completed") &&
    typeof candidate.elapsedSeconds === "number" &&
    Number.isFinite(candidate.elapsedSeconds) &&
    candidate.elapsedSeconds >= 0 &&
    (candidate.remainingSeconds === null || (
      typeof candidate.remainingSeconds === "number"
      && Number.isFinite(candidate.remainingSeconds)
      && candidate.remainingSeconds >= 0
    )) &&
    typeof candidate.timerRemainderMs === "number" &&
    Number.isFinite(candidate.timerRemainderMs) &&
    candidate.timerRemainderMs >= 0 &&
    Boolean(candidate.questionResults && typeof candidate.questionResults === "object" && !Array.isArray(candidate.questionResults)) &&
    Object.keys(candidate.questionResults ?? {}).length <= 1_000 &&
    Object.values(candidate.questionResults ?? {}).every(isValidQuestionResult) &&
    typeof candidate.updatedAt === "number" &&
    Number.isFinite(candidate.updatedAt) &&
    candidate.updatedAt > 0
  );
};

const isValidResult = (result: unknown): result is StudyPlanAssignmentResult => {
  if (!result || typeof result !== "object" || Array.isArray(result)) return false;
  const candidate = result as Partial<StudyPlanAssignmentResult>;
  return candidate.version === 1
    && isValidOwnerUid(candidate.ownerUid)
    && typeof candidate.assignmentId === "string"
    && candidate.assignmentId.length > 0
    && candidate.assignmentId.length <= 300
    && typeof candidate.plannedDate === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(candidate.plannedDate)
    && isInternalPath(candidate.returnPath)
    && isValidSource(candidate.source)
    && typeof candidate.sourceSessionId === "string"
    && candidate.sourceSessionId.length <= 300
    && typeof candidate.completedAt === "number"
    && Number.isFinite(candidate.completedAt)
    && typeof candidate.elapsedSeconds === "number"
    && Number.isFinite(candidate.elapsedSeconds)
    && candidate.elapsedSeconds >= 0
    && Number.isInteger(candidate.questionCount)
    && Number(candidate.questionCount) >= 0
    && Number.isInteger(candidate.attemptedCount)
    && Number(candidate.attemptedCount) >= 0
    && Number.isInteger(candidate.correctCount)
    && Number(candidate.correctCount) >= 0
    && typeof candidate.accuracy === "number"
    && Number.isFinite(candidate.accuracy)
    && candidate.accuracy >= 0
    && candidate.accuracy <= 100
    && Array.isArray(candidate.missedQuestionIds)
    && candidate.missedQuestionIds.length <= 1_000
    && candidate.missedQuestionIds.every((value) => typeof value === "string" && value.length <= 300)
    && Array.isArray(candidate.missedSkills)
    && candidate.missedSkills.length <= 100
    && candidate.missedSkills.every((value) => typeof value === "string" && value.length <= 300)
    && Array.isArray(candidate.questionResults)
    && candidate.questionResults.length <= 1_000
    && candidate.questionResults.every(isValidQuestionResult);
};

const writeSession = (
  session: StudyPlanAssignmentSession,
  storage: StorageLike | null,
): StudyPlanAssignmentSession => {
  storage?.setItem(STUDY_PLAN_ASSIGNMENT_STORAGE_KEY, JSON.stringify(session));
  return session;
};

const getSourceSessionId = (source: StudyPlanAssignmentSource): string => {
  if (source.kind === "practice-set") return source.practiceRunId;
  return source.sessionId;
};

const matchesSource = (source: StudyPlanAssignmentSource, match: AssignmentMatch): boolean => {
  if (source.kind === "practice-set") {
    return Boolean(match.practiceRunId && source.practiceRunId === match.practiceRunId);
  }
  if (source.kind === "module") {
    return Boolean(
      match.moduleSlug &&
      match.moduleSessionId &&
      source.moduleSlug === match.moduleSlug &&
      source.sessionId === match.moduleSessionId,
    );
  }
  return Boolean(
    match.practiceSetId &&
    match.practiceTestSessionId &&
    source.practiceSetId === match.practiceSetId &&
    source.sessionId === match.practiceTestSessionId,
  );
};

const clampWholeSeconds = (value: number): number =>
  Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));

export const beginStudyPlanAssignment = (
  input: Omit<StudyPlanAssignmentContext, "version" | "launchedAt" | "ownerUid"> &
    Partial<Pick<StudyPlanAssignmentContext, "launchedAt" | "ownerUid">>,
  storage: StorageLike | null = getDefaultStorage(),
): StudyPlanAssignmentSession => {
  const launchedAt = input.launchedAt ?? Date.now();
  const context: StudyPlanAssignmentContext = {
    ...input,
    ownerUid: input.ownerUid ?? null,
    version: 1,
    launchedAt,
  };
  if (!isValidContext(context)) {
    throw new Error("Invalid study plan assignment context");
  }

  storage?.removeItem(STUDY_PLAN_ASSIGNMENT_RESULT_STORAGE_KEY);
  return writeSession({
    version: 1,
    context,
    status: "active",
    elapsedSeconds: 0,
    remainingSeconds:
      context.timingMode.kind === "countdown"
        ? clampWholeSeconds(context.timingMode.timeLimitSeconds)
        : null,
    timerRemainderMs: 0,
    questionResults: {},
    updatedAt: launchedAt,
  }, storage);
};

export const getStudyPlanAssignmentSession = (
  storage: StorageLike | null = getDefaultStorage(),
): StudyPlanAssignmentSession | null => {
  if (!storage) return null;
  const session = readJson<StudyPlanAssignmentSession>(storage, STUDY_PLAN_ASSIGNMENT_STORAGE_KEY);
  return isValidSession(session) ? session : null;
};

export const getMatchingStudyPlanAssignmentSession = (
  match: AssignmentMatch,
  storage: StorageLike | null = getDefaultStorage(),
): StudyPlanAssignmentSession | null => {
  const session = getStudyPlanAssignmentSession(storage);
  return session
    && session.context.ownerUid === match.ownerUid
    && matchesSource(session.context.source, match)
    ? session
    : null;
};

export const getStudyPlanAssignmentReturnPath = (
  match: AssignmentMatch,
  storage: StorageLike | null = getDefaultStorage(),
): string | null => {
  const session = getMatchingStudyPlanAssignmentSession(match, storage);
  return session?.context.returnPath ?? null;
};

const getOwnedStudyPlanAssignmentSession = (
  ownerUid: string | null,
  storage: StorageLike | null,
) => {
  const session = getStudyPlanAssignmentSession(storage);
  return session?.context.ownerUid === ownerUid ? session : null;
};

export const advanceStudyPlanAssignmentTimer = (
  elapsedMs: number,
  ownerUid: string | null,
  storage: StorageLike | null = getDefaultStorage(),
): StudyPlanAssignmentSession | null => {
  const session = getOwnedStudyPlanAssignmentSession(ownerUid, storage);
  if (!session || session.status !== "active") return session;

  const safeElapsedMs = Math.max(0, Math.floor(elapsedMs));
  if (!safeElapsedMs) return session;
  if (session.remainingSeconds === 0) return session;

  const totalMs = session.timerRemainderMs + safeElapsedMs;
  const elapsedWholeSeconds = Math.floor(totalMs / 1000);
  const timerRemainderMs = totalMs % 1000;
  if (!elapsedWholeSeconds) {
    return writeSession({ ...session, timerRemainderMs, updatedAt: Date.now() }, storage);
  }

  const elapsedSeconds = session.remainingSeconds === null
    ? elapsedWholeSeconds
    : Math.min(elapsedWholeSeconds, session.remainingSeconds);
  const remainingSeconds = session.remainingSeconds === null
    ? null
    : Math.max(0, session.remainingSeconds - elapsedSeconds);

  return writeSession({
    ...session,
    elapsedSeconds: session.elapsedSeconds + elapsedSeconds,
    remainingSeconds,
    timerRemainderMs: remainingSeconds === 0 ? 0 : timerRemainderMs,
    updatedAt: Date.now(),
  }, storage);
};

export const pauseStudyPlanAssignment = (
  ownerUid: string | null,
  storage: StorageLike | null = getDefaultStorage(),
): StudyPlanAssignmentSession | null => {
  const session = getOwnedStudyPlanAssignmentSession(ownerUid, storage);
  if (!session || session.status === "completed") return session;
  return writeSession({ ...session, status: "paused", updatedAt: Date.now() }, storage);
};

export const resumeStudyPlanAssignment = (
  ownerUid: string | null,
  storage: StorageLike | null = getDefaultStorage(),
): StudyPlanAssignmentSession | null => {
  const session = getOwnedStudyPlanAssignmentSession(ownerUid, storage);
  if (!session || session.status === "completed") return session;
  return writeSession({ ...session, status: "active", updatedAt: Date.now() }, storage);
};

export const recordStudyPlanAssignmentQuestionResult = (
  input: QuestionResultInput,
  ownerUid: string | null,
  storage: StorageLike | null = getDefaultStorage(),
): StudyPlanAssignmentSession | null => {
  const session = getOwnedStudyPlanAssignmentSession(ownerUid, storage);
  if (!session || session.status === "completed") return session;
  const previous = session.questionResults[input.storageId];
  const questionResult: StudyPlanAssignmentQuestionResult = {
    storageId: input.storageId,
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
    ...(input.subject ? { subject: input.subject } : {}),
    ...(input.bankType ? { bankType: input.bankType } : {}),
    ...(input.domain ? { domain: input.domain } : {}),
    ...(input.skill ? { skill: input.skill } : {}),
    attemptCount: (previous?.attemptCount ?? 0) + 1,
    firstAttemptCorrect: previous?.firstAttemptCorrect ?? input.isCorrect,
    isCorrect: input.isCorrect || Boolean(previous?.isCorrect),
    timeSpentSeconds: Math.max(
      previous?.timeSpentSeconds ?? 0,
      clampWholeSeconds(input.timeSpentSeconds ?? 0),
    ),
  };

  return writeSession({
    ...session,
    questionResults: {
      ...session.questionResults,
      [input.storageId]: questionResult,
    },
    updatedAt: Date.now(),
  }, storage);
};

export const completeStudyPlanAssignment = (
  ownerUid: string | null,
  summary: CompletionSummary = {},
  storage: StorageLike | null = getDefaultStorage(),
): StudyPlanAssignmentResult | null => {
  const session = getOwnedStudyPlanAssignmentSession(ownerUid, storage);
  if (!session) return null;

  const questionResults = summary.questionResults ?? Object.values(session.questionResults);
  const attemptedCount = summary.attemptedCount ?? questionResults.length;
  const correctCount = summary.correctCount ?? questionResults.filter((question) => question.firstAttemptCorrect).length;
  const questionCount = summary.questionCount ?? questionResults.length;
  const missedQuestionIds = summary.missedQuestionIds ?? questionResults
    .filter((question) => !question.firstAttemptCorrect)
    .map((question) => question.storageId);
  const missedSkills = summary.missedSkills ?? [...new Set(
    questionResults
      .filter((question) => !question.firstAttemptCorrect && question.skill)
      .map((question) => question.skill as string),
  )];
  const accuracy = summary.accuracy ?? (
    questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0
  );
  const result: StudyPlanAssignmentResult = {
    version: 1,
    ownerUid: session.context.ownerUid,
    assignmentId: session.context.assignmentId,
    plannedDate: session.context.plannedDate,
    returnPath: session.context.returnPath,
    source: session.context.source,
    sourceSessionId: summary.sourceSessionId ?? getSourceSessionId(session.context.source),
    completedAt: Date.now(),
    elapsedSeconds: summary.elapsedSeconds ?? session.elapsedSeconds,
    questionCount,
    attemptedCount,
    correctCount,
    accuracy,
    missedQuestionIds,
    missedSkills,
    questionResults,
  };

  storage?.setItem(STUDY_PLAN_ASSIGNMENT_RESULT_STORAGE_KEY, JSON.stringify(result));
  writeSession({ ...session, status: "completed", updatedAt: result.completedAt }, storage);
  return result;
};

export const completeStudyPlanModuleAssignment = (
  moduleResult: ModuleAssignmentResult,
  ownerUid: string | null,
  storage: StorageLike | null = getDefaultStorage(),
): StudyPlanAssignmentResult | null => {
  const session = getMatchingStudyPlanAssignmentSession({
    ownerUid,
    moduleSlug: moduleResult.moduleSlug,
    moduleSessionId: moduleResult.sessionId,
  }, storage);
  if (!session) return null;

  const questionResults = moduleResult.questions.map((question) => ({
    storageId: question.storageId,
    domain: question.domain,
    skill: question.skill,
    attemptCount: question.isAnswered ? 1 : 0,
    firstAttemptCorrect:
      question.status === "correct-later" ? false : question.isCorrect,
    isCorrect: question.isCorrect,
    timeSpentSeconds: question.timeSpentSeconds,
  }));

  return completeStudyPlanAssignment(ownerUid, {
    sourceSessionId: moduleResult.sessionId,
    elapsedSeconds: moduleResult.elapsedSeconds,
    questionCount: moduleResult.questionCount,
    attemptedCount: moduleResult.answeredCount,
    correctCount: moduleResult.correctCount,
    accuracy: moduleResult.accuracy,
    questionResults,
    missedQuestionIds: questionResults
      .filter((question) => !question.firstAttemptCorrect)
      .map((question) => question.storageId),
    missedSkills: [...new Set(
      questionResults
        .filter((question) => !question.firstAttemptCorrect)
        .map((question) => question.skill),
    )],
  }, storage);
};

export const completeStudyPlanPracticeSetAssignment = (
  practiceRunId: string,
  ownerUid: string | null,
  summary: Pick<CompletionSummary, "questionCount"> = {},
  storage: StorageLike | null = getDefaultStorage(),
): StudyPlanAssignmentResult | null => {
  const session = getMatchingStudyPlanAssignmentSession({ ownerUid, practiceRunId }, storage);
  return session
    ? completeStudyPlanAssignment(ownerUid, { ...summary, sourceSessionId: practiceRunId }, storage)
    : null;
};

export const getStudyPlanAssignmentResult = (
  storage: StorageLike | null = getDefaultStorage(),
): StudyPlanAssignmentResult | null => {
  if (!storage) return null;
  const result = readJson<StudyPlanAssignmentResult>(storage, STUDY_PLAN_ASSIGNMENT_RESULT_STORAGE_KEY);
  return isValidResult(result) ? result : null;
};

export const consumeStudyPlanAssignmentResult = (
  storage: StorageLike | null = getDefaultStorage(),
): StudyPlanAssignmentResult | null => {
  const result = getStudyPlanAssignmentResult(storage);
  if (!result || !storage) return result;
  storage.removeItem(STUDY_PLAN_ASSIGNMENT_RESULT_STORAGE_KEY);
  const session = getStudyPlanAssignmentSession(storage);
  if (session?.context.assignmentId === result.assignmentId) {
    storage.removeItem(STUDY_PLAN_ASSIGNMENT_STORAGE_KEY);
  }
  return result;
};

export const clearStudyPlanAssignment = (
  storage: StorageLike | null = getDefaultStorage(),
): void => {
  storage?.removeItem(STUDY_PLAN_ASSIGNMENT_STORAGE_KEY);
  storage?.removeItem(STUDY_PLAN_ASSIGNMENT_RESULT_STORAGE_KEY);
};
