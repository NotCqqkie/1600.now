import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

import {
  type EnglishDomain,
  type MathDomain,
} from "@/data/questionCategories";

export type ScoreReportFocusId = MathDomain | EnglishDomain;
export type ScoreReportSource = "pdf-text" | "image-ocr";
export type ScoreReportFileKind = "pdf" | "image";
export type ScoreReportParseStage = "validating" | "reading-pdf" | "rendering-page" | "ocr" | "complete";

export interface ScoreReportParseProgress {
  stage: ScoreReportParseStage;
  progress: number;
  page?: number;
  pageCount?: number;
}

export interface ParseScoreReportFileOptions {
  signal?: AbortSignal;
  onProgress?: (progress: ScoreReportParseProgress) => void;
}

export const SCORE_REPORT_UPLOAD_LIMITS = {
  maxBytes: 15 * 1024 * 1024,
  maxPdfPages: 10,
  maxImagePixels: 20_000_000,
  ocrTargetPixels: 12_000_000,
} as const;

export const scoreReportPdfRenderScale = (width: number, height: number) => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("The PDF page has invalid dimensions.");
  }
  const basePixels = width * height;
  if (!Number.isFinite(basePixels) || basePixels <= 0) {
    throw new Error("The PDF page dimensions are too large to process safely.");
  }
  return Math.min(2, Math.sqrt(SCORE_REPORT_UPLOAD_LIMITS.ocrTargetPixels / basePixels));
};

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

const performanceBands: Record<ScoreReportDomainResult["section"], ReadonlyArray<readonly [number, number]>> = {
  "Reading and Writing": [
    [200, 360],
    [370, 410],
    [420, 480],
    [490, 540],
    [550, 600],
    [610, 670],
    [680, 800],
  ],
  Math: [
    [200, 360],
    [370, 410],
    [420, 460],
    [470, 540],
    [550, 600],
    [610, 670],
    [680, 800],
  ],
};

const psatReportPattern = /\b(?:PSAT\s*\/\s*NMSQT|PSAT\s*10|PSAT\s*8\s*\/\s*9|PSAT\s+Score\s+Report|Preliminary\s+SAT\s+Score\s+Report)\b/i;

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

const isSectionHeading = (line: string) => {
  const key = normalizeKey(line);
  return /^(?:latest sat )?(?:reading (?:and )?writing|math)(?: section)?(?: score| knowledge and skills)?(?: \d{3})?$/.test(key) ||
    key === "knowledge and skills";
};

const isScoreOrSectionHeading = (line: string) =>
  /\btotal\s+score\b/i.test(line) ||
  isSectionHeading(line) ||
  /\breading\s*(?:and|&)\s*writing\b/i.test(line) ||
  /^math\b|\bmath\s+(?:section\s+)?score\b/i.test(line);

const findScoreCandidatesNear = (
  lines: string[],
  labelPattern: RegExp,
  min: number,
  max: number,
) => {
  const candidates: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!labelPattern.test(lines[index])) continue;
    let end = Math.min(lines.length, index + 5);
    for (let cursor = index + 1; cursor < end; cursor += 1) {
      if (!isScoreOrSectionHeading(lines[cursor])) continue;
      end = cursor;
      break;
    }
    const context = lines.slice(index, end).join(" ");
    candidates.push(...numbersInRange(context, min, max));
  }
  return Array.from(new Set(candidates));
};

const extractScores = (lines: string[]) => {
  const totalCandidates = findScoreCandidatesNear(lines, /total score/i, 400, 1600);
  const readingWritingCandidates = findScoreCandidatesNear(
    lines,
    /^(?:latest\s+sat\s+)?reading\s*(?:and|&)\s*writing(?:\s+section)?(?:\s+score)?\b|\breading\s*(?:and|&)\s*writing\s+(?:section\s+)?score\b/i,
    200,
    800,
  );
  const mathCandidates = findScoreCandidatesNear(
    lines,
    /^(?:latest\s+sat\s+)?math(?:\s+section)?(?:\s+score)?\b|\bmath\s+(?:section\s+)?score\b/i,
    200,
    800,
  );
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

const domainStartsAt = (lines: string[], index: number, aliases: string[]) => {
  const current = normalizeKey(lines[index]);
  const currentTokens = new Set(current.split(" "));
  const window = normalizeKey(lines.slice(index, index + 3).join(" "));
  return aliases.map(normalizeKey).some((alias) => {
    if (current.includes(alias)) return true;
    const firstToken = alias.split(" ")[0];
    return currentTokens.has(firstToken) && window.includes(alias);
  });
};

const isDomainHeading = (lines: string[], index: number) =>
  domainDefinitions.some((domain) => domainStartsAt(lines, index, domain.aliases));

const findDomainContexts = (lines: string[], aliases: string[]) => {
  const contexts: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!domainStartsAt(lines, index, aliases)) continue;
    let end = index + 1;
    while (end < lines.length && !isDomainHeading(lines, end) && !isSectionHeading(lines[end])) end += 1;
    contexts.push(lines.slice(index, end).join(" "));
  }
  return contexts;
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

const extractPerformanceRange = (
  context: string,
  section: ScoreReportDomainResult["section"],
) => {
  for (const match of context.matchAll(/\b(\d{3})\s*-\s*(\d{3})\b/g)) {
    const low = Number(match[1]);
    const high = Number(match[2]);
    const proficiency = performanceBands[section].findIndex(([bandLow, bandHigh]) =>
      bandLow === low && bandHigh === high,
    ) + 1;
    if (proficiency === 0) continue;
    return {
      range: `${low}-${high}`,
      midpoint: Math.round((low + high) / 2),
      proficiency,
    };
  }
  return undefined;
};

const parseDomainsFromText = (
  lines: string[],
  visualBars: Partial<Record<ScoreReportFocusId, number>>,
) =>
  domainDefinitions.map((domain) => {
    const contexts = findDomainContexts(lines, domain.aliases);
    const rawContext = contexts.find((context) =>
      extractProficiency(context) !== undefined || extractPerformanceRange(context, domain.section) !== undefined,
    ) ?? contexts[0] ?? "";
    const performance = extractPerformanceRange(rawContext, domain.section);
    return {
      id: domain.id,
      label: domain.id,
      section: domain.section,
      proficiency: visualBars[domain.id] ?? extractProficiency(rawContext) ?? performance?.proficiency,
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
  const reportHeader = toLines(normalized).slice(0, 40).join(" ");
  if (psatReportPattern.test(reportHeader)) {
    throw new Error("This planner supports SAT score reports, not PSAT reports.");
  }
  const lines = toLines(normalized);
  const scores = extractScores(lines);
  const domains = parseDomainsFromText(lines, visualBars);
  const recommendedFocus = domains
    .filter(hasDomainMetric)
    .filter((domain) => focusScore(domain) <= 5)
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

const imageMimeTypes = new Set(["image/jpeg", "image/jpg", "image/pjpeg", "image/png", "image/x-png"]);

const fileExtension = (fileName: string) => fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

export const validateScoreReportFile = (file: File): ScoreReportFileKind => {
  if (file.size <= 0) throw new Error("The score report file is empty.");
  if (file.size > SCORE_REPORT_UPLOAD_LIMITS.maxBytes) {
    throw new Error("Score report files must be 15 MB or smaller.");
  }

  const type = file.type.toLowerCase().split(";", 1)[0].trim();
  const extension = fileExtension(file.name);
  if (type === "application/pdf") return "pdf";
  if (imageMimeTypes.has(type)) return "image";
  if (!type || type === "application/octet-stream") {
    if (extension === "pdf") return "pdf";
    if (extension === "jpg" || extension === "jpeg" || extension === "png") return "image";
  }
  throw new Error("Upload a PDF, JPEG, or PNG College Board score report.");
};

export const validateScoreReportPageCount = (pageCount: number) => {
  if (!Number.isInteger(pageCount) || pageCount <= 0) throw new Error("The PDF does not contain any readable pages.");
  if (pageCount > SCORE_REPORT_UPLOAD_LIMITS.maxPdfPages) {
    throw new Error("Score report PDFs must contain 10 pages or fewer.");
  }
};

export const validateScoreReportImageDimensions = (width: number, height: number) => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("The score report image has invalid dimensions.");
  }
  if (width * height > SCORE_REPORT_UPLOAD_LIMITS.maxImagePixels) {
    throw new Error("Score report images must be 20 megapixels or smaller.");
  }
};

const jpegStartOfFrameMarkers = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

export const readScoreReportImageDimensions = async (file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const isPng = bytes.length >= 24
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
    && String.fromCharCode(...bytes.slice(12, 16)) === "IHDR";
  if (isPng) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 3 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
      const marker = bytes[offset];
      offset += 1;
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
      if (offset + 1 >= bytes.length) break;
      const segmentLength = view.getUint16(offset);
      if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
      if (jpegStartOfFrameMarkers.has(marker) && segmentLength >= 7) {
        return {
          width: view.getUint16(offset + 5),
          height: view.getUint16(offset + 3),
        };
      }
      offset += segmentLength;
    }
  }

  throw new Error("The score report image header is invalid.");
};

const abortError = () => new DOMException("Score report parsing was canceled.", "AbortError");

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw abortError();
};

const emitProgress = (
  options: ParseScoreReportFileOptions,
  progress: ScoreReportParseProgress,
) => options.onProgress?.({ ...progress, progress: Math.min(1, Math.max(0, progress.progress)) });

const loadImage = (url: string, signal?: AbortSignal) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const cleanup = () => signal?.removeEventListener("abort", handleAbort);
    const handleAbort = () => {
      image.src = "";
      cleanup();
      reject(abortError());
    };
    image.onload = () => {
      cleanup();
      resolve(image);
    };
    image.onerror = () => {
      cleanup();
      reject(new Error("Image could not be loaded."));
    };
    if (signal?.aborted) {
      handleAbort();
      return;
    }
    signal?.addEventListener("abort", handleAbort, { once: true });
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
  signal?: AbortSignal,
): Promise<Partial<Record<ScoreReportFocusId, number>>> => {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url, signal);
    throwIfAborted(signal);
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

const prepareImageForOcr = async (file: File, signal?: AbortSignal) => {
  throwIfAborted(signal);
  const headerDimensions = await readScoreReportImageDimensions(file);
  throwIfAborted(signal);
  validateScoreReportImageDimensions(headerDimensions.width, headerDimensions.height);
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url, signal);
    throwIfAborted(signal);
    validateScoreReportImageDimensions(image.naturalWidth, image.naturalHeight);
    const pixels = image.naturalWidth * image.naturalHeight;
    if (pixels <= SCORE_REPORT_UPLOAD_LIMITS.ocrTargetPixels) return file;

    const scale = Math.sqrt(SCORE_REPORT_UPLOAD_LIMITS.ocrTargetPixels / pixels);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.floor(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The score report image could not be prepared.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    throwIfAborted(signal);
    const prepared = await canvasToPngFile(canvas, "score-report.png");
    if (!prepared) throw new Error("The score report image could not be prepared.");
    return prepared;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const prepareScoreCardsForOcr = async (file: File, signal?: AbortSignal) => {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url, signal);
    throwIfAborted(signal);
    const sourceHeight = Math.min(image.naturalHeight, Math.max(220, Math.round(image.naturalHeight * 0.3)));
    const sourceWidth = Math.min(image.naturalWidth, Math.max(220, Math.round(image.naturalWidth * 0.42)));
    const sourcePixels = sourceWidth * sourceHeight;
    const scale = Math.min(2.5, Math.sqrt(SCORE_REPORT_UPLOAD_LIMITS.ocrTargetPixels / sourcePixels));
    const centers = [image.naturalWidth / 6, image.naturalWidth / 2, image.naturalWidth * 5 / 6];
    const cards: File[] = [];
    for (let index = 0; index < centers.length; index += 1) {
      const sourceX = Math.max(0, Math.min(image.naturalWidth - sourceWidth, Math.round(centers[index] - sourceWidth / 2)));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(sourceWidth * scale));
      canvas.height = Math.max(1, Math.floor(sourceHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) continue;
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        image,
        sourceX,
        0,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      throwIfAborted(signal);
      const card = await canvasToPngFile(canvas, `score-report-card-${index + 1}.png`);
      if (card) cards.push(card);
    }
    return cards;
  } finally {
    URL.revokeObjectURL(url);
  }
};

type OcrWorker = {
  recognize: (file: File) => Promise<{ data: { text?: string; words?: OcrWord[] } }>;
  terminate: () => Promise<unknown>;
};

type OcrProgressContext = {
  page?: number;
  pageCount?: number;
};

const createOcrSession = (options: ParseScoreReportFileOptions) => {
  let worker: OcrWorker | undefined;
  let workerPromise: Promise<OcrWorker> | undefined;
  let terminationPromise: Promise<unknown> | undefined;
  let progressContext: OcrProgressContext = {};

  const getWorker = () => {
    if (!workerPromise) {
      workerPromise = import("tesseract.js")
        .then(async ({ createWorker, PSM }) => {
          const created = await createWorker("eng", undefined, {
            workerPath: "/tesseract/worker.min.js",
            corePath: "/tesseract/core",
            langPath: "/tesseract/lang",
            gzip: true,
            logger: ({ progress }) => {
              if (options.signal?.aborted || !Number.isFinite(progress)) return;
              emitProgress(options, { stage: "ocr", progress, ...progressContext });
            },
          });
          await created.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
          return created;
        })
        .then((created) => {
          worker = created;
          return created;
        });
    }
    return workerPromise;
  };

  return {
    recognize: async (file: File, context: OcrProgressContext = {}) => {
      throwIfAborted(options.signal);
      progressContext = context;
      const current = await getWorker();
      throwIfAborted(options.signal);
      let rejectAbort: ((reason: DOMException) => void) | undefined;
      const canceled = new Promise<never>((_, reject) => {
        rejectAbort = reject;
      });
      const handleAbort = () => {
        if (worker === current) {
          worker = undefined;
          workerPromise = undefined;
        }
        terminationPromise = current.terminate().catch(() => undefined);
        rejectAbort?.(abortError());
      };
      options.signal?.addEventListener("abort", handleAbort, { once: true });
      try {
        const result = options.signal
          ? await Promise.race([current.recognize(file), canceled])
          : await current.recognize(file);
        throwIfAborted(options.signal);
        return result.data;
      } finally {
        options.signal?.removeEventListener("abort", handleAbort);
      }
    },
    terminate: async () => {
      const current = worker;
      const pendingTermination = terminationPromise;
      worker = undefined;
      workerPromise = undefined;
      terminationPromise = undefined;
      if (current) await current.terminate();
      else if (pendingTermination) await pendingTermination;
    },
  };
};

type OcrSession = ReturnType<typeof createOcrSession>;

const extractPdfReport = async (
  file: File,
  ocr: OcrSession,
  options: ParseScoreReportFileOptions,
  forceOcr = false,
) => {
  throwIfAborted(options.signal);
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const data = new Uint8Array(await file.arrayBuffer());
  throwIfAborted(options.signal);
  const loadingTask = pdfjs.getDocument({ data });
  const cancelLoading = () => {
    void loadingTask.destroy();
  };
  options.signal?.addEventListener("abort", cancelLoading, { once: true });
  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch (error) {
    if (options.signal?.aborted) throw abortError();
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", cancelLoading);
  }

  const pages: string[] = [];
  const visualBars: Partial<Record<ScoreReportFocusId, number>> = {};

  try {
    validateScoreReportPageCount(pdf.numPages);
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      throwIfAborted(options.signal);
      emitProgress(options, {
        stage: "reading-pdf",
        progress: (pageNumber - 1) / pdf.numPages,
        page: pageNumber,
        pageCount: pdf.numPages,
      });
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      throwIfAborted(options.signal);
      const baseViewport = page.getViewport({ scale: 1 });
      const renderScale = scoreReportPdfRenderScale(baseViewport.width, baseViewport.height);
      const viewport = page.getViewport({ scale: renderScale });
      const textLines = groupPdfTextLines(content.items, pdfjs.Util.transform, viewport.transform, viewport.scale);
      const pageText = textLines.map((line) => line.text).join("\n");
      if (!forceOcr) pages.push(pageText);

      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) continue;
      emitProgress(options, {
        stage: "rendering-page",
        progress: (pageNumber - 1) / pdf.numPages,
        page: pageNumber,
        pageCount: pdf.numPages,
      });
      const renderTask = page.render({ canvas, viewport });
      const cancelRender = () => renderTask.cancel();
      options.signal?.addEventListener("abort", cancelRender, { once: true });
      try {
        await renderTask.promise;
      } catch (error) {
        if (options.signal?.aborted) throw abortError();
        throw error;
      } finally {
        options.signal?.removeEventListener("abort", cancelRender);
      }

      mergeVisualBars(visualBars, estimateVisualBarsFromCanvas(canvas, textLines));

      if (forceOcr || pageText.trim().length < 80) {
        const imageFile = await canvasToPngFile(canvas, `score-report-page-${pageNumber}.png`);
        if (imageFile) {
          const imageReport = await extractImageReport(imageFile, ocr, options, {
            page: pageNumber,
            pageCount: pdf.numPages,
          });
          pages.push(imageReport.text);
          mergeVisualBars(visualBars, imageReport.visualBars);
        }
      }
      emitProgress(options, {
        stage: "reading-pdf",
        progress: pageNumber / pdf.numPages,
        page: pageNumber,
        pageCount: pdf.numPages,
      });
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

const extractImageReport = async (
  file: File,
  ocr: OcrSession,
  options: ParseScoreReportFileOptions,
  context: OcrProgressContext = {},
) => {
  const data = await ocr.recognize(file, context);
  let text = data.text ?? "";
  const firstPassScores = extractScores(toLines(text));
  const hasScoreHeader = /total score/i.test(text)
    || (/reading\s*(?:and|&)\s*writing/i.test(text) && /\bmath\b/i.test(text));
  if (
    (context.page === undefined || context.page === 1)
    && hasScoreHeader
    && (!firstPassScores.totalScore || !firstPassScores.readingWritingScore || !firstPassScores.mathScore)
  ) {
    const scoreCards = await prepareScoreCardsForOcr(file, options.signal);
    for (const scoreCard of scoreCards) {
      const scoreData = await ocr.recognize(scoreCard, context);
      text = `${text}\n${scoreData.text ?? ""}`;
      const scores = extractScores(toLines(text));
      if (scores.totalScore && scores.readingWritingScore && scores.mathScore) break;
    }
  }
  const words = data.words ?? [];
  return {
    text,
    visualBars: await estimateVisualBars(file, words, options.signal),
  };
};

export const parseScoreReportFile = async (
  file: File,
  options: ParseScoreReportFileOptions = {},
): Promise<ParsedScoreReport> => {
  throwIfAborted(options.signal);
  emitProgress(options, { stage: "validating", progress: 0 });
  const kind = validateScoreReportFile(file);
  const ocr = createOcrSession(options);
  try {
    let report: ParsedScoreReport;
    if (kind === "pdf") {
      const { text, visualBars } = await extractPdfReport(file, ocr, options);
      const parsed = parseScoreReportText(text, file.name, "pdf-text", visualBars);
      if (!needsOcrFallback(parsed)) {
        report = parsed;
      } else {
        const fallback = await extractPdfReport(file, ocr, options, true);
        report = parseScoreReportText(
          `${text}\n${fallback.text}`,
          file.name,
          "pdf-text",
          { ...visualBars, ...fallback.visualBars },
        );
      }
    } else {
      const prepared = await prepareImageForOcr(file, options.signal);
      const { text, visualBars } = await extractImageReport(prepared, ocr, options);
      report = parseScoreReportText(text, file.name, "image-ocr", visualBars);
    }
    throwIfAborted(options.signal);
    emitProgress(options, { stage: "complete", progress: 1 });
    return report;
  } finally {
    await ocr.terminate();
  }
};
