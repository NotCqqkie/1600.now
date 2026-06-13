import { useEffect } from "react";
import { BRAND_NAME, BRAND_URL, brandedTitle } from "@/lib/brand";

type JsonLdPayload = Record<string, unknown>;

export interface HreflangAlternate {
  hreflang: string;
  href: string;
}

interface PageSeoProps {
  id: string;
  title?: string;
  description?: string;
  jsonLd?: JsonLdPayload | JsonLdPayload[];
  canonical?: string;
  alternates?: HreflangAlternate[];
  image?: string;
  imageAlt?: string;
  type?: "website" | "article";
}

const DEFAULT_OG_IMAGE = `${BRAND_URL}/og-image.png`;
const DEFAULT_OG_IMAGE_ALT = `${BRAND_NAME} Digital SAT prep tools and practice`;

function upsertMetaByName(name: string, content: string) {
  let el = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertMetaByProperty(property: string, content: string) {
  let el = document.head.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertJsonLd(scriptId: string, payload: JsonLdPayload | JsonLdPayload[]) {
  let el = document.head.querySelector(
    `script[data-seo-id="${scriptId}"]`,
  ) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.dataset.seoId = scriptId;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(payload);
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function upsertAlternates(scriptId: string, alternates: HreflangAlternate[]) {
  document.head
    .querySelectorAll(`link[rel="alternate"][data-seo-id="${scriptId}"]`)
    .forEach((el) => el.remove());
  for (const alt of alternates) {
    const link = document.createElement("link");
    link.setAttribute("rel", "alternate");
    link.setAttribute("hreflang", alt.hreflang);
    link.setAttribute("href", alt.href);
    link.dataset.seoId = scriptId;
    document.head.appendChild(link);
  }
}

export const PageSeo = ({
  id,
  title,
  description,
  jsonLd,
  canonical,
  alternates,
  image,
  imageAlt,
  type = "website",
}: PageSeoProps) => {
  useEffect(() => {
    const canonicalUrl =
      canonical ??
      `${BRAND_URL}${window.location.pathname === "/" ? "/" : window.location.pathname}`;
    const imageUrl = image ?? DEFAULT_OG_IMAGE;
    const resolvedImageAlt = imageAlt ?? DEFAULT_OG_IMAGE_ALT;

    if (title) {
      const finalTitle = brandedTitle(title);
      document.title = finalTitle;
      upsertMetaByProperty("og:title", finalTitle);
      upsertMetaByName("twitter:title", finalTitle);
    }
    if (description) {
      upsertMetaByName("description", description);
      upsertMetaByProperty("og:description", description);
      upsertMetaByName("twitter:description", description);
    }
    if (jsonLd) {
      upsertJsonLd(id, jsonLd);
    }
    upsertCanonical(canonicalUrl);
    upsertMetaByProperty("og:url", canonicalUrl);
    upsertMetaByProperty("og:type", type);
    upsertMetaByProperty("og:site_name", BRAND_NAME);
    upsertMetaByProperty("og:locale", "en_US");
    upsertMetaByProperty("og:image", imageUrl);
    upsertMetaByProperty("og:image:alt", resolvedImageAlt);
    upsertMetaByProperty("og:image:width", "1200");
    upsertMetaByProperty("og:image:height", "630");
    upsertMetaByName("twitter:card", "summary_large_image");
    upsertMetaByName("twitter:image", imageUrl);
    upsertMetaByName("twitter:image:alt", resolvedImageAlt);
    upsertMetaByName("robots", "index, follow, max-image-preview:large, max-snippet:-1");
    if (alternates && alternates.length > 0) {
      upsertAlternates(id, alternates);
    }
    return () => {
      const el = document.head.querySelector(`script[data-seo-id="${id}"]`);
      if (el) el.remove();
      document.head
        .querySelectorAll(`link[rel="alternate"][data-seo-id="${id}"]`)
        .forEach((node) => node.remove());
    };
  }, [id, title, description, jsonLd, canonical, alternates, image, imageAlt, type]);

  return null;
};

export interface FaqItem {
  question: string;
  answer: string;
}

export const buildFaqJsonLd = (items: FaqItem[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
});

export const buildBreadcrumbJsonLd = (
  items: { name: string; url: string }[],
) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, idx) => ({
    "@type": "ListItem",
    position: idx + 1,
    name: item.name,
    item: item.url,
  })),
});

export const buildItemListJsonLd = (
  name: string,
  items: { name: string; url: string }[],
) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name,
  itemListElement: items.map((item, idx) => ({
    "@type": "ListItem",
    position: idx + 1,
    name: item.name,
    url: item.url,
  })),
});

export const buildWebApplicationJsonLd = (data: {
  name: string;
  url: string;
  description?: string;
  featureList?: string[];
}) => ({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: data.name,
  url: data.url,
  description: data.description,
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  browserRequirements: "Requires JavaScript. Modern browser.",
  isAccessibleForFree: true,
  inLanguage: "en-US",
  publisher: {
    "@type": "Organization",
    name: BRAND_NAME,
    url: BRAND_URL,
  },
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
  ...(data.featureList ? { featureList: data.featureList } : {}),
});

export interface QuizJsonLdQuestion {
  questionName: string;
  questionText: string;
  choices: { id: string; text: string }[];
  correctAnswerId: string;
  url?: string;
}

export const buildQuizJsonLd = (data: {
  name: string;
  description: string;
  url: string;
  questions: QuizJsonLdQuestion[];
}) => ({
  "@context": "https://schema.org",
  "@type": "Quiz",
  name: data.name,
  about: {
    "@type": "Thing",
    name: data.description,
  },
  url: data.url,
  hasPart: data.questions.map((question) => ({
    "@type": "Question",
    name: question.questionName,
    text: question.questionText,
    url: question.url ?? data.url,
    eduQuestionType: "Multiple choice",
    learningResourceType: "Practice problem",
    suggestedAnswer: question.choices
      .filter((choice) => choice.id !== question.correctAnswerId)
      .map((choice) => ({
        "@type": "Answer",
        position: choice.id,
        text: choice.text,
      })),
    acceptedAnswer: {
      "@type": "Answer",
      position: question.correctAnswerId,
      text:
        question.choices.find((choice) => choice.id === question.correctAnswerId)?.text ?? "",
    },
  })),
});

export const buildArticleJsonLd = (data: {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  author?: string;
  image?: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "Article",
  headline: data.title,
  description: data.description,
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": data.url,
  },
  url: data.url,
  datePublished: data.datePublished,
  dateModified: data.dateModified ?? data.datePublished,
  image: data.image ?? "https://1600.now/og-image.png",
  author: {
    "@type": "Organization",
    name: data.author ?? BRAND_NAME,
  },
  publisher: {
    "@type": "Organization",
    name: BRAND_NAME,
    url: BRAND_URL,
    logo: {
      "@type": "ImageObject",
      url: `${BRAND_URL}/optimized/logo_text_b_1200.png`,
      width: 1200,
      height: 412,
    },
  },
});
