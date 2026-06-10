import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const explanationDir = path.join(root, "public/explanations");

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

const reportLimit = args.has("limit") ? Number.parseInt(args.get("limit"), 10) : 80;
const jsonOutput = args.get("format") === "json";
const failOnIssues = args.get("fail") !== "false";
const typeFilter = args.get("type") ?? "";

const readText = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(readText(relativePath));

const stripHtml = (value) =>
  String(value ?? "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|li|div|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|ndash|mdash);/gi, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalize = (value) =>
  stripHtml(value)
    .replace(/\\(?:left|right|text|mathrm|operatorname)\b/g, " ")
    .replace(/[{}$]/g, " ")
    .replace(/\\[a-z]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const extractUnofficialQuestions = () => {
  const text = readText("src/data/unofficialQuestions.ts");
  const marker = "export const questions";
  const markerIndex = text.indexOf(marker);
  const equalsIndex = text.indexOf("=", markerIndex);
  const start = text.indexOf("[", equalsIndex);
  const end = text.lastIndexOf("]");
  if (markerIndex === -1 || equalsIndex === -1 || start === -1 || end === -1 || end <= start) {
    throw new Error("Could not locate unofficial questions array");
  }
  return JSON.parse(text.slice(start, end + 1));
};

const isMathQuestion = (question) => {
  if (question?.section) return question.section === "Math";
  if (question?.category?.subject) return question.category.subject === "Math";
  return false;
};

const buildSourceIndex = () => {
  const index = new Map();
  for (const question of readJson("src/data/questions/math_past.json")) {
    if (isMathQuestion(question) && question.id) index.set(String(question.id), { bank: "past", question });
  }
  for (const question of extractUnofficialQuestions()) {
    if (isMathQuestion(question) && question.id) index.set(String(question.id), { bank: "unofficial", question });
  }
  return index;
};

const asRecord = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : null;
const asString = (value) => typeof value === "string" ? value : "";
const asStringArray = (value) =>
  Array.isArray(value)
    ? value
        .map((item) => {
          if (typeof item === "string") return item;
          const record = asRecord(item);
          return record ? asString(record.latex) || asString(record.expression) : "";
        })
        .filter(Boolean)
    : [];

const normalizeStep = (step, index) => {
  if (typeof step === "string") {
    return { title: `Step ${index + 1}`, content: step, formula: "", expressions: [] };
  }
  const record = asRecord(step);
  if (!record) return { title: `Step ${index + 1}`, content: "", formula: "", expressions: [] };
  const graphExpressions = Array.isArray(record.desmosGraphs)
    ? record.desmosGraphs.flatMap((graph) => asStringArray(asRecord(graph)?.expressions))
    : [];
  return {
    title: asString(record.title) || asString(record.heading) || asString(record.label) || `Step ${index + 1}`,
    content:
      asString(record.content) ||
      asString(record.text) ||
      asString(record.step) ||
      asString(record.explanation) ||
      asString(record.explanationHtml),
    formula: asString(record.formula),
    expressions: [...asStringArray(record.desmosExpressions), ...graphExpressions],
  };
};

const choiceText = (question) => (question.choices ?? []).map((choice) => choice.text ?? "").join(" ");
const sourceText = (question) => [question.text, choiceText(question), question.rationale].filter(Boolean).join(" ");
const hasEquationLikeText = (text) =>
  /(?:[xy]|[fgh]\s*\(\s*[a-z]\s*\)|[fgh]\s*\()\s*(?:=|~)|(?:=|~)\s*(?:[xy]|[fgh]\s*\(|-?\d|\\frac)/i.test(text);
const hasGraphOnlyPrompt = (question) =>
  /\bgraph\b/i.test(question.text ?? "") &&
  /\bshown\b/i.test(question.text ?? "") &&
  !hasEquationLikeText(`${question.text ?? ""} ${choiceText(question)}`);
const hasVisualPrompt = (question) =>
  /\b(?:graph|scatterplot|scatter plot|line of best fit|histogram|bar graph|line graph|shaded region|figure|shown)\b/i.test(
    question.text ?? "",
  );

const DESMOS_CONTEXT_RE = /\b(?:desmos|graph|plot|row|table|calculator|overlay|overlap|confirm|check|verify|below|shown|touch|intersect|same)\b/i;
const REGRESSION_METHOD_TEXT_RE =
  /\b(?:custom regression|regression row|linear regression|exponential regression|desmos regression|table regression|run\s+\w*\s*regression|fit\s+\w*\s*regression)\b/i;
const REGRESSION_EXPRESSION_RE = /~/;
const VISIBLE_REGRESSION_ROW_RE = /[a-z]_[0-9]\s*(?:\\sim|~)|(?:\\sim|~)\s*[a-z]_[0-9]/i;
const DESMOS_CLAIM_RE = /\bDesmos (?:gives|returns|reports)\b/i;
const REGRESSION_WORD_RE = /\bregression\b/i;
const AWKWARD_CALCULATOR_TEXT_RE =
  /\b(?:run The calculation|Type The calculation|Use The calculation|entering them in The calculation|matching the regression|regression values|regression parameters|regression equation|regression check|table-regression|linear-regression|exponential-regression|one-row regression|no new regression|direct calculation value|a the direct|fit [^.]{0,80} in Desmos|put [^.]{0,80} in Desmos as a table|put [^.]{0,80} into a Desmos table|run in Desmos|solving gives|type Desmos solves)\b/i;
const DENSE_BULLET_RE = /(?:^|<br\s*\/?>|\n)\s*[•*-]\s+/;
const RAW_BULLET_RE = /•/;
const ESCAPED_HTML_TAG_RE =
  /\\lt\s*(?:\/\s*)?(?:br|li|ul|ol|strong|em|p|span|div|table|thead|tbody|tr|td|th)\b/i;
const FRAGILE_INTERVAL_MATH_IN_HTML_RE =
  /<(?:li|p|div)\b[^>]*>[^<]*\$\[[^$]+\)\$|Through\s+\$\[[^$]+\)\$/i;
const GRAPH_EQUATION_CONTENT_RE =
  /\b(?:equation|line|parabola|curve|function|model)\b[^.;:\n]{0,90}(?:[fgh]\s*\(\s*x\s*\)|y)\s*=\s*[^.;\n]*x/i;
const BROKEN_STYLE_RE =
  /\b(?:BecaUse|so Use the table points directly|Use the table points directly\. Use|fastest check is to fit)\b/;
const MALFORMED_TEX_RE =
  /(?:[0-9a-z]\s*cdot|\\\s+Rightarrow|(?<!\\)(?:left|right)\s*[\(\[]|(?<!\\)\bquad(?:\\text|\s+[a-z])|[\f\r])/i;
const HTML_ENTITY_IN_MATH_RE = /&(lt|gt|le|ge);/i;
const HTML_ARROW_ENTITY_RE = /&rArr;|&Rightarrow;/i;
const QUADRATIC_TOOL_RE = /\b(?:discriminant|quadratic formula)\b/i;
const QUADRATIC_TOOL_CONTEXT_RE =
  /\b(?:exactly one|one real|no real|two distinct|repeated|touch|tangent|intersect|solutions?|roots?|factor|does not factor|opens|crosses|parabola|because|tells us|means|how many real)\b/i;
const WEAK_DESMOS_CONTEXT_RE =
  /^(?:check(?: the (?:result|answer))?|confirm(?: with (?:a )?graph)?|desmos(?: graph)?(?: check)?|graph check)$/i;
const TOOL_FIRST_TITLE_RE = /^(?:use|apply) the (?:discriminant|quadratic formula)(?: test| condition)?$/i;

const hasRawLessThanInMath = (value) => {
  const text = String(value ?? "");
  for (let cursor = 0; cursor < text.length;) {
    const start = text.slice(cursor).search(/(?<!\\)\$/);
    if (start === -1) return false;
    const open = cursor + start;
    const delimiterLength = text[open + 1] === "$" && text[open] !== "\\" ? 2 : 1;
    let close = open + delimiterLength;
    while (close < text.length) {
      if (
        text[close] === "$" &&
        text[close - 1] !== "\\" &&
        (delimiterLength === 1 || text[close + 1] === "$")
      ) {
        const body = text.slice(open + delimiterLength, close);
        if (/(?<!\\)</.test(body)) return true;
        cursor = close + delimiterLength;
        break;
      }
      close += 1;
    }
    if (close >= text.length) return false;
  }
  return false;
};

const hasHtmlEntityInMath = (value) => {
  const text = String(value ?? "");
  for (let cursor = 0; cursor < text.length;) {
    const start = text.slice(cursor).search(/(?<!\\)\$/);
    if (start === -1) return false;
    const open = cursor + start;
    const delimiterLength = text[open + 1] === "$" && text[open] !== "\\" ? 2 : 1;
    let close = open + delimiterLength;
    while (close < text.length) {
      if (
        text[close] === "$" &&
        text[close - 1] !== "\\" &&
        (delimiterLength === 1 || text[close + 1] === "$")
      ) {
        const body = text.slice(open + delimiterLength, close);
        if (HTML_ENTITY_IN_MATH_RE.test(body)) return true;
        cursor = close + delimiterLength;
        break;
      }
      close += 1;
    }
    if (close >= text.length) return false;
  }
  return false;
};

const auditStep = ({ fileName, question, step, stepIndex }) => {
  const issues = [];
  const cleanContent = stripHtml(step.content);
  const contentWithTitle = `${step.title} ${cleanContent}`;
  const hasExpressions = step.expressions.length > 0;

  if (hasExpressions && (!DESMOS_CONTEXT_RE.test(contentWithTitle) || (WEAK_DESMOS_CONTEXT_RE.test(step.title) && cleanContent.length < 120))) {
    issues.push({
      type: "contextlessDesmos",
      message: "Desmos expressions appear without nearby text explaining what the graph/table is checking.",
      stepIndex,
    });
  }

  if (
    hasVisualPrompt(question) &&
    !question.rationale &&
    (REGRESSION_METHOD_TEXT_RE.test(contentWithTitle) || step.expressions.some((expression) => REGRESSION_EXPRESSION_RE.test(expression)))
  ) {
    issues.push({
      type: "visualRegressionWithoutRationale",
      message: "Visual prompt without source rationale should not rely on regression/table-fit wording or rows.",
      stepIndex,
    });
  }

  if (
    REGRESSION_METHOD_TEXT_RE.test(contentWithTitle) ||
    VISIBLE_REGRESSION_ROW_RE.test(contentWithTitle) ||
    step.expressions.some((expression) => REGRESSION_EXPRESSION_RE.test(expression))
  ) {
    issues.push({
      type: "opaqueRegressionMethod",
      message: "Avoid opaque regression rows; explain the direct SAT relationship or explicit graph/choice check.",
      stepIndex,
    });
  }

  if (DESMOS_CLAIM_RE.test(contentWithTitle)) {
    issues.push({
      type: "opaqueDesmosClaim",
      message: "Do not rely on 'Desmos gives/returns/reports' without showing the underlying math or visible check.",
      stepIndex,
    });
  }

  if (REGRESSION_WORD_RE.test(contentWithTitle)) {
    issues.push({
      type: "regressionWording",
      message: "Avoid regression wording in student-facing explanations; state the direct relationship or visible graph check.",
      stepIndex,
    });
  }

  if (AWKWARD_CALCULATOR_TEXT_RE.test(contentWithTitle)) {
    issues.push({
      type: "awkwardCalculatorWording",
      message: "Generated calculator phrasing needs to be rewritten into direct, readable solution prose.",
      stepIndex,
    });
  }

  if (BROKEN_STYLE_RE.test(contentWithTitle)) {
    issues.push({
      type: "brokenGeneratedStyle",
      message: "Generated rewrite produced broken casing, duplicated instructions, or awkward fit wording.",
      stepIndex,
    });
  }

  if (MALFORMED_TEX_RE.test(step.content) || MALFORMED_TEX_RE.test(step.formula)) {
    issues.push({
      type: "malformedTeX",
      message: "Renderable content contains malformed TeX such as xcdot, wcdot, \\frac12, or spaced \\Rightarrow.",
      stepIndex,
    });
  }

  if (
    stepIndex === 0 &&
    QUADRATIC_TOOL_RE.test(contentWithTitle) &&
    (TOOL_FIRST_TITLE_RE.test(step.title) || !QUADRATIC_TOOL_CONTEXT_RE.test(cleanContent.slice(0, 280)))
  ) {
    issues.push({
      type: "formulaFirstNoContext",
      message: "First step should frame the solution goal before naming the discriminant or quadratic formula.",
      stepIndex,
    });
  }

  if (step.formula && !/(?:formula|discriminant|area|volume|slope|distance|use|apply|because|when|if)/i.test(contentWithTitle)) {
    issues.push({
      type: "orphanFormula",
      message: "Step has a formula card without enough context in the step text.",
      stepIndex,
    });
  }

  if (
    cleanContent.length > 280 &&
    (DENSE_BULLET_RE.test(step.content) || /\bcumulative counts?\b/i.test(cleanContent) || /\bhistogram\b/i.test(cleanContent)) &&
    !/<(?:ul|ol|table)\b/i.test(step.content)
  ) {
    issues.push({
      type: "denseDataParagraph",
      message: "Data-heavy explanation should use HTML list/table structure instead of a dense paragraph.",
      stepIndex,
    });
  }

  if (RAW_BULLET_RE.test(step.content) && !/<(?:ul|ol)\b/i.test(step.content)) {
    issues.push({
      type: "rawBulletList",
      message: "Use structured <ul>/<ol> list markup instead of raw bullet characters in renderable content.",
      stepIndex,
    });
  }

  if (hasRawLessThanInMath(step.content) || hasRawLessThanInMath(step.formula)) {
    issues.push({
      type: "rawLessThanInMath",
      message: "Use \\lt or &lt; instead of a raw < inside math content.",
      stepIndex,
    });
  }

  if (hasHtmlEntityInMath(step.content) || hasHtmlEntityInMath(step.formula)) {
    issues.push({
      type: "htmlEntityInMath",
      message: "Use TeX comparators such as \\lt and \\gt inside math spans instead of HTML entities.",
      stepIndex,
    });
  }

  if (HTML_ARROW_ENTITY_RE.test(step.content) || HTML_ARROW_ENTITY_RE.test(step.formula)) {
    issues.push({
      type: "htmlArrowEntity",
      message: "Use \\Rightarrow inside math content instead of an HTML arrow entity.",
      stepIndex,
    });
  }

  if (ESCAPED_HTML_TAG_RE.test(step.content) || ESCAPED_HTML_TAG_RE.test(step.formula)) {
    issues.push({
      type: "escapedHtmlTag",
      message: "Renderable content contains an escaped HTML tag such as \\lt li> or \\lt br/>.",
      stepIndex,
    });
  }

  if (FRAGILE_INTERVAL_MATH_IN_HTML_RE.test(step.content)) {
    issues.push({
      type: "fragileIntervalMathInHtml",
      message: "Interval notation inside HTML list/paragraph markup can leak tags in the rendered explanation; use plain text ranges or safer TeX.",
      stepIndex,
    });
  }

  if (hasGraphOnlyPrompt(question) && GRAPH_EQUATION_CONTENT_RE.test(step.content)) {
    issues.push({
      type: "inventedGraphEquationTextRisk",
      message: "Graph-only prompt has explanation text asserting an equation not given in the source.",
      stepIndex,
    });
  }

  if (hasGraphOnlyPrompt(question) && hasExpressions) {
    const source = normalize(sourceText(question));
    const invented = step.expressions.filter((expression) => {
      if (/^\s*\(-?\d|^\s*\(?\s*-?\\frac/.test(expression)) return false;
      const plain = normalize(expression);
      return hasEquationLikeText(expression) && plain.length > 3 && !source.includes(plain.slice(0, Math.min(plain.length, 24)));
    });
    if (invented.length) {
      issues.push({
        type: "inventedGraphEquationRisk",
        message: `Graph-only prompt has Desmos equation rows not present in the source: ${invented.slice(0, 3).join("; ")}`,
        stepIndex,
      });
    }
  }

  return issues.map((issue) => ({
    file: `public/explanations/${fileName}`,
    questionId: fileName.replace(/\.json$/, ""),
    ...issue,
  }));
};

const sourceIndex = buildSourceIndex();
const issues = [];

for (const fileName of readdirSync(explanationDir).filter((file) => file.endsWith(".json")).sort()) {
  const id = fileName.replace(/\.json$/, "");
  const source = sourceIndex.get(id);
  const filePath = path.join(explanationDir, fileName);
  if (!existsSync(filePath)) continue;
  let explanation;
  try {
    explanation = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    issues.push({
      type: "parse",
      file: `public/explanations/${fileName}`,
      questionId: id,
      stepIndex: null,
      message: error.message,
    });
    continue;
  }
  if (explanation?.section && explanation.section !== "Math") continue;
  if (!source && !explanation?.section) continue;
  const steps = Array.isArray(explanation.steps)
    ? explanation.steps.map(normalizeStep)
    : [];
  steps.forEach((step, stepIndex) => {
    issues.push(...auditStep({ fileName, question: source?.question ?? {}, step, stepIndex }));
  });
}

const reportedIssues = typeFilter ? issues.filter((issue) => issue.type === typeFilter) : issues;

const summary = {
  issues: reportedIssues.length,
  totalIssues: issues.length,
  byType: reportedIssues.reduce((counts, issue) => {
    counts[issue.type] = (counts[issue.type] ?? 0) + 1;
    return counts;
  }, {}),
  reportLimit,
  typeFilter: typeFilter || null,
};

if (jsonOutput) {
  console.log(JSON.stringify({ summary, issues: reportedIssues.slice(0, reportLimit) }, null, 2));
} else {
  console.log("Explanation quality audit");
  console.log(`Issues: ${summary.issues}`);
  for (const [type, count] of Object.entries(summary.byType)) console.log(`${type}: ${count}`);
  for (const issue of reportedIssues.slice(0, reportLimit)) {
    console.log(`- [${issue.type}] ${issue.file} step ${issue.stepIndex + 1}: ${issue.message}`);
  }
}

if (failOnIssues && reportedIssues.length) {
  process.exitCode = 1;
}
