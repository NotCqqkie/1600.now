import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy, type ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthReturnTracker } from "@/components/AuthReturnTracker";
import { AccountSync } from "@/components/AccountSync";
import { EmailVerificationGuard } from "@/components/EmailVerificationGuard";
import { AnalyticsPageTracker } from "@/components/AnalyticsPageTracker";
import { ScrollToTop } from "@/components/ScrollToTop";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { AppShell } from "@/components/AppShell";
import { Seo } from "@/components/Seo";
import { OnboardingTour } from "@/components/OnboardingTour";
import "@/lib/personalization";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const Index = lazy(() => import("./pages/Index"));
const HardQuestionsIntro = lazy(() => import("./pages/HardQuestionsIntro"));
const Question = lazy(() => import("./pages/Question"));
const BankIndex = lazy(() => import("./pages/BankIndex"));
const BankBrowse = lazy(() => import("./pages/BankBrowse"));
const BankFiltered = lazy(() => import("./pages/BankFiltered"));
const Analysis = lazy(() => import("./pages/Analysis"));
const Modules = lazy(() => import("./pages/Modules"));
const PracticeTestStart = lazy(() => import("./pages/PracticeTestStart"));
const PracticeTestTransition = lazy(() => import("./pages/PracticeTestTransition"));
const PracticeTestReview = lazy(() => import("./pages/PracticeTestReview"));
const PracticeTestResults = lazy(() => import("./pages/PracticeTestResults"));
const ModuleStart = lazy(() => import("./pages/ModuleStart"));
const ModulePracticeReview = lazy(() => import("./pages/ModulePracticeReview"));
const ModulePracticeResults = lazy(() => import("./pages/ModulePracticeResults"));
const Vocab = lazy(() => import("./pages/Vocab"));
const ScoreCalculator = lazy(() => import("./pages/ScoreCalculator"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Profile = lazy(() => import("./pages/Profile"));
const Personalization = lazy(() => import("./pages/Personalization"));
const SatVocabularyIndex = lazy(() => import("./pages/SatVocabularyIndex"));
const SatScoreIndex = lazy(() => import("./pages/SatScoreIndex"));
const SatScoreDetail = lazy(() => import("./pages/SatScoreDetail"));
const SatSkillIndex = lazy(() => import("./pages/SatSkillIndex"));
const SatSkillDetail = lazy(() => import("./pages/SatSkillDetail"));
const BlogIndex = lazy(() => import("./pages/BlogIndex"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const LandingVariant = lazy(() => import("./pages/LandingVariant"));
const IsScoreGood = lazy(() => import("./pages/IsScoreGood"));
const SatFaqIndex = lazy(() => import("./pages/SatFaqIndex"));
const SatFaqPage = lazy(() => import("./pages/SatFaqPage"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PillarPage = lazy(() => import("./pages/PillarPage"));
const ScoreGoalPage = lazy(() => import("./pages/ScoreGoalPage"));
const SatToActConverter = lazy(() => import("./pages/tools/SatToActConverter"));
const SatPercentileCalculator = lazy(() => import("./pages/tools/SatPercentileCalculator"));
const PsatToSatPredictor = lazy(() => import("./pages/tools/PsatToSatPredictor"));
const SatStudyPlanGenerator = lazy(() => import("./pages/tools/SatStudyPlanGenerator"));
const WhatSatScoreDoINeed = lazy(() => import("./pages/tools/WhatSatScoreDoINeed"));
const SatTestCountdown = lazy(() => import("./pages/tools/SatTestCountdown"));
const CountryHubPage = lazy(() => import("./pages/CountryHubPage"));
const CountryTopicPage = lazy(() => import("./pages/CountryTopicPage"));
const CollegeIndex = lazy(() => import("./pages/CollegeIndex"));
const CollegePage = lazy(() => import("./pages/CollegePage"));

import { landingVariants } from "@/lib/landingVariants";
import { pillarPages } from "@/lib/pillarData";
import { scoreGoalPages } from "@/lib/scoreGoalData";
import { countryHubs, countryPages } from "@/lib/countryHubData";

const queryClient = new QueryClient();

const Loading = () => (
  <div className="flex h-screen items-center justify-center bg-background text-foreground">
    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

const withSuspense = (page: ReactNode) => (
  <Suspense fallback={<Loading />}>{page}</Suspense>
);

const withShellSuspense = (page: ReactNode) => withSuspense(<AppShell>{page}</AppShell>);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner position="top-center" duration={2000} />
        <BrowserRouter>
          <Seo />
          <ScrollToTop />
          <AuthReturnTracker />
          <AccountSync />
          <EmailVerificationGuard />
          <AnalyticsPageTracker />
          <Routes>
            <Route path="/" element={withSuspense(<Home />)} />
            <Route path="/login" element={withSuspense(<Login />)} />
            <Route path="/modules" element={withShellSuspense(<Modules />)} />
            <Route path="/practice-tests/:setId" element={withSuspense(<PracticeTestStart />)} />
            <Route path="/practice-tests/:setId/start" element={withSuspense(<PracticeTestStart />)} />
            <Route path="/practice-tests/:setId/transition" element={withSuspense(<PracticeTestTransition />)} />
            <Route path="/practice-tests/:setId/review" element={withSuspense(<PracticeTestReview />)} />
            <Route path="/practice-tests/:setId/results" element={withSuspense(<PracticeTestResults />)} />
            <Route path="/modules/:moduleId" element={withSuspense(<ModuleStart />)} />
            <Route path="/modules/:moduleId/start" element={withSuspense(<ModuleStart />)} />
            <Route path="/modules/:moduleId/review" element={withSuspense(<ModulePracticeReview />)} />
            <Route path="/modules/:moduleId/results" element={withSuspense(<ModulePracticeResults />)} />
            <Route path="/signup" element={withSuspense(<Signup />)} />
            <Route path="/verify-email" element={withSuspense(<VerifyEmail />)} />
            <Route path="/profile" element={withShellSuspense(<Profile />)} />
            <Route path="/profile/personalization" element={withShellSuspense(<Personalization />)} />
            <Route path="/score-calculator" element={withShellSuspense(<ScoreCalculator />)} />
            <Route path="/browse" element={withShellSuspense(<Index />)} />
            <Route path="/hard" element={withShellSuspense(<HardQuestionsIntro />)} />
            <Route path="/hard/:id" element={withSuspense(<Question />)} />
            <Route path="/bank" element={withShellSuspense(<BankIndex />)} />
            <Route path="/bank/:subject/browse" element={withShellSuspense(<BankBrowse />)} />
            <Route path="/bank/:subject/:filterType/:filterValue" element={withShellSuspense(<BankFiltered />)} />
            <Route path="/bank/:subject/:id" element={withSuspense(<Question />)} />
            <Route path="/vocab" element={withShellSuspense(<Vocab />)} />
            <Route path="/analysis" element={withShellSuspense(<Analysis />)} />
            <Route path="/sat-vocabulary" element={withShellSuspense(<SatVocabularyIndex />)} />
            <Route path="/sat-score" element={withShellSuspense(<SatScoreIndex />)} />
            <Route path="/sat-score/:score" element={withShellSuspense(<SatScoreDetail />)} />
            <Route path="/sat-skill" element={withShellSuspense(<SatSkillIndex />)} />
            <Route path="/sat-skill/:slug" element={withShellSuspense(<SatSkillDetail />)} />
            <Route path="/blog" element={withShellSuspense(<BlogIndex />)} />
            <Route path="/blog/:slug" element={withShellSuspense(<BlogPost />)} />
            <Route path="/sat-faq" element={withShellSuspense(<SatFaqIndex />)} />
            <Route path="/sat-faq/:slug" element={withShellSuspense(<SatFaqPage />)} />
            {Array.from({ length: 121 }, (_, i) => 400 + i * 10).map((s) => (
              <Route
                key={`isgood-${s}`}
                path={`/is-a-${s}-a-good-sat-score`}
                element={withShellSuspense(<IsScoreGood />)}
              />
            ))}
            {landingVariants.map((v) => (
              <Route
                key={v.slug}
                path={`/${v.slug}`}
                element={withShellSuspense(<LandingVariant />)}
              />
            ))}
            <Route path="/privacy" element={withShellSuspense(<PrivacyPolicy />)} />
            <Route path="/terms" element={withShellSuspense(<TermsOfService />)} />
            {pillarPages.map((p) => (
              <Route
                key={`pillar-${p.slug}`}
                path={`/${p.slug}`}
                element={withShellSuspense(<PillarPage />)}
              />
            ))}
            {scoreGoalPages.map((p) => (
              <Route
                key={`score-goal-${p.slug}`}
                path={`/${p.slug}`}
                element={withShellSuspense(<ScoreGoalPage />)}
              />
            ))}
            <Route path="/sat-to-act-converter" element={withShellSuspense(<SatToActConverter />)} />
            <Route path="/sat-percentile-calculator" element={withShellSuspense(<SatPercentileCalculator />)} />
            <Route path="/psat-to-sat-predictor" element={withShellSuspense(<PsatToSatPredictor />)} />
            <Route path="/sat-study-plan-generator" element={withShellSuspense(<SatStudyPlanGenerator />)} />
            <Route path="/what-sat-score-do-i-need" element={withShellSuspense(<WhatSatScoreDoINeed />)} />
            <Route path="/sat-test-countdown" element={withShellSuspense(<SatTestCountdown />)} />
            {countryHubs.map((h) => (
              <Route
                key={`country-hub-${h.code}`}
                path={`/${h.hubSlug}`}
                element={withShellSuspense(<CountryHubPage />)}
              />
            ))}
            {countryPages.map((p) => (
              <Route
                key={`country-page-${p.slug}`}
                path={`/${p.slug}`}
                element={withShellSuspense(<CountryTopicPage />)}
              />
            ))}
            <Route path="/college" element={withShellSuspense(<CollegeIndex />)} />
            <Route path="/college/:slug" element={withShellSuspense(<CollegePage />)} />
<Route path="*" element={withShellSuspense(<NotFound />)} />
          </Routes>
          <LegalDisclaimer />
          <OnboardingTour />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
