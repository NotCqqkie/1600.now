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
        type="article"
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
        <h2 className="text-2xl font-semibold tracking-tight">
          Student action plan
        </h2>
        <p className="mt-3 text-muted-foreground">
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
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">Should I take the SAT?</td>
                <td className="px-4 py-3 text-muted-foreground">Whether your target universities accept or value SAT scores.</td>
                <td className="px-4 py-3 text-muted-foreground">Compare college score targets, then set a 1600-scale goal.</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">When should I test?</td>
                <td className="px-4 py-3 text-muted-foreground">School exams, application deadlines, and retake room.</td>
                <td className="px-4 py-3 text-muted-foreground">Pick a date and count backward into weekly modules and drills.</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">What should I practice first?</td>
                <td className="px-4 py-3 text-muted-foreground">Your weaker section and the skills causing repeated misses.</td>
                <td className="px-4 py-3 text-muted-foreground">Start a targeted bank drill before taking another timed module.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

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
        <h2 className="text-xl font-semibold tracking-tight">
          Keep working on 1600.now
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to="/bank"
            className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
          >
            Start targeted practice
          </Link>
          <Link
            to="/modules"
            className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
          >
            Take timed modules
          </Link>
          <Link
            to="/what-sat-score-do-i-need"
            className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
          >
            Compare college scores
          </Link>
        </div>
      </section>
    </div>
  );
};

export default CountryTopicPage;
