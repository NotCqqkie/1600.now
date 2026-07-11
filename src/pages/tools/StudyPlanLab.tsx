import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleOff,
  Clock3,
  FileText,
  MoveRight,
  Printer,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  buildModulePracticeSet,
  getPracticeModule,
} from "@/data/modulePracticeBank";
import type {
  EnglishDomain,
  EnglishSkill,
  MathDomain,
  MathSkill,
} from "@/data/questionCategories";
import { allEnglishDomains, allMathDomains } from "@/data/questionCategories";
import {
  loadQuestionsByDomain,
  loadQuestionsBySkill,
  loadSourceBankQuestionBySourceId,
  type BankQuestion,
} from "@/data/questionBank";
import { useAuth } from "@/contexts/AuthContext";
import {
  trackStudyPlanCalendarNavigation,
  trackStudyPlanPrint,
  trackStudyPlanRebalance,
  trackStudyPlanSaved,
  trackStudyPlanTaskCompletion,
  trackStudyPlanTaskLaunch,
  trackStudyPlanUpload,
  trackToolComplete,
} from "@/lib/analytics";
import {
  clearModulePracticeSession,
  createModulePracticeSession,
  getModulePracticeSession,
  saveModulePracticeSession,
  type ModulePracticeSessionMeta,
} from "@/lib/practice/modulePracticeSession";
import {
  PRACTICE_RUN_STORAGE_KEY,
  PRACTICE_SET_STORAGE_KEY,
  PRACTICE_SET_TOTAL_STORAGE_KEY,
  buildPracticeRunId,
  writePracticeLaunchStorage,
} from "@/lib/practice/practiceRunStorage";
import {
  buildModulePracticeQuestionRoute,
  buildPracticeBankQuestionRoute,
} from "@/lib/practice/practiceBankRoutes";
import {
  beginStudyPlanAssignment,
  clearStudyPlanAssignment,
  consumeStudyPlanAssignmentResult,
  getStudyPlanAssignmentResult,
  getStudyPlanAssignmentSession,
  resumeStudyPlanAssignment,
  type StudyPlanAssignmentSession,
  type StudyPlanAssignmentQuestionRef,
  type StudyPlanAssignmentResult,
} from "@/lib/studyPlan/assignmentContext";
import {
  addDays,
  availableOfficialSatDates,
  createDefaultStudyPlanSettings,
  currentDateKey,
  daysBetween,
  formatStudyPlanDate,
  generateStudyPlan,
  isStudyPlanDay,
  mergeLockedStudyPlan,
  normalizeStudyPlanSettings,
  studyPlanFocusAreas,
  studyPlanFocusById,
  studyPlanFocusForSkills,
  taskFitsDailyBudget,
  toDateKey,
  validateStudyPlanSettings,
  weekdayLabels,
  type StudyPlanFocusId,
  type StudyPlanIntensity,
  type StudyPlanProgressRecord,
  type StudyPlanQuestionRef,
  type StudyPlanSettings,
  type StudyPlanTask,
  type StudyPlanTaskAction,
  type StudyPlanTaskType,
} from "@/lib/studyPlan/studyPlanEngine";
import {
  parseScoreReportFile,
  type ParsedScoreReport,
  type ScoreReportParseProgress,
} from "@/lib/studyPlan/scoreReportParser";
import { buildScoreReportReview } from "@/lib/studyPlan/scoreReportReview";
import {
  createStudyPlanDocument,
  createStudyPlanScoreSummary,
  type StudyPlanDocumentV2,
  type StudyPlanScoreSummary,
} from "@/lib/studyPlan/studyPlanDocument";
import {
  deleteStudyPlanDocument,
  readStudyPlanBackup,
  readStudyPlanDocument,
  restoreStudyPlanBackup,
  saveStudyPlanDocument,
  syncStudyPlanDocument,
  type StudyPlanBackupV2,
} from "@/lib/studyPlan/studyPlanStorage";
import {
  isHydratedStudyPlanOwner,
  isStudyPlanOwnerReady,
  type StudyPlanOwnerUid,
} from "@/lib/studyPlan/studyPlanOwnership";
import {
  durableStudyPlanSaveDocument,
  isStudyPlanDeletionDurable,
  sameStudyPlanDocumentContent,
  studyPlanPersistenceStatusText,
  studyPlanSyncStatusForSaveResult,
  type StudyPlanSaveUiStatus,
  type StudyPlanSyncUiStatus,
} from "@/lib/studyPlan/studyPlanPersistenceUi";

interface StudyPlanLabProps {
  embedded?: boolean;
}

interface LegacyProgress {
  completed?: Record<string, boolean>;
  confidence?: Record<string, "hard" | "okay" | "easy">;
}

interface ModuleConflict {
  task: StudyPlanTask;
  moduleSlug: string;
  existing: ModulePracticeSessionMeta;
  matchesAssignmentSettings: boolean;
}

interface PracticeConflict {
  task: StudyPlanTask;
  existing: StudyPlanAssignmentSession;
  stored: StoredPracticeItem[];
}

interface OwnerActionGuard {
  ownerUid: string | null;
  epoch: number;
}

interface StudyPlanEditBaseline {
  settings: StudyPlanSettings;
  report?: StudyPlanScoreSummary;
  snapshot: StudyPlanTask[];
  progress: Record<string, StudyPlanProgressRecord>;
}

interface RebalanceProposal {
  strengthen: StudyPlanFocusId;
  reduce?: StudyPlanFocusId;
  assignmentId: string;
  accuracy: number;
  missedQuestionRefs: StudyPlanQuestionRef[];
}

interface PersistStudyPlanOverrides {
  settings?: StudyPlanSettings;
  report?: StudyPlanScoreSummary;
  removeReport?: boolean;
  snapshot?: StudyPlanTask[];
  progress?: Record<string, StudyPlanProgressRecord>;
}

const LEGACY_SETTINGS_KEY = "1600now-study-plan-lab";
const LEGACY_PROGRESS_KEY = "1600now-study-plan-progress";
const LEGACY_REPORT_KEY = "1600now-study-plan-score-report";
const LEGACY_SNAPSHOT_KEY = "1600now-study-plan-snapshot";

const typeLabels: Record<StudyPlanTaskType, string> = {
  diagnostic: "Diagnostic",
  lesson: "Lesson",
  "timed-set": "Timed set",
  module: "Timed module",
  review: "Missed review",
  checklist: "Offline checklist",
};

const typeClasses: Record<StudyPlanTaskType, string> = {
  diagnostic: "border-cobalt/40 bg-cobalt/10 text-cobalt-ink dark:text-cobalt",
  lesson: "border-ds-accent-deep/50 bg-ds-accent/20 text-ink",
  "timed-set": "border-fuchsia-400/40 bg-fuchsia-300/10 text-fuchsia-700 dark:text-fuchsia-200",
  module: "border-amber-400/50 bg-amber-300/15 text-amber-700 dark:text-amber-200",
  review: "border-ds-good/40 bg-ds-good/10 text-green-700 dark:text-green-300",
  checklist: "border-ds-line/50 bg-muted/60 text-ink-mid",
};

const printCss = `
  [data-study-plan-lab] .text-ink-muted,
  [data-study-plan-lab] .text-ink-muted\\/50 { color: rgb(var(--ink-mid)) !important; }
  @media print {
    body aside, body nav, [data-print-hidden], [data-sonner-toaster] { display: none !important; }
    body:has([data-study-plan-lab]) [data-study-plan-lab] { max-width: none !important; margin: 0 !important; padding: 0 !important; }
    [data-print-plan] { display: block !important; }
  }
`;

const loadJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};

const isConsistentReport = (parsed: ParsedScoreReport) =>
  typeof parsed.totalScore === "number" &&
  typeof parsed.readingWritingScore === "number" &&
  typeof parsed.mathScore === "number" &&
  parsed.totalScore === parsed.readingWritingScore + parsed.mathScore;

const hasDomainEvidence = (parsed: ParsedScoreReport) =>
  parsed.domains.filter((domain) => typeof domain.proficiency === "number" || typeof domain.performanceMidpoint === "number").length >= 2;

const isUsableReport = (parsed: ParsedScoreReport) =>
  isConsistentReport(parsed) || hasDomainEvidence(parsed);

const progressFromLegacy = (legacy: LegacyProgress): Record<string, StudyPlanProgressRecord> => {
  const result: Record<string, StudyPlanProgressRecord> = {};
  for (const [taskId, completed] of Object.entries(legacy.completed ?? {})) {
    result[taskId] = { completed, confidence: legacy.confidence?.[taskId] };
  }
  return result;
};

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const selectQuestions = (questions: BankQuestion[], action: Extract<StudyPlanTaskAction, { kind: "timed-set" }>, seed: string) =>
  questions
    .filter((question) => !action.excludeSkills.includes(question.category.skill))
    .map((question, index) => ({ question, rank: hashString(`${seed}:${question.stableId}:${index}`) }))
    .sort((left, right) => left.rank - right.rank || left.question.stableId.localeCompare(right.question.stableId))
    .slice(0, action.questionCount)
    .map(({ question }) => question);

const selectDiagnosticQuestions = (
  questions: BankQuestion[],
  action: Extract<StudyPlanTaskAction, { kind: "timed-set" }>,
  seed: string,
) => {
  const rankedByDomain = new Map<string, BankQuestion[]>();
  for (const question of questions.filter((candidate) => !action.excludeSkills.includes(candidate.category.skill))) {
    const current = rankedByDomain.get(question.category.domain) ?? [];
    current.push(question);
    rankedByDomain.set(question.category.domain, current);
  }
  for (const [domain, domainQuestions] of rankedByDomain) {
    rankedByDomain.set(domain, domainQuestions.sort((left, right) =>
      hashString(`${seed}:${left.stableId}`) - hashString(`${seed}:${right.stableId}`)
      || left.stableId.localeCompare(right.stableId)));
  }
  const domains = Array.from(rankedByDomain.keys()).sort();
  const selected: BankQuestion[] = [];
  for (let round = 0; selected.length < action.questionCount; round += 1) {
    let added = false;
    for (const domain of domains) {
      const question = rankedByDomain.get(domain)?.[round];
      if (!question) continue;
      selected.push(question);
      added = true;
      if (selected.length === action.questionCount) break;
    }
    if (!added) break;
  }
  return selected;
};

const practiceItemsFor = (questions: BankQuestion[]) => questions.map((question, index) => ({
  subject: question.subject,
  id: question.id,
  sourceId: question.sourceId,
  bankType: question.bankType,
  storageId: question.stableId,
  domain: question.category.domain,
  skill: question.category.skill,
  index: index + 1,
}));

type StoredPracticeItem = {
  subject?: "math" | "reading";
  sourceId?: string;
  bankType?: "past" | "unofficial";
  storageId?: string;
  domain?: string;
  skill?: string;
};

const assignmentQuestionRefsFor = (items: StoredPracticeItem[]): StudyPlanAssignmentQuestionRef[] =>
  items.map((item) => ({
    subject: item.subject!,
    sourceId: item.sourceId!,
    bankType: item.bankType!,
    storageId: item.storageId!,
  }));

const storedPracticeSetMatches = (
  items: StoredPracticeItem[],
  refs: StudyPlanAssignmentQuestionRef[],
) => items.length === refs.length && items.every((item, index) => {
  const reference = refs[index];
  return Boolean(
    reference
    && item.subject === reference.subject
    && item.sourceId === reference.sourceId
    && item.bankType === reference.bankType
    && item.storageId === reference.storageId,
  );
});

const readStoredPracticeSet = (): StoredPracticeItem[] => {
  try {
    const value = JSON.parse(sessionStorage.getItem(PRACTICE_SET_STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value as StoredPracticeItem[] : [];
  } catch {
    return [];
  }
};

const practiceSessionMatchesTask = (
  session: StudyPlanAssignmentSession,
  task: StudyPlanTask,
  stored: StoredPracticeItem[],
) => {
  if (
    session.context.source.kind !== "practice-set"
    || session.context.timingMode.kind !== "countdown"
    || !storedPracticeSetMatches(stored, session.context.source.questionRefs)
  ) return false;
  const action = task.action;
  if (action.kind === "timed-set") {
    return session.context.timingMode.timeLimitSeconds === action.timeLimitMinutes * 60
      && stored.length === action.questionCount
      && stored.every((item) => item.subject === action.subject)
      && stored.every((item) => !item.skill || !action.excludeSkills.includes(item.skill))
      && (task.type === "diagnostic" || stored.every((item) => item.domain === action.filterValue));
  }
  if (action.kind === "missed-review") {
    return session.context.timingMode.timeLimitSeconds === action.timeLimitMinutes * 60
      && action.questionRefs.length === session.context.source.questionRefs.length
      && action.questionRefs.every((reference, index) => {
        const sessionReference = session.context.source.kind === "practice-set"
          ? session.context.source.questionRefs[index]
          : undefined;
        return Boolean(
          sessionReference
          && reference.subject === sessionReference.subject
          && reference.sourceId === sessionReference.sourceId
          && reference.bankType === sessionReference.bankType
          && reference.storageId === sessionReference.storageId,
        );
      });
  }
  return false;
};

const trackPendingPersistence = <T,>(
  pending: Set<Promise<unknown>>,
  promise: Promise<T>,
): Promise<T> => {
  pending.add(promise);
  void promise.then(
    () => pending.delete(promise),
    () => pending.delete(promise),
  );
  return promise;
};

const weekStartFor = (dateKey: string) => {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() - date.getDay());
  return toDateKey(date);
};

const printableWeeksFor = (tasks: StudyPlanTask[]) => {
  const groups = new Map<string, StudyPlanTask[]>();
  for (const task of tasks) groups.set(weekStartFor(task.date), [...(groups.get(weekStartFor(task.date)) ?? []), task]);
  return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([weekStart, weekTasks]) => ({
    weekStart,
    weekEnd: addDays(weekStart, 6),
    tasks: weekTasks,
    minutes: weekTasks.reduce((sum, task) => sum + task.minutes, 0),
  }));
};

const monthStartFor = (dateKey: string) => `${dateKey.slice(0, 7)}-01`;

const addMonths = (dateKey: string, amount: number) => {
  const date = new Date(`${monthStartFor(dateKey)}T12:00:00`);
  date.setMonth(date.getMonth() + amount);
  return toDateKey(date);
};

const calendarDaysForMonth = (monthStart: string) => {
  const first = new Date(`${monthStart}T12:00:00`);
  const gridStart = addDays(monthStart, -first.getDay());
  const nextMonth = addMonths(monthStart, 1);
  const count = Math.ceil((first.getDay() + daysBetween(monthStart, nextMonth)) / 7) * 7;
  return Array.from({ length: count }, (_, index) => addDays(gridStart, index));
};

const adjustableScheduleFingerprint = (
  tasks: StudyPlanTask[],
  progress: Record<string, StudyPlanProgressRecord>,
  today: string,
  satDate: string,
) => JSON.stringify(tasks
  .filter((task) => task.date > today)
  .filter((task) => daysBetween(task.date, satDate) > 6)
  .filter((task) => !progress[task.id]?.completed)
  .map((task) => ({
    id: task.id,
    date: task.date,
    title: task.title,
    minutes: task.minutes,
    focus: task.focus,
    type: task.type,
    action: task.action,
  })));

const buildRebalancedPlan = ({
  proposal,
  settings,
  snapshot,
  progress,
  currentTasks,
  today,
  hasImportedReport,
}: {
  proposal: RebalanceProposal;
  settings: StudyPlanSettings;
  snapshot: StudyPlanTask[];
  progress: Record<string, StudyPlanProgressRecord>;
  currentTasks: StudyPlanTask[];
  today: string;
  hasImportedReport: boolean;
}) => {
  const proposedSettings: StudyPlanSettings = {
    ...settings,
    focus: settings.focus.includes(proposal.strengthen)
      ? settings.focus
      : [...settings.focus, proposal.strengthen],
    intensity: {
      ...settings.intensity,
      [proposal.strengthen]: "heavy",
      ...(proposal.reduce ? { [proposal.reduce]: "light" } : {}),
    },
  };
  let nextTasks = mergeLockedStudyPlan(
    generateStudyPlan(proposedSettings, { today, hasImportedReport }),
    snapshot,
    progress,
    today,
    proposedSettings.minutesPerDay,
  );
  const scheduleChanged = adjustableScheduleFingerprint(nextTasks, progress, today, settings.satDate)
    !== adjustableScheduleFingerprint(currentTasks, progress, today, settings.satDate);
  let scheduledReview = false;
  if (proposal.missedQuestionRefs.length) {
    const reviewMinutes = Math.min(
      settings.minutesPerDay,
      Math.max(10, Math.ceil((proposal.missedQuestionRefs.length * 2) / 5) * 5),
    );
    const reviewQuestionRefs = proposal.missedQuestionRefs.slice(
      0,
      Math.max(1, Math.floor(reviewMinutes / 2)),
    );
    const dateMinutes = new Map<string, number>();
    for (const task of nextTasks) {
      dateMinutes.set(task.date, (dateMinutes.get(task.date) ?? 0) + task.minutes);
    }
    const candidates = nextTasks.filter((task) =>
      task.date > today
      && daysBetween(task.date, settings.satDate) > 6
      && !progress[task.id]?.completed
      && task.id !== proposal.assignmentId
      && (dateMinutes.get(task.date) ?? 0) - task.minutes + reviewMinutes <= settings.minutesPerDay,
    );
    const displaced = candidates.find((task) => task.focus === proposal.reduce) ?? candidates[0];
    if (displaced) {
      const reviewTask: StudyPlanTask = {
        id: `${proposal.assignmentId}-missed-review`,
        date: displaced.date,
        title: `${studyPlanFocusById.get(proposal.strengthen)?.label ?? proposal.strengthen} missed-question review`,
        minutes: reviewMinutes,
        workMinutes: reviewMinutes,
        reviewMinutes: 0,
        focus: proposal.strengthen,
        type: "review",
        detail: `Reopen ${reviewQuestionRefs.length} actual missed question${reviewQuestionRefs.length === 1 ? "" : "s"} from the completed assignment.`,
        action: {
          kind: "missed-review",
          sourceAssignmentId: proposal.assignmentId,
          questionRefs: reviewQuestionRefs,
          timeLimitMinutes: reviewMinutes,
        },
        locked: true,
      };
      nextTasks = [...nextTasks.filter((task) => task.id !== displaced.id), reviewTask]
        .sort((left, right) => `${left.date}-${left.id}`.localeCompare(`${right.date}-${right.id}`));
      scheduledReview = true;
    }
  }
  const actionable = scheduleChanged || scheduledReview;
  return {
    actionable,
    scheduleChanged,
    scheduledReview,
    nextSettings: scheduleChanged ? proposedSettings : settings,
    nextTasks: actionable ? nextTasks : currentTasks,
    changeCount: Number(scheduleChanged) + Number(scheduledReview),
  };
};

const actionLabel = (task: StudyPlanTask) => {
  if (task.action.kind === "lesson") return "Open skill guide";
  if (task.action.kind === "timed-set") return `Start ${task.action.questionCount}-question set`;
  if (task.action.kind === "module") return "Start timed Math module";
  if (task.action.kind === "missed-review") return "Review missed questions";
  return "";
};

const parseStageLabel = (progress: ScoreReportParseProgress | null) => {
  if (!progress) return "";
  if (progress.stage === "validating") return "Checking the file";
  if (progress.stage === "reading-pdf") return `Reading PDF${progress.page ? `, page ${progress.page} of ${progress.pageCount}` : ""}`;
  if (progress.stage === "rendering-page") return `Preparing page ${progress.page ?? ""}`.trim();
  if (progress.stage === "ocr") return `Reading image text${progress.page ? `, page ${progress.page} of ${progress.pageCount}` : ""}`;
  return "Report ready";
};

const sectionClass = "rounded-xl border border-border bg-card shadow-sm";

export const StudyPlanLab = ({ embedded = false }: StudyPlanLabProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const today = currentDateKey();
  const fallbackSettings = createDefaultStudyPlanSettings(today);
  const initialDocumentRef = useRef<StudyPlanDocumentV2 | null>();
  if (initialDocumentRef.current === undefined) {
    initialDocumentRef.current = readStudyPlanDocument(user?.uid ?? null) ?? readStudyPlanDocument(null);
  }
  const initialDocument = initialDocumentRef.current;
  const [settings, setSettings] = useState<StudyPlanSettings>(() =>
    initialDocument
      ? normalizeStudyPlanSettings(initialDocument.settings, today)
      : normalizeStudyPlanSettings(loadJson<Partial<StudyPlanSettings>>(LEGACY_SETTINGS_KEY, fallbackSettings), today),
  );
  const [progress, setProgress] = useState<Record<string, StudyPlanProgressRecord>>(() =>
    initialDocument?.progress ?? progressFromLegacy(loadJson<LegacyProgress>(LEGACY_PROGRESS_KEY, {})),
  );
  const [report, setReport] = useState<StudyPlanScoreSummary | undefined>(initialDocument?.scoreSummary);
  const [reportCandidate, setReportCandidate] = useState<ParsedScoreReport | null>(null);
  const [snapshot, setSnapshot] = useState<StudyPlanTask[]>(() => initialDocument?.tasks ?? loadJson<StudyPlanTask[]>(LEGACY_SNAPSHOT_KEY, []));
  const [view, setView] = useState<"dashboard" | "settings">("dashboard");
  const [selectedDate, setSelectedDate] = useState(settings.startDate);
  const [visibleMonth, setVisibleMonth] = useState(monthStartFor(settings.startDate));
  const [launchingTaskId, setLaunchingTaskId] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<ScoreReportParseProgress | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [lastUpload, setLastUpload] = useState<File | null>(null);
  const [moduleConflict, setModuleConflict] = useState<ModuleConflict | null>(null);
  const [practiceConflict, setPracticeConflict] = useState<PracticeConflict | null>(null);
  const [rebalance, setRebalance] = useState<RebalanceProposal | null>(null);
  const [blackoutDraft, setBlackoutDraft] = useState("");
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [hydratedOwnerUid, setHydratedOwnerUid] = useState<StudyPlanOwnerUid>(undefined);
  const [syncStatus, setSyncStatus] = useState<StudyPlanSyncUiStatus>("local");
  const [scheduleSaveStatus, setScheduleSaveStatus] = useState<StudyPlanSaveUiStatus>("idle");
  const [scheduleSaveError, setScheduleSaveError] = useState("");
  const [planDataError, setPlanDataError] = useState("");
  const [backup, setBackup] = useState<StudyPlanBackupV2 | null>(null);
  const [persistenceEnabled, setPersistenceEnabled] = useState(Boolean(initialDocument));
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const uploadSequenceRef = useRef(0);
  const uploadStartedAtRef = useRef(0);
  const previousUidRef = useRef<string | null>(user?.uid ?? null);
  const didSelectInitialTaskRef = useRef(false);
  const editBaselineRef = useRef<StudyPlanEditBaseline | null>(null);
  const persistenceEpochRef = useRef(0);
  const persistenceReadyRef = useRef(false);
  const hydratedOwnerUidRef = useRef<StudyPlanOwnerUid>(undefined);
  const autosaveTimerRef = useRef<number | null>(null);
  const pendingPersistenceRef = useRef<Set<Promise<unknown>>>(new Set());
  const currentUidRef = useRef<string | null>(user?.uid ?? null);
  const activeOwnerUid = user?.uid ?? null;
  const persistenceStatusText = studyPlanPersistenceStatusText({
    uid: activeOwnerUid,
    persistenceEnabled,
    saveStatus: scheduleSaveStatus,
    syncStatus,
  });
  const persistenceRetryNeeded = syncStatus === "error" || syncStatus === "unsaved";
  const plannerReady = isStudyPlanOwnerReady({
    authLoading,
    persistenceReady,
    hydratedOwnerUid,
    activeOwnerUid,
  });
  persistenceReadyRef.current = persistenceReady;
  hydratedOwnerUidRef.current = hydratedOwnerUid;
  const returnPath = embedded || location.pathname === "/sat-study-plan-generator"
    ? "/sat-study-plan-generator"
    : "/study-plan-lab";

  const generated = useMemo(() => generateStudyPlan(settings, { today, hasImportedReport: Boolean(report) }), [report, settings, today]);
  const tasks = useMemo(
    () => mergeLockedStudyPlan(generated, snapshot, progress, today, settings.minutesPerDay),
    [generated, progress, settings.minutesPerDay, snapshot, today],
  );
  const tasksByDate = useMemo(() => {
    const groups = new Map<string, StudyPlanTask[]>();
    for (const task of tasks) groups.set(task.date, [...(groups.get(task.date) ?? []), task]);
    return groups;
  }, [tasks]);
  const validationErrors = useMemo(() => validateStudyPlanSettings(settings, today), [settings, today]);
  const nextTask = tasks.find((task) => task.date >= today && !progress[task.id]?.completed);
  const overdueTasks = tasks.filter((task) => task.date < today && !progress[task.id]?.completed);
  const activePlan = plannerReady && settings.setupComplete && snapshot.length > 0 && validationErrors.length === 0;
  const setupMode = !activePlan || view === "settings";
  const isEditingExistingPlan = view === "settings" && editBaselineRef.current !== null;
  const selectedTasks = tasksByDate.get(selectedDate) ?? [];
  const monthDays = useMemo(() => calendarDaysForMonth(visibleMonth), [visibleMonth]);
  const minMonth = monthStartFor(settings.startDate);
  const maxMonth = settings.satDate ? monthStartFor(settings.satDate) : minMonth;
  const activeTaskCount = tasks.filter((task) => !progress[task.id]?.skipped).length;
  const totalMinutes = tasks.reduce((sum, task) => sum + (progress[task.id]?.skipped ? 0 : task.minutes), 0);
  const completedCount = tasks.filter((task) => progress[task.id]?.completed && !progress[task.id]?.skipped).length;
  const printableWeeks = useMemo(() => printableWeeksFor(tasks.filter((task) => !progress[task.id]?.skipped)), [progress, tasks]);
  const futureSatDates = availableOfficialSatDates(today);
  const pausedAssignment = getStudyPlanAssignmentSession();
  const tasksRef = useRef(tasks);
  const progressRef = useRef(progress);
  const persistedStateRef = useRef({ settings, report, snapshot, generated, progress });
  tasksRef.current = tasks;
  progressRef.current = progress;
  persistedStateRef.current = { settings, report, snapshot, generated, progress };
  const pendingAssignmentResult = getStudyPlanAssignmentResult();
  const unresolvedProgressTask = tasks.find((task) => {
    const record = progress[task.id];
    return record?.completed
      && record.accuracy !== undefined
      && record.accuracy < 80
      && !record.rebalanceDecision;
  });
  const pendingResultTask = pendingAssignmentResult
    && pendingAssignmentResult.ownerUid === (user?.uid ?? null)
    && !pendingAssignmentResult.assignmentId.endsWith("-missed-review")
    && pendingAssignmentResult.accuracy < 80
    ? tasks.find((task) => task.id === pendingAssignmentResult.assignmentId)
    : undefined;
  const pendingRebalanceSource = pendingResultTask && pendingAssignmentResult
    ? {
        assignmentId: pendingAssignmentResult.assignmentId,
        accuracy: pendingAssignmentResult.accuracy,
        missedSkills: pendingAssignmentResult.missedSkills,
        task: pendingResultTask,
        missedQuestionRefs: pendingAssignmentResult.questionResults
          .filter((question) => pendingAssignmentResult.missedQuestionIds.includes(question.storageId))
          .filter((question) => question.subject && question.sourceId && question.bankType)
          .map((question) => ({
            subject: question.subject!,
            sourceId: question.sourceId!,
            bankType: question.bankType!,
            storageId: question.storageId,
          })),
      }
    : unresolvedProgressTask
      ? {
          assignmentId: unresolvedProgressTask.id,
          accuracy: progress[unresolvedProgressTask.id]!.accuracy!,
          missedSkills: progress[unresolvedProgressTask.id]!.missedSkills ?? [],
          task: unresolvedProgressTask,
          missedQuestionRefs: progress[unresolvedProgressTask.id]!.missedQuestionRefs ?? [],
        }
      : null;
  const pendingStrengthen = pendingRebalanceSource
    ? studyPlanFocusForSkills(pendingRebalanceSource.missedSkills) ?? pendingRebalanceSource.task.focus
    : undefined;
  const pendingReduceCandidate = tasks.find((task) =>
    progress[task.id]?.accuracy !== undefined
    && progress[task.id]!.accuracy! >= 90
    && settings.focus.includes(task.focus))?.focus;
  const pendingRebalanceCandidate: RebalanceProposal | null = pendingRebalanceSource
    && pendingStrengthen
    ? {
        strengthen: pendingStrengthen,
        reduce: pendingReduceCandidate === pendingStrengthen ? undefined : pendingReduceCandidate,
        assignmentId: pendingRebalanceSource.assignmentId,
        accuracy: pendingRebalanceSource.accuracy,
        missedQuestionRefs: pendingRebalanceSource.missedQuestionRefs,
      }
    : null;
  const pendingRebalanceOutcome = pendingRebalanceCandidate
    ? buildRebalancedPlan({
        proposal: pendingRebalanceCandidate,
        settings,
        snapshot,
        progress,
        currentTasks: tasks,
        today,
        hasImportedReport: Boolean(report),
      })
    : null;
  const pendingRebalance = pendingRebalanceOutcome?.actionable ? pendingRebalanceCandidate : null;
  const activeRebalance = rebalance ?? pendingRebalance;

  const hydrateDocument = useCallback((document: StudyPlanDocumentV2) => {
    setSettings(normalizeStudyPlanSettings(document.settings, today));
    setReport(document.scoreSummary);
    setSnapshot(document.tasks);
    setProgress(document.progress);
  }, [today]);

  const persistStudyPlanState = useCallback((
    overrides: PersistStudyPlanOverrides = {},
    consumeAssignmentResult = false,
  ) => {
    if (
      !persistenceReadyRef.current
      || !isHydratedStudyPlanOwner(hydratedOwnerUidRef.current, currentUidRef.current)
    ) return;
    const current = persistedStateRef.current;
    const nextSettings = overrides.settings ?? current.settings;
    const nextTasks = overrides.snapshot ?? tasksRef.current;
    const nextProgress = overrides.progress ?? current.progress;
    const nextReport = overrides.removeReport ? undefined : overrides.report ?? current.report;
    const uid = currentUidRef.current;
    const epoch = persistenceEpochRef.current;
    try {
      const document = createStudyPlanDocument({
        settings: nextSettings,
        ...(nextReport ? { scoreSummary: nextReport } : {}),
        tasks: nextSettings.setupComplete && nextTasks.length ? nextTasks : current.generated,
        progress: nextProgress,
      });
      const saveToCloud = (consumeAfterCloudSave: boolean) => {
        if (!uid) return;
        const cloudSave = saveStudyPlanDocument(document, { uid }).then((cloudResult) => {
          if (epoch !== persistenceEpochRef.current || uid !== currentUidRef.current) return;
          const nextStatus = studyPlanSyncStatusForSaveResult({
            result: cloudResult,
            submitted: document,
            uid,
            localDocument: readStudyPlanDocument(uid),
          });
          if (nextStatus !== "unsaved") {
            if (consumeAfterCloudSave) consumeStudyPlanAssignmentResult();
            setPlanDataError("");
          }
          setSyncStatus(nextStatus);
        }).catch(() => {
          if (epoch !== persistenceEpochRef.current || uid !== currentUidRef.current) return;
          const localDocument = readStudyPlanDocument(uid);
          setSyncStatus(localDocument && sameStudyPlanDocumentContent(localDocument, document)
            ? "error"
            : "unsaved");
        });
        trackPendingPersistence(pendingPersistenceRef.current, cloudSave);
      };
      const localSave = saveStudyPlanDocument(document, { uid, syncCloud: false }).then((result) => {
        if (epoch !== persistenceEpochRef.current || uid !== currentUidRef.current) return;
        if (result.cloudStatus === "error") {
          if (uid) saveToCloud(consumeAssignmentResult);
          else setSyncStatus("unsaved");
          return;
        }
        if (consumeAssignmentResult) consumeStudyPlanAssignmentResult();
        setPlanDataError("");
        if (!uid) {
          setSyncStatus("local");
          return;
        }
        saveToCloud(false);
      }).catch(() => {
        if (epoch !== persistenceEpochRef.current || uid !== currentUidRef.current) return;
        if (uid) saveToCloud(consumeAssignmentResult);
        else setSyncStatus("unsaved");
      });
      trackPendingPersistence(pendingPersistenceRef.current, localSave);
    } catch {
      if (epoch === persistenceEpochRef.current && uid === currentUidRef.current) setSyncStatus("unsaved");
    }
  }, []);

  const retryPlanPersistence = () => {
    setSyncStatus("syncing");
    persistStudyPlanState();
  };

  useEffect(() => {
    if (authLoading) return;
    const nextUid = activeOwnerUid;
    const ownerChanged = previousUidRef.current !== nextUid;
    if (ownerChanged) {
      uploadSequenceRef.current += 1;
      uploadAbortRef.current?.abort();
      uploadAbortRef.current = null;
      setIsParsing(false);
      setUploadProgress(null);
      setUploadError("");
      setLastUpload(null);
      setReportCandidate(null);
      setLaunchingTaskId(null);
      setLaunchError("");
      setModuleConflict(null);
      setPracticeConflict(null);
      setRebalance(null);
      editBaselineRef.current = null;
      setView("dashboard");
      didSelectInitialTaskRef.current = false;
    }
    persistenceEpochRef.current += 1;
    const syncEpoch = persistenceEpochRef.current;
    currentUidRef.current = nextUid;
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    persistenceReadyRef.current = false;
    hydratedOwnerUidRef.current = undefined;
    setPersistenceReady(false);
    setHydratedOwnerUid(undefined);
    setPersistenceEnabled(false);
    setScheduleSaveStatus("idle");
    setScheduleSaveError("");
    setPlanDataError("");
    setBackup(null);
    let cancelled = false;
    const markOwnerReady = (ownerUid: string | null) => {
      hydratedOwnerUidRef.current = ownerUid;
      persistenceReadyRef.current = true;
      setHydratedOwnerUid(ownerUid);
      setPersistenceReady(true);
    };
    if (!nextUid) {
      const anonymousDocument = readStudyPlanDocument(null);
      if (anonymousDocument) {
        hydrateDocument(anonymousDocument);
        setPersistenceEnabled(true);
      } else {
        const fresh = createDefaultStudyPlanSettings(today);
        setSettings(fresh);
        setReport(undefined);
        setSnapshot([]);
        setProgress({});
      }
      previousUidRef.current = null;
      setSyncStatus("local");
      markOwnerReady(null);
      return;
    }
    setSyncStatus("syncing");
    previousUidRef.current = nextUid;
    const syncUid = nextUid;
    const syncPromise = trackPendingPersistence(
      pendingPersistenceRef.current,
      syncStudyPlanDocument(syncUid),
    );
    void syncPromise.then((result) => {
      if (
        cancelled
        || syncEpoch !== persistenceEpochRef.current
        || syncUid !== currentUidRef.current
      ) return;
      if (result.document) {
        hydrateDocument(result.document);
        setPersistenceEnabled(true);
      } else {
        const fresh = createDefaultStudyPlanSettings(today);
        setSettings(fresh);
        setReport(undefined);
        setSnapshot([]);
        setProgress({});
        setPersistenceEnabled(false);
      }
      setBackup(readStudyPlanBackup(syncUid));
      if (result.cloudStatus === "error") {
        const localDocument = readStudyPlanDocument(syncUid);
        setSyncStatus(result.document && localDocument && sameStudyPlanDocumentContent(result.document, localDocument)
          ? "error"
          : "unsaved");
      } else {
        setSyncStatus(result.cloudStatus === "synced" ? "synced" : "local");
      }
      markOwnerReady(syncUid);
    }).catch(() => {
      if (
        cancelled
        || syncEpoch !== persistenceEpochRef.current
        || syncUid !== currentUidRef.current
      ) return;
      const localDocument = readStudyPlanDocument(syncUid);
      if (localDocument) {
        hydrateDocument(localDocument);
        setPersistenceEnabled(true);
      } else {
        const fresh = createDefaultStudyPlanSettings(today);
        setSettings(fresh);
        setReport(undefined);
        setSnapshot([]);
        setProgress({});
      }
      setBackup(readStudyPlanBackup(syncUid));
      setSyncStatus(localDocument ? "error" : "unsaved");
      markOwnerReady(syncUid);
    });
    return () => { cancelled = true; };
  }, [activeOwnerUid, authLoading, hydrateDocument, today]);

  useEffect(() => {
    if (!plannerReady || !persistenceEnabled || view === "settings" || !settings.satDate || settings.startDate >= settings.satDate) return;
    const capturedEpoch = persistenceEpochRef.current;
    const capturedUid = activeOwnerUid;
    const timeout = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      try {
        const document = createStudyPlanDocument({
          settings,
          ...(report ? { scoreSummary: report } : {}),
          tasks: settings.setupComplete && tasks.length ? tasks : generated,
          progress,
        });
        const savePromise = saveStudyPlanDocument(document, { uid: capturedUid }).then((result) => {
          if (capturedEpoch !== persistenceEpochRef.current || capturedUid !== currentUidRef.current) return;
          const localDocument = capturedUid ? readStudyPlanDocument(capturedUid) : null;
          const nextStatus = studyPlanSyncStatusForSaveResult({
            result,
            submitted: document,
            uid: capturedUid,
            localDocument,
          });
          const savedDocument = durableStudyPlanSaveDocument({
            result,
            submitted: document,
            uid: capturedUid,
            localDocument,
          });
          setSyncStatus(nextStatus);
          if (savedDocument) {
            setPlanDataError("");
            if (!sameStudyPlanDocumentContent(document, savedDocument)) hydrateDocument(savedDocument);
          }
        }).catch(() => {
          if (capturedEpoch === persistenceEpochRef.current && capturedUid === currentUidRef.current) {
            setSyncStatus("unsaved");
          }
        });
        trackPendingPersistence(pendingPersistenceRef.current, savePromise);
      } catch {
        if (capturedEpoch === persistenceEpochRef.current && capturedUid === currentUidRef.current) setSyncStatus("unsaved");
      }
    }, 350);
    autosaveTimerRef.current = timeout;
    return () => {
      window.clearTimeout(timeout);
      if (autosaveTimerRef.current === timeout) autosaveTimerRef.current = null;
    };
  }, [activeOwnerUid, generated, hydrateDocument, persistenceEnabled, plannerReady, progress, report, settings, tasks, view]);

  useEffect(() => {
    if (!plannerReady || view === "settings") return;
    const result = getStudyPlanAssignmentResult();
    if (!result) return;
    const scheduleConsume = () => {
      const consumeTimer = window.setTimeout(() => consumeStudyPlanAssignmentResult(), 0);
      return () => window.clearTimeout(consumeTimer);
    };
    if (result.ownerUid !== activeOwnerUid) return scheduleConsume();
    const missedReviewSuffix = "-missed-review";
    if (result.assignmentId.endsWith(missedReviewSuffix)) {
      const sourceAssignmentId = result.assignmentId.slice(0, -missedReviewSuffix.length);
      const sourceTask = tasksRef.current.find((task) => task.id === sourceAssignmentId);
      if (!sourceTask) return scheduleConsume();
      const reviewAlreadyCompleted = Boolean(progressRef.current[sourceAssignmentId]?.missedReviewCompletedAt);
      const nextProgress: Record<string, StudyPlanProgressRecord> = {
        ...progressRef.current,
        [sourceAssignmentId]: {
          ...progressRef.current[sourceAssignmentId],
          completed: Boolean(progressRef.current[sourceAssignmentId]?.completed),
          missedReviewCompletedAt: new Date(result.completedAt).toISOString(),
        },
        [result.assignmentId]: {
          ...progressRef.current[result.assignmentId],
          completed: true,
          completedAt: new Date(result.completedAt).toISOString(),
          accuracy: result.accuracy,
          elapsedSeconds: result.elapsedSeconds,
          missedSkills: result.missedSkills,
        },
      };
      setProgress(nextProgress);
      if (!reviewAlreadyCompleted) {
        trackStudyPlanTaskCompletion({
          actionKind: "missed-review",
          timingMode: "countdown",
          accuracyBand: result.accuracy < 50 ? "below_50" : result.accuracy < 75 ? "50_74" : result.accuracy < 90 ? "75_89" : "90_100",
          elapsedMinutes: Math.round(result.elapsedSeconds / 60),
        });
      }
      persistStudyPlanState({ progress: nextProgress }, true);
      return;
    }
    const missedIds = new Set(result.missedQuestionIds);
    const resultQuestionRefs: StudyPlanQuestionRef[] = result.questionResults
      .filter((question) => missedIds.has(question.storageId) && question.subject && question.sourceId && question.bankType)
      .map((question) => ({
        subject: question.subject!,
        sourceId: question.sourceId!,
        bankType: question.bankType!,
        storageId: question.storageId,
      }));
    const moduleQuestionRefs: StudyPlanQuestionRef[] = result.source.kind === "module"
      ? (getPracticeModule(result.source.moduleSlug)?.questions ?? [])
          .filter((question) => missedIds.has(question.bankQuestion.stableId))
          .map((question) => ({
            subject: question.bankQuestion.subject,
            sourceId: question.bankQuestion.sourceId,
            bankType: question.bankQuestion.bankType,
            storageId: question.bankQuestion.stableId,
          }))
      : [];
    const missedQuestionRefs = resultQuestionRefs.length ? resultQuestionRefs : moduleQuestionRefs;
    const assignmentAlreadyCompleted = Boolean(progressRef.current[result.assignmentId]?.completed);
    let nextProgress: Record<string, StudyPlanProgressRecord> = {
      ...progressRef.current,
      [result.assignmentId]: {
        ...progressRef.current[result.assignmentId],
        completed: true,
        completedAt: new Date(result.completedAt).toISOString(),
        accuracy: result.accuracy,
        elapsedSeconds: result.elapsedSeconds,
        missedSkills: result.missedSkills,
        missedQuestionRefs,
      },
    };
    const completedTask = tasksRef.current.find((task) => task.id === result.assignmentId);
    const strengthen = studyPlanFocusForSkills(result.missedSkills) ?? completedTask?.focus;
    let proposal: RebalanceProposal | null = null;
    if (strengthen && result.accuracy < 80) {
      const reduce = tasksRef.current.find((task) =>
        progressRef.current[task.id]?.accuracy !== undefined
        && progressRef.current[task.id]!.accuracy! >= 90
        && persistedStateRef.current.settings.focus.includes(task.focus))?.focus;
      proposal = {
        strengthen,
        reduce: reduce === strengthen ? undefined : reduce,
        assignmentId: result.assignmentId,
        accuracy: result.accuracy,
        missedQuestionRefs,
      };
    }
    const rebalanceOutcome = proposal
      ? buildRebalancedPlan({
          proposal,
          settings: persistedStateRef.current.settings,
          snapshot: persistedStateRef.current.snapshot,
          progress: nextProgress,
          currentTasks: tasksRef.current,
          today,
          hasImportedReport: Boolean(persistedStateRef.current.report),
        })
      : null;
    const shouldProposeRebalance = Boolean(proposal && rebalanceOutcome?.actionable);
    if (proposal && shouldProposeRebalance) setRebalance(proposal);
    else {
      setRebalance(null);
      nextProgress = {
        ...nextProgress,
        [result.assignmentId]: {
          ...nextProgress[result.assignmentId],
          rebalanceDecision: "kept",
        },
      };
    }
    progressRef.current = nextProgress;
    setProgress(nextProgress);
    if (completedTask && !assignmentAlreadyCompleted) {
      trackStudyPlanTaskCompletion({
        actionKind: completedTask.action.kind,
        timingMode: completedTask.action.kind === "module" ? "module" : "countdown",
        accuracyBand: result.accuracy < 50 ? "below_50" : result.accuracy < 75 ? "50_74" : result.accuracy < 90 ? "75_89" : "90_100",
        elapsedMinutes: Math.round(result.elapsedSeconds / 60),
      });
    }
    persistStudyPlanState({ progress: nextProgress }, !shouldProposeRebalance);
  }, [activeOwnerUid, persistStudyPlanState, plannerReady, today, view]);

  useEffect(() => {
    if (!activePlan) {
      didSelectInitialTaskRef.current = false;
      return;
    }
    if (didSelectInitialTaskRef.current) return;
    const preferred = tasks.find((task) => task.date === today && !progress[task.id]?.completed)
      ?? nextTask
      ?? tasks.find((task) => !progress[task.id]?.completed)
      ?? tasks[0];
    if (!preferred) return;
    didSelectInitialTaskRef.current = true;
    setSelectedDate(preferred.date);
    setVisibleMonth(monthStartFor(preferred.date));
  }, [activePlan, nextTask, progress, tasks, today]);

  useEffect(() => () => uploadAbortRef.current?.abort(), []);

  const updateSetting = <K extends keyof StudyPlanSettings>(key: K, value: StudyPlanSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const toggleWeekday = (day: number) => {
    setSettings((current) => {
      const next = current.freeWeekdays.includes(day)
        ? current.freeWeekdays.filter((item) => item !== day)
        : [...current.freeWeekdays, day].sort((left, right) => left - right);
      return next.length ? { ...current, freeWeekdays: next } : current;
    });
  };

  const toggleFocus = (focus: StudyPlanFocusId) => {
    setSettings((current) => {
      const next = current.focus.includes(focus)
        ? current.focus.filter((item) => item !== focus)
        : [...current.focus, focus];
      return next.length ? { ...current, focus: next } : current;
    });
  };

  const setIntensity = (focus: StudyPlanFocusId, intensity: StudyPlanIntensity) => {
    setSettings((current) => ({ ...current, intensity: { ...current.intensity, [focus]: intensity } }));
  };

  const updateTaskProgress = (taskId: string, patch: Partial<StudyPlanProgressRecord>) => {
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (task && patch.completed === true && !progress[taskId]?.completed) {
      trackStudyPlanTaskCompletion({
        actionKind: task.action.kind,
        timingMode: task.action.kind === "module" ? "module" : task.action.kind === "timed-set" || task.action.kind === "missed-review" ? "countdown" : task.action.kind === "checklist" ? "offline" : "untimed",
      });
    }
    const nextProgress: Record<string, StudyPlanProgressRecord> = {
      ...progressRef.current,
      [taskId]: { completed: false, ...progressRef.current[taskId], ...patch },
    };
    progressRef.current = nextProgress;
    setProgress(nextProgress);
    if (persistenceEnabled) persistStudyPlanState({ progress: nextProgress });
  };

  const saveSchedule = async () => {
    if (validationErrors.length || !generated.length) return;
    const nextSnapshot = mergeLockedStudyPlan(generated, snapshot, progress, today, settings.minutesPerDay);
    const nextSettings = { ...settings, setupComplete: true };
    const submittedDocument = createStudyPlanDocument({
      settings: nextSettings,
      ...(report ? { scoreSummary: report } : {}),
      tasks: nextSnapshot,
      progress,
    });
    const saveUid = currentUidRef.current;
    const saveEpoch = persistenceEpochRef.current;
    const wasActivePlan = activePlan;
    setScheduleSaveStatus("saving");
    setScheduleSaveError("");
    setSyncStatus("syncing");
    let result;
    try {
      result = await trackPendingPersistence(
        pendingPersistenceRef.current,
        saveStudyPlanDocument(submittedDocument, { uid: saveUid }),
      );
    } catch {
      if (saveEpoch !== persistenceEpochRef.current || saveUid !== currentUidRef.current) return;
      setScheduleSaveStatus("error");
      setScheduleSaveError("Plan not saved. Your setup is still open. Check browser storage or finish signing in or out in another tab, then retry.");
      setSyncStatus("unsaved");
      toast.error("Plan not saved. Your setup is still open so you can retry.");
      return;
    }
    if (saveEpoch !== persistenceEpochRef.current || saveUid !== currentUidRef.current) return;
    const savedDocument = durableStudyPlanSaveDocument({
      result,
      submitted: submittedDocument,
      uid: saveUid,
      localDocument: saveUid ? readStudyPlanDocument(saveUid) : null,
    });
    if (!savedDocument) {
      setScheduleSaveStatus("error");
      setScheduleSaveError("Plan not saved. Your setup is still open. Check browser storage or finish signing in or out in another tab, then retry.");
      setSyncStatus("unsaved");
      toast.error("Plan not saved. Your setup is still open so you can retry.");
      return;
    }
    editBaselineRef.current = null;
    setPersistenceEnabled(true);
    hydrateDocument(savedDocument);
    setScheduleSaveStatus("idle");
    setScheduleSaveError("");
    setPlanDataError("");
    setSyncStatus(studyPlanSyncStatusForSaveResult({
      result,
      submitted: submittedDocument,
      uid: saveUid,
      localDocument: saveUid ? readStudyPlanDocument(saveUid) : null,
    }));
    const preferred = savedDocument.tasks.find((task) => task.date >= today && !savedDocument.progress[task.id]?.completed)
      ?? savedDocument.tasks[0];
    if (preferred) {
      setSelectedDate(preferred.date);
      setVisibleMonth(monthStartFor(preferred.date));
    }
    setView("dashboard");
    trackStudyPlanSaved({
      mode: wasActivePlan ? "edit" : "create",
      taskCount: savedDocument.tasks.length,
      planLengthDays: daysBetween(savedDocument.settings.startDate, savedDocument.settings.satDate),
      minutesPerDay: savedDocument.settings.minutesPerDay,
      hasScoreReport: Boolean(savedDocument.scoreSummary),
      storage: saveUid ? "account" : "anonymous",
    });
    if (!wasActivePlan) {
      trackToolComplete({ tool: "study_plan_generator", outcome: "success" });
    }
    if (saveUid && result.cloudStatus === "error") {
      toast.warning("Schedule saved on this device. Account sync will retry.");
    } else {
      toast.success(wasActivePlan ? "Study schedule saved" : "Study plan created");
    }
  };

  const parseReport = async (file: File | null) => {
    if (!file) return;
    uploadAbortRef.current?.abort();
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    const sequence = ++uploadSequenceRef.current;
    uploadStartedAtRef.current = performance.now();
    setLastUpload(file);
    setUploadError("");
    setReportCandidate(null);
    setIsParsing(true);
    setUploadProgress({ stage: "validating", progress: 0 });
    try {
      const parsed = await parseScoreReportFile(file, {
        signal: controller.signal,
        onProgress: (next) => {
          if (sequence === uploadSequenceRef.current) setUploadProgress(next);
        },
      });
      if (sequence !== uploadSequenceRef.current || controller.signal.aborted) return;
      setReportCandidate(parsed);
      trackStudyPlanUpload({
        format: file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "image",
        outcome: "success",
        durationMs: performance.now() - uploadStartedAtRef.current,
      });
    } catch (error) {
      if (controller.signal.aborted || sequence !== uploadSequenceRef.current) return;
      const message = error instanceof Error ? error.message : "This report could not be read.";
      setUploadError(message);
      const lower = message.toLowerCase();
      trackStudyPlanUpload({
        format: file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "image",
        outcome: lower.includes("15 mb") || lower.includes("too large")
          ? "too_large"
          : lower.includes("10 pages")
            ? "too_many_pages"
            : lower.includes("megapixel") || lower.includes("pixels")
              ? "too_many_pixels"
              : lower.includes("pdf") || lower.includes("jpeg") || lower.includes("png") || lower.includes("supported")
                ? "unsupported"
                : "parse_error",
        durationMs: performance.now() - uploadStartedAtRef.current,
      });
    } finally {
      if (sequence === uploadSequenceRef.current) setIsParsing(false);
    }
  };

  const cancelUpload = () => {
    uploadSequenceRef.current += 1;
    uploadAbortRef.current?.abort();
    setIsParsing(false);
    setUploadProgress(null);
    if (lastUpload) {
      trackStudyPlanUpload({
        format: lastUpload.type === "application/pdf" || lastUpload.name.toLowerCase().endsWith(".pdf") ? "pdf" : "image",
        outcome: "cancelled",
        durationMs: performance.now() - uploadStartedAtRef.current,
      });
    }
  };

  const clearUploadState = () => {
    uploadSequenceRef.current += 1;
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    setIsParsing(false);
    setUploadProgress(null);
    setUploadError("");
    setLastUpload(null);
  };

  const beginEditSchedule = () => {
    editBaselineRef.current = { settings, report, snapshot, progress };
    setReportCandidate(null);
    setScheduleSaveStatus("idle");
    setScheduleSaveError("");
    setView("settings");
  };

  const cancelEditSchedule = () => {
    const baseline = editBaselineRef.current;
    if (!baseline) return;
    clearUploadState();
    editBaselineRef.current = null;
    setSettings(baseline.settings);
    setReport(baseline.report);
    setSnapshot(baseline.snapshot);
    progressRef.current = baseline.progress;
    setProgress(baseline.progress);
    setReportCandidate(null);
    setScheduleSaveStatus("idle");
    setScheduleSaveError("");
    setSyncStatus("local");
    didSelectInitialTaskRef.current = false;
    setView("dashboard");
  };

  const applyReport = () => {
    if (!reportCandidate || !isUsableReport(reportCandidate)) return;
    const candidate = reportCandidate;
    const canApplyScores = isConsistentReport(candidate);
    setSettings((current) => {
      const nextIntensity = { ...current.intensity };
      const review = buildScoreReportReview(candidate, current.focus);
      for (const domain of candidate.domains) {
        if (typeof domain.proficiency !== "number") continue;
        nextIntensity[domain.id] = domain.proficiency <= 3 ? "heavy" : domain.proficiency <= 5 ? "normal" : "light";
      }
      return {
        ...current,
        currentMath: canApplyScores ? candidate.mathScore! : current.currentMath,
        currentReadingWriting: canApplyScores ? candidate.readingWritingScore! : current.currentReadingWriting,
        focus: review.focusChange.next,
        intensity: nextIntensity,
      };
    });
    const derivedSummary = createStudyPlanScoreSummary(candidate);
    setReport(canApplyScores ? derivedSummary : {
      ...derivedSummary,
      totalScore: undefined,
      readingWritingScore: undefined,
      mathScore: undefined,
    });
    setReportCandidate(null);
    clearUploadState();
    toast.success("Score report applied to the plan");
  };

  const removeReport = () => {
    clearUploadState();
    setReport(undefined);
    setReportCandidate(null);
  };

  const ownerActionStillCurrent = (guard: OwnerActionGuard) =>
    guard.epoch === persistenceEpochRef.current
    && guard.ownerUid === currentUidRef.current
    && persistenceReadyRef.current
    && isHydratedStudyPlanOwner(hydratedOwnerUidRef.current, guard.ownerUid);

  const resumeStoredPracticeAssignment = (
    existing: StudyPlanAssignmentSession,
    stored: StoredPracticeItem[],
    guard: OwnerActionGuard,
  ) => {
    if (!ownerActionStillCurrent(guard) || existing.context.source.kind !== "practice-set") return false;
    const answeredCount = Object.keys(existing.questionResults).length;
    const targetIndex = Math.min(stored.length, Math.max(1, answeredCount + 1));
    const target = stored[targetIndex - 1];
    if (!target?.subject || !target.sourceId || !target.bankType) return false;
    sessionStorage.setItem(PRACTICE_RUN_STORAGE_KEY, existing.context.source.practiceRunId);
    writePracticeLaunchStorage(stored, returnPath);
    sessionStorage.setItem(PRACTICE_SET_TOTAL_STORAGE_KEY, String(stored.length));
    resumeStudyPlanAssignment(guard.ownerUid);
    navigate(buildPracticeBankQuestionRoute({
      subject: target.subject,
      sourceId: target.sourceId,
      bankType: target.bankType,
      idx: targetIndex,
    }));
    return true;
  };

  const startTimedSet = async (
    task: StudyPlanTask,
    action: Extract<StudyPlanTaskAction, { kind: "timed-set" }>,
    guard: OwnerActionGuard,
  ) => {
    if (!ownerActionStillCurrent(guard)) return;
    const existing = getStudyPlanAssignmentSession();
    if (
      existing
      && existing.context.assignmentId === task.id
      && existing.context.ownerUid === guard.ownerUid
      && existing.context.source.kind === "practice-set"
      && (existing.status === "active" || existing.status === "paused")
    ) {
      const stored = readStoredPracticeSet();
      if (storedPracticeSetMatches(stored, existing.context.source.questionRefs)) {
        if (practiceSessionMatchesTask(existing, task, stored)) {
          if (!resumeStoredPracticeAssignment(existing, stored, guard)) throw new Error("The saved assignment could not be resumed.");
        } else {
          setPracticeConflict({ task, existing, stored });
        }
        return;
      }
      if (!window.confirm("The saved question set no longer matches this assignment. Restart it with a fresh full timer?")) {
        toast.info("Saved assignment kept");
        return;
      }
      clearStudyPlanAssignment();
    }
    const diagnosticDomains = action.subject === "math" ? allMathDomains : allEnglishDomains;
    const pool = task.type === "diagnostic"
      ? (await Promise.all(diagnosticDomains.map((domain) =>
          loadQuestionsByDomain(action.subject, domain as MathDomain | EnglishDomain, "all"),
        ))).flat()
      : action.filterType === "domain"
        ? await loadQuestionsByDomain(action.subject, action.filterValue as MathDomain | EnglishDomain, "all")
        : await loadQuestionsBySkill(action.subject, action.filterValue as MathSkill | EnglishSkill, "all");
    if (!ownerActionStillCurrent(guard)) return;
    const selected = task.type === "diagnostic"
      ? selectDiagnosticQuestions(pool, action, task.id)
      : selectQuestions(pool, action, task.id);
    if (selected.length < action.questionCount) throw new Error("Not enough matching questions are available for this assignment.");
    const practiceSet = practiceItemsFor(selected);
    const first = practiceSet[0];
    const practiceRunId = buildPracticeRunId(`study-plan-${task.id}`);
    writePracticeLaunchStorage(practiceSet, returnPath);
    sessionStorage.setItem(PRACTICE_SET_TOTAL_STORAGE_KEY, String(practiceSet.length));
    sessionStorage.setItem(PRACTICE_RUN_STORAGE_KEY, practiceRunId);
    beginStudyPlanAssignment({
      ownerUid: guard.ownerUid,
      assignmentId: task.id,
      plannedDate: task.date,
      returnPath,
      timingMode: { kind: "countdown", timeLimitSeconds: action.timeLimitMinutes * 60 },
      source: {
        kind: "practice-set",
        practiceRunId,
        questionRefs: assignmentQuestionRefsFor(practiceSet),
      },
    });
    navigate(buildPracticeBankQuestionRoute({
      subject: first.subject,
      sourceId: first.sourceId,
      bankType: first.bankType,
      idx: 1,
    }));
  };

  const startMissedReview = async (
    task: StudyPlanTask,
    action: Extract<StudyPlanTaskAction, { kind: "missed-review" }>,
    guard: OwnerActionGuard,
  ) => {
    if (!ownerActionStillCurrent(guard)) return;
    const existing = getStudyPlanAssignmentSession();
    if (
      existing
      && existing.context.assignmentId === task.id
      && existing.context.ownerUid === guard.ownerUid
      && existing.context.source.kind === "practice-set"
      && (existing.status === "active" || existing.status === "paused")
    ) {
      const stored = readStoredPracticeSet();
      if (storedPracticeSetMatches(stored, existing.context.source.questionRefs)) {
        if (practiceSessionMatchesTask(existing, task, stored)) {
          if (!resumeStoredPracticeAssignment(existing, stored, guard)) throw new Error("The saved review could not be resumed.");
        } else {
          setPracticeConflict({ task, existing, stored });
        }
        return;
      }
      if (!window.confirm("The saved missed-question set is unavailable. Restart this review with a fresh full timer?")) {
        toast.info("Saved review kept");
        return;
      }
      clearStudyPlanAssignment();
    }
    const resolvedQuestions = await Promise.all(action.questionRefs.map((reference) =>
      loadSourceBankQuestionBySourceId(reference.subject, reference.sourceId, reference.bankType),
    ));
    if (!ownerActionStillCurrent(guard)) return;
    if (resolvedQuestions.some((question) => !question)) {
      throw new Error("One or more missed questions are no longer available. Regenerate the plan before starting this review.");
    }
    const questions = resolvedQuestions as BankQuestion[];
    const practiceSet = practiceItemsFor(questions);
    const first = practiceSet[0];
    if (!first) throw new Error("The missed questions are no longer available in the question bank.");
    const practiceRunId = buildPracticeRunId(`study-plan-review-${task.id}`);
    writePracticeLaunchStorage(practiceSet, returnPath);
    sessionStorage.setItem(PRACTICE_SET_TOTAL_STORAGE_KEY, String(practiceSet.length));
    sessionStorage.setItem(PRACTICE_RUN_STORAGE_KEY, practiceRunId);
    beginStudyPlanAssignment({
      ownerUid: guard.ownerUid,
      assignmentId: task.id,
      plannedDate: task.date,
      returnPath,
      timingMode: { kind: "countdown", timeLimitSeconds: action.timeLimitMinutes * 60 },
      source: {
        kind: "practice-set",
        practiceRunId,
        questionRefs: assignmentQuestionRefsFor(practiceSet),
      },
    });
    navigate(buildPracticeBankQuestionRoute({
      subject: first.subject,
      sourceId: first.sourceId,
      bankType: first.bankType,
      idx: 1,
    }));
  };

  const navigateToModule = (
    task: StudyPlanTask,
    moduleSlug: string,
    session: ModulePracticeSessionMeta,
    bindToAssignment = true,
  ) => {
    const practiceSet = buildModulePracticeSet(moduleSlug);
    if (!practiceSet?.length) throw new Error("This Math module is not available right now.");
    const activeSession = session.status === "paused" ? { ...session, status: "active" as const } : session;
    if (activeSession !== session) saveModulePracticeSession(activeSession);
    const targetIndex = Math.min(practiceSet.length - 1, Math.max(0, activeSession.currentIndex));
    const target = practiceSet[targetIndex];
    if (!target) throw new Error("This Math module is not available right now.");
    writePracticeLaunchStorage(practiceSet, returnPath);
    sessionStorage.setItem(PRACTICE_SET_TOTAL_STORAGE_KEY, String(practiceSet.length));
    if (bindToAssignment) {
      beginStudyPlanAssignment({
        ownerUid: user?.uid ?? null,
        assignmentId: task.id,
        plannedDate: task.date,
        returnPath,
        timingMode: activeSession.settings.timed && activeSession.settings.timeLimitSeconds
          ? { kind: "countdown", timeLimitSeconds: activeSession.settings.timeLimitSeconds }
          : { kind: "count-up" },
        source: { kind: "module", moduleSlug, sessionId: activeSession.sessionId },
      });
    } else {
      clearStudyPlanAssignment();
    }
    navigate(buildModulePracticeQuestionRoute({
      subject: target.subject,
      sourceId: target.sourceId,
      bankType: target.bankType,
      idx: targetIndex + 1,
      moduleSlug,
      moduleSessionId: activeSession.sessionId,
    }));
  };

  const prepareModule = (task: StudyPlanTask, action: Extract<StudyPlanTaskAction, { kind: "module" }>) => {
    const module = getPracticeModule(action.moduleSlug);
    if (!module || module.subject !== "math") throw new Error("The assigned Math module could not be loaded.");
    const existing = getModulePracticeSession(module.slug, user?.uid ?? null);
    if (existing?.status === "active" || existing?.status === "paused") {
      const matchesAssignmentSettings = existing.settings.timed
        && existing.settings.timeLimitSeconds === action.timeLimitMinutes * 60
        && !existing.settings.allowCheckingAnswers;
      setModuleConflict({ task, moduleSlug: module.slug, existing, matchesAssignmentSettings });
      return;
    }
    const session = createModulePracticeSession(module, {
      timed: true,
      timeLimitSeconds: action.timeLimitMinutes * 60,
      allowCheckingAnswers: false,
    }, user?.uid ?? null);
    navigateToModule(task, module.slug, session);
  };

  const restartConflictingModule = () => {
    if (!moduleConflict) return;
    const { task, moduleSlug } = moduleConflict;
    const module = getPracticeModule(moduleSlug);
    if (!module || task.action.kind !== "module") return;
    clearModulePracticeSession(moduleSlug, user?.uid ?? null);
    const session = createModulePracticeSession(module, {
      timed: true,
      timeLimitSeconds: task.action.timeLimitMinutes * 60,
      allowCheckingAnswers: false,
    }, user?.uid ?? null);
    setModuleConflict(null);
    navigateToModule(task, moduleSlug, session);
  };

  const resumeConflictingModule = () => {
    if (!moduleConflict) return;
    const conflict = moduleConflict;
    setModuleConflict(null);
    navigateToModule(
      conflict.task,
      conflict.moduleSlug,
      conflict.existing,
      conflict.matchesAssignmentSettings,
    );
  };

  const openTask = async (task: StudyPlanTask) => {
    if (!plannerReady || launchingTaskId || task.action.kind === "checklist") return;
    const guard: OwnerActionGuard = {
      ownerUid: activeOwnerUid,
      epoch: persistenceEpochRef.current,
    };
    const existingAssignment = getStudyPlanAssignmentSession();
    if (
      existingAssignment
      && existingAssignment.context.ownerUid === guard.ownerUid
      && existingAssignment.context.assignmentId !== task.id
      && (existingAssignment.status === "active" || existingAssignment.status === "paused")
      && (task.action.kind === "timed-set" || task.action.kind === "missed-review" || task.action.kind === "module")
    ) {
      const confirmed = window.confirm("Another study-plan assignment is unfinished. Start this assignment and clear the unfinished assignment session?");
      if (!confirmed) return;
      clearStudyPlanAssignment();
    }
    setLaunchingTaskId(task.id);
    setLaunchError("");
    trackStudyPlanTaskLaunch({
      actionKind: task.action.kind,
      timingMode: task.action.kind === "module" ? "module" : task.action.kind === "timed-set" || task.action.kind === "missed-review" ? "countdown" : "untimed",
      overdue: task.date < today,
    });
    try {
      if (task.action.kind === "lesson") {
        navigate(task.action.href);
      } else if (task.action.kind === "timed-set") {
        await startTimedSet(task, task.action, guard);
      } else if (task.action.kind === "module") {
        prepareModule(task, task.action);
      } else if (task.action.kind === "missed-review") {
        await startMissedReview(task, task.action, guard);
      }
    } catch (error) {
      setLaunchError(error instanceof Error ? error.message : "This assignment could not be started.");
    } finally {
      setLaunchingTaskId(null);
    }
  };

  const resumePracticeConflict = () => {
    if (!practiceConflict || !plannerReady) return;
    const guard: OwnerActionGuard = {
      ownerUid: activeOwnerUid,
      epoch: persistenceEpochRef.current,
    };
    const conflict = practiceConflict;
    setPracticeConflict(null);
    if (!resumeStoredPracticeAssignment(conflict.existing, conflict.stored, guard)) {
      setLaunchError("The saved assignment could not be resumed.");
    }
  };

  const restartPracticeConflict = () => {
    if (!practiceConflict || !plannerReady) return;
    const task = practiceConflict.task;
    setPracticeConflict(null);
    clearStudyPlanAssignment();
    window.setTimeout(() => { void openTask(task); }, 0);
  };

  const moveOverdueTask = (task: StudyPlanTask) => {
    if (!taskFitsDailyBudget(task, settings.minutesPerDay)) {
      setLaunchError(`“${task.title}” no longer fits the ${settings.minutesPerDay}-minute daily cap. Edit the schedule or skip it instead.`);
      return;
    }
    const displaced = tasks.find((candidate) => {
      const scheduledMinutes = tasks
        .filter((scheduled) => scheduled.date === candidate.date && scheduled.id !== candidate.id && !progress[scheduled.id]?.skipped)
        .reduce((sum, scheduled) => sum + scheduled.minutes, 0);
      return candidate.date >= today
        && daysBetween(candidate.date, settings.satDate) > 6
        && !progress[candidate.id]?.completed
        && candidate.id !== task.id
        && isStudyPlanDay(candidate.date, settings)
        && scheduledMinutes + task.minutes <= settings.minutesPerDay;
    });
    if (!displaced) {
      setLaunchError("There is no open date before the light test-week taper. Skip the task or edit the schedule.");
      return;
    }
    if (!window.confirm(`Move “${task.title}” to ${formatStudyPlanDate(displaced.date, "long")} and skip “${displaced.title}” to preserve your daily time cap?`)) return;
    const moved = {
      ...task,
      date: displaced.date,
      locked: true,
    };
    const skippedReplacement = { ...displaced, locked: true };
    const nextSnapshot = [...tasks.filter((item) => item.id !== task.id && item.id !== displaced.id), moved, skippedReplacement]
      .sort((left, right) => `${left.date}-${left.id}`.localeCompare(`${right.date}-${right.id}`));
    const nextProgress: Record<string, StudyPlanProgressRecord> = {
      ...progress,
      [displaced.id]: {
        ...progress[displaced.id],
        completed: true,
        skipped: true,
        completedAt: new Date().toISOString(),
      },
    };
    setSnapshot(nextSnapshot);
    setProgress(nextProgress);
    persistStudyPlanState({ snapshot: nextSnapshot, progress: nextProgress });
    setSelectedDate(displaced.date);
    setVisibleMonth(monthStartFor(displaced.date));
    toast.success(`Assignment moved; “${displaced.title}” was marked skipped.`);
  };

  const applyRebalance = () => {
    if (!activeRebalance) return;
    const outcome = buildRebalancedPlan({
      proposal: activeRebalance,
      settings,
      snapshot,
      progress,
      currentTasks: tasks,
      today,
      hasImportedReport: Boolean(report),
    });
    const nextProgress: Record<string, StudyPlanProgressRecord> = {
      ...progress,
      [activeRebalance.assignmentId]: {
        ...progress[activeRebalance.assignmentId],
        completed: Boolean(progress[activeRebalance.assignmentId]?.completed),
        rebalanceDecision: outcome.actionable ? "applied" : "kept",
      },
    };
    if (outcome.actionable) {
      setSettings(outcome.nextSettings);
      setSnapshot(outcome.nextTasks);
    }
    progressRef.current = nextProgress;
    setProgress(nextProgress);
    persistStudyPlanState(outcome.actionable
      ? { settings: outcome.nextSettings, snapshot: outcome.nextTasks, progress: nextProgress }
      : { progress: nextProgress }, true);
    setRebalance(null);
    trackStudyPlanRebalance({ decision: outcome.actionable ? "apply" : "cancel", changeCount: outcome.changeCount });
    if (!outcome.actionable) {
      toast.info("No future assignments can be changed without touching the light test-week taper. Your current plan was kept.");
    } else if (outcome.scheduledReview && outcome.scheduleChanged) {
      toast.success("Future work was reweighted and a budgeted missed-question review was scheduled. The light test-week taper stayed unchanged.");
    } else if (outcome.scheduledReview) {
      toast.success("A budgeted missed-question review was scheduled. The light test-week taper stayed unchanged.");
    } else {
      toast.success("Future assignments were reweighted. Completed, historical, and light test-week work stayed locked.");
    }
  };

  const keepCurrentPlan = () => {
    if (!activeRebalance) return;
    const nextProgress: Record<string, StudyPlanProgressRecord> = {
      ...progress,
      [activeRebalance.assignmentId]: {
        ...progress[activeRebalance.assignmentId],
        completed: Boolean(progress[activeRebalance.assignmentId]?.completed),
        rebalanceDecision: "kept",
      },
    };
    setProgress(nextProgress);
    persistStudyPlanState({ progress: nextProgress }, true);
    setRebalance(null);
    trackStudyPlanRebalance({ decision: "cancel", changeCount: activeRebalance.reduce ? 2 : 1 });
  };

  const addBlackoutDate = () => {
    if (!blackoutDraft || blackoutDraft < settings.startDate || blackoutDraft >= settings.satDate) return;
    updateSetting("blackoutDates", Array.from(new Set([...settings.blackoutDates, blackoutDraft])).sort());
    setBlackoutDraft("");
  };

  const startOver = async () => {
    const deletionScope = user
      ? "this device and your signed-in account, including synced progress, the imported score summary, and recoverable plan backups"
      : "this device, including progress, the imported score summary, and local plan backups";
    if (!window.confirm(`Start over and permanently delete this plan from ${deletionScope}?`)) return;
    const deletionUid = activeOwnerUid;
    const wasPersistenceEnabled = persistenceEnabled;
    setPlanDataError("");
    setPersistenceEnabled(false);
    persistenceEpochRef.current += 1;
    const deletionEpoch = persistenceEpochRef.current;
    persistenceReadyRef.current = false;
    hydratedOwnerUidRef.current = undefined;
    setPersistenceReady(false);
    setHydratedOwnerUid(undefined);
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    while (pendingPersistenceRef.current.size) {
      await Promise.allSettled(Array.from(pendingPersistenceRef.current));
    }
    const deletion = await deleteStudyPlanDocument({ uid: deletionUid, includeAnonymous: true });
    if (deletionEpoch !== persistenceEpochRef.current || deletionUid !== currentUidRef.current) return;
    const retainedDocument = readStudyPlanDocument(deletionUid);
    if (!isStudyPlanDeletionDurable(deletion, retainedDocument)) {
      hydratedOwnerUidRef.current = deletionUid;
      persistenceReadyRef.current = true;
      setHydratedOwnerUid(deletionUid);
      setPersistenceReady(true);
      setPersistenceEnabled(wasPersistenceEnabled);
      setBackup(readStudyPlanBackup(deletionUid));
      setSyncStatus(retainedDocument ? "error" : "unsaved");
      setPlanDataError("Plan data could not be deleted. Your existing plan is still shown so you can retry.");
      toast.error("Plan data could not be deleted. Your existing plan is still available.");
      return;
    }
    clearUploadState();
    clearStudyPlanAssignment();
    const fresh = createDefaultStudyPlanSettings(today);
    editBaselineRef.current = null;
    setSettings(fresh);
    progressRef.current = {};
    setProgress({});
    setReport(undefined);
    setReportCandidate(null);
    setSnapshot([]);
    setView("settings");
    setSelectedDate(fresh.startDate);
    setVisibleMonth(monthStartFor(fresh.startDate));
    setBackup(null);
    setScheduleSaveStatus("idle");
    setScheduleSaveError("");
    setPlanDataError("");
    hydratedOwnerUidRef.current = deletionUid;
    persistenceReadyRef.current = true;
    setHydratedOwnerUid(deletionUid);
    setPersistenceReady(true);
    if (user && deletion.cloudStatus !== "deleted") toast.warning("Plan deleted from this device. Account deletion will retry on your next visit when sync is available.");
    else toast.success("Study plan data deleted");
  };

  const restoreBackup = async () => {
    if (!user || !backup) return;
    const uid = user.uid;
    const epoch = persistenceEpochRef.current;
    const submittedDocument = backup.document;
    setPlanDataError("");
    const restorePromise = trackPendingPersistence(
      pendingPersistenceRef.current,
      restoreStudyPlanBackup(uid),
    );
    const result = await restorePromise;
    if (epoch !== persistenceEpochRef.current || uid !== currentUidRef.current) return;
    const restoredDocument = durableStudyPlanSaveDocument({
      result,
      submitted: submittedDocument,
      uid,
      localDocument: readStudyPlanDocument(uid),
    });
    if (!restoredDocument || !sameStudyPlanDocumentContent(restoredDocument, submittedDocument)) {
      setSyncStatus("unsaved");
      setPlanDataError("The older plan could not be restored. Your current plan is still shown so you can retry.");
      toast.error("Older study plan could not be restored.");
      return;
    }
    hydrateDocument(restoredDocument);
    setPersistenceEnabled(true);
    setBackup(null);
    setPlanDataError("");
    setSyncStatus(studyPlanSyncStatusForSaveResult({
      result,
      submitted: submittedDocument,
      uid,
      localDocument: readStudyPlanDocument(uid),
    }));
    if (result.cloudStatus === "error") toast.warning("Older plan restored on this device. Account sync will retry.");
    else toast.success("Older study plan restored");
  };

  const goToDate = (date: string) => {
    setSelectedDate(date);
    setVisibleMonth(monthStartFor(date));
    window.setTimeout(() => {
      document.querySelector("[data-selected-day-panel]")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const goToTask = (task: StudyPlanTask | undefined) => {
    if (!task) return;
    goToDate(task.date);
  };

  const renderTask = (task: StudyPlanTask) => {
    const record = progress[task.id];
    const done = Boolean(record?.completed);
    const skipped = Boolean(record?.skipped);
    const isOverdue = task.date < today && !done;
    const canResume = pausedAssignment?.context.assignmentId === task.id
      && pausedAssignment.context.ownerUid === activeOwnerUid
      && pausedAssignment.context.source.kind === "practice-set"
      && (pausedAssignment.status === "active" || pausedAssignment.status === "paused")
      && practiceSessionMatchesTask(pausedAssignment, task, readStoredPracticeSet());
    return (
      <article key={task.id} className="rounded-xl border border-border bg-background p-4" data-selected-assignment>
        <div className="flex items-start gap-3">
          <Checkbox
            checked={done}
            onCheckedChange={(checked) => updateTaskProgress(task.id, { completed: checked === true, skipped: false, completedAt: checked ? new Date().toISOString() : undefined })}
            aria-label={`${done ? "Mark incomplete" : "Mark complete"}: ${task.title}`}
            className="relative mt-0.5 h-5 w-5 after:absolute after:-inset-3 after:content-['']"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${typeClasses[task.type]}`}>{typeLabels[task.type]}</span>
              <span className="text-xs font-semibold text-ink-mid">{task.minutes} min</span>
              {isOverdue && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-200">Overdue</span>}
              {task.locked && <span className="text-[11px] font-semibold text-ink-muted">Locked</span>}
            </div>
            <h3 className={`mt-2 font-semibold ${done ? "line-through opacity-60" : ""}`}>{task.title}{skipped ? " (skipped)" : ""}</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-mid">{task.detail}</p>
            {task.reviewMinutes > 0 && (
              <p className="mt-2 text-xs font-semibold text-ink-muted">{task.workMinutes} min work + {task.reviewMinutes} min review</p>
            )}
            {task.action.kind === "checklist" && (
              <ul className="mt-3 space-y-1.5 text-sm text-ink-mid">
                {task.action.items.map((item) => <li key={item} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0" />{item}</li>)}
              </ul>
            )}
            {task.action.kind !== "checklist" && (
              <button
                type="button"
                onClick={() => openTask(task)}
                disabled={launchingTaskId === task.id}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink-fixed px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-ink-fixed"
              >
                {launchingTaskId === task.id ? "Starting…" : canResume ? "Resume assignment" : actionLabel(task)}
                <MoveRight className="h-4 w-4" />
              </button>
            )}
            {record?.missedReviewCompletedAt && (
              <p className="mt-3 text-sm font-semibold text-green-700 dark:text-green-300">Missed-question review completed</p>
            )}
            {(done || record?.confidence) && (
              <div className="mt-4" role="group" aria-label={`Confidence after ${task.title}`}>
                <div className="mb-1 text-xs font-semibold text-ink-muted">How did it feel?</div>
                <div className="grid max-w-sm grid-cols-3 gap-2">
                  {(["hard", "okay", "easy"] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      aria-pressed={record?.confidence === level}
                      onClick={() => updateTaskProgress(task.id, { confidence: level })}
                      className={`min-h-11 rounded-lg border text-xs font-semibold capitalize ${record?.confidence === level ? "border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-ink-fixed" : "border-border bg-card text-ink-mid"}`}
                    >{level}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </article>
    );
  };

  const selectedDayPanel = (
    <section data-selected-day-panel className={`${sectionClass} p-4 sm:p-5`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{formatStudyPlanDate(selectedDate, "long")}</h2>
          <p className="mt-1 text-sm text-ink-mid">
            {selectedTasks.length
              ? `${selectedTasks.length} assignment${selectedTasks.length === 1 ? "" : "s"}`
              : selectedDate < settings.startDate
                ? "Before plan"
                : selectedDate >= settings.satDate
                  ? "After plan"
                  : !isStudyPlanDay(selectedDate, settings)
                    ? "Rest day"
                    : "No assignment"}
          </p>
        </div>
        <CalendarDays className="h-5 w-5 text-cobalt-ink dark:text-cobalt" />
      </div>
      <div className="space-y-3">
        {selectedTasks.map(renderTask)}
        {!selectedTasks.length && (
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-ink-mid">
            {settings.blackoutDates.includes(selectedDate)
              ? "This date is unavailable. Remove it from unavailable dates to schedule work here."
              : "There is no assignment on this date."}
          </div>
        )}
      </div>
    </section>
  );

  const Title = embedded ? "h2" : "h1";

  if (!plannerReady) {
    return (
      <div data-study-plan-lab aria-busy="true" className="mx-auto w-full max-w-6xl min-w-0 px-4 py-6 text-ink sm:px-6 lg:px-8">
        <div className={`${sectionClass} flex min-h-40 items-center justify-center gap-3 p-6`} role="status" aria-live="polite">
          <RefreshCw className="h-5 w-5 animate-spin text-cobalt-ink dark:text-cobalt" aria-hidden="true" />
          <span className="font-semibold">Loading your study plan</span>
        </div>
      </div>
    );
  }

  if (setupMode) {
    const currentTotal = settings.currentMath + settings.currentReadingWriting;
    const suggestedTarget = reportCandidate && isConsistentReport(reportCandidate)
      ? Math.min(1600, reportCandidate.totalScore! + 120)
      : null;
    const canApplyReportCandidate = reportCandidate ? isUsableReport(reportCandidate) : false;
    const reportReview = reportCandidate ? buildScoreReportReview(reportCandidate, settings.focus) : null;
    const previewTask = generated.find((task) => task.date >= today) ?? generated[0];
    const mobileSetupError = validationErrors[0]
      ?? (!generated.length ? "No assignments fit these dates and weekdays." : "");
    const mobileActionError = scheduleSaveError || mobileSetupError;
    const saveButtonLabel = scheduleSaveStatus === "saving"
      ? "Saving…"
      : scheduleSaveStatus === "error"
        ? "Retry save"
        : activePlan ? "Save schedule" : "Create plan";
    return (
      <div data-study-plan-lab className="mx-auto w-full max-w-6xl min-w-0 px-4 py-6 pb-28 text-ink sm:px-6 md:pb-8 lg:px-8">
        <style>{printCss}</style>
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4" data-print-hidden>
          <div className="min-w-0">
            <Title className="text-2xl font-semibold tracking-tight sm:text-3xl">Build your SAT study plan</Title>
            <p className="mt-2 max-w-2xl text-sm text-ink-mid sm:text-base">Import a score report or enter scores, then get a date-by-date schedule with assignments you can launch.</p>
          </div>
          {isEditingExistingPlan && (
            <button type="button" onClick={cancelEditSchedule} className="min-h-11 rounded-lg border border-border bg-card px-4 text-sm font-semibold">Back to plan</button>
          )}
        </header>

        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]" data-print-hidden>
          <div className="min-w-0 space-y-5">
            <section className={`${sectionClass} min-w-0 p-4 sm:p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-cobalt-ink dark:text-cobalt">1 · Starting point</div>
                  <h2 className="mt-1 text-lg font-semibold">Score report and scores</h2>
                  <p className="mt-1 text-sm text-ink-mid">Your file stays on this device. Only a sanitized score summary can be saved.</p>
                </div>
                {report && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => uploadInputRef.current?.click()} className="min-h-11 rounded-lg border border-border px-3 text-sm font-semibold">Replace</button>
                    <button type="button" onClick={removeReport} className="min-h-11 rounded-lg border border-border px-3 text-sm font-semibold text-red-600">Remove</button>
                  </div>
                )}
              </div>
              <input
                ref={uploadInputRef}
                type="file"
                aria-label="SAT score report file"
                className="sr-only"
                accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                onChange={(event) => {
                  void parseReport(event.target.files?.[0] ?? null);
                  event.currentTarget.value = "";
                }}
              />
              {!report && !reportCandidate && (
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  className="mt-4 flex min-h-32 w-full min-w-0 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background px-4 text-center transition-colors hover:border-cobalt"
                >
                  <Upload className="h-6 w-6 text-cobalt-ink dark:text-cobalt" />
                  <span className="mt-2 font-semibold">Upload SAT score report</span>
                  <span className="mt-1 text-xs text-ink-muted">PDF, JPEG, or PNG · 15 MB · up to 10 PDF pages</span>
                </button>
              )}
              {isParsing && (
                <div className="mt-4 rounded-xl border border-cobalt/30 bg-cobalt/5 p-4" role="status" aria-live="polite">
                  <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                    <span>{parseStageLabel(uploadProgress)}</span>
                    <span>{Math.round((uploadProgress?.progress ?? 0) * 100)}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-cobalt transition-[width]" style={{ width: `${Math.round((uploadProgress?.progress ?? 0) * 100)}%` }} /></div>
                  <button type="button" onClick={cancelUpload} className="mt-3 min-h-11 rounded-lg border border-border bg-background px-4 text-sm font-semibold">Cancel</button>
                </div>
              )}
              {uploadError && (
                <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm" role="alert">
                  <div className="font-semibold">Could not import this report</div>
                  <div className="mt-1 text-ink-mid">{uploadError}</div>
                  {lastUpload && <button type="button" onClick={() => void parseReport(lastUpload)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-4 font-semibold"><RefreshCw className="h-4 w-4" />Retry</button>}
                </div>
              )}
              {reportCandidate && (
                <div className="mt-4 rounded-xl border border-cobalt/40 bg-cobalt/5 p-4" aria-label="Review imported score report">
                  <div className="flex items-center gap-2"><FileText className="h-5 w-5" /><h3 className="font-semibold">Review before applying</h3></div>
                  <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">Detected scores</div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-background p-3"><div className="text-xs text-ink-muted">Total</div><div className="text-xl font-semibold">{reportCandidate.totalScore ?? "—"}</div></div>
                    <div className="rounded-lg bg-background p-3"><div className="text-xs text-ink-muted">Reading & Writing</div><div className="text-xl font-semibold">{reportCandidate.readingWritingScore ?? "—"}</div></div>
                    <div className="rounded-lg bg-background p-3"><div className="text-xs text-ink-muted">Math</div><div className="text-xl font-semibold">{reportCandidate.mathScore ?? "—"}</div></div>
                  </div>
                  <div className="mt-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Detected weak domains</div>
                    {reportReview?.weakDomains.length ? (
                      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                        {reportReview.weakDomains.map((domain) => (
                          <li key={domain.id} className="rounded-lg border border-border bg-background p-3">
                            <div className="font-semibold">{domain.label}</div>
                            <div className="mt-0.5 text-xs text-ink-muted">{domain.section}</div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {domain.metrics.length
                                ? domain.metrics.map((metric) => <span key={metric} className="rounded-full border border-border px-2 py-1 text-xs font-semibold">{metric}</span>)
                                : <span className="text-xs text-ink-mid">Relative weakness detected; exact band unavailable.</span>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="mt-2 text-sm text-ink-mid">No reliable weak-domain metrics were detected.</p>}
                  </div>
                  <div className="mt-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Proposed focus changes</div>
                    {reportReview?.focusChange.selectionUnchanged ? <p className="mt-2 text-sm text-ink-mid">Your current focus selection will stay unchanged.</p> : (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-ds-good/30 bg-ds-good/10 p-3"><div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Add</div><div className="mt-2 flex flex-wrap gap-1.5">{reportReview?.focusChange.additions.length ? reportReview.focusChange.additions.map((focus) => <span key={focus} className="rounded-full border border-ds-good/40 bg-background px-2 py-1 text-xs font-semibold">{studyPlanFocusById.get(focus)?.label ?? focus}</span>) : <span className="text-sm text-ink-mid">None</span>}</div></div>
                        <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3"><div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Remove</div><div className="mt-2 flex flex-wrap gap-1.5">{reportReview?.focusChange.removals.length ? reportReview.focusChange.removals.map((focus) => <span key={focus} className="rounded-full border border-amber-400/50 bg-background px-2 py-1 text-xs font-semibold">{studyPlanFocusById.get(focus)?.label ?? focus}</span>) : <span className="text-sm text-ink-mid">None</span>}</div></div>
                      </div>
                    )}
                  </div>
                  {reportCandidate.warnings.length > 0 && <div className="mt-4 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm" role="alert"><div className="font-semibold">Import warnings</div><div className="mt-1 text-ink-mid">{reportCandidate.warnings.join(" ")}</div></div>}
                  {!canApplyReportCandidate && <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm" role="alert"><div className="font-semibold">This file cannot be applied</div><div className="mt-1 text-ink-mid">No consistent SAT score set or sufficient domain evidence was detected. Upload a clearer SAT score report or enter your scores manually.</div></div>}
                  {suggestedTarget && suggestedTarget > settings.targetScore && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background p-3 text-sm">
                      <span>Suggested target: <strong>{suggestedTarget}</strong>. Your target will not change automatically.</span>
                      <button type="button" onClick={() => updateSetting("targetScore", suggestedTarget)} className="min-h-11 rounded-lg border border-border px-3 font-semibold">Use suggestion</button>
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={applyReport} disabled={!canApplyReportCandidate} className="min-h-11 rounded-lg bg-ink-fixed px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-ink-fixed">Apply to plan</button>
                    <button type="button" onClick={() => setReportCandidate(null)} className="min-h-11 rounded-lg border border-border bg-background px-4 font-semibold">Discard</button>
                  </div>
                </div>
              )}
              {report && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-ds-good/30 bg-ds-good/10 p-4">
                  <Check className="mt-0.5 h-5 w-5 text-green-700" />
                  <div><div className="font-semibold">Score report applied</div><div className="mt-1 text-sm text-ink-mid">{report.totalScore ?? "Score"} detected · {report.recommendedFocus.length} proposed priorities saved</div></div>
                </div>
              )}
              <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-3">
                <label className="min-w-0 text-sm font-semibold">Reading & Writing<input aria-label="Current Reading and Writing score" aria-invalid={!Number.isInteger(settings.currentReadingWriting) || settings.currentReadingWriting < 200 || settings.currentReadingWriting > 800 || settings.currentReadingWriting % 10 !== 0} type="number" min={200} max={800} step={10} value={settings.currentReadingWriting} onChange={(event) => updateSetting("currentReadingWriting", Number(event.target.value))} className="mt-2 h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3" /></label>
                <label className="min-w-0 text-sm font-semibold">Math<input aria-label="Current Math score" aria-invalid={!Number.isInteger(settings.currentMath) || settings.currentMath < 200 || settings.currentMath > 800 || settings.currentMath % 10 !== 0} type="number" min={200} max={800} step={10} value={settings.currentMath} onChange={(event) => updateSetting("currentMath", Number(event.target.value))} className="mt-2 h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3" /></label>
                <label className="min-w-0 text-sm font-semibold">Target score<input aria-label="Target SAT score" aria-invalid={!Number.isInteger(settings.targetScore) || settings.targetScore < 400 || settings.targetScore > 1600 || settings.targetScore % 10 !== 0} type="number" min={400} max={1600} step={10} value={settings.targetScore} onChange={(event) => updateSetting("targetScore", Number(event.target.value))} className="mt-2 h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3" /></label>
              </div>
              <p className="mt-2 text-xs text-ink-muted">Current total: {currentTotal}. Your target stays under your control.</p>
            </section>

            <section className={`${sectionClass} min-w-0 p-4 sm:p-5`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-cobalt-ink dark:text-cobalt">2 · Calendar and time</div>
              <h2 className="mt-1 text-lg font-semibold">Set your study runway</h2>
              <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                <label className="min-w-0 text-sm font-semibold">Start date<input aria-invalid={settings.startDate < today || !settings.satDate || settings.startDate >= settings.satDate} type="date" min={today} max={settings.satDate ? addDays(settings.satDate, -1) : undefined} value={settings.startDate} onChange={(event) => updateSetting("startDate", event.target.value)} className="mt-2 h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3" /></label>
                <label className="min-w-0 text-sm font-semibold">Weekend SAT date<select aria-invalid={!settings.satDate} value={settings.satDate} onChange={(event) => updateSetting("satDate", event.target.value)} className="mt-2 h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3">{futureSatDates.length > 0 && !settings.satDate && <option value="" disabled>Choose a future weekend SAT date</option>}{!futureSatDates.length && <option value="">No future weekend SAT dates through June 2027</option>}{futureSatDates.map((item) => <option key={item.date} value={item.date}>Weekend SAT — {item.label}</option>)}</select></label>
              </div>
              <div className="mt-5">
                <div className="flex items-center justify-between gap-3 text-sm font-semibold"><label htmlFor="study-minutes">Minutes per study day</label><span>{settings.minutesPerDay} minutes</span></div>
                <Slider id="study-minutes" aria-label="Minutes per study day" value={[settings.minutesPerDay]} min={15} max={120} step={15} onValueChange={([value]) => updateSetting("minutesPerDay", value)} className="mt-4 [&_[role=slider]]:!h-11 [&_[role=slider]]:!w-11" />
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2" role="group" aria-label="Timing approach">
                {([{
                  value: "steady" as const,
                  title: "Keep timing steady",
                  detail: "Math modules use the standard 35-minute timer.",
                }, {
                  value: "tighten" as const,
                  title: "Tighten Math timing",
                  detail: "Only Math module timers shorten gradually.",
                }]).map((option) => (
                  <button key={option.value} type="button" aria-pressed={settings.pacingMode === option.value} onClick={() => updateSetting("pacingMode", option.value)} className={`min-h-20 rounded-xl border p-3 text-left ${settings.pacingMode === option.value ? "border-ds-accent-deep bg-ds-accent/20" : "border-border bg-background"}`}><div className="font-semibold">{option.title}</div><div className="mt-1 text-xs text-ink-mid">{option.detail}</div></button>
                ))}
              </div>
              <fieldset className="mt-5"><legend className="text-sm font-semibold">Available weekdays</legend><div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">{weekdayLabels.map((label, index) => <button key={label} type="button" aria-pressed={settings.freeWeekdays.includes(index)} aria-label={`${label} ${settings.freeWeekdays.includes(index) ? "selected" : "not selected"} as a study day`} onClick={() => toggleWeekday(index)} className={`min-h-11 rounded-lg border text-xs font-semibold ${settings.freeWeekdays.includes(index) ? "border-ds-accent-deep bg-ds-accent text-ink-fixed" : "border-border bg-background text-ink-muted"}`}>{label}</button>)}</div></fieldset>
              <div className="mt-5">
                <label htmlFor="blackout-date" className="text-sm font-semibold">One-off unavailable date</label>
                <div className="mt-2 flex min-w-0 flex-wrap gap-2"><input id="blackout-date" type="date" min={settings.startDate} max={settings.satDate ? addDays(settings.satDate, -1) : undefined} value={blackoutDraft} onChange={(event) => setBlackoutDraft(event.target.value)} className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3" /><button type="button" onClick={addBlackoutDate} disabled={!blackoutDraft} className="min-h-11 rounded-lg border border-border bg-background px-4 font-semibold disabled:opacity-50">Add</button></div>
                {settings.blackoutDates.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{settings.blackoutDates.map((date) => <button key={date} type="button" onClick={() => updateSetting("blackoutDates", settings.blackoutDates.filter((item) => item !== date))} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-3 text-xs font-semibold" aria-label={`Remove unavailable date ${formatStudyPlanDate(date, "long")}`}>{formatStudyPlanDate(date)}<X className="h-3.5 w-3.5" /></button>)}</div>}
              </div>
            </section>

            <section className={`${sectionClass} min-w-0 p-4 sm:p-5`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-cobalt-ink dark:text-cobalt">3 · Priorities</div>
              <h2 className="mt-1 text-lg font-semibold">Choose focus and intensity</h2>
              <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                {studyPlanFocusAreas.map((area) => {
                  const active = settings.focus.includes(area.id);
                  return <div key={area.id} className={`min-w-0 rounded-xl border p-3 ${active ? "border-ds-accent-deep bg-ds-accent/10" : "border-border bg-background"}`}>
                    <button type="button" aria-pressed={active} onClick={() => toggleFocus(area.id)} className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 text-left"><span className="min-w-0"><span className="block truncate font-semibold">{area.label}</span><span className="mt-0.5 block text-xs text-ink-muted">{area.section}</span></span>{active && <Check className="h-4 w-4 shrink-0" />}</button>
                    {active && <div className="mt-3 grid grid-cols-3 gap-1" role="group" aria-label={`Intensity for ${area.label}`}>{(["light", "normal", "heavy"] as const).map((level) => <button key={level} type="button" aria-pressed={settings.intensity[area.id] === level} onClick={() => setIntensity(area.id, level)} className={`min-h-11 rounded-lg text-xs font-semibold capitalize ${settings.intensity[area.id] === level ? "bg-ink-fixed text-white dark:bg-white dark:text-ink-fixed" : "border border-border bg-card text-ink-mid"}`}>{level}</button>)}</div>}
                  </div>;
                })}
              </div>
            </section>

            <section className={`${sectionClass} p-4 sm:p-5`}>
              <h2 className="font-semibold">Plan data</h2>
              <p className="mt-1 text-sm text-ink-mid">Anonymous plans stay on this device. {user ? "Your signed-in plan can also sync without uploading the original report." : "Sign in later to sync derived plan data."}</p>
              <div className="mt-3 text-xs font-semibold text-ink-muted" role="status" aria-live="polite">{persistenceStatusText}</div>
              {planDataError && <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm" role="alert">{planDataError}</div>}
              <div className="mt-4 flex flex-wrap gap-2">
                {backup && <button type="button" onClick={() => void restoreBackup()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold"><RotateCcw className="h-4 w-4" />Restore older plan</button>}
                <button type="button" onClick={() => void startOver()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-500/40 px-4 text-sm font-semibold text-red-600"><Trash2 className="h-4 w-4" />Start over and delete plan data</button>
              </div>
            </section>
          </div>

          <aside className="hidden min-w-0 md:block lg:sticky lg:top-6 lg:self-start">
            <section className={`${sectionClass} p-5`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Schedule preview</div>
              <div className="mt-3 text-3xl font-semibold">{Math.max(0, daysBetween(settings.startDate, settings.satDate))}</div>
              <div className="text-sm text-ink-mid">days in your runway</div>
              <div className="mt-5 space-y-3 text-sm">
                <div className="rounded-lg bg-background p-3"><div className="text-xs font-semibold uppercase text-ink-muted">Study load</div><div className="mt-1 font-semibold">{settings.freeWeekdays.length} days/week · up to {settings.minutesPerDay} min</div></div>
                <div className="rounded-lg bg-background p-3"><div className="text-xs font-semibold uppercase text-ink-muted">Assignments</div><div className="mt-1 font-semibold">{generated.length || "No assignments yet"}</div></div>
                <div className="rounded-lg bg-background p-3"><div className="text-xs font-semibold uppercase text-ink-muted">First assignment</div><div className="mt-1 font-semibold">{previewTask?.title ?? "Choose a valid date range"}</div>{previewTask && <div className="mt-1 text-ink-mid">{formatStudyPlanDate(previewTask.date)} · {previewTask.minutes} min</div>}</div>
              </div>
              {validationErrors.length > 0 && <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm" role="alert"><div className="font-semibold">Fix before creating</div><ul className="mt-1 list-disc pl-5 text-ink-mid">{validationErrors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
              {!validationErrors.length && !generated.length && <div className="mt-4 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm" role="alert">No assignments fit these dates and weekdays. Add a weekday or move the start date earlier.</div>}
              {scheduleSaveError && <div id="study-plan-save-error-desktop" className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm" role="alert">{scheduleSaveError}</div>}
              <button type="button" onClick={() => void saveSchedule()} aria-busy={scheduleSaveStatus === "saving"} aria-describedby={scheduleSaveError ? "study-plan-save-error-desktop" : undefined} disabled={Boolean(validationErrors.length) || !generated.length || isParsing || scheduleSaveStatus === "saving"} className="mt-5 min-h-12 w-full rounded-lg bg-ink-fixed px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-ink-fixed">{saveButtonLabel}</button>
            </section>
          </aside>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 p-3 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur md:hidden" data-print-hidden>
          {mobileActionError && <p id="mobile-study-plan-error" className="mb-2 text-sm font-semibold text-red-700" role="alert">{mobileActionError}</p>}
          <button type="button" onClick={() => void saveSchedule()} aria-busy={scheduleSaveStatus === "saving"} aria-describedby={mobileActionError ? "mobile-study-plan-error" : undefined} disabled={Boolean(validationErrors.length) || !generated.length || isParsing || scheduleSaveStatus === "saving"} className="min-h-12 w-full rounded-lg bg-ink-fixed px-4 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-ink-fixed">{saveButtonLabel}</button>
        </div>
      </div>
    );
  }

  return (
    <div data-study-plan-lab data-rebalance-pending={activeRebalance ? "true" : "false"} className="mx-auto w-full max-w-[78rem] min-w-0 px-4 py-5 text-ink sm:px-5 lg:px-7">
      <style>{printCss}</style>
      <section data-print-plan className="hidden bg-white text-black">
        <header className="mb-6 border-b border-black/20 pb-4"><div className="text-sm font-semibold uppercase tracking-wide">1600.now SAT Study Plan</div><h1 className="mt-2 text-3xl font-semibold">Daily SAT Plan</h1><div className="mt-3 text-sm">Test date: {formatStudyPlanDate(settings.satDate, "long")} · {activeTaskCount} assignments · {totalMinutes} minutes</div></header>
        <div className="space-y-5">{printableWeeks.map((week) => <section key={week.weekStart} className="break-inside-avoid rounded border border-black/20 p-4"><div className="mb-3 flex justify-between border-b border-black/10 pb-2"><h2 className="font-semibold">Week of {formatStudyPlanDate(week.weekStart)}–{formatStudyPlanDate(week.weekEnd)}</h2><span>{week.minutes} min</span></div><div className="space-y-3">{week.tasks.map((task) => <article key={task.id} className="grid grid-cols-[7rem_1fr_5rem] gap-3 text-sm"><div>{formatStudyPlanDate(task.date)}</div><div><div className="font-semibold">{task.title}</div><div>{task.detail}</div></div><div className="text-right font-semibold">{task.minutes} min</div></article>)}</div></section>)}</div>
      </section>

      <div className="grid min-w-0 gap-5 print:hidden xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          <header className={`${sectionClass} min-w-0 overflow-hidden`}>
            <div className="border-b border-border p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><Title className="text-2xl font-semibold tracking-tight">Your SAT study plan</Title><p className="mt-1 text-sm text-ink-mid">{formatStudyPlanDate(settings.satDate)} weekend SAT · {settings.currentReadingWriting + settings.currentMath} current · {settings.targetScore} target</p></div><div className="flex gap-2"><button type="button" onClick={() => { trackStudyPlanPrint({ taskCount: activeTaskCount, planLengthDays: daysBetween(settings.startDate, settings.satDate) }); window.print(); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold"><Printer className="h-4 w-4" />Print</button><button type="button" onClick={beginEditSchedule} className="min-h-11 rounded-lg border border-border bg-background px-4 text-sm font-semibold">Edit</button></div></div>
            </div>
            <div className="bg-gradient-to-br from-cobalt/10 via-transparent to-ds-accent/20 p-4 sm:p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cobalt-ink dark:text-cobalt">Next assignment</div>
              {nextTask ? <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0"><div className="text-xl font-semibold sm:text-2xl">{nextTask.title}</div><div className="mt-1 text-sm text-ink-mid">{formatStudyPlanDate(nextTask.date, "long")} · {nextTask.minutes} minutes</div></div><button type="button" onClick={() => { goToTask(nextTask); if (nextTask.action.kind !== "checklist") void openTask(nextTask); }} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-ink-fixed px-5 font-semibold text-white dark:bg-white dark:text-ink-fixed">{nextTask.action.kind === "checklist" ? "View next assignment" : actionLabel(nextTask)}<MoveRight className="h-4 w-4" /></button></div> : <div className="mt-3 font-semibold">Plan complete. No unfinished assignments remain.</div>}
            </div>
            <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4"><div className="bg-card p-4"><div className="text-xs font-semibold uppercase text-ink-muted">Countdown</div><div className="mt-1 text-2xl font-semibold">{Math.max(0, daysBetween(today, settings.satDate))}</div><div className="text-xs text-ink-mid">days</div></div><div className="bg-card p-4"><div className="text-xs font-semibold uppercase text-ink-muted">Progress</div><div className="mt-1 text-2xl font-semibold">{completedCount}/{activeTaskCount}</div><div className="text-xs text-ink-mid">completed</div></div><div className="bg-card p-4"><div className="text-xs font-semibold uppercase text-ink-muted">Daily cap</div><div className="mt-1 text-2xl font-semibold">{settings.minutesPerDay}</div><div className="text-xs text-ink-mid">minutes</div></div><div className="bg-card p-4"><div className="text-xs font-semibold uppercase text-ink-muted">Overdue</div><div className="mt-1 text-2xl font-semibold">{overdueTasks.length}</div><div className="text-xs text-ink-mid">to resolve</div></div></div>
          </header>

          {launchError && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm" role="alert"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div className="flex-1"><div className="font-semibold">Assignment could not start</div><div className="mt-1 text-ink-mid">{launchError}</div></div><button type="button" onClick={() => setLaunchError("")} aria-label="Dismiss launch error" className="min-h-11 min-w-11 rounded-lg"><X className="mx-auto h-4 w-4" /></button></div></div>}

          <section className={`${sectionClass} p-4 xl:hidden`}><div className="text-xs font-semibold uppercase text-ink-muted">Plan data</div><p className="mt-2 text-sm text-ink-mid" role="status" aria-live="polite">{persistenceStatusText}.</p>{planDataError && <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm" role="alert">{planDataError}</div>}<div className="mt-3 flex flex-wrap gap-2">{persistenceRetryNeeded && <button type="button" onClick={retryPlanPersistence} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold"><RefreshCw className="h-4 w-4" />{user ? "Retry sync" : "Retry save"}</button>}{backup && <button type="button" onClick={() => void restoreBackup()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold"><RotateCcw className="h-4 w-4" />Restore backup</button>}<button type="button" onClick={() => void startOver()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-500/40 px-3 text-sm font-semibold text-red-600"><RotateCcw className="h-4 w-4" />Start over</button></div></section>

          {overdueTasks.length > 0 && <section className={`${sectionClass} border-amber-400/40 p-4 sm:p-5`}><div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-amber-600" /><h2 className="font-semibold">Resolve overdue work</h2></div><div className="mt-3 space-y-3">{overdueTasks.slice(0, 3).map((task) => <div key={task.id} className="rounded-lg bg-background p-3"><div className="font-semibold">{task.title}</div><div className="mt-1 text-xs text-ink-mid">Originally {formatStudyPlanDate(task.date, "long")}</div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => goToTask(task)} className="min-h-11 rounded-lg border border-border px-3 text-sm font-semibold">Keep</button><button type="button" onClick={() => moveOverdueTask(task)} className="min-h-11 rounded-lg border border-border px-3 text-sm font-semibold">Move forward</button><button type="button" onClick={() => updateTaskProgress(task.id, { completed: true, skipped: true, completedAt: new Date().toISOString() })} className="min-h-11 rounded-lg border border-border px-3 text-sm font-semibold">Skip</button></div></div>)}</div></section>}

          {activeRebalance && <section className={`${sectionClass} border-cobalt/40 p-4 sm:p-5`}><div className="text-xs font-semibold uppercase tracking-wide text-cobalt-ink dark:text-cobalt">Proposed rebalance</div><h2 className="mt-1 font-semibold">Increase future weighting toward {activeRebalance.strengthen}</h2><p className="mt-2 text-sm text-ink-mid">Your last assignment was {Math.round(activeRebalance.accuracy)}% accurate. Future generation will prioritize {activeRebalance.strengthen}{activeRebalance.reduce ? ` and reduce the weighting of ${activeRebalance.reduce}` : ""}. {activeRebalance.missedQuestionRefs.length ? "If a compatible future slot is available, one assignment will be replaced with a budgeted review of actual missed questions. " : ""}The exact number of affected sessions depends on the remaining calendar. Completed and historical assignments stay locked.</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={applyRebalance} className="min-h-11 rounded-lg bg-ink-fixed px-4 text-sm font-semibold text-white dark:bg-white dark:text-ink-fixed">Apply proposal</button><button type="button" onClick={keepCurrentPlan} className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold">Keep current plan</button></div></section>}

          <section className={`${sectionClass} min-w-0 p-4 sm:p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Schedule</h2><p className="mt-1 text-sm text-ink-mid">Navigate every month from your start date through test day.</p></div><div className="flex flex-wrap gap-2"><button type="button" aria-label={`Today, ${formatStudyPlanDate(today, "long")}`} onClick={() => { trackStudyPlanCalendarNavigation({ action: "today", view: "month" }); goToDate(today); }} className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm font-semibold">Today</button><button type="button" aria-label={nextTask ? `Next assignment, ${formatStudyPlanDate(nextTask.date, "long")}` : "No next assignment"} onClick={() => { trackStudyPlanCalendarNavigation({ action: "next_assignment", view: "month" }); goToTask(nextTask); }} disabled={!nextTask} className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm font-semibold disabled:opacity-50">Next assignment</button></div></div>
            <div className="mt-5 hidden md:block">
              <div className="mb-3 flex items-center justify-between gap-3"><button type="button" aria-label={`Previous month, ${formatStudyPlanDate(addMonths(visibleMonth, -1), "month")}`} disabled={visibleMonth <= minMonth} onClick={() => { trackStudyPlanCalendarNavigation({ action: "previous", view: "month" }); setVisibleMonth(addMonths(visibleMonth, -1)); }} className="min-h-11 min-w-11 rounded-lg border border-border bg-background disabled:opacity-40"><ChevronLeft className="mx-auto h-4 w-4" /></button><h3 className="font-semibold" aria-live="polite">{formatStudyPlanDate(visibleMonth, "month")}</h3><button type="button" aria-label={`Next month, ${formatStudyPlanDate(addMonths(visibleMonth, 1), "month")}`} disabled={visibleMonth >= maxMonth} onClick={() => { trackStudyPlanCalendarNavigation({ action: "next", view: "month" }); setVisibleMonth(addMonths(visibleMonth, 1)); }} className="min-h-11 min-w-11 rounded-lg border border-border bg-background disabled:opacity-40"><ChevronRight className="mx-auto h-4 w-4" /></button></div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink-muted">{weekdayLabels.map((day) => <div key={day} className="py-2">{day}</div>)}</div>
              <div className="grid grid-cols-7 gap-1">{monthDays.map((date) => {
                const dayTasks = tasksByDate.get(date) ?? [];
                const isSelected = date === selectedDate;
                const inMonth = date.slice(0, 7) === visibleMonth.slice(0, 7);
                const withinPlan = date >= settings.startDate && date < settings.satDate;
                const allDone = dayTasks.length > 0 && dayTasks.every((task) => progress[task.id]?.completed);
                const label = dayTasks.length ? `${dayTasks.length} assignment${dayTasks.length === 1 ? "" : "s"}` : date < settings.startDate ? "Before plan" : withinPlan && !isStudyPlanDay(date, settings) ? "Rest day" : withinPlan ? "No assignment" : "Outside plan";
                return <button key={date} type="button" aria-label={`${formatStudyPlanDate(date, "long")}: ${label}`} aria-pressed={isSelected} onClick={() => setSelectedDate(date)} className={`min-h-24 min-w-0 overflow-hidden rounded-lg border p-2 text-left ${isSelected ? "border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-ink-fixed" : inMonth && withinPlan ? "border-border bg-background hover:border-cobalt" : "border-transparent bg-transparent text-ink-mid"}`}><div className="flex items-center justify-between"><span className="text-xs font-semibold">{new Date(`${date}T12:00:00`).getDate()}</span>{allDone && <Check className="h-3.5 w-3.5" />}</div><div className="mt-2 text-[11px] font-semibold leading-tight">{label}</div>{dayTasks[0] && <div className="mt-1 truncate text-[10px]">{dayTasks[0].minutes} min</div>}</button>;
              })}</div>
            </div>
            <div className="mt-5 md:hidden">
              <h3 className="font-semibold">Chronological agenda</h3>
              <div className="mt-3 space-y-2">{tasks.map((task) => <button key={task.id} type="button" aria-label={`${formatStudyPlanDate(task.date, "long")}: ${task.title}, ${task.minutes} minutes, ${typeLabels[task.type]}${progress[task.id]?.skipped ? ", skipped" : progress[task.id]?.completed ? ", completed" : ""}`} aria-pressed={task.date === selectedDate} onClick={() => goToTask(task)} className={`flex min-h-16 w-full items-center gap-3 rounded-xl border p-3 text-left ${task.date === selectedDate ? "border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-ink-fixed" : "border-border bg-background"}`}><div className="w-16 shrink-0 text-xs font-semibold">{formatStudyPlanDate(task.date)}</div><div className="min-w-0 flex-1"><div className="truncate font-semibold">{task.title}{progress[task.id]?.skipped ? " (skipped)" : ""}</div><div className="mt-0.5 text-xs opacity-75">{task.minutes} min · {typeLabels[task.type]}</div></div>{progress[task.id]?.completed && <Check className="h-4 w-4 shrink-0" />}</button>)}</div>
            </div>
          </section>

          <div className="xl:hidden">{selectedDayPanel}</div>
        </div>
        <aside className="hidden min-w-0 space-y-4 xl:block">{selectedDayPanel}<section className={`${sectionClass} p-4`}><div className="text-xs font-semibold uppercase text-ink-muted">Plan data</div><p className="mt-2 text-sm text-ink-mid" role="status" aria-live="polite">{persistenceStatusText}.</p>{planDataError && <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm" role="alert">{planDataError}</div>}{persistenceRetryNeeded && <button type="button" onClick={retryPlanPersistence} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold"><RefreshCw className="h-4 w-4" />{user ? "Retry sync" : "Retry save"}</button>}{backup && <button type="button" onClick={() => void restoreBackup()} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold"><RotateCcw className="h-4 w-4" />Restore backup</button>}<button type="button" onClick={() => void startOver()} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-500/40 px-3 text-sm font-semibold text-red-600"><RotateCcw className="h-4 w-4" />Start over</button></section></aside>
      </div>

      <AlertDialog open={Boolean(practiceConflict)} onOpenChange={(open) => { if (!open) setPracticeConflict(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assignment settings changed</AlertDialogTitle>
            <AlertDialogDescription>
              {practiceConflict && (() => {
                const previousMinutes = practiceConflict.existing.context.timingMode.kind === "countdown"
                  ? Math.ceil(practiceConflict.existing.context.timingMode.timeLimitSeconds / 60)
                  : null;
                const previousQuestions = practiceConflict.existing.context.source.kind === "practice-set"
                  ? practiceConflict.existing.context.source.questionRefs.length
                  : practiceConflict.stored.length;
                const currentAction = practiceConflict.task.action;
                const currentMinutes = currentAction.kind === "timed-set" || currentAction.kind === "missed-review"
                  ? currentAction.timeLimitMinutes
                  : practiceConflict.task.minutes;
                const currentQuestions = currentAction.kind === "timed-set"
                  ? currentAction.questionCount
                  : currentAction.kind === "missed-review"
                    ? currentAction.questionRefs.length
                    : 0;
                return `The saved assignment uses ${previousMinutes ?? "an untimed session"}${previousMinutes ? " minutes" : ""} and ${previousQuestions} questions. Resume those original settings, or restart with the current ${currentMinutes}-minute, ${currentQuestions}-question assignment.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep paused</AlertDialogCancel>
            <AlertDialogAction onClick={resumePracticeConflict}>Resume saved assignment</AlertDialogAction>
            <button type="button" onClick={restartPracticeConflict} className="inline-flex min-h-11 items-center justify-center rounded-md border border-red-500/40 px-4 font-semibold text-red-700 dark:text-red-300">Restart with current settings</button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(moduleConflict)} onOpenChange={(open) => { if (!open) setModuleConflict(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Module already in progress</AlertDialogTitle>
            <AlertDialogDescription>
              {moduleConflict?.matchesAssignmentSettings
                ? "Resume the matching timed module where you stopped, or restart and erase that unfinished session."
                : "The unfinished module uses different timing or answer-checking settings. Resume it without counting it toward this assignment, or restart with the assigned settings."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={resumeConflictingModule}>Resume</AlertDialogAction>
            <button type="button" onClick={restartConflictingModule} className="inline-flex min-h-11 items-center justify-center rounded-md border border-red-500/40 px-4 font-semibold text-red-600">Restart module</button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StudyPlanLab;
