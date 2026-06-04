import katex from "katex";
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

const collapseTableBlockNewlines = (content: string): string =>
  content.replace(/<table\b[\s\S]*?<\/table>/gi, (tableHtml) =>
    tableHtml.replace(/[ \t]*\n[ \t]*/g, " "),
  );

export function renderMixedContent(text: string, options: RenderMixedContentOptions = {}): string {
  if (!text) return "";
  const { normalizeMath = true, convertTexLineBreaks = true } = options;

  let processedText = text;
  if (convertTexLineBreaks) {
    processedText = processedText.replace(/\\\\\\\\/g, "<br /><br />");
    processedText = processedText.replace(/\\\\/g, "<br />");
    processedText = processedText.replace(/\\n/g, "<br />");
  }
  // Convert two or more consecutive bullet-prefixed lines (e.g. "\n• item")
  // into a Roman-numeral ordered list. SAT "I/II/III only" questions reference
  // these bullets as Roman numerals in the answer choices.
  processedText = processedText.replace(
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
  // Pre-unescape \$...\$ inside HTML table cells so they render as math.
  // The data exporter sometimes escapes dollar signs in <th>/<td> cells even
  // though the surrounding text uses bare $...$ delimiters.
  processedText = processedText.replace(
    /(<t[hd]\b[^>]*>)([\s\S]*?)(<\/t[hd]>)/gi,
    (_, open: string, inner: string, close: string) =>
      `${open}${inner.replace(/\\\$/g, "$")}${close}`,
  );
  // Collapse whitespace between HTML structural tags so newlines inside a
  // `<table>...</table>` don't get converted into stacks of empty <br /> tags
  // that produce huge blank vertical space before the table.
  processedText = collapseTableBlockNewlines(processedText);
  processedText = processedText.replace(
    /(<\/?(?:table|thead|tbody|tfoot|tr|td|th|colgroup|col|caption)\b[^>]*>)\s+(?=<\/?(?:table|thead|tbody|tfoot|tr|td|th|colgroup|col|caption)\b)/gi,
    "$1",
  );
  // Block elements (table/list) provide their own visual spacing — don't add
  // <br /> tags immediately after them, which produce excess gap before the
  // following text.
  processedText = processedText.replace(/(<\/(?:table|ol|ul|tbody|thead|tr)>)\s*\n+\s*/g, "$1");
  processedText = processedText.replace(/\n/g, "<br />");
  if (normalizeMath) {
    processedText = normalizeTextForMathRendering(processedText);
  }

  type ContentSegment =
    | { type: "text"; value: string }
    | { type: "math"; value: string; displayMode: boolean };

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

  const parts = splitTextAndMath(processedText);

  const applyInlineFormatting = (content: string): string => {
    let html = content.replace(/\n/g, "<br />");

    html = html.replace(/~~([^~]+?)~~/g, (_, inner: string) => {
      const trimmed = inner.trim();
      return trimmed ? `<del>${trimmed}</del>` : _;
    });

    html = html.replace(/<strong>([\s\S]*?)<\/strong>/gi, (_, inner: string) => {
      const trimmed = inner.trim();
      if (trimmed) return `<strong>${trimmed}</strong>`;
      return inner.length > 0 ? " " : "";
    });

    html = html.replace(/<em>([\s\S]*?)<\/em>/gi, (_, inner: string) => {
      const trimmed = inner.trim();
      if (trimmed) return `<em>${trimmed}</em>`;
      return inner.length > 0 ? " " : "";
    });

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
      const leading = inner.match(/^\s*/)?.[0] ?? "";
      const trailing = inner.match(/\s*$/)?.[0] ?? "";
      return `${prefix}${leading}<em>${trimmed}</em>${trailing}`;
    });

    html = html.replace(/(^|[^_])_([^_]+?)_(?!_)/g, (_, prefix: string, inner: string) => {
      const trimmed = inner.trim();
      if (!trimmed) return _;
      const leading = inner.match(/^\s*/)?.[0] ?? "";
      const trailing = inner.match(/\s*$/)?.[0] ?? "";
      return `${prefix}${leading}<em>${trimmed}</em>${trailing}`;
    });

    html = html.replace(
      /(<img\b[^>]*\bsrc\s*=\s*)(["'])([^"']+)(\2)/gi,
      (_, prefix: string, quote: string, src: string, closingQuote: string) =>
        `${prefix}${quote}${normalizePublicAssetPath(src)}${closingQuote}`,
    );

    return html;
  };

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

  return sanitizeHtml(rendered);
}
