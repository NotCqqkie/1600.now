import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  PageSeo,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
} from "@/components/seo/PageSeo";
import {
  colleges,
  formatPct,
  sitemapEligibleColleges,
  type College,
} from "@/lib/seo-data/collegesData";

const COLLEGE_INDEX_URL = "https://1600.now/college";
const DEFAULT_RESULT_LIMIT = 60;
const SEARCH_RESULT_LIMIT = 80;

const COLLEGE_FAQS = [
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

const COLLEGE_INDEX_JSON_LD = [
  buildBreadcrumbJsonLd([
    { name: "Home", url: "https://1600.now/" },
    { name: "Colleges", url: COLLEGE_INDEX_URL },
  ]),
  buildFaqJsonLd(COLLEGE_FAQS),
];

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  PR: "Puerto Rico",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  VI: "US Virgin Islands",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

const COLLEGE_STATE_GROUPS = (() => {
  const groups = new Map<string, College[]>();
  for (const college of sitemapEligibleColleges) {
    if (!college.state) continue;
    const group = groups.get(college.state);
    if (group) group.push(college);
    else groups.set(college.state, [college]);
  }
  return [...groups.entries()]
    .map(([state, stateColleges]) => ({
      state,
      label: STATE_NAMES[state] ?? state,
      colleges: stateColleges.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
})();

const matchesCollegeSearch = (college: College, normalizedQuery: string) =>
  college.name.toLowerCase().includes(normalizedQuery) ||
  (college.alias?.toLowerCase().includes(normalizedQuery) ?? false) ||
  college.state?.toLowerCase() === normalizedQuery ||
  (college.city?.toLowerCase().includes(normalizedQuery) ?? false);

const CollegeIndex = () => {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return colleges.slice(0, DEFAULT_RESULT_LIMIT);
    return colleges.filter((college) => matchesCollegeSearch(college, normalizedQuery)).slice(0, SEARCH_RESULT_LIMIT);
  }, [query]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <PageSeo
        id="college-index"
        title="US College Directory: SAT Scores, Acceptance Rates & Admissions"
        description={`Searchable directory of ${colleges.length} US colleges with SAT ranges, acceptance rates, tuition, and outcomes data from the College Scorecard.`}
        canonical={COLLEGE_INDEX_URL}
        jsonLd={COLLEGE_INDEX_JSON_LD}
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
        <h2 className="text-2xl font-semibold tracking-tight">
          Browse colleges by state
        </h2>
        <p className="mt-3 text-muted-foreground">
          Every college in this directory with published SAT ranges and
          acceptance rates, grouped by state.
        </p>
        <div className="mt-4 space-y-2">
          {COLLEGE_STATE_GROUPS.map(({ state, label, colleges: stateColleges }) => (
            <details
              key={state}
              className="rounded-lg border border-border px-4 py-3"
            >
              <summary className="cursor-pointer">
                <h3 className="inline text-base font-semibold">
                  {label} ({stateColleges.length})
                </h3>
              </summary>
              <ul className="mt-2 space-y-1">
                {stateColleges.map((college) => (
                  <li key={college.slug}>
                    <Link
                      to={`/college/${college.slug}`}
                      className="text-sm hover:underline"
                    >
                      {college.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">FAQs</h2>
        <div className="mt-4 space-y-5">
          {COLLEGE_FAQS.map((faq) => (
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
