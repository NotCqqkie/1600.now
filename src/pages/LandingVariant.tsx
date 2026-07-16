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
        <h2 className="text-2xl font-semibold">First session plan</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-muted/70">
              <tr>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Do this</th>
                <th className="px-4 py-3 font-semibold">Why it matters</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">10 min</td>
                <td className="px-4 py-3 text-muted-foreground">Open the question bank and pick one Math skill plus one Reading and Writing skill.</td>
                <td className="px-4 py-3 text-muted-foreground">A narrow start gives cleaner data than random mixed practice.</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">35 min</td>
                <td className="px-4 py-3 text-muted-foreground">Do a focused drill and write down every miss type.</td>
                <td className="px-4 py-3 text-muted-foreground">The miss pattern tells you what to study next.</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">35 min</td>
                <td className="px-4 py-3 text-muted-foreground">Take a timed module or short timed set.</td>
                <td className="px-4 py-3 text-muted-foreground">Timed work proves whether the skill transfers under SAT pressure.</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">10 min</td>
                <td className="px-4 py-3 text-muted-foreground">Use the score calculator or review page to choose the next drill.</td>
                <td className="px-4 py-3 text-muted-foreground">The next session should be based on data, not vibes.</td>
              </tr>
            </tbody>
          </table>
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
            <Link to="/vocab" className="hover:underline">SAT Vocabulary Practice</Link>
          </li>
          <li>
            <Link to="/free-sat-prep" className="hover:underline">Free SAT Prep</Link>
          </li>
          <li>
            <Link to="/sat-math-practice" className="hover:underline">SAT Math Practice</Link>
          </li>
          <li>
            <Link to="/sat-reading-practice" className="hover:underline">Reading and Writing Practice</Link>
          </li>
          <li>
            <Link to="/hard" className="hover:underline">100 Hard Math Questions</Link>
          </li>
        </ul>
      </section>
    </div>
  );
};

export default LandingVariant;
