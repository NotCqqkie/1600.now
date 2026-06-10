import { Link, Navigate, useLocation } from "react-router-dom";

import {
  PageSeo,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
} from "@/components/seo/PageSeo";
import {
  countryHubByCode,
  countryPageBySlug,
} from "@/lib/seo-data/countryHubData";

const CountryTopicPage = () => {
  const location = useLocation();
  const slug = location.pathname.replace(/^\//, "").replace(/\/$/, "");
  const page = countryPageBySlug.get(slug);

  if (!page) return <Navigate to="/" replace />;

  const hub = countryHubByCode.get(page.country);
  if (!hub) return <Navigate to={`/${page.country}`} replace />;

  const url = `https://1600.now/${page.slug}`;
  const hubUrl = `https://1600.now/${hub.hubSlug}`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <PageSeo
        id={`country-page-${page.slug}`}
        title={page.metaTitle}
        description={page.metaDescription}
        canonical={url}
        alternates={[
          { hreflang: page.language, href: url },
          { hreflang: "x-default", href: "https://1600.now/" },
        ]}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: hub.name, url: hubUrl },
            { name: page.headline, url },
          ]),
          buildArticleJsonLd({
            title: page.metaTitle,
            description: page.metaDescription,
            url,
            datePublished: "2026-04-20",
          }),
          buildFaqJsonLd(page.faqs),
        ]}
      />

      <nav className="mb-6 text-sm text-muted-foreground">
        <Link className="hover:underline" to="/">
          Home
        </Link>{" "}
        ›{" "}
        <Link className="hover:underline" to={`/${hub.hubSlug}`}>
          {hub.name}
        </Link>{" "}
        › <span className="text-foreground">{page.headline}</span>
      </nav>

      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
        {page.headline}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">{page.intro}</p>

      {page.sections.map((section) => (
        <section key={section.heading} className="mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">
            {section.heading}
          </h2>
          {section.paragraphs.map((paragraph, paragraphIndex) => (
            <p key={paragraphIndex} className="mt-3 text-muted-foreground">
              {paragraph}
            </p>
          ))}
          {section.bullets && section.bullets.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-6 text-muted-foreground">
              {section.bullets.map((bullet, bulletIndex) => (
                <li key={bulletIndex}>{bullet}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">FAQs</h2>
        <div className="mt-4 space-y-5">
          {page.faqs.map((faq) => (
            <div key={faq.question}>
              <h3 className="text-base font-semibold">{faq.question}</h3>
              <p className="mt-1 text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-xl border border-border p-5">
        <Link
          to={`/${hub.hubSlug}`}
          className="text-base font-semibold hover:underline"
        >
          ← Back to Digital SAT in {hub.name}
        </Link>
      </section>
    </div>
  );
};

export default CountryTopicPage;
