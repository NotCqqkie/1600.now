
export interface PillarSection {
  heading: string;
  body: string[];
  list?: string[];
}

export interface PillarFaq {
  question: string;
  answer: string;
}

export interface PillarPageData {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  heroIntro: string;
  sections: PillarSection[];
  faqs: PillarFaq[];
  relatedSkillSlugs?: string[];
  relatedPillarSlugs?: string[];
  relatedBlogSlugs?: string[];
  relatedScoreTargets?: number[];
}

export const pillarPages: PillarPageData[] = [
  {
    slug: "digital-sat-guide",
    title: "The Digital SAT: Complete 2026 Guide",
    metaTitle:
      "Digital SAT Guide: Format, Scoring, Timing, and How to Prep (2026)",
    metaDescription:
      "Everything about the Digital SAT in one place — format, adaptive modules, scoring, timing, question types, calculator rules, and a 12-week prep plan.",
    heroIntro:
      "The Digital SAT replaced the paper SAT in 2024 and is now the only version of the test College Board administers. This guide explains how the test works in 2026, how it is scored, what has actually changed from the paper SAT, and how to prepare efficiently.",
    sections: [
      {
        heading: "What is the Digital SAT?",
        body: [
          "The Digital SAT is a computer-delivered admissions test run through College Board's Bluebook app. Every US and international SAT administration since spring 2024 has been digital — there is no paper version to fall back on.",
          "The test has two sections, Reading and Writing and Math, and runs 2 hours 14 minutes of testing time plus a single 10-minute break. Both sections are section-level adaptive, which is the single most important structural change from the paper test.",
        ],
      },
      {
        heading: "Digital SAT format and timing",
        body: [
          "Each section is split into two modules. You cannot return to a module after you submit it, but you can move freely between questions inside a module, flag items for review, and change answers before time runs out.",
        ],
        list: [
          "Reading and Writing Module 1 — 27 questions, 32 minutes",
          "Reading and Writing Module 2 — 27 questions, 32 minutes (adaptive)",
          "Break — 10 minutes",
          "Math Module 1 — 22 questions, 35 minutes",
          "Math Module 2 — 22 questions, 35 minutes (adaptive)",
        ],
      },
      {
        heading: "How section-level adaptivity works",
        body: [
          "Your performance on Module 1 in each section determines whether you get the easier or harder Module 2. Students routed to the harder Module 2 have access to the full 200–800 scaled-score range for that section. Students routed to the easier Module 2 are capped well below 800, regardless of how many they get right.",
          "In practice this means the first module matters disproportionately. Missing early questions does not lock you into the easy path — what matters is your overall Module 1 score — but it makes the harder route harder to reach.",
        ],
      },
      {
        heading: "Digital SAT scoring",
        body: [
          "Each section is scored on a 200–800 scale. Reading and Writing and Math are added together for a 400–1600 total. Every form is equated so that a 1450 reflects roughly the same ability level across different test dates.",
          "Scores are typically released 10–14 days after your test date inside your College Board account. Super-scoring across dates is allowed by most colleges, but the SAT itself returns a single total and two section scores per administration.",
        ],
      },
      {
        heading: "What question types appear",
        body: [
          "Reading and Writing uses short passages of 25–150 words with exactly one question each. Math is a mix of multiple-choice and student-produced response (grid-in) questions and allows a built-in Desmos calculator on every question.",
        ],
        list: [
          "Reading and Writing: Words in Context, Central Ideas and Details, Command of Evidence, Inferences, Transitions, Rhetorical Synthesis, Boundaries, Form-Structure-and-Sense, Cross-Text Connections, Text Structure and Purpose",
          "Math: Algebra, Advanced Math, Problem-Solving and Data Analysis, Geometry and Trigonometry",
        ],
      },
      {
        heading: "Calculator and reference sheet",
        body: [
          "Every math question permits a built-in Desmos graphing calculator — you never have to bring your own, though you may. The Desmos panel supports graphing, tables, regression, and built-in statistics functions, which makes certain problem types much faster to solve visually than algebraically.",
          "A reference sheet with common geometry and trigonometry formulas is available on every math question. Do not spend prep time memorizing formulas that appear on the sheet.",
        ],
      },
      {
        heading: "How to prepare in 12 weeks",
        body: [
          "Start with a full-length diagnostic in Bluebook to establish your baseline. Spend the first four weeks on content review concentrated on the skills you missed most. The middle four weeks should alternate full-module timed practice with focused skill drills. The last four weeks should be full-length practice tests at least weekly, with thorough review of every missed question.",
          "The single highest-ROI activity is reviewing wrong answers with written explanations. You cannot outpace weak review by taking more practice tests.",
        ],
      },
      {
        heading: "Common mistakes students make",
        body: [
          "Students over-rely on old paper SAT practice material. Paper material is fine for content but does not drill the short-passage format, adaptive pacing, or Desmos-first math. Students also underuse the built-in Desmos calculator, treating it as a backup instead of a default tool.",
          "Finally, students consistently under-prepare for Reading and Writing, assuming it is easier than the paper-test verbal sections. It is shorter but it is not easier — the questions are denser, and vocabulary still matters.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is the Digital SAT easier than the paper SAT?",
        answer:
          "Not meaningfully. It is shorter and lets you use a calculator throughout, but the questions are denser, the modules are strictly timed, and the adaptive format rewards consistency. Most score distributions look similar to the paper era.",
      },
      {
        question: "Do colleges accept the Digital SAT?",
        answer:
          "Yes. The Digital SAT is the only SAT that College Board administers in 2026, so every US college that accepts the SAT accepts the Digital SAT.",
      },
      {
        question: "How long is the Digital SAT?",
        answer:
          "Total testing time is 2 hours 14 minutes, plus one 10-minute break. With check-in, most students are at the test center around 3 hours.",
      },
      {
        question: "Can you retake the Digital SAT?",
        answer:
          "Yes — you can take the SAT as many times as you like. Most students who retake improve on their second sitting, and most colleges super-score across dates.",
      },
    ],
    relatedSkillSlugs: [
      "linear-equations-one-variable",
      "words-in-context",
      "nonlinear-functions",
      "central-ideas-and-details",
    ],
    relatedPillarSlugs: [
      "digital-sat-math",
      "digital-sat-reading-writing",
      "bluebook-app-guide",
      "how-to-study-for-sat",
    ],
    relatedBlogSlugs: ["how-the-digital-sat-works", "digital-sat-vs-paper-sat"],
    relatedScoreTargets: [1400, 1500, 1600],
  },
  {
    slug: "digital-sat-math",
    title: "Digital SAT Math: Complete Section Guide",
    metaTitle: "Digital SAT Math: Every Domain, Skill, and Strategy (2026)",
    metaDescription:
      "The Digital SAT Math section explained: domains, question types, calculator use, pacing, and a skill-by-skill prep plan for every score range.",
    heroIntro:
      "Digital SAT Math has 44 questions across two adaptive modules, tests four content domains, and allows a built-in Desmos calculator on every question. This guide walks through the full content scope, the strategies that move scores the most, and the most common mistakes students make under pressure.",
    sections: [
      {
        heading: "Structure of the math section",
        body: [
          "The math section has two 35-minute modules with 22 questions each. The first module is fixed in difficulty; the second is harder or easier depending on your Module 1 performance. To reach the full 200–800 score range, you need to be routed to the hard Module 2.",
          "Questions are split roughly 75% multiple-choice and 25% student-produced response (grid-in). Student-produced responses accept integers, decimals, fractions, and negatives — just not plus/minus expressions or mixed numbers.",
        ],
      },
      {
        heading: "The four math domains",
        body: [
          "Every Digital SAT math question maps to one of four domains and one named skill inside that domain. Skills do not appear equally often — Algebra and Advanced Math together are about 65% of the section.",
        ],
        list: [
          "Algebra — linear equations, linear functions, systems of linear equations, and linear inequalities",
          "Advanced Math — nonlinear equations and systems, nonlinear functions, and equivalent expressions",
          "Problem-Solving and Data Analysis — ratios, percentages, probability, statistics, and two-variable data",
          "Geometry and Trigonometry — area and volume, triangles, trig, and circles",
        ],
      },
      {
        heading: "Desmos-first strategy",
        body: [
          "The Digital SAT gives you a full Desmos graphing calculator embedded on every math question. The single biggest strategy upgrade from paper-era prep is to default to Desmos whenever a problem involves equations, functions, or data.",
          "For quadratics, graph the function and read the x-intercepts visually instead of using the quadratic formula. For systems of equations, graph both and find the intersection. For statistics problems, use Desmos' built-in mean, median, quartile, and stdev functions directly on a list.",
        ],
      },
      {
        heading: "Pacing inside a module",
        body: [
          "You have 35 minutes for 22 questions, or about 95 seconds per question. Easy questions should take under 60 seconds; hard questions can justifiably take two to three minutes.",
          "Flag hard questions on the first pass and return to them after you have banked the easier points. The flag is a built-in Bluebook feature — use it liberally. Do not spend two minutes on question 7 if you have not read question 15 yet.",
        ],
      },
      {
        heading: "Reference sheet and what it gives you",
        body: [
          "A reference sheet with basic geometry and trigonometry formulas is available on every math question. It includes area formulas for rectangles, triangles, and circles; volume formulas for common solids; the Pythagorean theorem; and the 30-60-90 and 45-45-90 triangle ratios.",
          "What it does not give you: the quadratic formula, the exponential growth formula, vertex form, slope-intercept form, the distance formula, or any trig values beyond special right triangles. Learn those cold.",
        ],
      },
      {
        heading: "How to prep by score band",
        body: [
          "For 500–650 math, spend most time on the Algebra and Problem-Solving and Data Analysis domains — these make up the easier Module 2 and the first two-thirds of the hard Module 2. Master linear equations, linear functions, ratios, and percentages before touching quadratics.",
          "For 650–750, shift weight toward Advanced Math. Nonlinear functions, equivalent expressions, and nonlinear systems carry most of the hard Module 2.",
          "For 750–800, every missed point matters. Drill hard questions from each domain, rebuild pacing so you finish with 3+ minutes to review, and practice translating word problems into Desmos inputs quickly.",
        ],
      },
      {
        heading: "Common pitfalls",
        body: [
          "The most common pacing mistake is spending too long on grid-in questions that looked hard. Grid-ins are not scored differently from multiple-choice — skip and return like any other hard question.",
          "The most common content mistake is misreading word problems. Digital SAT word problems are densely worded on purpose. Translate into an equation before you compute.",
          "The most common Desmos mistake is not using it. Students who trained on paper SAT material often reach for algebra first out of habit.",
        ],
      },
    ],
    faqs: [
      {
        question: "What math is on the Digital SAT?",
        answer:
          "Algebra, Advanced Math (including quadratics and exponentials), Problem-Solving and Data Analysis, and Geometry and Trigonometry. No calculus.",
      },
      {
        question: "Is there a no-calculator math section?",
        answer:
          "No. Every math question on the Digital SAT allows the built-in Desmos calculator.",
      },
      {
        question: "How many math questions are on the Digital SAT?",
        answer:
          "44 scored questions, split across two 35-minute modules of 22 questions each.",
      },
      {
        question: "What is a good Digital SAT Math score?",
        answer:
          "700+ is competitive for most selective schools. 750+ is in range for top-20 universities. 800 is the top of the scale.",
      },
    ],
    relatedSkillSlugs: [
      "linear-equations-one-variable",
      "linear-functions",
      "nonlinear-functions",
      "equivalent-expressions",
      "ratios-rates-proportions",
      "right-triangles-and-trig",
    ],
    relatedPillarSlugs: [
      "digital-sat-guide",
      "desmos-sat-guide",
      "digital-sat-reading-writing",
    ],
    relatedBlogSlugs: ["how-the-digital-sat-works"],
    relatedScoreTargets: [700, 750, 800],
  },
  {
    slug: "digital-sat-reading-writing",
    title: "Digital SAT Reading and Writing: Complete Section Guide",
    metaTitle:
      "Digital SAT Reading and Writing: Every Domain and Skill (2026)",
    metaDescription:
      "The Reading and Writing section explained: short passages, ten skill types, pacing, vocabulary, and a skill-by-skill strategy for every score band.",
    heroIntro:
      "The Digital SAT Reading and Writing section replaced the paper SAT's separate Reading and Writing sections with a single 54-question section made of short passages and one question each. This guide walks through the ten tested skills and the strategy shifts that matter most.",
    sections: [
      {
        heading: "Structure of the section",
        body: [
          "Two 32-minute modules of 27 questions each, for 54 questions total. Each question has one short passage (25–150 words) followed by a single multiple-choice item. Passages are never shared across questions.",
          "Questions are loosely grouped by skill type within a module: Craft and Structure, then Information and Ideas, then Standard English Conventions, then Expression of Ideas. This ordering is consistent enough that you can anticipate the question type before you read.",
        ],
      },
      {
        heading: "The four domains and ten skills",
        body: [
          "Every Reading and Writing question maps to one of ten skill types grouped into four domains.",
        ],
        list: [
          "Craft and Structure — Words in Context, Text Structure and Purpose, Cross-Text Connections",
          "Information and Ideas — Central Ideas and Details, Command of Evidence, Inferences",
          "Standard English Conventions — Boundaries, Form-Structure-and-Sense",
          "Expression of Ideas — Transitions, Rhetorical Synthesis",
        ],
      },
      {
        heading: "Strategy by skill type",
        body: [
          "Words in Context rewards vocabulary breadth plus sensitivity to connotation. Predict a word before looking at choices, then eliminate choices that are close but carry the wrong tone.",
          "Transitions and Boundaries are grammar skills disguised as reading questions — the passage content barely matters. Focus on the logical relationship or the punctuation rule and ignore everything else.",
          "Rhetorical Synthesis questions give you a bulleted list of notes and a goal. The goal is the most important part of the question; reread it before evaluating answer choices.",
          "Command of Evidence is the hardest to rush. Restate the claim in your own words before reading the choices — otherwise the tempting but off-topic answers will look right.",
        ],
      },
      {
        heading: "Pacing",
        body: [
          "You have 32 minutes for 27 questions, or about 70 seconds per question. Words in Context and Transitions questions should be well under a minute; Command of Evidence and Rhetorical Synthesis can run longer.",
          "The most expensive Reading and Writing mistake is re-reading the passage multiple times. Read once with intent, decide, move on. Flag hard items and return after Easy ones are locked in.",
        ],
      },
      {
        heading: "Vocabulary still matters",
        body: [
          "Even though the Digital SAT shortened passages, vocabulary remains essential. Words in Context accounts for 6–8 questions per test, and tricky vocabulary appears inside Inferences and Central Ideas questions.",
          "Study vocabulary in context, not from flashcards alone. The SAT tests how words are used, not just what they mean in isolation.",
        ],
      },
      {
        heading: "Reading-Writing prep plan",
        body: [
          "Early prep: drill Boundaries, Form-Structure-and-Sense, and Transitions — these are rule-driven and respond quickly to practice. Build a vocabulary list from missed Words in Context items.",
          "Middle prep: focus on Central Ideas, Inferences, and Command of Evidence under timed conditions. These skills benefit most from volume.",
          "Late prep: work exclusively from full-length modules to train pacing and endurance. Review every miss with a short written note on why the right answer was right.",
        ],
      },
    ],
    faqs: [
      {
        question: "How long is the Reading and Writing section?",
        answer:
          "64 minutes total — two 32-minute modules with a hard break between sections, not between the two Reading and Writing modules.",
      },
      {
        question: "Are Reading and Writing questions based on long passages?",
        answer:
          "No. Every question has its own short passage of 25–150 words. There are no shared passages or long-form reading.",
      },
      {
        question: "Is vocabulary still on the SAT?",
        answer:
          "Yes. Words in Context is one of the most common question types. Vocabulary also shows up inside Inferences and Central Ideas items.",
      },
      {
        question: "What is a good Reading and Writing score?",
        answer:
          "700+ is competitive for most selective schools. 750+ is typical for top-20 universities. 800 is the top of the scale.",
      },
    ],
    relatedSkillSlugs: [
      "words-in-context",
      "central-ideas-and-details",
      "command-of-evidence",
      "inference",
      "transitions",
      "rhetorical-synthesis",
      "boundaries-punctuation",
      "form-structure-sense",
    ],
    relatedPillarSlugs: ["digital-sat-guide", "digital-sat-math"],
    relatedScoreTargets: [700, 750, 800],
  },
  {
    slug: "bluebook-app-guide",
    title: "Bluebook App: Complete Guide to the Digital SAT Testing Software",
    metaTitle: "Bluebook App Guide: Install, Navigate, and Test on Digital SAT",
    metaDescription:
      "How to install Bluebook, take practice tests, use the flag and cross-out tools, run the built-in Desmos calculator, and troubleshoot on test day.",
    heroIntro:
      "Bluebook is the desktop and iPad app the College Board uses to administer every Digital SAT. This guide walks through installation, navigation, every in-app tool, and what to do if something goes wrong on test day.",
    sections: [
      {
        heading: "What is Bluebook?",
        body: [
          "Bluebook is College Board's digital testing platform. It is free, required for the test, and the only app you can use to take the SAT, PSAT/NMSQT, PSAT 10, PSAT 8/9, and AP Digital exams.",
          "Bluebook runs on Mac, Windows, managed Chromebooks, and iPads. It does not run on phones, personal Chromebooks, or Linux. The app has a small footprint but locks down other apps while the exam is in progress, so install it on a device you can keep focused on the test.",
        ],
      },
      {
        heading: "Installing Bluebook",
        body: [
          "Download the app from bluebook.collegeboard.org. Sign in with your College Board account — the same login you use to register for the SAT. You only need to install it once per device, but you should open the app at least a few days before test day to confirm it still signs in cleanly.",
          "If your school provides a managed Chromebook, you may need to wait for your school to push the Bluebook app. Confirm availability with your test coordinator two weeks out.",
        ],
      },
      {
        heading: "In-app tools you actually use",
        body: [
          "Bluebook gives you four essential in-test tools. Learn each one in a practice test before using it on a real test.",
        ],
        list: [
          "Flag — mark a question you want to revisit; flagged questions appear in the review screen at the end of a module",
          "Cross-out — strike through answer choices you have eliminated without losing them permanently",
          "Desmos calculator — a full graphing calculator with regression, tables, and statistics functions, available on every math question",
          "Reference sheet — a popup with common geometry and trig formulas, also math-only",
        ],
      },
      {
        heading: "Practice tests inside Bluebook",
        body: [
          "Bluebook ships with several free, full-length adaptive practice tests. These are the most realistic practice material available — same interface, same timing, same adaptivity as the real test.",
          "Scores on these practice tests are released in your College Board account and are generally well-calibrated to real scores, though not perfectly.",
        ],
      },
      {
        heading: "Test day logistics",
        body: [
          "Charge your device to 100% the night before. Bring your charger, your test ticket, and an approved photo ID. The exam can run on battery, but plug in whenever you can — if your device dies mid-test, your proctor may be able to restart you where you left off, but that is slower than just staying plugged in.",
          "Close all other apps before launching Bluebook. The app will warn you if any restricted apps are running and refuse to start the exam until they are closed.",
        ],
      },
      {
        heading: "What to do if something breaks",
        body: [
          "If Bluebook crashes mid-section, the app saves your answers and timer continuously. Raise your hand for the proctor, relaunch, and sign back in — your progress should resume from the last answered question.",
          "If your device fails entirely, proctors have spare devices at most test centers. You will not lose credit for the section. If the whole center has an outage, College Board rescheduled dates exist and do not require a re-registration fee.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is Bluebook free?",
        answer:
          "Yes. The app is free to download and every practice test inside Bluebook is free.",
      },
      {
        question: "Can I take the SAT without Bluebook?",
        answer:
          "No. Bluebook is the only platform the Digital SAT runs on. There is no paper alternative in 2026.",
      },
      {
        question: "What devices run Bluebook?",
        answer:
          "Mac, Windows PCs (Windows 10+), iPads (iPadOS 13.4+), and managed Chromebooks. Personal Chromebooks and Linux are not supported.",
      },
      {
        question: "Can I use Bluebook on an iPad?",
        answer:
          "Yes. Bluebook supports iPad Air, iPad Pro, and iPad (7th generation or later). Connect a keyboard if you can — typing passages with an on-screen keyboard is slower.",
      },
    ],
    relatedPillarSlugs: [
      "digital-sat-guide",
      "desmos-sat-guide",
      "sat-practice-tests",
    ],
  },
  {
    slug: "desmos-sat-guide",
    title: "Desmos on the Digital SAT: A Complete Calculator Strategy Guide",
    metaTitle:
      "Desmos SAT Guide: Using Desmos on Every Math Question (2026)",
    metaDescription:
      "Master the built-in Desmos calculator on the Digital SAT — graphing, tables, regression, statistics, and when to use Desmos instead of algebra.",
    heroIntro:
      "Every Digital SAT math question allows a built-in Desmos graphing calculator. Students who use Desmos as their default problem-solving tool consistently outscore students who treat it as a backup. This guide shows when and how to use Desmos to move faster than pure algebra.",
    sections: [
      {
        heading: "Why Desmos is a big deal",
        body: [
          "On the paper SAT, calculator use was limited. The Digital SAT allows a full-featured graphing calculator on every math question, which means a student who can graph an equation is strictly faster than a student who must solve it by hand.",
          "The time savings compound. On a 44-question section, shaving 20 seconds off even half the questions gives you an extra 7 minutes for harder work — enough to answer three or four more questions confidently.",
        ],
      },
      {
        heading: "When to use Desmos by default",
        body: [
          "Graph first, algebra second. The problem types below should all be Desmos-first by default.",
        ],
        list: [
          "Quadratics — graph y = ax² + bx + c, read the x-intercepts, find the vertex",
          "Systems of equations — graph both, find the intersection",
          "Linear functions — graph to read slope, intercepts, or evaluate at a point",
          "Exponential growth/decay — graph to read initial value, growth factor, and asymptotes",
          "Statistics — use median(), mean(), stdev(), and quartile() directly on a list",
          "Regression — fit a linear, quadratic, or exponential model to a table of points",
        ],
      },
      {
        heading: "Identities and coefficient matching",
        body: [
          "When a question asks 'for what value of c are there infinitely many solutions' or 'what value of k makes these two expressions equivalent', use Desmos custom regression.",
          "Replace '=' with '~' in the equation, set x₁ = [1…100], and let Desmos solve for the unknown constant. This converts a multi-step algebra problem into a one-line calculator entry.",
        ],
      },
      {
        heading: "Statistics functions you should memorize",
        body: [
          "Desmos has built-in statistical functions that compute instantly when you pass a list as the argument. You do not need to store the list as a variable — just pass the values directly.",
        ],
        list: [
          "mean([3, 7, 11, 15, 20])",
          "median([3, 7, 11, 15, 20])",
          "stdev([3, 7, 11, 15, 20])",
          "quartile([3, 7, 11, 15, 20], 1)",
          "total([3, 7, 11, 15, 20])",
        ],
      },
      {
        heading: "Regression for two-variable data",
        body: [
          "Two-variable data questions often give you a table of points and ask for the slope, y-intercept, or equation of the line of best fit. Enter the points as x₁ and y₁ lists, then enter y₁ ~ mx₁ + b — Desmos returns m and b instantly.",
          "For nonlinear fits, use y₁ ~ a·b^x₁ (exponential) or y₁ ~ ax₁² + bx₁ + c (quadratic).",
        ],
      },
      {
        heading: "When Desmos is the wrong tool",
        body: [
          "Pure grammar and word-problem setup questions are Reading and Writing, not Math — Desmos does not apply. Inside math, geometry proofs, combinatorics questions, and logic-heavy word problems usually solve faster with reasoning than with a graph.",
          "The skill is picking the right tool, not forcing Desmos onto every question. Still, the default should be Desmos-first, because the error cost of trying Desmos and abandoning it is about 10 seconds — much smaller than the error cost of slogging through algebra when a graph would have answered instantly.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can I bring my own calculator to the SAT?",
        answer:
          "Yes, but the built-in Desmos is strictly more powerful than most handheld calculators and is what we recommend students practice with.",
      },
      {
        question: "Is Desmos allowed on every math question?",
        answer:
          "Yes. There is no no-calculator section on the Digital SAT.",
      },
      {
        question: "Does Desmos do trigonometry?",
        answer:
          "Yes. Use sin(x), cos(x), tan(x) with x in radians. For degrees, use sin(x°) with the explicit degree symbol.",
      },
      {
        question: "Can I use the same Desmos keyboard shortcuts as on the web?",
        answer:
          "Most work. The caret (^) for exponents, the slash (/) for fractions, and underscore (_) for subscripts all work the same as the public Desmos calculator.",
      },
    ],
    relatedSkillSlugs: [
      "nonlinear-functions",
      "nonlinear-equations-and-systems",
      "equivalent-expressions",
      "one-variable-data",
      "two-variable-data",
    ],
    relatedPillarSlugs: ["digital-sat-math", "digital-sat-guide"],
  },
  {
    slug: "sat-vs-act",
    title: "SAT vs ACT: Which Test Should You Take in 2026?",
    metaTitle: "SAT vs ACT: Format, Scoring, Content Differences, and How to Choose",
    metaDescription:
      "The SAT and ACT differ in length, pacing, math scope, and reading style. Here is a side-by-side comparison and how to decide which one is worth your prep time.",
    heroIntro:
      "The Digital SAT and Digital ACT are now both the only versions of their respective tests. Most selective US colleges accept either and do not prefer one over the other. The real question is which test suits your skills, pacing, and prep time better.",
    sections: [
      {
        heading: "Format side by side",
        body: [
          "Both tests are adaptive, digital, and scored on different scales. The rest of the format diverges substantially.",
        ],
        list: [
          "Digital SAT — 2 hrs 14 min, 98 questions, 400–1600 scale, section-level adaptive",
          "Digital ACT — 2 hrs 5 min (core), 131 questions, 1–36 scale, question-level adaptive on most sections",
        ],
      },
      {
        heading: "Content differences — math",
        body: [
          "SAT Math covers algebra, advanced math (quadratics, exponentials), data analysis, geometry, and trig. It leans algebra-heavy and allows a calculator on every question.",
          "ACT Math covers all of the above plus trigonometry, matrices, logarithms, and more complex geometry. It has less reading load per problem and tighter pacing.",
          "Students who are comfortable with procedural math and fast arithmetic often score higher on the ACT. Students who prefer fewer, slower, more reasoning-heavy problems usually prefer the SAT.",
        ],
      },
      {
        heading: "Content differences — reading",
        body: [
          "The Digital SAT uses short passages of 25–150 words with one question each. Questions are dense and often grammar-heavy.",
          "The Digital ACT uses longer passages with multiple questions each. Reading passages are literary, social science, humanities, and natural science.",
          "Students who process long passages well usually prefer the ACT. Students who get overwhelmed by length or who read carefully but slowly usually prefer the SAT.",
        ],
      },
      {
        heading: "Scoring",
        body: [
          "SAT: 400–1600 composite, two section scores of 200–800.",
          "ACT: 1–36 composite, four section scores averaged.",
          "Concordance tables published by College Board and ACT let you convert between scores. A 1400 SAT ≈ 31 ACT. A 1500 SAT ≈ 34 ACT. A 1600 SAT ≈ 36 ACT.",
        ],
      },
      {
        heading: "How to decide",
        body: [
          "Take a timed practice test of each before committing. Score either using Bluebook (SAT) or the ACT's official Digital ACT practice tests.",
          "If your concordant scores are within 30 SAT points, pick the test whose format you prefer. If one is meaningfully higher, prep for that one. Do not prep for both.",
        ],
      },
    ],
    faqs: [
      {
        question: "Do colleges prefer the SAT or the ACT?",
        answer:
          "No. Every selective US college accepts both and does not prefer one over the other.",
      },
      {
        question: "Which test is easier?",
        answer:
          "Neither is easier overall. The SAT has fewer, slower questions with dense reading. The ACT has more questions with tighter pacing. Which one suits you depends on your test-taking style.",
      },
      {
        question: "Can I take both?",
        answer:
          "You can, but most students do not benefit from it. Prep time is better concentrated on one test.",
      },
      {
        question: "How do I convert an SAT score to an ACT score?",
        answer:
          "Use the official ACT/SAT concordance tables. As rough benchmarks: 1200 SAT ≈ 25 ACT, 1400 SAT ≈ 31 ACT, 1500 SAT ≈ 34 ACT, 1600 SAT ≈ 36 ACT.",
      },
    ],
    relatedPillarSlugs: ["digital-sat-guide", "how-to-study-for-sat"],
    relatedScoreTargets: [1200, 1400, 1500, 1600],
  },
  {
    slug: "how-to-study-for-sat",
    title: "How to Study for the SAT: A 2026 Prep Plan That Actually Works",
    metaTitle: "How to Study for the SAT: A Week-by-Week Plan (2026)",
    metaDescription:
      "A week-by-week Digital SAT study plan, what to do each day, what to skip, and how to turn weak sections into strengths without burning out.",
    heroIntro:
      "There is no single right way to prep for the SAT, but there are plenty of wrong ways. This plan is built around three principles: diagnose before drilling, review harder than you practice, and stop once you hit your target.",
    sections: [
      {
        heading: "Step 1: diagnose",
        body: [
          "Take a full, timed practice test in Bluebook. Score it. Look at the miss breakdown by skill — every Bluebook practice test reports accuracy per domain and per skill.",
          "Identify the three skills where you missed the most points. Those are your priority targets for the next few weeks. Do not try to fix everything at once.",
        ],
      },
      {
        heading: "Step 2: content review",
        body: [
          "Spend 2–4 weeks on targeted content review. Use skill-specific explanations and 10–20 focused practice questions per session. Review every miss with a written note — not just 'oh I see' but a single sentence explaining why the right answer was right and why you picked what you picked.",
          "This is the part students most often skimp on. Written review is what converts short-term pattern-matching into long-term skill.",
        ],
      },
      {
        heading: "Step 3: timed practice",
        body: [
          "Once your targeted skills are reliable, move to full modules timed end-to-end. Do not go back to untimed practice. Pacing is its own skill and has to be practiced under the real clock.",
          "Take at least two full practice tests in weeks 6–10. Each one should feel progressively less like an emergency and more like a routine. That change — not the score — is the signal that you are ready.",
        ],
      },
      {
        heading: "Step 4: full-length rehearsals",
        body: [
          "In the last 2–3 weeks, take a full practice test every 5–7 days. Simulate test-day conditions: same start time, same break length, no phone. Review each test for 2–3 hours before starting the next.",
          "Stop adding volume in the final 3 days. Rest and light review outperform cramming at this stage.",
        ],
      },
      {
        heading: "How much time to spend per week",
        body: [
          "3–5 hours per week is enough for most students if the time is well-used. 10+ hours per week is rarely better than 5 — returns diminish fast, and burnout risk climbs.",
          "One common mistake: doing a little every day because it feels productive. Two focused 90-minute sessions beat seven hurried 20-minute ones.",
        ],
      },
      {
        heading: "When to stop prepping",
        body: [
          "Stop when you hit your target score on two consecutive practice tests under real conditions. Additional prep past that point usually trades small score gains for meaningful anxiety.",
          "If you have a specific application target in mind, use the 25th-percentile score from your target school as your floor and the 75th-percentile as your stretch goal.",
        ],
      },
    ],
    faqs: [
      {
        question: "How long should I study for the SAT?",
        answer:
          "Most students benefit from 8–12 weeks of structured prep. Cramming in 2 weeks rarely moves scores meaningfully; studying for 6+ months usually means a lot of inefficient practice.",
      },
      {
        question: "How many practice tests should I take?",
        answer:
          "At least 4 full-length practice tests in the last 6 weeks. Reviewing each one thoroughly matters more than adding a 5th.",
      },
      {
        question: "Is a tutor necessary?",
        answer:
          "No. Self-study with targeted practice and review works for most students. A tutor can shortcut weak review habits if you can afford one.",
      },
      {
        question: "Do I need to memorize vocabulary?",
        answer:
          "Some. Words in Context appears on every test. Build a list from missed questions rather than memorizing generic SAT word lists.",
      },
    ],
    relatedPillarSlugs: [
      "digital-sat-guide",
      "sat-practice-tests",
      "digital-sat-math",
      "digital-sat-reading-writing",
    ],
    relatedScoreTargets: [1200, 1400, 1500, 1600],
  },
  {
    slug: "sat-practice-tests",
    title: "SAT Practice Tests: What to Use and How to Use Them",
    metaTitle: "SAT Practice Tests: Official, Third-Party, and How to Use Them",
    metaDescription:
      "Which SAT practice tests actually simulate the real test, how to take one, and how to review it so the next test goes better.",
    heroIntro:
      "Practice tests are the highest-leverage single activity in SAT prep. Taking the right tests, under the right conditions, with the right review, is worth more than a month of unfocused drilling. This guide covers which tests to take and how to get the most out of each one.",
    sections: [
      {
        heading: "Official College Board practice tests",
        body: [
          "The six free Bluebook practice tests are the gold standard. They are adaptive, timed, and scored like the real SAT, and they run inside the same app you will use on test day.",
          "Do not skip these. No third-party test comes as close to the real interface and adaptivity.",
        ],
      },
      {
        heading: "Third-party practice tests",
        body: [
          "Third-party tests are useful as extra volume once you have exhausted Bluebook. Look for tests that match the Digital SAT format — short passages, section-level adaptivity, Desmos-enabled math — and skip anything based on the old paper SAT.",
          "Expect third-party tests to be slightly harder or easier than official ones. Use them to practice pacing and endurance; trust Bluebook scores more for score prediction.",
        ],
      },
      {
        heading: "How to take a practice test well",
        body: [
          "Set the test up like a real administration. Same device, same time of day, no phone, single 10-minute break between sections. If you cheat on the rules, the score is a lie.",
          "Do not pause the timer. Do not look up an answer mid-test. Do not re-read an explanation until the full test is done. The test measures your ability under constraint — removing constraints breaks the measurement.",
        ],
      },
      {
        heading: "How to review a practice test well",
        body: [
          "Review takes 2–3 hours per test. Plan for it or the test was wasted.",
          "For each miss, write one sentence that answers: 'Why was the right answer right, and why did I pick what I picked?' That sentence has to be specific enough that you could teach the question to a friend who has not seen it.",
          "For each correct answer you were unsure about, do the same — you want to harden the reasoning so you are not guessing next time.",
        ],
      },
      {
        heading: "How often to take practice tests",
        body: [
          "Once a week in the last 4–6 weeks. Two per week works for some high-volume students but stops helping around 8 tests total — you run out of new information to learn.",
          "In the final 3 days, stop taking new full tests. Rest and light review outperform another full-length grind.",
        ],
      },
    ],
    faqs: [
      {
        question: "How many official SAT practice tests are available?",
        answer:
          "Six adaptive full-length practice tests are free inside the Bluebook app.",
      },
      {
        question: "Are old paper SAT practice tests useful?",
        answer:
          "Limited. They share some content with the Digital SAT but do not simulate short passages, Desmos, or adaptive pacing. Use them for content practice only.",
      },
      {
        question: "How long does an SAT practice test take?",
        answer:
          "2 hours 14 minutes of test time, plus a 10-minute break, for about 2.5 hours end-to-end. Plan 4–5 hours total if you want to review the same day.",
      },
      {
        question: "Should I take a practice test the week before the SAT?",
        answer:
          "One full-length 7 days out is a good idea. Do not take another in the final 3 days — rest matters more than volume at that point.",
      },
    ],
    relatedPillarSlugs: [
      "digital-sat-guide",
      "how-to-study-for-sat",
      "bluebook-app-guide",
    ],
  },
  {
    slug: "sat-for-international-students",
    title: "Digital SAT for International Students: 2026 Guide",
    metaTitle:
      "Digital SAT for International Students: Registration, Centers, Scores",
    metaDescription:
      "How international students register for, prepare for, and submit the Digital SAT — centers, timing, fee waivers, score sends, and admissions impact.",
    heroIntro:
      "International students face the same Digital SAT as US students but have different registration logistics, test-center availability, and deadlines to navigate. This guide covers the international-specific steps that trip students up most.",
    sections: [
      {
        heading: "Where you can take the SAT",
        body: [
          "The College Board publishes a list of international test centers roughly one year in advance. Major metros in Asia, Europe, the Middle East, and Latin America typically have multiple dates per year.",
          "Availability in smaller cities is tighter. Register early — international seats fill faster than US seats, especially for the October and March administrations.",
        ],
      },
      {
        heading: "International test dates",
        body: [
          "International administrations usually run the same weekends as US administrations — August, October, November, December, March, May, and June.",
          "Some specific countries have restrictions. Check the College Board international center list for your country well before you plan to register.",
        ],
      },
      {
        heading: "Registration and fees",
        body: [
          "International SAT registration costs more than US registration. As of 2026, the international fee is around $117. Fee waivers are available for US citizens testing abroad but not for non-US citizens.",
          "You need a photo ID that matches your registered name exactly — typically a passport. Double-check the name on your College Board account against your passport before registering.",
        ],
      },
      {
        heading: "Sending scores to colleges",
        body: [
          "You get four free score sends when you register; these are a good value if you already know where you want to apply. After those, each report costs about $14 to send.",
          "Some colleges accept self-reported scores during the application and only require official score reports after admission. Check each school's policy — you may be able to save on score sends.",
        ],
      },
      {
        heading: "What US admissions look for from international applicants",
        body: [
          "Selective US colleges weigh SAT scores more heavily for international applicants, especially from schools with unfamiliar grading systems. A strong SAT is often the single most legible academic signal in your application.",
          "At the same time, a test score alone does not compensate for a weak application. Write for context, not against it: your score should corroborate your transcript and essays, not have to carry them.",
        ],
      },
      {
        heading: "English as a non-native language",
        body: [
          "The Digital SAT Reading and Writing section is harder for non-native English speakers than the Math section, but not unreachable. Vocabulary work pays off more for non-native speakers than for native speakers because it closes the biggest gap.",
          "Most selective US universities also require a separate English proficiency exam (TOEFL or IELTS) for international students whose first language is not English. The SAT does not replace that requirement.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is the Digital SAT available internationally?",
        answer:
          "Yes. Every SAT administration since spring 2024 has been digital, in every country.",
      },
      {
        question: "How much does the SAT cost internationally?",
        answer:
          "Around $117 in 2026, which includes a non-US regional fee on top of the base test fee. Check College Board for your specific country's fee.",
      },
      {
        question: "Do US colleges weigh international SAT scores differently?",
        answer:
          "Yes. For international applicants, the SAT is often weighted more heavily because US admissions officers may be less familiar with your school's grading system.",
      },
      {
        question:
          "Do I still need TOEFL or IELTS if I take the Digital SAT?",
        answer:
          "Usually yes. Most selective US universities require a separate English-proficiency exam for non-native speakers regardless of SAT score.",
      },
    ],
    relatedPillarSlugs: ["digital-sat-guide", "how-to-study-for-sat"],
  },
];

export const pillarBySlug = new Map(pillarPages.map((page) => [page.slug, page]));
