import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";

// Lazy load the heavy pages (not the homepage)
const Index = lazy(() => import("./pages/Index"));
const Question = lazy(() => import("./pages/Question"));
const BankIndex = lazy(() => import("./pages/BankIndex"));
const BankBrowse = lazy(() => import("./pages/BankBrowse"));
const BankFiltered = lazy(() => import("./pages/BankFiltered"));
const BankQuestion = lazy(() => import("./pages/BankQuestion"));
const OfficialBankIndex = lazy(() => import("./pages/OfficialBankIndex"));
const OfficialBankBrowse = lazy(() => import("./pages/OfficialBankBrowse"));
const OfficialBankFiltered = lazy(() => import("./pages/OfficialBankFiltered"));
const OfficialBankQuestion = lazy(() => import("./pages/OfficialBankQuestion"));
const Analysis = lazy(() => import("./pages/Analysis"));
const Modules = lazy(() => import("./pages/Modules"));
const ModuleView = lazy(() => import("./pages/ModuleView"));
const Vocab = lazy(() => import("./pages/Vocab"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Profile = lazy(() => import("./pages/Profile"));

const queryClient = new QueryClient();

const Loading = () => (
  <div className="flex h-screen items-center justify-center">
    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner position="top-center" duration={2000} />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/modules" element={<Suspense fallback={<Loading />}><Modules /></Suspense>} />
            <Route path="/modules/:moduleId" element={<Suspense fallback={<Loading />}><ModuleView /></Suspense>} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/profile" element={<Suspense fallback={<Loading />}><Profile /></Suspense>} />
            <Route path="/browse" element={<Suspense fallback={<Loading />}><Index /></Suspense>} />
            <Route path="/question/:id" element={<Suspense fallback={<Loading />}><Question /></Suspense>} />

          <Route path="/bank" element={<Suspense fallback={<Loading />}><BankIndex /></Suspense>} />
          <Route path="/bank/:subject/browse" element={<Suspense fallback={<Loading />}><BankBrowse /></Suspense>} />
          <Route path="/bank/:subject/:filterType/:filterValue" element={<Suspense fallback={<Loading />}><BankFiltered /></Suspense>} />
          <Route path="/bank/:subject/:id" element={<Suspense fallback={<Loading />}><Question /></Suspense>} />
          
          <Route path="/official-bank" element={<Suspense fallback={<Loading />}><OfficialBankIndex /></Suspense>} />
          <Route path="/official-bank/:subject/browse" element={<Suspense fallback={<Loading />}><OfficialBankBrowse /></Suspense>} />
          <Route path="/official-bank/:subject/:filterType/:filterValue" element={<Suspense fallback={<Loading />}><OfficialBankFiltered /></Suspense>} />
          <Route path="/official-bank/:subject/:id" element={<Suspense fallback={<Loading />}><Question /></Suspense>} />

          <Route path="/vocab" element={<Suspense fallback={<Loading />}><Vocab /></Suspense>} />
          <Route path="/analysis" element={<Suspense fallback={<Loading />}><Analysis /></Suspense>} />
          <Route path="*" element={<Suspense fallback={<Loading />}><NotFound /></Suspense>} />
          </Routes>
          <LegalDisclaimer />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
