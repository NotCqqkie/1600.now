import { useEffect, useMemo } from "react";
import { matchPath, useLocation } from "react-router-dom";

const SITE_NAME = "1600.now";
const SITE_URL = "https://1600.now";
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
    title: "1600.now | SAT Practice Questions, Modules, and Score Tools",
    description:
      "Prep for the digital SAT with timed practice questions, full SAT modules, answer explanations, vocabulary review, and a score calculator.",
  },
  {
    pattern: "/modules",
    title: "SAT Practice Modules | Full Digital SAT Modules",
    description:
      "Browse full SAT practice modules by year, form, subject, and module number for realistic digital SAT prep.",
  },
  {
    pattern: "/modules/:moduleId",
    title: "SAT Module Practice | Full Module Review",
    description:
      "Work through a full SAT practice module with official-style questions, pacing, and detailed explanations.",
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
  },
  {
    pattern: "/official-bank",
    title: "Official SAT Question Bank | Official Practice Questions",
    description:
      "Study official SAT practice questions with filters for subject, skill, and difficulty to build a targeted prep plan.",
  },
  {
    pattern: "/official-bank/:subject/browse",
    title: ({ subject }) =>
      `Official ${formatSubject(subject)} SAT Questions | Browse`,
    description: ({ subject }) =>
      `Browse official ${formatSubject(subject)} SAT practice questions with structured filters and fast navigation.`,
  },
  {
    pattern: "/official-bank/:subject/:filterType/:filterValue",
    title: ({ subject }) =>
      `Official ${formatSubject(subject)} SAT Questions | Filtered Bank`,
    description: ({ subject }) =>
      `Explore filtered official ${formatSubject(subject)} SAT questions and focus on the exact concepts you need to strengthen.`,
  },
  {
    pattern: "/official-bank/:subject/:id",
    title: ({ subject }) =>
      `Official ${formatSubject(subject)} SAT Practice Question`,
    description: ({ subject }) =>
      `Review an official ${formatSubject(subject)} SAT practice question with answer choices and explanation context.`,
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
    pattern: "/profile",
    title: "Profile | 1600.now SAT Prep",
    description:
      "Review your 1600.now SAT prep profile, synced study status, and account details.",
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
      title,
      description,
      noindex: matchedRoute?.noindex ?? false,
      canonicalUrl: `${SITE_URL}${pathname === "/" ? "" : pathname}`,
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
      content: metadata.noindex ? "noindex, nofollow" : "index, follow",
    });
    upsertLink('link[rel="canonical"]', {
      rel: "canonical",
      href: metadata.canonicalUrl,
    });

    upsertJsonLd("website", {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
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
  }, [metadata]);

  return null;
};
