import { Link } from "react-router-dom";

import { PageSeo, buildBreadcrumbJsonLd } from "@/components/seo/PageSeo";

const TITLE = "SAT Score Breakdowns: Every 400–1600 SAT Score Explained";
const DESCRIPTION =
  "Browse detailed breakdowns of every Digital SAT score from 400 to 1600. See the percentile, target colleges, and study plan for your SAT score.";
const SAT_SCORE_URL = "https://1600.now/sat-score";
const TABLE_HEAD_CELL_CLASS = "px-4 py-3 font-semibold";
const TABLE_ROW_CLASS = "border-t border-border";
const TABLE_BODY_CELL_CLASS = "px-4 py-3 text-muted-foreground";
const SECONDARY_CTA_CLASS =
  "inline-flex rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted";

const SCORE_BANDS = [
  ["1500-1600", "Elite", "Protect every easy and medium point; use hard Module 2 review."],
  ["1400-1490", "Strong", "Use timed modules to find the last section-specific misses."],
  ["1300-1390", "Competitive", "Target the weakest section with skill-filtered bank practice."],
  ["1200-1290", "Above average", "Clean up Algebra, punctuation, and pacing errors first."],
  ["400-1190", "Building", "Start with fundamentals and review every miss before adding speed."],
] as const;

const SCORE_BAND_QUESTIONS = [
  [
    "Is my total score competitive?",
    "A 1400 can be excellent for one college list and below range for another.",
    "Compare college targets.",
  ],
  [
    "Which section is holding me back?",
    "The same total score can hide a very different Math/RW split.",
    "Use the score calculator.",
  ],
  [
    "What should I practice next?",
    "The next drill should come from repeated misses, not from the score label.",
    "Open the filtered question bank.",
  ],
] as const;

const SatScoreIndex = () => {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <PageSeo
        id="sat-score-index"
        title={TITLE}
        description={DESCRIPTION}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: "SAT Scores", url: SAT_SCORE_URL },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: TITLE,
            description: DESCRIPTION,
            url: SAT_SCORE_URL,
          },
        ]}
      />

      <header className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight">
          SAT Score Breakdowns: Every Score From 400 to 1600
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Use the score bands below to decide what to do next. For your actual
          section split and current estimate, use the{" "}
          <Link className="underline" to="/score-calculator">
            Digital SAT score calculator
          </Link>{" "}
          first, then drill the section that is holding the total down.
        </p>
      </header>

      <div className="grid gap-3">
        {SCORE_BANDS.map(([range, tier, nextStep]) => (
          <div key={range} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="font-mono text-lg font-semibold">{range}</div>
              <div className="text-sm font-semibold">{tier}</div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{nextStep}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          How to use a score band
        </h2>
        <p className="mt-3 text-muted-foreground">
          A score band is a starting diagnosis, not the plan itself. Two students with a 1350 can need completely different work if one is 750 Math / 600 Reading and Writing and the other is 660 Math / 690 Reading and Writing. Always turn the band into a section-specific decision.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-muted/70">
              <tr>
                <th className={TABLE_HEAD_CELL_CLASS}>Question to answer</th>
                <th className={TABLE_HEAD_CELL_CLASS}>Why it matters</th>
                <th className={TABLE_HEAD_CELL_CLASS}>Tool to use</th>
              </tr>
            </thead>
            <tbody>
              {SCORE_BAND_QUESTIONS.map(([question, why, tool]) => (
                <tr key={question} className={TABLE_ROW_CLASS}>
                  <td className={TABLE_BODY_CELL_CLASS}>{question}</td>
                  <td className={TABLE_BODY_CELL_CLASS}>{why}</td>
                  <td className={TABLE_BODY_CELL_CLASS}>{tool}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          Common score-band mistakes
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-muted-foreground">
          <li>Assuming a total score is enough information without checking section split.</li>
          <li>Retaking full tests repeatedly when a narrow bank drill would fix the repeated miss type faster.</li>
          <li>Comparing your score to national averages instead of your actual college list.</li>
          <li>Chasing the next score band before protecting easy and medium questions in the current band.</li>
        </ul>
      </section>

      <ul className="mt-6 flex flex-wrap gap-3">
        <li>
          <Link
            to="/score-calculator"
            className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-cobalt hover:text-white"
          >
            Estimate your SAT score
          </Link>
        </li>
        <li>
          <Link
            to="/what-sat-score-do-i-need"
            className={SECONDARY_CTA_CLASS}
          >
            Compare college targets
          </Link>
        </li>
        <li>
          <Link
            to="/modules"
            className={SECONDARY_CTA_CLASS}
          >
            Take a timed module
          </Link>
        </li>
        <li>
          <Link
            to="/bank"
            className={SECONDARY_CTA_CLASS}
          >
            Drill weak skills
          </Link>
        </li>
      </ul>
    </div>
  );
};

export default SatScoreIndex;
