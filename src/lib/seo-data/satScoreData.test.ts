import { describe, expect, it } from "vitest";

import {
  formatOrdinal,
  getBalancedSectionSplit,
  getScoreProfile,
} from "@/lib/seo-data/satScoreData";

describe("SAT score SEO data", () => {
  it("uses valid 10-point section splits for totals ending in 10", () => {
    expect(getBalancedSectionSplit(1530)).toEqual({ rw: 760, math: 770 });
    expect(getBalancedSectionSplit(1350)).toEqual({ rw: 670, math: 680 });
    expect(getBalancedSectionSplit(1600)).toEqual({ rw: 800, math: 800 });
  });

  it("uses College Board SAT-user percentiles", () => {
    expect(getScoreProfile(1530).percentileLabel).toBe("99th");
    expect(getScoreProfile(1400).percentileLabel).toBe("93rd");
    expect(getScoreProfile(1050).percentileLabel).toBe("56th");
    expect(getScoreProfile(520).percentileLabel).toBe("below 1st");
  });

  it("formats ordinal suffixes correctly", () => {
    expect(formatOrdinal(1)).toBe("1st");
    expect(formatOrdinal(2)).toBe("2nd");
    expect(formatOrdinal(3)).toBe("3rd");
    expect(formatOrdinal(11)).toBe("11th");
    expect(formatOrdinal(93)).toBe("93rd");
  });
});
