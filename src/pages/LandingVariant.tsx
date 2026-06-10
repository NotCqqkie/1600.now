import { Link, useLocation, Navigate } from "react-router-dom";
import {
  PageSeo,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
} from "@/components/seo/PageSeo";
import { landingVariantBySlug } from "@/lib/seo-data/landingVariants";

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
        canonical={canonicalUrl}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: variant.h1, url: canonicalUrl },
          ]),
          buildFaqJsonLd(variant.faqs.map((faq) => ({ question: faq.q, answer: faq.a }))),
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: variant.metaTitle,
            description: variant.metaDescription,
            url: canonicalUrl,
            isPartOf: {
              "@type": "WebSite",
              name: "1600.now",
              url: "https://1600.now/",
            },
          },
        ]}
      />

      <section>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{variant.h1}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{variant.subhead}</p>
        <div className="mt-6 space-y-4 text-base leading-relaxed text-foreground/90">
          {variant.intro.map((paragraph, paragraphIndex) => (
            <p key={paragraphIndex}>{paragraph}</p>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/bank"
            className="inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-cobalt hover:text-white"
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
          {variant.features.map((feature) => (
            <Link
              key={feature.title}
              to={feature.href}
              className="rounded-xl border border-border bg-card p-5 transition hover:border-foreground/40"
            >
              <div className="text-base font-semibold">{feature.title}</div>
              <p className="mt-2 text-sm text-muted-foreground">{feature.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">{variant.keyword} FAQs</h2>
        <div className="mt-4 space-y-4">
          {variant.faqs.map((faq, faqIndex) => (
            <div key={faqIndex} className="rounded-lg border border-border bg-card p-4">
              <div className="font-semibold">{faq.q}</div>
              <p className="mt-2 text-sm text-foreground/80">{faq.a}</p>
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
          <li>
            <Link to="/sat-resources" className="hover:underline">SAT Resources</Link>
          </li>
        </ul>
      </section>
    </div>
  );
};

export default LandingVariant;
