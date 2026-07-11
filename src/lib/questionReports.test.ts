import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { getPracticeSets } from "@/data/modulePracticeBank";

import {
  buildQuestionReportCountMap,
  isValidQuestionReportId,
  normalizeQuestionReport,
} from "@/lib/questionReports";

describe("question report writes", () => {
  it("accepts only known stable question IDs", () => {
    expect(isValidQuestionReportId("hard-1")).toBe(true);
    expect(isValidQuestionReportId("hard-100")).toBe(true);
    expect(isValidQuestionReportId("bank-past-math-12ab34cd")).toBe(true);
    expect(isValidQuestionReportId("hard-101")).toBe(false);
    expect(isValidQuestionReportId("bank-past-math-../../admin")).toBe(false);
    expect(isValidQuestionReportId("bank-custom-math-12ab34cd")).toBe(false);
  });

  it("builds a true nested counter map and deduplicates reasons", () => {
    const counts = buildQuestionReportCountMap(
      ["typo", "incorrectAnswer", "typo"],
      true,
      "increment",
    );

    expect(counts).toEqual({
      typo: "increment",
      incorrectAnswer: "increment",
      other: "increment",
    });
    expect(Object.keys(counts).some((key) => key.includes("."))).toBe(false);
  });

  it("accepts every canonical ID used by bank, module, and practice routes", () => {
    const routeIndexDirectory = new URL("./generated/bank-route-index/", import.meta.url);
    const routeIds = readdirSync(routeIndexDirectory)
      .filter((name) => name.endsWith(".generated.ts"))
      .flatMap((name) => {
        const source = readFileSync(new URL(name, routeIndexDirectory), "utf8");
        return [...source.matchAll(/"(bank-(?:past|unofficial)-(?:math|reading)-[^"]+)"/g)]
          .map((match) => match[1]);
      });
    const practiceIds = getPracticeSets().flatMap((set) =>
      set.modules.flatMap((module) =>
        module.questions.map((question) => question.bankQuestion.stableId),
      ),
    );
    const hardIds = Array.from({ length: 100 }, (_, index) => `hard-${index + 1}`);

    expect(routeIds.length).toBeGreaterThan(10_000);
    expect(practiceIds).toHaveLength(3_528);
    expect([...routeIds, ...practiceIds, ...hardIds].filter(
      (questionId) => !isValidQuestionReportId(questionId),
    )).toEqual([]);
  });
});

describe("question report reads", () => {
  it("normalizes malformed legacy data without trusting document fields", () => {
    const questionId = "bank-unofficial-reading-deadbeef";
    const report = normalizeQuestionReport(
      {
        questionId: "../../unexpected",
        counts: { typo: 2, corrupted: -1, unknown: 99 },
        "counts.typo": 3,
        totalReports: "5",
        lastReportedAt: { seconds: 123 },
        otherComments: [
          null,
          { text: "  valid comment  ", timestamp: 10, userId: "user-1" },
          { text: "x".repeat(600), timestamp: 11, userId: "x".repeat(129) },
          { text: "missing timestamp" },
        ],
      },
      questionId,
    );

    expect(report.questionId).toBe(questionId);
    expect(report.counts).toEqual({ typo: 5 });
    expect(report.totalReports).toBe(0);
    expect(report.lastReportedAt).toEqual({ seconds: 123 });
    expect(report.otherComments).toEqual([
      { text: "valid comment", timestamp: 10, userId: "user-1" },
      { text: "x".repeat(500), timestamp: 11 },
    ]);
  });
});
