import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  PageSeo,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
} from "@/components/seo/PageSeo";
import { colleges, formatPct } from "@/lib/seo-data/collegesData";

const CollegeIndex = () => {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return colleges.slice(0, 60);
    return colleges
      .filter(
        (college) =>
          college.name.toLowerCase().includes(normalizedQuery) ||
          (college.alias?.toLowerCase().includes(normalizedQuery) ?? false) ||
          (college.state?.toLowerCase() === normalizedQuery) ||
          (college.city?.toLowerCase().includes(normalizedQuery) ?? false),
      )
      .slice(0, 80);
  }, [query]);

  const url = "https://1600.now/college";
  const faqs = [
    {
      question: "How many colleges are in this directory?",
      answer: `This directory covers ${colleges.length.toLocaleString("en-US")} four-year, degree-granting US institutions that report SAT score data to the US Department of Education.`,
    },
    {
      question: "Where does the admissions data come from?",
      answer:
        "All figures come from the US Department of Education College Scorecard, which aggregates data reported annually by each institution. We refresh our snapshot on each site build.",
    },
    {
      question: "Is this list exhaustive?",
      answer:
        "No — we exclude branch campuses, certificate-only institutions, and colleges that do not report SAT data. For a complete list, see collegescorecard.ed.gov.",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <PageSeo
        id="college-index"
        title="US College Directory: SAT Scores, Acceptance Rates & Admissions"
        description={`Searchable directory of ${colleges.length} US colleges with SAT ranges, acceptance rates, tuition, and outcomes data from the College Scorecard.`}
        canonical={url}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: "Colleges", url },
          ]),
          buildFaqJsonLd(faqs),
        ]}
      />

      <nav className="mb-6 text-sm text-muted-foreground">
        <Link className="hover:underline" to="/">
          Home
        </Link>{" "}
        › <span className="text-foreground">Colleges</span>
      </nav>

      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
        US College Directory
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Search SAT score ranges, acceptance rates, and admissions data for{" "}
        {colleges.length.toLocaleString("en-US")} US colleges. Data sourced
        from the US Department of Education College Scorecard.
      </p>

      <div className="mt-6">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, state (e.g. CA), or city"
          className="w-full rounded-lg border border-border bg-background px-3 py-2"
        />
      </div>

      <ul className="mt-6 space-y-2">
        {results.map((college) => (
          <li
            key={college.slug}
            className="rounded-lg border border-border px-4 py-3"
          >
            <Link
              to={`/college/${college.slug}`}
              className="font-semibold hover:underline"
            >
              {college.name}
            </Link>
            <div className="mt-1 text-sm text-muted-foreground">
              {college.city && college.state ? `${college.city}, ${college.state}` : college.state}
              {college.sat25 && college.sat75 && ` · SAT ${college.sat25}–${college.sat75}`}
              {college.acceptanceRate != null &&
                ` · ${formatPct(college.acceptanceRate)} acceptance`}
            </div>
          </li>
        ))}
      </ul>

      {results.length === 0 && (
        <p className="mt-6 text-muted-foreground">
          No colleges match "{query}". Try a state code (like "MA") or a
          broader name.
        </p>
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
    </div>
  );
};

export default CollegeIndex;
