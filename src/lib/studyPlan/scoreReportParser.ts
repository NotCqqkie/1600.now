import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

import {
  type EnglishDomain,
  type MathDomain,
} from "@/data/questionCategories";

export type ScoreReportFocusId = MathDomain | EnglishDomain;
export type ScoreReportSource = "pdf-text" | "image-ocr";

export interface ScoreReportDomainResult {
  id: ScoreReportFocusId;
  label: string;
  section: "Math" | "Reading and Writing";
  proficiency?: number;
  performanceRange?: string;
  performanceMidpoint?: number;
  percent?: number;
  questionRange?: string;
  rawContext: string;
}

export interface ParsedScoreReport {
  fileName: string;
  source: ScoreReportSource;
  totalScore?: number;
  readingWritingScore?: number;
  mathScore?: number;
  testDate?: string;
  domains: ScoreReportDomainResult[];
  recommendedFocus: ScoreReportFocusId[];
  extractedText: string;
  warnings: string[];
}

type OcrWord = {
  text?: string;
  bbox?: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
};

type PositionedTextLine = {
  text: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
};

const domainDefinitions: Array<{
  id: ScoreReportFocusId;
  section: "Math" | "Reading and Writing";
  aliases: string[];
}> = [
  { id: "Information and Ideas", section: "Reading and Writing", aliases: ["Information and Ideas"] },
  { id: "Craft and Structure", section: "Reading and Writing", aliases: ["Craft and Structure"] },
  { id: "Expression of Ideas", section: "Reading and Writing", aliases: ["Expression of Ideas"] },
  { id: "Standard English Conventions", section: "Reading and Writing", aliases: ["Standard English Conventions", "Standard English"] },
  { id: "Algebra", section: "Math", aliases: ["Algebra"] },
  { id: "Advanced Math", section: "Math", aliases: ["Advanced Math"] },
  { id: "Problem-Solving and Data Analysis", section: "Math", aliases: ["Problem-Solving and Data Analysis", "Problem Solving and Data Analysis"] },
  { id: "Geometry and Trigonometry", section: "Math", aliases: ["Geometry and Trigonometry"] },
];

const normalizeText = (value: string) =>
  value
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const normalizeKey = (value: string) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const toLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter(Boolean);

const isRangeEndpoint = (text: string, index: number, length: number) => {
  const before = text.slice(Math.max(0, index - 3), index);
  const after = text.slice(index + length, index + length + 3);
  const afterWithPercentile = text.slice(index + length, index + length + 16);
  if (/-\s*$/.test(before) && /^\s*(?:>\s*)?\d{1,2}(?:st|nd|rd|th)\*/i.test(afterWithPercentile)) return false;
  return /-\s*$/.test(before) || /^\s*-/.test(after);
};

const numbersInRange = (text: string, min: number, max: number) =>
  Array.from(text.matchAll(/\b\d{2,4}\b/g))
    .filter((match) => !isRangeEndpoint(text, match.index ?? 0, match[0].length))
    .map((match) => Number(match[0]))
    .filter((value) => value >= min && value <= max && value % 10 === 0);

const findScoreCandidatesNear = (
  lines: string[],
  labelPattern: RegExp,
  min: number,
  max: number,
) => {
  const candidates: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!labelPattern.test(lines[index])) continue;
    const context = lines.slice(index, index + 5).join(" ");
    candidates.push(...numbersInRange(context, min, max));
  }
  return Array.from(new Set(candidates));
};

const extractScores = (lines: string[]) => {
  const totalCandidates = findScoreCandidatesNear(lines, /total score/i, 400, 1600);
  const readingWritingCandidates = findScoreCandidatesNear(lines, /reading\s*(and|&)\s*writing/i, 200, 800);
  const mathCandidates = findScoreCandidatesNear(lines, /^math\b| math score/i, 200, 800);
  let totalScore = totalCandidates[0];
  let readingWritingScore = readingWritingCandidates[0];
  let mathScore = mathCandidates[0];

  let bestConsistentRank = Infinity;
  totalCandidates.forEach((total, totalRank) => {
    readingWritingCandidates.forEach((readingWriting, readingWritingRank) => {
      mathCandidates.forEach((math, mathRank) => {
        if (readingWriting + math === total) {
          const rank = totalRank + readingWritingRank + mathRank;
          if (rank >= bestConsistentRank) return;
          bestConsistentRank = rank;
          totalScore = total;
          readingWritingScore = readingWriting;
          mathScore = math;
        }
      });
    });
  });

  if (totalScore && readingWritingScore && !mathScore) {
    const inferred = totalScore - readingWritingScore;
    if (inferred >= 200 && inferred <= 800 && inferred % 10 === 0) mathScore = inferred;
  }
  if (totalScore && mathScore && !readingWritingScore) {
    const inferred = totalScore - mathScore;
    if (inferred >= 200 && inferred <= 800 && inferred % 10 === 0) readingWritingScore = inferred;
  }

  return {
    totalScore: totalScore ?? (readingWritingScore && mathScore ? readingWritingScore + mathScore : undefined),
    readingWritingScore,
    mathScore,
  };
};

const findTestDate = (text: string) => {
  const dateMatch =
    text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/i) ??
    text.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/);
  return dateMatch?.[0];
};

const findDomainContext = (lines: string[], aliases: string[]) => {
  const normalizedAliases = aliases.map(normalizeKey);
  for (let index = 0; index < lines.length; index += 1) {
    const key = normalizeKey(lines[index]);
    if (!normalizedAliases.some((alias) => key.includes(alias))) continue;
    return lines.slice(index, index + 8).join(" ");
  }
  return "";
};

const extractQuestionRange = (context: string) => {
  const range = context.match(/\b(\d{1,2})\s*-\s*(\d{1,2})\s*(?:questions?|qs?)\b/i);
  if (range) return `${range[1]}-${range[2]}`;
  const count = context.match(/\b(\d{1,2})\s*(?:questions?|qs?)\b/i);
  return count?.[1];
};

const extractPercent = (context: string) => {
  const match = context.match(/\b(\d{1,2})\s*%/);
  return match ? Number(match[1]) : undefined;
};

const extractProficiency = (context: string) => {
  const direct = context.match(/\b([1-7])\s*(?:\/|of)\s*7\b/i);
  if (direct) return Number(direct[1]);
  const bars = context.match(/\b([1-7])\s*bars?\b/i);
  if (bars) return Number(bars[1]);
  return undefined;
};

const extractPerformanceRange = (context: string) => {
  const match = context.match(/\bPerformance\s*:?\s*(\d{3})\s*-\s*(\d{3})\b/i);
  if (!match) return undefined;
  const low = Number(match[1]);
  const high = Number(match[2]);
  if (low < 200 || high > 800 || low > high) return undefined;
  return {
    range: `${low}-${high}`,
    midpoint: Math.round((low + high) / 2),
  };
};

const proficiencyFromPerformance = (midpoint?: number) => {
  if (!midpoint) return undefined;
  if (midpoint < 360) return 1;
  if (midpoint < 450) return 2;
  if (midpoint < 540) return 3;
  if (midpoint < 610) return 4;
  if (midpoint < 680) return 5;
  if (midpoint < 740) return 6;
  return 7;
};

const parseDomainsFromText = (
  lines: string[],
  visualBars: Partial<Record<ScoreReportFocusId, number>>,
) =>
  domainDefinitions.map((domain) => {
    const rawContext = findDomainContext(lines, domain.aliases);
    const performance = extractPerformanceRange(rawContext);
    return {
      id: domain.id,
      label: domain.id,
      section: domain.section,
      proficiency: visualBars[domain.id] ?? extractProficiency(rawContext) ?? proficiencyFromPerformance(performance?.midpoint),
      performanceRange: performance?.range,
      performanceMidpoint: performance?.midpoint,
      percent: extractPercent(rawContext),
      questionRange: extractQuestionRange(rawContext),
      rawContext,
    };
  });

const hasDomainMetric = (domain: ScoreReportDomainResult) =>
  typeof domain.proficiency === "number" || typeof domain.performanceMidpoint === "number";

const domainMetricCount = (domains: ScoreReportDomainResult[]) =>
  domains.filter(hasDomainMetric).length;

const focusScore = (domain: ScoreReportDomainResult) => {
  if (typeof domain.proficiency === "number") return domain.proficiency;
  if (typeof domain.performanceMidpoint === "number") return domain.performanceMidpoint / 100;
  return 8;
};

export const parseScoreReportText = (
  text: string,
  fileName: string,
  source: ScoreReportSource,
  visualBars: Partial<Record<ScoreReportFocusId, number>> = {},
): ParsedScoreReport => {
  const normalized = text.replace(/\u00a0/g, " ");
  const lines = toLines(normalized);
  const scores = extractScores(lines);
  const domains = parseDomainsFromText(lines, visualBars);
  const recommendedFocus = domains
    .filter(hasDomainMetric)
    .sort((a, b) => focusScore(a) - focusScore(b))
    .slice(0, 5)
    .map((domain) => domain.id);
  const warnings: string[] = [];

  if (!scores.totalScore) warnings.push("Could not confidently find the total score.");
  if (!scores.readingWritingScore) warnings.push("Could not confidently find the Reading and Writing score.");
  if (!scores.mathScore) warnings.push("Could not confidently find the Math score.");
  if (scores.totalScore && scores.readingWritingScore && scores.mathScore && scores.totalScore !== scores.readingWritingScore + scores.mathScore) {
    warnings.push("The total score did not match the section scores.");
  }
  if (domainMetricCount(domains) < 4) warnings.push("Could not confidently read enough Knowledge and Skills proficiency bars or performance ranges.");

  return {
    fileName,
    source,
    ...scores,
    testDate: findTestDate(normalized),
    domains,
    recommendedFocus,
    extractedText: normalized,
    warnings,
  };
};

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = url;
  });

const groupOcrLines = (words: OcrWord[]): PositionedTextLine[] => {
  const sorted = words
    .filter((word) => word.text && word.bbox)
    .sort((a, b) => (a.bbox!.y0 + a.bbox!.y1) / 2 - (b.bbox!.y0 + b.bbox!.y1) / 2);
  const lines: PositionedTextLine[] = [];

  sorted.forEach((word) => {
    const box = word.bbox!;
    const centerY = (box.y0 + box.y1) / 2;
    const line = lines.find((candidate) => centerY >= candidate.y0 - 8 && centerY <= candidate.y1 + 8);
    if (!line) {
      lines.push({ text: word.text ?? "", x0: box.x0, x1: box.x1, y0: box.y0, y1: box.y1 });
      return;
    }
    line.text = `${line.text} ${word.text ?? ""}`;
    line.x0 = Math.min(line.x0, box.x0);
    line.x1 = Math.max(line.x1, box.x1);
    line.y0 = Math.min(line.y0, box.y0);
    line.y1 = Math.max(line.y1, box.y1);
  });

  return lines;
};

const isBarPixel = (red: number, green: number, blue: number) => {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  return max > 80 && min < 210 && max - min > 28 && (blue > red + 20 || green > red + 20);
};

const countColoredClusters = (
  data: Uint8ClampedArray,
  width: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
) => {
  const columnHits: boolean[] = [];
  for (let x = x0; x < x1; x += 1) {
    let hits = 0;
    for (let y = y0; y < y1; y += 1) {
      const offset = (y * width + x) * 4;
      if (isBarPixel(data[offset], data[offset + 1], data[offset + 2])) hits += 1;
    }
    columnHits.push(hits >= 2);
  }

  let clusters = 0;
  let run = 0;
  columnHits.forEach((hit) => {
    if (hit) {
      run += 1;
      return;
    }
    if (run >= 5) clusters += 1;
    run = 0;
  });
  if (run >= 5) clusters += 1;
  return Math.min(7, clusters);
};

const estimateVisualBarsFromCanvas = (
  canvas: HTMLCanvasElement,
  textLines: PositionedTextLine[],
): Partial<Record<ScoreReportFocusId, number>> => {
  const context = canvas.getContext("2d");
  if (!context) return {};
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

  return domainDefinitions.reduce((acc, domain) => {
    const aliases = domain.aliases.map(normalizeKey);
    const line = textLines.find((candidate) => {
      const text = normalizeKey(candidate.text);
      return aliases.some((alias) => text.includes(alias));
    });
    if (!line) return acc;
    const lineHeight = Math.max(10, line.y1 - line.y0);
    const y0 = Math.max(0, Math.round(line.y0 - Math.max(4, lineHeight * 0.3)));
    const y1 = Math.min(canvas.height, Math.round(line.y1 + Math.max(10, lineHeight * 0.8)));
    const x0 = Math.min(canvas.width - 1, Math.round(line.x1 + 10));
    const x1 = Math.min(canvas.width, Math.round(canvas.width - 20));
    const clusters = countColoredClusters(pixels, canvas.width, x0, x1, y0, y1);
    if (clusters > 0) acc[domain.id] = clusters;
    return acc;
  }, {} as Partial<Record<ScoreReportFocusId, number>>);
};

const estimateVisualBars = async (
  file: File,
  words: OcrWord[],
): Promise<Partial<Record<ScoreReportFocusId, number>>> => {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) return {};
    context.drawImage(image, 0, 0);
    return estimateVisualBarsFromCanvas(canvas, groupOcrLines(words));
  } finally {
    URL.revokeObjectURL(url);
  }
};

const mergeVisualBars = (
  current: Partial<Record<ScoreReportFocusId, number>>,
  next: Partial<Record<ScoreReportFocusId, number>>,
) => {
  domainDefinitions.forEach((domain) => {
    const value = next[domain.id];
    if (typeof value === "number") current[domain.id] = value;
  });
};

const groupPdfTextLines = (
  items: unknown[],
  transform: (matrixA: number[], matrixB: number[]) => number[],
  viewportTransform: number[],
  viewportScale: number,
): PositionedTextLine[] => {
  const runs = items
    .map((item) => {
      if (!item || typeof item !== "object" || !("str" in item) || !("transform" in item)) return null;
      const typed = item as { str?: string; transform?: number[]; width?: number; height?: number };
      if (!typed.str || !typed.transform) return null;
      const matrix = transform(viewportTransform, typed.transform);
      const height = Math.max(8, Math.abs(matrix[3]) || (typed.height ?? 8) * viewportScale);
      const width = Math.max(typed.str.length * 5, (typed.width ?? typed.str.length * 5) * viewportScale);
      return {
        text: typed.str,
        x0: matrix[4],
        x1: matrix[4] + width,
        y0: matrix[5] - height,
        y1: matrix[5] + 4,
      };
    })
    .filter((run): run is PositionedTextLine => Boolean(run))
    .sort((a, b) => ((a.y0 + a.y1) / 2 === (b.y0 + b.y1) / 2 ? a.x0 - b.x0 : (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2));

  const lines: PositionedTextLine[] = [];
  runs.forEach((run) => {
    const centerY = (run.y0 + run.y1) / 2;
    const line = lines.find((candidate) => centerY >= candidate.y0 - 8 && centerY <= candidate.y1 + 8);
    if (!line) {
      lines.push({ ...run });
      return;
    }
    line.text = `${line.text} ${run.text}`;
    line.x0 = Math.min(line.x0, run.x0);
    line.x1 = Math.max(line.x1, run.x1);
    line.y0 = Math.min(line.y0, run.y0);
    line.y1 = Math.max(line.y1, run.y1);
  });
  return lines;
};

const canvasToPngFile = (canvas: HTMLCanvasElement, fileName: string) =>
  new Promise<File | null>((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob ? new File([blob], fileName, { type: "image/png" }) : null);
    }, "image/png");
  });

const extractPdfReport = async (file: File, forceOcr = false) => {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  const visualBars: Partial<Record<ScoreReportFocusId, number>> = {};

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const viewport = page.getViewport({ scale: 2 });
      const textLines = groupPdfTextLines(content.items, pdfjs.Util.transform, viewport.transform, viewport.scale);
      const pageText = textLines.map((line) => line.text).join("\n");
      pages.push(pageText);

      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) continue;
      await page.render({ canvas, viewport }).promise;

      mergeVisualBars(visualBars, estimateVisualBarsFromCanvas(canvas, textLines));

      if (forceOcr || pageText.trim().length < 80) {
        const imageFile = await canvasToPngFile(canvas, `${file.name}-page-${pageNumber}.png`);
        if (imageFile) {
          const imageReport = await extractImageReport(imageFile);
          pages.push(imageReport.text);
          mergeVisualBars(visualBars, imageReport.visualBars);
        }
      }
    }
  } finally {
    await pdf.destroy();
  }

  return {
    text: pages.join("\n"),
    visualBars,
  };
};

const needsOcrFallback = (report: ParsedScoreReport) =>
  !report.totalScore ||
  !report.readingWritingScore ||
  !report.mathScore ||
  (report.totalScore !== undefined &&
    report.readingWritingScore !== undefined &&
    report.mathScore !== undefined &&
    report.totalScore !== report.readingWritingScore + report.mathScore) ||
  domainMetricCount(report.domains) < 4;

const extractImageReport = async (file: File) => {
  const { createWorker } = await import("tesseract.js");
  // Self-host the executable worker, wasm core, and language data (all copied
  // into public/tesseract) so nothing — code or data — is fetched from a
  // third-party CDN at runtime.
  const worker = await createWorker("eng", undefined, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/core",
    langPath: "/tesseract/lang",
    gzip: true,
  });
  try {
    const result = await worker.recognize(file);
    const data = result.data as { text?: string; words?: OcrWord[] };
    const words = data.words ?? [];
    return {
      text: data.text ?? "",
      visualBars: await estimateVisualBars(file, words),
    };
  } finally {
    await worker.terminate();
  }
};

export const parseScoreReportFile = async (file: File): Promise<ParsedScoreReport> => {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const { text, visualBars } = await extractPdfReport(file);
    const parsed = parseScoreReportText(text, file.name, "pdf-text", visualBars);
    if (!needsOcrFallback(parsed)) return parsed;

    const fallback = await extractPdfReport(file, true);
    return parseScoreReportText(
      `${text}\n${fallback.text}`,
      file.name,
      "pdf-text",
      { ...visualBars, ...fallback.visualBars },
    );
  }

  if (file.type.startsWith("image/")) {
    const { text, visualBars } = await extractImageReport(file);
    return parseScoreReportText(text, file.name, "image-ocr", visualBars);
  }

  throw new Error("Upload a College Board score report PDF or image.");
};
