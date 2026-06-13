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
} from "@/lib/seo-data/countryHubData";

const countryTopicActionFor = (slug: string) => {
  if (slug.includes("score") || slug.includes("scholarship") || slug.includes("universities")) {
    return { href: "/what-sat-score-do-i-need", label: "Compare college score targets" };
  }
  if (slug.includes("date") || slug.includes("fee") || slug.includes("test-centers") || slug.includes("dubai") || slug.includes("abu-dhabi")) {
    return { href: "/sat-test-countdown", label: "Open SAT countdown" };
  }
  if (slug.includes("preparation")) {
    return { href: "/bank", label: "Start SAT practice" };
  }
  return { href: "/modules", label: "Take timed modules" };
};

const CountryHubPage = () => {
  const location = useLocation();
  const code = location.pathname.replace(/^\//, "").replace(/\/$/, "");
  const hub: CountryHubConfig | undefined =
    code === "in" || code === "ae" ? countryHubByCode.get(code) : undefined;

  if (!hub) return <Navigate to="/" replace />;

  const url = `https://1600.now/${hub.hubSlug}`;
  const topicPages = countryPages.filter((countryPage) => countryPage.country === hub.code);

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

      {hub.hubSections.map((section) => (
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

      <section className="mt-10 rounded-xl border border-border p-5">
        <h2 className="text-2xl font-semibold tracking-tight">
          Best way to start from {hub.name}
        </h2>
        <ol className="mt-4 list-decimal space-y-2 pl-6 text-muted-foreground">
          <li>Set a target score using the colleges or programs you actually plan to apply to.</li>
          <li>Take one timed module to find whether Math or Reading and Writing is currently weaker.</li>
          <li>Run targeted bank drills for the weakest skills before booking another full practice test.</li>
          <li>Pick a test date that leaves room for a retake before application deadlines.</li>
        </ol>
      </section>

      {topicPages.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">
            More for {hub.name} students
          </h2>
          <ul className="mt-4 space-y-3">
            {topicPages.map((topicPage) => {
              const action = countryTopicActionFor(topicPage.slug);
              return (
                <li
                  key={topicPage.slug}
                  className="rounded-xl border border-border p-4"
                >
                  <Link
                    to={action.href}
                    className="text-base font-semibold hover:underline"
                  >
                    {topicPage.headline}
                  </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {topicPage.metaDescription}
                </p>
                  <div className="mt-3 text-sm font-semibold">{action.label}</div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">FAQs</h2>
        <div className="mt-4 space-y-5">
          {hub.hubFaqs.map((faq) => (
            <div key={faq.question}>
              <h3 className="text-base font-semibold">{faq.question}</h3>
              <p className="mt-1 text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CountryHubPage;
