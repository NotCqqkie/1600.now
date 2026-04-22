import { Link, Navigate, useLocation } from "react-router-dom";

import {
  PageSeo,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
} from "@/components/seo/PageSeo";
import {
  countryHubByCode,
  countryPages,
  hreflangGroup,
  type CountryHubConfig,
} from "@/lib/countryHubData";

const CountryHubPage = () => {
  const location = useLocation();
  const code = location.pathname.replace(/^\//, "").replace(/\/$/, "");
  const hub: CountryHubConfig | undefined =
    code === "in" || code === "ae" ? countryHubByCode.get(code) : undefined;

  if (!hub) return <Navigate to="/" replace />;

  const url = `https://1600.now/${hub.hubSlug}`;
  const topicPages = countryPages.filter((p) => p.country === hub.code);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <PageSeo
        id={`country-hub-${hub.code}`}
        title={hub.hubTitle}
        description={hub.hubDescription}
        canonical={url}
        alternates={hreflangGroup}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: hub.name, url },
          ]),
          buildFaqJsonLd(hub.hubFaqs),
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: hub.hubTitle,
            description: hub.hubDescription,
            url,
            inLanguage: hub.language,
            isPartOf: {
              "@type": "WebSite",
              name: "1600.now",
              url: "https://1600.now/",
            },
          },
        ]}
      />

      <nav className="mb-6 text-sm text-muted-foreground">
        <Link className="hover:underline" to="/">
          Home
        </Link>{" "}
        › <span className="text-foreground">Digital SAT in {hub.name}</span>
      </nav>

      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
        {hub.hubTitle}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">{hub.hubIntro}</p>

      {hub.hubSections.map((s) => (
        <section key={s.heading} className="mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">
            {s.heading}
          </h2>
          {s.paragraphs.map((p, i) => (
            <p key={i} className="mt-3 text-muted-foreground">
              {p}
            </p>
          ))}
          {s.bullets && s.bullets.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-6 text-muted-foreground">
              {s.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {topicPages.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">
            More for {hub.name} students
          </h2>
          <ul className="mt-4 space-y-3">
            {topicPages.map((p) => (
              <li
                key={p.slug}
                className="rounded-xl border border-border p-4"
              >
                <Link
                  to={`/${p.slug}`}
                  className="text-base font-semibold hover:underline"
                >
                  {p.headline}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {p.metaDescription}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">FAQs</h2>
        <div className="mt-4 space-y-5">
          {hub.hubFaqs.map((f) => (
            <div key={f.question}>
              <h3 className="text-base font-semibold">{f.question}</h3>
              <p className="mt-1 text-muted-foreground">{f.answer}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CountryHubPage;
