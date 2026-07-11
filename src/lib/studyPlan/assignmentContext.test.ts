import { describe, expect, it } from "vitest";
import {
  STUDY_PLAN_ASSIGNMENT_STORAGE_KEY,
  advanceStudyPlanAssignmentTimer,
  beginStudyPlanAssignment,
  completeStudyPlanModuleAssignment,
  completeStudyPlanPracticeSetAssignment,
  consumeStudyPlanAssignmentResult,
  getMatchingStudyPlanAssignmentSession,
  getStudyPlanAssignmentReturnPath,
  getStudyPlanAssignmentSession,
  pauseStudyPlanAssignment,
  recordStudyPlanAssignmentQuestionResult,
  resumeStudyPlanAssignment,
} from "@/lib/studyPlan/assignmentContext";

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
};

const beginPracticeSet = (storage: ReturnType<typeof createStorage>) =>
  beginStudyPlanAssignment({
    ownerUid: "user-1",
    assignmentId: "assignment-1",
    plannedDate: "2026-07-10",
    returnPath: "/sat-study-plan-generator",
    timingMode: { kind: "countdown", timeLimitSeconds: 120 },
    source: {
      kind: "practice-set",
      practiceRunId: "run-1",
      questionRefs: [{ subject: "math", sourceId: "official#1", bankType: "past", storageId: "math-1" }],
    },
    launchedAt: 1_000,
  }, storage);

describe("study plan assignment context", () => {
  it("matches only the practice session that launched the assignment", () => {
    const storage = createStorage();
    beginPracticeSet(storage);

    expect(getMatchingStudyPlanAssignmentSession({ ownerUid: "user-1", practiceRunId: "run-1" }, storage)?.context.assignmentId)
      .toBe("assignment-1");
    expect(getMatchingStudyPlanAssignmentSession({ ownerUid: "user-1", practiceRunId: "another-run" }, storage))
      .toBeNull();
    expect(getMatchingStudyPlanAssignmentSession({ ownerUid: "user-2", practiceRunId: "run-1" }, storage))
      .toBeNull();
    expect(getStudyPlanAssignmentReturnPath({ ownerUid: "user-1", practiceRunId: "run-1" }, storage))
      .toBe("/sat-study-plan-generator");
  });

  it("persists one countdown across sub-second timer advances", () => {
    const storage = createStorage();
    beginPracticeSet(storage);

    advanceStudyPlanAssignmentTimer(600, "user-1", storage);
    const advanced = advanceStudyPlanAssignmentTimer(900, "user-1", storage);

    expect(advanced?.elapsedSeconds).toBe(1);
    expect(advanced?.remainingSeconds).toBe(119);
    expect(advanced?.timerRemainderMs).toBe(500);
  });

  it("records first-attempt accuracy and retains actual missed questions", () => {
    const storage = createStorage();
    beginPracticeSet(storage);
    recordStudyPlanAssignmentQuestionResult({
      storageId: "math-1",
      sourceId: "official#1",
      subject: "math",
      domain: "Algebra",
      skill: "Linear equations",
      isCorrect: false,
      timeSpentSeconds: 30,
    }, "user-1", storage);
    recordStudyPlanAssignmentQuestionResult({
      storageId: "math-1",
      sourceId: "official#1",
      subject: "math",
      domain: "Algebra",
      skill: "Linear equations",
      isCorrect: true,
      timeSpentSeconds: 45,
    }, "user-1", storage);

    const result = completeStudyPlanPracticeSetAssignment("run-1", "user-1", {}, storage);

    expect(result).toMatchObject({
      ownerUid: "user-1",
      attemptedCount: 1,
      correctCount: 0,
      accuracy: 0,
      missedQuestionIds: ["math-1"],
      missedSkills: ["Linear equations"],
    });
    expect(result?.questionResults[0]).toMatchObject({
      attemptCount: 2,
      firstAttemptCorrect: false,
      isCorrect: true,
    });
  });

  it("completes a module only when its slug and session id both match", () => {
    const storage = createStorage();
    beginStudyPlanAssignment({
      ownerUid: "user-1",
      assignmentId: "module-assignment",
      plannedDate: "2026-07-11",
      returnPath: "/study-plan-lab",
      timingMode: { kind: "countdown", timeLimitSeconds: 2_100 },
      source: { kind: "module", moduleSlug: "math-module-1", sessionId: "session-1" },
      launchedAt: 2_000,
    }, storage);
    const result = {
      sessionId: "another-session",
      moduleSlug: "math-module-1",
      elapsedSeconds: 300,
      questionCount: 1,
      answeredCount: 1,
      correctCount: 0,
      accuracy: 0,
      questions: [{
        storageId: "math-2",
        isAnswered: true,
        isCorrect: false,
        status: "answered",
        timeSpentSeconds: 300,
        domain: "Algebra",
        skill: "Systems of equations",
      }],
    };

    expect(completeStudyPlanModuleAssignment(result, "user-1", storage)).toBeNull();
    expect(completeStudyPlanModuleAssignment({ ...result, sessionId: "session-1" }, "user-2", storage))
      .toBeNull();
    expect(completeStudyPlanModuleAssignment({ ...result, sessionId: "session-1" }, "user-1", storage))
      .toMatchObject({ assignmentId: "module-assignment", missedQuestionIds: ["math-2"] });
  });

  it("ignores corrupt session data and consumes a result once", () => {
    const storage = createStorage();
    storage.setItem(STUDY_PLAN_ASSIGNMENT_STORAGE_KEY, "not-json");
    expect(getStudyPlanAssignmentSession(storage)).toBeNull();

    beginPracticeSet(storage);
    completeStudyPlanPracticeSetAssignment("run-1", "user-1", {}, storage);
    expect(consumeStudyPlanAssignmentResult(storage)?.assignmentId).toBe("assignment-1");
    expect(consumeStudyPlanAssignmentResult(storage)).toBeNull();
    expect(getStudyPlanAssignmentSession(storage)).toBeNull();
  });

  it("does not let another signed-in owner mutate or resume the assignment", () => {
    const storage = createStorage();
    beginPracticeSet(storage);

    expect(pauseStudyPlanAssignment("user-1", storage)?.status).toBe("paused");
    expect(resumeStudyPlanAssignment("user-2", storage)).toBeNull();
    expect(recordStudyPlanAssignmentQuestionResult({
      storageId: "math-1",
      isCorrect: false,
    }, "user-2", storage)).toBeNull();
    expect(completeStudyPlanPracticeSetAssignment("run-1", "user-2", {}, storage)).toBeNull();
    expect(getStudyPlanAssignmentSession(storage)).toMatchObject({
      status: "paused",
      questionResults: {},
    });
    expect(resumeStudyPlanAssignment("user-1", storage)?.status).toBe("active");
  });

  it("rejects malformed timer and question-result session state", () => {
    const storage = createStorage();
    beginPracticeSet(storage);
    const session = JSON.parse(storage.getItem(STUDY_PLAN_ASSIGNMENT_STORAGE_KEY)!) as Record<string, unknown>;

    storage.setItem(STUDY_PLAN_ASSIGNMENT_STORAGE_KEY, JSON.stringify({ ...session, remainingSeconds: -1 }));
    expect(getStudyPlanAssignmentSession(storage)).toBeNull();

    storage.setItem(STUDY_PLAN_ASSIGNMENT_STORAGE_KEY, JSON.stringify({ ...session, questionResults: [] }));
    expect(getStudyPlanAssignmentSession(storage)).toBeNull();

    storage.setItem(STUDY_PLAN_ASSIGNMENT_STORAGE_KEY, JSON.stringify({ ...session, updatedAt: Number.NaN }));
    expect(getStudyPlanAssignmentSession(storage)).toBeNull();
  });
});
