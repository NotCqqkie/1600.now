import { describe, expect, it } from "vitest";

import { parseScoreReportText } from "@/lib/studyPlan/scoreReportParser";

const cleanReport = [
  "SAT Score Report",
  "Total Score 1280",
  "Reading and Writing 640",
  "Math 640",
  "Information and Ideas Performance: 600-650",
  "Craft and Structure 4 of 7",
  "Expression of Ideas 5 bars",
  "Standard English Conventions 6 of 7",
  "Algebra Performance: 500-550",
  "Advanced Math 3 of 7",
  "Problem-Solving and Data Analysis 2 of 7",
  "Geometry and Trigonometry Performance: 450-500",
].join("\n");

const domainById = (
  report: ReturnType<typeof parseScoreReportText>,
  id: string,
) => report.domains.find((domain) => domain.id === id)!;

describe("parseScoreReportText", () => {
  it("extracts consistent section and total scores", () => {
    const report = parseScoreReportText(cleanReport, "report.pdf", "pdf-text");

    expect(report.totalScore).toBe(1280);
    expect(report.readingWritingScore).toBe(640);
    expect(report.mathScore).toBe(640);
    expect(report.fileName).toBe("report.pdf");
    expect(report.source).toBe("pdf-text");
  });

  it("reads proficiency and performance metrics per domain", () => {
    const report = parseScoreReportText(cleanReport, "report.pdf", "pdf-text");

    expect(domainById(report, "Craft and Structure").proficiency).toBe(4);
    expect(domainById(report, "Standard English Conventions").proficiency).toBe(6);
    expect(domainById(report, "Advanced Math").proficiency).toBe(3);

    const infoAndIdeas = domainById(report, "Information and Ideas");
    expect(infoAndIdeas.performanceRange).toBe("600-650");
    expect(infoAndIdeas.performanceMidpoint).toBe(625);
  });

  it("recommends the weakest domains first", () => {
    const report = parseScoreReportText(cleanReport, "report.pdf", "pdf-text");

    // Problem-Solving (proficiency 2) is the weakest measured domain.
    expect(report.recommendedFocus[0]).toBe("Problem-Solving and Data Analysis");
  });

  it("prefers explicit visual bars over parsed text proficiency", () => {
    const report = parseScoreReportText(cleanReport, "report.pdf", "pdf-text", {
      "Craft and Structure": 1,
    });

    expect(domainById(report, "Craft and Structure").proficiency).toBe(1);
  });

  it("warns when scores cannot be found", () => {
    const report = parseScoreReportText("No scores here at all.", "empty.pdf", "pdf-text");

    expect(report.totalScore).toBeUndefined();
    expect(report.warnings).toContain("Could not confidently find the total score.");
  });

  it("still parses a report with OCR-style noise", () => {
    const noisyReport = [
      "SAT   Score  Report",
      "T0tal Score 1280",
      "Total  Score   1280",
      "Read1ng and Writing 640",
      "Reading  and  Writing   640",
      "Math    640",
      "Informat1on and Ideas Performance : 600 - 650",
      "Information and Ideas",
      "Craft  and  Structure   4  of  7",
      "Expression of Ideas 5 bars",
      "Standard English Conventions 6 of 7",
      "Algebra Performance: 500-550",
      "Advanced Math 3 of 7",
      "Problem Solving and Data Analysis 2 of 7",
      "Geometry and Trigonometry Performance: 450-500",
    ].join("\n");

    const report = parseScoreReportText(noisyReport, "noisy.png", "image-ocr");

    expect(report.totalScore).toBe(1280);
    expect(report.readingWritingScore).toBe(640);
    expect(report.mathScore).toBe(640);
    // "Problem Solving" (no hyphen) still matches via its alias.
    expect(domainById(report, "Problem-Solving and Data Analysis").proficiency).toBe(2);
  });
});
