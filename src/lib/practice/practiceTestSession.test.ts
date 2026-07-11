import { describe, expect, it } from "vitest";

import { normalizePracticeTestSession } from "@/lib/practice/practiceTestSession";

const validSession = {
  version: 1,
  sessionId: "practice-test-1-123-abc",
  practiceSetId: "practice-test-1",
  practiceSetNumber: 1,
  currentIndex: 0,
  activeModuleIndex: 0,
  startedAt: 100,
  status: "active",
  phase: "module",
  settings: {
    timed: true,
    allowCheckingAnswers: false,
    moduleTimeLimitSeconds: { "reading-1": 1920 },
  },
  modules: [{
    moduleSlug: "reading-1",
    moduleTitle: "Reading and Writing Module 1",
    subject: "reading",
    moduleNumber: 1,
    questionCount: 27,
    startIndex: 0,
    endIndex: 26,
    timeLimitSeconds: 1920,
    elapsedSeconds: 0,
    remainingSeconds: 1920,
    timerRemainderMs: 0,
    status: "active",
  }],
  breakStatus: "pending",
  breakElapsedSeconds: 0,
  breakRemainingSeconds: 600,
} as const;

describe("practice-test session normalization", () => {
  it("accepts a complete current session", () => {
    expect(normalizePracticeTestSession(validSession, "practice-test-1")).toEqual(validSession);
  });

  it.each([
    {},
    { ...validSession, settings: undefined },
    { ...validSession, modules: [] },
    { ...validSession, activeModuleIndex: 5 },
    { ...validSession, practiceSetId: "practice-test-2" },
    { ...validSession, modules: [{ ...validSession.modules[0], endIndex: 99 }] },
  ])("rejects malformed or mismatched persisted sessions", (value) => {
    expect(normalizePracticeTestSession(value, "practice-test-1")).toBeNull();
  });
});
