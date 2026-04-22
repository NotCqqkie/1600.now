import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  PageSeo,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
} from "@/components/seo/PageSeo";
import { satToolBySlug } from "@/lib/satTools";
import { getScoreProfile } from "@/lib/satScoreData";

const tierLabel = (percentile: number): string => {
  if (percentile >= 99) return "Top 1%";
  if (percentile >= 95) return "Top 5%";
  if (percentile >= 90) return "Top 10%";
  if (percentile >= 75) return "Top 25% (above average)";
  if (percentile >= 50) return "Above average";
  if (percentile >= 25) return "Below average";
  return "Bottom 25%";
};

const SatPercentileCalculator = () => {
  const meta = satToolBySlug.get("sat-percentile-calculator")!;
  const [score, setScore] = useState<string>("1400");

  const result = useMemo(() => {
    const n = Number(score);
    if (!Number.isFinite(n) || n < 400 || n > 1600) return null;
    const rounded = Math.round(n / 10) * 10;
    const profile = getScoreProfile(rounded);
    return {
      score: rounded,
      percentile: profile.percentile,
      tier: tierLabel(profile.percentile),
      betterThan: profile.percentile,
    };
  }, [score]);

  const url = `https://1600.now/${meta.slug}`;
  const faqs = [
    {
      question: "What does an SAT percentile mean?",
      answer:
        "A percentile tells you the percentage of test takers you scored higher than. A 90th percentile score means you scored higher than 90% of all SAT test takers.",
    },
    {
      question: "Which percentile data does this use?",
      answer:
        "Approximate percentiles based on the most recent College Board Digital SAT test taker population data.",
    },
    {
      question: "What percentile is a 1200 SAT?",
      answer:
        "A 1200 Digital SAT score is approximately the 74th percentile, meaning you scored higher than about 74% of SAT takers.",
    },
    {
      question: "Does the percentile change by test date?",
      answer:
        "Percentiles are equated across test dates, so a 1400 on any Digital SAT administration represents roughly the same percentile rank.",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <PageSeo
        id={`tool-${meta.slug}`}
        title={meta.metaTitle}
        description={meta.metaDescription}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: meta.name, url },
          ]),
          buildFaqJsonLd(faqs),
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: meta.name,
            url,
            applicationCategory: "EducationalApplication",
            operatingSystem: "Any",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          },
        ]}
      />

      <nav className="mb-6 text-sm text-muted-foreground">
        <Link className="hover:underline" to="/">
          Home
        </Link>{" "}
        › <span className="text-foreground">{meta.name}</span>
      </nav>

      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
        {meta.name}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">{meta.intro}</p>

      <div className="mt-8 rounded-xl border border-border p-6">
        <label className="text-sm font-semibold">Digital SAT total score</label>
        <input
          type="number"
          min={400}
          max={1600}
          step={10}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
        />
        {result ? (
          <div className="mt-4 grid gap-3">
            <div>
              <div className="text-sm text-muted-foreground">Percentile</div>
              <div className="text-3xl font-semibold">{result.percentile}th</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Tier</div>
              <div className="text-lg font-semibold">{result.tier}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">You scored higher than</div>
              <div className="text-lg">
                ~{result.betterThan}% of Digital SAT test takers.
              </div>
            </div>
            <Link
              to={`/sat-score/${result.score}`}
              className="mt-2 inline-block text-sm underline"
            >
              See full {result.score} score profile →
            </Link>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Enter an SAT score between 400 and 1600.
          </p>
        )}
      </div>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          Common percentiles
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-6 text-muted-foreground">
          <li>1600 — 99th+ percentile (perfect score, top fraction of 1%)</li>
          <li>1500 — 98th percentile</li>
          <li>1400 — 94th percentile</li>
          <li>1300 — 86th percentile</li>
          <li>1200 — 74th percentile</li>
          <li>1100 — 58th percentile</li>
          <li>1050 — 49th percentile (approximately the current average)</li>
          <li>1000 — 40th percentile</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">FAQs</h2>
        <div className="mt-4 space-y-5">
          {faqs.map((f) => (
            <div key={f.question}>
              <h3 className="text-base font-semibold">{f.question}</h3>
              <p className="mt-1 text-muted-foreground">{f.answer}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default SatPercentileCalculator;
