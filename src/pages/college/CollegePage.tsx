import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";

import {
  PageSeo,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
} from "@/components/seo/PageSeo";
import {
  collegeBySlug,
  formatPct,
  formatUsd,
  type College,
} from "@/lib/seo-data/collegesData";

const chanceLabel = (sat: number, college: College): string => {
  if (!college.sat25 || !college.sat75) return "Check the admissions page for current ranges.";
  if (sat >= college.sat75 + 20) return "Strong — above the 75th percentile of admitted students.";
  if (sat >= college.sat75) return "Competitive — at or above the 75th percentile.";
  const mid = Math.round((college.sat25 + college.sat75) / 2);
  if (sat >= mid) return "In range — near the median of admitted students.";
  if (sat >= college.sat25) return "Low end — within the 25th–50th percentile band.";
  return "Below range — this score would be a significant drag on the application.";
};

const carnegieLabel = (code: number | null): string => {
  if (!code) return "Four-year college";
  if (code === 15) return "Doctoral / R1 research university";
  if (code === 16) return "Doctoral / R2 research university";
  if (code === 17) return "Doctoral / professional";
  if (code >= 18 && code <= 20) return "Master's university";
  if (code >= 21 && code <= 23) return "Liberal arts / baccalaureate college";
  return "Four-year college";
};

const OUTCOME_CARD_CLASS = "rounded-xl border border-border p-4";
const METRIC_LABEL_CLASS = "text-sm text-muted-foreground";
const OUTCOME_VALUE_CLASS = "text-lg font-semibold";

const OutcomeCard = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className={OUTCOME_CARD_CLASS}>
    <div className={METRIC_LABEL_CLASS}>{label}</div>
    <div className={OUTCOME_VALUE_CLASS}>{value}</div>
  </div>
);

const CollegePage = () => {
  const location = useLocation();
  const slug = location.pathname.replace(/^\/college\//, "").replace(/\/$/, "");
  const college = collegeBySlug.get(slug);

  if (!college) return <Navigate to="/college" replace />;

  const url = `https://1600.now/college/${college.slug}`;
  const displayName = college.name;
  const shortName = college.alias && college.alias !== college.name ? college.alias : college.name;
  const locationLabel =
    college.city && college.state ? `${college.city}, ${college.state}` : college.state ?? "United States";

  const satRange = college.sat25 && college.sat75 ? `${college.sat25}–${college.sat75}` : null;
  const satMid = satRange ? Math.round((college.sat25! + college.sat75!) / 2) : null;

  const faqs = [
    {
      question: `What SAT score do I need for ${shortName}?`,
      answer: satRange
        ? `${displayName}'s admitted students have a middle-50% SAT range of ${satRange}, with a median around ${satMid}. To be competitive, aim for ${college.sat75}+ — this puts you at or above the 75th percentile of admitted students.`
        : `${displayName} does not publish a full SAT middle-50% range. Check its admissions page for current expectations.`,
    },
    {
      question: `What is ${shortName}'s acceptance rate?`,
      answer:
        college.acceptanceRate != null
          ? `${displayName}'s most recently reported acceptance rate is approximately ${formatPct(college.acceptanceRate)}.`
          : `${displayName} does not publish a publicly available acceptance rate in the most recent Scorecard data.`,
    },
    {
      question: `How much does it cost to attend ${shortName}?`,
      answer:
        college.tuitionIn && college.tuitionOut && college.tuitionIn !== college.tuitionOut
          ? `In-state tuition is approximately ${formatUsd(college.tuitionIn)} and out-of-state is approximately ${formatUsd(college.tuitionOut)}. These figures exclude room, board, and fees.`
          : college.tuitionIn
            ? `Published tuition is approximately ${formatUsd(college.tuitionIn)} per year (excludes room, board, fees).`
            : `${displayName} does not publish a standard tuition figure in the most recent Scorecard data.`,
    },
    {
      question: `Is ${shortName} test-optional in 2026?`,
      answer:
        `Many US universities adjusted test policies after 2020. Check ${displayName}'s admissions page for current test-optional, test-required, or test-flexible policy.`,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <PageSeo
        id={`college-${college.slug}`}
        title={`${displayName}: SAT Scores, Acceptance Rate & Admissions (2026)`}
        description={
          satRange
            ? `${displayName} admits students with an SAT middle-50% of ${satRange} and an acceptance rate of ${formatPct(college.acceptanceRate)}. Full admissions profile, tuition, and score targets.`
            : `${displayName} admissions profile: acceptance rate, SAT/ACT ranges, tuition, location, and score targets for 2026 applicants.`
        }
        canonical={url}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: "Colleges", url: "https://1600.now/college" },
            { name: displayName, url },
          ]),
          buildFaqJsonLd(faqs),
          {
            "@context": "https://schema.org",
            "@type": "CollegeOrUniversity",
            name: displayName,
            alternateName: college.alias || undefined,
            url: college.url ? `https://${college.url.replace(/^https?:\/\//, "")}` : url,
            address: {
              "@type": "PostalAddress",
              addressLocality: college.city || undefined,
              addressRegion: college.state || undefined,
              postalCode: college.zip || undefined,
              addressCountry: "US",
            },
          },
        ]}
      />

      <nav className="mb-6 text-sm text-muted-foreground">
        <Link className="hover:underline" to="/">
          Home
        </Link>{" "}
        ›{" "}
        <Link className="hover:underline" to="/college">
          Colleges
        </Link>{" "}
        › <span className="text-foreground">{displayName}</span>
      </nav>

      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
        {displayName}
      </h1>
      <p className="mt-2 text-lg text-muted-foreground">
        {locationLabel} · {college.ownership} · {carnegieLabel(college.carnegieBasic)}
      </p>

      <section className="mt-8 grid gap-4 rounded-xl border border-border p-6 md:grid-cols-2">
        <div>
          <div className="text-sm text-muted-foreground">
            SAT middle 50% (admitted students)
          </div>
          <div className="text-3xl font-semibold">{satRange ?? "—"}</div>
          {satMid && (
            <div className="mt-1 text-sm text-muted-foreground">
              Median ~{satMid}
            </div>
          )}
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Acceptance rate</div>
          <div className="text-3xl font-semibold">
            {formatPct(college.acceptanceRate)}
          </div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Enrollment</div>
          <div className="text-lg font-semibold">
            {college.enrollment != null ? college.enrollment.toLocaleString("en-US") : "—"}
          </div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">
            ACT middle 50%
          </div>
          <div className="text-lg font-semibold">
            {college.act25 && college.act75 ? `${college.act25}–${college.act75}` : "—"}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          Tuition and outcomes
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <OutcomeCard label="Tuition (in-state)" value={formatUsd(college.tuitionIn)} />
          <OutcomeCard label="Tuition (out-of-state)" value={formatUsd(college.tuitionOut)} />
          <OutcomeCard
            label="Median earnings 10 years after entry"
            value={formatUsd(college.earnings10yr)}
          />
          <OutcomeCard
            label="4-year completion rate (150% time)"
            value={formatPct(college.completionRate)}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Source: US Department of Education College Scorecard, most recent
          available year. Tuition excludes room, board, fees, and books.
        </p>
      </section>

      {satRange && (
        <section className="mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">
            How your SAT score lines up
          </h2>
          <p className="mt-3 text-muted-foreground">
            At {displayName}, 25% of admitted students score below{" "}
            <strong>{college.sat25}</strong> and 25% score above{" "}
            <strong>{college.sat75}</strong>. Scoring at the 75th percentile or
            higher makes the SAT a positive factor in your application.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-muted-foreground">
            <li>
              <strong>{college.sat75! + 40}+ SAT:</strong>{" "}
              {chanceLabel(college.sat75! + 40, college)}
            </li>
            <li>
              <strong>{college.sat75} SAT (75th percentile):</strong>{" "}
              {chanceLabel(college.sat75!, college)}
            </li>
            <li>
              <strong>{satMid} SAT (median):</strong> {chanceLabel(satMid!, college)}
            </li>
            <li>
              <strong>{college.sat25} SAT (25th percentile):</strong>{" "}
              {chanceLabel(college.sat25!, college)}
            </li>
          </ul>
          <Link
            to="/what-sat-score-do-i-need"
            className="mt-4 inline-block text-sm underline"
          >
            Compare to other colleges →
          </Link>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">FAQs</h2>
        <div className="mt-4 space-y-5">
          {faqs.map((faq) => (
            <div key={faq.question}>
              <h3 className="text-base font-semibold">{faq.question}</h3>
              <p className="mt-1 text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {college.url && (
        <section className="mt-10 text-sm text-muted-foreground">
          Official site:{" "}
          <a
            className="underline"
            href={college.url.startsWith("http") ? college.url : `https://${college.url}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            {college.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </a>
        </section>
      )}
    </div>
  );
};

export default CollegePage;
