import { Link, useParams } from "react-router-dom";

import {
  PageSeo,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
} from "@/components/seo/PageSeo";
import {
  allSatScores,
  COLLEGE_BOARD_SAT_PERCENTILES_URL,
  getBalancedSectionSplit,
  getScoreProfile,
} from "@/lib/seo-data/satScoreData";
import {
  getSatScoreControlTitle,
  getSatScoreDocumentTitle,
} from "@/lib/seo/ctrTitleExperiment";
import NotFound from "@/pages/NotFound";

const SCORE_PAGE_PUBLISHED = "2026-04-01";

const SECTION_HEADING_CLASS = "text-2xl font-semibold tracking-tight";
const INLINE_LINK_CLASS = "underline";
const TOOL_LINK_CLASS =
  "inline-block rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-muted";
const FOOTER_LINK_CLASS = "text-sm underline";
const TABLE_HEAD_CELL_CLASS = "px-4 py-3 font-semibold";
const TABLE_ROW_CLASS = "border-t border-border";
const TABLE_BODY_CELL_CLASS = "px-4 py-3 text-muted-foreground";
const STAT_LABEL_CLASS = "text-xs uppercase tracking-wider text-muted-foreground";

const ACTION_TABLE_ROWS = [
  [
    "Math is lower than Reading and Writing by 40+ points",
    "Run two Math domain drills, then a timed Math module.",
  ],
  [
    "Reading and Writing is lower by 40+ points",
    "Split practice between Standard English Conventions and evidence/inference drills.",
  ],
  [
    "Both sections are balanced but below target",
    "Alternate full timed modules with narrow review sets from the bank.",
  ],
  [
    "Most misses are careless or from rushing",
    "Add a checkpoint plan and practice leaving two minutes for flagged questions.",
  ],
] as const;

const COLLEGE_SLUG_BY_EXAMPLE: Record<string, string> = {
  "Harvard University": "harvard-university",
  Caltech: "california-institute-of-technology",
  "Johns Hopkins": "johns-hopkins-university",
  "Boston University": "boston-university",
  "UT Austin": "the-university-of-texas-at-austin",
  "Georgia Tech": "georgia-institute-of-technology-main-campus",
  "Penn State": "pennsylvania-state-university-main-campus",
  "University of Arizona": "university-of-arizona",
  "University of Oregon": "university-of-oregon",
  "University of Kentucky": "university-of-kentucky",
};

const TOOL_LINKS = [
  { to: "/score-calculator", label: "Model section splits" },
  { to: "/what-sat-score-do-i-need", label: "Compare college targets" },
  { to: "/test-results", label: "Review saved test results" },
] as const;

const scoreActionPlan = (score: number) => {
  if (score >= 1550) {
    return {
      priority: "Protect the ceiling",
      focus: "At this range, content knowledge is rarely the blocker. The next points come from eliminating careless errors, checking hard Module 2 work, and staying calm on the last few questions.",
      drills: [
        "Redo every missed hard question twice: once immediately, once 48 hours later.",
        "Keep a careless-error log with the exact trigger: sign, unit, variable, graph read, or passage wording.",
        "Use timed hard-only sets instead of broad easy practice.",
      ],
    };
  }
  if (score >= 1450) {
    return {
      priority: "Convert strong into elite",
      focus: "You likely know the core content. The fastest gain is cleaning up the hardest version of each skill and reducing the number of questions you guess between two close choices.",
      drills: [
        "Run hard Math Module 2 drills for Advanced Math and data modeling.",
        "Run Reading and Writing drills for inference, command of evidence, boundaries, and transitions.",
        "After each module, sort misses into content gap, time pressure, and misread stem.",
      ],
    };
  }
  if (score >= 1300) {
    return {
      priority: "Push both sections into the hard-module range",
      focus: "This is the range where missed medium questions are expensive. Your job is to make the first module automatic enough that you reach the harder second module consistently.",
      drills: [
        "Drill the two weakest Math domains and two weakest Reading and Writing domains every week.",
        "Retake a timed module only after reviewing the last module's misses.",
        "Build accuracy on medium questions before chasing the hardest problems.",
      ],
    };
  }
  if (score >= 1150) {
    return {
      priority: "Remove easy and medium misses",
      focus: "The biggest score gain comes from fundamentals: linear equations, percentages, grammar boundaries, transitions, and evidence questions.",
      drills: [
        "Spend most practice time on easy and medium filtered bank questions.",
        "Review explanations until you can restate the tested rule in your own words.",
        "Take one timed module per week to check pacing without over-testing.",
      ],
    };
  }
  return {
    priority: "Build the base",
    focus: "Below 1150, a broad foundation beats advanced tactics. Focus on the common skills that appear every test and avoid burning time on rare hard problems.",
    drills: [
      "Start with linear equations, linear functions, percentages, punctuation boundaries, and transitions.",
      "Use untimed practice first, then add timing after accuracy improves.",
      "Keep modules short and review-heavy: one set, full review, then another set.",
    ],
  };
};

const SatScoreDetail = () => {
  const { score: scoreParam } = useParams();
  const score = Number(scoreParam);

  if (!Number.isFinite(score) || !allSatScores.includes(score)) {
    return <NotFound />;
  }

  const profile = getScoreProfile(score);
  const title = getSatScoreDocumentTitle(score);
  const articleTitle = getSatScoreControlTitle(score);
  const description = score === 1530
    ? "A 1530 SAT is the 99th percentile among recent SAT users. See valid 760/770 section splits, how to compare college ranges, and whether to retake."
    : `A ${score} Digital SAT score is in the ${profile.percentileLabel} percentile among recent SAT users. See valid section splits, college-range context, and next steps.`;
  const url = `https://1600.now/sat-score/${score}`;

  const { rw: rwTarget, math: mathTarget } = getBalancedSectionSplit(score);
  const actionPlan = scoreActionPlan(score);
  const targetColleges = profile.collegeExamples.slice(0, 3).join(", ");
  const scoreStats = [
    { label: "Score", value: score, className: "font-mono text-3xl" },
    { label: "SAT-user percentile", value: profile.percentileLabel, className: "font-mono text-3xl" },
    { label: "Tier", value: profile.tier, className: "text-lg font-semibold" },
  ] as const;

  const faqs = [
    {
      question: `What is the typical section split for a ${score}?`,
      answer: `One valid balanced ${score} split is ${rwTarget} in Reading & Writing and ${mathTarget} in Math. Other combinations work if each section is a 10-point score between 200 and 800 and the two sections add to ${score}.`,
    },
    {
      question: `What percentile is a ${score} SAT score?`,
      answer: `College Board's current SAT-user table places a ${score} in the ${profile.percentileLabel} percentile. SAT-user percentiles compare you with students who took the SAT in the most recent three graduating classes.`,
    },
    {
      question: `What colleges can I get into with a ${score} SAT?`,
      answer: `Use schools such as ${targetColleges} as starting points for checking current middle-50% score ranges. A ${score} alone cannot predict admission.`,
    },
    {
      question: `How do I raise a ${score} SAT score?`,
      answer: profile.studyFocus,
    },
    {
      question: `How many questions did I miss to get a ${score}?`,
      answer: `A ${score} does not map to one fixed missed-question count. Digital SAT scoring depends on question difficulty, adaptive routing, and equating, so use the detailed score report for the actual test instead of estimating misses from the total.`,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <PageSeo
        id={`sat-score-${score}`}
        title={title}
        description={description}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: "SAT Scores", url: "https://1600.now/sat-score" },
            { name: `${score}`, url },
          ]),
          buildFaqJsonLd(faqs),
          buildArticleJsonLd({
            title: articleTitle,
            description,
            url,
            datePublished: SCORE_PAGE_PUBLISHED,
          }),
        ]}
      />

      <nav className="mb-6 text-sm text-muted-foreground">
        <Link className="hover:underline" to="/">
          Home
        </Link>{" "}
        ›{" "}
        <Link className="hover:underline" to="/sat-score">
          SAT Scores
        </Link>{" "}
        › <span className="text-foreground">{score}</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          {score} SAT Score
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          A {score} on the Digital SAT is in the{" "}
          <strong>{profile.percentileLabel} percentile among recent SAT users</strong> — a{" "}
          <strong>{profile.tier.toLowerCase()}</strong> SAT score.{" "}
          {profile.tierDescription}
        </p>
        <p className="mt-3 text-sm">
          <Link to="/what-sat-score-do-i-need" className={INLINE_LINK_CLASS}>
            Compare this score with college target ranges →
          </Link>
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Percentile source:{" "}
          <a
            className={INLINE_LINK_CLASS}
            href={COLLEGE_BOARD_SAT_PERCENTILES_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            College Board SAT-user percentiles
          </a>
          .
        </p>
      </header>

      <section className="rounded-2xl border border-border p-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          {scoreStats.map((stat) => (
            <div key={stat.label}>
              <div className={STAT_LABEL_CLASS}>{stat.label}</div>
              <div className={stat.className}>{stat.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className={SECTION_HEADING_CLASS}>
          Section Breakdown for a {score}
        </h2>
        <p className="mt-3 text-muted-foreground">
          Section scores are reported in 10-point increments. One valid,
          balanced planning split for a {score} is:
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-6 text-muted-foreground">
          <li>
            Reading &amp; Writing: <strong>~{rwTarget}</strong>
          </li>
          <li>
            Math: <strong>~{mathTarget}</strong>
          </li>
        </ul>
        <p className="mt-3 text-muted-foreground">
          You can model different section splits using the free{" "}
          <Link className={INLINE_LINK_CLASS} to="/score-calculator">
            Digital SAT score calculator
          </Link>
          .
        </p>
      </section>

      <section className="mt-10">
        <h2 className={SECTION_HEADING_CLASS}>
          Colleges Where a {score} Is Competitive
        </h2>
        <p className="mt-3 text-muted-foreground">
          Start by comparing a {score} with the current published ranges for:
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-6 text-muted-foreground">
          {profile.collegeExamples.map((college) => {
            const collegeSlug = COLLEGE_SLUG_BY_EXAMPLE[college];
            return (
              <li key={college}>
                {collegeSlug ? (
                  <Link
                    className={INLINE_LINK_CLASS}
                    to={`/college/${collegeSlug}`}
                  >
                    {college}
                  </Link>
                ) : (
                  college
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          These are comparison starting points, not admission predictions.
          Testing policies and score ranges change, and colleges also consider
          grades, course rigor, essays, activities, and institutional priorities.
        </p>
      </section>

      <section className="mt-10">
        <h2 className={SECTION_HEADING_CLASS}>
          How to Raise a {score} SAT Score
        </h2>
        <p className="mt-3 text-muted-foreground">{profile.studyFocus}</p>
        <p className="mt-3 text-muted-foreground">
          Start by taking a full-length{" "}
          <Link className={INLINE_LINK_CLASS} to="/modules">
            Digital SAT practice module
          </Link>{" "}
          and logging which question types you miss. Then drill those exact
          skills in the{" "}
          <Link className={INLINE_LINK_CLASS} to="/bank">
            SAT question bank
          </Link>
          .
        </p>
      </section>

      <section className="mt-10">
        <h2 className={SECTION_HEADING_CLASS}>
          Score-specific action plan
        </h2>
        <p className="mt-3 text-muted-foreground">
          Priority: <strong>{actionPlan.priority}</strong>. {actionPlan.focus}
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-muted-foreground">
          {actionPlan.drills.map((drill) => (
            <li key={drill}>{drill}</li>
          ))}
        </ul>
        <div className="mt-5 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-muted/70">
              <tr>
                <th className={TABLE_HEAD_CELL_CLASS}>If your next report shows...</th>
                <th className={TABLE_HEAD_CELL_CLASS}>Do this before retesting</th>
              </tr>
            </thead>
            <tbody>
              {ACTION_TABLE_ROWS.map(([report, nextStep]) => (
                <tr key={report} className={TABLE_ROW_CLASS}>
                  <td className={TABLE_BODY_CELL_CLASS}>{report}</td>
                  <td className={TABLE_BODY_CELL_CLASS}>{nextStep}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className={SECTION_HEADING_CLASS}>
          Frequently Asked Questions
        </h2>
        <div className="mt-4 space-y-5">
          {faqs.map((faq) => (
            <div key={faq.question}>
              <h3 className="text-base font-semibold">{faq.question}</h3>
              <p className="mt-1 text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className={SECTION_HEADING_CLASS}>
          Use this score in the real tools
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {TOOL_LINKS.map((link) => (
            <li key={link.to}>
              <Link to={link.to} className={TOOL_LINK_CLASS}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 flex items-center justify-between rounded-xl border border-border p-4">
        {score > 400 ? (
          <Link className={FOOTER_LINK_CLASS} to={`/sat-score/${score - 10}`}>
            ← {score - 10} SAT score
          </Link>
        ) : (
          <span />
        )}
        <Link className={FOOTER_LINK_CLASS} to="/modules">
          Take a module
        </Link>
        {score < 1600 ? (
          <Link className={FOOTER_LINK_CLASS} to={`/sat-score/${score + 10}`}>
            {score + 10} SAT score →
          </Link>
        ) : (
          <span />
        )}
      </section>
    </div>
  );
};

export default SatScoreDetail;
