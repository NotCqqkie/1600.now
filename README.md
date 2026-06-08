# 1600.now

1600.now is a Digital SAT prep website with a full question bank, timed practice tests, custom practice sets, score tools, vocabulary study, progress analytics, and a large SAT content library.

Live site: [1600.now](https://1600.now)

The product is built as a Vite + React + TypeScript app. It uses Firebase for authentication, account sync, analytics, Firestore-backed progress, and admin-only question report review.

## Product Overview

1600.now is both a study app and an SAT resource library.

The app side helps students practice:

- Search and filter thousands of SAT questions.
- Work through individual questions with SAT-style tools.
- Build targeted practice sets from related questions.
- Take timed full-length practice tests and individual modules.
- Review results, explanations, answer history, and timing.
- Track progress by subject, domain, skill, time, and accuracy.
- Study SAT vocabulary through flashcards, learn mode, matching, tests, and browsing.

The content side helps search visitors and students research SAT topics:

- Digital SAT guides.
- SAT score profiles.
- SAT skill pages.
- SAT FAQs.
- SAT tools and calculators.
- Blog posts.
- College SAT score pages.
- Country-specific SAT pages for India and the UAE.
- Linkable resource pages such as charts, worksheets, checklists, and study plans.

## Main Features

### Home Page

The home page introduces the platform and routes users into the core study flows.

It includes:

- Primary calls to open the Question Bank or Practice Tests.
- Navigation to 100 Hard Math, Practice Tests, Score Calculator, login, and signup.
- Live-feeling product previews for the bank, filters, question interface, and study workflow.
- Theme-aware visuals for light and dark mode.
- Auth-aware account menu when signed in.

### App Shell

Most app pages run inside a shared shell with desktop and mobile navigation.

The sidebar includes:

- Question Bank.
- 100 Hard Math.
- Practice Tests.
- Score Calculator.
- Vocabulary.
- My Practice Sets.
- Test Results.
- Settings.
- Statistics.

Shell features include:

- Collapsible desktop sidebar.
- Mobile menu and mobile bottom navigation.
- Light/dark theme toggle.
- Login and signup shortcuts for signed-out users.
- Sign-out flow for signed-in users.
- Onboarding tour replay.
- Embedded mode for homepage previews, which hides navigation chrome inside iframes.

## Question Bank

The Question Bank is the main practice surface.

Current bank totals from generated source data:

- 8,349 total questions.
- 5,127 official Bluebook-style/past questions.
- 3,222 unofficial questions.
- Math and Reading & Writing subjects.
- 29 official SAT skills represented across Math and Reading & Writing.

Bank entry points:

- `/bank`
- `/bank/math/browse`
- `/bank/reading/browse`
- `/bank/:subject/domain/:domain`
- `/bank/:subject/skill/:skill`
- `/bank/:subject/:id`

Bank features include:

- Subject switching between Math and Reading & Writing.
- Source switching between official/past, unofficial, and all questions.
- Domain and skill browsing.
- Counts by domain and skill.
- Search across question text, passages, prompts, choices, and correct answers.
- Keyword search with subject balancing.
- Multi-topic selection across domains and skills.
- Shuffle practice by all questions, domain, skill, or selected group.
- Near-duplicate spacing so similar questions are spread out in practice sessions.
- Practice sessions launched directly from filtered or selected questions.

Bank filters include:

- Difficulty: Easy, Medium, Hard.
- Time spent solving.
- Question activity.
- Marked for review.
- Solved.
- Answered incorrectly.

Bank progress indicators include:

- Completed counts inside filtered lists.
- Answered and unanswered status.
- Flagged question indicators.
- Continue button to resume the first unanswered question in a filtered set.
- Per-user storage so anonymous progress and signed-in progress do not bleed across accounts.

### 100 Hard Math

The `/hard` route is a focused entry point for the curated 100 Hard Math set.

It uses the same question interface as the bank and supports:

- Ordered navigation.
- Bookmarking/marking.
- Answer checking.
- Explanations.
- Desmos.
- Formula sheet.
- Question state persistence.

### Browse Hub

The `/browse` route is a topic hub for students who want a broad map of the app.

It links to:

- 100 Hard Math.
- Vocabulary.
- Full Question Bank.
- Practice Tests.
- Math topic groups.
- Reading & Writing topic groups.
- Individual official SAT skills with live question counts.

## Question Experience

The question page is reused across the bank, 100 Hard Math, custom practice sets, individual modules, and full practice tests.

Question types:

- Multiple-choice questions.
- Free-response questions.
- Math questions with rendered math.
- Reading & Writing questions with normalized reading text.
- Image-based questions and answer choices.

Core question controls:

- Previous and next navigation.
- Question navigator sheet.
- Practice navigation sheet.
- Module practice navigation sheet.
- Answer selection and free-response entry.
- Check answer flow.
- Correct-first, correct-later, incorrect, answered, and unanswered states.
- Attempt count tracking.
- Time spent tracking.
- Timer pause/resume.
- Hide/show timer.
- Fullscreen mode.
- Compact and split layout modes.
- Row and column view modes.
- Light/dark toggle.

Study tools inside a question:

- Desmos calculator window.
- Formula/reference sheet dialog.
- Explanation window.
- Step-by-step explanation rendering when an explanation JSON exists.
- Fallback rationale rendering when full step-by-step data is not available.
- Draggable and sidebar-style tool windows.
- Split-screen positioning.
- Reading passage annotations and highlighting.
- Strikethrough for answer elimination.
- Notes window.
- Previous attempts dialog.
- Question info.
- Report question dialog.
- Create Practice Set from related questions.

Saved question state includes:

- Current answer.
- Checked answers.
- Attempt count.
- Correct/incorrect status.
- Flagged state.
- Notes.
- Reading annotations.
- Total time spent.

## Custom Practice Sets

My Practice Sets lets users save and revisit focused question groups.

Custom set features:

- Create a set from any bank question using the More menu.
- Automatically find related questions using generated similarity groups.
- Save 5-20 related questions for focused review.
- Support larger bank-selection sets when launched from selected questions.
- Generate readable titles from subject, domain, skill, and similarity group.
- Track completed count and percent complete.
- Resume from the first incomplete question.
- Delete saved sets.
- Store sets per anonymous user or signed-in account.
- Merge anonymous sets into the account on login.

Route:

- `/my-practice-sets`

## Practice Tests And Modules

The Practice Tests area is built from individual Digital SAT module JSON files.

Source data includes:

- 245 module JSON files.
- Reading & Writing modules with 27 questions.
- Math modules with 22 questions.
- Module metadata for month, year, region, form, subject, and module number.
- Repaired/replacement slots where module data needs to be completed from the bank.
- Generated practice sets that combine modules into full tests.

Practice Tests route:

- `/modules`

Practice-test features:

- Full practice test launch from each practice set.
- Individual module practice launch.
- Filters by subject, module number, and completion status.
- Resume most recent saved session.
- Discard saved session.
- Preserve scroll position when returning to the module browser.

Full test options:

- Timed or untimed mode.
- Normal time.
- 1.5x time.
- 2x time.
- Advanced per-module time limits.
- Optional instant answer checking.
- Resume saved full-test sessions.
- Discard saved full-test sessions.

Individual module options:

- Timed or untimed mode.
- Adjustable time limit.
- Optional instant answer checking.
- Resume saved module sessions.
- Discard saved module sessions.

Practice-test flow:

- Start screen.
- Module question flow.
- Review screen before submitting a module.
- Transition screen between sections/modules.
- Break transition in the full-test flow.
- Results screen.

Review screen features:

- Answered count.
- Unanswered count.
- Marked-for-review indicators.
- Timer with hide/show and pause/resume.
- Grid navigation back to any question.
- Submit confirmation.
- Auto-submit when a timed module reaches zero.

## Results And Scoring

Full practice-test results include:

- Total SAT estimate from 400-1600.
- Reading & Writing score from 200-800.
- Math score from 200-800.
- Module-level score estimates.
- Answered, unanswered, correct, and incorrect counts.
- Accuracy.
- Raw score.
- Time used.
- Per-question answer review.
- Correct answer hiding/revealing.
- Expand/collapse all visible questions.
- Sort by original order or correctness.
- Sort ascending or descending.
- Filter by module.
- Open explanations in a draggable/sidebar window.
- Share message and native share image support.

Module results include:

- Accuracy.
- Correct count.
- Answered and unanswered count.
- Time used.
- Average time by question type.
- Domain performance.
- Slowest and fastest questions.
- Sortable question review.
- Hidden/revealed correct answers.
- Explanations.

Result history route:

- `/test-results`

The result history can switch between:

- Full-length tests.
- Individual modules.

## Score Calculator

The Digital SAT Score Calculator converts raw module counts into scaled scores.

Route:

- `/score-calculator`

Features:

- Reading & Writing Module 1 slider.
- Reading & Writing Module 2 slider.
- Math Module 1 slider.
- Math Module 2 slider.
- Live Reading & Writing section score.
- Live Math section score.
- Live total score.
- Module progress bars.
- Reset control.
- Light/dark-aware presentation.
- SEO content below the calculator.

The calculator data also includes legacy pen-and-paper tables, score color bands, raw-score distributions, percentile helpers, and ordinal formatting utilities.

## Vocabulary

The vocabulary trainer contains:

- 1,800 words.
- 36 vocabulary sets.
- Foundational, Intermediate, Advanced, and Expert levels.
- Per-word definitions, part of speech, example usage, synonyms, antonyms, difficulty, and set metadata.

Route:

- `/vocab`

Modes:

- Flashcards.
- Learn.
- Match.
- Test.
- Browse.

Vocabulary features:

- Per-set progress.
- New, learning, and mastered statuses.
- Mastery dots.
- Mastery requires repeated confirmation across multiple practice modes.
- Flashcard groups.
- Learn rounds with multiple-choice definition practice.
- Match rounds with word-definition pairing.
- Timed test mode with mixed question types.
- Browse mode with search and status filters.
- Reset progress for the active set.
- Progress saved locally and synced to Firestore for signed-in users.

## Statistics

The Statistics page aggregates question progress and practice test history.

Route:

- `/analysis`

Tracked metrics include:

- Total attempted questions.
- Overall accuracy.
- First-try accuracy.
- Total time spent.
- Average time per question.
- Math accuracy.
- Reading & Writing accuracy.
- Domain-level accuracy.
- Skill-level accuracy.
- Fastest and slowest domains.
- Fastest and slowest skills.
- Daily activity counts.
- Accuracy over time.
- Past practice test score history.

Visualizations include:

- Year-style activity heatmap.
- Accuracy-over-time area chart.
- Past practice test strip.
- Subject insight cards for Math and Reading & Writing.

Signed-out users can use the app, but the Statistics page prompts them to sign in for cross-device progress tracking.

## Authentication And Account Sync

Authentication is Firebase-backed.

Supported auth flows:

- Email and password signup.
- Email verification.
- Email and password login.
- Google redirect sign-in.
- Password reset.
- Sign out.

Account behavior:

- Signed-out progress is stored in an anonymous local slot.
- Signed-in progress is stored in a user-scoped local slot.
- On first login, anonymous local data is merged into the account.
- Firestore sync stores question progress, question UI state, vocabulary progress, personalization, and custom practice sets.
- Cross-tab storage events keep active user progress in sync.
- Admin status comes from Firebase token claims.

Auth routes:

- `/login`
- `/signup`
- `/verify-email`

## Settings And Personalization

Settings route:

- `/profile`

Settings features:

- Account details.
- Email display.
- User ID display.
- Sign out.
- Reset all question progress.
- Link to personalization.

Personalization route:

- `/profile/personalization`

Personalization features:

- Question font selection.
- Question text size selection.
- Live preview question.
- Reset to defaults.
- Instant preference application across question text, passages, and answer choices.

## SAT Tools

The tool pages are public SEO-friendly calculators and planners.

Routes:

- `/sat-to-act-converter`
- `/sat-percentile-calculator`
- `/psat-to-sat-predictor`
- `/sat-study-plan-generator`
- `/what-sat-score-do-i-need`
- `/sat-test-countdown`

Tools include:

- SAT to ACT Converter using the official College Board x ACT concordance table.
- SAT Percentile Calculator with score tier labels and links to score profiles.
- PSAT to SAT Score Predictor based on PSAT score and months until SAT.
- SAT Study Plan Generator using baseline score, target score, and weeks available.
- What SAT Score Do I Need with curated college SAT middle-50 ranges.
- SAT Test Countdown with selectable upcoming SAT dates and backward planning guidance.

Each tool includes:

- Page-specific SEO metadata.
- Breadcrumb JSON-LD.
- FAQ JSON-LD.
- WebApplication JSON-LD.
- Supporting explanatory copy.

## SAT Content Library

1600.now includes a large content system for organic SAT search traffic.

Content families:

- Pillar guides.
- SAT skill pages.
- SAT score profiles.
- Score-goal pages.
- SAT FAQs.
- Blog posts.
- Vocabulary SEO pages.
- Linkable resource assets.
- Country hubs and country topic pages.
- College SAT pages.
- Landing-page variants.

Main content routes:

- `/digital-sat-guide`
- `/digital-sat-math`
- `/digital-sat-reading-writing`
- `/bluebook-app-guide`
- `/desmos-sat-guide`
- `/sat-vs-act`
- `/how-to-study-for-sat`
- `/sat-practice-tests`
- `/sat-for-international-students`
- `/sat-skill`
- `/sat-skill/:slug`
- `/sat-score`
- `/sat-score/:score`
- `/sat-faq`
- `/sat-faq/:slug`
- `/sat-vocabulary`
- `/is-a-[score]-a-good-sat-score`
- `/blog`
- `/blog/:slug`
- `/college`
- `/college/:slug`
- `/in`
- `/in/:topic`
- `/ae`
- `/ae/:topic`
- `/:slug` for landing variants, pillar guides, score-goal pages, and linkable assets.

Content data includes:

- 9 long-form pillar guides.
- 29 SAT skill pages.
- Score pages for every score from 400 to 1600 in 10-point increments.
- "Is this SAT score good?" pages for score-specific search queries.
- SAT FAQs on timing, calculators, scoring, guessing, PSAT, test dates, registration, scratch paper, and more.
- 50+ blog posts covering strategy, test day, Reading & Writing, Math, score improvement, and admissions.
- Linkable assets such as score charts, percentile charts, timing charts, format charts, formula charts, grammar charts, checklists, worksheets, study plans, and conversion charts.
- India and UAE hubs plus topic pages for test centers, fees, SAT vs local exams, scholarships, and preparation.
- College pages generated from `src/data/colleges.json`.

SEO implementation includes:

- Page-level title and description metadata.
- Canonical URLs.
- Breadcrumb JSON-LD.
- FAQ JSON-LD where relevant.
- WebApplication JSON-LD for tools.
- Sitemap files in `public/`.
- `robots.txt`.
- Open Graph image assets.

## Question Reports And Admin

Users can report questions from the question page.

Report data includes:

- Question ID.
- Reason counts.
- Total report count.
- Last reported timestamp.
- Optional comments.
- User ID on comments when available.

Admin route:

- `/admin/reports`

Admin features:

- Admin-only access based on Firebase token claims.
- List reported questions.
- Show report totals.
- Show comment totals.
- Preview reported question text.
- Show reason-count pills.
- Show comment bodies and timestamps.
- Refresh reports.

## Legal And Error Pages

Public legal pages:

- `/privacy`
- `/terms`

Other support routes:

- `*` renders the Not Found page.

## Data And Assets

Important source areas:

- `src/App.tsx`: route definitions, app providers, lazy-loaded page setup, loading skeletons.
- `src/pages/`: route-level screens.
- `src/components/`: shared UI, app shell, question controls, practice components, SEO components, auth helpers, and brand components.
- `src/contexts/AuthContext.tsx`: Firebase auth and session state.
- `src/hooks/`: progress, personalization, theme, toast, and mobile helpers.
- `src/lib/`: Firebase helpers, practice-session logic, scoring, text rendering, analytics, personalization, reports, and generated metadata.
- `src/data/`: question banks, module data, vocabulary, calculator data, colleges, question images, and generated/curated data.
- `src/lib/seo-data/`: public content-library data.
- `public/explanations/`: saved explanation JSON.
- `public/images/`: question images and runtime image assets.
- `public/reference-sheet/`: SAT reference sheet images.
- `public/optimized/`: optimized brand assets.
- `public/sitemap*.xml`: generated sitemap files.

## Persistence Model

Local storage and session storage are used for fast app state:

- Question progress.
- Question UI state.
- Vocabulary progress.
- Custom practice sets.
- Current bank practice sessions.
- Module practice sessions.
- Full practice-test sessions.
- Desmos UI state.
- Notes.
- Reading annotations.
- View modes.
- Onboarding state.

Firestore is used for account sync when a user is signed in:

- User progress.
- Vocabulary progress.
- Personalization preferences.
- Question UI state.
- Custom practice sets.
- Question reports.

## Tech Stack

- React 18.
- TypeScript.
- Vite.
- React Router.
- TanStack React Query.
- Firebase Auth, Firestore, and Analytics.
- Tailwind CSS.
- shadcn-style Radix UI components.
- lucide-react icons.
- KaTeX math rendering.
- DOMPurify sanitization.
- Recharts for analytics charts.
- date-fns for time formatting.

## Route Map

| Area | Routes |
| --- | --- |
| Home | `/` |
| Auth | `/login`, `/signup`, `/verify-email` |
| Question Bank | `/bank`, `/bank/:subject/browse`, `/bank/:subject/:filterType/:filterValue`, `/bank/:subject/:id` |
| 100 Hard Math | `/hard`, `/hard/:id` |
| Browse Hub | `/browse` |
| Practice Tests | `/modules`, `/practice-tests/:setId`, `/practice-tests/:setId/start`, `/practice-tests/:setId/transition`, `/practice-tests/:setId/review`, `/practice-tests/:setId/results` |
| Module Practice | `/modules/:moduleId`, `/modules/:moduleId/start`, `/modules/:moduleId/review`, `/modules/:moduleId/results` |
| Study Tools | `/score-calculator`, `/vocab`, `/analysis`, `/test-results`, `/my-practice-sets` |
| Settings | `/profile`, `/profile/personalization` |
| SAT Tools | `/sat-to-act-converter`, `/sat-percentile-calculator`, `/psat-to-sat-predictor`, `/sat-study-plan-generator`, `/what-sat-score-do-i-need`, `/sat-test-countdown` |
| SAT Content | `/sat-vocabulary`, `/sat-score`, `/sat-score/:score`, `/sat-skill`, `/sat-skill/:slug`, `/sat-faq`, `/sat-faq/:slug`, `/:slug` |
| Blog | `/blog`, `/blog/:slug` |
| Country Pages | `/in`, `/in/:topic`, `/ae`, `/ae/:topic` |
| Colleges | `/college`, `/college/:slug` |
| Admin | `/admin/reports` |
| Legal | `/privacy`, `/terms` |
| Fallback | `*` |
