import { useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import {
  PageSeo,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildItemListJsonLd,
} from "@/components/seo/PageSeo";
import {
  linkableAssetBySlug,
  linkableHubBySlug,
  type LinkableAsset,
  type LinkableAssetSection,
} from "@/lib/seo-data/linkableAssets";
import { satSkills } from "@/lib/seo-data/satSkillsData";
import {
  loadQuestionsByDomain,
  loadQuestionsBySkill,
  type BankSubject,
  type EnglishDomain,
  type EnglishSkill,
  type MathDomain,
  type MathSkill,
} from "@/data/questionBank";
import {
  createCustomPracticeSetFromQuestions,
  launchCustomPracticeSet,
} from "@/lib/practice/customPracticeSets";
import { useAuth } from "@/contexts/AuthContext";

const SITE = "https://1600.now";
const ASSET_PUBLISHED = "2026-05-28";
const SECTION_HEADING_CLASS = "text-2xl font-semibold tracking-tight";
const SECTION_PARAGRAPH_CLASS = "mt-3 text-muted-foreground";
const SECTION_LIST_CLASS = "mt-4 list-disc space-y-2 pl-6 text-muted-foreground";
const SECTION_TABLE_WRAPPER_CLASS = "mt-4 overflow-x-auto rounded-lg border border-border";
const SECTION_TABLE_CLASS = "w-full min-w-[560px] text-left text-sm";
const SECTION_TABLE_HEAD_CLASS = "bg-muted/70";
const SECTION_TABLE_HEADER_CELL_CLASS = "px-4 py-3 font-semibold";
const SECTION_TABLE_ROW_CLASS = "border-t border-border";
const SECTION_TABLE_CELL_CLASS = "px-4 py-3 text-muted-foreground";

type TextLinkRule = {
  phrases: string[];
  href: string;
};

type ProductLink = {
  label: string;
  href: string;
};

type PracticeTarget = {
  label: string;
  title: string;
  subject: BankSubject;
  domain?: MathDomain | EnglishDomain;
  skill?: MathSkill | EnglishSkill;
  maxQuestions?: number;
};

const skillPracticeHref = (skill: (typeof satSkills)[number]) =>
  `/bank/${skill.section === "Math" ? "math" : "reading"}/skill/${encodeURIComponent(skill.officialSkill)}`;

const skillBySlug = new Map(satSkills.map((skill) => [skill.slug, skill]));
const skillByWorksheetSlug = new Map(
  satSkills.map((skill) => [`sat-${skill.slug}-worksheet`, skill]),
);
const skillByOfficialSkill = new Map(satSkills.map((skill) => [skill.officialSkill, skill]));

const toSubject = (skill: (typeof satSkills)[number]): BankSubject =>
  skill.section === "Math" ? "math" : "reading";

const targetForSkill = (
  label: string,
  officialSkill: MathSkill | EnglishSkill,
): PracticeTarget | null => {
  const skill = skillByOfficialSkill.get(officialSkill);
  if (!skill) return null;
  return {
    label,
    title: `${skill.name} practice set`,
    subject: toSubject(skill),
    skill: skill.officialSkill,
    maxQuestions: 20,
  };
};

const targetForDomain = (
  label: string,
  subject: BankSubject,
  domain: MathDomain | EnglishDomain,
): PracticeTarget => ({
  label,
  title: `${domain} practice set`,
  subject,
  domain,
  maxQuestions: 20,
});

const isPracticeTarget = (target: PracticeTarget | null): target is PracticeTarget =>
  Boolean(target);

const staticPracticeTargets: Record<string, PracticeTarget[]> = {
  "sat-math-formula-chart": [
    targetForDomain("Start formula-heavy Math set", "math", "Advanced Math"),
    targetForDomain("Start Geometry formula set", "math", "Geometry and Trigonometry"),
  ],
  "sat-reading-writing-skill-chart": [
    targetForDomain("Start Reading and Writing set", "reading", "Information and Ideas"),
    targetForDomain("Start grammar set", "reading", "Standard English Conventions"),
  ],
  "sat-desmos-reference-sheet": [
    targetForSkill("Start systems practice set", "Systems of two linear equations in two variables"),
    targetForSkill("Start nonlinear practice set", "Nonlinear functions"),
    targetForSkill("Start scatterplot practice set", "Two-variable data: Models and scatterplots"),
  ].filter(isPracticeTarget),
  "sat-vocabulary-frequency-list": [
    targetForSkill("Start Words in Context set", "Words in Context"),
  ].filter(isPracticeTarget),
  "sat-grammar-rules-chart": [
    targetForSkill("Start grammar rules set", "Form, Structure, and Sense"),
    targetForSkill("Start punctuation set", "Boundaries"),
  ].filter(isPracticeTarget),
  "sat-punctuation-rules-chart": [
    targetForSkill("Start punctuation set", "Boundaries"),
  ].filter(isPracticeTarget),
  "sat-question-types-chart": [
    targetForDomain("Start Math question-type set", "math", "Algebra"),
    targetForDomain("Start Reading question-type set", "reading", "Information and Ideas"),
  ],
  "sat-calculator-policy-chart": [
    targetForSkill("Start calculator-friendly systems set", "Systems of two linear equations in two variables"),
    targetForSkill("Start data-modeling set", "Two-variable data: Models and scatterplots"),
  ].filter(isPracticeTarget),
  "sat-scores-by-college-major": [
    targetForDomain("Start Math readiness set", "math", "Advanced Math"),
  ],
  "sat-scores-for-engineering-schools": [
    targetForDomain("Start engineering Math set", "math", "Advanced Math"),
  ],
  "sat-scores-for-business-schools": [
    targetForDomain("Start quantitative set", "math", "Problem-Solving and Data Analysis"),
  ],
  "sat-scores-for-computer-science": [
    targetForDomain("Start CS-ready Math set", "math", "Advanced Math"),
  ],
  "sat-cram-plan": [
    targetForSkill("Start punctuation set", "Boundaries"),
    targetForSkill("Start linear equations set", "Linear equations in one variable"),
  ].filter(isPracticeTarget),
  "sat-study-plan-for-1400": [
    targetForDomain("Start 1400-level Math set", "math", "Algebra"),
    targetForDomain("Start 1400-level Reading set", "reading", "Information and Ideas"),
  ],
  "sat-study-plan-for-1500": [
    targetForDomain("Start hard Math set", "math", "Advanced Math"),
    targetForDomain("Start hard Reading set", "reading", "Craft and Structure"),
  ],
  "desmos-sat-shortcuts": [
    targetForSkill("Start systems practice set", "Systems of two linear equations in two variables"),
    targetForSkill("Start nonlinear functions set", "Nonlinear functions"),
    targetForSkill("Start data-modeling set", "Two-variable data: Models and scatterplots"),
  ].filter(isPracticeTarget),
  "sat-practice-test-score-sheet": [
    targetForDomain("Start review Math set", "math", "Algebra"),
    targetForDomain("Start review Reading set", "reading", "Standard English Conventions"),
  ],
};

const practiceRule = (slug: string, phrases: string[]): TextLinkRule | null => {
  const skill = skillBySlug.get(slug);
  if (!skill) return null;
  return { phrases, href: skillPracticeHref(skill) };
};

const textLinkRules: TextLinkRule[] = [
  ...satSkills.map((skill) => ({
    phrases: [skill.name, skill.officialSkill],
    href: skillPracticeHref(skill),
  })),
  { phrases: ["Algebra"], href: `/bank/math/domain/${encodeURIComponent("Algebra")}` },
  { phrases: ["Advanced Math"], href: `/bank/math/domain/${encodeURIComponent("Advanced Math")}` },
  {
    phrases: ["Problem-Solving and Data Analysis", "data analysis"],
    href: `/bank/math/domain/${encodeURIComponent("Problem-Solving and Data Analysis")}`,
  },
  {
    phrases: ["Geometry and Trigonometry", "geometry"],
    href: `/bank/math/domain/${encodeURIComponent("Geometry and Trigonometry")}`,
  },
  {
    phrases: ["Information and Ideas"],
    href: `/bank/reading/domain/${encodeURIComponent("Information and Ideas")}`,
  },
  {
    phrases: ["Craft and Structure"],
    href: `/bank/reading/domain/${encodeURIComponent("Craft and Structure")}`,
  },
  {
    phrases: ["Expression of Ideas"],
    href: `/bank/reading/domain/${encodeURIComponent("Expression of Ideas")}`,
  },
  {
    phrases: ["Standard English Conventions"],
    href: `/bank/reading/domain/${encodeURIComponent("Standard English Conventions")}`,
  },
  practiceRule("linear-functions", [
    "slope-intercept form",
    "point-slope form",
    "rate of change",
    "slope",
    "slopes",
    "intercepts",
  ]),
  practiceRule("systems-of-linear-equations", ["systems of equations", "systems", "intersections"]),
  practiceRule("nonlinear-equations-and-systems", ["nonlinear equations", "quadratic formula", "radical equations"]),
  practiceRule("nonlinear-functions", ["quadratics", "quadratic", "vertex form", "exponential growth", "exponentials"]),
  practiceRule("equivalent-expressions", ["equivalent expressions", "factoring", "complete the square"]),
  practiceRule("ratios-rates-proportions", ["ratios", "rates", "proportions", "unit conversions"]),
  practiceRule("percentages", ["percentages", "percent change", "percents", "discounts"]),
  practiceRule("one-variable-data", ["standard deviation", "histograms", "box plots", "dot plots", "one-variable data", "measures of center"]),
  practiceRule("two-variable-data", ["scatterplots", "scatterplot", "regression", "data-model", "best fit"]),
  practiceRule("probability", ["conditional probability", "probability"]),
  practiceRule("sample-statistics-margin-of-error", ["margin of error", "confidence interval", "sample statistic"]),
  practiceRule("evaluating-statistical-claims", ["causation", "correlation", "random samples", "observational studies"]),
  practiceRule("area-and-volume", ["area and volume", "surface area", "volume formulas"]),
  practiceRule("lines-angles-triangles", ["similar triangles", "parallel lines", "angle relationships"]),
  practiceRule("right-triangles-and-trig", ["right triangles", "trigonometry", "SOH-CAH-TOA", "Pythagorean"]),
  practiceRule("circles", ["circle equations", "circle area", "circles"]),
  practiceRule("words-in-context", ["Words in Context", "context clues"]),
  practiceRule("text-structure-and-purpose", ["Text Structure and Purpose", "purpose questions", "rhetorical role"]),
  practiceRule("cross-text-connections", ["Cross-Text Connections", "cross-text"]),
  practiceRule("central-ideas-and-details", ["Central Ideas and Details", "central idea", "main idea"]),
  practiceRule("command-of-evidence", ["Command of Evidence", "evidence questions"]),
  practiceRule("inference", ["inference questions", "inferences"]),
  practiceRule("transitions", ["transition questions", "transitions"]),
  practiceRule("rhetorical-synthesis", ["Rhetorical Synthesis", "rhetorical questions", "synthesis"]),
  practiceRule("boundaries-punctuation", [
    "sentence boundaries",
    "punctuation",
    "commas",
    "semicolons",
    "colons",
    "dashes",
    "comma splice",
    "independent clauses",
    "dependent clauses",
  ]),
  practiceRule("form-structure-sense", [
    "Form, Structure, and Sense",
    "subject-verb agreement",
    "pronoun agreement",
    "modifier placement",
    "modifiers",
    "verb tense",
    "parallel structure",
  ]),
  { phrases: ["SAT score calculator", "score calculator"], href: "/score-calculator" },
  { phrases: ["SAT percentile calculator", "percentile calculator"], href: "/sat-percentile-calculator" },
  { phrases: ["SAT countdown", "countdown"], href: "/sat-test-countdown" },
  { phrases: ["SAT to ACT converter"], href: "/sat-to-act-converter" },
  { phrases: ["PSAT to SAT predictor"], href: "/psat-to-sat-predictor" },
  { phrases: ["study plan generator", "custom plan"], href: "/sat-study-plan-generator" },
  { phrases: ["college score tool"], href: "/what-sat-score-do-i-need" },
  { phrases: ["college directory"], href: "/college" },
  { phrases: ["SAT vocabulary list", "SAT vocabulary"], href: "/vocab" },
  { phrases: ["timed modules", "full Digital SAT module", "practice module", "practice modules", "practice tests", "full tests", "timed tests", "hard Module 2", "Module 2", "Module 1"], href: "/modules" },
  { phrases: ["question bank", "drill sets", "skill drills"], href: "/bank" },
].filter((rule): rule is TextLinkRule => Boolean(rule));

const normalizedTextLinkRules = textLinkRules
  .flatMap((rule) =>
    rule.phrases.map((phrase) => ({
      phrase,
      lowerPhrase: phrase.toLowerCase(),
      href: rule.href,
    })),
  )
  .sort((leftRule, rightRule) => rightRule.phrase.length - leftRule.phrase.length);

const isWordChar = (char: string | undefined) => Boolean(char && /[A-Za-z0-9]/.test(char));

const isSelfHref = (href: string, currentSlug: string) =>
  href.replace(/^\//, "").replace(/\/$/, "") === currentSlug;

const renderLinkedText = (
  text: string,
  currentSlug: string,
  keyPrefix: string,
): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let buffer = "";
  let index = 0;
  let linkIndex = 0;
  const lowerText = text.toLowerCase();

  const flushBuffer = () => {
    if (!buffer) return;
    nodes.push(buffer);
    buffer = "";
  };

  while (index < text.length) {
    const rule = normalizedTextLinkRules.find((candidate) => {
      if (isSelfHref(candidate.href, currentSlug)) return false;
      if (!lowerText.startsWith(candidate.lowerPhrase, index)) return false;
      return !isWordChar(text[index - 1]) && !isWordChar(text[index + candidate.phrase.length]);
    });

    if (rule) {
      flushBuffer();
      const label = text.slice(index, index + rule.phrase.length);
      nodes.push(
        <Link
          key={`${keyPrefix}-${linkIndex}`}
          className="underline underline-offset-2 transition hover:text-foreground"
          to={rule.href}
        >
          {label}
        </Link>,
      );
      linkIndex += 1;
      index += rule.phrase.length;
    } else {
      buffer += text[index];
      index += 1;
    }
  }

  flushBuffer();
  return nodes;
};

const renderSectionTable = (
  section: LinkableAssetSection,
  currentSlug: string,
  keyPrefix: "table" | "generated-table",
) => {
  if (!section.table) return null;

  return (
    <div className={SECTION_TABLE_WRAPPER_CLASS}>
      <table className={SECTION_TABLE_CLASS}>
        <thead className={SECTION_TABLE_HEAD_CLASS}>
          <tr>
            {section.table.headers.map((header) => (
              <th key={header} className={SECTION_TABLE_HEADER_CELL_CLASS}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section.table.rows.map((row) => (
            <tr key={row.join("|")} className={SECTION_TABLE_ROW_CLASS}>
              {row.map((cell, cellIndex) => (
                <td key={`${cell}-${cellIndex}`} className={SECTION_TABLE_CELL_CLASS}>
                  {renderLinkedText(cell, currentSlug, `${keyPrefix}-${section.heading}-${row.join("|")}-${cellIndex}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const categoryGroups = (assets: LinkableAsset[]) => {
  const groups = new Map<LinkableAsset["category"], LinkableAsset[]>();
  for (const asset of assets) {
    const current = groups.get(asset.category) ?? [];
    current.push(asset);
    groups.set(asset.category, current);
  }
  return groups;
};

const allowedProductPrefixes = [
  "/bank",
  "/hard",
  "/modules",
  "/practice-tests",
  "/score-calculator",
  "/vocab",
  "/my-practice-sets",
  "/test-results",
  "/analysis",
  "/profile",
  "/college",
  "/sat-to-act-converter",
  "/sat-percentile-calculator",
  "/psat-to-sat-predictor",
  "/sat-study-plan-generator",
  "/what-sat-score-do-i-need",
  "/sat-test-countdown",
];

const productHrefRewrites: Record<string, ProductLink> = {
  "/sat-vocabulary": { label: "Open vocabulary practice", href: "/vocab" },
  "/sat-score": { label: "Use the score calculator", href: "/score-calculator" },
  "/sat-skill": { label: "Open the question bank", href: "/bank" },
};

const isAllowedProductHref = (href: string) =>
  allowedProductPrefixes.some((prefix) => href === prefix || href.startsWith(`${prefix}/`));

const normalizeProductLink = (link: ProductLink): ProductLink | null => {
  const rewritten = productHrefRewrites[link.href];
  if (rewritten) return rewritten;
  if (isAllowedProductHref(link.href)) return link;
  return null;
};

const defaultProductLinksByCategory: Record<LinkableAsset["category"], ProductLink[]> = {
  Math: [
    { label: "Open SAT Math bank", href: "/bank/math/browse" },
    { label: "Practice hard Math", href: "/hard" },
    { label: "Take timed modules", href: "/modules" },
  ],
  "Reading & Writing": [
    { label: "Open Reading and Writing bank", href: "/bank/reading/browse" },
    { label: "Practice vocabulary", href: "/vocab" },
    { label: "Take timed modules", href: "/modules" },
  ],
  Scores: [
    { label: "Use score calculator", href: "/score-calculator" },
    { label: "Review test results", href: "/test-results" },
    { label: "Open statistics", href: "/analysis" },
  ],
  Admissions: [
    { label: "Use college score tool", href: "/what-sat-score-do-i-need" },
    { label: "Browse college profiles", href: "/college" },
    { label: "Model your SAT score", href: "/score-calculator" },
  ],
  "Study Plans": [
    { label: "Generate a study plan", href: "/sat-study-plan-generator" },
    { label: "Start targeted drills", href: "/bank" },
    { label: "Take timed modules", href: "/modules" },
  ],
  Tools: [
    { label: "Take timed modules", href: "/modules" },
    { label: "Open the question bank", href: "/bank" },
    { label: "Use score calculator", href: "/score-calculator" },
  ],
};

const uniqueProductLinks = (links: ProductLink[]) => {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.href)) return false;
    seen.add(link.href);
    return true;
  });
};

const getProductLinks = (page: LinkableAsset) =>
  uniqueProductLinks([
    ...(page.productLinks ?? []).map(normalizeProductLink).filter((link): link is ProductLink => Boolean(link)),
    ...defaultProductLinksByCategory[page.category],
  ]).slice(0, 5);

const getPracticeTargets = (page: LinkableAsset): PracticeTarget[] => {
  const worksheetSkill = skillByWorksheetSlug.get(page.slug);
  if (worksheetSkill) {
    return [
      {
        label: `Start ${worksheetSkill.name} practice set`,
        title: `${worksheetSkill.name} practice set`,
        subject: toSubject(worksheetSkill),
        skill: worksheetSkill.officialSkill,
        maxQuestions: 20,
      },
    ];
  }

  return staticPracticeTargets[page.slug] ?? [];
};

const assetUseCases: Partial<Record<string, { body: string[]; list: string[] }>> = {
  "desmos-sat-shortcuts": {
    body: [
      "Use Desmos when the question gives equations, functions, a table, a scatterplot, or answer choices that can be tested numerically. Set up the math first, then use the calculator to remove algebra steps.",
      "The fastest workflow is usually: define the variable, enter the expression, read the graph or table, then translate the calculator output back into the answer choice or grid-in format.",
    ],
    list: [
      "Systems: graph both equations and use the intersection coordinates.",
      "Function values: enter the function, open a table, and type the requested x-values.",
      "Quadratics: use x-intercepts for solutions and the vertex for maximum or minimum questions.",
      "Scatterplots: run regression only when the question asks for a model, prediction, or line of best fit.",
      "Answer choices: test the choices only after checking which variable or unit the question asks for.",
    ],
  },
  "sat-desmos-reference-sheet": {
    body: [
      "Treat this as a decision sheet, not a list to memorize. The SAT rewards knowing when Desmos is faster than paper algebra and when it is just extra clicking.",
    ],
    list: [
      "Use graphing for intersections, roots, and systems.",
      "Use tables for function values and repeated substitutions.",
      "Use regression for data-model questions with enough points to justify a model.",
      "Stay with algebra for one-step equations, simple percentages, and mental-math checks.",
    ],
  },
  "sat-calculator-policy-chart": {
    body: [
      "The important policy point for prep is simple: calculator use is available throughout Math, so practice calculator-first decision making before test day.",
    ],
    list: [
      "Bring a personal approved calculator only as backup.",
      "Use the built-in Desmos for graphing, tables, and regression.",
      "Do not waste time opening Desmos for arithmetic you can do faster mentally.",
      "Practice with the same workflow you will use in Bluebook.",
    ],
  },
};

const getApplicationSection = (page: LinkableAsset) => {
  const worksheetSkill = skillByWorksheetSlug.get(page.slug);
  if (worksheetSkill) {
    return {
      heading: "How to use this on real SAT questions",
      body: [
        `${worksheetSkill.name} questions are easiest to improve when you practice the recognition step before the calculation step. First identify the ${worksheetSkill.domain} pattern, then choose the fastest method.`,
        `Inside the bank, start untimed until you can explain why the answer works. Then rerun the same skill under time pressure and review only the misses and guesses.`,
      ],
      list: worksheetSkill.keyTips,
    };
  }

  const useCase = assetUseCases[page.slug];
  if (useCase) {
    return {
      heading: "How to use this on real SAT questions",
      ...useCase,
    };
  }

  if (page.category === "Scores" || page.category === "Admissions") {
    return {
      heading: "How to use this with your actual prep",
      body: [
        "Use score pages as decision tools, not reading assignments. Enter a real practice result, compare the section split to your target, then choose the next drill from the weaker section.",
        "The useful next action is always concrete: take a timed module, review missed questions, or model whether a score is high enough for the schools on your list.",
      ],
      list: [
        "Use the score calculator after every timed module.",
        "Check whether Math or Reading and Writing is limiting the total score.",
        "Turn the weakest section into a bank drill before taking another full test.",
      ],
    };
  }

  if (page.category === "Study Plans") {
    return {
      heading: "How to turn this plan into practice",
      body: [
        "A study plan only works if each block turns into a question set, a timed module, or a review session. Keep the schedule narrow enough that you can finish the work and review it.",
      ],
      list: [
        "Start each week with one target skill in Math and one in Reading and Writing.",
        "Use timed modules to test whether skill drills transfer under pressure.",
        "Review misses before adding more new questions.",
      ],
    };
  }

  return {
    heading: "How to use this on 1600.now",
    body: [
      "Read the chart once, then switch into practice. The site is built around filtered bank questions, timed modules, score tools, and saved practice sets, so the next step should be an action inside one of those tools.",
    ],
    list: [
      "Use the question bank when the page names a skill or domain.",
      "Use timed modules when the page is about pacing or test format.",
      "Use score tools when the page is about score targets or admissions decisions.",
    ],
  };
};

const drillBlockForSkill = (skill: (typeof satSkills)[number]): LinkableAssetSection[] => [
  {
    heading: "How to recognize this question type",
    body: [
      `${skill.name} questions usually signal themselves through the representation they give you: an equation, table, graph, short passage, or answer-choice pattern tied to ${skill.domain}. Do not start calculating until you have named the pattern.`,
      `On a real module, the fastest students first decide whether the question is asking for a value, a relationship, an interpretation, or a rewritten form. That decision tells you which tool to use.`,
    ],
    list: [
      `Look for wording connected to ${skill.officialSkill}.`,
      `Identify whether the answer should be a number, expression, sentence, or interpretation.`,
      "Underline the exact value or claim the question asks for before touching the answer choices.",
      ...skill.keyTips.slice(0, 2),
    ],
  },
  {
    heading: "90-minute drill block",
    body: [
      "Use this sequence when the page is no longer just reading material. The goal is to convert the topic into score movement.",
    ],
    table: {
      headers: ["Time", "Work", "Success check"],
      rows: [
        ["0-10 min", "Read the rules and solve two examples slowly.", "You can say why each step is valid."],
        ["10-35 min", "Do 10 untimed bank questions from this skill.", "Misses are caused by content gaps, not rushing."],
        ["35-65 min", "Do 15 timed questions from the same skill.", "Average time stays under the module pace."],
        ["65-90 min", "Redo every miss without the explanation open.", "You can solve the miss cleanly on the second pass."],
      ],
    },
  },
];

const desmosDetailSections: LinkableAssetSection[] = [
  {
    heading: "Actual Desmos shortcuts to practice",
    body: [
      "These are the calculator moves worth making automatic before test day. Practice the typed setup, not just the idea.",
    ],
    table: {
      headers: ["Problem type", "What to type in Desmos", "Shortcut"],
      rows: [
        ["Solve f(x) = g(x)", "Enter each side as its own graph.", "Click the intersection and read the x-coordinate."],
        ["System of equations", "Type both equations exactly as written.", "Use the intersection point, then check whether the question asks for x, y, or an expression like x + y."],
        ["Quadratic roots", "Type y = ax^2 + bx + c.", "Read x-intercepts instead of factoring when the numbers are ugly."],
        ["Vertex / maximum / minimum", "Type the function and zoom near the turning point.", "Use the vertex coordinates; the x-value and y-value answer different questions."],
        ["Function table", "Define f(x)=..., then open a table.", "Type only the requested x-values and read f(x)."],
        ["Unknown constant", "Type the equation with a letter such as a.", "Add the slider, then adjust or test answer choices until the condition is true."],
        ["Scatterplot regression", "Put points in a table, then type y_1 ~ m x_1 + b.", "Read m and b, then use the model only if the question asks for a prediction or line of best fit."],
        ["Restrict a graph", "Add braces such as {0 < x < 10}.", "Focus on the interval the SAT actually asks about."],
      ],
    },
  },
  {
    heading: "When Desmos is a trap",
    body: [
      "Desmos saves time only when the setup is faster than the algebra. If you spend 30 seconds deciding what to type, the shortcut stopped being a shortcut.",
    ],
    list: [
      "Skip Desmos for one-step percent, ratio, or formula-substitution questions.",
      "Do not use regression when the question only asks for the slope between two given points.",
      "Do not trust the visible graph window; zoom or use a table when the value matters.",
      "Do not copy the intersection blindly if the question asks for a transformed value.",
      "Do not use a slider until you have decided what condition the constant must satisfy.",
    ],
  },
];

const detailSectionsForCategory = (page: LinkableAsset): LinkableAssetSection[] => {
  if (page.slug === "desmos-sat-shortcuts") return desmosDetailSections;

  const worksheetSkill = skillByWorksheetSlug.get(page.slug);
  if (worksheetSkill) return drillBlockForSkill(worksheetSkill);

  if (page.category === "Math") {
    return [
      {
        heading: "How to turn this into SAT Math points",
        body: [
          "For Math resources, the useful question is always: which setup gets me to the answer fastest? Decide between mental math, paper algebra, Desmos, or answer-choice testing before you start calculating.",
        ],
        list: [
          "Use Desmos for intersections, roots, vertices, tables, and regression.",
          "Use paper algebra when the equation is short or already factored.",
          "Use answer choices when they are ordered and easy to substitute.",
          "After every miss, label it as setup, algebra, calculator, or reading error.",
        ],
      },
    ];
  }

  if (page.category === "Reading & Writing") {
    return [
      {
        heading: "How to turn this into Reading and Writing points",
        body: [
          "For Reading and Writing resources, most improvement comes from slowing down the decision step. Name the question type, predict the job of the answer, then compare choices.",
        ],
        list: [
          "For grammar, identify the tested rule before reading all four choices.",
          "For evidence and inference, prove the answer from a specific phrase in the passage.",
          "For transitions, decide the logical relationship before looking at choices.",
          "For vocabulary, replace the word in context and reject choices with the wrong tone or direction.",
        ],
      },
    ];
  }

  if (page.category === "Scores" || page.category === "Admissions") {
    return [
      {
        heading: "What decision this page should help you make",
        body: [
          "A score or admissions page is useful only if it changes your next action. Use it to decide whether to retest, which section is limiting the total, and whether your target colleges need a stronger score.",
        ],
        table: {
          headers: ["If this is true", "Do this next"],
          rows: [
            ["Math is 40+ points lower than Reading and Writing", "Run two Math domain drills before the next full module."],
            ["Reading and Writing is 40+ points lower than Math", "Split practice between grammar rules and evidence/inference questions."],
            ["Your score is below the college middle-50% range", "Plan a retake and target the weaker section first."],
            ["Your score is above the 75th percentile for your list", "Spend prep time on grades, essays, and application fit instead of chasing small SAT gains."],
          ],
        },
      },
    ];
  }

  if (page.category === "Study Plans") {
    return [
      {
        heading: "How to know whether the plan is working",
        body: [
          "Do not judge a study plan by hours logged. Judge it by whether your miss pattern changes after each week.",
        ],
        list: [
          "Track misses by skill, not just by section score.",
          "Repeat missed questions 48 hours later before adding more new drills.",
          "Use one timed module each week as the transfer test.",
          "If the same mistake appears twice, make the next drill narrower.",
        ],
      },
    ];
  }

  return [
    {
      heading: "How to use this page without wasting time",
      body: [
        "Read for the decision, then move into practice. The page should tell you which tool to open, which skill to drill, or which score question to answer.",
      ],
      list: [
        "If the topic names a skill, open that filtered bank route.",
        "If the topic names timing, use a timed module.",
        "If the topic names scores or colleges, use the score tools.",
        "If the topic names mistakes, create a saved drill set and redo it later.",
      ],
    },
  ];
};

const ResourcePracticeButton = ({
  target,
  exitTo,
}: {
  target: PracticeTarget;
  exitTo: string;
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    if (loading) return;
    setLoading(true);
    const questions = target.skill
      ? await loadQuestionsBySkill(target.subject, target.skill)
      : await loadQuestionsByDomain(target.subject, target.domain!);
    const practiceSet = createCustomPracticeSetFromQuestions({
      questions,
      title: target.title,
      uid: user?.id ?? null,
      maxQuestions: target.maxQuestions ?? 20,
      sourceType: "bank-selection",
    });
    launchCustomPracticeSet(practiceSet, navigate, exitTo);
  };

  return (
    <button
      type="button"
      onClick={handleStart}
      disabled={loading}
      className="inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-cobalt hover:text-white disabled:pointer-events-none disabled:opacity-70"
    >
      {loading ? "Building set..." : target.label}
    </button>
  );
};

const LinkableAssetPage = () => {
  const location = useLocation();
  const slug = location.pathname.replace(/^\//, "").replace(/\/$/, "");
  const asset = linkableAssetBySlug.get(slug);
  const hub = linkableHubBySlug.get(slug);

  if (!asset && !hub) return <Navigate to="/" replace />;

  if (hub) {
    const url = `${SITE}/${hub.slug}`;
    const hubAssets = hub.assetSlugs
      .map((assetSlug) => linkableAssetBySlug.get(assetSlug))
      .filter((item): item is LinkableAsset => Boolean(item));
    const grouped = categoryGroups(hubAssets);

    return (
      <article className="mx-auto max-w-5xl px-6 py-10">
        <PageSeo
          id={`resource-hub-${hub.slug}`}
          title={hub.metaTitle}
          description={hub.metaDescription}
          canonical={url}
          jsonLd={[
            buildBreadcrumbJsonLd([
              { name: "Home", url: `${SITE}/` },
              { name: hub.title, url },
            ]),
            {
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: hub.title,
              description: hub.metaDescription,
              url,
              hasPart: hubAssets.map((item) => ({
                "@type": "CreativeWork",
                name: item.title,
                url: `${SITE}/${item.slug}`,
              })),
            },
            buildItemListJsonLd(
              hub.title,
              hubAssets.map((item) => ({
                name: item.title,
                url: `${SITE}/${item.slug}`,
              })),
            ),
          ]}
        />

        <nav className="mb-6 text-sm text-muted-foreground">
          <Link className="hover:underline" to="/">
            Home
          </Link>{" "}
          › <span className="text-foreground">{hub.title}</span>
        </nav>

        <header className="mb-10">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            {hub.title}
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
            {hub.intro}
          </p>
        </header>

        <div className="grid gap-8">
          {Array.from(grouped.entries()).map(([category, items]) => (
            <section key={category}>
              <h2 className={SECTION_HEADING_CLASS}>
                {category}
              </h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {items.map((item) => (
                  <Link
                    key={item.slug}
                    to={`/${item.slug}`}
                    className="rounded-lg border border-border p-4 transition hover:bg-muted"
                  >
                    <div className="text-sm font-semibold">{item.title}</div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {item.metaDescription}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    );
  }

  const page = asset!;
  const url = `${SITE}/${page.slug}`;
  const practiceTargets = getPracticeTargets(page);
  const productLinks = getProductLinks(page);
  const applicationSection = getApplicationSection(page);
  const generatedDetailSections = detailSectionsForCategory(page);

  return (
    <article className="mx-auto max-w-4xl px-6 py-10">
      <PageSeo
        id={`resource-${page.slug}`}
        title={page.metaTitle}
        description={page.metaDescription}
        canonical={url}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: `${SITE}/` },
            { name: "SAT Resources", url: `${SITE}/sat-resources` },
            { name: page.title, url },
          ]),
          buildArticleJsonLd({
            title: page.title,
            description: page.metaDescription,
            url,
            datePublished: ASSET_PUBLISHED,
          }),
          buildFaqJsonLd(page.faqs),
        ]}
      />

      <nav className="mb-6 text-sm text-muted-foreground">
        <Link className="hover:underline" to="/">
          Home
        </Link>{" "}
        ›{" "}
        <Link className="hover:underline" to="/sat-resources">
          SAT Resources
        </Link>{" "}
        › <span className="text-foreground">{page.title}</span>
      </nav>

      <header className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {page.category} · {page.kind.replace("-", " ")}
        </div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
          {page.title}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{page.intro}</p>
      </header>

      <div className="space-y-10">
        {page.sections.map((section) => (
          <section key={section.heading}>
            <h2 className={SECTION_HEADING_CLASS}>
              {section.heading}
            </h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className={SECTION_PARAGRAPH_CLASS}>
                {renderLinkedText(paragraph, page.slug, `body-${section.heading}-${paragraph}`)}
              </p>
            ))}
            {section.list && (
              <ul className={SECTION_LIST_CLASS}>
                {section.list.map((item) => (
                  <li key={item}>
                    {renderLinkedText(item, page.slug, `list-${section.heading}-${item}`)}
                  </li>
                ))}
              </ul>
            )}
            {renderSectionTable(section, page.slug, "table")}
          </section>
        ))}

        <section>
          <h2 className={SECTION_HEADING_CLASS}>
            {applicationSection.heading}
          </h2>
          {applicationSection.body.map((paragraph) => (
            <p key={paragraph} className={SECTION_PARAGRAPH_CLASS}>
              {renderLinkedText(paragraph, page.slug, `application-${paragraph}`)}
            </p>
          ))}
          <ul className={SECTION_LIST_CLASS}>
            {applicationSection.list.map((item) => (
              <li key={item}>
                {renderLinkedText(item, page.slug, `application-list-${item}`)}
              </li>
            ))}
          </ul>
        </section>

        {generatedDetailSections.map((section) => (
          <section key={section.heading}>
            <h2 className={SECTION_HEADING_CLASS}>
              {section.heading}
            </h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className={SECTION_PARAGRAPH_CLASS}>
                {renderLinkedText(paragraph, page.slug, `generated-${section.heading}-${paragraph}`)}
              </p>
            ))}
            {section.list && (
              <ul className={SECTION_LIST_CLASS}>
                {section.list.map((item) => (
                  <li key={item}>
                    {renderLinkedText(item, page.slug, `generated-list-${section.heading}-${item}`)}
                  </li>
                ))}
              </ul>
            )}
            {renderSectionTable(section, page.slug, "generated-table")}
          </section>
        ))}
      </div>

      {(practiceTargets.length > 0 || productLinks.length > 0) && (
        <section className="mt-12 rounded-xl border border-border p-5">
          <h2 className="text-xl font-semibold tracking-tight">
            Practice this on 1600.now
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {practiceTargets.map((target) => (
              <ResourcePracticeButton
                key={`${target.subject}-${target.domain ?? target.skill}-${target.label}`}
                target={target}
                exitTo={`/${page.slug}`}
              />
            ))}
            {productLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="inline-flex rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12">
        <h2 className={SECTION_HEADING_CLASS}>FAQs</h2>
        <div className="mt-4 space-y-5">
          {page.faqs.map((faq) => (
            <div key={faq.question}>
              <h3 className="text-base font-semibold">{faq.question}</h3>
              <p className="mt-1 text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className={SECTION_HEADING_CLASS}>
          Keep working
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {defaultProductLinksByCategory[page.category].map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </article>
  );
};

export default LinkableAssetPage;
