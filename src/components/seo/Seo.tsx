import { useEffect, useMemo } from "react";
import { matchPath, useLocation } from "react-router-dom";
import { hreflangGroup } from "@/lib/seo-data/hreflangData";
import {
  BRAND_ALTERNATE,
  BRAND_NAME,
  BRAND_SAME_AS,
  BRAND_URL,
  brandedTitle,
} from "@/lib/brand";

const SITE_NAME = BRAND_NAME;
const SITE_URL = BRAND_URL;
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

type RouteMetadata = {
  pattern: string;
  title: string | ((params: Record<string, string | undefined>) => string);
  description: string | ((params: Record<string, string | undefined>) => string);
  noindex?: boolean;
};

const routeMetadata: RouteMetadata[] = [
  {
    pattern: "/",
    title: "Free Digital SAT Practice & Question Bank | 1600.now",
    description:
      "Free Digital SAT prep. Every practice question is instantly filterable by domain, skill, and difficulty — plus full adaptive modules, a score calculator, and detailed explanations.",
  },
  {
    pattern: "/modules",
    title: "SAT Practice Tests | Full Digital SAT Practice Tests",
    description:
      "Browse full SAT practice tests by year, form, subject, and module number for realistic digital SAT prep.",
  },
  {
    pattern: "/modules/:moduleId",
    title: "SAT Module Practice | Full Module Review",
    description:
      "Work through a full SAT practice module with official-style questions, pacing, and detailed explanations.",
  },
  {
    pattern: "/modules/:moduleId/start",
    title: "SAT Module Practice | 1600.now",
    description:
      "Start a timed SAT practice module on 1600.now.",
    noindex: true,
  },
  {
    pattern: "/modules/:moduleId/review",
    title: "SAT Module Review | 1600.now",
    description:
      "Review a timed SAT practice module on 1600.now.",
    noindex: true,
  },
  {
    pattern: "/modules/:moduleId/results",
    title: "SAT Module Results | 1600.now",
    description:
      "View SAT module practice results on 1600.now.",
    noindex: true,
  },
  {
    pattern: "/practice-tests/:setId",
    title: "SAT Practice Test | 1600.now",
    description:
      "Start a Digital SAT practice test on 1600.now.",
    noindex: true,
  },
  {
    pattern: "/practice-tests/:setId/start",
    title: "SAT Practice Test Start | 1600.now",
    description:
      "Start a Digital SAT practice test on 1600.now.",
    noindex: true,
  },
  {
    pattern: "/practice-tests/:setId/transition",
    title: "SAT Practice Test Transition | 1600.now",
    description:
      "Continue a Digital SAT practice test on 1600.now.",
    noindex: true,
  },
  {
    pattern: "/practice-tests/:setId/review",
    title: "SAT Practice Test Review | 1600.now",
    description:
      "Review a Digital SAT practice test on 1600.now.",
    noindex: true,
  },
  {
    pattern: "/practice-tests/:setId/results",
    title: "SAT Practice Test Results | 1600.now",
    description:
      "View Digital SAT practice test results on 1600.now.",
    noindex: true,
  },
  {
    pattern: "/score-calculator",
    title: "SAT Score Calculator | Estimate Your Digital SAT Score",
    description:
      "Estimate your SAT Math and Reading & Writing score with a fast digital SAT score calculator based on your raw performance.",
  },
  {
    pattern: "/browse",
    title: "SAT Question Browser | Review Practice Questions",
    description:
      "Browse SAT practice questions, review explanations, and move quickly through a broad digital SAT question set.",
  },
  {
    pattern: "/bank",
    title: "SAT Question Bank | Filter by Subject, Skill, and Difficulty",
    description:
      "Filter SAT practice questions by subject, domain, skill, difficulty, and progress to target the areas that need the most work.",
  },
  {
    pattern: "/bank/:subject/browse",
    title: ({ subject }) =>
      `${formatSubject(subject)} SAT Question Bank | Browse Practice Questions`,
    description: ({ subject }) =>
      `Browse ${formatSubject(subject)} SAT practice questions with filtering by skill, difficulty, and progress.`,
  },
  {
    pattern: "/bank/:subject/:filterType/:filterValue",
    title: ({ subject }) =>
      `${formatSubject(subject)} SAT Practice Questions | Filtered Bank`,
    description: ({ subject }) =>
      `Explore filtered ${formatSubject(subject)} SAT practice questions and focus on the exact skills you want to improve.`,
  },
  {
    pattern: "/bank/:subject/:id",
    title: ({ subject }) => `${formatSubject(subject)} SAT Practice Question`,
    description: ({ subject }) =>
      `Review a ${formatSubject(subject)} SAT practice question with answer choices, explanations, and study context.`,
    noindex: true,
  },
  {
    pattern: "/hard/:id",
    title: "Hard SAT Practice Question | 1600.now",
    description:
      "Review a hard SAT practice question on 1600.now.",
    noindex: true,
  },
  {
    pattern: "/vocab",
    title: "SAT Vocabulary Practice | High-Frequency SAT Words",
    description:
      "Study SAT vocabulary with targeted word lists and high-frequency terms that appear in digital SAT reading questions.",
  },
  {
    pattern: "/analysis",
    title: "SAT Performance Analysis | Review Accuracy and Trends",
    description:
      "Analyze SAT practice performance, track strengths and weaknesses, and identify the next highest-impact study areas.",
    noindex: true,
  },
  {
    pattern: "/test-results",
    title: "SAT Test Results | 1600.now",
    description:
      "Review saved SAT test results and progress on 1600.now.",
    noindex: true,
  },
  {
    pattern: "/my-practice-sets",
    title: "My Practice Sets | 1600.now",
    description:
      "Review saved SAT practice sets on 1600.now.",
    noindex: true,
  },
  {
    pattern: "/sat-vocabulary",
    title: "SAT Vocabulary List | 260+ Digital SAT Words in Context",
    description:
      "Complete Digital SAT vocabulary list with definitions, grouped by difficulty, covering every high-frequency SAT Words-in-Context word.",
  },
  {
    pattern: "/sat-score",
    title: "SAT Score Breakdowns | Every 400–1600 Score Explained",
    description:
      "See percentile, target colleges, and a study plan for every Digital SAT score from 400 to 1600.",
  },
  {
    pattern: "/sat-score/:score",
    title: ({ score }) => `${score} SAT Score | Percentile, Sections & Colleges`,
    description: ({ score }) =>
      `A ${score} Digital SAT score breakdown — percentile, section targets, competitive colleges, and a study plan to raise it.`,
  },
  {
    pattern: "/sat-skill",
    title: "Digital SAT Skills List | Every Math & Reading Skill Tested",
    description:
      "Complete list of every skill tested on the Digital SAT, with tips and targeted practice for each.",
  },
  {
    pattern: "/sat-skill/:slug",
    title: "Digital SAT Skill Guide | Tips, Examples, and Practice",
    description:
      "Master a specific Digital SAT skill with a focused guide, key tips, and practice resources.",
  },
  {
    pattern: "/blog",
    title: "1600.now Blog | Digital SAT Prep Guides and Strategy",
    description:
      "In-depth Digital SAT guides on scoring, adaptive testing, math formulas, vocabulary strategy, and more.",
  },
  {
    pattern: "/blog/:slug",
    title: "1600.now Blog | Digital SAT Prep Article",
    description:
      "Digital SAT prep article from the 1600.now blog.",
  },
  {
    pattern: "/privacy",
    title: "Privacy Policy | 1600.now",
    description:
      "Privacy Policy for 1600.now, including information collection, usage, sharing, retention, choices, and contact details.",
  },
  {
    pattern: "/terms",
    title: "Terms of Service | 1600.now",
    description:
      "Terms of Service for using 1600.now SAT prep tools, practice modules, score calculator, and question bank.",
  },
  {
    pattern: "/login",
    title: "Log In | 1600.now SAT Prep",
    description:
      "Log in to 1600.now to sync SAT progress, saved work, and practice history across devices.",
    noindex: true,
  },
  {
    pattern: "/signup",
    title: "Create Account | 1600.now SAT Prep",
    description:
      "Create a 1600.now account to save SAT progress, sync study data, and continue practice across devices.",
    noindex: true,
  },
  {
    pattern: "/verify-email",
    title: "Verify Email | 1600.now SAT Prep",
    description:
      "Verify your 1600.now account email address.",
    noindex: true,
  },
  {
    pattern: "/profile",
    title: "Profile | 1600.now SAT Prep",
    description:
      "Review your 1600.now SAT prep profile, synced study status, and account details.",
    noindex: true,
  },
  {
    pattern: "/profile/personalization",
    title: "Personalization | 1600.now SAT Prep",
    description:
      "Personalize your 1600.now SAT prep profile.",
    noindex: true,
  },
  {
    pattern: "/admin/reports",
    title: "Admin Reports | 1600.now",
    description:
      "1600.now admin reports.",
    noindex: true,
  },
];

function formatSubject(subject?: string) {
  if (subject === "math") return "Math";
  if (subject === "reading") return "Reading and Writing";
  return "SAT";
}

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;

  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element!.setAttribute(key, value);
  });
}

function upsertLink(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector(selector) as HTMLLinkElement | null;

  if (!element) {
    element = document.createElement("link");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element!.setAttribute(key, value);
  });
}

function upsertJsonLd(id: string, payload: object) {
  let element = document.head.querySelector(
    `script[data-seo-id="${id}"]`,
  ) as HTMLScriptElement | null;

  if (!element) {
    element = document.createElement("script");
    element.type = "application/ld+json";
    element.dataset.seoId = id;
    document.head.appendChild(element);
  }

  element.textContent = JSON.stringify(payload);
}

export const Seo = () => {
  const location = useLocation();

  const metadata = useMemo(() => {
    const pathname = location.pathname;
    const matchedRoute =
      routeMetadata.find((route) =>
        matchPath({ path: route.pattern, end: true }, pathname),
      ) ?? null;

    const params = matchedRoute
      ? matchPath({ path: matchedRoute.pattern, end: true }, pathname)?.params ?? {}
      : {};

    const title =
      typeof matchedRoute?.title === "function"
        ? matchedRoute.title(params)
        : matchedRoute?.title ?? "1600.now | Digital SAT Prep";

    const description =
      typeof matchedRoute?.description === "function"
        ? matchedRoute.description(params)
        : matchedRoute?.description ??
          "Digital SAT prep with question banks, modules, score tools, and explanations.";

    return {
      title: pathname === "/" ? title : brandedTitle(title),
      description,
      noindex: matchedRoute?.noindex ?? false,
      canonicalUrl: `${SITE_URL}${pathname === "/" ? "/" : pathname}`,
    };
  }, [location.pathname]);

  useEffect(() => {
    document.title = metadata.title;

    upsertMeta('meta[name="description"]', {
      name: "description",
      content: metadata.description,
    });
    upsertMeta('meta[property="og:title"]', {
      property: "og:title",
      content: metadata.title,
    });
    upsertMeta('meta[property="og:description"]', {
      property: "og:description",
      content: metadata.description,
    });
    upsertMeta('meta[property="og:url"]', {
      property: "og:url",
      content: metadata.canonicalUrl,
    });
    upsertMeta('meta[property="og:site_name"]', {
      property: "og:site_name",
      content: SITE_NAME,
    });
    upsertMeta('meta[property="og:image"]', {
      property: "og:image",
      content: DEFAULT_OG_IMAGE,
    });
    upsertMeta('meta[name="twitter:title"]', {
      name: "twitter:title",
      content: metadata.title,
    });
    upsertMeta('meta[name="twitter:description"]', {
      name: "twitter:description",
      content: metadata.description,
    });
    upsertMeta('meta[name="twitter:image"]', {
      name: "twitter:image",
      content: DEFAULT_OG_IMAGE,
    });
    upsertMeta('meta[name="robots"]', {
      name: "robots",
      content: metadata.noindex
        ? "noindex, follow"
        : "index, follow, max-image-preview:large, max-snippet:-1",
    });
    upsertLink('link[rel="canonical"]', {
      rel: "canonical",
      href: metadata.canonicalUrl,
    });

    // Bidirectional hreflang: the site root declares alternates for every
    // country hub so Google can swap locales from the English home to /in or
    // /ae. Country hubs declare the same group on their end. Other routes do
    // not have localized alternates, so we remove any stale tags.
    document.head
      .querySelectorAll('link[rel="alternate"][data-seo-hreflang]')
      .forEach((el) => el.remove());
    if (location.pathname === "/") {
      hreflangGroup.forEach((a) => {
        const el = document.createElement("link");
        el.setAttribute("rel", "alternate");
        el.setAttribute("hreflang", a.hreflang);
        el.setAttribute("href", a.href);
        el.setAttribute("data-seo-hreflang", "root");
        document.head.appendChild(el);
      });
    }

    upsertJsonLd("website", {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      alternateName: BRAND_ALTERNATE,
      url: SITE_URL,
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/bank?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    });

    upsertJsonLd("organization", {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      alternateName: BRAND_ALTERNATE,
      url: SITE_URL,
      logo: `${SITE_URL}/logo_b.png`,
      ...(BRAND_SAME_AS.length > 0 ? { sameAs: BRAND_SAME_AS } : {}),
    });

    upsertJsonLd("webpage", {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: metadata.title,
      description: metadata.description,
      url: metadata.canonicalUrl,
      isPartOf: {
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_URL,
      },
    });
  }, [metadata, location.pathname]);

  return null;
};
