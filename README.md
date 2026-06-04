# 1600 Prep Hub

1600 Prep Hub is a Vite/React app for SAT prep content, practice tools, and admin features.

## Repository Layout

- `src/`: application code
- `src/pages/`: top-level page files `Analysis.tsx`, `Home.tsx`, `Index.tsx`, `LandingVariant.tsx`, `MyPracticeSets.tsx`, `NotFound.tsx`, `ScoreCalculator.tsx`, `TestResults.tsx`, and `Vocab.tsx`, plus route folders for question bank, practice tests, module practice, SAT tools, SAT info pages, blog, college, country, legal, admin, and auth
- `src/components/`: shared components `AnalyticsPageTracker.tsx`, `AppShell.tsx`, `DraggableWindow.tsx`, `ErrorBoundary.tsx`, `OnboardingTour.tsx`, `ScrollToTop.tsx`, and `TransparentAwareImage.tsx`, plus `auth/`, `brand/`, `practice/`, `question/`, `seo/`, `tools/`, and `ui/`
- `src/contexts/`: shared React context code, including `AuthContext.tsx`
- `src/hooks/`: shared hooks such as `use-mobile.tsx`, `use-toast.ts`, `usePersonalization.ts`, `useThemeMode.ts`, and `useUserProgress.ts`
- `src/lib/`: shared app logic, Firebase utilities in `firebase/` (`authErrors.ts`, `firebaseAnalytics.ts`, `firebaseApp.ts`, `firebaseAuth.ts`, and `firebaseDb.ts`), practice helpers in `practice/` (`customPracticeSets.ts`, `modulePracticeNavigation.ts`, `modulePracticeSession.ts`, `moduleProgress.ts`, `practiceTestNavigation.ts`, `practiceTestScoring.ts`, and `practiceTestSession.ts`), generated helpers in `generated/` (`bankMetadata.generated.ts`, `bankTotals.generated.ts`, `questionSimilarity.generated.ts`, and `skillSampleQuestions.generated.ts`), SEO data and helpers in `seo-data/`, text helpers in `text/` (`answerEquivalence.ts`, `mathRendering.ts`, `mathTextNormalization.ts`, `nearDuplicateSpacing.ts`, `readingTextNormalization.ts`, and `sanitizeHtml.ts`), and files like `admin.ts`, `analytics.ts`, `authSecurity.ts`, `brand.ts`, `chunkLoadRecovery.ts`, `desmosLoader.ts`, `explanationApi.ts`, `personalization.ts`, `questionReports.ts`, `theme.ts`, and `utils.ts`
- `src/data/`: TypeScript, JSON, and generated data files including `all_questions.ts`, `bankQuestionMetadata.ts`, `bankTypes.ts`, `colleges.json`, `hardQuestions.ts`, `modulePracticeBank.ts`, `questionBank.ts`, `questionCategories.ts`, `questionImageMap.ts`, `satCalculator.ts`, `satImageManifest.ts`, `satQuestionImages.ts`, `unofficialQuestionImageMap.ts`, `unofficialQuestions.ts`, and `vocabulary.ts`, plus `modules/` and `questions/` source folders
- `src/data/modules/`: SAT module JSON files used to build `src/data/all_questions.ts`
- `src/data/questions/`: JSON question sources used by the app
- `public/assets/`: `cursors/`, including `macos-pointer.png` and `macos-cursor-LICENSE.md`, assets used at runtime
- `public/explanations/`: explanation JSON files and related images
- `public/images/`: `1600.now questions/`, `SAT-Style Questions/`, and runtime image assets
- `public/optimized/`: optimized image assets used at runtime
- `public/reference-sheet/`: reference sheet PNGs used by the app
- `public/`: runtime assets plus `favicon.ico`, `logo_b.png`, `og-image.png`, `robots.txt`, and `sitemap-*.xml`
- `scripts/`: build and maintenance scripts, including `generate-question-similarity.mjs`, `generate-sitemap.mjs`, `generate-skill-samples.mjs`, `prerender.mjs`, plus extract and image utilities
- `docs/`: deployment and Firebase setup docs (`DEPLOYMENT.md` and `FIREBASE_SETUP.md`)
- `root deployment/config files`: `.dockerignore`, `.env`, `.env.example`, `.env.local`, `.firebaserc`, `.gitignore`, `Dockerfile`, `docker-compose.yml`, `firebase.json`, `firestore.rules`, and `nginx.conf`
- `root app/build/tooling files`: `components.json`, `eslint.config.js`, `eslint.undefined.config.js`, `index.html`, `package-lock.json`, `package.json`, `postcss.config.js`, `tailwind.config.ts`, `tsconfig.app.json`, `tsconfig.json`, `tsconfig.node.json`, and `vite.config.ts`

## Local Development

Run `npm install`, then start the dev server with `npm run dev`.

## Scripts

- `npm run dev`: start the Vite dev server
- `npm run lint`: run ESLint across the repo
- `npm run lint:undef`: run the undefined-variable check for TypeScript and TSX files
- `npm run build`: run lint:undef, skill-sample generation, sitemap generation, the Vite build, and prerendering
- `npm run build:dev`: run lint:undef and a development-mode Vite build
- `npm run sitemap`: regenerate sitemap files
- `npm run skill-samples`: regenerate skill sample content
- `npm run prerender`: prerender routes after a build
- `npm run preview`: preview the built app locally

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Docker and self-hosting setup, and [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) for Firebase auth and Firestore setup.

## Notes

- The SAT question bank lives under `src/pages/bank/`, with supporting components under `src/components/question/`.
- For custom domains, Firebase Google Sign-In needs `/__/auth/*` routed back to the Firebase project domain; the Docker Nginx configuration already includes that proxy.
- Generated build, audit, review, and local-tool outputs are omitted from the source tree.
