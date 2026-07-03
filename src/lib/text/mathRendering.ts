import katex from "katex";
// KaTeX styles travel with this module so every consumer (including lazy
// importers) gets them without a separate page-level CSS import.
import "katex/dist/katex.min.css";
import {
  isEscapedAt,
  isLikelyInlineMath,
  normalizeTextForMathRendering,
} from "@/lib/text/mathTextNormalization";
import { normalizePublicAssetPath } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/text/sanitizeHtml";

type RenderMixedContentOptions = {
  normalizeMath?: boolean;
  convertTexLineBreaks?: boolean;
};

type MathDelimiter = { open: "$" | "$$" | "\\(" | "\\["; close: "$" | "$$" | "\\)" | "\\]" };
type TexDelimiter = "\\(" | "\\)" | "\\[" | "\\]" | "$" | "$$";
type ContentSegment =
  | { type: "text"; value: string }
  | { type: "math"; value: string; displayMode: boolean };

const collapseTableBlockNewlines = (content: string): string =>
  content.replace(/<table\b[\s\S]*?<\/table>/gi, (tableHtml) =>
    tableHtml.replace(/[ \t]*\n[ \t]*/g, " "),
  );

const normalizeInlineWhitespace = (content: string): string =>
  content
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, " ")
    .replace(/\s*<(em|strong|u)\b[^>]*>\s*<\/\1>\s*/gi, " ")
    .replace(/\s+<(em|strong|u)\b([^>]*)>\s*([,.;:!?])\s*<\/\1>/gi, "<$1$2>$3</$1>")
    .replace(/([A-Za-z0-9])<(em|strong|u)\b([^>]*)>\s+/gi, "$1 <$2$3>")
    .replace(/([([{])<(em|strong|u)\b([^>]*)>\s+/gi, "$1<$2$3>")
    .replace(/(\s)<(em|strong|u)\b([^>]*)>\s+/gi, "$1<$2$3>")
    .replace(/<\/(em|strong|u)>(?=[A-Za-z0-9])/gi, "</$1> ")
    .replace(/\s+<\/(em|strong|u)>(?=\s|[,.!?;:])/gi, "</$1>")
    .replace(/[ \t]+(?:&deg;|°)/gi, "°")
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ");

const readOpeningMathDelimiterAt = (content: string, index: number): MathDelimiter | null => {
  if (isEscapedAt(content, index)) return null;
  if (content.startsWith("$$", index)) return { open: "$$", close: "$$" };
  if (content[index] === "$") return { open: "$", close: "$" };
  if (content.startsWith("\\(", index)) return { open: "\\(", close: "\\)" };
  if (content.startsWith("\\[", index)) return { open: "\\[", close: "\\]" };
  return null;
};

const findUnescapedDelimiter = (content: string, delimiter: string, from: number): number => {
  let cursor = from;
  while (cursor < content.length) {
    if (content.startsWith(delimiter, cursor) && !isEscapedAt(content, cursor)) {
      return cursor;
    }
    cursor += 1;
  }
  return content.length;
};

const convertLineBreaksOutsideMath = (content: string): string => {
  const convert = (value: string): string =>
    value
      .replace(/\\\\\\\\/g, "<br /><br />")
      .replace(/\\\\/g, "<br />")
      .replace(/\\n/g, "<br />");

  let result = "";
  let cursor = 0;
  let textStart = 0;

  while (cursor < content.length) {
    const delimiter = readOpeningMathDelimiterAt(content, cursor);
    if (!delimiter) {
      cursor += 1;
      continue;
    }

    const closing = findUnescapedDelimiter(content, delimiter.close, cursor + delimiter.open.length);

    if (closing >= content.length) {
      cursor += 1;
      continue;
    }

    result += convert(content.slice(textStart, cursor));
    result += content.slice(cursor, closing + delimiter.close.length);
    cursor = closing + delimiter.close.length;
    textStart = cursor;
  }

  result += convert(content.slice(textStart));
  return result;
};

const normalizeTexDelimiters = (content: string): string => {
  const segments: { type: "text" | "math"; value: string; displayMode?: boolean }[] = [];
  let cursor = 0;
  let textStart = 0;

  const findNextDelimiter = (from: number): { index: number; delimiter: TexDelimiter } | null => {
    let scan = from;
    while (scan < content.length) {
      if (!isEscapedAt(content, scan)) {
        if (content.startsWith("$$", scan)) return { index: scan, delimiter: "$$" };
        if (content[scan] === "$") return { index: scan, delimiter: "$" };
      }
      if (content[scan] === "\\" && !isEscapedAt(content, scan)) {
        const candidate = content.slice(scan, scan + 2);
        if (candidate === "\\(" || candidate === "\\)" || candidate === "\\[" || candidate === "\\]") {
          return { index: scan, delimiter: candidate };
        }
      }
      scan += 1;
    }
    return null;
  };

  while (cursor < content.length) {
    const next = findNextDelimiter(cursor);
    if (!next) break;

    if (next.delimiter === "\\)" || next.delimiter === "\\]") {
      cursor = next.index + 2;
      continue;
    }

    const displayMode = next.delimiter === "$$" || next.delimiter === "\\[";
    const closeDelimiter = next.delimiter === "\\(" ? "\\)" : next.delimiter === "\\[" ? "\\]" : next.delimiter;
    const openLength = next.delimiter.length;
    const closeLength = closeDelimiter.length;
    const closing = findUnescapedDelimiter(content, closeDelimiter, next.index + openLength);

    if (closing >= content.length) {
      cursor = next.index + openLength;
      continue;
    }

    if (textStart < next.index) {
      segments.push({ type: "text", value: content.slice(textStart, next.index) });
    }
    segments.push({
      type: "math",
      value: content.slice(next.index + openLength, closing),
      displayMode,
    });

    cursor = closing + closeLength;
    textStart = cursor;
  }

  if (textStart < content.length) {
    segments.push({ type: "text", value: content.slice(textStart) });
  }

  if (!segments.length) return content;

  return segments
    .map((segment) => {
      if (segment.type === "text") return segment.value;
      const delimiter = segment.displayMode ? "$$" : "$";
      return `${delimiter}${segment.value}${delimiter}`;
    })
    .join("");
};

const normalizeBulletListBlocks = (content: string): string =>
  content.replace(
    /(?:(?:^|\n)\s*•\s*[^\n]+){2,}/g,
    (block: string) => {
      const items = block
        .split(/\n/)
        .map((line) => line.replace(/^\s*•\s*/, "").trim())
        .filter((line) => line.length > 0);
      if (items.length < 2) return block;
      const lis = items.map((item) => `<li>${item}</li>`).join("");
      return `\n<ol type="I" class="bullet-list">${lis}</ol>\n`;
    },
  );

const normalizeTableHtmlBeforeMath = (content: string): string => {
  let normalized = content.replace(
    /(<t[hd]\b[^>]*>)([\s\S]*?)(<\/t[hd]>)/gi,
    (_, open: string, inner: string, close: string) =>
      `${open}${inner.replace(/\\\$/g, "$")}${close}`,
  );
  normalized = collapseTableBlockNewlines(normalized);
  normalized = normalized.replace(
    /(<\/?(?:table|thead|tbody|tfoot|tr|td|th|colgroup|col|caption)\b[^>]*>)\s+(?=<\/?(?:table|thead|tbody|tfoot|tr|td|th|colgroup|col|caption)\b)/gi,
    "$1",
  );
  normalized = normalized.replace(/(<\/(?:table|ol|ul|tbody|thead|tr)>)\s*\n+\s*/g, "$1");
  return normalized;
};

const splitTextAndMath = (content: string): ContentSegment[] => {
  const segments: ContentSegment[] = [];
  let cursor = 0;
  let textStart = 0;

  while (cursor < content.length) {
    if (content[cursor] !== "$" || isEscapedAt(content, cursor)) {
      cursor += 1;
      continue;
    }

    const isDisplayMath = content[cursor + 1] === "$" && !isEscapedAt(content, cursor + 1);
    const delimiterLength = isDisplayMath ? 2 : 1;

    let closing = cursor + delimiterLength;
    while (closing < content.length) {
      if (
        content[closing] === "$" &&
        !isEscapedAt(content, closing) &&
        (isDisplayMath ? content[closing + 1] === "$" : content[closing + 1] !== "$")
      ) {
        break;
      }
      closing += 1;
    }

    if (closing >= content.length) {
      cursor += 1;
      continue;
    }

    const mathCandidate = content.slice(cursor + delimiterLength, closing);
    if (
      /^\s*\d[\d,.]*\s*[,;:]?\s*$/.test(mathCandidate) &&
      /\d/.test(content[closing + delimiterLength] ?? "")
    ) {
      cursor += 1;
      continue;
    }
    if (!isLikelyInlineMath(mathCandidate)) {
      cursor += 1;
      continue;
    }

    if (textStart < cursor) {
      segments.push({ type: "text", value: content.slice(textStart, cursor) });
    }
    segments.push({ type: "math", value: mathCandidate, displayMode: isDisplayMath });

    cursor = closing + delimiterLength;
    textStart = cursor;
  }

  if (textStart < content.length) {
    segments.push({ type: "text", value: content.slice(textStart) });
  }

  return segments;
};

const trimHtmlWrapperSpacing = (content: string, tag: "strong" | "em"): string =>
  content.replace(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "gi"), (_, inner: string) => {
    const trimmed = inner.trim();
    if (!trimmed) return inner.length > 0 ? inner : "";
    const leading = inner.match(/^\s*/)?.[0] ?? "";
    const trailing = inner.match(/\s*$/)?.[0] ?? "";
    return `${leading}<${tag}>${trimmed}</${tag}>${trailing}`;
  });

const applyInlineFormatting = (content: string): string => {
  let html = content.replace(/\n/g, "<br />");
  const protectedTags: string[] = [];
  const protectTags = (value: string) =>
    value.replace(/<\/?[A-Za-z][^>]*>/g, (tag: string) => {
      const index = protectedTags.push(tag) - 1;
      return `\uE000${index}\uE001`;
    });
  const restoreTags = (value: string) =>
    value.replace(/\uE000(\d+)\uE001/g, (_match: string, index: string) => protectedTags[Number(index)] ?? "");

  html = html.replace(/~~([^~]+?)~~/g, (_, inner: string) => {
    const trimmed = inner.trim();
    return trimmed ? `<del>${trimmed}</del>` : _;
  });

  html = trimHtmlWrapperSpacing(html, "strong");
  html = trimHtmlWrapperSpacing(html, "em");

  html = protectTags(html);

  html = html.replace(/\*\*([^*]+?)\*\*/g, (_, inner: string) => {
    const trimmed = inner.trim();
    return trimmed ? `<strong>${trimmed}</strong>` : _;
  });

  html = html.replace(/__([^_]+?)__/g, (_, inner: string) => {
    const trimmed = inner.trim();
    return trimmed ? `<u>${trimmed}</u>` : _;
  });

  html = html.replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, (_, prefix: string, inner: string) => {
    const trimmed = inner.trim();
    if (!trimmed) return _;
    return `${prefix}<em>${trimmed}</em>`;
  });

  html = html.replace(/(^|[^\w])_([^_]+?)_(?![\w_])/g, (_, prefix: string, inner: string) => {
    const trimmed = inner.trim();
    if (!trimmed) return _;
    return `${prefix}<em>${trimmed}</em>`;
  });

  html = restoreTags(html);

  html = html.replace(
    /(<img\b[^>]*\bsrc\s*=\s*)(["'])([^"']+)(\2)/gi,
    (_, prefix: string, quote: string, src: string) =>
      `${prefix}${quote}${normalizePublicAssetPath(src)}${quote}`,
  );

  return html;
};

// Rendering is pure (same text + options → same HTML) but expensive
// (normalization passes + KaTeX + sanitize), and list views re-render the
// same strings on every keystroke — so results are cached. Insertion-order
// eviction keeps memory bounded.
const RENDER_CACHE_MAX_ENTRIES = 500;
const renderResultCache = new Map<string, string>();

export function renderMixedContent(text: string, options: RenderMixedContentOptions = {}): string {
  if (!text) return "";
  const { normalizeMath = true, convertTexLineBreaks = true } = options;

  const cacheKey = `${normalizeMath ? 1 : 0}${convertTexLineBreaks ? 1 : 0}:${text}`;
  const cachedResult = renderResultCache.get(cacheKey);
  if (cachedResult !== undefined) return cachedResult;

  let processedText = text;
  if (convertTexLineBreaks) {
    processedText = convertLineBreaksOutsideMath(processedText);
  }
  processedText = normalizeBulletListBlocks(processedText);
  processedText = normalizeTableHtmlBeforeMath(processedText);
  processedText = processedText.replace(/\n/g, "<br />");
  if (normalizeMath) {
    processedText = normalizeTextForMathRendering(processedText);
  }
  processedText = normalizeInlineWhitespace(processedText);
  processedText = normalizeTexDelimiters(processedText);

  const parts = splitTextAndMath(processedText);

  const rendered = parts
    .map((part) => {
      if (part.type === "math") {
        try {
          return katex.renderToString(part.value, {
            displayMode: part.displayMode,
            throwOnError: false,
            trust: false,
            strict: false,
            output: "html",
          });
        } catch (error) {
          console.error("KaTeX error:", error);
          return `$${part.value}$`;
        }
      }

      return applyInlineFormatting(part.value).replace(/\\\$/g, "$");
    })
    .join("");

  const result = sanitizeHtml(rendered);
  if (renderResultCache.size >= RENDER_CACHE_MAX_ENTRIES) {
    renderResultCache.delete(renderResultCache.keys().next().value as string);
  }
  renderResultCache.set(cacheKey, result);
  return result;
}
