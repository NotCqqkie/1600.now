import {
  COLLEGE_BOARD_SAT_DATES_URL,
  OFFICIAL_SAT_DATES,
  SAT_FACTS_VERIFIED_ON,
} from "@/lib/seo-data/satOfficialData";

interface SatFaqPage {
  slug: string;
  question: string;
  shortAnswer: string;
  metaTitle: string;
  metaDescription: string;
  sections: { heading: string; body: string[]; list?: string[] }[];
  relatedSlugs?: string[];
}

export const satFaqPages: SatFaqPage[] = [
  {
    slug: "how-long-is-the-sat",
    question: "How long is the SAT?",
    shortAnswer:
      "The Digital SAT is 2 hours and 14 minutes of testing time, plus a single 10-minute break — about 2 hours 24 minutes total from start to finish.",
    metaTitle: "How Long Is the SAT? Total Time With Breaks Explained",
    metaDescription:
      "The Digital SAT runs 2 hours 14 minutes of testing, with a 10-minute break. Total time at the test center is closer to 3 hours with check-in.",
    sections: [
      {
        heading: "Testing time breakdown",
        body: ["The Digital SAT is divided into four modules, two per section."],
        list: [
          "English Module 1 — 32 minutes",
          "English Module 2 — 32 minutes",
          "10-minute break",
          "Math Module 1 — 35 minutes",
          "Math Module 2 — 35 minutes",
        ],
      },
      {
        heading: "How long you'll actually be at the test center",
        body: [
          "Plan for roughly 3 hours at the test center once you add check-in, seating, and the end-of-test processing. Most students arrive by 7:45 AM and leave around 11:30 AM.",
        ],
      },
    ],
    relatedSlugs: ["how-many-questions-are-on-the-sat", "how-is-the-sat-scored"],
  },
  {
    slug: "can-you-bring-a-calculator-to-the-sat",
    question: "Can you bring a calculator to the SAT?",
    shortAnswer:
      "Yes. The Digital SAT includes a built-in Desmos graphing calculator you can use on every math question, and you can also bring an approved physical calculator as a backup.",
    metaTitle: "Can You Bring a Calculator to the SAT? Full Rules Explained",
    metaDescription:
      "You can bring an approved calculator to the SAT, but Bluebook also includes a built-in Desmos graphing calculator available on every math question.",
    sections: [
      {
        heading: "The built-in Desmos calculator",
        body: [
          "The Digital SAT includes a full Desmos graphing calculator inside Bluebook. It is available on every math question, and it is genuinely powerful — most 1500+ students rely on Desmos to speed through algebra and graphing questions.",
        ],
      },
      {
        heading: "Approved physical calculators",
        body: [
          "You can also bring your own calculator as backup. Approved calculators include most graphing calculators (TI-84, TI-Nspire non-CAS, Casio fx-9860) and four-function or scientific calculators.",
        ],
      },
      {
        heading: "Not allowed",
        body: [
          "Calculators with CAS (TI-89, TI-Nspire CAS), laptop-based calculators, phone calculators, or anything with wireless capability are prohibited.",
        ],
      },
    ],
    relatedSlugs: ["how-long-is-the-sat", "how-many-questions-are-on-the-sat"],
  },
  {
    slug: "how-many-questions-are-on-the-sat",
    question: "How many questions are on the SAT?",
    shortAnswer:
      "The Digital SAT has 98 questions total — 54 Reading & Writing questions (27 per module) and 44 Math questions (22 per module).",
    metaTitle: "How Many Questions Are on the SAT? Full Breakdown",
    metaDescription:
      "The Digital SAT has 98 total questions: 54 Reading & Writing and 44 Math, split evenly across two modules per section.",
    sections: [
      {
        heading: "Question count by section",
        body: ["Each section splits into two modules of equal size."],
        list: [
          "English Module 1 — 27 questions",
          "English Module 2 — 27 questions",
          "Math Module 1 — 22 questions",
          "Math Module 2 — 22 questions",
          "Total — 98 questions",
        ],
      },
      {
        heading: "Does every question count?",
        body: [
          "No. Each module includes pretest (experimental) questions that don't count toward your score. You can't tell which ones they are, so treat every question as scored.",
        ],
      },
    ],
    relatedSlugs: ["how-long-is-the-sat", "how-is-the-sat-scored"],
  },
  {
    slug: "what-is-a-perfect-sat-score",
    question: "What is a perfect SAT score?",
    shortAnswer:
      "A perfect SAT score is 1600 — the maximum possible. That is 800 on Reading & Writing plus 800 on Math.",
    metaTitle: "What Is a Perfect SAT Score? 1600 Explained",
    metaDescription:
      "A perfect SAT score is 1600. Here's how rare it is, how it's calculated, and what it takes to score 800 in each section.",
    sections: [
      {
        heading: "How rare is a 1600?",
        body: [
          "Fewer than 1% of test takers earn a perfect 1600. It usually requires missing zero or one question in each section while reaching the hard Module 2.",
        ],
      },
      {
        heading: "Can you miss questions and still get 1600?",
        body: [
          "Sometimes. The exact raw-to-scaled conversion varies by test form. Some forms allow one miss per section and still award 800; others do not.",
        ],
      },
    ],
    relatedSlugs: ["how-is-the-sat-scored", "is-the-sat-curved"],
  },
  {
    slug: "is-the-sat-curved",
    question: "Is the SAT curved?",
    shortAnswer:
      "The SAT is not curved against other test takers. It is equated — your raw score is converted using a scale specific to your test form to account for difficulty differences across dates.",
    metaTitle: "Is the SAT Curved? Equating vs Curving Explained",
    metaDescription:
      "The SAT is not curved. Scores are equated — a statistical process that adjusts for difficulty differences so a 1450 means the same thing across test dates.",
    sections: [
      {
        heading: "Curving vs equating",
        body: [
          "A curve grades you relative to the people who took the test the same day. Equating adjusts your raw score based on the difficulty of the specific test form you took.",
          "Equating means that if your form was slightly harder than average, your raw-to-scaled conversion is a little more generous — and vice versa.",
        ],
      },
      {
        heading: "What this means for you",
        body: [
          "You are not competing against the other students in your room. You are competing against a fixed ability standard. This is why SAT scores are comparable across test dates, years, and schools.",
        ],
      },
    ],
    relatedSlugs: ["how-is-the-sat-scored", "what-is-a-perfect-sat-score"],
  },
  {
    slug: "does-the-sat-penalize-guessing",
    question: "Does the SAT penalize guessing?",
    shortAnswer:
      "No. There is no guessing penalty on the Digital SAT — you should answer every question, even if you have to guess.",
    metaTitle: "Does the SAT Penalize Guessing? Why You Should Always Answer",
    metaDescription:
      "The SAT does not penalize guessing. You should answer every question, even when you're unsure, because blank answers are automatically wrong.",
    sections: [
      {
        heading: "The rule",
        body: [
          "Every question is scored the same: correct gives you one raw point, wrong or blank gives you zero. Leaving a question blank is mathematically equivalent to getting it wrong.",
        ],
      },
      {
        heading: "Guessing strategy",
        body: [
          "If you run out of time, fill in a single letter across all remaining questions — statistically you will pick up about 25% of them.",
          "If you have time to eliminate even one wrong answer, your expected value from guessing goes up significantly.",
        ],
      },
    ],
    relatedSlugs: ["how-is-the-sat-scored", "sat-pacing-strategy"],
  },
  {
    slug: "psat-vs-sat",
    question: "PSAT vs SAT: What's the difference?",
    shortAnswer:
      "The PSAT is a shorter, slightly easier practice version of the SAT used for the National Merit Scholarship. It uses the same digital format but tops out at 1520, not 1600.",
    metaTitle: "PSAT vs SAT | All the Differences Explained",
    metaDescription:
      "The PSAT is the shorter, lower-stakes practice SAT used for National Merit. It uses the same digital format but has a 1520 ceiling instead of 1600.",
    sections: [
      {
        heading: "Format overlap",
        body: [
          "Both tests are now digital, adaptive, and delivered through Bluebook. They test the same skills in the same question types.",
        ],
      },
      {
        heading: "Key differences",
        body: ["The PSAT is a shorter, less-high-stakes version of the SAT."],
        list: [
          "PSAT max score: 1520. SAT max score: 1600.",
          "PSAT testing time: ~2 hours 14 minutes. SAT: same.",
          "PSAT is used for National Merit; SAT is used for college admissions.",
          "PSAT is typically taken in 10th or 11th grade; SAT is most often taken in 11th and 12th grade.",
        ],
      },
    ],
    relatedSlugs: ["how-is-the-sat-scored", "when-should-you-take-the-sat"],
  },
  {
    slug: "is-the-sat-essay-required",
    question: "Is the SAT essay still required?",
    shortAnswer:
      "No. The SAT essay was discontinued in 2021 and is no longer part of the SAT. The Digital SAT has no essay component at all.",
    metaTitle: "Is the SAT Essay Still Required? Status and History",
    metaDescription:
      "The SAT essay was discontinued in 2021 and is not part of the Digital SAT. No college requires an SAT essay score as of 2026.",
    sections: [
      {
        heading: "Current status",
        body: [
          "The SAT essay is gone. The Digital SAT has exactly two sections — Reading & Writing and Math — and no essay.",
        ],
      },
      {
        heading: "Why it was removed",
        body: [
          "College Board retired the essay in 2021. Colleges had stopped requiring it, and research showed it didn't add meaningful information beyond the writing portions of the rest of the test.",
        ],
      },
    ],
    relatedSlugs: ["how-the-digital-sat-works", "how-is-the-sat-scored"],
  },
  {
    slug: "how-is-the-sat-scored",
    question: "How is the SAT scored?",
    shortAnswer:
      "Each SAT section is scored on a 200–800 scale. Your raw score (number of correct answers) is converted into a scaled score via equating, and the two section scores add to your 1600 total.",
    metaTitle: "How Is the SAT Scored? Raw, Scaled, and Total Explained",
    metaDescription:
      "Digital SAT scoring converts your raw correct-answer count into a 200–800 scaled score per section, with the total between 400 and 1600.",
    sections: [
      {
        heading: "From raw to scaled",
        body: [
          "Your raw score is the number of questions you answered correctly. That raw number gets converted to a scaled section score from 200 to 800 using a conversion table specific to your test form.",
        ],
      },
      {
        heading: "Adaptive scoring",
        body: [
          "Because the Digital SAT is section-adaptive, the Module 2 you reach determines your ceiling. Students who reach the hard Module 2 can access the full 800; students who stay in the easier Module 2 have a lower ceiling.",
        ],
      },
    ],
    relatedSlugs: ["what-is-a-perfect-sat-score", "is-the-sat-curved"],
  },
  {
    slug: "what-is-a-sat-percentile",
    question: "What is an SAT percentile?",
    shortAnswer:
      "An SAT percentile tells you what percent of test takers scored at or below your score. A 90th percentile score means you did better than 90% of test takers.",
    metaTitle: "What Is an SAT Percentile? How Your Score Ranks",
    metaDescription:
      "An SAT percentile shows the percentage of test takers you outperformed. Learn how percentiles work and what each score range means.",
    sections: [
      {
        heading: "How percentiles work",
        body: [
          "Percentiles are ranks, not scores. A 1400 at the 94th percentile means 94% of test takers scored at or below 1400. The percentile is relative to the SAT-taking population, not all students.",
        ],
      },
      {
        heading: "Common score percentiles",
        body: ["Approximate percentiles at common SAT scores."],
        list: [
          "1600: 99th+",
          "1500: 98th",
          "1400: 94th",
          "1300: 86th",
          "1200: 74th",
          "1100: 58th (near national average)",
          "1000: 40th",
        ],
      },
    ],
    relatedSlugs: ["how-is-the-sat-scored", "what-is-a-perfect-sat-score"],
  },
  {
    slug: "when-are-the-sat-test-dates-2026",
    question: "When are the SAT test dates in 2026?",
    shortAnswer:
      "The remaining 2026 weekend SAT dates are August 22, September 12, October 3, November 7, and December 5. College Board has also confirmed March 6, May 1, and June 5 for spring 2027.",
    metaTitle: "SAT Test Dates 2026–2027: Official Dates & Deadlines",
    metaDescription:
      "Confirmed SAT dates and registration deadlines from August 2026 through June 2027, including the September 12 SAT administration.",
    sections: [
      {
        heading: "Confirmed dates and registration deadlines",
        body: [
          `College Board's schedule applies to US and international weekend test takers. It was verified on ${SAT_FACTS_VERIFIED_ON} at ${COLLEGE_BOARD_SAT_DATES_URL}.`,
        ],
        list: OFFICIAL_SAT_DATES.map(
          (testDate) => `${testDate.label} — register by ${testDate.registrationDeadline}; late changes and registration close ${testDate.lateDeadline}`,
        ),
      },
      {
        heading: "Choosing a date",
        body: [
          "Most students take their first SAT in spring of junior year and retake in the fall of senior year. For Early Action or Early Decision applications, your last retake should be the August or October test.",
        ],
      },
    ],
    relatedSlugs: ["when-should-you-take-the-sat", "how-to-cancel-sat-registration"],
  },
  {
    slug: "how-to-cancel-sat-registration",
    question: "How do you cancel an SAT registration?",
    shortAnswer:
      "You can cancel your SAT registration through your College Board account up to a few days before the test. Partial refunds are available if you cancel by the registration deadline.",
    metaTitle: "How to Cancel SAT Registration: Deadlines & Refunds",
    metaDescription:
      "Cancel your SAT registration through your College Board account. Partial refunds are available before the registration deadline for each test date.",
    sections: [
      {
        heading: "How to cancel",
        body: [
          "Log into your College Board account, find your upcoming SAT registration, and select 'Cancel Registration.' College Board will confirm the cancellation and, if eligible, issue a partial refund.",
        ],
      },
      {
        heading: "Refund rules",
        body: [
          "Full or partial refunds are available if you cancel by the registration deadline. After that, you forfeit the registration fee but can still cancel to free up your seat.",
        ],
      },
    ],
    relatedSlugs: ["when-are-the-sat-test-dates-2026", "sat-fee-waiver-eligibility"],
  },
  {
    slug: "is-sat-required-for-college-2026",
    question: "Is the SAT required for college in 2026?",
    shortAnswer:
      "It depends on the school. Many US colleges are still test-optional in 2026, but a growing number of selective schools (including MIT, Harvard, and Yale) have reinstated the SAT requirement.",
    metaTitle: "Is the SAT Required for College in 2026? Full Policy Guide",
    metaDescription:
      "Some 2026 colleges require the SAT, others are test-optional. See which top schools now require the SAT and how to decide if you should submit scores.",
    sections: [
      {
        heading: "Schools that require the SAT",
        body: [
          "As of 2026, several top schools have reinstated SAT requirements, including MIT, Harvard, Yale, Dartmouth, Brown, Caltech, Georgetown, and Florida's public universities. Check each school's admissions page for the current policy.",
        ],
      },
      {
        heading: "Test-optional schools",
        body: [
          "Many colleges remain test-optional, which means you can submit SAT scores but aren't required to. If your score is at or above the school's middle-50% range, submitting helps; below, you can choose not to submit.",
        ],
      },
    ],
    relatedSlugs: ["ivy-league-sat-scores", "average-sat-scores-by-college"],
  },
  {
    slug: "sat-fee-waiver-eligibility",
    question: "Who is eligible for an SAT fee waiver?",
    shortAnswer:
      "SAT fee waivers are available to US low-income 11th and 12th graders. They cover two free SAT registrations, unlimited free score sends, and college application fee waivers.",
    metaTitle: "SAT Fee Waiver Eligibility | Full 2026 Guide",
    metaDescription:
      "SAT fee waivers cover two free SAT registrations, unlimited score sends, and college application fee waivers. Here's how to qualify and apply.",
    sections: [
      {
        heading: "Who qualifies",
        body: [
          "SAT fee waivers are granted to US 11th and 12th graders who meet income or program-based eligibility — for example, being enrolled in the National School Lunch Program, living in a household that receives SNAP, or being in foster care.",
        ],
      },
      {
        heading: "How to apply",
        body: [
          "Ask your school counselor. They can issue fee waivers directly through College Board. There is no separate application form for students — counselors confirm eligibility on your behalf.",
        ],
      },
    ],
    relatedSlugs: ["when-are-the-sat-test-dates-2026", "how-to-cancel-sat-registration"],
  },
  {
    slug: "how-long-are-sat-scores-valid",
    question: "How long are SAT scores valid?",
    shortAnswer:
      "SAT scores are valid for five years after the test date. After that, College Board no longer actively reports them unless you specifically request archived scores.",
    metaTitle: "How Long Are SAT Scores Valid? Reporting Window Explained",
    metaDescription:
      "SAT scores are valid for five years. After that, colleges may not accept them, and College Board reports them as archived rather than active.",
    sections: [
      {
        heading: "The five-year rule",
        body: [
          "College Board actively reports SAT scores to colleges for five years. After five years, scores become archived — they still exist, but you have to specifically request them to be released.",
        ],
      },
      {
        heading: "Do colleges accept older scores?",
        body: [
          "Most colleges only accept SAT scores from the past five years. If you took the SAT before that window, plan to retake.",
        ],
      },
    ],
    relatedSlugs: ["when-are-the-sat-test-dates-2026", "how-to-send-sat-scores"],
  },
  {
    slug: "can-you-use-scratch-paper-on-the-digital-sat",
    question: "Can you use scratch paper on the Digital SAT?",
    shortAnswer:
      "Yes. Test centers provide scratch paper for the Digital SAT. You cannot bring your own, but you can request additional sheets if you run out.",
    metaTitle: "Can You Use Scratch Paper on the Digital SAT? Official Rule",
    metaDescription:
      "The Digital SAT allows scratch paper provided by the test center. You can't bring your own, but test-center staff will provide extra sheets on request.",
    sections: [
      {
        heading: "The official rule",
        body: [
          "Test centers provide scratch paper for every student taking the Digital SAT. You can use it for any section — Reading & Writing or Math — and test-center staff will supply more if you ask.",
        ],
      },
      {
        heading: "What you can't do",
        body: [
          "You cannot bring your own scratch paper. All scratch paper is collected at the end of the test and destroyed.",
        ],
      },
      {
        heading: "How to use the provided paper efficiently",
        body: [
          "Write the module and question number beside each calculation so you can return to flagged work quickly. For Math, reserve one area for equations and another for Desmos checks; for Reading and Writing, use brief elimination notes rather than copying passage text.",
        ],
        list: [
          "Ask the proctor for more paper before you run out.",
          "Keep question numbers visible beside every calculation.",
          "Do not spend time making scratch work neat after you have the answer.",
        ],
      },
    ],
    relatedSlugs: ["can-you-bring-a-calculator-to-the-sat", "how-long-is-the-sat"],
  },
  {
    slug: "what-happens-if-you-run-out-of-time-on-sat",
    question: "What happens if you run out of time on the SAT?",
    shortAnswer:
      "If you run out of time, unanswered questions are marked wrong — there's no partial credit and no guessing penalty, so always fill in an answer for every question.",
    metaTitle: "What Happens If You Run Out of Time on the SAT?",
    metaDescription:
      "If you run out of time on the SAT, blank answers are scored as wrong. Since there's no guessing penalty, always fill in something for every question.",
    sections: [
      {
        heading: "The consequence",
        body: [
          "Any question you don't answer is scored as wrong. There is no partial credit. There is also no penalty for guessing, which is why leaving anything blank is strictly worse than picking an answer at random.",
        ],
      },
      {
        heading: "Last-minute strategy",
        body: [
          "If you're seconds from the end of a module, pick a letter and fill it in for every remaining question. That alone typically adds a few raw points compared to leaving them blank.",
        ],
      },
    ],
    relatedSlugs: ["does-the-sat-penalize-guessing", "sat-pacing-strategy"],
  },
  {
    slug: "sat-vs-psat-difficulty",
    question: "Is the SAT harder than the PSAT?",
    shortAnswer:
      "Yes, the SAT is slightly harder than the PSAT. Both test the same skills, but the SAT has harder Module 2 content and a 1600 ceiling versus the PSAT's 1520.",
    metaTitle: "Is the SAT Harder Than the PSAT? Honest Comparison",
    metaDescription:
      "The SAT is slightly harder than the PSAT. Both cover the same skills, but the SAT has a higher ceiling and more difficult Module 2 questions.",
    sections: [
      {
        heading: "Same skills, different ceilings",
        body: [
          "The PSAT and SAT test the same skills in the same format. The SAT just extends the difficulty range higher — the hardest SAT questions are harder than the hardest PSAT questions.",
        ],
      },
      {
        heading: "What your PSAT score predicts",
        body: [
          "A PSAT score is a reasonable predictor of your SAT score if you continue prepping at the same pace. Most students add 30–80 points on the SAT compared to their PSAT thanks to extra practice and content exposure.",
        ],
      },
    ],
    relatedSlugs: ["psat-vs-sat", "how-is-the-sat-scored"],
  },
];

export const satFaqPageBySlug = new Map(satFaqPages.map((page) => [page.slug, page]));
