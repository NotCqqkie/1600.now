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

const landingVariants: LandingVariant[] = [
  {
    slug: "free-sat-prep",
    keyword: "Free SAT Prep",
    h1: "Free SAT Prep for the Digital SAT",
    subhead: "A complete prep path with no subscription, trial, or locked lessons.",
    metaTitle: "Free SAT Prep | Digital SAT Questions, Modules & Guides",
    metaDescription:
      "Free Digital SAT prep with a question bank, timed modules, skill guides, vocabulary, and a 1600-scale score calculator. No signup required.",
    intro: [
      "Use 1600.now as the practice layer between official Bluebook tests: diagnose a weak skill, drill it in the bank, and verify the gain in a timed module.",
      "The full workflow is free. Start without an account, then create one only if you want progress to sync across devices.",
    ],
    features: [
      {
        title: "Start with a diagnostic module",
        body: "Use a timed module to find the section and skills that are costing the most points.",
        href: "/modules",
      },
      {
        title: "Drill the exact miss pattern",
        body: "Filter the question bank by section, domain, skill, difficulty, and progress state.",
        href: "/bank",
      },
      {
        title: "Learn one skill at a time",
        body: "Open a focused guide for every Digital SAT Math and Reading and Writing skill.",
        href: "/sat-skill",
      },
      {
        title: "Track the score target",
        body: "Estimate a 1600-scale score and connect the result to a concrete improvement guide.",
        href: "/sat-score",
      },
    ],
    faqs: [
      { q: "Is 1600.now SAT prep really free?", a: "Yes. The question bank, timed modules, skill guides, vocabulary tools, and score calculator are free to use." },
      { q: "Can I use this alongside Bluebook?", a: "Yes. Use official Bluebook tests for full-test benchmarks and 1600.now for targeted practice between those tests." },
      { q: "Do I need an account to start?", a: "No. You can practice without signing up. An account is only needed to sync progress across devices." },
      { q: "How should I structure my prep?", a: "Take a diagnostic, identify repeated misses, drill one weak skill at a time, and use timed modules to verify that the improvement transfers." },
    ],
  },
  {
    slug: "sat-math-practice",
    keyword: "SAT Math Practice",
    h1: "SAT Math Practice by Skill and Difficulty",
    subhead: "Target Algebra, Advanced Math, Data Analysis, and Geometry with explanations and Desmos-aware strategies.",
    metaTitle: "SAT Math Practice | Free Questions Filtered by Skill",
    metaDescription:
      "Free SAT Math practice filtered by skill and difficulty, with worked explanations and Desmos-aware strategies for every tested domain.",
    intro: [
      "SAT Math improves fastest when practice is narrow enough to expose a repeatable error. Choose one official skill, drill it until the miss pattern is clear, then check the gain in a timed module.",
      "The bank covers all four Digital SAT Math domains and lets you separate foundational questions from hard Module 2 work.",
    ],
    features: [
      {
        title: "Browse every Math skill",
        body: "Learn the rules and shortcuts behind each official Digital SAT Math skill.",
        href: "/sat-skill",
      },
      {
        title: "Filter Math questions",
        body: "Choose a domain or skill, then narrow the set by source and progress state.",
        href: "/bank/math/browse",
      },
      {
        title: "Practice hard Math",
        body: "Work through a curated set of difficult Math questions with detailed explanations.",
        href: "/hard",
      },
      {
        title: "Use the Math reference sheet",
        body: "Review formulas, when to use them, and the relationships the SAT expects you to recognize.",
        href: "/sat-math-formula-sheet",
      },
    ],
    faqs: [
      { q: "What is the best way to practice SAT Math?", a: "Diagnose the weakest skill, drill that skill, review every miss, and then use a timed module to check whether the fix transfers under pressure." },
      { q: "Which Math domains are covered?", a: "Algebra, Advanced Math, Problem-Solving and Data Analysis, and Geometry and Trigonometry are all covered." },
      { q: "Does the practice include Desmos strategies?", a: "Yes. Explanations use Desmos-first approaches when graphing is faster or clearer than a purely algebraic solution." },
      { q: "Should I practice only hard questions?", a: "No. Protect easy and medium points first, then add hard Module 2 questions once routine accuracy is stable." },
    ],
  },
  {
    slug: "sat-reading-practice",
    keyword: "SAT Reading and Writing Practice",
    h1: "SAT Reading and Writing Practice by Skill",
    subhead: "Drill evidence, inference, vocabulary, grammar, transitions, and rhetorical synthesis in the Digital SAT format.",
    metaTitle: "SAT Reading Practice | Free Reading & Writing Questions",
    metaDescription:
      "Free Digital SAT Reading and Writing practice by skill, including evidence, inference, vocabulary, grammar, transitions, and rhetorical synthesis.",
    intro: [
      "Digital SAT Reading and Writing uses short passages, so improvement depends on recognizing the exact job of each question. Group practice by skill instead of treating the section as one broad reading test.",
      "Use the bank to isolate a repeated miss, open the matching guide for the rule or proof standard, then return to a mixed timed module.",
    ],
    features: [
      {
        title: "Browse every Reading and Writing skill",
        body: "Review the tested rule, the proof standard, and the common traps for each skill.",
        href: "/sat-skill",
      },
      {
        title: "Filter Reading and Writing questions",
        body: "Practice one domain or official skill at a time, with explanations on each item.",
        href: "/bank/reading/browse",
      },
      {
        title: "Build vocabulary in context",
        body: "Study academic words with definitions and examples, then apply them to Words in Context questions.",
        href: "/vocab",
      },
      {
        title: "Review grammar rules",
        body: "Use the grammar cheat sheet for boundaries, agreement, modifiers, and sentence structure.",
        href: "/sat-grammar-rules-cheat-sheet",
      },
    ],
    faqs: [
      { q: "How should I practice SAT Reading and Writing?", a: "Group questions by skill, review the exact evidence or grammar rule behind every miss, and use timed mixed modules to check transfer." },
      { q: "Which skills are covered?", a: "The practice covers Information and Ideas, Craft and Structure, Expression of Ideas, and Standard English Conventions." },
      { q: "Is grammar still tested on the Digital SAT?", a: "Yes. Grammar appears in Standard English Conventions questions, including punctuation, agreement, verb form, and sentence structure." },
      { q: "Is there still an SAT essay?", a: "No. The standard Digital SAT does not include an essay; Reading and Writing questions are multiple choice." },
    ],
  },
];

export const landingVariantBySlug = new Map(landingVariants.map((variant) => [variant.slug, variant]));
