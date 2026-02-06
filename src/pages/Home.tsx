import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { bankCounts } from "@/data/questionBank";
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  LogOut,
  Settings,
  Target,
  Trophy,
  User,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const questionBankTotal = bankCounts.math + bankCounts.reading;
const totalQuestions = questionBankTotal + 100;

const BrandMark = () => (
  <svg viewBox="0 0 240 152" aria-hidden="true" className="h-4 w-7">
    <path
      d="M18 28C46 12 82 12 114 28C146 44 177 44 220 31L145 134C138 144 122 144 115 134L18 28Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="16"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M121 47V130" stroke="currentColor" strokeWidth="16" strokeLinecap="round" />
  </svg>
);

const Home = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [countValue, setCountValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const duration = 3000;
    let startTime = 0;

    const tick = (time: number) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCountValue(Math.floor(eased * totalQuestions));

      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-secondary/20" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

      <div className="relative flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="container mx-auto h-16 px-4 flex items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center gap-2 text-foreground no-underline" aria-label="1600.now homepage">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-foreground text-background">
              <BrandMark />
            </span>
            <span className="font-semibold tracking-tight">1600.now</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-muted-foreground" aria-label="Primary">
            <Link to="/bank" className="rounded-md px-3 py-1.5 hover:bg-muted hover:text-foreground">Question Bank</Link>
            <Link to="/question/1" className="rounded-md px-3 py-1.5 hover:bg-muted hover:text-foreground">100 Hard</Link>
          </nav>

          <div className="inline-flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-1.5 font-medium">
                    <User className="h-4 w-4" />
                    <span>Account</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">{user.email}</div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/analysis")}>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    <span>Statistics</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()} className="text-red-600 focus:text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="inline-flex items-center gap-1">
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => navigate("/login")}>
                  Log In
                </Button>
                <Button size="sm" onClick={() => navigate("/signup")}>
                  Sign Up
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto flex-1 px-4">
        <section className="px-5 py-16 md:px-10 md:py-24 mt-6 md:mt-8 text-center">
          <div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tight text-balance leading-[0.95]">
              Reach your best score
            </h1>
            <p className="mt-5 mx-auto max-w-2xl text-base md:text-lg text-muted-foreground">
              Simple, free, and accurate SAT practice&mdash;based off real past tests
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" onClick={() => navigate("/bank")}>
                Explore question bank
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className="mt-9 text-2xl md:text-4xl font-semibold tracking-tight">
              Over{" "}
              <span className="tabular-nums">{countValue.toLocaleString()}</span>{" "}
              questions
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl pt-12 pb-6" id="question-bank-overview">
          <Card className="border-border bg-card shadow-sm">
            <div className="p-5 md:p-7">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overview</p>
              <h2 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">Question Bank</h2>
              <p className="mt-3 text-muted-foreground max-w-3xl">
                Practice with a large SAT-style pool built from real test patterns. Filter by reading or math,
                target weak skills, and improve through focused repetition.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{questionBankTotal.toLocaleString()} questions</span> across reading and math.
                </div>
                <div className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                  Mix broad practice with targeted drills by topic and skill.
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="mx-auto max-w-5xl pb-14" id="hard-overview">
          <Card className="border-border bg-card shadow-sm">
            <div className="p-5 md:p-7">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overview</p>
              <h2 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">100 Hard Questions</h2>
              <p className="mt-3 text-muted-foreground max-w-3xl">
                A curated set of high-difficulty questions designed to stress test your strategy, pace,
                and accuracy before test day.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <div className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground inline-flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-foreground" />
                  Advanced difficulty set
                </div>
                <div className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground inline-flex items-center gap-2">
                  <Target className="h-4 w-4 text-foreground" />
                  Built for precision under pressure
                </div>
              </div>
            </div>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="container mx-auto px-4 py-4 text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
          <p>© 2026 1600.now</p>
          <span>Built for focused SAT prep.</span>
        </div>
      </footer>
      </div>
    </div>
  );
};

export default Home;
