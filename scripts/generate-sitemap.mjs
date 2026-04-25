#!/usr/bin/env node
// Regenerates sitemap files under public/ with every indexable URL on 1600.now.
// Emits a sitemap index (public/sitemap.xml) and per-type child sitemaps so
// Google Search Console can report coverage per content cluster. <lastmod>
// is truthful: blog posts use their datePublished, other URLs use the mtime
// of the source file that drives their content.

import { readFileSync, writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const SITE = "https://1600.now";

// ---- Source file mtimes (ISO date) ----------------------------------------

const mtimeIso = (rel) => {
  try {
    return statSync(path.join(root, rel)).mtime.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

const MTIME_BLOG = mtimeIso("src/lib/blogData.ts");
const MTIME_SKILLS = mtimeIso("src/lib/satSkillsData.ts");
const MTIME_FAQ = mtimeIso("src/lib/satFaqData.ts");
const MTIME_LANDING = mtimeIso("src/lib/landingVariants.ts");
const MTIME_SCORES = mtimeIso("src/lib/satScoreData.ts");
const MTIME_PILLARS = mtimeIso("src/lib/pillarData.ts");
const MTIME_SCORE_GOALS = mtimeIso("src/lib/scoreGoalData.ts");
const MTIME_TOOLS = mtimeIso("src/lib/satTools.ts");
const MTIME_COUNTRY = mtimeIso("src/lib/countryHubData.ts");
const MTIME_COLLEGES = mtimeIso("src/data/colleges.json");
const MTIME_HOME = mtimeIso("src/pages/Home.tsx");
const MTIME_SCORE_CALC = mtimeIso("src/pages/ScoreCalculator.tsx");
const MTIME_MODULES = mtimeIso("src/pages/Modules.tsx");
const MTIME_BANK = mtimeIso("src/pages/BankIndex.tsx");
const MTIME_VOCAB = mtimeIso("src/pages/Vocab.tsx");
const MTIME_VOCAB_INDEX = mtimeIso("src/pages/SatVocabularyIndex.tsx");
const MTIME_ANALYSIS = mtimeIso("src/pages/Analysis.tsx");
const MTIME_HARD = mtimeIso("src/pages/HardQuestionsIntro.tsx");
const MTIME_PRIVACY = mtimeIso("src/pages/PrivacyPolicy.tsx");
const MTIME_TERMS = mtimeIso("src/pages/TermsOfService.tsx");
const MTIME_BROWSE = mtimeIso("src/pages/Index.tsx");

// ---- Slug extraction ------------------------------------------------------

const skillSrc = read("src/lib/satSkillsData.ts");
const skillSlugs = [...skillSrc.matchAll(/slug:\s*"([^"]+)"/g)].map((m) => m[1]);

const blogSrc = read("src/lib/blogData.ts");
const blogSlugs = [...blogSrc.matchAll(/slug:\s*"([^"]+)"/g)].map((m) => m[1]);

// Map blog slug → datePublished by pairing consecutive slug/date matches.
const blogDateBySlug = (() => {
  const pairRegex = /slug:\s*"([^"]+)"[\s\S]*?datePublished:\s*"([0-9]{4}-[0-9]{2}-[0-9]{2})"/g;
  const out = {};
  for (const m of blogSrc.matchAll(pairRegex)) out[m[1]] = m[2];
  return out;
})();

const landingSrc = read("src/lib/landingVariants.ts");
const landingSlugs = [...landingSrc.matchAll(/slug:\s*"([^"]+)"/g)].map((m) => m[1]);

const satFaqSrc = read("src/lib/satFaqData.ts");
const satFaqSlugs = [...satFaqSrc.matchAll(/slug:\s*"([^"]+)"/g)].map((m) => m[1]);

const pillarSrc = read("src/lib/pillarData.ts");
const pillarSlugs = [...pillarSrc.matchAll(/slug:\s*"([^"]+)"/g)].map((m) => m[1]);

const scoreGoalSrc = read("src/lib/scoreGoalData.ts");
const scoreGoalHardcoded = [...scoreGoalSrc.matchAll(/slug:\s*"([^"]+)"/g)].map((m) => m[1]);
const scoreGoalDynamic = [1000, 1100, 1200, 1250, 1300, 1350, 1400, 1450, 1500, 1550, 1600].map(
  (n) => `how-to-get-${n}-sat`,
);
const scoreGoalSlugs = [...scoreGoalDynamic, ...scoreGoalHardcoded.filter((s) => !s.startsWith("how-to-get-"))];

const toolSrc = read("src/lib/satTools.ts");
const toolSlugs = [...toolSrc.matchAll(/slug:\s*"([^"]+)"/g)].map((m) => m[1]);

const collegesData = JSON.parse(read("src/data/colleges.json"));
const collegeSlugs = collegesData.map((c) => c.slug);

const countrySrc = read("src/lib/countryHubData.ts");
const countryHubSlugs = [...countrySrc.matchAll(/hubSlug:\s*"([^"]+)"/g)].map(
  (m) => m[1],
);
const countryPageSlugs = [...countrySrc.matchAll(/slug:\s*"((?:in|ae)\/[^"]+)"/g)].map(
  (m) => m[1],
);

const scores = [];
for (let s = 400; s <= 1600; s += 10) scores.push(s);

const isGoodScores = [];
for (let s = 400; s <= 1600; s += 10) isGoodScores.push(s);

// ---- URL buckets (one child sitemap per bucket) ---------------------------

const pagesBucket = [
  { url: "/", lastmod: MTIME_HOME },
  { url: "/modules", lastmod: MTIME_MODULES },
  { url: "/score-calculator", lastmod: MTIME_SCORE_CALC },
  { url: "/browse", lastmod: MTIME_BROWSE },
  { url: "/bank", lastmod: MTIME_BANK },
  { url: "/vocab", lastmod: MTIME_VOCAB },
  { url: "/analysis", lastmod: MTIME_ANALYSIS },
  { url: "/hard", lastmod: MTIME_HARD },
  { url: "/sat-vocabulary", lastmod: MTIME_VOCAB_INDEX },
  { url: "/sat-score", lastmod: MTIME_SCORES },
  { url: "/sat-skill", lastmod: MTIME_SKILLS },
  { url: "/blog", lastmod: MTIME_BLOG },
  { url: "/sat-faq", lastmod: MTIME_FAQ },
  { url: "/privacy", lastmod: MTIME_PRIVACY },
  { url: "/terms", lastmod: MTIME_TERMS },
];

const skillsBucket = skillSlugs.map((s) => ({
  url: `/sat-skill/${s}`,
  lastmod: MTIME_SKILLS,
}));

const blogBucket = blogSlugs.map((s) => ({
  url: `/blog/${s}`,
  lastmod: blogDateBySlug[s] ?? MTIME_BLOG,
}));

const faqBucket = satFaqSlugs.map((s) => ({
  url: `/sat-faq/${s}`,
  lastmod: MTIME_FAQ,
}));

const landingBucket = landingSlugs.map((s) => ({
  url: `/${s}`,
  lastmod: MTIME_LANDING,
}));

const pillarBucket = pillarSlugs.map((s) => ({
  url: `/${s}`,
  lastmod: MTIME_PILLARS,
}));

const scoreGoalBucket = scoreGoalSlugs.map((s) => ({
  url: `/${s}`,
  lastmod: MTIME_SCORE_GOALS,
}));

const toolsBucket = toolSlugs.map((s) => ({
  url: `/${s}`,
  lastmod: MTIME_TOOLS,
}));

const countryBucket = [
  ...countryHubSlugs.map((s) => ({ url: `/${s}`, lastmod: MTIME_COUNTRY })),
  ...countryPageSlugs.map((s) => ({ url: `/${s}`, lastmod: MTIME_COUNTRY })),
];

const collegesBucket = [
  { url: "/college", lastmod: MTIME_COLLEGES },
  ...collegeSlugs.map((s) => ({ url: `/college/${s}`, lastmod: MTIME_COLLEGES })),
];

const scoresBucket = [
  ...scores.map((n) => ({ url: `/sat-score/${n}`, lastmod: MTIME_SCORES })),
  ...isGoodScores.map((n) => ({
    url: `/is-a-${n}-a-good-sat-score`,
    lastmod: MTIME_SCORES,
  })),
];

// ---- Priority + changefreq ------------------------------------------------

const priorityFor = (u) => {
  if (u === "/") return "1.0";
  if (
    [
      "/score-calculator",
      "/modules",
      "/bank",
      "/sat-vocabulary",
      "/blog",
      "/sat-score",
      "/sat-skill",
    ].includes(u)
  )
    return "0.9";
  if (u.startsWith("/blog/")) return "0.8";
  if (u.startsWith("/sat-skill/")) return "0.8";
  if (u.startsWith("/sat-score/")) return "0.7";
  if (pillarSlugs.includes(u.slice(1))) return "0.9";
  if (scoreGoalSlugs.includes(u.slice(1))) return "0.8";
  if (toolSlugs.includes(u.slice(1))) return "0.8";
  if (u.startsWith("/in/") || u.startsWith("/ae/") || u === "/in" || u === "/ae")
    return "0.7";
  if (u === "/college") return "0.8";
  if (u.startsWith("/college/")) return "0.6";
  return "0.6";
};

const changefreqFor = (u) => {
  if (u === "/" || u.startsWith("/blog")) return "weekly";
  return "monthly";
};

// ---- Emit child sitemaps + index -----------------------------------------

const renderChildSitemap = (entries) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  entries
    .map(
      ({ url, lastmod }) =>
        `  <url>\n` +
        `    <loc>${SITE}${url === "/" ? "/" : url}</loc>\n` +
        `    <lastmod>${lastmod}</lastmod>\n` +
        `    <changefreq>${changefreqFor(url)}</changefreq>\n` +
        `    <priority>${priorityFor(url)}</priority>\n` +
        `  </url>`,
    )
    .join("\n") +
  `\n</urlset>\n`;

const writeChild = (filename, entries) => {
  writeFileSync(path.join(root, "public", filename), renderChildSitemap(entries));
  return { filename, count: entries.length };
};

const children = [
  { filename: "sitemap-pages.xml", entries: pagesBucket },
  { filename: "sitemap-skills.xml", entries: skillsBucket },
  { filename: "sitemap-blog.xml", entries: blogBucket },
  { filename: "sitemap-faq.xml", entries: faqBucket },
  { filename: "sitemap-scores.xml", entries: scoresBucket },
  { filename: "sitemap-landing.xml", entries: landingBucket },
  { filename: "sitemap-pillars.xml", entries: pillarBucket },
  { filename: "sitemap-score-goals.xml", entries: scoreGoalBucket },
  { filename: "sitemap-tools.xml", entries: toolsBucket },
  { filename: "sitemap-country.xml", entries: countryBucket },
  { filename: "sitemap-colleges.xml", entries: collegesBucket },
].filter((c) => c.entries.length > 0);

const childResults = children.map((c) => writeChild(c.filename, c.entries));

// Child sitemap lastmod = most recent entry inside.
const maxDate = (entries) =>
  entries.reduce((acc, { lastmod }) => (lastmod > acc ? lastmod : acc), "1970-01-01");

const indexXml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  children
    .map(
      ({ filename, entries }) =>
        `  <sitemap>\n` +
        `    <loc>${SITE}/${filename}</loc>\n` +
        `    <lastmod>${maxDate(entries)}</lastmod>\n` +
        `  </sitemap>`,
    )
    .join("\n") +
  `\n</sitemapindex>\n`;

writeFileSync(path.join(root, "public/sitemap.xml"), indexXml);

const total = childResults.reduce((n, r) => n + r.count, 0);
console.log(
  `Generated sitemap index with ${childResults.length} child sitemaps, ${total} URLs:\n` +
    childResults.map((r) => `  ${r.filename}  (${r.count} URLs)`).join("\n"),
);
