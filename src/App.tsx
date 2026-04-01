import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy, type ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ScrollToTop } from "@/components/ScrollToTop";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Index = lazy(() => import("./pages/Index"));
const Question = lazy(() => import("./pages/Question"));
const BankIndex = lazy(() => import("./pages/BankIndex"));
const BankBrowse = lazy(() => import("./pages/BankBrowse"));
const BankFiltered = lazy(() => import("./pages/BankFiltered"));
const OfficialBankIndex = lazy(() => import("./pages/OfficialBankIndex"));
const OfficialBankBrowse = lazy(() => import("./pages/OfficialBankBrowse"));
const OfficialBankFiltered = lazy(() => import("./pages/OfficialBankFiltered"));
const Analysis = lazy(() => import("./pages/Analysis"));
const Modules = lazy(() => import("./pages/Modules"));
const ModuleView = lazy(() => import("./pages/ModuleView"));
const Vocab = lazy(() => import("./pages/Vocab"));
const ScoreCalculator = lazy(() => import("./pages/ScoreCalculator"));
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner position="top-center" duration={2000} />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={withSuspense(<Home />)} />
            <Route path="/login" element={withSuspense(<Login />)} />
            <Route path="/modules" element={withSuspense(<Modules />)} />
            <Route path="/modules/:moduleId" element={withSuspense(<ModuleView />)} />
            <Route path="/signup" element={withSuspense(<Signup />)} />
            <Route path="/profile" element={withSuspense(<Profile />)} />
            <Route path="/score-calculator" element={withSuspense(<ScoreCalculator />)} />
            <Route path="/browse" element={withSuspense(<Index />)} />
            <Route path="/hard/:id" element={withSuspense(<Question />)} />
            <Route path="/bank" element={withSuspense(<BankIndex />)} />
            <Route path="/bank/:subject/browse" element={withSuspense(<BankBrowse />)} />
            <Route path="/bank/:subject/:filterType/:filterValue" element={withSuspense(<BankFiltered />)} />
            <Route path="/bank/:subject/:id" element={withSuspense(<Question />)} />
            <Route path="/official-bank" element={withSuspense(<OfficialBankIndex />)} />
            <Route path="/official-bank/:subject/browse" element={withSuspense(<OfficialBankBrowse />)} />
            <Route path="/official-bank/:subject/:filterType/:filterValue" element={withSuspense(<OfficialBankFiltered />)} />
            <Route path="/official-bank/:subject/:id" element={withSuspense(<Question />)} />
            <Route path="/vocab" element={withSuspense(<Vocab />)} />
            <Route path="/analysis" element={withSuspense(<Analysis />)} />
            <Route path="*" element={withSuspense(<NotFound />)} />
          </Routes>
          <LegalDisclaimer />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
