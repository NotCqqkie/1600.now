import { Link } from "react-router-dom";

import { PageSeo, buildBreadcrumbJsonLd } from "@/components/seo/PageSeo";
import { allSatScores } from "@/lib/satScoreData";

const title = "SAT Score Breakdowns: Every 400–1600 SAT Score Explained";
const description =
  "Browse detailed breakdowns of every Digital SAT score from 400 to 1600. See the percentile, target colleges, and study plan for your SAT score.";

const SatScoreIndex = () => {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <PageSeo
        id="sat-score-index"
        title={title}
        description={description}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: "SAT Scores", url: "https://1600.now/sat-score" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: title,
            description,
            url: "https://1600.now/sat-score",
          },
        ]}
      />

      <header className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight">
          SAT Score Breakdowns: Every Score From 400 to 1600
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Pick any Digital SAT score to see its percentile, how it compares to
          other students, which colleges it is competitive for, and a focused
          study plan to raise it. Use our{" "}
          <Link className="underline" to="/score-calculator">
            Digital SAT score calculator
          </Link>{" "}
          to estimate your own score first.
        </p>
      </header>

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {allSatScores.map((score) => (
          <li key={score}>
            <Link
              to={`/sat-score/${score}`}
              className="block rounded-md border border-border px-3 py-2 text-center text-sm font-mono transition hover:bg-muted"
            >
              {score}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SatScoreIndex;
