import { Link } from "react-router-dom";
import { PageSeo, buildFaqJsonLd } from "@/components/seo/PageSeo";
import { satFaqPages } from "@/lib/seo-data/satFaqData";

const SatFaqIndex = () => {
  const title = "SAT FAQ: Answers to the Most Common SAT Questions";
  const description =
    "Answers to the most-searched SAT questions — test length, calculator rules, scoring, percentiles, fee waivers, and more.";

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <PageSeo
        id="sat-faq-index"
        title={title}
        description={description}
        jsonLd={buildFaqJsonLd(
          satFaqPages.map((p) => ({ question: p.question, answer: p.shortAnswer })),
        )}
      />

      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">SAT FAQ</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Quick answers to the most-searched SAT questions. Click through for a full explanation of each.
      </p>

      <ul className="mt-8 space-y-3">
        {satFaqPages.map((p) => (
          <li key={p.slug}>
            <Link
              to={`/sat-faq/${p.slug}`}
              className="block rounded-lg border border-border bg-card p-4 transition hover:border-foreground/40"
            >
              <div className="font-semibold">{p.question}</div>
              <p className="mt-1 text-sm text-muted-foreground">{p.shortAnswer}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SatFaqIndex;
