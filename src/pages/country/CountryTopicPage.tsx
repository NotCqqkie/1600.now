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
  countryPages,
} from "@/lib/seo-data/countryHubData";
import {
  CountryActionLink,
  CountryFaqSection,
  CountrySections,
} from "./countryContentBlocks";
import { countryPageClasses } from "./countryPageClasses";

const ACTION_PLAN_ROWS = [
  [
    "Should I take the SAT?",
    "Whether your target universities accept or value SAT scores.",
    "Compare college score targets, then set a 1600-scale goal.",
  ],
  [
    "When should I test?",
    "School exams, application deadlines, and retake room.",
    "Pick a date and count backward into weekly modules and drills.",
  ],
  [
    "What should I practice first?",
    "Your weaker section and the skills causing repeated misses.",
    "Start a targeted bank drill before taking another timed module.",
  ],
] as const;

const CTA_LINKS = [
  { to: "/bank", label: "Start targeted practice" },
  { to: "/modules", label: "Take timed modules" },
  { to: "/what-sat-score-do-i-need", label: "Compare college scores" },
] as const;

const CountryTopicPage = () => {
  const location = useLocation();
  const slug = location.pathname.replace(/^\//, "").replace(/\/$/, "");
  const page = countryPageBySlug.get(slug);

  if (!page) return <Navigate to="/" replace />;

  const hub = countryHubByCode.get(page.country);
  if (!hub) return <Navigate to={`/${page.country}`} replace />;

  const url = `https://1600.now/${page.slug}`;
  const hubUrl = `https://1600.now/${hub.hubSlug}`;

  const countryTopics = countryPages.filter((topic) => topic.country === page.country);
  const topicIndex = countryTopics.findIndex((topic) => topic.slug === page.slug);
  const siblingPages = [1, 2, 3]
    .map((offset) => countryTopics[(topicIndex + offset) % countryTopics.length])
    .filter((sibling) => sibling.slug !== page.slug);

  return (
    <div className={countryPageClasses.page}>
      <PageSeo
        id={`country-page-${page.slug}`}
        title={page.metaTitle}
        description={page.metaDescription}
        canonical={url}
        type="article"
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

      <nav className={countryPageClasses.nav}>
        <Link className={countryPageClasses.homeLink} to="/">
          Home
        </Link>{" "}
        ›{" "}
        <Link className={countryPageClasses.homeLink} to={`/${hub.hubSlug}`}>
          {hub.name}
        </Link>{" "}
        › <span className={countryPageClasses.navCurrent}>{page.headline}</span>
      </nav>

      <h1 className={countryPageClasses.title}>
        {page.headline}
      </h1>
      <p className={countryPageClasses.intro}>{page.intro}</p>

      <CountrySections sections={page.sections} />

      <section className={countryPageClasses.section}>
        <h2 className={countryPageClasses.sectionTitle}>
          Student action plan
        </h2>
        <p className={countryPageClasses.paragraph}>
          Use this page to make a concrete admissions or prep decision, then test that decision in the actual 1600.now tools.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-muted/70">
              <tr>
                <th className="px-4 py-3 font-semibold">Decision</th>
                <th className="px-4 py-3 font-semibold">What to check</th>
                <th className="px-4 py-3 font-semibold">Next action</th>
              </tr>
            </thead>
            <tbody>
              {ACTION_PLAN_ROWS.map((row) => (
                <tr key={row[0]} className="border-t border-border">
                  {row.map((cell) => (
                    <td key={cell} className={countryPageClasses.tableCell}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <CountryFaqSection faqs={page.faqs} />

      <section className={countryPageClasses.section}>
        <h2 className={countryPageClasses.sectionTitle}>
          More SAT guides for {hub.name} students
        </h2>
        <ul className="mt-4 space-y-3">
          {siblingPages.map((sibling) => (
            <li key={sibling.slug} className={countryPageClasses.topicCard}>
              <Link to={`/${sibling.slug}`} className={countryPageClasses.topicLink}>
                {sibling.headline}
              </Link>
              <p className={countryPageClasses.topicDescription}>
                {sibling.metaDescription}
              </p>
            </li>
          ))}
        </ul>
        <p className={countryPageClasses.paragraph}>
          Browse every guide on the{" "}
          <Link className="underline" to={`/${hub.hubSlug}`}>
            Digital SAT in {hub.name}
          </Link>{" "}
          hub.
        </p>
      </section>

      <section className={countryPageClasses.card}>
        <h2 className="text-xl font-semibold tracking-tight">
          Keep working on 1600.now
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {CTA_LINKS.map((link) => (
            <CountryActionLink key={link.to} to={link.to} label={link.label} />
          ))}
        </div>
      </section>
    </div>
  );
};

export default CountryTopicPage;
