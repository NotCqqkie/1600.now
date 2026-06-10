import { Link, useParams } from "react-router-dom";

import {
  PageSeo,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
} from "@/components/seo/PageSeo";
import { blogPostBySlug, blogPosts } from "@/lib/seo-data/blogData";

const BlogPost = () => {
  const { slug = "" } = useParams();
  const post = blogPostBySlug.get(slug);

  if (!post) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-3xl font-semibold">Post not found</h1>
        <p className="mt-3 text-muted-foreground">
          Browse the{" "}
          <Link className="underline" to="/blog">
            blog index
          </Link>
          .
        </p>
      </div>
    );
  }

  const url = `https://1600.now/blog/${post.slug}`;
  const related = (post.relatedSlugs ?? [])
    .map((relatedSlug) => blogPostBySlug.get(relatedSlug))
    .filter((relatedPost): relatedPost is NonNullable<typeof relatedPost> => Boolean(relatedPost));

  return (
    <article className="mx-auto max-w-3xl px-6 py-10">
      <PageSeo
        id={`blog-${post.slug}`}
        title={`${post.title} | 1600.now`}
        description={post.description}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: "Blog", url: "https://1600.now/blog" },
            { name: post.title, url },
          ]),
          buildArticleJsonLd({
            title: post.title,
            description: post.description,
            url,
            datePublished: post.datePublished,
          }),
        ]}
      />

      <nav className="mb-6 text-sm text-muted-foreground">
        <Link className="hover:underline" to="/">
          Home
        </Link>{" "}
        ›{" "}
        <Link className="hover:underline" to="/blog">
          Blog
        </Link>{" "}
        › <span className="text-foreground">{post.title}</span>
      </nav>

      <header className="mb-8">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {post.tag} · {post.readingMinutes} min read · Published{" "}
          {new Date(post.datePublished).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
          {post.title}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          {post.description}
        </p>
      </header>

      {post.sections.map((section) => (
        <section key={section.heading} className="mt-8">
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

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            Related Posts
          </h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {related.map((relatedPost) => (
              <li key={relatedPost.slug}>
                <Link
                  to={`/blog/${relatedPost.slug}`}
                  className="block rounded-xl border border-border p-4 transition hover:bg-muted"
                >
                  <div className="font-semibold">{relatedPost.title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {relatedPost.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12 rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold">Practice on 1600.now</h3>
        <p className="mt-2 text-muted-foreground">
          Apply what you just read. Run the numbers in the{" "}
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

      <p className="mt-8 text-xs text-muted-foreground">
        Post {blogPosts.findIndex((p) => p.slug === post.slug) + 1} of{" "}
        {blogPosts.length} in the 1600.now Digital SAT blog.
      </p>
    </article>
  );
};

export default BlogPost;
