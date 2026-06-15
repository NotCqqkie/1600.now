import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const explanationDir = path.join(root, "public", "explanations");
const reportPath = path.join(root, "tmp", "math-explanation-shortcut-review.json");

const readJson = (relativePath) => JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
const writeJson = (filePath, value) => writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
const readBaselineJson = (relativePath, fallbackPath) => {
  try {
    return JSON.parse(execFileSync("git", ["show", `HEAD:${relativePath}`], { cwd: root, encoding: "utf8" }));
  } catch {
    return JSON.parse(readFileSync(fallbackPath, "utf8"));
  }
};

const mathPast = readJson("src/data/questions/math_past.json").map((question) => ({ bank: "past", question }));
const unofficialMath = readJson("src/data/questions/unofficial_math.json").map((question) => ({
  bank: "unofficial",
  question,
}));

const targetQuestions = [...mathPast, ...unofficialMath];

const asRecord = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : null;
const asString = (value) => typeof value === "string" ? value : "";
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const stripHtml = (value) =>
  String(value ?? "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|ndash|mdash);/gi, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const hasVariable = (value, variable) =>
  new RegExp(`(^|[^A-Za-z])${escapeRegExp(variable)}(?![A-Za-z])`).test(String(value ?? ""));

const hasXy = (value) => hasVariable(value, "x") && hasVariable(value, "y");
const hasInequality = (value) => /\\(?:lt|gt|le|ge)\b|[<>]/.test(String(value ?? ""));

const mathBlocks = (value) =>
  [...String(value ?? "").matchAll(/(?<!\\)\$([^$]+?)(?<!\\)\$/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);

const equationBlocks = (question) => mathBlocks(question.text).filter((block) => /=/.test(block));

const normalizeExpression = (value) =>
  String(value ?? "")
    .replace(/\\lt/g, "<")
    .replace(/\\gt/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const choiceForAnswer = (question) => {
  const answer = String(question.correctAnswer ?? "");
  if (!/^[A-D]$/.test(answer)) return null;
  return question.choices?.find((choice) => choice.id === answer) ?? null;
};

const isMathWrapped = (value) => /^\s*\$[\s\S]*\$\s*$/.test(String(value ?? ""));

const formatAnswerValue = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (isMathWrapped(text) || /<[^>]+>/.test(text)) return text;
  if (/^-?\d+(?:\.\d+)?(?:,\s*-?\d+(?:\.\d+)?)*$/.test(text) && !/^\d{1,3}(?:,\d{3})+$/.test(text)) {
    const pieces = text.split(/\s*,\s*/).filter(Boolean);
    if (pieces.length > 1) return pieces.map((piece) => `$${piece}$`).join(" or ");
  }
  if (/^-?(?:\d+(?:,\d{3})*|\d*\.\d+)(?:\/-?(?:\d+(?:,\d{3})*|\d*\.\d+))?$/.test(text)) return `$${text}$`;
  return text;
};

const answerPhrase = (question) => {
  const answer = String(question.correctAnswer ?? "").trim();
  const choice = choiceForAnswer(question);
  if (choice) return `<strong>${answer}</strong>, ${choice.text}`;
  return `<strong>${formatAnswerValue(answer)}</strong>`;
};

const answerValueOnly = (question) => {
  const choice = choiceForAnswer(question);
  return choice ? choice.text : String(question.correctAnswer ?? "").trim();
};

const existingStepText = (explanation) =>
  Array.isArray(explanation.steps)
    ? explanation.steps.map((step) => `${asString(step?.title)} ${asString(step?.content)}`).join(" ")
    : "";

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

const keepStep = (step) => {
  const record = asRecord(step);
  if (!record) return null;
  const title = asString(record.title) || asString(record.heading) || asString(record.label);
  const content =
    asString(record.content) ||
    asString(record.text) ||
    asString(record.step) ||
    asString(record.explanation) ||
    asString(record.explanationHtml);
  if (!content) return null;
  const clean = `${title} ${stripHtml(content)}`.toLowerCase();
  if (/^fastest path:/i.test(title) || /^fastest check:/i.test(title) || /^algebra check$/i.test(title)) return null;
  if (/confirm the answer/.test(clean)) return null;
  if (/the final check is to match the computed result to the answer choices/.test(clean)) return null;
  return {
    title: title || "Explanation",
    content,
    ...(asString(record.formula) ? { formula: asString(record.formula) } : {}),
    ...(asStringArray(record.desmosExpressions).length
      ? { desmosExpressions: asStringArray(record.desmosExpressions) }
      : {}),
    ...(Array.isArray(record.desmosGraphs) ? { desmosGraphs: record.desmosGraphs } : {}),
  };
};

const oldStepsForMix = (explanation, limit = 3) => {
  const steps = Array.isArray(explanation.steps) ? explanation.steps.map(keepStep).filter(Boolean) : [];
  return steps.slice(0, limit);
};

const directCoordinateAsk = (text) =>
  /(?:what is|find)(?: the)? (?:a )?(?:possible )?value of\s*(?:\$)?[xy](?:\$)?(?:\b|[\s?.])/i.test(text) ||
  /\b[xy]-coordinate\b/i.test(text);

const solutionPointAsk = (text) =>
  /what is(?: the)? solution\s*(?:\$)?\(x,\s*y\)(?:\$)?\s*to/i.test(text) ||
  /what is(?: the)? solution\s*(?:\$)?\(x,\s*y\)(?:\$)?/i.test(text) ||
  /solution\s*(?:\$)?\(x,\s*y\)(?:\$)?\s*\?/i.test(text);

const intersectionCountAsk = (text) =>
  /how many points.*(?:intersect|meet)|number of (?:solutions|intersection points)/i.test(text);

const systemContext = (question, text) =>
  /Systems of two linear equations/i.test(question.skill ?? "") ||
  /given system|system of equations|graphs? of the given equations|equations in the given system/i.test(text);

const directFunctionTableAsk = (question) => {
  const text = question.text ?? "";
  return (
    /(?:function\s+[a-z]\s+is defined by|\b[fghp]\s*\(\s*x\s*\)\s*=)/i.test(text) &&
    /(?:what is (?:the value of )?\$?[fghp]\s*\(\s*-?\d|for what value of\s*\$?x\$?\s+(?:is|does)|according to the function|when\s+\$?x\$?\s*=)/i.test(
      text,
    ) &&
    !/table shows|graph.*shown|shown.*graph|constant|maximum|minimum|intercept|zeros?/i.test(text)
  );
};

const desmosSafeExpression = (expression) => {
  const identifiers = [...String(expression ?? "").matchAll(/[A-Za-z]+/g)].map((match) => match[0]);
  const allowed = new Set([
    "x",
    "y",
    "f",
    "g",
    "h",
    "p",
    "sqrt",
    "frac",
    "left",
    "right",
    "cdot",
    "times",
    "pi",
    "sin",
    "cos",
    "tan",
    "log",
    "ln",
  ]);
  return identifiers.every((identifier) => allowed.has(identifier));
};

const planForQuestion = (bank, question, explanation) => {
  const text = question.text ?? "";
  const equations = equationBlocks(question).map(normalizeExpression);
  const joinedEquations = equations.join(" ");
  const existingText = existingStepText(explanation);

  if (
    equations.length >= 2 &&
    hasXy(joinedEquations) &&
    !hasInequality(joinedEquations) &&
    systemContext(question, text) &&
    (directCoordinateAsk(text) || solutionPointAsk(text) || intersectionCountAsk(text)) &&
    !/which system|which of the following systems|for each real number|tables are all|represented by the following/i.test(text)
  ) {
    return buildSystemPlan(question, equations);
  }

  if (directFunctionTableAsk(question)) return buildFunctionPlan(question, explanation);

  if (
    equations.length === 1 &&
    hasVariable(joinedEquations, "x") &&
    !hasVariable(joinedEquations, "y") &&
    !hasInequality(joinedEquations) &&
    /solution to the given equation|what value of\s*(?:\$)?x(?:\$)?(?:\b|[\s?.])|for what value of\s*(?:\$)?x(?:\$)?(?:\b|[\s?.])|zeros? of the function|x-intercept|minimum value|maximum value|greatest solution|positive solution/i.test(
      text,
    ) &&
    !/constant|integer|least possible|greatest possible|exactly one real|no real solutions|has no real|cannot|not be|table shows|graph.*shown|shown.*graph|value of\s*(?:\$)?x\s*[-+]/i.test(
      text,
    )
  ) {
    return buildSingleEquationPlan(question, equations[0], explanation);
  }

  if (
    /Equivalent expressions/i.test(question.skill ?? "") &&
    question.type === "multiple-choice" &&
    /which .*?(?:expression|equation|form|function).*?equivalent|equivalent forms? of/i.test(text)
  ) {
    return buildEquivalencePlan(question, explanation);
  }

  if (
    question.type === "multiple-choice" &&
    /^(Algebra|Advanced Math)$/.test(question.domain ?? "") &&
    equations.length &&
    /solution to the given equation|which of the following is a solution/i.test(text) &&
    !/can be written as|what is the value of\s*(?:\$)?\\frac|which equation|which function|represents|equivalent|cannot|not be|least|greatest|exactly|no real|table shows|graph.*shown|shown.*graph/i.test(
      text,
    )
  ) {
    return buildChoicePlan(question, explanation);
  }

  if (
    /each value .* greater than|each value .* less than|data set .* created by adding|data set .* created by subtracting/i.test(
      text,
    ) &&
    /mean|median|range|standard deviation/i.test(text)
  ) {
    return buildShiftedDataPlan(question, explanation);
  }

  if (geometryShortcutAsk(question, existingText)) return buildGeometryPlan(question, explanation);

  return { decision: "keep-current", changed: false, reason: "Existing explanation kept after shortcut review." };
};

const buildSystemPlan = (question, equations) => {
  const expressions = equations.filter(desmosSafeExpression);
  const value = formatAnswerValue(answerValueOnly(question));
  const asksCount = intersectionCountAsk(question.text ?? "");
  const asksPoint = solutionPointAsk(question.text ?? "");
  const asksY = /value of\s*(?:\$)?y(?:\$)?|y-coordinate/i.test(question.text ?? "");
  const asksX = /value of\s*(?:\$)?x(?:\$)?|x-coordinate/i.test(question.text ?? "");
  const readTarget = asksPoint
    ? "the full intersection point"
    : asksCount
      ? "the number of intersections"
      : asksY
        ? "the y-coordinate"
        : asksX
          ? "the x-coordinate"
          : "the requested coordinate";

  return {
    decision: "desmos-system-intersection",
    changed: true,
    reason: "A graph intersection gives the requested system value faster than rearranging the equations.",
    steps: [
      {
        title: "Fastest path: graph the equations as written",
        content: `Type the equations into Desmos exactly as they appear, one per row:<br/>${equations
          .map((equation) => `$$${equation}$$`)
          .join("<br/>")}<br/>You do not need to solve or rearrange them first.`,
        ...(expressions.length === equations.length ? { desmosExpressions: expressions } : {}),
      },
      {
        title: `Read ${readTarget}`,
        content: asksCount
          ? `The graphs show ${value} intersection point(s), so the matching answer is ${answerPhrase(question)}.`
          : `Click the intersection point and read ${readTarget}. It matches ${answerPhrase(question)}.`,
      },
      {
        title: "Why this works",
        content:
          "A solution to a system is exactly a point that lies on every graph in the system. Desmos is showing the same shared point that substitution or elimination would find.",
      },
    ],
  };
};

const buildFunctionPlan = (question, explanation) => {
  const value = formatAnswerValue(answerValueOnly(question));
  return {
    decision: "direct-function-table",
    changed: true,
    reason: "Direct function entry or a calculator table is the shortest safe method.",
    steps: [
      {
        title: "Fastest path: use the function table",
        content: /for what value of/i.test(question.text ?? "")
          ? `Enter the function in Desmos or a calculator table and scan for the row with the output named in the question. The input that works gives ${answerPhrase(question)}. This is just a table lookup, and the arithmetic below confirms the same value.`
          : `Enter the function in Desmos or a calculator table, then plug in the requested input. The output is ${value}, so the answer is ${answerPhrase(question)}. This is just a one-row lookup, and the arithmetic below confirms the table value.`,
      },
      ...oldStepsForMix(explanation, 2),
    ],
  };
};

const buildSingleEquationPlan = (question, equation, explanation) => {
  const value = formatAnswerValue(answerValueOnly(question));
  const expressions = desmosSafeExpression(equation) ? [equation] : [];
  const graphLanguage = /minimum|maximum|x-intercept|zeros?|greatest solution|positive solution/i.test(question.text ?? "")
    ? "Graph it and use the visible intercept, root, or vertex the question asks for."
    : "Graph or solve it directly and read the x-value that works.";
  return {
    decision: "desmos-single-equation",
    changed: true,
    reason: "A graph/table solve gives the requested value faster, while the old algebra remains as verification.",
    steps: [
      {
        title: "Fastest path: graph or solve the equation",
        content: `Type the equation into Desmos as written:<br/>$$${equation}$$${graphLanguage} The requested value is ${value}.`,
        ...(expressions.length ? { desmosExpressions: expressions } : {}),
      },
      ...oldStepsForMix(explanation, 3),
    ],
  };
};

const buildEquivalencePlan = (question, explanation) => ({
  decision: "desmos-equivalence-check",
  changed: true,
  reason: "A graph/table comparison is a fast check, but the algebraic proof is kept to avoid false one-point identity checks.",
  steps: [
    {
      title: "Fastest check: compare a table or graph",
      content: `For an equivalent-expression question, enter the original expression and the answer choices in a calculator table or graph. The correct choice must match for several inputs, not just one. The matching choice is ${answerPhrase(question)}.`,
    },
    {
      title: "Algebra check",
      content:
        "Use the work below to confirm the identity for every allowed input. This matters because one random matching input is only a quick screen, not a proof that two expressions are always equivalent.",
    },
    ...oldStepsForMix(explanation, 3),
  ],
});

const buildChoicePlan = (question, explanation) => ({
  decision: "try-answer-choices",
  changed: true,
  reason: "The answer choices can be tested directly in the equation.",
  steps: [
    {
      title: "Fastest path: try the choices",
      content: `Because the choices give possible solutions, plug them into the equation instead of solving from scratch. The only choice that satisfies the equation is ${answerPhrase(question)}.`,
    },
    ...oldStepsForMix(explanation, 3),
  ],
});

const buildShiftedDataPlan = (question, explanation) => ({
  decision: "shifted-data-shortcut",
  changed: true,
  reason: "Shifted data sets have a direct mean/median/range shortcut.",
  steps: [
    {
      title: "Fastest path: track what changes",
      content:
        "When the same amount is added to every value, the mean and median move by that amount. The range and standard deviation stay the same because the spacing between values does not change.",
    },
    ...oldStepsForMix(explanation, 3),
  ],
});

const geometryShortcutAsk = (question, existingText) => {
  if (question.domain !== "Geometry and Trigonometry") return false;
  if (/draw|sketch|mark|label|from the figure|in the figure/i.test(existingText)) return false;
  return /figure|shown|triangle|angle|circle|radius|diameter|area|volume|similar|congruent|right triangle|prism|cylinder|cone|sphere/i.test(
    `${question.text ?? ""} ${question.skill ?? ""}`,
  );
};

const geometryLeadContent = (question) => {
  const skill = question.skill ?? "";
  const text = question.text ?? "";
  if (/Right triangles and trigonometry/i.test(skill)) {
    return "Label the side pair for the named angle first: opposite, adjacent, and hypotenuse. Then pick the matching shortcut, such as SOH/CAH/TOA, complementary trig values, or a special right-triangle ratio.";
  }
  if (/Lines, angles, and triangles/i.test(skill)) {
    return "Mark the given angle relationships on the figure first: equal angles, vertical angles, supplementary angles, parallel-line angles, and triangle sums of $180^\\circ$. Most of these questions become a short angle chase once the givens are marked.";
  }
  if (/Circles/i.test(skill)) {
    if (/xy-plane|equation|center|radius|point/i.test(text)) {
      return "For coordinate-circle questions, read the center and radius from the equation or graph the circle as a check. For diagram facts, mark equal radii, diameters, tangents, and arcs before doing algebra.";
    }
    return "Mark the circle facts first: radii are equal, a diameter sets up a right angle, a tangent is perpendicular to the radius, and central/inscribed angles connect to arcs.";
  }
  if (/Area and volume/i.test(skill)) {
    return "Count the relevant faces, dimensions, or scale factor before setting up equations. Lengths scale by $k$, areas by $k^2$, and volumes by $k^3$; for boxes and prisms, write the needed face or volume formula directly.";
  }
  return "Make a quick sketch or mark the given information on the figure first. Convert the visual fact into the relevant theorem or formula, then compute from that setup.";
};

const buildGeometryPlan = (question, explanation) => ({
  decision: "geometry-figure-first",
  changed: true,
  reason: "Geometry explanations should start from marking the visual shortcut before algebra.",
  steps: [
    {
      title: "Fastest path: mark the figure first",
      content: geometryLeadContent(question),
    },
    ...oldStepsForMix(explanation, 3),
  ],
});

const review = [];
let changedCount = 0;

for (const { bank, question } of targetQuestions) {
  const id = String(question.id ?? "").trim();
  const filePath = path.join(explanationDir, `${id}.json`);
  const relativePath = path.relative(root, filePath);
  if (!id || !existsSync(filePath)) {
    review.push({ id, bank, decision: "missing-explanation", changed: false });
    continue;
  }

  const explanation = readBaselineJson(relativePath, filePath);
  const plan = planForQuestion(bank, question, explanation);
  const nextExplanation = plan.changed
    ? {
        ...explanation,
        questionId: asString(explanation.questionId) || id,
        correctAnswer: asString(explanation.correctAnswer) || String(question.correctAnswer ?? ""),
        section: "Math",
        steps: plan.steps,
      }
    : explanation;

  const currentExplanation = JSON.parse(readFileSync(filePath, "utf8"));
  const current = JSON.stringify(currentExplanation);
  const next = JSON.stringify(nextExplanation);
  if (current !== next) writeJson(filePath, nextExplanation);

  if (plan.changed) {
    const baseline = JSON.stringify(explanation);
    if (baseline !== next) changedCount += 1;
  }

  review.push({
    id,
    bank,
    domain: question.domain,
    skill: question.skill,
    type: question.type,
    decision: plan.decision,
    changed: plan.changed,
    reason: plan.reason,
  });
}

mkdirSync(path.dirname(reportPath), { recursive: true });
writeJson(reportPath, {
  totalReviewed: review.length,
  changed: changedCount,
  decisions: review.reduce((accumulator, item) => {
    accumulator[item.decision] = (accumulator[item.decision] ?? 0) + 1;
    return accumulator;
  }, {}),
  review,
});

console.log(
  JSON.stringify(
    {
      totalReviewed: review.length,
      changed: changedCount,
      decisions: review.reduce((accumulator, item) => {
        accumulator[item.decision] = (accumulator[item.decision] ?? 0) + 1;
        return accumulator;
      }, {}),
      reportPath: path.relative(root, reportPath),
    },
    null,
    2,
  ),
);
