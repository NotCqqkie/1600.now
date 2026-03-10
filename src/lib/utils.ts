import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import katex from "katex";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function renderMixedContent(text: string): string {
  if (!text) return "";
  
  // Normalize line breaks:
  // 1. Literal "\n" (from JSON string) -> <br />
  // 2. Real newline characters -> <br />
  // 3. Double backslashes ( \\ ) -> <br />
  // 4. Quadruple backslashes ( \\\\ ) -> <br /><br />
  
  let processedText = text;
  
  // Handle various line break representations
  processedText = processedText.replace(/\\\\\\\\/g, '<br /><br />'); // Quad slash -> Double break
  processedText = processedText.replace(/\\\\/g, '<br />');           // Double slash -> Single break
  // Also handle single backslash if user encoded it poorly (safe fallback for simple text)
  // processedText = processedText.replace(/\\/g, '<br />'); // Removing this as it breaks LaTeX commands like \frac

  processedText = processedText.replace(/\\n/g, '<br />');            // Literal \n -> Single break
  processedText = processedText.replace(/\n/g, '<br />');             // Real newline -> Single break
  
  const isEscapedAt = (content: string, index: number): boolean => {
    let backslashCount = 0;
    let i = index - 1;
    while (i >= 0 && content[i] === "\\") {
      backslashCount += 1;
      i -= 1;
    }
    return backslashCount % 2 === 1;
  };

  const isLikelyInlineMath = (candidate: string): boolean => {
    const trimmed = candidate.trim();
    if (!trimmed) return false;

    // Avoid treating long prose/currency spans as math.
    const proseWords = trimmed.match(/[A-Za-z]{3,}/g) ?? [];
    if (proseWords.length >= 2) return false;

    // Fast-path for clear math syntax.
    if (/[\\^_{}]/.test(trimmed)) return true;
    if (/[=<>+*/]/.test(trimmed)) return true;
    if (/(^|[^A-Za-z])-(?=\d|[A-Za-z(])/.test(trimmed)) return true;

    // Plain number/variable snippets are often math.
    if (/^\d[\d.,]*$/.test(trimmed)) return true;
    if (/^[A-Za-z][A-Za-z0-9]{0,3}$/.test(trimmed)) return true;
    if (/^[A-Za-z][A-Za-z0-9]*\([^)]*\)$/.test(trimmed)) return true;

    // Avoid treating prose/currency spans as math (e.g. "$500 and $700").
    if (/\s/.test(trimmed) && !/[=<>+*/\\^_{}]/.test(trimmed)) return false;
    if (/\b(and|or|the|of|to|for|in|is|are)\b/i.test(trimmed)) return false;

    // If it has letters and no obvious prose words, allow it.
    if (/[A-Za-z]/.test(trimmed)) return true;

    return false;
  };

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

      // No closing delimiter: treat "$" as plain text.
      if (closing >= content.length) {
        cursor += 1;
        continue;
      }

      const mathCandidate = content.slice(cursor + delimiterLength, closing);
      if (!isLikelyInlineMath(mathCandidate)) {
        // Keep scanning to allow this "$" to remain literal while still parsing later math delimiters.
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

    // Bold: **text**
    html = html.replace(/\*\*([^*]+?)\*\*/g, (_, inner: string) => {
      const trimmed = inner.trim();
      return trimmed ? `<b>${trimmed}</b>` : _;
    });

    // Underline: __text__
    html = html.replace(/__([^_]+?)__/g, (_, inner: string) => {
      const trimmed = inner.trim();
      return trimmed ? `<u>${trimmed}</u>` : _;
    });

    // Italic (asterisks): *text* (supports spacing like "* n *")
    html = html.replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, (_, prefix: string, inner: string) => {
      const trimmed = inner.trim();
      return trimmed ? `${prefix}<i>${trimmed}</i>` : _;
    });

    // Italic (underscores): _text_ (supports spacing like "_ n _")
    html = html.replace(/(^|[^_])_([^_]+?)_(?!_)/g, (_, prefix: string, inner: string) => {
      const trimmed = inner.trim();
      return trimmed ? `${prefix}<i>${trimmed}</i>` : _;
    });

    return html;
  };

  return parts.map((part) => {
    if (part.type === "math") {
      try {
        return katex.renderToString(part.value, {
          displayMode: part.displayMode,
          throwOnError: false,
          trust: true,
          strict: false
        });
      } catch (error) {
        console.error('KaTeX error:', error);
        return `$${part.value}$`;
      }
    }
    return applyInlineFormatting(part.value).replace(/\\\$/g, "$");
  }).join('');
}
