import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  ClipboardList,
  Clock3,
  FileText,
  Minus,
  MoveRight,
  Plus,
  Printer,
  Upload,
} from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  buildModulePracticeSet,
  getPracticeModule,
  getPracticeModules,
  type PracticeModule,
} from "@/data/modulePracticeBank";
import {
  allEnglishDomains,
  allMathDomains,
  englishDomainSkills,
  mathDomainSkills,
  type EnglishDomain,
  type EnglishSkill,
  type MathDomain,
  type MathSkill,
} from "@/data/questionCategories";
import {
  loadQuestionsByDomain,
  loadQuestionsBySkill,
  type BankQuestion,
  type BankSubject,
} from "@/data/questionBank";
import {
  clearModulePracticeSession,
  createModulePracticeSession,
  getModulePracticeDefaultTimeMinutes,
} from "@/lib/practice/modulePracticeSession";
import { PRACTICE_RUN_STORAGE_KEY } from "@/lib/practice/practiceRunStorage";
import { buildModulePracticeQuestionRoute, buildPracticeBankQuestionRoute } from "@/lib/practice/practiceBankRoutes";
import {
  parseScoreReportFile,
  type ParsedScoreReport,
  type ScoreReportFocusId,
} from "@/lib/studyPlan/scoreReportParser";

type FocusId =
  | MathDomain
  | EnglishDomain
  | "Pacing"
  | "Full Practice";

type Intensity = "light" | "normal" | "heavy";
type TaskType = "diagnostic" | "learn" | "drill" | "review" | "timed" | "mock" | "taper";
type ViewMode = "dashboard" | "settings";
type PacingMode = "steady" | "tighten";
type PlannerTaskAction =
  | {
      kind: "bank-set";
      subject: BankSubject;
      filterType: "domain" | "skill";
      filterValue: string;
      questionCount: number;
    }
  | {
      kind: "module";
      moduleSlug: string;
      timeLimitMinutes: number;
    }
  | {
      kind: "module-slice";
      moduleSlug: string;
      startQuestionIndex: number;
      questionCount: number;
      timeLimitMinutes: number;
      sliceLabel: "first half" | "second half";
    };

interface FocusArea {
  id: FocusId;
  label: string;
  section: "Math" | "Reading and Writing" | "Strategy";
  skills: string[];
}

interface PlannerSettings {
  setupComplete: boolean;
  startDate: string;
  satDate: string;
  targetScore: number;
  currentMath: number;
  currentReadingWriting: number;
  minutesPerDay: number;
  pacingMode: PacingMode;
  freeWeekdays: number[];
  focus: FocusId[];
  intensity: Record<FocusId, Intensity>;
  blackoutDates: string[];
}

interface UploadedScoreReport {
  name: string;
  type: string;
  size: number;
  addedAt: string;
  parsed?: ParsedScoreReport;
  error?: string;
}

interface PlannerTask {
  id: string;
  date: string;
  title: string;
  minutes: number;
  focus: FocusId;
  type: TaskType;
  detail: string;
  route?: string;
  action?: PlannerTaskAction;
}

interface StoredProgress {
  completed: Record<string, boolean>;
  confidence: Record<string, "hard" | "okay" | "easy">;
}

const STORAGE_KEY = "1600now-study-plan-lab";
const PROGRESS_KEY = "1600now-study-plan-progress";
const SCORE_REPORT_KEY = "1600now-study-plan-score-report";
const PLAN_SNAPSHOT_KEY = "1600now-study-plan-snapshot";

const officialSatDates = [
  { date: "2026-08-22", monthLabel: "August 2026", label: "Aug. 22, 2026", deadline: "Aug. 7, 2026" },
  { date: "2026-09-12", monthLabel: "September 2026", label: "Sept. 12, 2026", deadline: "Aug. 28, 2026" },
  { date: "2026-10-03", monthLabel: "October 2026", label: "Oct. 3, 2026", deadline: "Sept. 18, 2026" },
  { date: "2026-11-07", monthLabel: "November 2026", label: "Nov. 7, 2026", deadline: "Oct. 23, 2026" },
  { date: "2026-12-05", monthLabel: "December 2026", label: "Dec. 5, 2026", deadline: "Nov. 20, 2026" },
  { date: "2027-03-06", monthLabel: "March 2027", label: "March 6, 2027", deadline: "Feb. 19, 2027" },
  { date: "2027-05-01", monthLabel: "May 2027", label: "May 1, 2027", deadline: "Apr. 16, 2027" },
  { date: "2027-06-05", monthLabel: "June 2027", label: "June 5, 2027", deadline: "May 21, 2027" },
];

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const officialSatDateKeys = new Set(officialSatDates.map((date) => date.date));
const defaultToday = "2026-06-15";
const studyPlanPrintCss = `
  @media print {
    body aside,
    body nav {
      display: none !important;
    }
    #root,
    #root > div,
    #root > div > div,
    body > div,
    body > div > div,
    body > div > div > div,
    .study-plan-shell-reset,
    body:has([data-study-plan-lab]) .lg\\:pl-64,
    body:has([data-study-plan-lab]) .lg\\:pl-\\[4\\.5625rem\\] {
      max-width: none !important;
      margin: 0 !important;
      padding-left: 0 !important;
      padding-top: 0 !important;
    }
    body:has([data-study-plan-lab]) [data-study-plan-lab] {
      max-width: none !important;
      margin: 0 !important;
      padding: 0 !important;
    }
  }
`;

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const currentDateKey = () => {
  const today = new Date();
  if (Number.isNaN(today.getTime())) return defaultToday;
  const runtimeToday = toDateKey(today);
  return runtimeToday < defaultToday ? defaultToday : runtimeToday;
};

const addDays = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

const formatDate = (dateKey: string, style: "short" | "long" = "short") =>
  new Intl.DateTimeFormat("en-US", {
    month: style === "long" ? "long" : "short",
    day: "numeric",
    year: style === "long" ? "numeric" : undefined,
    weekday: style === "long" ? "long" : undefined,
  }).format(new Date(`${dateKey}T12:00:00`));

const daysBetween = (start: string, end: string) =>
  Math.ceil((new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86400000);

const nextOfficialDate = () => {
  const todayKey = currentDateKey();
  return officialSatDates.find((item) => item.date > todayKey)?.date ?? officialSatDates[0].date;
};

const mathFocus: FocusArea[] = allMathDomains.map((domain) => ({
  id: domain,
  label: domain,
  section: "Math",
  skills: mathDomainSkills[domain].slice(0, 3),
}));

const isVocabSkill = (skill: string) => /vocab|words in context/i.test(skill);

const englishFocus: FocusArea[] = allEnglishDomains.map((domain) => ({
  id: domain,
  label: domain,
  section: "Reading and Writing",
  skills: englishDomainSkills[domain].filter((skill) => !isVocabSkill(skill)).slice(0, 3),
}));

const strategyFocus: FocusArea[] = [
  {
    id: "Pacing",
    label: "Pacing",
    section: "Strategy",
    skills: ["Module timing", "Question triage", "End-check routine"],
  },
  {
    id: "Full Practice",
    label: "Full Practice",
    section: "Strategy",
    skills: ["Bluebook test", "Score review", "Stamina"],
  },
];

const focusAreas: FocusArea[] = [...englishFocus, ...mathFocus, ...strategyFocus];
const focusById = new Map(focusAreas.map((focus) => [focus.id, focus]));

const defaultIntensity = focusAreas.reduce((acc, focus) => {
  acc[focus.id] = "normal";
  return acc;
}, {} as Record<FocusId, Intensity>);

const defaultSettings = (): PlannerSettings => ({
  setupComplete: false,
  startDate: currentDateKey(),
  satDate: nextOfficialDate(),
  targetScore: 1450,
  currentMath: 610,
  currentReadingWriting: 620,
  minutesPerDay: 45,
  pacingMode: "steady",
  freeWeekdays: [1, 2, 3, 4, 6],
  focus: [
    "Standard English Conventions",
    "Information and Ideas",
    "Advanced Math",
    "Problem-Solving and Data Analysis",
    "Pacing",
  ],
  intensity: defaultIntensity,
  blackoutDates: [],
});

const practiceTestModules = getPracticeModules()
  .sort((left, right) => {
    if (left.setNumber !== right.setNumber) return left.setNumber - right.setNumber;
    if (left.subject !== right.subject) return left.subject === "reading" ? -1 : 1;
    if (left.moduleNumber !== right.moduleNumber) return left.moduleNumber - right.moduleNumber;
    return left.slug.localeCompare(right.slug);
  });

const moduleForIndex = (index: number): PracticeModule | null =>
  practiceTestModules.length ? practiceTestModules[index % practiceTestModules.length] : null;

const fullModuleBudgetMinutes = Math.max(
  35,
  ...practiceTestModules.map((module) => getModulePracticeDefaultTimeMinutes(module.subject)),
);

const questionCountForMinutes = (minutes: number, subject: BankSubject) => {
  const perQuestion = subject === "math" ? 4 : 3;
  return Math.max(5, Math.min(18, Math.round(minutes / perQuestion)));
};

const moduleActionForIndex = (index: number, timeLimitMinutes: number): Extract<PlannerTaskAction, { kind: "module" }> => {
  const module = moduleForIndex(index);
  return {
    kind: "module",
    moduleSlug: module?.slug ?? "",
    timeLimitMinutes,
  };
};

const moduleSliceActionForIndex = (index: number, timeLimitMinutes: number): Extract<PlannerTaskAction, { kind: "module-slice" }> => {
  const module = moduleForIndex(Math.floor(index / 2));
  const firstHalf = index % 2 === 0;
  const midpoint = module ? Math.ceil(module.questionCount / 2) : 0;
  return {
    kind: "module-slice",
    moduleSlug: module?.slug ?? "",
    startQuestionIndex: firstHalf ? 0 : midpoint,
    questionCount: module ? (firstHalf ? midpoint : module.questionCount - midpoint) : 0,
    timeLimitMinutes,
    sliceLabel: firstHalf ? "first half" : "second half",
  };
};

const bankActionForFocus = (focus: FocusId, minutes: number, index: number): PlannerTaskAction => {
  const area = focusById.get(focus);
  if (!area || area.section === "Strategy") {
    return minutes < fullModuleBudgetMinutes
      ? moduleSliceActionForIndex(index, minutes)
      : moduleActionForIndex(index, Math.min(minutes, fullModuleBudgetMinutes));
  }
  const subject: BankSubject = area.section === "Math" ? "math" : "reading";
  const skill = area.skills[index % Math.max(1, area.skills.length)];
  return {
    kind: "bank-set",
    subject,
    filterType: area.section === "Reading and Writing" && skill ? "skill" : "domain",
    filterValue: area.section === "Reading and Writing" && skill ? skill : area.label,
    questionCount: questionCountForMinutes(minutes, subject),
  };
};

const taskTypeLabel: Record<TaskType, string> = {
  diagnostic: "Diagnostic",
  learn: "Learn",
  drill: "Drill",
  review: "Review",
  timed: "Timed",
  mock: "Mock",
  taper: "Taper",
};

const taskTypeClass: Record<TaskType, string> = {
  diagnostic: "border-cobalt/40 bg-cobalt/10 text-cobalt-ink dark:text-cobalt",
  learn: "border-ds-accent-deep/50 bg-ds-accent/20 text-ink",
  drill: "border-ds-good/40 bg-ds-good/10 text-green-700 dark:text-green-300",
  review: "border-amber-400/50 bg-amber-300/15 text-amber-700 dark:text-amber-200",
  timed: "border-fuchsia-400/40 bg-fuchsia-300/10 text-fuchsia-700 dark:text-fuchsia-200",
  mock: "border-ink/25 bg-ink/5 text-ink dark:border-white/30 dark:bg-white/10",
  taper: "border-ds-line/50 bg-muted/60 text-ink-mid",
};

const buildDateRange = (start: string, end: string) => {
  const totalDays = Math.max(0, daysBetween(start, end));
  return Array.from({ length: totalDays }, (_, index) => addDays(start, index));
};

const isStudyDay = (dateKey: string, settings: PlannerSettings) => {
  const weekday = new Date(`${dateKey}T12:00:00`).getDay();
  return settings.freeWeekdays.includes(weekday) && !settings.blackoutDates.includes(dateKey);
};

const getFocusWeight = (focus: FocusId, settings: PlannerSettings) => {
  const intensity = settings.intensity[focus] ?? "normal";
  if (intensity === "heavy") return 3;
  if (intensity === "light") return 1;
  return 2;
};

const weightedFocusQueue = (settings: PlannerSettings) => {
  const queue = settings.focus.flatMap((focus) =>
    Array.from({ length: getFocusWeight(focus, settings) }, () => focus),
  );
  return queue.length > 0 ? queue : defaultSettings().focus;
};

const actionLabel = (action?: PlannerTaskAction) => {
  if (!action) return "practice";
  if (action.kind === "bank-set") return `${action.questionCount}-question set`;
  const module = getPracticeModule(action.moduleSlug);
  const moduleLabel = module
    ? module.testName.includes(module.publicTitle)
      ? module.testName
      : `${module.testName} ${module.publicTitle}`
    : "SAT module";
  if (action.kind === "module-slice") {
    const start = action.startQuestionIndex + 1;
    const end = action.startQuestionIndex + action.questionCount;
    return `${moduleLabel} ${action.sliceLabel}, Q${start}-${end} (${action.timeLimitMinutes} min)`;
  }
  return `${moduleLabel} (${action.timeLimitMinutes} min)`;
};

const taskTitleFor = (type: TaskType, focus: FocusId, action?: PlannerTaskAction) => {
  const area = focusById.get(focus);
  const label = area?.label ?? focus;
  if (type === "diagnostic") return "Baseline score report review";
  if (type === "learn") return `${label} concept pass`;
  if (type === "drill") return `${label} ${actionLabel(action)}`;
  if (type === "review") return `${label} mistake review`;
  if (type === "timed") return action?.kind === "module" || action?.kind === "module-slice" ? `Timed ${actionLabel(action)}` : `${label} timed ${actionLabel(action)}`;
  if (type === "mock") return `Official ${actionLabel(action)}`;
  return "Light test-week review";
};

const taskDetailFor = (type: TaskType, focus: FocusId, action?: PlannerTaskAction) => {
  const area = focusById.get(focus);
  const skills = area?.skills.slice(0, 2).join(" and ");
  if (type === "diagnostic") return `Start with a concrete ${actionLabel(action)} from one weak area, then review every miss.`;
  if (type === "learn") return `Review the core rule set, then solve untimed examples${skills ? ` for ${skills}` : ""}.`;
  if (type === "drill") return `Complete the assigned ${actionLabel(action)}, review every miss, and tag the reason for each error.`;
  if (type === "review") return "Redo missed problems without notes, then write the shortest rule that would prevent the miss.";
  if (type === "timed") return action?.kind === "module"
    ? "Use the shorter timer, stop when time expires, then review the misses inside today's study block."
    : action?.kind === "module-slice"
      ? "Take only this half-module today, then continue the next practice chunk on another study day."
    : `Run the assigned ${actionLabel(action)} under time pressure, then review misses.`;
  if (type === "mock") return action?.kind === "module-slice"
    ? "Take this half-module instead of a full test sitting, then review misses before the next chunk."
    : "Run the assigned official module and use the results to refresh next week's priorities.";
  return "Keep it light: formulas, grammar rules, pacing checkpoints, and sleep schedule.";
};

const moduleMinutesFor = (settings: PlannerSettings, weekIndex: number) =>
  settings.pacingMode === "tighten"
    ? Math.max(25, fullModuleBudgetMinutes - Math.floor(weekIndex / 2) * 2)
    : fullModuleBudgetMinutes;

const practiceTaskFocusFor = (type: TaskType): FocusId =>
  type === "mock" ? "Full Practice" : "Pacing";

const reviewTaskForRemainder = (
  dateKey: string,
  focus: FocusId,
  minutes: number,
  index: number,
): PlannerTask => ({
  id: `${dateKey}-practice-review-${focus}-${index}`,
  date: dateKey,
  title: taskTitleFor("review", focus),
  minutes,
  focus,
  type: "review",
  detail: taskDetailFor("review", focus),
});

const buildPracticeTasksForDay = (
  dateKey: string,
  type: TaskType,
  dailyBudget: number,
  settings: PlannerSettings,
  weekIndex: number,
  index: number,
): PlannerTask[] => {
  const focus = practiceTaskFocusFor(type);
  const moduleMinutes = moduleMinutesFor(settings, weekIndex);

  if (dailyBudget < fullModuleBudgetMinutes) {
    const action = moduleSliceActionForIndex(index, dailyBudget);
    return [{
      id: `${dateKey}-${type}-${focus}-${action.kind}-${action.moduleSlug}-${action.startQuestionIndex}`,
      date: dateKey,
      title: taskTitleFor(type, focus, action),
      minutes: dailyBudget,
      focus,
      type,
      detail: taskDetailFor(type, focus, action),
      action,
    }];
  }

  const moduleCount = dailyBudget >= fullModuleBudgetMinutes * 2 ? 2 : 1;
  let remaining = dailyBudget;
  const tasks: PlannerTask[] = [];

  for (let offset = 0; offset < moduleCount && remaining >= moduleMinutes; offset += 1) {
    const action = moduleActionForIndex(index * moduleCount + offset, moduleMinutes);
    tasks.push({
      id: `${dateKey}-${type}-${focus}-${action.kind}-${action.moduleSlug}`,
      date: dateKey,
      title: taskTitleFor(type, focus, action),
      minutes: moduleMinutes,
      focus,
      type,
      detail: taskDetailFor(type, focus, action),
      action,
    });
    remaining -= moduleMinutes;
  }

  if (remaining > 0) {
    tasks.push(reviewTaskForRemainder(dateKey, focus, remaining, index));
  }

  return tasks;
};

const generatePlan = (settings: PlannerSettings): PlannerTask[] => {
  const range = buildDateRange(settings.startDate, settings.satDate);
  const studyDays = range.filter((dateKey) => isStudyDay(dateKey, settings));
  const queue = weightedFocusQueue(settings);
  const tasks: PlannerTask[] = [];
  const scoreGap = Math.max(0, settings.targetScore - settings.currentMath - settings.currentReadingWriting);
  const dailyBudget = Math.min(150, Math.max(15, Math.round(settings.minutesPerDay / 5) * 5));

  studyDays.forEach((dateKey, index) => {
    const daysUntilTest = daysBetween(dateKey, settings.satDate);
    const weekIndex = Math.floor(index / Math.max(1, settings.freeWeekdays.length));
    const queuedFocus = queue[index % queue.length];
    const isFirstDay = index === 0;
    const isTaper = daysUntilTest <= 6;
    const wantsTimedModule =
      settings.pacingMode === "tighten" &&
      index > 0 &&
      !isTaper &&
      weekIndex % 2 === 1;
    const wantsModule =
      !isFirstDay &&
      !isTaper &&
      (wantsTimedModule ||
        queuedFocus === "Pacing" ||
        queuedFocus === "Full Practice" ||
        ((index + 1) % Math.max(5, settings.freeWeekdays.length * 2) === 0 && daysUntilTest > 7));
    const type: TaskType = isFirstDay
      ? "diagnostic"
      : isTaper
        ? "taper"
        : wantsModule
          ? wantsTimedModule ? "timed" : "mock"
          : weekIndex % 3 === 0
            ? "learn"
            : weekIndex % 3 === 1
              ? "drill"
              : "timed";
    if (wantsModule) {
      tasks.push(...buildPracticeTasksForDay(dateKey, type, dailyBudget, settings, weekIndex, index));
      return;
    }

    const focus = queuedFocus;
    const reviewFits =
      dailyBudget >= 45 &&
      !isTaper &&
      type !== "diagnostic" &&
      (index % 2 === 1 || scoreGap >= 180);
    const reviewMinutes = reviewFits ? Math.min(30, Math.max(15, Math.round((dailyBudget * 0.35) / 5) * 5)) : 0;
    const minutes = dailyBudget - reviewMinutes;
    const action = bankActionForFocus(focus, minutes, index);

    tasks.push({
      id: `${dateKey}-${type}-${focus}`,
      date: dateKey,
      title: taskTitleFor(type, focus, action),
      minutes,
      focus,
      type,
      detail: taskDetailFor(type, focus, action),
      action,
    });

    if (reviewFits) {
      const reviewFocus = queue[(index + 2) % queue.length];
      const reviewAction = bankActionForFocus(reviewFocus, reviewMinutes, index + 2);
      tasks.push({
        id: `${dateKey}-review-${reviewFocus}`,
        date: dateKey,
        title: taskTitleFor("review", reviewFocus, reviewAction),
        minutes: reviewMinutes,
        focus: reviewFocus,
        type: "review",
        detail: taskDetailFor("review", reviewFocus, reviewAction),
        action: reviewAction,
      });
    }
  });

  return tasks.sort((a, b) => `${a.date}-${a.id}`.localeCompare(`${b.date}-${b.id}`));
};

const loadJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    if (fallback && typeof fallback === "object" && !Array.isArray(fallback) && parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { ...fallback, ...parsed };
    }
    return parsed;
  } catch {
    return fallback;
  }
};

const isKnownFocus = (focus: string): focus is FocusId =>
  focusById.has(focus as FocusId);

const normalizeSettings = (settings: PlannerSettings): PlannerSettings => {
  const fallback = defaultSettings();
  const focus = settings.focus.filter((item) => isKnownFocus(item));
  const intensity = focusAreas.reduce((acc, area) => {
    acc[area.id] = settings.intensity?.[area.id] ?? "normal";
    return acc;
  }, {} as Record<FocusId, Intensity>);
  return {
    ...settings,
    satDate: officialSatDateKeys.has(settings.satDate) ? settings.satDate : fallback.satDate,
    pacingMode: settings.pacingMode === "tighten" ? "tighten" : "steady",
    minutesPerDay: Math.min(150, Math.max(15, Math.round((settings.minutesPerDay ?? fallback.minutesPerDay) / 5) * 5)),
    focus: focus.length > 0 ? focus : fallback.focus,
    intensity,
  };
};

const normalizeSnapshot = (snapshot: PlannerTask[]) =>
  snapshot.filter((task) => isKnownFocus(task.focus));

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const isVocabQuestion = (question: BankQuestion) =>
  isVocabSkill(question.category.skill);

const selectPracticeQuestions = (questions: BankQuestion[], count: number, seed: string) =>
  questions
    .filter((question) => !isVocabQuestion(question))
    .map((question, index) => ({
      question,
      rank: hashString(`${seed}:${question.stableId}:${index}`),
    }))
    .sort((left, right) => {
      if (left.rank !== right.rank) return left.rank - right.rank;
      return left.question.stableId.localeCompare(right.question.stableId);
    })
    .slice(0, count)
    .map(({ question }) => question);

const buildPracticeSetItems = (questions: BankQuestion[]) =>
  questions.map((question, index) => ({
    subject: question.subject,
    id: question.id,
    sourceId: question.sourceId,
    bankType: question.bankType,
    storageId: question.stableId,
    index: index + 1,
  }));

const taskActionLabel = (task: PlannerTask) => {
  if (!task.action) return "Start assignment";
  if (task.action.kind === "module") return task.type === "timed" ? "Start timed module" : "Start module";
  if (task.action.kind === "module-slice") return "Start half module";
  return `Start ${task.action.questionCount}-question set`;
};

const mergeLockedPlan = (
  generated: PlannerTask[],
  snapshot: PlannerTask[],
  progress: StoredProgress,
  todayKey: string,
) => {
  if (snapshot.length === 0) return generated;
  const lockedDates = new Set(
    snapshot
      .filter((task) => task.date < todayKey || progress.completed[task.id])
      .map((task) => task.date),
  );
  const lockedTasks = snapshot.filter((task) => lockedDates.has(task.date));
  const futureTasks = generated.filter((task) => !lockedDates.has(task.date));
  return [...lockedTasks, ...futureTasks].sort((a, b) => `${a.date}-${a.id}`.localeCompare(`${b.date}-${b.id}`));
};

const sanitizeParsedReport = (parsed: ParsedScoreReport): ParsedScoreReport => ({
  ...parsed,
  fileName: "Score report",
  testDate: undefined,
  extractedText: "",
  domains: parsed.domains.map((domain) => ({
    id: domain.id,
    label: domain.label,
    section: domain.section,
    proficiency: domain.proficiency,
    percent: domain.percent,
    questionRange: domain.questionRange,
    rawContext: "",
  })),
});

const clampToStep = (value: number, min: number, max: number, step: number) =>
  Math.min(max, Math.max(min, Math.trunc(value / step) * step));

const normalizeScoreDraft = (draft: string, min: number, max: number, step: number, fallback: number) => {
  const digits = draft.replace(/\D/g, "");
  if (!digits) return fallback;
  const whole = Number(digits);
  if (!Number.isFinite(whole)) return fallback;
  if (whole >= min && whole <= max) return clampToStep(whole, min, max, step);

  const candidates: number[] = [];
  const addCandidate = (value: string) => {
    if (!value) return;
    const parsed = Number(value);
    if (parsed >= min && parsed <= max) candidates.push(parsed);
  };
  const maxDigits = String(max).length;
  if (digits.length > maxDigits) {
    addCandidate(digits.slice(0, maxDigits));
    addCandidate(digits.slice(-maxDigits));
  }
  if (digits.length > 3) {
    addCandidate(digits.slice(0, 3));
    addCandidate(digits.slice(-3));
  }
  if (candidates.length > 0) return clampToStep(candidates[0], min, max, step);
  return clampToStep(whole, min, max, step);
};

const hasReportDomainEvidence = (domain: ParsedScoreReport["domains"][number]) =>
  typeof domain.proficiency === "number" || typeof domain.performanceMidpoint === "number";

const reportDomainEvidenceCount = (parsed: ParsedScoreReport) =>
  parsed.domains.filter(hasReportDomainEvidence).length;

const hasConsistentReportScores = (parsed: ParsedScoreReport) =>
  typeof parsed.totalScore === "number" &&
  typeof parsed.readingWritingScore === "number" &&
  typeof parsed.mathScore === "number" &&
  parsed.totalScore === parsed.readingWritingScore + parsed.mathScore;

const intensityFromParsedReport = (
  parsed: ParsedScoreReport,
  current: Record<FocusId, Intensity>,
) => {
  const next = { ...current };
  parsed.domains.forEach((domain) => {
    if (!domain.proficiency) return;
    next[domain.id] = domain.proficiency <= 3 ? "heavy" : domain.proficiency <= 5 ? "normal" : "light";
  });
  return next;
};

const SectionPill = ({ section }: { section: FocusArea["section"] }) => {
  const className =
    section === "Math"
      ? "bg-cobalt/15 text-cobalt-ink dark:text-cobalt"
      : section === "Reading and Writing"
        ? "bg-ds-good/15 text-green-700 dark:text-green-300"
        : "bg-amber-300/20 text-amber-700 dark:text-amber-200";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>{section}</span>;
};

const ScoreInput = ({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) => {
  const [draft, setDraft] = useState(String(value));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) setDraft(String(value));
  }, [isEditing, value]);

  const applyValue = (next: number) => {
    if (!Number.isFinite(next)) return;
    const clamped = clampToStep(next, min, max, 10);
    setDraft(String(clamped));
    onChange(clamped);
  };

  const commitDraft = () => {
    setIsEditing(false);
    applyValue(normalizeScoreDraft(draft, min, max, 10, value));
  };

  return (
    <div className="block text-sm font-semibold">
      <div>{label}</div>
      <div className="mt-1 grid h-12 grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] gap-1">
        <button
          type="button"
          onClick={() => applyValue(value - 10)}
          className="flex items-center justify-center rounded-lg border border-border bg-background text-ink-mid hover:bg-muted"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={label}
          value={draft}
          onFocus={() => setIsEditing(true)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="min-w-0 rounded-lg border border-border bg-background px-2 text-center text-lg font-semibold outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/20"
        />
        <button
          type="button"
          onClick={() => applyValue(value + 10)}
          className="flex items-center justify-center rounded-lg border border-border bg-background text-ink-mid hover:bg-muted"
          aria-label={`Increase ${label}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const weekStartFor = (dateKey: string) => {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() - date.getDay());
  return toDateKey(date);
};

const buildPrintableWeeks = (tasks: PlannerTask[]) => {
  const grouped = new Map<string, PlannerTask[]>();
  tasks.forEach((task) => {
    const weekStart = weekStartFor(task.date);
    grouped.set(weekStart, [...(grouped.get(weekStart) ?? []), task]);
  });

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, weekTasks]) => {
      const sortedTasks = [...weekTasks].sort((a, b) => `${a.date}-${a.id}`.localeCompare(`${b.date}-${b.id}`));
      return {
        weekStart,
        weekEnd: addDays(weekStart, 6),
        tasks: sortedTasks,
        totalMinutes: sortedTasks.reduce((sum, task) => sum + task.minutes, 0),
      };
    });
};

const StudyPlanLab = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<PlannerSettings>(() => normalizeSettings(loadJson(STORAGE_KEY, defaultSettings())));
  const [progress, setProgress] = useState<StoredProgress>(() =>
    loadJson(PROGRESS_KEY, { completed: {}, confidence: {} }),
  );
  const [report, setReport] = useState<UploadedScoreReport | null>(() =>
    loadJson<UploadedScoreReport | null>(SCORE_REPORT_KEY, null),
  );
  const [planSnapshot, setPlanSnapshot] = useState<PlannerTask[]>(() =>
    normalizeSnapshot(loadJson<PlannerTask[]>(PLAN_SNAPSHOT_KEY, [])),
  );
  const [selectedDate, setSelectedDate] = useState(
    () => buildDateRange(settings.startDate, settings.satDate).find((dateKey) => isStudyDay(dateKey, settings)) ?? settings.startDate,
  );
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [launchingTaskId, setLaunchingTaskId] = useState<string | null>(null);
  const [isParsingReport, setIsParsingReport] = useState(false);
  const todayKey = currentDateKey();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    if (report) localStorage.setItem(SCORE_REPORT_KEY, JSON.stringify(report));
    else localStorage.removeItem(SCORE_REPORT_KEY);
  }, [report]);

  useEffect(() => {
    localStorage.setItem(PLAN_SNAPSHOT_KEY, JSON.stringify(planSnapshot));
  }, [planSnapshot]);

  useEffect(() => {
    const shell = document.querySelector("[data-study-plan-lab]")?.parentElement;
    shell?.classList.add("study-plan-shell-reset");
    return () => shell?.classList.remove("study-plan-shell-reset");
  }, []);

  const generatedTasks = useMemo(() => generatePlan(settings), [settings]);
  const tasks = useMemo(
    () => mergeLockedPlan(generatedTasks, planSnapshot, progress, todayKey),
    [generatedTasks, planSnapshot, progress, todayKey],
  );
  const tasksByDate = useMemo(() => {
    const grouped = new Map<string, PlannerTask[]>();
    tasks.forEach((task) => {
      grouped.set(task.date, [...(grouped.get(task.date) ?? []), task]);
    });
    return grouped;
  }, [tasks]);

  const selectedTasks = tasksByDate.get(selectedDate) ?? [];
  const totalMinutes = tasks.reduce((sum, task) => sum + task.minutes, 0);
  const studyDays = buildDateRange(settings.startDate, settings.satDate).filter((dateKey) => isStudyDay(dateKey, settings));
  const averageMinutes = studyDays.length ? Math.round(totalMinutes / studyDays.length) : 0;
  const daysUntilTest = Math.max(0, daysBetween(todayKey, settings.satDate));
  const scoreGap = Math.max(0, settings.targetScore - settings.currentMath - settings.currentReadingWriting);
  const workload = averageMinutes >= 90 || scoreGap > studyDays.length * 8
    ? "Heavy"
    : averageMinutes >= 45 || scoreGap > studyDays.length * 4
      ? "Balanced"
      : "Light";
  const nextTask = tasks.find((task) => task.date >= todayKey && !progress.completed[task.id]) ?? tasks[0];
  const printableWeeks = useMemo(() => buildPrintableWeeks(tasks), [tasks]);
  const currentWeekStart = useMemo(() => weekStartFor(todayKey), [todayKey]);
  const currentWeekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(currentWeekStart, index)),
    [currentWeekStart],
  );
  const currentWeekMinutes = currentWeekDates.reduce(
    (sum, date) => sum + (tasksByDate.get(date) ?? []).reduce((daySum, task) => daySum + task.minutes, 0),
    0,
  );
  const selectedFocusLabels = settings.focus
    .map((focus) => focusById.get(focus)?.label ?? focus)
    .slice(0, 8)
    .join(", ");
  const parsedWeakDomains = report?.parsed?.domains
    .filter((domain) => (domain.proficiency ?? 8) <= 4)
    .slice(0, 5)
    .map((domain) => domain.label)
    .join(", ");

  const calendarStart = useMemo(() => {
    const first = new Date(`${settings.startDate}T12:00:00`);
    first.setDate(first.getDate() - first.getDay());
    return toDateKey(first);
  }, [settings.startDate]);

  const calendarDays = useMemo(() => Array.from({ length: 42 }, (_, index) => addDays(calendarStart, index)), [calendarStart]);

  const updateSetting = <K extends keyof PlannerSettings>(key: K, value: PlannerSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const toggleWeekday = (day: number) => {
    setSettings((current) => {
      const hasDay = current.freeWeekdays.includes(day);
      const next = hasDay
        ? current.freeWeekdays.filter((item) => item !== day)
        : [...current.freeWeekdays, day].sort((a, b) => a - b);
      return { ...current, freeWeekdays: next.length ? next : current.freeWeekdays };
    });
  };

  const toggleFocus = (focus: FocusId) => {
    setSettings((current) => {
      const next = current.focus.includes(focus)
        ? current.focus.filter((item) => item !== focus)
        : [...current.focus, focus];
      return { ...current, focus: next.length ? next : current.focus };
    });
  };

  const toggleCompleted = (task: PlannerTask) => {
    setProgress((current) => ({
      ...current,
      completed: { ...current.completed, [task.id]: !current.completed[task.id] },
    }));
  };

  const setConfidence = (taskId: string, confidence: "hard" | "okay" | "easy") => {
    setProgress((current) => ({
      ...current,
      confidence: { ...current.confidence, [taskId]: confidence },
    }));
  };

  const launchBankSet = async (task: PlannerTask, action: Extract<PlannerTaskAction, { kind: "bank-set" }>) => {
    const questions = action.filterType === "domain"
      ? await loadQuestionsByDomain(action.subject, action.filterValue as MathDomain | EnglishDomain, "all")
      : await loadQuestionsBySkill(action.subject, action.filterValue as MathSkill | EnglishSkill, "all");
    const selected = selectPracticeQuestions(questions, action.questionCount, task.id);
    const practiceSet = buildPracticeSetItems(selected);
    const first = practiceSet[0];
    if (!first) return;

    sessionStorage.setItem("practiceExitTo", "/study-plan-lab");
    sessionStorage.setItem("practiceSet", JSON.stringify(practiceSet));
    sessionStorage.setItem("practiceSetTotal", String(practiceSet.length));
    sessionStorage.setItem(PRACTICE_RUN_STORAGE_KEY, `study-plan-${task.id}-${Date.now()}`);
    navigate(buildPracticeBankQuestionRoute({
      subject: first.subject,
      sourceId: first.sourceId,
      bankType: first.bankType,
      idx: 1,
    }));
  };

  const launchModule = (task: PlannerTask, action: Extract<PlannerTaskAction, { kind: "module" }>) => {
    const module = getPracticeModule(action.moduleSlug);
    const practiceSet = action.moduleSlug ? buildModulePracticeSet(action.moduleSlug) : null;
    const first = practiceSet?.[0];
    if (!module || !practiceSet?.length || !first) return;

    clearModulePracticeSession(module.slug);
    const session = createModulePracticeSession(module, {
      timed: true,
      timeLimitSeconds: action.timeLimitMinutes * 60,
      allowCheckingAnswers: false,
    });
    sessionStorage.setItem("practiceExitTo", "/study-plan-lab");
    sessionStorage.setItem("practiceSet", JSON.stringify(practiceSet));
    sessionStorage.setItem("practiceSetTotal", String(practiceSet.length));
    navigate(buildModulePracticeQuestionRoute({
      subject: first.subject,
      sourceId: first.sourceId,
      bankType: first.bankType,
      idx: 1,
      moduleSlug: module.slug,
      moduleSessionId: session.sessionId,
    }));
  };

  const launchModuleSlice = (task: PlannerTask, action: Extract<PlannerTaskAction, { kind: "module-slice" }>) => {
    const module = getPracticeModule(action.moduleSlug);
    const fullSet = action.moduleSlug ? buildModulePracticeSet(action.moduleSlug) : null;
    const practiceSet = fullSet
      ?.slice(action.startQuestionIndex, action.startQuestionIndex + action.questionCount)
      .map((item, index) => ({ ...item, index: index + 1 }));
    const first = practiceSet?.[0];
    if (!module || !practiceSet?.length || !first) return;

    sessionStorage.setItem("practiceExitTo", "/study-plan-lab");
    sessionStorage.setItem("practiceSet", JSON.stringify(practiceSet));
    sessionStorage.setItem("practiceSetTotal", String(practiceSet.length));
    sessionStorage.setItem(PRACTICE_RUN_STORAGE_KEY, `study-plan-${task.id}-${Date.now()}`);
    navigate(buildPracticeBankQuestionRoute({
      subject: first.subject,
      sourceId: first.sourceId,
      bankType: first.bankType,
      idx: 1,
    }));
  };

  const openTask = async (task: PlannerTask) => {
    if (!task.action || launchingTaskId) return;
    setLaunchingTaskId(task.id);
    try {
      if (task.action.kind === "bank-set") {
        await launchBankSet(task, task.action);
      } else if (task.action.kind === "module-slice") {
        launchModuleSlice(task, task.action);
      } else {
        launchModule(task, task.action);
      }
    } finally {
      setLaunchingTaskId(null);
    }
  };

  const handleScoreReport = async (file: File | undefined) => {
    if (!file) return;
    setIsParsingReport(true);
    try {
      const parsed = await parseScoreReportFile(file);
      const safeParsed = sanitizeParsedReport(parsed);
      const canApplyScores = hasConsistentReportScores(parsed);
      const hasDomainEvidence = reportDomainEvidenceCount(parsed) >= 4;
      const parsedFocus = parsed.recommendedFocus.filter((focus): focus is ScoreReportFocusId =>
        focusById.has(focus),
      );
      const nextFocus = parsedFocus.length > 0 && hasDomainEvidence
        ? Array.from(new Set<FocusId>([...parsedFocus, "Pacing"])).slice(0, 7)
        : [];

      setSettings((current) => {
        const currentScore = canApplyScores ? parsed.totalScore! : current.currentMath + current.currentReadingWriting;
        const targetScore = Math.min(1600, Math.max(current.targetScore, currentScore + 120));
        return {
          ...current,
          currentReadingWriting: canApplyScores ? parsed.readingWritingScore! : current.currentReadingWriting,
          currentMath: canApplyScores ? parsed.mathScore! : current.currentMath,
          targetScore,
          focus: nextFocus.length > 0 ? nextFocus : current.focus,
          intensity: hasDomainEvidence ? intensityFromParsedReport(parsed, current.intensity) : current.intensity,
        };
      });

      setReport({
        name: "Score report",
        type: file.type || "Local file",
        size: 0,
        addedAt: new Date().toISOString(),
        parsed: safeParsed,
        error: parsed.warnings.length > 0 ? parsed.warnings.join(" ") : undefined,
      });
    } catch (error) {
      setReport({
        name: "Score report",
        type: file.type || "Local file",
        size: 0,
        addedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "The score report could not be parsed.",
      });
    } finally {
      setIsParsingReport(false);
    }
  };

  const savePlanSnapshot = () => {
    const rebuilt = generatePlan(settings);
    const completedDates = new Set(tasks.filter((task) => progress.completed[task.id]).map((task) => task.date));
    const lockedTasks = tasks.filter((task) => task.date < todayKey || completedDates.has(task.date));
    const futureTasks = rebuilt.filter((task) => task.date >= todayKey && !completedDates.has(task.date));
    const nextPlan = [...lockedTasks, ...futureTasks].sort((a, b) => `${a.date}-${a.id}`.localeCompare(`${b.date}-${b.id}`));
    setPlanSnapshot(nextPlan);
    setSettings((current) => ({ ...current, setupComplete: true }));
    setSelectedDate(nextPlan.find((task) => task.date >= todayKey && !progress.completed[task.id])?.date ?? nextPlan[0]?.date ?? settings.startDate);
    setViewMode("dashboard");
  };

  const currentTotal = settings.currentMath + settings.currentReadingWriting;
  const firstPreviewTask = generatedTasks.find((task) => task.date >= todayKey) ?? generatedTasks[0];
  const hasActivePlan = settings.setupComplete && planSnapshot.length > 0;
  const setupMode = !hasActivePlan || viewMode === "settings";
  const selectedDayPanel = (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{formatDate(selectedDate, "long")}</h2>
          <p className="text-sm text-ink-mid">{selectedTasks.length ? `${selectedTasks.length} planned task${selectedTasks.length === 1 ? "" : "s"}` : "No tasks planned"}</p>
        </div>
        <ClipboardList className="h-5 w-5 text-cobalt-ink dark:text-cobalt" />
      </div>
      <div className="space-y-3">
        {selectedTasks.map((task) => {
          const area = focusById.get(task.focus);
          const done = Boolean(progress.completed[task.id]);
          return (
            <article key={task.id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-start gap-3">
                <Checkbox checked={done} onCheckedChange={() => toggleCompleted(task)} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${taskTypeClass[task.type]}`}>
                      {taskTypeLabel[task.type]}
                    </span>
                    <span className="text-xs font-semibold text-ink-mid">{task.minutes} min</span>
                  </div>
                  <h3 className={`mt-2 font-semibold ${done ? "line-through opacity-60" : ""}`}>{task.title}</h3>
                  <p className="mt-1 text-sm text-ink-mid">{task.detail}</p>
                  {area && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <SectionPill section={area.section} />
                      <span className="text-xs text-ink-mid">{area.skills[0]}</span>
                    </div>
                  )}
                  {(done || progress.confidence[task.id]) && (
                    <div className="mt-3 grid grid-cols-3 gap-1 print:hidden">
                      {(["hard", "okay", "easy"] as const).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setConfidence(task.id, level)}
                          className={`h-8 rounded-md text-xs font-semibold capitalize ${
                            progress.confidence[task.id] === level
                              ? "bg-ink-fixed text-white dark:bg-white dark:text-ink-fixed"
                              : "bg-card text-ink-mid"
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  )}
                  {task.action && (
                    <button
                      type="button"
                      onClick={() => openTask(task)}
                      disabled={launchingTaskId === task.id}
                      className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-cobalt-ink hover:underline disabled:cursor-wait disabled:opacity-60 dark:text-cobalt print:hidden"
                    >
                      {launchingTaskId === task.id ? "Starting..." : taskActionLabel(task)}
                      <MoveRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
        {selectedTasks.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-ink-mid">
            Pick a free weekday or remove a blackout date to schedule work here.
          </div>
        )}
      </div>
    </section>
  );
  const nextUpPanel = nextTask ? (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase text-ink-muted">Next up</div>
      <div className="mt-2 font-semibold">{nextTask.title}</div>
      <div className="mt-1 text-sm text-ink-mid">{formatDate(nextTask.date)} · {nextTask.minutes} min</div>
    </section>
  ) : null;

  if (setupMode) {
    return (
      <main data-study-plan-lab className="mx-auto w-full max-w-6xl px-4 py-6 text-ink sm:px-6 lg:px-8">
        <style>{studyPlanPrintCss}</style>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Build your SAT plan</h1>
            <p className="mt-1 text-sm text-ink-mid">Upload a score report or enter scores, then choose time and weak areas.</p>
          </div>
          {hasActivePlan && (
            <button
              type="button"
              onClick={() => setViewMode("dashboard")}
              className="h-10 rounded-lg border border-border bg-card px-4 text-sm font-semibold"
            >
              Back to dashboard
            </button>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <section className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">1. Scores</h2>
                  <p className="text-sm text-ink-mid">PDF score reports are parsed first; screenshots use OCR.</p>
                </div>
                <Upload className="h-5 w-5 text-green-700 dark:text-green-300" />
              </div>
              <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background px-5 text-center text-sm text-ink-mid">
                <FileText className="mb-2 h-7 w-7" />
                {isParsingReport ? "Reading score report..." : "Upload College Board score report"}
                <span className="mt-1 text-xs">PDF, PNG, or JPG</span>
                <span className="mt-2 text-xs text-ink-muted">Processed in this browser. Nothing is uploaded.</span>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(event) => handleScoreReport(event.target.files?.[0])}
                  className="sr-only"
                />
              </label>
              {report?.error && (
                <div className="mt-3 rounded-lg border border-amber-400/40 bg-amber-300/15 p-3 text-sm text-amber-800 dark:text-amber-100">
                  {report.error}
                </div>
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <ScoreInput
                  label="RW"
                  value={settings.currentReadingWriting}
                  min={200}
                  max={800}
                  onChange={(value) => updateSetting("currentReadingWriting", value)}
                />
                <ScoreInput
                  label="Math"
                  value={settings.currentMath}
                  min={200}
                  max={800}
                  onChange={(value) => updateSetting("currentMath", value)}
                />
                <div className="rounded-lg border border-border bg-background p-3">
                  <div className="text-sm font-semibold text-ink-mid">Current total</div>
                  <div className="mt-1 text-3xl font-semibold">{currentTotal}</div>
                </div>
              </div>
              <div className="mt-4">
                <ScoreInput
                  label="Goal score"
                  value={settings.targetScore}
                  min={400}
                  max={1600}
                  onChange={(value) => updateSetting("targetScore", value)}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Clock3 className="h-5 w-5 text-amber-600 dark:text-amber-200" />
                <h2 className="font-semibold">2. Time</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold">
                  When do you want to start?
                  <input
                    type="date"
                    value={settings.startDate}
                    onChange={(event) => updateSetting("startDate", event.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Which SAT are you taking?
                  <select
                    value={settings.satDate}
                    onChange={(event) => updateSetting("satDate", event.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3"
                  >
                    {officialSatDates.map((date) => (
                      <option key={date.date} value={date.date}>
                        {date.monthLabel}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs font-normal text-ink-muted">
                    {officialSatDates.find((date) => date.date === settings.satDate)?.label}
                  </span>
                </label>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>Minutes per study day</span>
                  <span>{settings.minutesPerDay}</span>
                </div>
                <Slider
                  value={[settings.minutesPerDay]}
                  min={15}
                  max={120}
                  step={15}
                  onValueChange={([value]) => updateSetting("minutesPerDay", value)}
                />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {([
                  {
                    value: "steady",
                    title: "Keep timing steady",
                    detail: "Timed work uses normal pacing.",
                  },
                  {
                    value: "tighten",
                    title: "Tighten module timing",
                    detail: "Math module timers get a little shorter over time.",
                  },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateSetting("pacingMode", option.value)}
                    className={`rounded-lg border p-3 text-left ${
                      settings.pacingMode === option.value ? "border-ds-accent-deep bg-ds-accent/20" : "border-border bg-background"
                    }`}
                  >
                    <div className="font-semibold">{option.title}</div>
                    <div className="mt-1 text-xs text-ink-mid">{option.detail}</div>
                  </button>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-7 gap-1">
                {weekdayLabels.map((label, index) => {
                  const active = settings.freeWeekdays.includes(index);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleWeekday(index)}
                      className={`h-10 min-w-0 rounded-lg border text-xs font-semibold ${
                        active ? "border-ds-accent-deep bg-ds-accent text-ink-fixed" : "border-border bg-background text-ink-muted"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="mb-4">
                <div>
                  <h2 className="font-semibold">3. Focus</h2>
                  <p className="text-sm text-ink-mid">Pick weak domains or let the score report choose them.</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {focusAreas.map((area) => {
                  const active = settings.focus.includes(area.id);
                  return (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => toggleFocus(area.id)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        active ? "border-ds-accent-deep bg-ds-accent/20" : "border-border bg-background"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{area.label}</span>
                        {active && <Check className="h-4 w-4" />}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <SectionPill section={area.section} />
                        <span className="truncate text-xs text-ink-mid">{area.skills[0]}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="text-sm font-semibold text-ink-muted">Preview</div>
              <div className="mt-3 text-3xl font-semibold">{Math.max(0, daysBetween(settings.startDate, settings.satDate))}</div>
              <div className="text-sm text-ink-mid">days until test</div>
              <div className="mt-5 grid gap-3">
                <div className="rounded-lg bg-background p-3">
                  <div className="text-xs font-semibold uppercase text-ink-muted">Your study days</div>
                  <div className="mt-1 font-semibold">{settings.freeWeekdays.length} days/week · {settings.minutesPerDay} min each</div>
                </div>
                <div className="rounded-lg bg-background p-3">
                  <div className="text-xs font-semibold uppercase text-ink-muted">Score gap</div>
                  <div className="mt-1 font-semibold">{Math.max(0, settings.targetScore - currentTotal)} points</div>
                </div>
                <div className="rounded-lg bg-background p-3">
                  <div className="text-xs font-semibold uppercase text-ink-muted">First study day</div>
                  <div className="mt-1 font-semibold">{firstPreviewTask?.title ?? "No study day selected"}</div>
                  {firstPreviewTask && <div className="text-sm text-ink-mid">{formatDate(firstPreviewTask.date)} · {firstPreviewTask.minutes} min</div>}
                </div>
              </div>
              <button
                type="button"
                onClick={savePlanSnapshot}
                disabled={isParsingReport || generatedTasks.length === 0}
                className="mt-5 h-12 w-full rounded-lg bg-ink-fixed px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-ink-fixed"
              >
                {hasActivePlan ? "Save schedule" : "Create plan"}
              </button>
            </section>
          </aside>
        </div>
      </main>
    );
  }

  return (
    <main data-study-plan-lab className="mx-auto w-full max-w-[78rem] px-4 py-5 text-ink sm:px-5 lg:px-7">
      <style>{studyPlanPrintCss}</style>
      <section className="hidden bg-white text-black print:block">
        <header className="mb-6 border-b border-black/20 pb-4">
          <div className="text-sm font-semibold uppercase tracking-wide">1600.now SAT Study Plan</div>
          <h1 className="mt-2 text-3xl font-semibold">Daily SAT Plan</h1>
          <div className="mt-4 grid grid-cols-4 gap-3 text-sm">
            <div>
              <div className="font-semibold">Test date</div>
              <div>{formatDate(settings.satDate, "long")}</div>
            </div>
            <div>
              <div className="font-semibold">Current score</div>
              <div>{currentTotal}</div>
            </div>
            <div>
              <div className="font-semibold">Target score</div>
              <div>{settings.targetScore}</div>
            </div>
            <div>
              <div className="font-semibold">Plan load</div>
              <div>{tasks.length} tasks · {totalMinutes} minutes</div>
            </div>
          </div>
          <div className="mt-3 text-sm">
            <span className="font-semibold">Focus: </span>
            {selectedFocusLabels || "Balanced SAT prep"}
          </div>
          {parsedWeakDomains && (
            <div className="mt-1 text-sm">
              <span className="font-semibold">Score report priorities: </span>
              {parsedWeakDomains}
            </div>
          )}
        </header>

        <div className="space-y-6">
          {printableWeeks.map((week) => (
            <section key={week.weekStart} className="break-inside-avoid rounded border border-black/20 p-4">
              <div className="mb-3 flex items-center justify-between border-b border-black/10 pb-2">
                <h2 className="text-xl font-semibold">
                  Week of {formatDate(week.weekStart)} - {formatDate(week.weekEnd)}
                </h2>
                <div className="text-sm font-semibold">{week.totalMinutes} minutes</div>
              </div>
              <div className="space-y-4">
                {week.tasks.map((task) => {
                  const area = focusById.get(task.focus);
                  return (
                    <article key={task.id} className="grid grid-cols-[1.2rem_7rem_1fr_5rem] gap-3 text-sm">
                      <div className="mt-0.5 h-4 w-4 border border-black" />
                      <div>
                        <div className="font-semibold">{formatDate(task.date)}</div>
                        <div>{weekdayLabels[new Date(`${task.date}T12:00:00`).getDay()]}</div>
                      </div>
                      <div>
                        <div className="font-semibold">{task.title}</div>
                        <div>{task.detail}</div>
                        <div className="mt-1 text-xs">
                          {taskTypeLabel[task.type]} · {area?.label ?? task.focus}
                          {area?.skills[0] ? ` · ${area.skills[0]}` : ""}
                        </div>
                      </div>
                      <div className="text-right font-semibold">{task.minutes} min</div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>

      <div className="grid gap-5 print:hidden xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0 space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Study dashboard</h1>
                <p className="mt-1 text-sm text-ink-mid">
                  {formatDate(settings.satDate)} SAT · {currentTotal} current · {settings.targetScore} target
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewMode("settings")}
                className="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold"
              >
                Edit schedule
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
              <div>
                <div className="text-xs font-semibold uppercase text-ink-muted">Test countdown</div>
                <div className="mt-1 text-2xl font-semibold sm:text-3xl">{daysUntilTest}</div>
                <div className="text-xs text-ink-mid">days until {formatDate(settings.satDate)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-ink-muted">Workload</div>
                <div className="mt-1 text-2xl font-semibold sm:text-3xl">{workload}</div>
                <div className="text-xs text-ink-mid">{averageMinutes} min per study day</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-ink-muted">Study days</div>
                <div className="mt-1 text-2xl font-semibold sm:text-3xl">{studyDays.length}</div>
                <div className="text-xs text-ink-mid">{tasks.length} tasks · {totalMinutes} minutes</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-ink-muted">Next up</div>
                <div className="mt-1 truncate text-2xl font-semibold sm:text-3xl">{nextTask?.minutes ?? 0} min</div>
                <div className="truncate text-xs text-ink-mid">{nextTask ? nextTask.title : "No task scheduled"}</div>
              </div>
            </div>
          </div>

          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Today and calendar</h2>
                <p className="text-sm text-ink-mid">Pick a day, review the tasks, and print the full plan.</p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
            </div>

            <div className="mb-4 xl:hidden">
              {selectedDayPanel}
            </div>

            <section className="mb-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">This week</h3>
                  <p className="text-sm text-ink-mid">{formatDate(currentWeekStart)} - {formatDate(addDays(currentWeekStart, 6))} · {currentWeekMinutes} minutes</p>
                </div>
                <div className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-ink-mid">
                  {currentWeekDates.reduce((sum, date) => sum + (tasksByDate.get(date)?.length ?? 0), 0)} tasks
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
                {currentWeekDates.map((date) => {
                  const dayTasks = tasksByDate.get(date) ?? [];
                  const isSelected = date === selectedDate;
                  return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    className={`min-h-20 min-w-0 overflow-hidden rounded-lg border p-2 text-left sm:min-h-24 sm:p-3 ${
                      isSelected ? "border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-ink-fixed" : "border-border bg-background"
                    }`}
                  >
                    <div className="text-xs font-semibold">{weekdayLabels[new Date(`${date}T12:00:00`).getDay()]}</div>
                    <div className="mt-1 text-lg font-semibold">{new Date(`${date}T12:00:00`).getDate()}</div>
                    {dayTasks.length > 0 ? (
                      <div className="mt-2 text-xs">
                        <div className="font-semibold">{dayTasks.length} task{dayTasks.length === 1 ? "" : "s"}</div>
                        <div className="opacity-80">{dayTasks.reduce((sum, task) => sum + task.minutes, 0)} min</div>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs opacity-70">Open</div>
                    )}
                  </button>
                  );
                })}
              </div>
            </section>

            <section className="border-t border-border pt-4">
              <div className="mb-3">
                <h3 className="font-semibold">Daily calendar</h3>
                <p className="text-sm text-ink-mid">Click a day to inspect tasks and mark progress.</p>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink-muted">
                {weekdayLabels.map((day) => (
                  <div key={day} className="min-w-0 truncate py-2">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((date) => {
                  const dayTasks = tasksByDate.get(date) ?? [];
                  const isSelected = date === selectedDate;
                  const isWithinPlan = date >= settings.startDate && date < settings.satDate;
                  const isFree = isStudyDay(date, settings);
                  const dayMinutes = dayTasks.reduce((sum, task) => sum + task.minutes, 0);
                  const complete = dayTasks.length > 0 && dayTasks.every((task) => progress.completed[task.id]);
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => {
                        setSelectedDate(date);
                      }}
                      className={`min-h-[4.9rem] min-w-0 overflow-hidden rounded-lg border p-1.5 text-left transition-colors sm:min-h-[5.75rem] sm:p-2 ${
                        isSelected
                          ? "border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-ink-fixed"
                          : isWithinPlan
                            ? isFree
                              ? "border-border bg-background hover:border-cobalt"
                              : "border-border bg-muted/60 text-ink-muted"
                            : "border-transparent bg-transparent text-ink-muted/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="shrink-0 text-xs font-semibold">{new Date(`${date}T12:00:00`).getDate()}</span>
                        {complete && <Check className="h-3.5 w-3.5 shrink-0" />}
                      </div>
                      {dayTasks.length > 0 ? (
                        <div className="mt-2 min-w-0 space-y-1">
                          <div className="truncate text-[10px] font-semibold sm:text-[11px]">{dayTasks.length} task{dayTasks.length === 1 ? "" : "s"}</div>
                          <div className="truncate text-[10px] opacity-80 sm:text-[11px]">{dayMinutes} min</div>
                          <div className="flex min-w-0 flex-wrap gap-1 overflow-hidden">
                            {dayTasks.slice(0, 2).map((task) => (
                              <span key={task.id} className={`h-1.5 w-3 rounded-full sm:w-5 ${task.type === "mock" ? "bg-amber-400" : "bg-ds-accent-deep"}`} />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 text-[11px] opacity-70">{isWithinPlan && !isFree ? "Off" : ""}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          </section>
        </section>

        <aside className="hidden space-y-4 xl:block">
          {selectedDayPanel}
          {nextUpPanel}
        </aside>
      </div>
    </main>
  );
};

export default StudyPlanLab;
