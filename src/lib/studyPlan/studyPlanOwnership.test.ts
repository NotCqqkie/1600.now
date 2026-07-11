import { describe, expect, it } from "vitest";

import {
  isHydratedStudyPlanOwner,
  isStudyPlanOwnerReady,
} from "@/lib/studyPlan/studyPlanOwnership";

describe("study-plan ownership", () => {
  it("accepts only the currently hydrated owner", () => {
    expect(isHydratedStudyPlanOwner("user-a", "user-a")).toBe(true);
    expect(isHydratedStudyPlanOwner(null, null)).toBe(true);
    expect(isHydratedStudyPlanOwner("user-a", "user-b")).toBe(false);
    expect(isHydratedStudyPlanOwner(undefined, "user-a")).toBe(false);
  });

  it("keeps the planner gated while auth or owner hydration is pending", () => {
    expect(isStudyPlanOwnerReady({
      authLoading: true,
      persistenceReady: true,
      hydratedOwnerUid: "user-a",
      activeOwnerUid: "user-a",
    })).toBe(false);
    expect(isStudyPlanOwnerReady({
      authLoading: false,
      persistenceReady: false,
      hydratedOwnerUid: "user-a",
      activeOwnerUid: "user-a",
    })).toBe(false);
    expect(isStudyPlanOwnerReady({
      authLoading: false,
      persistenceReady: true,
      hydratedOwnerUid: "user-a",
      activeOwnerUid: "user-b",
    })).toBe(false);
  });

  it("allows signed-in and anonymous owners after hydration", () => {
    expect(isStudyPlanOwnerReady({
      authLoading: false,
      persistenceReady: true,
      hydratedOwnerUid: "user-a",
      activeOwnerUid: "user-a",
    })).toBe(true);
    expect(isStudyPlanOwnerReady({
      authLoading: false,
      persistenceReady: true,
      hydratedOwnerUid: null,
      activeOwnerUid: null,
    })).toBe(true);
  });
});
