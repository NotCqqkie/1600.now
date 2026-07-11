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
import { getPracticeModules } from "@/data/modulePracticeBank";
import type { BankSubject } from "@/data/questionBank";
import { satSkills } from "@/lib/seo-data/satSkillsData";

export type StudyPlanFocusId = MathDomain | EnglishDomain | "Pacing";
export type StudyPlanIntensity = "light" | "normal" | "heavy";
export type StudyPlanPacingMode = "steady" | "tighten";
export type StudyPlanTaskType = "diagnostic" | "lesson" | "timed-set" | "module" | "review" | "checklist";

export interface StudyPlanFocusArea {
  id: StudyPlanFocusId;
  label: string;
  section: "Math" | "Reading & Writing" | "Strategy";
  skills: string[];
}

export interface StudyPlanQuestionRef {
  subject: BankSubject;
  sourceId: string;
  bankType: "past" | "unofficial";
  storageId: string;
}

export type StudyPlanTaskAction =
  | {
      kind: "lesson";
      skill: MathSkill | EnglishSkill;
      href: string;
    }
  | {
      kind: "missed-review";
      sourceAssignmentId: string;
      questionRefs: StudyPlanQuestionRef[];
      timeLimitMinutes: number;
    }
  | {
      kind: "timed-set";
      subject: BankSubject;
      filterType: "domain" | "skill";
      filterValue: string;
      questionCount: number;
      timeLimitMinutes: number;
      excludeSkills: string[];
    }
  | {
      kind: "module";
      subject: BankSubject;
      moduleSlug: string;
      timeLimitMinutes: number;
    }
  | {
      kind: "checklist";
      items: string[];
    };

export interface StudyPlanTask {
  id: string;
  date: string;
  title: string;
  minutes: number;
  workMinutes: number;
  reviewMinutes: number;
  focus: StudyPlanFocusId;
  type: StudyPlanTaskType;
  detail: string;
  action: StudyPlanTaskAction;
  locked?: boolean;
}

export interface StudyPlanSettings {
  setupComplete: boolean;
  startDate: string;
  satDate: string;
  targetScore: number;
  currentMath: number;
  currentReadingWriting: number;
  minutesPerDay: number;
  pacingMode: StudyPlanPacingMode;
  freeWeekdays: number[];
  focus: StudyPlanFocusId[];
  intensity: Record<StudyPlanFocusId, StudyPlanIntensity>;
  blackoutDates: string[];
}

export interface StudyPlanProgressRecord {
  completed: boolean;
  skipped?: boolean;
  completedAt?: string;
  missedReviewCompletedAt?: string;
  confidence?: "hard" | "okay" | "easy";
  accuracy?: number;
  elapsedSeconds?: number;
  missedSkills?: string[];
  missedQuestionRefs?: StudyPlanQuestionRef[];
  rebalanceDecision?: "applied" | "kept";
}

export interface StudyPlanGenerationOptions {
  hasImportedReport?: boolean;
  today?: string;
}

export const officialSatDates = [
  { date: "2026-08-22", monthLabel: "August 2026", label: "Aug. 22, 2026", deadline: "Aug. 7, 2026" },
  { date: "2026-09-12", monthLabel: "September 2026", label: "Sept. 12, 2026", deadline: "Aug. 28, 2026" },
  { date: "2026-10-03", monthLabel: "October 2026", label: "Oct. 3, 2026", deadline: "Sept. 18, 2026" },
  { date: "2026-11-07", monthLabel: "November 2026", label: "Nov. 7, 2026", deadline: "Oct. 23, 2026" },
  { date: "2026-12-05", monthLabel: "December 2026", label: "Dec. 5, 2026", deadline: "Nov. 20, 2026" },
  { date: "2027-03-06", monthLabel: "March 2027", label: "March 6, 2027", deadline: "Feb. 19, 2027" },
  { date: "2027-05-01", monthLabel: "May 2027", label: "May 1, 2027", deadline: "Apr. 16, 2027" },
  { date: "2027-06-05", monthLabel: "June 2027", label: "June 5, 2027", deadline: "May 21, 2027" },
] as const;

export const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const isVocabSkill = (skill: string) => /words in context|vocab/i.test(skill);

const mathFocus: StudyPlanFocusArea[] = allMathDomains.map((domain) => ({
  id: domain,
  label: domain,
  section: "Math",
  skills: mathDomainSkills[domain],
}));

const englishFocus: StudyPlanFocusArea[] = allEnglishDomains.map((domain) => ({
  id: domain,
  label: domain,
  section: "Reading & Writing",
  skills: englishDomainSkills[domain].filter((skill) => !isVocabSkill(skill)),
}));

export const studyPlanFocusAreas: StudyPlanFocusArea[] = [
  ...englishFocus,
  ...mathFocus,
  {
    id: "Pacing",
    label: "Pacing",
    section: "Strategy",
    skills: ["Math module timing", "Question triage", "End-check routine"],
  },
];

export const studyPlanFocusById = new Map(studyPlanFocusAreas.map((area) => [area.id, area]));

export const studyPlanFocusForSkills = (skills: readonly string[]) =>
  studyPlanFocusAreas.find((area) => skills.some((skill) => area.skills.includes(skill)))?.id;

const knownFocusIds = new Set(studyPlanFocusAreas.map((area) => area.id));
const mathModules = getPracticeModules()
  .filter((module) => module.subject === "math")
  .sort((left, right) => left.setNumber - right.setNumber || left.moduleNumber - right.moduleNumber);

export const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const currentDateKey = () => toDateKey(new Date());

export const addDays = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

export const daysBetween = (start: string, end: string) => {
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = end.split("-").map(Number);
  const startTime = Date.UTC(startYear, startMonth - 1, startDay);
  const endTime = Date.UTC(endYear, endMonth - 1, endDay);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 0;
  return Math.ceil((endTime - startTime) / 86400000);
};

export const formatStudyPlanDate = (dateKey: string, style: "short" | "long" | "month" = "short") =>
  new Intl.DateTimeFormat("en-US", style === "month"
    ? { month: "long", year: "numeric" }
    : {
        month: style === "long" ? "long" : "short",
        day: "numeric",
        year: style === "long" ? "numeric" : undefined,
        weekday: style === "long" ? "long" : undefined,
      }).format(new Date(`${dateKey}T12:00:00`));

export const availableOfficialSatDates = (today = currentDateKey()) =>
  officialSatDates.filter((item) => item.date > today);

export const nextOfficialSatDate = (today = currentDateKey()) =>
  availableOfficialSatDates(today)[0]?.date ?? "";

const defaultIntensity = () => studyPlanFocusAreas.reduce((result, area) => {
  result[area.id] = "normal";
  return result;
}, {} as Record<StudyPlanFocusId, StudyPlanIntensity>);

export const createDefaultStudyPlanSettings = (today = currentDateKey()): StudyPlanSettings => ({
  setupComplete: false,
  startDate: today,
  satDate: nextOfficialSatDate(today),
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
  intensity: defaultIntensity(),
  blackoutDates: [],
});

const isDateKey = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T12:00:00`).getTime());

const clampScore = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed / 10) * 10));
};

export const normalizeStudyPlanSettings = (
  value: Partial<Omit<StudyPlanSettings, "focus" | "intensity">> & {
    focus?: string[];
    intensity?: Partial<Record<StudyPlanFocusId, StudyPlanIntensity>>;
  },
  today = currentDateKey(),
): StudyPlanSettings => {
  const fallback = createDefaultStudyPlanSettings(today);
  const availableDates = availableOfficialSatDates(today);
  const validSatDates = new Set<string>(availableDates.map((item) => item.date));
  const migratedFocus = (value.focus ?? fallback.focus)
    .map((focus) => focus === "Full Practice" ? "Pacing" : focus)
    .filter((focus): focus is StudyPlanFocusId => knownFocusIds.has(focus as StudyPlanFocusId));
  const focus = Array.from(new Set(migratedFocus));
  const intensity = defaultIntensity();
  for (const area of studyPlanFocusAreas) {
    const candidate = value.intensity?.[area.id];
    if (candidate === "light" || candidate === "normal" || candidate === "heavy") intensity[area.id] = candidate;
  }
  const hasFutureSavedSatDate = typeof value.satDate === "string" && validSatDates.has(value.satDate);
  const savedPlanNeedsNewDate = value.setupComplete === true && !hasFutureSavedSatDate;
  const satDate = savedPlanNeedsNewDate
    ? ""
    : hasFutureSavedSatDate
      ? value.satDate as string
      : fallback.satDate;
  const preserveActiveHistory = value.setupComplete === true && hasFutureSavedSatDate;
  const requestedStart = isDateKey(value.startDate) ? value.startDate : fallback.startDate;
  const startDate = preserveActiveHistory || requestedStart >= today ? requestedStart : today;
  const weekdays = Array.from(new Set((value.freeWeekdays ?? fallback.freeWeekdays)
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)))
    .sort((left, right) => left - right);

  return {
    setupComplete: value.setupComplete === true && !savedPlanNeedsNewDate,
    startDate,
    satDate,
    targetScore: clampScore(value.targetScore, fallback.targetScore, 400, 1600),
    currentMath: clampScore(value.currentMath, fallback.currentMath, 200, 800),
    currentReadingWriting: clampScore(value.currentReadingWriting, fallback.currentReadingWriting, 200, 800),
    minutesPerDay: Math.min(150, Math.max(15, Math.round(Number(value.minutesPerDay ?? fallback.minutesPerDay) / 5) * 5)),
    pacingMode: value.pacingMode === "tighten" ? "tighten" : "steady",
    freeWeekdays: weekdays.length ? weekdays : fallback.freeWeekdays,
    focus: focus.length ? focus : fallback.focus,
    intensity,
    blackoutDates: Array.from(new Set((value.blackoutDates ?? [])
      .filter(isDateKey)
      .filter((date) => preserveActiveHistory || date >= today)))
      .sort(),
  };
};

export const validateStudyPlanSettings = (settings: StudyPlanSettings, today = currentDateKey()) => {
  const errors: string[] = [];
  if (!settings.satDate) {
    errors.push(availableOfficialSatDates(today).length
      ? "Choose a future weekend SAT date."
      : "No future weekend SAT date is available through June 2027.");
  }
  const preservesActiveHistory = settings.setupComplete && settings.satDate > today;
  if (settings.startDate < today && !preservesActiveHistory) errors.push("Your start date cannot be before today.");
  if (settings.satDate && settings.startDate >= settings.satDate) errors.push("Your start date must be before your SAT date.");
  if (!settings.freeWeekdays.length) errors.push("Choose at least one study weekday.");
  if (!settings.focus.length) errors.push("Choose at least one focus area.");
  if (!Number.isInteger(settings.currentReadingWriting) || settings.currentReadingWriting < 200 || settings.currentReadingWriting > 800 || settings.currentReadingWriting % 10 !== 0) {
    errors.push("Reading & Writing score must be between 200 and 800 in 10-point steps.");
  }
  if (!Number.isInteger(settings.currentMath) || settings.currentMath < 200 || settings.currentMath > 800 || settings.currentMath % 10 !== 0) {
    errors.push("Math score must be between 200 and 800 in 10-point steps.");
  }
  if (!Number.isInteger(settings.targetScore) || settings.targetScore < 400 || settings.targetScore > 1600 || settings.targetScore % 10 !== 0) {
    errors.push("Target score must be between 400 and 1600 in 10-point steps.");
  }
  if (!Number.isInteger(settings.minutesPerDay) || settings.minutesPerDay < 15 || settings.minutesPerDay > 150 || settings.minutesPerDay % 5 !== 0) {
    errors.push("Daily study time must be between 15 and 150 minutes.");
  }
  return errors;
};

export const isStudyPlanDay = (dateKey: string, settings: StudyPlanSettings) => {
  const weekday = new Date(`${dateKey}T12:00:00`).getDay();
  return settings.freeWeekdays.includes(weekday) && !settings.blackoutDates.includes(dateKey);
};

const buildDateRange = (start: string, end: string) => {
  const dayCount = Math.max(0, daysBetween(start, end));
  return Array.from({ length: dayCount }, (_, index) => addDays(start, index));
};

const weightedFocusQueue = (settings: StudyPlanSettings) => settings.focus.flatMap((focus) => {
  const intensity = settings.intensity[focus] ?? "normal";
  const weight = intensity === "heavy" ? 3 : intensity === "light" ? 1 : 2;
  return Array.from({ length: weight }, () => focus);
});

const skillGuideFor = (skill: string) => satSkills.find((entry) => entry.officialSkill === skill);

const questionCountForTimer = (minutes: number, subject: BankSubject, minimum = 3) => {
  const minutesPerQuestion = subject === "math" ? 2.5 : 2;
  return Math.max(minimum, Math.min(18, Math.floor(minutes / minutesPerQuestion)));
};

const timePartsForTimedSet = (budget: number) => {
  if (budget < 15) {
    const reviewMinutes = Math.max(1, Math.floor(budget * 0.2));
    return { workMinutes: budget - reviewMinutes, reviewMinutes };
  }
  const reviewMinutes = Math.min(20, Math.max(5, Math.floor(budget * 0.3 / 5) * 5));
  return { workMinutes: budget - reviewMinutes, reviewMinutes };
};

const subjectForFocus = (focus: StudyPlanFocusId, index: number): BankSubject => {
  const area = studyPlanFocusById.get(focus);
  if (area?.section === "Math") return "math";
  if (area?.section === "Reading & Writing") return "reading";
  return index % 2 === 0 ? "math" : "reading";
};

const timedSetFor = (
  date: string,
  focus: StudyPlanFocusId,
  budget: number,
  index: number,
  type: "diagnostic" | "timed-set" = "timed-set",
  minimumQuestionCount = 3,
): StudyPlanTask => {
  const area = studyPlanFocusById.get(focus) ?? studyPlanFocusAreas[0];
  const subject = subjectForFocus(focus, index);
  const filterValue = area.section === "Strategy"
    ? subject === "math" ? "Algebra" : "Information and Ideas"
    : area.label;
  const { workMinutes, reviewMinutes } = timePartsForTimedSet(budget);
  const questionCount = questionCountForTimer(workMinutes, subject, minimumQuestionCount);
  const label = area.section === "Strategy" ? (subject === "math" ? "Math" : "Reading & Writing") : area.label;
  return {
    id: `${date}-${type}-${focus.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
    date,
    title: type === "diagnostic" ? `${label} baseline diagnostic` : `${label} timed set`,
    minutes: workMinutes + reviewMinutes,
    workMinutes,
    reviewMinutes,
    focus,
    type,
    detail: `${questionCount} questions. Aim to answer in ${workMinutes} minutes, then use the remaining ${reviewMinutes} minutes in the same countdown to check and redo misses before finishing.`,
    action: {
      kind: "timed-set",
      subject,
      filterType: "domain",
      filterValue,
      questionCount,
      timeLimitMinutes: workMinutes + reviewMinutes,
      excludeSkills: subject === "reading" ? ["Words in Context"] : [],
    },
  };
};

const diagnosticDayFor = (
  date: string,
  settings: StudyPlanSettings,
  budget: number,
): StudyPlanTask[] => {
  const readingFocus = settings.focus.find((focus) => studyPlanFocusById.get(focus)?.section === "Reading & Writing")
    ?? "Information and Ideas";
  const mathFocusId = settings.focus.find((focus) => studyPlanFocusById.get(focus)?.section === "Math")
    ?? "Algebra";
  const readingBudget = Math.floor(budget / 2);
  const mathBudget = budget - readingBudget;
  const reading = timedSetFor(date, readingFocus, readingBudget, 0, "diagnostic", allEnglishDomains.length);
  const math = timedSetFor(date, mathFocusId, mathBudget, 1, "diagnostic", allMathDomains.length);
  const readingAction = reading.action as Extract<StudyPlanTaskAction, { kind: "timed-set" }>;
  const mathAction = math.action as Extract<StudyPlanTaskAction, { kind: "timed-set" }>;
  return [
    {
      ...reading,
      id: reading.id.replace(`${date}-diagnostic-`, `${date}-diagnostic-1-`),
      title: "Reading & Writing baseline diagnostic",
      detail: `Part 1 of a two-part baseline. Questions rotate across Reading & Writing domains as time allows. ${reading.detail}`,
      action: { ...readingAction, filterValue: "All Reading & Writing domains" },
    },
    {
      ...math,
      id: math.id.replace(`${date}-diagnostic-`, `${date}-diagnostic-2-`),
      title: "Math baseline diagnostic",
      detail: `Part 2 of a two-part baseline. Questions rotate across Math domains as time allows. ${math.detail}`,
      action: { ...mathAction, filterValue: "All Math domains" },
    },
  ];
};

const lessonFor = (date: string, focus: StudyPlanFocusId, budget: number, index: number): StudyPlanTask | null => {
  const area = studyPlanFocusById.get(focus) ?? studyPlanFocusAreas[0];
  const guides = area.skills
    .filter((skill) => !isVocabSkill(skill))
    .map(skillGuideFor)
    .filter((guide): guide is NonNullable<typeof guide> => Boolean(guide));
  const guide = guides[index % guides.length];
  if (!guide) return null;
  const minutes = Math.min(budget, 30);
  return {
    id: `${date}-lesson-${guide.slug}`,
    date,
    title: `${guide.name} lesson`,
    minutes,
    workMinutes: minutes,
    reviewMinutes: 0,
    focus,
    type: "lesson",
    detail: `Open the matching skill guide and work through its rules, examples, and key tips for ${minutes} minutes.`,
    action: { kind: "lesson", skill: guide.officialSkill, href: `/sat-skill/${guide.slug}` },
  };
};

const moduleFor = (
  date: string,
  budget: number,
  index: number,
  pacingMode: StudyPlanPacingMode,
  weekIndex: number,
): StudyPlanTask | null => {
  const module = mathModules[index % Math.max(1, mathModules.length)];
  if (!module || budget < 35) return null;
  const standardMinutes = 35;
  const timeLimitMinutes = pacingMode === "tighten"
    ? Math.max(29, standardMinutes - Math.min(6, Math.floor(weekIndex / 2) * 2))
    : standardMinutes;
  const moduleTitle = module.publicTitle.startsWith("Math") ? module.publicTitle : `Math ${module.publicTitle}`;
  return {
    id: `${date}-module-${module.slug}`,
    date,
    title: `Timed ${moduleTitle}`,
    minutes: timeLimitMinutes,
    workMinutes: timeLimitMinutes,
    reviewMinutes: 0,
    focus: "Pacing",
    type: "module",
    detail: `${timeLimitMinutes}-minute Math module. Submit when you finish; reviewing the result afterward is optional and is not part of this assignment.`,
    action: {
      kind: "module",
      subject: "math",
      moduleSlug: module.slug,
      timeLimitMinutes,
    },
  };
};

const reportReviewFor = (date: string, budget: number, focus: StudyPlanFocusId): StudyPlanTask => {
  const minutes = Math.min(25, budget);
  return {
    id: `${date}-report-review`,
    date,
    title: "Score report priority review",
    minutes,
    workMinutes: minutes,
    reviewMinutes: 0,
    focus,
    type: "checklist",
    detail: "Confirm the report priorities you applied and write one concrete mistake pattern for each weak domain.",
    action: {
      kind: "checklist",
      items: [
        "Review the detected section scores and weak domains",
        "Write one recurring mistake pattern for each priority domain",
        "Set one measurable goal for the next timed assignment",
      ],
    },
  };
};

const taperFor = (date: string, budget: number, focus: StudyPlanFocusId): StudyPlanTask => {
  const minutes = Math.min(20, Math.max(10, Math.floor(budget / 2)));
  return {
    id: `${date}-test-week-checklist`,
    date,
    title: "Light test-week checklist",
    minutes,
    workMinutes: minutes,
    reviewMinutes: 0,
    focus,
    type: "checklist",
    detail: "Keep the load deliberately light. Do not add a new timed set today.",
    action: {
      kind: "checklist",
      items: ["Review your shortest formula and grammar notes", "Confirm test-day materials", "Protect your normal sleep schedule"],
    },
  };
};

export const generateStudyPlan = (
  rawSettings: StudyPlanSettings,
  options: StudyPlanGenerationOptions = {},
): StudyPlanTask[] => {
  const today = options.today ?? currentDateKey();
  const settings = normalizeStudyPlanSettings(rawSettings, today);
  if (validateStudyPlanSettings(settings, today).length) return [];
  const studyDays = buildDateRange(settings.startDate, settings.satDate)
    .filter((date) => isStudyPlanDay(date, settings));
  const queue = weightedFocusQueue(settings);
  if (!studyDays.length || !queue.length) return [];
  const budget = settings.minutesPerDay;

  return studyDays.flatMap((date, index) => {
    const focus = queue[index % queue.length];
    const daysUntilTest = daysBetween(date, settings.satDate);
    const weekIndex = Math.floor(index / Math.max(1, settings.freeWeekdays.length));
    if (daysUntilTest <= 6) return [taperFor(date, budget, focus)];
    if (index === 0 && !options.hasImportedReport) return diagnosticDayFor(date, settings, budget);
    if (index === 0) return [reportReviewFor(date, budget, focus)];
    const wantsMathModule = budget >= 35 && (
      focus === "Pacing" ||
      (studyPlanFocusById.get(focus)?.section === "Math" && index % Math.max(4, settings.freeWeekdays.length) === 0)
    );
    if (wantsMathModule) {
      const module = moduleFor(date, budget, index, settings.pacingMode, weekIndex);
      if (module) return [module];
    }
    if (index % 3 === 1 && focus !== "Pacing") {
      const lesson = lessonFor(date, focus, budget, index);
      if (lesson) return [lesson];
    }
    return [timedSetFor(date, focus, budget, index)];
  });
};

export const taskFitsDailyBudget = (task: StudyPlanTask, budget: number) => {
  if (task.minutes > budget || task.workMinutes + task.reviewMinutes !== task.minutes) return false;
  if ((task.action.kind === "timed-set" || task.action.kind === "missed-review")
      && task.action.timeLimitMinutes > task.minutes) return false;
  if (task.action.kind === "module"
      && task.action.timeLimitMinutes + task.reviewMinutes > task.minutes) return false;
  return true;
};

export const mergeLockedStudyPlan = (
  generated: StudyPlanTask[],
  previous: StudyPlanTask[],
  progress: Record<string, StudyPlanProgressRecord>,
  today = currentDateKey(),
  dailyBudget?: number,
) => {
  if (!previous.length) return generated;
  const lockedIds = new Set<string>();
  const futureLockedMinutes = new Map<string, number>();
  for (const task of previous) {
    if (task.date < today || progress[task.id]?.completed) {
      lockedIds.add(task.id);
      continue;
    }
    if (!task.locked) continue;
    const scheduled = futureLockedMinutes.get(task.date) ?? 0;
    if (dailyBudget !== undefined
        && (!taskFitsDailyBudget(task, dailyBudget) || scheduled + task.minutes > dailyBudget)) continue;
    lockedIds.add(task.id);
    futureLockedMinutes.set(task.date, scheduled + task.minutes);
  }
  const lockedDates = new Set(previous.filter((task) => lockedIds.has(task.id)).map((task) => task.date));
  const previousDatesById = new Map(previous.map((task) => [task.id, task.date]));
  return [
    ...previous.filter((task) => lockedIds.has(task.id)).map((task) => ({ ...task, locked: true })),
    ...generated.filter((task) =>
      !lockedIds.has(task.id)
      && (!lockedDates.has(task.date) || previousDatesById.get(task.id) === task.date)
      && !(previousDatesById.has(task.id) && previousDatesById.get(task.id) !== task.date)),
  ].sort((left, right) => `${left.date}-${left.id}`.localeCompare(`${right.date}-${right.id}`));
};

export const isVocabularyFreeAssignment = (task: StudyPlanTask) => {
  if (task.action.kind === "lesson") return !isVocabSkill(task.action.skill);
  if (task.action.kind === "timed-set") {
    return task.action.subject !== "reading" || task.action.excludeSkills.some(isVocabSkill);
  }
  return task.action.kind !== "module" || task.action.subject !== "reading";
};
