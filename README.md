# 1600.now

1600.now is my Digital SAT prep app.

Live site: [1600.now](https://1600.now)

It started as a question bank and grew into the SAT workspace I kept wishing existed: real questions, fast filtering, practice tests, Desmos, explanations, saved progress, score tools, vocab, and enough route-specific SAT pages to stop every Google result from feeling like recycled advice.

The standard I keep using is simple. A student should be able to open a real question, filter down to the exact thing they missed, check an answer, see what happened last time, and keep going. No giant worksheet PDF. No "go read this article first." No interface that gets louder than the question.

## what's here

- A Digital SAT question bank with 8,334 visible questions right now.
- 5,106 past/official-style questions and 3,228 unofficial questions.
- Math and Reading & Writing coverage across the 29 official SAT skills.
- A curated `/hard` set for 100 Hard Math.
- Bank-backed full practice tests and modules: 36 practice tests, 144 modules, 3,528 practice questions.
- Custom practice sets built from related questions.
- Saved progress, notes, timing, marked questions, previous attempts, and answer state.
- A score calculator, vocabulary trainer, result history, and statistics page.
- Public SAT guides, tools, college score pages, country pages, blog posts, FAQs, and generated sitemaps.
- Firebase Auth, Firestore sync, Analytics, and an admin-only question report page.

## what I keep tightening

The bank is the center of the app. Most SAT sites make students choose between a giant list of questions and a polished but locked-down practice flow. This tries to keep both: fast browsing when you want to hunt for a skill, and focused sessions when you want to stop deciding and just practice.

The question viewer is reused almost everywhere: bank questions, 100 Hard Math, custom sets, modules, and full tests. That is why so many tiny details live there. It handles multiple choice, free response, images, rendered math, reading passages, annotations, strikethrough, notes, Desmos, a formula sheet, explanations, timers, split layouts, fullscreen mode, and previous attempts.

A lot of the work has been weirdly specific on purpose. Search had to stop freezing on the first keystroke. Question-to-question navigation had to stop flashing a skeleton screen. Image questions had to stop doing runtime canvas work before the first click. The sidebar and floating windows had to return to the places students expect. The small stuff matters because students are usually already annoyed when they are practicing SAT math.

The explanations are meant to start with the fastest reasonable method, especially for math. If Desmos, a graph, a table, or a quick substitution is the cleanest route, that should come first. The longer algebra can still be there, but it should not be the first thing a student has to read.

## main routes

| area | routes |
| --- | --- |
| Home | `/` |
| Question Bank | `/bank`, `/bank/math/browse`, `/bank/reading/browse`, `/bank/:subject/:id` |
| 100 Hard Math | `/hard`, `/hard/:id` |
| Practice Tests | `/modules`, `/practice-tests/:setId/start`, `/practice-tests/:setId/results` |
| Module Practice | `/modules/:moduleId/start`, `/modules/:moduleId/results` |
| Saved Work | `/my-practice-sets`, `/test-results`, `/analysis` |
| Tools | `/score-calculator`, `/vocab`, `/sat-study-plan-generator`, `/sat-test-countdown` |
| Settings | `/profile`, `/profile/personalization` |
| Content | `/digital-sat-guide`, `/desmos-sat-guide`, `/sat-skill/:slug`, `/sat-score/:score`, `/blog/:slug`, `/college/:slug` |
| Admin | `/admin/reports` |

There is also a hidden-by-navigation study planner at `/study-plan-lab`. It is reachable by URL, noindexed, and not part of the public nav.

## stack

This is a Vite + React 18 + TypeScript app.

The UI uses Tailwind CSS, shadcn-style Radix primitives, lucide icons, KaTeX, DOMPurify, Recharts, Sonner, and a few focused helpers around local storage, generated bank metadata, and Firebase sync. Routing is `react-router-dom`. Server state and async helpers use TanStack React Query where it fits.

Firebase handles Auth, Firestore, Hosting, Analytics, and admin claims. Local emulator ports are wired in `firebase.json`: Auth on `9099`, Firestore on `8089`, Emulator UI on `4000`.

The SAT question and route data are mostly static/generated. The build creates hidden-question data, skill samples, question-image metadata, bank route indexes, sitemap files, the Vite bundle, and prerendered HTML.

## repo map

- `src/App.tsx` - routes, providers, lazy page setup, route preload rules.
- `src/pages/` - page-level screens.
- `src/pages/bank/Question.tsx` - the shared question viewer. If a question surface is acting strange, start here.
- `src/pages/bank/BankIndex.tsx` - the main `/bank` browse/search page.
- `src/components/` - app shell, shared UI, question tools, SEO helpers, auth pieces.
- `src/contexts/AuthContext.tsx` - Firebase auth, account state, email verification and reset flows.
- `src/lib/` - Firebase helpers, practice/session logic, bank search, scoring, analytics, personalization, reports, generated metadata.
- `src/data/` - question banks, hard questions, modules, vocabulary, calculator data, colleges, images.
- `src/lib/seo-data/` - public SAT content data.
- `public/explanations/` - explanation JSON files.
- `public/images/` - question images and other runtime image assets.
- `public/generated/` - generated bank/search/image artifacts used by the app.
- `scripts/` - generation, audits, extraction, prerendering, sitemap, and verification scripts.

I avoid treating `dist/`, `node_modules/`, and `.claude/` as source.

## local setup

Use npm.

```bash
npm install
npm run dev
```

The dev server runs on port `8080`.

```bash
http://localhost:8080
```

Preview builds use port `4173`.

```bash
npm run preview
```

## scripts I actually use

```bash
npm run lint:undef
```

Fast undefined-symbol check for TS/TSX files. This is usually the first check after a focused code edit.

```bash
npm run lint
```

Full ESLint pass.

```bash
npm run build:dev
```

Vite development-mode build after the undefined-symbol check. Good when I need a real bundle without the full generated-content/prerender pipeline.

```bash
npm run build
```

Full production build. This runs generated-content steps, question-image sizing, route-index generation, sitemap generation, Vite build, and prerendering.

```bash
npm run deploy
```

Full build plus Firebase Hosting deploy to `now-483609`.

Other useful checks:

```bash
npm run audit:math-explanations
npm run audit:explanation-quality
npm run audit:desmos-expressions
npm run verify:study-plan-lab
```

## deployment notes

Hosting serves from `dist/`. Firebase is set to `cleanUrls: true` and `trailingSlash: false`, because the canonical no-slash routes need to return route-specific HTML directly.

The app depends on prerendered SAT content routes. When SEO pages look wrong, the first thing to check is the actual served HTML for the route, then `scripts/prerender.mjs`, then metadata copy.

Generated sitemap files live in `public/`. If the route/content set changes, regenerate them instead of hand-editing XML.

## data and persistence

Anonymous users can practice without making an account. Their progress stays in local storage under an anonymous slot. Signed-in users get a user-scoped local slot plus Firestore sync.

Saved state covers question progress, answer checks, attempts, notes, reading annotations, marked questions, time spent, vocab progress, custom practice sets, module sessions, full test sessions, personalization, and some Desmos/window state.

On first login, anonymous local work is merged into the account. Cross-tab storage events keep progress from drifting when the app is open in more than one tab.

## content notes

The public SAT content library is large because organic search is part of the product, but the pages should still be useful. The best pages connect back to real practice: filtered bank routes, tools, score pages, worksheets, charts, calculators, or study flows.

The strongest SEO work here has not been "write more pages." It has been making sure the pages that already exist have correct prerendered HTML, canonical URLs, usable titles, and a path back into practice.

## small scars

Some project details only make sense if you have spent time clicking through the app:

- `/hard` wording edits usually belong in `src/data/hardQuestions.ts`, not the shared renderer.
- The bank search path uses generated data and workerized search because the main thread should not choke when a student types the first letter.
- Question images have generated sizing/optimization metadata because runtime analysis made the first navigation feel laggy.
- The home page avoids eagerly pulling the real bank and question viewer into the first load.
- Practice Save & Exit flows should return to `/modules`, because that is where students expect to land after modules and full tests.
- The hidden study-plan lab launches exact practice work, not broad browse pages.

Those are not big architectural slogans. They are just things that felt bad in the browser until they were fixed.
