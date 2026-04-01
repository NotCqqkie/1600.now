import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  ChevronDown,
  LogOut,
  Settings,
  User,
  Zap,
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

const ProductDemo = () => {
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
          background: "hsl(222, 30%, 13%)",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.07), 0 40px 100px rgba(0,0,0,0.55), 0 0 80px rgba(125,211,252,0.07)",
          opacity: isInvisible ? 0 : 1,
          transition: "opacity 0.5s ease",
        }}
      >
        {/* Browser chrome */}
        <div
          style={{
            background: "hsl(222, 30%, 9%)",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: 7,
            borderBottom: "1px solid rgba(255,255,255,0.05)",
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
              background: "hsl(222, 30%, 6%)",
              borderRadius: 6,
              padding: "4px 12px",
              fontSize: 10,
              color: "rgba(255,255,255,0.3)",
              fontFamily: "'Space Mono', monospace",
            }}
          >
            1600.now / bank / math / question / 472
          </div>
        </div>

        {/* Progress bar strip */}
        <div
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.04)",
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
                    i < 6 ? "hsl(201, 100%, 70%)" : "rgba(255,255,255,0.09)",
                }}
              />
            ))}
          </div>
          <span
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.28)",
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
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10,
              padding: "12px 14px",
              marginBottom: 12,
              fontSize: 11.5,
              color: "rgba(255,255,255,0.78)",
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
                      : "1px solid rgba(255,255,255,0.07)",
                    background: sel
                      ? "rgba(125,211,252,0.1)"
                      : "rgba(255,255,255,0.02)",
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
                        : "2px solid rgba(255,255,255,0.18)",
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
                      color: sel ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)",
                      lineHeight: 1.4,
                      transition: "color 0.3s",
                    }}
                  >
                    <strong
                      style={{
                        marginRight: 5,
                        color: sel
                          ? "hsl(201,100%,80%)"
                          : "rgba(255,255,255,0.28)",
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
                  : "rgba(255,255,255,0.07)",
                color: isAnswerSelected
                  ? "hsl(222,30%,9%)"
                  : "rgba(255,255,255,0.22)",
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
                  color: "rgba(255,255,255,0.58)",
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

// ─── Feature card ──────────────────────────────────────────────────────────

const FeatureCard = ({
  icon,
  title,
  desc,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  href: string;
}) => {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => navigate(href)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "28px 30px",
        borderRadius: 16,
        border: hovered
          ? "1px solid rgba(125,211,252,0.45)"
          : "1px solid hsl(var(--border))",
        background: "hsl(var(--card))",
        cursor: "pointer",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hovered ? "0 16px 40px rgba(0,0,0,0.1)" : "none",
        transition: "border-color 0.2s, transform 0.2s, box-shadow 0.2s",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "rgba(125,211,252,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "hsl(201,100%,50%)",
          marginBottom: 18,
        }}
      >
        {icon}
      </div>
      <h3
        style={{
          fontSize: 17,
          fontWeight: 600,
          marginBottom: 8,
          color: "hsl(var(--foreground))",
          fontFamily: "'Outfit', sans-serif",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 14,
          color: "hsl(var(--muted-foreground))",
          lineHeight: 1.65,
          margin: 0,
          fontFamily: "'Outfit', sans-serif",
        }}
      >
        {desc}
      </p>
    </div>
  );
};

// ─── Home page ─────────────────────────────────────────────────────────────

const Home = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [questionBankTotal, setQuestionBankTotal] = useState(DEFAULT_QUESTION_BANK_TOTAL);
  const [countValue, setCountValue] = useState(0);
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
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="container mx-auto h-16 px-4 flex items-center justify-between gap-3">
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

          <nav className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1 text-sm text-muted-foreground">
            <Link
              to="/bank"
              className="rounded-md px-3 py-1.5 hover:bg-muted hover:text-foreground transition-colors"
            >
              Question Bank
            </Link>
            <Link
              to="/hard/1"
              className="rounded-md px-3 py-1.5 hover:bg-muted hover:text-foreground transition-colors"
            >
              100 Hard Questions
            </Link>
            <Link
              to="/score-calculator"
              className="rounded-md px-3 py-1.5 hover:bg-muted hover:text-foreground transition-colors"
            >
              Score Calculator
            </Link>
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
                  <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">
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
            background:
              "radial-gradient(ellipse, rgba(125,211,252,0.11) 0%, transparent 68%)",
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
            background:
              "radial-gradient(ellipse, rgba(251,191,36,0.055) 0%, transparent 68%)",
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
          {/* Badge */}
          <div className="h-fade-1" style={{ marginBottom: 28 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 16px",
                borderRadius: 100,
                background: "rgba(125,211,252,0.09)",
                border: "1px solid rgba(125,211,252,0.22)",
                fontSize: 12,
                color: "hsl(201,100%,78%)",
                fontWeight: 500,
                letterSpacing: "0.03em",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "hsl(201,100%,72%)",
                  display: "inline-block",
                  boxShadow: "0 0 8px hsl(201,100%,72%)",
                }}
              />
              Free · No account required to start
            </span>
          </div>

          {/* Headline */}
          <h1
            className="h-fade-2"
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: "clamp(54px, 9.5vw, 112px)",
              lineHeight: 0.94,
              color: "white",
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
              color: "rgba(255,255,255,0.46)",
              maxWidth: 460,
              margin: "0 auto 38px",
              lineHeight: 1.65,
              fontWeight: 300,
            }}
          >
            Accurate SAT practice built from real past tests.
            <br />
            No fluff. No paywalls.
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
                color: "hsl(222,40%,8%)",
                fontWeight: 600,
                fontSize: 15,
                border: "none",
                cursor: "pointer",
                fontFamily: "'Outfit', sans-serif",
                boxShadow:
                  "0 0 36px rgba(125,211,252,0.28), 0 4px 18px rgba(0,0,0,0.22)",
                transition: "transform 0.14s, box-shadow 0.14s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  "translateY(-2px)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 0 48px rgba(125,211,252,0.45), 0 8px 28px rgba(0,0,0,0.28)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  "translateY(0)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 0 36px rgba(125,211,252,0.28), 0 4px 18px rgba(0,0,0,0.22)";
              }}
            >
              Explore question bank
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => navigate("/hard/1")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "13px 30px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.055)",
                color: "rgba(255,255,255,0.78)",
                fontWeight: 500,
                fontSize: 15,
                border: "1px solid rgba(255,255,255,0.11)",
                cursor: "pointer",
                fontFamily: "'Outfit', sans-serif",
                transition: "background 0.14s, border-color 0.14s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(255,255,255,0.1)";
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "rgba(255,255,255,0.2)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(255,255,255,0.055)";
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "rgba(255,255,255,0.11)";
              }}
            >
              100 Hard Questions
            </button>
          </div>

          {/* Counter */}
          <div className="h-fade-5" style={{ marginBottom: 64 }}>
            <div
              style={{
                fontSize: "clamp(38px, 5.5vw, 64px)",
                fontFamily: "'Space Mono', monospace",
                fontWeight: 700,
                color: "white",
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
                color: "rgba(255,255,255,0.3)",
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
              background:
                "radial-gradient(ellipse at 50% 40%, rgba(125,211,252,0.14) 0%, transparent 65%)",
              pointerEvents: "none",
            }}
          />
          <div className="demo-float">
            <ProductDemo />
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
      <section
        className="bg-background"
        style={{ padding: "56px 24px 88px" }}
      >
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <p
            style={{
              textAlign: "center",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "hsl(var(--muted-foreground))",
              marginBottom: 10,
            }}
          >
            Everything you need
          </p>
          <h2
            style={{
              textAlign: "center",
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: "clamp(30px, 4vw, 44px)",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              marginBottom: 52,
              color: "hsl(var(--foreground))",
            }}
          >
            Built for focused practice
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: 20,
            }}
          >
            <FeatureCard
              icon={<BookOpen size={20} />}
              title="Question Bank"
              desc={`${questionBankTotal.toLocaleString()} SAT-style questions across math and reading. Filter by topic, skill, or difficulty and drill exactly what you need.`}
              href="/bank"
            />
            <FeatureCard
              icon={<Zap size={20} />}
              title="100 Hard Questions"
              desc="A curated high-difficulty set designed to stress-test your strategy and build real confidence before test day."
              href="/hard/1"
            />
            <FeatureCard
              icon={<BarChart3 size={20} />}
              title="Performance Analytics"
              desc="Track your progress over time. Spot weak areas and focus your study where it actually moves the needle."
              href={user ? "/analysis" : "/signup"}
            />
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card mt-auto">
        <div className="container mx-auto px-4 py-4 text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
          <p>© 2026 1600.now</p>
          <span>Built for focused SAT prep.</span>
        </div>
      </footer>
    </div>
  );
};

export default Home;
