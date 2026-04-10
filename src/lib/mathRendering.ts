import katex from "katex";
import {
  isEscapedAt,
  isLikelyInlineMath,
  normalizeTextForMathRendering,
} from "@/lib/mathTextNormalization";
import { normalizePublicAssetPath } from "@/lib/utils";

export function renderMixedContent(text: string): string {
  if (!text) return "";

  let processedText = text;
  processedText = processedText.replace(/\\\\\\\\/g, "<br /><br />");
  processedText = processedText.replace(/\\\\/g, "<br />");
  processedText = processedText.replace(/\\n/g, "<br />");
  processedText = processedText.replace(/\n/g, "<br />");
  processedText = normalizeTextForMathRendering(processedText);

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

    html = html.replace(/\*\*([^*]+?)\*\*/g, (_, inner: string) => {
      const trimmed = inner.trim();
      return trimmed ? `<b>${trimmed}</b>` : _;
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
      return `${prefix}${leading}<i>${trimmed}</i>${trailing}`;
    });

    html = html.replace(/(^|[^_])_([^_]+?)_(?!_)/g, (_, prefix: string, inner: string) => {
      const trimmed = inner.trim();
      if (!trimmed) return _;
      const leading = inner.match(/^\s*/)?.[0] ?? "";
      const trailing = inner.match(/\s*$/)?.[0] ?? "";
      return `${prefix}${leading}<i>${trimmed}</i>${trailing}`;
    });

    html = html.replace(
      /(<img\b[^>]*\bsrc\s*=\s*)(["'])([^"']+)(\2)/gi,
      (_, prefix: string, quote: string, src: string, closingQuote: string) =>
        `${prefix}${quote}${normalizePublicAssetPath(src)}${closingQuote}`,
    );

    return html;
  };

  return parts
    .map((part) => {
      if (part.type === "math") {
        try {
          return katex.renderToString(part.value, {
            displayMode: part.displayMode,
            throwOnError: false,
            trust: true,
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
}
