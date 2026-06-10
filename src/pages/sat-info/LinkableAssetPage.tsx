import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";

import {
  PageSeo,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildItemListJsonLd,
} from "@/components/seo/PageSeo";
import {
  linkableAssetBySlug,
  linkableAssets,
  linkableHubBySlug,
  type LinkableAsset,
} from "@/lib/seo-data/linkableAssets";
import { landingVariantBySlug } from "@/lib/seo-data/landingVariants";
import { pillarBySlug } from "@/lib/seo-data/pillarData";
import { scoreGoalBySlug } from "@/lib/seo-data/scoreGoalData";
import { satSkills } from "@/lib/seo-data/satSkillsData";
import { satToolBySlug } from "@/lib/seo-data/satTools";

const SITE = "https://1600.now";
const ASSET_PUBLISHED = "2026-05-28";

type TextLinkRule = {
  phrases: string[];
  href: string;
};

const skillPracticeHref = (skill: (typeof satSkills)[number]) =>
  `/bank/${skill.section === "Math" ? "math" : "reading"}/skill/${encodeURIComponent(skill.officialSkill)}`;

const skillBySlug = new Map(satSkills.map((skill) => [skill.slug, skill]));

const practiceRule = (slug: string, phrases: string[]): TextLinkRule | null => {
  const skill = skillBySlug.get(slug);
  if (!skill) return null;
  return { phrases, href: skillPracticeHref(skill) };
};

const textLinkRules: TextLinkRule[] = [
  ...satSkills.map((skill) => ({
    phrases: [skill.name, skill.officialSkill],
    href: skillPracticeHref(skill),
  })),
  { phrases: ["Algebra"], href: `/bank/math/domain/${encodeURIComponent("Algebra")}` },
  { phrases: ["Advanced Math"], href: `/bank/math/domain/${encodeURIComponent("Advanced Math")}` },
  {
    phrases: ["Problem-Solving and Data Analysis", "data analysis"],
    href: `/bank/math/domain/${encodeURIComponent("Problem-Solving and Data Analysis")}`,
  },
  {
    phrases: ["Geometry and Trigonometry", "geometry"],
    href: `/bank/math/domain/${encodeURIComponent("Geometry and Trigonometry")}`,
  },
  {
    phrases: ["Information and Ideas"],
    href: `/bank/reading/domain/${encodeURIComponent("Information and Ideas")}`,
  },
  {
    phrases: ["Craft and Structure"],
    href: `/bank/reading/domain/${encodeURIComponent("Craft and Structure")}`,
  },
  {
    phrases: ["Expression of Ideas"],
    href: `/bank/reading/domain/${encodeURIComponent("Expression of Ideas")}`,
  },
  {
    phrases: ["Standard English Conventions"],
    href: `/bank/reading/domain/${encodeURIComponent("Standard English Conventions")}`,
  },
  practiceRule("linear-functions", [
    "slope-intercept form",
    "point-slope form",
    "rate of change",
    "slope",
    "slopes",
    "intercepts",
  ]),
  practiceRule("systems-of-linear-equations", ["systems of equations", "systems", "intersections"]),
  practiceRule("nonlinear-equations-and-systems", ["nonlinear equations", "quadratic formula", "radical equations"]),
  practiceRule("nonlinear-functions", ["quadratics", "quadratic", "vertex form", "exponential growth", "exponentials"]),
  practiceRule("equivalent-expressions", ["equivalent expressions", "factoring", "complete the square"]),
  practiceRule("ratios-rates-proportions", ["ratios", "rates", "proportions", "unit conversions"]),
  practiceRule("percentages", ["percentages", "percent change", "percents", "discounts"]),
  practiceRule("one-variable-data", ["standard deviation", "histograms", "box plots", "dot plots", "one-variable data", "measures of center"]),
  practiceRule("two-variable-data", ["scatterplots", "scatterplot", "regression", "data-model", "best fit"]),
  practiceRule("probability", ["conditional probability", "probability"]),
  practiceRule("sample-statistics-margin-of-error", ["margin of error", "confidence interval", "sample statistic"]),
  practiceRule("evaluating-statistical-claims", ["causation", "correlation", "random samples", "observational studies"]),
  practiceRule("area-and-volume", ["area and volume", "surface area", "volume formulas"]),
  practiceRule("lines-angles-triangles", ["similar triangles", "parallel lines", "angle relationships"]),
  practiceRule("right-triangles-and-trig", ["right triangles", "trigonometry", "SOH-CAH-TOA", "Pythagorean"]),
  practiceRule("circles", ["circle equations", "circle area", "circles"]),
  practiceRule("words-in-context", ["Words in Context", "context clues"]),
  practiceRule("text-structure-and-purpose", ["Text Structure and Purpose", "purpose questions", "rhetorical role"]),
  practiceRule("cross-text-connections", ["Cross-Text Connections", "cross-text"]),
  practiceRule("central-ideas-and-details", ["Central Ideas and Details", "central idea", "main idea"]),
  practiceRule("command-of-evidence", ["Command of Evidence", "evidence questions"]),
  practiceRule("inference", ["inference questions", "inferences"]),
  practiceRule("transitions", ["transition questions", "transitions"]),
  practiceRule("rhetorical-synthesis", ["Rhetorical Synthesis", "rhetorical questions", "synthesis"]),
  practiceRule("boundaries-punctuation", [
    "sentence boundaries",
    "punctuation",
    "commas",
    "semicolons",
    "colons",
    "dashes",
    "comma splice",
    "independent clauses",
    "dependent clauses",
  ]),
  practiceRule("form-structure-sense", [
    "Form, Structure, and Sense",
    "subject-verb agreement",
    "pronoun agreement",
    "modifier placement",
    "modifiers",
    "verb tense",
    "parallel structure",
  ]),
  { phrases: ["SAT score calculator", "score calculator"], href: "/score-calculator" },
  { phrases: ["SAT percentile calculator", "percentile calculator"], href: "/sat-percentile-calculator" },
  { phrases: ["SAT countdown", "countdown"], href: "/sat-test-countdown" },
  { phrases: ["SAT to ACT converter"], href: "/sat-to-act-converter" },
  { phrases: ["PSAT to SAT predictor"], href: "/psat-to-sat-predictor" },
  { phrases: ["study plan generator", "custom plan"], href: "/sat-study-plan-generator" },
  { phrases: ["college score tool"], href: "/what-sat-score-do-i-need" },
  { phrases: ["college directory"], href: "/college" },
  { phrases: ["SAT vocabulary list", "SAT vocabulary"], href: "/sat-vocabulary" },
  { phrases: ["Digital SAT guide"], href: "/digital-sat-guide" },
  { phrases: ["Desmos guide"], href: "/desmos-sat-guide" },
  { phrases: ["Desmos shortcuts"], href: "/desmos-sat-shortcuts" },
  { phrases: ["Desmos"], href: "/desmos-sat-guide" },
  { phrases: ["timed modules", "full Digital SAT module", "practice module", "practice modules", "practice tests", "full tests", "timed tests", "hard Module 2", "Module 2", "Module 1"], href: "/modules" },
  { phrases: ["question bank", "drill sets", "skill drills"], href: "/bank" },
].filter((rule): rule is TextLinkRule => Boolean(rule));

const normalizedTextLinkRules = textLinkRules
  .flatMap((rule) =>
    rule.phrases.map((phrase) => ({
      phrase,
      lowerPhrase: phrase.toLowerCase(),
      href: rule.href,
    })),
  )
  .sort((leftRule, rightRule) => rightRule.phrase.length - leftRule.phrase.length);

const isWordChar = (char: string | undefined) => Boolean(char && /[A-Za-z0-9]/.test(char));

const isSelfHref = (href: string, currentSlug: string) =>
  href.replace(/^\//, "").replace(/\/$/, "") === currentSlug;

const renderLinkedText = (
  text: string,
  currentSlug: string,
  keyPrefix: string,
): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let buffer = "";
  let index = 0;
  let linkIndex = 0;
  const lowerText = text.toLowerCase();

  const flushBuffer = () => {
    if (!buffer) return;
    nodes.push(buffer);
    buffer = "";
  };

  while (index < text.length) {
    const rule = normalizedTextLinkRules.find((candidate) => {
      if (isSelfHref(candidate.href, currentSlug)) return false;
      if (!lowerText.startsWith(candidate.lowerPhrase, index)) return false;
      return !isWordChar(text[index - 1]) && !isWordChar(text[index + candidate.phrase.length]);
    });

    if (rule) {
      flushBuffer();
      const label = text.slice(index, index + rule.phrase.length);
      nodes.push(
        <Link
          key={`${keyPrefix}-${linkIndex}`}
          className="underline underline-offset-2 transition hover:text-foreground"
          to={rule.href}
        >
          {label}
        </Link>,
      );
      linkIndex += 1;
      index += rule.phrase.length;
    } else {
      buffer += text[index];
      index += 1;
    }
  }

  flushBuffer();
  return nodes;
};

const labelForSlug = (slug: string) => {
  const asset = linkableAssetBySlug.get(slug);
  if (asset) return asset.title;
  const hub = linkableHubBySlug.get(slug);
  if (hub) return hub.title;
  const tool = satToolBySlug.get(slug);
  if (tool) return tool.name;
  const pillar = pillarBySlug.get(slug);
  if (pillar) return pillar.title;
  const scoreGoal = scoreGoalBySlug.get(slug);
  if (scoreGoal) return scoreGoal.headline;
  const landingVariant = landingVariantBySlug.get(slug);
  if (landingVariant) return landingVariant.h1;
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const categoryGroups = (assets: LinkableAsset[]) => {
  const groups = new Map<LinkableAsset["category"], LinkableAsset[]>();
  for (const asset of assets) {
    const current = groups.get(asset.category) ?? [];
    current.push(asset);
    groups.set(asset.category, current);
  }
  return groups;
};

const LinkableAssetPage = () => {
  const location = useLocation();
  const slug = location.pathname.replace(/^\//, "").replace(/\/$/, "");
  const asset = linkableAssetBySlug.get(slug);
  const hub = linkableHubBySlug.get(slug);

  if (!asset && !hub) return <Navigate to="/" replace />;

  if (hub) {
    const url = `${SITE}/${hub.slug}`;
    const hubAssets = hub.assetSlugs
      .map((assetSlug) => linkableAssetBySlug.get(assetSlug))
      .filter((item): item is LinkableAsset => Boolean(item));
    const grouped = categoryGroups(hubAssets);

    return (
      <article className="mx-auto max-w-5xl px-6 py-10">
        <PageSeo
          id={`resource-hub-${hub.slug}`}
          title={hub.metaTitle}
          description={hub.metaDescription}
          canonical={url}
          jsonLd={[
            buildBreadcrumbJsonLd([
              { name: "Home", url: `${SITE}/` },
              { name: hub.title, url },
            ]),
            {
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: hub.title,
              description: hub.metaDescription,
              url,
              hasPart: hubAssets.map((item) => ({
                "@type": "CreativeWork",
                name: item.title,
                url: `${SITE}/${item.slug}`,
              })),
            },
            buildItemListJsonLd(
              hub.title,
              hubAssets.map((item) => ({
                name: item.title,
                url: `${SITE}/${item.slug}`,
              })),
            ),
          ]}
        />

        <nav className="mb-6 text-sm text-muted-foreground">
          <Link className="hover:underline" to="/">
            Home
          </Link>{" "}
          › <span className="text-foreground">{hub.title}</span>
        </nav>

        <header className="mb-10">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            {hub.title}
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
            {hub.intro}
          </p>
        </header>

        <div className="grid gap-8">
          {Array.from(grouped.entries()).map(([category, items]) => (
            <section key={category}>
              <h2 className="text-2xl font-semibold tracking-tight">
                {category}
              </h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {items.map((item) => (
                  <Link
                    key={item.slug}
                    to={`/${item.slug}`}
                    className="rounded-lg border border-border p-4 transition hover:bg-muted"
                  >
                    <div className="text-sm font-semibold">{item.title}</div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {item.metaDescription}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    );
  }

  const page = asset!;
  const url = `${SITE}/${page.slug}`;
  const related = (page.relatedSlugs ?? [])
    .filter((relatedSlug) => relatedSlug !== page.slug)
    .slice(0, 6);

  return (
    <article className="mx-auto max-w-4xl px-6 py-10">
      <PageSeo
        id={`resource-${page.slug}`}
        title={page.metaTitle}
        description={page.metaDescription}
        canonical={url}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: `${SITE}/` },
            { name: "SAT Resources", url: `${SITE}/sat-resources` },
            { name: page.title, url },
          ]),
          buildArticleJsonLd({
            title: page.title,
            description: page.metaDescription,
            url,
            datePublished: ASSET_PUBLISHED,
          }),
          buildFaqJsonLd(page.faqs),
        ]}
      />

      <nav className="mb-6 text-sm text-muted-foreground">
        <Link className="hover:underline" to="/">
          Home
        </Link>{" "}
        ›{" "}
        <Link className="hover:underline" to="/sat-resources">
          SAT Resources
        </Link>{" "}
        › <span className="text-foreground">{page.title}</span>
      </nav>

      <header className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {page.category} · {page.kind.replace("-", " ")}
        </div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
          {page.title}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{page.intro}</p>
      </header>

      <div className="space-y-10">
        {page.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-2xl font-semibold tracking-tight">
              {section.heading}
            </h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="mt-3 text-muted-foreground">
                {renderLinkedText(paragraph, page.slug, `body-${section.heading}-${paragraph}`)}
              </p>
            ))}
            {section.list && (
              <ul className="mt-4 list-disc space-y-2 pl-6 text-muted-foreground">
                {section.list.map((item) => (
                  <li key={item}>
                    {renderLinkedText(item, page.slug, `list-${section.heading}-${item}`)}
                  </li>
                ))}
              </ul>
            )}
            {section.table && (
              <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-muted/70">
                    <tr>
                      {section.table.headers.map((header) => (
                        <th key={header} className="px-4 py-3 font-semibold">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.table.rows.map((row) => (
                      <tr key={row.join("|")} className="border-t border-border">
                        {row.map((cell, cellIndex) => (
                          <td key={`${cell}-${cellIndex}`} className="px-4 py-3 text-muted-foreground">
                            {renderLinkedText(cell, page.slug, `table-${section.heading}-${row.join("|")}-${cellIndex}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>

      {page.productLinks && page.productLinks.length > 0 && (
        <section className="mt-12 rounded-xl border border-border p-5">
          <h2 className="text-xl font-semibold tracking-tight">
            Practice on 1600.now
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {page.productLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="inline-flex rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12">
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

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            Related resources
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {related.map((relatedSlug) => (
              <Link
                key={relatedSlug}
                to={`/${relatedSlug}`}
                className="rounded-lg border border-border p-4 text-sm font-semibold hover:bg-muted"
              >
                {labelForSlug(relatedSlug)}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          Resource library
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/sat-resources"
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            All SAT resources
          </Link>
          {linkableAssets
            .filter((item) => item.category === page.category && item.slug !== page.slug)
            .slice(0, 5)
            .map((item) => (
              <Link
                key={item.slug}
                to={`/${item.slug}`}
                className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
              >
                {item.title}
              </Link>
            ))}
        </div>
      </section>
    </article>
  );
};

export default LinkableAssetPage;
