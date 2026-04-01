import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart3,
  ChevronDown,
  LogOut,
  Settings,
  User,
  RotateCcw,
} from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
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

// Sections split by subject for the two-panel layout
const rwSections = digitalSatSections.slice(0, 2); // indices 0, 1
const mathSections = digitalSatSections.slice(2, 4); // indices 2, 3

const ScoreCalculator = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [rawScores, setRawScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      digitalSatSections.map((section, secIdx) => [
        String(secIdx),
        Math.round(section.maxRaw / 2),
      ]),
    ),
  );

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.id = "calc-keyframes";
    style.textContent = `
      @keyframes scoreGlowPulse {
        0%, 100% { text-shadow: 0 0 40px var(--score-glow, rgba(125,211,252,0.3)); }
        50%       { text-shadow: 0 0 70px var(--score-glow, rgba(125,211,252,0.5)); }
      }
      .score-number { animation: scoreGlowPulse 4s ease-in-out infinite; }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(link);
      document.getElementById("calc-keyframes")?.remove();
    };
  }, []);

  const scores = useMemo(() => {
    const readingWriting =
      (digitalSatSections[0].scores[rawScores["0"] ?? 0] ?? 0) +
      (digitalSatSections[1].scores[rawScores["1"] ?? 0] ?? 0);
    const math =
      (digitalSatSections[2].scores[rawScores["2"] ?? 0] ?? 0) +
      (digitalSatSections[3].scores[rawScores["3"] ?? 0] ?? 0);
    const total = readingWriting + math;
    return { readingWriting, math, total, color: getSatScoreColor(total) };
  }, [rawScores]);

  const updateScore = (sectionIndex: number, nextValue: number) => {
    setRawScores((prev) => ({ ...prev, [String(sectionIndex)]: nextValue }));
  };

  const resetScores = () => {
    setRawScores(
      Object.fromEntries(
        digitalSatSections.map((section, secIdx) => [
          String(secIdx),
          Math.round(section.maxRaw / 2),
        ]),
      ),
    );
  };

  return (
    <div
      className="min-h-screen"
      style={{ fontFamily: "'Outfit', sans-serif" }}
    >
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4">
          <Link
            to="/"
            className="inline-flex flex-shrink-0 items-center no-underline"
            aria-label="1600.now homepage"
          >
            <img
              src="/logo_b.png"
              alt="1600.now"
              className="h-10 object-contain dark:hidden"
            />
            <img
              src="/logo_w.png"
              alt="1600.now"
              className="hidden h-10 object-contain dark:block"
            />
          </Link>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 text-sm text-muted-foreground md:flex">
            {tabLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "rounded-md px-3 py-1.5 transition-colors",
                  link.to === "/score-calculator"
                    ? "bg-primary/10 text-foreground"
                    : "hover:bg-muted hover:text-foreground",
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
                  <div className="truncate px-2 py-1.5 text-xs text-muted-foreground">
                    {user.email}
                  </div>
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
                  <DropdownMenuItem
                    onClick={() => signOut()}
                    className="text-red-600 focus:text-red-600"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/")}
              >
                Home
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ── DARK SCORE HERO ──────────────────────────────────────────────── */}
      <section
        style={{
          background:
            "linear-gradient(160deg, hsl(226,42%,7%) 0%, hsl(220,38%,10%) 55%, hsl(214,34%,13%) 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)",
            backgroundSize: "52px 52px",
            pointerEvents: "none",
          }}
        />
        {/* Score glow blob */}
        <div
          style={{
            position: "absolute",
            top: "-20%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 600,
            height: 400,
            borderRadius: "50%",
            background: `radial-gradient(ellipse, ${scores.color}22 0%, transparent 68%)`,
            pointerEvents: "none",
            transition: "background 0.6s ease",
          }}
        />

        <div
          style={{
            position: "relative",
            maxWidth: 860,
            margin: "0 auto",
            padding: "52px 24px 56px",
            textAlign: "center",
          }}
        >
          {/* Label */}
          <p
            style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.35)",
              marginBottom: 16,
            }}
          >
            Digital SAT Score Estimator
          </p>

          {/* Total score */}
          <div
            className="score-number"
            style={
              {
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: "clamp(80px, 16vw, 160px)",
                fontWeight: 400,
                lineHeight: 0.9,
                color: scores.color,
                transition: "color 0.4s ease",
                marginBottom: 28,
                "--score-glow": `${scores.color}55`,
              } as React.CSSProperties
            }
          >
            {scores.total}
          </div>

          {/* Section subscores */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                padding: "14px 24px",
                minWidth: 130,
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.4)",
                  marginBottom: 6,
                }}
              >
                Reading & Writing
              </p>
              <p
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 32,
                  fontWeight: 700,
                  color: "white",
                  lineHeight: 1,
                  transition: "color 0.3s",
                }}
              >
                {scores.readingWriting}
              </p>
            </div>

            <div
              style={{
                width: 1,
                height: 40,
                background: "rgba(255,255,255,0.12)",
                flexShrink: 0,
              }}
            />

            <div
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                padding: "14px 24px",
                minWidth: 130,
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.4)",
                  marginBottom: 6,
                }}
              >
                Math
              </p>
              <p
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 32,
                  fontWeight: 700,
                  color: "white",
                  lineHeight: 1,
                  transition: "color 0.3s",
                }}
              >
                {scores.math}
              </p>
            </div>
          </div>

          {/* Reset */}
          <div style={{ marginTop: 28 }}>
            <button
              onClick={resetScores}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 18px",
                borderRadius: 100,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.5)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "'Outfit', sans-serif",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(255,255,255,0.12)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "rgba(255,255,255,0.8)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(255,255,255,0.07)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "rgba(255,255,255,0.5)";
              }}
            >
              <RotateCcw size={12} />
              Reset to defaults
            </button>
          </div>
        </div>

        {/* Fade to background */}
        <div
          style={{
            height: 64,
            background:
              "linear-gradient(to bottom, transparent, hsl(var(--background)))",
          }}
        />
      </section>

      {/* ── SLIDERS ──────────────────────────────────────────────────────── */}
      <main
        style={{ maxWidth: 860, margin: "0 auto", padding: "8px 24px 80px" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 32,
          }}
        >
          {/* Reading & Writing panel */}
          <SubjectPanel
            label="Reading & Writing"
            accent="#60a5fa"
            sections={rwSections}
            sectionOffset={0}
            rawScores={rawScores}
            onUpdate={updateScore}
          />

          {/* Math panel */}
          <SubjectPanel
            label="Math"
            accent="hsl(201,100%,74%)"
            sections={mathSections}
            sectionOffset={2}
            rawScores={rawScores}
            onUpdate={updateScore}
          />
        </div>

        {/* Scoring note */}
        <p
          style={{
            fontSize: 12,
            color: "hsl(var(--muted-foreground))",
            textAlign: "center",
            marginTop: 36,
            lineHeight: 1.7,
          }}
        >
          Scores estimated using Digital SAT conversion tables. Module 2
          adaptive scoring may vary based on Module 1 performance.
        </p>
      </main>
    </div>
  );
};

// ─── Subject panel (RW or Math) ────────────────────────────────────────────

interface SubjectPanelProps {
  label: string;
  accent: string;
  sections: (typeof digitalSatSections)[number][];
  sectionOffset: number;
  rawScores: Record<string, number>;
  onUpdate: (idx: number, val: number) => void;
}

const SubjectPanel = ({
  label,
  accent,
  sections,
  sectionOffset,
  rawScores,
  onUpdate,
}: SubjectPanelProps) => (
  <div>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          width: 3,
          height: 20,
          borderRadius: 2,
          background: accent,
          flexShrink: 0,
        }}
      />
      <h2
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "hsl(var(--foreground))",
          margin: 0,
        }}
      >
        {label}
      </h2>
    </div>

    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {sections.map((section, i) => {
        const globalIdx = sectionOffset + i;
        const value = rawScores[String(globalIdx)] ?? 0;
        const pct = (value / section.maxRaw) * 100;

        return (
          <div
            key={section.title}
            style={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 14,
              padding: "18px 20px",
              transition: "border-color 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor =
                `${accent}55`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor =
                "hsl(var(--border))";
            }}
          >
            {/* Module label + score fraction */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "hsl(var(--foreground))",
                    margin: "0 0 2px",
                  }}
                >
                  {section.title.includes("Module 1") ? "Module 1" : "Module 2"}
                </p>
                <p
                  style={{
                    fontSize: 11,
                    color: "hsl(var(--muted-foreground))",
                    margin: 0,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    fontWeight: 500,
                  }}
                >
                  Raw score
                </p>
              </div>

              <div
                style={{
                  textAlign: "right",
                }}
              >
                <span
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 22,
                    fontWeight: 700,
                    color: "hsl(var(--foreground))",
                  }}
                >
                  {value}
                </span>
                <span
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 13,
                    color: "hsl(var(--muted-foreground))",
                    marginLeft: 3,
                  }}
                >
                  / {section.maxRaw}
                </span>
              </div>
            </div>

            {/* Thin progress strip */}
            <div
              style={{
                height: 3,
                borderRadius: 2,
                background: "hsl(var(--muted))",
                marginBottom: 14,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: 2,
                  width: `${pct}%`,
                  background: accent,
                  transition: "width 0.15s ease",
                }}
              />
            </div>

            {/* Slider + stepper */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                style={stepperBtn}
                onClick={() => onUpdate(globalIdx, Math.max(0, value - 1))}
                aria-label={`Decrease ${section.title}`}
              >
                −
              </button>
              <div style={{ flex: 1 }}>
                <Slider
                  value={[value]}
                  min={0}
                  max={section.maxRaw}
                  step={1}
                  onValueChange={([next]) => onUpdate(globalIdx, next)}
                  className="py-3 [&_[role=slider]]:h-6 [&_[role=slider]]:w-6 [&_[role=slider]]:border-[3px] [&_[role=slider]]:border-primary [&_[role=slider]]:bg-background [&_[role=slider]]:shadow-lg [&_[role=slider]]:hover:scale-110 [&_[data-orientation=horizontal]]:h-2.5 [&_[data-radix-collection-item]]:transition-transform"
                />
              </div>
              <button
                style={stepperBtn}
                onClick={() =>
                  onUpdate(globalIdx, Math.min(section.maxRaw, value + 1))
                }
                aria-label={`Increase ${section.title}`}
              >
                +
              </button>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const stepperBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  border: "1.5px solid hsl(var(--border))",
  background: "hsl(var(--background))",
  color: "hsl(var(--foreground))",
  fontSize: 18,
  fontWeight: 300,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  lineHeight: 1,
  transition: "background 0.15s, border-color 0.15s",
};

export default ScoreCalculator;
