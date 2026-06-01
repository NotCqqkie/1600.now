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

const SITE = "https://1600.now";
const ASSET_PUBLISHED = "2026-05-28";

const labelForSlug = (slug: string) => {
  const asset = linkableAssetBySlug.get(slug);
  if (asset) return asset.title;
  const hub = linkableHubBySlug.get(slug);
  if (hub) return hub.title;
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
                {paragraph}
              </p>
            ))}
            {section.list && (
              <ul className="mt-4 list-disc space-y-2 pl-6 text-muted-foreground">
                {section.list.map((item) => (
                  <li key={item}>{item}</li>
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
                        {row.map((cell) => (
                          <td key={cell} className="px-4 py-3 text-muted-foreground">
                            {cell}
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
