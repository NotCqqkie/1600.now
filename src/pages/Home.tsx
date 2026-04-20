import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { BrandLogo } from "@/components/BrandLogo";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bookmark,
  ChevronDown,
  ChevronUp,
  LogOut,
  Settings,
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
import { Badge } from "@/components/ui/badge";
import { MultipleChoiceQuestion } from "@/components/MultipleChoiceQuestion";
import { InlineDesmos } from "@/components/InlineDesmos";
import { useThemeMode } from "@/hooks/useThemeMode";

const DEFAULT_QUESTION_BANK_TOTAL = 5880;

// ─── Demo state machine ────────────────────────────────────────────────────

type Phase =
  | "reading"
  | "movingToChoice"
  | "clickedChoice"
  | "movingToCheck"
  | "clickedCheck"
  | "explained"
  | "fadingOut";

const PHASES: { phase: Phase; duration: number }[] = [
  { phase: "reading", duration: 1600 },
  { phase: "movingToChoice", duration: 900 },
  { phase: "clickedChoice", duration: 560 },
  { phase: "movingToCheck", duration: 780 },
  { phase: "clickedCheck", duration: 460 },
  { phase: "explained", duration: 3400 },
  { phase: "fadingOut", duration: 600 },
];

const DEMO_Q = {
  text: "A quadratic function f is defined by f(x) = −2(x − 3)² + 8. What is the maximum value of f(x)?",
  choices: [
    { id: "A", text: "−2" },
    { id: "B", text: "3" },
    { id: "C", text: "8" },
    { id: "D", text: "14" },
  ],
  correctId: "C",
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
  const cardRef = useRef<HTMLDivElement>(null);
  const mcqRef = useRef<HTMLDivElement>(null);
  const [rowPos, setRowPos] = useState<{ rowTop: number; checkX: number; choiceX: number } | null>(null);

  useEffect(() => {
    const { duration } = PHASES[phaseIdx];
    const t = setTimeout(
      () => setPhaseIdx((i) => (i + 1) % PHASES.length),
      duration
    );
    return () => clearTimeout(t);
  }, [phaseIdx]);

  // Measure the actual correct-choice row & check-button column for accurate cursor placement
  useEffect(() => {
    const measure = () => {
      const card = cardRef.current;
      const mcq = mcqRef.current;
      if (!card || !mcq) return;
      const correctIdx = DEMO_Q.choices.findIndex((c) => c.id === DEMO_Q.correctId);
      const targetRow = mcq.firstElementChild?.children[correctIdx] as HTMLElement | undefined;
      if (!targetRow) return;
      const cardRect = card.getBoundingClientRect();
      const rowRect = targetRow.getBoundingClientRect();
      setRowPos({
        rowTop: rowRect.top - cardRect.top + rowRect.height / 2,
        choiceX: 36,
        checkX: rowRect.right - cardRect.left - 48,
      });
    };
    measure();
    const t = setTimeout(measure, 60);
    window.addEventListener("resize", measure);
    return () => { clearTimeout(t); window.removeEventListener("resize", measure); };
  }, [phaseIdx]);

  const { phase } = PHASES[phaseIdx];
  const isAnswerSelected = ["clickedChoice", "movingToCheck", "clickedCheck", "explained"].includes(phase);
  const isChecked = ["clickedCheck", "explained"].includes(phase);
  const showExplanation = phase === "explained";
  const isInvisible = phase === "fadingOut";
  const isCursorClicking = phase === "clickedChoice" || phase === "clickedCheck";

  const chromeBorder = isDarkMode
    ? "1px solid rgba(255,255,255,0.05)"
    : "1px solid rgba(15,23,42,0.08)";
  const progressInactive = isDarkMode ? "rgba(255,255,255,0.09)" : "rgba(15,23,42,0.09)";
  const progressText = isDarkMode ? "rgba(255,255,255,0.28)" : "rgba(15,23,42,0.38)";
  const windowShadow = isDarkMode
    ? "0 0 0 1px rgba(255,255,255,0.07), 0 40px 100px rgba(0,0,0,0.55), 0 0 80px rgba(125,211,252,0.07)"
    : "0 0 0 1px rgba(15,23,42,0.08), 0 24px 64px rgba(15,23,42,0.12), 0 0 48px rgba(56,189,248,0.1)";

  // Cursor position anchored to the MEASURED row/column of the correct answer
  const cPos = ((): { left: string; top: string } => {
    const rowTop = rowPos ? `${rowPos.rowTop}px` : "50%";
    const checkLeft = rowPos ? `${rowPos.checkX}px` : "88%";
    const choiceLeft = rowPos ? `${rowPos.choiceX}px` : "10%";
    switch (phase) {
      case "reading":        return { left: "50%", top: "80px" };
      case "movingToChoice": return { left: choiceLeft, top: rowTop };
      case "clickedChoice":  return { left: choiceLeft, top: rowTop };
      case "movingToCheck":  return { left: checkLeft,  top: rowTop };
      case "clickedCheck":   return { left: checkLeft,  top: rowTop };
      case "explained":      return { left: "50%", top: rowTop };
      case "fadingOut":      return { left: "50%", top: "80px" };
    }
  })();

  const selectedAnswer = isAnswerSelected ? DEMO_Q.correctId : "";
  const checkedAnswers = isChecked ? { [DEMO_Q.correctId]: true } : {};

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      {/* Window */}
      <div
        ref={cardRef}
        className="bg-card"
        style={{
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: windowShadow,
          opacity: isInvisible ? 0 : 1,
          transition: "opacity 0.5s ease",
        }}
      >
        {/* Progress strip */}
        <div
          style={{
            borderBottom: chromeBorder,
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
                  width: 22,
                  height: 4,
                  borderRadius: 2,
                  background: i < 6 ? "hsl(201, 100%, 70%)" : progressInactive,
                }}
              />
            ))}
          </div>
          <span
            style={{
              fontSize: 11,
              color: progressText,
              fontFamily: "'Space Mono', monospace",
            }}
          >
            Q 47 / 100
          </span>
        </div>

        {/* Real question header — mirrors /question page */}
        <div className="px-5 pt-4">
          <div className="bg-slate-100 dark:bg-slate-800 flex items-center justify-between rounded-md overflow-hidden h-10 shadow-sm border border-slate-200 dark:border-slate-700 px-1">
            <div className="flex items-center h-full gap-2">
              <div className="bg-white dark:bg-black text-black dark:text-white h-full min-w-[3.5rem] px-2 flex items-center justify-center font-bold text-base tabular-nums border-r border-slate-200 dark:border-slate-700 mr-1 -ml-1">
                47
              </div>
              <div className="h-7 rounded px-3 gap-2 font-normal text-muted-foreground inline-flex items-center">
                <Bookmark className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Mark for Review</span>
              </div>
            </div>
          </div>
        </div>

        {/* Body — uses the REAL MultipleChoiceQuestion */}
        <div className="px-5 pt-4 pb-5">
          <div className="mb-5 text-[15px] leading-relaxed text-foreground">
            {DEMO_Q.text}
          </div>

          <div ref={mcqRef} className="pointer-events-none">
            <MultipleChoiceQuestion
              choices={DEMO_Q.choices}
              selectedAnswer={selectedAnswer}
              checkedAnswers={checkedAnswers}
              onCheck={() => {}}
              questionId="hero-demo"
              subject="math"
            />
          </div>

          {/* Inline success banner — reserves space so page height doesn't jump */}
          <div
            style={{
              marginTop: 14,
              minHeight: 88,
              opacity: showExplanation ? 1 : 0,
              transition: "opacity 0.4s ease",
            }}
          >
            <div className="rounded-xl border border-[#2E7D32]/40 bg-[#C8E6C9]/20 dark:border-[#2E7D32]/50 dark:bg-[#1B5E20]/20 px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-5 h-5 rounded-full bg-[#1B5E20] dark:bg-[#2E7D32] flex items-center justify-center text-white text-xs font-bold">
                  ✓
                </div>
                <span className="text-sm font-semibold text-[#1B5E20] dark:text-[#4ade80]">
                  Correct — Choice {DEMO_Q.correctId}
                </span>
              </div>
              <p className="text-[13px] text-muted-foreground leading-snug m-0 pl-7">
                Vertex form −2(x − 3)² + 8 opens downward, so the vertex (3, 8)
                is a maximum. Therefore f(x)<sub>max</sub> = 8.
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

// ─── Auto-cycling explanation demo ─────────────────────────────────────────

const EXPLANATION_STEPS: {
  title: string;
  body: string;
  desmos?: string[];
}[] = [
  {
    title: "Set up the equation",
    body: "We have f(x) = −2(x − 3)² + 8 in vertex form. The vertex of the parabola is at (3, 8).",
  },
  {
    title: "Locate the maximum",
    body: "The leading coefficient −2 is negative, so the parabola opens downward. The vertex is therefore a maximum point.",
  },
  {
    title: "Interpret the graph",
    body: "Graphing confirms the peak: the curve tops out at y = 8, making the maximum value of f(x) equal to 8.",
    desmos: ["y=-2(x-3)^2+8", "(3,8)"],
  },
];

const AnimatedExplanation = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [animKey, setAnimKey] = useState(0);
  const [paused, setPaused] = useState(false);

  const totalSteps = EXPLANATION_STEPS.length;

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setDirection(1);
      setCurrentStep((s) => (s + 1) % totalSteps);
      setAnimKey((k) => k + 1);
    }, 3600);
    return () => clearInterval(t);
  }, [paused, totalSteps]);

  const goTo = (target: number) => {
    setPaused(true);
    setDirection(target > currentStep ? 1 : -1);
    setCurrentStep(Math.max(0, Math.min(totalSteps - 1, target)));
    setAnimKey((k) => k + 1);
  };

  const step = EXPLANATION_STEPS[currentStep];
  const isLast = currentStep === totalSteps - 1;

  return (
    <div
      className="rounded-[14px] overflow-hidden border border-border bg-card flex flex-col"
      style={{
        height: 440,
        boxShadow: isDarkMode
          ? "0 20px 60px rgba(0,0,0,0.5)"
          : "0 20px 50px rgba(15,23,42,0.1)",
      }}
    >
      {/* Header — identical to StepByStepExplanation */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-background/95 backdrop-blur-sm shrink-0">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          Answer: C
        </Badge>
        <div className="flex gap-1.5">
          {EXPLANATION_STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-300 ${
                i === currentStep
                  ? "w-3 h-1.5 bg-primary"
                  : "w-1.5 h-1.5 bg-primary/40 hover:bg-primary/70 cursor-pointer"
              }`}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Step content — identical to StepByStepExplanation with scroll-between-steps animation */}
      <div className="flex-1 overflow-hidden relative">
        <div
          key={animKey}
          className="absolute inset-0 overflow-y-auto px-3 py-4 explanation-step-slide"
          style={{ "--step-dir": direction } as React.CSSProperties}
        >
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0 mt-0.5">
                {currentStep + 1}
              </div>
              <div>
                <h3 className="font-semibold text-base leading-snug">
                  {step.title}
                </h3>
                <span className="text-xs text-muted-foreground">
                  Step {currentStep + 1} of {totalSteps}
                </span>
              </div>
            </div>
            <div className="text-[15px] leading-snug pl-9 explanation-content text-foreground/90">
              {step.body}
            </div>
            {step.desmos && (
              <div className="ml-9 mt-2">
                <InlineDesmos expressions={step.desmos} height={220} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation footer — identical to StepByStepExplanation */}
      <div className="px-3 py-2 border-t border-border/50 shrink-0 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => goTo(currentStep - 1)}
          disabled={currentStep === 0}
          className="flex-1 gap-1"
        >
          <ChevronUp className="w-4 h-4" />
          Back
        </Button>
        {isLast ? (
          <span className="flex-1 text-center text-xs text-muted-foreground">
            End of explanation
          </span>
        ) : (
          <Button
            size="sm"
            onClick={() => goTo(currentStep + 1)}
            className="flex-1 gap-1"
          >
            Next Step
            <ChevronDown className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

// ─── Scroll-driven question interface ──────────────────────────────────────

const SCROLL_DEMO_Q = {
  text: "In a linear function f, f(2) = 7 and f(5) = 19. What is the value of f(9)?",
  choices: [
    { id: "A", text: "27" },
    { id: "B", text: "31" },
    { id: "C", text: "35" },
    { id: "D", text: "39" },
  ],
  correctId: "C",
  explanation:
    "Slope = (19 − 7)/(5 − 2) = 4. Using f(x) = 4x + b with f(2) = 7 gives b = −1, so f(9) = 4(9) − 1 = 35.",
};

const ScrollQuestionDemo = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const raw = total > 0 ? -rect.top / total : 0;
      setProgress(Math.max(0, Math.min(1, raw)));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const answerSelected = progress > 0.3;
  const checked = progress > 0.55;
  const explained = progress > 0.72;

  const cardRef = useRef<HTMLDivElement>(null);
  const mcqRef = useRef<HTMLDivElement>(null);
  const [rowPos, setRowPos] = useState<{ rowTop: number; checkX: number; choiceX: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const card = cardRef.current;
      const mcq = mcqRef.current;
      if (!card || !mcq) return;
      const correctIdx = SCROLL_DEMO_Q.choices.findIndex(
        (c) => c.id === SCROLL_DEMO_Q.correctId,
      );
      const targetRow = mcq.firstElementChild?.children[correctIdx] as HTMLElement | undefined;
      if (!targetRow) return;
      const cardRect = card.getBoundingClientRect();
      const rowRect = targetRow.getBoundingClientRect();
      setRowPos({
        rowTop: rowRect.top - cardRect.top + rowRect.height / 2,
        choiceX: 36,
        checkX: rowRect.right - cardRect.left - 48,
      });
    };
    measure();
    const t = setTimeout(measure, 60);
    window.addEventListener("resize", measure);
    return () => { clearTimeout(t); window.removeEventListener("resize", measure); };
  }, []);

  // Cursor anchored to measured row for the correct-answer choice
  const cursor = ((): { left: string; top: string } => {
    const rowTop = rowPos ? `${rowPos.rowTop}px` : "50%";
    const checkLeft = rowPos ? `${rowPos.checkX}px` : "88%";
    const choiceLeft = rowPos ? `${rowPos.choiceX}px` : "10%";
    if (progress < 0.28) return { left: "50%", top: "60px" };
    if (progress < 0.55) return { left: choiceLeft, top: rowTop };
    if (progress < 0.72) return { left: checkLeft,  top: rowTop };
    return { left: "50%", top: rowTop };
  })();
  const cursorClicking =
    (progress > 0.26 && progress < 0.32) || (progress > 0.53 && progress < 0.58);

  const selectedAnswer = answerSelected ? SCROLL_DEMO_Q.correctId : "";
  const checkedAnswers = checked ? { [SCROLL_DEMO_Q.correctId]: true } : {};

  return (
    <section
      ref={sectionRef}
      style={{ position: "relative", height: "240vh" }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            width: "100%",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)",
            gap: 64,
            alignItems: "center",
          }}
        >
          {/* Left: big text */}
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "hsl(201,100%,60%)",
                fontWeight: 600,
                marginBottom: 18,
              }}
            >
              — Scroll to play
            </div>
            <h2
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: "clamp(44px, 6vw, 76px)",
                lineHeight: 0.98,
                letterSpacing: "-0.025em",
                color: "hsl(var(--foreground))",
                margin: "0 0 22px",
              }}
            >
              Real questions.
              <br />
              <em style={{ fontStyle: "italic", color: "hsl(201,100%,70%)" }}>
                Real feedback.
              </em>
            </h2>
            <p
              style={{
                fontSize: 16,
                lineHeight: 1.65,
                fontWeight: 300,
                color: isDarkMode
                  ? "rgba(255,255,255,0.55)"
                  : "rgba(15,23,42,0.62)",
                maxWidth: 420,
                margin: 0,
              }}
            >
              Every question is answer-checked with a full written
              explanation — tailored to the exact choice you made.
            </p>

            {/* Progress indicator */}
            <div
              style={{
                marginTop: 34,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  flex: 1,
                  maxWidth: 200,
                  height: 3,
                  borderRadius: 2,
                  background: isDarkMode
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(15,23,42,0.1)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${progress * 100}%`,
                    height: "100%",
                    background: "hsl(201,100%,70%)",
                    transition: "width 0.08s linear",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "'Space Mono', monospace",
                  color: isDarkMode
                    ? "rgba(255,255,255,0.4)"
                    : "rgba(15,23,42,0.5)",
                }}
              >
                {explained
                  ? "solved"
                  : checked
                  ? "checking"
                  : answerSelected
                  ? "answering"
                  : "reading"}
              </span>
            </div>
          </div>

          {/* Right: demo window */}
          <div style={{ position: "relative" }}>
            <div
              style={{
                position: "absolute",
                inset: "-30px",
                background: isDarkMode
                  ? "radial-gradient(ellipse at 50% 50%, rgba(125,211,252,0.12) 0%, transparent 65%)"
                  : "radial-gradient(ellipse at 50% 50%, rgba(56,189,248,0.15) 0%, transparent 65%)",
                pointerEvents: "none",
              }}
            />
            <div
              ref={cardRef}
              className="relative bg-card"
              style={{
                borderRadius: 14,
                overflow: "hidden",
                boxShadow: isDarkMode
                  ? "0 0 0 1px rgba(255,255,255,0.07), 0 40px 100px rgba(0,0,0,0.55)"
                  : "0 0 0 1px rgba(15,23,42,0.08), 0 24px 64px rgba(15,23,42,0.12)",
              }}
            >
              {/* Question header, mirrors /question page */}
              <div className="px-5 pt-4">
                <div className="bg-slate-100 dark:bg-slate-800 flex items-center justify-between rounded-md overflow-hidden h-10 shadow-sm border border-slate-200 dark:border-slate-700 px-1">
                  <div className="flex items-center h-full gap-2">
                    <div className="bg-white dark:bg-black text-black dark:text-white h-full min-w-[3.5rem] px-2 flex items-center justify-center font-bold text-base tabular-nums border-r border-slate-200 dark:border-slate-700 mr-1 -ml-1">
                      284
                    </div>
                    <div className="h-7 rounded px-3 gap-2 font-normal text-muted-foreground inline-flex items-center">
                      <Bookmark className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">Mark for Review</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-5 pt-4 pb-5">
                <div className="mb-5 text-[15px] leading-relaxed text-foreground">
                  {SCROLL_DEMO_Q.text}
                </div>

                <div ref={mcqRef} className="pointer-events-none">
                  <MultipleChoiceQuestion
                    choices={SCROLL_DEMO_Q.choices}
                    selectedAnswer={selectedAnswer}
                    checkedAnswers={checkedAnswers}
                    onCheck={() => {}}
                    questionId="scroll-demo"
                    subject="math"
                  />
                </div>

                <div
                  style={{
                    marginTop: 14,
                    minHeight: 96,
                    opacity: explained ? 1 : 0,
                    transition: "opacity 0.45s ease",
                  }}
                >
                  <div className="rounded-xl border border-[#2E7D32]/40 bg-[#C8E6C9]/20 dark:border-[#2E7D32]/50 dark:bg-[#1B5E20]/20 px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded-full bg-[#1B5E20] dark:bg-[#2E7D32] flex items-center justify-center text-white text-xs font-bold">
                        ✓
                      </div>
                      <span className="text-sm font-semibold text-[#1B5E20] dark:text-[#4ade80]">
                        Correct — Choice {SCROLL_DEMO_Q.correctId}
                      </span>
                    </div>
                    <p className="text-[13px] text-muted-foreground leading-snug m-0 pl-7">
                      {SCROLL_DEMO_Q.explanation}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Cursor overlay */}
            <div
              style={{
                position: "absolute",
                left: cursor.left,
                top: cursor.top,
                transition:
                  "left 0.5s cubic-bezier(0.25,0.46,0.45,0.94), top 0.5s cubic-bezier(0.25,0.46,0.45,0.94)",
                pointerEvents: "none",
                zIndex: 20,
                filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))",
              }}
            >
              <CursorDot clicking={cursorClicking} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Animated filter bank demo ─────────────────────────────────────────────

type DifficultyPill = "easy" | "medium" | "hard";
type SubjectPill = "math" | "reading";

const AnimatedFilterBank = ({
  isDarkMode,
  totalQuestions,
  mathCount,
  readingCount,
}: {
  isDarkMode: boolean;
  totalQuestions: number;
  mathCount: number;
  readingCount: number;
}) => {
  const [difficulties, setDifficulties] = useState<DifficultyPill[]>([]);
  const [subjects, setSubjects] = useState<SubjectPill[]>([]);

  const toggle = <T extends string>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  // Count reacts to subject (exact) and difficulty (proportional — SAT bank splits ~roughly even)
  const matchingCount = useMemo(() => {
    const subjectTotal =
      subjects.length === 0
        ? totalQuestions
        : subjects.reduce(
            (acc, s) => acc + (s === "math" ? mathCount : readingCount),
            0,
          );
    const difficultyFraction =
      difficulties.length === 0 ? 1 : difficulties.length / 3;
    return Math.round(subjectTotal * difficultyFraction);
  }, [subjects, difficulties, totalQuestions, mathCount, readingCount]);

  return (
    <div
      className="rounded-[14px] overflow-hidden border border-border bg-card"
      style={{
        boxShadow: isDarkMode
          ? "0 20px 60px rgba(0,0,0,0.5)"
          : "0 20px 50px rgba(15,23,42,0.1)",
      }}
    >
      <div className="p-5 sm:p-6 space-y-5">
        <FilterPillRow
          icon={<BarChart3 className="h-4 w-4" />}
          label="Difficulty"
          options={[
            { value: "easy", label: "Easy" },
            { value: "medium", label: "Medium" },
            { value: "hard", label: "Hard" },
          ]}
          selected={difficulties}
          onToggle={(v) => setDifficulties((d) => toggle(d, v as DifficultyPill))}
        />

        <FilterPillRow
          icon={<BookOpen className="h-4 w-4" />}
          label="Subject"
          options={[
            { value: "math", label: "Math" },
            { value: "reading", label: "Reading & Writing" },
          ]}
          selected={subjects}
          onToggle={(v) => setSubjects((s) => toggle(s, v as SubjectPill))}
        />

        <div className="pt-4 border-t border-border flex items-baseline gap-2">
          <span className="font-mono text-3xl font-bold text-primary transition-colors tabular-nums">
            {matchingCount.toLocaleString()}
          </span>
          <span className="text-[11px] text-muted-foreground tracking-widest uppercase">
            matching questions
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Rotating skill-count orbit ────────────────────────────────────────────

const SKILL_ORBIT: { label: string; count: number }[] = [
  { label: "Linear functions", count: 612 },
  { label: "Nonlinear functions", count: 548 },
  { label: "Equivalent expressions", count: 421 },
  { label: "Ratios & rates", count: 376 },
  { label: "Percentages", count: 289 },
  { label: "One-variable data", count: 312 },
  { label: "Probability", count: 244 },
  { label: "Area & volume", count: 268 },
  { label: "Right triangles", count: 231 },
  { label: "Circles", count: 198 },
  { label: "Words in Context", count: 487 },
  { label: "Transitions", count: 403 },
  { label: "Inferences", count: 356 },
  { label: "Boundaries", count: 298 },
  { label: "Form & Structure", count: 342 },
  { label: "Central Ideas", count: 274 },
];

const SkillOrbit = ({
  visible,
  totalQuestions,
  isDarkMode,
}: {
  visible: boolean;
  totalQuestions: number;
  isDarkMode: boolean;
}) => {
  const [rotation, setRotation] = useState(0);
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setRotation((r) => (r + dt * 0.012) % 360); // ~4.3°/s, gentle drift
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const radius = 200;
  const chips = SKILL_ORBIT;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.88)",
        transition: "opacity 0.55s ease, transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)",
        zIndex: 5,
      }}
    >
      {/* Faint guide ring */}
      <div
        style={{
          position: "absolute",
          width: radius * 2 + 40,
          height: radius * 2 + 40,
          borderRadius: "50%",
          border: isDarkMode
            ? "1px dashed rgba(125,211,252,0.18)"
            : "1px dashed rgba(56,189,248,0.22)",
        }}
      />
      <div
        style={{
          position: "relative",
          width: radius * 2,
          height: radius * 2,
          transform: `rotate(${rotation}deg)`,
        }}
      >
        {chips.map((chip, i) => {
          const angle = (i / chips.length) * 2 * Math.PI;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          return (
            <div
              key={chip.label}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${-rotation}deg)`,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 999,
                background: isDarkMode
                  ? "rgba(20, 30, 48, 0.88)"
                  : "rgba(255,255,255,0.95)",
                border: isDarkMode
                  ? "1px solid rgba(125,211,252,0.25)"
                  : "1px solid rgba(56,189,248,0.3)",
                boxShadow: isDarkMode
                  ? "0 4px 14px rgba(0,0,0,0.4)"
                  : "0 4px 14px rgba(15,23,42,0.08)",
                whiteSpace: "nowrap",
                fontSize: 12,
                fontWeight: 500,
                color: "hsl(var(--foreground))",
              }}
            >
              <span>{chip.label}</span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 36,
                  height: 22,
                  padding: "0 8px",
                  borderRadius: 999,
                  background: "hsl(201,100%,70%)",
                  color: "hsl(210,50%,12%)",
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 11,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {chip.count}
              </span>
            </div>
          );
        })}
      </div>
      {/* Center total */}
      <div
        style={{
          position: "absolute",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          padding: "14px 22px",
          borderRadius: 16,
          background: isDarkMode
            ? "rgba(10,18,32,0.9)"
            : "rgba(255,255,255,0.95)",
          border: isDarkMode
            ? "1px solid rgba(125,211,252,0.3)"
            : "1px solid rgba(56,189,248,0.35)",
          boxShadow: isDarkMode
            ? "0 10px 40px rgba(0,0,0,0.5)"
            : "0 10px 40px rgba(15,23,42,0.1)",
        }}
      >
        <span
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 30,
            fontWeight: 700,
            color: "hsl(201,100%,70%)",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {totalQuestions.toLocaleString()}
        </span>
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: isDarkMode
              ? "rgba(255,255,255,0.5)"
              : "rgba(15,23,42,0.55)",
          }}
        >
          tagged questions
        </span>
      </div>
    </div>
  );
};

// ─── Scroll-driven filter feature section ─────────────────────────────────

const FilterFeatureSection = ({
  isDarkMode,
  totalQuestions,
  mathCount,
  readingCount,
}: {
  isDarkMode: boolean;
  totalQuestions: number;
  mathCount: number;
  readingCount: number;
}) => {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const raw = total > 0 ? -rect.top / total : 0;
      setProgress(Math.max(0, Math.min(1, raw)));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // Orbit is visible during the middle of the scroll, then fades out
  const orbitVisible = progress > 0.28 && progress < 0.72;

  return (
    <div ref={sectionRef} style={{ position: "relative", height: "260vh" }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        {/* Rotating skill orbit overlay */}
        <SkillOrbit
          visible={orbitVisible}
          totalQuestions={totalQuestions}
          isDarkMode={isDarkMode}
        />

        {/* Feature content (fades when orbit is active) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)",
            gap: 64,
            alignItems: "center",
            padding: "0 24px",
            maxWidth: 1200,
            margin: "0 auto",
            width: "100%",
            opacity: orbitVisible ? 0.12 : 1,
            transition: "opacity 0.45s ease",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "hsl(201,100%,60%)",
                fontWeight: 600,
                marginBottom: 18,
              }}
            >
              — {totalQuestions.toLocaleString()} questions
            </div>
            <h2
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: "clamp(40px, 5.5vw, 68px)",
                lineHeight: 0.98,
                letterSpacing: "-0.025em",
                color: "hsl(var(--foreground))",
                margin: "0 0 22px",
              }}
            >
              Every question,
              <br />
              <em style={{ fontStyle: "italic", color: "hsl(201,100%,70%)" }}>
                instantly filterable.
              </em>
            </h2>
            <p
              style={{
                fontSize: 16,
                lineHeight: 1.65,
                fontWeight: 300,
                color: isDarkMode
                  ? "rgba(255,255,255,0.55)"
                  : "rgba(15,23,42,0.62)",
                maxWidth: 420,
                margin: "0 0 28px",
              }}
            >
              Slice the bank by domain, skill, or difficulty. Numbers update as you tap — nothing to configure, nothing to wait for.
            </p>
            <button
              onClick={() => navigate("/bank")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 14,
                fontWeight: 600,
                color: "hsl(201,100%,70%)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Open the question bank
              <ArrowRight size={14} />
            </button>
          </div>
          <div style={{ position: "relative" }}>
            <div
              style={{
                position: "absolute",
                inset: "-30px",
                background: isDarkMode
                  ? "radial-gradient(ellipse at 50% 50%, rgba(125,211,252,0.1) 0%, transparent 65%)"
                  : "radial-gradient(ellipse at 50% 50%, rgba(56,189,248,0.13) 0%, transparent 65%)",
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "relative" }}>
              <AnimatedFilterBank
                isDarkMode={isDarkMode}
                totalQuestions={totalQuestions}
                mathCount={mathCount}
                readingCount={readingCount}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FilterPillRow = ({
  icon,
  label,
  options,
  selected,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isSelected = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onToggle(opt.value)}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted text-foreground"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  </div>
);

// ─── Animated accuracy sparkline ───────────────────────────────────────────

const AnimatedAccuracyChart = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const VISIBLE_POINTS = 14;
  const [series, setSeries] = useState<number[]>(() => {
    // Gradually climbing baseline with some noise
    const out: number[] = [];
    let v = 58;
    for (let i = 0; i < VISIBLE_POINTS; i++) {
      v += (Math.random() - 0.35) * 3.2;
      v = Math.max(52, Math.min(94, v));
      out.push(v);
    }
    return out;
  });

  // Continuously stream new data in (no reset — graph keeps marching forward)
  useEffect(() => {
    const id = setInterval(() => {
      setSeries((prev) => {
        const last = prev[prev.length - 1];
        const drift = 0.35; // gentle upward bias
        let next = last + (Math.random() - 0.5 + drift * 0.2) * 4.2;
        next = Math.max(52, Math.min(94, next));
        return [...prev.slice(1), next];
      });
    }, 900);
    return () => clearInterval(id);
  }, []);

  const width = 420;
  const height = 160;
  const step = width / (series.length - 1);
  const toY = (v: number) => height - ((v - 50) / 45) * height + 6;
  const path = series
    .map((y, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)},${toY(y).toFixed(2)}`)
    .join(" ");

  const bg = isDarkMode ? "hsl(222,30%,13%)" : "hsl(0,0%,100%)";
  const border = isDarkMode
    ? "1px solid rgba(255,255,255,0.07)"
    : "1px solid rgba(15,23,42,0.08)";
  const mutedText = isDarkMode
    ? "rgba(255,255,255,0.4)"
    : "rgba(15,23,42,0.5)";
  const bodyText = isDarkMode
    ? "rgba(255,255,255,0.85)"
    : "rgba(15,23,42,0.85)";

  const current = series[series.length - 1];
  const windowStart = series[0];
  const delta = current - windowStart;

  return (
    <div
      style={{
        background: bg,
        borderRadius: 14,
        overflow: "hidden",
        border,
        boxShadow: isDarkMode
          ? "0 20px 60px rgba(0,0,0,0.5)"
          : "0 20px 50px rgba(15,23,42,0.1)",
      }}
    >
      <div style={{ padding: "22px 22px 22px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 36,
                fontWeight: 700,
                color: bodyText,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                transition: "color 0.3s",
              }}
            >
              {Math.round(current)}%
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: mutedText,
                marginTop: 4,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              live accuracy
            </div>
          </div>
          <div
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              background: delta >= 0 ? "rgba(34,197,94,0.15)" : "rgba(248,113,113,0.15)",
              border: delta >= 0 ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(248,113,113,0.3)",
              fontSize: 11,
              fontWeight: 600,
              color: delta >= 0 ? "#4ade80" : "#f87171",
              fontVariantNumeric: "tabular-nums",
              transition: "all 0.3s",
            }}
          >
            {delta >= 0 ? "↑" : "↓"} {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
          </div>
        </div>

        <svg width="100%" viewBox={`0 0 ${width} ${height + 12}`} style={{ display: "block" }}>
          <defs>
            <linearGradient id="accFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(201,100%,70%)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="hsl(201,100%,70%)" stopOpacity="0" />
            </linearGradient>
            {/* Fade the trailing edge so new points appear to scroll in smoothly */}
            <linearGradient id="leftFade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={bg} stopOpacity="1" />
              <stop offset="100%" stopColor={bg} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${path} L ${width},${height + 12} L 0,${height + 12} Z`}
            fill="url(#accFill)"
            style={{ transition: "d 0.9s linear" }}
          />
          <path
            d={path}
            fill="none"
            stroke="hsl(201,100%,70%)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transition: "d 0.9s linear" }}
          />
          {/* Pulsing head point */}
          <circle
            cx={(series.length - 1) * step}
            cy={toY(current)}
            r={4}
            fill="hsl(201,100%,70%)"
            style={{ transition: "cy 0.9s linear" }}
          />
          <circle
            cx={(series.length - 1) * step}
            cy={toY(current)}
            r={9}
            fill="hsl(201,100%,70%)"
            opacity={0.25}
            style={{
              transition: "cy 0.9s linear",
              animation: "accuracyPulse 1.6s ease-in-out infinite",
              transformOrigin: "center",
            }}
          />
          {/* Left fade mask */}
          <rect x={0} y={0} width={60} height={height + 12} fill="url(#leftFade)" />
        </svg>
      </div>
    </div>
  );
};

// ─── Feature row (big text left, demo right) ──────────────────────────────

const FeatureRow = ({
  eyebrow,
  title,
  titleEm,
  body,
  ctaLabel,
  ctaHref,
  demo,
  reverse,
  isDarkMode,
}: {
  eyebrow: string;
  title: string;
  titleEm: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  demo: React.ReactNode;
  reverse?: boolean;
  isDarkMode: boolean;
}) => {
  const navigate = useNavigate();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)",
        gap: 64,
        alignItems: "center",
        padding: "96px 24px",
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      <div style={{ order: reverse ? 2 : 1 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "hsl(201,100%,60%)",
            fontWeight: 600,
            marginBottom: 18,
          }}
        >
          — {eyebrow}
        </div>
        <h2
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: "clamp(40px, 5.5vw, 68px)",
            lineHeight: 0.98,
            letterSpacing: "-0.025em",
            color: "hsl(var(--foreground))",
            margin: "0 0 22px",
          }}
        >
          {title}
          <br />
          <em style={{ fontStyle: "italic", color: "hsl(201,100%,70%)" }}>
            {titleEm}
          </em>
        </h2>
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.65,
            fontWeight: 300,
            color: isDarkMode
              ? "rgba(255,255,255,0.55)"
              : "rgba(15,23,42,0.62)",
            maxWidth: 420,
            margin: "0 0 28px",
          }}
        >
          {body}
        </p>
        <button
          onClick={() => navigate(ctaHref)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 14,
            fontWeight: 600,
            color: "hsl(201,100%,70%)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          {ctaLabel}
          <ArrowRight size={14} />
        </button>
      </div>
      <div style={{ order: reverse ? 1 : 2, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            inset: "-30px",
            background: isDarkMode
              ? "radial-gradient(ellipse at 50% 50%, rgba(125,211,252,0.1) 0%, transparent 65%)"
              : "radial-gradient(ellipse at 50% 50%, rgba(56,189,248,0.13) 0%, transparent 65%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative" }}>{demo}</div>
      </div>
    </div>
  );
};

// ─── Home page ─────────────────────────────────────────────────────────────

const Home = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [questionBankTotal, setQuestionBankTotal] = useState(DEFAULT_QUESTION_BANK_TOTAL);
  const [bankBreakdown, setBankBreakdown] = useState<{ math: number; reading: number }>({
    math: Math.round(DEFAULT_QUESTION_BANK_TOTAL * 0.5),
    reading: Math.round(DEFAULT_QUESTION_BANK_TOTAL * 0.5),
  });
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
      @keyframes accuracyPulse {
        0%, 100% { transform: scale(1); opacity: 0.25; }
        50%      { transform: scale(1.6); opacity: 0; }
      }
      @keyframes explanationStepSlide {
        from { opacity: 0; transform: translateY(calc(22px * var(--step-dir, 1))); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .explanation-step-slide {
        animation: explanationStepSlide 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
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
        setBankBreakdown({ math: bankCounts.math, reading: bankCounts.reading });
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
              to="/modules"
              className="rounded-md px-3 py-1.5 transition-colors hover:bg-muted hover:text-foreground"
            >
              Practice Modules
            </Link>
            <Link
              to="/score-calculator"
              className="rounded-md px-3 py-1.5 transition-colors hover:bg-muted hover:text-foreground"
            >
              Score Calculator
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
            maxWidth: 960,
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

      {/* ── SCROLL-DRIVEN QUESTION INTERFACE ──────────────────────────── */}
      <div className="bg-background">
        <ScrollQuestionDemo isDarkMode={isDarkMode} />
      </div>

      {/* ── FEATURE ROW — BANK FILTERS ────────────────────────────────── */}
      <section className="bg-background">
        <FilterFeatureSection
          isDarkMode={isDarkMode}
          totalQuestions={questionBankTotal}
          mathCount={bankBreakdown.math}
          readingCount={bankBreakdown.reading}
        />
      </section>

      {/* ── FEATURE ROW — EXPLANATIONS ─────────────────────────────────── */}
      <section className="bg-background">
        <FeatureRow
          eyebrow="Walk-through explanations"
          title="See how every"
          titleEm="answer is built."
          body="Every question unfolds step by step — the setup, the key move, the interpretation. No walls of text, just the reasoning you'd write yourself."
          ctaLabel="Try a hard question"
          ctaHref="/hard"
          demo={<AnimatedExplanation isDarkMode={isDarkMode} />}
          reverse
          isDarkMode={isDarkMode}
        />
      </section>

      {/* ── FEATURE ROW — PROGRESS ─────────────────────────────────────── */}
      <section className="bg-background">
        <FeatureRow
          eyebrow="Progress tracking"
          title="Watch your"
          titleEm="accuracy climb."
          body="Per-domain accuracy, trends over time, and a clear view of which skills to focus on next. Free, forever."
          ctaLabel={user ? "View your stats" : "Create free account"}
          ctaHref={user ? "/analysis" : "/signup"}
          demo={<AnimatedAccuracyChart isDarkMode={isDarkMode} />}
          isDarkMode={isDarkMode}
        />
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section style={{ padding: "40px 24px 96px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", textAlign: "center" }}>
          <h2
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: "clamp(36px, 5vw, 60px)",
              fontWeight: 400,
              letterSpacing: "-0.025em",
              color: "hsl(var(--foreground))",
              margin: "0 0 28px",
              lineHeight: 1,
            }}
          >
            {user ? (
              <>Keep going.</>
            ) : (
              <>
                Start for{" "}
                <em style={{ fontStyle: "italic", color: "hsl(201,100%,70%)" }}>
                  free.
                </em>
              </>
            )}
          </h2>
          <button
            onClick={() => navigate(user ? "/bank" : "/signup")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 32px",
              borderRadius: 10,
              background: "hsl(201,100%,74%)",
              color: "hsl(210,50%,12%)",
              fontWeight: 600,
              fontSize: 15,
              border: "none",
              cursor: "pointer",
              fontFamily: "'Outfit', sans-serif",
              boxShadow: isDarkMode
                ? "0 0 36px rgba(125,211,252,0.28)"
                : "0 10px 30px rgba(56,189,248,0.22)",
              transition: "transform 0.14s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
            }}
          >
            {user ? "Go to Question Bank" : "Get started"}
            <ArrowRight size={15} />
          </button>
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
