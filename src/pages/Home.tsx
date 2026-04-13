import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { BrandLogo } from "@/components/BrandLogo";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Calculator,
  ChevronDown,
  GraduationCap,
  LogOut,
  Settings,
  SpellCheck,
  Target,
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
import { Button } from "@/components/ui/button";
import { useThemeMode } from "@/hooks/useThemeMode";

const DEFAULT_QUESTION_BANK_TOTAL = 5880;

// ─── Demo state machine ────────────────────────────────────────────────────

type Phase =
  | "reading"
  | "movingToB"
  | "clickedB"
  | "movingToCheck"
  | "clickedCheck"
  | "explained"
  | "fadingOut";

const PHASES: { phase: Phase; duration: number }[] = [
  { phase: "reading", duration: 1400 },
  { phase: "movingToB", duration: 850 },
  { phase: "clickedB", duration: 520 },
  { phase: "movingToCheck", duration: 820 },
  { phase: "clickedCheck", duration: 420 },
  { phase: "explained", duration: 2800 },
  { phase: "fadingOut", duration: 600 },
];

const DEMO_Q = {
  text: "The graph shows recovery rates from 2018–2023. Which statement is best supported by the data?",
  answers: [
    { label: "A", text: "Scores declined each consecutive year" },
    { label: "B", text: "Performance improved steadily after 2020" },
    { label: "C", text: "The sample size was insufficient" },
    { label: "D", text: "Results show no measurable trend" },
  ],
  correctIdx: 1,
  explanation:
    "Choice B is directly supported — the data shows a consistent upward trend in recovery rates starting in 2020, satisfying the claim of steady improvement.",
};

// ─── Animated cursor dot ───────────────────────────────────────────────────

const CursorDot = ({ clicking }: { clicking: boolean }) => (
  <div style={{ position: "relative", width: 22, height: 26 }}>
    <svg width="22" height="26" viewBox="0 0 22 26" fill="none">
      <path
        d="M3 2.5L18.5 13.5L11.5 15L8.5 23L3 2.5Z"
        fill="white"
        stroke="rgba(0,0,0,0.55)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
    {clicking && (
      <div
        key={`ripple-${Date.now()}`}
        style={{
          position: "absolute",
          top: 4,
          left: 4,
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.75)",
          animation: "demoClickRipple 0.45s ease-out forwards",
        }}
      />
    )}
  </div>
);

// ─── Product demo window ───────────────────────────────────────────────────

const ProductDemo = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const [phaseIdx, setPhaseIdx] = useState(0);

  useEffect(() => {
    const { duration } = PHASES[phaseIdx];
    const t = setTimeout(
      () => setPhaseIdx((i) => (i + 1) % PHASES.length),
      duration
    );
    return () => clearTimeout(t);
  }, [phaseIdx]);

  const { phase } = PHASES[phaseIdx];
  const isAnswerSelected = ["clickedB", "movingToCheck", "clickedCheck", "explained"].includes(phase);
  const showExplanation = phase === "explained";
  const isInvisible = phase === "fadingOut";
  const isCursorClicking = phase === "clickedB" || phase === "clickedCheck";
  const demoTheme = isDarkMode
    ? {
        windowBg: "hsl(222, 30%, 13%)",
        windowShadow:
          "0 0 0 1px rgba(255,255,255,0.07), 0 40px 100px rgba(0,0,0,0.55), 0 0 80px rgba(125,211,252,0.07)",
        chromeBg: "hsl(222, 30%, 9%)",
        chromeBorder: "1px solid rgba(255,255,255,0.05)",
        addressBg: "hsl(222, 30%, 6%)",
        addressText: "rgba(255,255,255,0.3)",
        stripBorder: "1px solid rgba(255,255,255,0.04)",
        progressInactive: "rgba(255,255,255,0.09)",
        progressText: "rgba(255,255,255,0.28)",
        cardBg: "rgba(255,255,255,0.03)",
        cardBorder: "1px solid rgba(255,255,255,0.06)",
        cardText: "rgba(255,255,255,0.78)",
        answerBorder: "1px solid rgba(255,255,255,0.07)",
        answerBg: "rgba(255,255,255,0.02)",
        radioBorder: "2px solid rgba(255,255,255,0.18)",
        answerText: "rgba(255,255,255,0.5)",
        answerLabel: "rgba(255,255,255,0.28)",
        checkBg: "rgba(255,255,255,0.07)",
        checkText: "rgba(255,255,255,0.22)",
        explanationText: "rgba(255,255,255,0.58)",
      }
    : {
        windowBg: "hsl(0, 0%, 100%)",
        windowShadow:
          "0 0 0 1px rgba(15,23,42,0.08), 0 24px 64px rgba(15,23,42,0.12), 0 0 48px rgba(56,189,248,0.1)",
        chromeBg: "hsl(210, 40%, 97%)",
        chromeBorder: "1px solid rgba(15,23,42,0.08)",
        addressBg: "hsl(210, 36%, 94%)",
        addressText: "rgba(15,23,42,0.42)",
        stripBorder: "1px solid rgba(15,23,42,0.06)",
        progressInactive: "rgba(15,23,42,0.09)",
        progressText: "rgba(15,23,42,0.38)",
        cardBg: "rgba(248,250,252,0.92)",
        cardBorder: "1px solid rgba(15,23,42,0.08)",
        cardText: "rgba(15,23,42,0.82)",
        answerBorder: "1px solid rgba(15,23,42,0.08)",
        answerBg: "rgba(248,250,252,0.88)",
        radioBorder: "2px solid rgba(15,23,42,0.18)",
        answerText: "rgba(15,23,42,0.62)",
        answerLabel: "rgba(15,23,42,0.4)",
        checkBg: "rgba(15,23,42,0.08)",
        checkText: "rgba(15,23,42,0.4)",
        explanationText: "rgba(15,23,42,0.62)",
      };

  // Cursor position as % of the demo container
  const cPos = ((): { left: string; top: string } => {
    switch (phase) {
      case "reading":       return { left: "58%", top: "23%" };
      case "movingToB":     return { left: "6%",  top: "56%" };
      case "clickedB":      return { left: "6%",  top: "56%" };
      case "movingToCheck": return { left: "70%", top: "75%" };
      case "clickedCheck":  return { left: "70%", top: "75%" };
      case "explained":     return { left: "40%", top: "85%" };
      case "fadingOut":     return { left: "58%", top: "23%" };
    }
  })();

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      {/* Window */}
      <div
        style={{
          background: demoTheme.windowBg,
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: demoTheme.windowShadow,
          opacity: isInvisible ? 0 : 1,
          transition: "opacity 0.5s ease",
        }}
      >
        {/* Browser chrome */}
        <div
          style={{
            background: demoTheme.chromeBg,
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: 7,
            borderBottom: demoTheme.chromeBorder,
          }}
        >
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <div
              key={c}
              style={{ width: 11, height: 11, borderRadius: "50%", background: c }}
            />
          ))}
          <div
            style={{
              flex: 1,
              marginLeft: 10,
              background: demoTheme.addressBg,
              borderRadius: 6,
              padding: "4px 12px",
              fontSize: 10,
              color: demoTheme.addressText,
              fontFamily: "'Space Mono', monospace",
            }}
          >
            1600.now / bank / math / question / 472
          </div>
        </div>

        {/* Progress bar strip */}
        <div
          style={{
            borderBottom: demoTheme.stripBorder,
            padding: "9px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 3 }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 18,
                  height: 4,
                  borderRadius: 2,
                  background:
                    i < 6 ? "hsl(201, 100%, 70%)" : demoTheme.progressInactive,
                }}
              />
            ))}
          </div>
          <span
            style={{
              fontSize: 10,
              color: demoTheme.progressText,
              fontFamily: "'Space Mono', monospace",
            }}
          >
            Q 47 / 100
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px 20px" }}>
          {/* Question */}
          <div
            style={{
              background: demoTheme.cardBg,
              border: demoTheme.cardBorder,
              borderRadius: 10,
              padding: "12px 14px",
              marginBottom: 12,
              fontSize: 11.5,
              color: demoTheme.cardText,
              lineHeight: 1.55,
            }}
          >
            {DEMO_Q.text}
          </div>

          {/* Answers */}
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
            {DEMO_Q.answers.map((ans, idx) => {
              const sel = isAnswerSelected && idx === DEMO_Q.correctIdx;
              return (
                <div
                  key={ans.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: sel
                      ? "1px solid hsl(201,100%,68%)"
                      : demoTheme.answerBorder,
                    background: sel
                      ? "rgba(125,211,252,0.1)"
                      : demoTheme.answerBg,
                    transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      flexShrink: 0,
                      border: sel
                        ? "2px solid hsl(201,100%,70%)"
                        : demoTheme.radioBorder,
                      background: sel ? "hsl(201,100%,70%)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.35s ease",
                    }}
                  >
                    {sel && (
                      <div
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: "hsl(222,30%,9%)",
                        }}
                      />
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 10.5,
                      color: sel ? demoTheme.cardText : demoTheme.answerText,
                      lineHeight: 1.4,
                      transition: "color 0.3s",
                    }}
                  >
                    <strong
                      style={{
                        marginRight: 5,
                        color: sel
                          ? "hsl(201,100%,80%)"
                          : demoTheme.answerLabel,
                        transition: "color 0.3s",
                      }}
                    >
                      {ans.label}.
                    </strong>
                    {ans.text}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Check button */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <div
              style={{
                padding: "8px 20px",
                borderRadius: 7,
                background: isAnswerSelected
                  ? "hsl(201,100%,74%)"
                  : demoTheme.checkBg,
                color: isAnswerSelected
                  ? "hsl(222,30%,9%)"
                  : demoTheme.checkText,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "'Outfit', sans-serif",
                cursor: "pointer",
                transition: "all 0.35s ease",
                boxShadow: isAnswerSelected
                  ? "0 0 24px rgba(125,211,252,0.35)"
                  : "none",
              }}
            >
              Check Answer
            </div>
          </div>

          {/* Explanation */}
          <div
            style={{
              overflow: "hidden",
              maxHeight: showExplanation ? 130 : 0,
              opacity: showExplanation ? 1 : 0,
              transition:
                "max-height 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease",
            }}
          >
            <div
              style={{
                background: "rgba(34,197,94,0.07)",
                border: "1px solid rgba(34,197,94,0.22)",
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "rgba(34,197,94,0.18)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    color: "#4ade80",
                    fontWeight: 700,
                  }}
                >
                  ✓
                </div>
                <span
                  style={{ fontSize: 11, fontWeight: 700, color: "#4ade80" }}
                >
                  Correct — Choice B
                </span>
              </div>
              <p
                style={{
                  fontSize: 10.5,
                  color: demoTheme.explanationText,
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {DEMO_Q.explanation}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cursor */}
      <div
        style={{
          position: "absolute",
          left: cPos.left,
          top: cPos.top,
          transition:
            "left 0.72s cubic-bezier(0.25,0.46,0.45,0.94), top 0.72s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.4s ease",
          pointerEvents: "none",
          zIndex: 20,
          opacity: isInvisible ? 0 : 1,
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))",
        }}
      >
        <CursorDot clicking={isCursorClicking} />
      </div>
    </div>
  );
};

// ─── Home page ─────────────────────────────────────────────────────────────

const Home = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [questionBankTotal, setQuestionBankTotal] = useState(DEFAULT_QUESTION_BANK_TOTAL);
  const [countValue, setCountValue] = useState(0);
  const isDarkMode = useThemeMode();
  const totalQuestions = questionBankTotal + 100;

  // Font + animation injection
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.id = "home-keyframes";
    style.textContent = `
      @keyframes demoClickRipple {
        0%   { transform: scale(0.3); opacity: 1; }
        100% { transform: scale(2.8); opacity: 0; }
      }
      @keyframes homeFadeUp {
        from { opacity: 0; transform: translateY(22px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes heroGlowPulse {
        0%, 100% { opacity: 0.35; transform: scale(1); }
        50%       { opacity: 0.65; transform: scale(1.08); }
      }
      @keyframes demoFloat {
        0%, 100% { transform: translateY(0px) perspective(1200px) rotateX(1.5deg); }
        50%       { transform: translateY(-10px) perspective(1200px) rotateX(1.5deg); }
      }
      .h-fade-1 { animation: homeFadeUp 0.75s ease 0.1s both; }
      .h-fade-2 { animation: homeFadeUp 0.75s ease 0.22s both; }
      .h-fade-3 { animation: homeFadeUp 0.75s ease 0.36s both; }
      .h-fade-4 { animation: homeFadeUp 0.75s ease 0.5s both; }
      .h-fade-5 { animation: homeFadeUp 0.75s ease 0.64s both; }
      .h-fade-6 { animation: homeFadeUp 0.85s ease 0.8s both; }
      .demo-float { animation: demoFloat 5.5s ease-in-out infinite; }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(link);
      document.getElementById("home-keyframes")?.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadQuestionCounts = async () => {
      const { bankCounts } = await import("@/data/questionBank");
      if (!cancelled) {
        setQuestionBankTotal(bankCounts.math + bankCounts.reading);
      }
    };

    loadQuestionCounts().catch(() => {
      // Keep the fallback count if the bank module fails to load.
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Count-up animation
  useEffect(() => {
    let frame = 0;
    let startTime = 0;
    const duration = 3200;
    const tick = (time: number) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCountValue(Math.floor(eased * totalQuestions));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [totalQuestions]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ fontFamily: "'Outfit', sans-serif" }}
    >
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-3 sm:px-4">
          <BrandLogo variant="mark" className="h-9 w-9" />

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 text-sm text-muted-foreground md:flex">
            <Link
              to="/bank"
              className="rounded-md px-3 py-1.5 transition-colors hover:bg-muted hover:text-foreground"
            >
              Question Bank
            </Link>
            <Link
              to="/hard"
              className="rounded-md px-3 py-1.5 transition-colors hover:bg-muted hover:text-foreground"
            >
              100 Hard Math Questions
            </Link>
            <Link
              to="/score-calculator"
              className="rounded-md px-3 py-1.5 transition-colors hover:bg-muted hover:text-foreground"
            >
              Score Calculator
            </Link>
            <Link
              to="/modules"
              className="rounded-md px-3 py-1.5 transition-colors hover:bg-muted hover:text-foreground"
            >
              Practice Modules
            </Link>
          </nav>

          <div className="inline-flex flex-shrink-0 items-center gap-2">
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
              <div className="inline-flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex"
                  onClick={() => navigate("/login")}
                >
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

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section
        style={{
          background: isDarkMode
            ? "linear-gradient(160deg, hsl(226,42%,7%) 0%, hsl(220,38%,10%) 55%, hsl(214,34%,13%) 100%)"
            : "linear-gradient(160deg, hsl(210,70%,98%) 0%, hsl(205,72%,95%) 48%, hsl(215,44%,92%) 100%)",
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
              isDarkMode
                ? "linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)"
                : "linear-gradient(rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.05) 1px, transparent 1px)",
            backgroundSize: "52px 52px",
            pointerEvents: "none",
          }}
        />
        {/* Glow blobs */}
        <div
          style={{
            position: "absolute",
            top: "-15%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 700,
            height: 450,
            borderRadius: "50%",
            background: isDarkMode
              ? "radial-gradient(ellipse, rgba(125,211,252,0.11) 0%, transparent 68%)"
              : "radial-gradient(ellipse, rgba(56,189,248,0.18) 0%, transparent 70%)",
            pointerEvents: "none",
            animation: "heroGlowPulse 7s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "15%",
            right: "-8%",
            width: 340,
            height: 340,
            borderRadius: "50%",
            background: isDarkMode
              ? "radial-gradient(ellipse, rgba(251,191,36,0.055) 0%, transparent 68%)"
              : "radial-gradient(ellipse, rgba(250,204,21,0.14) 0%, transparent 72%)",
            pointerEvents: "none",
          }}
        />

        {/* Hero text */}
        <div
          style={{
            position: "relative",
            maxWidth: 860,
            margin: "0 auto",
            padding: "76px 24px 0",
            textAlign: "center",
          }}
        >
          {/* Headline */}
          <h1
            className="h-fade-2"
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: "clamp(54px, 9.5vw, 112px)",
              lineHeight: 0.94,
              color: "hsl(var(--foreground))",
              margin: "0 0 26px",
              letterSpacing: "-0.025em",
            }}
          >
            Reach your
            <br />
            <em
              style={{
                fontStyle: "italic",
                color: "hsl(201,100%,80%)",
              }}
            >
              best score.
            </em>
          </h1>

          {/* Subtitle */}
          <p
            className="h-fade-3"
            style={{
              fontSize: "clamp(15px, 2.2vw, 19px)",
              color: isDarkMode
                ? "rgba(255,255,255,0.46)"
                : "rgba(15,23,42,0.68)",
              maxWidth: 460,
              margin: "0 auto 38px",
              lineHeight: 1.65,
              fontWeight: 300,
            }}
          >
            Accurate SAT practice built from real past tests.
            <br />
            No paywalls.
          </p>

          {/* CTAs */}
          <div
            className="h-fade-4"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              justifyContent: "center",
              marginBottom: 52,
            }}
          >
            <button
              onClick={() => navigate("/bank")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "13px 30px",
                borderRadius: 10,
                background: "hsl(201,100%,74%)",
                color: "hsl(210,50%,12%)",
                fontWeight: 600,
                fontSize: 15,
                border: "none",
                cursor: "pointer",
                fontFamily: "'Outfit', sans-serif",
                boxShadow:
                  isDarkMode
                    ? "0 0 36px rgba(125,211,252,0.28), 0 4px 18px rgba(0,0,0,0.22)"
                    : "0 10px 30px rgba(56,189,248,0.22)",
                transition: "transform 0.14s, box-shadow 0.14s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  "translateY(-2px)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  isDarkMode
                    ? "0 0 48px rgba(125,211,252,0.45), 0 8px 28px rgba(0,0,0,0.28)"
                    : "0 16px 36px rgba(56,189,248,0.28)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  "translateY(0)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  isDarkMode
                    ? "0 0 36px rgba(125,211,252,0.28), 0 4px 18px rgba(0,0,0,0.22)"
                    : "0 10px 30px rgba(56,189,248,0.22)";
              }}
            >
              Explore question bank
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => navigate("/hard")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "13px 30px",
                borderRadius: 10,
                background: isDarkMode
                  ? "rgba(255,255,255,0.055)"
                  : "rgba(255,255,255,0.78)",
                color: isDarkMode
                  ? "rgba(255,255,255,0.78)"
                  : "rgba(15,23,42,0.82)",
                fontWeight: 500,
                fontSize: 15,
                border: isDarkMode
                  ? "1px solid rgba(255,255,255,0.11)"
                  : "1px solid rgba(15,23,42,0.12)",
                cursor: "pointer",
                fontFamily: "'Outfit', sans-serif",
                transition: "background 0.14s, border-color 0.14s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.95)";
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  isDarkMode ? "rgba(255,255,255,0.2)" : "rgba(15,23,42,0.18)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  isDarkMode ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.78)";
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  isDarkMode ? "rgba(255,255,255,0.11)" : "rgba(15,23,42,0.12)";
              }}
            >
              100 Hard Math Questions
            </button>
          </div>

          {/* Counter */}
          <div className="h-fade-5" style={{ marginBottom: 64 }}>
            <div
              style={{
              fontSize: "clamp(38px, 5.5vw, 64px)",
              fontFamily: "'Space Mono', monospace",
              fontWeight: 700,
              color: "hsl(var(--foreground))",
              letterSpacing: "-0.025em",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
              }}
            >
              {countValue.toLocaleString()}
            </div>
            <div
              style={{
                fontSize: 11,
                color: isDarkMode
                  ? "rgba(255,255,255,0.3)"
                  : "rgba(15,23,42,0.42)",
                marginTop: 9,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontWeight: 500,
              }}
            >
              practice questions
            </div>
          </div>
        </div>

        {/* Floating demo */}
        <div
          className="h-fade-6"
          style={{
            maxWidth: 700,
            margin: "0 auto",
            padding: "0 24px",
            position: "relative",
          }}
        >
          {/* Ambient glow behind the window */}
          <div
            style={{
              position: "absolute",
              inset: "-30px 20px",
              background: isDarkMode
                ? "radial-gradient(ellipse at 50% 40%, rgba(125,211,252,0.14) 0%, transparent 65%)"
                : "radial-gradient(ellipse at 50% 40%, rgba(56,189,248,0.18) 0%, transparent 65%)",
              pointerEvents: "none",
            }}
          />
          <div className="demo-float">
            <ProductDemo isDarkMode={isDarkMode} />
          </div>
        </div>

        {/* Fade gradient into next section */}
        <div
          style={{
            height: 90,
            marginTop: 48,
            background:
              "linear-gradient(to bottom, transparent, hsl(var(--background)))",
          }}
        />
      </section>

      {/* ── FEATURES ───────────────────────────────────────────────────── */}
      <section className="bg-background" style={{ padding: "72px 24px 0" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ marginBottom: 52 }}>
            <h2
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: "clamp(28px, 3.5vw, 42px)",
                fontWeight: 400,
                letterSpacing: "-0.02em",
                color: "hsl(var(--foreground))",
                marginBottom: 12,
              }}
            >
              Everything you need.
              <br />
              <em style={{ fontStyle: "italic", color: "hsl(201,100%,60%)" }}>Nothing you don't.</em>
            </h2>
            <p
              style={{
                fontSize: 15,
                color: isDarkMode ? "rgba(255,255,255,0.42)" : "rgba(15,23,42,0.55)",
                fontWeight: 300,
                maxWidth: 420,
              }}
            >
              All the tools for SAT prep, in one place. No account required to start.
            </p>
          </div>

          {/* Feature grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
              marginBottom: 80,
            }}
          >
            {[
              {
                Icon: BookOpen,
                title: "Question Bank",
                desc: `${questionBankTotal.toLocaleString()} SAT questions across Math and Reading & Writing. Filter by topic, skill, or test source.`,
                href: "/bank",
                cta: "Explore questions",
                accent: "hsl(201,100%,74%)",
              },
              {
                Icon: Target,
                title: "100 Hard Math Questions",
                desc: "A curated set of the hardest SAT math questions — shows precisely where your strategy breaks under pressure.",
                href: "/hard",
                cta: "Start the set",
                accent: "hsl(201,100%,74%)",
              },
              {
                Icon: GraduationCap,
                title: "Practice Modules",
                desc: "Full exam modules from real past tests. Practice a complete section in timed conditions.",
                href: "/modules",
                cta: "Browse modules",
                accent: "hsl(201,100%,74%)",
              },
              {
                Icon: SpellCheck,
                title: "Vocabulary",
                desc: "High-frequency SAT words with flashcards, match games, and spaced-repetition learn mode.",
                href: "/vocab",
                cta: "Study vocabulary",
                accent: "hsl(39,100%,57%)",
              },
              {
                Icon: Calculator,
                title: "Score Calculator",
                desc: "Convert raw section scores to a scaled SAT score estimate in seconds.",
                href: "/score-calculator",
                cta: "Calculate score",
                accent: "hsl(39,100%,57%)",
              },
              {
                Icon: BarChart3,
                title: "Progress Tracking",
                desc: "Per-domain accuracy, trends over time, and a clear view of which skills to focus on next.",
                href: user ? "/analysis" : "/signup",
                cta: user ? "View your stats" : "Create free account",
                accent: "hsl(39,100%,57%)",
              },
            ].map(({ Icon, title, desc, href, cta, accent }) => (
              <button
                key={title}
                onClick={() => navigate(href)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 0,
                  padding: "24px",
                  borderRadius: 16,
                  border: isDarkMode
                    ? "1px solid rgba(255,255,255,0.07)"
                    : "1px solid rgba(15,23,42,0.08)",
                  background: isDarkMode
                    ? "rgba(255,255,255,0.025)"
                    : "rgba(255,255,255,0.9)",
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "'Outfit', sans-serif",
                  transition: "border-color 0.18s, background 0.18s, transform 0.18s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = accent + "55";
                  (e.currentTarget as HTMLButtonElement).style.background = isDarkMode
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(255,255,255,1)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = isDarkMode
                    ? "rgba(255,255,255,0.07)"
                    : "rgba(15,23,42,0.08)";
                  (e.currentTarget as HTMLButtonElement).style.background = isDarkMode
                    ? "rgba(255,255,255,0.025)"
                    : "rgba(255,255,255,0.9)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: accent + "18",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={18} style={{ color: accent }} />
                </div>

                <h3
                  style={{
                    fontFamily: "'Instrument Serif', Georgia, serif",
                    fontSize: 20,
                    fontWeight: 400,
                    color: "hsl(var(--foreground))",
                    margin: "0 0 8px",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {title}
                </h3>
                <p
                  style={{
                    fontSize: 13.5,
                    color: isDarkMode ? "rgba(255,255,255,0.44)" : "rgba(15,23,42,0.58)",
                    lineHeight: 1.65,
                    margin: "0 0 20px",
                    fontWeight: 300,
                    flex: 1,
                  }}
                >
                  {desc}
                </p>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 13,
                    fontWeight: 500,
                    color: accent,
                  }}
                >
                  {cta}
                  <ArrowRight size={12} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA STRIP ──────────────────────────────────────────────────── */}
      <section style={{ padding: "0 24px 80px" }}>
        <div
          style={{
            maxWidth: 960,
            margin: "0 auto",
            borderRadius: 20,
            padding: "48px 40px",
            background: isDarkMode
              ? "linear-gradient(135deg, hsl(222,30%,13%) 0%, hsl(220,28%,10%) 100%)"
              : "linear-gradient(135deg, hsl(201,100%,96%) 0%, hsl(205,90%,92%) 100%)",
            border: isDarkMode
              ? "1px solid rgba(255,255,255,0.07)"
              : "1px solid rgba(56,189,248,0.2)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* glow */}
          <div
            style={{
              position: "absolute",
              right: "-5%",
              top: "-20%",
              width: 320,
              height: 320,
              borderRadius: "50%",
              background: isDarkMode
                ? "radial-gradient(ellipse, rgba(125,211,252,0.08) 0%, transparent 68%)"
                : "radial-gradient(ellipse, rgba(56,189,248,0.2) 0%, transparent 68%)",
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "relative" }}>
            <h2
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: "clamp(22px, 3vw, 32px)",
                fontWeight: 400,
                letterSpacing: "-0.02em",
                color: "hsl(var(--foreground))",
                margin: "0 0 10px",
              }}
            >
              {user ? "Keep going." : "Start for free today."}
            </h2>
            <p
              style={{
                fontSize: 14,
                color: isDarkMode ? "rgba(255,255,255,0.46)" : "rgba(15,23,42,0.62)",
                margin: "0 0 28px",
                fontWeight: 300,
                maxWidth: 360,
                lineHeight: 1.65,
              }}
            >
              {user
                ? "You have access to every tool on the platform — no upgrades, no paywalls."
                : "Create a free account to unlock progress tracking and personalized practice."}
            </p>
            <button
              onClick={() => navigate(user ? "/bank" : "/signup")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 26px",
                borderRadius: 10,
                background: "hsl(201,100%,74%)",
                color: "hsl(210,50%,12%)",
                fontWeight: 600,
                fontSize: 14,
                border: "none",
                cursor: "pointer",
                fontFamily: "'Outfit', sans-serif",
                boxShadow: isDarkMode
                  ? "0 0 28px rgba(125,211,252,0.22)"
                  : "0 8px 24px rgba(56,189,248,0.2)",
                transition: "transform 0.14s, box-shadow 0.14s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              }}
            >
              {user ? "Go to Question Bank" : "Get started free"}
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card mt-auto">
        <div className="container mx-auto px-4 py-5 text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <BrandLogo variant="mark" className="h-5 w-5" />
            <span>© 2026 1600.now</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Built for focused SAT prep.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
