import { describe, expect, it } from "vitest";

import {
  buildScoreReportReview,
} from "@/lib/studyPlan/scoreReportReview";
import type {
  ParsedScoreReport,
  ScoreReportDomainResult,
} from "@/lib/studyPlan/scoreReportParser";

const domain = (
  overrides: Partial<ScoreReportDomainResult> & Pick<ScoreReportDomainResult, "id" | "section">,
): ScoreReportDomainResult => ({
  label: overrides.id,
  rawContext: "Private student report context",
  ...overrides,
});

const report = (overrides: Partial<ParsedScoreReport> = {}): ParsedScoreReport => ({
  fileName: "Private Student SAT.pdf",
  source: "pdf-text",
  domains: [],
  recommendedFocus: [],
  extractedText: "Private student extracted report text",
  warnings: ["Private warning text"],
  ...overrides,
});

describe("buildScoreReportReview", () => {
  it("uses recommended domains plus Pacing when at least two domains have reliable evidence", () => {
    const review = buildScoreReportReview(report({
      domains: [
        domain({
          id: "Algebra",
          section: "Math",
          proficiency: 3,
          performanceRange: "420-460",
          performanceMidpoint: 440,
          percent: 35,
          questionRange: "13-15",
        }),
        domain({
          id: "Craft and Structure",
          section: "Reading and Writing",
          proficiency: 4,
        }),
      ],
      recommendedFocus: ["Algebra", "Craft and Structure"],
    }), ["Information and Ideas", "Pacing"]);

    expect(review.hasReliableDomainEvidence).toBe(true);
    expect(review.usesRecommendedFocus).toBe(true);
    expect(review.weakDomains).toEqual([
      {
        id: "Algebra",
        label: "Algebra",
        section: "Math",
        metrics: ["Band 3 of 7", "Performance range 420-460", "35%", "13-15 questions"],
      },
      {
        id: "Craft and Structure",
        label: "Craft and Structure",
        section: "Reading & Writing",
        metrics: ["Band 4 of 7"],
      },
    ]);
    expect(review.focusChange).toEqual({
      current: ["Information and Ideas", "Pacing"],
      next: ["Algebra", "Craft and Structure", "Pacing"],
      additions: ["Algebra", "Craft and Structure"],
      removals: ["Information and Ideas"],
      retained: ["Pacing"],
      selectionUnchanged: false,
    });
  });

  it("keeps the current focus when domain evidence is insufficient", () => {
    const review = buildScoreReportReview(report({
      domains: [domain({ id: "Algebra", section: "Math", proficiency: 2 })],
      recommendedFocus: ["Algebra"],
    }), ["Advanced Math", "Pacing"]);

    expect(review.hasReliableDomainEvidence).toBe(false);
    expect(review.usesRecommendedFocus).toBe(false);
    expect(review.focusChange).toEqual({
      current: ["Advanced Math", "Pacing"],
      next: ["Advanced Math", "Pacing"],
      additions: [],
      removals: [],
      retained: ["Advanced Math", "Pacing"],
      selectionUnchanged: true,
    });
  });

  it("keeps the current focus when evidence exists but there are no recommendations", () => {
    const review = buildScoreReportReview(report({
      domains: [
        domain({ id: "Algebra", section: "Math", proficiency: 3 }),
        domain({ id: "Advanced Math", section: "Math", performanceMidpoint: 450 }),
      ],
    }), ["Geometry and Trigonometry"]);

    expect(review.hasReliableDomainEvidence).toBe(true);
    expect(review.usesRecommendedFocus).toBe(false);
    expect(review.weakDomains).toEqual([]);
    expect(review.focusChange.next).toEqual(["Geometry and Trigonometry"]);
    expect(review.focusChange.selectionUnchanged).toBe(true);
  });

  it("omits missing or unsafe optional metrics instead of inventing display values", () => {
    const review = buildScoreReportReview(report({
      domains: [
        domain({
          id: "Algebra",
          section: "Math",
          performanceMidpoint: 450,
          performanceRange: "Student Name 420-460",
          percent: 101,
          questionRange: "unknown",
        }),
        domain({ id: "Advanced Math", section: "Math", proficiency: 4 }),
      ],
      recommendedFocus: ["Algebra"],
    }), ["Pacing"]);

    expect(review.weakDomains).toEqual([{
      id: "Algebra",
      label: "Algebra",
      section: "Math",
      metrics: [],
    }]);
  });

  it("returns only canonical labels and sanitized metric strings", () => {
    const review = buildScoreReportReview(report({
      domains: [
        domain({
          id: "Algebra",
          label: "Private Student Name",
          section: "Math",
          proficiency: 2,
          rawContext: "Private Student Name scored poorly",
        }),
        domain({ id: "Advanced Math", section: "Math", proficiency: 5 }),
      ],
      recommendedFocus: ["Algebra"],
    }), ["Pacing"]);
    const serialized = JSON.stringify(review);

    expect(serialized).not.toContain("Private");
    expect(serialized).not.toContain("fileName");
    expect(serialized).not.toContain("rawContext");
    expect(serialized).not.toContain("extractedText");
    expect(review.weakDomains[0]).toEqual({
      id: "Algebra",
      label: "Algebra",
      section: "Math",
      metrics: ["Band 2 of 7"],
    });
  });
});
