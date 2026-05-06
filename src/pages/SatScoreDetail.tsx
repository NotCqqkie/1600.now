import { Link, useParams } from "react-router-dom";

import {
  PageSeo,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
} from "@/components/seo/PageSeo";
import { allSatScores, getScoreProfile } from "@/lib/satScoreData";

const SatScoreDetail = () => {
  const { score: scoreParam } = useParams();
  const score = Number(scoreParam);

  if (!Number.isFinite(score) || !allSatScores.includes(score)) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-3xl font-semibold">Score not found</h1>
        <p className="mt-3 text-muted-foreground">
          Pick a score from our{" "}
          <Link className="underline" to="/sat-score">
            SAT score index
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
  const nextUp = Math.min(1600, score + 50);
  const prevDown = Math.max(400, score - 50);

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
          A {score} on the Digital SAT is in approximately the{" "}
          <strong>{profile.percentile}th percentile</strong> — a{" "}
          <strong>{profile.tier.toLowerCase()}</strong> SAT score.{" "}
          {profile.tierDescription}
        </p>
        <p className="mt-3 text-sm">
          <Link to={`/is-a-${score}-a-good-sat-score`} className="underline">
            Is a {score} a good SAT score? →
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
          {profile.collegeExamples.map((c) => (
            <li key={c}>{c}</li>
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
          Frequently Asked Questions
        </h2>
        <div className="mt-4 space-y-5">
          {faqs.map((f) => (
            <div key={f.question}>
              <h3 className="text-base font-semibold">{f.question}</h3>
              <p className="mt-1 text-muted-foreground">{f.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 flex items-center justify-between rounded-xl border border-border p-4">
        {score > 400 ? (
          <Link
            className="text-sm underline"
            to={`/sat-score/${prevDown}`}
          >
            ← {prevDown} SAT Score
          </Link>
        ) : (
          <span />
        )}
        <Link className="text-sm underline" to="/sat-score">
          All scores
        </Link>
        {score < 1600 ? (
          <Link
            className="text-sm underline"
            to={`/sat-score/${nextUp}`}
          >
            {nextUp} SAT Score →
          </Link>
        ) : (
          <span />
        )}
      </section>
    </div>
  );
};

export default SatScoreDetail;
