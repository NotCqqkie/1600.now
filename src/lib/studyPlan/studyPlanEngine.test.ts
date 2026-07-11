import { describe, expect, it } from "vitest";

import {
  addDays,
  createDefaultStudyPlanSettings,
  daysBetween,
  generateStudyPlan,
  isVocabularyFreeAssignment,
  mergeLockedStudyPlan,
  normalizeStudyPlanSettings,
  studyPlanFocusForSkills,
  studyPlanFocusById,
  taskFitsDailyBudget,
  validateStudyPlanSettings,
  type StudyPlanSettings,
} from "./studyPlanEngine";

const TODAY = "2026-07-09";

const settingsFor = (startDate: string, satDate: string, minutesPerDay = 45): StudyPlanSettings => ({
  ...createDefaultStudyPlanSettings(TODAY),
  setupComplete: true,
  startDate,
  satDate,
  minutesPerDay,
  freeWeekdays: [0, 1, 2, 3, 4, 5, 6],
  focus: ["Craft and Structure", "Algebra", "Pacing"],
});

describe("generateStudyPlan", () => {
  it.each([
    ["two weeks", "2026-08-08", "2026-08-22", 14],
    ["six weeks", "2026-08-01", "2026-09-12", 42],
    ["ninety days", "2026-08-09", "2026-11-07", 90],
    ["longest supported", "2026-07-09", "2027-06-05", 331],
  ])("builds a reachable, actionable, budget-correct, vocabulary-free %s plan", (_label, startDate, satDate, expectedDays) => {
    const settings = settingsFor(startDate, satDate);
    const tasks = generateStudyPlan(settings, { today: TODAY });

    expect(daysBetween(startDate, satDate)).toBe(expectedDays);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((task) => task.date >= startDate && task.date < satDate)).toBe(true);
    expect(tasks.every((task) => Boolean(task.action))).toBe(true);
    expect(tasks.every((task) => taskFitsDailyBudget(task, settings.minutesPerDay))).toBe(true);
    const minutesByDate = tasks.reduce((totals, task) => {
      totals.set(task.date, (totals.get(task.date) ?? 0) + task.minutes);
      return totals;
    }, new Map<string, number>());
    expect([...minutesByDate.values()].every((minutes) => minutes <= settings.minutesPerDay)).toBe(true);
    expect(tasks.every(isVocabularyFreeAssignment)).toBe(true);
    expect(tasks.filter((task) => task.action.kind === "lesson").every((task) =>
      task.action.kind === "lesson" && studyPlanFocusById.get(task.focus)?.skills.includes(task.action.skill))).toBe(true);
  });

  it("uses a real diagnostic without a report and report review only with a report", () => {
    const settings = settingsFor(TODAY, "2026-08-22");
    const withoutReport = generateStudyPlan(settings, { today: TODAY, hasImportedReport: false });
    const withReport = generateStudyPlan(settings, { today: TODAY, hasImportedReport: true });
    const diagnosticDay = withoutReport.filter((task) => task.date === settings.startDate);
    const diagnosticActions = diagnosticDay.map((task) => task.action);

    expect(diagnosticDay).toHaveLength(2);
    expect(diagnosticDay.every((task) => task.type === "diagnostic")).toBe(true);
    expect(diagnosticActions.every((action) => action.kind === "timed-set")).toBe(true);
    expect(new Set(diagnosticActions.map((action) => action.kind === "timed-set" ? action.subject : null)))
      .toEqual(new Set(["reading", "math"]));
    expect(diagnosticDay.reduce((sum, task) => sum + task.minutes, 0)).toBe(settings.minutesPerDay);
    expect(diagnosticDay.every((task) => task.detail.includes("two-part baseline"))).toBe(true);
    expect(diagnosticActions.map((action) => action.kind === "timed-set" ? action.filterValue : null))
      .toEqual(["All Reading & Writing domains", "All Math domains"]);
    expect(withReport[0].title).toContain("Score report");
    expect(withReport[0].action.kind).toBe("checklist");
  });

  it("keeps the minimum-time no-report diagnostic broad without exceeding the daily cap", () => {
    const settings = settingsFor(TODAY, "2026-08-22", 15);
    const tasks = generateStudyPlan(settings, { today: TODAY, hasImportedReport: false });
    const firstDay = tasks.filter((task) => task.date === settings.startDate);

    expect(firstDay).toHaveLength(2);
    expect(firstDay.every((task) => task.type === "diagnostic" && task.action.kind === "timed-set")).toBe(true);
    expect(firstDay.every((task) => task.action.kind === "timed-set" && task.action.questionCount >= 4)).toBe(true);
    expect(firstDay.reduce((sum, task) => sum + task.minutes, 0)).toBe(15);
    expect(firstDay.every((task) => taskFitsDailyBudget(task, 15))).toBe(true);
  });

  it("keeps a no-report plan genuinely light when it starts during taper week", () => {
    const settings = settingsFor("2026-08-18", "2026-08-22", 15);
    const tasks = generateStudyPlan(settings, { today: TODAY, hasImportedReport: false });

    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((task) => task.type === "checklist" && task.action.kind === "checklist")).toBe(true);
    expect(tasks.every((task) => task.minutes <= 20)).toBe(true);
  });

  it("uses Math-only tightening and standard Math timing", () => {
    const steady = settingsFor(TODAY, "2026-10-03", 45);
    const tightened = { ...steady, pacingMode: "tighten" as const };
    const steadyModules = generateStudyPlan(steady, { today: TODAY }).filter((task) => task.action.kind === "module");
    const tightModules = generateStudyPlan(tightened, { today: TODAY }).filter((task) => task.action.kind === "module");

    expect(steadyModules.length).toBeGreaterThan(0);
    expect(steadyModules.every((task) => task.action.kind === "module" && task.action.subject === "math" && task.action.timeLimitMinutes === 35)).toBe(true);
    expect(steadyModules.every((task) =>
      task.minutes === 35
      && task.reviewMinutes === 0
      && task.detail.includes("reviewing the result afterward is optional")
      && !task.detail.includes("before returning"))).toBe(true);
    expect(tightModules.every((task) => task.action.kind !== "module" || task.action.subject === "math")).toBe(true);
    expect(tightModules.some((task) => task.action.kind === "module" && task.action.timeLimitMinutes < 35)).toBe(true);
  });

  it("keeps taper assignments genuinely light", () => {
    const settings = settingsFor("2026-08-15", "2026-08-22", 90);
    const tasks = generateStudyPlan(settings, { today: TODAY });
    const taper = tasks.filter((task) => task.type === "checklist");

    expect(taper.length).toBeGreaterThan(0);
    expect(taper.every((task) => task.minutes <= 20 && task.action.kind === "checklist")).toBe(true);
  });

  it("rejects an assignment whose launch timer exceeds its displayed daily work", () => {
    const settings = settingsFor(TODAY, "2026-08-22", 60);
    const task = generateStudyPlan(settings, { today: TODAY })
      .find((candidate) => candidate.action.kind === "timed-set")!;
    expect(task.action.kind).toBe("timed-set");
    if (task.action.kind !== "timed-set") return;

    expect(taskFitsDailyBudget({
      ...task,
      action: { ...task.action, timeLimitMinutes: task.minutes + 5 },
    }, settings.minutesPerDay)).toBe(false);
  });

  it("never schedules a blackout date", () => {
    const settings = settingsFor(TODAY, "2026-08-22");
    settings.blackoutDates = [addDays(TODAY, 1), addDays(TODAY, 2)];
    const tasks = generateStudyPlan(settings, { today: TODAY });

    expect(tasks.some((task) => settings.blackoutDates.includes(task.date))).toBe(false);
  });

  it("keeps a moved locked assignment by id without restoring its old generated copy", () => {
    const settings = settingsFor(TODAY, "2026-08-22");
    const generated = generateStudyPlan(settings, { today: TODAY });
    const original = generated[0];
    const moved = { ...original, date: generated[2].date, locked: true };
    const merged = mergeLockedStudyPlan(generated, [moved], {}, TODAY);

    expect(merged.filter((task) => task.id === original.id)).toEqual([moved]);
  });

  it("regenerates future locked work that no longer fits a lower daily cap", () => {
    const originalSettings = settingsFor(TODAY, "2026-08-22", 45);
    const original = generateStudyPlan(originalSettings, { today: TODAY });
    const locked = { ...original.find((task) => task.date > TODAY)!, locked: true };
    const reducedSettings = { ...originalSettings, minutesPerDay: 15 };
    const regenerated = generateStudyPlan(reducedSettings, { today: TODAY });
    const merged = mergeLockedStudyPlan(regenerated, [locked], {}, TODAY, 15);

    expect(merged.every((task) => task.date <= TODAY || taskFitsDailyBudget(task, 15))).toBe(true);
    expect(merged.find((task) => task.id === locked.id)?.minutes).toBeLessThanOrEqual(15);
  });

  it("keeps the unfinished diagnostic sibling when the other same-day diagnostic is locked", () => {
    const settings = settingsFor(TODAY, "2026-08-22");
    const generated = generateStudyPlan(settings, { today: TODAY });
    const diagnosticDay = generated.filter((task) => task.date === TODAY);
    const merged = mergeLockedStudyPlan(generated, generated, {
      [diagnosticDay[0].id]: { completed: true },
    }, TODAY);

    expect(diagnosticDay).toHaveLength(2);
    expect(merged.filter((task) => task.date === TODAY).map((task) => task.id))
      .toEqual(diagnosticDay.map((task) => task.id));
  });

  it("requires an explicit new date for an expired saved plan", () => {
    const normalized = normalizeStudyPlanSettings({
      ...settingsFor("2026-07-09", "2026-08-22"),
      startDate: "2026-07-09",
      satDate: "2026-08-22",
    }, "2026-09-01");

    expect(normalized.startDate).toBe("2026-09-01");
    expect(normalized.satDate).toBe("");
    expect(normalized.setupComplete).toBe(false);
    expect(validateStudyPlanSettings(normalized, "2026-09-01")).toContain("Choose a future weekend SAT date.");
    expect(normalizeStudyPlanSettings(normalized, "2027-06-06").satDate).toBe("");
    expect(validateStudyPlanSettings(normalized, "2027-06-06"))
      .toContain("No future weekend SAT date is available through June 2027.");
  });

  it("keeps an active plan stable when today advances past its start date", () => {
    const settings = {
      ...settingsFor("2026-07-09", "2026-08-22"),
      blackoutDates: ["2026-07-11"],
    };
    const original = generateStudyPlan(settings, { today: "2026-07-09" });
    const normalized = normalizeStudyPlanSettings(settings, "2026-07-10");
    const reloaded = generateStudyPlan(normalized, { today: "2026-07-10" });

    expect(normalized.startDate).toBe("2026-07-09");
    expect(normalized.blackoutDates).toEqual(["2026-07-11"]);
    expect(reloaded).toEqual(original);
  });

  it("maps missed skills to the matching rebalance focus", () => {
    expect(studyPlanFocusForSkills(["Math module timing"])).toBe("Pacing");
  });
});
