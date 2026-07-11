import { describe, expect, it } from "vitest";

import {
  INTERNATIONAL_SAT_FEES,
  OFFICIAL_SAT_DATES,
} from "@/lib/seo-data/satOfficialData";

describe("official SAT facts", () => {
  it("keeps the current international fee arithmetic explicit", () => {
    expect(INTERNATIONAL_SAT_FEES.registration + INTERNATIONAL_SAT_FEES.international)
      .toBe(INTERNATIONAL_SAT_FEES.total);
    expect(INTERNATIONAL_SAT_FEES.total).toBe(111);
  });

  it("includes the September 2026 administration and corrected spring dates", () => {
    expect(OFFICIAL_SAT_DATES.map(({ date }) => date)).toEqual([
      "2026-08-22",
      "2026-09-12",
      "2026-10-03",
      "2026-11-07",
      "2026-12-05",
      "2027-03-06",
      "2027-05-01",
      "2027-06-05",
    ]);
  });
});
