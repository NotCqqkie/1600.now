import {
  generateStudyPlan,
  normalizeStudyPlanSettings,
  studyPlanFocusAreas,
  toDateKey,
  type StudyPlanFocusId,
  type StudyPlanProgressRecord,
  type StudyPlanSettings,
  type StudyPlanTask,
  type StudyPlanTaskAction,
} from "@/lib/studyPlan/studyPlanEngine";
import type {
  ParsedScoreReport,
  ScoreReportFocusId,
  ScoreReportSource,
} from "@/lib/studyPlan/scoreReportParser";

export const STUDY_PLAN_SCHEMA_VERSION = 2 as const;
const LEGACY_MIGRATION_UPDATED_AT = 1;

export interface StudyPlanScoreDomainSummary {
  id: ScoreReportFocusId;
  section: "Math" | "Reading and Writing";
  proficiency?: number;
  performanceRange?: string;
  performanceMidpoint?: number;
  percent?: number;
  questionRange?: string;
}

export interface StudyPlanScoreSummary {
  source: ScoreReportSource;
  importedAt: number;
  totalScore?: number;
  readingWritingScore?: number;
  mathScore?: number;
  domains: StudyPlanScoreDomainSummary[];
  recommendedFocus: ScoreReportFocusId[];
  warnings: string[];
}

export interface StudyPlanDocumentV2 {
  schemaVersion: typeof STUDY_PLAN_SCHEMA_VERSION;
  settings: StudyPlanSettings;
  scoreSummary?: StudyPlanScoreSummary;
  tasks: StudyPlanTask[];
  progress: Record<string, StudyPlanProgressRecord>;
  updatedAt: number;
}

export interface LegacyStudyPlanData {
  settings?: unknown;
  progress?: unknown;
  scoreReport?: unknown;
  snapshot?: unknown;
}

type UnknownRecord = Record<string, unknown>;

const knownFocusIds = new Set(studyPlanFocusAreas.map((area) => area.id));
const scoreFocusIds = new Set(
  studyPlanFocusAreas
    .filter((area) => area.id !== "Pacing")
    .map((area) => area.id as ScoreReportFocusId),
);
const taskTypes = new Set(["diagnostic", "lesson", "timed-set", "module", "review", "checklist"]);
const actionKinds = new Set(["lesson", "missed-review", "timed-set", "module", "checklist"]);
const confidenceValues = new Set(["hard", "okay", "easy"]);
const scoreReportWarnings = new Set([
  "Could not confidently find the total score.",
  "Could not confidently find the Reading and Writing score.",
  "Could not confidently find the Math score.",
  "The total score did not match the section scores.",
  "Could not confidently read enough Knowledge and Skills proficiency bars or performance ranges.",
]);

const isRecord = (value: unknown): value is UnknownRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isIntegerBetween = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && Number(value) >= min && Number(value) <= max;

const isShortString = (value: unknown, max = 500): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;

const isDateKey = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
};

const isStringArray = (value: unknown, maxItems: number, maxLength = 500): value is string[] =>
  Array.isArray(value)
  && value.length <= maxItems
  && value.every((item) => typeof item === "string" && item.length <= maxLength);

const isFocusId = (value: unknown): value is StudyPlanFocusId =>
  typeof value === "string" && knownFocusIds.has(value as StudyPlanFocusId);

const isScoreFocusId = (value: unknown): value is ScoreReportFocusId =>
  typeof value === "string" && scoreFocusIds.has(value as ScoreReportFocusId);

const isValidSettings = (value: unknown): value is StudyPlanSettings => {
  if (!isRecord(value)) return false;
  if (typeof value.setupComplete !== "boolean") return false;
  if (!isDateKey(value.startDate) || !isDateKey(value.satDate) || value.startDate >= value.satDate) return false;
  if (!isIntegerBetween(value.targetScore, 400, 1600) || Number(value.targetScore) % 10 !== 0) return false;
  if (!isIntegerBetween(value.currentMath, 200, 800) || Number(value.currentMath) % 10 !== 0) return false;
  if (!isIntegerBetween(value.currentReadingWriting, 200, 800) || Number(value.currentReadingWriting) % 10 !== 0) return false;
  if (!isIntegerBetween(value.minutesPerDay, 15, 150)) return false;
  if (value.pacingMode !== "steady" && value.pacingMode !== "tighten") return false;
  if (!Array.isArray(value.freeWeekdays)
      || value.freeWeekdays.length < 1
      || value.freeWeekdays.length > 7
      || !value.freeWeekdays.every((day) => isIntegerBetween(day, 0, 6))) return false;
  if (!Array.isArray(value.focus)
      || value.focus.length < 1
      || value.focus.length > knownFocusIds.size
      || !value.focus.every(isFocusId)) return false;
  if (!isRecord(value.intensity)) return false;
  if (!value.focus.every((focus) => {
    const intensity = value.intensity[focus];
    return intensity === "light" || intensity === "normal" || intensity === "heavy";
  })) return false;
  return Array.isArray(value.blackoutDates)
    && value.blackoutDates.length <= 730
    && value.blackoutDates.every(isDateKey);
};

const isValidAction = (value: unknown): value is StudyPlanTaskAction => {
  if (!isRecord(value) || typeof value.kind !== "string" || !actionKinds.has(value.kind)) return false;
  if (value.kind === "lesson") {
    return isShortString(value.skill, 200)
      && isShortString(value.href, 500)
      && value.href.startsWith("/");
  }
  if (value.kind === "missed-review") {
    return isShortString(value.sourceAssignmentId, 300)
      && Array.isArray(value.questionRefs)
      && value.questionRefs.length <= 100
      && value.questionRefs.every((reference) => isRecord(reference)
        && (reference.subject === "math" || reference.subject === "reading")
        && isShortString(reference.sourceId, 300)
        && (reference.bankType === "past" || reference.bankType === "unofficial")
        && isShortString(reference.storageId, 300))
      && isIntegerBetween(value.timeLimitMinutes, 1, 240);
  }
  if (value.kind === "timed-set") {
    return (value.subject === "math" || value.subject === "reading")
      && (value.filterType === "domain" || value.filterType === "skill")
      && isShortString(value.filterValue, 300)
      && isIntegerBetween(value.questionCount, 1, 100)
      && isIntegerBetween(value.timeLimitMinutes, 1, 240)
      && isStringArray(value.excludeSkills, 100, 300);
  }
  if (value.kind === "module") {
    return (value.subject === "math" || value.subject === "reading")
      && isShortString(value.moduleSlug, 300)
      && isIntegerBetween(value.timeLimitMinutes, 1, 240);
  }
  return isStringArray(value.items, 100, 500) && value.items.length > 0;
};

const isValidTask = (value: unknown): value is StudyPlanTask => {
  if (!isRecord(value)) return false;
  const baseValid = isShortString(value.id, 300)
    && isDateKey(value.date)
    && isShortString(value.title, 500)
    && isIntegerBetween(value.minutes, 1, 240)
    && isIntegerBetween(value.workMinutes, 0, 240)
    && isIntegerBetween(value.reviewMinutes, 0, 240)
    && Number(value.workMinutes) + Number(value.reviewMinutes) === Number(value.minutes)
    && isFocusId(value.focus)
    && typeof value.type === "string"
    && taskTypes.has(value.type)
    && isShortString(value.detail, 2_000)
    && (value.locked === undefined || typeof value.locked === "boolean")
    && isValidAction(value.action);
  if (!baseValid) return false;
  const task = value as unknown as StudyPlanTask;
  if ((task.action.kind === "timed-set" || task.action.kind === "missed-review")
      && task.action.timeLimitMinutes > task.minutes) return false;
  if (task.action.kind === "module"
      && task.action.timeLimitMinutes + task.reviewMinutes > task.minutes) return false;
  return true;
};

const sanitizeAction = (action: StudyPlanTaskAction): StudyPlanTaskAction => {
  if (action.kind === "lesson") {
    return { kind: action.kind, skill: action.skill, href: action.href };
  }
  if (action.kind === "missed-review") {
    return {
      kind: action.kind,
      sourceAssignmentId: action.sourceAssignmentId,
      questionRefs: action.questionRefs.map((reference) => ({
        subject: reference.subject,
        sourceId: reference.sourceId,
        bankType: reference.bankType,
        storageId: reference.storageId,
      })),
      timeLimitMinutes: action.timeLimitMinutes,
    };
  }
  if (action.kind === "timed-set") {
    return {
      kind: action.kind,
      subject: action.subject,
      filterType: action.filterType,
      filterValue: action.filterValue,
      questionCount: action.questionCount,
      timeLimitMinutes: action.timeLimitMinutes,
      excludeSkills: [...action.excludeSkills],
    };
  }
  if (action.kind === "module") {
    return {
      kind: action.kind,
      subject: action.subject,
      moduleSlug: action.moduleSlug,
      timeLimitMinutes: action.timeLimitMinutes,
    };
  }
  return { kind: action.kind, items: [...action.items] };
};

const sanitizeTask = (task: StudyPlanTask): StudyPlanTask => ({
  id: task.id,
  date: task.date,
  title: task.title,
  minutes: task.minutes,
  workMinutes: task.workMinutes,
  reviewMinutes: task.reviewMinutes,
  focus: task.focus,
  type: task.type,
  detail: task.detail,
  action: sanitizeAction(task.action),
  ...(task.locked === undefined ? {} : { locked: task.locked }),
});

const isValidProgressRecord = (value: unknown): value is StudyPlanProgressRecord => {
  if (!isRecord(value) || typeof value.completed !== "boolean") return false;
  if (value.skipped !== undefined && typeof value.skipped !== "boolean") return false;
  if (value.completedAt !== undefined
      && (typeof value.completedAt !== "string"
        || value.completedAt.length > 50
        || !Number.isFinite(Date.parse(value.completedAt)))) return false;
  if (value.missedReviewCompletedAt !== undefined
      && (typeof value.missedReviewCompletedAt !== "string"
        || value.missedReviewCompletedAt.length > 50
        || !Number.isFinite(Date.parse(value.missedReviewCompletedAt)))) return false;
  if (value.confidence !== undefined
      && (typeof value.confidence !== "string" || !confidenceValues.has(value.confidence))) return false;
  if (value.accuracy !== undefined
      && (!isFiniteNumber(value.accuracy) || value.accuracy < 0 || value.accuracy > 100)) return false;
  if (value.elapsedSeconds !== undefined && !isIntegerBetween(value.elapsedSeconds, 0, 86_400)) return false;
  if (value.missedSkills !== undefined && !isStringArray(value.missedSkills, 100, 300)) return false;
  if (value.rebalanceDecision !== undefined
      && value.rebalanceDecision !== "applied"
      && value.rebalanceDecision !== "kept") return false;
  return value.missedQuestionRefs === undefined || (
    Array.isArray(value.missedQuestionRefs)
    && value.missedQuestionRefs.length <= 100
    && value.missedQuestionRefs.every((reference) => isRecord(reference)
      && (reference.subject === "math" || reference.subject === "reading")
      && isShortString(reference.sourceId, 300)
      && (reference.bankType === "past" || reference.bankType === "unofficial")
      && isShortString(reference.storageId, 300))
  );
};

const sanitizeProgressRecord = (record: StudyPlanProgressRecord): StudyPlanProgressRecord => ({
  completed: record.completed,
  ...(record.skipped === undefined ? {} : { skipped: record.skipped }),
  ...(record.completedAt === undefined ? {} : { completedAt: record.completedAt }),
  ...(record.missedReviewCompletedAt === undefined ? {} : { missedReviewCompletedAt: record.missedReviewCompletedAt }),
  ...(record.confidence === undefined ? {} : { confidence: record.confidence }),
  ...(record.accuracy === undefined ? {} : { accuracy: record.accuracy }),
  ...(record.elapsedSeconds === undefined ? {} : { elapsedSeconds: record.elapsedSeconds }),
  ...(record.missedSkills === undefined ? {} : { missedSkills: [...record.missedSkills] }),
  ...(record.rebalanceDecision === undefined ? {} : { rebalanceDecision: record.rebalanceDecision }),
  ...(record.missedQuestionRefs === undefined ? {} : {
    missedQuestionRefs: record.missedQuestionRefs.map((reference) => ({ ...reference })),
  }),
});

const sanitizeSettings = (settings: StudyPlanSettings): StudyPlanSettings => {
  const intensity = studyPlanFocusAreas.reduce((result, area) => {
    const value = settings.intensity[area.id];
    result[area.id] = value === "light" || value === "heavy" ? value : "normal";
    return result;
  }, {} as StudyPlanSettings["intensity"]);
  return {
    setupComplete: settings.setupComplete,
    startDate: settings.startDate,
    satDate: settings.satDate,
    targetScore: settings.targetScore,
    currentMath: settings.currentMath,
    currentReadingWriting: settings.currentReadingWriting,
    minutesPerDay: settings.minutesPerDay,
    pacingMode: settings.pacingMode,
    freeWeekdays: Array.from(new Set(settings.freeWeekdays)).sort((left, right) => left - right),
    focus: Array.from(new Set(settings.focus)),
    intensity,
    blackoutDates: Array.from(new Set(settings.blackoutDates)).sort(),
  };
};

const optionalScore = (value: unknown, min: number, max: number) =>
  value === undefined || (isIntegerBetween(value, min, max) && Number(value) % 10 === 0);

const isValidScoreDomainSummary = (value: unknown): value is StudyPlanScoreDomainSummary => {
  if (!isRecord(value) || !isScoreFocusId(value.id)) return false;
  if (value.section !== "Math" && value.section !== "Reading and Writing") return false;
  if (value.proficiency !== undefined && !isIntegerBetween(value.proficiency, 1, 7)) return false;
  if (value.performanceRange !== undefined
      && (typeof value.performanceRange !== "string" || !/^\d{3}-\d{3}$/.test(value.performanceRange))) return false;
  if (value.performanceMidpoint !== undefined
      && (!isFiniteNumber(value.performanceMidpoint) || value.performanceMidpoint < 200 || value.performanceMidpoint > 800)) return false;
  if (value.percent !== undefined
      && (!isFiniteNumber(value.percent) || value.percent < 0 || value.percent > 100)) return false;
  return value.questionRange === undefined
    || (typeof value.questionRange === "string" && value.questionRange.length <= 20);
};

const isValidScoreSummary = (value: unknown): value is StudyPlanScoreSummary => {
  if (!isRecord(value)) return false;
  if (value.source !== "pdf-text" && value.source !== "image-ocr") return false;
  if (!isIntegerBetween(value.importedAt, 1, Number.MAX_SAFE_INTEGER)) return false;
  if (!optionalScore(value.totalScore, 400, 1600)) return false;
  if (!optionalScore(value.readingWritingScore, 200, 800)) return false;
  if (!optionalScore(value.mathScore, 200, 800)) return false;
  if (!Array.isArray(value.domains)
      || value.domains.length > scoreFocusIds.size
      || !value.domains.every(isValidScoreDomainSummary)) return false;
  if (!Array.isArray(value.recommendedFocus)
      || value.recommendedFocus.length > scoreFocusIds.size
      || !value.recommendedFocus.every(isScoreFocusId)) return false;
  return isStringArray(value.warnings, 30, 500)
    && value.warnings.every((warning) => scoreReportWarnings.has(warning));
};

const hasUsableScoreEvidence = (summary: StudyPlanScoreSummary) => {
  const hasConsistentScores = summary.totalScore !== undefined
    && summary.readingWritingScore !== undefined
    && summary.mathScore !== undefined
    && summary.totalScore === summary.readingWritingScore + summary.mathScore;
  const evidencedDomains = summary.domains.filter((domain) =>
    domain.proficiency !== undefined || domain.performanceMidpoint !== undefined).length;
  return hasConsistentScores || evidencedDomains >= 2;
};

const sanitizeScoreSummary = (summary: StudyPlanScoreSummary): StudyPlanScoreSummary => ({
  source: summary.source,
  importedAt: summary.importedAt,
  ...(summary.totalScore === undefined ? {} : { totalScore: summary.totalScore }),
  ...(summary.readingWritingScore === undefined ? {} : { readingWritingScore: summary.readingWritingScore }),
  ...(summary.mathScore === undefined ? {} : { mathScore: summary.mathScore }),
  domains: summary.domains.map((domain) => ({
    id: domain.id,
    section: domain.section,
    ...(domain.proficiency === undefined ? {} : { proficiency: domain.proficiency }),
    ...(domain.performanceRange === undefined ? {} : { performanceRange: domain.performanceRange }),
    ...(domain.performanceMidpoint === undefined ? {} : { performanceMidpoint: domain.performanceMidpoint }),
    ...(domain.percent === undefined ? {} : { percent: domain.percent }),
    ...(domain.questionRange === undefined ? {} : { questionRange: domain.questionRange }),
  })),
  recommendedFocus: Array.from(new Set(summary.recommendedFocus)),
  warnings: summary.warnings.filter((warning) => scoreReportWarnings.has(warning)),
});

export const createStudyPlanScoreSummary = (
  report: ParsedScoreReport,
  importedAt = Date.now(),
): StudyPlanScoreSummary => sanitizeScoreSummary({
  source: report.source,
  importedAt,
  ...(report.totalScore === undefined ? {} : { totalScore: report.totalScore }),
  ...(report.readingWritingScore === undefined ? {} : { readingWritingScore: report.readingWritingScore }),
  ...(report.mathScore === undefined ? {} : { mathScore: report.mathScore }),
  domains: report.domains
    .filter((domain) => isScoreFocusId(domain.id))
    .map((domain) => ({
      id: domain.id,
      section: domain.section,
      ...(domain.proficiency === undefined ? {} : { proficiency: domain.proficiency }),
      ...(domain.performanceRange === undefined ? {} : { performanceRange: domain.performanceRange }),
      ...(domain.performanceMidpoint === undefined ? {} : { performanceMidpoint: domain.performanceMidpoint }),
      ...(domain.percent === undefined ? {} : { percent: domain.percent }),
      ...(domain.questionRange === undefined ? {} : { questionRange: domain.questionRange }),
    })),
  recommendedFocus: report.recommendedFocus.filter(isScoreFocusId),
  warnings: report.warnings.filter((warning) => scoreReportWarnings.has(warning)),
});

export const sanitizeStudyPlanDocument = (value: unknown): StudyPlanDocumentV2 | null => {
  if (!isRecord(value) || value.schemaVersion !== STUDY_PLAN_SCHEMA_VERSION) return null;
  if (!isValidSettings(value.settings)) return null;
  if (!Array.isArray(value.tasks) || value.tasks.length > 1_000 || !value.tasks.every(isValidTask)) return null;
  if (!isRecord(value.progress)) return null;
  if (!isIntegerBetween(value.updatedAt, 1, Number.MAX_SAFE_INTEGER)) return null;
  const scoreSummary = value.scoreSummary;
  let sanitizedScoreSummary: StudyPlanScoreSummary | undefined;
  if (scoreSummary !== undefined) {
    if (!isValidScoreSummary(scoreSummary)) return null;
    const candidate = sanitizeScoreSummary(scoreSummary);
    if (hasUsableScoreEvidence(candidate)) sanitizedScoreSummary = candidate;
  }

  const taskIds = new Set(value.tasks.map((task) => task.id));
  const progress: Record<string, StudyPlanProgressRecord> = {};
  for (const [taskId, record] of Object.entries(value.progress)) {
    if (!taskIds.has(taskId) || !isValidProgressRecord(record)) continue;
    progress[taskId] = sanitizeProgressRecord(record);
  }

  return {
    schemaVersion: STUDY_PLAN_SCHEMA_VERSION,
    settings: sanitizeSettings(value.settings),
    ...(sanitizedScoreSummary === undefined ? {} : { scoreSummary: sanitizedScoreSummary }),
    tasks: value.tasks.map(sanitizeTask),
    progress,
    updatedAt: value.updatedAt,
  };
};

export const createStudyPlanDocument = (
  input: Omit<StudyPlanDocumentV2, "schemaVersion" | "updatedAt"> & { updatedAt?: number },
): StudyPlanDocumentV2 => {
  const document = sanitizeStudyPlanDocument({
    schemaVersion: STUDY_PLAN_SCHEMA_VERSION,
    ...input,
    updatedAt: input.updatedAt ?? Date.now(),
  });
  if (!document) throw new Error("Invalid study plan document.");
  return document;
};

const legacyProgress = (
  value: unknown,
  taskIds: Set<string>,
): Record<string, StudyPlanProgressRecord> => {
  if (!isRecord(value)) return {};
  const completed = isRecord(value.completed) ? value.completed : {};
  const confidence = isRecord(value.confidence) ? value.confidence : {};
  const progress: Record<string, StudyPlanProgressRecord> = {};
  for (const taskId of taskIds) {
    const completedValue = completed[taskId];
    const confidenceValue = confidence[taskId];
    if (completedValue !== true && !confidenceValues.has(String(confidenceValue))) continue;
    progress[taskId] = {
      completed: completedValue === true,
      ...(confidenceValues.has(String(confidenceValue))
        ? { confidence: confidenceValue as StudyPlanProgressRecord["confidence"] }
        : {}),
    };
  }
  return progress;
};

const lockedLegacyTasks = (
  value: unknown,
  progressValue: unknown,
  today: string,
): StudyPlanTask[] => {
  if (!Array.isArray(value)) return [];
  const completed = isRecord(progressValue) && isRecord(progressValue.completed)
    ? progressValue.completed
    : {};
  const tasks: StudyPlanTask[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate)
        || !isShortString(candidate.id, 300)
        || !isDateKey(candidate.date)) continue;
    if (candidate.date >= today && completed[candidate.id] !== true) continue;
    const rawMinutes = isFiniteNumber(candidate.minutes) ? Math.round(candidate.minutes) : 15;
    const minutes = Math.min(240, Math.max(1, rawMinutes));
    const migratedFocus = candidate.focus === "Full Practice" ? "Pacing" : candidate.focus;
    const focus = isFocusId(migratedFocus) ? migratedFocus : "Pacing";
    tasks.push({
      id: candidate.id,
      date: candidate.date,
      title: isShortString(candidate.title, 500) ? candidate.title : "Previous planner assignment",
      minutes,
      workMinutes: minutes,
      reviewMinutes: 0,
      focus,
      type: "checklist",
      detail: isShortString(candidate.detail, 2_000)
        ? candidate.detail
        : "Retained from the previous version of your study plan.",
      action: {
        kind: "checklist",
        items: ["This assignment was retained from your previous study plan."],
      },
      locked: true,
    });
  }
  return tasks;
};

export const migrateLegacyStudyPlanData = (
  legacy: LegacyStudyPlanData,
  now = Date.now(),
): StudyPlanDocumentV2 | null => {
  try {
    if (!isRecord(legacy.settings)) return null;
    const today = toDateKey(new Date(now));
    const settings = normalizeStudyPlanSettings(legacy.settings as Partial<StudyPlanSettings>, today);
    if (!settings.satDate || settings.startDate >= settings.satDate) return null;

    const reportRecord = isRecord(legacy.scoreReport) ? legacy.scoreReport : null;
    const parsedReport = reportRecord && isRecord(reportRecord.parsed)
      ? reportRecord.parsed as unknown as ParsedScoreReport
      : null;
    let scoreSummary: StudyPlanScoreSummary | undefined;
    if (parsedReport) {
      try {
        const addedAt = typeof reportRecord?.addedAt === "string" ? Date.parse(reportRecord.addedAt) : NaN;
        const candidate = createStudyPlanScoreSummary(parsedReport, Number.isFinite(addedAt) ? addedAt : now);
        scoreSummary = hasUsableScoreEvidence(candidate) ? candidate : undefined;
      } catch {
        scoreSummary = undefined;
      }
    }

    const generatedTasks = generateStudyPlan(settings, { hasImportedReport: !!scoreSummary, today });
    const previousTasks = lockedLegacyTasks(legacy.snapshot, legacy.progress, today);
    const previousDates = new Set(previousTasks.map((task) => task.date));
    const tasks = [
      ...previousTasks,
      ...generatedTasks.filter((task) => !previousDates.has(task.date)),
    ].sort((left, right) => `${left.date}-${left.id}`.localeCompare(`${right.date}-${right.id}`));
    const progress = legacyProgress(legacy.progress, new Set(tasks.map((task) => task.id)));
    return createStudyPlanDocument({
      settings,
      ...(scoreSummary ? { scoreSummary } : {}),
      tasks,
      progress,
      updatedAt: LEGACY_MIGRATION_UPDATED_AT,
    });
  } catch {
    return null;
  }
};

export const removeStudyPlanScoreSummary = (
  document: StudyPlanDocumentV2,
  updatedAt = Date.now(),
): StudyPlanDocumentV2 => createStudyPlanDocument({
  settings: document.settings,
  tasks: document.tasks,
  progress: document.progress,
  updatedAt: Math.max(updatedAt, document.updatedAt + 1),
});
