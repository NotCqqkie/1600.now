import { Link, useLocation, Navigate } from "react-router-dom";

import {
  PageSeo,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
} from "@/components/seo/PageSeo";
import { pillarBySlug } from "@/lib/seo-data/pillarData";
import { satSkillBySlug } from "@/lib/seo-data/satSkillsData";

const PILLAR_PUBLISHED = "2026-04-01";

const skillPracticeHref = (skill: NonNullable<ReturnType<typeof satSkillBySlug.get>>) =>
  `/bank/${skill.section === "Math" ? "math" : "reading"}/skill/${encodeURIComponent(skill.officialSkill)}`;

const PillarPage = () => {
  const location = useLocation();
  const slug = location.pathname.replace(/^\//, "").replace(/\/$/, "");
  const pillar = pillarBySlug.get(slug);

  if (!pillar) return <Navigate to="/" replace />;

  const url = `https://1600.now/${pillar.slug}`;

  const relatedSkills = (pillar.relatedSkillSlugs ?? [])
    .map((relatedSlug) => satSkillBySlug.get(relatedSlug))
    .filter((relatedSkill): relatedSkill is NonNullable<typeof relatedSkill> => Boolean(relatedSkill));

  return (
    <article className="mx-auto max-w-3xl px-6 py-10">
      <PageSeo
        id={`pillar-${pillar.slug}`}
        title={pillar.metaTitle}
        description={pillar.metaDescription}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: pillar.title, url },
          ]),
          buildArticleJsonLd({
            title: pillar.title,
            description: pillar.metaDescription,
            url,
            datePublished: PILLAR_PUBLISHED,
          }),
          buildFaqJsonLd(pillar.faqs),
        ]}
      />

      <nav className="mb-6 text-sm text-muted-foreground">
        <Link className="hover:underline" to="/">
          Home
        </Link>{" "}
        › <span className="text-foreground">{pillar.title}</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          {pillar.title}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{pillar.heroIntro}</p>
      </header>

      {pillar.sections.map((section) => (
        <section key={section.heading} className="mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">
            {section.heading}
          </h2>
          {section.body.map((paragraph, paragraphIndex) => (
            <p key={paragraphIndex} className="mt-3 text-muted-foreground">
              {paragraph}
            </p>
          ))}
          {section.list && (
            <ul className="mt-3 list-disc space-y-1 pl-6 text-muted-foreground">
              {section.list.map((listItem) => (
                <li key={listItem}>{listItem}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          How to use this guide in one practice session
        </h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-muted/70">
              <tr>
                <th className="px-4 py-3 font-semibold">Step</th>
                <th className="px-4 py-3 font-semibold">Work</th>
                <th className="px-4 py-3 font-semibold">Output</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">1</td>
                <td className="px-4 py-3 text-muted-foreground">Read the guide and write the three rules or decisions that matter most.</td>
                <td className="px-4 py-3 text-muted-foreground">A short checklist you can use during questions.</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">2</td>
                <td className="px-4 py-3 text-muted-foreground">Drill the related bank skills below for 30-45 minutes.</td>
                <td className="px-4 py-3 text-muted-foreground">A miss log sorted by skill instead of by page.</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">3</td>
                <td className="px-4 py-3 text-muted-foreground">Take a timed module and watch whether the same mistakes repeat.</td>
                <td className="px-4 py-3 text-muted-foreground">Proof that the guide transferred to timed work.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">FAQs</h2>
        <div className="mt-4 space-y-5">
          {pillar.faqs.map((faq) => (
            <div key={faq.question}>
              <h3 className="text-base font-semibold">{faq.question}</h3>
              <p className="mt-1 text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {relatedSkills.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            Related SAT Skills
          </h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {relatedSkills.map((skill) => (
              <li key={skill.slug}>
                <Link
                  to={skillPracticeHref(skill)}
                  className="block rounded-xl border border-border p-4 transition hover:bg-muted"
                >
                  <div className="font-semibold">{skill.name}</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {skill.shortDescription}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          Use this guide in practice
        </h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          <li>
            <Link
              to="/bank"
              className="block rounded-xl border border-border p-4 transition hover:bg-muted"
            >
              <div className="font-semibold">Drill targeted questions</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Filter the bank by section, domain, skill, and difficulty.
              </p>
            </Link>
          </li>
          <li>
            <Link
              to="/modules"
              className="block rounded-xl border border-border p-4 transition hover:bg-muted"
            >
              <div className="font-semibold">Take timed modules</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Check whether the strategy holds up under real pacing.
              </p>
            </Link>
          </li>
          <li>
            <Link
              to="/score-calculator"
              className="block rounded-xl border border-border p-4 transition hover:bg-muted"
            >
              <div className="font-semibold">Model your score</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Convert module results into a 400-1600 estimate.
              </p>
            </Link>
          </li>
        </ul>
      </section>

      <section className="mt-12 rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold">Practice on 1600.now</h3>
        <p className="mt-2 text-muted-foreground">
          Run the numbers in the{" "}
          <Link className="underline" to="/score-calculator">
            SAT score calculator
          </Link>
          , take a{" "}
          <Link className="underline" to="/modules">
            full Digital SAT module
          </Link>
          , or drill targeted skills in the{" "}
          <Link className="underline" to="/bank">
            question bank
          </Link>
          .
        </p>
      </section>
    </article>
  );
};

export default PillarPage;
