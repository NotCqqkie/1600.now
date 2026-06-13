import { Link, useParams } from "react-router-dom";

import {
  PageSeo,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
} from "@/components/seo/PageSeo";
import { allSatScores, getScoreProfile } from "@/lib/seo-data/satScoreData";

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
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-3xl font-semibold">Score not found</h1>
        <p className="mt-3 text-muted-foreground">
          Estimate your score with the{" "}
          <Link className="underline" to="/score-calculator">
            SAT score calculator
          </Link>
          .
        </p>
      </div>
    );
  }

  const profile = getScoreProfile(score);
  const title = `${score} SAT Score — Percentile, Section Breakdown & Colleges`;
  const description = `A ${score} Digital SAT score breakdown: ${profile.percentile}th percentile, typical Math/Reading section split, target colleges, and a study plan to raise it.`;
  const url = `https://1600.now/sat-score/${score}`;

  const rwTarget = Math.round(score / 2);
  const mathTarget = score - rwTarget;
  const actionPlan = scoreActionPlan(score);

  const faqs = [
    {
      question: `What is the typical section split for a ${score}?`,
      answer: `A balanced ${score} usually comes from roughly ${rwTarget} in Reading & Writing and ${mathTarget} in Math, but you can lean 20–40 points either direction and still land at ${score}.`,
    },
    {
      question: `What percentile is a ${score} SAT score?`,
      answer: `A ${score} on the Digital SAT is roughly the ${profile.percentile}th percentile nationally, meaning you scored higher than about ${profile.percentile}% of test takers.`,
    },
    {
      question: `What colleges can I get into with a ${score} SAT?`,
      answer: `A ${score} is competitive at schools such as ${profile.collegeExamples.slice(0, 3).join(", ")}. Many more schools are reachable depending on your GPA and application.`,
    },
    {
      question: `How do I raise a ${score} SAT score?`,
      answer: profile.studyFocus,
    },
    {
      question: `How many questions did I miss to get a ${score}?`,
      answer: `A ${score} typically corresponds to roughly ${Math.round((1600 - score) / 15)} missed questions across the Digital SAT, but the adaptive module routing means exact counts vary.`,
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
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: title,
            description,
            url,
            author: { "@type": "Organization", name: "1600.now" },
            publisher: { "@type": "Organization", name: "1600.now" },
          },
        ]}
      />

      <nav className="mb-6 text-sm text-muted-foreground">
        <Link className="hover:underline" to="/">
          Home
        </Link>{" "}
        ›{" "}
        <Link className="hover:underline" to="/score-calculator">
          SAT Score Calculator
        </Link>{" "}
        › <span className="text-foreground">{score}</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          {score} SAT Score
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          A {score} on the Digital SAT is in approximately the{" "}
          <strong>{profile.percentile}th percentile</strong> — a{" "}
          <strong>{profile.tier.toLowerCase()}</strong> SAT score.{" "}
          {profile.tierDescription}
        </p>
        <p className="mt-3 text-sm">
          <Link to="/what-sat-score-do-i-need" className="underline">
            Compare this score with college target ranges →
          </Link>
        </p>
      </header>

      <section className="rounded-2xl border border-border p-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Score
            </div>
            <div className="font-mono text-3xl">{score}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Percentile
            </div>
            <div className="font-mono text-3xl">{profile.percentile}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Tier
            </div>
            <div className="text-lg font-semibold">{profile.tier}</div>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          Section Breakdown for a {score}
        </h2>
        <p className="mt-3 text-muted-foreground">
          Most students who score a {score} are relatively balanced between
          the two Digital SAT sections. A typical split looks like this:
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
          <Link className="underline" to="/score-calculator">
            Digital SAT score calculator
          </Link>
          .
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          Colleges Where a {score} Is Competitive
        </h2>
        <p className="mt-3 text-muted-foreground">
          A {score} SAT score is in range at schools including:
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-6 text-muted-foreground">
          {profile.collegeExamples.map((college) => (
            <li key={college}>{college}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          Note: College admissions consider GPA, essays, extracurriculars,
          and course rigor in addition to your SAT score. A {score} is one
          data point in a holistic file.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          How to Raise a {score} SAT Score
        </h2>
        <p className="mt-3 text-muted-foreground">{profile.studyFocus}</p>
        <p className="mt-3 text-muted-foreground">
          Start by taking a full-length{" "}
          <Link className="underline" to="/modules">
            Digital SAT practice module
          </Link>{" "}
          and logging which question types you miss. Then drill those exact
          skills in the{" "}
          <Link className="underline" to="/bank">
            SAT question bank
          </Link>
          .
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">
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
                <th className="px-4 py-3 font-semibold">If your next report shows...</th>
                <th className="px-4 py-3 font-semibold">Do this before retesting</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">Math is lower than Reading and Writing by 40+ points</td>
                <td className="px-4 py-3 text-muted-foreground">Run two Math domain drills, then a timed Math module.</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">Reading and Writing is lower by 40+ points</td>
                <td className="px-4 py-3 text-muted-foreground">Split practice between Standard English Conventions and evidence/inference drills.</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">Both sections are balanced but below target</td>
                <td className="px-4 py-3 text-muted-foreground">Alternate full timed modules with narrow review sets from the bank.</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">Most misses are careless or from rushing</td>
                <td className="px-4 py-3 text-muted-foreground">Add a checkpoint plan and practice leaving two minutes for flagged questions.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">
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
        <h2 className="text-2xl font-semibold tracking-tight">
          Use this score in the real tools
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          <li>
            <Link
              to="/score-calculator"
              className="inline-block rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-muted"
            >
              Model section splits
            </Link>
          </li>
          <li>
            <Link
              to="/what-sat-score-do-i-need"
              className="inline-block rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-muted"
            >
              Compare college targets
            </Link>
          </li>
          <li>
            <Link
              to="/test-results"
              className="inline-block rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-muted"
            >
              Review saved test results
            </Link>
          </li>
        </ul>
      </section>

      <section className="mt-10 flex items-center justify-between rounded-xl border border-border p-4">
        {score > 400 ? (
          <Link
            className="text-sm underline"
            to="/score-calculator"
          >
            Estimate a lower split
          </Link>
        ) : (
          <span />
        )}
        <Link className="text-sm underline" to="/modules">
          Take a module
        </Link>
        {score < 1600 ? (
          <Link
            className="text-sm underline"
            to="/bank"
          >
            Drill for a higher score →
          </Link>
        ) : (
          <span />
        )}
      </section>
    </div>
  );
};

export default SatScoreDetail;
