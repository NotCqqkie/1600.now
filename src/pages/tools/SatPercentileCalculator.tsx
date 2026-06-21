import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { satToolBySlug } from "@/lib/seo-data/satTools";
import { getScoreProfile } from "@/lib/seo-data/satScoreData";

import {
  SatToolPageScaffold,
  TOOL_FORM_CARD_CLASS,
  TOOL_INFO_TABLE_CELL_CLASS,
  TOOL_INFO_TABLE_CLASS,
  TOOL_INFO_TABLE_HEAD_CLASS,
  TOOL_INFO_TABLE_HEADER_CELL_CLASS,
  TOOL_INFO_TABLE_ROW_CLASS,
  TOOL_INFO_TABLE_WRAPPER_CLASS,
  TOOL_INPUT_CLASS,
  TOOL_SECTION_HEADING_CLASS,
} from "./SatToolPageScaffold";

const tierLabel = (percentile: number): string => {
  if (percentile >= 99) return "Top 1%";
  if (percentile >= 95) return "Top 5%";
  if (percentile >= 90) return "Top 10%";
  if (percentile >= 75) return "Top 25% (above average)";
  if (percentile >= 50) return "Above average";
  if (percentile >= 25) return "Below average";
  return "Bottom 25%";
};

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

const SatPercentileCalculator = () => {
  const meta = satToolBySlug.get("sat-percentile-calculator")!;
  const [score, setScore] = useState<string>("1400");

  const result = useMemo(() => {
    const scoreValue = Number(score);
    if (!Number.isFinite(scoreValue) || scoreValue < 400 || scoreValue > 1600) return null;
    const rounded = Math.round(scoreValue / 10) * 10;
    const profile = getScoreProfile(rounded);
    return {
      percentile: profile.percentile,
      tier: tierLabel(profile.percentile),
    };
  }, [score]);

  return (
    <SatToolPageScaffold meta={meta} faqs={faqs}>
      <div className={TOOL_FORM_CARD_CLASS}>
        <label className="text-sm font-semibold">Digital SAT total score</label>
        <input
          type="number"
          min={400}
          max={1600}
          step={10}
          value={score}
          onChange={(event) => setScore(event.target.value)}
          className={TOOL_INPUT_CLASS}
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
              <div className="text-sm text-muted-foreground">You scored at or above</div>
              <div className="text-lg">
                ~{result.percentile}% of Digital SAT test takers.
              </div>
            </div>
            <Link
              to="/what-sat-score-do-i-need"
              className="mt-2 inline-block text-sm underline"
            >
              Compare this score with college ranges →
            </Link>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Enter an SAT score between 400 and 1600.
          </p>
        )}
      </div>

      <section className="mt-10">
        <h2 className={TOOL_SECTION_HEADING_CLASS}>
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
        <h2 className={TOOL_SECTION_HEADING_CLASS}>
          How to use your percentile
        </h2>
        <p className="mt-3 text-muted-foreground">
          Percentile is useful for national context, but admissions decisions are made school by school. A high percentile can still be below range at a top engineering program, and a lower percentile can be strong for a regional public university or scholarship cutoff.
        </p>
        <div className={TOOL_INFO_TABLE_WRAPPER_CLASS}>
          <table className={TOOL_INFO_TABLE_CLASS}>
            <thead className={TOOL_INFO_TABLE_HEAD_CLASS}>
              <tr>
                <th className={TOOL_INFO_TABLE_HEADER_CELL_CLASS}>Percentile range</th>
                <th className={TOOL_INFO_TABLE_HEADER_CELL_CLASS}>What it means</th>
                <th className={TOOL_INFO_TABLE_HEADER_CELL_CLASS}>Next step</th>
              </tr>
            </thead>
            <tbody>
              <tr className={TOOL_INFO_TABLE_ROW_CLASS}>
                <td className={TOOL_INFO_TABLE_CELL_CLASS}>95th+</td>
                <td className={TOOL_INFO_TABLE_CELL_CLASS}>Strong for selective colleges, but still compare against each school's middle 50% range.</td>
                <td className={TOOL_INFO_TABLE_CELL_CLASS}>Protect easy points and drill hard-module misses.</td>
              </tr>
              <tr className={TOOL_INFO_TABLE_ROW_CLASS}>
                <td className={TOOL_INFO_TABLE_CELL_CLASS}>75th-94th</td>
                <td className={TOOL_INFO_TABLE_CELL_CLASS}>Above average to strong; section split determines the best improvement path.</td>
                <td className={TOOL_INFO_TABLE_CELL_CLASS}>Use the score calculator and drill the weaker section.</td>
              </tr>
              <tr className={TOOL_INFO_TABLE_ROW_CLASS}>
                <td className={TOOL_INFO_TABLE_CELL_CLASS}>Below 75th</td>
                <td className={TOOL_INFO_TABLE_CELL_CLASS}>There is likely broad score upside from fundamentals and pacing.</td>
                <td className={TOOL_INFO_TABLE_CELL_CLASS}>Start with easy/medium bank questions and review every miss.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </SatToolPageScaffold>
  );
};

export default SatPercentileCalculator;
