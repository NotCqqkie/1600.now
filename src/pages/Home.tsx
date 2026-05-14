import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { BrandLogo } from "@/components/BrandLogo";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
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
import { InlineDesmos } from "@/components/InlineDesmos";
import { useThemeMode } from "@/hooks/useThemeMode";
import { renderMixedContent } from "@/lib/mathRendering";
import {
  BANK_COUNT_BY_OFFICIAL_SKILL,
  BANK_TOTAL_ALL,
} from "@/lib/bankTotals.generated";
import "katex/dist/katex.min.css";

const DEFAULT_QUESTION_BANK_TOTAL = BANK_TOTAL_ALL;

// Pinned to a real bank question: past/math/(x-4)^2+6, minimum value
const DEMO_Q_SOURCE_ID = "6197d48e-7c76-4333-af39-0b9aa39e924c_21";
const DEMO_Q = {
  text: "$f(x)=(x-4)^{2}+6$\nWhat is the minimum value of the given function?",
  choices: [
    { id: "A", text: "$2$" },
    { id: "B", text: "$4$" },
    { id: "C", text: "$6$" },
    { id: "D", text: "$10$" },
  ],
  correctId: "C",
};

// ─── Hero question preview — iframes the real /bank viewer in embed mode ──

// Cache pool scans so every filter flip doesn't re-scan the bank.
const heroQuestionIdCache = new Map<string, number>();
const resolveHeroQuestionId = async (
  subject: "math" | "reading",
  difficulty: "Easy" | "Medium" | "Hard" | null,
): Promise<number> => {
  const cacheKey = `${subject}|${difficulty ?? ""}`;
  const cached = heroQuestionIdCache.get(cacheKey);
  if (cached !== undefined) return cached;
  try {
    const { getBankPool } = await import("@/data/questionBank");
    const pool = getBankPool(subject, "past");
    let id = 1;
    if (subject === "math" && !difficulty) {
      const pinnedIdx = pool.findIndex((q) => q.sourceId === DEMO_Q_SOURCE_ID);
      if (pinnedIdx >= 0) id = pinnedIdx + 1;
    } else {
      const firstMatch = pool.find(
        (q) => !difficulty || q.difficulty === difficulty,
      );
      id = firstMatch?.id ?? 1;
    }
    heroQuestionIdCache.set(cacheKey, id);
    return id;
  } catch {
    return 1;
  }
};

const HERO_PREVIEW_SCALE = 0.85;
const HERO_PREVIEW_LOGICAL_HEIGHT = 760;
const HERO_PREVIEW_MOBILE_SCALE = 0.55;
const HERO_PREVIEW_MOBILE_LOGICAL_HEIGHT = 640;

const HeroQuestionPreview = memo(({
  isDarkMode,
  subject,
  difficulty,
}: {
  isDarkMode: boolean;
  subject: "math" | "reading";
  difficulty: "Easy" | "Medium" | "Hard" | null;
}) => {
  const [questionId] = useState<number>(1);
  const src = `/bank/${subject}/${questionId}?bankType=past&embed=1${
    difficulty ? `&difficulty=${difficulty}` : ""
  }`;
  const windowShadow = isDarkMode
    ? "0 0 0 1px rgba(255,255,255,0.07), 0 40px 100px rgba(0,0,0,0.55), 0 0 80px rgba(125,211,252,0.07)"
    : "0 0 0 1px rgba(15,23,42,0.08), 0 24px 64px rgba(15,23,42,0.12), 0 0 48px rgba(56,189,248,0.1)";

  // Forward wheel events from the embedded viewer so the page scrolls even
  // while the user is hovering the preview.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const data = e.data;
      if (!data || data.type !== "heroWheel") return;
      const dy = typeof data.deltaY === "number" ? data.deltaY : 0;
      const dx = typeof data.deltaX === "number" ? data.deltaX : 0;
      window.scrollBy({ top: dy, left: dx });
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Scale the iframe down: render at logical size then transform. The
  // outer box clamps visual size; internal coordinates (used by the auto-demo
  // cursor) remain in the iframe's own viewport and stay aligned.
  // Mobile gets a smaller scale so the preview doesn't dominate the screen.
  const [isPhone, setIsPhone] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false,
  );
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const onChange = (e: MediaQueryListEvent) => setIsPhone(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  const activeScale = isPhone ? HERO_PREVIEW_MOBILE_SCALE : HERO_PREVIEW_SCALE;
  const activeLogicalHeight = isPhone ? HERO_PREVIEW_MOBILE_LOGICAL_HEIGHT : HERO_PREVIEW_LOGICAL_HEIGHT;
  const visibleHeight = activeLogicalHeight * activeScale;
  return (
    <div
      className="bg-card"
      style={{
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: windowShadow,
        width: "100%",
        height: visibleHeight,
        position: "relative",
      }}
    >
      <iframe
        key={src}
        src={src}
        title="Live question preview"
        scrolling="no"
        style={{
          width: `${100 / activeScale}%`,
          height: activeLogicalHeight,
          border: 0,
          display: "block",
          background: "transparent",
          transform: `scale(${activeScale})`,
          transformOrigin: "top left",
        }}
      />
    </div>
  );
});
HeroQuestionPreview.displayName = "HeroQuestionPreview";
// ─── Auto-cycling explanation demo ─────────────────────────────────────────

const EXPLANATION_STEPS: {
  title: string;
  body: string;
  desmos?: string[];
}[] = [
  {
    title: "Recognize vertex form",
    body: "$f(x) = (x-4)^2 + 6$ is already written in <strong>vertex form</strong> $a(x-h)^2 + k$.\n\nMatching terms: $h = 4$ and $k = 6$, so the vertex is at $(4,\\, 6)$.",
  },
  {
    title: "Minimum or maximum?",
    body: "The leading coefficient is $a = 1 > 0$, so the parabola <strong>opens upward</strong>.\n\nAn upward-opening parabola has its vertex as the <strong>lowest point</strong> — meaning the vertex gives a minimum, not a maximum.",
  },
  {
    title: "Read the answer from the vertex",
    body: "The minimum value of $f(x)$ is the $y$-coordinate of the vertex. Since $k = 6$:\n\n$$f(4) = (4-4)^2 + 6 = 0 + 6 = 6$$\n\nThe minimum value is $\\boxed{6}$ — choice <strong>C</strong>.",
    desmos: ["y=(x-4)^2+6", "(4,6)"],
  },
];

const AnimatedExplanation = memo(({
  isDarkMode,
  currentStep,
  direction,
  animKey,
  onNavigate,
  scale = 1,
}: {
  isDarkMode: boolean;
  currentStep: number;
  direction: 1 | -1;
  animKey: number;
  onNavigate?: (target: number) => void;
  scale?: number;
}) => {
  const totalSteps = EXPLANATION_STEPS.length;
  const step = EXPLANATION_STEPS[currentStep];
  const isLast = currentStep === totalSteps - 1;

  return (
    <div
      className="rounded-[14px] overflow-hidden border border-border bg-card flex flex-col"
      style={{
        height: 520,
        transform: `scale(${scale})`,
        transformOrigin: "center center",
        transition: "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
        boxShadow: isDarkMode
          ? "0 30px 90px rgba(0,0,0,0.6)"
          : "0 30px 80px rgba(15,23,42,0.2)",
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
              onClick={() => onNavigate?.(i)}
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

      {/* Step content — overflow hidden so no scrollbar appears on step 3 */}
      <div className="flex-1 overflow-hidden relative">
        <div
          key={animKey}
          className="absolute inset-0 overflow-hidden px-3 py-4 explanation-step-slide"
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
            <div
              className="text-[15px] leading-snug pl-9 explanation-content text-foreground/90"
              // renderMixedContent output is app-owned static data, not user input
              dangerouslySetInnerHTML={{ __html: renderMixedContent(step.body) }}
            />
            {step.desmos && (
              <div className="ml-9 mt-2">
                <InlineDesmos expressions={step.desmos} height={260} />
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
          onClick={() => onNavigate?.(currentStep - 1)}
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
            onClick={() => onNavigate?.(currentStep + 1)}
            className="flex-1 gap-1"
          >
            Next Step
            <ChevronDown className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
});
AnimatedExplanation.displayName = "AnimatedExplanation";

// ─── Scroll-driven explanation feature section (spotlight + scroll-through steps)

const ExplanationFeatureSection = memo(({ isDarkMode }: { isDarkMode: boolean }) => {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const prevStepRef = useRef(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    let rafId = 0;
    let pending = false;
    const compute = () => {
      pending = false;
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const raw = total > 0 ? -rect.top / total : 0;
      setProgress(Math.max(0, Math.min(1, raw)));
    };
    const schedule = () => {
      if (pending) return;
      pending = true;
      rafId = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  const totalSteps = EXPLANATION_STEPS.length;

  // Map scroll progress to a step index.
  // 0..0.15  → intro (step 0, card small)
  // 0.15..0.85 → step 0→N (card full-size, spotlight)
  // 0.85..1  → outro (card small)
  const spotlight = progress > 0.12 && progress < 0.88;
  const stepProgress = Math.max(0, Math.min(1, (progress - 0.15) / 0.70));
  const currentStep = Math.min(totalSteps - 1, Math.floor(stepProgress * totalSteps));

  useEffect(() => {
    if (currentStep !== prevStepRef.current) {
      setDirection(currentStep > prevStepRef.current ? 1 : -1);
      setAnimKey((k) => k + 1);
      prevStepRef.current = currentStep;
    }
  }, [currentStep]);

  // Map a target step index back to the scroll-position whose progress lands
  // inside that step's slice. We aim slightly past the slice's start so the
  // browser's scroll-snap can't drift back into the previous step.
  const scrollToStep = useCallback((target: number) => {
    const clamped = Math.max(0, Math.min(totalSteps - 1, target));
    const el = sectionRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    if (total <= 0) return;
    const sectionTopAbs = rect.top + window.scrollY;
    // Slice center: progress = 0.15 + (step + 0.5)/totalSteps * 0.70
    const targetProgress = 0.15 + ((clamped + 0.5) / totalSteps) * 0.70;
    window.scrollTo({
      top: sectionTopAbs + targetProgress * total,
      behavior: "smooth",
    });
  }, [totalSteps]);

  // Card scales up as it enters the spotlight, and down as it leaves
  const scale = spotlight ? 1 : 0.9;
  // Dim overlay opacity ramps up/down around the spotlight window
  const dimOpacity = spotlight
    ? Math.min(1, (progress - 0.12) / 0.08) * Math.min(1, (0.88 - progress) / 0.08)
    : 0;

  return (
    <div ref={sectionRef} style={{ position: "relative", height: "320vh" }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
        }}
      >
        {/* Full-screen spotlight dim overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: isDarkMode
              ? "radial-gradient(circle at 62% 50%, transparent 18%, rgba(0,0,0,0.78) 50%)"
              : "radial-gradient(circle at 62% 50%, transparent 18%, rgba(10,18,32,0.55) 50%)",
            opacity: dimOpacity * 0.95,
            pointerEvents: "none",
            zIndex: 2,
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 3,
            height: "100%",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)",
            gap: 64,
            alignItems: "center",
            padding: "0 24px",
            maxWidth: 1200,
            margin: "0 auto",
          }}
        >
          {/* Left: headline */}
          <div style={{ opacity: spotlight ? 0.35 : 1, transition: "opacity 0.5s ease" }}>
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
            </div>
            <h2
              style={{
                fontFamily: "'Geist', Georgia, serif",
                fontSize: "clamp(40px, 5.5vw, 68px)",
                lineHeight: 0.98,
                letterSpacing: "-0.025em",
                color: "hsl(var(--foreground))",
                margin: "0 0 22px",
              }}
            >
              See how every
              <br />
              <em style={{ fontStyle: "normal", color: "hsl(201,100%,70%)" }}>
                answer is built.
              </em>
            </h2>
            <p
              style={{
                fontSize: 16,
                lineHeight: 1.65,
                fontWeight: 300,
                color: isDarkMode ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.62)",
                maxWidth: 420,
                margin: "0 0 28px",
              }}
            >
              Learn step-by-step through every solution.
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
                fontFamily: "'Geist', sans-serif",
              }}
            >
              Open question bank
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Right: the scroll-driven explanation card */}
          <div style={{ position: "relative" }}>
            <AnimatedExplanation
              isDarkMode={isDarkMode}
              currentStep={currentStep}
              direction={direction}
              animKey={animKey}
              scale={scale}
              onNavigate={scrollToStep}
            />
            {/* Scroll progress hint */}
            <div
              style={{
                marginTop: 14,
                display: "flex",
                justifyContent: "center",
                gap: 4,
                opacity: spotlight ? 1 : 0,
                transition: "opacity 0.4s ease",
              }}
            >
              {EXPLANATION_STEPS.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 28,
                    height: 3,
                    borderRadius: 2,
                    background: i <= currentStep
                      ? "hsl(201,100%,70%)"
                      : isDarkMode
                      ? "rgba(255,255,255,0.12)"
                      : "rgba(15,23,42,0.14)",
                    transition: "background 0.3s",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
ExplanationFeatureSection.displayName = "ExplanationFeatureSection";

// ─── Question bank feature section ───────────────────────────────────────────

type DifficultyPill = "easy" | "medium" | "hard";
type SubjectPill = "math" | "reading";

type SkillEntry = {
  label: string;       // display label
  bankSkill: string;   // exact skill name in questionBank
  bankDomain: string;  // exact domain name in questionBank
  count: number;       // approximate total across all difficulties
  subject: SubjectPill;
};

const skillCount = (officialSkill: string): number =>
  BANK_COUNT_BY_OFFICIAL_SKILL[officialSkill] ?? 0;

const SKILL_ORBIT: SkillEntry[] = [
  { label: "Linear functions",       bankSkill: "Linear functions",                                                   bankDomain: "Algebra",                            count: skillCount("Linear functions"),                                                   subject: "math" },
  { label: "Nonlinear functions",    bankSkill: "Nonlinear functions",                                                bankDomain: "Advanced Math",                      count: skillCount("Nonlinear functions"),                                                subject: "math" },
  { label: "Equivalent expressions", bankSkill: "Equivalent expressions",                                             bankDomain: "Advanced Math",                      count: skillCount("Equivalent expressions"),                                             subject: "math" },
  { label: "Ratios & rates",         bankSkill: "Ratios, rates, proportional relationships, and units",               bankDomain: "Problem-Solving and Data Analysis",  count: skillCount("Ratios, rates, proportional relationships, and units"),               subject: "math" },
  { label: "Percentages",            bankSkill: "Percentages",                                                        bankDomain: "Problem-Solving and Data Analysis",  count: skillCount("Percentages"),                                                        subject: "math" },
  { label: "One-variable data",      bankSkill: "One-variable data: Distributions and measures of center and spread", bankDomain: "Problem-Solving and Data Analysis",  count: skillCount("One-variable data: Distributions and measures of center and spread"), subject: "math" },
  { label: "Probability",            bankSkill: "Probability and conditional probability",                            bankDomain: "Problem-Solving and Data Analysis",  count: skillCount("Probability and conditional probability"),                            subject: "math" },
  { label: "Area & volume",          bankSkill: "Area and volume",                                                    bankDomain: "Geometry and Trigonometry",          count: skillCount("Area and volume"),                                                    subject: "math" },
  { label: "Right triangles",        bankSkill: "Right triangles and trigonometry",                                   bankDomain: "Geometry and Trigonometry",          count: skillCount("Right triangles and trigonometry"),                                   subject: "math" },
  { label: "Circles",                bankSkill: "Circles",                                                            bankDomain: "Geometry and Trigonometry",          count: skillCount("Circles"),                                                            subject: "math" },
  { label: "Words in Context",       bankSkill: "Words in Context",                                                   bankDomain: "Craft and Structure",                count: skillCount("Words in Context"),                                                   subject: "reading" },
  { label: "Transitions",            bankSkill: "Transitions",                                                        bankDomain: "Expression of Ideas",                count: skillCount("Transitions"),                                                        subject: "reading" },
  { label: "Inferences",             bankSkill: "Inferences",                                                         bankDomain: "Information and Ideas",              count: skillCount("Inferences"),                                                         subject: "reading" },
  { label: "Boundaries",             bankSkill: "Boundaries",                                                         bankDomain: "Standard English Conventions",       count: skillCount("Boundaries"),                                                         subject: "reading" },
  { label: "Form & Structure",       bankSkill: "Form, Structure, and Sense",                                         bankDomain: "Standard English Conventions",       count: skillCount("Form, Structure, and Sense"),                                         subject: "reading" },
  { label: "Central Ideas",          bankSkill: "Central Ideas and Details",                                          bankDomain: "Information and Ideas",              count: skillCount("Central Ideas and Details"),                                          subject: "reading" },
];

const DIFFICULTY_COLORS: Record<DifficultyPill, { bg: string; border: string; text: string }> = {
  easy:   { bg: "rgba(34,197,94,0.15)",   border: "rgba(34,197,94,0.5)",   text: "#16a34a" },
  medium: { bg: "rgba(234,179,8,0.15)",   border: "rgba(234,179,8,0.5)",   text: "#ca8a04" },
  hard:   { bg: "rgba(239,68,68,0.15)",   border: "rgba(239,68,68,0.5)",   text: "#dc2626" },
};

const FilterFeatureSection = memo(({
  isDarkMode,
  totalQuestions,
}: {
  isDarkMode: boolean;
  totalQuestions: number;
}) => {
  const navigate = useNavigate();
  const [selectedDifficulties, setSelectedDifficulties] = useState<DifficultyPill[]>(["easy", "medium", "hard"]);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const chipsRef = useRef<HTMLDivElement>(null);
  const [chipsInView, setChipsInView] = useState(false);

  useEffect(() => {
    const el = chipsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setChipsInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const toggleDifficulty = useCallback((d: DifficultyPill) => {
    setSelectedDifficulties((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  }, []);

  const toggleSkill = useCallback((label: string) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  const matchingCount = useMemo(() => {
    const diffFraction = selectedDifficulties.length === 0 ? 1 : selectedDifficulties.length / 3;
    if (selectedSkills.size === 0) {
      return Math.round(totalQuestions * diffFraction);
    }
    const skillTotal = SKILL_ORBIT.filter((s) => selectedSkills.has(s.label)).reduce(
      (acc, s) => acc + s.count,
      0,
    );
    return Math.round(skillTotal * diffFraction);
  }, [selectedDifficulties, selectedSkills, totalQuestions]);

  const openBank = useCallback(() => {
    if (selectedDifficulties.length > 0 || selectedSkills.size > 0) {
      const preset = {
        difficulties: selectedDifficulties,
        skills: SKILL_ORBIT
          .filter((s) => selectedSkills.has(s.label))
          .map((s) => ({ bankSkill: s.bankSkill, bankDomain: s.bankDomain, subject: s.subject })),
      };
      sessionStorage.setItem("bankFilterPreset", JSON.stringify(preset));
    }
    navigate("/bank");
  }, [navigate, selectedDifficulties, selectedSkills]);

  const chipBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "5px 11px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    transition:
      "border-color 0.15s, background 0.15s, color 0.15s, opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1), transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)",
    border: "1px solid",
    userSelect: "none",
  };

  return (
    <div className="pt-6 pb-24 px-4">
      <div className="mx-auto" style={{ maxWidth: 900 }}>

        {/* Header */}
        <div className="text-center mb-10">
          <h2
            style={{
              fontFamily: "'Geist', Georgia, serif",
              fontSize: "clamp(30px, 4vw, 52px)",
              lineHeight: 1,
              letterSpacing: "-0.025em",
              color: "hsl(var(--foreground))",
              margin: "0 0 14px",
            }}
          >
            Every question,{" "}
            <em style={{ fontStyle: "normal", color: "hsl(201,100%,70%)" }}>
              instantly filterable.
            </em>
          </h2>
          <p style={{ fontSize: 15, color: "hsl(var(--muted-foreground))", margin: 0 }}>
          </p>
        </div>

        {/* Difficulty toggles */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 10,
            marginBottom: 24,
          }}
        >
          {(["easy", "medium", "hard"] as DifficultyPill[]).map((d) => {
            const active = selectedDifficulties.includes(d);
            const colors = DIFFICULTY_COLORS[d];
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDifficulty(d)}
                style={{
                  ...chipBase,
                  padding: "7px 18px",
                  fontSize: 13,
                  fontWeight: 600,
                  background: active ? colors.bg : isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                  borderColor: active ? colors.border : isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
                  color: active ? colors.text : "hsl(var(--muted-foreground))",
                  boxShadow: active ? `0 0 0 2px ${colors.border}` : "none",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  if (active) {
                    el.style.filter = "brightness(0.92)";
                  } else {
                    el.style.background = isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
                  }
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.filter = "";
                  el.style.background = active
                    ? colors.bg
                    : isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";
                }}
              >
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            );
          })}
        </div>

        {/* Skill chips */}
        <div
          ref={chipsRef}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 9,
            justifyContent: "center",
            marginBottom: 32,
          }}
        >
          {SKILL_ORBIT.map((chip, chipIdx) => {
            const active = selectedSkills.has(chip.label);
            const diffFraction = selectedDifficulties.length === 0 ? 1 : selectedDifficulties.length / 3;
            const displayCount = Math.round(chip.count * diffFraction);
            return (
              <button
                key={chip.label}
                type="button"
                onClick={() => toggleSkill(chip.label)}
                className={`chip-cascade${chipsInView ? " in" : ""}`}
                style={{
                  ...chipBase,
                  transitionDelay: chipsInView ? `${chipIdx * 38}ms` : "0ms",
                  background: active
                    ? isDarkMode ? "rgba(125,211,252,0.18)" : "rgba(56,189,248,0.12)"
                    : isDarkMode ? "rgba(20,30,48,0.6)" : "rgba(255,255,255,0.85)",
                  borderColor: active
                    ? isDarkMode ? "rgba(125,211,252,0.6)" : "rgba(56,189,248,0.65)"
                    : isDarkMode ? "rgba(125,211,252,0.18)" : "rgba(56,189,248,0.22)",
                  color: active
                    ? isDarkMode ? "rgba(125,211,252,1)" : "hsl(201,100%,30%)"
                    : "hsl(var(--foreground))",
                  boxShadow: active
                    ? isDarkMode
                      ? "0 0 0 2px rgba(125,211,252,0.25)"
                      : "0 0 0 2px rgba(56,189,248,0.2)"
                    : isDarkMode
                    ? "0 2px 6px rgba(0,0,0,0.25)"
                    : "0 2px 6px rgba(15,23,42,0.06)",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  if (active) {
                    el.style.background = isDarkMode ? "rgba(125,211,252,0.28)" : "rgba(56,189,248,0.2)";
                  } else {
                    el.style.background = isDarkMode ? "rgba(125,211,252,0.1)" : "rgba(56,189,248,0.08)";
                  }
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.background = active
                    ? isDarkMode ? "rgba(125,211,252,0.18)" : "rgba(56,189,248,0.12)"
                    : isDarkMode ? "rgba(20,30,48,0.6)" : "rgba(255,255,255,0.85)";
                }}
              >
                <span>{chip.label}</span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 32,
                    height: 19,
                    padding: "0 6px",
                    borderRadius: 999,
                    background: active ? "hsl(201,100%,70%)" : isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)",
                    color: active ? "hsl(210,50%,12%)" : "hsl(var(--muted-foreground))",
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 10,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  {displayCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* Live count + CTA */}
        <div className="flex flex-col items-center gap-4">
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              padding: "12px 24px",
              borderRadius: 12,
              background: isDarkMode ? "rgba(125,211,252,0.06)" : "rgba(56,189,248,0.06)",
              border: isDarkMode ? "1px solid rgba(125,211,252,0.15)" : "1px solid rgba(56,189,248,0.18)",
            }}
          >
            <span
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 28,
                fontWeight: 700,
                color: "hsl(var(--foreground))",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.02em",
              }}
            >
              {matchingCount.toLocaleString()}
            </span>
            <span
              style={{
                fontSize: 12,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "hsl(var(--muted-foreground))",
                fontWeight: 500,
              }}
            >
              {selectedSkills.size > 0 || selectedDifficulties.length > 0 ? "matching questions" : "total questions"}
            </span>
          </div>

          <button
            type="button"
            onClick={openBank}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 28px",
              borderRadius: 10,
              background: "hsl(201,100%,42%)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              border: "none",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = "hsl(201,100%,36%)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = "hsl(201,100%,42%)")
            }
          >
            Open question bank
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

      </div>
    </div>
  );
});
FilterFeatureSection.displayName = "FilterFeatureSection";

// ─── Animated accuracy sparkline ───────────────────────────────────────────

type AccuracyPoint = { day: number; value: number };

const AnimatedAccuracyChart = memo(({ isDarkMode }: { isDarkMode: boolean }) => {
  const VISIBLE_POINTS = 14;
  const TICK_MS = 1600; // time between new points
  // Upward trend with visible fluctuation: mean drift is small, jitter is wide
  // so individual steps can dip while the series still climbs overall.
  const STEP_MEAN = 1.6;
  const STEP_JITTER = 6; // ± STEP_JITTER/2 noise
  const START_MIN = 50;
  const START_MAX = 54;
  const RESET_AT = 95;
  // Buffer points off each side so new data slides in from the right smoothly
  const SERIES_LEN = VISIBLE_POINTS + 2;

  const seed = (startDay: number): AccuracyPoint[] => {
    const out: AccuracyPoint[] = [];
    for (let i = 0; i < SERIES_LEN; i++) {
      const v = START_MIN + Math.random() * (START_MAX - START_MIN);
      out.push({ day: startDay + i, value: v });
    }
    return out;
  };

  // Random start date; each series.day is a chronological offset from here
  const baseDateRef = useRef<Date | null>(null);
  if (!baseDateRef.current) {
    const d = new Date();
    d.setDate(d.getDate() - (60 + Math.floor(Math.random() * 700)));
    baseDateRef.current = d;
  }
  const formatDay = (dayOffset: number) => {
    const d = new Date(baseDateRef.current!);
    d.setDate(d.getDate() + dayOffset);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // One buffer point off each side for smooth slide-in animation
  const seriesRef = useRef<AccuracyPoint[]>([]);
  if (seriesRef.current.length === 0) seriesRef.current = seed(0);
  const [series, setSeries] = useState<AccuracyPoint[]>(seriesRef.current);
  const [offset, setOffset] = useState(0); // 0 → 1 per tick (continuous)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);

  // Smoothly animate offset with RAF; when it crosses 1, shift a new point in
  useEffect(() => {
    if (paused) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // Clamp dt so tab-blur pauses resume cleanly instead of fast-forwarding
      // through a huge backlog (which puts the series off-screen for ~0.5s).
      const dt = Math.min(now - last, TICK_MS);
      last = now;
      setOffset((o) => {
        const next = o + dt / TICK_MS;
        if (next >= 1) {
          setSeries((prev) => {
            const tail = prev[prev.length - 1];
            // Hit the ceiling → reset the climb with a fresh run of days
            if (tail.value >= RESET_AT) {
              return seed(tail.day + 1);
            }
            const nextVal = Math.min(
              RESET_AT,
              tail.value + STEP_MEAN + (Math.random() - 0.5) * STEP_JITTER
            );
            return [...prev.slice(1), { day: tail.day + 1, value: nextVal }];
          });
          return next - 1;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused]);

  const width = 420;
  const height = 160;
  // Visible range spans indexes 1..VISIBLE_POINTS (index 0 sits off-screen to the left)
  const step = width / (VISIBLE_POINTS - 1);
  const toY = (v: number) => height - ((v - 50) / 45) * height + 6;
  // Sliding: at offset=0, point i=1 is at x=0; point i=VISIBLE_POINTS at x=width.
  // At offset=1 (about to commit), everything has shifted left by one step.
  const xFor = (i: number) => (i - 1 - offset) * step;

  const path = series
    .map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(2)},${toY(p.value).toFixed(2)}`)
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

  // Value and y at the right edge (x = width). Between indices VISIBLE_POINTS and
  // VISIBLE_POINTS+1, interpolated by `offset` so the head bubble and the big
  // number track the line exactly as it slides in from the right.
  const rightEdgeValue =
    series[VISIBLE_POINTS].value +
    offset * (series[VISIBLE_POINTS + 1].value - series[VISIBLE_POINTS].value);
  const current = rightEdgeValue;
  const windowStart = series[1].value; // left edge of visible range
  const delta = rightEdgeValue - windowStart; // matches what the chart shows
  const currentDay = series[VISIBLE_POINTS].day;

  const svgRef = useRef<SVGSVGElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    // Find the visible point closest to px (indices 1..VISIBLE_POINTS are visible)
    let closest = -1;
    let closestD = Infinity;
    for (let i = 1; i <= VISIBLE_POINTS; i++) {
      const d = Math.abs(xFor(i) - px);
      if (d < closestD) {
        closestD = d;
        closest = i;
      }
    }
    setHoverIdx(closest);
    setPaused(true);
  };
  const onLeave = () => {
    setHoverIdx(null);
    setPaused(false);
  };

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
              }}
            >
              {Math.round(hoverIdx !== null ? series[hoverIdx].value : current)}%
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
              {hoverIdx !== null ? formatDay(series[hoverIdx].day) : `live accuracy · ${formatDay(currentDay)}`}
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
            }}
          >
            {delta >= 0 ? "↑" : "↓"} {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <svg
            ref={svgRef}
            width="100%"
            viewBox={`0 0 ${width} ${height + 12}`}
            style={{ display: "block", cursor: "crosshair" }}
            onMouseMove={onMove}
            onMouseLeave={onLeave}
          >
            <defs>
              <linearGradient id="accFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(201,100%,70%)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="hsl(201,100%,70%)" stopOpacity="0" />
              </linearGradient>
              <clipPath id="accClip">
                <rect x="0" y="0" width={width} height={height + 12} />
              </clipPath>
            </defs>
            <g clipPath="url(#accClip)">
              <path
                d={`${path} L ${xFor(series.length - 1)},${height + 12} L ${xFor(0)},${height + 12} Z`}
                fill="url(#accFill)"
              />
              <path
                d={path}
                fill="none"
                stroke="hsl(201,100%,70%)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Hover-aware point markers */}
              {series.map((p, i) => {
                const x = xFor(i);
                if (x < -step || x > width + step) return null;
                const isHover = hoverIdx === i;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={toY(p.value)}
                    r={isHover ? 5 : 2.5}
                    fill={isHover ? "hsl(201,100%,82%)" : "hsl(201,100%,70%)"}
                    stroke={isHover ? bg : "none"}
                    strokeWidth={isHover ? 2 : 0}
                  />
                );
              })}
              {/* Pulsing head point — pinned to the right edge, y tracks the line */}
              {hoverIdx === null && (
                <>
                  <circle cx={width} cy={toY(rightEdgeValue)} r={4} fill="hsl(201,100%,70%)" />
                  <circle
                    cx={width}
                    cy={toY(rightEdgeValue)}
                    r={9}
                    fill="hsl(201,100%,70%)"
                    opacity={0.25}
                    style={{ animation: "accuracyPulse 1.6s ease-in-out infinite", transformOrigin: "center" }}
                  />
                </>
              )}
              {/* Hover crosshair line */}
              {hoverIdx !== null && (
                <line
                  x1={xFor(hoverIdx)}
                  x2={xFor(hoverIdx)}
                  y1={0}
                  y2={height + 12}
                  stroke={isDarkMode ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.15)"}
                  strokeDasharray="3,3"
                />
              )}
            </g>
          </svg>

          {/* Tooltip */}
          {hoverIdx !== null && (() => {
            const hovered = series[hoverIdx];
            const x = xFor(hoverIdx);
            const y = toY(hovered.value);
            const xPct = (x / width) * 100;
            const yPct = (y / (height + 12)) * 100;
            return (
              <div
                style={{
                  position: "absolute",
                  left: `${xPct}%`,
                  top: `${yPct}%`,
                  transform: "translate(-50%, calc(-100% - 12px))",
                  padding: "6px 10px",
                  borderRadius: 8,
                  background: isDarkMode ? "hsl(222,30%,18%)" : "hsl(0,0%,100%)",
                  border: isDarkMode ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(15,23,42,0.12)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                  zIndex: 5,
                }}
              >
                <div
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 14,
                    fontWeight: 700,
                    color: bodyText,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {hovered.value.toFixed(1)}%
                </div>
                <div style={{ fontSize: 10, color: mutedText, marginTop: 2 }}>
                  {formatDay(hovered.day)}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
});
AnimatedAccuracyChart.displayName = "AnimatedAccuracyChart";

// ─── Feature row (big text left, demo right) ──────────────────────────────

const FeatureRow = memo(({
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
            fontFamily: "'Geist', Georgia, serif",
            fontSize: "clamp(40px, 5.5vw, 68px)",
            lineHeight: 0.98,
            letterSpacing: "-0.025em",
            color: "hsl(var(--foreground))",
            margin: "0 0 22px",
          }}
        >
          {title}
          <br />
          <em style={{ fontStyle: "normal", color: "hsl(201,100%,70%)" }}>
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
            fontFamily: "'Geist', sans-serif",
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
});
FeatureRow.displayName = "FeatureRow";


// ─── Slot-machine digit counter ────────────────────────────────────────────

const SlotDigit = memo(({ digit, delay }: { digit: number; delay: number }) => (
  <span
    style={{
      display: "inline-block",
      height: "1em",
      lineHeight: 1,
      overflow: "hidden",
      verticalAlign: "top",
    }}
  >
    <span
      style={{
        display: "block",
        transform: `translateY(-${digit}em)`,
        transition: `transform 1.1s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
      }}
    >
      {Array.from({ length: 10 }).map((_, i) => (
        <span key={i} style={{ display: "block", height: "1em", lineHeight: 1 }}>{i}</span>
      ))}
    </span>
  </span>
));
SlotDigit.displayName = "SlotDigit";

const SlotMachineCounter = memo(({ value, startValue = 247, countDuration = 2000 }: { value: number; startValue?: number; countDuration?: number }) => {
  const [displayed, setDisplayed] = useState(startValue);
  // Drives a CSS opacity fade so the counter never appears as a static
  // startValue (mobile disables the wrapper fade, otherwise "247" would flash).
  const [revealed, setRevealed] = useState(false);
  const rafRef = useRef<number>(0);
  const displayedRef = useRef(startValue);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    const from = hasAnimatedRef.current ? displayedRef.current : startValue;
    const range = value - from;
    if (range === 0) {
      hasAnimatedRef.current = true;
      setRevealed(true);
      return;
    }
    // Subsequent updates (e.g. async total arrives after first animation) tick
    // smoothly from the displayed value, not restart from startValue.
    const duration = hasAnimatedRef.current ? 600 : countDuration;
    const mountTime = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - mountTime) / duration, 1);
      // 1.8 is gentler than cubic — keeps visible motion through the final
      // quarter instead of crawling to a halt.
      const eased = 1 - Math.pow(1 - t, 1.8);
      const next = Math.round(from + range * eased);
      displayedRef.current = next;
      setDisplayed(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        hasAnimatedRef.current = true;
      }
    };
    // Fade the counter in on the next frame so the start value is never
    // visible — by the time opacity reaches 1, the digits have already moved.
    rafRef.current = requestAnimationFrame((now) => {
      setRevealed(true);
      tick(now);
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, startValue, countDuration]);

  return (
    <span
      style={{
        fontVariantNumeric: "tabular-nums",
        opacity: revealed ? 1 : 0,
        transition: "opacity 0.6s ease-out",
        display: "inline-block",
      }}
    >
      {displayed.toLocaleString()}
    </span>
  );
});
SlotMachineCounter.displayName = "SlotMachineCounter";

// ─── Floating math symbols (hero ambient) ──────────────────────────────────

const MATH_SYMBOLS = ["∑", "π", "√", "∫", "∞", "θ", "Δ", "λ", "φ", "Ω", "α", "β"];

const FloatingMathSymbols = memo(({ isDarkMode }: { isDarkMode: boolean }) => {
  const items = useMemo(() => {
    const seedRand = (seed: number) => {
      const x = Math.sin(seed * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    return Array.from({ length: 18 }).map((_, i) => ({
      sym: MATH_SYMBOLS[i % MATH_SYMBOLS.length],
      left: seedRand(i * 7.3) * 100,
      delay: seedRand(i * 11.1) * 22,
      duration: 18 + seedRand(i * 13.7) * 16,
      size: 24 + seedRand(i * 17.2) * 42,
      opacity: 0.05 + seedRand(i * 19.5) * 0.07,
    }));
  }, []);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 0,
      }}
    >
      {items.map((it, i) => (
        <span
          key={i}
          className="float-sym"
          style={{
            left: `${it.left}%`,
            fontSize: it.size,
            opacity: isDarkMode ? it.opacity * 1.5 : it.opacity,
            animationDelay: `${it.delay}s`,
            animationDuration: `${it.duration}s`,
            color: isDarkMode ? "rgba(125,211,252,1)" : "rgba(15,23,42,1)",
          }}
        >
          {it.sym}
        </span>
      ))}
    </div>
  );
});
FloatingMathSymbols.displayName = "FloatingMathSymbols";

// ─── Mouse-parallax tilt wrapper ───────────────────────────────────────────

const ParallaxTilt = memo(({
  children,
  max = 4,
}: {
  children: React.ReactNode;
  max?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(1400px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`;
  }, [max]);
  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(1400px) rotateX(0deg) rotateY(0deg)";
  }, []);
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        transition: "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: "transform",
        transformStyle: "preserve-3d",
      }}
    >
      {children}
    </div>
  );
});
ParallaxTilt.displayName = "ParallaxTilt";

// ─── Score dial section (scroll-driven gauge 400 → 1600) ───────────────────

const ScoreDialSection = memo(({ isDarkMode }: { isDarkMode: boolean }) => {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    let pending = false;
    const compute = () => {
      pending = false;
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const raw = total > 0 ? -rect.top / total : 0;
      setProgress(Math.max(0, Math.min(1, raw)));
    };
    const schedule = () => {
      if (pending) return;
      pending = true;
      raf = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  const sweep = Math.max(0, Math.min(1, (progress - 0.18) / 0.64));
  const score = Math.round((400 + sweep * 1200) / 10) * 10;
  const inSpotlight = progress > 0.1 && progress < 0.92;

  const RADIUS = 160;
  const STROKE = 24;
  const W = (RADIUS + STROKE) * 2;
  const H = RADIUS + STROKE * 2 + 8;
  const CIRC = Math.PI * RADIUS;

  return (
    <div ref={sectionRef} style={{ position: "relative", height: "240vh" }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            textAlign: "center",
            maxWidth: 760,
            padding: "0 24px",
            opacity: inSpotlight ? 1 : 0.35,
            transition: "opacity 0.5s ease",
          }}
        >
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
            — Score calculator
          </div>
          <h2
            style={{
              fontFamily: "'Geist', Georgia, serif",
              fontSize: "clamp(40px, 5.5vw, 68px)",
              lineHeight: 0.98,
              letterSpacing: "-0.025em",
              color: "hsl(var(--foreground))",
              margin: "0 0 28px",
            }}
          >
            Know exactly where
            <br />
            <em style={{ fontStyle: "normal", color: "hsl(201,100%,70%)" }}>you stand.</em>
          </h2>
          <div style={{ position: "relative", display: "inline-block" }}>
            <svg
              width={W}
              height={H}
              viewBox={`0 0 ${W} ${H}`}
              overflow="visible"
              style={{ display: "block", maxWidth: "min(560px, 90vw)", height: "auto" }}
            >
              <defs>
                <linearGradient id="scoreDialGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(0, 75%, 60%)" />
                  <stop offset="35%" stopColor="hsl(35, 95%, 58%)" />
                  <stop offset="70%" stopColor="hsl(80, 70%, 52%)" />
                  <stop offset="100%" stopColor="hsl(150, 75%, 48%)" />
                </linearGradient>
              </defs>
              <path
                d={`M ${STROKE},${RADIUS + STROKE} A ${RADIUS} ${RADIUS} 0 0 1 ${W - STROKE},${RADIUS + STROKE}`}
                fill="none"
                stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}
                strokeWidth={STROKE}
                strokeLinecap="round"
              />
              <path
                d={`M ${STROKE},${RADIUS + STROKE} A ${RADIUS} ${RADIUS} 0 0 1 ${W - STROKE},${RADIUS + STROKE}`}
                fill="none"
                stroke="url(#scoreDialGrad)"
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - sweep)}
                style={{ transition: "stroke-dashoffset 0.12s linear" }}
              />
              {[400, 800, 1200, 1600].map((tick) => {
                const t = (tick - 400) / 1200;
                const angle = Math.PI * (1 - t);
                const cx = RADIUS + STROKE + Math.cos(angle) * (RADIUS + STROKE / 2 + 16);
                const cy = RADIUS + STROKE - Math.sin(angle) * (RADIUS + STROKE / 2 + 16);
                return (
                  <text
                    key={tick}
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="11"
                    fontFamily="'Space Mono', monospace"
                    fill={isDarkMode ? "rgba(255,255,255,0.45)" : "rgba(15,23,42,0.5)"}
                    fontWeight="600"
                  >
                    {tick}
                  </text>
                );
              })}
            </svg>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: "58%",
                transform: "translateY(-50%)",
                textAlign: "center",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  fontFamily: "'Inter Tight', sans-serif",
                  fontSize: "clamp(56px, 8vw, 92px)",
                  fontWeight: 800,
                  color: "hsl(var(--foreground))",
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "-0.04em",
                }}
              >
                {score}
              </div>
            </div>
          </div>
          <p
            style={{
              maxWidth: 460,
              margin: "28px auto 28px",
              fontSize: 16,
              lineHeight: 1.6,
              fontWeight: 300,
              color: isDarkMode ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.62)",
            }}
          >
            Convert raw practice results into a real Digital SAT score using official scoring curves.
          </p>
          <button
            onClick={() => navigate("/score-calculator")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "13px 30px",
              borderRadius: 10,
              background: "hsl(201,100%,42%)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              border: "none",
              cursor: "pointer",
              fontFamily: "'Geist', sans-serif",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "hsl(201,100%,36%)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "hsl(201,100%,42%)")}
          >
            Try the score calculator
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
});
ScoreDialSection.displayName = "ScoreDialSection";

// ─── Streak heatmap section (scroll-driven contribution grid) ──────────────

const StreakHeatmapSection = memo(({ isDarkMode }: { isDarkMode: boolean }) => {
  const navigate = useNavigate();
  const COLS = 26;
  const ROWS = 7;
  const TOTAL = COLS * ROWS;

  const [hoveredCell, setHoveredCell] = useState<{ idx: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (hoveredCell === null) return;
    const dismiss = () => setHoveredCell(null);
    window.addEventListener("scroll", dismiss, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", dismiss, { capture: true });
  }, [hoveredCell]);

  const intensities = useMemo(() => {
    const seedRand = (seed: number) => {
      const x = Math.sin(seed * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    return Array.from({ length: TOTAL }).map((_, i) => {
      const trend = (i / TOTAL) * 0.55;
      const noise = seedRand(i + 1);
      if (noise < 0.18) return 0;
      return Math.max(0, Math.min(1, trend + noise * 0.65 - 0.05));
    });
  }, []);

  const sectionRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    let pending = false;
    const compute = () => {
      pending = false;
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const raw = total > 0 ? -rect.top / total : 0;
      setProgress(Math.max(0, Math.min(1, raw)));
    };
    const schedule = () => {
      if (pending) return;
      pending = true;
      raf = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  const sweep = Math.max(0, Math.min(1, (progress - 0.1) / 0.75));
  const fillCount = Math.floor(sweep * TOTAL);

  return (
    <div ref={sectionRef} style={{ position: "relative", height: "200vh" }}>
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
        className="streak-section-grid"
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
            — Daily streaks
          </div>
          <h2
            style={{
              fontFamily: "'Geist', Georgia, serif",
              fontSize: "clamp(40px, 5.5vw, 68px)",
              lineHeight: 0.98,
              letterSpacing: "-0.025em",
              color: "hsl(var(--foreground))",
              margin: "0 0 22px",
            }}
          >
            A little every day,
            <br />
            <em style={{ fontStyle: "normal", color: "hsl(201,100%,70%)" }}>adds up fast.</em>
          </h2>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.65,
              fontWeight: 300,
              color: isDarkMode ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.62)",
              maxWidth: 420,
              margin: "0 0 28px",
            }}
          >
            Turn consistent studying into meaningful score improvements.
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
              fontFamily: "'Geist', sans-serif",
            }}
          >
            Start a streak
            <ArrowRight size={14} />
          </button>
        </div>
        <div style={{ position: "relative" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gap: 4,
              position: "relative",
            }}
          >
            {Array.from({ length: COLS * ROWS }).map((_, idx) => {
              const c = idx % COLS;
              const r = Math.floor(idx / COLS);
              const visitOrder = c * ROWS + r;
              const visible = visitOrder < fillCount;
              const v = intensities[visitOrder];
              let color: string;
              if (!visible || v === 0) {
                color = isDarkMode ? "rgba(255,255,255,0.045)" : "rgba(15,23,42,0.06)";
              } else {
                const alpha = 0.35 + v * 0.6;
                const lightness = 75 - v * 28;
                color = `hsla(201, 100%, ${lightness}%, ${alpha})`;
              }
              const daysAgo = TOTAL - 1 - visitOrder;
              const cellDate = new Date(Date.now() - daysAgo * 86400000);
              const questions = visible && v > 0 ? Math.max(1, Math.round(v * 22)) : 0;
              const isFilled = visible && v > 0;
              return (
                <div
                  key={idx}
                  onMouseEnter={isFilled ? (e) => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setHoveredCell({ idx: visitOrder, x: rect.left + rect.width / 2, y: rect.top });
                  } : undefined}
                  onMouseLeave={isFilled ? () => setHoveredCell(null) : undefined}
                  style={{
                    aspectRatio: "1 / 1",
                    background: color,
                    borderRadius: 3,
                    transition: "background 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
                    cursor: isFilled ? "default" : undefined,
                  }}
                  data-visit={visitOrder}
                  data-date={cellDate.toISOString().slice(0, 10)}
                  data-questions={questions}
                />
              );
            })}
            {hoveredCell !== null && (() => {
              const daysAgo = TOTAL - 1 - hoveredCell.idx;
              const cellDate = new Date(Date.now() - daysAgo * 86400000);
              const v = intensities[hoveredCell.idx];
              const questions = v > 0 ? Math.max(1, Math.round(v * 22)) : 0;
              const dateStr = cellDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              return (
                <div
                  style={{
                    position: "fixed",
                    left: hoveredCell.x,
                    top: hoveredCell.y - 8,
                    transform: "translate(-50%, -100%)",
                    background: isDarkMode ? "rgba(15,23,42,0.95)" : "rgba(255,255,255,0.97)",
                    border: `1px solid ${isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)"}`,
                    borderRadius: 8,
                    padding: "7px 11px",
                    fontSize: 12,
                    fontWeight: 500,
                    color: isDarkMode ? "rgba(255,255,255,0.85)" : "rgba(15,23,42,0.85)",
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                    zIndex: 9999,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
                    fontFamily: "'Geist', sans-serif",
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ color: "hsl(201,100%,65%)", fontWeight: 600, marginBottom: 2 }}>
                    {questions === 0 ? "No questions" : `${questions} question${questions === 1 ? "" : "s"}`}
                  </div>
                  <div style={{ opacity: 0.65, fontSize: 11 }}>{dateStr}</div>
                </div>
              );
            })()}
          </div>
          <div
            style={{
              marginTop: 14,
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: isDarkMode ? "rgba(255,255,255,0.4)" : "rgba(15,23,42,0.45)",
            }}
          >
            <span>Less</span>
            {[0.15, 0.4, 0.65, 0.9].map((v) => (
              <div
                key={v}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  background: `hsla(201, 100%, ${75 - v * 28}%, ${0.35 + v * 0.6})`,
                }}
              />
            ))}
            <span>More</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
});
StreakHeatmapSection.displayName = "StreakHeatmapSection";

// ─── Home page ─────────────────────────────────────────────────────────────

const Home = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [difficulties, setDifficulties] = useState<DifficultyPill[]>([]);
  const [subjects, setSubjects] = useState<SubjectPill[]>([]);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const isDarkMode = useThemeMode();
  const totalQuestions = DEFAULT_QUESTION_BANK_TOTAL;

  const heroSubject: "math" | "reading" =
    subjects.length === 1 ? subjects[0] : "math";
  const heroDifficulty: "Easy" | "Medium" | "Hard" | null =
    difficulties.length === 1
      ? ((difficulties[0].charAt(0).toUpperCase() +
          difficulties[0].slice(1)) as "Easy" | "Medium" | "Hard")
      : null;

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
      @keyframes floatSymUp {
        0%   { transform: translateY(0) rotate(-4deg); opacity: 0; }
        12%  { opacity: 1; }
        88%  { opacity: 1; }
        100% { transform: translateY(-130vh) rotate(18deg); opacity: 0; }
      }
      .float-sym {
        position: absolute;
        bottom: -80px;
        font-family: 'Geist', Georgia, serif;
        font-style: italic;
        animation: floatSymUp linear infinite;
        pointer-events: none;
        user-select: none;
        will-change: transform, opacity;
      }
.chip-cascade {
        opacity: 0;
        transform: translateY(14px);
        transition: opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1), transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .chip-cascade.in {
        opacity: 1;
        transform: translateY(0);
      }
      .h-fade-1 { animation: homeFadeUp 0.75s ease 0.1s both; }
      .h-fade-2 { animation: homeFadeUp 0.75s ease 0.22s both; }
      .h-fade-3 { animation: homeFadeUp 0.75s ease 0.36s both; }
      .h-fade-4 { animation: homeFadeUp 0.75s ease 0.5s both; }
      .h-fade-5 { animation: homeFadeUp 0.75s ease 0.64s both; }
      .h-fade-6 { animation: homeFadeUp 0.85s ease 0.8s both; }
      .demo-float { animation: demoFloat 5.5s ease-in-out infinite; }

      /* Mobile-only overrides for the home page. Desktop keeps its
         lavish spacing and animations. */
      @media (max-width: 767px) {
        .h-fade-1, .h-fade-2, .h-fade-3, .h-fade-4, .h-fade-5, .h-fade-6,
        .demo-float, .explanation-step-slide {
          animation: none !important;
          opacity: 1 !important;
          transform: none !important;
        }
        .float-sym { display: none !important; }
        .streak-section-grid {
          grid-template-columns: 1fr !important;
          gap: 32px !important;
        }
        .home-hero {
          padding: 32px 16px 0 !important;
        }
        .home-hero h1 {
          font-size: clamp(40px, 12vw, 64px) !important;
          margin: 0 0 16px !important;
        }
        .home-hero p.home-subtitle {
          font-size: 15px !important;
          margin: 0 auto 22px !important;
        }
        .home-cta-row {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 10px !important;
          margin-bottom: 32px !important;
        }
        .home-cta-row button {
          width: 100% !important;
          padding: 14px 22px !important;
          justify-content: center !important;
        }
        .home-counter { margin-bottom: 40px !important; }
        .home-counter .home-count-num { font-size: 40px !important; }
        .home-demo-wrap { padding: 0 12px !important; }
        .home-demo-title { font-size: clamp(22px, 6vw, 28px) !important; }
        .home-demo-subtitle { font-size: 14px !important; margin-top: 10px !important; }
        .home-cta-final h2 { font-size: clamp(30px, 9vw, 42px) !important; }
        .home-cta-final button { padding: 14px 28px !important; }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(link);
      document.getElementById("home-keyframes")?.remove();
    };
  }, []);

  useEffect(() => {
    const updateHeaderState = () => {
      setIsHeaderScrolled(window.scrollY > 12);
    };

    updateHeaderState();
    window.addEventListener("scroll", updateHeaderState, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateHeaderState);
    };
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ fontFamily: "'Geist', 'Inter', system-ui, sans-serif" }}
    >
      <header
        className={`sticky top-0 z-20 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ${
          isHeaderScrolled
            ? "border-border/45 bg-card/85 shadow-[0_10px_32px_rgba(15,23,42,0.06)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/78"
            : "border-border bg-card/95 backdrop-blur"
        }`}
      >
        <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-3 sm:px-4">
          <BrandLogo variant="mark" className="h-9 w-9" />

          {/* Top nav — Inter 500, 14px, tracking -0.5%, ink. Hover opacity 0.7, never underline. */}
          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
            <Link
              to="/bank"
              className="rounded-md px-3 py-1.5 font-sans text-[14px] font-medium tracking-[-0.005em] text-ink transition-opacity hover:opacity-70"
            >
              Question Bank
            </Link>
            <Link
              to="/hard"
              className="rounded-md px-3 py-1.5 font-sans text-[14px] font-medium tracking-[-0.005em] text-ink transition-opacity hover:opacity-70"
            >
              100 Hard Math Questions
            </Link>
            <Link
              to="/modules"
              className="rounded-md px-3 py-1.5 font-sans text-[14px] font-medium tracking-[-0.005em] text-ink transition-opacity hover:opacity-70"
            >
              Practice Tests
            </Link>
            <Link
              to="/score-calculator"
              className="rounded-md px-3 py-1.5 font-sans text-[14px] font-medium tracking-[-0.005em] text-ink transition-opacity hover:opacity-70"
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
                {/* Log In — text only, Inter 500. */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex !rounded-full !font-medium"
                  onClick={() => navigate("/login")}
                >
                  Log In
                </Button>
                {/* Sign Up — Inter 600, ink on accent, full pill on marketing nav. */}
                <Button size="sm" className="!rounded-full" onClick={() => navigate("/signup")}>
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
        {/* Floating math symbols */}
        <FloatingMathSymbols isDarkMode={isDarkMode} />
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
          className="home-hero"
          style={{
            position: "relative",
            maxWidth: 860,
            margin: "0 auto",
            padding: "76px 24px 0",
            textAlign: "center",
          }}
        >
          {/* Headline — Geist 500, clamp 44-84px, leading 0.98, tracking -3.5%
              (matches design system home spec). */}
          <h1
            className="h-fade-2"
            style={{
              fontFamily: "'Geist', system-ui, sans-serif",
              fontWeight: 500,
              fontSize: "clamp(44px, 6.8vw, 96px)",
              lineHeight: 0.98,
              color: "rgb(var(--ink))",
              margin: "0 0 26px",
              letterSpacing: "-0.035em",
            }}
          >
            Reach your
            <br />
            {/* Cobalt gradient accent — design system swaps the old serif-italic
                for a Geist 600 word painted with the cobalt → cobalt-deep ramp. */}
            <span
              style={{
                fontFamily: "'Geist', system-ui, sans-serif",
                fontWeight: 600,
                letterSpacing: "-0.035em",
                backgroundImage:
                  "linear-gradient(180deg, rgb(var(--cobalt)) 0%, rgb(var(--cobalt-deep)) 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              best score.
            </span>
          </h1>

          {/* Subtitle — Geist 300, 19px lede, leading 1.55, ink-mid. */}
          <p
            className="h-fade-3 home-subtitle"
            style={{
              fontFamily: "'Geist', system-ui, sans-serif",
              fontSize: 19,
              color: "rgb(var(--ink-mid))",
              maxWidth: 540,
              margin: "0 auto 38px",
              lineHeight: 1.55,
              fontWeight: 300,
            }}
          >
            Accurate SAT practice built from real past tests.
          </p>

          {/* CTAs */}
          <div
            className="h-fade-4 home-cta-row"
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
                padding: "14px 22px",
                borderRadius: 10,
                background: "rgb(var(--ds-accent))",
                color: "rgb(var(--ink))",
                fontWeight: 500,
                fontSize: 15,
                border: "none",
                cursor: "pointer",
                fontFamily: "'Geist', system-ui, sans-serif",
                letterSpacing: "-0.005em",
                boxShadow:
                  isDarkMode
                    ? "0 0 36px rgba(125,211,252,0.28), 0 4px 18px rgba(0,0,0,0.22)"
                    : "0 10px 30px rgba(56,189,248,0.22)",
                transition:
                  "transform 0.14s, box-shadow 0.14s, background-color 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.transform = "translateY(-2px)";
                el.style.background = "rgb(var(--cobalt))";
                el.style.color = "#fff";
                el.style.boxShadow =
                  "0 16px 36px rgba(58,120,216,0.34), 0 4px 14px rgba(58,120,216,0.28)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.transform = "translateY(0)";
                el.style.background = "rgb(var(--ds-accent))";
                el.style.color = "rgb(var(--ink))";
                el.style.boxShadow = isDarkMode
                  ? "0 0 36px rgba(125,211,252,0.28), 0 4px 18px rgba(0,0,0,0.22)"
                  : "0 10px 30px rgba(56,189,248,0.22)";
              }}
              onMouseDown={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "rgb(var(--cobalt-deep))";
                el.style.color = "#fff";
                el.style.transform = "scale(0.98)";
              }}
              onMouseUp={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "rgb(var(--cobalt))";
                el.style.transform = "translateY(-2px)";
              }}
            >
              Explore question bank
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => navigate("/modules")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "14px 22px",
                borderRadius: 10,
                background: isDarkMode
                  ? "rgba(255,255,255,0.055)"
                  : "rgba(255,255,255,0.78)",
                color: isDarkMode
                  ? "rgba(255,255,255,0.88)"
                  : "rgb(var(--ink))",
                fontWeight: 500,
                fontSize: 15,
                border: isDarkMode
                  ? "1px solid rgba(255,255,255,0.11)"
                  : "1px solid rgba(14,33,56,0.10)",
                cursor: "pointer",
                fontFamily: "'Geist', system-ui, sans-serif",
                letterSpacing: "-0.005em",
                transition: "background 0.14s, border-color 0.14s, color 0.14s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = isDarkMode
                  ? "rgba(180,225,255,0.12)"
                  : "rgba(232,244,251,0.95)";
                el.style.borderColor = "rgb(var(--cobalt))";
                el.style.color = isDarkMode
                  ? "rgb(var(--cobalt-ink))"
                  : "rgb(var(--cobalt-deep))";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = isDarkMode
                  ? "rgba(255,255,255,0.055)"
                  : "rgba(255,255,255,0.78)";
                el.style.borderColor = isDarkMode
                  ? "rgba(255,255,255,0.11)"
                  : "rgba(15,23,42,0.12)";
                el.style.color = isDarkMode
                  ? "rgba(255,255,255,0.88)"
                  : "rgb(var(--ink))";
              }}
            >
              Practice Tests
            </button>
          </div>

          {/* Counter */}
          <div className="h-fade-5 home-counter" style={{ marginBottom: 88 }}>
            {/* Hero stat — Inter Tight 700, clamp 64-132px, tabular nums, comma-grouped. */}
            <div
              className="home-count-num"
              style={{
              fontSize: "clamp(64px, 8.6vw, 132px)",
              fontFamily: "'Inter Tight', sans-serif",
              fontWeight: 700,
              color: "rgb(var(--ink))",
              letterSpacing: "-0.04em",
              lineHeight: 0.95,
              fontVariantNumeric: "tabular-nums",
              fontFeatureSettings: "'tnum'",
              }}
            >
              <SlotMachineCounter value={totalQuestions} />
            </div>
            {/* Caption — Geist 600, 11px, +32% tracking (wide because the number above is giant). */}
            <div
              style={{
                fontFamily: "'Geist', system-ui, sans-serif",
                fontSize: 11,
                color: "rgb(var(--ink-muted))",
                marginTop: 14,
                letterSpacing: "0.32em",
                textTransform: "uppercase",
                fontWeight: 600,
                lineHeight: 1,
              }}
            >
              Practice questions
            </div>
          </div>
        </div>

        {/* Floating demo */}
        <div
          className="h-fade-6 home-demo-wrap"
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 24px",
            position: "relative",
          }}
        >
          {/* Section header */}
          <div
            style={{
              textAlign: "center",
              margin: "0 auto 28px",
              maxWidth: 720,
            }}
          >
            {/* Section heading — Geist 500, 52px responsive, leading 1.05, tracking -3.5%. */}
            <h2
              className="home-demo-title"
              style={{
                fontFamily: "'Geist', system-ui, sans-serif",
                fontSize: "clamp(28px, 4.4vw, 52px)",
                fontWeight: 500,
                letterSpacing: "-0.035em",
                lineHeight: 1.05,
                color: "rgb(var(--ink))",
                margin: 0,
              }}
            >
              An interface so easy, you can use it right here.
            </h2>
          </div>

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
          <ParallaxTilt max={3}>
            <HeroQuestionPreview
              isDarkMode={isDarkMode}
              subject={heroSubject}
              difficulty={heroDifficulty}
            />
          </ParallaxTilt>
        </div>

        {/* Fade gradient into next section — tall + immediate so the
            hero's blue tint blends smoothly into the page background instead
            of meeting it at a hard band. */}
        <div
          style={{
            height: 240,
            marginTop: 64,
            background:
              "linear-gradient(to bottom, transparent 0%, hsl(var(--background)) 92%)",
          }}
        />
      </section>

      {/* ── FEATURE ROW — BANK FILTERS ────────────────────────────────── */}
      <section className="bg-background">
        <FilterFeatureSection
          isDarkMode={isDarkMode}
          totalQuestions={totalQuestions}
        />
      </section>

      {/* ── SCROLL-DRIVEN EXPLANATION WITH SPOTLIGHT ─────────────────── */}
      <section className="bg-background">
        <ExplanationFeatureSection isDarkMode={isDarkMode} />
      </section>

      {/* ── SCORE DIAL ─────────────────────────────────────────────────── */}
      <section className="bg-background">
        <ScoreDialSection isDarkMode={isDarkMode} />
      </section>

      {/* ── FEATURE ROW — PROGRESS ─────────────────────────────────────── */}
      <section className="bg-background">
        <FeatureRow
          eyebrow="Progress tracking"
          title="Watch your"
          titleEm="accuracy climb."
          body="Per-domain accuracy, trends over time, and a clear view of which skills to focus on next."
          ctaLabel={user ? "View your stats" : "Create free account"}
          ctaHref={user ? "/analysis" : "/signup"}
          demo={<AnimatedAccuracyChart isDarkMode={isDarkMode} />}
          reverse
          isDarkMode={isDarkMode}
        />
      </section>

      {/* ── STREAK HEATMAP ─────────────────────────────────────────────── */}
      <section className="bg-background">
        <StreakHeatmapSection isDarkMode={isDarkMode} />
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="home-cta-final" style={{ padding: "0px 24px 96px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", textAlign: "center" }}>
          <h2
            style={{
              fontFamily: "'Geist', Georgia, serif",
              fontSize: "clamp(36px, 5vw, 60px)",
              fontWeight: 400,
              letterSpacing: "-0.025em",
              color: "hsl(var(--foreground))",
              margin: "0 0 28px",
              lineHeight: 1,
            }}
          >
            {user ? (
              <>Practice Now.</>
            ) : (
              <>
                Always{" "}
                <em style={{ fontStyle: "normal", color: "hsl(201,100%,70%)" }}>
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
              fontFamily: "'Geist', sans-serif",
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
