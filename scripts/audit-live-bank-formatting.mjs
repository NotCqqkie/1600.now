import { spawn } from "node:child_process";
import process from "node:process";
import puppeteer from "puppeteer";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

const requestedTargetCleanStreak = args.get("target-clean-streak") ?? "1000";
const targetCleanStreak = requestedTargetCleanStreak === "all"
  ? "all"
  : Number.parseInt(requestedTargetCleanStreak, 10);
const maxQuestions = Number.parseInt(args.get("max-questions") ?? "20000", 10);
const reportLimit = Number.parseInt(args.get("report-limit") ?? "80", 10);
const port = Number.parseInt(args.get("port") ?? "5187", 10);
const baseUrl = `http://127.0.0.1:${port}`;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForServer = async (child) => {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Vite exited before becoming ready with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      await wait(250);
    }
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
};

const startVite = async () => {
  const child = spawn(
    "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, BROWSER: "none" },
    },
  );

  let recentOutput = "";
  const collect = (chunk) => {
    recentOutput = `${recentOutput}${chunk.toString()}`.slice(-4000);
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);

  try {
    await waitForServer(child);
  } catch (error) {
    child.kill("SIGTERM");
    error.message = `${error.message}\n${recentOutput}`;
    throw error;
  }

  return child;
};

const stopVite = async (child) => {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await wait(500);
  if (child.exitCode === null) child.kill("SIGKILL");
};

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const vite = await startVite();

try {
  const page = await browser.newPage();
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto(baseUrl, { waitUntil: "networkidle0" });

  const result = await page.evaluate(
    async ({ targetCleanStreak, maxQuestions, reportLimit }) => {
      const [{ getBankPool }, { renderMixedContent }, { normalizeReadingDisplayText }] =
        await Promise.all([
          import("/src/data/questionBank.ts"),
          import("/src/lib/text/mathRendering.ts"),
          import("/src/lib/text/readingTextNormalization.ts"),
        ]);

      const pools = [
        ...getBankPool("math", "all"),
        ...getBankPool("reading", "all"),
      ];
      const resolvedTargetCleanStreak = targetCleanStreak === "all" ? pools.length : targetCleanStreak;

      const parser = new DOMParser();
      const imageStatus = new Map();
      const failures = [];
      const reportedFailureKeys = new Set();
      const issueTypes = new Map();
      let checked = 0;
      let cleanStreak = 0;

      const addIssueType = (type) => {
        issueTypes.set(type, (issueTypes.get(type) ?? 0) + 1);
      };

      const unescapedDollarCount = (value) => {
        let count = 0;
        for (let index = 0; index < value.length; index += 1) {
          if (value[index] !== "$") continue;
          let slashCount = 0;
          for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
            slashCount += 1;
          }
          if (slashCount % 2 === 0) count += 1;
        }
        return count;
      };

      const textFromHtml = (html) => {
        const document = parser.parseFromString(`<div>${html}</div>`, "text/html");
        document.querySelectorAll(".katex-mathml").forEach((node) => node.remove());
        document.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
        document.querySelectorAll("td, th").forEach((node) => node.append(" "));
        document.querySelectorAll("tr, caption").forEach((node) => node.append("\n"));
        document.querySelectorAll("p, div, li").forEach((node) => node.append("\n"));
        return (document.body.textContent ?? "")
          .replace(/\u00a0/g, " ")
          .replace(/[ \t]+\n/g, "\n")
          .replace(/\n[ \t]+/g, "\n")
          .replace(/[ \t]{2,}/g, " ")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
      };

      const hasVisibleRawDollarMath = (value) => {
        let cursor = 0;
        while (cursor < value.length) {
          if (value[cursor] !== "$") {
            cursor += 1;
            continue;
          }
          const closing = value.indexOf("$", cursor + 1);
          if (closing === -1) return false;
          const startsCurrency = /\d/.test(value[cursor + 1] ?? "");
          const nextAfterClosing = value[closing + 1] ?? "";
          const nextTwoAfterClosing = value.slice(closing + 1, closing + 3);
          if (startsCurrency && (/\d/.test(nextAfterClosing) || /^\.\d/.test(nextTwoAfterClosing))) {
            cursor = closing + 1;
            continue;
          }
          const candidate = value.slice(cursor + 1, closing).trim();
          const proseWords = candidate.match(/[A-Za-z]{3,}/g) ?? [];
          if (startsCurrency && proseWords.length > 0) {
            cursor += 1;
            continue;
          }
          if (value[cursor + 1] === "(" && /,\s*or\s*$/i.test(candidate)) {
            cursor += 1;
            continue;
          }
          const hasMathSymbol = /[\\^_{}=<>π√∠△°·×÷≤≥≠≈±−²³]/.test(candidate);
          const isCompactVariable = /^[A-Za-z][A-Za-z0-9]{0,3}$/.test(candidate);
          const isStandaloneMathNumber = /^[-+]?(?:\d[\d.,]*|\.\d+)$/.test(candidate);
          const isNumericExpression =
            /^[-+]?(?:\d[\d.,]*|\.\d+)(?:\s*(?:[+*/·×÷−-]|:)\s*[-+]?(?:\d[\d.,]*|\.\d+))+$/.test(candidate);
          if (candidate && proseWords.length < 2 && (hasMathSymbol || isCompactVariable || isStandaloneMathNumber || isNumericExpression)) {
            return true;
          }
          cursor += 1;
        }
        return false;
      };

      const rawInlineText = (value) =>
        value
          .replace(/\$([^$]*)\$/g, "$1")
          .replace(/\\text\{([^{}]*)\}/g, "$1")
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim();

      const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const inlineSpacingIssues = (field) => {
        const issues = [];
        const rendered = field.text.replace(/\s+/g, " ");
        const afterTagPattern = /<(em|strong|u)\b[^>]*>([\s\S]*?)<\/\1>([A-Za-z0-9])/gi;
        const beforeTagPattern = /([A-Za-z0-9])<(em|strong|u)\b[^>]*>([\s\S]*?)<\/\2>/gi;
        for (const match of field.raw.matchAll(afterTagPattern)) {
          const inner = match[2] ?? "";
          if (!/\s$/.test(inner)) continue;
          const token = rawInlineText(inner);
          const next = match[3] ?? "";
          const glued = `${token}${next}`;
          const gluedPattern = new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(glued)}(?=[^A-Za-z0-9]|$)`);
          if (token && next && gluedPattern.test(rendered)) {
            issues.push("inline HTML tag swallowed following space");
          }
        }
        for (const match of field.raw.matchAll(beforeTagPattern)) {
          const previous = match[1] ?? "";
          const inner = match[3] ?? "";
          if (!/^\s/.test(inner)) continue;
          const token = rawInlineText(inner);
          const glued = `${previous}${token}`;
          const gluedPattern = new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(glued)}(?=[^A-Za-z0-9]|$)`);
          if (previous && token && gluedPattern.test(rendered)) {
            issues.push("inline HTML tag swallowed preceding space");
          }
        }
        return issues;
      };

      const renderField = (question, label, value) => {
        const text = typeof value === "string" ? value : "";
        const normalized = question.subject === "reading" ? normalizeReadingDisplayText(text) : text;
        const html = renderMixedContent(normalized, { normalizeMath: question.subject === "math" });
        return { label, raw: text, html, text: textFromHtml(html) };
      };

      const hasUnclosedHtmlTag = (value) => {
        const tags = ["em", "strong", "u", "table", "tr", "td", "th", "ol", "ul", "li"];
        return tags.some((tag) => {
          const opens = value.match(new RegExp(`<${tag}\\b[^>]*>`, "gi"))?.length ?? 0;
          const closes = value.match(new RegExp(`</${tag}>`, "gi"))?.length ?? 0;
          return opens !== closes;
        });
      };

      const staticFieldIssues = (field) => {
        const issues = [];
        const { raw, html, text } = field;
        if (!raw.trim()) issues.push("blank rendered field");
        if (raw !== raw.trim()) issues.push("leading/trailing field whitespace");
        if (/\r/.test(raw)) issues.push("carriage return in field");
        if (/\t/.test(text)) issues.push("visible tab character");
        if (/[ \t]+\n/.test(text)) issues.push("visible trailing whitespace before newline");
        if (/�/.test(raw) || /�/.test(text)) issues.push("replacement character");
        if (hasUnclosedHtmlTag(raw) && hasUnclosedHtmlTag(html)) issues.push("unbalanced supported HTML tag");
        if (unescapedDollarCount(raw) % 2 === 1) issues.push("unmatched dollar math delimiter");
        if (/\\\(|\\\)|\\\[|\\\]/.test(text)) issues.push("visible TeX delimiter");
        if (hasVisibleRawDollarMath(text)) issues.push("visible raw dollar math");
        if (/\bkatex-error\b/i.test(html)) issues.push("KaTeX render error");
        issues.push(...inlineSpacingIssues(field));
        if (/<(?:em|strong|u)>\s*<\/(?:em|strong|u)>/i.test(html)) issues.push("empty inline HTML tag");
        if (/(?:<br\s*\/?>\s*){4,}/i.test(html)) issues.push("excessive consecutive line breaks");
        if (/\s+(?:[,;:!?]|\.(?!\d))/u.test(text)) issues.push("visible space before punctuation");
        if (/([([{])\s+/u.test(text)) issues.push("visible space after opening punctuation");
        if (/\s+([)\]}])/u.test(text)) issues.push("visible space before closing punctuation");
        if (/\S {2,}\S/.test(text.replace(/\u00a0/g, " "))) issues.push("visible repeated spaces");
        return issues;
      };

      const syntheticFixtures = [
        {
          name: "empty inline HTML and swallowed emphasis spacing",
          subject: "math",
          raw: "where <em>r </em>is measured and angle <em></em>with measure<em> a</em>°",
          includes: ["r is", "angle with measure a°"],
          rejects: [/ris/, /anglewith/, /<em>\s*<\/em>/i],
        },
        {
          name: "escaped math delimiter repair",
          subject: "math",
          raw: "Dividing both sides by \\$- 1\\$ results in $y=15$.",
          includes: ["results in"],
          rejects: [/\$-\s*1\$/],
        },
        {
          name: "currency in text command",
          subject: "math",
          raw: "The coupon was $\\text{\\$}63$ off.",
          includes: ["$63"],
          rejects: [/\\text\{\\\$\}/],
        },
        {
          name: "percent sign inside math",
          subject: "math",
          raw: "$\\left(100%\\text{of}115\\right)+\\left(40%\\text{of}115\\right)$",
          includes: ["of 115"],
          rejects: [],
        },
        {
          name: "leading decimal math",
          subject: "math",
          raw: "The correct answer is $.2$.",
          includes: [".2"],
          rejects: [/\$\.2\$/],
        },
        {
          name: "spaced negative math",
          subject: "math",
          raw: "The coordinates are $8, - 6$ and the values are $- 4$ and $- 3$.",
          includes: ["8", "−6", "−4", "−3"],
          rejects: [/\$8,\s*-\s*6\$/, /\$-\s*4\$/],
        },
        {
          name: "spaced negative variable math",
          subject: "math",
          raw: "The value of $- a$ is negative.",
          includes: ["−a"],
          rejects: [/\$-\s*a\$/],
        },
        {
          name: "unit text leading spaces",
          subject: "math",
          raw: "$\\left(\\text{ ft}^2\\right)$",
          includes: ["ft"],
          rejects: [/\(\s+ft/],
        },
        {
          name: "reading markdown emphasis trim",
          subject: "reading",
          raw: "clicks in * Manduca pellenia * to whistles in * Rhodinia fugax. *",
          includes: ["Manduca pellenia to"],
          rejects: [/\s{2,}/],
        },
        {
          name: "reading bracket spacing",
          subject: "reading",
          raw: "[ Mr. Ely] was regarded as learned.",
          includes: ["[Mr. Ely]"],
          rejects: [/\[\s+Mr\. Ely\]/],
        },
      ];

      const auditSyntheticFixtures = () => {
        const syntheticFailures = [];
        for (const fixture of syntheticFixtures) {
          const normalized = fixture.subject === "reading"
            ? normalizeReadingDisplayText(fixture.raw)
            : fixture.raw;
          const html = renderMixedContent(normalized, { normalizeMath: fixture.subject === "math" });
          const text = textFromHtml(html);
          const issues = [];
          if (/\bkatex-error\b/i.test(html)) issues.push("KaTeX render error");
          if (hasVisibleRawDollarMath(text)) issues.push("visible raw dollar math");
          for (const expected of fixture.includes) {
            if (!text.includes(expected)) issues.push(`missing expected text: ${expected}`);
          }
          for (const pattern of fixture.rejects) {
            if (pattern.test(text) || pattern.test(html)) issues.push(`matched rejected pattern: ${pattern}`);
          }
          if (issues.length) {
            for (const issue of issues) addIssueType(`synthetic ${issue}`);
            syntheticFailures.push({ name: fixture.name, raw: fixture.raw, text, issues });
          }
        }
        return syntheticFailures;
      };

      const checkImage = async (src) => {
        if (!src) return [];
        if (imageStatus.has(src)) return imageStatus.get(src);
        const url = new URL(src, window.location.origin).toString();
        let issues = [];
        try {
          const response = await fetch(url);
          if (!response.ok) issues = [`broken image asset (${response.status})`];
        } catch (error) {
          issues = [`broken image asset (${error.message})`];
        }
        imageStatus.set(src, issues);
        return issues;
      };

      const auditQuestion = async (question) => {
        const issues = [];
        const addFieldIssues = (field) => {
          for (const issue of staticFieldIssues(field)) {
            issues.push({ type: issue, field: field.label, excerpt: field.text.slice(0, 220) });
          }
        };

        if (!question.stableId || !question.sourceId) {
          issues.push({ type: "missing stable/source id", field: "metadata", excerpt: "" });
        }
        if (!question.prompt?.trim()) {
          issues.push({ type: "missing prompt", field: "prompt", excerpt: "" });
        }

        for (const [label, value] of [
          ["prompt", question.prompt],
          ["passage", question.passage],
          ["questionText", question.questionText],
          ["rationale", question.rationale],
        ]) {
          if (typeof value === "string" && value.trim()) addFieldIssues(renderField(question, label, value));
        }

        if (question.type === "multiple-choice") {
          if (!Array.isArray(question.choices) || question.choices.length === 0) {
            issues.push({ type: "multiple-choice question has no choices", field: "choices", excerpt: "" });
          } else {
            for (const choice of question.choices) {
              if (!choice.id?.trim()) {
                issues.push({ type: "choice missing id", field: "choices", excerpt: "" });
              }
              if (!choice.text?.trim() && !choice.image) {
                issues.push({ type: "choice has no renderable text or image", field: `choice ${choice.id}`, excerpt: "" });
              }
              if (choice.text?.trim()) addFieldIssues(renderField(question, `choice ${choice.id}`, choice.text));
              if (choice.image) {
                for (const issue of await checkImage(choice.image)) {
                  issues.push({ type: issue, field: `choice ${choice.id} image`, excerpt: choice.image });
                }
              }
            }
          }
        }

        if (Array.isArray(question.questionImages)) {
          for (const image of question.questionImages) {
            for (const issue of await checkImage(image.src)) {
              issues.push({ type: issue, field: "question image", excerpt: image.src });
            }
          }
        }

        return issues;
      };

      const syntheticFailures = auditSyntheticFixtures();

      for (let index = 0; checked < maxQuestions && cleanStreak < resolvedTargetCleanStreak; index += 1) {
        const question = pools[index % pools.length];
        checked += 1;
        const issues = await auditQuestion(question);
        if (issues.length) {
          cleanStreak = 0;
          for (const issue of issues) addIssueType(issue.type);
          const failureKey = `${question.stableId}:${issues.map((issue) => `${issue.field}:${issue.type}`).join("|")}`;
          if (!reportedFailureKeys.has(failureKey) && failures.length < reportLimit) {
            reportedFailureKeys.add(failureKey);
            failures.push({
              checked,
              stableId: question.stableId,
              sourceId: question.sourceId,
              bankType: question.bankType,
              subject: question.subject,
              questionNumber: question.id,
              testName: question.testName,
              issues,
            });
          }
        } else {
          cleanStreak += 1;
        }
      }

      return {
        poolSize: pools.length,
        checked,
        cleanStreak,
        targetCleanStreak: resolvedTargetCleanStreak,
        syntheticFailures,
        failures,
        issueTypes: Object.fromEntries([...issueTypes.entries()].sort((a, b) => b[1] - a[1])),
      };
    },
    { targetCleanStreak, maxQuestions, reportLimit },
  );

  if (browserErrors.length) {
    result.browserErrors = browserErrors.slice(0, reportLimit);
  }

  console.log(JSON.stringify(result, null, 2));
  if (result.cleanStreak < result.targetCleanStreak || result.browserErrors?.length || result.syntheticFailures?.length) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  await stopVite(vite);
}
