import { Link, useLocation, Navigate } from "react-router-dom";

import {
  PageSeo,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
} from "@/components/seo/PageSeo";
import { pillarBySlug } from "@/lib/pillarData";
import { satSkillBySlug } from "@/lib/satSkillsData";
import { blogPostBySlug } from "@/lib/blogData";

const PILLAR_PUBLISHED = "2026-04-01";

const PillarPage = () => {
  const location = useLocation();
  const slug = location.pathname.replace(/^\//, "").replace(/\/$/, "");
  const pillar = pillarBySlug.get(slug);

  if (!pillar) return <Navigate to="/" replace />;

  const url = `https://1600.now/${pillar.slug}`;
  const pillarMtime = new Date().toISOString().slice(0, 10);

  const relatedSkills = (pillar.relatedSkillSlugs ?? [])
    .map((s) => satSkillBySlug.get(s))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const relatedPillars = (pillar.relatedPillarSlugs ?? [])
    .map((s) => pillarBySlug.get(s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const relatedBlogs = (pillar.relatedBlogSlugs ?? [])
    .map((s) => blogPostBySlug.get(s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

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
            dateModified: pillarMtime,
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
          {section.body.map((p, i) => (
            <p key={i} className="mt-3 text-muted-foreground">
              {p}
            </p>
          ))}
          {section.list && (
            <ul className="mt-3 list-disc space-y-1 pl-6 text-muted-foreground">
              {section.list.map((li) => (
                <li key={li}>{li}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">FAQs</h2>
        <div className="mt-4 space-y-5">
          {pillar.faqs.map((f) => (
            <div key={f.question}>
              <h3 className="text-base font-semibold">{f.question}</h3>
              <p className="mt-1 text-muted-foreground">{f.answer}</p>
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
            {relatedSkills.map((s) => (
              <li key={s.slug}>
                <Link
                  to={`/sat-skill/${s.slug}`}
                  className="block rounded-xl border border-border p-4 transition hover:bg-muted"
                >
                  <div className="font-semibold">{s.name}</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {s.shortDescription}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {relatedPillars.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            Related Guides
          </h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {relatedPillars.map((p) => (
              <li key={p.slug}>
                <Link
                  to={`/${p.slug}`}
                  className="block rounded-xl border border-border p-4 transition hover:bg-muted"
                >
                  <div className="font-semibold">{p.title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {p.metaDescription}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {relatedBlogs.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            Related Blog Posts
          </h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {relatedBlogs.map((b) => (
              <li key={b.slug}>
                <Link
                  to={`/blog/${b.slug}`}
                  className="block rounded-xl border border-border p-4 transition hover:bg-muted"
                >
                  <div className="font-semibold">{b.title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {b.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pillar.relatedScoreTargets && pillar.relatedScoreTargets.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            Score Targets
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {pillar.relatedScoreTargets.map((n) => (
              <li key={n}>
                <Link
                  to={`/sat-score/${n}`}
                  className="inline-block rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  {n} SAT
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

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
