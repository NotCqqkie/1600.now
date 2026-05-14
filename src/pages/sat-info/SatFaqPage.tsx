import { Link, useParams, Navigate } from "react-router-dom";
import { PageSeo, buildFaqJsonLd, buildBreadcrumbJsonLd } from "@/components/seo/PageSeo";
import { satFaqPageBySlug, satFaqPages } from "@/lib/seo-data/satFaqData";

const SatFaqPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const page = slug ? satFaqPageBySlug.get(slug) : undefined;

  if (!page) return <Navigate to="/sat-faq" replace />;

  const url = `https://1600.now/sat-faq/${page.slug}`;

  const related = (page.relatedSlugs ?? [])
    .map((s) => satFaqPageBySlug.get(s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <PageSeo
        id={`sat-faq-${page.slug}`}
        title={page.metaTitle}
        description={page.metaDescription}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "1600.now", url: "https://1600.now/" },
            { name: "SAT FAQ", url: "https://1600.now/sat-faq" },
            { name: page.question, url },
          ]),
          buildFaqJsonLd([{ question: page.question, answer: page.shortAnswer }]),
        ]}
      />

      <nav className="text-sm text-muted-foreground">
        <Link to="/sat-faq" className="hover:underline">SAT FAQ</Link>
        <span className="mx-2">/</span>
        <span>{page.question}</span>
      </nav>

      <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">{page.question}</h1>
      <p className="mt-4 text-lg font-medium text-foreground">{page.shortAnswer}</p>

      <div className="mt-10 space-y-10">
        {page.sections.map((s, i) => (
          <section key={i}>
            <h2 className="text-2xl font-semibold">{s.heading}</h2>
            <div className="mt-3 space-y-3 text-foreground/90">
              {s.body.map((p, j) => (
                <p key={j}>{p}</p>
              ))}
            </div>
            {s.list && (
              <ul className="mt-3 list-disc space-y-1 pl-6 text-foreground/90">
                {s.list.map((li, j) => (
                  <li key={j}>{li}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">Related SAT questions</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {related.map((r) => (
              <li key={r.slug}>
                <Link to={`/sat-faq/${r.slug}`} className="text-foreground/80 hover:underline">
                  {r.question}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12 rounded-2xl border border-border bg-card/60 p-6">
        <h2 className="text-lg font-semibold">Ready to practice?</h2>
        <p className="mt-2 text-sm text-foreground/90">
          Drill free SAT questions by skill, take timed modules, and project your 1600-scale score.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link to="/bank" className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            Question bank
          </Link>
          <Link to="/score-calculator" className="rounded-lg border border-border px-5 py-2 text-sm font-semibold text-foreground hover:bg-muted">
            Score calculator
          </Link>
        </div>
      </section>

      <section className="mt-12 text-sm text-muted-foreground">
        <Link to="/sat-faq" className="hover:underline">← All SAT FAQs ({satFaqPages.length})</Link>
      </section>
    </div>
  );
};

export default SatFaqPage;
