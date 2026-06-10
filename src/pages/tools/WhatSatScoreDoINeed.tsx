import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  PageSeo,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
} from "@/components/seo/PageSeo";
import { satToolBySlug } from "@/lib/seo-data/satTools";
interface CollegeProfile {
  name: string;
  p25: number;
  p75: number;
  acceptance: number;
  tags: string[];
}

const COLLEGES: CollegeProfile[] = [
  { name: "Harvard University", p25: 1500, p75: 1580, acceptance: 3, tags: ["Ivy", "reach"] },
  { name: "MIT", p25: 1520, p75: 1580, acceptance: 4, tags: ["STEM", "reach"] },
  { name: "Stanford University", p25: 1500, p75: 1570, acceptance: 4, tags: ["reach"] },
  { name: "Princeton University", p25: 1510, p75: 1570, acceptance: 4, tags: ["Ivy", "reach"] },
  { name: "Yale University", p25: 1500, p75: 1580, acceptance: 4, tags: ["Ivy", "reach"] },
  { name: "Columbia University", p25: 1490, p75: 1570, acceptance: 4, tags: ["Ivy", "reach"] },
  { name: "University of Pennsylvania", p25: 1500, p75: 1570, acceptance: 6, tags: ["Ivy", "reach"] },
  { name: "Brown University", p25: 1490, p75: 1570, acceptance: 5, tags: ["Ivy", "reach"] },
  { name: "Cornell University", p25: 1470, p75: 1550, acceptance: 7, tags: ["Ivy", "reach"] },
  { name: "Dartmouth College", p25: 1480, p75: 1570, acceptance: 6, tags: ["Ivy", "reach"] },
  { name: "Duke University", p25: 1490, p75: 1570, acceptance: 6, tags: ["reach"] },
  { name: "University of Chicago", p25: 1500, p75: 1570, acceptance: 5, tags: ["reach"] },
  { name: "Northwestern University", p25: 1480, p75: 1560, acceptance: 7, tags: ["reach"] },
  { name: "Johns Hopkins University", p25: 1500, p75: 1560, acceptance: 7, tags: ["reach"] },
  { name: "Caltech", p25: 1530, p75: 1580, acceptance: 3, tags: ["STEM", "reach"] },
  { name: "Carnegie Mellon University", p25: 1480, p75: 1560, acceptance: 11, tags: ["STEM"] },
  { name: "Washington University in St. Louis", p25: 1490, p75: 1560, acceptance: 12, tags: [] },
  { name: "Rice University", p25: 1490, p75: 1560, acceptance: 8, tags: [] },
  { name: "Vanderbilt University", p25: 1480, p75: 1560, acceptance: 7, tags: [] },
  { name: "Emory University", p25: 1420, p75: 1540, acceptance: 13, tags: [] },
  { name: "Notre Dame", p25: 1440, p75: 1550, acceptance: 13, tags: [] },
  { name: "UC Berkeley", p25: 1390, p75: 1540, acceptance: 12, tags: ["public"] },
  { name: "UCLA", p25: 1380, p75: 1540, acceptance: 9, tags: ["public"] },
  { name: "University of Michigan", p25: 1360, p75: 1530, acceptance: 18, tags: ["public"] },
  { name: "University of Virginia", p25: 1370, p75: 1520, acceptance: 19, tags: ["public"] },
  { name: "UNC Chapel Hill", p25: 1330, p75: 1500, acceptance: 17, tags: ["public"] },
  { name: "Georgia Tech", p25: 1400, p75: 1530, acceptance: 17, tags: ["STEM", "public"] },
  { name: "University of Florida", p25: 1340, p75: 1470, acceptance: 24, tags: ["public"] },
  { name: "UT Austin", p25: 1290, p75: 1490, acceptance: 31, tags: ["public"] },
  { name: "NYU", p25: 1440, p75: 1540, acceptance: 8, tags: [] },
  { name: "Boston University", p25: 1370, p75: 1490, acceptance: 14, tags: [] },
  { name: "Tufts University", p25: 1450, p75: 1540, acceptance: 10, tags: [] },
  { name: "University of Southern California", p25: 1390, p75: 1530, acceptance: 12, tags: [] },
  { name: "Boston College", p25: 1410, p75: 1510, acceptance: 16, tags: [] },
  { name: "University of Wisconsin-Madison", p25: 1320, p75: 1480, acceptance: 49, tags: ["public"] },
  { name: "University of Illinois Urbana-Champaign", p25: 1290, p75: 1480, acceptance: 45, tags: ["public"] },
  { name: "Penn State", p25: 1180, p75: 1370, acceptance: 55, tags: ["public"] },
  { name: "Ohio State", p25: 1240, p75: 1420, acceptance: 53, tags: ["public"] },
  { name: "Purdue University", p25: 1200, p75: 1440, acceptance: 53, tags: ["STEM", "public"] },
  { name: "University of Washington", p25: 1230, p75: 1440, acceptance: 48, tags: ["public"] },
  { name: "Rutgers University", p25: 1250, p75: 1440, acceptance: 66, tags: ["public"] },
  { name: "Arizona State University", p25: 1120, p75: 1360, acceptance: 88, tags: ["public"] },
];

const chanceLabel = (sat: number, profile: CollegeProfile): string => {
  if (sat >= profile.p75 + 20) return "Strong — above the 75th percentile of admitted students";
  if (sat >= profile.p75) return "Competitive — at or above the 75th percentile";
  if (sat >= Math.round((profile.p25 + profile.p75) / 2)) return "In range — near the median of admitted students";
  if (sat >= profile.p25) return "On the low end — within the 25th–50th percentile band";
  if (sat >= profile.p25 - 40) return "Below range — will likely need a strong rest-of-application";
  return "Well below range — consider raising the score or shifting targets";
};

const WhatSatScoreDoINeed = () => {
  const meta = satToolBySlug.get("what-sat-score-do-i-need")!;
  const [query, setQuery] = useState<string>("");
  const [currentSat, setCurrentSat] = useState<string>("1300");

  const matches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return COLLEGES.slice(0, 8);
    return COLLEGES.filter((college) => college.name.toLowerCase().includes(normalizedQuery)).slice(0, 12);
  }, [query]);

  const sat = Number(currentSat);
  const satValid = Number.isFinite(sat) && sat >= 400 && sat <= 1600;

  const url = `https://1600.now/${meta.slug}`;
  const faqs = [
    {
      question: "What SAT score do I need for Ivy League schools?",
      answer:
        "The Ivy League middle 50% SAT range is roughly 1470–1580. A 1500+ puts you within range for every Ivy; a 1550+ is competitive at the top of the admitted range.",
    },
    {
      question: "Is a 1400 SAT good enough for top colleges?",
      answer:
        "A 1400 is above the 94th percentile and competitive at strong flagship universities (UVA, UNC, UT Austin) and many selective private schools (NYU, BU, Emory), but below the 25th percentile at most Ivy-tier schools.",
    },
    {
      question: "Do I need to hit the 75th percentile to get admitted?",
      answer:
        "No. Being at the 75th percentile is competitive but not required. The middle 50% range means 25% of admitted students scored below the 25th percentile number — typically due to strong non-score factors (athletes, legacy, first-gen, exceptional essays).",
    },
    {
      question: "How recent is this admissions data?",
      answer:
        "Ranges are drawn from the most recently published Common Data Set and College Scorecard figures available at the time of writing. Always cross-check a college's own admissions page before using these figures for high-stakes decisions.",
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

      <div className="mt-8 grid gap-4 rounded-xl border border-border p-6 md:grid-cols-2">
        <div>
          <label className="text-sm font-semibold">Search a college</label>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. Harvard, UCLA, Penn State"
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </div>
        <div>
          <label className="text-sm font-semibold">
            Your current SAT (optional)
          </label>
          <input
            type="number"
            min={400}
            max={1600}
            step={10}
            value={currentSat}
            onChange={(event) => setCurrentSat(event.target.value)}
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </div>
      </div>

      <section className="mt-8 space-y-3">
        {matches.length === 0 ? (
          <p className="text-muted-foreground">
            No colleges match "{query}". Try a broader name — e.g. "Michigan"
            or "Texas".
          </p>
        ) : (
          matches.map((college) => {
            const middleScore = Math.round((college.p25 + college.p75) / 2);
            return (
              <div
                key={college.name}
                className="rounded-xl border border-border p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-lg font-semibold">{college.name}</div>
                  <div className="text-sm text-muted-foreground">
                    ~{college.acceptance}% acceptance
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <span className="text-muted-foreground">
                    Admitted-student SAT middle 50%:
                  </span>{" "}
                  <span className="font-semibold">
                    {college.p25}–{college.p75}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    (target ≈ {middleScore})
                  </span>
                </div>
                {satValid && (
                  <div className="mt-2 text-sm">{chanceLabel(sat, college)}</div>
                )}
              </div>
            );
          })
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          How to use these SAT ranges
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-6 text-muted-foreground">
          <li>
            Aim for the 75th percentile or higher to have the SAT work as a
            "lift" on your application.
          </li>
          <li>
            Scoring in the middle 50% means the SAT is neutral — admissions
            will turn on essays, GPA, and extracurriculars.
          </li>
          <li>
            Below the 25th percentile, the SAT is a drag; consider raising it
            or applying test-optional if policy allows.
          </li>
        </ul>
      </section>

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
    </div>
  );
};

export default WhatSatScoreDoINeed;
