import { Link } from "react-router-dom";

import { PageSeo, buildBreadcrumbJsonLd } from "@/components/seo/PageSeo";
import { blogPosts } from "@/lib/blogData";

const title = "1600.now Blog: Digital SAT Prep Guides & Strategy";
const description =
  "In-depth guides on the Digital SAT: scoring, strategy, math formulas, vocabulary, adaptive testing, and study plans. Updated for 2026.";

const BlogIndex = () => {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <PageSeo
        id="blog-index"
        title={title}
        description={description}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: "Blog", url: "https://1600.now/blog" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "Blog",
            name: "1600.now Blog",
            url: "https://1600.now/blog",
            description,
          },
        ]}
      />

      <header className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight">
          The 1600.now Blog
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Practical guides on the Digital SAT — how it's scored, how adaptive
          modules work, what formulas to memorize, and how to reach a 1600.
        </p>
      </header>

      <ul className="space-y-6">
        {blogPosts
          .slice()
          .sort((a, b) => (a.datePublished < b.datePublished ? 1 : -1))
          .map((post) => (
            <li key={post.slug}>
              <Link
                to={`/blog/${post.slug}`}
                className="block rounded-xl border border-border p-5 transition hover:bg-muted"
              >
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {post.tag} · {post.readingMinutes} min read
                </div>
                <h2 className="mt-1 text-xl font-semibold">{post.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {post.description}
                </p>
              </Link>
            </li>
          ))}
      </ul>
    </div>
  );
};

export default BlogIndex;
