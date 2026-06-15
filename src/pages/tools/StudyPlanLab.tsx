import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Check,
  ClipboardList,
  Clock3,
  FileText,
  Flame,
  Minus,
  MoveRight,
  Plus,
  Printer,
  RefreshCw,
  Upload,
} from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  allEnglishDomains,
  allMathDomains,
  englishDomainSkills,
  mathDomainSkills,
  type EnglishDomain,
  type MathDomain,
} from "@/data/questionCategories";
import {
  parseScoreReportFile,
  type ParsedScoreReport,
  type ScoreReportFocusId,
} from "@/lib/studyPlan/scoreReportParser";

type FocusId =
  | MathDomain
  | EnglishDomain
  | "Pacing"
  | "Error Log"
  | "Full Practice";

type Intensity = "light" | "normal" | "heavy";
type TaskType = "diagnostic" | "learn" | "drill" | "review" | "timed" | "mock" | "taper";
type ViewMode = "today" | "calendar" | "progress" | "settings";

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
  { date: "2026-08-22", label: "Aug. 22, 2026", deadline: "Aug. 7, 2026" },
  { date: "2026-09-12", label: "Sept. 12, 2026", deadline: "Aug. 28, 2026" },
  { date: "2026-10-03", label: "Oct. 3, 2026", deadline: "Sept. 18, 2026" },
  { date: "2026-11-07", label: "Nov. 7, 2026", deadline: "Oct. 23, 2026" },
  { date: "2026-12-05", label: "Dec. 5, 2026", deadline: "Nov. 20, 2026" },
  { date: "2027-03-06", label: "March 6, 2027", deadline: "Feb. 19, 2027" },
  { date: "2027-05-01", label: "May 1, 2027", deadline: "Apr. 16, 2027" },
  { date: "2027-06-05", label: "June 5, 2027", deadline: "May 21, 2027" },
];

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

const englishFocus: FocusArea[] = allEnglishDomains.map((domain) => ({
  id: domain,
  label: domain,
  section: "Reading and Writing",
  skills: englishDomainSkills[domain].slice(0, 3),
}));

const strategyFocus: FocusArea[] = [
  {
    id: "Pacing",
    label: "Pacing",
    section: "Strategy",
    skills: ["Module timing", "Question triage", "End-check routine"],
  },
  {
    id: "Error Log",
    label: "Error Log",
    section: "Strategy",
    skills: ["Miss review", "Pattern tracking", "Retest queue"],
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

const scoreReportGuideSteps = [
  {
    title: "Open Student Score Reports",
    detail: "Go to the College Board score portal and sign in with the account that took the SAT.",
    image: "/study-plan/college-board-score-portal.png",
  },
  {
    title: "Open Score Details",
    detail: "Choose the SAT score, then open the score details page before downloading the PDF.",
    image: "/study-plan/college-board-score-details.png",
  },
  {
    title: "Save the Report",
    detail: "Download the score report PDF or take a clear screenshot of the Knowledge and Skills bars.",
    image: "/study-plan/college-board-score-download.png",
  },
];

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

const routeForFocus = (focus: FocusId) => {
  const area = focusById.get(focus);
  if (!area) return "/bank";
  if (area.section === "Math") return `/bank/math/domain/${encodeURIComponent(area.label)}?bankType=all`;
  if (area.section === "Reading and Writing") return `/bank/reading/domain/${encodeURIComponent(area.label)}?bankType=all`;
  if (focus === "Full Practice") return "/modules";
  if (focus === "Error Log") return "/my-practice-sets";
  return "/bank";
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

const taskTitleFor = (type: TaskType, focus: FocusId) => {
  const area = focusById.get(focus);
  const label = area?.label ?? focus;
  if (type === "diagnostic") return "Baseline score report review";
  if (type === "learn") return `${label} concept pass`;
  if (type === "drill") return `${label} targeted drill`;
  if (type === "review") return `${label} error-log review`;
  if (type === "timed") return `${label} timed set`;
  if (type === "mock") return "Full-length practice test";
  return "Light test-week review";
};

const taskDetailFor = (type: TaskType, focus: FocusId) => {
  const area = focusById.get(focus);
  const skills = area?.skills.slice(0, 2).join(" and ");
  if (type === "diagnostic") return "Confirm section scores, mark weak domains, and create a miss log before drilling.";
  if (type === "learn") return `Review the core rule set, then solve untimed examples${skills ? ` for ${skills}` : ""}.`;
  if (type === "drill") return "Complete a focused set, review every miss, and tag the reason for each error.";
  if (type === "review") return "Redo missed problems without notes, then write the shortest rule that would prevent the miss.";
  if (type === "timed") return "Use strict module pacing and stop when time expires.";
  if (type === "mock") return "Take the test in one sitting, then review the score report before the next study block.";
  return "Keep it light: formulas, grammar rules, pacing checkpoints, and sleep schedule.";
};

const generatePlan = (settings: PlannerSettings): PlannerTask[] => {
  const range = buildDateRange(settings.startDate, settings.satDate);
  const studyDays = range.filter((dateKey) => isStudyDay(dateKey, settings));
  const queue = weightedFocusQueue(settings);
  const tasks: PlannerTask[] = [];
  const totalStudyDays = studyDays.length || 1;
  const scoreGap = Math.max(0, settings.targetScore - settings.currentMath - settings.currentReadingWriting);
  const loadMultiplier = scoreGap >= 260 ? 1.45 : scoreGap >= 180 ? 1.25 : scoreGap >= 100 ? 1.12 : 1;
  const adjustedBaseMinutes = Math.min(150, Math.max(15, Math.round((settings.minutesPerDay * loadMultiplier) / 5) * 5));

  studyDays.forEach((dateKey, index) => {
    const daysUntilTest = daysBetween(dateKey, settings.satDate);
    const weekIndex = Math.floor(index / Math.max(1, settings.freeWeekdays.length));
    const focus = queue[index % queue.length];
    const isFirstDay = index === 0;
    const isMockDay = index > 0 && (index + 1) % Math.max(4, settings.freeWeekdays.length * 2) === 0 && daysUntilTest > 7;
    const isTaper = daysUntilTest <= 6;
    const type: TaskType = isFirstDay
      ? "diagnostic"
      : isTaper
        ? "taper"
        : isMockDay
          ? "mock"
          : weekIndex % 3 === 0
            ? "learn"
            : weekIndex % 3 === 1
              ? "drill"
              : "timed";
    const minutes = type === "mock"
      ? Math.max(120, adjustedBaseMinutes * 3)
      : type === "diagnostic"
        ? Math.max(45, adjustedBaseMinutes)
        : type === "taper"
          ? Math.min(35, adjustedBaseMinutes)
          : adjustedBaseMinutes;

    tasks.push({
      id: `${dateKey}-${type}-${focus}`,
      date: dateKey,
      title: taskTitleFor(type, focus),
      minutes,
      focus,
      type,
      detail: taskDetailFor(type, focus),
      route: routeForFocus(focus),
    });

    if (!isTaper && type !== "mock" && adjustedBaseMinutes >= 45 && (index % 2 === 1 || scoreGap >= 180)) {
      const reviewFocus = queue[(index + 2) % queue.length];
      tasks.push({
        id: `${dateKey}-review-${reviewFocus}`,
        date: dateKey,
        title: taskTitleFor("review", reviewFocus),
        minutes: Math.min(30, Math.round(adjustedBaseMinutes / 2)),
        focus: reviewFocus,
        type: "review",
        detail: taskDetailFor("review", reviewFocus),
        route: routeForFocus(reviewFocus),
      });
    }
  });

  const targetMocks = totalStudyDays >= 20 ? 3 : totalStudyDays >= 10 ? 2 : 1;
  const existingMocks = tasks.filter((task) => task.type === "mock").length;
  if (studyDays.length > 4 && existingMocks < targetMocks) {
    studyDays
      .slice(Math.max(1, studyDays.length - targetMocks * 5), -2)
      .filter((_, index) => index % 4 === 0)
      .slice(0, targetMocks - existingMocks)
      .forEach((dateKey, index) => {
        tasks.push({
          id: `${dateKey}-extra-mock-${index}`,
          date: dateKey,
          title: "Full-length Bluebook practice test",
          minutes: Math.max(120, settings.minutesPerDay * 3),
          focus: "Full Practice",
          type: "mock",
          detail: "Run a realistic practice test and use the score report to refresh the next week's priorities.",
          route: "/modules",
        });
      });
  }

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
  Math.min(max, Math.max(min, Math.round(value / step) * step));

const hasReportDomainEvidence = (domain: ParsedScoreReport["domains"][number]) =>
  typeof domain.proficiency === "number" || typeof domain.performanceMidpoint === "number";

const reportDomainEvidenceCount = (parsed: ParsedScoreReport) =>
  parsed.domains.filter(hasReportDomainEvidence).length;

const hasConsistentReportScores = (parsed: ParsedScoreReport) =>
  typeof parsed.totalScore === "number" &&
  typeof parsed.readingWritingScore === "number" &&
  typeof parsed.mathScore === "number" &&
  parsed.totalScore === parsed.readingWritingScore + parsed.mathScore;

const isStrongReportParse = (parsed: ParsedScoreReport) =>
  hasConsistentReportScores(parsed) && reportDomainEvidenceCount(parsed) >= 4 && parsed.warnings.length === 0;

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
  const applyValue = (next: number) => {
    if (!Number.isFinite(next)) return;
    onChange(clampToStep(next, min, max, 10));
  };

  return (
    <label className="block text-sm font-semibold">
      {label}
      <div className="mt-1 grid h-12 grid-cols-[2.5rem_1fr_2.5rem] overflow-hidden rounded-lg border border-border bg-background">
        <button
          type="button"
          onClick={() => applyValue(value - 10)}
          className="flex items-center justify-center border-r border-border text-ink-mid hover:bg-muted"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="number"
          min={min}
          max={max}
          step={10}
          value={value}
          onChange={(event) => {
            if (event.target.value === "") return;
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
          }}
          onBlur={() => applyValue(value)}
          className="min-w-0 border-0 bg-transparent px-2 text-center text-lg font-semibold outline-none"
        />
        <button
          type="button"
          onClick={() => applyValue(value + 10)}
          className="flex items-center justify-center border-l border-border text-ink-mid hover:bg-muted"
          aria-label={`Increase ${label}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </label>
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
  const [settings, setSettings] = useState<PlannerSettings>(() => loadJson(STORAGE_KEY, defaultSettings()));
  const [progress, setProgress] = useState<StoredProgress>(() =>
    loadJson(PROGRESS_KEY, { completed: {}, confidence: {} }),
  );
  const [report, setReport] = useState<UploadedScoreReport | null>(() =>
    loadJson<UploadedScoreReport | null>(SCORE_REPORT_KEY, null),
  );
  const [planSnapshot, setPlanSnapshot] = useState<PlannerTask[]>(() =>
    loadJson<PlannerTask[]>(PLAN_SNAPSHOT_KEY, []),
  );
  const [selectedDate, setSelectedDate] = useState(
    () => buildDateRange(settings.startDate, settings.satDate).find((dateKey) => isStudyDay(dateKey, settings)) ?? settings.startDate,
  );
  const [viewMode, setViewMode] = useState<ViewMode>("today");
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
  const completedCount = tasks.filter((task) => progress.completed[task.id]).length;
  const totalMinutes = tasks.reduce((sum, task) => sum + task.minutes, 0);
  const completedMinutes = tasks.reduce((sum, task) => sum + (progress.completed[task.id] ? task.minutes : 0), 0);
  const studyDays = buildDateRange(settings.startDate, settings.satDate).filter((dateKey) => isStudyDay(dateKey, settings));
  const averageMinutes = studyDays.length ? Math.round(totalMinutes / studyDays.length) : 0;
  const daysUntilTest = Math.max(0, daysBetween(todayKey, settings.satDate));
  const scoreGap = Math.max(0, settings.targetScore - settings.currentMath - settings.currentReadingWriting);
  const workload = averageMinutes >= 90 || scoreGap > studyDays.length * 8
    ? "Heavy"
    : averageMinutes >= 45 || scoreGap > studyDays.length * 4
      ? "Balanced"
      : "Light";
  const hardTasks = tasks.filter((task) => progress.confidence[task.id] === "hard");
  const missedTasks = tasks.filter((task) => task.date < todayKey && !progress.completed[task.id]).length;
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
        ? Array.from(new Set<FocusId>([...parsedFocus, "Pacing", "Error Log"])).slice(0, 7)
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
    setViewMode("today");
  };

  const applyTemplate = (template: "balanced" | "math" | "rw" | "weekend" | "crash") => {
    setSettings((current) => {
      if (template === "math") {
        return {
          ...current,
          minutesPerDay: 60,
          freeWeekdays: [1, 2, 3, 4, 6],
          focus: ["Algebra", "Advanced Math", "Problem-Solving and Data Analysis", "Geometry and Trigonometry", "Pacing"],
          intensity: { ...current.intensity, Algebra: "heavy", "Advanced Math": "heavy", "Geometry and Trigonometry": "normal" },
        };
      }
      if (template === "rw") {
        return {
          ...current,
          minutesPerDay: 60,
          freeWeekdays: [1, 2, 3, 4, 6],
          focus: ["Information and Ideas", "Craft and Structure", "Expression of Ideas", "Standard English Conventions", "Error Log"],
          intensity: { ...current.intensity, "Information and Ideas": "heavy", "Standard English Conventions": "heavy" },
        };
      }
      if (template === "weekend") {
        return {
          ...current,
          minutesPerDay: 90,
          freeWeekdays: [0, 6],
          focus: ["Full Practice", "Error Log", "Pacing", "Algebra", "Standard English Conventions"],
        };
      }
      if (template === "crash") {
        return {
          ...current,
          minutesPerDay: 75,
          freeWeekdays: [0, 1, 2, 3, 4, 5, 6],
          focus: ["Pacing", "Error Log", "Full Practice", "Advanced Math", "Standard English Conventions"],
          intensity: { ...current.intensity, Pacing: "heavy", "Error Log": "heavy", "Full Practice": "heavy" },
        };
      }
      return {
        ...current,
        minutesPerDay: 45,
        freeWeekdays: [1, 2, 3, 4, 6],
        focus: defaultSettings().focus,
        intensity: { ...current.intensity, ...defaultIntensity },
      };
    });
  };

  const resetProgress = () => {
    setProgress({ completed: {}, confidence: {} });
  };

  const currentTotal = settings.currentMath + settings.currentReadingWriting;
  const firstPreviewTask = generatedTasks.find((task) => task.date >= todayKey) ?? generatedTasks[0];
  const setupMode = !settings.setupComplete || viewMode === "settings";
  const reportIsStrong = report?.parsed ? isStrongReportParse(report.parsed) : false;
  const showTaskRail = viewMode === "today" || viewMode === "calendar";
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
                  {task.route && (
                    <a
                      href={task.route}
                      className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-cobalt-ink hover:underline dark:text-cobalt print:hidden"
                    >
                      Open practice
                      <MoveRight className="h-4 w-4" />
                    </a>
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
          {settings.setupComplete && (
            <button
              type="button"
              onClick={() => setViewMode("today")}
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
              {report && (
                <div className={`mt-3 rounded-lg border p-3 text-sm ${report.parsed && reportIsStrong ? "border-green-500/30 bg-green-500/10" : "border-amber-400/40 bg-amber-300/15"}`}>
                  <div className="font-semibold">{report.name}</div>
                  {report.parsed ? (
                    <>
                      <div className="mt-1 text-ink-mid">
                        {reportIsStrong ? "Read" : "Partially read"} {report.parsed.totalScore ?? "total unknown"} total, RW {report.parsed.readingWritingScore ?? "-"}, Math {report.parsed.mathScore ?? "-"}.
                      </div>
                      {report.error && <div className="mt-2 text-amber-800 dark:text-amber-100">{report.error}</div>}
                      {report.parsed.recommendedFocus.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {report.parsed.recommendedFocus.slice(0, 5).map((focus) => (
                            <span key={focus} className="rounded-full bg-white/80 px-2 py-1 text-xs font-semibold text-green-800 dark:bg-ink/30 dark:text-green-200">
                              {focus}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mt-1 text-ink-mid">{report.error ?? "Upload received."}</div>
                  )}
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
                  Study starts
                  <input
                    type="date"
                    value={settings.startDate}
                    onChange={(event) => updateSetting("startDate", event.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Test date
                  <input
                    type="date"
                    value={settings.satDate}
                    onChange={(event) => updateSetting("satDate", event.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3"
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {officialSatDates.slice(0, 5).map((date) => (
                  <button
                    key={date.date}
                    type="button"
                    onClick={() => updateSetting("satDate", date.date)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                      settings.satDate === date.date ? "border-ds-accent-deep bg-ds-accent text-ink-fixed" : "border-border bg-background"
                    }`}
                  >
                    {date.label}
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>Base minutes per study day</span>
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
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">3. Focus</h2>
                  <p className="text-sm text-ink-mid">Pick weak domains or let the score report choose them.</p>
                </div>
                <button
                  type="button"
                  onClick={() => applyTemplate("balanced")}
                  className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-semibold"
                >
                  Balanced
                </button>
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
              <div className="mt-3 text-3xl font-semibold">{daysBetween(settings.startDate, settings.satDate)}</div>
              <div className="text-sm text-ink-mid">calendar days until test</div>
              <div className="mt-5 grid gap-3">
                <div className="rounded-lg bg-background p-3">
                  <div className="text-xs font-semibold uppercase text-ink-muted">Study rhythm</div>
                  <div className="mt-1 font-semibold">{settings.freeWeekdays.length} days/week · {settings.minutesPerDay} min base</div>
                </div>
                <div className="rounded-lg bg-background p-3">
                  <div className="text-xs font-semibold uppercase text-ink-muted">Score gap</div>
                  <div className="mt-1 font-semibold">{Math.max(0, settings.targetScore - currentTotal)} points</div>
                </div>
                <div className="rounded-lg bg-background p-3">
                  <div className="text-xs font-semibold uppercase text-ink-muted">First task</div>
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
                {settings.setupComplete ? "Save schedule" : "Create plan"}
              </button>
            </section>

            <details className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <summary className="cursor-pointer text-sm font-semibold">Need help finding your report?</summary>
              <div className="mt-3 space-y-3">
                {scoreReportGuideSteps.map((step, index) => (
                  <article key={step.title} className="overflow-hidden rounded-lg border border-border bg-background">
                    <img src={step.image} alt={step.title} className="h-28 w-full object-cover object-top" loading="lazy" />
                    <div className="p-3 text-sm">
                      <div className="font-semibold text-ink">{index + 1}. {step.title}</div>
                      <div className="mt-1 text-ink-mid">{step.detail}</div>
                    </div>
                  </article>
                ))}
              </div>
              <a
                href="https://satsuite.collegeboard.org/scores/score-release-dates/getting-sat-weekend-scores"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex text-sm font-semibold text-cobalt-ink hover:underline dark:text-cobalt"
              >
                Official College Board instructions
              </a>
            </details>
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

      <div className={`grid gap-5 print:hidden ${showTaskRail ? "xl:grid-cols-[minmax(0,1fr)_22rem]" : ""}`}>
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
                <div className="text-xs font-semibold uppercase text-ink-muted">Progress</div>
                <div className="mt-1 text-2xl font-semibold sm:text-3xl">{completedCount}/{tasks.length}</div>
                <div className="text-xs text-ink-mid">{completedMinutes} of {totalMinutes} minutes done</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-ink-muted">Adaptive flags</div>
                <div className="mt-1 text-2xl font-semibold sm:text-3xl">{hardTasks.length + missedTasks}</div>
                <div className="text-xs text-ink-mid">{missedTasks} missed, {hardTasks.length} marked hard</div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-2 shadow-sm print:hidden">
            <div className="grid grid-cols-4 gap-1">
              {(["today", "calendar", "progress", "settings"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`h-10 rounded-lg text-xs font-semibold ${
                    viewMode === mode ? "bg-ink-fixed text-white dark:bg-white dark:text-ink-fixed" : "text-ink-mid"
                  }`}
                >
                  {mode === "settings" ? "Edit" : mode[0].toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className={viewMode === "calendar" ? "block" : "hidden"}>
            <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Daily calendar</h2>
                  <p className="text-sm text-ink-mid">Click a day to inspect tasks and mark progress.</p>
                </div>
                <div className="flex gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold"
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </button>
                </div>
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
              <div className="mt-4 xl:hidden">
                {selectedDayPanel}
              </div>
            </section>
          </div>

          <div className={viewMode === "today" ? "block" : "hidden"}>
            <div className="mb-4 xl:hidden">
              {selectedDayPanel}
            </div>
            <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">This week</h2>
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
                      onClick={() => {
                        setSelectedDate(date);
                        setViewMode("today");
                      }}
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
          </div>

          <div className={viewMode === "progress" ? "block" : "hidden"}>
            <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Progress and rebalancing</h2>
                  <p className="text-sm text-ink-mid">Hard or missed work becomes the next review priority.</p>
                </div>
                <button
                  type="button"
                  onClick={resetProgress}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold print:hidden"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reset
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-background p-4">
                  <Flame className="h-5 w-5 text-amber-600" />
                  <div className="mt-3 text-2xl font-semibold">{Math.round((completedCount / Math.max(1, tasks.length)) * 100)}%</div>
                  <div className="text-sm text-ink-mid">completion</div>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <BarChart3 className="h-5 w-5 text-green-700" />
                  <div className="mt-3 text-2xl font-semibold">{scoreGap}</div>
                  <div className="text-sm text-ink-mid">points to target</div>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <div className="mt-3 text-2xl font-semibold">{missedTasks}</div>
                  <div className="text-sm text-ink-mid">overdue tasks</div>
                </div>
              </div>
              {(hardTasks.length > 0 || missedTasks > 0) && (
                <div className="mt-3 rounded-lg border border-amber-400/40 bg-amber-300/15 p-4 text-sm">
                  Next generated review priority: {hardTasks[0]?.title ?? "unfinished earlier work"}. Add a review block or increase that focus area's intensity.
                </div>
              )}
            </section>
          </div>
        </section>

        {showTaskRail && (
          <aside className="hidden space-y-4 xl:block">
            {selectedDayPanel}
            {nextUpPanel}
          </aside>
        )}
      </div>
    </main>
  );
};

export default StudyPlanLab;
