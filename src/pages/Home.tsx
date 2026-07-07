import { Suspense, lazy, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isChunkLoadError, recoverFromChunkLoadError } from "@/lib/chunkLoadRecovery";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { PreloadLink } from "@/components/PreloadLink";
import {
  ArrowRight,
  BarChart3,
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
  defaultFilters,
  MAX_TIME_SPENT_FILTER_SECONDS,
  MIN_SCORE_BAND,
  MAX_SCORE_BAND,
  type QuestionBankFilters,
} from "@/lib/questionBankFilters";
import { MOBILE_MEDIA_QUERY } from "@/hooks/use-mobile";
import { useThemeMode } from "@/lib/theme";
import { preloadRouteIntent } from "@/lib/routePreload";
import { BANK_TOTAL_ALL } from "@/lib/generated/bankTotals.generated";

const DEFAULT_QUESTION_BANK_TOTAL = BANK_TOTAL_ALL;
const PRACTICE_TESTS_COUNT = 34;
const HERO_QUESTION_PREVIEW_LIMIT = 3;
const HERO_PREVIEW_FORCE_READY_MS = 1400;
const preloadBankRoute = () => preloadRouteIntent("/bank");
const preloadModulesRoute = () => preloadRouteIntent("/modules");
const preloadProfileRoute = () => preloadRouteIntent("/profile");
const preloadAnalysisRoute = () => preloadRouteIntent("/analysis");
const preloadLoginRoute = () => preloadRouteIntent("/login");
const preloadSignupRoute = () => preloadRouteIntent("/signup");

const InlineDesmos = lazy(() =>
  import("@/components/tools/InlineDesmos").then((mod) => ({ default: mod.InlineDesmos })),
);
const loadEmbeddedQuestionPreview = () =>
  import("@/pages/bank/Question").then((mod) => ({ default: mod.Question }));
const EmbeddedQuestionPreview = lazy(loadEmbeddedQuestionPreview);
const EmbeddedBankIndexPreview = lazy(() =>
  import("@/pages/bank/BankIndex").then((mod) => ({ default: mod.BankIndex })),
);
const defaultBankFilters = defaultFilters;
const HOME_DEMO_USER_SCROLL_EVENT = "home-demo-user-scroll";
const STYLE_POSITION_RELATIVE: CSSProperties = { position: "relative" };

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

const HERO_PREVIEW_SCALE = 1.02;
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
      <div className="relative flex h-full flex-col">
        <div
          className="relative flex h-14 shrink-0 items-center justify-end gap-2 border-b px-4"
          style={{ borderColor, background: panelBg }}
        >
          <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-3">
            <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-4 w-4 rounded-full" />
            <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-5 w-14 rounded-full" />
            <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-4 w-4 rounded-sm" />
          </div>
          <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-9 w-32 rounded-md" />
          <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-9 w-24 rounded-md" style={{ background: accentBg }} />
          <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-9 w-20 rounded-md" />
        </div>

        <div className="min-h-0 flex-1 overflow-hidden px-4 py-6">
          <div className="mx-auto max-w-[56rem] p-4 sm:p-6">
            <div
              className="mb-6 flex h-12 items-center justify-between overflow-hidden rounded-md border"
              style={{ borderColor, background: softBg }}
            >
              <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-full w-16 rounded-none" />
              <div className="flex h-full flex-1 items-center gap-3 px-3">
                <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-6 w-32 rounded-md" />
              </div>
              <HomeSkeletonBlock isDarkMode={isDarkMode} className="mr-2 h-9 w-9 rounded-md" />
            </div>

            <div className="mb-8 space-y-4">
              <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-4 w-24 rounded-full" style={{ background: accentBg }} />
              <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-4 w-full rounded-full" />
              <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-4 w-11/12 rounded-full" />
            </div>

            <div className="space-y-3">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="flex min-h-[4rem] items-center gap-3 rounded-lg border p-4"
                  style={{ borderColor, background: item === 1 ? accentBg : panelBg }}
                >
                  <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-8 w-8 shrink-0 rounded-full" />
                  <div className="w-full space-y-2">
                    <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-3 w-full rounded-full" />
                    <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-3 w-2/3 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 border-t px-4 py-3 shadow-lg"
          style={{ borderColor, background: panelBg }}
        >
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
            <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-10 w-24 rounded-md" />
            <div className="flex justify-center gap-2">
              <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-10 w-28 rounded-md" />
              <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-10 w-24 rounded-md" style={{ background: accentBg }} />
            </div>
            <div className="flex gap-2">
              <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-10 w-24 rounded-md" />
              <HomeSkeletonBlock isDarkMode={isDarkMode} className="h-10 w-20 rounded-md" />
            </div>
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
  ready?: boolean;
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
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
    const nextId = decodeURIComponent(match[2]);
    const nextQuestionNumber = Number.parseInt(nextId, 10);
    if (!Number.isInteger(nextQuestionNumber) || nextQuestionNumber < 1 || nextQuestionNumber > HERO_QUESTION_PREVIEW_LIMIT) {
      onOpenBank?.();
      return;
    }
    setPreviewLoaded(false);
    setPreviewQuestion({
      subject: match[1] as "math" | "reading",
      id: nextId,
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
    questionLimit: HERO_QUESTION_PREVIEW_LIMIT,
  }), [handlePreviewNavigate, handlePreviewReady, isDarkMode, onOpenBank, previewQuestion.id, previewQuestion.subject]);
  const [isPhone, setIsPhone] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_MEDIA_QUERY).matches : false,
  );
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_MEDIA_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsPhone(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  const activeScale = isPhone ? HERO_PREVIEW_MOBILE_SCALE : HERO_PREVIEW_SCALE;
  const activeLogicalHeight = isPhone ? HERO_PREVIEW_MOBILE_LOGICAL_HEIGHT : HERO_PREVIEW_LOGICAL_HEIGHT;
  const visibleHeight = activeLogicalHeight * activeScale;
  useForwardScrollToPage(rootRef, nearViewport);
  useEffect(() => {
    if (!nearViewport) setPreviewLoaded(false);
  }, [nearViewport]);
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

  if (!nearViewport) {
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
  // Mount the embed as soon as the frame is near the viewport so it loads and
  // renders under the skeleton during the ready-gate window; only reveal it
  // once it has painted (previewLoaded) AND the hero intro has finished (ready),
  // so the fade-in matches the previous visual sequence but never exposes a
  // still-loading skeleton.
  const revealed = previewLoaded && ready;
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
          opacity: revealed ? 1 : 0,
          transition: "opacity 220ms ease",
        }}
      >
        <Suspense fallback={null}>
          <EmbeddedQuestionPreview previewEmbed={previewEmbed} />
        </Suspense>
      </div>
      {!revealed && (
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
  const rowRef = useRef<HTMLDivElement>(null);
  const isNear = useIsNearViewport(rowRef, "300px 0px");
  return (
    <div
      ref={rowRef}
      className="explanation-feature-row"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.15fr)",
        gap: 76,
        alignItems: "center",
        padding: "110px 24px",
        maxWidth: 1440,
        margin: "0 auto",
      }}
    >
      <div>
        <h2
          style={{
            fontFamily: "'Geist', system-ui, sans-serif",
            fontWeight: 500,
            fontSize: "clamp(40px, 4.9vw, 72px)",
            lineHeight: 1,
            letterSpacing: "-0.035em",
            color: "rgb(var(--ink))",
            margin: "0 0 22px",
          }}
        >
          See how every
          <br />
          <em
            style={{
              fontStyle: "normal",
              fontWeight: 600,
              color: "rgb(var(--cobalt))",
            }}
          >
            answer is built.
          </em>
        </h2>
        <p
          style={{
            fontSize: 18,
            lineHeight: 1.65,
            fontWeight: 300,
            color: isDarkMode ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.62)",
            maxWidth: 504,
            margin: "0 0 28px",
          }}
        >
          Learn step-by-step through every solution.
        </p>
      </div>

      <div style={STYLE_POSITION_RELATIVE}>
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
        <div style={STYLE_POSITION_RELATIVE}>
          <ParallaxTilt max={3}>
            <AnimatedExplanation isDarkMode={isDarkMode} active={isNear} />
          </ParallaxTilt>
        </div>
      </div>
    </div>
  );
});
ExplanationFeatureSection.displayName = "ExplanationFeatureSection";
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

// mathRendering (KaTeX, ~290KB) is loaded lazily so it stays off the home
// page's critical path; the demo section loads it on mount, well before its
// explanation steps scroll into view.
type MathRenderingModule = typeof import("@/lib/text/mathRendering");
let loadedMathRenderingModule: MathRenderingModule | null = null;
const loadMathRenderingModule = () =>
  import("@/lib/text/mathRendering").then((mod) => {
    loadedMathRenderingModule = mod;
    return mod;
  });

const useMathRenderingModule = () => {
  const [mathRendering, setMathRendering] = useState<MathRenderingModule | null>(loadedMathRenderingModule);

  useEffect(() => {
    if (mathRendering) return;
    let cancelled = false;
    void loadMathRenderingModule().then(
      (mod) => {
        if (!cancelled) setMathRendering(mod);
      },
      (error: unknown) => {
        if (isChunkLoadError(error)) recoverFromChunkLoadError();
      },
    );
    return () => {
      cancelled = true;
    };
  }, [mathRendering]);

  return mathRendering;
};

const AnimatedExplanation = memo(({ isDarkMode, active }: { isDarkMode: boolean; active: boolean }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isVisible = useIsCurrentlyInViewport(scrollRef);
  const documentVisible = useDocumentVisible();
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [animKey, setAnimKey] = useState(0);
  const [paused, setPaused] = useState(false);

  const totalSteps = EXPLANATION_STEPS.length;

  useForwardScrollToPage(scrollRef);

  useEffect(() => {
    if (paused || !active || !isVisible || !documentVisible) return;
    const timerId = setInterval(() => {
      setDirection(1);
      setCurrentStep((stepIndex) => (stepIndex + 1) % totalSteps);
      setAnimKey((animationKey) => animationKey + 1);
    }, 3600);
    return () => clearInterval(timerId);
  }, [active, documentVisible, isVisible, paused, totalSteps]);

  const goTo = (target: number) => {
    setPaused(true);
    setDirection(target > currentStep ? 1 : -1);
    setCurrentStep(Math.max(0, Math.min(totalSteps - 1, target)));
    setAnimKey((animationKey) => animationKey + 1);
  };

  const step = EXPLANATION_STEPS[currentStep];
  const isLast = currentStep === totalSteps - 1;
  const mathRendering = useMathRenderingModule();
  const stepBodyHtml = mathRendering
    ? mathRendering.renderMixedContent(step.body, { convertTexLineBreaks: false })
    : "";

  return (
    <div
      ref={scrollRef}
      className="rounded-[14px] overflow-hidden border border-border bg-card flex flex-col"
      style={{
        height: 634,
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
          {EXPLANATION_STEPS.map((_, stepIndex) => (
            <button
              key={stepIndex}
              onClick={() => goTo(stepIndex)}
              className={`rounded-full transition-all duration-300 ${
                stepIndex === currentStep
                  ? "w-3 h-1.5 bg-primary"
                  : "w-1.5 h-1.5 bg-primary/40 hover:bg-primary/70 cursor-pointer"
              }`}
              aria-label={`Go to step ${stepIndex + 1}`}
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
                <h3 className="text-lg font-semibold leading-snug">
                  {step.title}
                </h3>
                <span className="text-[13px] text-muted-foreground">
                  Step {currentStep + 1} of {totalSteps}
                </span>
              </div>
            </div>
            <div
              className="pl-9 text-[17px] leading-snug explanation-content text-foreground/90"
              dangerouslySetInnerHTML={{ __html: stepBodyHtml }}
            />
            {step.desmos && (
              <div className="ml-9 mt-2">
                <Suspense
                  fallback={
                    <div
                      className="rounded-lg border border-primary/20 overflow-hidden bg-background"
                      style={{ height: 264 }}
                    />
                  }
                >
                  <InlineDesmos expressions={step.desmos} height={264} forwardScrollToPage />
                </Suspense>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 shrink-0 items-center gap-2 border-t border-border/50 px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => goTo(currentStep - 1)}
          disabled={currentStep === 0}
          className="min-w-0 flex-1 gap-1 px-2"
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
            className="min-w-0 flex-1 gap-1 px-2"
          >
            <span className="hidden sm:inline">Next Step</span>
            <span className="sm:hidden">Next</span>
            <ChevronDown className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
});
AnimatedExplanation.displayName = "AnimatedExplanation";

const FilterFeatureSection = memo(({
  isDarkMode,
}: {
  isDarkMode: boolean;
}) => {
  const navigate = useNavigate();
  return (
    <div
      className="filter-feature-row"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.44fr) minmax(340px, 0.82fr)",
        gap: 86,
        alignItems: "center",
        padding: "126px 24px",
        maxWidth: 1656,
        margin: "0 auto",
      }}
    >
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
        <div style={STYLE_POSITION_RELATIVE}>
          <ParallaxTilt max={3}>
            <BankFilterInlineDemo isDarkMode={isDarkMode} />
          </ParallaxTilt>
        </div>
      </div>

      <div>
        <h2
          style={{
            fontFamily: "'Geist', system-ui, sans-serif",
            fontWeight: 500,
            fontSize: "clamp(40px, 4.9vw, 72px)",
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
            fontSize: 18,
            lineHeight: 1.6,
            fontWeight: 300,
            color: isDarkMode ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.62)",
            maxWidth: 528,
            margin: "0 0 28px",
          }}
        >
          Find the exact SAT questions you need by difficulty, topic, time spent,
          and what you have or haven&rsquo;t solved &mdash; in one click.
        </p>
        <button
          type="button"
          onClick={() => navigate("/bank")}
          onFocus={preloadBankRoute}
          onPointerDown={preloadBankRoute}
          onPointerEnter={preloadBankRoute}
          onTouchStart={preloadBankRoute}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 15,
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

const PracticeTestScoreShowcase = memo(() => {
  return (
    <div
      className="practice-results-showcase"
      style={{
        position: "relative",
        maxWidth: 744,
        marginLeft: "auto",
      }}
    >
      <div className="practice-score-stack">
        <div className="practice-score-card-viewport">
          <div className="practice-score-card-shell practice-score-card-current">
            <SatScoreCard
              title="Practice Test 10"
              dateLabel="August 1, 2026"
              totalScore={1600}
              readingWritingScore={800}
              mathScore={800}
              compact
              showcase
            />
          </div>
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
        gap: 76,
        alignItems: "center",
        padding: "82px 24px 65px",
        maxWidth: 1440,
        margin: "0 auto",
      }}
    >
      <div>
        <h2
          style={{
            fontFamily: "'Geist', system-ui, sans-serif",
            fontWeight: 500,
            fontSize: "clamp(40px, 4.9vw, 72px)",
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
            fontSize: 18,
            lineHeight: 1.6,
            fontWeight: 300,
            color: isDarkMode ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.62)",
            maxWidth: 528,
            margin: "0 0 28px",
          }}
        >
          Full-length SAT practice tests organized by subject and module &mdash;
          take a complete test, drill one section, or review a single module.
        </p>
        <button
          type="button"
          onClick={() => navigate("/modules")}
          onFocus={preloadModulesRoute}
          onPointerDown={preloadModulesRoute}
          onPointerEnter={preloadModulesRoute}
          onTouchStart={preloadModulesRoute}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 15,
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

      <div style={STYLE_POSITION_RELATIVE}>
        <PracticeTestScoreShowcase />
      </div>
    </div>
  );
});
PracticeTestsFeatureSection.displayName = "PracticeTestsFeatureSection";

const FILTER_DEMO_PREVIEW_WIDTH = 874;
const FILTER_DEMO_PREVIEW_HEIGHT = 696;
const FILTER_DEMO_MAX_SCALE = 1;
const FILTER_DEMO_CURSOR_MIN_DURATION_MS = 420;
const FILTER_DEMO_CURSOR_MAX_DURATION_MS = 2400;
const FILTER_DEMO_CURSOR_SPEED_PX_PER_MS = 0.127;
const FILTER_DEMO_CURSOR_CLICK_PAUSE_MS = 32;
const FILTER_DEMO_CURSOR_MENU_PAUSE_MS = 0;
const FILTER_DEMO_CURSOR_NEXT_STEP_PAUSE_MS = 360;
const FILTER_DEMO_CURSOR_IDLE_RETRY_MS = 180;
const FILTER_DEMO_CURSOR_CLOSE_MENU_DURATION_MS = 220;
const FILTER_DEMO_MENU_AUTO_CLOSE_CHECK_MS = 90;
const FILTER_DEMO_OPTION_PRESS_MS = 140;
const FILTER_DEMO_USER_INTERACTION_PAUSE_MS = 900;
const FILTER_DEMO_MANUAL_CLOSE_PAUSE_MS = 1800;
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
    valueRange: [number, number];
  };
};

const demoTargetFilters: QuestionBankFilters = {
  scoreBandRange: [8, 10],
  timeSpentRange: [20, 95],
  activeQuestions: "active",
  markedForReview: "yes",
  solved: "yes",
  answeredIncorrectly: "all",
};

const isDemoApplied = (filters: QuestionBankFilters) =>
  filters.scoreBandRange[0] === demoTargetFilters.scoreBandRange[0] &&
  filters.scoreBandRange[1] === demoTargetFilters.scoreBandRange[1] &&
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

const isUsableDemoOption = (element: HTMLElement) => (
  isVisibleElement(element) && Boolean(element.textContent?.trim())
);

const isVisibleInViewport = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
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
  const isNear = useIsNearViewport(containerRef, "900px 0px");
  const isVisible = useIsCurrentlyInViewport(containerRef);
  const documentVisible = useDocumentVisible();
  const [demoLoaded, setDemoLoaded] = useState(false);
  const demoShouldMount = isNear;
  const demoShouldRun = isNear && isVisible && documentVisible;
  const [demoScale, setDemoScale] = useState(FILTER_DEMO_MAX_SCALE);
  const [filters, setFilters] = useState<QuestionBankFilters>(defaultBankFilters);
  const [cursor, setCursor] = useState<DemoCursorState>({
    x: 28,
    y: 86,
    visible: false,
    durationMs: 0,
  });
  const cursorRef = useRef(cursor);
  const cursorPathSeedRef = useRef(0);
  const userFilterPauseUntilRef = useRef(0);
  const manualResumeTimerRef = useRef<number | null>(null);
  const manualResumeTokenRef = useRef(0);
  const scriptedInteractionDepthRef = useRef(0);
  const lastManualInteractionAtRef = useRef(0);
  const [clickKey, setClickKey] = useState(0);
  const [demoMode, setDemoMode] = useState<FilterDemoMode>("apply");
  const [demoTick, setDemoTick] = useState(1);
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
  const applyDemoOptionKey = useCallback((optionKey: string) => {
    const [group, value] = optionKey.split(":");
    if (!value) return;
    if (group === "activity") {
      setDemoFilterPatch({ activeQuestions: value as QuestionBankFilters["activeQuestions"] });
      return;
    }
    if (group === "marked") {
      setDemoFilterPatch({ markedForReview: value as QuestionBankFilters["markedForReview"] });
      return;
    }
    if (group === "solved") {
      setDemoFilterPatch({ solved: value as QuestionBankFilters["solved"] });
      return;
    }
    if (group === "incorrect") {
      setDemoFilterPatch({ answeredIncorrectly: value as QuestionBankFilters["answeredIncorrectly"] });
    }
  }, [setDemoFilterPatch]);
  const handleBankDemoReady = useCallback(() => {
    setDemoLoaded(true);
  }, []);
  const queueManualResume = useCallback(() => {
    if (manualResumeTimerRef.current !== null) {
      window.clearTimeout(manualResumeTimerRef.current);
    }
    const resumeToken = manualResumeTokenRef.current + 1;
    manualResumeTokenRef.current = resumeToken;
    const resumeDelay = Math.max(0, userFilterPauseUntilRef.current - Date.now());
    manualResumeTimerRef.current = window.setTimeout(() => {
      if (resumeToken !== manualResumeTokenRef.current) return;
      manualResumeTimerRef.current = null;
      const resumedCursor = { ...cursorRef.current, visible: true, durationMs: 0 };
      cursorRef.current = resumedCursor;
      setCursor(resumedCursor);
      window.setTimeout(() => setDemoTick((tick) => tick + 1), 40);
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
    const container = containerRef.current;
    const target = event.target instanceof HTMLElement ? event.target : null;
    const filterRoot = container?.querySelector<HTMLElement>('[data-tour="bank-filters"]');
    const filterRect = filterRoot?.getBoundingClientRect();
    const isInsideFilterBounds = Boolean(
      filterRect &&
      event.clientX >= filterRect.left &&
      event.clientX <= filterRect.right &&
      event.clientY >= filterRect.top &&
      event.clientY <= filterRect.bottom,
    );
    const isFilterTarget = Boolean(
      target?.closest('[data-tour="bank-filters"], [data-filter-demo-option], [role="option"], [cmdk-item]'),
    );
    if (!isFilterTarget && !isInsideFilterBounds) {
      return;
    }
    const now = Date.now();
    if (now - lastManualInteractionAtRef.current < 50) return;
    lastManualInteractionAtRef.current = now;
    const hiddenCursor = { ...cursorRef.current, visible: false, durationMs: 0 };
    cursorRef.current = hiddenCursor;
    setCursor(hiddenCursor);
    userFilterPauseUntilRef.current = now + FILTER_DEMO_USER_INTERACTION_PAUSE_MS;
    setManualInteractionVersion((version) => version + 1);
    queueManualResume();
  }, [queueManualResume]);
  const pauseForHomeFilterMenuChange = useCallback((_control: string, open: boolean) => {
    if (scriptedInteractionDepthRef.current > 0) return;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const restoreScroll = () => {
      if (Math.abs(window.scrollX - scrollX) > 1 || Math.abs(window.scrollY - scrollY) > 1) {
        window.scrollTo(scrollX, scrollY);
      }
    };
    const now = Date.now();
    const hiddenCursor = { ...cursorRef.current, visible: false, durationMs: 0 };
    cursorRef.current = hiddenCursor;
    setCursor(hiddenCursor);
    userFilterPauseUntilRef.current = now + (open
      ? FILTER_DEMO_USER_INTERACTION_PAUSE_MS
      : FILTER_DEMO_MANUAL_CLOSE_PAUSE_MS);
    if (open) {
      window.requestAnimationFrame(restoreScroll);
      window.setTimeout(restoreScroll, 80);
      window.setTimeout(restoreScroll, 220);
    }
    setManualInteractionVersion((version) => version + 1);
    queueManualResume();
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
    const ownerDocument = container.ownerDocument;
    ownerDocument.addEventListener("pointerdown", pauseForManualFilterInteraction, { capture: true });
    ownerDocument.addEventListener("mousedown", pauseForManualFilterInteraction, { capture: true });
    return () => {
      ownerDocument.removeEventListener("pointerdown", pauseForManualFilterInteraction, { capture: true });
      ownerDocument.removeEventListener("mousedown", pauseForManualFilterInteraction, { capture: true });
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
        .find(isUsableDemoOption) ?? null
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
      valueRange: [0, MAX_TIME_SPENT_FILTER_SECONDS],
    });
    const bandDrag = (
      from: [number, number],
      to: [number, number],
    ): NonNullable<FilterDemoAction["timeDrag"]> => ({
      from,
      to,
      setRange: (range) => setDemoFilterPatch({ scoreBandRange: range }),
      valueRange: [MIN_SCORE_BAND, MAX_SCORE_BAND],
    });
    const slider = () => control("time") ?? root.querySelector<HTMLElement>('[role="slider"]');
    const bandSlider = () => control("difficulty");

    if (mode === "apply") {
      if (
        currentFilters.scoreBandRange[0] !== demoTargetFilters.scoreBandRange[0] ||
        currentFilters.scoreBandRange[1] !== demoTargetFilters.scoreBandRange[1]
      ) {
        const target = bandSlider();
        return target ? {
          target,
          timeDrag: bandDrag(
            [currentFilters.scoreBandRange[0], currentFilters.scoreBandRange[1]],
            [demoTargetFilters.scoreBandRange[0], demoTargetFilters.scoreBandRange[1]],
          ),
        } : null;
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

    if (
      currentFilters.scoreBandRange[0] !== defaultBankFilters.scoreBandRange[0] ||
      currentFilters.scoreBandRange[1] !== defaultBankFilters.scoreBandRange[1]
    ) {
      const target = bandSlider();
      return target ? {
        target,
        timeDrag: bandDrag(
          [currentFilters.scoreBandRange[0], currentFilters.scoreBandRange[1]],
          [defaultBankFilters.scoreBandRange[0], defaultBankFilters.scoreBandRange[1]],
        ),
      } : null;
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
    if (!demoShouldRun || !demoLoaded || demoTick === 0) return;
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
    if (!container) {
      return scheduleDemoTick(FILTER_DEMO_CURSOR_IDLE_RETRY_MS);
    }
    const action = resolveDemoAction(container, filtersRef.current, modeRef.current);
    if (!action) {
      return scheduleDemoTick(FILTER_DEMO_CURSOR_NEXT_STEP_PAUSE_MS);
    }

    let protectedScrollX = window.scrollX;
    let protectedScrollY = window.scrollY;
    const timers: number[] = [];
    const rafs = new Set<number>();
    let demoInterrupted = false;
    let userScrolled = false;
    const captureProtectedScroll = () => {
      protectedScrollX = window.scrollX;
      protectedScrollY = window.scrollY;
    };
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
    const isPointOnTarget = (target: HTMLElement) => {
      const point = viewportPointForElement(target);
      const hit = target.ownerDocument.elementFromPoint(point.x, point.y);
      return Boolean(hit && target.contains(hit));
    };
    const markUserScroll = () => {
      if (!isVisibleInViewport(container)) return;
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
      target.isConnected &&
      isVisibleElement(target) &&
      (!isTargetInViewport(target) || isPointOnTarget(target))
    );
    const restoreScroll = () => {
      if (userScrolled) return;
      if (!isVisibleInViewport(container)) return;
      if (
        Math.abs(window.scrollX - protectedScrollX) > 12 ||
        Math.abs(window.scrollY - protectedScrollY) > 12
      ) {
        window.scrollTo(protectedScrollX, protectedScrollY);
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
    const cursorForViewportPoint = (point: { x: number; y: number }) => {
      const currentContainerRect = container.getBoundingClientRect();
      return {
        x: point.x - currentContainerRect.left - FILTER_DEMO_CURSOR_HOTSPOT_X,
        y: point.y - currentContainerRect.top - FILTER_DEMO_CURSOR_HOTSPOT_Y,
        visible: true,
      };
    };
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
	    const getDemoTimePoint = (
      element: HTMLElement,
      value: number,
      valueRange: [number, number] = [0, MAX_TIME_SPENT_FILTER_SECONDS],
    ) => {
      const rect = element.getBoundingClientRect();
      const inset = Math.min(12, rect.width * 0.14);
      const [rangeMin, rangeMax] = valueRange;
      const clamped = Math.min(rangeMax, Math.max(rangeMin, value));
      const ratio = rangeMax === rangeMin ? 0 : (clamped - rangeMin) / (rangeMax - rangeMin);
      return {
        x: rect.left + inset + (rect.width - inset * 2) * ratio,
        y: rect.top + rect.height / 2,
      };
    };
    const clickDemoTarget = (target: HTMLElement, afterClick?: () => void) => {
      if (!canRunStep(target)) return false;
      setCursorToPoint(viewportPointForElement(target), 0);
      setClickKey((key) => key + 1);
      if (target.hasAttribute("data-filter-demo-option")) {
        target.classList.add("filter-demo-option-press");
        schedule(() => {
          if (!canRunStep(target)) {
            queueDemoRetry();
            return;
          }
          captureProtectedScroll();
          activateScriptedElement(target);
          afterClick?.();
        }, FILTER_DEMO_OPTION_PRESS_MS);
        schedule(() => target.classList.remove("filter-demo-option-press"), FILTER_DEMO_OPTION_PRESS_MS + 140);
        return true;
      }
      captureProtectedScroll();
      activateScriptedElement(target);
      afterClick?.();
      return true;
    };
    const animateRangeValue = (
      index: 0 | 1,
      startValue: number,
      endValue: number,
      rangeBase: [number, number],
      setRange: (range: [number, number]) => void,
      duration = 560,
      valueRange: [number, number] = [0, MAX_TIME_SPENT_FILTER_SECONDS],
    ) => {
      captureProtectedScroll();
      const startedAt = performance.now();
      let lastValue = Number.NaN;
      const [rangeMin, rangeMax] = valueRange;
      const step = (now: number) => {
        if (demoInterrupted || Date.now() < userFilterPauseUntilRef.current) return;
        const progress = duration <= 0 ? 1 : Math.min(1, Math.max(0, (now - startedAt) / duration));
        // Interpolate continuously (no stepped rounding) so the thumb glides smoothly;
        // the caller snaps to the exact stepped target once the animation completes.
        const nextValue = Math.min(rangeMax, Math.max(rangeMin,
          startValue + (endValue - startValue) * getDemoCursorEase(progress)));
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
      const { from, to, setRange, valueRange } = action.timeDrag;
      const changedHandles = ([0, 1] as const).filter((index) => from[index] !== to[index]);
      if (changedHandles.length === 0) {
        captureProtectedScroll();
        setRange([to[0], to[1]]);
        restoreScrollSoon();
        queueDemoTick();
        return () => {
          stopWatchingScroll();
          timers.forEach((timer) => window.clearTimeout(timer));
          rafs.forEach((frame) => window.cancelAnimationFrame(frame));
        };
      }

      let currentRange: [number, number] = [from[0], from[1]];
      const runTimeHandle = (handlePosition: number) => {
        const handleIndex = changedHandles[handlePosition];
        const startValue = currentRange[handleIndex];
        const endValue = to[handleIndex];
        const moveDuration = setCursorToPoint(getDemoTimePoint(action.target, startValue, valueRange));
        schedule(() => {
          if (!canRunStep(action.target)) {
            queueDemoRetry();
            return;
          }
          setClickKey((key) => key + 1);
          const animationBase: [number, number] = [currentRange[0], currentRange[1]];
          const dragDuration = setCursorToPoint(getDemoTimePoint(action.target, endValue, valueRange));
          captureProtectedScroll();
          animateRangeValue(handleIndex, startValue, endValue, animationBase, setRange, dragDuration, valueRange);
          schedule(() => {
            if (!canRunStep(action.target)) {
              queueDemoRetry();
              return;
            }
            currentRange = [currentRange[0], currentRange[1]];
            currentRange[handleIndex] = endValue;
            captureProtectedScroll();
            setRange(currentRange);
            restoreScrollSoon();
            if (handlePosition + 1 < changedHandles.length) {
              runTimeHandle(handlePosition + 1);
            } else {
              captureProtectedScroll();
              setRange([to[0], to[1]]);
              queueDemoTick();
            }
          }, dragDuration + FILTER_DEMO_CURSOR_CLICK_PAUSE_MS);
        }, moveDuration + FILTER_DEMO_CURSOR_CLICK_PAUSE_MS);
      };

      runTimeHandle(0);
      return () => {
        stopWatchingScroll();
        timers.forEach((timer) => window.clearTimeout(timer));
        rafs.forEach((frame) => window.cancelAnimationFrame(frame));
      };
    }

    if (action.optionKey && !isVisibleInViewport(container)) {
      const controlName = action.optionKey.split(":")[0];
      const controlTarget = container.querySelector<HTMLElement>(
        `[data-filter-demo-control="${controlName}"]`,
      ) ?? action.target;
      const moveDuration = setCursorToPoint(viewportPointForElement(controlTarget));
      schedule(() => {
        if (!canRunStep(controlTarget)) {
          queueDemoRetry();
          return;
        }
        setCursorToPoint(viewportPointForElement(controlTarget), 0);
        setClickKey((key) => key + 1);
        captureProtectedScroll();
        applyDemoOptionKey(action.optionKey!);
        restoreScrollSoon();
        queueDemoTick();
      }, moveDuration + FILTER_DEMO_CURSOR_CLICK_PAUSE_MS);
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
      if (!clickDemoTarget(action.target, () => {
        restoreScrollSoon();
        if (!action.optionKey) {
          queueDemoTick();
        }
      })) {
        queueDemoRetry();
        return;
      }
    }, clickDelay);

    if (action.optionKey) {
      const optionKey = action.optionKey;
      const optionPrefix = `${optionKey.split(":")[0]}:`;
      const hasVisibleOptionsForCurrentControl = () => (
        Array.from(
          container.querySelectorAll<HTMLElement>(`[data-filter-demo-option^="${optionPrefix}"]`),
        ).some(isUsableDemoOption)
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
          if (!clickDemoTarget(action.target, () => {
            restoreScrollSoon();
            queueDemoTick();
          })) {
            queueDemoRetry();
            return;
          }
        }, closeMoveDuration + FILTER_DEMO_CURSOR_CLICK_PAUSE_MS);
      };
      schedule(() => {
        const nextTarget = Array.from(
          container.querySelectorAll<HTMLElement>(`[data-filter-demo-option="${optionKey}"]`),
        ).find(isUsableDemoOption);
        if (!nextTarget || !canRunStep(nextTarget)) {
          queueDemoRetry();
          return;
        }
        const optionMoveDuration = setCursorToPoint(viewportPointForElement(nextTarget));
        schedule(() => {
          const optionTarget = Array.from(
            container.querySelectorAll<HTMLElement>(`[data-filter-demo-option="${optionKey}"]`),
          ).find(isUsableDemoOption);
          if (!optionTarget || !canRunStep(optionTarget)) {
            queueDemoRetry();
            return;
          }
          if (!clickDemoTarget(optionTarget, () => {
            schedule(closeCurrentMenuBeforeNext, FILTER_DEMO_MENU_AUTO_CLOSE_CHECK_MS);
          })) {
            queueDemoRetry();
            return;
          }
        }, optionMoveDuration + FILTER_DEMO_CURSOR_CLICK_PAUSE_MS);
      }, clickDelay + FILTER_DEMO_CURSOR_MENU_PAUSE_MS);
    }

    return () => {
      stopWatchingScroll();
      timers.forEach((timer) => window.clearTimeout(timer));
      rafs.forEach((frame) => window.cancelAnimationFrame(frame));
    };
  }, [activateScriptedElement, applyDemoOptionKey, demoLoaded, demoShouldRun, demoTick, manualInteractionVersion, resolveDemoAction]);

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
                onHomeFilterDemoControlOpenChange={pauseForHomeFilterMenuChange}
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
    const supportsIntersectionObserver = "IntersectionObserver" in window;
    if (!supportsIntersectionObserver) {
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

const useIsCurrentlyInViewport = <T extends HTMLElement>(
  ref: React.RefObject<T>,
  rootMargin = "0px 0px",
) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const setNextVisible = (next: boolean) => {
      setIsVisible((current) => (current === next ? current : next));
    };

    const checkVisible = () => {
      const rect = node.getBoundingClientRect();
      const next =
        rect.bottom >= 0 &&
        rect.right >= 0 &&
        rect.top <= window.innerHeight &&
        rect.left <= window.innerWidth;
      setNextVisible(next);
    };

    checkVisible();

    const supportsIntersectionObserver = "IntersectionObserver" in window;
    if (!supportsIntersectionObserver) {
      window.addEventListener("scroll", checkVisible, { passive: true });
      window.addEventListener("resize", checkVisible);
      return () => {
        window.removeEventListener("scroll", checkVisible);
        window.removeEventListener("resize", checkVisible);
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => setNextVisible(entry.isIntersecting),
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return isVisible;
};

const useDocumentVisible = () => {
  const [isVisible, setIsVisible] = useState(() =>
    typeof document === "undefined" || document.visibilityState === "visible",
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return isVisible;
};

const sectionVisibility = (intrinsicSize: string): React.CSSProperties => ({
  contentVisibility: "auto",
  containIntrinsicSize: intrinsicSize,
});

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
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const node = spanRef.current;
    if (!node) return;
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
      const progress = Math.min((now - begin) / countDuration, 1);
      const eased = 1 - Math.pow(1 - progress, 1.8);
      const next = Math.round(startValue + range * eased);
      const str = next.toLocaleString();
      if (str !== lastText) {
        node.textContent = str;
        lastText = str;
      }
      if (progress < 1) {
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
    const HERO_COUNTER_START_DELAY_MS = 120;
    launchTimer = window.setTimeout(launch, HERO_COUNTER_START_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(launchTimer);
      clearTimeout(completeTimer);
      cancelAnimationFrame(raf);
    };
  }, [countDuration, startValue, value]);
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
      const rawSeedValue = Math.sin(seed * 12.9898) * 43758.5453;
      return rawSeedValue - Math.floor(rawSeedValue);
    };
    return Array.from({ length: 18 }).map((_, symbolIndex) => ({
      sym: MATH_SYMBOLS[symbolIndex % MATH_SYMBOLS.length],
      left: seedRand(symbolIndex * 7.3) * 100,
      delay: seedRand(symbolIndex * 11.1) * 22,
      duration: 18 + seedRand(symbolIndex * 13.7) * 16,
      size: 24 + seedRand(symbolIndex * 17.2) * 42,
      opacity: 0.05 + seedRand(symbolIndex * 19.5) * 0.07,
    }));
  }, []);

  useLayoutEffect(() => {
    const update = () => {
      const container = containerRef.current;
      const exclusionElement = exclusionRef?.current;
      if (!container || !exclusionElement) {
        setMaskCss({});
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const exclusionRect = exclusionElement.getBoundingClientRect();
      const centerX = exclusionRect.left - containerRect.left + exclusionRect.width / 2;
      const centerY = exclusionRect.top - containerRect.top + exclusionRect.height / 2;
      const radiusX = exclusionRect.width / 2 + 100;
      const radiusY = exclusionRect.height / 2 + 80;
      const gradient = `radial-gradient(ellipse ${radiusX}px ${radiusY}px at ${centerX}px ${centerY}px, transparent 0%, transparent 55%, black 100%)`;
      setMaskCss({ maskImage: gradient, WebkitMaskImage: gradient });
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    if (exclusionRef?.current) ro.observe(exclusionRef.current);
    window.addEventListener("resize", update);
    if (document.fonts?.ready) document.fonts.ready.then(update);
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
      {items.map((item, itemIndex) => (
        <span
          key={itemIndex}
          className="float-sym"
          style={{
            left: `${item.left}%`,
            fontSize: item.size,
            opacity: isDarkMode ? item.opacity * 1.5 : item.opacity,
            animationDelay: `${item.delay}s`,
            animationDuration: `${item.duration}s`,
            color: isDarkMode ? "rgba(125,211,252,1)" : "rgba(15,23,42,1)",
          }}
        >
          {item.sym}
        </span>
      ))}
    </div>
  );
});
FloatingMathSymbols.displayName = "FloatingMathSymbols";
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
  | "clearing"
  | "graphing"
  | "graphHold";

const HomePageBackdrop = memo(({
  isDarkMode,
  onReady,
}: {
  isDarkMode: boolean;
  onReady?: () => void;
}) => {
  const [cycle, setCycle] = useState(0);
  const [phase, setPhase] = useState<HPPhase>("typing");
  const HP_MS_PER_CHAR = 90;
  const FIRST_CURVE_START_MS = 140;
  const [firstCurveEarly, setFirstCurveEarly] = useState(false);
  const firstCurveRef = useRef<SVGPathElement | null>(null);
  const maskLayerRef = useRef<HTMLDivElement | null>(null);
  const glowSvgRef = useRef<SVGSVGElement | null>(null);
  const readyFiredRef = useRef(false);
  const markReady = useCallback(() => {
    if (readyFiredRef.current) return;
    readyFiredRef.current = true;
    onReady?.();
  }, [onReady]);

  const currentEq = HP_EQUATIONS[cycle % HP_EQUATIONS.length];
  const isFirstCycle = cycle === 0;
  const currentTypingMs = currentEq.charCount * HP_MS_PER_CHAR;
  useEffect(() => {
    if (phase !== "typing") return;
    const id = window.setTimeout(() => setPhase("typingHold"), currentTypingMs);
    return () => window.clearTimeout(id);
  }, [phase, currentTypingMs]);

  useEffect(() => {
    if (!isFirstCycle || phase !== "typing") return;
    setFirstCurveEarly(false);
    const id = window.setTimeout(() => setFirstCurveEarly(true), FIRST_CURVE_START_MS);
    return () => window.clearTimeout(id);
  }, [isFirstCycle, phase]);
  useEffect(() => {
    if (phase !== "typingHold") return;
    const id = window.setTimeout(() => {
      setPhase(isFirstCycle ? "graphing" : "pushing");
    }, isFirstCycle ? 250 : 750);
    return () => window.clearTimeout(id);
  }, [phase, isFirstCycle]);
  useEffect(() => {
    if (phase !== "pushing") return;
    const id = window.setTimeout(() => setPhase("clearing"), 450);
    return () => window.clearTimeout(id);
  }, [phase]);
  useEffect(() => {
    if (phase !== "clearing") return;
    const id = window.setTimeout(() => setPhase("graphing"), 950);
    return () => window.clearTimeout(id);
  }, [phase]);
  useEffect(() => {
    if (phase !== "graphing") return;
    const id = window.setTimeout(() => setPhase("graphHold"), 3600);
    return () => window.clearTimeout(id);
  }, [phase]);
  useEffect(() => {
    if (phase !== "graphHold") return;
    const id = window.setTimeout(() => {
      setCycle((cycleIndex) => cycleIndex + 1);
      setPhase("typing");
    }, 1200);
    return () => window.clearTimeout(id);
  }, [phase]);

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
  useEffect(() => {
    if (cycle !== 0 || animatedCurveIdx !== 0) return;
    let fallbackTimer = 0;
    const raf = window.requestAnimationFrame(() => {
      const curve = firstCurveRef.current;
      if (!curve) {
        markReady();
        return;
      }
      const style = window.getComputedStyle(curve);
      const animationName = style.animationName;
      const durationMs = style.animationDuration
        .split(",")
        .map((duration) => {
          const value = Number.parseFloat(duration);
          return duration.trim().endsWith("ms") ? value : value * 1000;
        })
        .reduce((max, duration) => Math.max(max, Number.isFinite(duration) ? duration : 0), 0);
      if (animationName === "none" || durationMs <= 0) {
        markReady();
        return;
      }
      fallbackTimer = window.setTimeout(markReady, durationMs + 120);
    });
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(fallbackTimer);
    };
  }, [animatedCurveIdx, cycle, markReady]);

  const lineColor = isDarkMode ? "rgba(125,211,252,0.14)" : "rgba(15,23,42,0.11)";
  const curveColor = isDarkMode ? "rgba(125,211,252,0.55)" : "rgba(125,211,252,0.78)";
  const INITIAL_CURVE_MASK = "linear-gradient(to bottom, black 0%, black 100%)";
  // One scroll/resize-driven effect handles backdrop visibility, the glow
  // blur scale, and the text cutout mask. The mask + blur are written straight
  // to the DOM (no setState) so an animation-frame update never triggers a
  // React re-render, and all measurement is skipped while the backdrop is
  // faded out.
  useEffect(() => {
    const PAD_X = 24;
    const PAD_Y = 18;
    const round = (value: number) => Math.round(value * 10) / 10;
    let raf = 0;
    let currentVisible: boolean | null = null;
    let lastMask = "";
    let lastBlur = 0;
    const update = () => {
      raf = 0;
      const demoTitle = document.querySelector(".home-demo-title");
      const titleTop = demoTitle?.getBoundingClientRect().top ?? Infinity;
      const visible = titleTop > window.innerHeight / 2;
      if (visible !== currentVisible) {
        currentVisible = visible;
        document.body.classList.toggle("hp-bg-hidden", !visible);
      }
      if (!visible) return;

      // stdDeviation 6 lived in the 1400x900 viewBox, so the old SVG glow
      // scaled with the "slice" fit; match that on the CSS-blurred glow copy.
      const scale = Math.max(window.innerWidth / 1400, (window.innerHeight - 64) / 900);
      const nextBlur = round(6 * scale);
      if (nextBlur !== lastBlur && glowSvgRef.current) {
        lastBlur = nextBlur;
        glowSvgRef.current.style.filter = `blur(${nextBlur}px)`;
      }

      const cutoutElements = document.querySelectorAll<HTMLElement>("[data-curve-cutout]");
      const viewportWidth = window.innerWidth;
      const viewportGraphHeight = window.innerHeight - 64;
      const gradients: string[] = [];
      cutoutElements.forEach((element) => {
        const elementRect = element.getBoundingClientRect();
        if (elementRect.width === 0 || elementRect.height === 0) return;
        if (elementRect.bottom < 64 || elementRect.top > window.innerHeight) return;
        const centerX = round(((elementRect.left + elementRect.right) / 2 / viewportWidth) * 100);
        const centerY = round(((elementRect.top - 64 + elementRect.height / 2) / viewportGraphHeight) * 100);
        const radiusX = round(((elementRect.width + PAD_X * 2) / 2 / viewportWidth) * 100);
        const radiusY = round(((elementRect.height + PAD_Y * 2) / 2 / viewportGraphHeight) * 100);
        gradients.push(
          `radial-gradient(ellipse ${radiusX}% ${radiusY}% at ${centerX}% ${centerY}%, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.55) 70%, black 100%)`
        );
      });
      gradients.push("linear-gradient(to bottom, black 0%, black 100%)");
      const nextMask = gradients.join(", ");
      if (nextMask === lastMask) return;
      lastMask = nextMask;
      const layer = maskLayerRef.current;
      if (layer) {
        layer.style.maskImage = nextMask;
        layer.style.webkitMaskImage = nextMask;
      }
    };
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };

    update();
    const ro = new ResizeObserver(schedule);
    document
      .querySelectorAll<HTMLElement>("[data-curve-cutout]")
      .forEach((element) => ro.observe(element));
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    if (document.fonts?.ready) document.fonts.ready.then(update);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.body.classList.remove("hp-bg-hidden");
    };
  }, []);

  const renderCurvePaths = (variant: "sharp" | "glow") => (
    <>
      {staticCurveIdx !== null && (
        <path
          d={HP_EQUATIONS[staticCurveIdx].path}
          fill="none"
          stroke={curveColor}
          strokeWidth="4.5"
          strokeLinecap="round"
          className={`hp-static-curve${staticFading ? " fading" : ""}`}
        />
      )}
      {animatedCurveIdx !== null && (
        <path
          ref={variant === "sharp" && cycle === 0 ? firstCurveRef : undefined}
          key={cycle}
          d={HP_EQUATIONS[animatedCurveIdx].path}
          fill="none"
          stroke={curveColor}
          strokeWidth="4.5"
          strokeLinecap="round"
          className="hp-curve"
          onAnimationEnd={variant === "sharp" && cycle === 0 ? markReady : undefined}
        />
      )}
    </>
  );

  return (
    <>
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
        }}
      />
      <div
        ref={maskLayerRef}
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
          WebkitMaskImage: INITIAL_CURVE_MASK,
          maskImage: INITIAL_CURVE_MASK,
          WebkitMaskComposite: "source-in",
          maskComposite: "intersect",
        }}
      >
        {/* Glow copy: GPU-composited CSS blur replaces the SVG feGaussianBlur
            filter, which re-rasterized the full viewport on every draw frame.
            Blur radius tracks the viewBox slice scale (set in JS). */}
        <svg
          ref={glowSvgRef}
          viewBox="0 0 1400 900"
          preserveAspectRatio="xMidYMid slice"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            display: "block",
            filter: "blur(6px)",
          }}
        >
          {renderCurvePaths("glow")}
        </svg>
        {/* Sharp copy stacked on top — identical paths + animation, no filter. */}
        <svg
          viewBox="0 0 1400 900"
          preserveAspectRatio="xMidYMid slice"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            display: "block",
          }}
        >
          {renderCurvePaths("sharp")}
        </svg>
      </div>
    </>
  );
});
HomePageBackdrop.displayName = "HomePageBackdrop";

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

const Home = () => {
  const navigate = useNavigate();
  const handleHeroOpenBank = useCallback(() => navigate("/bank"), [navigate]);
  const { user, signOut } = useAuth();
  const preloadFinalCtaRoute = useCallback(() => preloadRouteIntent(user ? "/bank" : "/signup"), [user]);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const isDarkMode = useThemeMode();
  const totalQuestions = DEFAULT_QUESTION_BANK_TOTAL;
  const [heroCounterReady, setHeroCounterReady] = useState(false);
  const [heroGraphReady, setHeroGraphReady] = useState(false);
  const [heroPreviewTimerReady, setHeroPreviewTimerReady] = useState(false);
  const questionPreviewReady = heroCounterReady || heroGraphReady || heroPreviewTimerReady;
  const handleHeroCounterReady = useCallback(() => setHeroCounterReady(true), []);
  const handleHeroGraphReady = useCallback(() => setHeroGraphReady(true), []);

  useEffect(() => {
    const id = window.setTimeout(() => setHeroPreviewTimerReady(true), HERO_PREVIEW_FORCE_READY_MS);
    return () => window.clearTimeout(id);
  }, []);

  // Warm the hero demo's lazy chunks (Question + its static deps: questionBank,
  // mathRendering) and prime its data caches during idle time after first paint,
  // so the embed renders from cache within the ready-gate window and reveals
  // instantly. questionBank is imported dynamically (never statically) to keep
  // its multi-MB chunk out of the Home chunk's critical path.
  useEffect(() => {
    let cancelled = false;
    const warm = () => {
      if (cancelled) return;
      void loadEmbeddedQuestionPreview().catch(() => {});
      void import("@/data/questionBank")
        .then((mod) => {
          if (!cancelled) mod.prefetchHeroPreviewQuestion();
        })
        .catch(() => {});
    };
    const win = window as typeof window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let idleId: number | null = null;
    let timeoutId: number | null = null;
    if (typeof win.requestIdleCallback === "function") {
      idleId = win.requestIdleCallback(warm, { timeout: 800 });
    } else {
      timeoutId = window.setTimeout(warm, 300);
    }
    return () => {
      cancelled = true;
      if (idleId !== null && typeof win.cancelIdleCallback === "function") win.cancelIdleCallback(idleId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);

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

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
            <PreloadLink
              to="/bank"
              className="rounded-md px-3 py-1.5 font-sans text-[14px] font-medium tracking-[-0.005em] text-ink transition-opacity hover:opacity-70"
            >
              Question Bank
            </PreloadLink>
            <PreloadLink
              to="/hard"
              className="rounded-md px-3 py-1.5 font-sans text-[14px] font-medium tracking-[-0.005em] text-ink transition-opacity hover:opacity-70"
            >
              100 Hard Math
            </PreloadLink>
            <PreloadLink
              to="/modules"
              className="rounded-md px-3 py-1.5 font-sans text-[14px] font-medium tracking-[-0.005em] text-ink transition-opacity hover:opacity-70"
            >
              Practice Tests
            </PreloadLink>
            <PreloadLink
              to="/score-calculator"
              className="rounded-md px-3 py-1.5 font-sans text-[14px] font-medium tracking-[-0.005em] text-ink transition-opacity hover:opacity-70"
            >
              Score Calculator
            </PreloadLink>
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
                  <DropdownMenuItem
                    onFocus={preloadProfileRoute}
                    onPointerEnter={preloadProfileRoute}
                    onClick={() => navigate("/profile")}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onFocus={preloadAnalysisRoute}
                    onPointerEnter={preloadAnalysisRoute}
                    onClick={() => navigate("/analysis")}
                  >
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
                  className="hidden sm:inline-flex !rounded-full !font-medium"
                  onClick={() => navigate("/login")}
                  onFocus={preloadLoginRoute}
                  onPointerDown={preloadLoginRoute}
                  onPointerEnter={preloadLoginRoute}
                  onTouchStart={preloadLoginRoute}
                >
                  Log In
                </Button>
                <Button
                  size="sm"
                  className="!rounded-full"
                  onClick={() => navigate("/signup")}
                  onFocus={preloadSignupRoute}
                  onPointerDown={preloadSignupRoute}
                  onPointerEnter={preloadSignupRoute}
                  onTouchStart={preloadSignupRoute}
                >
                  Sign Up
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <section
        className="home-hero-section"
        style={{
          background: "transparent",
          position: "relative",
          overflow: "hidden",
          paddingBottom: "clamp(72px, 7vw, 108px)",
        }}
      >
        <HomePageBackdrop isDarkMode={isDarkMode} onReady={handleHeroGraphReady} />

        <div
          className="home-hero"
          style={{
            position: "relative",
            maxWidth: 1032,
            margin: "0 auto",
            padding: "76px 24px 0",
            textAlign: "center",
          }}
        >
          <h1
            className="h-fade-2"
            data-curve-cutout
            style={{
              fontFamily: "'Geist', system-ui, sans-serif",
              fontWeight: 500,
              fontSize: "clamp(48px, 7vw, 108px)",
              lineHeight: 0.98,
              color: "rgb(var(--ink))",
              margin: "0 0 26px",
              letterSpacing: "-0.035em",
            }}
          >
            Reach your{" "}
            <br />
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

          <p
            className="h-fade-3 home-subtitle"
            data-curve-cutout
            style={{
              fontFamily: "'Geist', system-ui, sans-serif",
              fontSize: 20,
              color: "rgb(var(--ink-mid))",
              maxWidth: 648,
              margin: "0 auto 38px",
              lineHeight: 1.55,
              fontWeight: 300,
            }}
          >
            Accurate SAT practice built from real past tests.
          </p>

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
              onFocus={preloadBankRoute}
              onPointerDown={preloadBankRoute}
              onPointerEnter={preloadBankRoute}
              onTouchStart={preloadBankRoute}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "14px 22px",
                borderRadius: 10,
                background: "rgb(var(--ds-accent))",
                color: "rgb(var(--ink-fixed))",
                fontWeight: 600,
                fontSize: 16,
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
              onFocus={preloadModulesRoute}
              onPointerDown={preloadModulesRoute}
              onPointerEnter={preloadModulesRoute}
              onTouchStart={preloadModulesRoute}
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
                fontSize: 16,
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

          <div className="h-fade-5 home-counter" data-curve-cutout style={{ marginBottom: 88 }}>
            <div
              className="home-count-num"
              style={{
              fontSize: "clamp(48px, 5.4vw, 80px)",
              fontFamily: "'Inter Tight', sans-serif",
              fontWeight: 600,
              color: "rgb(var(--ink))",
              letterSpacing: "-0.04em",
              lineHeight: 0.95,
              fontVariantNumeric: "tabular-nums",
              fontFeatureSettings: "'tnum'",
              }}
            >
              <SlotMachineCounter value={totalQuestions} onComplete={handleHeroCounterReady} />
            </div>
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

        <div
          className="h-fade-6 home-demo-wrap"
          style={{
            maxWidth: 1440,
            margin: "210px auto 0",
            padding: "0 24px",
            position: "relative",
          }}
        >
          <div
            ref={demoTitleRef}
            style={{
              textAlign: "center",
              margin: "0 auto 28px",
              maxWidth: 864,
            }}
          >
            <h2
              className="home-demo-title"
              style={{
                fontFamily: "'Geist', system-ui, sans-serif",
                fontSize: "clamp(31px, 4.6vw, 62px)",
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

      <section className="bg-background" style={sectionVisibility("auto 720px")}>
        <ExplanationFeatureSection isDarkMode={isDarkMode} />
      </section>

      <section className="bg-background" style={sectionVisibility("auto 760px")}>
        <FilterFeatureSection
          isDarkMode={isDarkMode}
        />
      </section>

      <section className="bg-background" style={sectionVisibility("auto 560px")}>
        <PracticeTestsFeatureSection isDarkMode={isDarkMode} />
      </section>

      <section
        className="home-cta-final"
        style={{ padding: "0px 24px 96px", position: "relative" }}
      >
        <div style={{ position: "relative", maxWidth: 1152, margin: "0 auto", textAlign: "center" }}>
          <h2
            style={{
              fontFamily: "'Geist', system-ui, sans-serif",
              fontSize: "clamp(40px, 5.2vw, 72px)",
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
            onFocus={preloadFinalCtaRoute}
            onPointerDown={preloadFinalCtaRoute}
            onPointerEnter={preloadFinalCtaRoute}
            onTouchStart={preloadFinalCtaRoute}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 32px",
              borderRadius: 10,
              background: "hsl(201,100%,74%)",
              color: "hsl(210,50%,12%)",
              fontWeight: 600,
              fontSize: 16,
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

    </div>
  );
};

export default Home;
