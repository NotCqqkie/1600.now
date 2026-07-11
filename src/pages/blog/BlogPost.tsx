import { Link, useParams } from "react-router-dom";

import {
  PageSeo,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
} from "@/components/seo/PageSeo";
import {
  BLOG_EDITORIAL_AUTHOR,
  BLOG_LAST_REVIEWED,
  BLOG_PRIMARY_SOURCE_URL,
  blogPostBySlug,
  blogPosts,
  getBlogReadingMinutes,
} from "@/lib/seo-data/blogData";
import NotFound from "@/pages/NotFound";

const BLOG_URL = "https://1600.now/blog";
const SECTION_HEADING_CLASS = "text-2xl font-semibold tracking-tight";
const PRACTICE_CARD_CLASS = "block rounded-xl border border-border p-4 transition hover:bg-muted";
const PRACTICE_CARD_TITLE_CLASS = "font-semibold";
const PRACTICE_CARD_DESCRIPTION_CLASS = "mt-1 text-sm text-muted-foreground";

const PRACTICE_LINKS = [
  {
    to: "/bank",
    title: "Drill questions",
    description: "Turn the strategy into targeted SAT practice.",
  },
  {
    to: "/modules",
    title: "Take a timed module",
    description: "Check pacing with a realistic module.",
  },
  {
    to: "/score-calculator",
    title: "Estimate your score",
    description: "Convert raw results into a 1600-scale estimate.",
  },
] as const;

const blogActionPlanFor = (tag: string) => {
  if (tag.includes("Scoring")) {
    return {
      checklist: [
        "Record your latest Reading and Writing score, Math score, and total score.",
        "Identify the section that is furthest from your target.",
        "Run one targeted drill in that section before taking another full module.",
      ],
      mistakes: [
        "Chasing a total-score goal without knowing which section is holding it down.",
        "Comparing scores without checking whether they are from timed, realistic practice.",
        "Taking another practice test before reviewing every missed question.",
      ],
    };
  }

  if (tag.includes("Strategy")) {
    return {
      checklist: [
        "Choose one strategy from the article and test it on a timed module.",
        "Mark whether the strategy saved time, improved accuracy, or only felt easier.",
        "Keep the strategy only if it improves the review data, not just confidence.",
      ],
      mistakes: [
        "Trying three new tactics in the same module.",
        "Changing strategy after one hard question instead of after a full review.",
        "Ignoring easy misses because the hard questions feel more interesting.",
      ],
    };
  }

  return {
    checklist: [
      "Turn the article into one action: a bank drill, a timed module, or a score calculation.",
      "Write down the exact skill or habit you are testing.",
      "Review the result before reading another guide.",
    ],
    mistakes: [
      "Reading multiple guides without doing practice between them.",
      "Using broad practice when the article points to a narrow skill.",
      "Treating format knowledge as score improvement before testing it under time.",
    ],
  };
};

const BlogPost = () => {
  const { slug = "" } = useParams();
  const post = blogPostBySlug.get(slug);

  if (!post) {
    return <NotFound />;
  }

  const url = `${BLOG_URL}/${post.slug}`;
  const actionPlan = blogActionPlanFor(post.tag);
  const relatedPosts = (post.relatedSlugs ?? [])
    .map((relatedSlug) => blogPostBySlug.get(relatedSlug))
    .filter((relatedPost): relatedPost is NonNullable<typeof relatedPost> => Boolean(relatedPost));
  const readingMinutes = getBlogReadingMinutes(post);
  const postIndex =
    blogPosts.findIndex((candidate) => candidate.slug === post.slug) + 1;

  return (
    <article className="mx-auto max-w-3xl px-6 py-10">
      <PageSeo
        id={`blog-${post.slug}`}
        title={`${post.title} | 1600.now`}
        description={post.description}
        type="article"
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: "Blog", url: BLOG_URL },
            { name: post.title, url },
          ]),
          buildArticleJsonLd({
            title: post.title,
            description: post.description,
            url,
            datePublished: post.datePublished,
            dateModified: BLOG_LAST_REVIEWED,
            author: BLOG_EDITORIAL_AUTHOR,
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
          {post.tag} · {readingMinutes} min read · Published{" "}
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
        <div className="mt-4 rounded-lg border border-border p-3 text-sm text-muted-foreground">
          <div>By {BLOG_EDITORIAL_AUTHOR} · Reviewed {BLOG_LAST_REVIEWED}</div>
          <div className="mt-1">
            Primary standards source:{" "}
            <a
              className="underline"
              href={BLOG_PRIMARY_SOURCE_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              College Board SAT Suite
            </a>
            . College policies and deadlines should also be verified with the institution.
          </div>
        </div>
      </header>

      {post.sections.map((section) => (
        <section key={section.heading} className="mt-8">
          <h2 className={SECTION_HEADING_CLASS}>
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
        <h2 className={SECTION_HEADING_CLASS}>
          What to do after reading this
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-6 text-muted-foreground">
          {actionPlan.checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>

      {relatedPosts.length > 0 && (
        <section className="mt-12">
          <h2 className={SECTION_HEADING_CLASS}>Related SAT guides</h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {relatedPosts.map((relatedPost) => (
              <li key={relatedPost.slug}>
                <Link to={`/blog/${relatedPost.slug}`} className={PRACTICE_CARD_CLASS}>
                  <div className={PRACTICE_CARD_TITLE_CLASS}>{relatedPost.title}</div>
                  <p className={PRACTICE_CARD_DESCRIPTION_CLASS}>
                    {relatedPost.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            <Link className="underline" to="/sat-resources">
              Browse all SAT resources →
            </Link>
          </p>
        </section>
      )}

      <section className="mt-10">
        <h2 className={SECTION_HEADING_CLASS}>
          Mistakes to avoid
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-muted-foreground">
          {actionPlan.mistakes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className={SECTION_HEADING_CLASS}>
          Use this in practice
        </h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {PRACTICE_LINKS.map((link) => (
            <li key={link.to}>
              <Link to={link.to} className={PRACTICE_CARD_CLASS}>
                <div className={PRACTICE_CARD_TITLE_CLASS}>{link.title}</div>
                <p className={PRACTICE_CARD_DESCRIPTION_CLASS}>
                  {link.description}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

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
        Post {postIndex} of {blogPosts.length} in the 1600.now Digital SAT blog.
      </p>
    </article>
  );
};

export default BlogPost;
