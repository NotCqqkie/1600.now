import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, ChevronDown, Home, LogOut, Settings, User } from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getSatScoreColor, satCalculatorYears } from "@/data/satCalculator";

const tabLinks = [
  { to: "/bank", label: "Question Bank" },
  { to: "/hard/1", label: "100 Hard Questions" },
  { to: "/score-calculator", label: "Score Calculator" },
];

const digitalSatSections = satCalculatorYears[0].sections;

const ScoreCalculator = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [rawScores, setRawScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(digitalSatSections.map((section, secIdx) => [String(secIdx), Math.round(section.maxRaw / 2)])),
  );

  const scores = useMemo(() => {
    const readingWriting =
      (digitalSatSections[0].scores[rawScores["0"] ?? 0] ?? 0) +
      (digitalSatSections[1].scores[rawScores["1"] ?? 0] ?? 0);
    const math =
      (digitalSatSections[2].scores[rawScores["2"] ?? 0] ?? 0) +
      (digitalSatSections[3].scores[rawScores["3"] ?? 0] ?? 0);
    const total = readingWriting + math;

    return {
      readingWriting,
      math,
      total,
      color: getSatScoreColor(total),
    };
  }, [rawScores]);

  const updateScore = (sectionIndex: number, nextValue: number) => {
    setRawScores((prev) => ({
      ...prev,
      [String(sectionIndex)]: nextValue,
    }));
  };

  const resetScores = () => {
    setRawScores(
      Object.fromEntries(digitalSatSections.map((section, secIdx) => [String(secIdx), Math.round(section.maxRaw / 2)])),
    );
  };

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "'Outfit', sans-serif" }}>
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4">
          <Link to="/" className="inline-flex flex-shrink-0 items-center no-underline" aria-label="1600.now homepage">
            <img src="/logo_b.png" alt="1600.now" className="h-10 object-contain dark:hidden" />
            <img src="/logo_w.png" alt="1600.now" className="hidden h-10 object-contain dark:block" />
          </Link>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 text-sm text-muted-foreground md:flex">
            {tabLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "rounded-md px-3 py-1.5 transition-colors",
                  link.to === "/score-calculator" ? "bg-primary/10 text-foreground" : "hover:bg-muted hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="inline-flex flex-shrink-0 items-center gap-2">
            <ThemeToggle />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <User className="h-4 w-4" />
                    <span>Account</span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <div className="truncate px-2 py-1.5 text-xs text-muted-foreground">{user.email}</div>
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
              <Button variant="outline" size="sm" onClick={() => navigate("/")}>
                <Home className="mr-2 h-4 w-4" />
                Home
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-8 md:py-10">
        <div className="space-y-6">
          <Card className="overflow-hidden border-border/70 bg-gradient-to-br from-card via-card to-muted/20 shadow-sm">
            <div className="grid gap-6 p-6 md:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">Digital SAT estimator</p>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-foreground md:text-4xl">SAT Score Calculator</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                  Move each module slider to estimate your section scores. The total updates live so you can see the effect immediately.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-primary/15 bg-primary/5 p-5 shadow-sm sm:col-span-3">
                  <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Total score</p>
                  <p className="mt-3 text-6xl font-black tracking-[-0.04em] md:text-7xl" style={{ color: scores.color }}>
                    {scores.total}
                  </p>
                </div>

                <div className="rounded-2xl bg-muted/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Reading & Writing</p>
                  <p className="mt-2 text-3xl font-black text-foreground">{scores.readingWriting}</p>
                </div>

                <div className="rounded-2xl bg-muted/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Math</p>
                  <p className="mt-2 text-3xl font-black text-foreground">{scores.math}</p>
                </div>

                <div className="flex items-center justify-end sm:justify-start">
                  <Button variant="outline" onClick={resetScores} className="h-11 rounded-full px-5 text-sm font-semibold">
                    Reset scores
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-border/70 p-5 shadow-sm md:p-6">
            <div className="grid gap-4">
              {digitalSatSections.map((section, secIdx) => {
                const value = rawScores[String(secIdx)] ?? 0;
                return (
                  <div
                    key={section.title}
                    className="rounded-3xl border border-border/70 bg-gradient-to-r from-background to-muted/20 p-5 shadow-sm transition-colors hover:border-primary/25"
                  >
                    <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-lg font-bold text-foreground md:text-xl">{section.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">Raw score selector</p>
                      </div>

                      <div className="inline-flex min-w-[110px] items-end justify-between rounded-2xl border border-border/60 bg-background/90 px-4 py-3 text-right shadow-sm">
                        <span className="text-3xl font-black tracking-tight text-foreground">{value}</span>
                        <span className="pb-1 text-sm font-medium text-muted-foreground">/ {section.maxRaw}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 md:gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 flex-shrink-0 rounded-full border-2 text-lg font-bold"
                        onClick={() => updateScore(secIdx, Math.max(0, value - 1))}
                        aria-label={`Decrease ${section.title} raw score`}
                      >
                        -
                      </Button>
                      <Slider
                        value={[value]}
                        min={0}
                        max={section.maxRaw}
                        step={1}
                        onValueChange={([next]) => updateScore(secIdx, next)}
                        className="py-4 [&_[role=slider]]:h-8 [&_[role=slider]]:w-8 [&_[role=slider]]:border-[5px] [&_[role=slider]]:border-primary [&_[role=slider]]:bg-background [&_[role=slider]]:shadow-xl [&_[role=slider]]:shadow-primary/20 [&_[role=slider]]:hover:scale-110 [&_[data-orientation=horizontal]]:h-4 [&_[data-radix-collection-item]]:transition-transform"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 flex-shrink-0 rounded-full border-2 text-lg font-bold"
                        onClick={() => updateScore(secIdx, Math.min(section.maxRaw, value + 1))}
                        aria-label={`Increase ${section.title} raw score`}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ScoreCalculator;
