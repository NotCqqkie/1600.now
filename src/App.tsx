import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy, type ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ScrollToTop } from "@/components/ScrollToTop";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { AppShell } from "@/components/AppShell";
import { Seo } from "@/components/Seo";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
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
const ExplanationTrial = lazy(() => import("./pages/ExplanationTrial"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Profile = lazy(() => import("./pages/Profile"));

const queryClient = new QueryClient();

const Loading = () => (
  <div className="flex h-screen items-center justify-center">
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
            <Route path="/profile" element={withShellSuspense(<Profile />)} />
            <Route path="/score-calculator" element={withShellSuspense(<ScoreCalculator />)} />
            <Route path="/browse" element={withShellSuspense(<Index />)} />
            <Route path="/hard" element={withShellSuspense(<HardQuestionsIntro />)} />
            <Route path="/hard/:id" element={withSuspense(<Question />)} />
            <Route path="/bank" element={withShellSuspense(<BankIndex />)} />
            <Route path="/bank/:subject/browse" element={withShellSuspense(<BankBrowse />)} />
            <Route path="/bank/:subject/:filterType/:filterValue" element={withShellSuspense(<BankFiltered />)} />
            <Route path="/bank/:subject/:id" element={withSuspense(<Question />)} />
            <Route path="/official-bank" element={withShellSuspense(<BankIndex />)} />
            <Route path="/official-bank/:subject/browse" element={withShellSuspense(<BankBrowse />)} />
            <Route path="/official-bank/:subject/:filterType/:filterValue" element={withShellSuspense(<BankFiltered />)} />
            <Route path="/official-bank/:subject/:id" element={withSuspense(<Question />)} />
            <Route path="/vocab" element={withShellSuspense(<Vocab />)} />
            <Route path="/analysis" element={withShellSuspense(<Analysis />)} />
            <Route path="/explanation-trial" element={withSuspense(<ExplanationTrial />)} />
<Route path="*" element={withShellSuspense(<NotFound />)} />
          </Routes>
          <LegalDisclaimer />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
