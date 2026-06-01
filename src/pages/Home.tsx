import { Suspense, lazy, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { BrandLogo } from "@/components/brand/BrandLogo";
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
import { SatScoreCard } from "@/components/practice/SatScoreCard";
import {
  MAX_TIME_SPENT_FILTER_SECONDS,
  type QuestionBankFilters,
} from "@/components/question/questionBankFilterModel";
import { useThemeMode } from "@/hooks/useThemeMode";
import { BANK_TOTAL_ALL } from "@/lib/generated/bankTotals.generated";
import { cn } from "@/lib/utils";
import { renderMixedContent } from "@/lib/text/mathRendering";
import "katex/dist/katex.min.css";

const DEFAULT_QUESTION_BANK_TOTAL = BANK_TOTAL_ALL;
const PRACTICE_TESTS_COUNT = 34;

const InlineDesmos = lazy(() =>
  import("@/components/tools/InlineDesmos").then((mod) => ({ default: mod.InlineDesmos })),
);
const EmbeddedQuestionPreview = lazy(() =>
  import("@/pages/bank/Question").then((mod) => ({ default: mod.Question })),
);
const EmbeddedBankIndexPreview = lazy(() =>
  import("@/pages/bank/BankIndex").then((mod) => ({ default: mod.BankIndex })),
);
const defaultBankFilters: QuestionBankFilters = {
  difficulty: [],
  timeSpentRange: [0, MAX_TIME_SPENT_FILTER_SECONDS],
  activeQuestions: "all",
  markedForReview: "all",
  solved: "all",
  answeredIncorrectly: "all",
};
const HOME_DEMO_USER_SCROLL_EVENT = "home-demo-user-scroll";

const forwardHomeScroll = (deltaX: number, deltaY: number) => {
  if (!deltaX && !deltaY) return;
  window.dispatchEvent(new Event(HOME_DEMO_USER_SCROLL_EVENT));
  window.scrollBy({ left: deltaX, top: deltaY, behavior: "auto" });
};

const useForwardScrollToPage = <T extends HTMLElement>(
  ref: { current: T | null },
  enabled = true,
) => {
  useEffect(() => {
    if (!enabled) return;
    const node = ref.current;
    if (!node) return;

    let lastTouchX: number | null = null;
    let lastTouchY: number | null = null;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      forwardHomeScroll(event.deltaX, event.deltaY);
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        lastTouchX = null;
        lastTouchY = null;
        return;
      }
      lastTouchX = event.touches[0].clientX;
      lastTouchY = event.touches[0].clientY;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1 || lastTouchX === null || lastTouchY === null) return;
      const touch = event.touches[0];
      const deltaX = lastTouchX - touch.clientX;
      const deltaY = lastTouchY - touch.clientY;
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
      if (Math.abs(deltaX) + Math.abs(deltaY) < 1) return;
      event.preventDefault();
      event.stopPropagation();
      forwardHomeScroll(deltaX, deltaY);
    };
    const resetTouch = () => {
      lastTouchX = null;
      lastTouchY = null;
    };

    node.addEventListener("wheel", onWheel, { passive: false, capture: true });
    node.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    node.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    node.addEventListener("touchend", resetTouch, { capture: true });
    node.addEventListener("touchcancel", resetTouch, { capture: true });

    return () => {
      node.removeEventListener("wheel", onWheel, { capture: true });
      node.removeEventListener("touchstart", onTouchStart, { capture: true });
      node.removeEventListener("touchmove", onTouchMove, { capture: true });
      node.removeEventListener("touchend", resetTouch, { capture: true });
      node.removeEventListener("touchcancel", resetTouch, { capture: true });
    };
  }, [enabled, ref]);
};

const HERO_PREVIEW_SCALE = 0.85;
const HERO_PREVIEW_LOGICAL_HEIGHT = 760;
const HERO_PREVIEW_MOBILE_SCALE = 0.55;

const HERO_PREVIEW_MOBILE_LOGICAL_HEIGHT = 640;

const HomeSkeletonBlock = ({
  isDarkMode,
  className,
  style,
}: {
  isDarkMode: boolean;
  className: string;
  style?: React.CSSProperties;
}) => (
  <div
    className={`motion-safe:animate-pulse ${className}`}
    style={{
      background: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(14,33,56,0.08)",
      ...style,
    }}
  />
);

const HomePreviewSkeleton = memo(({
  isDarkMode,
  variant,
  style,
}: {
  isDarkMode: boolean;
  variant: "question" | "filters";
  style?: React.CSSProperties;
}) => {
  const panelBg = isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.82)";
  const borderColor = isDarkMode ? "rgba(255,255,255,0.09)" : "rgba(15,23,42,0.08)";
  const softBg = isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(14,33,56,0.035)";
  const accentBg = isDarkMode ? "rgba(125,211,252,0.15)" : "rgba(56,189,248,0.16)";

  if (variant === "filters") {
    return (
      <div
        aria-hidden
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          borderRadius: 14,
          border: `1px solid ${borderColor}`,
          background: panelBg,
          pointerEvents: "none",
          ...style,
        }}
      >
        <div className="flex h-full flex-col p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="space-y-2">
              <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-5 w-40 rounded-full" />
              <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-3 w-56 rounded-full" />
            </div>
            <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-8 w-24 rounded-md" style={{ background: accentBg }} />
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-[0.56fr_1fr] gap-4">
            <div className="space-y-3 rounded-lg p-3" style={{ background: softBg }}>
              {[0, 1, 2, 3, 4].map((item) => (
                <div key={item} className="space-y-2">
                  <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-3 w-2/3 rounded-full" />
                  <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-8 w-full rounded-md" />
                </div>
              ))}
            </div>
            <div className="grid min-h-0 grid-cols-2 gap-3">
              {[0, 1].map((column) => (
                <div key={column} className="space-y-3 rounded-lg p-3" style={{ background: softBg }}>
                  <div className="flex items-center gap-3">
                    <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-9 w-9 rounded-lg" style={{ background: accentBg }} />
                    <div className="space-y-2">
                      <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-4 w-28 rounded-full" />
                      <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-3 w-20 rounded-full" />
                    </div>
                  </div>
                  {[0, 1, 2, 3, 4, 5].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-4 w-4 rounded" />
                      <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-3 flex-1 rounded-full" />
                      <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-3 w-10 rounded-full" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        borderRadius: 14,
        border: `1px solid ${borderColor}`,
        background: panelBg,
        pointerEvents: "none",
        ...style,
      }}
    >
      <div className="flex h-full flex-col p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-2">
            <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-7 w-16 rounded-full" style={{ background: accentBg }} />
            <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-7 w-24 rounded-full" />
          </div>
          <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-8 w-28 rounded-md" />
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_0.92fr] gap-5">
          <div className="space-y-3 rounded-lg p-4" style={{ background: softBg }}>
            <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-4 w-28 rounded-full" />
            <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-4 w-full rounded-full" />
            <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-4 w-11/12 rounded-full" />
            <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-4 w-4/5 rounded-full" />
            <HomeSkeletonBlock isDarkMode={isDarkMode} className="mt-4 h-40 w-full rounded-lg" style={{ background: accentBg }} />
          </div>
          <div className="space-y-3">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-lg p-3" style={{ background: softBg }}>
                <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-7 w-7 shrink-0 rounded-full" />
                <div className="w-full space-y-2">
                  <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-3 w-full rounded-full" />
                  <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-3 w-3/4 rounded-full" />
                </div>
              </div>
            ))}
          </div>
      </div>
    </div>
    </div>
  );
});
HomePreviewSkeleton.displayName = "HomePreviewSkeleton";

const HeroQuestionPreview = memo(({
  isDarkMode,
  onOpenBank,
  ready = true,
}: {
  isDarkMode: boolean;
  onOpenBank?: () => void;
  // When false, render a same-size skeleton and defer the native preview until
  // the hero counter has finished animating.
  ready?: boolean;
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(true);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<{ subject: "math" | "reading"; id: string }>({
    subject: "math",
    id: "1",
  });
  const windowShadow = isDarkMode
    ? "0 0 0 1px rgba(255,255,255,0.07), 0 40px 100px rgba(0,0,0,0.55), 0 0 80px rgba(125,211,252,0.07)"
    : "0 0 0 1px rgba(15,23,42,0.08), 0 24px 64px rgba(15,23,42,0.12), 0 0 48px rgba(56,189,248,0.1)";
  const handlePreviewReady = useCallback(() => setPreviewLoaded(true), []);
  const handlePreviewNavigate = useCallback((to: string) => {
    const url = new URL(to, window.location.origin);
    if (url.pathname === "/bank") {
      onOpenBank?.();
      return;
    }
    const match = url.pathname.match(/^\/bank\/(math|reading)\/([^/]+)/);
    if (!match) return;
    setPreviewLoaded(false);
    setPreviewQuestion({
      subject: match[1] as "math" | "reading",
      id: decodeURIComponent(match[2]),
    });
  }, [onOpenBank]);
  const previewEmbed = useMemo(() => ({
    subject: previewQuestion.subject,
    id: previewQuestion.id,
    bankType: "past" as const,
    isDarkMode,
    onNavigate: handlePreviewNavigate,
    onOpenBank,
    onReady: handlePreviewReady,
  }), [handlePreviewNavigate, handlePreviewReady, isDarkMode, onOpenBank, previewQuestion.id, previewQuestion.subject]);

  // Scale the native preview down: render at logical size then transform. The
  // outer box clamps visual size; internal coordinates stay aligned.
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
  useForwardScrollToPage(rootRef, ready && nearViewport);
  useEffect(() => {
    if (!ready || !nearViewport) setPreviewLoaded(false);
  }, [nearViewport, ready]);
  useEffect(() => {
    if (nearViewport) return;
    const node = rootRef.current;
    if (!node) return;
    const margin = 180;
    const checkNearViewport = () => {
      const rect = node.getBoundingClientRect();
      if (rect.bottom < -margin || rect.top > window.innerHeight + margin) return false;
      setNearViewport(true);
      return true;
    };
    if (checkNearViewport()) return;
    if (!("IntersectionObserver" in window)) {
      setNearViewport(true);
      return;
    }
    const checkTimer = window.setTimeout(checkNearViewport, 150);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: "180px 0px" },
    );
    observer.observe(node);
    window.addEventListener("scroll", checkNearViewport, { passive: true });
    window.addEventListener("resize", checkNearViewport);
    return () => {
      window.clearTimeout(checkTimer);
      observer.disconnect();
      window.removeEventListener("scroll", checkNearViewport);
      window.removeEventListener("resize", checkNearViewport);
    };
  }, [nearViewport]);
  const frameStyle: React.CSSProperties = {
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: windowShadow,
    width: "100%",
    height: visibleHeight,
    position: "relative",
  };

  if (!ready || !nearViewport) {
    return (
      <div
        ref={rootRef}
        className="bg-card"
        style={frameStyle}
      >
        <HomePreviewSkeleton isDarkMode={isDarkMode} variant="question" />
      </div>
    );
  }
  return (
    <div
      ref={rootRef}
      className="bg-card"
      style={frameStyle}
    >
      <div
        style={{
          width: `${100 / activeScale}%`,
          height: activeLogicalHeight,
          display: "block",
          background: "transparent",
          transform: `scale(${activeScale})`,
          transformOrigin: "top left",
          opacity: previewLoaded ? 1 : 0,
          transition: "opacity 220ms ease",
        }}
      >
        <Suspense fallback={null}>
          <EmbeddedQuestionPreview previewEmbed={previewEmbed} />
        </Suspense>
      </div>
      {!previewLoaded && (
        <HomePreviewSkeleton
          isDarkMode={isDarkMode}
          variant="question"
          style={{ position: "absolute", inset: 0, zIndex: 1 }}
        />
      )}
    </div>
  );
});
HeroQuestionPreview.displayName = "HeroQuestionPreview";
const ExplanationFeatureSection = memo(({ isDarkMode }: { isDarkMode: boolean }) => {
  const navigate = useNavigate();
  const rowRef = useRef<HTMLDivElement>(null);
  const isNear = useIsNearViewport(rowRef, "300px 0px");
  return (
    <div
      ref={rowRef}
      className="explanation-feature-row"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.15fr)",
        gap: 64,
        alignItems: "center",
        padding: "96px 24px",
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      {/* Left — heading, body, CTA */}
      <div>
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
          type="button"
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

      {/* Right — native question preview with the explanation popup
          auto-opening and stepping. Cursor overlay animates over its Next
          button. */}
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
          <ParallaxTilt max={3}>
            <AnimatedExplanation isDarkMode={isDarkMode} active={isNear} />
          </ParallaxTilt>
        </div>
      </div>
    </div>
  );
});
ExplanationFeatureSection.displayName = "ExplanationFeatureSection";

// Auto-cycling explanation card mirroring StepByStepExplanation's chrome.
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

const AnimatedExplanation = memo(({ isDarkMode, active }: { isDarkMode: boolean; active: boolean }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [animKey, setAnimKey] = useState(0);
  const [paused, setPaused] = useState(false);

  const totalSteps = EXPLANATION_STEPS.length;

  useForwardScrollToPage(scrollRef);

  useEffect(() => {
    if (paused || !active) return;
    const t = setInterval(() => {
      setDirection(1);
      setCurrentStep((s) => (s + 1) % totalSteps);
      setAnimKey((k) => k + 1);
    }, 3600);
    return () => clearInterval(t);
  }, [active, paused, totalSteps]);

  const goTo = (target: number) => {
    setPaused(true);
    setDirection(target > currentStep ? 1 : -1);
    setCurrentStep(Math.max(0, Math.min(totalSteps - 1, target)));
    setAnimKey((k) => k + 1);
  };

  const step = EXPLANATION_STEPS[currentStep];
  const isLast = currentStep === totalSteps - 1;
  const stepBodyHtml = renderMixedContent(step.body, { convertTexLineBreaks: false });

  return (
    <div
      ref={scrollRef}
      className="rounded-[14px] overflow-hidden border border-border bg-card flex flex-col"
      style={{
        height: 528,
        boxShadow: isDarkMode
          ? "0 20px 60px rgba(0,0,0,0.5)"
          : "0 20px 50px rgba(15,23,42,0.1)",
      }}
    >
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
            <div
              className="text-[15px] leading-snug pl-9 explanation-content text-foreground/90"
              dangerouslySetInnerHTML={{ __html: stepBodyHtml }}
            />
            {step.desmos && (
              <div className="ml-9 mt-2">
                <Suspense
                  fallback={
                    <div
                      className="rounded-lg border border-primary/20 overflow-hidden bg-background"
                      style={{ height: 220 }}
                    />
                  }
                >
                  <InlineDesmos expressions={step.desmos} height={220} forwardScrollToPage />
                </Suspense>
              </div>
            )}
          </div>
        </div>
      </div>

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
});
AnimatedExplanation.displayName = "AnimatedExplanation";

// ─── Question bank feature section ───────────────────────────────────────────
//
// Left side: heading + CTA. Right side: a mocked "Question Bank" window with an
// auto-cursor that visits filter controls and toggles them. The window is NOT a
// real bank route — we render a stand-alone React mock so a signed-in viewer never
// sees their own progress here. Counts are computed for a "blank user": any
// filter that depends on personal progress (Solved/Marked/Incorrect/Time Spent)
// collapses the result to zero, since a fresh account has no recorded activity.

const FilterFeatureSection = memo(({
  isDarkMode,
  totalQuestions,
}: {
  isDarkMode: boolean;
  totalQuestions: number;
}) => {
  const navigate = useNavigate();
  return (
    <div
      className="filter-feature-row"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.38fr) minmax(300px, 0.82fr)",
        gap: 72,
        alignItems: "center",
        padding: "112px 24px",
        maxWidth: 1380,
        margin: "0 auto",
      }}
    >
      {/* Left — inline filter panel demo (real components, auto-cursor drives
          real state updates). */}
      <div className="filter-demo-shell" style={{ position: "relative", minWidth: 0, width: "100%" }}>
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
          <ParallaxTilt max={3}>
            <BankFilterInlineDemo isDarkMode={isDarkMode} />
          </ParallaxTilt>
        </div>
      </div>

      {/* Right — heading, body, CTA */}
      <div>
        <h2
          style={{
            fontFamily: "'Geist', system-ui, sans-serif",
            fontWeight: 500,
            fontSize: "clamp(36px, 4.6vw, 60px)",
            lineHeight: 1,
            letterSpacing: "-0.035em",
            color: "rgb(var(--ink))",
            margin: "0 0 22px",
          }}
        >
          Every question,{" "}
          <em
            style={{
              fontStyle: "normal",
              fontWeight: 600,
              color: "rgb(var(--cobalt))",
            }}
          >
            instantly filterable.
          </em>
        </h2>
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.6,
            fontWeight: 300,
            color: isDarkMode ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.62)",
            maxWidth: 440,
            margin: "0 0 28px",
          }}
        >
          Slice {totalQuestions.toLocaleString()} real SAT questions by difficulty, topic, time
          spent, and what you have or haven&rsquo;t solved &mdash; in one click.
        </p>
        <button
          type="button"
          onClick={() => navigate("/bank")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 14,
            fontWeight: 600,
            color: "rgb(var(--cobalt))",
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
    </div>
  );
});
FilterFeatureSection.displayName = "FilterFeatureSection";

// ─── Practice tests feature section ──────────────────────────────────────────
//
// Left: heading + CTA. Right: a cycling score-card mock that shows progress
// across completed full practice tests without using real signed-in data.

const homeScoreProgression = [
  {
    title: "Practice Test 1",
    dateLabel: "March 14, 2026",
    totalScore: 1210,
    readingWritingScore: 600,
    mathScore: 610,
  },
  {
    title: "Practice Test 2",
    dateLabel: "March 28, 2026",
    totalScore: 1290,
    readingWritingScore: 640,
    mathScore: 650,
  },
  {
    title: "Practice Test 3",
    dateLabel: "April 18, 2026",
    totalScore: 1370,
    readingWritingScore: 680,
    mathScore: 690,
  },
  {
    title: "Practice Test 4",
    dateLabel: "May 9, 2026",
    totalScore: 1450,
    readingWritingScore: 720,
    mathScore: 730,
  },
  {
    title: "Practice Test 5",
    dateLabel: "May 23, 2026",
    totalScore: 1510,
    readingWritingScore: 750,
    mathScore: 760,
  },
];

const PracticeTestScoreShowcase = memo(() => {
  const showcaseRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isInView, setIsInView] = useState(false);
  const totalScores = homeScoreProgression.length;
  const activeIndexRef = useRef(0);

  useEffect(() => {
    const node = showcaseRef.current;
    if (!node) return;
    if (!("IntersectionObserver" in window)) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting && entry.intersectionRatio > 0);
      },
      {
        rootMargin: "0px",
        threshold: [0, 0.01],
      },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const advanceScore = useCallback(() => {
    const nextIndex = (activeIndexRef.current + 1) % totalScores;
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
  }, [totalScores]);

  useEffect(() => {
    if (!isInView) return;
    const firstTickId = window.setTimeout(advanceScore, 1150);
    const intervalId = window.setInterval(() => {
      advanceScore();
    }, 6800);
    return () => {
      window.clearTimeout(firstTickId);
      window.clearInterval(intervalId);
    };
  }, [advanceScore, isInView]);

  const getCarouselPosition = useCallback(
    (index: number, centerIndex: number) => {
      const forwardDistance = (index - centerIndex + totalScores) % totalScores;
      if (forwardDistance === 0) return "practice-score-card-current";
      if (forwardDistance === 1) return "practice-score-card-next";
      if (forwardDistance === totalScores - 1) return "practice-score-card-previous";
      return "practice-score-card-hidden";
    },
    [totalScores],
  );

  const getPeekPosition = useCallback(
    (index: number, centerIndex: number) =>
      getCarouselPosition(index, centerIndex).replace("practice-score-card", "practice-score-peek"),
    [getCarouselPosition],
  );

  const previousScoreIndex = (activeIndex - 1 + totalScores) % totalScores;
  const nextScoreIndex = (activeIndex + 1) % totalScores;
  const renderPeekViewport = useCallback(
    (placement: "top" | "bottom", centerIndex: number) => (
      <div
        className={cn(
          "practice-score-peek-viewport",
          `practice-score-peek-viewport-${placement}`,
        )}
        aria-hidden
      >
        {homeScoreProgression.map((score, index) => (
          <div
            key={`${placement}-${score.title}`}
            className={cn("practice-score-peek-layer", getPeekPosition(index, centerIndex))}
            style={{ "--peek-offset": `${index * 18}px` } as React.CSSProperties}
          />
        ))}
      </div>
    ),
    [getPeekPosition],
  );

  return (
    <div
      ref={showcaseRef}
      className="practice-results-showcase"
      style={{
        position: "relative",
        maxWidth: 630,
        marginLeft: "auto",
      }}
    >
      <div className="practice-score-stack">
        {renderPeekViewport("top", previousScoreIndex)}
        {renderPeekViewport("bottom", nextScoreIndex)}
        <div className="practice-score-card-viewport">
          {homeScoreProgression.map((score, index) => {
            const positionClass = getCarouselPosition(index, activeIndex);
            return (
              <div
                key={score.title}
                className={cn("practice-score-card-shell", positionClass)}
                aria-hidden={positionClass !== "practice-score-card-current"}
              >
                <SatScoreCard
                  title={score.title}
                  dateLabel={score.dateLabel}
                  totalScore={score.totalScore}
                  readingWritingScore={score.readingWritingScore}
                  mathScore={score.mathScore}
                  compact
                  showcase
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
PracticeTestScoreShowcase.displayName = "PracticeTestScoreShowcase";

const PracticeTestsFeatureSection = memo(({ isDarkMode }: { isDarkMode: boolean }) => {
  const navigate = useNavigate();
  return (
    <div
      className="practice-tests-feature-row"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.15fr)",
        gap: 64,
        alignItems: "center",
        padding: "68px 24px 54px",
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      <div>
        <h2
          style={{
            fontFamily: "'Geist', system-ui, sans-serif",
            fontWeight: 500,
            fontSize: "clamp(36px, 4.6vw, 60px)",
            lineHeight: 1,
            letterSpacing: "-0.035em",
            color: "rgb(var(--ink))",
            margin: "0 0 22px",
          }}
        >
          {PRACTICE_TESTS_COUNT}{" "}
          <span
            style={{
              display: "inline-block",
              marginRight: 10,
              color: "rgb(var(--ink))",
            }}
          >
            curated
          </span>
          <em
            style={{
              display: "inline-block",
              fontStyle: "normal",
              fontWeight: 600,
              color: "rgb(var(--cobalt))",
            }}
          >
            practice tests.
          </em>
        </h2>
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.6,
            fontWeight: 300,
            color: isDarkMode ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.62)",
            maxWidth: 440,
            margin: "0 0 28px",
          }}
        >
          Full-length SAT practice tests grouped by year, form, subject, and module &mdash;
          take the whole test or just one module at a time.
        </p>
        <button
          type="button"
          onClick={() => navigate("/modules")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 14,
            fontWeight: 600,
            color: "rgb(var(--cobalt))",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
            fontFamily: "'Geist', sans-serif",
          }}
        >
          Browse practice tests
          <ArrowRight size={14} />
        </button>
      </div>

      <div style={{ position: "relative" }}>
        <PracticeTestScoreShowcase />
      </div>
    </div>
  );
});
PracticeTestsFeatureSection.displayName = "PracticeTestsFeatureSection";

const CredibilitySection = memo(() => {
  return null;
});
CredibilitySection.displayName = "CredibilitySection";

const FILTER_DEMO_PREVIEW_WIDTH = 728;
const FILTER_DEMO_PREVIEW_HEIGHT = 580;
const FILTER_DEMO_MAX_SCALE = 1;
const FILTER_DEMO_CURSOR_MIN_DURATION_MS = 420;
const FILTER_DEMO_CURSOR_MAX_DURATION_MS = 2400;
const FILTER_DEMO_CURSOR_SPEED_PX_PER_MS = 0.11;
const FILTER_DEMO_CURSOR_CLICK_PAUSE_MS = 32;
const FILTER_DEMO_CURSOR_MENU_PAUSE_MS = 0;
const FILTER_DEMO_CURSOR_NEXT_STEP_PAUSE_MS = 8;
const FILTER_DEMO_CURSOR_IDLE_RETRY_MS = 900;
const FILTER_DEMO_CURSOR_START_DELAY_MS = 160;
const FILTER_DEMO_CURSOR_CLOSE_MENU_DURATION_MS = 220;
const FILTER_DEMO_MENU_AUTO_CLOSE_CHECK_MS = 90;
const FILTER_DEMO_USER_INTERACTION_PAUSE_MS = 2200;
const FILTER_DEMO_CURSOR_SIZE = 40;
const FILTER_DEMO_CURSOR_HOTSPOT_X = (48 / 128) * FILTER_DEMO_CURSOR_SIZE;
const FILTER_DEMO_CURSOR_HOTSPOT_Y = (40 / 128) * FILTER_DEMO_CURSOR_SIZE;

type FilterDemoMode = "apply" | "clear";
type DemoCursorState = {
  x: number;
  y: number;
  visible: boolean;
  durationMs: number;
};
type FilterDemoAction = {
  target: HTMLElement;
  optionKey?: string;
  timeDrag?: {
    from: [number, number];
    to: [number, number];
    setRange: (range: [number, number]) => void;
  };
};

const demoTargetFilters: QuestionBankFilters = {
  difficulty: ["hard"],
  timeSpentRange: [20, 95],
  activeQuestions: "active",
  markedForReview: "yes",
  solved: "yes",
  answeredIncorrectly: "all",
};

const isDemoApplied = (filters: QuestionBankFilters) =>
  filters.difficulty.length === demoTargetFilters.difficulty.length &&
  demoTargetFilters.difficulty.every((difficulty) => filters.difficulty.includes(difficulty)) &&
  filters.timeSpentRange[0] === demoTargetFilters.timeSpentRange[0] &&
  filters.timeSpentRange[1] === demoTargetFilters.timeSpentRange[1] &&
  filters.activeQuestions === demoTargetFilters.activeQuestions &&
  filters.markedForReview === demoTargetFilters.markedForReview &&
  filters.solved === demoTargetFilters.solved &&
  filters.answeredIncorrectly === demoTargetFilters.answeredIncorrectly;

const isVisibleElement = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

const isLiveInViewport = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  return rect.bottom > -80 && rect.top < window.innerHeight + 80;
};

const activateDemoElement = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;
  const pointer = { bubbles: true, cancelable: true, composed: true, clientX, clientY, button: 0 };
  const win = element.ownerDocument.defaultView ?? window;
  const scrollX = win.scrollX;
  const scrollY = win.scrollY;
  const restoreScroll = () => {
    if (Math.abs(win.scrollX - scrollX) > 1 || Math.abs(win.scrollY - scrollY) > 1) {
      win.scrollTo(scrollX, scrollY);
    }
  };
  element.dispatchEvent(new win.PointerEvent("pointerdown", pointer));
  restoreScroll();
  element.dispatchEvent(new win.MouseEvent("mousedown", pointer));
  restoreScroll();
  element.dispatchEvent(new win.PointerEvent("pointerup", pointer));
  restoreScroll();
  element.dispatchEvent(new win.MouseEvent("mouseup", pointer));
  restoreScroll();
  element.click();
  restoreScroll();
  win.requestAnimationFrame(restoreScroll);
  win.setTimeout(restoreScroll, 0);
};

const clampDemoTimeValue = (value: number) =>
  Math.min(MAX_TIME_SPENT_FILTER_SECONDS, Math.max(0, value));

const roundDemoTimeStep = (value: number) =>
  Math.round(clampDemoTimeValue(value) / 5) * 5;

const getDemoCursorDuration = (distance: number) => (
  Math.round(Math.min(
    FILTER_DEMO_CURSOR_MAX_DURATION_MS,
    Math.max(FILTER_DEMO_CURSOR_MIN_DURATION_MS, distance / FILTER_DEMO_CURSOR_SPEED_PX_PER_MS),
  ))
);

const getDemoCursorRandom = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

const getDemoCursorEase = (progress: number, accelerate = 1.45, decelerate = 1.35) => (
  progress < 0.5
    ? 0.5 * Math.pow(progress * 2, accelerate)
    : 1 - 0.5 * Math.pow((1 - progress) * 2, decelerate)
);

const getDemoCursorBezierPoint = (
  start: { x: number; y: number },
  controlA: { x: number; y: number },
  controlB: { x: number; y: number },
  end: { x: number; y: number },
  progress: number,
) => {
  const inverse = 1 - progress;
  const startWeight = inverse * inverse * inverse;
  const controlAWeight = 3 * inverse * inverse * progress;
  const controlBWeight = 3 * inverse * progress * progress;
  const endWeight = progress * progress * progress;
  return {
    x: start.x * startWeight + controlA.x * controlAWeight + controlB.x * controlBWeight + end.x * endWeight,
    y: start.y * startWeight + controlA.y * controlAWeight + controlB.y * controlBWeight + end.y * endWeight,
  };
};

const DemoCursor = memo(({ x, y, visible, clickKey }: DemoCursorState & { clickKey: number }) => (
  <div
    data-filter-demo-cursor
    data-filter-demo-cursor-visible={visible ? "true" : "false"}
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      transform: `translate(${x}px, ${y}px)`,
      transition: "opacity 180ms ease",
      opacity: visible ? 1 : 0,
      pointerEvents: "none",
      zIndex: 45,
      willChange: "transform",
    }}
  >
    <span
      key={clickKey}
      className="filter-demo-click-ring"
      style={{
        position: "absolute",
        left: FILTER_DEMO_CURSOR_HOTSPOT_X - 7,
        top: FILTER_DEMO_CURSOR_HOTSPOT_Y - 7,
        width: 14,
        height: 14,
        borderRadius: "50%",
        border: "1.5px solid rgba(14,165,233,0.65)",
        background: "rgba(14,165,233,0.12)",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.55)",
        pointerEvents: "none",
        animation: "demoClickPulse 260ms ease-out forwards",
      }}
    />
    <img
      src="/assets/cursors/macos-pointer.png"
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: FILTER_DEMO_CURSOR_SIZE,
        minWidth: FILTER_DEMO_CURSOR_SIZE,
        maxWidth: "none",
        height: FILTER_DEMO_CURSOR_SIZE,
        filter: "drop-shadow(0 2px 3px rgba(15,23,42,0.32))",
        userSelect: "none",
      }}
    />
  </div>
));
DemoCursor.displayName = "DemoCursor";

const BankFilterInlineDemo = memo(({ isDarkMode }: { isDarkMode: boolean }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isNear = true;
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [demoShouldMount, setDemoShouldMount] = useState(false);
  const [demoScale, setDemoScale] = useState(FILTER_DEMO_MAX_SCALE);
  const [filters, setFilters] = useState<QuestionBankFilters>(defaultBankFilters);
  const [cursor, setCursor] = useState<DemoCursorState>({
    x: -120,
    y: -120,
    visible: false,
    durationMs: 0,
  });
  const cursorRef = useRef(cursor);
  const cursorPathSeedRef = useRef(0);
  const userFilterPauseUntilRef = useRef(0);
  const manualResumeTimerRef = useRef<number | null>(null);
  const scriptedInteractionDepthRef = useRef(0);
  const [clickKey, setClickKey] = useState(0);
  const [demoMode, setDemoMode] = useState<FilterDemoMode>("apply");
  const [demoTick, setDemoTick] = useState(0);
  const [manualInteractionVersion, setManualInteractionVersion] = useState(0);
  const filtersRef = useRef<QuestionBankFilters>(defaultBankFilters);
  const modeRef = useRef<FilterDemoMode>(demoMode);
  const applyDemoFilters = useCallback((nextFilters: QuestionBankFilters) => {
    filtersRef.current = nextFilters;
    setFilters(nextFilters);
  }, []);
  const setDemoFilterPatch = useCallback((patch: Partial<QuestionBankFilters>) => {
    setFilters((current) => {
      const next = { ...current, ...patch };
      filtersRef.current = next;
      return next;
    });
  }, []);
  const handleBankDemoReady = useCallback(() => {
    setDemoLoaded(true);
  }, []);
  const queueManualResume = useCallback(() => {
    if (manualResumeTimerRef.current !== null) {
      window.clearTimeout(manualResumeTimerRef.current);
    }
    const resumeDelay = Math.max(0, userFilterPauseUntilRef.current - Date.now());
    manualResumeTimerRef.current = window.setTimeout(() => {
      manualResumeTimerRef.current = null;
      setDemoTick((tick) => tick + 1);
    }, resumeDelay);
  }, []);
  const activateScriptedElement = useCallback((element: HTMLElement) => {
    scriptedInteractionDepthRef.current += 1;
    try {
      activateDemoElement(element);
    } finally {
      scriptedInteractionDepthRef.current = Math.max(0, scriptedInteractionDepthRef.current - 1);
    }
  }, []);
  const pauseForManualFilterInteraction = useCallback((event: PointerEvent | MouseEvent) => {
    if (scriptedInteractionDepthRef.current > 0) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target?.closest('[data-tour="bank-filters"], [data-filter-demo-option], [role="option"], [cmdk-item]')) {
      return;
    }
    const manualScrollX = window.scrollX;
    const manualScrollY = window.scrollY;
    const restoreManualClickScroll = () => {
      if (Math.abs(window.scrollX - manualScrollX) > 2 || Math.abs(window.scrollY - manualScrollY) > 2) {
        window.scrollTo(manualScrollX, manualScrollY);
      }
    };
    userFilterPauseUntilRef.current = Date.now() + FILTER_DEMO_USER_INTERACTION_PAUSE_MS;
    const hiddenCursor = { ...cursorRef.current, visible: false, durationMs: 0 };
    cursorRef.current = hiddenCursor;
    setCursor(hiddenCursor);
    setManualInteractionVersion((version) => version + 1);
    queueManualResume();
    restoreManualClickScroll();
    window.requestAnimationFrame(restoreManualClickScroll);
    window.setTimeout(restoreManualClickScroll, 0);
    window.setTimeout(restoreManualClickScroll, 80);
    window.setTimeout(restoreManualClickScroll, 220);
  }, [queueManualResume]);

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  useEffect(() => () => {
    if (manualResumeTimerRef.current !== null) {
      window.clearTimeout(manualResumeTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !demoShouldMount) return;
    container.addEventListener("pointerdown", pauseForManualFilterInteraction, { capture: true });
    container.addEventListener("mousedown", pauseForManualFilterInteraction, { capture: true });
    return () => {
      container.removeEventListener("pointerdown", pauseForManualFilterInteraction, { capture: true });
      container.removeEventListener("mousedown", pauseForManualFilterInteraction, { capture: true });
    };
  }, [demoShouldMount, pauseForManualFilterInteraction]);

  useEffect(() => {
    filtersRef.current = filters;
    if (isDemoApplied(filters) && modeRef.current === "apply") {
      setDemoMode("clear");
    }
  }, [filters]);

  useEffect(() => {
    modeRef.current = demoMode;
  }, [demoMode]);
  useEffect(() => {
    if (!isNear || demoShouldMount) return;
    const mountTimer = window.setTimeout(() => setDemoShouldMount(true), 900);
    return () => window.clearTimeout(mountTimer);
  }, [demoShouldMount, isNear]);

  useEffect(() => {
    if (!isNear || !demoLoaded) return;
    const id = window.setTimeout(() => {
      setDemoTick((tick) => tick + 1);
    }, FILTER_DEMO_CURSOR_START_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [demoLoaded, isNear]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const parent = container?.closest<HTMLElement>(".filter-demo-shell") ?? container?.parentElement;
    if (!parent) return;

    const measure = () => {
      const availableWidth = parent.getBoundingClientRect().width;
      if (availableWidth > 0) {
        setDemoScale(Math.min(FILTER_DEMO_MAX_SCALE, availableWidth / FILTER_DEMO_PREVIEW_WIDTH));
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  const resolveDemoAction = useCallback((
    root: HTMLElement,
    currentFilters: QuestionBankFilters,
    mode: FilterDemoMode,
  ): FilterDemoAction | null => {
    const control = (name: string) => (
      root.querySelector<HTMLElement>(`[data-filter-demo-control="${name}"]`)
    );
    const option = (key: string) => (
      Array.from(root.querySelectorAll<HTMLElement>(`[data-filter-demo-option="${key}"]`))
        .find(isVisibleElement) ?? null
    );
    const optionOrControl = (key: string, controlName: string): FilterDemoAction | null => {
      const visibleOption = option(key);
      if (visibleOption) return { target: visibleOption };
      const visibleControl = control(controlName);
      return visibleControl ? { target: visibleControl, optionKey: key } : null;
    };
    const timeDrag = (
      from: [number, number],
      to: [number, number],
    ): NonNullable<FilterDemoAction["timeDrag"]> => ({
      from,
      to,
      setRange: (range) => setDemoFilterPatch({ timeSpentRange: range }),
    });
    const slider = () => control("time") ?? root.querySelector<HTMLElement>('[role="slider"]');

    if (mode === "apply") {
      const nextDifficulty = demoTargetFilters.difficulty.find(
        (difficulty) => !currentFilters.difficulty.includes(difficulty),
      );
      if (nextDifficulty) {
        return optionOrControl(`difficulty:${nextDifficulty}`, "difficulty");
      }
      if (
        currentFilters.timeSpentRange[0] !== demoTargetFilters.timeSpentRange[0] ||
        currentFilters.timeSpentRange[1] !== demoTargetFilters.timeSpentRange[1]
      ) {
        const target = slider();
        return target ? {
          target,
          timeDrag: timeDrag(
            [currentFilters.timeSpentRange[0], currentFilters.timeSpentRange[1]],
            [demoTargetFilters.timeSpentRange[0], demoTargetFilters.timeSpentRange[1]],
          ),
        } : null;
      }
      if (currentFilters.activeQuestions !== demoTargetFilters.activeQuestions) {
        return optionOrControl("activity:active", "activity");
      }
      if (currentFilters.markedForReview !== demoTargetFilters.markedForReview) {
        return optionOrControl("marked:yes", "marked");
      }
      if (currentFilters.solved !== demoTargetFilters.solved) {
        return optionOrControl("solved:yes", "solved");
      }
      if (currentFilters.answeredIncorrectly !== demoTargetFilters.answeredIncorrectly) {
        return optionOrControl(`incorrect:${demoTargetFilters.answeredIncorrectly}`, "incorrect");
      }
      setDemoMode("clear");
      return null;
    }

    if (currentFilters.difficulty.includes("hard")) {
      return optionOrControl("difficulty:hard", "difficulty");
    }
    if (currentFilters.difficulty.includes("medium")) {
      return optionOrControl("difficulty:medium", "difficulty");
    }
    if (
      currentFilters.timeSpentRange[0] !== defaultBankFilters.timeSpentRange[0] ||
      currentFilters.timeSpentRange[1] !== defaultBankFilters.timeSpentRange[1]
    ) {
      const target = slider();
      return target ? {
        target,
        timeDrag: timeDrag(
          [currentFilters.timeSpentRange[0], currentFilters.timeSpentRange[1]],
          [defaultBankFilters.timeSpentRange[0], defaultBankFilters.timeSpentRange[1]],
        ),
      } : null;
    }
    if (currentFilters.activeQuestions !== defaultBankFilters.activeQuestions) {
      return optionOrControl("activity:all", "activity");
    }
    if (currentFilters.markedForReview !== defaultBankFilters.markedForReview) {
      return optionOrControl("marked:all", "marked");
    }
    if (currentFilters.solved !== defaultBankFilters.solved) {
      return optionOrControl("solved:all", "solved");
    }
    if (currentFilters.answeredIncorrectly !== defaultBankFilters.answeredIncorrectly) {
      return optionOrControl("incorrect:all", "incorrect");
    }
    setDemoMode("apply");
    return null;
  }, [setDemoFilterPatch]);

  useEffect(() => {
    if (!isNear || !demoLoaded || demoTick === 0) return;
    const scheduleDemoTick = (delay: number) => {
      const id = window.setTimeout(() => {
        setDemoTick((tick) => tick + 1);
      }, delay);
      return () => window.clearTimeout(id);
    };
    const pausedForUserMs = userFilterPauseUntilRef.current - Date.now();
    if (pausedForUserMs > 0) {
      return scheduleDemoTick(pausedForUserMs);
    }
    const container = containerRef.current;
    if (!container || !isLiveInViewport(container)) {
      return scheduleDemoTick(FILTER_DEMO_CURSOR_IDLE_RETRY_MS);
    }
    const action = resolveDemoAction(container, filtersRef.current, modeRef.current);
    if (!action) {
      return scheduleDemoTick(FILTER_DEMO_CURSOR_NEXT_STEP_PAUSE_MS);
    }

    const containerRect = container.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const timers: number[] = [];
    const rafs = new Set<number>();
    let demoInterrupted = false;
    let userScrolled = false;
    const viewportPointForElement = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };
    const isTargetInViewport = (target: HTMLElement) => {
      const point = viewportPointForElement(target);
      return (
        point.x >= 0 &&
        point.x <= window.innerWidth &&
        point.y >= 12 &&
        point.y <= window.innerHeight - 12
      );
    };
    if (!isTargetInViewport(action.target)) {
      return scheduleDemoTick(FILTER_DEMO_CURSOR_IDLE_RETRY_MS);
    }

    const markUserScroll = () => {
      demoInterrupted = true;
      userScrolled = true;
    };
    const userScrollOptions = { passive: true, capture: true };
    window.addEventListener("wheel", markUserScroll, userScrollOptions);
    window.addEventListener("touchstart", markUserScroll, userScrollOptions);
    window.addEventListener("touchmove", markUserScroll, userScrollOptions);
    window.addEventListener("keydown", markUserScroll, { capture: true });
    window.addEventListener(HOME_DEMO_USER_SCROLL_EVENT, markUserScroll);
    const stopWatchingScroll = () => {
      window.removeEventListener("wheel", markUserScroll, { capture: true });
      window.removeEventListener("touchstart", markUserScroll, { capture: true });
      window.removeEventListener("touchmove", markUserScroll, { capture: true });
      window.removeEventListener("keydown", markUserScroll, { capture: true });
      window.removeEventListener(HOME_DEMO_USER_SCROLL_EVENT, markUserScroll);
    };
    const canRunStep = (target = action.target) => (
      !demoInterrupted &&
      Date.now() >= userFilterPauseUntilRef.current &&
      isLiveInViewport(container) &&
      isTargetInViewport(target)
    );
    const restoreScroll = () => {
      if (userScrolled) return;
      if (Math.abs(window.scrollX - scrollX) > 12 || Math.abs(window.scrollY - scrollY) > 12) {
        window.scrollTo(scrollX, scrollY);
      }
    };
    const raf = (callback: (time: number) => void) => {
      const id = window.requestAnimationFrame((time) => {
        rafs.delete(id);
        callback(time);
      });
      rafs.add(id);
    };
    const schedule = (callback: () => void, delay: number) => {
      timers.push(window.setTimeout(callback, delay));
    };
    const queueDemoTick = (delay = FILTER_DEMO_CURSOR_NEXT_STEP_PAUSE_MS) => {
      schedule(() => {
        setDemoTick((tick) => tick + 1);
      }, delay);
    };
    const queueDemoRetry = () => {
      queueDemoTick(Math.max(FILTER_DEMO_CURSOR_IDLE_RETRY_MS, userFilterPauseUntilRef.current - Date.now()));
    };
    const restoreScrollSoon = () => {
      restoreScroll();
      raf(restoreScroll);
      schedule(restoreScroll, 80);
      schedule(restoreScroll, 220);
    };
    const cursorForViewportPoint = (point: { x: number; y: number }) => ({
      x: point.x - containerRect.left - FILTER_DEMO_CURSOR_HOTSPOT_X,
      y: point.y - containerRect.top - FILTER_DEMO_CURSOR_HOTSPOT_Y,
      visible: true,
    });
    const setCursorToPoint = (point: { x: number; y: number }, durationOverride?: number) => {
      const nextPoint = cursorForViewportPoint(point);
      let previous = cursorRef.current;
      let entryDelay = 0;
      if (!previous.visible) {
        const startCursor = {
          x: Math.max(12, Math.min(FILTER_DEMO_PREVIEW_WIDTH - 58, nextPoint.x - 104)),
          y: Math.max(14, nextPoint.y - 58),
          visible: true,
          durationMs: 0,
        };
        previous = startCursor;
        cursorRef.current = startCursor;
        setCursor(startCursor);
        entryDelay = 20;
      }
      const distance = Math.hypot(nextPoint.x - previous.x, nextPoint.y - previous.y);
      const seed = cursorPathSeedRef.current + 1;
      cursorPathSeedRef.current = seed;
      const durationMs = durationOverride ?? (
        distance > 1
          ? Math.round(
            Math.min(
              FILTER_DEMO_CURSOR_MAX_DURATION_MS,
              Math.max(
                FILTER_DEMO_CURSOR_MIN_DURATION_MS,
                getDemoCursorDuration(distance) * (0.9 + getDemoCursorRandom(seed + 0.13) * 0.22),
              ),
            ),
          )
          : 0
      );
      if (durationMs <= 0 || distance <= 1) {
        const nextCursor = { ...nextPoint, durationMs: 0 };
        cursorRef.current = nextCursor;
        setCursor(nextCursor);
        return entryDelay;
      }
      const startedAt = performance.now() + entryDelay;
      const dx = nextPoint.x - previous.x;
      const dy = nextPoint.y - previous.y;
      const normalX = -dy / distance;
      const normalY = dx / distance;
      const curveDirection = getDemoCursorRandom(seed + 1.71) > 0.5 ? 1 : -1;
      const spread = Math.min(26, Math.max(4, distance * (0.025 + getDemoCursorRandom(seed + 2.23) * 0.055)));
      const controlAProgress = 0.18 + getDemoCursorRandom(seed + 3.41) * 0.28;
      const controlBProgress = 0.62 + getDemoCursorRandom(seed + 4.67) * 0.28;
      const controlADrift = curveDirection * spread * (0.35 + getDemoCursorRandom(seed + 5.89) * 0.65);
      const controlBDrift = curveDirection * spread * (0.2 + getDemoCursorRandom(seed + 6.31) * 0.85);
      const controlA = {
        x: previous.x + dx * controlAProgress + normalX * controlADrift,
        y: previous.y + dy * controlAProgress + normalY * controlADrift,
      };
      const controlB = {
        x: previous.x + dx * controlBProgress + normalX * controlBDrift,
        y: previous.y + dy * controlBProgress + normalY * controlBDrift,
      };
      const longDistanceBoost = Math.min(1, Math.max(0, (distance - 120) / 360));
      const accelerationPower = 1.42 + longDistanceBoost * 1.05 + getDemoCursorRandom(seed + 7.13) * 0.44;
      const decelerationPower = 1.22 + longDistanceBoost * 0.62 + getDemoCursorRandom(seed + 8.77) * 0.42;
      const jitterAmount = Math.min(0.9, distance * 0.0025) * (0.35 + getDemoCursorRandom(seed + 9.49) * 0.65);
      const jitterFrequency = 1.5 + getDemoCursorRandom(seed + 10.21) * 1.3;
      const step = (now: number) => {
        if (demoInterrupted || Date.now() < userFilterPauseUntilRef.current) return;
        const progress = Math.min(1, Math.max(0, (now - startedAt) / durationMs));
        const easedProgress = getDemoCursorEase(progress, accelerationPower, decelerationPower);
        const pointOnCurve = getDemoCursorBezierPoint(previous, controlA, controlB, nextPoint, easedProgress);
        const jitter = Math.sin(progress * Math.PI * 2 * jitterFrequency) * Math.sin(Math.PI * progress) * jitterAmount;
        const nextCursor = {
          x: pointOnCurve.x + normalX * jitter,
          y: pointOnCurve.y + normalY * jitter,
          visible: true,
          durationMs: 0,
        };
        cursorRef.current = nextCursor;
        setCursor(nextCursor);
        if (progress < 1) {
          raf(step);
        } else {
          const finalCursor = { ...nextPoint, durationMs: 0 };
          cursorRef.current = finalCursor;
          setCursor(finalCursor);
        }
      };
      raf(step);
      return durationMs + entryDelay;
    };
    const getDemoTimePoint = (element: HTMLElement, value: number) => {
      const rect = element.getBoundingClientRect();
      const inset = Math.min(12, rect.width * 0.14);
      const ratio = clampDemoTimeValue(value) / MAX_TIME_SPENT_FILTER_SECONDS;
      return {
        x: rect.left + inset + (rect.width - inset * 2) * ratio,
        y: rect.top + rect.height / 2,
      };
    };
    const animateRangeValue = (
      index: 0 | 1,
      startValue: number,
      endValue: number,
      rangeBase: [number, number],
      setRange: (range: [number, number]) => void,
      duration = 560,
    ) => {
      const startedAt = performance.now();
      let lastValue = Number.NaN;
      const step = (now: number) => {
        if (demoInterrupted || Date.now() < userFilterPauseUntilRef.current) return;
        const progress = duration <= 0 ? 1 : Math.min(1, (now - startedAt) / duration);
        const nextValue = roundDemoTimeStep(startValue + (endValue - startValue) * getDemoCursorEase(progress));
        if (nextValue !== lastValue) {
          lastValue = nextValue;
          const nextRange: [number, number] = [rangeBase[0], rangeBase[1]];
          nextRange[index] = nextValue;
          setRange(nextRange);
          restoreScroll();
        }
        if (progress < 1) raf(step);
      };
      raf(step);
    };

    if (action.timeDrag) {
      const { from, to, setRange } = action.timeDrag;
      const firstMoveDuration = setCursorToPoint(getDemoTimePoint(action.target, from[0]));
      const firstClickDelay = firstMoveDuration + FILTER_DEMO_CURSOR_CLICK_PAUSE_MS;
      schedule(() => {
        if (!canRunStep(action.target)) {
          queueDemoRetry();
          return;
        }
        setClickKey((key) => key + 1);
        const firstDragDuration = setCursorToPoint(getDemoTimePoint(action.target, to[0]));
        animateRangeValue(0, from[0], to[0], [from[0], from[1]], setRange, firstDragDuration);
        schedule(() => {
          if (!canRunStep(action.target)) {
            queueDemoRetry();
            return;
          }
          const secondMoveDuration = setCursorToPoint(getDemoTimePoint(action.target, from[1]));
          schedule(() => {
            if (!canRunStep(action.target)) {
              queueDemoRetry();
              return;
            }
            setClickKey((key) => key + 1);
            const secondDragDuration = setCursorToPoint(getDemoTimePoint(action.target, to[1]));
            animateRangeValue(1, from[1], to[1], [to[0], from[1]], setRange, secondDragDuration);
            schedule(() => {
              if (!canRunStep(action.target)) {
                queueDemoRetry();
                return;
              }
              setRange([to[0], to[1]]);
              restoreScrollSoon();
              queueDemoTick();
            }, secondDragDuration + FILTER_DEMO_CURSOR_CLICK_PAUSE_MS);
          }, secondMoveDuration + FILTER_DEMO_CURSOR_CLICK_PAUSE_MS);
        }, firstDragDuration + FILTER_DEMO_CURSOR_CLICK_PAUSE_MS);
      }, firstClickDelay);
      return () => {
        stopWatchingScroll();
        timers.forEach((timer) => window.clearTimeout(timer));
        rafs.forEach((frame) => window.cancelAnimationFrame(frame));
      };
    }

    const firstPoint = viewportPointForElement(action.target);
    const moveDuration = setCursorToPoint(firstPoint);
    const clickDelay = moveDuration + FILTER_DEMO_CURSOR_CLICK_PAUSE_MS;
    schedule(() => {
      if (!canRunStep(action.target)) {
        queueDemoRetry();
        return;
      }
      setClickKey((key) => key + 1);
      activateScriptedElement(action.target);
      restoreScrollSoon();
      if (!action.optionKey) {
        queueDemoTick();
      }
    }, clickDelay);

    if (action.optionKey) {
      const optionKey = action.optionKey;
      const optionPrefix = `${optionKey.split(":")[0]}:`;
      const hasVisibleOptionsForCurrentControl = () => (
        Array.from(
          container.querySelectorAll<HTMLElement>(`[data-filter-demo-option^="${optionPrefix}"]`),
        ).some(isVisibleElement)
      );
      const closeCurrentMenuBeforeNext = () => {
        if (!hasVisibleOptionsForCurrentControl() || !canRunStep(action.target)) {
          restoreScrollSoon();
          queueDemoTick();
          return;
        }
        const closeMoveDuration = setCursorToPoint(
          viewportPointForElement(action.target),
          FILTER_DEMO_CURSOR_CLOSE_MENU_DURATION_MS,
        );
        schedule(() => {
          if (!canRunStep(action.target)) {
            queueDemoRetry();
            return;
          }
          setClickKey((key) => key + 1);
          activateScriptedElement(action.target);
          restoreScrollSoon();
          queueDemoTick();
        }, closeMoveDuration + FILTER_DEMO_CURSOR_CLICK_PAUSE_MS);
      };
      schedule(() => {
        const nextTarget = Array.from(
          container.querySelectorAll<HTMLElement>(`[data-filter-demo-option="${optionKey}"]`),
        ).find(isVisibleElement);
        if (!nextTarget || !canRunStep(nextTarget)) {
          queueDemoRetry();
          return;
        }
        const optionMoveDuration = setCursorToPoint(viewportPointForElement(nextTarget));
        schedule(() => {
          const optionTarget = Array.from(
            container.querySelectorAll<HTMLElement>(`[data-filter-demo-option="${optionKey}"]`),
          ).find(isVisibleElement);
          if (!optionTarget || !canRunStep(optionTarget)) {
            queueDemoRetry();
            return;
          }
          setClickKey((key) => key + 1);
          activateScriptedElement(optionTarget);
          schedule(closeCurrentMenuBeforeNext, FILTER_DEMO_MENU_AUTO_CLOSE_CHECK_MS);
        }, optionMoveDuration + FILTER_DEMO_CURSOR_CLICK_PAUSE_MS);
      }, clickDelay + FILTER_DEMO_CURSOR_MENU_PAUSE_MS);
    }

    return () => {
      stopWatchingScroll();
      timers.forEach((timer) => window.clearTimeout(timer));
      rafs.forEach((frame) => window.cancelAnimationFrame(frame));
    };
  }, [activateScriptedElement, demoLoaded, demoTick, isNear, manualInteractionVersion, resolveDemoAction]);

  const activePreviewHeight = demoScale < 0.65 ? 840 : FILTER_DEMO_PREVIEW_HEIGHT;
  const visibleWidth = FILTER_DEMO_PREVIEW_WIDTH * demoScale;
  const visibleHeight = activePreviewHeight * demoScale;

  return (
    <div
      ref={containerRef}
      style={{
        overflow: "visible",
        width: visibleWidth,
        maxWidth: "100%",
        height: visibleHeight,
        position: "relative",
        background: "transparent",
      }}
    >
      {demoShouldMount ? (
        <>
          <div
            style={{
              width: FILTER_DEMO_PREVIEW_WIDTH,
              height: activePreviewHeight,
              transform: `scale(${demoScale})`,
              transformOrigin: "top left",
              display: "block",
              background: "transparent",
              opacity: demoLoaded ? 1 : 0,
              transition: "opacity 220ms ease",
            }}
          >
            <Suspense fallback={null}>
              <EmbeddedBankIndexPreview
                homeFilterDemo
                homeFilterDemoFilters={filters}
                onHomeFilterDemoFiltersChange={applyDemoFilters}
                onHomeFilterDemoReady={handleBankDemoReady}
              />
            </Suspense>
          </div>
          {!demoLoaded && (
            <HomePreviewSkeleton
              isDarkMode={isDarkMode}
              variant="filters"
              style={{ position: "absolute", inset: 0, zIndex: 1 }}
            />
          )}
        </>
      ) : (
        <HomePreviewSkeleton isDarkMode={isDarkMode} variant="filters" />
      )}
      <DemoCursor
        x={cursor.x}
        y={cursor.y}
        visible={cursor.visible}
        durationMs={cursor.durationMs}
        clickKey={clickKey}
      />
    </div>
  );
});
BankFilterInlineDemo.displayName = "BankFilterInlineDemo";

// ─── Animated accuracy sparkline ───────────────────────────────────────────

type AccuracyPoint = { day: number; value: number };

const useIsNearViewport = <T extends HTMLElement>(
  ref: React.RefObject<T>,
  rootMargin = "700px 0px",
) => {
  const [isNear, setIsNear] = useState(false);

  useEffect(() => {
    if (isNear) return;
    const node = ref.current;
    if (!node) return;
    const verticalMargin = Number.parseFloat(rootMargin) || 0;
    const checkNearViewport = () => {
      const rect = node.getBoundingClientRect();
      if (rect.bottom < -verticalMargin || rect.top > window.innerHeight + verticalMargin) return false;
      setIsNear(true);
      return true;
    };
    if (checkNearViewport()) return;
    if (!("IntersectionObserver" in window)) {
      setIsNear(true);
      return;
    }
    const checkTimer = window.setTimeout(checkNearViewport, 150);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsNear(true);
        observer.disconnect();
      },
      { rootMargin },
    );
    observer.observe(node);
    window.addEventListener("scroll", checkNearViewport, { passive: true });
    window.addEventListener("resize", checkNearViewport);
    return () => {
      window.clearTimeout(checkTimer);
      observer.disconnect();
      window.removeEventListener("scroll", checkNearViewport);
      window.removeEventListener("resize", checkNearViewport);
    };
  }, [isNear, ref, rootMargin]);

  return isNear;
};

const sectionVisibility = (intrinsicSize: string): React.CSSProperties => ({
  contentVisibility: "auto",
  containIntrinsicSize: intrinsicSize,
});

const AnimatedAccuracyChart = memo(({ isDarkMode, active }: { isDarkMode: boolean; active: boolean }) => {
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
    if (paused || !active) return;
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
  }, [active, paused]);

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

const AccuracyChartDemo = memo(({ isDarkMode }: { isDarkMode: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isNear = useIsNearViewport(ref);

  return (
    <div ref={ref}>
      <AnimatedAccuracyChart isDarkMode={isDarkMode} active={isNear} />
    </div>
  );
});
AccuracyChartDemo.displayName = "AccuracyChartDemo";

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
        <h2
          style={{
            fontFamily: "'Geist', system-ui, sans-serif",
            fontWeight: 500,
            fontSize: "clamp(40px, 5.5vw, 68px)",
            lineHeight: 0.98,
            letterSpacing: "-0.035em",
            color: "rgb(var(--ink))",
            margin: "0 0 22px",
          }}
        >
          {title}
          <br />
          <em
            style={{
              fontStyle: "normal",
              fontWeight: 600,
              color: "rgb(var(--cobalt))",
            }}
          >
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
            color: "rgb(var(--cobalt))",
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
// Counts from 0 → value. RAF writes directly to the DOM (no React render per
// frame). A hidden sibling reserves the target width so the tick never
// reflows. `contain: layout paint` keeps each repaint local.
//
// Critical: starts ONLY after `window.load` (all initial subresources are
// done). Running during mount means RAF callbacks queue behind parsing / font
// loading / six staggered CSS fades, which causes a "freeze then jump" lag.
// With a 2500ms hard cap so we still animate on slow networks. Hidden until
// launch so there's no stagnant "0".

const SlotMachineCounter = memo(({
  value,
  startValue = 0,
  countDuration = 1000,
  onComplete,
}: {
  value: number;
  startValue?: number;
  countDuration?: number;
  onComplete?: () => void;
}) => {
  const spanRef = useRef<HTMLSpanElement>(null);
  const [revealed, setRevealed] = useState(false);
  // Keep the latest onComplete in a ref so the empty-deps effect always sees
  // the current callback without resetting the whole animation lifecycle.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const node = spanRef.current;
    if (!node) return;

    // D: respect reduced-motion and low-end devices — skip the animation entirely.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cpu = navigator.hardwareConcurrency ?? 8;
    const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 8;
    const lowEnd = cpu <= 4 || mem <= 4;
    if (reduced || lowEnd) {
      node.textContent = value.toLocaleString();
      setRevealed(true);
      onCompleteRef.current?.();
      return;
    }

    const range = value - startValue;
    let cancelled = false;
    let raf = 0;
    let begin = 0;
    let lastText = "";
    let fired = false;
    let launchTimer = 0;
    let completeTimer = 0;

    const finish = () => {
      if (cancelled || fired) return;
      fired = true;
      node.textContent = value.toLocaleString();
      onCompleteRef.current?.();
    };

    const tick = (now: number) => {
      if (cancelled) return;
      if (!begin) begin = now;
      const t = Math.min((now - begin) / countDuration, 1);
      const eased = 1 - Math.pow(1 - t, 1.8);
      const next = Math.round(startValue + range * eased);
      const str = next.toLocaleString();
      if (str !== lastText) {
        node.textContent = str;
        lastText = str;
      }
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        finish();
      }
    };

    const launch = () => {
      if (cancelled) return;
      setRevealed(true);
      raf = requestAnimationFrame(tick);
      completeTimer = window.setTimeout(finish, countDuration + 300);
    };

    // Trigger on window.load (initial images/fonts done) so RAF runs on a
    // clear main thread. Hard cap fires the animation anyway if load is slow.
    const HARD_CAP_MS = 2500;
    const MIN_DELAY_MS = 700; // floor so we never collide with hero entrance fades
    const mountedAt = performance.now();
    let triggered = false;
    const trigger = () => {
      if (triggered || cancelled) return;
      triggered = true;
      const elapsed = performance.now() - mountedAt;
      const wait = Math.max(0, MIN_DELAY_MS - elapsed);
      // Small inner setTimeout absorbs the final reflow burst that often
      // follows `load` (image decode, layout settle).
      launchTimer = window.setTimeout(launch, wait + 80);
    };

    if (document.readyState === "complete") {
      trigger();
    } else {
      window.addEventListener("load", trigger, { once: true });
    }
    const cap = setTimeout(trigger, HARD_CAP_MS);

    return () => {
      cancelled = true;
      clearTimeout(cap);
      clearTimeout(launchTimer);
      clearTimeout(completeTimer);
      cancelAnimationFrame(raf);
      window.removeEventListener("load", trigger);
    };
  }, []);

  // inline-grid stacks both children in the same cell. The hidden placeholder
  // reserves the target width so the counting span can change text without
  // triggering layout. justifyItems: end right-aligns the digits, so the
  // trailing digit anchors as leading digits grow in from the left.
  return (
    <span
      style={{
        display: "inline-grid",
        justifyItems: "end",
        fontVariantNumeric: "tabular-nums",
        opacity: revealed ? 1 : 0,
        transition: "opacity 0.5s ease-out",
        contain: "layout paint",
      }}
    >
      <span aria-hidden="true" style={{ gridArea: "1 / 1", visibility: "hidden" }}>
        {value.toLocaleString()}
      </span>
      <span ref={spanRef} style={{ gridArea: "1 / 1" }}>
        {startValue.toLocaleString()}
      </span>
    </span>
  );
});
SlotMachineCounter.displayName = "SlotMachineCounter";

// ─── Floating math symbols (hero ambient) ──────────────────────────────────

const MATH_SYMBOLS = ["∑", "π", "√", "∫", "∞", "θ", "Δ", "λ", "φ", "Ω", "α", "β"];

const FloatingMathSymbols = memo(({
  isDarkMode,
  exclusionRef,
}: {
  isDarkMode: boolean;
  exclusionRef?: React.RefObject<HTMLElement>;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [maskCss, setMaskCss] = useState<{ maskImage?: string; WebkitMaskImage?: string }>({});
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

  useLayoutEffect(() => {
    const update = () => {
      const c = containerRef.current;
      const t = exclusionRef?.current;
      if (!c || !t) {
        setMaskCss({});
        return;
      }
      const cr = c.getBoundingClientRect();
      const tr = t.getBoundingClientRect();
      const cx = tr.left - cr.left + tr.width / 2;
      const cy = tr.top - cr.top + tr.height / 2;
      const rx = tr.width / 2 + 100;
      const ry = tr.height / 2 + 80;
      const gradient = `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, transparent 0%, transparent 55%, black 100%)`;
      setMaskCss({ maskImage: gradient, WebkitMaskImage: gradient });
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    if (exclusionRef?.current) ro.observe(exclusionRef.current);
    window.addEventListener("resize", update);
    if (document.fonts?.ready) document.fonts.ready.then(update).catch(() => {});
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [exclusionRef]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 0,
        ...maskCss,
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

// ─── Aurora mesh background (animated radial-gradient blobs) ───────────────

const AuroraMesh = memo(({ isDarkMode }: { isDarkMode: boolean }) => {
  const blobs = isDarkMode
    ? [
        { c: "rgba(56,189,248,0.22)",  cls: "aurora-blob-a" },
        { c: "rgba(99,102,241,0.20)",  cls: "aurora-blob-b" },
        { c: "rgba(168,85,247,0.14)",  cls: "aurora-blob-c" },
        { c: "rgba(251,191,36,0.08)",  cls: "aurora-blob-d" },
      ]
    : [
        { c: "rgba(56,189,248,0.36)",  cls: "aurora-blob-a" },
        { c: "rgba(129,140,248,0.28)", cls: "aurora-blob-b" },
        { c: "rgba(244,114,182,0.18)", cls: "aurora-blob-c" },
        { c: "rgba(250,204,21,0.18)",  cls: "aurora-blob-d" },
      ];
  return (
    <div
      aria-hidden
      className="hp-fixed-layer"
      style={{
        // Fixed to viewport so it stays locked to the grid + curves as a
        // single backdrop layer. Opacity is driven by the body-level
        // `.hp-bg-hidden` class set by HomePageBackdrop's scroll handler.
        position: "fixed",
        top: 64,
        left: 0,
        right: 0,
        height: "calc(100vh - 64px)",
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
        filter: "blur(40px)",
        WebkitMaskImage:
          "linear-gradient(to bottom, black 0%, black 22%, rgba(0,0,0,0.55) 55%, transparent 92%)",
        maskImage:
          "linear-gradient(to bottom, black 0%, black 22%, rgba(0,0,0,0.55) 55%, transparent 92%)",
      }}
    >
      {blobs.map((b, i) => (
        <div
          key={i}
          className={b.cls}
          style={{
            position: "absolute",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${b.c} 0%, transparent 70%)`,
            willChange: "transform",
          }}
        />
      ))}
    </div>
  );
});
AuroraMesh.displayName = "AuroraMesh";

// ─── Home page graph backdrop (scrolling grid + axes/curve/marker) ─────────

// Each entry has:
//   typed: the plain-text source typed into the panel char-by-char (cursor animation)
//   latex: KaTeX-renderable LaTeX that replaces the plain text once typing finishes
//   path:  SVG path on the 1400×900 viewBox. Every path is centered around (700, 450)
//          (the visual middle of the hero) so the graph reads as "going through" the
//          headline/buttons area.
// Each equation lists:
//   latex: KaTeX source — rendered once, then "typed" in via a clip-path reveal
//          so the formatted output is the thing that actually animates.
//   path:  SVG path. Coordinates use viewBox 1400×900 mapped to math coords by
//          (x_math = x_viewbox/100, y_math = (900 - y_viewbox)/100). Each path
//          plots the corresponding equation for x ∈ [1, 13] so the curve fills
//          the above-the-fold viewport without spilling below.
// Math → viewBox mapping: x_vb = 100·x, y_vb = 270 + 55·(4.5 − y_math).
// This places y_math=4.5 at y_vb=270 (≈ the subtitle row in the SVG), so
// every curve's focal feature (vertex / midpoint / inflection) clusters
// around that visual line — the curves all feel "centered" on the subtitle.
//
// `steps` is the progressive build of the LaTeX, used by the typing animation
// to swap whole rendered components in order (instead of a left-to-right wipe).
// Paths are stylized rather than mathematically exact — every curve's visual
// focal point (parabola vertex / line midpoint / cubic inflection) lands at
// viewBox y≈270, which corresponds to the subtitle row. Curves still reach
// the viewBox edges (x=0..1400) so they hit the screen edges.
// Each equation is rendered once via KaTeX, then revealed character-by-
// character with a typewriter CSS animation (steps() timing on a clip-path
// width). `charCount` controls how many discrete reveal steps the typewriter
// uses — roughly the visual character count of the typeset equation.
const HP_EQUATIONS = [
  {
    latex: "y=-(x-7)^{2}/8+8",
    charCount: 15,
    path: "M 0 600 Q 700 -60 1400 600",
    html: "<span class=\"hp-equation-text\">y = -(x - 7)<sup>2</sup>/8 + 8</span>",
  },
  {
    latex: "y=-x/2+8",
    charCount: 8,
    // Shifted down ~150 viewBox units so the line's midpoint lands on the
    // hero text block (buttons/counter row) instead of above the headline.
    path: "M 0 230 L 1400 610",
    html: "<span class=\"hp-equation-text\">y = -x/2 + 8</span>",
  },
  {
    latex: "y=(x-7)^{3}/40+4.5",
    charCount: 15,
    path: "M 0 700 C 350 700, 450 270, 700 270 S 1050 -160, 1400 -160",
    html: "<span class=\"hp-equation-text\">y = (x - 7)<sup>3</sup>/40 + 4.5</span>",
  },
  {
    latex: "y=(x-7)^{2}/10+1",
    charCount: 13,
    path: "M 0 60 Q 700 940 1400 60",
    html: "<span class=\"hp-equation-text\">y = (x - 7)<sup>2</sup>/10 + 1</span>",
  },
  {
    latex: "y=8-(x-7)^{2}/30",
    charCount: 14,
    path: "M 0 420 Q 700 120 1400 420",
    html: "<span class=\"hp-equation-text\">y = 8 - (x - 7)<sup>2</sup>/30</span>",
  },
];

type HPPhase =
  | "typing"
  | "typingHold"
  | "pushing"
  // `clearing` — old curve fades out completely before the new one starts
  // drawing. Nothing draws during this phase except the static fade-out.
  | "clearing"
  | "graphing"
  | "graphHold";

type SlotState =
  // `typing` renders the full KaTeX with a single CSS-driven typewriter
  // animation — clip-path 100%→0% over `durationMs` with steps(charCount)
  // timing. The caret rides the clip boundary at the same step pace and
  // blinks. `cycleKey` keys the element so React remounts and the animation
  // restarts on each new equation.
  | {
      mode: "typing";
      latex: string;
      html: string;
      cycleKey: number;
      charCount: number;
      durationMs: number;
    }
  | { mode: "rendered"; latex: string; html: string }
  | { mode: "empty" };

const HomePageBackdrop = memo(({ isDarkMode }: { isDarkMode: boolean }) => {
  // Single state machine drives the Desmos panel typing AND the curve draw,
  // so the curve lands exactly when the new equation sits in slot 1.
  //   typing       → user-style char-by-char typing into a row
  //   typingHold   → typed equation pauses (cursor blinks)
  //   pushing      → row 2 slides up into row 1, row 1 fades out (skipped on cycle 0)
  //   graphing     → SVG path draws in
  //   graphHold    → drawn curve rests, then we loop
  const [cycle, setCycle] = useState(0);
  const [phase, setPhase] = useState<HPPhase>("typing");
  const HP_PANEL_FONT_PX = 26;
  // Per-character pacing of the typewriter reveal.
  const HP_MS_PER_CHAR = 90;
  const FIRST_CURVE_LEAD_MS = 750;
  const [firstCurveEarly, setFirstCurveEarly] = useState(false);
  // Fade the entire backdrop (aurora + grid + curves) once the "An interface
  // so easy…" title reaches the vertical middle of the viewport. Toggle a
  // single body class — every backdrop element with `.hp-fixed-layer` reads
  // from it via CSS, so AuroraMesh (in a separate component) and the grid
  // layer here all stay in sync without prop drilling.
  useEffect(() => {
    let raf = 0;
    let currentVisible: boolean | null = null;
    const update = () => {
      raf = 0;
      const demoTitle = document.querySelector(".home-demo-title");
      const t = demoTitle?.getBoundingClientRect().top ?? Infinity;
      const visible = t > window.innerHeight / 2;
      if (visible === currentVisible) return;
      currentVisible = visible;
      document.body.classList.toggle("hp-bg-hidden", !visible);
    };
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.body.classList.remove("hp-bg-hidden");
    };
  }, []);

  const currentEq = HP_EQUATIONS[cycle % HP_EQUATIONS.length];
  const prevEq = cycle === 0 ? null : HP_EQUATIONS[(cycle - 1) % HP_EQUATIONS.length];
  const isFirstCycle = cycle === 0;

  // typing: one fixed timeout matching the CSS typewriter animation duration.
  // The character-by-character reveal is driven entirely by the steps() CSS
  // timing function on a clip-path animation.
  const currentTypingMs = currentEq.charCount * HP_MS_PER_CHAR;
  useEffect(() => {
    if (phase !== "typing") return;
    const id = window.setTimeout(() => setPhase("typingHold"), currentTypingMs);
    return () => window.clearTimeout(id);
  }, [phase, currentTypingMs]);

  useEffect(() => {
    if (!isFirstCycle || phase !== "typing") return;
    setFirstCurveEarly(false);
    const normalFirstCurveStartMs = currentTypingMs + 250;
    const id = window.setTimeout(
      () => setFirstCurveEarly(true),
      Math.max(0, normalFirstCurveStartMs - FIRST_CURVE_LEAD_MS),
    );
    return () => window.clearTimeout(id);
  }, [isFirstCycle, phase, currentTypingMs]);

  // typingHold → pushing (or clearing on first cycle, since there's no push)
  useEffect(() => {
    if (phase !== "typingHold") return;
    const id = window.setTimeout(() => {
      setPhase(isFirstCycle ? "graphing" : "pushing");
    }, isFirstCycle ? 250 : 750);
    return () => window.clearTimeout(id);
  }, [phase, isFirstCycle]);

  // pushing → clearing (old curve gets the spotlight to fade away)
  useEffect(() => {
    if (phase !== "pushing") return;
    const id = window.setTimeout(() => setPhase("clearing"), 450);
    return () => window.clearTimeout(id);
  }, [phase]);

  // clearing → graphing (only after old curve has fully faded)
  useEffect(() => {
    if (phase !== "clearing") return;
    const id = window.setTimeout(() => setPhase("graphing"), 950);
    return () => window.clearTimeout(id);
  }, [phase]);

  // graphing → graphHold (slow, natural ease — matches hpDraw duration)
  useEffect(() => {
    if (phase !== "graphing") return;
    const id = window.setTimeout(() => setPhase("graphHold"), 3600);
    return () => window.clearTimeout(id);
  }, [phase]);

  // graphHold → next cycle
  useEffect(() => {
    if (phase !== "graphHold") return;
    const id = window.setTimeout(() => {
      setCycle((c) => c + 1);
      setPhase("typing");
    }, 1200);
    return () => window.clearTimeout(id);
  }, [phase]);

  const typingSlot = (): SlotState => ({
    mode: "typing",
    latex: currentEq.latex,
    html: currentEq.html,
    cycleKey: cycle,
    charCount: currentEq.charCount,
    durationMs: currentTypingMs,
  });

  let slot1: SlotState;
  let slot2: SlotState;
  if (isFirstCycle) {
    // First equation types directly into slot 1; slot 2 stays empty.
    slot1 = phase === "typing"
      ? typingSlot()
      : { mode: "rendered", latex: currentEq.latex, html: currentEq.html };
    slot2 = { mode: "empty" };
  } else {
    if (phase === "typing" || phase === "typingHold" || phase === "pushing") {
      slot1 = { mode: "rendered", latex: prevEq!.latex, html: prevEq!.html };
    } else {
      slot1 = { mode: "rendered", latex: currentEq.latex, html: currentEq.html };
    }
    if (phase === "typing") {
      slot2 = typingSlot();
    } else if (phase === "typingHold" || phase === "pushing") {
      slot2 = { mode: "rendered", latex: currentEq.latex, html: currentEq.html };
    } else {
      slot2 = { mode: "empty" };
    }
  }

  // Static curve = whichever equation is currently sitting drawn in slot 1.
  // Sequence:
  //   typing/typingHold/pushing: show previous cycle's curve (static, full opacity)
  //   clearing: still show previous, but with `.fading` class → opacity 0
  //   graphing: previous is gone; new curve animates in
  //   graphHold: new curve stays as static
  let staticCurveIdx: number | null = null;
  let staticFading = false;
  if (cycle > 0) {
    if (
      phase === "typing" ||
      phase === "typingHold" ||
      phase === "pushing"
    ) {
      staticCurveIdx = (cycle - 1) % HP_EQUATIONS.length;
    } else if (phase === "clearing") {
      staticCurveIdx = (cycle - 1) % HP_EQUATIONS.length;
      staticFading = true;
    } else if (phase === "graphHold") {
      staticCurveIdx = cycle % HP_EQUATIONS.length;
    }
  } else if (phase === "graphHold") {
    staticCurveIdx = 0;
  }
  const animatedCurveIdx =
    phase === "graphing" || (isFirstCycle && firstCurveEarly && (phase === "typing" || phase === "typingHold"))
      ? cycle % HP_EQUATIONS.length
      : null;

  const lineColor = isDarkMode ? "rgba(125,211,252,0.14)" : "rgba(15,23,42,0.11)";
  // Softer pastel cyan — less saturation so the curves don't compete with
  // text. Combined with the per-row mask cutouts they read as background.
  const curveColor = isDarkMode ? "rgba(125,211,252,0.55)" : "rgba(125,211,252,0.78)";

  // Grid mask: full visibility everywhere, only fade out before the next section.
  // Grid fills the whole viewport-pinned layer (no bottom-fade). The whole
  // backdrop fades out via opacity when the demo title hits mid-viewport,
  // so a per-layer bottom-fade just adds a visible cutoff with no benefit.
  const gridMask = "linear-gradient(to bottom, black 0%, black 100%)";
  // Curve mask: stack of narrow radial dimmers, one per text *line* of the
  // hero (headline lines, subtitle, button row, counter, label). Compositing
  // them with `intersect` (multiply) means the curve dims only where each
  // line actually lives — the gaps between lines stay at full opacity. Each
  // ellipse is wide-but-short so it tracks a row of text, not the whole box.
  // Dynamic cutout mask: every element tagged `data-curve-cutout` punches an
  // elliptical hole through the curve at its current viewport position. The
  // mask rebuilds whenever any tagged element resizes, the window resizes,
  // fonts finish loading, or the user scrolls — so the cutouts track the
  // actual on-screen position of the text instead of being hardcoded to
  // specific percentages.
  const [cutoutMask, setCutoutMask] = useState<string>(
    "linear-gradient(to bottom, black 0%, black 100%)"
  );
  useEffect(() => {
    // Pixel padding added around each rect before converting to a radial
    // gradient — gives the text some breathing room from the curve.
    const PAD_X = 24;
    const PAD_Y = 18;
    let raf = 0;
    let lastMask = "";
    const update = () => {
      raf = 0;
      const els = document.querySelectorAll<HTMLElement>("[data-curve-cutout]");
      const W = window.innerWidth;
      const H = window.innerHeight - 64; // matches curve layer height
      const gradients: string[] = [];
      els.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        // Skip cutouts that are outside the fixed curve layer.
        if (r.bottom < 64 || r.top > window.innerHeight) return;
        const cx = ((r.left + r.right) / 2 / W) * 100;
        const cy = ((r.top - 64 + r.height / 2) / H) * 100;
        const rx = ((r.width + PAD_X * 2) / 2 / W) * 100;
        const ry = ((r.height + PAD_Y * 2) / 2 / H) * 100;
        gradients.push(
          `radial-gradient(ellipse ${rx}% ${ry}% at ${cx}% ${cy}%, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.55) 70%, black 100%)`
        );
      });
      gradients.push("linear-gradient(to bottom, black 0%, black 100%)");
      const nextMask = gradients.join(", ");
      if (nextMask === lastMask) return;
      lastMask = nextMask;
      setCutoutMask(nextMask);
    };
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };

    update();
    const ro = new ResizeObserver(update);
    document
      .querySelectorAll<HTMLElement>("[data-curve-cutout]")
      .forEach((el) => ro.observe(el));
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // After web fonts load, text sizes can change — recompute then too.
    if (document.fonts?.ready) document.fonts.ready.then(update);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);
  const curveMask = cutoutMask;

  return (
    <>
      {/* Grid layer — fixed to the viewport so it travels with the curves
          as a single unit, and fades out via the same `.hp-fixed-layer`
          opacity rule when the demo title reaches mid-viewport. */}
      <div
        aria-hidden
        className="hp-fixed-layer"
        style={{
          position: "fixed",
          top: 64,
          left: 0,
          right: 0,
          height: "calc(100vh - 64px)",
          pointerEvents: "none",
          zIndex: 0,
          backgroundImage: `
            linear-gradient(${lineColor} 1px, transparent 1px),
            linear-gradient(90deg, ${lineColor} 1px, transparent 1px)
          `,
          backgroundSize: "54px 54px",
          WebkitMaskImage: gridMask,
          maskImage: gridMask,
        }}
      />
      {/* Curve layer — position: fixed so it stays pinned to the viewport as
          the user scrolls. The hero section has `overflow: hidden` which
          breaks `position: sticky`, so fixed is the workable option. We hide
          it once the hero leaves the viewport (see opacity logic below). */}
      <div
        aria-hidden
        className="hp-fixed-layer"
        style={{
          position: "fixed",
          top: 64,
          left: 0,
          right: 0,
          height: "calc(100vh - 64px)",
          pointerEvents: "none",
          zIndex: 0,
          WebkitMaskImage: curveMask,
          maskImage: curveMask,
          WebkitMaskComposite: "source-in",
          maskComposite: "intersect",
        }}
      >
        <svg
          viewBox="0 0 1400 900"
          preserveAspectRatio="xMidYMid slice"
          style={{ width: "100%", height: "100%", display: "block" }}
        >
          <defs>
            {/* Soft glow: Gaussian blur of the source merged under the
                crisp stroke, so each curve reads as a faintly glowing
                trace instead of a flat line. */}
            <filter id="hp-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {staticCurveIdx !== null && (
            <path
              d={HP_EQUATIONS[staticCurveIdx].path}
              fill="none"
              stroke={curveColor}
              strokeWidth="4.5"
              strokeLinecap="round"
              filter="url(#hp-glow)"
              className={`hp-static-curve${staticFading ? " fading" : ""}`}
            />
          )}
          {animatedCurveIdx !== null && (
            <path
              key={cycle}
              d={HP_EQUATIONS[animatedCurveIdx].path}
              fill="none"
              stroke={curveColor}
              strokeWidth="4.5"
              strokeLinecap="round"
              filter="url(#hp-glow)"
              className="hp-curve"
            />
          )}
        </svg>
      </div>
    </>
  );
});
HomePageBackdrop.displayName = "HomePageBackdrop";

// Renders one equation line. The same KaTeX HTML is used in both `typing`
// and `rendered` modes — the only difference is that `typing` overlays a
// clip-path reveal animation and a moving caret so the formatted equation
// appears character-by-character. KaTeX HTML is pre-rendered from hardcoded
// HP_EQUATIONS strings, so it's trusted.
// Desmos-style row: left number cell (numbered "1" or "2" with a colored
// background that differs per variant) + divider on the primary row +
// the equation line itself.
const DesmosRow = memo(
  ({
    number,
    slot,
    isDarkMode,
    variant,
    fadeIn = false,
  }: {
    number: number;
    slot: SlotState;
    isDarkMode: boolean;
    variant: "primary" | "secondary";
    fadeIn?: boolean;
  }) => {
    const isPrimary = variant === "primary";
    return (
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          height: "1.6em",
          borderBottom: isPrimary
            ? `1px solid ${isDarkMode ? "rgba(125,211,252,0.12)" : "rgba(15,23,42,0.08)"}`
            : "none",
        }}
      >
        <div
          style={{
            width: 36,
            flexShrink: 0,
            fontFamily: "system-ui, sans-serif",
            fontSize: 13,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isPrimary
              ? (isDarkMode ? "rgba(56,189,248,0.22)" : "#dbeafe")
              : (isDarkMode ? "rgba(125,211,252,0.06)" : "rgba(15,23,42,0.04)"),
            color: isPrimary
              ? (isDarkMode ? "#7dd3fc" : "#1d4ed8")
              : (isDarkMode ? "#94a3b8" : "#64748b"),
          }}
        >
          {number}
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            padding: "0 14px",
            overflow: "hidden",
          }}
        >
          <DesmosLine slot={slot} fadeIn={fadeIn} />
        </div>
      </div>
    );
  }
);
DesmosRow.displayName = "DesmosRow";

const DesmosLine = memo(
  ({ slot, fadeIn = false }: { slot: SlotState; fadeIn?: boolean }) => {
    if (slot.mode === "empty") {
      // Reserve the row's height so the column doesn't collapse.
      return <div style={{ height: "1.6em" }} />;
    }
    if (slot.mode === "typing") {
      const fullHtml = { __html: slot.html };
      // Pure CSS typewriter: clip-path runs from inset(0 100% 0 0) to
      // inset(0 0 0 0) with steps(charCount, end), revealing one character-
      // width chunk per step. Caret rides at the clip boundary.
      const animStyle = {
        animationDuration: `${slot.durationMs}ms`,
        animationTimingFunction: `steps(${slot.charCount}, end)`,
      } as React.CSSProperties;
      return (
        <div
          key={slot.cycleKey}
          className="hp-tw-wrap"
          style={{ height: "1.6em", position: "relative" }}
        >
          <span
            className="hp-tw-reveal hp-latex"
            style={{ display: "inline-block", ...animStyle }}
            dangerouslySetInnerHTML={fullHtml}
          />
          <span className="hp-tw-caret" style={animStyle} />
        </div>
      );
    }
    const html = { __html: slot.html };
    return (
      <div
        className={fadeIn ? "hp-row-fade-in" : ""}
        style={{ height: "1.6em" }}
      >
        <span
          key={slot.latex}
          className="hp-row-fade-in hp-latex"
          dangerouslySetInnerHTML={html}
        />
      </div>
    );
  }
);
DesmosLine.displayName = "DesmosLine";

// ─── Mouse-parallax tilt wrapper ───────────────────────────────────────────

const ParallaxTilt = memo(({
  children,
  max = 4,
}: {
  children: React.ReactNode;
  max?: number;
}) => {
  void max;
  return (
    <div>
      {children}
    </div>
  );
});
ParallaxTilt.displayName = "ParallaxTilt";

// ─── Score dial section (scroll-driven gauge 400 → 1600) ───────────────────

const ScoreDialSection = memo(({ isDarkMode }: { isDarkMode: boolean }) => {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLDivElement>(null);
  const isNear = useIsNearViewport(sectionRef, "900px 0px");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isNear) return;
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
  }, [isNear]);

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
          <h2
            style={{
              fontFamily: "'Geist', system-ui, sans-serif",
              fontWeight: 500,
              fontSize: "clamp(40px, 5.5vw, 68px)",
              lineHeight: 0.98,
              letterSpacing: "-0.035em",
              color: "rgb(var(--ink))",
              margin: "0 0 28px",
            }}
          >
            Know exactly where
            <br />
            <em
              style={{
                fontStyle: "normal",
                fontWeight: 600,
                color: "rgb(var(--cobalt))",
              }}
            >
              you stand.
            </em>
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
  const isNear = useIsNearViewport(sectionRef, "900px 0px");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isNear) return;
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
  }, [isNear]);

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
          <h2
            style={{
              fontFamily: "'Geist', system-ui, sans-serif",
              fontWeight: 500,
              fontSize: "clamp(40px, 5.5vw, 68px)",
              lineHeight: 0.98,
              letterSpacing: "-0.035em",
              color: "rgb(var(--ink))",
              margin: "0 0 22px",
            }}
          >
            A little every day,
            <br />
            <em
              style={{
                fontStyle: "normal",
                fontWeight: 600,
                color: "rgb(var(--cobalt))",
              }}
            >
              adds up fast.
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
              color: "rgb(var(--cobalt))",
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
                  <div style={{ color: "rgb(var(--cobalt))", fontWeight: 600, marginBottom: 2 }}>
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
  const handleHeroOpenBank = useCallback(() => navigate("/bank"), [navigate]);
  const { user, signOut } = useAuth();
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const isDarkMode = useThemeMode();
  const totalQuestions = DEFAULT_QUESTION_BANK_TOTAL;
  // Hold the question demo card back until the hero counter finishes — the
  // preview mount (nested React tree + KaTeX) is what makes
  // the counter freeze/jump during initial load.
  const [questionPreviewReady, setQuestionPreviewReady] = useState(false);
  const handleCounterComplete = useCallback(() => setQuestionPreviewReady(true), []);
  useEffect(() => {
    if (questionPreviewReady) return;
    const fallback = window.setTimeout(() => setQuestionPreviewReady(true), 4200);
    return () => window.clearTimeout(fallback);
  }, [questionPreviewReady]);

  const demoTitleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || (data.type !== "homeDemoScroll" && data.type !== "heroWheel")) return;
      const deltaX = typeof data.deltaX === "number" ? data.deltaX : 0;
      const deltaY = typeof data.deltaY === "number" ? data.deltaY : 0;
      forwardHomeScroll(deltaX, deltaY);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

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
      @keyframes demoClickPulse {
        0%   { transform: scale(0.72); opacity: 0; }
        30%  { transform: scale(1); opacity: 0.8; }
        100% { transform: scale(1.65); opacity: 0; }
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
      @keyframes auroraDriftA {
        0%   { transform: translate(-10%, -20%) scale(1); }
        50%  { transform: translate(20%, 10%)  scale(1.18); }
        100% { transform: translate(-10%, -20%) scale(1); }
      }
      @keyframes auroraDriftB {
        0%   { transform: translate(60%, -10%) scale(1.1); }
        50%  { transform: translate(30%, 30%)  scale(1); }
        100% { transform: translate(60%, -10%) scale(1.1); }
      }
      @keyframes auroraDriftC {
        0%   { transform: translate(20%, 60%)  scale(1); }
        50%  { transform: translate(60%, 40%)  scale(1.22); }
        100% { transform: translate(20%, 60%)  scale(1); }
      }
      @keyframes auroraDriftD {
        0%   { transform: translate(80%, 50%)  scale(1.05); }
        50%  { transform: translate(50%, 80%)  scale(0.9); }
        100% { transform: translate(80%, 50%)  scale(1.05); }
      }
      .aurora-blob-a, .aurora-blob-b, .aurora-blob-c, .aurora-blob-d {
        top: 0; left: 0;
        width: 55%;
        aspect-ratio: 1 / 1;
        max-width: 720px;
      }
      .aurora-blob-a { animation: auroraDriftA 22s ease-in-out infinite; }
      .aurora-blob-b { animation: auroraDriftB 28s ease-in-out infinite; }
      .aurora-blob-c { animation: auroraDriftC 26s ease-in-out infinite; width: 48%; }
      .aurora-blob-d { animation: auroraDriftD 32s ease-in-out infinite; width: 42%; }
      @keyframes hpDraw {
        0%   { stroke-dashoffset: 3500; opacity: 0; }
        5%   { opacity: 1; }
        100% { stroke-dashoffset: 0; opacity: 1; }
      }
      .hp-curve {
        stroke-dasharray: 3500;
        stroke-dashoffset: 3500;
        /* Long, gentle S-curve — slow start, slow finish for a natural draw feel. */
        animation: hpDraw 3.6s cubic-bezier(0.65, 0.05, 0.35, 1) forwards;
      }
      .hp-static-curve {
        opacity: 1;
        transition: opacity 900ms ease;
      }
      .hp-static-curve.fading {
        opacity: 0;
      }
      @keyframes hpCaret {
        0%, 50%       { opacity: 1; }
        50.01%, 100%  { opacity: 0; }
      }
      .hp-cursor {
        display: inline-block;
        width: 2px;
        height: 1.05em;
        background: currentColor;
        vertical-align: text-bottom;
        margin-left: 1px;
        animation: hpCaret 1s steps(2) infinite;
      }
      /* Whole row column shifts up during pushing; overflow:hidden parent clips
         the old row off the top and the new empty slot 2 in from the bottom.
         The bare floating-equation layout uses em units so the shift tracks
         the equation font-size. */
      @keyframes hpShiftUpBare {
        from { transform: translateY(0); }
        to   { transform: translateY(-1.6em); }
      }
      .hp-shift-up-bare { animation: hpShiftUpBare 520ms cubic-bezier(0.4, 0, 0.2, 1) forwards; }
      .hp-shift-rest    { transform: translateY(0); }
      /* When the column resets (push → graphing), the new bottom row fades in
         so the freshly-revealed slot 2 doesn't pop. */
      @keyframes hpRowFadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      .hp-row-fade-in { animation: hpRowFadeIn 420ms ease forwards; }
      /* Typing reveal: clip-path animates left→right so the typeset KaTeX
         appears character-by-character. The caret rides the clip boundary
         and blinks while it moves. Use steps(...) for a closer match to
         per-character reveal vs. a continuous wipe. */
      .hp-type-wrap {
        position: relative;
        display: inline-block;
        white-space: nowrap;
      }
      .hp-type-reveal {
        display: inline-block;
        animation: hpTypeReveal 1.8s steps(22, end) forwards;
        clip-path: inset(0 100% 0 0);
      }
      @keyframes hpTypeReveal {
        from { clip-path: inset(0 100% 0 0); }
        to   { clip-path: inset(0 0 0 0); }
      }
      .hp-type-caret {
        position: absolute;
        top: 0.05em;
        left: 0;
        width: 2px;
        height: 1.1em;
        background: currentColor;
        animation:
          hpTypeCaret 1.8s steps(22, end) forwards,
          hpCaret 1s steps(2) infinite;
      }
      @keyframes hpTypeCaret {
        from { left: 0; }
        to   { left: 100%; }
      }
      .home-inline-math,
      .hp-equation-text {
        font-family: "Geist Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.96em;
        letter-spacing: 0;
      }
      .home-inline-math {
        display: inline-block;
        padding: 0 0.18em;
        border-radius: 0.3em;
        background: color-mix(in srgb, currentColor 8%, transparent);
      }
      /* Typewriter: pre-rendered equation text is revealed by a clip-path animation
         that steps left-to-right in charCount discrete chunks, one per
         character-width. The caret runs the same step animation in left
         so it sits at the reveal boundary, and a separate blink animation
         pulses it on/off. */
      @keyframes hpTwReveal {
        from { clip-path: inset(0 100% 0 0); }
        to   { clip-path: inset(0 0 0 0); }
      }
      @keyframes hpTwCaret {
        from { left: 0%; }
        to   { left: 100%; }
      }
      .hp-tw-wrap { display: inline-block; }
      .hp-tw-reveal {
        clip-path: inset(0 100% 0 0);
        animation-name: hpTwReveal;
        animation-fill-mode: forwards;
      }
      .hp-tw-caret {
        position: absolute;
        top: 0.1em;
        width: 2px;
        height: 1.1em;
        background: currentColor;
        animation-name: hpTwCaret, hpCaret;
        animation-fill-mode: forwards, none;
        animation-iteration-count: 1, infinite;
        animation-duration: inherit, 1s;
        /* Caret blink keeps its own steady cadence. */
      }
      .hp-tw-caret { animation-timing-function: inherit, steps(2); }
      /* All viewport-pinned backdrop layers (aurora, grid, curves) share
         a single fade controlled by a body class — so AuroraMesh, which is
         rendered separately from HomePageBackdrop, stays in sync without
         needing prop drilling. */
      .hp-fixed-layer { opacity: 1; transition: opacity 350ms ease; }
      body.hp-bg-hidden .hp-fixed-layer { opacity: 0; }
      /* Overscroll cap: a fixed band sitting just above the viewport, filled
         with the nav's card color, so when the user rubber-bands above the
         top of the page they see the nav appearing to continue upward rather
         than the speckled body background bleeding through. */
      body::before {
        content: '';
        position: fixed;
        top: -200px;
        left: 0;
        right: 0;
        height: 200px;
        background: rgb(var(--card));
        z-index: 30;
        pointer-events: none;
      }
      html.theme-transitioning [data-home-header='true'] {
        background-color: hsl(var(--card) / 0.98) !important;
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
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
      .demo-float { animation: none !important; }
      .practice-score-stack {
        position: relative;
        height: 420px;
        overflow: visible;
        isolation: isolate;
      }
      .practice-score-peek-viewport {
        position: absolute;
        left: 36px;
        right: 36px;
        height: 24px;
        overflow: hidden;
        pointer-events: none;
        z-index: 12;
        isolation: isolate;
      }
      .practice-score-peek-viewport-top {
        top: 29px;
        border-radius: 18px 18px 0 0;
        transform-origin: center bottom;
      }
      .practice-score-peek-viewport-bottom {
        top: 365px;
        border-radius: 0 0 18px 18px;
        transform-origin: center top;
      }
      .practice-score-peek-layer {
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: #c7dcff;
        opacity: 0.9;
        overflow: hidden;
        transform: translate3d(0, 0, 0);
        transition: transform 1600ms cubic-bezier(0.4, 0, 0.2, 1);
        will-change: transform;
      }
      .practice-score-peek-layer::before {
        content: '';
        position: absolute;
        inset: 0;
        background:
          linear-gradient(90deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 38%),
          radial-gradient(circle at calc(18% + var(--peek-offset, 0px)) 50%, rgba(255,255,255,0.18), transparent 28px);
      }
      .dark .practice-score-peek-layer {
        background: #243b63;
      }
      .dark .practice-score-peek-layer::before {
        background:
          linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0) 38%),
          radial-gradient(circle at calc(18% + var(--peek-offset, 0px)) 50%, rgba(255,255,255,0.1), transparent 28px);
      }
      .practice-score-peek-current {
        transform: translate3d(0, 0, 0);
      }
      .practice-score-peek-next {
        transform: translate3d(0, 100%, 0);
      }
      .practice-score-peek-previous {
        transform: translate3d(0, -100%, 0);
      }
      .practice-score-peek-hidden {
        opacity: 0;
        transform: translate3d(0, 100%, 0);
        transition: none;
      }
      .practice-score-card-viewport {
        position: absolute;
        top: 51px;
        left: 14px;
        right: 14px;
        height: 316px;
        z-index: 30;
        overflow: hidden;
        border-radius: 18px;
        isolation: isolate;
        box-shadow:
          0 -16px 28px -22px rgba(14,33,56,0.24),
          0 28px 48px -24px rgba(14,33,56,0.34);
      }
      .dark .practice-score-card-viewport {
        box-shadow:
          0 -16px 28px -22px rgba(0,0,0,0.45),
          0 28px 48px -24px rgba(0,0,0,0.56);
      }
      .practice-score-card-shell {
        position: absolute;
        inset: 0;
        z-index: 1;
        backface-visibility: hidden;
        transform-origin: center center;
        overflow: visible;
        border-radius: 18px;
        contain: layout;
        will-change: transform;
        transition: transform 1600ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .practice-score-card-shell > article {
        height: 316px;
        box-shadow: none !important;
      }
      .practice-score-card-current {
        z-index: 2;
        transform: translate3d(0, 0, 0);
      }
      .practice-score-card-next {
        pointer-events: none;
        transform: translate3d(0, 316px, 0);
      }
      .practice-score-card-previous {
        pointer-events: none;
        transform: translate3d(0, -316px, 0);
      }
      .practice-score-card-hidden {
        z-index: 0;
        opacity: 0;
        pointer-events: none;
        transform: translate3d(0, 316px, 0);
        transition: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .practice-score-card-shell,
        .practice-score-peek-layer {
          transition: none !important;
        }
      }

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
        .aurora-blob-a, .aurora-blob-b, .aurora-blob-c, .aurora-blob-d {
          animation: none !important;
        }
        .hp-curve { animation: none !important; opacity: 1 !important; stroke-dashoffset: 0 !important; }
        .hp-static-curve { opacity: 1 !important; transition: none !important; }
        .hp-type-reveal, .hp-type-caret, .hp-shift-up-bare { animation: none !important; }
        .hp-type-reveal { clip-path: none !important; }
        .hp-type-caret { display: none !important; }
        .hp-desmos-panel { display: none !important; }
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
        .filter-feature-row {
          grid-template-columns: 1fr !important;
          gap: 40px !important;
          padding: 80px 16px !important;
        }
        .practice-tests-feature-row {
          grid-template-columns: 1fr !important;
          gap: 26px !important;
          padding: 56px 16px 44px !important;
        }
        .practice-results-showcase {
          height: auto !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        .practice-score-stack {
          height: 420px !important;
        }
        .home-proof-section {
          padding: 56px 16px 64px !important;
        }
        .home-proof-section > div {
          grid-template-columns: 1fr !important;
          gap: 32px !important;
        }
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
    let raf = 0;
    let previous: boolean | null = null;
    const updateHeaderState = () => {
      raf = 0;
      const next = window.scrollY > 12;
      if (next === previous) return;
      previous = next;
      setIsHeaderScrolled(next);
    };
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(updateHeaderState);
    };

    updateHeaderState();
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
    };
  }, []);

  return (
    <div
      data-home-page="true"
      className="min-h-screen flex flex-col"
      style={{ fontFamily: "'Geist', 'Inter', system-ui, sans-serif" }}
    >
      <header
        data-home-header="true"
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
              100 Hard Math
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
        className="home-hero-section"
        style={{
          // No section-level gradient. The body's solid `bg-background` shows
          // through, so the hero's bg matches the next section's bg exactly —
          // there's no color-change line at the section boundary. The aurora
          // (fixed) supplies the colored top accent.
          background: "transparent",
          position: "relative",
          overflow: "hidden",
          paddingBottom: "clamp(72px, 7vw, 108px)",
        }}
      >
        {/* Aurora mesh background — soft colored blobs */}
        <AuroraMesh isDarkMode={isDarkMode} />
        {/* Graph paper backdrop — sits over the aurora; only the
            left/right/top/bottom edges show through the radial mask. */}
        <HomePageBackdrop isDarkMode={isDarkMode} />

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
            data-curve-cutout
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
                color: "rgb(var(--cobalt))",
              }}
            >
              best score.
            </span>
          </h1>

          {/* Subtitle — Geist 300, 19px lede, leading 1.55, ink-mid. */}
          <p
            className="h-fade-3 home-subtitle"
            data-curve-cutout
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
            data-curve-cutout
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
                // ink-fixed stays dark on the always-light accent fill in dark mode.
                color: "rgb(var(--ink-fixed))",
                fontWeight: 600,
                fontSize: 15,
                border: "none",
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
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
                el.style.color = "rgb(var(--ink-fixed))";
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
                fontWeight: 600,
                fontSize: 15,
                border: isDarkMode
                  ? "1px solid rgba(255,255,255,0.11)"
                  : "1px solid rgba(14,33,56,0.10)",
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
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
          <div className="h-fade-5 home-counter" data-curve-cutout style={{ marginBottom: 88 }}>
            {/* Hero stat — Inter Tight 600, design's "stat-xl" scale (72px peak,
                line-height 0.95, tracking -4%). Tabular nums, comma-grouped. */}
            <div
              className="home-count-num"
              style={{
              fontSize: "clamp(44px, 5.2vw, 72px)",
              fontFamily: "'Inter Tight', sans-serif",
              fontWeight: 600,
              color: "rgb(var(--ink))",
              letterSpacing: "-0.04em",
              lineHeight: 0.95,
              fontVariantNumeric: "tabular-nums",
              fontFeatureSettings: "'tnum'",
              }}
            >
              <SlotMachineCounter value={totalQuestions} onComplete={handleCounterComplete} />
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
            margin: "210px auto 0",
            padding: "0 24px",
            position: "relative",
          }}
        >
          {/* Section header */}
          <div
            ref={demoTitleRef}
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

          <ParallaxTilt max={3}>
            <HeroQuestionPreview
              isDarkMode={isDarkMode}
              onOpenBank={handleHeroOpenBank}
              ready={questionPreviewReady}
            />
          </ParallaxTilt>
        </div>

      </section>

      {/* ── EXPLANATION POPUP DEMO ─────────────────────────────────────── */}
      <section className="bg-background" style={sectionVisibility("auto 720px")}>
        <ExplanationFeatureSection isDarkMode={isDarkMode} />
      </section>

      {/* ── FEATURE ROW — BANK FILTERS ────────────────────────────────── */}
      <section className="bg-background" style={sectionVisibility("auto 760px")}>
        <FilterFeatureSection
          isDarkMode={isDarkMode}
          totalQuestions={totalQuestions}
        />
      </section>

      {/* ── PRACTICE TESTS ─────────────────────────────────────────────── */}
      <section className="bg-background" style={sectionVisibility("auto 560px")}>
        <PracticeTestsFeatureSection isDarkMode={isDarkMode} />
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section
        className="home-cta-final"
        style={{ padding: "0px 24px 96px", position: "relative" }}
      >
        <div style={{ position: "relative", maxWidth: 960, margin: "0 auto", textAlign: "center" }}>
          <h2
            style={{
              fontFamily: "'Geist', system-ui, sans-serif",
              fontSize: "clamp(36px, 5vw, 60px)",
              fontWeight: 500,
              letterSpacing: "-0.035em",
              color: "rgb(var(--ink))",
              margin: "0 0 28px",
              lineHeight: 1,
            }}
          >
            {user ? (
              <>Practice Now.</>
            ) : (
              <>
                Always{" "}
                <em
                  style={{
                    fontStyle: "normal",
                    fontWeight: 600,
                    color: "rgb(var(--cobalt))",
                  }}
                >
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
