import { Link, Navigate, useLocation } from "react-router-dom";

import {
  PageSeo,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
} from "@/components/seo/PageSeo";
import {
  countryHubByCode,
  countryPages,
} from "@/lib/seo-data/countryHubData";
import { hreflangGroup } from "@/lib/seo-data/hreflangData";
import {
  CountryFaqSection,
  CountrySections,
} from "./countryContentBlocks";
import { countryPageClasses } from "./countryPageClasses";

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
  const hub = code === "in" || code === "ae" ? countryHubByCode.get(code) : undefined;

  if (!hub) return <Navigate to="/" replace />;

  const url = `https://1600.now/${hub.hubSlug}`;
  const topicPages = countryPages.filter((countryPage) => countryPage.country === hub.code);

  return (
    <div className={countryPageClasses.page}>
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

      <nav className={countryPageClasses.nav}>
        <Link className={countryPageClasses.homeLink} to="/">
          Home
        </Link>{" "}
        › <span className={countryPageClasses.navCurrent}>Digital SAT in {hub.name}</span>
      </nav>

      <h1 className={countryPageClasses.title}>
        {hub.hubTitle}
      </h1>
      <p className={countryPageClasses.intro}>{hub.hubIntro}</p>

      <CountrySections sections={hub.hubSections} />

      <section className={countryPageClasses.card}>
        <h2 className={countryPageClasses.sectionTitle}>
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
        <section className={countryPageClasses.section}>
          <h2 className={countryPageClasses.sectionTitle}>
            More for {hub.name} students
          </h2>
          <ul className="mt-4 space-y-3">
            {topicPages.map((topicPage) => {
              const action = countryTopicActionFor(topicPage.slug);
              return (
                <li
                  key={topicPage.slug}
                  className={countryPageClasses.topicCard}
                >
                  <Link
                    to={`/${topicPage.slug}`}
                    className={countryPageClasses.topicLink}
                  >
                    {topicPage.headline}
                  </Link>
                  <p className={countryPageClasses.topicDescription}>
                    {topicPage.metaDescription}
                  </p>
                  <Link
                    to={action.href}
                    className="mt-3 block text-sm font-semibold"
                  >
                    {action.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <CountryFaqSection faqs={hub.hubFaqs} />
    </div>
  );
};

export default CountryHubPage;
