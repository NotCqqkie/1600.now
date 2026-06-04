// SAT Question Category Taxonomy

export type MathDomain = "Algebra" | "Advanced Math" | "Problem-Solving and Data Analysis" | "Geometry and Trigonometry";
export type EnglishDomain = "Craft and Structure" | "Expression of Ideas" | "Information and Ideas" | "Standard English Conventions";

export type MathSkill =
  | "Linear equations in one variable"
  | "Linear functions"
  | "Linear equations in two variables"
  | "Systems of two linear equations in two variables"
  | "Linear inequalities in one or two variables"
  | "Equivalent expressions"
  | "Nonlinear equations in one variable and systems of equations in two variables"
  | "Nonlinear functions"
  | "Ratios, rates, proportional relationships, and units"
  | "Percentages"
  | "One-variable data: Distributions and measures of center and spread"
  | "Two-variable data: Models and scatterplots"
  | "Probability and conditional probability"
  | "Inference from sample statistics and margin of error"
  | "Evaluating statistical claims: Observational studies and experiments"
  | "Area and volume"
  | "Lines, angles, and triangles"
  | "Right triangles and trigonometry"
  | "Circles";

export type EnglishSkill =
  | "Cross-Text Connections"
  | "Text Structure and Purpose"
  | "Words in Context"
  | "Rhetorical Synthesis"
  | "Transitions"
  | "Central Ideas and Details"
  | "Command of Evidence"
  | "Inferences"
  | "Boundaries"
  | "Form, Structure, and Sense";

export interface QuestionCategory {
  subject: "Math" | "English";
  domain: MathDomain | EnglishDomain;
  skill: MathSkill | EnglishSkill;
  confidence: "high" | "medium" | "low";
}

export interface SourceCategoryInput {
  subject?: string | null;
  section?: string | null;
  domain?: string | null;
  skill?: string | null;
  confidence?: string | null;
  testName?: string | null;
}

// Domain to skills mapping
export const mathDomainSkills: Record<MathDomain, MathSkill[]> = {
  "Algebra": [
    "Linear equations in one variable",
    "Linear functions",
    "Linear equations in two variables",
    "Systems of two linear equations in two variables",
    "Linear inequalities in one or two variables",
  ],
  "Advanced Math": [
    "Equivalent expressions",
    "Nonlinear equations in one variable and systems of equations in two variables",
    "Nonlinear functions",
  ],
  "Problem-Solving and Data Analysis": [
    "Ratios, rates, proportional relationships, and units",
    "Percentages",
    "One-variable data: Distributions and measures of center and spread",
    "Two-variable data: Models and scatterplots",
    "Probability and conditional probability",
    "Inference from sample statistics and margin of error",
    "Evaluating statistical claims: Observational studies and experiments",
  ],
  "Geometry and Trigonometry": [
    "Area and volume",
    "Lines, angles, and triangles",
    "Right triangles and trigonometry",
    "Circles",
  ],
};

export const englishDomainSkills: Record<EnglishDomain, EnglishSkill[]> = {
  "Craft and Structure": [
    "Cross-Text Connections",
    "Text Structure and Purpose",
    "Words in Context",
  ],
  "Expression of Ideas": [
    "Rhetorical Synthesis",
    "Transitions",
  ],
  "Information and Ideas": [
    "Central Ideas and Details",
    "Command of Evidence",
    "Inferences",
  ],
  "Standard English Conventions": [
    "Boundaries",
    "Form, Structure, and Sense",
  ],
};

const mathSkillAliasMap: Record<string, MathSkill> = {
  // Algebra
  "linear equations in one variable": "Linear equations in one variable",
  "linear equations in 1 variable": "Linear equations in one variable",
  "linear functions": "Linear functions",
  "linear equations in two variables": "Linear equations in two variables",
  "linear equations in 2 variables": "Linear equations in two variables",
  "systems of linear equations": "Systems of two linear equations in two variables",
  "systems of two linear equations": "Systems of two linear equations in two variables",
  "systems of two linear equations in two variables": "Systems of two linear equations in two variables",
  "linear inequalities": "Linear inequalities in one or two variables",
  "linear inequalities in one or two variables": "Linear inequalities in one or two variables",
  "linear inequalities in 1 or 2 variables": "Linear inequalities in one or two variables",
  // Advanced Math
  "equivalent expressions": "Equivalent expressions",
  "nonlinear equations and systems": "Nonlinear equations in one variable and systems of equations in two variables",
  "nonlinear equations in one variable and systems of equations in two variables": "Nonlinear equations in one variable and systems of equations in two variables",
  "nonlinear equations in 1 variable and systems of equations in 2 variables": "Nonlinear equations in one variable and systems of equations in two variables",
  "nonlinear functions": "Nonlinear functions",
  // Problem-Solving and Data Analysis
  "ratios, rates, proportions, and units": "Ratios, rates, proportional relationships, and units",
  "ratios, rates, proportional relationships, and units": "Ratios, rates, proportional relationships, and units",
  "ratios, rates, and proportional relationships": "Ratios, rates, proportional relationships, and units",
  "percentages": "Percentages",
  "one-variable data": "One-variable data: Distributions and measures of center and spread",
  "one-variable data: distributions and measures of center and spread": "One-variable data: Distributions and measures of center and spread",
  "two-variable data": "Two-variable data: Models and scatterplots",
  "two-variable data: models and scatterplots": "Two-variable data: Models and scatterplots",
  "probability": "Probability and conditional probability",
  "probability and conditional probability": "Probability and conditional probability",
  "sample statistics and margin of error": "Inference from sample statistics and margin of error",
  "inference from sample statistics and margin of error": "Inference from sample statistics and margin of error",
  "evaluating statistical claims": "Evaluating statistical claims: Observational studies and experiments",
  "evaluating statistical claims: observational studies and experiments": "Evaluating statistical claims: Observational studies and experiments",
  // Geometry and Trigonometry
  "area and volume": "Area and volume",
  "lines, angles, and triangles": "Lines, angles, and triangles",
  "right triangles and trigonometry": "Right triangles and trigonometry",
  "circles": "Circles",
};

const englishSkillAliasMap: Record<string, EnglishSkill> = {
  "cross-text connections": "Cross-Text Connections",
  "text structure and purpose": "Text Structure and Purpose",
  "words in context": "Words in Context",
  "rhetorical synthesis": "Rhetorical Synthesis",
  "transitions": "Transitions",
  "central ideas and details": "Central Ideas and Details",
  "command of evidence": "Command of Evidence",
  // Common sub-type labels from some SAT data sources
  "command of evidence (textual)": "Command of Evidence",
  "command of evidence (quantitative)": "Command of Evidence",
  "command of evidence - textual": "Command of Evidence",
  "command of evidence - quantitative": "Command of Evidence",
  "inferences": "Inferences",
  "boundaries": "Boundaries",
  "form, structure, and sense": "Form, Structure, and Sense",
};

const normalizeKey = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

const normalizeConfidence = (value: string | null | undefined): QuestionCategory["confidence"] => {
  const key = normalizeKey(value);
  if (key === "high" || key === "medium" || key === "low") return key;
  return "high";
};

const toMathDomain = (value: string | null | undefined): MathDomain | null => {
  const key = normalizeKey(value);
  return allMathDomains.find((d) => normalizeKey(d) === key) ?? null;
};

const toEnglishDomain = (value: string | null | undefined): EnglishDomain | null => {
  const key = normalizeKey(value);
  return allEnglishDomains.find((d) => normalizeKey(d) === key) ?? null;
};

const toMathSkill = (value: string | null | undefined): MathSkill | null => {
  const key = normalizeKey(value);
  return mathSkillAliasMap[key] ?? null;
};

const toEnglishSkill = (value: string | null | undefined): EnglishSkill | null => {
  const key = normalizeKey(value);
  return englishSkillAliasMap[key] ?? null;
};

const inferSubjectFromTaxonomy = (
  domain: string | null | undefined,
  skill: string | null | undefined,
): QuestionCategory["subject"] | null => {
  if (toMathDomain(domain) || toMathSkill(skill)) return "Math";
  if (toEnglishDomain(domain) || toEnglishSkill(skill)) return "English";
  return null;
};

export const inferSubjectFromSource = (input: SourceCategoryInput): QuestionCategory["subject"] | null => {
  const fromTaxonomy = inferSubjectFromTaxonomy(input.domain, input.skill);
  if (fromTaxonomy) return fromTaxonomy;

  const fromSection = normalizeKey(input.section);
  if (fromSection === "math") return "Math";
  if (fromSection === "reading and writing" || fromSection === "english" || fromSection === "reading & writing") {
    return "English";
  }

  const fromSubject = normalizeKey(input.subject);
  if (fromSubject === "math") return "Math";
  if (fromSubject === "english" || fromSubject === "reading and writing" || fromSubject === "reading & writing") {
    return "English";
  }

  const fromTestName = input.testName ?? "";
  if (/\bmath\b/i.test(fromTestName)) return "Math";
  if (/\b(english|reading|writing)\b/i.test(fromTestName)) return "English";

  return null;
};

const getMathDomainForSkill = (skill: MathSkill): MathDomain => {
  for (const [domain, skills] of Object.entries(mathDomainSkills) as [MathDomain, MathSkill[]][]) {
    if (skills.includes(skill)) return domain;
  }
  return "Algebra";
};

const getEnglishDomainForSkill = (skill: EnglishSkill): EnglishDomain => {
  for (const [domain, skills] of Object.entries(englishDomainSkills) as [EnglishDomain, EnglishSkill[]][]) {
    if (skills.includes(skill)) return domain;
  }
  return "Information and Ideas";
};

export function normalizeCategoryFromSource(input: SourceCategoryInput): QuestionCategory | null {
  const subject = inferSubjectFromSource(input);
  if (!subject) return null;

  if (subject === "Math") {
    const skill = toMathSkill(input.skill);
    if (!skill) return null;

    const domainFromSkill = getMathDomainForSkill(skill);
    const sourceDomain = toMathDomain(input.domain);
    const usedCorrectedDomain = Boolean(sourceDomain && sourceDomain !== domainFromSkill);
    const domain = sourceDomain && sourceDomain === domainFromSkill ? sourceDomain : domainFromSkill;
    const confidence = usedCorrectedDomain ? "medium" : normalizeConfidence(input.confidence);

    return {
      subject,
      domain,
      skill,
      confidence,
    };
  }

  const skill = toEnglishSkill(input.skill);
  if (!skill) return null;

  const domainFromSkill = getEnglishDomainForSkill(skill);
  const sourceDomain = toEnglishDomain(input.domain);
  const usedCorrectedDomain = Boolean(sourceDomain && sourceDomain !== domainFromSkill);
  const domain = sourceDomain && sourceDomain === domainFromSkill ? sourceDomain : domainFromSkill;
  const confidence = usedCorrectedDomain ? "medium" : normalizeConfidence(input.confidence);

  return {
    subject,
    domain,
    skill,
    confidence,
  };
}

// Keyword patterns for classification
const mathPatterns: { skill: MathSkill; patterns: RegExp[]; domain: MathDomain }[] = [
  // Algebra - order matters! Systems should be checked before single-variable
  {
    skill: "Systems of two linear equations in two variables",
    domain: "Algebra",
    patterns: [
      /system.*equations|equations.*system/i,
      /solution.*\(x,\s*y\)/i,
      /two equations.*intersect/i,
      /infinitely many solutions|no solution/i,
      /value of x \+ y/i,
      /value of x - y/i,
      /ordered pair.*solution/i,
      /\d+x\s*[+-]\s*\d*y\s*=.*\d+x\s*[+-]\s*\d*y\s*=/i, // Two equations like 3y=-24, 6x-3y=18
      /what is the value of [xy]\s*\?.*\d+[xy]/i, // Question asking for x or y with equation containing both
    ],
  },
  {
    skill: "Linear equations in two variables",
    domain: "Algebra",
    patterns: [
      /xy.?plane.*line|line.*xy.?plane/i,
      /graph.*linear|linear.*graph/i,
      /equation.*line|line.*equation/i,
      /passes through the point/i,
      /slope of the line/i,
      /perpendicular to the line/i,
      /parallel to the line/i,
      /represent.*total|total.*represent/i, // Word problems like pencils and erasers
      /\d+[a-z]\s*\+\s*\d+[a-z]\s*=\s*\d+/i, // Pattern like 4x + 5y = 40
      /combined total|together.*equal/i,
      /mixture|solution.*volume/i, // Mixture problems
    ],
  },
  {
    skill: "Linear functions",
    domain: "Algebra",
    patterns: [
      /linear.*function|function.*linear/i,
      /f\s*\(\s*x\s*\)\s*=\s*\d*x\s*[+-]/i,
      /slope.*intercept|y-intercept|x-intercept/i,
      /rate of change/i,
      /constant rate/i,
      /initial value/i,
      /model.*relationship/i,
      /table.*function|function.*table/i, // Tables showing f(x) values
      /when x\s*=\s*\d+.*f\s*\(/i, // When x = 3, f(x) = ...
      /graph.*passes through/i, // Graph of linear function passing through points
    ],
  },
  {
    skill: "Linear equations in one variable",
    domain: "Algebra",
    patterns: [
      /solve.*equation|equation.*solve/i,
      /what is the value of [a-z]\s*\?/i,
      /\d+[a-z]\s*=\s*\d+/i, // Pattern like 5s=40
      /\d+\s*\+\s*[a-z]\s*=\s*\d+/i, // Pattern like 28+x=63
      /what value of [a-z] satisfies/i,
      /solution to the given equation/i,
      /value of [a-z] is/i,
      /[a-z]\s*[+-]\s*\d+\s*=\s*\d+/i, // x + 5 = 10
      /\d+\s*[+-]\s*\d+[a-z]\s*=\s*\d+/i, // 7 + 3x = 19
    ],
  },
  {
    skill: "Linear inequalities in one or two variables",
    domain: "Algebra",
    patterns: [
      /inequality|inequalities/i,
      /\\le|\\ge|≤|≥/,
      /solution.*region/i,
      /maximum possible value/i,
      /minimum possible value/i,
      /at least|at most/i,
      /no more than|no less than/i,
      /\d+[a-z]\s*\+\s*\d+[a-z]\s*[<>≤≥]/i, // Pattern like 3b+4c≤48
      /cannot exceed|must not exceed/i,
      /greater than|less than/i,
    ],
  },
  // Advanced Math
  {
    skill: "Equivalent expressions",
    domain: "Advanced Math",
    patterns: [
      /equivalent.*expression|expression.*equivalent/i,
      /is equivalent to \d+[a-z]/i, // "is equivalent to 9x^4+13x^4"
      /which of the following is equivalent/i,
      /expression.*is equivalent/i,
      /simplif|factor(?!ial)|expand/i, // factor but not factorial
      /rewrite.*expression/i,
      /equivalent form/i,
      /rational exponent/i,
      /radical form/i,
      /\d+[a-z]\^?\d*\s*[+-]\s*\d+[a-z]\^?\d*\s*[+-]\s*\d+[a-z]/i, // combining like terms: 7b²−4b²+9b
      /\([a-z][+-]\d+\)\s*\([a-z][+-]\d+\)/i, // FOIL: (x+4)(x-6)
    ],
  },
  {
    skill: "Nonlinear equations in one variable and systems of equations in two variables",
    domain: "Advanced Math",
    patterns: [
      /quadratic.*equation|equation.*quadratic/i,
      /[a-z]\^2\s*=\s*\d+/i, // y²=49
      /[a-z]²\s*=\s*\d+/i, // y²=49 (unicode)
      /\d+[a-z]\^?2\s*[-+=]/i, // 3x² in equation context
      /solution.*to.*equation/i,
      /solutions.*equation.*[a-z]/i,
      /parabola.*intersect/i,
      /discriminant/i,
      /vertex of the parabola/i,
      /zeros of the function/i,
      /roots of the equation/i,
      /\|[a-z][-+−]\d+\|\s*=/i, // absolute value equation |y-4|=10
      /system.*linear.*nonlinear|nonlinear.*system/i,
      /one linear equation and one nonlinear/i,
      /negative solution to the equation/i,
      /nearest.*solution.*equation/i,
    ],
  },
  {
    skill: "Nonlinear functions",
    domain: "Advanced Math",
    patterns: [
      /exponential.*function|function.*exponential/i,
      /polynomial.*function|quadratic.*function/i,
      /for the quadratic function/i, // "For the quadratic function p"
      /table.*quadratic|quadratic.*table/i,
      /function.*defined by.*equation/i, // "Function h is defined by the given equation"
      /equation defines.*function|which.*defines.*function/i, // "Which equation defines function h"
      /\^\\frac|growth|decay/i,
      /absolute value function/i, // only absolute value FUNCTION, not equation
      /compound interest/i,
      /half-life/i,
      /doubles every/i,
      /initial population/i,
      /maximum height/i, // projectile motion
      /\)\s*\^\s*t/i, // exponential forms like (2.72)^t
      /y-intercept.*graph|graph.*y-intercept/i,
      /[a-z]\(x\)\s*=.*\d+\^?x/i, // g(x)=(6)(4)^x exponential
      /graph of function.*contains the point/i,
      /graph of.*in the xy-?plane/i,
    ],
  },
  // Problem-Solving and Data Analysis
  {
    skill: "Ratios, rates, proportional relationships, and units",
    domain: "Problem-Solving and Data Analysis",
    patterns: [
      /ratio|rate|proportion/i,
      /per hour|per minute|per second|miles per/i,
      /bottles.*hour|hour.*bottles/i, // bottling plant fills 900 bottles in 1 hour
      /liters.*second|second.*liters/i, // liters per second
      /how many.*per|per.*how many/i,
      /unit.*conversion|convert.*unit/i,
      /fluid ounces|cups.*ounces|ounces.*cups/i, // unit conversion
      /1 cup = \d+ fluid ounces/i,
      /density/i,
      /scale factor/i,
      /population density/i,
      /operates.*continuously|continuously.*operates/i,
      /at this rate/i,
    ],
  },
  {
    skill: "Percentages",
    domain: "Problem-Solving and Data Analysis",
    patterns: [
      /what is \d+%/i, // What is 75% of 800
      /what percentage of/i, // What percentage of the boxes
      /\d+% of \d+/i, // 75% of 800
      /percent|%/i,
      /increase.*by.*%|decrease.*by.*%/i,
      /discount|tax|interest/i,
      /percentage point/i,
      /original price/i,
      /are hardcover.*percentage|percentage.*hardcover/i,
    ],
  },
  {
    skill: "One-variable data: Distributions and measures of center and spread",
    domain: "Problem-Solving and Data Analysis",
    patterns: [
      /mean|median|mode|standard deviation/i,
      /data set|distribution/i,
      /average|range/i,
      /frequency table|frequency.*correctly/i, // frequency table questions
      /Number.*Frequency/i, // table header pattern
      /box plot|dot plot|histogram/i,
      /measure of center/i,
      /outlier/i,
      /comparing the means|means of the two/i,
      /which of the following is the median/i,
      /correct representation of this data/i,
    ],
  },
  {
    skill: "Two-variable data: Models and scatterplots",
    domain: "Problem-Solving and Data Analysis",
    patterns: [
      /scatterplot|scatter plot/i,
      /based on the scatterplot/i, // Based on the scatterplot, what is
      /line of best fit|regression/i,
      /best represents the line of best fit/i,
      /line graph shows/i, // line graph questions
      /according to the graph/i,
      /correlation/i,
      /predicted value/i,
      /residual/i,
      /linear model/i,
      /relationship between.*variables.*shown/i,
    ],
  },
  {
    skill: "Probability and conditional probability",
    domain: "Problem-Solving and Data Analysis",
    patterns: [
      /probability that/i, // what is the probability that
      /probability.*selected|selected.*probability/i,
      /one.*selected at random|chosen at random/i, // If one is chosen at random
      /given that|conditional/i,
      /likely|chance/i,
      /expected value/i,
      /fraction of the/i,
      /table shows the distribution/i, // probability tables
      /express.*answer.*decimal.*fraction/i, // probability answer format
    ],
  },
  {
    skill: "Inference from sample statistics and margin of error",
    domain: "Problem-Solving and Data Analysis",
    patterns: [
      /margin of error/i,
      /\d+%\s*margin of error/i, // 3.8% margin of error - high priority
      /predict.*margin of error/i,
      /random sample.*surveyed|surveyed.*random sample/i,
      /confidence.*interval/i,
      /survey.*population/i,
      /representative sample/i,
      /based on this sample/i, // Based on this sample, about how many
      /best estimate of the total number/i,
      /standard error/i,
      /of those surveyed/i,
      /from the survey results/i,
    ],
  },
  {
    skill: "Evaluating statistical claims: Observational studies and experiments",
    domain: "Problem-Solving and Data Analysis",
    patterns: [
      /observational.*study|experiment.*control/i,
      /statistical.*claim/i,
      /random.*assignment/i,
      /cause and effect/i,
      /conclusion.*drawn|which conclusion/i,
      /largest population to which/i, // Which is the largest population to which the results can be applied
      /results.*can be applied|can be generalized/i,
      /which.*statements must be true/i, // Which of the following statements must be true
      /most justifiably generalized/i,
      /based on this information.*which/i,
    ],
  },
  // Geometry and Trigonometry
  // ORDER MATTERS: More specific patterns first to avoid false positives
  
  // Right triangles and trig FIRST - most specific, avoids "tan" matching "constant"
  {
    skill: "Right triangles and trigonometry",
    domain: "Geometry and Trigonometry",
    patterns: [
      /\bsin\s+[A-Za-z]/i,  // sin R (with space) but not "single"
      /\bcos\s+[A-Za-z]/i,  // cos R (with space) but not "cost"
      /\btan\s+[A-Za-z]/i,  // tan W (with space) but not "tank", "constant"
      /sin\s*\(/i,  // sin(x)
      /cos\s*\(/i,  // cos(x)
      /tan\s*\(/i,  // tan(x)
      /\\sin|\\cos|\\tan/i,  // LaTeX trig functions
      /\bsine\b|\bcosine\b/i,  // spelled out trig (word boundaries)
      /tangent of/i,  // "tangent of angle" not "tangent to circle"
      /hypotenuse/i,
      /right triangle/i,
      /angle of elevation/i,
      /angle of depression/i,
      /pythagorean/i,
      /opposite.*adjacent|adjacent.*opposite/i,
      /leg of (?:the )?triangle/i,
      /the value of (?:sin|cos|tan)\b/i,
      /what is (?:the value of )?[a-z]\?.*right/i, // right triangle context
    ],
  },
  // Area and volume - 3D shapes and area calculations
  {
    skill: "Area and volume",
    domain: "Geometry and Trigonometry",
    patterns: [
      /volume/i,
      /surface area/i,
      /area of (?:a |the )?(?:rectangle|square|triangle|circle|trapezoid|parallelogram)/i,
      /cubic (?:feet|meters|inches|centimeters|yards)/i,
      /square (?:feet|meters|inches|centimeters|yards)/i,
      /hemisphere/i,
      /sphere/i,
      /cylinder/i,
      /\bcone\b/i,  // word boundary to avoid "cone" in other contexts
      /prism/i,
      /pyramid/i,
      /rectangular.*(?:box|container|tank|pool)/i,
      /perimeter/i,
    ],
  },
  // Circles - circle properties and equations
  {
    skill: "Circles",
    domain: "Geometry and Trigonometry",
    patterns: [
      /\bcircle\b/i,  // explicit "circle" word
      /circumference/i,
      /arc length/i,
      /\bsector\b/i,
      /\bchord\b/i,
      /tangent to (?:the )?(?:circle|point)/i,
      /central angle/i,
      /inscribed.*circle|circle.*inscribed/i,
      /\(x[+-].*\)\s*\^?\s*2\s*\+\s*\(y[+-].*\)\s*\^?\s*2/i,  // circle equation (x+a)^2+(y+b)^2
      /x\^2\s*\+\s*y\^2.*=.*\d+/i,  // x^2 + y^2 = r^2
      /radius.*circle|circle.*radius/i,
      /diameter.*circle|circle.*diameter/i,
      /radians/i,
    ],
  },
  // Lines, angles, triangles - general geometry (NOT trig)
  {
    skill: "Lines, angles, and triangles",
    domain: "Geometry and Trigonometry",
    patterns: [
      /parallel lines?/i,
      /transversal/i,
      /supplementary/i,
      /complementary/i,
      /vertical angles?/i,
      /alternate (?:interior|exterior)/i,
      /corresponding angles?/i,
      /\bcongruent\b/i,
      /similar triangles?/i,
      /isosceles/i,
      /equilateral/i,
      /exterior angle/i,
      /interior angle/i,
      /sum of (?:the )?(?:angles|measures)/i,
      /measure of angle/i,
      /triangle.*angle|angle.*triangle/i,
      /degrees?.*triangle|triangle.*degrees?/i,
      /line.*intersects?.*parallel/i,
      /triangles?.*congruent|congruent.*triangles?/i,
      /triangle inequality/i,
      /(base|height).*triangle/i,
    ],
  },
];

const englishPatterns: { skill: EnglishSkill; patterns: RegExp[]; domain: EnglishDomain }[] = [
  // Craft and Structure
  {
    skill: "Words in Context",
    domain: "Craft and Structure",
    patterns: [
      /as used in the text.*mean/i,
      /most nearly mean/i,
      /word.*phrase.*most logical/i,
      /completes the text with the most logical/i,
      /precise word or phrase/i,
    ],
  },
  {
    skill: "Text Structure and Purpose",
    domain: "Craft and Structure",
    patterns: [
      /main purpose|overall structure/i,
      /function.*underlined/i,
      /best describes.*structure/i,
      /purpose of the text/i,
      /function of the sentence/i,
      /best describes the function/i,
    ],
  },
  {
    skill: "Cross-Text Connections",
    domain: "Craft and Structure",
    patterns: [
      /text 1.*text 2|both texts/i,
      /passage 1.*passage 2/i,
      /based on the texts/i,
      /how would.*text 2.*respond/i,
      /text 2.*challenge/i,
    ],
  },
  // Expression of Ideas
  {
    skill: "Transitions",
    domain: "Expression of Ideas",
    patterns: [
      /transition|blank.*logically/i,
      /which choice.*connect|link.*sentences/i,
      /however|therefore|moreover|furthermore/i,
      /most logical transition/i,
      /consequently|likewise|similarly/i,
    ],
  },
  {
    skill: "Rhetorical Synthesis",
    domain: "Expression of Ideas",
    patterns: [
      /notes.*student|student.*notes/i,
      /bullet.*points|from a researcher/i,
      /emphasize|introduce.*audience/i,
      /student wants to/i,
      /effectively uses relevant information/i,
    ],
  },
  // Information and Ideas
  {
    skill: "Central Ideas and Details",
    domain: "Information and Ideas",
    patterns: [
      /main idea|central idea/i,
      /best.*summarizes/i,
      /according to the text/i,
      /which choice best states/i,
      /details.*text/i,
    ],
  },
  {
    skill: "Command of Evidence",
    domain: "Information and Ideas",
    patterns: [
      /quotation.*illustrates|best supports/i,
      /evidence.*claim/i,
      /data.*table.*graph/i,
      /effectively uses data/i,
      /support.*hypothesis/i,
      /weaken.*argument/i,
      /undermine.*claim/i,
      /support.*conclusion/i,
    ],
  },
  {
    skill: "Inferences",
    domain: "Information and Ideas",
    patterns: [
      /infer|suggest|imply/i,
      /can be concluded/i,
      /based on the text.*most likely/i,
      /logically completes/i,
      /most logical conclusion/i,
    ],
  },
  // Standard English Conventions
  {
    skill: "Boundaries",
    domain: "Standard English Conventions",
    patterns: [
      /punctuation|comma|semicolon|colon/i,
      /sentence boundary/i,
      /run-on|fragment/i,
      /conventions of standard english/i,
      /completes the text.*conform/i,
    ],
  },
  {
    skill: "Form, Structure, and Sense",
    domain: "Standard English Conventions",
    patterns: [
      /verb.*tense|subject.*verb.*agreement/i,
      /pronoun|possessive/i,
      /parallel.*structure/i,
      /modifier|clause/i,
      /plural|singular/i,
      /apostrophe/i,
    ],
  },
];

export function classifyQuestion(
  text: string,
  isMath: boolean
): QuestionCategory | null {
  const lowerText = text.toLowerCase();
  
  if (isMath) {
    let bestMatch: { skill: MathSkill; domain: MathDomain; score: number } | null = null;
    
    for (const { skill, domain, patterns } of mathPatterns) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          score++;
        }
      }
      
      // Special handling for Geometry edge cases
      if (skill === "Circles") {
        // Sphere/hemisphere/cylinder/cone is Area and Volume, not Circles
        if (/sphere|hemisphere|cylinder|cone|prism|pyramid/i.test(text)) {
          score = 0;
        }
      }
      
      if (skill === "Area and volume") {
        // "Volume" in the context of liquid mixtures (solutions) is Algebra, not Geometry
        if (/solution|mixture|saltwater|concentration/i.test(text) && /volume/i.test(text)) {
          score = 0;
        }
      }
      
      if (skill === "Lines, angles, and triangles") {
        // If has trig functions, it's Right triangles, not general
        if (/\bsin\s+[A-Za-z]|\bcos\s+[A-Za-z]|\btan\s+[A-Za-z]|sin\s*\(|cos\s*\(|tan\s*\(|\bsine\b|\bcosine\b|tangent of|hypotenuse/i.test(text)) {
          score = 0;
        }
      }
      
      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { skill, domain, score };
      }
    }
    
    if (bestMatch) {
      return {
        subject: "Math",
        domain: bestMatch.domain,
        skill: bestMatch.skill,
        confidence: bestMatch.score >= 2 ? "high" : bestMatch.score === 1 ? "medium" : "low",
      };
    }
    
    // Default fallback for math
    return {
      subject: "Math",
      domain: "Algebra",
      skill: "Linear equations in one variable",
      confidence: "low",
    };
  } else {
    let bestMatch: { skill: EnglishSkill; domain: EnglishDomain; score: number } | null = null;
    
    for (const { skill, domain, patterns } of englishPatterns) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          score++;
        }
      }
      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { skill, domain, score };
      }
    }
    
    if (bestMatch) {
      return {
        subject: "English",
        domain: bestMatch.domain,
        skill: bestMatch.skill,
        confidence: bestMatch.score >= 2 ? "high" : bestMatch.score === 1 ? "medium" : "low",
      };
    }
    
    // Default fallback for English
    return {
      subject: "English",
      domain: "Information and Ideas",
      skill: "Central Ideas and Details",
      confidence: "low",
    };
  }
}

// Export all domains and skills for UI
export const allMathDomains: MathDomain[] = [
  "Algebra",
  "Advanced Math",
  "Problem-Solving and Data Analysis",
  "Geometry and Trigonometry",
];

export const allEnglishDomains: EnglishDomain[] = [
  "Craft and Structure",
  "Expression of Ideas",
  "Information and Ideas",
  "Standard English Conventions",
];
