import { describe, expect, it } from "vitest";
import {
  canScrollElementInDirection,
  getTouchScrollDelta,
} from "@/lib/questionPageScrollLock";

describe("question page scroll lock", () => {
  it("maps an upward finger movement to downward content scrolling", () => {
    expect(getTouchScrollDelta(300, 240)).toBe(60);
    expect(getTouchScrollDelta(240, 300)).toBe(-60);
  });

  it("allows nested scrolling only while content can move in that direction", () => {
    const metrics = { scrollTop: 50, scrollHeight: 300, clientHeight: 100 };

    expect(canScrollElementInDirection(metrics, 20)).toBe(true);
    expect(canScrollElementInDirection(metrics, -20)).toBe(true);
    expect(canScrollElementInDirection({ ...metrics, scrollTop: 200 }, 20)).toBe(false);
    expect(canScrollElementInDirection({ ...metrics, scrollTop: 0 }, -20)).toBe(false);
  });
});
