import { describe, expect, it } from "vitest";
import { shouldUseSidebarLayout } from "@/lib/responsiveWindowLayout";

describe("shouldUseSidebarLayout", () => {
  it("keeps requested sidebars on desktop", () => {
    expect(shouldUseSidebarLayout(true, false)).toBe(true);
  });

  it("forces requested sidebars to floating layout on mobile", () => {
    expect(shouldUseSidebarLayout(true, true)).toBe(false);
  });
});
