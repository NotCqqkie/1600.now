import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AuthReturnTracker } from "@/components/auth/AuthReturnTracker";
import { EmailVerificationGuard } from "@/components/auth/EmailVerificationGuard";
import { AnalyticsPageTracker } from "@/components/AnalyticsPageTracker";
import { ScrollToTop } from "@/components/ScrollToTop";
import { LegalDisclaimer } from "@/components/brand/LegalDisclaimer";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Seo } from "@/components/seo/Seo";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "@/lib/personalization";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/auth/Login"));
const Signup = lazy(() => import("./pages/auth/Signup"));
const VerifyEmail = lazy(() => import("./pages/auth/VerifyEmail"));
const Index = lazy(() => import("./pages/Index"));
const HardQuestionsIntro = lazy(() => import("./pages/bank/HardQuestionsIntro"));
const Question = lazy(() => import("./pages/bank/Question"));
const BankIndex = lazy(() => import("./pages/bank/BankIndex"));
const BankBrowse = lazy(() => import("./pages/bank/BankBrowse"));
const BankFiltered = lazy(() => import("./pages/bank/BankFiltered"));
const Analysis = lazy(() => import("./pages/Analysis"));
const TestResults = lazy(() => import("./pages/TestResults"));
const MyPracticeSets = lazy(() => import("./pages/MyPracticeSets"));
const Modules = lazy(() => import("./pages/modules/Modules"));
const PracticeTestStart = lazy(() => import("./pages/practice-test/PracticeTestStart"));
const PracticeTestTransition = lazy(() => import("./pages/practice-test/PracticeTestTransition"));
const PracticeTestReview = lazy(() => import("./pages/practice-test/PracticeTestReview"));
const PracticeTestResults = lazy(() => import("./pages/practice-test/PracticeTestResults"));
const ModuleStart = lazy(() => import("./pages/modules/ModuleStart"));
const ModulePracticeReview = lazy(() => import("./pages/modules/ModulePracticeReview"));
const ModulePracticeResults = lazy(() => import("./pages/modules/ModulePracticeResults"));
const Vocab = lazy(() => import("./pages/Vocab"));
const ScoreCalculator = lazy(() => import("./pages/ScoreCalculator"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Profile = lazy(() => import("./pages/auth/Profile"));
const Personalization = lazy(() => import("./pages/auth/Personalization"));
const SatVocabularyIndex = lazy(() => import("./pages/sat-info/SatVocabularyIndex"));
const SatScoreIndex = lazy(() => import("./pages/sat-info/SatScoreIndex"));
const SatScoreDetail = lazy(() => import("./pages/sat-info/SatScoreDetail"));
const SatSkillIndex = lazy(() => import("./pages/sat-info/SatSkillIndex"));
const SatSkillDetail = lazy(() => import("./pages/sat-info/SatSkillDetail"));
const BlogIndex = lazy(() => import("./pages/blog/BlogIndex"));
const BlogPost = lazy(() => import("./pages/blog/BlogPost"));
const IsScoreGood = lazy(() => import("./pages/sat-info/IsScoreGood"));
const SatFaqIndex = lazy(() => import("./pages/sat-info/SatFaqIndex"));
const SatFaqPage = lazy(() => import("./pages/sat-info/SatFaqPage"));
const PrivacyPolicy = lazy(() => import("./pages/legal/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/legal/TermsOfService"));
const TopLevelSeoPage = lazy(() => import("./pages/sat-info/TopLevelSeoPage"));
const SatToActConverter = lazy(() => import("./pages/tools/SatToActConverter"));
const SatPercentileCalculator = lazy(() => import("./pages/tools/SatPercentileCalculator"));
const PsatToSatPredictor = lazy(() => import("./pages/tools/PsatToSatPredictor"));
const SatStudyPlanGenerator = lazy(() => import("./pages/tools/SatStudyPlanGenerator"));
const WhatSatScoreDoINeed = lazy(() => import("./pages/tools/WhatSatScoreDoINeed"));
const SatTestCountdown = lazy(() => import("./pages/tools/SatTestCountdown"));
const CountryHubPage = lazy(() => import("./pages/country/CountryHubPage"));
const CountryTopicPage = lazy(() => import("./pages/country/CountryTopicPage"));
const CollegeIndex = lazy(() => import("./pages/college/CollegeIndex"));
const CollegePage = lazy(() => import("./pages/college/CollegePage"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AppShell = lazy(() => import("./components/AppShell").then((mod) => ({ default: mod.AppShell })));
const AccountSync = lazy(() => import("./components/auth/AccountSync").then((mod) => ({ default: mod.AccountSync })));
const OnboardingTour = lazy(() => import("./components/OnboardingTour").then((mod) => ({ default: mod.OnboardingTour })));

const queryClient = new QueryClient();
const ONBOARDING_REPLAY_REQUEST_KEY = "onboarding-replay-requested";
const PRACTICE_SET_HELP_REQUEST_KEY = "practice-set-help-requested";

const hasPendingTourRequest = () =>
  typeof window !== "undefined" &&
  (
    sessionStorage.getItem("onboarding-pending") === "1" ||
    sessionStorage.getItem(ONBOARDING_REPLAY_REQUEST_KEY) === "1" ||
    sessionStorage.getItem(PRACTICE_SET_HELP_REQUEST_KEY) === "1"
  );

const LoadingBlock = ({ className }: { className: string }) => (
  <div className={`motion-safe:animate-pulse bg-muted/80 ${className}`} />
);

const EmbeddedQuestionSkeleton = () => (
  <AccurateQuestionSkeleton horizontal />
);

const EmbeddedBankSkeleton = () => (
  <div className="h-screen overflow-hidden bg-transparent p-4 text-foreground">
    <div className="mx-auto h-full max-w-6xl space-y-2 overflow-hidden">
      <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="grid gap-2 md:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="space-y-1.5">
              <LoadingBlock className="h-3 w-16 rounded-full" />
              <LoadingBlock className="h-8 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid h-[calc(100%-4.25rem)] min-h-0 grid-cols-2 gap-4">
        {[0, 1].map((column) => (
          <div key={column} className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <LoadingBlock className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <LoadingBlock className="h-5 w-32 rounded-full" />
                <LoadingBlock className="h-3 w-24 rounded-full" />
              </div>
            </div>
            <div className="space-y-3">
              {[0, 1, 2, 3, 4, 5].map((item) => (
                <div key={item} className="space-y-2 rounded-lg border border-border/60 p-3">
                  <div className="flex items-center justify-between">
                    <LoadingBlock className="h-4 w-40 rounded-full" />
                    <LoadingBlock className="h-5 w-14 rounded-full" />
                  </div>
                  <LoadingBlock className="h-3 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ShellSkeleton = ({ children, maxWidth = "max-w-5xl" }: { children: ReactNode; maxWidth?: string }) => (
  <div className="min-h-screen bg-background text-foreground lg:pl-64">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border/60 bg-card/95 px-4 py-3 lg:flex">
      <LoadingBlock className="h-9 w-36 rounded-md" />
      <div className="mt-5 space-y-2">
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="flex h-10 items-center gap-3 rounded-lg px-2">
            <LoadingBlock className="h-4 w-4 rounded" />
            <LoadingBlock className="h-3 w-32 rounded-full" />
          </div>
        ))}
      </div>
      <div className="mt-8 space-y-2 border-t border-border/70 pt-4">
        {[0, 1, 2].map((item) => (
          <div key={item} className="flex h-10 items-center gap-3 rounded-lg px-2">
            <LoadingBlock className="h-4 w-4 rounded" />
            <LoadingBlock className="h-3 w-28 rounded-full" />
          </div>
        ))}
      </div>
      <div className="mt-auto space-y-2 border-t border-border/70 pt-3">
        <LoadingBlock className="h-10 w-full rounded-lg" />
        <LoadingBlock className="h-10 w-full rounded-lg" />
      </div>
    </aside>
    <div className="min-h-screen pt-14 lg:pt-0">
      <main className={`mx-auto w-full ${maxWidth} px-4 py-5 sm:px-6 lg:px-8`}>
        {children}
      </main>
    </div>
  </div>
);

const PageHeaderSkeleton = ({ wide = false }: { wide?: boolean }) => (
  <header className="mb-8 space-y-3">
    <LoadingBlock className={`h-10 rounded-full ${wide ? "w-full max-w-3xl" : "w-72 max-w-full"}`} />
    <LoadingBlock className="h-4 w-full max-w-2xl rounded-full" />
    <LoadingBlock className="h-4 w-4/5 max-w-xl rounded-full" />
  </header>
);

const HomeSkeleton = () => (
  <div className="min-h-screen bg-background px-4 py-5 text-foreground">
    <div className="mx-auto max-w-6xl">
      <div className="mb-14 flex items-center justify-between">
        <LoadingBlock className="h-10 w-36 rounded-md" />
        <div className="hidden items-center gap-3 md:flex">
          <LoadingBlock className="h-3 w-24 rounded-full" />
          <LoadingBlock className="h-3 w-28 rounded-full" />
          <LoadingBlock className="h-3 w-24 rounded-full" />
        </div>
        <LoadingBlock className="h-9 w-24 rounded-full" />
      </div>
      <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-5">
          <LoadingBlock className="h-12 w-11/12 rounded-full" />
          <LoadingBlock className="h-12 w-4/5 rounded-full" />
          <LoadingBlock className="h-4 w-full rounded-full" />
          <LoadingBlock className="h-4 w-5/6 rounded-full" />
          <div className="flex gap-3 pt-4">
            <LoadingBlock className="h-11 w-44 rounded-lg" />
            <LoadingBlock className="h-11 w-36 rounded-lg" />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <LoadingBlock className="h-4 w-36 rounded-full" />
            <LoadingBlock className="h-8 w-28 rounded-md" />
          </div>
          <div className="grid gap-5 md:grid-cols-[1fr_0.85fr]">
            <div className="space-y-3">
              <LoadingBlock className="h-4 w-full rounded-full" />
              <LoadingBlock className="h-4 w-10/12 rounded-full" />
              <LoadingBlock className="h-44 w-full rounded-lg" />
            </div>
            <div className="space-y-3">
              {[0, 1, 2, 3].map((item) => (
                <LoadingBlock key={item} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const AuthSkeleton = () => (
  <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
    <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-8 space-y-3 text-center">
        <LoadingBlock className="mx-auto h-10 w-36 rounded-md" />
        <LoadingBlock className="mx-auto h-7 w-48 rounded-full" />
        <LoadingBlock className="mx-auto h-3 w-64 max-w-full rounded-full" />
      </div>
      <div className="space-y-4">
        {[0, 1].map((item) => (
          <div key={item} className="space-y-2">
            <LoadingBlock className="h-3 w-24 rounded-full" />
            <LoadingBlock className="h-11 w-full rounded-lg" />
          </div>
        ))}
        <LoadingBlock className="h-11 w-full rounded-lg" />
        <LoadingBlock className="h-10 w-full rounded-lg" />
      </div>
    </div>
  </div>
);

const BankPageSkeleton = () => (
  <ShellSkeleton maxWidth="max-w-6xl">
    <PageHeaderSkeleton />
    <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
      <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <LoadingBlock className="h-9 w-full rounded-lg" />
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="space-y-2">
            <LoadingBlock className="h-3 w-28 rounded-full" />
            <LoadingBlock className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((item) => (
            <LoadingBlock key={item} className="h-9 w-28 rounded-full" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <LoadingBlock className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <LoadingBlock className="h-4 w-3/4 rounded-full" />
                  <LoadingBlock className="h-3 w-1/2 rounded-full" />
                </div>
              </div>
              <div className="space-y-2">
                <LoadingBlock className="h-3 w-full rounded-full" />
                <LoadingBlock className="h-3 w-11/12 rounded-full" />
                <LoadingBlock className="h-3 w-3/5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </ShellSkeleton>
);

const QuestionPanelSkeleton = ({ className = "" }: { className?: string }) => (
  <div className={`grid grid-rows-[auto_1fr_auto] rounded-xl border border-border bg-card shadow-sm ${className}`}>
    <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
      <div className="flex items-center gap-2">
        <LoadingBlock className="h-7 w-16 rounded-full" />
        <LoadingBlock className="h-7 w-28 rounded-full" />
      </div>
      <LoadingBlock className="h-8 w-28 rounded-md" />
    </div>
    <div className="grid gap-5 p-5 lg:grid-cols-[1fr_0.9fr]">
      <div className="space-y-4">
        <LoadingBlock className="h-4 w-28 rounded-full" />
        <LoadingBlock className="h-4 w-full rounded-full" />
        <LoadingBlock className="h-4 w-11/12 rounded-full" />
        <LoadingBlock className="h-4 w-5/6 rounded-full" />
        <LoadingBlock className="mt-4 h-56 w-full rounded-lg" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="flex items-center gap-3 rounded-lg border border-border/70 p-4">
            <LoadingBlock className="h-8 w-8 shrink-0 rounded-full" />
            <div className="w-full space-y-2">
              <LoadingBlock className="h-3 w-full rounded-full" />
              <LoadingBlock className="h-3 w-2/3 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
    <div className="flex items-center justify-between border-t border-border/70 px-4 py-3">
      <LoadingBlock className="h-9 w-24 rounded-md" />
      <LoadingBlock className="h-9 w-28 rounded-md" />
    </div>
  </div>
);

const QuestionPageSkeleton = () => (
  <div className="min-h-screen bg-background p-4 text-foreground">
    <div className="mx-auto max-w-6xl">
      <QuestionPanelSkeleton className="min-h-[calc(100vh-2rem)]" />
    </div>
  </div>
);

const ModulesSkeleton = () => (
  <ShellSkeleton>
    <PageHeaderSkeleton />
    <div className="mb-5 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap gap-3">
        {[0, 1, 2].map((item) => (
          <LoadingBlock key={item} className="h-10 w-40 rounded-lg" />
        ))}
      </div>
    </div>
    <div className="space-y-5">
      {[0, 1, 2].map((set) => (
        <section key={set} className="space-y-3">
          <LoadingBlock className="h-6 w-48 rounded-full" />
          <div className="grid gap-3 md:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <LoadingBlock className="h-5 w-56 max-w-full rounded-full" />
                    <LoadingBlock className="h-3 w-32 rounded-full" />
                  </div>
                  <LoadingBlock className="h-9 w-9 rounded-lg" />
                </div>
                <LoadingBlock className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  </ShellSkeleton>
);

const PracticeStartSkeleton = () => (
  <div className="min-h-screen bg-background px-4 py-8 text-foreground">
    <div className="mx-auto max-w-4xl">
      <PageHeaderSkeleton />
      <div className="grid gap-5 md:grid-cols-[1fr_18rem]">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="space-y-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="flex items-center justify-between gap-4 rounded-lg border border-border/70 p-4">
                <div className="space-y-2">
                  <LoadingBlock className="h-4 w-48 rounded-full" />
                  <LoadingBlock className="h-3 w-32 rounded-full" />
                </div>
                <LoadingBlock className="h-6 w-14 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="space-y-4">
            <LoadingBlock className="h-5 w-32 rounded-full" />
            <LoadingBlock className="h-10 w-full rounded-lg" />
            <LoadingBlock className="h-10 w-full rounded-lg" />
            <LoadingBlock className="h-11 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

const PracticeReviewSkeleton = () => (
  <div className="grid min-h-screen grid-rows-[auto_1fr] bg-background text-foreground">
    <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
      <LoadingBlock className="h-6 w-40 rounded-full" />
      <LoadingBlock className="h-8 w-28 rounded-md" />
    </div>
    <div className="grid gap-5 p-4 lg:grid-cols-[1fr_20rem]">
      <QuestionPanelSkeleton className="min-h-[calc(100vh-5rem)]" />
      <div className="hidden rounded-xl border border-border bg-card p-4 shadow-sm lg:block">
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 27 }, (_, item) => (
            <LoadingBlock key={item} className="h-9 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>
  </div>
);

const ResultsSkeleton = ({ shell = false }: { shell?: boolean }) => {
  const content = (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <LoadingBlock className="h-3 w-24 rounded-full" />
            <LoadingBlock className="mt-4 h-9 w-28 rounded-full" />
            <LoadingBlock className="mt-3 h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <LoadingBlock className="mb-5 h-5 w-36 rounded-full" />
          <LoadingBlock className="h-64 w-full rounded-lg" />
        </div>
        <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
          {[0, 1, 2, 3, 4].map((item) => (
            <LoadingBlock key={item} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </>
  );
  return shell ? <ShellSkeleton>{content}</ShellSkeleton> : <div className="min-h-screen bg-background px-4 py-8 text-foreground"><div className="mx-auto max-w-5xl">{content}</div></div>;
};

const ScoreCalculatorSkeleton = () => (
  <ShellSkeleton maxWidth="max-w-6xl">
    <div className="grid gap-7 lg:grid-cols-[1fr_26rem]">
      <div className="space-y-6">
        {[0, 1].map((panel) => (
          <div key={panel} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <LoadingBlock className="mb-5 h-6 w-48 rounded-full" />
            {[0, 1].map((item) => (
              <div key={item} className="mb-6 space-y-3">
                <div className="flex justify-between">
                  <LoadingBlock className="h-4 w-36 rounded-full" />
                  <LoadingBlock className="h-4 w-10 rounded-full" />
                </div>
                <LoadingBlock className="h-3 w-full rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <LoadingBlock className="mx-auto h-24 w-56 rounded-full" />
        <div className="mt-8 space-y-3">
          {[0, 1, 2, 3].map((item) => (
            <LoadingBlock key={item} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  </ShellSkeleton>
);

const VocabSkeleton = () => (
  <ShellSkeleton maxWidth="max-w-6xl">
    <div className="mb-5 flex flex-wrap gap-2">
      {[0, 1, 2, 3, 4].map((item) => (
        <LoadingBlock key={item} className="h-9 w-28 rounded-full" />
      ))}
    </div>
    <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <LoadingBlock className="mb-4 h-5 w-36 rounded-full" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 24 }, (_, item) => (
            <LoadingBlock key={item} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mx-auto max-w-xl space-y-5 text-center">
          <LoadingBlock className="mx-auto h-7 w-16 rounded-full" />
          <LoadingBlock className="mx-auto h-16 w-72 max-w-full rounded-full" />
          <LoadingBlock className="mx-auto h-4 w-full rounded-full" />
          <LoadingBlock className="mx-auto h-4 w-4/5 rounded-full" />
          <div className="flex justify-center gap-3 pt-8">
            <LoadingBlock className="h-12 w-32 rounded-lg" />
            <LoadingBlock className="h-12 w-32 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  </ShellSkeleton>
);

const ToolSkeleton = () => (
  <ShellSkeleton maxWidth="max-w-3xl">
    <PageHeaderSkeleton wide />
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="space-y-2">
            <LoadingBlock className="h-3 w-24 rounded-full" />
            <LoadingBlock className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <LoadingBlock className="mt-5 h-11 w-44 rounded-lg" />
    </div>
    <div className="mt-8 space-y-4">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <LoadingBlock className="h-5 w-56 max-w-full rounded-full" />
          <LoadingBlock className="mt-3 h-3 w-full rounded-full" />
          <LoadingBlock className="mt-2 h-3 w-4/5 rounded-full" />
        </div>
      ))}
    </div>
  </ShellSkeleton>
);

const ContentIndexSkeleton = () => (
  <ShellSkeleton maxWidth="max-w-5xl">
    <PageHeaderSkeleton wide />
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
        <div key={item} className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <LoadingBlock className="h-5 w-40 rounded-full" />
          <LoadingBlock className="mt-3 h-3 w-full rounded-full" />
          <LoadingBlock className="mt-2 h-3 w-2/3 rounded-full" />
        </div>
      ))}
    </div>
  </ShellSkeleton>
);

const ArticleSkeleton = () => (
  <ShellSkeleton maxWidth="max-w-3xl">
    <PageHeaderSkeleton wide />
    <article className="space-y-6">
      {[0, 1, 2, 3].map((section) => (
        <section key={section} className="space-y-3">
          <LoadingBlock className="h-7 w-64 max-w-full rounded-full" />
          <LoadingBlock className="h-4 w-full rounded-full" />
          <LoadingBlock className="h-4 w-11/12 rounded-full" />
          <LoadingBlock className="h-4 w-4/5 rounded-full" />
        </section>
      ))}
    </article>
  </ShellSkeleton>
);

const SettingsSkeleton = () => (
  <ShellSkeleton maxWidth="max-w-3xl">
    <PageHeaderSkeleton />
    <div className="space-y-4">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <LoadingBlock className="h-5 w-48 rounded-full" />
          <LoadingBlock className="mt-3 h-3 w-full rounded-full" />
          <LoadingBlock className="mt-5 h-10 w-full rounded-lg" />
        </div>
      ))}
    </div>
  </ShellSkeleton>
);

const skeletonRange = (length: number) => Array.from({ length }, (_, index) => index);

const HomeAmbientSkeleton = () => (
  <>
    <div
      aria-hidden
      className="absolute inset-x-0 top-16 h-[calc(100vh-4rem)] opacity-80"
      style={{
        backgroundImage: `
          radial-gradient(circle at 20% 12%, rgba(56,189,248,0.18), transparent 34%),
          radial-gradient(circle at 78% 18%, rgba(129,140,248,0.14), transparent 32%),
          radial-gradient(circle at 45% 72%, rgba(244,114,182,0.08), transparent 34%)
        `,
      }}
    />
    <div
      aria-hidden
      className="absolute inset-x-0 top-16 h-[calc(100vh-4rem)] opacity-60"
      style={{
        backgroundImage: `
          linear-gradient(rgba(15,23,42,0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(15,23,42,0.08) 1px, transparent 1px)
        `,
        backgroundSize: "54px 54px",
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 72%, transparent 100%)",
        maskImage: "linear-gradient(to bottom, black 0%, black 72%, transparent 100%)",
      }}
    />
    <svg
      aria-hidden
      viewBox="0 0 1400 900"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-x-0 top-16 h-[calc(100vh-4rem)] w-full opacity-45"
    >
      <path
        d="M 0 600 Q 700 -60 1400 600"
        fill="none"
        stroke="rgba(125,211,252,0.58)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M 0 230 L 1400 610"
        fill="none"
        stroke="rgba(125,211,252,0.32)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  </>
);

const HomeQuestionPreviewSkeleton = ({ className = "" }: { className?: string }) => (
  <div className={`overflow-hidden rounded-[14px] border border-border bg-card shadow-2xl ${className}`}>
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2">
          <LoadingBlock className="h-7 w-16 rounded-full" />
          <LoadingBlock className="h-7 w-24 rounded-full" />
        </div>
        <LoadingBlock className="h-8 w-28 rounded-md" />
      </div>
      <div className="grid min-h-0 flex-1 gap-5 md:grid-cols-[1fr_0.92fr]">
        <div className="space-y-3 rounded-lg bg-muted/30 p-4">
          <LoadingBlock className="h-4 w-28 rounded-full" />
          <LoadingBlock className="h-4 w-full rounded-full" />
          <LoadingBlock className="h-4 w-11/12 rounded-full" />
          <LoadingBlock className="h-4 w-4/5 rounded-full" />
          <LoadingBlock className="mt-4 h-40 w-full rounded-lg" />
        </div>
        <div className="space-y-3">
          {skeletonRange(4).map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
              <LoadingBlock className="h-7 w-7 shrink-0 rounded-full" />
              <div className="w-full space-y-2">
                <LoadingBlock className="h-3 w-full rounded-full" />
                <LoadingBlock className="h-3 w-3/4 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const HomeFilterPreviewSkeleton = ({ className = "", style }: { className?: string; style?: CSSProperties }) => (
  <div className={`overflow-hidden rounded-[14px] border border-border bg-card shadow-2xl ${className}`} style={style}>
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="space-y-2">
          <LoadingBlock className="h-5 w-40 rounded-full" />
          <LoadingBlock className="h-3 w-56 max-w-full rounded-full" />
        </div>
        <LoadingBlock className="h-8 w-24 rounded-md" />
      </div>
      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[0.56fr_1fr]">
        <div className="space-y-3 rounded-lg bg-muted/30 p-3">
          {skeletonRange(5).map((item) => (
            <div key={item} className="space-y-2">
              <LoadingBlock className="h-3 w-2/3 rounded-full" />
              <LoadingBlock className="h-8 w-full rounded-md" />
            </div>
          ))}
        </div>
        <div className="grid min-h-0 gap-3 sm:grid-cols-2">
          {skeletonRange(2).map((column) => (
            <div key={column} className="space-y-3 rounded-lg bg-muted/30 p-3">
              <div className="flex items-center gap-3">
                <LoadingBlock className="h-9 w-9 rounded-lg" />
                <div className="space-y-2">
                  <LoadingBlock className="h-4 w-28 rounded-full" />
                  <LoadingBlock className="h-3 w-20 rounded-full" />
                </div>
              </div>
              {skeletonRange(6).map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <LoadingBlock className="h-4 w-4 rounded" />
                  <LoadingBlock className="h-3 flex-1 rounded-full" />
                  <LoadingBlock className="h-3 w-10 rounded-full" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const HomeExplanationSkeleton = () => (
  <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-2xl">
    <div className="flex h-[528px] flex-col">
      <div className="flex items-center justify-between border-b border-border/50 bg-background/95 px-3 py-2">
        <LoadingBlock className="h-5 w-16 rounded-full" />
        <div className="flex gap-1.5">
          <LoadingBlock className="h-1.5 w-3 rounded-full" />
          <LoadingBlock className="h-1.5 w-1.5 rounded-full" />
          <LoadingBlock className="h-1.5 w-1.5 rounded-full" />
        </div>
      </div>
      <div className="flex-1 px-3 py-4">
        <div className="flex items-start gap-2">
          <LoadingBlock className="mt-0.5 h-7 w-7 rounded-full" />
          <div className="space-y-2">
            <LoadingBlock className="h-5 w-44 rounded-full" />
            <LoadingBlock className="h-3 w-24 rounded-full" />
          </div>
        </div>
        <div className="mt-5 space-y-3 pl-9">
          <LoadingBlock className="h-4 w-full rounded-full" />
          <LoadingBlock className="h-4 w-11/12 rounded-full" />
          <LoadingBlock className="h-4 w-4/5 rounded-full" />
          <LoadingBlock className="mt-5 h-56 w-full rounded-lg" />
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-border/50 px-3 py-2">
        <LoadingBlock className="h-9 flex-1 rounded-md" />
        <LoadingBlock className="h-9 flex-1 rounded-md" />
      </div>
    </div>
  </div>
);

const HomeFeatureCopySkeleton = ({ align = "left" }: { align?: "left" | "right" }) => (
  <div className={align === "right" ? "lg:pl-2" : ""}>
    <LoadingBlock className="h-14 w-full max-w-[420px] rounded-full" />
    <LoadingBlock className="mt-3 h-14 w-64 rounded-full" />
    <div className="mt-6 space-y-2">
      <LoadingBlock className="h-4 w-full max-w-[440px] rounded-full" />
      <LoadingBlock className="h-4 w-4/5 max-w-[390px] rounded-full" />
    </div>
    <LoadingBlock className="mt-7 h-5 w-40 rounded-full" />
  </div>
);

const AccurateShellSkeleton = ({
  children,
  maxWidth = "max-w-5xl",
}: {
  children: ReactNode;
  maxWidth?: string;
}) => (
  <div className="relative min-h-screen bg-background text-foreground">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border/60 bg-card/95 px-4 py-3 lg:flex">
      <LoadingBlock className="h-9 w-36 rounded-md" />
      <div className="mt-3 space-y-1">
        {skeletonRange(6).map((item) => (
          <div key={item} className="flex h-10 items-center gap-3 rounded-lg px-2">
            <LoadingBlock className="h-4 w-4 rounded" />
            <LoadingBlock className="h-3 w-32 rounded-full" />
          </div>
        ))}
      </div>
      <LoadingBlock className="mt-5 h-3 w-16 rounded-full" />
      <div className="mt-2 space-y-1">
        {skeletonRange(3).map((item) => (
          <div key={item} className="flex h-10 items-center gap-3 rounded-lg px-2">
            <LoadingBlock className="h-4 w-4 rounded" />
            <LoadingBlock className="h-3 w-28 rounded-full" />
          </div>
        ))}
      </div>
      <div className="mt-auto space-y-1.5 border-t border-border/70 pt-2.5">
        {skeletonRange(3).map((item) => (
          <LoadingBlock key={item} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    </aside>
    <LoadingBlock className="fixed left-3 top-3 z-50 h-11 w-11 rounded-xl lg:hidden" />
    <div className="min-h-screen pt-14 lg:pl-64 lg:pt-0">
      <main className={`mx-auto w-full ${maxWidth} px-4 py-5 sm:px-6 lg:px-8`}>
        {children}
      </main>
    </div>
  </div>
);

const AccurateHomeSkeleton = () => (
  <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'Geist', 'Inter', system-ui, sans-serif" }}>
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-3 sm:px-4">
        <BrandLogo variant="mark" className="h-9 w-9" />
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
          <a href="/bank" className="rounded-md px-3 py-1.5 font-sans text-[14px] font-medium tracking-[-0.005em] text-ink">Question Bank</a>
          <a href="/hard" className="rounded-md px-3 py-1.5 font-sans text-[14px] font-medium tracking-[-0.005em] text-ink">100 Hard Math</a>
          <a href="/modules" className="rounded-md px-3 py-1.5 font-sans text-[14px] font-medium tracking-[-0.005em] text-ink">Practice Tests</a>
          <a href="/score-calculator" className="rounded-md px-3 py-1.5 font-sans text-[14px] font-medium tracking-[-0.005em] text-ink">Score Calculator</a>
        </nav>
        <div className="inline-flex flex-shrink-0 items-center gap-1.5">
          <a href="/login" className="hidden rounded-full px-3 py-2 text-sm font-medium text-foreground sm:inline-flex">Log In</a>
          <a href="/signup" className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">Sign Up</a>
        </div>
      </div>
    </header>
    <section className="relative overflow-hidden pb-[clamp(72px,7vw,108px)]">
      <HomeAmbientSkeleton />
      <div className="relative mx-auto max-w-[860px] px-6 pt-[76px] text-center">
        <h1
          style={{
            fontFamily: "'Geist', system-ui, sans-serif",
            fontWeight: 500,
            fontSize: "clamp(44px, 6.8vw, 96px)",
            lineHeight: 0.98,
            color: "rgb(var(--ink))",
            margin: "0 0 26px",
            letterSpacing: "-0.035em",
          }}
        >
          Reach your
          <br />
          <span style={{ fontWeight: 600, color: "rgb(var(--cobalt))" }}>best score.</span>
        </h1>
        <p
          style={{
            fontSize: 19,
            color: "rgb(var(--ink-mid))",
            maxWidth: 540,
            margin: "0 auto 38px",
            lineHeight: 1.55,
            fontWeight: 300,
          }}
        >
          Accurate SAT practice built from real past tests.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a href="/bank" className="inline-flex h-[52px] items-center rounded-[10px] bg-primary px-6 text-[15px] font-semibold text-primary-foreground">
            Explore question bank
          </a>
          <a href="/modules" className="inline-flex h-[52px] items-center rounded-[10px] border border-border bg-card/80 px-6 text-[15px] font-semibold text-foreground">
            Practice Tests
          </a>
        </div>
        <div className="mt-[52px]">
          <div
            style={{
              fontSize: "clamp(44px, 5.2vw, 72px)",
              fontFamily: "'Inter Tight', sans-serif",
              fontWeight: 600,
              color: "rgb(var(--ink))",
              letterSpacing: "-0.04em",
              lineHeight: 0.95,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            8,349
          </div>
          <div
            style={{
              fontSize: 11,
              color: "rgb(var(--ink-muted))",
              marginTop: 14,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            Practice questions
          </div>
        </div>
      </div>
      <div className="relative mx-auto mt-[210px] max-w-[1200px] px-6">
        <div className="mx-auto mb-7 max-w-[720px] text-center">
          <h2
            style={{
              fontFamily: "'Geist', system-ui, sans-serif",
              fontSize: "clamp(28px, 4.4vw, 52px)",
              fontWeight: 500,
              letterSpacing: "-0.035em",
              lineHeight: 1.05,
              color: "rgb(var(--ink))",
              margin: 0,
            }}
          >
            An interface so easy, you can use it right here.
          </h2>
        </div>
        <HomeQuestionPreviewSkeleton className="h-[352px] md:h-[646px]" />
      </div>
    </section>
    <section className="bg-background">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-6 py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
        <HomeFeatureCopySkeleton />
        <HomeExplanationSkeleton />
      </div>
    </section>
    <section className="bg-background">
      <div className="mx-auto grid max-w-[1380px] items-center gap-12 px-6 py-28 lg:grid-cols-[minmax(0,1.38fr)_minmax(300px,0.82fr)] lg:gap-[72px]">
        <HomeFilterPreviewSkeleton className="h-[580px]" />
        <HomeFeatureCopySkeleton align="right" />
      </div>
    </section>
    <section className="bg-background">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-6 pb-14 pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
        <HomeFeatureCopySkeleton />
        <div className="ml-auto w-full max-w-[620px]">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="space-y-3">
              <LoadingBlock className="h-5 w-40 rounded-full" />
              <LoadingBlock className="h-16 w-40 rounded-full" />
              <div className="grid gap-3 sm:grid-cols-2">
                <LoadingBlock className="h-24 rounded-xl" />
                <LoadingBlock className="h-24 rounded-xl" />
              </div>
              <LoadingBlock className="h-36 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
);

const AccurateLoginSkeleton = () => (
  <div className="flex min-h-screen flex-col bg-background text-foreground">
    <div className="flex items-center justify-between px-6 py-4">
      <LoadingBlock className="h-10 w-10 rounded-lg" />
      <LoadingBlock className="h-9 w-32 rounded-md" />
    </div>
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 space-y-3">
          <LoadingBlock className="h-8 w-48 rounded-full" />
          <LoadingBlock className="h-4 w-56 rounded-full" />
        </div>
        <div className="space-y-4">
          <LoadingBlock className="h-10 w-full rounded-md" />
          <div className="flex items-center gap-3">
            <LoadingBlock className="h-px flex-1 rounded-full" />
            <LoadingBlock className="h-3 w-8 rounded-full" />
            <LoadingBlock className="h-px flex-1 rounded-full" />
          </div>
          {skeletonRange(2).map((item) => (
            <div key={item} className="space-y-1.5">
              <LoadingBlock className="h-4 w-24 rounded-full" />
              <LoadingBlock className="h-10 w-full rounded-md" />
            </div>
          ))}
          <LoadingBlock className="h-10 w-full rounded-md" />
        </div>
        <LoadingBlock className="mx-auto mt-6 h-4 w-56 rounded-full" />
      </div>
    </div>
  </div>
);

const AccurateSignupSkeleton = () => (
  <div className="flex min-h-screen bg-background text-foreground">
    <div className="relative hidden w-[44%] overflow-hidden border-r border-border bg-muted/30 p-10 lg:flex lg:flex-col">
      <LoadingBlock className="h-9 w-9 rounded-lg" />
      <div className="flex flex-1 flex-col justify-center">
        <LoadingBlock className="h-14 w-full max-w-sm rounded-full" />
        <LoadingBlock className="mt-3 h-14 w-64 rounded-full" />
        <LoadingBlock className="mt-6 h-4 w-full max-w-sm rounded-full" />
        <div className="mt-8 space-y-3">
          {skeletonRange(4).map((item) => (
            <div key={item} className="flex items-center gap-3">
              <LoadingBlock className="h-4 w-4 rounded-full" />
              <LoadingBlock className="h-4 w-64 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <LoadingBlock className="h-3 w-24 rounded-full" />
    </div>
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 space-y-3">
          <LoadingBlock className="h-8 w-48 rounded-full" />
          <LoadingBlock className="h-4 w-44 rounded-full" />
        </div>
        <div className="space-y-4">
          <LoadingBlock className="h-10 w-full rounded-md" />
          <div className="flex items-center gap-3">
            <LoadingBlock className="h-px flex-1 rounded-full" />
            <LoadingBlock className="h-3 w-8 rounded-full" />
            <LoadingBlock className="h-px flex-1 rounded-full" />
          </div>
          {skeletonRange(2).map((item) => (
            <div key={item} className="space-y-1.5">
              <LoadingBlock className="h-4 w-24 rounded-full" />
              <LoadingBlock className="h-10 w-full rounded-md" />
            </div>
          ))}
          <LoadingBlock className="h-10 w-full rounded-md" />
        </div>
        <LoadingBlock className="mx-auto mt-6 h-4 w-48 rounded-full" />
        <LoadingBlock className="mx-auto mt-6 h-3 w-56 rounded-full" />
      </div>
    </div>
  </div>
);

const AccurateVerifyEmailSkeleton = () => (
  <div className="flex min-h-screen flex-col bg-background text-foreground">
    <div className="flex items-center justify-between px-6 py-4">
      <LoadingBlock className="h-10 w-10 rounded-lg" />
      <LoadingBlock className="h-9 w-20 rounded-md" />
    </div>
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <LoadingBlock className="mx-auto mb-6 h-16 w-16 rounded-full" />
        <LoadingBlock className="mx-auto h-9 w-56 rounded-full" />
        <LoadingBlock className="mx-auto mt-5 h-4 w-40 rounded-full" />
        <LoadingBlock className="mx-auto mt-2 h-5 w-64 max-w-full rounded-full" />
        <LoadingBlock className="mx-auto mt-6 h-4 w-full rounded-full" />
        <LoadingBlock className="mx-auto mt-2 h-4 w-4/5 rounded-full" />
        <div className="mt-8 space-y-3">
          <LoadingBlock className="h-10 w-full rounded-md" />
          <LoadingBlock className="h-10 w-full rounded-md" />
        </div>
      </div>
    </div>
  </div>
);

const AccurateBrowseSkeleton = () => (
  <AccurateShellSkeleton maxWidth="max-w-none">
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <LoadingBlock className="h-8 w-32 rounded-full" />
        <LoadingBlock className="h-4 w-64 rounded-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {skeletonRange(4).map((item) => (
          <div key={item} className="rounded-xl border-2 border-border bg-card p-6">
            <div className="flex items-center gap-4">
              <LoadingBlock className="h-14 w-14 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <LoadingBlock className="h-5 w-full rounded-full" />
                <LoadingBlock className="h-3 w-11/12 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <LoadingBlock className="h-8 w-48 rounded-full" />
      <div className="grid gap-8 md:grid-cols-2">
        {skeletonRange(2).map((subject) => (
          <div key={subject} className="rounded-xl border border-border bg-card p-6">
            <div className="mb-6 flex items-center gap-3">
              <LoadingBlock className="h-12 w-12 rounded-lg" />
              <div className="space-y-2">
                <LoadingBlock className="h-7 w-32 rounded-full" />
                <LoadingBlock className="h-4 w-24 rounded-full" />
              </div>
            </div>
            <div className="space-y-4">
              {skeletonRange(4).map((domain) => (
                <div key={domain} className="rounded-lg border border-border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <LoadingBlock className="h-5 w-44 rounded-full" />
                    <LoadingBlock className="h-5 w-12 rounded-full" />
                  </div>
                  <div className="space-y-2">
                    {skeletonRange(4).map((skill) => (
                      <LoadingBlock key={skill} className="h-9 w-full rounded-md" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </AccurateShellSkeleton>
);

const AccurateBankIndexSkeleton = () => (
  <AccurateShellSkeleton maxWidth="max-w-none">
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <LoadingBlock className="h-11 w-56 rounded-full" />
        <LoadingBlock className="h-4 w-64 rounded-full" />
      </div>
      <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
        <LoadingBlock className="h-10 w-full rounded-lg" />
      </div>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-6">
          {skeletonRange(6).map((item) => (
            <div key={item} className="space-y-2">
              <LoadingBlock className="h-3 w-20 rounded-full" />
              <LoadingBlock className="h-9 w-full rounded-md" />
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <LoadingBlock className="h-9 w-48 rounded-full" />
          <div className="flex gap-2">
            <LoadingBlock className="h-9 w-24 rounded-md" />
            <LoadingBlock className="h-9 w-40 rounded-md" />
          </div>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {skeletonRange(2).map((subject) => (
          <div key={subject} className="min-w-0 rounded-xl border border-border bg-card p-5">
            <div className="mb-5 flex items-center gap-3">
              <LoadingBlock className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <LoadingBlock className="h-6 w-36 rounded-full" />
                <LoadingBlock className="h-3 w-28 rounded-full" />
              </div>
            </div>
            <div className="space-y-3">
              {skeletonRange(7).map((item) => (
                <div key={item} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-center justify-between">
                    <LoadingBlock className="h-4 w-48 max-w-[70%] rounded-full" />
                    <LoadingBlock className="h-5 w-14 rounded-full" />
                  </div>
                  <div className="mt-3 space-y-2 pl-5">
                    <LoadingBlock className="h-3 w-5/6 rounded-full" />
                    <LoadingBlock className="h-3 w-3/4 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </AccurateShellSkeleton>
);

const AccurateBankBrowseSkeleton = () => (
  <AccurateShellSkeleton maxWidth="max-w-none">
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center gap-4">
        <LoadingBlock className="h-10 w-10 rounded-md" />
        <LoadingBlock className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <LoadingBlock className="h-7 w-48 rounded-full" />
          <LoadingBlock className="h-4 w-64 rounded-full" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <LoadingBlock className="h-10 w-24 rounded-md" />
        <LoadingBlock className="h-10 w-44 rounded-md" />
        <LoadingBlock className="h-10 w-48 rounded-md" />
      </div>
      <div className="space-y-3">
        {skeletonRange(4).map((domain) => (
          <div key={domain} className="relative overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex min-h-20 items-center gap-3 px-4 pr-40">
              <LoadingBlock className="h-7 w-7 rounded-full" />
              <div className="flex-1 space-y-2">
                <LoadingBlock className="h-5 w-64 max-w-full rounded-full" />
                <LoadingBlock className="h-4 w-28 rounded-full" />
              </div>
            </div>
            <div className="space-y-2 px-8 pb-4">
              {skeletonRange(4).map((skill) => (
                <LoadingBlock key={skill} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </AccurateShellSkeleton>
);

const AccurateBankFilteredSkeleton = () => (
  <AccurateShellSkeleton maxWidth="max-w-none">
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <LoadingBlock className="h-10 w-10 rounded-md" />
        <LoadingBlock className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <LoadingBlock className="h-3 w-32 rounded-full" />
          <LoadingBlock className="h-7 w-72 max-w-full rounded-full" />
        </div>
        <div className="hidden space-y-2 sm:block">
          <LoadingBlock className="h-7 w-16 rounded-full" />
          <LoadingBlock className="h-3 w-20 rounded-full" />
        </div>
      </div>
      <LoadingBlock className="h-10 w-48 rounded-md" />
      <div className="flex items-center gap-6 rounded-xl border border-border bg-card p-4">
        <LoadingBlock className="h-5 w-40 rounded-full" />
        <LoadingBlock className="h-2 flex-1 rounded-full" />
        <LoadingBlock className="h-9 w-24 rounded-md" />
      </div>
      <LoadingBlock className="h-10 w-full rounded-md" />
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {skeletonRange(8).map((item) => (
          <div key={item} className="flex items-center gap-4 border-b border-border/60 p-4 last:border-b-0">
            <LoadingBlock className="h-5 w-5 rounded-full" />
            <LoadingBlock className="h-4 w-10 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <LoadingBlock className="h-3 w-1/2 rounded-full" />
              <LoadingBlock className="h-4 w-full rounded-full" />
            </div>
            <LoadingBlock className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  </AccurateShellSkeleton>
);

const AccurateHardIntroSkeleton = () => (
  <AccurateShellSkeleton maxWidth="max-w-none">
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pt-16 sm:pt-20">
      <section className="relative overflow-hidden rounded-[32px] border border-border/70 bg-card px-6 pb-10 pt-10 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:px-10 sm:pt-12">
        <LoadingBlock className="h-12 w-72 max-w-full rounded-full" />
        <LoadingBlock className="mt-4 h-4 w-full max-w-2xl rounded-full" />
        <LoadingBlock className="mt-2 h-4 w-11/12 max-w-2xl rounded-full" />
        <LoadingBlock className="mt-8 h-11 w-40 rounded-full" />
      </section>
    </div>
  </AccurateShellSkeleton>
);

const AccurateQuestionSkeleton = ({ horizontal = false }: { horizontal?: boolean }) => (
  <div className="relative flex min-h-screen flex-col bg-background text-foreground">
    <header className="sticky top-0 z-10 border-b border-border bg-card">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <LoadingBlock className="h-9 w-24 rounded-md" />
          <div className="flex items-center gap-2">
            <LoadingBlock className="h-9 w-9 rounded-md" />
            <LoadingBlock className="h-9 w-16 rounded-full" />
            <LoadingBlock className="h-9 w-9 rounded-md" />
            <LoadingBlock className="h-9 w-28 rounded-md" />
            <LoadingBlock className="h-9 w-20 rounded-md" />
          </div>
        </div>
      </div>
    </header>
    <main className={`flex-1 pb-28 ${horizontal ? "px-8 py-6" : "px-4 py-8"}`}>
      <div className={`${horizontal ? "w-full p-6" : "mx-auto max-w-4xl p-4 sm:p-6 md:p-8"}`}>
        {horizontal ? (
          <div className="flex min-h-[420px]">
            <div className="w-[55%] space-y-4 pr-4">
              <LoadingBlock className="h-4 w-28 rounded-full" />
              <LoadingBlock className="h-4 w-full rounded-full" />
              <LoadingBlock className="h-4 w-11/12 rounded-full" />
              <LoadingBlock className="h-56 w-full rounded-lg" />
            </div>
            <div className="flex w-4 shrink-0 justify-center">
              <LoadingBlock className="h-full w-1 rounded-full" />
            </div>
            <div className="w-[45%] space-y-4 pl-4">
              <div className="flex h-10 items-center justify-between overflow-hidden rounded-md border border-border bg-muted/60 px-1">
                <LoadingBlock className="h-full w-16 rounded-none" />
                <LoadingBlock className="h-7 w-36 rounded-md" />
                <LoadingBlock className="h-7 w-7 rounded-md" />
              </div>
              <LoadingBlock className="h-4 w-full rounded-full" />
              {skeletonRange(4).map((item) => (
                <LoadingBlock key={item} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 flex h-12 items-center justify-between overflow-hidden rounded-md border border-border bg-muted/60">
              <LoadingBlock className="h-full w-20 rounded-none" />
              <LoadingBlock className="h-9 w-40 rounded-md" />
              <LoadingBlock className="mr-2 h-8 w-8 rounded-md" />
            </div>
            <div className="mb-8 space-y-4">
              <LoadingBlock className="h-4 w-28 rounded-full" />
              <LoadingBlock className="h-4 w-full rounded-full" />
              <LoadingBlock className="h-4 w-11/12 rounded-full" />
              <LoadingBlock className="h-52 w-full rounded-lg" />
            </div>
            <div className="space-y-3">
              {skeletonRange(4).map((item) => (
                <LoadingBlock key={item} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-border bg-card shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <LoadingBlock className="h-10 w-24 rounded-md" />
          <div className="flex justify-center gap-2">
            <LoadingBlock className="h-10 w-28 rounded-md" />
            <LoadingBlock className="h-10 w-24 rounded-md" />
          </div>
          <div className="flex gap-2">
            <LoadingBlock className="h-10 w-32 rounded-md" />
            <LoadingBlock className="h-10 w-24 rounded-md" />
            <LoadingBlock className="h-10 w-24 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

const AccurateModulesSkeleton = () => (
  <AccurateShellSkeleton maxWidth="max-w-none">
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="space-y-3">
        <LoadingBlock className="h-14 w-72 rounded-full" />
        <LoadingBlock className="h-4 w-full max-w-[600px] rounded-full" />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {skeletonRange(3).map((item) => (
          <LoadingBlock key={item} className="h-9 w-full rounded-md" />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {skeletonRange(8).map((item) => (
          <div key={item} className="rounded-xl border border-border/60 bg-card/60 p-4">
            <LoadingBlock className="h-7 w-44 rounded-full" />
            <LoadingBlock className="mt-3 h-10 w-full rounded-md" />
            <div className="mt-[14px] border-t border-border pt-[14px]">
              <LoadingBlock className="h-3 w-36 rounded-full" />
              <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
                <LoadingBlock className="h-4 w-16 rounded-full" />
                <div className="flex gap-2">
                  <LoadingBlock className="h-9 flex-1 rounded-md" />
                  <LoadingBlock className="h-9 flex-1 rounded-md" />
                </div>
                <LoadingBlock className="h-4 w-12 rounded-full" />
                <div className="flex gap-2">
                  <LoadingBlock className="h-9 flex-1 rounded-md" />
                  <LoadingBlock className="h-9 flex-1 rounded-md" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </AccurateShellSkeleton>
);

const AccurateStartOptionsSkeleton = ({ fullTest = false }: { fullTest?: boolean }) => (
  <div className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <LoadingBlock className="h-9 w-36 rounded-md" />
      <LoadingBlock className="h-12 w-72 max-w-full rounded-full" />
      <div className="rounded-xl border border-border bg-card p-6">
        <LoadingBlock className="h-6 w-40 rounded-full" />
        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-5">
            <div className="flex items-start justify-between">
              <LoadingBlock className="h-5 w-44 rounded-full" />
              <LoadingBlock className="h-6 w-11 rounded-full" />
            </div>
            {fullTest ? (
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {skeletonRange(4).map((item) => (
                  <LoadingBlock key={item} className="h-10 rounded-md" />
                ))}
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <LoadingBlock className="h-4 w-24 rounded-full" />
                  <LoadingBlock className="h-7 w-24 rounded-full" />
                </div>
                <LoadingBlock className="h-3 w-full rounded-full" />
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <LoadingBlock className="h-5 w-48 rounded-full" />
                <LoadingBlock className="h-4 w-72 max-w-full rounded-full" />
              </div>
              <LoadingBlock className="h-6 w-11 rounded-full" />
            </div>
          </div>
          {fullTest && (
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {skeletonRange(4).map((item) => (
                  <div key={item} className="rounded-xl border border-border/60 bg-background px-4 py-3">
                    <LoadingBlock className="h-4 w-32 rounded-full" />
                    <LoadingBlock className="mt-2 h-4 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <LoadingBlock className="h-10 w-20 rounded-md" />
            <LoadingBlock className="h-10 w-32 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

const AccurateReviewGridSkeleton = ({ timer = false }: { timer?: boolean }) => (
  <div className="min-h-screen bg-background text-foreground">
    {timer && (
      <div className="sticky top-0 z-40 border-b border-border bg-background/95">
        <div className="mx-auto flex w-full max-w-6xl justify-center px-4 py-2">
          <div className="flex items-center gap-2">
            <LoadingBlock className="h-9 w-9 rounded-md" />
            <LoadingBlock className="h-8 w-16 rounded-full" />
            <LoadingBlock className="h-9 w-9 rounded-md" />
          </div>
        </div>
      </div>
    )}
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-3 text-center">
        <LoadingBlock className="mx-auto h-14 w-80 max-w-full rounded-full" />
        <LoadingBlock className="mx-auto h-4 w-full max-w-2xl rounded-full" />
        <LoadingBlock className="mx-auto h-4 w-11/12 max-w-2xl rounded-full" />
      </div>
      <div className="rounded-[28px] border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <LoadingBlock className="h-8 w-64 rounded-full" />
            <LoadingBlock className="h-4 w-32 rounded-full" />
          </div>
          <div className="flex gap-4">
            {skeletonRange(3).map((item) => (
              <LoadingBlock key={item} className="h-4 w-24 rounded-full" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(42px,1fr))] gap-2.5">
          {skeletonRange(27).map((item) => (
            <LoadingBlock key={item} className="h-11 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="flex justify-between">
        <LoadingBlock className="h-10 w-20 rounded-md" />
        <LoadingBlock className="h-10 w-32 rounded-md" />
      </div>
    </div>
  </div>
);

const AccurateTransitionSkeleton = () => (
  <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
    <div className="w-full max-w-3xl rounded-xl border border-border bg-card py-12 text-center">
      <LoadingBlock className="mx-auto h-14 w-14 rounded-full" />
      <LoadingBlock className="mx-auto mt-6 h-12 w-80 max-w-full rounded-full" />
      <LoadingBlock className="mx-auto mt-3 h-4 w-44 rounded-full" />
    </div>
  </div>
);

const AccurateResultsSkeleton = ({ practiceTest = false }: { practiceTest?: boolean }) => (
  <div className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
    <div className={`mx-auto flex w-full flex-col gap-6 ${practiceTest ? "max-w-6xl" : "max-w-7xl"}`}>
      <LoadingBlock className="h-9 w-36 rounded-md" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <LoadingBlock className="h-14 w-80 max-w-full rounded-full" />
          <LoadingBlock className="h-4 w-48 rounded-full" />
        </div>
        {practiceTest && <LoadingBlock className="h-12 w-12 rounded-md" />}
      </div>
      <div className={`grid gap-4 ${practiceTest ? "sm:grid-cols-2 lg:grid-cols-4" : "lg:grid-cols-[1.2fr_0.8fr]"}`}>
        <div className={`grid gap-4 ${practiceTest ? "sm:col-span-2 lg:col-span-4 sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
          {skeletonRange(3).map((item) => (
            <div key={item} className={`rounded-xl border border-border bg-card p-6 ${practiceTest && item === 0 ? "sm:col-span-2" : ""}`}>
              <LoadingBlock className="h-3 w-24 rounded-full" />
              <LoadingBlock className="mt-3 h-10 w-24 rounded-full" />
              <LoadingBlock className="mt-2 h-4 w-32 rounded-full" />
            </div>
          ))}
        </div>
        {!practiceTest && (
          <div className="rounded-xl border border-border bg-card p-6">
            <LoadingBlock className="h-5 w-48 rounded-full" />
            <div className="mt-4 space-y-3">
              {skeletonRange(4).map((item) => (
                <LoadingBlock key={item} className="h-8 w-full rounded-md" />
              ))}
            </div>
          </div>
        )}
      </div>
      {practiceTest && (
        <div className="rounded-xl border border-border bg-card p-6">
          <LoadingBlock className="h-6 w-44 rounded-full" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {skeletonRange(4).map((item) => (
              <LoadingBlock key={item} className="h-32 rounded-2xl" />
            ))}
          </div>
        </div>
      )}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <LoadingBlock className="h-8 w-56 rounded-full" />
          <div className="flex flex-wrap gap-3">
            <LoadingBlock className="h-10 w-36 rounded-md" />
            <LoadingBlock className="h-10 w-44 rounded-md" />
            <LoadingBlock className="h-10 w-32 rounded-md" />
          </div>
        </div>
        <div className="mt-6 divide-y divide-border/60">
          {skeletonRange(8).map((item) => (
            <div key={item} className="py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <LoadingBlock className="h-5 w-72 max-w-full rounded-full" />
                  <div className="flex gap-5">
                    <LoadingBlock className="h-4 w-24 rounded-full" />
                    <LoadingBlock className="h-4 w-28 rounded-full" />
                    <LoadingBlock className="h-4 w-28 rounded-full" />
                  </div>
                </div>
                <LoadingBlock className="h-7 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const AccurateAnalysisSkeleton = () => (
  <AccurateShellSkeleton maxWidth="max-w-none">
    <div className="-mx-4 -mt-5 sm:-mx-6 lg:-mx-8">
      <section className="bg-muted/40">
        <div className="mx-auto max-w-[1080px] px-6 py-12">
          <LoadingBlock className="h-6 w-32 rounded-full" />
          <LoadingBlock className="mt-4 h-14 w-80 max-w-full rounded-full" />
          <div className="mt-8 grid grid-cols-2 gap-5 rounded-[24px] border border-border bg-card/80 p-6 md:grid-cols-4">
            {skeletonRange(8).map((item) => (
              <div key={item} className="space-y-3">
                <LoadingBlock className="h-3 w-24 rounded-full" />
                <LoadingBlock className="h-8 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="h-20 bg-gradient-to-b from-transparent to-background" />
      </section>
      <main className="mx-auto max-w-[1080px] px-6 pb-20">
        <div className="space-y-10">
          {skeletonRange(3).map((section) => (
            <section key={section}>
              <LoadingBlock className="h-8 w-48 rounded-full" />
              <LoadingBlock className="mt-2 h-4 w-72 rounded-full" />
              <div className={`mt-5 rounded-2xl border border-border bg-card p-6 ${section === 2 ? "grid gap-5 md:grid-cols-2" : ""}`}>
                {section === 2 ? (
                  skeletonRange(2).map((item) => (
                    <div key={item} className="space-y-4">
                      <LoadingBlock className="h-5 w-36 rounded-full" />
                      {skeletonRange(6).map((row) => (
                        <LoadingBlock key={row} className="h-10 w-full rounded-md" />
                      ))}
                    </div>
                  ))
                ) : (
                  <LoadingBlock className="h-52 w-full rounded-lg" />
                )}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  </AccurateShellSkeleton>
);

const AccurateListPageSkeleton = ({ titleWidth = "w-64" }: { titleWidth?: string }) => (
  <AccurateShellSkeleton maxWidth="max-w-none">
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <LoadingBlock className={`h-14 ${titleWidth} rounded-full`} />
      <div className="grid gap-4 lg:grid-cols-2">
        {skeletonRange(4).map((item) => (
          <div key={item} className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <LoadingBlock className="h-4 w-36 rounded-full" />
                <LoadingBlock className="h-7 w-64 max-w-full rounded-full" />
                <LoadingBlock className="h-4 w-40 rounded-full" />
              </div>
              <LoadingBlock className="h-9 w-9 rounded-md" />
            </div>
            <LoadingBlock className="mt-6 h-2 w-full rounded-full" />
            <div className="mt-5 flex flex-wrap gap-2">
              <LoadingBlock className="h-7 w-28 rounded-full" />
              <LoadingBlock className="h-7 w-44 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </AccurateShellSkeleton>
);

const AccurateScoreSkeleton = () => (
  <AccurateShellSkeleton maxWidth="max-w-none">
    <div className="mx-auto max-w-[1100px]">
      <div className="grid gap-7 lg:grid-cols-[1fr_26rem]">
        <div className="space-y-6">
          {skeletonRange(2).map((panel) => (
            <div key={panel}>
              <div className="mb-5 flex items-center gap-2">
                <LoadingBlock className="h-5 w-1 rounded-full" />
                <LoadingBlock className="h-6 w-48 rounded-full" />
              </div>
              <div className="rounded-[22px] border border-border bg-card p-6">
                {skeletonRange(2).map((item) => (
                  <div key={item} className="mb-7 last:mb-0">
                    <div className="mb-4 flex items-center justify-between">
                      <LoadingBlock className="h-5 w-44 rounded-full" />
                      <LoadingBlock className="h-6 w-14 rounded-full" />
                    </div>
                    <div className="flex items-center gap-4">
                      <LoadingBlock className="h-10 w-10 rounded-full" />
                      <LoadingBlock className="h-3 flex-1 rounded-full" />
                      <LoadingBlock className="h-10 w-10 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-[28px] border border-border bg-card p-7">
          <LoadingBlock className="h-3 w-24 rounded-full" />
          <LoadingBlock className="mx-auto mt-6 h-24 w-56 rounded-full" />
          <div className="mt-8 space-y-4">
            {skeletonRange(4).map((item) => (
              <div key={item}>
                <div className="mb-2 flex justify-between">
                  <LoadingBlock className="h-4 w-36 rounded-full" />
                  <LoadingBlock className="h-4 w-12 rounded-full" />
                </div>
                <LoadingBlock className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
          <LoadingBlock className="mt-8 h-11 w-full rounded-full" />
        </div>
      </div>
    </div>
  </AccurateShellSkeleton>
);

const AccurateVocabSkeleton = () => (
  <AccurateShellSkeleton maxWidth="max-w-none">
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-7">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-4">
          <div className="space-y-2">
            <LoadingBlock className="h-11 w-52 rounded-full" />
            <LoadingBlock className="h-4 w-64 rounded-full" />
          </div>
          <LoadingBlock className="h-10 w-28 rounded-[10px]" />
        </div>
        <div className="flex w-fit max-w-full gap-1 overflow-hidden rounded-xl border border-border bg-muted/40 p-1">
          {skeletonRange(5).map((item) => (
            <LoadingBlock key={item} className="h-10 w-24 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-[720px]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <LoadingBlock className="h-4 w-36 rounded-full" />
          <LoadingBlock className="h-3 flex-1 rounded-full" />
          <LoadingBlock className="h-4 w-20 rounded-full" />
        </div>
        <div className="h-[420px] rounded-[20px] border border-border bg-card p-8 shadow-sm">
          <LoadingBlock className="h-6 w-28 rounded-full" />
          <LoadingBlock className="mt-24 h-20 w-72 max-w-full rounded-full" />
          <LoadingBlock className="mt-4 h-4 w-full rounded-full" />
          <LoadingBlock className="mt-2 h-4 w-4/5 rounded-full" />
        </div>
        <div className="mt-5 flex gap-3">
          <LoadingBlock className="h-11 flex-1 rounded-full" />
          <LoadingBlock className="h-11 flex-1 rounded-full" />
        </div>
      </div>
    </div>
  </AccurateShellSkeleton>
);

const AccurateToolSkeleton = () => (
  <AccurateShellSkeleton maxWidth="max-w-none">
    <div className="mx-auto max-w-3xl px-2 py-5">
      <LoadingBlock className="mb-6 h-4 w-48 rounded-full" />
      <LoadingBlock className="h-12 w-full max-w-3xl rounded-full" />
      <LoadingBlock className="mt-4 h-5 w-full rounded-full" />
      <LoadingBlock className="mt-2 h-5 w-4/5 rounded-full" />
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {skeletonRange(2).map((item) => (
          <div key={item} className="rounded-xl border border-border bg-card p-6">
            <LoadingBlock className="h-4 w-32 rounded-full" />
            <LoadingBlock className="mt-3 h-10 w-full rounded-lg" />
            <LoadingBlock className="mt-5 h-4 w-44 rounded-full" />
            <LoadingBlock className="mt-2 h-9 w-20 rounded-full" />
          </div>
        ))}
      </div>
      <div className="mt-10 space-y-5">
        <LoadingBlock className="h-8 w-56 rounded-full" />
        {skeletonRange(5).map((item) => (
          <LoadingBlock key={item} className="h-8 w-full rounded-md" />
        ))}
      </div>
    </div>
  </AccurateShellSkeleton>
);

const AccurateContentIndexSkeleton = () => (
  <AccurateShellSkeleton maxWidth="max-w-none">
    <div className="mx-auto max-w-5xl px-2 py-5">
      <header className="mb-10">
        <LoadingBlock className="h-11 w-full max-w-2xl rounded-full" />
        <LoadingBlock className="mt-3 h-5 w-full max-w-3xl rounded-full" />
        <LoadingBlock className="mt-2 h-5 w-4/5 max-w-2xl rounded-full" />
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {skeletonRange(12).map((item) => (
          <div key={item} className="rounded-xl border border-border bg-card p-5">
            <LoadingBlock className="h-5 w-40 rounded-full" />
            <LoadingBlock className="mt-3 h-3 w-full rounded-full" />
            <LoadingBlock className="mt-2 h-3 w-2/3 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  </AccurateShellSkeleton>
);

const AccurateArticleSkeleton = () => (
  <AccurateShellSkeleton maxWidth="max-w-none">
    <article className="mx-auto max-w-3xl px-2 py-5">
      <LoadingBlock className="mb-6 h-4 w-64 max-w-full rounded-full" />
      <header className="mb-8">
        <LoadingBlock className="h-12 w-full rounded-full" />
        <LoadingBlock className="mt-3 h-12 w-4/5 rounded-full" />
        <LoadingBlock className="mt-4 h-5 w-full rounded-full" />
        <LoadingBlock className="mt-2 h-5 w-11/12 rounded-full" />
      </header>
      <div className="space-y-10">
        {skeletonRange(5).map((section) => (
          <section key={section} className={section === 0 ? "rounded-2xl border border-border p-6" : ""}>
            <LoadingBlock className="h-8 w-64 max-w-full rounded-full" />
            <LoadingBlock className="mt-4 h-4 w-full rounded-full" />
            <LoadingBlock className="mt-3 h-4 w-11/12 rounded-full" />
            <LoadingBlock className="mt-3 h-4 w-4/5 rounded-full" />
          </section>
        ))}
      </div>
    </article>
  </AccurateShellSkeleton>
);

const AccurateSettingsSkeleton = () => (
  <AccurateShellSkeleton maxWidth="max-w-none">
    <div className="mx-auto max-w-4xl space-y-6 p-1">
      <div className="flex items-center justify-between gap-4">
        <LoadingBlock className="h-9 w-32 rounded-full" />
        <div className="flex items-center gap-3">
          <LoadingBlock className="hidden h-4 w-48 rounded-full sm:block" />
          <LoadingBlock className="h-9 w-28 rounded-md" />
        </div>
      </div>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-2">
          <LoadingBlock className="h-8 w-56 rounded-full" />
          <LoadingBlock className="h-4 w-80 max-w-full rounded-full" />
        </div>
        {skeletonRange(3).map((item) => (
          <div key={item} className="rounded-xl border border-border bg-card p-6">
            <LoadingBlock className="h-6 w-44 rounded-full" />
            <LoadingBlock className="mt-2 h-4 w-64 rounded-full" />
            <LoadingBlock className="mt-6 h-12 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  </AccurateShellSkeleton>
);

const AccuratePersonalizationSkeleton = () => (
  <AccurateShellSkeleton maxWidth="max-w-none">
    <div className="mx-auto max-w-4xl space-y-6 p-1">
      <div className="flex items-center justify-between gap-4">
        <LoadingBlock className="h-9 w-40 rounded-md" />
        <LoadingBlock className="h-9 w-36 rounded-md" />
      </div>
      <div className="space-y-2">
        <LoadingBlock className="h-9 w-56 rounded-full" />
        <LoadingBlock className="h-4 w-full max-w-xl rounded-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-6">
          {skeletonRange(2).map((card) => (
            <div key={card} className="rounded-xl border border-border bg-card p-6">
              <LoadingBlock className="h-6 w-44 rounded-full" />
              <LoadingBlock className="mt-2 h-4 w-64 rounded-full" />
              <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {skeletonRange(card === 0 ? 6 : 4).map((item) => (
                  <LoadingBlock key={item} className="h-20 rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <LoadingBlock className="h-6 w-32 rounded-full" />
          <LoadingBlock className="mt-2 h-4 w-64 rounded-full" />
          <div className="mt-5 rounded-xl border border-border p-4">
            <LoadingBlock className="h-4 w-32 rounded-full" />
            <LoadingBlock className="mt-4 h-4 w-full rounded-full" />
            <LoadingBlock className="mt-3 h-4 w-11/12 rounded-full" />
            <div className="mt-5 space-y-2">
              {skeletonRange(4).map((item) => (
                <LoadingBlock key={item} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </AccurateShellSkeleton>
);

const AccurateLegalSkeleton = () => (
  <AccurateShellSkeleton maxWidth="max-w-none">
    <main className="mx-auto max-w-4xl px-2 py-5">
      <LoadingBlock className="h-4 w-40 rounded-full" />
      <LoadingBlock className="mt-3 h-11 w-80 max-w-full rounded-full" />
      <LoadingBlock className="mt-4 h-5 w-full max-w-2xl rounded-full" />
      <div className="mt-10 space-y-8">
        {skeletonRange(6).map((item) => (
          <section key={item} className="space-y-3">
            <LoadingBlock className="h-7 w-56 rounded-full" />
            <LoadingBlock className="h-4 w-full rounded-full" />
            <LoadingBlock className="h-4 w-11/12 rounded-full" />
          </section>
        ))}
      </div>
    </main>
  </AccurateShellSkeleton>
);

const AccurateNotFoundSkeleton = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
    <div className="mb-8">
      <LoadingBlock className="h-10 w-10 rounded-full" />
    </div>
    <div className="w-full max-w-sm space-y-4 text-center">
      <LoadingBlock className="mx-auto h-24 w-44 rounded-2xl" />
      <LoadingBlock className="mx-auto h-6 w-44 rounded-full" />
      <div className="space-y-2">
        <LoadingBlock className="mx-auto h-3 w-full rounded-full" />
        <LoadingBlock className="mx-auto h-3 w-64 rounded-full" />
      </div>
      <LoadingBlock className="mx-auto h-5 w-32 rounded-full" />
    </div>
  </div>
);

const classifySkeleton = (pathname: string) => {
  const parts = pathname.split("/").filter(Boolean);
  if (pathname === "/") return "home";
  if (pathname === "/login") return "login";
  if (pathname === "/signup") return "signup";
  if (pathname === "/verify-email") return "verify-email";
  if (pathname === "/browse") return "browse";
  if (pathname === "/profile/personalization") return "personalization";
  if (pathname === "/profile") return "settings";
  if (pathname === "/score-calculator") return "score";
  if (pathname === "/vocab") return "vocab";
  if (pathname === "/analysis") return "analysis";
  if (pathname === "/test-results") return "test-results";
  if (pathname === "/my-practice-sets") return "practice-sets";
  if (pathname === "/admin/reports") return "admin-reports";
  if (pathname === "/modules") return "modules";
  if (parts[0] === "practice-tests") {
    if (parts.length === 3 && parts[2] === "transition") return "transition";
    if (parts.length === 3 && parts[2] === "review") return "review";
    if (parts.length === 3 && parts[2] === "results") return "practice-results";
    if (parts.length === 2 || (parts.length === 3 && parts[2] === "start")) return "practice-test-start";
    return "not-found";
  }
  if (parts[0] === "modules") {
    if (parts.length === 3 && parts[2] === "review") return "module-review";
    if (parts.length === 3 && parts[2] === "results") return "module-results";
    if (parts.length === 2 || (parts.length === 3 && parts[2] === "start")) return "module-start";
    return "not-found";
  }
  if (pathname === "/hard") return "hard-intro";
  if (parts[0] === "hard") {
    if (parts.length === 2) return "question-vertical";
    return "not-found";
  }
  if (pathname === "/bank") return "bank-index";
  if (parts[0] === "bank") {
    if (parts.length === 3 && parts[2] === "browse") return "bank-browse";
    if (parts.length === 4) return "bank-filtered";
    if (parts.length === 3) return parts[1] === "reading" ? "question-horizontal" : "question-vertical";
    return "not-found";
  }
  if (parts[0] === "profile") return "not-found";
  if (
    [
      "/sat-to-act-converter",
      "/sat-percentile-calculator",
      "/psat-to-sat-predictor",
      "/sat-study-plan-generator",
      "/what-sat-score-do-i-need",
      "/sat-test-countdown",
    ].includes(pathname)
  ) return "tool";
  if (pathname === "/privacy" || pathname === "/terms") return "legal";
  if (
    pathname === "/sat-score" ||
    pathname === "/sat-skill" ||
    pathname === "/sat-vocabulary" ||
    pathname === "/sat-faq" ||
    pathname === "/blog" ||
    pathname === "/college" ||
    pathname === "/in" ||
    pathname === "/ae"
  ) return "content-index";
  if (
    (parts.length === 2 && parts[0] === "sat-score") ||
    (parts.length === 2 && parts[0] === "sat-skill") ||
    (parts.length === 2 && parts[0] === "sat-faq") ||
    (parts.length === 2 && parts[0] === "blog") ||
    (parts.length === 2 && parts[0] === "college") ||
    (parts.length === 2 && parts[0] === "in") ||
    (parts.length === 2 && parts[0] === "ae")
  ) return "article";
  if (parts.length > 1) return "not-found";
  return "article";
};

const PageSkeleton = ({ pathname }: { pathname: string }) => {
  const kind = classifySkeleton(pathname);
  if (kind === "home") return <div className="min-h-screen bg-background" />;
  if (kind === "login") return <AccurateLoginSkeleton />;
  if (kind === "signup") return <AccurateSignupSkeleton />;
  if (kind === "verify-email") return <AccurateVerifyEmailSkeleton />;
  if (kind === "browse") return <AccurateBrowseSkeleton />;
  if (kind === "settings") return <AccurateSettingsSkeleton />;
  if (kind === "personalization") return <AccuratePersonalizationSkeleton />;
  if (kind === "bank-index") return <AccurateBankIndexSkeleton />;
  if (kind === "bank-browse") return <AccurateBankBrowseSkeleton />;
  if (kind === "bank-filtered") return <AccurateBankFilteredSkeleton />;
  if (kind === "hard-intro") return <AccurateHardIntroSkeleton />;
  if (kind === "question-horizontal") return <AccurateQuestionSkeleton horizontal />;
  if (kind === "question-vertical") return <AccurateQuestionSkeleton />;
  if (kind === "modules") return <AccurateModulesSkeleton />;
  if (kind === "module-start") return <AccurateStartOptionsSkeleton />;
  if (kind === "practice-test-start") return <AccurateStartOptionsSkeleton fullTest />;
  if (kind === "transition") return <AccurateTransitionSkeleton />;
  if (kind === "review") return <AccurateReviewGridSkeleton timer />;
  if (kind === "module-review") return <AccurateReviewGridSkeleton />;
  if (kind === "practice-results") return <AccurateResultsSkeleton practiceTest />;
  if (kind === "module-results") return <AccurateResultsSkeleton />;
  if (kind === "analysis") return <AccurateAnalysisSkeleton />;
  if (kind === "test-results") return <AccurateListPageSkeleton titleWidth="w-64" />;
  if (kind === "practice-sets") return <AccurateListPageSkeleton titleWidth="w-72" />;
  if (kind === "admin-reports") return <AccurateListPageSkeleton titleWidth="w-56" />;
  if (kind === "score") return <AccurateScoreSkeleton />;
  if (kind === "vocab") return <AccurateVocabSkeleton />;
  if (kind === "tool") return <AccurateToolSkeleton />;
  if (kind === "content-index") return <AccurateContentIndexSkeleton />;
  if (kind === "legal") return <AccurateLegalSkeleton />;
  if (kind === "not-found") return <AccurateNotFoundSkeleton />;
  return <AccurateArticleSkeleton />;
};

const Loading = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isEmbed =
    typeof window !== "undefined" &&
    window.self !== window.top &&
    searchParams.get("embed") === "1";
  const isBankEmbed = location.pathname === "/bank";

  useEffect(() => {
    if (!isEmbed || typeof document === "undefined") return;
    const root = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = root.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlGutter = root.style.getPropertyValue("scrollbar-gutter");
    const prevBodyGutter = body.style.getPropertyValue("scrollbar-gutter");
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    root.style.setProperty("scrollbar-gutter", "auto");
    body.style.setProperty("scrollbar-gutter", "auto");
    return () => {
      root.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      if (prevHtmlGutter) root.style.setProperty("scrollbar-gutter", prevHtmlGutter);
      else root.style.removeProperty("scrollbar-gutter");
      if (prevBodyGutter) body.style.setProperty("scrollbar-gutter", prevBodyGutter);
      else body.style.removeProperty("scrollbar-gutter");
    };
  }, [isEmbed]);

  if (isEmbed) return isBankEmbed ? <EmbeddedBankSkeleton /> : <EmbeddedQuestionSkeleton />;
  return <PageSkeleton pathname={location.pathname} />;
};

const RouteErrorBoundary = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  return <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>;
};

const withSuspense = (page: ReactNode) => (
  <RouteErrorBoundary>
    <Suspense fallback={<Loading />}>{page}</Suspense>
  </RouteErrorBoundary>
);

const withShellSuspense = (page: ReactNode) => (
  <RouteErrorBoundary>
    <Suspense fallback={<Loading />}>
      <AppShell>
        <RouteErrorBoundary>
          {page}
        </RouteErrorBoundary>
      </AppShell>
    </Suspense>
  </RouteErrorBoundary>
);

const DeferredRootEffects = () => {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) {
      setReady(false);
      return;
    }
    const mount = () => setReady(true);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let idleId: number | undefined;

    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(mount, { timeout: 3000 });
    } else {
      timeoutId = setTimeout(mount, 1500);
    }

    return () => {
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [user]);

  if (!user || !ready) return null;

  return (
    <Suspense fallback={null}>
      <AccountSync />
    </Suspense>
  );
};

const DeferredOnboardingTour = () => {
  const location = useLocation();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const enable = () => setEnabled(true);
    window.addEventListener("onboarding:replay", enable);
    window.addEventListener("onboarding:practice-set-help", enable);
    if (hasPendingTourRequest()) enable();
    return () => {
      window.removeEventListener("onboarding:replay", enable);
      window.removeEventListener("onboarding:practice-set-help", enable);
    };
  }, []);

  useEffect(() => {
    if (enabled) return;
    if (hasPendingTourRequest()) {
      setEnabled(true);
      return;
    }
  }, [enabled, location.key]);

  if (!enabled) return null;

  return (
    <Suspense fallback={null}>
      <OnboardingTour />
    </Suspense>
  );
};

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
          <EmailVerificationGuard />
          <AnalyticsPageTracker />
          <DeferredOnboardingTour />
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
            <Route path="/test-results" element={withShellSuspense(<TestResults />)} />
            <Route path="/my-practice-sets" element={withShellSuspense(<MyPracticeSets />)} />
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
            <Route path="/privacy" element={withShellSuspense(<PrivacyPolicy />)} />
            <Route path="/terms" element={withShellSuspense(<TermsOfService />)} />
            <Route path="/sat-to-act-converter" element={withShellSuspense(<SatToActConverter />)} />
            <Route path="/sat-percentile-calculator" element={withShellSuspense(<SatPercentileCalculator />)} />
            <Route path="/psat-to-sat-predictor" element={withShellSuspense(<PsatToSatPredictor />)} />
            <Route path="/sat-study-plan-generator" element={withShellSuspense(<SatStudyPlanGenerator />)} />
            <Route path="/what-sat-score-do-i-need" element={withShellSuspense(<WhatSatScoreDoINeed />)} />
            <Route path="/sat-test-countdown" element={withShellSuspense(<SatTestCountdown />)} />
            <Route path="/in" element={withShellSuspense(<CountryHubPage />)} />
            <Route path="/ae" element={withShellSuspense(<CountryHubPage />)} />
            <Route path="/in/:topic" element={withShellSuspense(<CountryTopicPage />)} />
            <Route path="/ae/:topic" element={withShellSuspense(<CountryTopicPage />)} />
            <Route path="/college" element={withShellSuspense(<CollegeIndex />)} />
            <Route path="/college/:slug" element={withShellSuspense(<CollegePage />)} />
            <Route path="/admin/reports" element={withShellSuspense(<AdminReports />)} />
            <Route path="/:slug" element={withShellSuspense(<TopLevelSeoPage />)} />
            <Route path="*" element={withShellSuspense(<NotFound />)} />
          </Routes>
          <LegalDisclaimer />
          <DeferredRootEffects />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
