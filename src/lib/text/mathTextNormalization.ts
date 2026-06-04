const isEscapedAt = (content: string, index: number): boolean => {
  let backslashCount = 0;
  let i = index - 1;
  while (i >= 0 && content[i] === "\\") {
    backslashCount += 1;
    i -= 1;
  }
  return backslashCount % 2 === 1;
};

export const isLikelyInlineMath = (candidate: string): boolean => {
  const trimmed = candidate.trim();
  if (!trimmed) return false;

  if (/\\[A-Za-z]+/.test(trimmed)) return true;
  if (/[\\^_{}]/.test(trimmed)) return true;

  // Reject English prose before short-circuiting on operators. Otherwise
  // "Substitute x = 7 into the function" wraps as $...$ and KaTeX strips
  // its spaces, rendering "Substitutex=7intothefunction".
  const proseCandidate = trimmed.replace(/\\[A-Za-z]+/g, " ");
  const proseWords = proseCandidate.match(/[A-Za-z]{3,}/g) ?? [];
  if (proseWords.length >= 2) return false;

  if (/^\(?\s*[+\-−]\s*\)?$/.test(trimmed)) return true;
  if (/[=<>+*/]/.test(trimmed)) return true;
  if (/(^|[^A-Za-z])-(?=\d|[A-Za-z(])/.test(trimmed)) return true;

  if (/^\d[\d.,]*$/.test(trimmed)) return true;
  if (/^\d+(?:\.\d+)?(?:\s*:\s*\d+(?:\.\d+)?)+$/.test(trimmed)) return true;
  if (/^[A-Za-z][A-Za-z0-9]{0,3}$/.test(trimmed)) return true;
  if (/^[A-Za-z][A-Za-z0-9]*\([^)]*\)$/.test(trimmed)) return true;
  if (/^\(\s*[-\dA-Za-z.,\s]+\)$/.test(trimmed) && trimmed.includes(",")) return true;
  if (/[\dA-Za-z)]\s*-\s*[\dA-Za-z(]/.test(trimmed)) return true;

  // Comma-separated list of numbers, e.g. "4, 10, 18, 4, 4, 5, 6, 5"
  if (/^-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?)+$/.test(trimmed)) return true;

  // Bracketed list of numbers, e.g. "[4, 4, 4, 5, 5, 6, 10, 18]"
  if (/^\[\s*-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?)*\s*\]$/.test(trimmed)) return true;

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
  normalized = normalized.replace(
    /\*\*\s*([A-Za-z0-9]+(?:\.[A-Za-z0-9]+)?|xy|pi|π)\s*\*\*/gi,
    "$1",
  );
  normalized = normalized.replace(
    /\(\*\s*([A-Za-z])\s*\*\*\s*,\s*([A-Za-z])\s*\*\)/g,
    "($1, $2)",
  );
  normalized = normalized.replace(
    /\(\*\s*([A-Za-z])\s*,\s*([A-Za-z])\s*\*\)/g,
    "($1, $2)",
  );
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
  normalized = normalized.replace(
    /\*\s*([A-Za-z])\s*\*\*\s*(\d+)\s*\*/g,
    (_, variable: string, exponent: string) => `$${variable}^${exponent}$`,
  );
  normalized = normalized.replace(
    /\*\s*([A-Za-z])\s+2\s*\*/g,
    (_, variable: string) => `$${variable}^2$`,
  );
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

const normalizeDecimalCommas = (content: string): string =>
  content.replace(
    /\b(\d{2,}),(\d{1,2})(?=\s+(?:feet?|foot|inches?|seconds?|minutes?|hours?|days?|years?|months?|meters?|miles?|kilograms?|grams?|pounds?|dollars?|cents?|degrees?|megawatts?|joules?|gallons?|liters?|percent|above|below|after|before|per|when|where|of|from|at|high|low|long|wide|tall|deep)\b)/gi,
    "$1.$2",
  );

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

const normalizeBareMathFragments = (content: string): string => {
  const wrapMath = (candidate: string): string => {
    const trimmed = candidate.trim();
    if (!trimmed || trimmed.includes("$")) return candidate;
    if (!isLikelyInlineMath(trimmed)) return candidate;
    return `$${trimmed}$`;
  };

  const normalizedLines = content
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.includes("$")) return line;
      if (/<\/?[a-zA-Z]/.test(trimmed)) return line;
      if (!/[=<>|]/.test(trimmed)) return line;
      if (!/^[A-Za-z0-9().,^+\-−=<>|/ ]+$/.test(trimmed)) return line;
      return line.replace(trimmed, wrapMath(trimmed));
    })
    .join("\n");

  return normalizedLines.replace(
    /\b(what is the value of)\s+([^?]+?)(\?)/gi,
    (match, prefix: string, candidate: string, suffix: string) => {
      const trimmed = candidate.trim();
      if (!trimmed || trimmed.includes("$")) return match;
      if (/<\/?[a-zA-Z]/.test(trimmed)) return match;
      if (!/[=^+\-*/()0-9A-Za-z]/.test(trimmed)) return match;
      const wrapped = wrapMath(trimmed);
      if (wrapped === trimmed) return match;
      return `${prefix} ${wrapped}${suffix}`;
    },
  );
};

const normalizeMalformedComparatorCommands = (content: string): string =>
  content.replace(/\\(le|ge|lt|gt)([A-Za-pr-zA-PR-Z0-9])(?=[^A-Za-z]|$)/g, "\\$1 $2");

const normalizeImplicitFunctionArguments = (content: string): string =>
  content.replace(
    /\\(arccos|arcsin|arctan|arcsec|arccsc|arccot|cosh|sinh|tanh|coth|sech|csch|cos|sin|tan|cot|sec|csc|log|ln)(?=[A-Za-z0-9])/g,
    "\\$1 ",
  );

const wrapBareLatexSegments = (content: string): string => {
  // Split on <br/> or newlines, wrap any segment containing a bare LaTeX
  // command with braces (e.g. \text{Median} = \frac{5+5}{2} = 5) in $...$.
  const separator = /(<br\s*\/?\s*>|\n)/i;
  const parts = content.split(separator);
  return parts
    .map((part) => {
      if (/^(<br\s*\/?\s*>|\n)$/i.test(part)) return part;
      const trimmed = part.trim();
      if (!trimmed || trimmed.includes("$")) return part;
      if (!/\\[a-zA-Z]+\s*\{/.test(trimmed)) return part;
      const leading = part.match(/^\s*/)?.[0] ?? "";
      const trailing = part.match(/\s*$/)?.[0] ?? "";
      return `${leading}$${trimmed}$${trailing}`;
    })
    .join("");
};

const normalizeAdjacentTextBlocks = (content: string): string => {
  const containsLower = (s: string): boolean => /[a-z]/.test(s);
  const needsSpace = (x: string, y: string): boolean =>
    (containsLower(x) || containsLower(y)) && !/\s$/.test(x);

  let result = content;
  let prev: string;
  do {
    prev = result;
    result = result.replace(
      /\\text\{([^{}]*)\}(\{?)\\text\{([^{}]*)\}/g,
      (match, x: string, brace: string, y: string) =>
        needsSpace(x, y) ? `\\text{${x} }${brace}\\text{${y}}` : match,
    );
    result = result.replace(
      /\\text\{([^{}]*)\}\{\\text\{([^{}]*)\}\}/g,
      (match, x: string, y: string) =>
        needsSpace(x, y) ? `\\text{${x} }{\\text{${y}}}` : match,
    );
  } while (result !== prev);

  result = result.replace(
    /(\d)\\text\{([a-z])/g,
    (_, digit: string, letter: string) => `${digit}\\text{ ${letter}`,
  );

  // Patch F: `\text{abc}1\text{xyz}` → `\text{abc }1\text{ xyz}`
  // (digit immediately following a closing \text{...} that ended in a letter)
  result = result.replace(
    /\\text\{([^{}]*[a-z])\}(?=\d)/gi,
    "\\text{$1 }",
  );

  return result;
};

// Patch E: Inside math ($...$), some choices contain TTS spellings of math
// operators ("n plus 12", "x times, open parenthesis") because the data was
// generated from screen-reader strings. Convert those phrases back to symbols.
const normalizeTtsMathPhrasesInsideMath = (content: string): string => {
  let result = "";
  let cursor = 0;
  while (cursor < content.length) {
    if (content[cursor] !== "$" || isEscapedAt(content, cursor)) {
      result += content[cursor];
      cursor += 1;
      continue;
    }
    const isDisplayMath =
      content[cursor + 1] === "$" && !isEscapedAt(content, cursor + 1);
    const delimiterLength: 1 | 2 = isDisplayMath ? 2 : 1;
    const closing = findClosingMathDelimiter(content, cursor, delimiterLength);
    if (closing === -1) {
      result += content[cursor];
      cursor += 1;
      continue;
    }
    const inner = content.slice(cursor + delimiterLength, closing);
    let fixed = inner;
    fixed = fixed.replace(/,?\s*open parenthesis,?\s*/gi, "(");
    fixed = fixed.replace(/,?\s*close parenthesis/gi, ")");
    fixed = fixed.replace(/\s+plus\s+/gi, "+");
    fixed = fixed.replace(/\s+minus\s+/gi, "-");
    fixed = fixed.replace(/\s+times,?\s+/gi, " \\cdot ");
    fixed = fixed.replace(/\s+times(?=[A-Za-z(])/gi, " \\cdot ");
    fixed = fixed.replace(/\s+divided by\s+/gi, "/");
    fixed = fixed.replace(/,\s+negative\s+/gi, ",-");
    fixed = fixed.replace(/(?<=[(\s,])negative\s+/gi, "-");
    fixed = fixed.replace(/\bcomma\s+/gi, ",");
    fixed = fixed.replace(/\b([A-Za-z0-9]+)\s+(?:raised\s+to\s+the\s+|to\s+the\s+)([a-z]+)(?:\s+power)?\b/gi, (_match, base: string, power: string) => {
      const numeric = ({
        zeroth: 0, first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
        sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
      } as Record<string, number>)[power.toLowerCase()];
      return numeric === undefined ? `${base}^{${power}}` : `${base}^{${numeric}}`;
    });
    result += content.slice(cursor, cursor + delimiterLength) + fixed + content.slice(closing, closing + delimiterLength);
    cursor = closing + delimiterLength;
  }
  return result;
};

// Patch C.1: data sources sometimes wrap a math expression in *nested* math
// delimiters: `$\frac{$\sqrt{...}$}{$\sqrt[3]{...}$}$`. The inner `$`s split
// the outer math span before our parser sees it, so KaTeX never gets a chance.
// First strip the inner `$`s structurally, *then* run the per-span cleanup.
const normalizeNestedDollarSigns = (content: string): string => {
  // Structural strip: inner `${command}` or `}{...$}` patterns.
  let pre = content;
  let prev: string;
  do {
    prev = pre;
    pre = pre
      // `{$\command` → `{\command`  and  `[$\command` → `[\command`
      .replace(/\{\$(\\[a-zA-Z])/g, "{$1")
      .replace(/\[\$(\\[a-zA-Z])/g, "[$1")
      // Inner `$}` adjacent to a `{`/`}`/end-of-span → strip the `$`
      .replace(/\$\}(?=[{}])/g, "}")
      // `}{$` (segment boundary where an inner `$` was lost) — strip leftover
      .replace(/\}\{\$(?=\\[a-zA-Z])/g, "}{")
      // Trailing `$}<closing-$>` of inner span just before outer closer
      .replace(/\$\}\$/g, "}$");
  } while (pre !== prev);

  // Per-span cleanup pass for any remaining `{$...$}` adjacency inside a span.
  let result = "";
  let cursor = 0;
  while (cursor < pre.length) {
    if (pre[cursor] !== "$" || isEscapedAt(pre, cursor)) {
      result += pre[cursor];
      cursor += 1;
      continue;
    }
    const isDisplayMath =
      pre[cursor + 1] === "$" && !isEscapedAt(pre, cursor + 1);
    const delimiterLength: 1 | 2 = isDisplayMath ? 2 : 1;
    const closing = findClosingMathDelimiter(pre, cursor, delimiterLength);
    if (closing === -1) {
      result += pre[cursor];
      cursor += 1;
      continue;
    }
    const inner = pre.slice(cursor + delimiterLength, closing);
    const cleaned = inner.replace(/\{\$/g, "{").replace(/\$\}/g, "}");
    result += pre.slice(cursor, cursor + delimiterLength) + cleaned + pre.slice(closing, closing + delimiterLength);
    cursor = closing + delimiterLength;
  }
  return result;
};

// Patch C.2: source HTML sometimes constrains tables with hard-coded inline
// widths (`style="width: 25%;"`) that squash cells to one character per row.
// Strip width-related inline styles from `<table>` tags (preserve the rest).
const stripTableInlineWidths = (content: string): string => {
  return content.replace(/<table\b([^>]*)>/gi, (_match, attrs: string) => {
    const cleanedAttrs = attrs
      .replace(/\sstyle\s*=\s*"([^"]*)"/i, (_attr, styleValue: string) => {
        const filtered = styleValue
          .split(";")
          .map((decl) => decl.trim())
          .filter((decl) => decl && !/^\s*(?:max-)?width\s*:/i.test(decl))
          .join("; ");
        return filtered ? ` style="${filtered}"` : "";
      })
      .replace(/\swidth\s*=\s*"[^"]*"/i, "");
    return `<table${cleanedAttrs}>`;
  });
};

// Patch C.3: convert `<span class="italic">x</span>` → `<em>x</em>` so it
// renders as italic. Also normalize stray `<u>` to `<em>` (SAT data uses `<u>`
// to mark the focal word, but most renderers won't underline inside math).
const normalizeInlineHtmlEmphasis = (content: string): string =>
  content
    .replace(/<span\b[^>]*class\s*=\s*"[^"]*\bitalic\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, "<em>$1</em>")
    .replace(/<u\b[^>]*>([\s\S]*?)<\/u>/gi, "<em>$1</em>");

// Bullet items in choice text often contain TTS narration of graph features
// ("• The vertex is at the point (2 comma negative 6)"). Convert the high-
// confidence verbal patterns to symbolic form so the text reads cleanly.
// Scoped to bullet lines to avoid mangling prose elsewhere.
const normalizeBulletTtsNarration = (content: string): string => {
  if (!/(^|\n)\s*•/.test(content)) return content;
  return content.replace(/((?:^|\n)\s*•[^\n]*)/g, (line) => {
    let out = line;
    // StartFraction X Over Y EndFraction -> $\frac{X}{Y}$
    out = out.replace(
      /(?:negative\s+)?StartFraction\s+([^]+?)\s+Over\s+([^]+?)\s+EndFraction/gi,
      (m, num, den) => {
        const sign = /^negative\b/i.test(m) ? "-" : "";
        return `$${sign}\\frac{${num.trim()}}{${den.trim()}}$`;
      },
    );
    // (N comma M), (N comma negative M), (negative N comma M), (negative N comma negative M)
    out = out.replace(
      /\(\s*(negative\s+)?(\d[\d,]*)\s+comma\s+(negative\s+)?(\d[\d,]*)\s*\)/gi,
      (_m, sN, n, sM, mNum) => `(${sN ? "-" : ""}${n}, ${sM ? "-" : ""}${mNum})`,
    );
    // Standalone "negative N" before a digit-only token elsewhere in the bullet
    out = out.replace(/\bnegative\s+(\d[\d,]*)/gi, "-$1");
    return out;
  });
};

const normalizePlainTextWrappedMath = (content: string): string => {
  let result = "";
  let cursor = 0;

  while (cursor < content.length) {
    if (content[cursor] !== "$" || isEscapedAt(content, cursor)) {
      result += content[cursor];
      cursor += 1;
      continue;
    }

    const isDisplayMath =
      content[cursor + 1] === "$" &&
      !isEscapedAt(content, cursor + 1);
    const delimiterLength: 1 | 2 = isDisplayMath ? 2 : 1;
    const closing = findClosingMathDelimiter(content, cursor, delimiterLength);

    if (closing === -1) {
      result += content[cursor];
      cursor += 1;
      continue;
    }

    const candidate = content.slice(cursor + delimiterLength, closing).trim();
    const plainTextMatch = candidate.match(/^\\(?:text|mathrm)\{([^{}]+)\}$/);
    const plainText = plainTextMatch?.[1]?.trim();

    if (
      plainText &&
      /\s/.test(plainText) &&
      /[A-Za-z]/.test(plainText) &&
      !/[\\^_=]/.test(plainText)
    ) {
      result += plainText;
    } else {
      result += content.slice(cursor, closing + delimiterLength);
    }

    cursor = closing + delimiterLength;
  }

  return result;
};

// LLMs sometimes escape the OPENING dollar of a math span — emitting `\$28$`
// when they meant `$28$`. The escape was almost certainly added because the
// span opens with a number, which the model misread as currency. Repair the
// pattern when the inner content is plausibly math and the closer is not
// followed by another `$` (so we don't disturb display math).
//
// Crucially, only fire when we're OUTSIDE an existing math span. Otherwise we
// destroy legitimate escaped-currency-inside-math patterns like `$\$641$`
// (487+ occurrences in the question bank), turning the whole sentence after it
// into one giant unclosed math run.
const repairLlmEscapedMathOpen = (content: string): string => {
  let result = "";
  let cursor = 0;
  let inMathSpan = false;

  while (cursor < content.length) {
    const ch = content[cursor];

    if (ch === "$" && !isEscapedAt(content, cursor)) {
      const isDisplay =
        content[cursor + 1] === "$" && !isEscapedAt(content, cursor + 1);
      if (isDisplay) {
        result += "$$";
        cursor += 2;
        continue;
      }
      result += "$";
      cursor += 1;
      inMathSpan = !inMathSpan;
      continue;
    }

    if (!inMathSpan && ch === "\\" && content[cursor + 1] === "$") {
      const tail = content.slice(cursor);
      const match = tail.match(/^\\\$([^$\n<]{1,80}?)\$(?!\$)/);
      if (match) {
        const inner = match[1];
        const trimmed = inner.trim();
        const proseWords = trimmed.match(/[A-Za-z]{3,}/g) ?? [];
        if (trimmed && proseWords.length < 2 && isLikelyInlineMath(trimmed)) {
          result += `$${inner}$`;
          cursor += match[0].length;
          continue;
        }
      }
    }

    result += ch;
    cursor += 1;
  }

  return result;
};

export function normalizeTextForMathRendering(text: string | null | undefined): string {
  if (!text) return text || "";

  const preprocessed = normalizeTtsMathPhrasesInsideMath(
    normalizeNestedDollarSigns(
      stripTableInlineWidths(
        normalizeBulletTtsNarration(
          normalizeInlineHtmlEmphasis(repairLlmEscapedMathOpen(text)),
        ),
      ),
    ),
  );

  const normalizedCurrency = normalizeInlineMathSpacing(
    normalizeMathWrappedCurrency(
      normalizeMathWrappedPercentages(
        normalizeMalformedComparatorCommands(
          normalizeImplicitFunctionArguments(
            normalizeBareMathFragments(
              normalizeImplicitMathExponents(
                normalizeDecimalCommas(
                  normalizeFullWidthMathPunctuation(
                    wrapBareLatexSegments(
                      normalizeAdjacentTextBlocks(
                        normalizeAsteriskWrappedMath(preprocessed),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  const normalizedPlainText = normalizePlainTextWrappedMath(normalizedCurrency);
  let result = "";
  let cursor = 0;

  while (cursor < normalizedPlainText.length) {
    if (normalizedPlainText[cursor] !== "$" || isEscapedAt(normalizedPlainText, cursor)) {
      result += normalizedPlainText[cursor];
      cursor += 1;
      continue;
    }

    const isDisplayMath =
      normalizedPlainText[cursor + 1] === "$" &&
      !isEscapedAt(normalizedPlainText, cursor + 1);
    const delimiterLength: 1 | 2 = isDisplayMath ? 2 : 1;
    const closing = findClosingMathDelimiter(normalizedPlainText, cursor, delimiterLength);

    if (closing === -1) {
      result += delimiterLength === 2 ? "\\$\\$" : "\\$";
      cursor += delimiterLength;
      continue;
    }

    const mathCandidate = normalizedPlainText.slice(cursor + delimiterLength, closing);
    if (isLikelyInlineMath(mathCandidate)) {
      result += normalizedPlainText.slice(cursor, closing + delimiterLength);
      cursor = closing + delimiterLength;
      continue;
    }

    result += "\\$";
    cursor += 1;
  }

  return result;
}

export { isEscapedAt };
