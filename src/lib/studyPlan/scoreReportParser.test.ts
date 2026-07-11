import { describe, expect, it } from "vitest";

import {
  SCORE_REPORT_UPLOAD_LIMITS,
  parseScoreReportFile,
  parseScoreReportText,
  readScoreReportImageDimensions,
  scoreReportPdfRenderScale,
  validateScoreReportFile,
  validateScoreReportImageDimensions,
  validateScoreReportPageCount,
} from "@/lib/studyPlan/scoreReportParser";

const cleanReport = [
  "SAT Score Report",
  "Total Score 1280",
  "Reading and Writing 640",
  "Math 640",
  "Information and Ideas Performance: 610-670",
  "Craft and Structure 4 of 7",
  "Expression of Ideas 5 bars",
  "Standard English Conventions 6 of 7",
  "Algebra Performance: 470-540",
  "Advanced Math 3 of 7",
  "Problem-Solving and Data Analysis 2 of 7",
  "Geometry and Trigonometry Performance: 370-410",
].join("\n");

const domainIds = [
  "Information and Ideas",
  "Craft and Structure",
  "Expression of Ideas",
  "Standard English Conventions",
  "Algebra",
  "Advanced Math",
  "Problem-Solving and Data Analysis",
  "Geometry and Trigonometry",
] as const;

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

  it("keeps valid scores when labels and values are stacked", () => {
    const report = parseScoreReportText([
      "SAT Score Report",
      "Total Score",
      "1230",
      "Reading and Writing",
      "630",
      "Math",
      "600",
    ].join("\n"), "report.pdf", "pdf-text");

    expect(report.totalScore).toBe(1230);
    expect(report.readingWritingScore).toBe(630);
    expect(report.mathScore).toBe(600);
  });

  it("does not borrow an adjacent Math score when Reading and Writing is missing", () => {
    const report = parseScoreReportText([
      "SAT Score Report",
      "Reading and Writing",
      "Score unavailable",
      "Math",
      "600",
    ].join("\n"), "report.pdf", "pdf-text");

    expect(report.readingWritingScore).toBeUndefined();
    expect(report.mathScore).toBe(600);
    expect(report.totalScore).toBeUndefined();
  });

  it.each([
    "Latest SAT Math",
    "Latest SAT Math Section",
  ])("treats the prefixed %s heading as a hard score boundary", (mathHeading) => {
    const report = parseScoreReportText([
      "SAT Score Report",
      "Reading and Writing",
      "Score unavailable",
      mathHeading,
      "600",
    ].join("\n"), "report.pdf", "pdf-text");

    expect(report.readingWritingScore).toBeUndefined();
    expect(report.mathScore).toBe(600);
    expect(report.totalScore).toBeUndefined();
  });

  it("isolates adjacent OCR-style section score headings", () => {
    const report = parseScoreReportText([
      "SAT   Score   Report",
      "TOTAL SCORE :",
      "1210",
      "READING & WRITING SECTION SCORE :",
      "610",
      "MATH SECTION SCORE :",
      "600",
    ].join("\n"), "report.png", "image-ocr");

    expect(report.totalScore).toBe(1210);
    expect(report.readingWritingScore).toBe(610);
    expect(report.mathScore).toBe(600);
  });

  it("reads explicit proficiency and official performance bands per domain", () => {
    const report = parseScoreReportText(cleanReport, "report.pdf", "pdf-text");

    expect(domainById(report, "Craft and Structure").proficiency).toBe(4);
    expect(domainById(report, "Standard English Conventions").proficiency).toBe(6);
    expect(domainById(report, "Advanced Math").proficiency).toBe(3);

    const infoAndIdeas = domainById(report, "Information and Ideas");
    expect(infoAndIdeas.performanceRange).toBe("610-670");
    expect(infoAndIdeas.performanceMidpoint).toBe(640);
    expect(infoAndIdeas.proficiency).toBe(6);
  });

  it.each([
    ["Reading and Writing", "Information and Ideas", "200-360", 1],
    ["Reading and Writing", "Information and Ideas", "370-410", 2],
    ["Reading and Writing", "Information and Ideas", "420-480", 3],
    ["Reading and Writing", "Information and Ideas", "490-540", 4],
    ["Reading and Writing", "Information and Ideas", "550-600", 5],
    ["Reading and Writing", "Information and Ideas", "610-670", 6],
    ["Reading and Writing", "Information and Ideas", "680-800", 7],
    ["Math", "Algebra", "200-360", 1],
    ["Math", "Algebra", "370-410", 2],
    ["Math", "Algebra", "420-460", 3],
    ["Math", "Algebra", "470-540", 4],
    ["Math", "Algebra", "550-600", 5],
    ["Math", "Algebra", "610-670", 6],
    ["Math", "Algebra", "680-800", 7],
  ])("maps the official %s %s band %s to proficiency %i", (_, domain, range, proficiency) => {
    const report = parseScoreReportText(
      `SAT Score Report\n${domain} Performance: ${range}`,
      "report.pdf",
      "pdf-text",
    );

    expect(domainById(report, domain as string).proficiency).toBe(proficiency);
  });

  it("does not turn an invented midpoint range into a proficiency band", () => {
    const report = parseScoreReportText(
      "SAT Score Report\nInformation and Ideas Performance: 600-650",
      "report.pdf",
      "pdf-text",
    );

    expect(domainById(report, "Information and Ideas").proficiency).toBeUndefined();
    expect(domainById(report, "Information and Ideas").performanceRange).toBeUndefined();
  });

  it.each(domainIds)("isolates metrics for %s from every other domain", (domainId) => {
    const report = parseScoreReportText(
      `SAT Score Report\n${domainId} 3 of 7`,
      "report.pdf",
      "pdf-text",
    );

    domainIds.forEach((candidate) => {
      expect(domainById(report, candidate).proficiency).toBe(candidate === domainId ? 3 : undefined);
    });
  });

  it("recognizes an OCR-wrapped domain heading without crossing into the next domain", () => {
    const report = parseScoreReportText([
      "SAT Score Report",
      "Problem-Solving and",
      "Data Analysis",
      "2 of 7",
      "Geometry and Trigonometry 6 of 7",
    ].join("\n"), "report.pdf", "pdf-text");

    expect(domainById(report, "Problem-Solving and Data Analysis").proficiency).toBe(2);
    expect(domainById(report, "Geometry and Trigonometry").proficiency).toBe(6);
  });

  it("ends a domain block at the next domain heading", () => {
    const report = parseScoreReportText([
      "SAT Score Report",
      "Information and Ideas",
      "No performance band available",
      "Craft and Structure 2 of 7 42% 12-14 questions",
    ].join("\n"), "report.pdf", "pdf-text");

    const missing = domainById(report, "Information and Ideas");
    expect(missing.proficiency).toBeUndefined();
    expect(missing.percent).toBeUndefined();
    expect(missing.questionRange).toBeUndefined();
    expect(domainById(report, "Craft and Structure").proficiency).toBe(2);
  });

  it("ends a Reading and Writing domain block at the Math section heading", () => {
    const report = parseScoreReportText([
      "SAT Score Report",
      "Standard English Conventions",
      "Math Knowledge and Skills",
      "Algebra 1 of 7",
    ].join("\n"), "report.pdf", "pdf-text");

    expect(domainById(report, "Standard English Conventions").proficiency).toBeUndefined();
    expect(domainById(report, "Algebra").proficiency).toBe(1);
  });

  it.each([
    "Latest SAT Math",
    "Latest SAT Math Section",
  ])("treats the prefixed %s heading as a hard domain boundary", (mathHeading) => {
    const report = parseScoreReportText([
      "SAT Score Report",
      "Standard English Conventions",
      "No performance band available",
      mathHeading,
      "3 of 7",
      "Algebra 6 of 7",
    ].join("\n"), "report.pdf", "pdf-text");

    expect(domainById(report, "Standard English Conventions").proficiency).toBeUndefined();
    expect(domainById(report, "Algebra").proficiency).toBe(6);
  });

  it("recommends the weakest domains first", () => {
    const report = parseScoreReportText(cleanReport, "report.pdf", "pdf-text");

    expect(report.recommendedFocus[0]).toBe("Problem-Solving and Data Analysis");
  });

  it("does not label strong band 6 or 7 domains as weak priorities", () => {
    const report = parseScoreReportText([
      "SAT Score Report",
      "Information and Ideas 6 of 7",
      "Craft and Structure 7 of 7",
      "Algebra 6 of 7",
      "Advanced Math 7 of 7",
    ].join("\n"), "report.pdf", "pdf-text");

    expect(report.recommendedFocus).toEqual([]);
  });

  it("prefers explicit visual bars over parsed text proficiency", () => {
    const report = parseScoreReportText(cleanReport, "report.pdf", "pdf-text", {
      "Craft and Structure": 1,
    });

    expect(domainById(report, "Craft and Structure").proficiency).toBe(1);
  });

  it("warns instead of inventing data for malformed text", () => {
    const report = parseScoreReportText("No scores here at all.", "empty.pdf", "pdf-text");

    expect(report.totalScore).toBeUndefined();
    expect(report.recommendedFocus).toEqual([]);
    expect(report.warnings).toContain("Could not confidently find the total score.");
    expect(report.warnings).toContain("Could not confidently read enough Knowledge and Skills proficiency bars or performance ranges.");
  });

  it.each([
    "PSAT/NMSQT Score Report",
    "PSAT 10 Score Report",
    "PSAT 8/9 Score Report",
    "Preliminary SAT Score Report",
  ])("rejects the non-SAT report type: %s", (heading) => {
    expect(() => parseScoreReportText(`${heading}\nTotal Score 1200`, "report.pdf", "pdf-text"))
      .toThrow("This planner supports SAT score reports, not PSAT reports.");
  });

  it("rejects a PSAT header even when OCR retry text precedes it", () => {
    const retryNoise = Array.from({ length: 20 }, (_, index) => `Score crop retry ${index}`).join("\n");
    expect(() => parseScoreReportText(
      `${retryNoise}\nPSAT/NMSQT Score Report\nTotal Score 1200`,
      "report.png",
      "image-ocr",
    )).toThrow("This planner supports SAT score reports, not PSAT reports.");
  });

  it("still parses a report with OCR-style noise", () => {
    const noisyReport = [
      "SAT   Score  Report",
      "T0tal Score 1280",
      "Total  Score   1280",
      "Read1ng and Writing 640",
      "Reading  and  Writing   640",
      "Math    640",
      "Informat1on and Ideas Performance : 610 - 670",
      "Information and Ideas",
      "Craft  and  Structure   4  of  7",
      "Expression of Ideas 5 bars",
      "Standard English Conventions 6 of 7",
      "Algebra Performance: 470-540",
      "Advanced Math 3 of 7",
      "Problem Solving and Data Analysis 2 of 7",
      "Geometry and Trigonometry Performance: 370-410",
    ].join("\n");

    const report = parseScoreReportText(noisyReport, "noisy.png", "image-ocr");

    expect(report.totalScore).toBe(1280);
    expect(report.readingWritingScore).toBe(640);
    expect(report.mathScore).toBe(640);
    expect(domainById(report, "Problem-Solving and Data Analysis").proficiency).toBe(2);
  });
});

describe("score report upload validation", () => {
  it.each([
    ["report.pdf", "application/pdf", "pdf"],
    ["report.jpg", "image/jpeg", "image"],
    ["report.jpeg", "", "image"],
    ["report.png", "image/png", "image"],
    ["report.pdf", "application/octet-stream", "pdf"],
  ] as const)("accepts %s with MIME type %s", (name, type, kind) => {
    expect(validateScoreReportFile(new File(["x"], name, { type }))).toBe(kind);
  });

  it.each([
    ["report.gif", "image/gif"],
    ["report.webp", "image/webp"],
    ["report.txt", "text/plain"],
    ["fake.pdf", "text/plain"],
  ] as const)("rejects unsupported file %s", (name, type) => {
    expect(() => validateScoreReportFile(new File(["x"], name, { type })))
      .toThrow("Upload a PDF, JPEG, or PNG College Board score report.");
  });

  it("rejects empty and oversized files", () => {
    expect(() => validateScoreReportFile(new File([], "empty.pdf", { type: "application/pdf" })))
      .toThrow("The score report file is empty.");
    expect(() => validateScoreReportFile({
      name: "large.pdf",
      type: "application/pdf",
      size: SCORE_REPORT_UPLOAD_LIMITS.maxBytes + 1,
    } as File)).toThrow("Score report files must be 15 MB or smaller.");
  });

  it("enforces the PDF page limit", () => {
    expect(() => validateScoreReportPageCount(0)).toThrow("The PDF does not contain any readable pages.");
    expect(() => validateScoreReportPageCount(10)).not.toThrow();
    expect(() => validateScoreReportPageCount(11)).toThrow("Score report PDFs must contain 10 pages or fewer.");
  });

  it("enforces the image pixel limit", () => {
    expect(() => validateScoreReportImageDimensions(5_000, 4_000)).not.toThrow();
    expect(() => validateScoreReportImageDimensions(5_001, 4_000))
      .toThrow("Score report images must be 20 megapixels or smaller.");
    expect(() => validateScoreReportImageDimensions(0, 4_000))
      .toThrow("The score report image has invalid dimensions.");
  });

  it("reads PNG dimensions before browser image decoding", async () => {
    const bytes = new Uint8Array(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    bytes.set([0x49, 0x48, 0x44, 0x52], 12);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, 5001);
    view.setUint32(20, 4000);

    const dimensions = await readScoreReportImageDimensions(
      new File([bytes], "report.png", { type: "image/png" }),
    );

    expect(dimensions).toEqual({ width: 5001, height: 4000 });
    expect(() => validateScoreReportImageDimensions(dimensions.width, dimensions.height))
      .toThrow("Score report images must be 20 megapixels or smaller.");
  });

  it("reads JPEG dimensions before browser image decoding", async () => {
    const bytes = new Uint8Array([
      0xff, 0xd8,
      0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
      0xff, 0xc0, 0x00, 0x0b, 0x08, 0x0f, 0xa0, 0x13, 0x88, 0x01, 0x01, 0x11, 0x00,
      0xff, 0xd9,
    ]);

    await expect(readScoreReportImageDimensions(
      new File([bytes], "report.jpg", { type: "image/jpeg" }),
    )).resolves.toEqual({ width: 5000, height: 4000 });
  });

  it("caps oversized PDF page rendering at the OCR pixel budget", () => {
    const scale = scoreReportPdfRenderScale(20_000, 10_000);
    expect(20_000 * scale * 10_000 * scale).toBeLessThanOrEqual(SCORE_REPORT_UPLOAD_LIMITS.ocrTargetPixels + 1);
    expect(scoreReportPdfRenderScale(612, 792)).toBe(2);
    expect(() => scoreReportPdfRenderScale(Number.POSITIVE_INFINITY, 792)).toThrow("invalid dimensions");
  });

  it("honors a cancellation signal before file processing begins", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(parseScoreReportFile(
      new File(["x"], "report.pdf", { type: "application/pdf" }),
      { signal: controller.signal },
    )).rejects.toMatchObject({ name: "AbortError" });
  });
});
