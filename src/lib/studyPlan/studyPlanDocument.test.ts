import { describe, expect, it } from "vitest";

import {
  createStudyPlanDocument,
  createStudyPlanScoreSummary,
  migrateLegacyStudyPlanData,
  sanitizeStudyPlanDocument,
} from "@/lib/studyPlan/studyPlanDocument";
import {
  createDefaultStudyPlanSettings,
  generateStudyPlan,
  type StudyPlanTask,
} from "@/lib/studyPlan/studyPlanEngine";
import type { ParsedScoreReport } from "@/lib/studyPlan/scoreReportParser";

const today = "2026-07-09";

const buildSettings = () => ({
  ...createDefaultStudyPlanSettings(today),
  setupComplete: true,
  startDate: today,
  satDate: "2026-08-22",
});

const buildReport = (): ParsedScoreReport => ({
  fileName: "Luke Private SAT.pdf",
  source: "pdf-text",
  totalScore: 1280,
  readingWritingScore: 630,
  mathScore: 650,
  testDate: "June 6, 2026",
  domains: [{
    id: "Algebra",
    label: "Algebra",
    section: "Math",
    proficiency: 3,
    performanceRange: "450-500",
    performanceMidpoint: 475,
    percent: 35,
    questionRange: "13-15",
    rawContext: "Student Luke Finigan private raw context",
  }],
  recommendedFocus: ["Algebra"],
  extractedText: "Student Luke Finigan private extracted report text",
  warnings: ["Review the detected values before applying them."],
});

const buildDocument = (updatedAt = 100) => {
  const settings = buildSettings();
  return createStudyPlanDocument({
    settings,
    tasks: generateStudyPlan(settings, { today }),
    progress: {},
    updatedAt,
  });
};

describe("StudyPlanDocumentV2", () => {
  it("stores only derived score-report fields", () => {
    const report = buildReport();
    const summary = createStudyPlanScoreSummary(report, 100);
    const document = createStudyPlanDocument({
      ...buildDocument(100),
      scoreSummary: summary,
      updatedAt: 101,
    });

    const serialized = JSON.stringify(document);
    expect(serialized).toContain("1280");
    expect(serialized).toContain("Algebra");
    expect(serialized).not.toContain(report.fileName);
    expect(serialized).not.toContain(report.extractedText);
    expect(serialized).not.toContain(report.domains[0].rawContext);
    expect(serialized).not.toContain(report.testDate);
  });

  it("keeps only allowlisted action and settings fields", () => {
    const document = buildDocument();
    const task = document.tasks.find((candidate) => candidate.action.kind === "timed-set")!;
    const action = {
      ...task.action,
      futureLaunchFlag: "supported",
      rawContext: "private OCR context",
      extractedText: "private report text",
    };
    const value = {
      ...document,
      settings: {
        ...document.settings,
        intensity: { ...document.settings.intensity, extractedText: "private report text" },
      },
      tasks: document.tasks.map((candidate) => candidate.id === task.id
        ? { ...candidate, action }
        : candidate),
    };

    const sanitized = sanitizeStudyPlanDocument(value)!;
    const savedAction = sanitized.tasks.find((candidate) => candidate.id === task.id)!.action as unknown as Record<string, unknown>;
    expect(savedAction).not.toHaveProperty("futureLaunchFlag");
    expect(savedAction).not.toHaveProperty("rawContext");
    expect(savedAction).not.toHaveProperty("extractedText");
    expect(sanitized.settings.intensity).not.toHaveProperty("extractedText");
  });

  it("drops orphaned progress and rejects malformed tasks", () => {
    const document = buildDocument();
    const taskId = document.tasks[0].id;
    const sanitized = sanitizeStudyPlanDocument({
      ...document,
      progress: {
        [taskId]: {
          completed: true,
          accuracy: 80,
          missedReviewCompletedAt: "2026-07-10T12:00:00.000Z",
          missedQuestionRefs: [{ subject: "math", sourceId: "official#1", bankType: "past", storageId: "math-1" }],
        },
        removedTask: { completed: true },
      },
    })!;

    expect(sanitized.progress).toEqual({
      [taskId]: {
        completed: true,
        accuracy: 80,
        missedReviewCompletedAt: "2026-07-10T12:00:00.000Z",
        missedQuestionRefs: [{ subject: "math", sourceId: "official#1", bankType: "past", storageId: "math-1" }],
      },
    });
    expect(sanitizeStudyPlanDocument({
      ...document,
      tasks: [{ ...document.tasks[0], minutes: 999 }],
    })).toBeNull();
    const timedTask = document.tasks.find((task) => task.action.kind === "timed-set")!;
    expect(timedTask.action.kind).toBe("timed-set");
    if (timedTask.action.kind !== "timed-set") return;
    expect(sanitizeStudyPlanDocument({
      ...document,
      tasks: document.tasks.map((task) => task.id === timedTask.id
        ? {
            ...task,
            action: { ...timedTask.action, timeLimitMinutes: task.minutes + 5 },
          }
        : task),
    })).toBeNull();
  });

  it("regenerates legacy actions and sanitizes legacy report data", () => {
    const report = buildReport();
    const migrated = migrateLegacyStudyPlanData({
      settings: {
        ...buildSettings(),
        focus: ["Algebra", "Full Practice"],
        intensity: { Algebra: "heavy", "Full Practice": "normal" },
      },
      progress: { completed: {}, confidence: {} },
      scoreReport: {
        name: report.fileName,
        addedAt: "2026-07-08T12:00:00.000Z",
        parsed: report,
      },
    }, Date.parse("2026-07-09T12:00:00.000Z"));

    expect(migrated?.schemaVersion).toBe(2);
    expect(migrated?.settings.focus).toEqual(["Algebra", "Pacing"]);
    expect(migrated?.tasks.length).toBeGreaterThan(0);
    expect(migrated?.tasks.every((task: StudyPlanTask) =>
      ["lesson", "missed-review", "timed-set", "module", "checklist"].includes(task.action.kind))).toBe(true);
    expect(JSON.stringify(migrated)).not.toContain("Luke Private SAT.pdf");
    expect(JSON.stringify(migrated)).not.toContain("private extracted report text");
  });

  it("fails a malformed legacy payload closed instead of throwing", () => {
    expect(migrateLegacyStudyPlanData({
      settings: {
        ...buildSettings(),
        freeWeekdays: "Monday",
      },
    }, Date.parse("2026-07-09T12:00:00.000Z"))).toBeNull();
  });

  it("drops an empty report summary so it cannot trigger report-based planning", () => {
    const document = buildDocument();
    const sanitized = sanitizeStudyPlanDocument({
      ...document,
      scoreSummary: {
        source: "pdf-text",
        importedAt: 100,
        domains: [],
        recommendedFocus: [],
        warnings: [],
      },
    });

    expect(sanitized?.scoreSummary).toBeUndefined();
  });
});
