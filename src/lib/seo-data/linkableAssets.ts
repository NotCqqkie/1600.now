import { satSkills } from "@/lib/seo-data/satSkillsData";

export type LinkableAssetKind =
  | "worksheet"
  | "chart"
  | "college"
  | "study-plan"
  | "tool-companion";

export interface LinkableAssetTable {
  headers: string[];
  rows: string[][];
}

export interface LinkableAssetSection {
  heading: string;
  body: string[];
  list?: string[];
  table?: LinkableAssetTable;
}

export interface LinkableAsset {
  slug: string;
  kind: LinkableAssetKind;
  category: "Math" | "Reading & Writing" | "Scores" | "Admissions" | "Study Plans" | "Tools";
  title: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  sections: LinkableAssetSection[];
  faqs: { question: string; answer: string }[];
  relatedSlugs?: string[];
  productLinks?: { label: string; href: string }[];
}

export interface LinkableHub {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  assetSlugs: string[];
}

const bankSkillHref = (subjectPath: "math" | "reading", skill: string) =>
  `/bank/${subjectPath}/skill/${encodeURIComponent(skill)}`;

const bankDomainHref = (subjectPath: "math" | "reading", domain: string) =>
  `/bank/${subjectPath}/domain/${encodeURIComponent(domain)}`;

const skillWorksheetAssets: LinkableAsset[] = satSkills.map((skill) => {
  const subjectPath = skill.section === "Math" ? "math" : "reading";
  const category = skill.section === "Math" ? "Math" : "Reading & Writing";

  return {
    slug: `sat-${skill.slug}-worksheet`,
    kind: "worksheet",
    category,
    title: `SAT ${skill.name} Worksheet`,
    metaTitle: `SAT ${skill.name} Worksheet: Practice, Rules, and Review`,
    metaDescription: `Free SAT ${skill.name.toLowerCase()} worksheet with rules, practice checklist, common traps, and links to targeted Digital SAT practice.`,
    intro: `${skill.description} This worksheet page turns that skill into a focused review asset: what to know, what to practice, and what to check before moving on.`,
    sections: [
      {
        heading: "What this worksheet covers",
        body: [
          `${skill.name} belongs to the ${skill.domain} domain on the Digital SAT ${skill.section} section.`,
          `Use this as a one-skill worksheet before timed modules. The goal is not just to get questions right, but to recognize the pattern quickly under SAT timing.`,
        ],
        list: [
          `Official skill: ${skill.officialSkill}`,
          `Section: ${skill.section}`,
          `Domain: ${skill.domain}`,
          "Best use: focused drill session before a timed module",
        ],
      },
      {
        heading: "Rules to remember",
        body: [
          "Before drilling this skill, memorize the core rules below and keep them next to your scratch work.",
        ],
        list: skill.keyTips,
      },
      {
        heading: "Practice routine",
        body: [
          "Start untimed until you can explain the pattern. Then switch to timed sets so the skill holds up inside a full module.",
        ],
        list: [
          "Do 10 warmup questions and write down every mistake type.",
          "Do 20 timed questions from the same skill.",
          "Review missed questions without looking at the explanation first.",
          "Repeat the misses 48 hours later to confirm the fix stuck.",
        ],
      },
    ],
    faqs: [
      {
        question: `How do I practice SAT ${skill.name.toLowerCase()}?`,
        answer: `Drill ${skill.name.toLowerCase()} as its own skill first, then mix it into timed modules. Isolated practice builds the pattern; timed modules prove you can use it under pressure.`,
      },
      {
        question: `Is ${skill.name.toLowerCase()} important on the Digital SAT?`,
        answer: `Yes. It is part of the official ${skill.domain} domain for the SAT ${skill.section} section, so it can appear on real test forms.`,
      },
      {
        question: "Should I review explanations after every question?",
        answer: "Review every missed or guessed question. Correct guesses still hide weak reasoning, and weak reasoning becomes expensive on hard Module 2.",
      },
    ],
    relatedSlugs: [
      skill.section === "Math" ? "sat-math-resources" : "sat-reading-writing-resources",
      "digital-sat-timing-chart",
      "sat-practice-test-score-sheet",
    ],
    productLinks: [
      { label: "Practice this skill", href: bankSkillHref(subjectPath, skill.officialSkill) },
      { label: "Review skill guide", href: `/sat-skill/${skill.slug}` },
      { label: "Open the question bank", href: `/bank/${subjectPath}/browse` },
    ],
  };
});

const staticAssets: LinkableAsset[] = [
  {
    slug: "sat-score-chart",
    kind: "chart",
    category: "Scores",
    title: "SAT Score Chart",
    metaTitle: "SAT Score Chart: Percentiles, Ranges, and College Targets",
    metaDescription: "Free SAT score chart with percentile bands, score tiers, college target ranges, and what each Digital SAT score usually means.",
    intro: "Use this SAT score chart to translate a 400-1600 score into a practical admissions target. The chart groups scores by percentile, competitiveness, and next-step study focus.",
    sections: [
      {
        heading: "SAT score bands",
        body: ["The same score can mean different things depending on your college list. These bands give a fast national benchmark."],
        table: {
          headers: ["Score range", "Approximate meaning", "Best next step"],
          rows: [
            ["1550-1600", "Elite / top 1%", "Eliminate careless errors"],
            ["1450-1540", "Highly competitive", "Drill hard Module 2 questions"],
            ["1350-1440", "Competitive", "Push both sections into hard modules"],
            ["1250-1340", "Above average", "Clean up medium-difficulty misses"],
            ["1100-1240", "Solid", "Rebuild algebra and grammar fundamentals"],
            ["400-1090", "Building", "Focus on easy and medium questions first"],
          ],
        },
      },
      {
        heading: "How to use the chart",
        body: ["Find your current range, then set a target score 50-150 points higher for the next study cycle."],
        list: ["Use percentiles for national context.", "Use college ranges for admissions context.", "Use section scores to choose what to drill next."],
      },
    ],
    faqs: [
      { question: "What is a good SAT score?", answer: "A good SAT score is the score that makes you competitive at your target colleges. Nationally, 1200+ is above average, 1400+ is strong, and 1500+ is elite." },
      { question: "Is a 1600 the only perfect SAT score?", answer: "Yes. The SAT total scale runs from 400 to 1600, so 1600 is the maximum possible score." },
    ],
    relatedSlugs: ["sat-percentile-chart", "sat-score-needed-for-college", "sat-raw-score-conversion-chart"],
    productLinks: [{ label: "Use the SAT score calculator", href: "/score-calculator" }],
  },
  {
    slug: "sat-percentile-chart",
    kind: "chart",
    category: "Scores",
    title: "SAT Percentile Chart",
    metaTitle: "SAT Percentile Chart: Compare Every Digital SAT Score",
    metaDescription: "SAT percentile chart for common Digital SAT scores, including national rank, score tier, and what each score means.",
    intro: "SAT percentiles show how your score compares with other test takers. This chart is built for quick lookup and planning.",
    sections: [
      {
        heading: "Common SAT percentiles",
        body: ["Percentiles are approximate and should be used as planning ranges, not exact admissions guarantees."],
        table: {
          headers: ["SAT score", "Approximate percentile", "Tier"],
          rows: [
            ["1600", "99th+", "Perfect"],
            ["1500", "98th", "Elite"],
            ["1400", "94th", "Strong"],
            ["1300", "86th", "Competitive"],
            ["1200", "74th", "Above average"],
            ["1100", "58th", "Solid"],
            ["1050", "49th", "Near average"],
            ["1000", "40th", "Building"],
          ],
        },
      },
      {
        heading: "Percentile versus admissions strength",
        body: ["Percentile tells you national rank. Admissions strength depends on the colleges on your list and where your score lands in their middle-50% range."],
      },
    ],
    faqs: [
      { question: "What percentile is a 1400 SAT?", answer: "A 1400 SAT is roughly the 94th percentile nationally." },
      { question: "What percentile is a 1500 SAT?", answer: "A 1500 SAT is roughly the 98th percentile nationally." },
    ],
    relatedSlugs: ["sat-score-chart", "sat-percentile-lookup-table", "sat-section-score-chart"],
    productLinks: [{ label: "Open the percentile calculator", href: "/sat-percentile-calculator" }],
  },
  {
    slug: "sat-raw-score-conversion-chart",
    kind: "chart",
    category: "Scores",
    title: "SAT Raw Score Conversion Chart",
    metaTitle: "SAT Raw Score Conversion Chart for the Digital SAT",
    metaDescription: "Digital SAT raw score conversion guide explaining why missed questions convert differently across adaptive modules and test forms.",
    intro: "The Digital SAT does not use one fixed raw-score chart. Adaptive routing and equating mean the same number of misses can produce different scaled scores.",
    sections: [
      {
        heading: "Why raw-score conversion varies",
        body: ["College Board equates each test form. That means raw correct counts convert to scaled scores differently depending on form difficulty and module path."],
        list: ["Module 1 determines easier or harder Module 2.", "Hard Module 2 unlocks the highest section scores.", "Easy Module 2 caps the section score below the ceiling.", "One hard question can be worth more than one easy question."],
      },
      {
        heading: "Planning ranges",
        body: ["Use these rough miss budgets only for planning."],
        table: {
          headers: ["Target score", "Rough total miss budget", "Priority"],
          rows: [
            ["1500+", "0-6 misses", "Hard Module 2 accuracy"],
            ["1400", "7-12 misses", "Medium and hard consistency"],
            ["1300", "13-20 misses", "Avoid easy misses"],
            ["1200", "21-28 misses", "Build fundamentals"],
          ],
        },
      },
    ],
    faqs: [
      { question: "Is there an official Digital SAT raw score chart?", answer: "No single public chart works for every Digital SAT because adaptive routing and equating change the conversion." },
      { question: "Can I estimate my score from missed questions?", answer: "Yes, but only roughly. Use a score calculator for planning and Bluebook practice tests for the most reliable estimate." },
    ],
    relatedSlugs: ["sat-score-chart", "sat-practice-test-score-sheet", "sat-section-score-chart"],
    productLinks: [{ label: "Estimate your score", href: "/score-calculator" }],
  },
  {
    slug: "digital-sat-timing-chart",
    kind: "chart",
    category: "Tools",
    title: "Digital SAT Timing Chart",
    metaTitle: "Digital SAT Timing Chart: Sections, Modules, and Pacing",
    metaDescription: "Digital SAT timing chart with section lengths, question counts, minutes per question, and pacing checkpoints.",
    intro: "The Digital SAT is short, but the modules move quickly. This timing chart gives the section-by-section pacing targets students need before test day.",
    sections: [
      {
        heading: "Digital SAT timing",
        body: ["Each section has two modules. You can move around inside a module, but you cannot return to a module after submitting it."],
        table: {
          headers: ["Module", "Questions", "Time", "Pace"],
          rows: [
            ["Reading & Writing Module 1", "27", "32 minutes", "About 71 seconds/question"],
            ["Reading & Writing Module 2", "27", "32 minutes", "About 71 seconds/question"],
            ["Math Module 1", "22", "35 minutes", "About 95 seconds/question"],
            ["Math Module 2", "22", "35 minutes", "About 95 seconds/question"],
          ],
        },
      },
      {
        heading: "Pacing checkpoints",
        body: ["Use checkpoints instead of staring at the timer after every question."],
        list: ["Reading & Writing: question 14 with about 16 minutes left.", "Math: question 11 with about 17 minutes left.", "Leave 2-3 minutes for flagged questions if possible."],
      },
    ],
    faqs: [
      { question: "How long is the Digital SAT?", answer: "The Digital SAT has 2 hours and 14 minutes of testing time plus one 10-minute break." },
      { question: "Which section has more time per question?", answer: "Math has more time per question: about 95 seconds compared with about 71 seconds in Reading & Writing." },
    ],
    relatedSlugs: ["digital-sat-format-chart", "sat-practice-test-score-sheet", "2-week-sat-study-plan"],
    productLinks: [
      { label: "Take timed modules", href: "/modules" },
      { label: "Open the question bank", href: "/bank" },
    ],
  },
  {
    slug: "digital-sat-format-chart",
    kind: "chart",
    category: "Tools",
    title: "Digital SAT Format Chart",
    metaTitle: "Digital SAT Format Chart: Adaptive Modules and Question Types",
    metaDescription: "Digital SAT format chart showing sections, modules, adaptive routing, question counts, and tested skill groups.",
    intro: "The Digital SAT format is module-based and adaptive. This chart summarizes the structure students need to understand before practice tests.",
    sections: [
      {
        heading: "Format overview",
        body: ["Both sections use Module 1 to determine whether Module 2 is easier or harder."],
        table: {
          headers: ["Section", "Modules", "Question types", "Adaptive?"],
          rows: [
            ["Reading & Writing", "2", "Short passage multiple choice", "Yes"],
            ["Math", "2", "Multiple choice and student-produced response", "Yes"],
          ],
        },
      },
      {
        heading: "What changed from the paper SAT",
        body: ["The Digital SAT is shorter, uses short reading passages, allows Desmos throughout Math, and adapts by section."],
      },
    ],
    faqs: [
      { question: "Is the Digital SAT adaptive?", answer: "Yes. Reading & Writing and Math each use section-level adaptivity based on Module 1 performance." },
      { question: "Does the Digital SAT still have long reading passages?", answer: "No. Reading & Writing uses short passages with one question each." },
    ],
    relatedSlugs: ["digital-sat-timing-chart", "sat-question-types-chart", "desmos-sat-shortcuts"],
    productLinks: [
      { label: "Take timed modules", href: "/modules" },
      { label: "Read the Digital SAT guide", href: "/digital-sat-guide" },
    ],
  },
  {
    slug: "sat-math-formula-chart",
    kind: "chart",
    category: "Math",
    title: "SAT Math Formula Chart",
    metaTitle: "SAT Math Formula Chart: What to Know for the Digital SAT",
    metaDescription: "Printable SAT Math formula chart covering algebra, geometry, circles, triangles, volume, and formulas worth memorizing.",
    intro: "The SAT gives you some formulas, but not every formula worth knowing. This chart separates what appears on the reference sheet from what you should memorize.",
    sections: [
      {
        heading: "High-value formulas",
        body: ["Prioritize formulas that save time or appear inside multi-step problems."],
        table: {
          headers: ["Topic", "Formula", "Use"],
          rows: [
            ["Slope", "(y2 - y1) / (x2 - x1)", "Lines and rates"],
            ["Quadratic formula", "x = (-b +/- sqrt(b^2 - 4ac)) / 2a", "Non-factorable quadratics"],
            ["Circle area", "A = pi r^2", "Geometry"],
            ["Triangle area", "A = 1/2 bh", "Geometry"],
            ["Exponential growth", "y = a(1 + r)^x", "Growth models"],
          ],
        },
      },
      {
        heading: "What to memorize",
        body: ["Memorize formulas that let you move faster than opening the reference sheet."],
        list: ["Slope-intercept form", "Point-slope form", "Vertex form", "Distance formula", "Percent change"],
      },
    ],
    faqs: [
      { question: "Does the Digital SAT provide a formula sheet?", answer: "Yes. The Math section includes a reference sheet, but you should still memorize common algebra and function forms." },
      { question: "What formula matters most for SAT Math?", answer: "Slope is the highest-frequency formula because it appears in lines, functions, tables, graphs, and word problems." },
    ],
    relatedSlugs: ["sat-linear-functions-worksheet", "sat-circles-worksheet", "sat-right-triangles-and-trig-worksheet"],
    productLinks: [
      { label: "Practice SAT Math", href: "/bank/math/browse" },
      { label: "Practice Algebra", href: bankDomainHref("math", "Algebra") },
      { label: "Practice Geometry", href: bankDomainHref("math", "Geometry and Trigonometry") },
    ],
  },
  {
    slug: "sat-reading-writing-skill-chart",
    kind: "chart",
    category: "Reading & Writing",
    title: "SAT Reading and Writing Skill Chart",
    metaTitle: "SAT Reading and Writing Skill Chart for the Digital SAT",
    metaDescription: "Chart of every Digital SAT Reading and Writing skill, domain, question pattern, and best practice method.",
    intro: "Reading and Writing improves fastest when students drill by skill instead of mixing every question type together. This chart maps the section.",
    sections: [
      {
        heading: "Skill groups",
        body: ["The section tests four broad domains. Each domain rewards a different solving routine."],
        table: {
          headers: ["Domain", "Common skills", "Best drill method"],
          rows: [
            ["Information and Ideas", "Main idea, evidence, inference", "Slow accuracy first"],
            ["Craft and Structure", "Words in context, structure, cross-text", "Elimination practice"],
            ["Expression of Ideas", "Transitions, synthesis", "Pattern recognition"],
            ["Standard English Conventions", "Punctuation, grammar", "Rule memorization"],
          ],
        },
      },
      {
        heading: "How to use it",
        body: ["Pick one domain per day. Drill a narrow skill, review misses, then mix skills inside a timed module."],
      },
    ],
    faqs: [
      { question: "What are the Digital SAT Reading and Writing domains?", answer: "The four domains are Information and Ideas, Craft and Structure, Expression of Ideas, and Standard English Conventions." },
      { question: "Should I practice SAT reading by passage type?", answer: "For the Digital SAT, practicing by skill is usually better because each passage has only one question." },
    ],
    relatedSlugs: ["sat-words-in-context-worksheet", "sat-transitions-worksheet", "sat-boundaries-punctuation-worksheet"],
    productLinks: [
      { label: "Practice Reading and Writing", href: "/bank/reading/browse" },
      { label: "Practice grammar", href: bankDomainHref("reading", "Standard English Conventions") },
      { label: "Practice transitions", href: bankSkillHref("reading", "Transitions") },
    ],
  },
  {
    slug: "sat-desmos-reference-sheet",
    kind: "chart",
    category: "Math",
    title: "SAT Desmos Reference Sheet",
    metaTitle: "SAT Desmos Reference Sheet: Graphing Calculator Moves",
    metaDescription: "SAT Desmos reference sheet with graphing shortcuts, table tricks, regression use cases, and when to use calculator-first solving.",
    intro: "Desmos is available on every Digital SAT Math question. This reference sheet lists the calculator moves that save the most time.",
    sections: [
      {
        heading: "High-value Desmos moves",
        body: ["Use Desmos to verify algebra, find intersections, test answer choices, and model word problems."],
        list: ["Graph both sides of an equation and find intersections.", "Use tables to test answer choices quickly.", "Use sliders for unknown constants.", "Use regression for data-model questions.", "Use restrictions to narrow domains."],
      },
      {
        heading: "When not to use Desmos",
        body: ["Do not open Desmos when mental math or one algebra step is faster. The calculator is a speed tool, not a replacement for fundamentals."],
      },
    ],
    faqs: [
      { question: "Can I use Desmos on every SAT Math question?", answer: "Yes. The built-in Desmos graphing calculator is available throughout the Digital SAT Math section." },
      { question: "Is Desmos faster than algebra?", answer: "Often, but not always. It is fastest for graph intersections, systems, functions, and answer-choice testing." },
    ],
    relatedSlugs: ["desmos-sat-shortcuts", "sat-nonlinear-functions-worksheet", "sat-systems-of-linear-equations-worksheet"],
    productLinks: [
      { label: "Practice systems with Desmos", href: bankSkillHref("math", "Systems of two linear equations in two variables") },
      { label: "Practice nonlinear functions", href: bankSkillHref("math", "Nonlinear functions") },
      { label: "Read the Desmos SAT guide", href: "/desmos-sat-guide" },
    ],
  },
  {
    slug: "sat-vocabulary-frequency-list",
    kind: "chart",
    category: "Reading & Writing",
    title: "SAT Vocabulary Frequency List",
    metaTitle: "SAT Vocabulary Frequency List for Digital SAT Words in Context",
    metaDescription: "SAT vocabulary frequency list organized by test usefulness, with a study routine for Digital SAT Words in Context questions.",
    intro: "The Digital SAT does not test obscure word memorization as directly as older tests, but vocabulary still matters in Words in Context and dense passages.",
    sections: [
      {
        heading: "High-frequency categories",
        body: ["Study word families, not isolated definitions. The test often rewards tone, logic, and context clues."],
        table: {
          headers: ["Category", "Examples", "How it appears"],
          rows: [
            ["Contrast words", "however, nevertheless, whereas", "Transitions"],
            ["Evidence words", "substantiate, corroborate, undermine", "Research passages"],
            ["Tone words", "skeptical, ambivalent, emphatic", "Purpose questions"],
            ["Change words", "fluctuate, diminish, intensify", "Science passages"],
          ],
        },
      },
      {
        heading: "Study routine",
        body: ["Learn words in sample sentences and review them inside real passage contexts."],
      },
    ],
    faqs: [
      { question: "Does the Digital SAT test vocabulary?", answer: "Yes. Vocabulary appears most directly in Words in Context questions and indirectly in dense reading passages." },
      { question: "Should I memorize hundreds of SAT words?", answer: "Memorize high-frequency academic words, but prioritize context-clue practice over raw flashcard volume." },
    ],
    relatedSlugs: ["sat-words-in-context-worksheet", "sat-vocabulary-frequency-list", "sat-reading-writing-skill-chart"],
    productLinks: [
      { label: "Practice Words in Context", href: bankSkillHref("reading", "Words in Context") },
      { label: "Open SAT vocabulary", href: "/sat-vocabulary" },
    ],
  },
  {
    slug: "sat-grammar-rules-chart",
    kind: "chart",
    category: "Reading & Writing",
    title: "SAT Grammar Rules Chart",
    metaTitle: "SAT Grammar Rules Chart: Digital SAT Writing Rules",
    metaDescription: "SAT grammar rules chart covering agreement, modifiers, verb tense, pronouns, boundaries, and common Digital SAT traps.",
    intro: "SAT grammar is rule-based. A small set of rules explains most Standard English Conventions questions.",
    sections: [
      {
        heading: "Rules to master",
        body: ["Memorize the rule, then drill examples until the pattern is automatic."],
        table: {
          headers: ["Rule", "What to check", "Common trap"],
          rows: [
            ["Subject-verb agreement", "Core subject and verb", "Prepositional phrase distraction"],
            ["Pronoun agreement", "Pronoun and antecedent", "Singular they mismatch"],
            ["Modifier placement", "What the modifier describes", "Dangling opener"],
            ["Verb tense", "Timeline and surrounding verbs", "Unnecessary tense shift"],
          ],
        },
      },
      {
        heading: "Practice order",
        body: ["Start with punctuation, then agreement, then modifiers and tense. Punctuation produces the fastest score gains for most students."],
      },
    ],
    faqs: [
      { question: "What grammar is on the Digital SAT?", answer: "The Digital SAT tests punctuation, agreement, modifiers, verb tense, pronouns, and sentence boundaries." },
      { question: "Is there an SAT essay?", answer: "No. The Digital SAT has no essay. Grammar appears only in multiple-choice Reading and Writing questions." },
    ],
    relatedSlugs: ["sat-boundaries-punctuation-worksheet", "sat-form-structure-sense-worksheet", "sat-punctuation-rules-chart"],
    productLinks: [
      { label: "Practice grammar rules", href: bankSkillHref("reading", "Form, Structure, and Sense") },
      { label: "Practice punctuation", href: bankSkillHref("reading", "Boundaries") },
    ],
  },
  {
    slug: "sat-punctuation-rules-chart",
    kind: "chart",
    category: "Reading & Writing",
    title: "SAT Punctuation Rules Chart",
    metaTitle: "SAT Punctuation Rules Chart: Commas, Colons, Dashes, Semicolons",
    metaDescription: "SAT punctuation chart explaining commas, semicolons, colons, dashes, sentence boundaries, and the highest-frequency traps.",
    intro: "Punctuation questions are among the most learnable Digital SAT question types. This chart gives the rules in test-ready form.",
    sections: [
      {
        heading: "Core punctuation rules",
        body: ["The SAT rewards function, not vibes. Identify what each punctuation mark is doing in the sentence."],
        table: {
          headers: ["Punctuation", "Use", "Trap"],
          rows: [
            ["Comma", "Separate nonessential info or list items", "Comma splice"],
            ["Semicolon", "Join two independent clauses", "Using it before a fragment"],
            ["Colon", "Introduce explanation or list after a complete idea", "Using it after an incomplete lead-in"],
            ["Dash", "Set off interruption or emphasis", "Mismatched pair"],
          ],
        },
      },
      {
        heading: "Fast check",
        body: ["If punctuation joins clauses, label each side as independent or dependent before choosing."],
      },
    ],
    faqs: [
      { question: "What punctuation appears most on the SAT?", answer: "Commas, semicolons, colons, and dashes appear frequently in sentence-boundary questions." },
      { question: "How do I avoid comma splices?", answer: "Do not join two complete sentences with only a comma. Use a period, semicolon, or comma plus conjunction." },
    ],
    relatedSlugs: ["sat-boundaries-punctuation-worksheet", "sat-grammar-rules-chart", "sat-writing-practice"],
    productLinks: [
      { label: "Practice punctuation", href: bankSkillHref("reading", "Boundaries") },
      { label: "Review punctuation guide", href: "/sat-skill/boundaries-punctuation" },
    ],
  },
  {
    slug: "sat-score-release-calendar",
    kind: "chart",
    category: "Scores",
    title: "SAT Score Release Calendar",
    metaTitle: "SAT Score Release Calendar: When Digital SAT Scores Come Out",
    metaDescription: "SAT score release calendar and planning guide for when Digital SAT scores are usually posted after test day.",
    intro: "SAT scores are not instant. Use this release calendar to plan retakes, college deadlines, and when to send scores.",
    sections: [
      {
        heading: "Typical release timing",
        body: ["Most Digital SAT scores are released about 10-14 days after test day, though exact timing can vary."],
        table: {
          headers: ["Test type", "Typical release", "Planning note"],
          rows: [
            ["Weekend SAT", "About 10-14 days", "Check College Board account"],
            ["School Day SAT", "Often longer", "Depends on school administration"],
            ["Makeup test", "Varies", "Allow extra buffer"],
          ],
        },
      },
      {
        heading: "Retake planning",
        body: ["Do not wait for score release to keep studying if your next test date is close. Continue light review until you know the result."],
      },
    ],
    faqs: [
      { question: "When do SAT scores come out?", answer: "Most Digital SAT scores come out about 10-14 days after the test date." },
      { question: "Where do I see my SAT score?", answer: "SAT scores appear in your College Board account when released." },
    ],
    relatedSlugs: ["sat-test-day-checklist-printable", "sat-retake-study-plan", "sat-test-countdown"],
    productLinks: [{ label: "Open SAT countdown", href: "/sat-test-countdown" }],
  },
  {
    slug: "sat-test-day-checklist-printable",
    kind: "chart",
    category: "Tools",
    title: "SAT Test Day Checklist",
    metaTitle: "SAT Test Day Checklist: What to Bring and What to Do",
    metaDescription: "SAT test day checklist covering ID, admission ticket, device, calculator, snacks, timing, and last-minute prep.",
    intro: "A test-day checklist prevents avoidable mistakes before the SAT starts. Use this the night before and again before leaving home.",
    sections: [
      {
        heading: "Bring these",
        body: ["Policies can change, so confirm College Board rules before test day. This checklist covers the standard planning items."],
        list: ["Acceptable photo ID", "Admission ticket or registration details", "Approved testing device", "Charged battery and charger", "Approved calculator if bringing your own", "Pencils or pens for scratch work if allowed", "Snack and water for break"],
      },
      {
        heading: "Do not bring these into testing",
        body: ["Keep prohibited items away from the testing room to avoid cancellation risk."],
        list: ["Smartwatch", "Phone during testing", "Notes or formula sheets", "Unapproved calculator", "Extra electronic devices"],
      },
    ],
    faqs: [
      { question: "Can I bring a calculator to the Digital SAT?", answer: "Yes, but the built-in Desmos calculator is also available throughout Math." },
      { question: "Should I study the morning of the SAT?", answer: "Only light review. Heavy last-minute studying usually creates more stress than points." },
    ],
    relatedSlugs: ["sat-score-release-calendar", "sat-cram-plan", "digital-sat-timing-chart"],
    productLinks: [{ label: "Read test-day guides", href: "/blog/sat-test-day-checklist" }],
  },
  {
    slug: "sat-section-score-chart",
    kind: "chart",
    category: "Scores",
    title: "SAT Section Score Chart",
    metaTitle: "SAT Section Score Chart: Math and Reading/Writing Targets",
    metaDescription: "SAT section score chart showing balanced and lopsided score splits for Digital SAT total-score goals.",
    intro: "Your total SAT score is the sum of Reading & Writing and Math. This chart shows common section splits for target totals.",
    sections: [
      {
        heading: "Balanced section targets",
        body: ["Balanced splits are not required, but they are useful planning baselines."],
        table: {
          headers: ["Total target", "Reading & Writing", "Math"],
          rows: [
            ["1500", "750", "750"],
            ["1450", "730", "720"],
            ["1400", "700", "700"],
            ["1350", "680", "670"],
            ["1300", "650", "650"],
            ["1200", "600", "600"],
          ],
        },
      },
      {
        heading: "Using an uneven split",
        body: ["If one section is stronger, lean into it. A 1400 can be 760 Math and 640 Reading & Writing, or the reverse."],
      },
    ],
    faqs: [
      { question: "Can one SAT section make up for the other?", answer: "Yes. Colleges usually evaluate the total score, and many superscore across test dates." },
      { question: "What is the maximum SAT section score?", answer: "Each SAT section is scored from 200 to 800." },
    ],
    relatedSlugs: ["sat-score-chart", "sat-raw-score-conversion-chart", "sat-study-plan-for-1400"],
    productLinks: [{ label: "Model section splits", href: "/score-calculator" }],
  },
  {
    slug: "sat-question-types-chart",
    kind: "chart",
    category: "Tools",
    title: "SAT Question Types Chart",
    metaTitle: "SAT Question Types Chart: Digital SAT Math and Reading/Writing",
    metaDescription: "Digital SAT question types chart covering every Math and Reading/Writing pattern students should practice.",
    intro: "The Digital SAT is predictable when you know the question types. This chart maps each major type to the practice method that works best.",
    sections: [
      {
        heading: "Question type map",
        body: ["Use this as a diagnostic checklist after practice tests."],
        table: {
          headers: ["Section", "Question types", "Best practice"],
          rows: [
            ["Reading & Writing", "Words, evidence, inference, transitions, grammar", "Drill by skill"],
            ["Math", "Algebra, functions, data, geometry", "Drill by domain"],
            ["Both", "Easy, medium, hard module variants", "Review by mistake type"],
          ],
        },
      },
      {
        heading: "Review method",
        body: ["After each practice module, tag every miss by question type. Your next drill set should match your largest miss bucket."],
      },
    ],
    faqs: [
      { question: "How many question types are on the SAT?", answer: "There are dozens of patterns, but they group into four Reading & Writing domains and four Math domains." },
      { question: "Should I practice mixed question sets?", answer: "Yes, but only after isolated skill practice. Mixed sets are best for pacing and transfer." },
    ],
    relatedSlugs: ["sat-reading-writing-skill-chart", "sat-math-formula-chart", "digital-sat-format-chart"],
    productLinks: [
      { label: "Practice Math question types", href: "/bank/math/browse" },
      { label: "Practice Reading question types", href: "/bank/reading/browse" },
      { label: "Browse skills", href: "/sat-skill" },
    ],
  },
  {
    slug: "sat-calculator-policy-chart",
    kind: "chart",
    category: "Math",
    title: "SAT Calculator Policy Chart",
    metaTitle: "SAT Calculator Policy Chart for the Digital SAT",
    metaDescription: "SAT calculator policy chart explaining Desmos access, personal calculators, and when to use calculator-first math strategies.",
    intro: "The Digital SAT allows calculator use throughout Math. The built-in Desmos calculator changes how students should solve many problems.",
    sections: [
      {
        heading: "Calculator rules overview",
        body: ["Always check current College Board rules before test day, especially if bringing a personal calculator."],
        table: {
          headers: ["Calculator option", "Allowed?", "Best use"],
          rows: [
            ["Built-in Desmos", "Yes", "Graphing, tables, systems, regressions"],
            ["Approved personal calculator", "Yes", "Familiar backup"],
            ["Phone calculator", "No", "Not allowed"],
            ["CAS calculator", "Check policy", "May be restricted"],
          ],
        },
      },
      {
        heading: "Strategy",
        body: ["Use Desmos when it saves steps. Use mental math when opening the calculator would take longer than solving."],
      },
    ],
    faqs: [
      { question: "Is there a no-calculator section on the Digital SAT?", answer: "No. Calculator use is allowed throughout the Digital SAT Math section." },
      { question: "Do I need to bring a calculator?", answer: "No. Desmos is built in, but you may bring an approved calculator as a backup." },
    ],
    relatedSlugs: ["sat-desmos-reference-sheet", "desmos-sat-shortcuts", "sat-math-formula-chart"],
    productLinks: [
      { label: "Practice calculator math", href: "/bank/math/browse" },
      { label: "Practice systems", href: bankSkillHref("math", "Systems of two linear equations in two variables") },
      { label: "Practice data models", href: bankSkillHref("math", "Two-variable data: Models and scatterplots") },
    ],
  },
  {
    slug: "ivy-league-sat-score-chart",
    kind: "college",
    category: "Admissions",
    title: "Ivy League SAT Score Chart",
    metaTitle: "Ivy League SAT Score Chart: Competitive Scores by School",
    metaDescription: "Ivy League SAT score chart with practical target ranges, 75th-percentile strategy, and how to use scores in admissions planning.",
    intro: "Ivy League admissions are holistic, but SAT scores still matter when submitted. This chart focuses on practical target ranges, not guarantees.",
    sections: [
      {
        heading: "Ivy League score targets",
        body: ["For highly selective schools, aim at or above the 75th percentile when possible."],
        table: {
          headers: ["Target band", "Meaning", "Strategy"],
          rows: [
            ["1550-1600", "Strong submitted score", "Submit if other academics align"],
            ["1500-1540", "Competitive but context-dependent", "Compare to school range"],
            ["1450-1490", "Often below median at Ivies", "Consider retake if time allows"],
            ["Below 1450", "Usually weak for Ivy League submission", "Focus on test-optional strategy"],
          ],
        },
      },
      {
        heading: "How to use this chart",
        body: ["Use the chart as a retake decision tool. The stronger the rest of the file, the more context matters."],
      },
    ],
    faqs: [
      { question: "What SAT score do you need for the Ivy League?", answer: "Most competitive Ivy League applicants who submit scores are around 1500-1560+, with 1550+ safest." },
      { question: "Can you get into an Ivy with a lower SAT?", answer: "Yes, but the score is less likely to help unless there is strong context elsewhere in the application." },
    ],
    relatedSlugs: ["top-private-college-sat-scores", "sat-score-needed-for-college", "sat-study-plan-for-1500"],
    productLinks: [{ label: "Read Ivy League SAT guide", href: "/blog/ivy-league-sat-scores" }],
  },
  {
    slug: "top-public-university-sat-scores",
    kind: "college",
    category: "Admissions",
    title: "Top Public University SAT Scores",
    metaTitle: "Top Public University SAT Scores: Score Targets and Ranges",
    metaDescription: "SAT score targets for top public universities, including flagship strategy, 75th-percentile planning, and retake guidance.",
    intro: "Top public universities often publish broad score ranges and admit many students by major, residency, and school within the university.",
    sections: [
      {
        heading: "Target bands",
        body: ["For selective public flagships, your target depends heavily on residency and major."],
        table: {
          headers: ["Score band", "Application strength", "Notes"],
          rows: [
            ["1500+", "Very strong", "Helpful for honors and competitive majors"],
            ["1400-1490", "Strong", "Competitive at many flagships"],
            ["1300-1390", "Solid", "Often in range, varies by school"],
            ["Below 1300", "School-dependent", "Use state and major context"],
          ],
        },
      },
      {
        heading: "Major matters",
        body: ["Engineering, computer science, and business often have higher score expectations than the university overall."],
      },
    ],
    faqs: [
      { question: "What SAT score is good for public universities?", answer: "A 1300-1450 is competitive at many public universities, while 1450+ is stronger for selective flagships and honors programs." },
      { question: "Do public universities superscore the SAT?", answer: "Many do, but policies vary by school. Always check the admissions page." },
    ],
    relatedSlugs: ["sat-score-for-state-schools", "sat-scores-for-engineering-schools", "sat-scholarship-score-chart"],
    productLinks: [{ label: "Search college score targets", href: "/what-sat-score-do-i-need" }],
  },
  {
    slug: "top-private-college-sat-scores",
    kind: "college",
    category: "Admissions",
    title: "Top Private College SAT Scores",
    metaTitle: "Top Private College SAT Scores: Competitive Target Ranges",
    metaDescription: "SAT score ranges for top private colleges, with target bands for selective admissions and test-optional strategy.",
    intro: "Selective private colleges evaluate scores in context, but high SAT scores can still validate academic readiness.",
    sections: [
      {
        heading: "Private college target bands",
        body: ["Use these ranges as broad planning bands before checking school-specific profiles."],
        table: {
          headers: ["Score", "Use case", "Retake guidance"],
          rows: [
            ["1550+", "Strong at nearly all private colleges", "Retake usually unnecessary"],
            ["1500-1540", "Competitive at most selective colleges", "Retake only for top-end goals"],
            ["1400-1490", "Strong at many private colleges", "Retake for ultra-selective schools"],
            ["Below 1400", "Depends on selectivity", "Compare to middle-50% range"],
          ],
        },
      },
      {
        heading: "Test-optional decision",
        body: ["Submit when your score is at least near the school's median and ideally above the 75th percentile."],
      },
    ],
    faqs: [
      { question: "Should I submit a 1450 to a top private college?", answer: "Usually yes if it is within or above the school's middle-50% range, but not always for the most selective schools." },
      { question: "Is 1500 enough for top private colleges?", answer: "A 1500 is competitive at many top private colleges, though 1550+ is stronger at the most selective schools." },
    ],
    relatedSlugs: ["ivy-league-sat-score-chart", "college-sat-middle-50-explained", "sat-study-plan-for-1500"],
    productLinks: [{ label: "View college directory", href: "/college" }],
  },
  {
    slug: "sat-score-needed-for-college",
    kind: "college",
    category: "Admissions",
    title: "What SAT Score Do You Need for College?",
    metaTitle: "What SAT Score Do You Need for College? Target Score Guide",
    metaDescription: "Guide to choosing the SAT score you need for college admissions based on middle-50% ranges, major, and application strategy.",
    intro: "The SAT score you need depends on the colleges you are targeting. A useful target is usually the 75th percentile of admitted students.",
    sections: [
      {
        heading: "Target score method",
        body: ["Build your target from your college list, not from a national average."],
        list: ["Find each school's middle-50% SAT range.", "Circle the 75th percentile score.", "Use the highest 75th-percentile score as your reach target.", "Use the median score as your minimum submit target."],
      },
      {
        heading: "Score tiers",
        body: ["Different score levels open different admissions options."],
        table: {
          headers: ["Score", "Typical use"],
          rows: [
            ["1500+", "Highly selective colleges"],
            ["1400-1490", "Selective colleges and honors programs"],
            ["1300-1390", "Many strong public and private colleges"],
            ["1200-1290", "Broad four-year college competitiveness"],
          ],
        },
      },
    ],
    faqs: [
      { question: "Should I aim for the 75th percentile SAT score?", answer: "Yes. The 75th percentile is a strong target because it makes the score a likely positive part of the application." },
      { question: "Is the average SAT score enough for college?", answer: "It can be enough for many colleges, but selective schools usually expect scores well above the national average." },
    ],
    relatedSlugs: ["college-sat-middle-50-explained", "sat-score-chart", "what-sat-score-do-i-need"],
    productLinks: [{ label: "Use the college score tool", href: "/what-sat-score-do-i-need" }],
  },
  {
    slug: "test-optional-colleges-sat-strategy",
    kind: "college",
    category: "Admissions",
    title: "Test-Optional SAT Strategy",
    metaTitle: "Test-Optional SAT Strategy: When to Submit Your Score",
    metaDescription: "Test-optional SAT strategy guide explaining when to submit, withhold, retake, or superscore your Digital SAT result.",
    intro: "Test-optional does not mean test-blind. If a score strengthens your academic case, it can still help.",
    sections: [
      {
        heading: "Submit or withhold",
        body: ["Use school-specific score ranges when deciding."],
        table: {
          headers: ["Your score position", "Recommendation", "Reason"],
          rows: [
            ["Above 75th percentile", "Submit", "Likely academic strength"],
            ["Near median", "Usually submit", "Generally neutral to positive"],
            ["Below 25th percentile", "Consider withholding", "May weaken file"],
            ["No published range", "Use peer-school context", "Compare selectivity"],
          ],
        },
      },
      {
        heading: "Retake strategy",
        body: ["Retake if a realistic 50-100 point gain would move you from below range to in range."],
      },
    ],
    faqs: [
      { question: "Does test-optional hurt applicants who do not submit?", answer: "Not automatically, but a strong submitted score can still help." },
      { question: "Should I submit a score below the 25th percentile?", answer: "Usually no, unless there is unusual context or the school recommends submitting all scores." },
    ],
    relatedSlugs: ["sat-score-needed-for-college", "college-sat-middle-50-explained", "sat-retake-study-plan"],
    productLinks: [{ label: "Compare college targets", href: "/what-sat-score-do-i-need" }],
  },
  {
    slug: "sat-scholarship-score-chart",
    kind: "college",
    category: "Admissions",
    title: "SAT Scholarship Score Chart",
    metaTitle: "SAT Scholarship Score Chart: Merit Aid Target Scores",
    metaDescription: "SAT scholarship score chart showing common score bands for merit aid, honors programs, and competitive scholarships.",
    intro: "Merit scholarships often reward scores well above a school's average, especially at colleges trying to attract high-scoring students.",
    sections: [
      {
        heading: "Scholarship score bands",
        body: ["Policies vary by college, but these bands are useful for planning."],
        table: {
          headers: ["SAT score", "Scholarship potential", "Best target schools"],
          rows: [
            ["1500+", "High", "Honors and full-tuition competitions"],
            ["1400-1490", "Strong", "Selective merit programs"],
            ["1300-1390", "Moderate", "Regional and public universities"],
            ["1200-1290", "School-dependent", "Automatic merit at some colleges"],
          ],
        },
      },
      {
        heading: "Strategy",
        body: ["For merit aid, target schools where your SAT is above the 75th percentile, not just in range."],
      },
    ],
    faqs: [
      { question: "What SAT score gets scholarships?", answer: "Many merit scholarships begin around 1300-1400, but competitive awards often require 1450-1500+." },
      { question: "Can SAT scores help with merit aid?", answer: "Yes. Many colleges use SAT scores as one factor for merit scholarships and honors programs." },
    ],
    relatedSlugs: ["top-public-university-sat-scores", "sat-score-needed-for-college", "sat-scholarship-score-chart"],
    productLinks: [{ label: "Read merit scholarship guide", href: "/blog/merit-scholarships-by-sat-score" }],
  },
  {
    slug: "sat-scores-by-college-major",
    kind: "college",
    category: "Admissions",
    title: "SAT Scores by College Major",
    metaTitle: "SAT Scores by College Major: Engineering, Business, CS, and More",
    metaDescription: "Guide to how SAT target scores change by college major, especially engineering, business, computer science, and STEM programs.",
    intro: "At many universities, major matters. Competitive majors can have higher score expectations than the college overall.",
    sections: [
      {
        heading: "Major-based score pressure",
        body: ["Use the university's range as a floor when applying to selective majors."],
        table: {
          headers: ["Major type", "Score pressure", "Why"],
          rows: [
            ["Computer science", "Very high", "High applicant volume"],
            ["Engineering", "High", "Math readiness signal"],
            ["Business", "Moderate to high", "Selective school admissions"],
            ["Humanities", "School-dependent", "Holistic context matters more"],
          ],
        },
      },
      {
        heading: "Math split",
        body: ["For STEM and business, the Math section score often matters more than the total score alone."],
      },
    ],
    faqs: [
      { question: "Do colleges evaluate SAT scores by major?", answer: "Often indirectly. Selective majors can have stronger applicant pools, so the competitive score may be higher." },
      { question: "What SAT score is good for engineering?", answer: "For selective engineering programs, 1450+ and a strong Math score are useful targets." },
    ],
    relatedSlugs: ["sat-scores-for-engineering-schools", "sat-scores-for-computer-science", "sat-section-score-chart"],
    productLinks: [
      { label: "Practice SAT Math", href: "/bank/math/browse" },
      { label: "Model your Math score", href: "/score-calculator" },
    ],
  },
  {
    slug: "sat-scores-for-engineering-schools",
    kind: "college",
    category: "Admissions",
    title: "SAT Scores for Engineering Schools",
    metaTitle: "SAT Scores for Engineering Schools: Math Targets and Ranges",
    metaDescription: "SAT score guide for engineering applicants, with Math section targets, total score bands, and retake strategy.",
    intro: "Engineering admissions put special pressure on Math readiness. A strong total score helps, but the Math section carries extra signal.",
    sections: [
      {
        heading: "Engineering score targets",
        body: ["Use these targets for selective engineering programs."],
        table: {
          headers: ["Goal", "Total SAT", "Math section"],
          rows: [
            ["Top engineering programs", "1500+", "780-800"],
            ["Selective engineering schools", "1400-1490", "720-780"],
            ["Solid engineering targets", "1300-1390", "670-730"],
          ],
        },
      },
      {
        heading: "Study focus",
        body: ["Prioritize functions, advanced algebra, geometry, and data analysis. Then drill hard Module 2 Math under time."],
      },
    ],
    faqs: [
      { question: "What SAT Math score is good for engineering?", answer: "A 750+ Math score is strong for many engineering programs; top programs often see many 780-800 scores." },
      { question: "Is Reading & Writing less important for engineering?", answer: "It still matters because colleges evaluate the total score, but Math carries special readiness signal." },
    ],
    relatedSlugs: ["sat-math-formula-chart", "sat-scores-by-college-major", "sat-study-plan-for-1500"],
    productLinks: [
      { label: "Practice SAT Math", href: "/bank/math/browse" },
      { label: "Practice functions", href: bankSkillHref("math", "Linear functions") },
      { label: "Practice data analysis", href: bankDomainHref("math", "Problem-Solving and Data Analysis") },
    ],
  },
  {
    slug: "sat-scores-for-business-schools",
    kind: "college",
    category: "Admissions",
    title: "SAT Scores for Business Schools",
    metaTitle: "SAT Scores for Business Schools: Competitive Applicant Guide",
    metaDescription: "SAT score guide for undergraduate business programs, including target score bands and section-score strategy.",
    intro: "Undergraduate business programs can be more selective than the university overall. Strong SAT scores help signal quantitative readiness.",
    sections: [
      {
        heading: "Business school score bands",
        body: ["Use the overall university score range, then adjust upward for selective business programs."],
        table: {
          headers: ["Program selectivity", "Target SAT", "Notes"],
          rows: [
            ["Highly selective", "1500+", "Strong Math and total score"],
            ["Selective", "1400-1490", "Often competitive"],
            ["Moderate", "1250-1390", "School-dependent"],
          ],
        },
      },
      {
        heading: "Section strategy",
        body: ["A strong Math score helps, but business schools also value reading precision and writing clarity."],
      },
    ],
    faqs: [
      { question: "What SAT score is good for business school?", answer: "For selective undergraduate business programs, 1400+ is a useful target and 1500+ is stronger." },
      { question: "Does SAT Math matter for business?", answer: "Yes. Math helps show quantitative readiness, especially for finance, analytics, and economics-focused programs." },
    ],
    relatedSlugs: ["sat-scores-by-college-major", "sat-score-needed-for-college", "sat-section-score-chart"],
    productLinks: [{ label: "Compare college targets", href: "/what-sat-score-do-i-need" }],
  },
  {
    slug: "sat-scores-for-computer-science",
    kind: "college",
    category: "Admissions",
    title: "SAT Scores for Computer Science",
    metaTitle: "SAT Scores for Computer Science Applicants",
    metaDescription: "SAT score guide for computer science applicants, including Math targets, total score bands, and selective-major strategy.",
    intro: "Computer science is one of the most competitive undergraduate majors. SAT targets are often higher than the university average.",
    sections: [
      {
        heading: "Computer science target scores",
        body: ["For CS, aim above the school's general 75th percentile when possible."],
        table: {
          headers: ["School type", "Target SAT", "Math target"],
          rows: [
            ["Top CS programs", "1550+", "790-800"],
            ["Selective CS programs", "1450-1540", "750-790"],
            ["Broad CS admissions", "1350-1440", "700-750"],
          ],
        },
      },
      {
        heading: "Retake decision",
        body: ["Retake if your Math score is meaningfully below the typical range for the CS program, even if your total is decent."],
      },
    ],
    faqs: [
      { question: "What SAT score is good for computer science?", answer: "For selective CS programs, 1450+ is a strong target, with 1500+ better for top programs." },
      { question: "Does SAT Math matter more for CS?", answer: "Yes. A high Math score supports quantitative readiness for computer science." },
    ],
    relatedSlugs: ["sat-scores-for-engineering-schools", "sat-math-formula-chart", "sat-study-plan-for-1500"],
    productLinks: [
      { label: "Practice hard SAT Math", href: "/bank/math/browse" },
      { label: "Practice Advanced Math", href: bankDomainHref("math", "Advanced Math") },
    ],
  },
  {
    slug: "college-sat-middle-50-explained",
    kind: "college",
    category: "Admissions",
    title: "College SAT Middle 50% Explained",
    metaTitle: "College SAT Middle 50% Explained: 25th and 75th Percentiles",
    metaDescription: "Plain-English guide to college SAT middle-50% ranges, 25th percentile, 75th percentile, medians, and submit strategy.",
    intro: "The middle 50% is one of the most useful admissions stats, but it is easy to misread. It shows the score range for the middle half of admitted students.",
    sections: [
      {
        heading: "How to read the range",
        body: ["A range like 1350-1500 means 25% of admitted students scored below 1350, 50% scored between 1350 and 1500, and 25% scored above 1500."],
        table: {
          headers: ["Position", "Meaning", "Submit strategy"],
          rows: [
            ["Above 75th percentile", "Strong score for that school", "Submit"],
            ["Near median", "In range", "Usually submit"],
            ["Below 25th percentile", "Below range", "Consider test-optional"],
          ],
        },
      },
      {
        heading: "What the range does not tell you",
        body: ["It does not guarantee admission and does not separate applicants by major, residency, recruited athlete status, or other context."],
      },
    ],
    faqs: [
      { question: "What does SAT middle 50% mean?", answer: "It is the score range between the 25th and 75th percentiles of admitted students." },
      { question: "Should I aim for the 75th percentile?", answer: "Yes. The 75th percentile is the strongest practical target for a school." },
    ],
    relatedSlugs: ["sat-score-needed-for-college", "test-optional-colleges-sat-strategy", "top-private-college-sat-scores"],
    productLinks: [{ label: "View college directory", href: "/college" }],
  },
  {
    slug: "sat-score-for-state-schools",
    kind: "college",
    category: "Admissions",
    title: "SAT Scores for State Schools",
    metaTitle: "SAT Scores for State Schools: Public University Targets",
    metaDescription: "SAT score guide for state schools and public universities, including flagship, regional, honors, and scholarship targets.",
    intro: "State schools vary widely. A score that is average at one flagship can be scholarship-level at another regional public university.",
    sections: [
      {
        heading: "State school score bands",
        body: ["Use these as starting points, then check each campus and major."],
        table: {
          headers: ["Goal", "SAT target", "Notes"],
          rows: [
            ["Flagship honors", "1400+", "Often higher for STEM"],
            ["Selective flagship admission", "1300-1450", "Depends on residency"],
            ["Regional public admission", "1050-1250", "Often in range"],
            ["Merit aid target", "Above school 75th percentile", "Best scholarship signal"],
          ],
        },
      },
      {
        heading: "Residency context",
        body: ["In-state applicants and out-of-state applicants may face different selectivity, especially at popular flagships."],
      },
    ],
    faqs: [
      { question: "What SAT score is good for state schools?", answer: "A 1200-1350 is competitive at many state schools; selective flagships and honors programs often reward 1400+." },
      { question: "Can SAT scores help with state school scholarships?", answer: "Yes. Scores above a school's 75th percentile can help with merit aid and honors consideration." },
    ],
    relatedSlugs: ["top-public-university-sat-scores", "sat-scholarship-score-chart", "sat-score-needed-for-college"],
    productLinks: [{ label: "Find college score targets", href: "/what-sat-score-do-i-need" }],
  },
  {
    slug: "2-week-sat-study-plan",
    kind: "study-plan",
    category: "Study Plans",
    title: "2-Week SAT Study Plan",
    metaTitle: "2-Week SAT Study Plan: Fast Digital SAT Prep Schedule",
    metaDescription: "Two-week SAT study plan for students with limited time, including diagnostics, daily drills, timed modules, and review blocks.",
    intro: "Two weeks is short, so the plan must be narrow. The goal is to fix the highest-value misses, not relearn the entire test.",
    sections: [
      {
        heading: "14-day schedule",
        body: ["Use one diagnostic, targeted daily drills, and two timed tests."],
        list: ["Day 1: diagnostic and error log", "Days 2-5: weakest Math and grammar skills", "Day 6: timed modules", "Day 7: review", "Days 8-11: second weakest skills", "Day 12: full practice", "Day 13: review only", "Day 14: light warmup"],
      },
      {
        heading: "What to skip",
        body: ["Skip low-frequency topics and huge content overhauls. Focus on mistakes you can actually fix before test day."],
      },
    ],
    faqs: [
      { question: "Can I improve my SAT score in two weeks?", answer: "Yes, especially by fixing careless errors, pacing, punctuation, and common algebra patterns." },
      { question: "How many hours per day should I study?", answer: "Plan for 1.5-3 focused hours per day if you only have two weeks." },
    ],
    relatedSlugs: ["sat-cram-plan", "sat-test-day-checklist-printable", "digital-sat-timing-chart"],
    productLinks: [
      { label: "Generate a custom plan", href: "/sat-study-plan-generator" },
      { label: "Start targeted drills", href: "/bank" },
      { label: "Take timed modules", href: "/modules" },
    ],
  },
  {
    slug: "30-day-sat-study-plan-template",
    kind: "study-plan",
    category: "Study Plans",
    title: "30-Day SAT Study Plan Template",
    metaTitle: "30-Day SAT Study Plan Template for the Digital SAT",
    metaDescription: "A 30-day SAT study plan template with weekly goals, daily drills, full-length practice, and review checkpoints.",
    intro: "Thirty days is enough time to make a meaningful SAT score move if every week has a purpose and every practice test gets reviewed.",
    sections: [
      {
        heading: "Weekly structure",
        body: ["Each week combines skill drills, timed practice, and review."],
        table: {
          headers: ["Week", "Focus", "Deliverable"],
          rows: [
            ["1", "Diagnostic and fundamentals", "Error log"],
            ["2", "Weakest Math and grammar", "Targeted drill sets"],
            ["3", "Timed modules", "Pacing notes"],
            ["4", "Full tests and review", "Final retake plan"],
          ],
        },
      },
      {
        heading: "Daily rhythm",
        body: ["Use 60-90 minutes for drills and 30 minutes for review. Review is where score gains happen."],
      },
    ],
    faqs: [
      { question: "Is 30 days enough for SAT prep?", answer: "Yes for focused improvement, especially if you already know your baseline and target score." },
      { question: "How many practice tests should I take in 30 days?", answer: "Two to three full practice tests is enough if you thoroughly review them." },
    ],
    relatedSlugs: ["60-day-sat-study-plan", "sat-study-schedule-template", "sat-practice-test-score-sheet"],
    productLinks: [
      { label: "Build a study plan", href: "/sat-study-plan-generator" },
      { label: "Start targeted drills", href: "/bank" },
      { label: "Take timed modules", href: "/modules" },
    ],
  },
  {
    slug: "60-day-sat-study-plan",
    kind: "study-plan",
    category: "Study Plans",
    title: "60-Day SAT Study Plan",
    metaTitle: "60-Day SAT Study Plan: 8-Week Digital SAT Prep Schedule",
    metaDescription: "60-day SAT study plan with diagnostics, skill blocks, timed modules, practice tests, and final review for the Digital SAT.",
    intro: "Sixty days gives enough time to build skills and test pacing. This plan alternates targeted drills with timed modules.",
    sections: [
      {
        heading: "8-week roadmap",
        body: ["Keep the same weekly pattern so progress is easy to track."],
        list: ["Week 1: diagnostic and setup", "Weeks 2-3: core Math and grammar", "Weeks 4-5: weakest Reading & Writing skills", "Week 6: timed modules", "Week 7: full tests", "Week 8: review and taper"],
      },
      {
        heading: "Score goal",
        body: ["A 100-200 point gain is realistic for many students if they review misses deeply and practice consistently."],
      },
    ],
    faqs: [
      { question: "How many hours should I study over 60 days?", answer: "Many students do well with 5-8 focused hours per week." },
      { question: "Should I study every day?", answer: "Four to six days per week is usually better than one or two long sessions." },
    ],
    relatedSlugs: ["30-day-sat-study-plan-template", "90-day-sat-study-plan", "sat-study-plan-for-1400"],
    productLinks: [
      { label: "Practice timed modules", href: "/modules" },
      { label: "Drill core Math", href: "/bank/math/browse" },
      { label: "Drill Reading and Writing", href: "/bank/reading/browse" },
    ],
  },
  {
    slug: "90-day-sat-study-plan",
    kind: "study-plan",
    category: "Study Plans",
    title: "90-Day SAT Study Plan",
    metaTitle: "90-Day SAT Study Plan: 12-Week Digital SAT Prep Roadmap",
    metaDescription: "90-day SAT study plan for major score gains, with 12 weeks of diagnostics, skill work, modules, full tests, and review.",
    intro: "Ninety days is enough for a serious SAT rebuild. The plan should start broad, then narrow around your most expensive mistakes.",
    sections: [
      {
        heading: "12-week roadmap",
        body: ["Use the first month for fundamentals, the second for targeted practice, and the third for test simulation."],
        table: {
          headers: ["Phase", "Weeks", "Focus"],
          rows: [
            ["Foundation", "1-4", "Skill review and error log"],
            ["Targeted practice", "5-8", "Weak skills and timed modules"],
            ["Test simulation", "9-12", "Full tests and final review"],
          ],
        },
      },
      {
        heading: "Review system",
        body: ["Every miss should be tagged as content gap, careless error, misread, or pacing problem."],
      },
    ],
    faqs: [
      { question: "Is 90 days enough for a 200-point SAT gain?", answer: "It can be, especially for students with inconsistent fundamentals or weak review habits." },
      { question: "How often should I take practice tests?", answer: "Start every 2-3 weeks, then weekly in the final month." },
    ],
    relatedSlugs: ["60-day-sat-study-plan", "summer-sat-study-plan", "sat-study-plan-for-1500"],
    productLinks: [
      { label: "Start with the question bank", href: "/bank" },
      { label: "Take timed modules", href: "/modules" },
    ],
  },
  {
    slug: "summer-sat-study-plan",
    kind: "study-plan",
    category: "Study Plans",
    title: "Summer SAT Study Plan",
    metaTitle: "Summer SAT Study Plan: Weekly Prep Schedule for Students",
    metaDescription: "Summer SAT study plan with weekly prep blocks, diagnostics, practice tests, review days, and a schedule for school-year readiness.",
    intro: "Summer is one of the best times to prep because students can study before school-year workload returns.",
    sections: [
      {
        heading: "Summer structure",
        body: ["Use 8-10 weeks if available. Keep weekends for longer practice and weekdays for shorter drills."],
        list: ["Monday: Math skill drill", "Tuesday: Reading & Writing skill drill", "Wednesday: review log", "Thursday: timed module", "Friday: vocabulary and grammar", "Weekend: practice test or deep review"],
      },
      {
        heading: "Avoid burnout",
        body: ["Two focused hours beats five distracted hours. Keep one full day off per week."],
      },
    ],
    faqs: [
      { question: "Is summer a good time to study for the SAT?", answer: "Yes. Summer gives more uninterrupted study time and makes fall test dates easier to manage." },
      { question: "How long should a summer SAT plan be?", answer: "Eight to ten weeks is ideal for steady improvement without cramming." },
    ],
    relatedSlugs: ["90-day-sat-study-plan", "sat-study-schedule-template", "sat-retake-study-plan"],
    productLinks: [
      { label: "Generate a plan", href: "/sat-study-plan-generator" },
      { label: "Practice SAT Math", href: "/bank/math/browse" },
      { label: "Practice Reading and Writing", href: "/bank/reading/browse" },
    ],
  },
  {
    slug: "sat-study-schedule-template",
    kind: "study-plan",
    category: "Study Plans",
    title: "SAT Study Schedule Template",
    metaTitle: "SAT Study Schedule Template: Weekly Digital SAT Planner",
    metaDescription: "Reusable SAT study schedule template for weekly drills, practice tests, review sessions, and score tracking.",
    intro: "A good SAT schedule repeats the same loop: diagnose, drill, time, review, repeat.",
    sections: [
      {
        heading: "Weekly template",
        body: ["Use this template for any score goal."],
        table: {
          headers: ["Day", "Task", "Time"],
          rows: [
            ["Monday", "Math skill drill", "60-90 min"],
            ["Tuesday", "Reading & Writing drill", "60-90 min"],
            ["Wednesday", "Review misses", "45-60 min"],
            ["Thursday", "Timed module", "45-75 min"],
            ["Friday", "Weak skill retest", "45-60 min"],
            ["Weekend", "Full test or deep review", "2-3 hours"],
          ],
        },
      },
      {
        heading: "Tracking",
        body: ["Track accuracy by skill, not just total score. Skill accuracy tells you what to do next."],
      },
    ],
    faqs: [
      { question: "How many days per week should I study for the SAT?", answer: "Four to six days per week is enough for most students." },
      { question: "Should I schedule review days?", answer: "Yes. Review days are required; they turn practice into score improvement." },
    ],
    relatedSlugs: ["30-day-sat-study-plan-template", "60-day-sat-study-plan", "sat-practice-test-score-sheet"],
    productLinks: [
      { label: "Create a custom schedule", href: "/sat-study-plan-generator" },
      { label: "Start weekly drills", href: "/bank" },
      { label: "Take timed modules", href: "/modules" },
    ],
  },
  {
    slug: "sat-cram-plan",
    kind: "study-plan",
    category: "Study Plans",
    title: "SAT Cram Plan",
    metaTitle: "SAT Cram Plan: Last-Minute Digital SAT Prep",
    metaDescription: "SAT cram plan for the final days before the test, focused on high-yield review, pacing, and avoiding last-minute mistakes.",
    intro: "Cramming cannot replace real prep, but a focused final push can prevent avoidable point loss.",
    sections: [
      {
        heading: "Last-minute priorities",
        body: ["Only work on things that can improve quickly."],
        list: ["Punctuation rules", "Linear equations", "Desmos shortcuts", "Pacing checkpoints", "Review of recent misses", "Test-day logistics"],
      },
      {
        heading: "What not to do",
        body: ["Do not start brand-new advanced topics the night before. That creates stress without reliable score gain."],
      },
    ],
    faqs: [
      { question: "Can cramming improve an SAT score?", answer: "A little, mostly by reducing careless errors and fixing high-frequency rule gaps." },
      { question: "Should I take a full practice test the day before?", answer: "Usually no. Do light review, rest, and make sure logistics are handled." },
    ],
    relatedSlugs: ["2-week-sat-study-plan", "sat-test-day-checklist-printable", "digital-sat-timing-chart"],
    productLinks: [
      { label: "Practice quick drills", href: "/bank" },
      { label: "Practice punctuation", href: bankSkillHref("reading", "Boundaries") },
      { label: "Practice linear equations", href: bankSkillHref("math", "Linear equations in one variable") },
    ],
  },
  {
    slug: "sat-retake-study-plan",
    kind: "study-plan",
    category: "Study Plans",
    title: "SAT Retake Study Plan",
    metaTitle: "SAT Retake Study Plan: How to Improve on Your Next Test",
    metaDescription: "SAT retake study plan for students who already have a score and need a targeted improvement plan before the next test date.",
    intro: "Retake prep should not repeat the same generic plan. Start from your score report and build around your actual misses.",
    sections: [
      {
        heading: "Retake workflow",
        body: ["Use your old test as the diagnostic."],
        list: ["Sort misses by skill and mistake type.", "Pick the three most expensive weaknesses.", "Drill those skills for two weeks.", "Run timed modules.", "Retake only after practice scores stabilize."],
      },
      {
        heading: "Superscore strategy",
        body: ["If colleges superscore, focus on the section with the most realistic upside."],
      },
    ],
    faqs: [
      { question: "How much can I improve on an SAT retake?", answer: "Many students improve 50-150 points with targeted review, especially if the first test had pacing or careless-error issues." },
      { question: "Should I retake a 1500 SAT?", answer: "Only if your target colleges make a higher score meaningfully useful or one section is much weaker than the other." },
    ],
    relatedSlugs: ["test-optional-colleges-sat-strategy", "sat-score-release-calendar", "sat-study-plan-for-1500"],
    productLinks: [
      { label: "Analyze score targets", href: "/sat-score" },
      { label: "Drill weak skills", href: "/bank" },
      { label: "Take timed modules", href: "/modules" },
    ],
  },
  {
    slug: "sat-study-plan-for-1400",
    kind: "study-plan",
    category: "Study Plans",
    title: "SAT Study Plan for 1400",
    metaTitle: "SAT Study Plan for 1400: Digital SAT Score Roadmap",
    metaDescription: "SAT study plan for reaching 1400, including section targets, weekly drills, score checkpoints, and common mistakes to fix.",
    intro: "A 1400 usually requires strong medium-question accuracy and enough hard-question success to reach the higher module path.",
    sections: [
      {
        heading: "1400 score profile",
        body: ["A balanced 1400 is about 700 Math and 700 Reading & Writing, but uneven splits are fine."],
        list: ["Goal: consistent hard Module 2 access", "Priority: no easy misses", "Secondary focus: hard Math and rhetorical questions"],
      },
      {
        heading: "Study plan",
        body: ["Spend the first half fixing medium misses and the second half increasing hard-question accuracy."],
      },
    ],
    faqs: [
      { question: "How hard is it to get a 1400 SAT?", answer: "It is challenging but realistic for many students with strong fundamentals and disciplined review." },
      { question: "How many questions can I miss for 1400?", answer: "The exact number varies, but roughly 7-12 total misses is a useful planning range." },
    ],
    relatedSlugs: ["how-to-get-1400-sat", "sat-section-score-chart", "60-day-sat-study-plan"],
    productLinks: [
      { label: "Practice medium misses", href: "/bank" },
      { label: "Take timed modules", href: "/modules" },
      { label: "Read the 1400 guide", href: "/how-to-get-1400-sat" },
    ],
  },
  {
    slug: "sat-study-plan-for-1500",
    kind: "study-plan",
    category: "Study Plans",
    title: "SAT Study Plan for 1500",
    metaTitle: "SAT Study Plan for 1500: High-Score Digital SAT Roadmap",
    metaDescription: "SAT study plan for reaching 1500, with hard Module 2 practice, careless-error reduction, and section-score targets.",
    intro: "A 1500 requires strong content and very few careless errors. The plan shifts from learning rules to proving consistency.",
    sections: [
      {
        heading: "1500 score profile",
        body: ["A balanced 1500 is about 750 Math and 750 Reading & Writing."],
        list: ["Goal: hard Module 2 in both sections", "Priority: zero easy or medium misses", "Secondary focus: hardest vocabulary, functions, and evidence questions"],
      },
      {
        heading: "Study plan",
        body: ["Use full timed modules often. At this score level, timing and error control matter as much as content."],
      },
    ],
    faqs: [
      { question: "How hard is it to get a 1500 SAT?", answer: "A 1500 is an elite score and usually requires near-perfect easy and medium accuracy plus solid hard-question performance." },
      { question: "Can I reach 1500 from 1400?", answer: "Yes, but the last 100 points usually come from eliminating careless errors and mastering the hardest question types." },
    ],
    relatedSlugs: ["how-to-get-1500-sat", "sat-study-plan-for-1400", "ivy-league-sat-score-chart"],
    productLinks: [
      { label: "Practice hard Math", href: bankDomainHref("math", "Advanced Math") },
      { label: "Practice hard Reading", href: "/bank/reading/browse" },
      { label: "Read the 1500 guide", href: "/how-to-get-1500-sat" },
    ],
  },
  {
    slug: "sat-to-act-conversion-chart",
    kind: "tool-companion",
    category: "Tools",
    title: "SAT to ACT Conversion Chart",
    metaTitle: "SAT to ACT Conversion Chart: Compare SAT and ACT Scores",
    metaDescription: "SAT to ACT conversion chart using concordance-style score bands, with guidance for choosing which test score to submit.",
    intro: "SAT and ACT scores use different scales. A conversion chart helps compare scores when deciding which test better represents your application.",
    sections: [
      {
        heading: "Common conversions",
        body: ["Use the official concordance tool for exact decisions. This table is a fast planning reference."],
        table: {
          headers: ["SAT", "ACT equivalent range", "Meaning"],
          rows: [
            ["1600", "36", "Maximum score"],
            ["1500", "34-35", "Elite"],
            ["1400", "31-32", "Strong"],
            ["1300", "28-29", "Competitive"],
            ["1200", "25-26", "Above average"],
          ],
        },
      },
      {
        heading: "Which score to submit",
        body: ["Submit the test that is stronger relative to the college's admitted-student range."],
      },
    ],
    faqs: [
      { question: "Can I convert SAT to ACT?", answer: "Yes. Concordance tables estimate equivalent score ranges between the SAT and ACT." },
      { question: "Is a 1500 SAT better than a 34 ACT?", answer: "They are broadly comparable, but exact preference depends on the college and score profile." },
    ],
    relatedSlugs: ["psat-to-sat-conversion-chart", "sat-score-chart", "sat-percentile-chart"],
    productLinks: [{ label: "Use SAT to ACT converter", href: "/sat-to-act-converter" }],
  },
  {
    slug: "psat-to-sat-conversion-chart",
    kind: "tool-companion",
    category: "Tools",
    title: "PSAT to SAT Conversion Chart",
    metaTitle: "PSAT to SAT Conversion Chart: Predict Your SAT Score",
    metaDescription: "PSAT to SAT conversion chart explaining vertical scaling, projected SAT ranges, and how much growth to expect before test day.",
    intro: "The PSAT and SAT share a related scale, so PSAT scores are useful for predicting current SAT readiness.",
    sections: [
      {
        heading: "PSAT to SAT planning",
        body: ["A PSAT score is a baseline, not a ceiling."],
        table: {
          headers: ["PSAT range", "Current SAT readiness", "Growth target"],
          rows: [
            ["1450-1520", "Very high", "1500-1600"],
            ["1300-1440", "Strong", "1400-1550"],
            ["1150-1290", "Solid", "1250-1450"],
            ["1000-1140", "Building", "1150-1350"],
          ],
        },
      },
      {
        heading: "Growth expectations",
        body: ["Many students add 30-100 points between PSAT and SAT with consistent prep."],
      },
    ],
    faqs: [
      { question: "Does PSAT predict SAT score?", answer: "Yes. It is a useful current-readiness estimate, especially because the tests share similar skills." },
      { question: "Can my SAT be higher than my PSAT?", answer: "Yes. Many students improve after targeted prep and more exposure to the test format." },
    ],
    relatedSlugs: ["sat-to-act-conversion-chart", "sat-study-schedule-template", "30-day-sat-study-plan-template"],
    productLinks: [{ label: "Use PSAT to SAT predictor", href: "/psat-to-sat-predictor" }],
  },
  {
    slug: "desmos-sat-shortcuts",
    kind: "tool-companion",
    category: "Math",
    title: "Desmos SAT Shortcuts",
    metaTitle: "Desmos SAT Shortcuts: Digital SAT Calculator Strategies",
    metaDescription: "Desmos SAT shortcuts for graphing, systems, tables, sliders, regressions, and checking answer choices quickly.",
    intro: "Desmos can turn many hard-looking SAT Math questions into graphing or table problems. The key is knowing when to switch tools.",
    sections: [
      {
        heading: "Shortcut list",
        body: ["Practice these before test day so they are automatic."],
        list: ["Graph both sides to solve equations.", "Use intersections for systems.", "Use a table for function values.", "Use sliders for unknown constants.", "Use regression for scatterplots.", "Use answer choices as test values."],
      },
      {
        heading: "Best question types",
        body: ["Desmos is strongest for functions, systems, nonlinear equations, and data modeling."],
      },
    ],
    faqs: [
      { question: "What is the best Desmos shortcut for SAT Math?", answer: "Graphing both sides of an equation and finding intersections is the most broadly useful shortcut." },
      { question: "Should I use Desmos on every Math question?", answer: "No. Use it when it saves time or reduces error risk." },
    ],
    relatedSlugs: ["sat-desmos-reference-sheet", "sat-calculator-policy-chart", "sat-nonlinear-functions-worksheet"],
    productLinks: [
      { label: "Practice systems", href: bankSkillHref("math", "Systems of two linear equations in two variables") },
      { label: "Practice nonlinear functions", href: bankSkillHref("math", "Nonlinear functions") },
      { label: "Read Desmos guide", href: "/desmos-sat-guide" },
    ],
  },
  {
    slug: "sat-percentile-lookup-table",
    kind: "tool-companion",
    category: "Scores",
    title: "SAT Percentile Lookup Table",
    metaTitle: "SAT Percentile Lookup Table: Find Your Digital SAT Rank",
    metaDescription: "SAT percentile lookup table for common score bands, with calculator links and interpretation for admissions planning.",
    intro: "This lookup table helps students quickly connect SAT scores to percentile rank and score tier.",
    sections: [
      {
        heading: "Lookup table",
        body: ["Percentiles are approximate and rounded for planning."],
        table: {
          headers: ["Score", "Percentile", "Interpretation"],
          rows: [
            ["1550+", "99th", "Elite"],
            ["1500", "98th", "Elite"],
            ["1450", "96th", "Highly competitive"],
            ["1400", "94th", "Strong"],
            ["1350", "91st", "Competitive"],
            ["1300", "86th", "Competitive"],
            ["1250", "80th", "Above average"],
            ["1200", "74th", "Above average"],
          ],
        },
      },
      {
        heading: "Use with college ranges",
        body: ["Percentile is useful nationally, but admissions decisions depend more on the school's score range."],
      },
    ],
    faqs: [
      { question: "What percentile is a 1300 SAT?", answer: "A 1300 SAT is roughly the 86th percentile nationally." },
      { question: "What percentile is a 1200 SAT?", answer: "A 1200 SAT is roughly the 74th percentile nationally." },
    ],
    relatedSlugs: ["sat-percentile-chart", "sat-score-chart", "sat-score-needed-for-college"],
    productLinks: [{ label: "Use percentile calculator", href: "/sat-percentile-calculator" }],
  },
  {
    slug: "sat-practice-test-score-sheet",
    kind: "tool-companion",
    category: "Tools",
    title: "SAT Practice Test Score Sheet",
    metaTitle: "SAT Practice Test Score Sheet: Track Modules, Misses, and Review",
    metaDescription: "SAT practice test score sheet for tracking module results, missed-question types, pacing errors, and score improvement.",
    intro: "A practice test without a score sheet is just a score. A score sheet turns the test into a study plan.",
    sections: [
      {
        heading: "Track these fields",
        body: ["Record more than the total score. The mistake pattern matters most."],
        table: {
          headers: ["Field", "Why it matters", "Example"],
          rows: [
            ["Section score", "Tracks progress", "Math 690"],
            ["Missed skill", "Chooses drills", "Linear functions"],
            ["Mistake type", "Fixes process", "Careless sign error"],
            ["Time left", "Reveals pacing", "2 minutes"],
          ],
        },
      },
      {
        heading: "Review loop",
        body: ["After the test, redo every missed question before reading the explanation. Then write the one-sentence fix."],
      },
    ],
    faqs: [
      { question: "How should I review an SAT practice test?", answer: "Tag every miss by skill and mistake type, then redo missed questions without the explanation first." },
      { question: "Should I track guessed questions?", answer: "Yes. Guessed-right questions still reveal unstable knowledge." },
    ],
    relatedSlugs: ["sat-raw-score-conversion-chart", "digital-sat-timing-chart", "sat-study-schedule-template"],
    productLinks: [
      { label: "Take a practice module", href: "/modules" },
      { label: "Open the question bank", href: "/bank" },
    ],
  },
];

export const linkableAssets: LinkableAsset[] = [...skillWorksheetAssets, ...staticAssets];

export const linkableAssetBySlug = new Map(linkableAssets.map((asset) => [asset.slug, asset]));

export const linkableHubs: LinkableHub[] = [
  {
    slug: "sat-resources",
    title: "SAT Resources",
    metaTitle: "Free SAT Resources: Charts, Worksheets, Study Plans, and Tools",
    metaDescription: "Free SAT resources from 1600.now: worksheets, score charts, study plans, admissions guides, and calculator companions.",
    intro: "This resource library collects the most linkable SAT charts, worksheets, templates, and planning guides on 1600.now.",
    assetSlugs: linkableAssets.map((asset) => asset.slug),
  },
  {
    slug: "sat-score-resources",
    title: "SAT Score Resources",
    metaTitle: "SAT Score Resources: Charts, Percentiles, Conversion, and Targets",
    metaDescription: "SAT score resources including score charts, percentile tables, conversion guides, section targets, and college score planning.",
    intro: "Use these resources to understand SAT scores, compare percentiles, model section splits, and choose college target scores.",
    assetSlugs: linkableAssets.filter((asset) => asset.category === "Scores" || asset.category === "Admissions").map((asset) => asset.slug),
  },
  {
    slug: "sat-math-resources",
    title: "SAT Math Resources",
    metaTitle: "SAT Math Resources: Formula Charts, Desmos Guides, and Worksheets",
    metaDescription: "SAT Math resources with worksheets for every math skill, formula charts, Desmos shortcuts, and calculator strategy guides.",
    intro: "Use these SAT Math resources for focused skill drills, formula review, and Desmos-first strategy practice.",
    assetSlugs: linkableAssets.filter((asset) => asset.category === "Math").map((asset) => asset.slug),
  },
  {
    slug: "sat-reading-writing-resources",
    title: "SAT Reading and Writing Resources",
    metaTitle: "SAT Reading and Writing Resources: Grammar, Vocabulary, and Skill Worksheets",
    metaDescription: "Digital SAT Reading and Writing resources with skill worksheets, grammar charts, vocabulary lists, and punctuation guides.",
    intro: "Use these Reading and Writing resources to drill every Digital SAT verbal skill by pattern.",
    assetSlugs: linkableAssets.filter((asset) => asset.category === "Reading & Writing").map((asset) => asset.slug),
  },
];

export const linkableHubBySlug = new Map(linkableHubs.map((hub) => [hub.slug, hub]));

export const linkableAssetSlugs = linkableAssets.map((asset) => asset.slug);
export const linkableHubSlugs = linkableHubs.map((hub) => hub.slug);
