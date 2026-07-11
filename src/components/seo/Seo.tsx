import { useEffect, useMemo } from "react";
import { matchPath, useLocation } from "react-router-dom";
import { hreflangGroup } from "@/lib/seo-data/hreflangData";
import {
  BRAND_NAME,
  BRAND_URL,
  brandedTitle,
} from "@/lib/brand";

const SITE_NAME = BRAND_NAME;
const SITE_URL = BRAND_URL;
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;
const DEFAULT_OG_IMAGE_ALT = `${SITE_NAME} Digital SAT prep tools and practice`;

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
      "Browse full SAT practice tests organized by subject and module for realistic digital SAT prep.",
  },
  {
    pattern: "/modules/:moduleId",
    title: "SAT Module Practice | Full Module Review",
    description:
      "Work through a full SAT practice module with official-style questions, pacing, and detailed explanations.",
    noindex: true,
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
    noindex: true,
  },
  {
    pattern: "/bank/:subject/:filterType/:filterValue",
    title: ({ subject }) =>
      `${formatSubject(subject)} SAT Practice Questions | Filtered Bank`,
    description: ({ subject }) =>
      `Explore filtered ${formatSubject(subject)} SAT practice questions and focus on the exact skills you want to improve.`,
    noindex: true,
  },
  {
    pattern: "/bank/:subject/:id",
    title: ({ subject }) => `${formatSubject(subject)} SAT Practice Question`,
    description: ({ subject }) =>
      `Review a ${formatSubject(subject)} SAT practice question with answer choices, explanations, and study context.`,
    noindex: true,
  },
  {
    pattern: "/hard",
    title: "100 Hard SAT Math Questions",
    description:
      "Work through 100 hard Digital SAT Math questions with detailed step-by-step explanations.",
  },
  {
    pattern: "/hard/:id",
    title: "Hard SAT Math Question | 1600.now",
    description: "An individual hard SAT Math practice question.",
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
    title: "SAT Vocabulary List | 1,800+ Digital SAT Words in Context",
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
    pattern: "/sat-faq",
    title: "SAT FAQ | Digital SAT Questions Answered",
    description:
      "Clear answers to common Digital SAT questions about timing, scoring, calculators, test dates, and prep.",
  },
  {
    pattern: "/sat-faq/:slug",
    title: "SAT FAQ Answer | 1600.now",
    description:
      "A focused answer to a common Digital SAT question from 1600.now.",
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
    pattern: "/sat-to-act-converter",
    title: "SAT to ACT Converter",
    description:
      "Convert SAT scores to ACT composite scores using current concordance tables.",
  },
  {
    pattern: "/sat-percentile-calculator",
    title: "SAT Percentile Calculator",
    description:
      "Find the percentile rank for a Digital SAT score and compare it with national test-taker results.",
  },
  {
    pattern: "/psat-to-sat-predictor",
    title: "PSAT to SAT Score Predictor",
    description:
      "Estimate an SAT score range from a PSAT score using the shared College Board score scale.",
  },
  {
    pattern: "/sat-study-plan-generator",
    title: "SAT Study Plan Generator",
    description:
      "Upload an SAT score report or enter your scores to generate a personalized daily study schedule with timed assignments.",
  },
  {
    pattern: "/study-plan-lab",
    title: "SAT Study Plan Lab",
    description:
      "Hidden SAT study planning lab with calendar tasks, score-report intake, focus areas, and printable daily plans.",
    noindex: true,
  },
  {
    pattern: "/what-sat-score-do-i-need",
    title: "What SAT Score Do I Need?",
    description:
      "Find SAT score targets for college admissions based on school score ranges.",
  },
  {
    pattern: "/sat-test-countdown",
    title: "SAT Test Countdown",
    description:
      "Count down to an upcoming Digital SAT test date and review upcoming SAT administrations.",
  },
  {
    pattern: "/in",
    title: "Digital SAT Prep for Indian Students",
    description:
      "Digital SAT prep guide for students in India, including test centers, score targets, and study planning.",
  },
  {
    pattern: "/ae",
    title: "Digital SAT Prep for UAE Students",
    description:
      "Digital SAT prep guide for students in the UAE, including test centers, score targets, and study planning.",
  },
  {
    pattern: "/in/:topic",
    title: "India Digital SAT Guide | 1600.now",
    description:
      "A focused Digital SAT guide for students in India.",
  },
  {
    pattern: "/ae/:topic",
    title: "UAE Digital SAT Guide | 1600.now",
    description:
      "A focused Digital SAT guide for students in the UAE.",
  },
  {
    pattern: "/college",
    title: "US College Directory | SAT Scores and Admissions",
    description:
      "Browse US colleges by SAT score ranges, acceptance rates, admissions data, costs, and outcomes.",
  },
  {
    pattern: "/college/:slug",
    title: "College SAT Scores and Admissions | 1600.now",
    description:
      "Review SAT score ranges, acceptance rate, admissions data, costs, and outcomes for a US college.",
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
      "Verify your 1600.now email address to finish signing in.",
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
      "Personalize your 1600.now study experience.",
    noindex: true,
  },
  {
    pattern: "/admin/reports",
    title: "Admin Reports | 1600.now",
    description:
      "1600.now admin reports.",
    noindex: true,
  },
  {
    pattern: "/:slug",
    title: ({ slug }) => formatTopLevelSeoTitle(slug),
    description: ({ slug }) => formatTopLevelSeoDescription(slug),
  },
  {
    pattern: "*",
    title: "Page Not Found | 1600.now",
    description:
      "The requested 1600.now page could not be found.",
    noindex: true,
  },
];

function formatSubject(subject?: string) {
  if (subject === "math") return "Math";
  if (subject === "reading") return "Reading and Writing";
  return "SAT";
}

function formatTopLevelSeoTitle(slug?: string) {
  const score = slug?.match(/^is-a-(\d{3,4})-a-good-sat-score$/)?.[1];
  if (score) return `Is a ${score} a Good SAT Score?`;
  return "Digital SAT Prep Guide";
}

function formatTopLevelSeoDescription(slug?: string) {
  const score = slug?.match(/^is-a-(\d{3,4})-a-good-sat-score$/)?.[1];
  if (score) {
    return `See whether a ${score} SAT score is good, what percentile it represents, and which colleges it fits.`;
  }
  return "Digital SAT prep guide from 1600.now.";
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
    // Normalize: lowercase the path and strip any trailing slash (except root)
    // so /Bank/Math/123, /bank/math/123/, and /bank/math/123 all canonicalize
    // to a single URL.
    const rawPath = location.pathname || "/";
    const lowered = rawPath.toLowerCase();
    const pathname =
      lowered.length > 1 && lowered.endsWith("/")
        ? lowered.replace(/\/+$/, "")
        : lowered;
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
      title: pathname === "/" || title.length >= 52 ? title : brandedTitle(title),
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
    upsertMeta('meta[property="og:locale"]', {
      property: "og:locale",
      content: "en_US",
    });
    upsertMeta('meta[property="og:type"]', {
      property: "og:type",
      content: "website",
    });
    upsertMeta('meta[property="og:image"]', {
      property: "og:image",
      content: DEFAULT_OG_IMAGE,
    });
    upsertMeta('meta[property="og:image:alt"]', {
      property: "og:image:alt",
      content: DEFAULT_OG_IMAGE_ALT,
    });
    upsertMeta('meta[property="og:image:width"]', {
      property: "og:image:width",
      content: "1200",
    });
    upsertMeta('meta[property="og:image:height"]', {
      property: "og:image:height",
      content: "630",
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
    upsertMeta('meta[name="twitter:image:alt"]', {
      name: "twitter:image:alt",
      content: DEFAULT_OG_IMAGE_ALT,
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

    upsertJsonLd("webpage", {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: metadata.title,
      description: metadata.description,
      url: metadata.canonicalUrl,
      inLanguage: "en-US",
      isPartOf: {
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_URL,
      },
    });
  }, [metadata, location.pathname]);

  return null;
};
