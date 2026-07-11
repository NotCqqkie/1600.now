import { Link, useLocation } from "react-router-dom";
import { PageSeo, buildFaqJsonLd, buildBreadcrumbJsonLd } from "@/components/seo/PageSeo";
import {
  COLLEGE_BOARD_SAT_PERCENTILES_URL,
  getScoreProfile,
} from "@/lib/seo-data/satScoreData";
import NotFound from "@/pages/NotFound";

const MIN_VALID_SCORE = 400;
const MAX_VALID_SCORE = 1600;
const SCORE_INCREMENT = 10;
const SCORE_ROUTE_REGEX = /^\/is-a-(\d+)-a-good-sat-score$/;
const STAT_CARD_CLASS = "rounded-xl border border-border bg-card p-4";
const STAT_LABEL_CLASS = "text-xs uppercase tracking-wider text-muted-foreground";
const STAT_VALUE_CLASS = "mt-1 text-3xl font-bold";
const TIER_VALUE_CLASS = "mt-1 text-lg font-semibold";

const VALID_SCORES = Array.from(
  { length: (MAX_VALID_SCORE - MIN_VALID_SCORE) / SCORE_INCREMENT + 1 },
  (_, index) => MIN_VALID_SCORE + index * SCORE_INCREMENT,
);

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

const verdictFor = (score: number, percentileLabel: string) => {
  if (score >= 1500) return `Yes — a ${score} is an exceptional national SAT result in the ${percentileLabel} percentile among recent SAT users. It can fall within the range at highly selective colleges, but it never guarantees admission.`;
  if (score >= 1400) return `Yes — a ${score} is a very strong SAT result in the ${percentileLabel} percentile among recent SAT users. Compare it with each college's current range before deciding whether to submit or retake.`;
  if (score >= 1300) return `Yes — a ${score} is a strong SAT result in the ${percentileLabel} percentile among recent SAT users. Its admissions value depends on the schools on your list.`;
  if (score >= 1200) return `A ${score} is an above-median SAT-user result in the ${percentileLabel} percentile. Check current college ranges rather than treating one national label as universal.`;
  if (score >= 1000) return `A ${score} is near the middle of the SAT-user distribution at the ${percentileLabel} percentile. Whether to retake depends on your target colleges and section-level opportunities.`;
  return `A ${score} is in the ${percentileLabel} percentile among recent SAT users. Use the section report to choose a focused improvement plan and compare the result with current college ranges.`;
};

const IsScoreGood = () => {
  const location = useLocation();
  const match = location.pathname.match(SCORE_ROUTE_REGEX);
  const score = match ? parseInt(match[1], 10) : NaN;

  if (!VALID_SCORES.includes(score)) return <NotFound />;

  const profile = getScoreProfile(score);
  const verdict = verdictFor(score, profile.percentileLabel);
  const url = `https://1600.now/is-a-${score}-a-good-sat-score`;
  const collegeExamplesText = profile.collegeExamples.slice(0, 4).join(", ");
  const hasLowerScore = VALID_SCORES.includes(score - SCORE_INCREMENT);
  const hasHigherScore = VALID_SCORES.includes(score + SCORE_INCREMENT);
  const stats = [
    { label: "Score", value: score, valueClassName: STAT_VALUE_CLASS },
    { label: "SAT-user percentile", value: profile.percentileLabel, valueClassName: STAT_VALUE_CLASS },
    { label: "Tier", value: profile.tier, valueClassName: TIER_VALUE_CLASS },
  ] as const;

  const title = `Is a ${score} a Good SAT Score? Percentile, Colleges & Advice`;
  const description = `Is a ${score} a good SAT score? See the percentile, target colleges, and what to do next if you scored ${score} on the Digital SAT.`;

  const faqs = [
    {
      q: `Is a ${score} a good SAT score?`,
      a: verdict,
    },
    {
      q: `What percentile is a ${score} SAT score?`,
      a: `College Board's current SAT-user table places a ${score} in the ${profile.percentileLabel} percentile. This comparison group is based on recent SAT takers, not all high school students.`,
    },
    {
      q: `What colleges can I get into with a ${score} SAT score?`,
      a: `Use schools such as ${collegeExamplesText} as starting points for checking current middle-50% SAT ranges. A ${score} alone cannot predict admission.`,
    },
    {
      q: `Should I retake the SAT if I scored ${score}?`,
      a: score >= 1500
        ? `Probably not. A ${score} is already elite. Retake only if you specifically need a superscore bump in one section.`
        : score >= 1400
          ? `Only retake if your target schools have a 75th-percentile SAT above ${score}, or if you have clear untapped gains on practice tests.`
          : `A retake may be worthwhile if practice scores show repeatable gains or the score is below your target colleges' current ranges.`,
    },
    {
      q: `How can I improve from a ${score} SAT score?`,
      a: profile.studyFocus,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <PageSeo
        id={`is-good-${score}`}
        title={title}
        description={description}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "1600.now", url: "https://1600.now/" },
            { name: "SAT Score Breakdowns", url: "https://1600.now/sat-score" },
            { name: `Is a ${score} a good SAT score?`, url },
          ]),
          buildFaqJsonLd(faqs.map((faq) => ({ question: faq.q, answer: faq.a }))),
        ]}
      />

      <nav className="text-sm text-muted-foreground">
        <Link to="/sat-score" className="hover:underline">SAT Score Breakdowns</Link>
        <span className="mx-2">/</span>
        <span>Is a {score} a good SAT score?</span>
      </nav>

      <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
        Is a {score} a Good SAT Score?
      </h1>
      <p className="mt-4 text-lg text-foreground/90">{verdict}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Source:{" "}
        <a
          className="underline"
          href={COLLEGE_BOARD_SAT_PERCENTILES_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          College Board SAT-user percentiles
        </a>
        .
      </p>
      <p className="mt-3 text-sm">
        <Link to={`/sat-score/${score}`} className="text-foreground/80 hover:underline">
          See the full {score} SAT score breakdown →
        </Link>
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className={STAT_CARD_CLASS}>
            <div className={STAT_LABEL_CLASS}>{stat.label}</div>
            <div className={stat.valueClassName}>{stat.value}</div>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">What a {score} means</h2>
        <p className="mt-3 text-foreground/90">{profile.tierDescription}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Colleges where {score} is competitive</h2>
        <ul className="mt-3 grid gap-2 text-sm text-foreground/90 sm:grid-cols-2">
          {profile.collegeExamples.map((college) => {
            const collegeSlug = COLLEGE_SLUG_BY_EXAMPLE[college];
            return collegeSlug ? (
              <li key={college}>
                <Link
                  to={`/college/${collegeSlug}`}
                  className="block rounded-md border border-border bg-card px-3 py-2 hover:underline"
                >
                  {college}
                </Link>
              </li>
            ) : (
              <li key={college} className="rounded-md border border-border bg-card px-3 py-2">{college}</li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          Always check each school's published middle-50% SAT range before finalizing your college list.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">How to improve from {score}</h2>
        <p className="mt-3 text-foreground/90">{profile.studyFocus}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/bank" className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-cobalt hover:text-white">
            Practice questions
          </Link>
          <Link to="/score-calculator" className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted">
            Track your score
          </Link>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">FAQs about a {score} SAT score</h2>
        <div className="mt-4 space-y-4">
          {faqs.map((faq, faqIndex) => (
            <div key={faqIndex} className="rounded-lg border border-border bg-card p-4">
              <div className="font-semibold">{faq.q}</div>
              <p className="mt-2 text-sm text-foreground/80">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 flex justify-between text-sm">
        {hasLowerScore && (
          <Link
            to={`/is-a-${score - SCORE_INCREMENT}-a-good-sat-score`}
            className="text-foreground/80 hover:underline"
          >
            ← Is a {score - SCORE_INCREMENT} a good SAT score?
          </Link>
        )}
        <span />
        {hasHigherScore && (
          <Link
            to={`/is-a-${score + SCORE_INCREMENT}-a-good-sat-score`}
            className="ml-auto text-foreground/80 hover:underline"
          >
            Is a {score + SCORE_INCREMENT} a good SAT score? →
          </Link>
        )}
      </section>

      <section className="mt-10">
        <Link to="/what-sat-score-do-i-need" className="text-sm text-foreground/80 hover:underline">
          Compare this score with college target ranges →
        </Link>
      </section>
    </div>
  );
};

export default IsScoreGood;
