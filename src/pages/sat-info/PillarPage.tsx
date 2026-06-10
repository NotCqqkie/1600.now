import { Link, useLocation, Navigate } from "react-router-dom";

import {
  PageSeo,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
} from "@/components/seo/PageSeo";
import { pillarBySlug } from "@/lib/seo-data/pillarData";
import { satSkillBySlug } from "@/lib/seo-data/satSkillsData";
import { blogPostBySlug } from "@/lib/seo-data/blogData";

const PILLAR_PUBLISHED = "2026-04-01";

const PillarPage = () => {
  const location = useLocation();
  const slug = location.pathname.replace(/^\//, "").replace(/\/$/, "");
  const pillar = pillarBySlug.get(slug);

  if (!pillar) return <Navigate to="/" replace />;

  const url = `https://1600.now/${pillar.slug}`;

  const relatedSkills = (pillar.relatedSkillSlugs ?? [])
    .map((relatedSlug) => satSkillBySlug.get(relatedSlug))
    .filter((relatedSkill): relatedSkill is NonNullable<typeof relatedSkill> => Boolean(relatedSkill));

  const relatedPillars = (pillar.relatedPillarSlugs ?? [])
    .map((relatedSlug) => pillarBySlug.get(relatedSlug))
    .filter((relatedPillar): relatedPillar is NonNullable<typeof relatedPillar> => Boolean(relatedPillar));

  const relatedBlogs = (pillar.relatedBlogSlugs ?? [])
    .map((relatedSlug) => blogPostBySlug.get(relatedSlug))
    .filter((relatedPost): relatedPost is NonNullable<typeof relatedPost> => Boolean(relatedPost));

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
                  to={`/sat-skill/${skill.slug}`}
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

      {relatedPillars.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            Related Guides
          </h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {relatedPillars.map((relatedPillar) => (
              <li key={relatedPillar.slug}>
                <Link
                  to={`/${relatedPillar.slug}`}
                  className="block rounded-xl border border-border p-4 transition hover:bg-muted"
                >
                  <div className="font-semibold">{relatedPillar.title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {relatedPillar.metaDescription}
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
            {relatedBlogs.map((blogPost) => (
              <li key={blogPost.slug}>
                <Link
                  to={`/blog/${blogPost.slug}`}
                  className="block rounded-xl border border-border p-4 transition hover:bg-muted"
                >
                  <div className="font-semibold">{blogPost.title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {blogPost.description}
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
            {pillar.relatedScoreTargets.map((scoreTarget) => (
              <li key={scoreTarget}>
                <Link
                  to={`/sat-score/${scoreTarget}`}
                  className="inline-block rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  {scoreTarget} SAT
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
