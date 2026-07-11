interface BlogSection {
  heading: string;
  body: string[];
  list?: string[];
}

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  datePublished: string;
  readingMinutes: number;
  tag: string;
  sections: BlogSection[];
  relatedSlugs?: string[];
}

export const BLOG_EDITORIAL_AUTHOR = "1600.now SAT Content Team";
export const BLOG_LAST_REVIEWED = "2026-07-10";
export const BLOG_PRIMARY_SOURCE_URL = "https://satsuite.collegeboard.org/sat";

export const getBlogReadingMinutes = (post: BlogPost): number => {
  const text = [
    post.title,
    post.description,
    ...post.sections.flatMap((section) => [
      section.heading,
      ...section.body,
      ...(section.list ?? []),
    ]),
  ].join(" ");
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 220));
};

export const blogPosts: BlogPost[] = [
  {
    slug: "how-the-digital-sat-works",
    title: "How the Digital SAT Works: The Complete 2026 Guide",
    description:
      "The complete guide to the Digital SAT: format, adaptive modules, scoring, timing, and how to prepare. Everything a student needs to know in one place.",
    datePublished: "2025-08-18",
    readingMinutes: 14,
    tag: "SAT Basics",
    sections: [
      {
        heading: "What is the Digital SAT?",
        body: [
          "The Digital SAT is the current version of the SAT, administered on a computer or tablet through the College Board's Bluebook app. It replaced the paper SAT in 2024 in the US and is now the only format of the SAT offered.",
          "The Digital SAT has two sections — Reading and Writing, then Math — and runs just over two hours including a single 10-minute break. Both sections are section-adaptive: your performance on the first module within each section determines whether the second module is easier or harder.",
        ],
      },
      {
        heading: "Digital SAT Sections and Timing",
        body: [
          "The test is broken into four modules, two per section. Each module is discrete — once you submit a module you can't return to it. Inside a module, you can move freely between questions.",
        ],
        list: [
          "English Module 1 — 27 questions, 32 minutes",
          "English Module 2 — 27 questions, 32 minutes",
          "Math Module 1 — 22 questions, 35 minutes",
          "Math Module 2 — 22 questions, 35 minutes",
        ],
      },
      {
        heading: "How Adaptive Scoring Works",
        body: [
          "After you finish Module 1 of each section, the test routes you to either an easier or a harder Module 2. This is called section-level adaptivity — your Module 1 performance determines your Module 2 path.",
          "You need to reach the hard Module 2 in a section to access the full scaled-score range in that section. Students who stay in the easy Module 2 have a scaled-score ceiling well below 800.",
        ],
      },
      {
        heading: "How the Digital SAT Is Scored",
        body: [
          "Each section is scored on a 200–800 scaled score. Reading & Writing and Math are added together for a total score from 400 to 1600.",
          "Every test form has slightly different difficulty, so the College Board uses a process called equating to ensure that, for example, a 1450 means the same level of ability across different test dates.",
        ],
      },
      {
        heading: "How to Prepare",
        body: [
          "Start with a full-length practice test in Bluebook or another adaptive platform to establish your baseline. From there, break your prep into three loops: drill the skills you miss, practice full modules for pacing, and review every wrong answer.",
          "Use our SAT score calculator to translate raw scores into a projected 1600-scale score, and use the SAT skills hub to find targeted practice.",
        ],
      },
    ],
    relatedSlugs: [
      "digital-sat-scoring-explained",
      "how-adaptive-sat-testing-works",
      "digital-sat-vs-paper-sat",
    ],
  },
  {
    slug: "digital-sat-vs-paper-sat",
    title: "Digital SAT vs Paper SAT: Every Difference That Matters",
    description:
      "The Digital SAT is shorter, adaptive, and has different question types than the old paper SAT. Here is every change that affects how you prepare.",
    datePublished: "2025-08-22",
    readingMinutes: 10,
    tag: "SAT Basics",
    sections: [
      {
        heading: "Length and Timing",
        body: [
          "The Digital SAT is about 2 hours 14 minutes, compared to 3 hours for the paper SAT. There are fewer questions but more time per question in most cases.",
        ],
      },
      {
        heading: "Question Types",
        body: [
          "The new Reading and Writing section uses short passages — 25 to 150 words — with a single question each. The old SAT had long passages with many questions each.",
          "Math now allows a Desmos calculator on every question. There is no 'no-calculator' section.",
        ],
      },
      {
        heading: "What This Means for Prep",
        body: [
          "Old paper SAT practice material is still useful for content, but not for format. Use Bluebook practice tests and adaptive third-party practice to simulate modern timing and question style.",
        ],
      },
    ],
    relatedSlugs: ["how-the-digital-sat-works", "best-digital-sat-practice-tests"],
  },
  {
    slug: "what-is-a-good-sat-score",
    title: "What Is a Good SAT Score in 2026?",
    description:
      "A breakdown of what counts as a good Digital SAT score, with percentiles, target colleges, and how the bar shifts depending on your goals.",
    datePublished: "2025-08-27",
    readingMinutes: 8,
    tag: "SAT Scoring",
    sections: [
      {
        heading: "Good Depends on Your Goals",
        body: [
          "A 'good' SAT score is the score that gets you into the colleges you want. National averages are a reference point, not a goal.",
        ],
        list: [
          "1050–1100: National average — competitive at many regional universities.",
          "1200+: Above average — competitive at most four-year colleges.",
          "1400+: Strong — competitive at selective universities.",
          "1500+: Elite — Ivy League and top-ranked schools in range.",
        ],
      },
      {
        heading: "Find Your Target Score",
        body: [
          "Look up the middle-50% SAT range for your top three schools, then aim for the 75th percentile. Use our SAT score breakdowns for details at every score level.",
        ],
      },
    ],
    relatedSlugs: ["how-to-get-a-1600", "digital-sat-scoring-explained", "ivy-league-sat-scores"],
  },
  {
    slug: "digital-sat-scoring-explained",
    title: "Digital SAT Scoring Explained: From Raw Score to 1600",
    description:
      "A complete breakdown of how Digital SAT scoring works, including adaptive modules, raw-to-scaled conversion, and why the same raw score can mean different totals.",
    datePublished: "2025-09-02",
    readingMinutes: 9,
    tag: "SAT Scoring",
    sections: [
      {
        heading: "The Two Numbers You Get",
        body: [
          "The Digital SAT gives you three numbers: a Reading & Writing scaled score (200–800), a Math scaled score (200–800), and a total (400–1600).",
          "There are no subscores or cross-test scores anymore — just the two section scores and the sum.",
        ],
      },
      {
        heading: "From Raw Score to Scaled Score",
        body: [
          "Your raw score is the number of correct answers you get. That raw score is converted into a scaled score using a conversion table for your specific test form. The conversion handles small differences in form difficulty through equating.",
          "Because of adaptive routing, the same raw number of questions correct can produce different scaled scores depending on whether you reached the hard Module 2.",
        ],
      },
      {
        heading: "Estimate Your Own Score",
        body: [
          "Use our Digital SAT score calculator to see how specific raw totals in each module map onto the 1600 scale. It is a fast way to set target raw-score goals for each practice session.",
        ],
      },
    ],
    relatedSlugs: [
      "how-adaptive-sat-testing-works",
      "how-the-digital-sat-works",
      "what-is-a-good-sat-score",
    ],
  },
  {
    slug: "how-adaptive-sat-testing-works",
    title: "How Adaptive Testing Works on the Digital SAT",
    description:
      "Everything you need to know about section-level adaptivity on the Digital SAT — what triggers the hard Module 2, and how to aim for it strategically.",
    datePublished: "2025-09-07",
    readingMinutes: 7,
    tag: "SAT Strategy",
    sections: [
      {
        heading: "What 'Section-Level Adaptive' Means",
        body: [
          "The Digital SAT is not question-level adaptive like the GRE. Your performance inside Module 1 is evaluated as a whole, and that score determines whether Module 2 is easier or harder.",
          "Within Module 1, every student sees a mix of easy, medium, and hard questions. You can navigate freely, flag items, and change answers.",
        ],
      },
      {
        heading: "How to Aim for the Hard Module 2",
        body: [
          "Treat Module 1 as critical. Your Module 1 accuracy is the single biggest lever on your final score — missing even a few extra questions can drop you into the easy Module 2 and cap your section score near 600.",
        ],
      },
    ],
    relatedSlugs: [
      "digital-sat-scoring-explained",
      "how-to-get-a-1600",
      "sat-pacing-strategy",
    ],
  },
  {
    slug: "sat-vs-act-which-should-you-take",
    title: "SAT vs ACT: Which Test Should You Take?",
    description:
      "A side-by-side comparison of the Digital SAT and the ACT covering format, content, timing, and which test fits different student strengths.",
    datePublished: "2025-09-12",
    readingMinutes: 9,
    tag: "SAT Basics",
    sections: [
      {
        heading: "The Format Gap",
        body: [
          "The Digital SAT is shorter, adaptive, and computer-based. The ACT is longer, linear, and has a dedicated Science section. Colleges accept either — there is no admissions preference.",
        ],
      },
      {
        heading: "Which Fits Your Strengths",
        body: [
          "Choose the SAT if you prefer fewer, longer-to-solve questions and are comfortable with a digital interface. Choose the ACT if you read quickly, have strong science-data interpretation skills, and don't mind faster pacing.",
        ],
        list: [
          "Average per-question time, SAT Math: ~95 seconds.",
          "Average per-question time, ACT Math: ~60 seconds.",
          "ACT includes a Science section; SAT does not.",
          "Digital SAT is adaptive; ACT is not.",
        ],
      },
      {
        heading: "Can You Take Both?",
        body: [
          "Yes. Many students take both once and submit whichever score is stronger. If you have the bandwidth, a diagnostic in each format is the cleanest way to decide.",
        ],
      },
    ],
    relatedSlugs: ["how-the-digital-sat-works", "when-should-you-take-the-sat"],
  },
  {
    slug: "when-should-you-take-the-sat",
    title: "When Should You Take the SAT? The Best Test Dates Explained",
    description:
      "A guide to choosing your first SAT test date based on grade level, application deadlines, and how long you realistically need to prep.",
    datePublished: "2025-09-17",
    readingMinutes: 7,
    tag: "SAT Basics",
    sections: [
      {
        heading: "The Standard Timeline",
        body: [
          "Most students take the SAT for the first time in the spring of junior year and retake in the fall of senior year. This gives you a baseline early enough to improve and a retake before college deadlines.",
        ],
      },
      {
        heading: "If You're Aiming for 1500+",
        body: [
          "Take a diagnostic in fall of junior year, then plan on 3–4 months of structured prep before your first real sitting. A second attempt three months later gives you room to push a 1400 into 1500+ territory.",
        ],
      },
      {
        heading: "If You're Applying Early",
        body: [
          "Early Action and Early Decision deadlines are November 1 or November 15. That means your final retake must be the August or October SAT of senior year. Back-plan from there.",
        ],
      },
    ],
    relatedSlugs: ["how-many-times-should-you-take-the-sat", "30-day-sat-study-plan"],
  },
  {
    slug: "how-many-times-should-you-take-the-sat",
    title: "How Many Times Should You Take the SAT?",
    description:
      "Most students take the SAT two or three times. Here is how to decide on your retake count without wasting a Saturday or triggering admissions red flags.",
    datePublished: "2025-09-22",
    readingMinutes: 6,
    tag: "SAT Basics",
    sections: [
      {
        heading: "Two to Three Is Standard",
        body: [
          "Almost no admissions office cares if you sit the SAT two or three times. Four or more can look like poor planning; one attempt can leave points on the table.",
        ],
      },
      {
        heading: "When to Retake",
        body: [
          "Retake if your score is below your target range by 50 points or more, or if you know exactly why you underperformed (pacing, a single weak skill, test-day nerves).",
        ],
      },
      {
        heading: "When Not to Retake",
        body: [
          "If your score is already above the 75th percentile of your target schools and your prep has plateaued on practice tests, further retakes usually don't move the needle.",
        ],
      },
    ],
    relatedSlugs: ["when-should-you-take-the-sat", "sat-superscore-explained"],
  },
  {
    slug: "how-to-study-for-sat-2-weeks",
    title: "How to Study for the SAT in 2 Weeks",
    description:
      "A realistic two-week Digital SAT study plan for when you're out of runway — triage, drill, and simulate.",
    datePublished: "2025-09-27",
    readingMinutes: 7,
    tag: "SAT Strategy",
    sections: [
      {
        heading: "Day 1: Triage",
        body: [
          "Take one full-length Bluebook practice test under real conditions. Mark every missed question by skill. You'll focus only on the top five skill gaps.",
        ],
      },
      {
        heading: "Days 2–10: Drill",
        body: [
          "One skill per day. 30 minutes of concept review plus 45 minutes of targeted practice. Review every miss immediately, don't move on with unresolved misses.",
        ],
      },
      {
        heading: "Days 11–14: Simulate",
        body: [
          "Two more full-length practice tests with 48 hours between them. Light review only on the final day. Sleep is worth more than one extra drill.",
        ],
      },
    ],
    relatedSlugs: ["30-day-sat-study-plan", "last-week-sat-study-plan"],
  },
  {
    slug: "30-day-sat-study-plan",
    title: "The 30-Day SAT Study Plan",
    description:
      "A structured 30-day Digital SAT study plan designed to raise scores 100+ points with focused daily work and three full-length practice tests.",
    datePublished: "2025-10-02",
    readingMinutes: 10,
    tag: "SAT Strategy",
    sections: [
      {
        heading: "Week 1: Baseline",
        body: [
          "Day 1: Full diagnostic. Days 2–7: review every miss, study one skill per day, drill 30 minutes on each.",
        ],
      },
      {
        heading: "Weeks 2–3: Targeted Skill Work",
        body: [
          "Rotate through your top eight weakest skills. Every fourth day, do one timed module in your weakest section.",
        ],
      },
      {
        heading: "Week 4: Simulate",
        body: [
          "Two full-length practice tests with a review day after each. Then taper for test day — light review, no new content.",
        ],
      },
    ],
    relatedSlugs: ["how-to-study-for-sat-2-weeks", "90-day-sat-study-plan"],
  },
  {
    slug: "90-day-sat-study-plan",
    title: "The 90-Day SAT Study Plan for Serious Score Gains",
    description:
      "A 90-day Digital SAT plan for students aiming to go from a 1200 baseline to a 1400+ score with steady, scaffolded work.",
    datePublished: "2025-10-07",
    readingMinutes: 11,
    tag: "SAT Strategy",
    sections: [
      {
        heading: "Phase 1 (Days 1–30): Content Build",
        body: [
          "Cover every tested skill once. Two skills per week, with a 30-question drill after each. No timed practice yet — focus on understanding.",
        ],
      },
      {
        heading: "Phase 2 (Days 31–60): Timed Sections",
        body: [
          "One timed module per day, alternating Math and R&W. Weekly full-length practice test. Review every wrong answer, not just the hard ones.",
        ],
      },
      {
        heading: "Phase 3 (Days 61–90): Refinement",
        body: [
          "Focus exclusively on the skills and question types you still miss. Three more full-length tests. Final week: taper and rest.",
        ],
      },
    ],
    relatedSlugs: ["30-day-sat-study-plan", "how-to-get-a-1600"],
  },
  {
    slug: "last-week-sat-study-plan",
    title: "The Last-Week SAT Study Plan",
    description:
      "Exactly what to do in the seven days before your Digital SAT — no cramming, no burnout, just the final prep that actually helps.",
    datePublished: "2025-10-12",
    readingMinutes: 6,
    tag: "SAT Strategy",
    sections: [
      {
        heading: "Day-by-Day Plan",
        body: [
          "7 days out: one full-length practice test. Review all misses in detail.",
          "Days 6–5: drill top three missed skills from the practice test.",
          "Day 4: one module under timed conditions, any section.",
          "Day 3: review SAT vocabulary and math formulas.",
          "Day 2: light review only, no new questions.",
          "Day 1: rest. Prep your ID, Bluebook login, and laptop.",
        ],
      },
    ],
    relatedSlugs: ["how-to-get-a-1600", "sat-pacing-strategy", "sat-test-day-checklist"],
  },
  {
    slug: "sat-test-day-checklist",
    title: "SAT Test Day Checklist: What to Do the Morning of the Test",
    description:
      "A minute-by-minute Digital SAT test day checklist so nothing goes wrong before you sit down at the test center.",
    datePublished: "2025-10-17",
    readingMinutes: 6,
    tag: "SAT Strategy",
    sections: [
      {
        heading: "The Night Before",
        body: [
          "Charge your laptop or tablet to 100%. Confirm Bluebook is installed and your exam is downloaded. Pack your bag the night before, not the morning of.",
        ],
        list: [
          "Photo ID",
          "Admission ticket (printed or on phone)",
          "Fully charged laptop or tablet",
          "Charger",
          "Approved calculator as backup",
          "Water and snack",
          "Layered clothing",
        ],
      },
      {
        heading: "The Morning Of",
        body: [
          "Eat the same breakfast you've eaten on practice-test mornings. Leave 15 minutes earlier than you think you need to — parking at test centers is unpredictable.",
        ],
      },
      {
        heading: "Before the First Module",
        body: [
          "Log into Bluebook, confirm your exam is ready, and take three deep breaths. Your first minute of Module 1 sets the tone for the section — don't rush it.",
        ],
      },
    ],
    relatedSlugs: ["what-to-bring-to-sat-test-day", "how-to-stay-calm-during-sat"],
  },
  {
    slug: "what-to-bring-to-sat-test-day",
    title: "What to Bring to the SAT: Complete Test Day Bag List",
    description:
      "Every item you need (and shouldn't bring) on Digital SAT test day, from ID requirements to backup calculators and snacks.",
    datePublished: "2025-10-22",
    readingMinutes: 5,
    tag: "SAT Strategy",
    sections: [
      {
        heading: "Required Items",
        body: ["These are non-negotiable. Arriving without any of these can mean you are turned away."],
        list: [
          "A valid government-issued photo ID",
          "Your printed or digital admission ticket",
          "A fully charged laptop or tablet with Bluebook installed",
          "A charger",
        ],
      },
      {
        heading: "Recommended Extras",
        body: [
          "Bluebook has a built-in Desmos calculator, but bringing an approved physical calculator as backup is smart in case of a tech issue.",
        ],
        list: [
          "Approved graphing calculator",
          "Watch (non-smart, silent)",
          "Water bottle",
          "Small snack for the break",
          "A light layer in case the room is cold",
        ],
      },
      {
        heading: "Prohibited Items",
        body: [
          "Phones must be powered off and stored away. Smartwatches, earbuds, and scratch paper you brought yourself are all prohibited.",
        ],
      },
    ],
    relatedSlugs: ["sat-test-day-checklist", "how-to-stay-calm-during-sat"],
  },
  {
    slug: "how-to-stay-calm-during-sat",
    title: "How to Stay Calm During the SAT",
    description:
      "Concrete techniques for managing test anxiety on the Digital SAT so your score reflects your prep, not your nerves.",
    datePublished: "2025-10-27",
    readingMinutes: 6,
    tag: "SAT Strategy",
    sections: [
      {
        heading: "Before the Test",
        body: [
          "Anxiety is usually driven by uncertainty. Simulate the test environment at least twice in the final week — same time of day, same laptop, timed modules — so nothing on test day feels new.",
        ],
      },
      {
        heading: "During the Test",
        body: [
          "If you feel your pulse rising, use a 4-7-8 breath: inhale 4 seconds, hold 7, exhale 8. One cycle resets most stress responses. Flag the question, move on, come back.",
        ],
      },
      {
        heading: "Between Modules",
        body: [
          "Do not think about the module you just finished. You can't change it, and rumination will poison the next one. Stretch, breathe, hydrate.",
        ],
      },
    ],
    relatedSlugs: ["sat-test-day-checklist", "common-sat-mistakes"],
  },
  {
    slug: "common-sat-mistakes",
    title: "10 Common SAT Mistakes and How to Avoid Them",
    description:
      "The most frequent Digital SAT mistakes students make on test day and during prep — plus how to fix each one.",
    datePublished: "2025-11-01",
    readingMinutes: 9,
    tag: "SAT Strategy",
    sections: [
      {
        heading: "The Top Mistakes",
        body: ["Most score losses come from a handful of avoidable patterns."],
        list: [
          "Spending too long on Module 1's hardest question",
          "Not flagging and returning",
          "Misreading the question (especially 'least,' 'except,' 'not')",
          "Ignoring Desmos for algebra questions",
          "Over-reviewing right answers instead of wrong ones",
          "Cramming the night before",
          "Only practicing one section",
          "Skipping the review step after practice tests",
          "Changing confident answers under second-guessing",
          "Running out of time because of pacing drift",
        ],
      },
      {
        heading: "The Common Thread",
        body: [
          "Most mistakes aren't about content — they are about process. A disciplined pacing and review routine fixes more score loss than any single skill upgrade.",
        ],
      },
    ],
    relatedSlugs: ["sat-pacing-strategy", "how-to-review-sat-practice-tests"],
  },
  {
    slug: "how-to-review-sat-practice-tests",
    title: "How to Review an SAT Practice Test (the Right Way)",
    description:
      "Taking a practice test is only half the work. Here is a rigorous review process that turns missed questions into durable score gains.",
    datePublished: "2025-11-06",
    readingMinutes: 8,
    tag: "SAT Strategy",
    sections: [
      {
        heading: "The Three-Column Review",
        body: [
          "For every missed question, write three things: what the question was actually asking, what you picked and why, and what the correct path would have been. This exposes pattern-level errors.",
        ],
      },
      {
        heading: "Categorize Every Miss",
        body: [
          "Sort misses into four buckets: content gap, careless error, misread, and pacing. Your next week of study should target the bucket you filled most.",
        ],
      },
      {
        heading: "Revisit After a Week",
        body: [
          "Re-do your missed questions seven days later without looking at the explanation first. If you still miss, that's a true content gap — not a fluke.",
        ],
      },
    ],
    relatedSlugs: ["common-sat-mistakes", "best-digital-sat-practice-tests"],
  },
  {
    slug: "best-digital-sat-practice-tests",
    title: "The Best Free Digital SAT Practice Tests Ranked",
    description:
      "An honest ranking of the best free Digital SAT practice tests in 2026, from Bluebook to 1600.now and everything in between.",
    datePublished: "2025-11-11",
    readingMinutes: 10,
    tag: "SAT Strategy",
    sections: [
      {
        heading: "Rule #1: Use Bluebook Official Practice First",
        body: [
          "Nothing beats a real College Board Bluebook practice test for realism. Bluebook includes six full-length adaptive practice tests, and they are the single best predictor of your real score.",
        ],
      },
      {
        heading: "Best Free Alternatives",
        body: [
          "Once you've used all the official tests, rotate into strong third-party options.",
        ],
        list: [
          "1600.now — free adaptive practice modules and question bank, with detailed explanations.",
          "Khan Academy — excellent concept refreshers and official-aligned practice.",
          "Other open question banks — useful for volume but variable quality.",
        ],
      },
    ],
    relatedSlugs: ["how-the-digital-sat-works", "how-to-get-a-1600"],
  },
  {
    slug: "sat-pacing-strategy",
    title: "Digital SAT Pacing Strategy: How to Finish Every Module on Time",
    description:
      "Concrete pacing strategies for every Digital SAT module so you never run out of time — and what to do if you do.",
    datePublished: "2025-11-16",
    readingMinutes: 8,
    tag: "SAT Strategy",
    sections: [
      {
        heading: "Baseline Targets by Module",
        body: [
          "Reading & Writing: about 71 seconds per question.",
          "Math: about 95 seconds per question.",
          "These are averages. Easy questions should come in well under the average so you bank time for harder ones.",
        ],
      },
      {
        heading: "The 'Two Pass' Method",
        body: [
          "On every module, do a first pass where you answer everything you can in under 60 seconds, flag anything slower, then return to flagged questions with remaining time. This prevents one hard question from eating the whole module.",
        ],
      },
    ],
    relatedSlugs: ["how-to-get-a-1600", "how-adaptive-sat-testing-works"],
  },
  {
    slug: "sat-vocabulary-strategy",
    title: "SAT Vocabulary Study Strategy: What Actually Works",
    description:
      "Rote flashcards are only half the story. Here is how 1500+ students actually study SAT vocabulary so the words stick.",
    datePublished: "2025-11-21",
    readingMinutes: 7,
    tag: "SAT Reading",
    sections: [
      {
        heading: "Contextual Learning Beats Lists",
        body: [
          "Seeing a word only in a flashcard is not enough for Words-in-Context questions. You need to see each word in an academic passage, in multiple senses, and then try to predict it before seeing the answer choices.",
        ],
      },
      {
        heading: "Our SAT Vocabulary Hub",
        body: [
          "The 1600.now SAT vocabulary hub groups every tested word by difficulty and links to individual pages with examples for each word. Use it as your primary source of truth for SAT vocabulary.",
        ],
      },
    ],
    relatedSlugs: ["sat-words-in-context-guide", "what-is-a-good-sat-score"],
  },
  {
    slug: "sat-words-in-context-guide",
    title: "SAT Words in Context: The Complete Question Guide",
    description:
      "How to solve every Digital SAT Words in Context question with a predict-first method that beats process of elimination.",
    datePublished: "2025-11-26",
    readingMinutes: 7,
    tag: "SAT Reading",
    sections: [
      {
        heading: "Predict Before You Look",
        body: [
          "Before looking at the answer choices, cover them with your hand and write one word that fits the blank. Then scan for the answer closest to your prediction. This avoids the trap of choices that sound SAT-ish but don't fit.",
        ],
      },
      {
        heading: "Watch for Double Meanings",
        body: [
          "SAT Words-in-Context questions frequently hinge on a secondary meaning of a common word. 'Qualify' can mean to modify, not just to become eligible. Always check the context before trusting the first meaning that comes to mind.",
        ],
      },
    ],
    relatedSlugs: ["sat-vocabulary-strategy", "sat-main-idea-questions"],
  },
  {
    slug: "sat-main-idea-questions",
    title: "How to Find the Main Idea on the Digital SAT",
    description:
      "Main idea questions test whether you can summarize a passage in one sentence. Here's the fastest, most reliable approach.",
    datePublished: "2025-12-01",
    readingMinutes: 6,
    tag: "SAT Reading",
    sections: [
      {
        heading: "Summarize in Your Own Words First",
        body: [
          "After reading the passage, write one sentence summarizing the author's central claim. Then match your summary to the answer choice it most closely resembles.",
        ],
      },
      {
        heading: "Eliminate Too-Narrow and Too-Broad Choices",
        body: [
          "Wrong answers usually either restate one detail (too narrow) or generalize beyond the passage's scope (too broad). The correct answer captures the full argument and nothing more.",
        ],
      },
    ],
    relatedSlugs: ["sat-evidence-based-questions", "sat-inference-questions"],
  },
  {
    slug: "sat-transitions-guide",
    title: "SAT Transitions Questions: The Complete Guide",
    description:
      "Transitions questions test logical relationships between sentences. Here is a decision tree that solves almost every one.",
    datePublished: "2025-12-06",
    readingMinutes: 7,
    tag: "SAT Writing",
    sections: [
      {
        heading: "Identify the Relationship First",
        body: [
          "Read the sentence before and after the blank. Decide on the relationship — contrast, cause, example, continuation, conclusion — before looking at the choices.",
        ],
      },
      {
        heading: "Common Transition Categories",
        body: ["Each category has a set of expected transitions."],
        list: [
          "Contrast: however, in contrast, nevertheless, on the other hand",
          "Cause: therefore, consequently, thus, as a result",
          "Example: for example, for instance, specifically",
          "Continuation: moreover, furthermore, in addition",
          "Conclusion: in summary, ultimately, overall",
        ],
      },
    ],
    relatedSlugs: ["sat-rhetorical-synthesis", "sat-grammar-commas-semicolons-colons"],
  },
  {
    slug: "sat-rhetorical-synthesis",
    title: "SAT Rhetorical Synthesis: How to Solve These Fast",
    description:
      "Rhetorical Synthesis gives you a bulleted list of notes and asks which sentence best fulfills a rhetorical goal. Here is the method.",
    datePublished: "2025-12-11",
    readingMinutes: 7,
    tag: "SAT Writing",
    sections: [
      {
        heading: "The Goal Is Everything",
        body: [
          "Each rhetorical synthesis question names a specific goal — emphasize a similarity, introduce a topic, contrast two findings. Circle the goal, then match answer choices against it, not against the bullets generally.",
        ],
      },
      {
        heading: "Eliminate Partial Matches",
        body: [
          "A common trap: an answer that is factually supported by the bullets but doesn't match the goal. If the goal is 'emphasize a difference,' only pick a choice that actually contrasts.",
        ],
      },
    ],
    relatedSlugs: ["sat-transitions-guide", "sat-main-idea-questions"],
  },
  {
    slug: "sat-evidence-based-questions",
    title: "SAT Evidence-Based Questions Strategy",
    description:
      "Command of evidence questions ask which quotation best supports a claim. Here is the matching approach that consistently works.",
    datePublished: "2025-12-16",
    readingMinutes: 7,
    tag: "SAT Reading",
    sections: [
      {
        heading: "Pin Down the Claim First",
        body: [
          "Before you look at answer quotations, state the claim in your own words. The correct quotation is the one that directly supports your version of the claim — not one that just shares vocabulary.",
        ],
      },
      {
        heading: "Watch for Near-Miss Quotations",
        body: [
          "Wrong answers often quote sentences that are nearby the claim or share topic words but don't actually support the claim. The right answer must prove the claim, not just relate to it.",
        ],
      },
    ],
    relatedSlugs: ["sat-main-idea-questions", "sat-inference-questions"],
  },
  {
    slug: "sat-inference-questions",
    title: "SAT Inference Questions: A Reliable Method",
    description:
      "Inference questions ask what must be true based on a passage. Here's how to stay inside the boundaries of what the text actually supports.",
    datePublished: "2025-12-21",
    readingMinutes: 7,
    tag: "SAT Reading",
    sections: [
      {
        heading: "Stay on the Passage",
        body: [
          "The correct inference is always a small logical step from something stated in the passage. If the inference requires outside knowledge or a leap in logic, it's wrong.",
        ],
      },
      {
        heading: "Test Each Choice Against the Text",
        body: [
          "For each answer choice, find the sentence in the passage that proves it. If you can't find one in 15 seconds, that choice is almost certainly wrong.",
        ],
      },
    ],
    relatedSlugs: ["sat-evidence-based-questions", "sat-main-idea-questions"],
  },
  {
    slug: "sat-grammar-commas-semicolons-colons",
    title: "SAT Grammar: Commas, Semicolons, and Colons",
    description:
      "The punctuation rules tested on every Digital SAT, with the exact patterns College Board uses.",
    datePublished: "2025-12-28",
    readingMinutes: 8,
    tag: "SAT Writing",
    sections: [
      {
        heading: "The Core Rules",
        body: ["These three marks drive most SAT punctuation questions."],
        list: [
          "Comma + FANBOYS to join two independent clauses.",
          "Semicolon to join two independent clauses without a conjunction.",
          "Colon to introduce a list, definition, or elaboration after an independent clause.",
          "Em dash pairs to insert extra information mid-sentence.",
          "Single comma to set off introductory or non-essential elements.",
        ],
      },
      {
        heading: "The Independent Clause Test",
        body: [
          "Before picking any punctuation, check both sides of the mark. If both sides are complete sentences, you need a semicolon, period, or comma + FANBOYS. If only one side is complete, most punctuation marks won't fit.",
        ],
      },
    ],
    relatedSlugs: ["sat-punctuation-rules", "sat-subject-verb-agreement"],
  },
  {
    slug: "sat-subject-verb-agreement",
    title: "SAT Subject-Verb Agreement: Every Pattern Tested",
    description:
      "A guide to subject-verb agreement on the Digital SAT, including the distractors College Board uses most often.",
    datePublished: "2026-01-03",
    readingMinutes: 6,
    tag: "SAT Writing",
    sections: [
      {
        heading: "Find the Real Subject",
        body: [
          "Most SAT agreement traps work by inserting a prepositional phrase between the subject and verb. Cross out the intervening phrase and check whether the verb agrees with the actual subject.",
        ],
      },
      {
        heading: "Tricky Cases",
        body: ["These patterns catch strong students."],
        list: [
          "Collective nouns (team, jury) — singular in American English.",
          "Either/or and neither/nor — the verb agrees with the closer subject.",
          "There is / there are — the verb agrees with what follows.",
          "Each, every, everyone — always singular.",
        ],
      },
    ],
    relatedSlugs: ["sat-grammar-commas-semicolons-colons", "sat-punctuation-rules"],
  },
  {
    slug: "sat-punctuation-rules",
    title: "SAT Punctuation Rules: A Complete Summary",
    description:
      "Every punctuation rule tested on the Digital SAT, compressed into a single cheat sheet you can memorize in an afternoon.",
    datePublished: "2026-01-08",
    readingMinutes: 7,
    tag: "SAT Writing",
    sections: [
      {
        heading: "The Essential Marks",
        body: ["The SAT tests a small, repeatable set of punctuation patterns."],
        list: [
          "Period: ends an independent clause.",
          "Comma: separates elements, sets off non-essential information.",
          "Semicolon: joins two independent clauses, or separates list items with internal commas.",
          "Colon: introduces a list or elaboration after a complete sentence.",
          "Em dash: inserts extra information; always in pairs mid-sentence.",
          "Apostrophe: shows possession or contraction.",
        ],
      },
      {
        heading: "The Single Biggest Trap",
        body: [
          "Comma splices — two independent clauses joined by just a comma — are the most frequent wrong-answer pattern. When two complete sentences meet, you almost always need a semicolon, period, or comma + FANBOYS.",
        ],
      },
    ],
    relatedSlugs: ["sat-grammar-commas-semicolons-colons", "sat-subject-verb-agreement"],
  },
  {
    slug: "sat-reading-poetry-passages",
    title: "How to Read Poetry Passages on the Digital SAT",
    description:
      "Poetry passages are the most feared SAT Reading format. Here is a practical approach that treats them like regular prose.",
    datePublished: "2026-01-13",
    readingMinutes: 6,
    tag: "SAT Reading",
    sections: [
      {
        heading: "Paraphrase Line by Line",
        body: [
          "Read each line and restate it in plain language before moving on. Nearly every SAT poetry question is really asking you to paraphrase accurately — not to identify meter or devices.",
        ],
      },
      {
        heading: "Anchor to the Speaker",
        body: [
          "Always identify who the speaker is and what attitude they seem to have toward the subject. The correct answer almost always aligns with the speaker's attitude in the passage — not a generic interpretation.",
        ],
      },
    ],
    relatedSlugs: ["sat-main-idea-questions", "sat-inference-questions"],
  },
  {
    slug: "how-to-solve-sat-linear-equations",
    title: "How to Solve SAT Linear Equations (Every Pattern)",
    description:
      "Linear equations are the most common Digital SAT Math topic. Here's how to solve every pattern fast.",
    datePublished: "2026-01-18",
    readingMinutes: 8,
    tag: "SAT Math",
    sections: [
      {
        heading: "Slope-Intercept Is Your Default",
        body: [
          "When a problem gives you a linear relationship, write it as y = mx + b unless the problem forces a different form. This makes slope and intercept visible for every follow-up question.",
        ],
      },
      {
        heading: "The Most Common Question Types",
        body: [
          "SAT linear equation questions cluster around a few recognizable shapes.",
        ],
        list: [
          "Find the slope given two points.",
          "Find the y-intercept from a context.",
          "Determine whether two lines are parallel or perpendicular.",
          "Solve for the value of a constant that produces a specific slope.",
          "Interpret the meaning of m or b in a word problem.",
        ],
      },
    ],
    relatedSlugs: ["sat-systems-of-equations", "sat-inequalities-guide"],
  },
  {
    slug: "sat-systems-of-equations",
    title: "SAT Systems of Equations: The Complete Cheat Sheet",
    description:
      "Three techniques — substitution, elimination, and graphing with Desmos — cover every SAT system of equations question.",
    datePublished: "2026-01-23",
    readingMinutes: 8,
    tag: "SAT Math",
    sections: [
      {
        heading: "Pick the Right Method",
        body: [
          "Substitution works best when one equation is already solved for a variable. Elimination is fastest when coefficients line up. And Desmos graphing solves any system in under 30 seconds if you just need the intersection.",
        ],
      },
      {
        heading: "The 'No Solution' and 'Infinite Solutions' Trap",
        body: [
          "If two lines have the same slope and different y-intercepts, there are no solutions. If they have the same slope and same y-intercept, there are infinite solutions. SAT loves to test this exact distinction.",
        ],
      },
    ],
    relatedSlugs: ["how-to-solve-sat-linear-equations", "how-to-use-desmos-on-sat"],
  },
  {
    slug: "sat-quadratics-guide",
    title: "SAT Quadratics Guide: Every Formula and Trick",
    description:
      "Quadratics appear on nearly every Digital SAT Math module. Here's every formula, factoring trick, and Desmos shortcut you need.",
    datePublished: "2026-01-28",
    readingMinutes: 9,
    tag: "SAT Math",
    sections: [
      {
        heading: "The Three Forms of a Quadratic",
        body: ["Each form exposes different information about the parabola."],
        list: [
          "Standard: y = ax² + bx + c — y-intercept is visible.",
          "Vertex: y = a(x − h)² + k — vertex is (h, k).",
          "Factored: y = a(x − r₁)(x − r₂) — roots are r₁ and r₂.",
        ],
      },
      {
        heading: "Fastest Way to Find Roots",
        body: [
          "Graph the quadratic in Desmos. The x-intercepts are the roots. If Desmos isn't practical, factor first; if it doesn't factor cleanly, use the quadratic formula.",
        ],
      },
    ],
    relatedSlugs: ["sat-math-formulas", "how-to-use-desmos-on-sat"],
  },
  {
    slug: "sat-inequalities-guide",
    title: "SAT Inequalities Explained",
    description:
      "How to solve every type of SAT inequality question, including compound inequalities and systems with feasible regions.",
    datePublished: "2026-02-02",
    readingMinutes: 7,
    tag: "SAT Math",
    sections: [
      {
        heading: "Solve Like an Equation, Flip on Negatives",
        body: [
          "You can add, subtract, multiply, and divide inequalities just like equations — with one exception: flipping the sign when you multiply or divide by a negative number.",
        ],
      },
      {
        heading: "Systems of Inequalities",
        body: [
          "For 'which point is in the solution region' questions, graph both inequalities in Desmos and look for the overlap. The point you pick must be in the darkened region of both.",
        ],
      },
    ],
    relatedSlugs: ["sat-systems-of-equations", "how-to-use-desmos-on-sat"],
  },
  {
    slug: "sat-exponents-radicals",
    title: "SAT Exponents and Radicals: The Rules You Must Know",
    description:
      "A cheat sheet for Digital SAT exponent rules, radical simplification, and the fractional-exponent conversion that unlocks half these problems.",
    datePublished: "2026-02-07",
    readingMinutes: 7,
    tag: "SAT Math",
    sections: [
      {
        heading: "Core Exponent Rules",
        body: ["These show up on every Digital SAT."],
        list: [
          "a^m · a^n = a^(m+n)",
          "a^m / a^n = a^(m−n)",
          "(a^m)^n = a^(mn)",
          "a^0 = 1",
          "a^(−n) = 1/a^n",
          "a^(1/n) = n-th root of a",
        ],
      },
      {
        heading: "Radicals Are Just Fractional Exponents",
        body: [
          "√x = x^(1/2), ∛x = x^(1/3). Converting radicals to fractional exponents often makes a messy SAT problem collapse into a clean one.",
        ],
      },
    ],
    relatedSlugs: ["sat-quadratics-guide", "sat-math-formulas"],
  },
  {
    slug: "sat-percentages-guide",
    title: "SAT Percentages: The Fast Way",
    description:
      "Percent change, percent of, and reverse-percent questions on the Digital SAT — all solved with one consistent formula.",
    datePublished: "2026-02-12",
    readingMinutes: 6,
    tag: "SAT Math",
    sections: [
      {
        heading: "The One Formula You Need",
        body: [
          "Percent = (part / whole) × 100. Every SAT percent question can be rewritten to fit this, then rearranged algebraically.",
        ],
      },
      {
        heading: "Percent Change",
        body: [
          "Percent change = ((new − old) / old) × 100. Always divide by the original number, not the final one — mixing these up is the most common SAT percent mistake.",
        ],
      },
    ],
    relatedSlugs: ["sat-ratios-proportions", "sat-statistics-mean-median-mode"],
  },
  {
    slug: "sat-ratios-proportions",
    title: "SAT Ratios and Proportions: Complete Guide",
    description:
      "How to solve SAT ratio and proportion questions by setting up clean cross-multiplication and spotting unit conversions.",
    datePublished: "2026-02-17",
    readingMinutes: 6,
    tag: "SAT Math",
    sections: [
      {
        heading: "Set Up the Proportion",
        body: [
          "Write both ratios with units labeled above each number. Matching units have to stay on the same side. If they don't, you've set up the proportion backwards.",
        ],
      },
      {
        heading: "Unit Conversion Traps",
        body: [
          "SAT frequently mixes miles and kilometers, or minutes and hours, inside a single ratio problem. Always convert both sides to the same units before cross-multiplying.",
        ],
      },
    ],
    relatedSlugs: ["sat-percentages-guide", "sat-word-problems-framework"],
  },
  {
    slug: "sat-probability-questions",
    title: "SAT Probability Questions: Walkthrough and Examples",
    description:
      "A walkthrough of Digital SAT probability questions, including two-way tables, conditional probability, and the AND/OR rules.",
    datePublished: "2026-02-22",
    readingMinutes: 7,
    tag: "SAT Math",
    sections: [
      {
        heading: "The Basic Formula",
        body: [
          "Probability = favorable outcomes / total outcomes. Every SAT probability question eventually reduces to this fraction — your job is to correctly identify each number.",
        ],
      },
      {
        heading: "Two-Way Tables",
        body: [
          "Most Digital SAT probability problems come with a two-way table. Identify the row or column that contains your 'total outcomes,' then find the intersecting cell for 'favorable outcomes.'",
        ],
      },
      {
        heading: "AND vs OR",
        body: [
          "For independent events, AND means multiply probabilities, OR means add them (and subtract any overlap). SAT will explicitly hint at independence if you need it.",
        ],
      },
    ],
    relatedSlugs: ["sat-statistics-mean-median-mode", "sat-percentages-guide"],
  },
  {
    slug: "sat-statistics-mean-median-mode",
    title: "SAT Statistics: Mean, Median, and Mode Explained",
    description:
      "Mean, median, mode, range, and standard deviation on the Digital SAT — with the intuition that makes them click.",
    datePublished: "2026-02-27",
    readingMinutes: 7,
    tag: "SAT Math",
    sections: [
      {
        heading: "The Four You Must Know",
        body: [
          "Mean is the arithmetic average. Median is the middle value. Mode is the most common value. Range is max minus min. SAT tests these directly and through 'which of these changes if…' comparisons.",
        ],
      },
      {
        heading: "Standard Deviation (Conceptually)",
        body: [
          "You don't need to calculate standard deviation on the SAT. You just need to know that it measures spread — tighter data has lower standard deviation, and outliers raise it.",
        ],
      },
    ],
    relatedSlugs: ["sat-probability-questions", "sat-percentages-guide"],
  },
  {
    slug: "sat-geometry-overview",
    title: "SAT Geometry Overview: Every Topic Tested",
    description:
      "The Digital SAT tests geometry lightly but predictably. Here's the full topic list with what matters for each.",
    datePublished: "2026-03-04",
    readingMinutes: 8,
    tag: "SAT Math",
    sections: [
      {
        heading: "The Topic List",
        body: ["Everything geometry-adjacent that can appear on the Digital SAT."],
        list: [
          "Area and perimeter of triangles, rectangles, circles",
          "Volume of prisms, cylinders, cones, pyramids, spheres",
          "Pythagorean theorem and special right triangles",
          "Right-triangle trigonometry (SOH-CAH-TOA)",
          "Circles: radius, diameter, circumference, arc length, sector area",
          "Similar and congruent triangles",
          "Angle relationships with parallel lines",
        ],
      },
      {
        heading: "Reference Sheet Awareness",
        body: [
          "Most formulas you need are on the Bluebook reference sheet. Learn to find them fast rather than memorizing perfectly — then re-read to confirm you're using the right one.",
        ],
      },
    ],
    relatedSlugs: ["sat-right-triangles-trig", "sat-circles-guide"],
  },
  {
    slug: "sat-right-triangles-trig",
    title: "SAT Right Triangles and Trigonometry",
    description:
      "The right-triangle and trig patterns most often tested on the Digital SAT, with the special triangles and SOH-CAH-TOA cheat sheet.",
    datePublished: "2026-03-09",
    readingMinutes: 7,
    tag: "SAT Math",
    sections: [
      {
        heading: "Know the Special Triangles",
        body: [
          "30-60-90 triangles have sides in ratio 1 : √3 : 2. 45-45-90 triangles have sides in ratio 1 : 1 : √2. Recognizing these by sight saves 60+ seconds every time.",
        ],
      },
      {
        heading: "SOH-CAH-TOA in Practice",
        body: [
          "Label the sides relative to the angle: opposite, adjacent, hypotenuse. Then write sin, cos, or tan as the correct pair. Most SAT trig questions are one substitution away from done.",
        ],
      },
    ],
    relatedSlugs: ["sat-geometry-overview", "sat-math-formulas"],
  },
  {
    slug: "sat-circles-guide",
    title: "SAT Circles Guide: Every Formula and Trap",
    description:
      "How to solve every SAT circle question, from basic circumference to standard-form equations with a completing-the-square step.",
    datePublished: "2026-03-14",
    readingMinutes: 8,
    tag: "SAT Math",
    sections: [
      {
        heading: "The Circle Equation",
        body: [
          "The standard form of a circle is (x − h)² + (y − k)² = r², where (h, k) is the center and r is the radius.",
        ],
      },
      {
        heading: "Completing the Square",
        body: [
          "When the SAT gives you a circle equation in expanded form, you'll need to complete the square on both the x and y terms to rewrite it in standard form. Then the center and radius fall out.",
        ],
      },
      {
        heading: "Arcs and Sectors",
        body: [
          "Arc length = (θ/360) × 2πr for degrees, or θ × r for radians. Sector area = (θ/360) × πr² for degrees, or (θ/2) × r² for radians.",
        ],
      },
    ],
    relatedSlugs: ["sat-geometry-overview", "sat-math-formulas"],
  },
  {
    slug: "sat-word-problems-framework",
    title: "SAT Word Problems: A Framework That Actually Works",
    description:
      "A repeatable framework for SAT Math word problems: translate, set up, solve, check. Works on linear, quadratic, and ratio problems alike.",
    datePublished: "2026-03-19",
    readingMinutes: 7,
    tag: "SAT Math",
    sections: [
      {
        heading: "Step 1: Translate",
        body: [
          "Rewrite every clause of the word problem as a math relationship before touching any numbers. 'Twice as much as' means multiply by 2. 'x percent of y' means (x/100) × y. Don't skip this step.",
        ],
      },
      {
        heading: "Step 2: Identify the Question Asked",
        body: [
          "Underline what the problem is actually asking for. A common mistake is to solve for x when the question wants 2x + 5. Always re-read the last sentence before picking an answer.",
        ],
      },
    ],
    relatedSlugs: ["how-to-solve-sat-linear-equations", "sat-function-questions"],
  },
  {
    slug: "sat-function-questions",
    title: "How to Solve SAT Function Questions",
    description:
      "SAT function questions test notation, evaluation, and interpretation. Here's how to handle each type without overthinking.",
    datePublished: "2026-03-24",
    readingMinutes: 7,
    tag: "SAT Math",
    sections: [
      {
        heading: "Function Notation Is Just Substitution",
        body: [
          "f(x) = 2x + 3 and y = 2x + 3 are the same equation. To find f(5), replace every x with 5. Anyone telling you function notation is harder than that is overcomplicating it.",
        ],
      },
      {
        heading: "Nested and Composite Functions",
        body: [
          "For f(g(x)), evaluate g first, then plug that result into f. Work inside-out. If SAT gives you f(g(2)), find g(2), call it k, then find f(k).",
        ],
      },
    ],
    relatedSlugs: ["sat-word-problems-framework", "sat-quadratics-guide"],
  },
  {
    slug: "sat-math-formulas",
    title: "Every SAT Math Formula You Need to Memorize",
    description:
      "The complete list of Digital SAT math formulas to memorize — including what the reference sheet already covers and what it doesn't.",
    datePublished: "2026-03-28",
    readingMinutes: 9,
    tag: "SAT Math",
    sections: [
      {
        heading: "What's on the Reference Sheet",
        body: [
          "The Digital SAT gives you a reference sheet inside Bluebook with basic area, volume, and circle formulas. You don't need to memorize those — but you should know them well enough that you don't need to look them up under time pressure.",
        ],
        list: [
          "Area of a rectangle, triangle, circle",
          "Volume of a cube, rectangular prism, cylinder, sphere, cone, pyramid",
          "Pythagorean theorem",
          "30-60-90 and 45-45-90 triangle side ratios",
          "Circumference and arc/sector formulas in radians",
        ],
      },
      {
        heading: "What to Memorize (Not on the Sheet)",
        body: [
          "A set of formulas you must memorize because they aren't on the reference sheet but appear repeatedly.",
        ],
        list: [
          "Slope = (y₂ − y₁) / (x₂ − x₁)",
          "Distance = √((x₂ − x₁)² + (y₂ − y₁)²)",
          "Midpoint = ((x₁ + x₂)/2, (y₁ + y₂)/2)",
          "Quadratic formula",
          "Vertex form of a parabola: y = a(x − h)² + k",
          "Exponential growth/decay: y = a(1 + r)^t",
          "Simple interest and compound interest",
          "SOH-CAH-TOA for right-triangle trig",
        ],
      },
    ],
    relatedSlugs: ["how-to-get-a-1600", "how-to-use-desmos-on-sat"],
  },
  {
    slug: "how-to-use-desmos-on-sat",
    title: "How to Use Desmos on the Digital SAT",
    description:
      "A tactical guide to using the built-in Desmos graphing calculator on the Digital SAT Math section — the shortcuts that save the most time.",
    datePublished: "2026-04-01",
    readingMinutes: 8,
    tag: "SAT Math",
    sections: [
      {
        heading: "Why Desmos Changes Everything",
        body: [
          "The Digital SAT embeds the full Desmos graphing calculator inside Bluebook. That means any problem that can be reduced to solving an equation or finding intersection points becomes a plug-and-graph problem.",
        ],
      },
      {
        heading: "Five Moves Every 1500+ Student Knows",
        body: ["These are the Desmos moves that consistently save a minute or more per question."],
        list: [
          "Type any equation in y= form and read the x- and y-intercepts directly.",
          "Graph both sides of an equation separately; intersection x = solution.",
          "Use sliders to test 'for which value of k' questions in seconds.",
          "Use tables to evaluate complex expressions at many inputs at once.",
          "Graph systems of inequalities and eyeball the feasible region.",
        ],
      },
    ],
    relatedSlugs: ["sat-math-formulas", "how-to-get-a-1600"],
  },
  {
    slug: "how-to-get-a-1600",
    title: "How to Get a 1600 on the Digital SAT",
    description:
      "A realistic plan for scoring a perfect 1600 on the Digital SAT, based on what 1600-scorers actually do differently from 1500 scorers.",
    datePublished: "2026-04-04",
    readingMinutes: 12,
    tag: "SAT Strategy",
    sections: [
      {
        heading: "What a 1600 Actually Requires",
        body: [
          "A perfect 1600 on the Digital SAT typically requires missing zero or one question in each section, in the hard Module 2. The margin for error is close to nothing.",
          "The distance from 1500 to 1600 is not about learning new content — it is about eliminating careless errors and mastering the hardest question types.",
        ],
      },
      {
        heading: "A 60-Day Plan to Push Past 1550",
        body: [
          "Week 1–2: Take one timed practice test, identify every missed question type, and rank them by frequency.",
          "Week 3–6: Drill the top five missed skills in 30-minute blocks. Review every miss on the same day.",
          "Week 7–8: Full-length practice tests every weekend, review on Sunday. No new content — just refining.",
        ],
      },
    ],
    relatedSlugs: [
      "how-adaptive-sat-testing-works",
      "sat-math-formulas",
      "what-is-a-good-sat-score",
    ],
  },
  {
    slug: "ivy-league-sat-scores",
    title: "What SAT Score Do You Need for the Ivy League?",
    description:
      "The middle-50% SAT score ranges for every Ivy League school, plus how to think about the bar if you're aiming for admission.",
    datePublished: "2026-04-07",
    readingMinutes: 8,
    tag: "SAT Scoring",
    sections: [
      {
        heading: "The Middle 50% at Each Ivy",
        body: [
          "Middle-50% SAT ranges across the Ivies cluster between 1470 and 1570. That means 25% of admitted students score below the low number and 25% score above the high one.",
        ],
        list: [
          "Harvard: ~1500–1580",
          "Princeton: ~1500–1570",
          "Yale: ~1500–1580",
          "Columbia: ~1490–1570",
          "UPenn: ~1490–1560",
          "Brown: ~1490–1560",
          "Dartmouth: ~1470–1560",
          "Cornell: ~1460–1550",
        ],
      },
      {
        heading: "What the Numbers Actually Mean",
        body: [
          "Hitting a school's 75th percentile SAT score doesn't guarantee admission — holistic review matters more than any single number. But scoring above that line takes standardized testing off the board as a weakness.",
        ],
      },
      {
        heading: "What to Aim For",
        body: [
          "If an Ivy is on your list, aim for 1500+. If you're applying to more than one, aim for the 75th percentile of the highest-range school you're serious about.",
        ],
      },
    ],
    relatedSlugs: ["what-is-a-good-sat-score", "average-sat-scores-by-college"],
  },
  {
    slug: "average-sat-scores-by-college",
    title: "Average SAT Scores by College: How to Read the Ranges",
    description:
      "How to use middle-50% SAT ranges from the Common Data Set to set realistic targets for any college on your list.",
    datePublished: "2026-04-10",
    readingMinutes: 7,
    tag: "SAT Scoring",
    sections: [
      {
        heading: "Where to Find Real Numbers",
        body: [
          "Every college publishes its middle-50% SAT range in the Common Data Set or admissions statistics page. Those are authoritative — don't trust third-party rankings for SAT data.",
        ],
      },
      {
        heading: "Aim Above the 50th",
        body: [
          "If your score is below a school's 25th percentile, your SAT is a weakness in the application. If it's above the 75th, your SAT is a strength. Aim for the 75th percentile at every school on your list.",
        ],
      },
    ],
    relatedSlugs: ["ivy-league-sat-scores", "sat-superscore-explained"],
  },
  {
    slug: "how-to-send-sat-scores",
    title: "How to Send SAT Scores to Colleges",
    description:
      "Every option for sending your SAT scores to colleges, including free score sends, Score Choice, and how superscoring interacts with your submissions.",
    datePublished: "2026-04-12",
    readingMinutes: 6,
    tag: "SAT Scoring",
    sections: [
      {
        heading: "Free Score Sends",
        body: [
          "You get four free score sends within nine days of your test date. After that, each send costs a fee. If you know your college list, use the free sends.",
        ],
      },
      {
        heading: "Score Choice",
        body: [
          "Score Choice lets you pick which test dates to send. Some colleges require all scores, others accept your best — read each school's policy before sending.",
        ],
      },
      {
        heading: "The Right Move",
        body: [
          "If you plan to retake, consider skipping the free sends so you can send only your best result later. The retake fee is usually worth it.",
        ],
      },
    ],
    relatedSlugs: ["sat-superscore-explained", "how-many-times-should-you-take-the-sat"],
  },
  {
    slug: "sat-superscore-explained",
    title: "SAT Superscore Explained: How to Use It",
    description:
      "Most colleges superscore the SAT. Here is exactly what superscoring means, which schools do it, and how to plan retakes around it.",
    datePublished: "2026-04-14",
    readingMinutes: 6,
    tag: "SAT Scoring",
    sections: [
      {
        heading: "What Superscoring Is",
        body: [
          "Superscoring means a college combines your highest Math section score and your highest Reading & Writing section score across all test dates. A 1400 (780 R&W, 620 Math) plus a 1380 (640 R&W, 740 Math) superscores to 1520.",
        ],
      },
      {
        heading: "Planning Retakes",
        body: [
          "If your top schools superscore, focus each retake on your weaker section. You don't need a strong day in both — you just need to beat your prior high in at least one.",
        ],
      },
    ],
    relatedSlugs: ["how-to-send-sat-scores", "how-many-times-should-you-take-the-sat"],
  },
  {
    slug: "merit-scholarships-by-sat-score",
    title: "Merit Scholarships by SAT Score",
    description:
      "What SAT scores unlock merit aid at public and private universities, plus how to leverage a high score into tuition savings.",
    datePublished: "2026-04-16",
    readingMinutes: 8,
    tag: "SAT Scoring",
    sections: [
      {
        heading: "Public Universities Often Have Score Grids",
        body: [
          "Many state flagships publish transparent merit grids: a specific SAT score plus a specific GPA guarantees a named scholarship. Alabama, Arizona, and several others have done this historically. Check each school's scholarship page for current thresholds.",
        ],
      },
      {
        heading: "Private Universities Are Holistic",
        body: [
          "Private colleges rarely publish grids, but merit aid still correlates strongly with SAT scores above the middle 50%. Every 50 points above the median tends to increase your merit package meaningfully.",
        ],
      },
      {
        heading: "Leverage a Retake",
        body: [
          "For many students, one extra SAT retake pays for itself several times over in merit aid. If you're within 30–50 points of a named-scholarship cutoff, the math almost always favors retaking.",
        ],
      },
    ],
    relatedSlugs: ["average-sat-scores-by-college", "how-many-times-should-you-take-the-sat"],
  },
];

export const blogPostBySlug = new Map(blogPosts.map((post) => [post.slug, post]));
