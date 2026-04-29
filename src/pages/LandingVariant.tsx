import { Link, useLocation, Navigate } from "react-router-dom";
import { PageSeo, buildFaqJsonLd } from "@/components/seo/PageSeo";
import { landingVariantBySlug } from "@/lib/landingVariants";

const LandingVariant = () => {
  const location = useLocation();
  const slug = location.pathname.replace(/^\//, "").split("/")[0];
  const variant = landingVariantBySlug.get(slug);

  if (!variant) return <Navigate to="/" replace />;

  const canonicalUrl = `https://1600.now/${variant.slug}`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <PageSeo
        id={`landing-${variant.slug}`}
        title={variant.metaTitle}
        description={variant.metaDescription}
        jsonLd={[
          buildFaqJsonLd(variant.faqs.map((f) => ({ question: f.q, answer: f.a }))),
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: variant.metaTitle,
            description: variant.metaDescription,
            url: canonicalUrl,
          },
        ]}
      />

      <section>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{variant.h1}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{variant.subhead}</p>
        <div className="mt-6 space-y-4 text-base leading-relaxed text-foreground/90">
          {variant.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/bank"
            className="inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Start practicing free
          </Link>
          <Link
            to="/score-calculator"
            className="inline-flex items-center rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Score calculator
          </Link>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">What you get</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {variant.features.map((f) => (
            <Link
              key={f.title}
              to={f.href}
              className="rounded-xl border border-border bg-card p-5 transition hover:border-foreground/40"
            >
              <div className="text-base font-semibold">{f.title}</div>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">{variant.keyword} FAQs</h2>
        <div className="mt-4 space-y-4">
          {variant.faqs.map((f, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4">
              <div className="font-semibold">{f.q}</div>
              <p className="mt-2 text-sm text-foreground/80">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-border bg-card/60 p-6">
        <h2 className="text-xl font-semibold">Explore more SAT prep</h2>
        <ul className="mt-3 grid gap-2 text-sm text-foreground/90 sm:grid-cols-2">
          <li>
            <Link to="/bank" className="hover:underline">SAT Question Bank</Link>
          </li>
          <li>
            <Link to="/modules" className="hover:underline">Practice Tests</Link>
          </li>
          <li>
            <Link to="/score-calculator" className="hover:underline">SAT Score Calculator</Link>
          </li>
          <li>
            <Link to="/sat-vocabulary" className="hover:underline">SAT Vocabulary List</Link>
          </li>
          <li>
            <Link to="/sat-skill" className="hover:underline">SAT Skills Hub</Link>
          </li>
          <li>
            <Link to="/blog" className="hover:underline">SAT Prep Blog</Link>
          </li>
        </ul>
      </section>
    </div>
  );
};

export default LandingVariant;
