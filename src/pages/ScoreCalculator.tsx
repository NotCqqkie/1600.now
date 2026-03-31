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

      <main className="container mx-auto max-w-5xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <Card className="border-border/70 p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">SAT Score Calculator</h1>
                <p className="mt-1 text-sm text-muted-foreground">Adjust your module scores to estimate Reading and Writing, Math, and total.</p>
              </div>
              <Button variant="outline" onClick={resetScores}>
                Reset
              </Button>
            </div>

            <div className="space-y-4">
              {digitalSatSections.map((section, secIdx) => {
                const value = rawScores[String(secIdx)] ?? 0;
                return (
                  <div key={section.title} className="rounded-2xl border border-border/80 p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-foreground">{section.title}</p>
                      </div>
                      <div className="rounded-xl bg-muted/40 px-3 py-2 text-right">
                        <p className="text-2xl font-bold text-foreground">
                          {value}
                          <span className="ml-1 text-sm font-medium text-muted-foreground">/ {section.maxRaw}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        onClick={() => updateScore(secIdx, Math.max(0, value - 1))}
                      >
                        -
                      </Button>
                      <Slider
                        value={[value]}
                        min={0}
                        max={section.maxRaw}
                        step={1}
                        onValueChange={([next]) => updateScore(secIdx, next)}
                        className="py-3 [&_[role=slider]]:border-4 [&_[role=slider]]:border-emerald-500 [&_[role=slider]]:shadow-lg [&_[role=slider]]:shadow-emerald-500/20 [&_[data-orientation=horizontal]]:h-3 [&_[data-orientation=horizontal]>span]:bg-emerald-500"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        onClick={() => updateScore(secIdx, Math.min(section.maxRaw, value + 1))}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="border-border/70 p-6 shadow-sm lg:sticky lg:top-24 lg:h-fit">
            <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">Scores</h2>
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">Reading and Writing</p>
                <p className="mt-1 text-4xl font-black text-foreground">{scores.readingWriting}</p>
              </div>

              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">Math</p>
                <p className="mt-1 text-4xl font-black text-foreground">{scores.math}</p>
              </div>

              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="mt-1 text-5xl font-black tracking-tight" style={{ color: scores.color }}>
                  {scores.total}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ScoreCalculator;
