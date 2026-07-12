import { describe, expect, it } from "vitest";

import {
  SAT_SCORE_CTR_CONTROL_SCORES,
  SAT_SCORE_CTR_TREATMENT_SCORES,
  getSatScoreControlTitle,
  getSatScoreCtrExperimentArm,
  getSatScoreDocumentTitle,
} from "./ctrTitleExperiment";

describe("SAT score CTR title experiment", () => {
  it("keeps the treatment and control groups fixed and disjoint", () => {
    const treatment = new Set<number>(SAT_SCORE_CTR_TREATMENT_SCORES);
    const control = new Set<number>(SAT_SCORE_CTR_CONTROL_SCORES);

    expect(treatment.size).toBe(34);
    expect(control.size).toBe(34);
    expect([...treatment].filter((score) => control.has(score))).toEqual([]);
  });

  it("returns the preregistered experiment arm", () => {
    expect(getSatScoreCtrExperimentArm(430)).toBe("treatment");
    expect(getSatScoreCtrExperimentArm(470)).toBe("control");
    expect(getSatScoreCtrExperimentArm(1530)).toBe("excluded");
    expect(getSatScoreCtrExperimentArm(1200)).toBe("excluded");
  });

  it("changes only treatment document titles", () => {
    expect(getSatScoreDocumentTitle(430)).toBe(
      "Is 430 a Good SAT Score? Percentile & College Ranges",
    );
    expect(getSatScoreDocumentTitle(470)).toBe(getSatScoreControlTitle(470));
    expect(getSatScoreDocumentTitle(1530)).toBe(getSatScoreControlTitle(1530));
  });

  it("keeps treatment titles above the unbranded title threshold", () => {
    expect(getSatScoreDocumentTitle(430).length).toBeGreaterThanOrEqual(52);
    expect(getSatScoreDocumentTitle(1590).length).toBeGreaterThanOrEqual(52);
  });
});
