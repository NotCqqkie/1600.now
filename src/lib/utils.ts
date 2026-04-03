import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import katex from "katex";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizePublicAssetPath(path: string): string {
  if (!path) return path;

  const trimmed = path.trim();
  if (!trimmed || /^(?:https?:|data:|blob:|mailto:|tel:)/i.test(trimmed)) {
    return trimmed;
  }

  const [pathAndQuery, hash = ""] = trimmed.split("#");
  const [pathname, query = ""] = pathAndQuery.split("?");
  const normalizedPath = pathname.replace(/\\/g, "/");
  const encodedPath = normalizedPath
    .split("/")
    .map((segment, index) => {
      if (index === 0 && segment === "") return "";
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join("/");

  const querySuffix = query ? `?${query}` : "";
  const hashSuffix = hash ? `#${hash}` : "";
  return `${encodedPath}${querySuffix}${hashSuffix}`;
}

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

  if (/\\[A-Za-z]+/.test(trimmed)) return true;
  if (/[\\^_{}]/.test(trimmed)) return true;
  if (/[=<>+*/]/.test(trimmed)) return true;
  if (/(^|[^A-Za-z])-(?=\d|[A-Za-z(])/.test(trimmed)) return true;

  const proseCandidate = trimmed.replace(/\\[A-Za-z]+/g, " ");
  const proseWords = proseCandidate.match(/[A-Za-z]{3,}/g) ?? [];
  if (proseWords.length >= 2) return false;

  if (/^\d[\d.,]*$/.test(trimmed)) return true;
  if (/^[A-Za-z][A-Za-z0-9]{0,3}$/.test(trimmed)) return true;
  if (/^[A-Za-z][A-Za-z0-9]*\([^)]*\)$/.test(trimmed)) return true;
  if (/^\(\s*[-\dA-Za-z.,\s]+\)$/.test(trimmed) && trimmed.includes(",")) return true;
  if (/[\dA-Za-z)]\s*-\s*[\dA-Za-z(]/.test(trimmed)) return true;

  if (/\s/.test(trimmed) && !/[=<>+*/\\^_{}]/.test(trimmed)) return false;
  if (/\b(and|or|the|of|to|for|in|is|are)\b/i.test(trimmed)) return false;

  if (/[A-Za-z]/.test(trimmed)) return true;

  return false;
};

const findClosingMathDelimiter = (
  content: string,
  start: number,
  delimiterLength: 1 | 2,
): number => {
  let cursor = start + delimiterLength;
  while (cursor < content.length) {
    if (
      content[cursor] === "$" &&
      !isEscapedAt(content, cursor) &&
      (
        delimiterLength === 2
          ? content[cursor + 1] === "$" && !isEscapedAt(content, cursor + 1)
          : content[cursor + 1] !== "$"
      )
    ) {
      return cursor;
    }
    cursor += 1;
  }
  return -1;
};

const isSimpleCurrencyExpression = (candidate: string): boolean => {
  const trimmed = candidate.trim();
  if (!trimmed.startsWith("\\$")) return false;
  const amount = trimmed.slice(2).trim();
  return /^[0-9][0-9,\s]*(?:\.\d+)?$/.test(amount);
};

const isSimplePercentExpression = (candidate: string): boolean => {
  const trimmed = candidate.trim();
  return /^[-+]?(?:\d[\d,]*(?:\.\d+)?|[A-Za-z][A-Za-z0-9]*)\s*%$/.test(trimmed);
};

const normalizeMathWrappedPercentages = (content: string): string => {
  let result = "";
  let cursor = 0;

  while (cursor < content.length) {
    if (
      content[cursor] !== "$" ||
      isEscapedAt(content, cursor) ||
      content[cursor + 1] === "$"
    ) {
      result += content[cursor];
      cursor += 1;
      continue;
    }

    const closing = findClosingMathDelimiter(content, cursor, 1);
    if (closing === -1) {
      result += content[cursor];
      cursor += 1;
      continue;
    }

    const candidate = content.slice(cursor + 1, closing);
    if (isSimplePercentExpression(candidate)) {
      result += candidate.trim().replace(/\s*%\s*$/, "%");
    } else {
      result += content.slice(cursor, closing + 1);
    }

    cursor = closing + 1;
  }

  return result;
};

const normalizeMathWrappedCurrency = (content: string): string => {
  let result = "";
  let cursor = 0;

  while (cursor < content.length) {
    if (
      content[cursor] !== "$" ||
      isEscapedAt(content, cursor) ||
      content[cursor + 1] === "$"
    ) {
      result += content[cursor];
      cursor += 1;
      continue;
    }

    const closing = findClosingMathDelimiter(content, cursor, 1);
    if (closing === -1) {
      result += content[cursor];
      cursor += 1;
      continue;
    }

    const candidate = content.slice(cursor + 1, closing);
    if (isSimpleCurrencyExpression(candidate)) {
      result += candidate.replace(/^\\\$/, "\\$");
    } else {
      result += content.slice(cursor, closing + 1);
    }

    cursor = closing + 1;
  }

  return result;
};

const normalizeAsteriskWrappedMath = (content: string): string => {
  let normalized = content;

  normalized = normalized.replace(
    /\*\s*([A-Za-z])\s*\*\s*in the\s*\*\s*xy\s*\*(?=-plane\b)/gi,
    (_, variable: string) => `$${variable}$ in the $xy$`,
  );
  normalized = normalized.replace(
    /\*\s*([A-Za-z])\s*\*\s*in terms of\b/gi,
    (_, variable: string) => `$${variable}$ in terms of`,
  );

  // Unwrap doubly emphasized math tokens such as "** x **" that should just be x.
  normalized = normalized.replace(
    /\*\*\s*([A-Za-z0-9]+(?:\.[A-Za-z0-9]+)?|xy|pi|π)\s*\*\*/gi,
    "$1",
  );

  // Repair common coordinate corruption like "(* x **, y *)" -> "(x, y)".
  normalized = normalized.replace(
    /\(\*\s*([A-Za-z])\s*\*\*\s*,\s*([A-Za-z])\s*\*\)/g,
    "($1, $2)",
  );
  normalized = normalized.replace(
    /\(\*\s*([A-Za-z])\s*,\s*([A-Za-z])\s*\*\)/g,
    "($1, $2)",
  );

  // Repair starred variable lists such as "* h, b *" and "* b, x, *".
  normalized = normalized.replace(
    /\*\s*([A-Za-z])((?:\s*,\s*[A-Za-z])+)\s*,?\s*\*/g,
    (match, first: string, rest: string) => {
      const variables = [first, ...rest.split(",").map((part) => part.trim()).filter(Boolean)];
      if (!variables.every((variable) => /^[A-Za-z]$/.test(variable))) {
        return match;
      }

      const hasTrailingComma = /,\s*\*$/.test(match);
      return `${variables.map((variable) => `$${variable}$`).join(", ")}${hasTrailingComma ? "," : ""}`;
    },
  );

  // Repair malformed starred variables before punctuation, such as "* y ** *=".
  normalized = normalized.replace(
    /\*\s*([A-Za-z]+)\s*\*\*\s*\*\s*([=,)])/g,
    (_, variable: string, suffix: string) => `$${variable}$${suffix}`,
  );
  normalized = normalized.replace(
    /\*\s*([A-Za-z]+)\s*\*\*\s*([=,)])/g,
    (_, variable: string, suffix: string) => `$${variable}$${suffix}`,
  );
  normalized = normalized.replace(
    /\*\s*([A-Za-z]+)\s*\*\*\s*,\s*\*/g,
    (_, variable: string) => `$${variable}$, `,
  );
  normalized = normalized.replace(
    /\*\s*([A-Za-z]+)\s*\?\s*\*/g,
    (_, variable: string) => `$${variable}$?`,
  );
  normalized = normalized.replace(
    /\*\s*([A-Za-z]+)\s*\*\*\s*\*/g,
    (_, variable: string) => `$${variable}$`,
  );
  normalized = normalized.replace(/\*\s*(in [^*]+?)\s*\*/gi, "$1");
  normalized = normalized.replace(
    /\*\s*([A-Za-z])\s*\*\s*(hours?|days?|seconds?|minutes?|months?|years?)\b/gi,
    (_, variable: string, unit: string) => `$${variable}$ ${unit}`,
  );
  normalized = normalized.replace(
    /\b([A-Za-z])\s*\*\s*(hours?|days?|seconds?|minutes?|months?|years?)\b/gi,
    (_, variable: string, unit: string) => `$${variable}$ ${unit}`,
  );

  // Repair exponent corruption such as "* x ** 2 *" -> "$x^2$" and "* a 2 *" -> "$a^2$".
  normalized = normalized.replace(
    /\*\s*([A-Za-z])\s*\*\*\s*(\d+)\s*\*/g,
    (_, variable: string, exponent: string) => `$${variable}^${exponent}$`,
  );
  normalized = normalized.replace(
    /\*\s*([A-Za-z])\s+2\s*\*/g,
    (_, variable: string) => `$${variable}^2$`,
  );

  // Convert remaining math-like starred spans to LaTeX math while leaving prose titles alone.
  normalized = normalized.replace(/\*([^*\n]+?)\*/g, (match, inner: string) => {
    const candidate = inner
      .replace(/\*\*\s*([A-Za-z0-9]+(?:\.[A-Za-z0-9]+)?|xy|pi|π)\s*\*\*/gi, "$1")
      .trim()
      .replace(/\s+/g, " ");

    if (!candidate || !isLikelyInlineMath(candidate)) {
      return match;
    }

    return `$${candidate}$`;
  });

  normalized = normalized.replace(/\*\s*\*/g, "");

  return normalized;
};

const normalizeFullWidthMathPunctuation = (content: string): string =>
  content
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[，]/g, ",")
    .replace(/[？]/g, "?")
    .replace(/[＞]/g, ">")
    .replace(/[＜]/g, "<");

const normalizeImplicitMathExponents = (content: string): string => {
  let normalized = content;

  normalized = normalized.replace(
    /\)\s+([23])(?=(?:\s*[+\-)=,?.]|$))/g,
    ")^$1",
  );
  normalized = normalized.replace(
    /(^|[^A-Za-z])([A-Za-z])\s+([23])(?=(?:\s*[A-Za-z+\-)=,?.]|$))/g,
    (_, prefix: string, variable: string, exponent: string) => `${prefix}${variable}^${exponent}`,
  );

  return normalized;
};

const normalizeInlineMathSpacing = (content: string): string => {
  let normalized = content;

  normalized = normalized.replace(
    /\$([A-Za-z]+)\$\(([^)$]+)\)/g,
    (_, fn: string, arg: string) => `$${fn}(${arg})$`,
  );
  normalized = normalized.replace(
    /([A-Za-z]+)\(\$([A-Za-z]+)\$\)/g,
    (_, fn: string, arg: string) => `$${fn}(${arg})$`,
  );

  normalized = normalized.replace(/([A-Za-z])(\$[A-Za-z][^$]*\$)/g, "$1 $2");
  normalized = normalized.replace(/(\$[A-Za-z][^$]*\$)([A-Za-z])/g, "$1 $2");

  return normalized;
};

const normalizeMalformedComparatorCommands = (content: string): string =>
  content.replace(/\\(le|ge|lt|gt)([A-Za-pr-zA-PR-Z0-9])(?=[^A-Za-z]|$)/g, "\\$1 $2");

export function normalizeTextForMathRendering(text: string | null | undefined): string {
  if (!text) return text || "";

  const normalizedCurrency = normalizeInlineMathSpacing(
    normalizeMathWrappedCurrency(
      normalizeMathWrappedPercentages(
        normalizeMalformedComparatorCommands(
          normalizeImplicitMathExponents(
            normalizeFullWidthMathPunctuation(
              normalizeAsteriskWrappedMath(text)
            )
          )
        )
      )
    )
  );
  let result = "";
  let cursor = 0;

  while (cursor < normalizedCurrency.length) {
    if (normalizedCurrency[cursor] !== "$" || isEscapedAt(normalizedCurrency, cursor)) {
      result += normalizedCurrency[cursor];
      cursor += 1;
      continue;
    }

    const isDisplayMath =
      normalizedCurrency[cursor + 1] === "$" &&
      !isEscapedAt(normalizedCurrency, cursor + 1);
    const delimiterLength: 1 | 2 = isDisplayMath ? 2 : 1;
    const closing = findClosingMathDelimiter(normalizedCurrency, cursor, delimiterLength);

    if (closing === -1) {
      result += delimiterLength === 2 ? "\\$\\$" : "\\$";
      cursor += delimiterLength;
      continue;
    }

    const mathCandidate = normalizedCurrency.slice(cursor + delimiterLength, closing);
    if (isLikelyInlineMath(mathCandidate)) {
      result += normalizedCurrency.slice(cursor, closing + delimiterLength);
      cursor = closing + delimiterLength;
      continue;
    }

    result += "\\$";
    cursor += 1;
  }

  return result;
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
      if (!trimmed) return _;
      const leading = inner.match(/^\s*/)?.[0] ?? "";
      const trailing = inner.match(/\s*$/)?.[0] ?? "";
      return `${prefix}${leading}<i>${trimmed}</i>${trailing}`;
    });

    // Italic (underscores): _text_ (supports spacing like "_ n _")
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
        `${prefix}${quote}${normalizePublicAssetPath(src)}${closingQuote}`
    );

    return html;
  };

  return parts.map((part) => {
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
        console.error('KaTeX error:', error);
        return `$${part.value}$`;
      }
    }
    return applyInlineFormatting(part.value).replace(/\\\$/g, "$");
  }).join('');
}
