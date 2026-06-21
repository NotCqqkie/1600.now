import type { ReactNode } from "react";
import { Link, useLocation, Navigate } from "react-router-dom";

import {
  PageSeo,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
} from "@/components/seo/PageSeo";
import { scoreGoalBySlug } from "@/lib/seo-data/scoreGoalData";
import { getScoreProfile } from "@/lib/seo-data/satScoreData";

const SCORE_GOAL_PUBLISHED = "2026-04-01";
const SECTION_HEADING_CLASS = "text-2xl font-semibold tracking-tight";
const INLINE_LINK_CLASS = "underline";
const CTA_LIST_CLASS = "mt-3 flex flex-wrap gap-2";
const CTA_LINK_CLASS = "inline-block rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted";
const TABLE_HEAD_CELL_CLASS = "px-4 py-3 font-semibold";
const TABLE_ROW_CLASS = "border-t border-border";
const TABLE_BODY_CELL_CLASS = "px-4 py-3 text-muted-foreground";

const WEEKLY_PLAN_ROWS = [
  [
    "Section split",
    "Whether Math or Reading and Writing is limiting the total.",
    "Drill the weaker section before another full module.",
  ],
  [
    "Miss pattern",
    "Which skills repeat across practice sets.",
    "Create a narrow bank set for the repeated skill.",
  ],
  [
    "Timed-module score",
    "Whether drills are transferring under real pacing.",
    "Keep the plan if timing improves; narrow it if misses repeat.",
  ],
] as const;

interface NumericGoalContent {
  sectionSplit: { rw: number; math: number };
  percentile: number;
  tier: string;
  tierDescription: string;
  missBudget: number;
  collegeExamples: string[];
  studyFocus: string;
}

const numericContent = (score: number): NumericGoalContent => {
  const profile = getScoreProfile(score);
  const rw = Math.round(score / 2);
  return {
    sectionSplit: { rw, math: score - rw },
    percentile: profile.percentile,
    tier: profile.tier,
    tierDescription: profile.tierDescription,
    missBudget: Math.round((1600 - score) / 15),
    collegeExamples: profile.collegeExamples,
    studyFocus: profile.studyFocus,
  };
};

type Faq = { question: string; answer: string };
type CtaLinkItem = { to: string; label: string };

const CtaLinkList = ({ links }: { links: readonly CtaLinkItem[] }) => (
  <ul className={CTA_LIST_CLASS}>
    {links.map(({ to, label }) => (
      <li key={`${to}:${label}`}>
        <Link to={to} className={CTA_LINK_CLASS}>
          {label}
        </Link>
      </li>
    ))}
  </ul>
);

const ScoreGoalPage = () => {
  const location = useLocation();
  const slug = location.pathname.replace(/^\//, "").replace(/\/$/, "");
  const page = scoreGoalBySlug.get(slug);

  if (!page) return <Navigate to="/" replace />;

  const url = `https://1600.now/${page.slug}`;

  let faqs: Faq[];
  let body: ReactNode;

  if (typeof page.target === "number") {
    const content = numericContent(page.target);
    const score = page.target;
    faqs = [
      {
        question: `Is a ${score} SAT achievable?`,
        answer: `Yes. A ${score} places you in the ${content.percentile}th percentile — reachable with 8–16 weeks of focused prep for most students who start within 150 points of the target.`,
      },
      {
        question: `How many questions can I miss and still get a ${score}?`,
        answer: `You can miss roughly ${content.missBudget} questions across the whole Digital SAT and still land at a ${score}, though exact counts vary because of the adaptive Module 2.`,
      },
      {
        question: `What is the section split for a ${score}?`,
        answer: `A balanced ${score} usually means about ${content.sectionSplit.rw} in Reading & Writing and ${content.sectionSplit.math} in Math. Uneven splits are fine — lean 30–40 points into your stronger section.`,
      },
      {
        question: `What colleges accept a ${score} SAT?`,
        answer: `A ${score} is competitive at ${content.collegeExamples.slice(0, 3).join(", ")} and dozens of other schools with similar admissions profiles.`,
      },
    ];

    body = (
      <>
        <section>
          <h2 className={SECTION_HEADING_CLASS}>
            What a {score} means
          </h2>
          <p className="mt-3 text-muted-foreground">
            A {score} on the Digital SAT is a {content.tier.toLowerCase()} score —{" "}
            {content.tierDescription} At the {content.percentile}th percentile, you are
            scoring higher than about {content.percentile}% of all SAT test takers.
          </p>
        </section>

        <section className="mt-10">
          <h2 className={SECTION_HEADING_CLASS}>
            Section split for a {score}
          </h2>
          <p className="mt-3 text-muted-foreground">
            A balanced {score} typically comes from about {content.sectionSplit.rw}{" "}
            in Reading & Writing and {content.sectionSplit.math} in Math. The Digital
            SAT weighs both sections equally, so a lopsided split (for example{" "}
            {content.sectionSplit.rw + 30} RW and {content.sectionSplit.math - 30} Math) is
            completely fine — aim for whichever section feels stronger.
          </p>
        </section>

        <section className="mt-10">
          <h2 className={SECTION_HEADING_CLASS}>
            How many questions you can afford to miss
          </h2>
          <p className="mt-3 text-muted-foreground">
            To land at {score}, you need to miss no more than roughly{" "}
            {content.missBudget} questions across the entire test. Keep in mind the
            test is adaptive: missing early questions in Module 1 can route you
            to the easier Module 2, which caps your ceiling well below 800 for
            that section.
          </p>
        </section>

        <section className="mt-10">
          <h2 className={SECTION_HEADING_CLASS}>
            What to focus on
          </h2>
          <p className="mt-3 text-muted-foreground">{content.studyFocus}</p>
        </section>

        <section className="mt-10">
          <h2 className={SECTION_HEADING_CLASS}>
            An 8-week study plan to reach {score}
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              Week 1: Take a full-length diagnostic in Bluebook to find your
              baseline. Note which skills you missed most.
            </li>
            <li>
              Weeks 2–3: Drill weak skills in the{" "}
              <Link className={INLINE_LINK_CLASS} to="/bank">
                question bank
              </Link>{" "}
              — 40 questions per day, reviewed thoroughly.
            </li>
            <li>
              Weeks 4–5: Alternate timed modules with targeted drills. Every
              miss should be reviewed with a written explanation.
            </li>
            <li>
              Weeks 6–7: Full-length{" "}
              <Link className={INLINE_LINK_CLASS} to="/modules">
                practice modules
              </Link>{" "}
              twice a week, plus focused review of every wrong answer.
            </li>
            <li>
              Week 8: Two full-length practice tests. Focus on pacing and
              avoiding careless errors, not new content.
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className={SECTION_HEADING_CLASS}>
            Colleges where {score} is competitive
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-muted-foreground">
            {content.collegeExamples.map((col) => (
              <li key={col}>{col}</li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className={SECTION_HEADING_CLASS}>
            Turn this target into practice
          </h2>
          <CtaLinkList
            links={[
              { to: "/score-calculator", label: "Model your current score" },
              { to: "/modules", label: "Take a timed module" },
              { to: "/bank", label: "Drill weak skills" },
            ]}
          />
        </section>
      </>
    );
  } else if (page.target === "perfect") {
    faqs = [
      {
        question: "How rare is a 1600 SAT score?",
        answer:
          "Fewer than 1 in 500 Digital SAT test takers score a 1600, placing it at the 99th+ percentile. In absolute terms, a few thousand students per year hit a perfect score.",
      },
      {
        question: "Can you get a 1600 while missing questions?",
        answer:
          "No. A 1600 requires scoring 800 in both sections, which typically means missing zero questions in the hard Module 2. The Digital SAT's adaptive scoring does not allow any miss in the hardest path.",
      },
      {
        question: "How long does it take to prep for a 1600?",
        answer:
          "Most 1600 scorers start within 100 points of the target and spend 3–6 months eliminating careless errors, not learning new content.",
      },
      {
        question: "Does College Board round up to 1600?",
        answer:
          "No. The 1600 scaled score requires a genuine top performance in both sections. There is no rounding bonus at the ceiling.",
      },
    ];

    body = (
      <>
        <section>
          <h2 className={SECTION_HEADING_CLASS}>
            What a 1600 actually requires
          </h2>
          <p className="mt-3 text-muted-foreground">
            A perfect 1600 requires scoring 800 in both Reading & Writing and
            Math. Because the Digital SAT is adaptive, both sections route to
            the harder Module 2, where the score cap is 800 — but only with
            near-perfect accuracy across both modules.
          </p>
          <p className="mt-3 text-muted-foreground">
            In practice, 1600 scorers typically miss zero questions on Module 1
            and at most one on Module 2 in each section, though forgiving test
            forms occasionally allow one miss per module.
          </p>
        </section>

        <section className="mt-10">
          <h2 className={SECTION_HEADING_CLASS}>
            How rare is a 1600?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Fewer than 1 in 500 Digital SAT takers score a 1600. Out of roughly
            2 million annual SAT takers, only a few thousand achieve the
            perfect score each year.
          </p>
        </section>

        <section className="mt-10">
          <h2 className={SECTION_HEADING_CLASS}>
            What 1600 scorers do differently
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              They prioritize eliminating careless errors over learning harder
              content. Most have already mastered every skill.
            </li>
            <li>
              They use the Desmos graphing calculator to verify algebra
              answers. Practice calculator-friendly questions in the{" "}
              <Link className={INLINE_LINK_CLASS} to="/bank/math/browse">
                SAT Math bank
              </Link>
              .
            </li>
            <li>
              They take full-length{" "}
              <Link className={INLINE_LINK_CLASS} to="/modules">
                practice modules
              </Link>{" "}
              weekly and review every wrong answer with a written explanation.
            </li>
            <li>
              They pace themselves to finish each module with 2–3 minutes left
              to review flagged questions.
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className={SECTION_HEADING_CLASS}>
            Colleges that expect a near-perfect SAT
          </h2>
          <p className="mt-3 text-muted-foreground">
            A 1600 is at the 75th percentile at Harvard, MIT, Caltech, and
            Stanford — meaning it is competitive, not guaranteed admission.
            Most top-20 schools expect a 1500+.
          </p>
        </section>
      </>
    );
  } else if (page.target === "good") {
    faqs = [
      {
        question: "What is considered a good SAT score?",
        answer:
          "A score above the national average (currently ~1050) is statistically good. But \"good for college\" depends on where you apply — 1200+ for most state universities, 1400+ for selective private schools, 1500+ for top-20 schools.",
      },
      {
        question: "Is 1200 a good SAT score?",
        answer:
          "1200 places you around the 74th percentile and is above average. It is competitive at many mid-tier state universities and regional private schools.",
      },
      {
        question: "Is 1400 a good SAT score?",
        answer:
          "Yes. 1400 is the 94th percentile and is competitive at a wide range of selective universities, including UT Austin, UNC, NYU, and many top liberal arts colleges.",
      },
      {
        question: "Is 1500 a good SAT score?",
        answer:
          "Very good. 1500 places you at the 98th percentile and is competitive at nearly every US university short of the Ivy League and its peers, where it sits around the 25th–50th percentile of admitted students.",
      },
    ];

    body = (
      <>
        <section>
          <h2 className={SECTION_HEADING_CLASS}>
            The honest answer
          </h2>
          <p className="mt-3 text-muted-foreground">
            A good SAT score is the score that gets you admitted. That depends
            entirely on where you want to apply. A 1200 is a fine score for
            many schools; at an Ivy it would land in the bottom 25% of
            admitted students.
          </p>
        </section>

        <section className="mt-10">
          <h2 className={SECTION_HEADING_CLASS}>
            By tier of college
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              <strong>Ivy League and peers:</strong> 1500+ is competitive;
              1550+ is the 50th percentile of admits.
            </li>
            <li>
              <strong>Top-30 private schools</strong> (Duke, Northwestern,
              Vanderbilt, etc.): 1450+ is competitive.
            </li>
            <li>
              <strong>Top state flagships</strong> (UVA, UNC, UT Austin, UCLA):
              1350+ is competitive for out-of-state; 1250+ in-state.
            </li>
            <li>
              <strong>Mid-tier state universities</strong> (Penn State, Ohio
              State, etc.): 1150+ is competitive.
            </li>
            <li>
              <strong>Open-admission and regional colleges:</strong> any score
              above 900 is accepted.
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className={SECTION_HEADING_CLASS}>
            National benchmarks
          </h2>
          <p className="mt-3 text-muted-foreground">
            The current Digital SAT national average is approximately 1050. A
            score at the 75th percentile (~1200) is above average; the 90th
            percentile is ~1340; the 99th percentile is ~1520.
          </p>
        </section>

        <section className="mt-10">
          <h2 className={SECTION_HEADING_CLASS}>
            Put your percentile target into practice
          </h2>
          <CtaLinkList
            links={[
              { to: "/score-calculator", label: "Model a target score" },
              { to: "/what-sat-score-do-i-need", label: "Compare college ranges" },
              { to: "/modules", label: "Take a timed module" },
            ]}
          />
        </section>
      </>
    );
  } else {
    faqs = [
      {
        question: "What is the current average SAT score?",
        answer:
          "The current national average Digital SAT score is approximately 1050, split roughly 530 in Reading & Writing and 520 in Math.",
      },
      {
        question: "Is the average SAT score good enough for college?",
        answer:
          "For open-admission and many regional universities, yes. For selective private schools and top state flagships, the average is well below their admitted-student profile.",
      },
      {
        question: "Does the average SAT score change year to year?",
        answer:
          "It fluctuates within a narrow range. The Digital SAT average has hovered around 1050 since the transition from the paper test.",
      },
      {
        question: "How much above average do I need to be competitive?",
        answer:
          "For top-50 schools, aim 200+ points above the national average (1250+). For top-20, aim 400+ points above (1450+).",
      },
    ];

    body = (
      <>
        <section>
          <h2 className={SECTION_HEADING_CLASS}>
            The current average
          </h2>
          <p className="mt-3 text-muted-foreground">
            The national average Digital SAT score is approximately 1050. This
            breaks down to roughly 530 in Reading & Writing and 520 in Math,
            though recent administrations have shown Math averaging slightly
            higher than RW.
          </p>
        </section>

        <section className="mt-10">
          <h2 className={SECTION_HEADING_CLASS}>
            Who takes the SAT
          </h2>
          <p className="mt-3 text-muted-foreground">
            The SAT is taken by roughly 2 million US high school students each
            year. The population includes both students targeting selective
            universities and students at open-admission schools, which pulls
            the average lower than people familiar only with competitive-prep
            communities expect.
          </p>
        </section>

        <section className="mt-10">
          <h2 className={SECTION_HEADING_CLASS}>
            Setting a realistic target
          </h2>
          <p className="mt-3 text-muted-foreground">
            Use the average as a floor, not a ceiling. Most selective
            universities expect scores well above 1050. A productive starting
            goal is 200 points above your baseline, which is reachable with
            8–12 weeks of focused prep.
          </p>
        </section>

        <section className="mt-10">
          <h2 className={SECTION_HEADING_CLASS}>
            Set a realistic score target
          </h2>
          <CtaLinkList
            links={[
              { to: "/score-calculator", label: "Estimate your current score" },
              { to: "/what-sat-score-do-i-need", label: "Find college target ranges" },
              { to: "/bank", label: "Start targeted practice" },
            ]}
          />
        </section>
      </>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-6 py-10">
      <PageSeo
        id={`score-goal-${page.slug}`}
        title={page.metaTitle}
        description={page.metaDescription}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: page.headline, url },
          ]),
          buildArticleJsonLd({
            title: page.headline,
            description: page.metaDescription,
            url,
            datePublished: SCORE_GOAL_PUBLISHED,
          }),
          buildFaqJsonLd(faqs),
        ]}
      />

      <nav className="mb-6 text-sm text-muted-foreground">
        <Link className="hover:underline" to="/">
          Home
        </Link>{" "}
        › <span className="text-foreground">{page.headline}</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          {page.headline}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{page.intro}</p>
      </header>

      {body}

      <section className="mt-12">
        <h2 className={SECTION_HEADING_CLASS}>
          How to turn this score target into a weekly plan
        </h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-muted/70">
              <tr>
                <th className={TABLE_HEAD_CELL_CLASS}>Weekly check</th>
                <th className={TABLE_HEAD_CELL_CLASS}>What it tells you</th>
                <th className={TABLE_HEAD_CELL_CLASS}>Next move</th>
              </tr>
            </thead>
            <tbody>
              {WEEKLY_PLAN_ROWS.map(([check, signal, nextMove]) => (
                <tr key={check} className={TABLE_ROW_CLASS}>
                  <td className={TABLE_BODY_CELL_CLASS}>{check}</td>
                  <td className={TABLE_BODY_CELL_CLASS}>{signal}</td>
                  <td className={TABLE_BODY_CELL_CLASS}>{nextMove}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12">
        <h2 className={SECTION_HEADING_CLASS}>FAQs</h2>
        <div className="mt-4 space-y-5">
          {faqs.map((faq) => (
            <div key={faq.question}>
              <h3 className="text-base font-semibold">{faq.question}</h3>
              <p className="mt-1 text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold">Start practicing now</h3>
        <p className="mt-2 text-muted-foreground">
          Run a timed{" "}
          <Link className={INLINE_LINK_CLASS} to="/modules">
            Digital SAT module
          </Link>
          , drill targeted skills in the{" "}
          <Link className={INLINE_LINK_CLASS} to="/bank">
            question bank
          </Link>
          , or estimate your current score with the{" "}
          <Link className={INLINE_LINK_CLASS} to="/score-calculator">
            SAT score calculator
          </Link>
          .
        </p>
      </section>
    </article>
  );
};

export default ScoreGoalPage;
