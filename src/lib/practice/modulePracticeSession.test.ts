import { describe, expect, it } from "vitest";

import {
  advanceModulePracticeSessionTimer,
  clearModulePracticeSession,
  getModulePracticeSession,
  getModulePracticeDefaultTimeMinutes,
  resumeModulePracticeSession,
  saveModulePracticeSession,
  type ModulePracticeSessionMeta,
  type ModulePracticeSessionStorageLike,
} from "./modulePracticeSession";

const sessionFor = (
  subject: "math" | "reading",
  timeLimitSeconds: number,
  ownerUid: string | null = null,
): ModulePracticeSessionMeta => ({
  version: 1,
  ownerUid,
  sessionId: `${subject}-session-${ownerUid ?? "anon"}`,
  moduleSlug: `${subject}-module`,
  moduleTitle: `${subject} module`,
  moduleSubtitle: "Timed practice",
  subject,
  questionCount: 27,
  currentIndex: 0,
  startedAt: 1,
  status: "active",
  settings: { timed: true, timeLimitSeconds, allowCheckingAnswers: false },
  elapsedSeconds: 0,
  remainingSeconds: timeLimitSeconds,
  timerRemainderMs: 0,
});

const createStorage = (): ModulePracticeSessionStorageLike => {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    key: (index) => [...values.keys()][index] ?? null,
  };
};

describe("module practice timers", () => {
  it("uses the standard 32-minute Reading and Writing and 35-minute Math limits", () => {
    expect(getModulePracticeDefaultTimeMinutes("reading")).toBe(32);
    expect(getModulePracticeDefaultTimeMinutes("math")).toBe(35);
  });

  it.each([
    ["reading", 32 * 60],
    ["math", 35 * 60],
    ["reading half module", 16 * 60],
    ["math half module", 17.5 * 60],
  ] as const)("preserves and advances the %s countdown", (label, seconds) => {
    const subject = label.startsWith("math") ? "math" : "reading";
    const advanced = advanceModulePracticeSessionTimer(sessionFor(subject, seconds), 1_500);

    expect(advanced.elapsedSeconds).toBe(1);
    expect(advanced.remainingSeconds).toBe(seconds - 1);
    expect(advanced.timerRemainderMs).toBe(500);
  });

  it("carries the same countdown through review and caps truthful elapsed time at expiry", () => {
    const duringQuestions = advanceModulePracticeSessionTimer(sessionFor("math", 2), 1_500, 1_501);
    const duringReview = advanceModulePracticeSessionTimer(duringQuestions, 500, 2_001);
    const afterExpiry = advanceModulePracticeSessionTimer(duringReview, 10_000, 12_001);

    expect(duringQuestions).toMatchObject({
      elapsedSeconds: 1,
      remainingSeconds: 1,
      timerRemainderMs: 500,
      timerUpdatedAt: 1_501,
    });
    expect(duringReview).toMatchObject({
      elapsedSeconds: 2,
      remainingSeconds: 0,
      timerRemainderMs: 0,
      timerUpdatedAt: 2_001,
    });
    expect(afterExpiry).toBe(duringReview);
  });

  it("resumes a paused module without charging time spent away", () => {
    const paused = {
      ...advanceModulePracticeSessionTimer(sessionFor("reading", 32 * 60), 1_500, 2_500),
      status: "paused" as const,
    };

    const resumed = resumeModulePracticeSession(paused, 60_000);
    const afterOneSecond = advanceModulePracticeSessionTimer(resumed, 1_000, 61_000);

    expect(resumed).toMatchObject({
      status: "active",
      elapsedSeconds: 1,
      remainingSeconds: 32 * 60 - 1,
      timerRemainderMs: 500,
      timerUpdatedAt: 60_000,
    });
    expect(afterOneSecond).toMatchObject({
      elapsedSeconds: 2,
      remainingSeconds: 32 * 60 - 2,
      timerRemainderMs: 500,
      timerUpdatedAt: 61_000,
    });
  });
});

describe("module practice session ownership", () => {
  it("stores and clears active sessions within one owner scope", () => {
    const storage = createStorage();
    const first = sessionFor("math", 35 * 60, "user-1");
    const second = sessionFor("math", 35 * 60, "user-2");
    saveModulePracticeSession(first, storage);
    saveModulePracticeSession(second, storage);
    storage.setItem(`module-practice:state:${first.sessionId}:question-1`, "private-user-1-answer");
    storage.setItem(`module-practice:state:${second.sessionId}:question-1`, "private-user-2-answer");

    expect(getModulePracticeSession("math-module", "user-1", storage)?.sessionId).toBe(first.sessionId);
    expect(getModulePracticeSession("math-module", "user-2", storage)?.sessionId).toBe(second.sessionId);
    expect(getModulePracticeSession("math-module", "user-3", storage)).toBeNull();

    clearModulePracticeSession("math-module", "user-2", storage);
    expect(getModulePracticeSession("math-module", "user-2", storage)).toBeNull();
    expect(getModulePracticeSession("math-module", "user-1", storage)?.sessionId).toBe(first.sessionId);
    expect(storage.getItem(`module-practice:state:${first.sessionId}:question-1`)).toBe("private-user-1-answer");
    expect(storage.getItem(`module-practice:state:${second.sessionId}:question-1`)).toBeNull();
  });

  it("migrates only anonymous legacy sessions into the anonymous scope", () => {
    const storage = createStorage();
    const legacy = sessionFor("math", 35 * 60, null) as Partial<ModulePracticeSessionMeta>;
    delete legacy.ownerUid;
    storage.setItem("module-practice:session:math-module", JSON.stringify(legacy));

    expect(getModulePracticeSession("math-module", "user-1", storage)).toBeNull();
    expect(storage.getItem("module-practice:session:math-module")).not.toBeNull();

    expect(getModulePracticeSession("math-module", null, storage)).toMatchObject({
      ownerUid: null,
      sessionId: "math-session-anon",
    });
    expect(storage.getItem("module-practice:session:math-module")).toBeNull();
    expect(getModulePracticeSession("math-module", "user-1", storage)).toBeNull();
  });
});
