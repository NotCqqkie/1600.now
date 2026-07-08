
interface LandingVariant {
  slug: string;
  keyword: string;
  h1: string;
  subhead: string;
  metaTitle: string;
  metaDescription: string;
  intro: string[];
  features: { title: string; body: string; href: string }[];
  faqs: { q: string; a: string }[];
}

const SHARED_FEATURES: LandingVariant["features"] = [
  {
    title: "Free SAT question bank",
    body: "Filter thousands of SAT questions by subject, skill, and difficulty, with explanations on every item.",
    href: "/bank",
  },
  {
    title: "Full-length practice modules",
    body: "Take realistic, adaptive-style modules with the same timing and structure as the real Bluebook exam.",
    href: "/modules",
  },
  {
    title: "SAT score calculator",
    body: "Convert raw scores into 1600-scale projections so every practice session ends with a clear number.",
    href: "/score-calculator",
  },
  {
    title: "Vocabulary and skill guides",
    body: "Work through 260+ high-frequency SAT words and targeted guides for every tested math and reading skill.",
    href: "/vocab",
  },
];

const makeVariant = (partial: Omit<LandingVariant, "features"> & { features?: LandingVariant["features"] }): LandingVariant => ({
  ...partial,
  features: partial.features ?? SHARED_FEATURES,
});

const landingVariants: LandingVariant[] = [
  makeVariant({
    slug: "free-sat-practice",
    keyword: "Free SAT Practice",
    h1: "Free SAT Practice Questions, Modules, and Tests",
    subhead: "Everything on 1600.now is free — question bank, modules, vocabulary, and score tools.",
    metaTitle: "Free SAT Practice | Questions, Modules, and Full Tests",
    metaDescription:
      "Free SAT practice questions, timed modules, and a score calculator. Filter by subject, skill, and difficulty. No signup required to start.",
    intro: [
      "1600.now is a 100% free Digital SAT prep platform. There is no paywall on the question bank, the practice modules, or any of the study tools.",
      "Start with the question bank to drill any skill you want, or jump into a timed module for realistic pacing practice.",
    ],
    faqs: [
      { q: "Is SAT practice on 1600.now really free?", a: "Yes. Every question, module, and tool on 1600.now is free. There is no paid tier and no locked content." },
      { q: "Do I need an account to practice?", a: "No. You can start practicing without signing up. Accounts are optional — they just sync your progress across devices." },
      { q: "How realistic is the free SAT practice?", a: "The question bank mirrors the style, difficulty, and subject mix of the Digital SAT, and the modules match Bluebook's pacing and format." },
      { q: "How much free SAT practice is enough?", a: "Most students benefit from 20–40 hours of targeted practice. Use the score calculator to track progress and aim for a consistent score at your target level." },
    ],
  }),
  makeVariant({
    slug: "free-sat-prep",
    keyword: "Free SAT Prep",
    h1: "Free SAT Prep for the Digital SAT",
    subhead: "A complete free SAT prep platform — no subscriptions, no locked content.",
    metaTitle: "Free SAT Prep | Full Digital SAT Prep Platform, No Signup",
    metaDescription:
      "Free SAT prep with a full question bank, practice modules, vocabulary hub, and a 1600-scale score calculator. Everything is free forever.",
    intro: [
      "Free SAT prep that actually covers everything you need: a thousand-plus question bank, adaptive-style modules, 260+ vocabulary words, and tools that convert practice scores to the real 1600 scale.",
      "No subscriptions, no trial paywall — every tool on the site stays free as you scale up your prep.",
    ],
    faqs: [
      { q: "Is 1600.now better than paid SAT prep?", a: "For most students, yes. The content on the free site covers the same topics as paid courses, and the question bank size rivals the largest commercial platforms." },
      { q: "Can I use this free SAT prep alongside Bluebook?", a: "Absolutely. Bluebook's six official practice tests are the gold standard. Use 1600.now for everything in between those tests." },
      { q: "How do I structure my free SAT prep?", a: "Start with a diagnostic, identify weakest skills, drill those with the question bank, then run timed modules to convert skill gains into score gains." },
      { q: "Is free SAT prep enough for 1500+ scores?", a: "Yes, if you're consistent. Most 1500+ scorers study with a mix of official College Board material and one good free platform — not with expensive courses." },
    ],
  }),
  makeVariant({
    slug: "digital-sat-prep",
    keyword: "Digital SAT Prep",
    h1: "Digital SAT Prep Built for Bluebook",
    subhead: "Modules, question banks, and tools that mirror the Digital SAT format.",
    metaTitle: "Digital SAT Prep | Bluebook-Style Modules & Question Bank",
    metaDescription:
      "Digital SAT prep that matches the real Bluebook exam: adaptive-style modules, timed practice, and a 1600-scale score calculator. Free to use.",
    intro: [
      "Digital SAT prep that matches how the real exam works. The modules on 1600.now replicate Bluebook's timing, question mix, and section structure so your practice transfers cleanly to test day.",
      "Pair our adaptive-style modules with official Bluebook practice tests for the most complete Digital SAT prep stack available.",
    ],
    faqs: [
      { q: "What makes Digital SAT prep different from old SAT prep?", a: "The Digital SAT is adaptive, shorter, and uses micro-passages instead of long reading passages. Old SAT prep material still teaches useful concepts but doesn't match the modern format." },
      { q: "Does this Digital SAT prep cover Desmos strategy?", a: "Yes. Our math explanations include Desmos-first approaches on every question where graphing is faster than algebra." },
      { q: "Can I take full-length Digital SAT practice here?", a: "Yes. The modules run with Bluebook-equivalent timing, and the score calculator combines modules into a projected 1600 total." },
      { q: "Is this Digital SAT prep suitable for beginners?", a: "Yes. Start with the SAT skills hub to build concept fluency, then transition into the question bank and modules." },
    ],
  }),
  makeVariant({
    slug: "online-sat-prep",
    keyword: "Online SAT Prep",
    h1: "Online SAT Prep That Works on Any Device",
    subhead: "Everything runs in your browser — no apps to install, no accounts required.",
    metaTitle: "Online SAT Prep | Browser-Based, No Install Required",
    metaDescription:
      "Online SAT prep that runs in any browser. Drill questions, take timed modules, study vocabulary, and estimate your 1600-scale score from any device.",
    intro: [
      "Online SAT prep with zero installation. The whole platform runs in your browser, on any laptop, tablet, or phone.",
      "Prep on a Chromebook at school, a tablet on the couch, or a phone on the bus — your progress syncs if you sign in, or stays local if you don't.",
    ],
    faqs: [
      { q: "Does this online SAT prep work on mobile?", a: "Yes. The full platform is mobile-friendly. Question drilling and vocabulary are especially convenient on phones." },
      { q: "Do I need fast internet for online SAT prep?", a: "No. The app is lightweight and works fine on slow connections once the initial page loads." },
      { q: "Is online SAT prep better than an in-person tutor?", a: "Depends on the student. Online prep gives you unlimited questions and flexible scheduling. Tutoring is better for students who need accountability or personalized explanations." },
      { q: "How much does this online SAT prep cost?", a: "Zero. Every feature on 1600.now is free." },
    ],
  }),
  makeVariant({
    slug: "sat-practice-test",
    keyword: "SAT Practice Test",
    h1: "SAT Practice Test: Full-Length and Skill-Focused",
    subhead: "Take a realistic timed SAT practice test and get a 1600-scale score estimate.",
    metaTitle: "SAT Practice Test | Full-Length Digital SAT Simulation",
    metaDescription:
      "Take a full-length SAT practice test with Digital SAT timing and a 1600-scale scoring estimate. Free, unlimited retakes, detailed explanations.",
    intro: [
      "A good SAT practice test does three things: simulates pacing, scores on the same 1600 scale as the real exam, and surfaces your weak spots in a review. 1600.now does all three.",
      "Take a full-length practice test, then review every missed question with on-page explanations and links to targeted skill drills.",
    ],
    faqs: [
      { q: "How long is an SAT practice test?", a: "A full-length Digital SAT is about 2 hours 14 minutes. Our modules match that timing." },
      { q: "Can I retake an SAT practice test?", a: "Yes. You can re-take any module as many times as you want." },
      { q: "Does the SAT practice test show a 1600 score?", a: "Yes. The score calculator converts your raw module totals into a projected 1600-scale score." },
      { q: "Is this SAT practice test as hard as the real SAT?", a: "The question difficulty mirrors the real SAT distribution. If you hit hard Module 2 in practice, your modules include those harder items too." },
    ],
  }),
  makeVariant({
    slug: "sat-practice-questions",
    keyword: "SAT Practice Questions",
    h1: "Thousands of Free SAT Practice Questions",
    subhead: "Filter by subject, skill, domain, and difficulty. Explanations on every question.",
    metaTitle: "SAT Practice Questions | Free Bank Filtered by Skill",
    metaDescription:
      "Thousands of free SAT practice questions with filters for subject, skill, and difficulty. Every question has an explanation. No signup required.",
    intro: [
      "The fastest way to improve your SAT score is to drill a large volume of SAT practice questions in the exact skills you miss. The 1600.now question bank is built for that — every question is tagged by subject, domain, and skill, so you can drill with surgical precision.",
      "Filter by difficulty, pick a skill, and run 20-question sets that target just your weak spots.",
    ],
    faqs: [
      { q: "How many SAT practice questions are in the bank?", a: "Thousands, covering every Digital SAT subject, domain, and skill." },
      { q: "Do the SAT practice questions have explanations?", a: "Yes. Every question has an explanation, and most include worked-out steps and Desmos strategies where applicable." },
      { q: "Can I filter SAT practice questions by skill?", a: "Yes. Filters include subject, skill, difficulty, and progress state (attempted, correct, missed)." },
      { q: "Are these real SAT practice questions?", a: "The bank includes SAT-style questions and clearly marked College Board official questions where available." },
    ],
  }),
  makeVariant({
    slug: "sat-question-bank-free",
    keyword: "SAT Question Bank",
    h1: "Free SAT Question Bank — Filtered, Tagged, and Searchable",
    subhead: "The largest free SAT question bank online, with full skill tagging and explanations.",
    metaTitle: "Free SAT Question Bank | Filter Thousands of Questions",
    metaDescription:
      "A free SAT question bank with thousands of filterable practice questions, full skill and difficulty tagging, and explanations on every item.",
    intro: [
      "Free SAT question banks are everywhere, but most are either tiny, untagged, or behind a signup wall. The 1600.now question bank is none of those things — it's free, fully tagged, and usable without an account.",
      "Search for exactly the skill you want to drill, or filter by difficulty to target your weakest areas.",
    ],
    faqs: [
      { q: "Is this SAT question bank really free?", a: "Yes. No paywall, no trial, no signup required." },
      { q: "Does the SAT question bank include official questions?", a: "Yes — official College Board questions are clearly labeled in the bank." },
      { q: "Can I save SAT questions for later review?", a: "Yes, once you create a free account. Otherwise, you can use browser bookmarks on any question page." },
      { q: "How often is the SAT question bank updated?", a: "The bank is updated regularly as new official and high-quality practice questions become available." },
    ],
  }),
  makeVariant({
    slug: "best-sat-prep",
    keyword: "Best SAT Prep",
    h1: "The Best Free SAT Prep Platform for the Digital SAT",
    subhead: "Built by students who scored 1500+ — designed for the way top scorers actually study.",
    metaTitle: "Best SAT Prep | The Top Free Digital SAT Platform",
    metaDescription:
      "The best SAT prep is free, adaptive, and matches the real Digital SAT. 1600.now gives you a full question bank, modules, and tools on one platform.",
    intro: [
      "The best SAT prep isn't the most expensive course — it's the material that matches the real test, gives you unlimited practice, and helps you review misses the right way.",
      "1600.now covers all three. Take a diagnostic, drill weak skills, run full-length modules, and track a 1600-scale projected score.",
    ],
    faqs: [
      { q: "What is the best SAT prep for most students?", a: "The best SAT prep for most students is Bluebook official practice + one strong free platform + consistent review. 1600.now is purpose-built to be the 'one strong free platform.'" },
      { q: "Is paid SAT prep better than free?", a: "Not usually. Paid courses mostly package the same content. The biggest score lever is your review process, not the price of your materials." },
      { q: "What's the best SAT prep for 1500+ students?", a: "Volume of official and official-style questions, a ruthless review process, and full-length timed practice. All free on 1600.now." },
      { q: "Is 1600.now the best SAT prep for beginners?", a: "Yes. Beginners benefit most from clear skill guides, slow explanations, and unlimited practice — all of which are free here." },
    ],
  }),
  makeVariant({
    slug: "sat-study-guide",
    keyword: "SAT Study Guide",
    h1: "The Complete SAT Study Guide for 2026",
    subhead: "A structured SAT study guide covering every tested skill, every strategy, every formula.",
    metaTitle: "SAT Study Guide | Complete 2026 Digital SAT Guide",
    metaDescription:
      "A full SAT study guide covering Math, Reading & Writing, vocabulary, pacing, and test-day strategy. Free, structured, updated for the Digital SAT.",
    intro: [
      "A complete SAT study guide walks you through every skill the test measures, every strategy that actually works, and every formula worth memorizing. This guide does all three.",
      "Start with the skills hub for structured lessons, use the blog for strategy deep-dives, and drill the question bank to convert theory into points.",
    ],
    faqs: [
      { q: "What's the best SAT study guide for the Digital SAT?", a: "A study guide written specifically for the Digital SAT format — adaptive modules, Desmos integration, and short passages. Old paper-SAT guides miss key format details." },
      { q: "How long should I follow an SAT study guide?", a: "Most students benefit from 30 to 90 days of structured study. Our 30-day and 90-day plans are linked from the blog." },
      { q: "Does the SAT study guide cover every tested skill?", a: "Yes. The skills hub covers all 23 tested skills across Math and Reading & Writing." },
    ],
  }),
  makeVariant({
    slug: "sat-math-practice",
    keyword: "SAT Math Practice",
    h1: "SAT Math Practice: Every Skill, Every Difficulty",
    subhead: "Drill SAT Math by skill — linear equations, quadratics, trig, circles, probability, and more.",
    metaTitle: "SAT Math Practice | Free Questions Filtered by Skill",
    metaDescription:
      "SAT Math practice filtered by skill, difficulty, and progress. Thousands of questions, full explanations, Desmos-aware strategies. Free.",
    intro: [
      "SAT Math practice works best when it's targeted. Instead of drilling random problems, find your weakest skill, drill that skill to mastery, and move on.",
      "Our question bank breaks every Digital SAT math skill into its own drill set, with difficulty filters and explanations on each item.",
    ],
    faqs: [
      { q: "What's the best way to practice SAT Math?", a: "Diagnose your weakest skill, drill 30–50 questions in that skill, review every miss, then test yourself with a timed module. Repeat weekly." },
      { q: "How hard is SAT Math practice on 1600.now?", a: "Difficulty spans easy through hard Module 2 level. Use the difficulty filter to target the level you're practicing for." },
      { q: "Does SAT Math practice here include Desmos strategies?", a: "Yes. Explanations include Desmos-first approaches for any problem where graphing is faster than algebra." },
    ],
  }),
  makeVariant({
    slug: "sat-reading-practice",
    keyword: "SAT Reading Practice",
    h1: "SAT Reading and Writing Practice",
    subhead: "Practice every Digital SAT Reading and Writing skill — from Words in Context to Rhetorical Synthesis.",
    metaTitle: "SAT Reading Practice | Words in Context, Synthesis & More",
    metaDescription:
      "SAT Reading and Writing practice questions covering Words in Context, main idea, evidence, inference, transitions, and rhetorical synthesis. Free.",
    intro: [
      "SAT Reading and Writing practice works best when you group questions by skill and drill one skill at a time. The short-passage format on the Digital SAT rewards pattern recognition.",
      "Our bank lets you filter by Digital SAT Reading & Writing domain — Information & Ideas, Craft & Structure, Expression of Ideas, Standard English Conventions — or by individual skill.",
    ],
    faqs: [
      { q: "How do I practice SAT Reading and Writing?", a: "Group questions by skill. Drill one skill per day, review every miss, and run timed modules weekly to convert skill wins into section score." },
      { q: "What's the hardest SAT Reading and Writing skill?", a: "For most students, Rhetorical Synthesis and Transitions are the hardest. Both are testable with focused practice." },
      { q: "Does SAT Reading practice here include vocabulary?", a: "Yes. The vocabulary hub covers 260+ high-frequency Digital SAT words with definitions and example sentences." },
    ],
  }),
  makeVariant({
    slug: "sat-writing-practice",
    keyword: "SAT Writing Practice",
    h1: "SAT Writing Practice for the Digital SAT",
    subhead: "Drill SAT punctuation, subject-verb agreement, transitions, and rhetorical synthesis.",
    metaTitle: "SAT Writing Practice | Grammar, Punctuation, Transitions",
    metaDescription:
      "SAT writing practice covering punctuation, subject-verb agreement, modifiers, transitions, and rhetorical synthesis. Free question bank and guides.",
    intro: [
      "SAT Writing practice on the Digital SAT means Standard English Conventions and Expression of Ideas — the grammar, punctuation, and rhetorical-synthesis questions inside the Reading & Writing section.",
      "We cover both categories with targeted question sets, full grammar guides, and explanations that teach the underlying rule.",
    ],
    faqs: [
      { q: "What does SAT writing practice cover on the Digital SAT?", a: "Punctuation, subject-verb agreement, modifier placement, pronoun agreement, transitions, and rhetorical synthesis." },
      { q: "Is there still an SAT essay?", a: "No. The Digital SAT does not include an essay. Only multiple-choice SAT writing questions are tested." },
      { q: "What's the best SAT writing practice strategy?", a: "Memorize the core punctuation rules, drill agreement and transitions separately, then run timed modules to work on pacing." },
    ],
  }),
];

export const landingVariantBySlug = new Map(landingVariants.map((variant) => [variant.slug, variant]));
