# 1600.now SEO Playbook

Last updated: 2026-07-04. Based on a full-code audit (7 dimensions + adversarial verification) of the live SEO surface: 1,382 sitemap URLs, all prerendered to static HTML.

## 1. How this site does SEO (architecture)

- **Vite SPA + puppeteer prerender.** `npm run build` regenerates all sitemaps (`scripts/generate-sitemap.mjs`), builds, then `scripts/prerender.mjs` snapshots every sitemap URL to a static `.html` in `dist/`. Firebase `cleanUrls` serves those files directly; the catch-all rewrite serves `/spa-shell.html` (a neutral shell with no canonical/robots) for client-only and unknown URLs.
- **Meta system.** `src/components/seo/Seo.tsx` holds a route-pattern table (title/description/robots per pattern, DOM upserts). `src/components/seo/PageSeo.tsx` layers page-specific overrides + JSON-LD builders on ~30 page templates. PageSeo only writes a robots meta when its `robots` prop is explicitly passed — never remove that guard; it previously force-indexed ~8,560 noindex bank question pages.
- **Indexable set = sitemap set = prerendered set.** Keep this invariant. Anything routable but not sitemapped must be `noindex` in Seo's route table (bank filter pages, `/modules/:moduleId`, non-eligible colleges are handled this way today).

## 2. econ-learn playbook mapping

| econ-learn piece | 1600.now status |
|---|---|
| Programmatic long-tail pages | ✅ Bigger: 1,383 URLs (890 colleges, 242 scores, 76 assets, 52 blog, 29 skills, 20 country, 18 FAQ, 14 score goals, 12 landing, 9 pillars, 6 tools) |
| Structured data everywhere | ✅ 20+ types incl. Quiz (practice problems), Article, BreadcrumbList; consolidated to one Organization/WebSite graph in `index.html` |
| Route-specific meta/canonicals | ✅ All prerendered pages bake unique title/desc/canonical/OG |
| Dynamic sitemap | ✅ 12-bucket index, git-commit-date lastmod (not mtime) |
| Crawl/index control | ✅ robots.txt fixed (per-bot groups removed), private routes noindex |
| Soft-404 prevention | ✅ NotFound now upserts noindex + strips canonical; unknown URLs serve neutral spa-shell instead of homepage clones |
| Internal linking system | ✅ Global footer (~31 hub links), hub→child links fixed, score-page grid, related colleges, state directory |
| AI-search visibility | ✅ `public/llms.txt`; AI crawlers explicitly allowed in robots.txt |
| IndexNow | ❌ Deliberately skipped for now (Bing-family only; low value until content cadence resumes). Add a post-deploy ping if Bing traffic matters |
| Duplicate-content cleanup | ✅ www-host and homepage-clone issues addressed (see §4 for the DNS step) |

## 3. Implemented 2026-07-04 (this playbook's fix layer)

**Indexing correctness**
- robots.txt: removed `User-agent: Googlebot/Bingbot/...` bare `Allow: /` groups that voided every Disallow for those bots.
- PageSeo robots prop (opt-in) — stopped force-indexing 8,560 bank question pages.
- Noindexed: `/bank/:subject/browse`, `/bank/:subject/:filterType/:filterValue`, `/modules/:moduleId`, and the 601 colleges that fail the sitemap eligibility predicate (`sat25 && sat75 && acceptanceRate`).
- NotFound: noindex + canonical removal; invalid blog/skill/score slugs render it.
- `dist/spa-shell.html` (canonical/robots stripped) is the rewrite target — unknown URLs no longer serve byte-identical homepage copies with `canonical: /`.
- Deleted dead `public/_redirects`, deleted conflicting `googlebot` meta.

**Structured data**
- Single Organization(`EducationalOrganization`)/WebSite graph in `index.html`; deleted Seo.tsx duplicates.
- Quiz JSON-LD now spec-compliant (0-indexed integer answer positions, `\(...\)` math delimiters, `educationalAlignment`).
- FAQPage markup removed from the FAQ index (kept on detail pages) and from all 890 college pages (Google restricted FAQ rich results in 2023; 890 boilerplate FAQPages = scaled-content risk).
- Score-page Article markup uses the shared builder (dates, mainEntityOfPage).
- Titles: brand suffix skipped at ≥52 chars; college template shortened + state disambiguation for the 9 duplicate names; skill titles shortened.

**Internal linking (the big one — ~85% of URLs had zero inlinks)**
- Global `SiteFooter` on every prerendered page: Practice / Scores / Guides / Tools / More columns.
- Hub cards now link their own children: FAQ index → 18 FAQ pages, country hubs → 18 topic pages, skill index → 29 skill guides.
- Score pages: index grid to all 121 `/sat-score/N`, prev/next chains, `/sat-score/N` ⇄ `/is-a-N-a-good-sat-score` cross-links, college-example links, breadcrumb UI now matches schema.
- Colleges: state-grouped directory of all 889 eligible colleges on `/college`; "similar SAT scores" block (6 links) on every college page.
- `/sat-skill` guides are the canonical skill destination; skill/pillar related-cards repointed from unprerendered `/bank` filter URLs to guides. Worksheet→skill-guide links un-stripped (`allowedProductPrefixes` bug).
- Country topic pages: invalid per-topic hreflang removed (home//in//ae cluster kept — it's valid), sibling + hub links added.

**Trust & discovery**
- `/about` page (E-E-A-T; site had zero trust pages), linked from footer + LegalDisclaimer, in sitemap.
- `public/blog-rss.xml` generated at build; `<link rel="alternate">` in head.
- `public/llms.txt`.
- Sitemap lastmod from git commit dates (mtime lied on fresh clones).

**Performance (protects rankings via CWV)**
- Cache-Control fixed: prerendered HTML is now actually `no-cache` (the `**/*.html` rule never matched clean URLs → stale HTML for up to 1h after deploys); long-cache added for `/optimized/**`, `/images/**`, `/reference-sheet/**`.
- Prerender preload pruning extended: Firebase SDK + bank-practice-index pruned sitewide; question-bank data chunks pruned from non-bank pages (landing pages were preloading a 2.7 MB graph).
- `main.tsx` pre-mounts the matching route chunk (races 1.5s) — kills the blank Suspense flash that replaced prerendered content.

## 4. Off-repo actions (only you can do these)

1. **www → apex 301.** `https://www.1600.now` currently serves the full site at HTTP 200 (a complete duplicate host). Firebase Hosting console (project `now-483609`) → set www.1600.now as a redirect-type domain, or fix at DNS. Verify: `curl -sI https://www.1600.now/` → `301` + `Location: https://1600.now/`.
2. **Google Search Console.** Verify the property if not already (no verification token in the repo — may be DNS-verified). Then check, in order: Page indexing (how many of the 1,382 are actually indexed — expect large "Discovered, not indexed" buckets that the new internal links should shrink over 4–8 weeks), Crawl stats (budget wasted on /explanations/, ?q=, www host), Rich result reports (Breadcrumb, Practice problems).
3. **Bing Webmaster Tools** — free, imports from GSC, and is the main consumer if you ever add IndexNow.
4. **Backlinks.** The 76 linkable-asset pages (worksheets, charts, calendars) are built for link acquisition but need outreach: teacher/counselor newsletters, Reddit r/Sat resource threads, school prep-resource pages. No page-building substitute exists for this.
5. After the next deploy, spot-check: `curl -s https://1600.now/sat-score/1400 | grep -c 'rel="canonical"'` (expect 1), a random `/college/*` page for the similar-colleges block, and `https://1600.now/blog-rss.xml`.

## 5. Content roadmap (sequenced — do NOT ship all at once)

Post-March-2024 "scaled content" policies judge programmatic surfaces holistically. The site is ~95% programmatic with a thin trust layer that was only just added. Sequence expansions and watch GSC between waves. **Hard prerequisite for anything embedding question text: the in-flight 7.6k-question rephrase (tmp/rephrase/) must finish first**, or Google indexes text that's about to be mass-rewritten.

**Wave 1 — after GSC shows the fix layer indexing (est. +4–8 weeks)**
- **Test-date pages** (top-5 volume query, seasonal): `/sat-test-dates-2026` + `/sat-test-dates-2027` hubs + ~7 per-administration pages. Data already in `SatTestCountdown.tsx` and the score-release calendar asset. ~9 pages.
- **Section-score pages**: "is 700 SAT math good" etc. — 200–800 step 10 × 2 sections (~122 pages) reusing `satScoreData.ts` percentile logic + the curves in `satCalculator.ts`. Clone of the proven score-page template.
- **Competitor comparisons** (highest commercial intent, editorial not programmatic): vs Khan Academy, vs UWorld, vs Princeton Review, vs Kaplan, "best free SAT prep 2026". ~8 hand-written pages via the TopLevelSeoPage slug dispatcher.

**Wave 2 — after rephrase completes**
- **Skill × difficulty roll-up pages** ("Hard SAT linear functions practice questions with answers"): 29 skills × 3 difficulties ≈ 87 pages, each embedding 10–20 full questions + rationales. ⚠️ Build-time extraction into small per-page JSON — never static-import `src/data/questions/*.json` (13 MB; the fetched-asset architecture is deliberate). Extend prerender prune patterns before adding any bank-adjacent prerendered family.
- **Per-word vocabulary pages** (the econ-learn glossary analog, biggest single vertical): 1,800 words with definition/POS/synonyms/example already in `src/data/vocabulary.ts`; `vocabSeo.ts` has unused slug + related-word helpers. Ship in tranches (e.g. 300/mo), DefinedTerm JSON-LD, interlink via the related-words helper. Watch GSC for "Crawled, not indexed" buildup between tranches.
- **Domain hub pages**: 8 official domains ("SAT algebra practice") aggregating skills, counts from `bankCountIndex.generated.ts`.

**Wave 3 — new verticals**
- **PSAT cluster**: 121 "is X a good PSAT score" pages (concordance data in `PsatToSatPredictor.tsx`) + ~51 state National Merit cutoff pages — a proven programmatic pattern with zero current coverage.
- **Grammar-rule pages** (~15–20): comma rules, semicolons, transitions — seeded from the grammar chart assets + blog posts, each embedding 3–5 rephrased questions.
- **Comparison expansion**: SAT vs IB (globalize the `/ae` one), SAT vs AP, superscoring, Bluebook vs Khan practice tests (~15 pages).
- **Country expansion**: Pakistan, Saudi Arabia hubs (template proven with /in, /ae).
- **Blog cadence**: publishing stopped 2026-04-16. The missing cluster: "how to improve SAT reading/math score", "+200 points plan", retake strategy — interlink with score-goal pages and the study-plan generator.

**Explicitly not recommended**
- Indexing all 8,560 bank questions (thin-page risk dwarfs the win; roll-ups capture the demand).
- More exact-match landing variants (the existing 12 are already borderline doorway pages; consolidate before adding).
- FAQ schema expansion (no rich-result payoff since 2023).

## 6. Guardrails (do not regress)

1. **Perf architecture**: question data = fetched JSON assets (`?url` imports), practice-bank code split, pruned preloads. Any new page family must not static-import large data. New prerendered families need prune-pattern review in `prerender.mjs`.
2. **App Check**: Firestore enforcement is OFF (reverted 2026-07-02). Prerender executes the app against live Firebase — re-verify a full build after client App Check ships and before re-enforcement. The Firebase-SDK preload prune assumes the SDK stays lazily loaded; re-check when App Check lands in the entry path.
3. **Rephrase pipeline**: no question text into indexable pages until tmp/rephrase/ completes.
4. **The invariant**: indexable ⇔ sitemapped ⇔ prerendered. New route families get all three or `noindex`.
5. **Annual freshness debt**: college titles hardcode "(2026)"; pillar/score-goal/asset `datePublished` constants are single hardcoded dates. Roll these each January (grep for `(2026)` and `_PUBLISHED`).

## 7. Measurement cadence

- **Weekly**: GSC Page indexing trend (the fix layer should move "Discovered – currently not indexed" → indexed over 4–8 weeks); Performance → new queries for score/college/skill pages.
- **Monthly**: CWV field data (PSI / GSC CWV report) — the preload pruning + cache fix should improve mobile LCP; Ahrefs/GSC links report on the 76 linkable assets.
- **Per deploy**: build hard-fails if any of the 1,383 pages prerenders thin (<300 chars) — treat a prerender failure as a release blocker, never bypass it.
- **Before each content wave**: confirm the previous wave's index rate >60% in GSC; if not, fix quality/linking before adding pages.
