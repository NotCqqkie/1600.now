import { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useThemeMode } from "@/lib/theme";
import {
  ArrowRight,
  ArrowLeft,
  BarChart3,
  BookA,
  BookOpen,
  BookOpenCheck,
  Calculator,
  Columns2,
  Compass,
  FileText,
  Filter,
  Flame,
  GraduationCap,
  HelpCircle,
  LayoutGrid,
  LineChart,
  MoreHorizontal,
  PanelRight,
  PartyPopper,
  Sparkles,
  Wand2,
} from "lucide-react";

type LucideIcon = React.ComponentType<{ className?: string }>;

type AccentName = "sky" | "violet" | "emerald" | "amber" | "rose" | "cyan" | "fuchsia" | "indigo" | "teal";
const ACCENT_CLASSES: Record<AccentName, { text: string; bg: string; chip: string }> = {
  sky:      { text: "text-sky-500",     bg: "bg-sky-500/25",     chip: "bg-sky-500/30 text-sky-700 dark:text-sky-200" },
  violet:   { text: "text-violet-500",  bg: "bg-violet-500/25",  chip: "bg-violet-500/30 text-violet-700 dark:text-violet-200" },
  emerald:  { text: "text-emerald-600", bg: "bg-emerald-500/25", chip: "bg-emerald-500/30 text-emerald-700 dark:text-emerald-200" },
  amber:    { text: "text-amber-500",   bg: "bg-amber-500/25",   chip: "bg-amber-500/30 text-amber-700 dark:text-amber-200" },
  rose:     { text: "text-rose-500",    bg: "bg-rose-500/25",    chip: "bg-rose-500/30 text-rose-700 dark:text-rose-200" },
  cyan:     { text: "text-cyan-600",    bg: "bg-cyan-500/25",    chip: "bg-cyan-500/30 text-cyan-700 dark:text-cyan-200" },
  fuchsia:  { text: "text-fuchsia-500", bg: "bg-fuchsia-500/25", chip: "bg-fuchsia-500/30 text-fuchsia-700 dark:text-fuchsia-200" },
  indigo:   { text: "text-indigo-500",  bg: "bg-indigo-500/25",  chip: "bg-indigo-500/30 text-indigo-700 dark:text-indigo-200" },
  teal:     { text: "text-teal-600",    bg: "bg-teal-500/25",    chip: "bg-teal-500/30 text-teal-700 dark:text-teal-200" },
};

interface BaseStep {
  key: string;
  title: string;
  body: string;
  icon: LucideIcon;
  accent: AccentName;
}
interface SplashStep extends BaseStep { kind: "splash" }
interface SpotlightStep extends BaseStep {
  kind: "spotlight";
  target: string;
  route?: string;
  pad?: number;
  clickFirst?: string;
  clickOnExit?: string;
  waitMs?: number;
  afterClickMs?: number;
  preferSide?: "right" | "left" | "bottom" | "top";
  revealContent?: boolean;
}
interface FinaleStep extends BaseStep { kind: "finale" }
type Step = SplashStep | SpotlightStep | FinaleStep;
type ActiveTour = "main" | "practice-set";

const MAIN_STEPS: Step[] = [
  {
    kind: "splash",
    key: "welcome",
    icon: Sparkles,
    title: "Welcome to 1600.now",
    body: "A quick walkthrough of the pages you'll use most, so you can start practicing without hunting around.",
    accent: "sky",
  },
  {
    kind: "spotlight",
    key: "sidebar",
    icon: LayoutGrid,
    title: "Your home base",
    body: "Jump between the bank, practice tests, vocab, and your stats from here. Collapse it anytime for more workspace.",
    accent: "indigo",
    target: "sidebar",
    route: "/bank",
    pad: 6,
  },
  {
    kind: "spotlight",
    key: "bank",
    icon: BookOpen,
    title: "Question Bank",
    body: "Search thousands of real SAT questions by skill, difficulty, status, and source.",
    accent: "violet",
    target: "nav-bank",
    route: "/bank",
    revealContent: true,
  },
  {
    kind: "spotlight",
    key: "filters",
    icon: Filter,
    title: "Filter to what you need",
    body: "Narrow the bank to the questions that matter right now, whether that is hard algebra, missed reading questions, or items you marked for review.",
    accent: "violet",
    target: "bank-filters",
    route: "/bank",
    pad: 8,
    preferSide: "bottom",
  },
  {
    kind: "spotlight",
    key: "modules",
    icon: GraduationCap,
    title: "Practice Tests",
    body: "Take full timed SAT practice tests or work one module at a time. When you finish, you'll get section scores and a question-by-question breakdown.",
    accent: "emerald",
    target: "nav-modules",
    route: "/modules",
    revealContent: true,
  },
  {
    kind: "spotlight",
    key: "hard",
    icon: Flame,
    title: "100 Hard Math",
    body: "A focused set of high-difficulty math questions for students pushing toward the top score range.",
    accent: "rose",
    target: "nav-hard",
    route: "/hard",
    revealContent: true,
  },
  {
    kind: "spotlight",
    key: "vocab",
    icon: BookA,
    title: "Vocabulary",
    body: "Review SAT-relevant words with spaced repetition, so missed cards come back at the right time.",
    accent: "amber",
    target: "nav-vocab",
    route: "/vocab",
    revealContent: true,
  },
  {
    kind: "spotlight",
    key: "stats",
    icon: BarChart3,
    title: "Your statistics",
    body: "Track accuracy by skill, difficulty, and section over time, then use the weak spots to choose what to practice next.",
    accent: "indigo",
    target: "nav-stats",
    route: "/analysis",
    revealContent: true,
  },
  {
    kind: "spotlight",
    key: "question-toolbar",
    icon: Compass,
    title: "Inside a question",
    body: "Each question page keeps the problem, tools, notes, and explanation close by.",
    accent: "cyan",
    target: "reference-button",
    route: "/hard/1",
    pad: 6,
    preferSide: "bottom",
  },
  {
    kind: "spotlight",
    key: "reference-window",
    icon: FileText,
    title: "Reference sheet",
    body: "Open the same formulas and geometry facts provided on the SAT without leaving the question.",
    accent: "fuchsia",
    target: "window-referenceSheet",
    clickFirst: "reference-button",
    clickOnExit: "reference-button",
    pad: 4,
  },
  {
    kind: "spotlight",
    key: "desmos-button",
    icon: Calculator,
    title: "Desmos lives here",
    body: "Use the SAT's Desmos calculator directly beside the problem.",
    accent: "teal",
    target: "desmos-button",
    pad: 6,
    preferSide: "bottom",
  },
  {
    kind: "spotlight",
    key: "desmos-window",
    icon: LineChart,
    title: "Built-in Desmos",
    body: "Move it, resize it, and keep your graph work on screen while you solve.",
    accent: "teal",
    target: "window-desmos",
    clickFirst: "desmos-button",
    pad: 4,
  },
  {
    kind: "spotlight",
    key: "desmos-sidebar-toggle",
    icon: PanelRight,
    title: "Or dock it to the side",
    body: "Pin Desmos beside the question when you want the calculator and problem visible at the same time.",
    accent: "teal",
    target: "sidebar-toggle-desmos",
    pad: 4,
    preferSide: "right",
  },
  {
    kind: "spotlight",
    key: "desmos-sidebarred",
    icon: Columns2,
    title: "Side-by-side mode",
    body: "Now the calculator stays next to the question. Use the same control to return it to a floating window.",
    accent: "teal",
    target: "window-desmos",
    clickFirst: "sidebar-toggle-desmos",
    clickOnExit: "desmos-button",
    pad: 4,
    preferSide: "right",
  },
  {
    kind: "spotlight",
    key: "replay",
    icon: HelpCircle,
    title: "Lost? Replay the tour",
    body: "Run this walkthrough again anytime from here.",
    accent: "emerald",
    target: "tour-replay",
    route: "/bank",
  },
  {
    kind: "finale",
    key: "ready",
    icon: PartyPopper,
    title: "You're all set",
    body: "Start in the Question Bank, choose a practice test, or use the sidebar to jump straight to the tool you need.",
    accent: "fuchsia",
  },
];

const PRACTICE_SET_HELP_QUESTION_ROUTE = "/bank/math/9c1847da-e82b-4814-a0ec-0b4f99891322_4?bankType=past";

const PRACTICE_SET_STEPS: Step[] = [
  {
    kind: "spotlight",
    key: "practice-set-more",
    icon: MoreHorizontal,
    title: "Open More",
    body: "From any bank question, the more menu can build a focused practice set from related questions.",
    accent: "sky",
    target: "question-more-menu",
    route: PRACTICE_SET_HELP_QUESTION_ROUTE,
    pad: 6,
    waitMs: 8000,
    preferSide: "bottom",
  },
  {
    kind: "spotlight",
    key: "practice-set-create",
    icon: BookOpenCheck,
    title: "Create Practice Set",
    body: "Your saved set includes 5-20 related questions and appears in My Practice Sets for targeted review.",
    accent: "emerald",
    target: "create-practice-set-menu-item",
    clickFirst: "question-more-menu",
    pad: 8,
    waitMs: 8000,
    afterClickMs: 360,
    preferSide: "left",
    clickOnExit: "question-more-menu",
  },
];

const tourKey = (uid: string | undefined) => `onboarding-seen:${uid ?? "anon"}`;
const ONBOARDING_REPLAY_REQUEST_KEY = "onboarding-replay-requested";
const PRACTICE_SET_HELP_REQUEST_KEY = "practice-set-help-requested";

const preloadTourRoutes = () => {
  void import("@/pages/bank/BankIndex");
  void import("@/pages/modules/Modules");
  void import("@/pages/bank/HardQuestionsIntro");
  void import("@/pages/Vocab");
  void import("@/pages/Analysis");
  void import("@/pages/bank/Question");
};

type Rect = { x: number; y: number; w: number; h: number };
type CoachPositionStyle = Pick<React.CSSProperties, "left" | "top" | "right" | "bottom" | "transform">;

const findTargetRect = (target: string, pad = 4): Rect | null => {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const bounds = el.getBoundingClientRect();
  if (bounds.width === 0 || bounds.height === 0) return null;
  return {
    x: bounds.left - pad,
    y: bounds.top - pad,
    w: bounds.width + pad * 2,
    h: bounds.height + pad * 2,
  };
};

const waitForTarget = (target: string, pad: number, timeoutMs = 3500): Promise<Rect | null> => {
  return new Promise((resolve) => {
    const immediate = findTargetRect(target, pad);
    if (immediate) return resolve(immediate);
    let settled = false;
    const finish = (value: Rect | null) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(timeoutId);
      resolve(value);
    };
    const observer = new MutationObserver(() => {
      const targetRect = findTargetRect(target, pad);
      if (targetRect) finish(targetRect);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    const timeoutId = window.setTimeout(() => {
      finish(findTargetRect(target, pad));
    }, timeoutMs);
  });
};

const clickByTour = (target: string) => {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return;
  if (typeof PointerEvent !== "undefined") {
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, pointerType: "mouse" }));
    el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, button: 0, pointerType: "mouse" }));
  }
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
  el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
};

const computeCoachPos = (rect: Rect, cardW = 380, cardH = 240, gap = 18, prefer?: "right" | "left" | "bottom" | "top") => {
  const viewport = window.visualViewport;
  const viewLeft = viewport?.offsetLeft ?? 0;
  const viewTop = viewport?.offsetTop ?? 0;
  const vw = viewport?.width ?? window.innerWidth;
  const vh = viewport?.height ?? window.innerHeight;
  const viewRight = viewLeft + vw;
  const viewBottom = viewTop + vh;
  const effectiveCardW = Math.min(cardW, vw * 0.92);
  const effectiveCardH = Math.min(cardH, vh - 24);
  const rightSpace = viewRight - (rect.x + rect.w);
  const leftSpace = rect.x - viewLeft;
  const bottomSpace = viewBottom - (rect.y + rect.h);
  const topSpace = rect.y - viewTop;

  let side: "right" | "left" | "bottom" | "top" = "right";
  if (prefer && (
    (prefer === "right" && rightSpace >= effectiveCardW + gap + 12) ||
    (prefer === "left" && leftSpace >= effectiveCardW + gap + 12) ||
    (prefer === "bottom" && bottomSpace >= effectiveCardH + gap + 12) ||
    (prefer === "top" && topSpace >= effectiveCardH + gap + 12)
  )) {
    side = prefer;
  } else {
    const max = Math.max(rightSpace, leftSpace, bottomSpace, topSpace);
    if (max === rightSpace) side = "right";
    else if (max === leftSpace) side = "left";
    else if (max === bottomSpace) side = "bottom";
    else side = "top";
  }

  let left = 0, top = 0;
  if (side === "right")  { left = rect.x + rect.w + gap; top = rect.y + rect.h / 2 - effectiveCardH / 2; }
  if (side === "left")   { left = rect.x - effectiveCardW - gap; top = rect.y + rect.h / 2 - effectiveCardH / 2; }
  if (side === "bottom") { top = rect.y + rect.h + gap; left = rect.x + rect.w / 2 - effectiveCardW / 2; }
  if (side === "top")    { top = rect.y - effectiveCardH - gap; left = rect.x + rect.w / 2 - effectiveCardW / 2; }

  const minLeft = viewLeft + 12;
  const maxLeft = Math.max(minLeft, viewRight - effectiveCardW - 12);
  const minTop = viewTop + 12;
  const maxTop = Math.max(minTop, viewBottom - effectiveCardH - 12);
  left = Math.max(minLeft, Math.min(left, maxLeft));
  top = Math.max(minTop, Math.min(top, maxTop));
  return { left, top, side };
};

const FloatingBlobs = ({ accent }: { accent: AccentName }) => {
  const accentClass = ACCENT_CLASSES[accent];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className={`absolute -top-32 -left-24 h-[26rem] w-[26rem] rounded-full ${accentClass.bg} blur-3xl animate-onboarding-blob`} style={{ animationDuration: "9s" }} />
      <div className={`absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full ${accentClass.bg} blur-3xl animate-onboarding-blob`} style={{ animationDuration: "11s", animationDelay: "1.2s" }} />
      <div className={`absolute top-1/3 right-1/4 h-72 w-72 rounded-full ${accentClass.bg} blur-3xl animate-onboarding-blob opacity-60`} style={{ animationDuration: "13s", animationDelay: "0.4s" }} />
    </div>
  );
};

const SplashCard = ({ step, onNext, onSkip, index, total, isDark }: {
  step: SplashStep; onNext: () => void; onSkip: () => void; index: number; total: number; isDark: boolean;
}) => {
  const titleColor = isDark ? "text-white" : "text-slate-900";
  const bodyColor = isDark ? "text-white/75" : "text-slate-700";
  const captionColor = isDark ? "text-white/60" : "text-slate-500";
  const skipColor = isDark
    ? "text-white/70 hover:text-white hover:bg-white/10"
    : "text-slate-600 hover:text-slate-900 hover:bg-slate-900/5";
  return (
    <div className="relative flex h-full w-full items-center justify-center px-6">
      <FloatingBlobs accent={step.accent} />

      <div className="relative z-10 max-w-xl text-center">
        <h2
          className={`mb-4 tour-splash-text ${titleColor}`}
          style={{ fontFamily: "'Geist', Georgia, serif", fontSize: 56, lineHeight: 1.02 }}
        >
          {step.title}
        </h2>
        <p className={`mx-auto max-w-md text-[15px] leading-relaxed tour-splash-text ${bodyColor}`} style={{ animationDelay: "60ms" }}>
          {step.body}
        </p>
        <div className="mt-9 flex items-center justify-center gap-3 tour-splash-text" style={{ animationDelay: "120ms" }}>
          <Button variant="ghost" onClick={onSkip} className={skipColor}>Skip tour</Button>
          <Button size="lg" onClick={onNext} className="gap-2 px-6">
            Take the tour
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <div className={`mt-8 text-xs tabular-nums ${captionColor}`}>{index + 1} / {total}</div>
      </div>
    </div>
  );
};

const FinaleCard = ({ step, onClose, onJump, index, total, isDark }: {
  step: FinaleStep; onClose: () => void; onJump: (path: string) => void; index: number; total: number; isDark: boolean;
}) => {
  const accentClass = ACCENT_CLASSES[step.accent];
  const titleColor = isDark ? "text-white" : "text-slate-900";
  const bodyColor = isDark ? "text-white/75" : "text-slate-700";
  const captionColor = isDark ? "text-white/60" : "text-slate-500";
  const outlineBtn = isDark
    ? "border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
    : "border-slate-900/15 bg-white/70 text-slate-900 hover:bg-white hover:text-slate-900";
  return (
    <div className="relative flex h-full w-full items-center justify-center px-6">
      <FloatingBlobs accent={step.accent} />

      <div aria-hidden className="pointer-events-none absolute inset-0 z-[1]">
        {[0, 1, 2, 3, 4, 5].map((orbitIndex) => {
          const orbitRadius = 200 + (orbitIndex % 3) * 60;
          const duration = 22 + (orbitIndex % 4) * 6;
          const delay = orbitIndex * -4;
          const Glyph = [Sparkles, PartyPopper, Wand2, Sparkles, Sparkles, PartyPopper][orbitIndex];
          return (
            <div
              key={orbitIndex}
              className="absolute left-1/2 top-1/2 h-7 w-7"
              style={{
                ["--orbit-r" as never]: `${orbitRadius}px`,
                animation: `tour-orbit ${duration}s linear infinite`,
                animationDelay: `${delay}s`,
                opacity: 0.32,
              }}
            >
              <Glyph className={`h-7 w-7 ${accentClass.text}`} />
            </div>
          );
        })}
      </div>

      <div className="relative z-10 max-w-xl text-center">
        <h2 className={`mb-4 tour-splash-text ${titleColor}`} style={{ fontFamily: "'Geist', Georgia, serif", fontSize: 56, lineHeight: 1.02 }}>
          {step.title}
        </h2>
        <p className={`mx-auto max-w-md text-[15px] leading-relaxed tour-splash-text ${bodyColor}`} style={{ animationDelay: "60ms" }}>
          {step.body}
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3 tour-splash-text" style={{ animationDelay: "120ms" }}>
          <Button variant="outline" onClick={() => onJump("/bank")} className={`gap-2 ${outlineBtn}`}>
            <BookOpen className="h-4 w-4" /> Question Bank
          </Button>
          <Button variant="outline" onClick={() => onJump("/modules")} className={`gap-2 ${outlineBtn}`}>
            <GraduationCap className="h-4 w-4" /> Practice Tests
          </Button>
          <Button size="lg" onClick={onClose} className="gap-2 px-6">
            I'm ready
            <Wand2 className="h-4 w-4" />
          </Button>
        </div>
        <div className={`mt-8 text-xs tabular-nums ${captionColor}`}>{index + 1} / {total}</div>
      </div>
    </div>
  );
};

export const OnboardingTour = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = useThemeMode();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [steps, setSteps] = useState<Step[]>(MAIN_STEPS);
  const [activeTour, setActiveTour] = useState<ActiveTour>("main");

  const step = steps[index] ?? steps[0];
  const total = steps.length;
  const isStepResolving = step.kind === "spotlight" && !rect;
  const isFirst = index === 0;
  const isLast = index === total - 1;

  useEffect(() => {
    if (loading || !user) return;
    if (!user.emailVerified) return;
    const pending = sessionStorage.getItem("onboarding-pending");
    if (pending === "1") {
      setSteps(MAIN_STEPS);
      setActiveTour("main");
      setIndex(0);
      setRect(null);
      setOpen(true);
      sessionStorage.removeItem("onboarding-pending");
    }
  }, [user, loading]);
  useEffect(() => {
    const replay = () => {
      sessionStorage.removeItem(ONBOARDING_REPLAY_REQUEST_KEY);
      setSteps(MAIN_STEPS);
      setActiveTour("main");
      setIndex(0);
      setRect(null);
      setOpen(true);
    };
    if (sessionStorage.getItem(ONBOARDING_REPLAY_REQUEST_KEY) === "1") {
      replay();
    }
    window.addEventListener("onboarding:replay", replay);
    return () => window.removeEventListener("onboarding:replay", replay);
  }, []);

  useEffect(() => {
    const showPracticeSetHelp = () => {
      sessionStorage.removeItem(PRACTICE_SET_HELP_REQUEST_KEY);
      setSteps(PRACTICE_SET_STEPS);
      setActiveTour("practice-set");
      setIndex(0);
      setRect(null);
      setOpen(true);
    };
    if (sessionStorage.getItem(PRACTICE_SET_HELP_REQUEST_KEY) === "1") {
      showPracticeSetHelp();
    }
    window.addEventListener("onboarding:practice-set-help", showPracticeSetHelp);
    return () => window.removeEventListener("onboarding:practice-set-help", showPracticeSetHelp);
  }, []);
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("tour-active");
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove("tour-active");
    };
  }, [open]);

  const hasPreloadedRoutesRef = useRef(false);
  const preloadRoutesOnce = useCallback(() => {
    if (hasPreloadedRoutesRef.current) return;
    hasPreloadedRoutesRef.current = true;
    preloadTourRoutes();
  }, []);

  const close = useCallback(() => {
    const shouldReturnToBank = activeTour === "main";
    const shouldReturnToPracticeSets = activeTour === "practice-set";
    if (shouldReturnToBank && user) localStorage.setItem(tourKey(user.uid), "1");
    setOpen(false);
    setIndex(0);
    setRect(null);
    setSteps(MAIN_STEPS);
    setActiveTour("main");
    if (shouldReturnToBank && location.pathname !== "/bank") navigate("/bank");
    if (shouldReturnToPracticeSets && location.pathname !== "/my-practice-sets") navigate("/my-practice-sets");
  }, [activeTour, user, location.pathname, navigate]);
  const prevIndexRef = useRef<number | null>(null);
  useEffect(() => {
    if (!open) {
      prevIndexRef.current = null;
      return;
    }
    const prev = prevIndexRef.current;
    if (prev !== null && prev !== index) {
      const outgoing = steps[prev];
      if (outgoing?.kind === "spotlight" && outgoing.clickOnExit) {
        clickByTour(outgoing.clickOnExit);
      }
    }
    prevIndexRef.current = index;
  }, [index, open, steps]);
  const lastResolvedKeyRef = useRef<string>("");
  const [isNavigating, setIsNavigating] = useState(false);
  const [contentLeft, setContentLeft] = useState(0);
  const lastCoachPositionStyleRef = useRef<CoachPositionStyle | null>(null);
  const coachCardRef = useRef<HTMLDivElement | null>(null);
  const lastCoachBoxRef = useRef<DOMRectReadOnly | null>(null);
  const coachAnimationRef = useRef<Animation | null>(null);
  useEffect(() => {
    if (!open) {
      lastResolvedKeyRef.current = "";
      setIsNavigating(false);
      return;
    }
    const fingerprint = `${index}:${step.key}:${location.pathname}${location.search}`;
    if (lastResolvedKeyRef.current === fingerprint) {
      return;
    }
    lastResolvedKeyRef.current = fingerprint;
    if (step.kind !== "spotlight") {
      setRect(null);
      return;
    }
    let cancelled = false;

    const run = async () => {
      const startingPath = `${location.pathname}${location.search}`;
      const willNavigate = step.route && step.route !== startingPath;
      if (willNavigate) {
        const aside = document.querySelector<HTMLElement>('aside[data-tour="sidebar"]');
        if (aside) setContentLeft(Math.round(aside.getBoundingClientRect().right));
        setIsNavigating(true);
        await new Promise((resolve) => setTimeout(resolve, 170));
        if (cancelled) return;
        navigate(step.route!);
        await new Promise((resolve) => setTimeout(resolve, 90));
      } else {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      }
      if (cancelled) return;
      if (step.clickFirst) {
        await waitForTarget(step.clickFirst, 0, 2500);
        if (cancelled) return;
        clickByTour(step.clickFirst);
        await new Promise((r) => setTimeout(r, step.afterClickMs ?? 220));
      }
      if (cancelled) return;

      const targetRect = await waitForTarget(step.target, step.pad ?? 4, step.waitMs);
      if (cancelled) return;
      if (targetRect) setRect(targetRect);
      await new Promise((res) => setTimeout(res, 60));
      if (!cancelled) setIsNavigating(false);
    };
    run();

    return () => { cancelled = true; };
  }, [open, index, step, location.pathname, location.search, navigate]);
  useEffect(() => {
    if (!open || step.kind !== "spotlight") return;
    const reposition = () => {
      const targetRect = findTargetRect(step.target, step.pad ?? 4);
      if (targetRect) setRect(targetRect);
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, step]);

  const resetStepResolution = useCallback(() => {
    lastResolvedKeyRef.current = "";
    setRect(null);
    setIsNavigating(false);
  }, []);
  const next = useCallback(() => {
    if (index === 0) preloadRoutesOnce();
    resetStepResolution();
    setIndex((i) => Math.min(i + 1, total - 1));
  }, [index, preloadRoutesOnce, resetStepResolution, total]);
  const prev = useCallback(() => {
    resetStepResolution();
    setIndex((i) => Math.max(i - 1, 0));
  }, [resetStepResolution]);
  const stopTourEvent = useCallback((event: React.MouseEvent | React.PointerEvent) => {
    event.stopPropagation();
  }, []);
  const tourControlActionRef = useRef({
    close,
    isFirst,
    isLast,
    isStepResolving,
    next,
    prev,
  });
  const lastTourControlPressRef = useRef(0);
  useEffect(() => {
    tourControlActionRef.current = {
      close,
      isFirst,
      isLast,
      isStepResolving,
      next,
      prev,
    };
  }, [close, isFirst, isLast, isStepResolving, next, prev]);
  useEffect(() => {
    if (!open) return;
    const handleControlPress = (event: PointerEvent | MouseEvent) => {
      if (event.button !== 0 || !(event.target instanceof Element)) return;
      if (event.type === "mousedown" && event.timeStamp - lastTourControlPressRef.current < 80) return;
      const button = event.target.closest<HTMLButtonElement>("[data-tour-control]");
      if (!button || button.disabled) return;
      const control = button.dataset.tourControl;
      const actions = tourControlActionRef.current;
      if (control === "back" && (actions.isFirst || actions.isStepResolving)) return;
      if ((control === "next" || control === "done") && actions.isStepResolving) return;
      lastTourControlPressRef.current = event.timeStamp;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (control === "back") actions.prev();
      else if (control === "skip" || control === "done") actions.close();
      else if (control === "next") actions.next();
    };
    document.addEventListener("pointerdown", handleControlPress, true);
    document.addEventListener("mousedown", handleControlPress, true);
    return () => {
      document.removeEventListener("pointerdown", handleControlPress, true);
      document.removeEventListener("mousedown", handleControlPress, true);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      else if (!isStepResolving && (event.key === "ArrowRight" || event.key === "Enter")) next();
      else if (!isStepResolving && event.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, next, prev, close, isStepResolving]);

  const coachPos = useMemo(() => {
    if (!rect || step.kind !== "spotlight") return null;
    return computeCoachPos(rect, 380, 260, 18, step.preferSide);
  }, [rect, step]);
  const isRevealStep = step.kind === "spotlight" && Boolean(step.revealContent);
  const coachLeft = coachPos?.left;
  const coachTop = coachPos?.top;
  const isCoachPositionResolved = isRevealStep || (coachLeft !== undefined && coachTop !== undefined);
  const coachPositionStyle = useMemo<CoachPositionStyle | null>(() => {
    if (step.kind !== "spotlight") return null;
    if (isRevealStep) {
      return { right: 24, bottom: 24, left: "auto", top: "auto", transform: "none" };
    }
    if (coachLeft !== undefined && coachTop !== undefined) {
      return { left: coachLeft, top: coachTop, right: "auto", bottom: "auto", transform: "none" };
    }
    return lastCoachPositionStyleRef.current;
  }, [coachLeft, coachTop, isRevealStep, step.kind]);
  const coachPositionFingerprint = coachPositionStyle
    ? `${coachPositionStyle.left ?? ""}|${coachPositionStyle.top ?? ""}|${coachPositionStyle.right ?? ""}|${coachPositionStyle.bottom ?? ""}|${coachPositionStyle.transform ?? ""}`
    : "";

  useEffect(() => {
    if (open) return;
    lastCoachPositionStyleRef.current = null;
    lastCoachBoxRef.current = null;
    coachAnimationRef.current?.cancel();
    coachAnimationRef.current = null;
  }, [open]);

  useLayoutEffect(() => {
    if (!open || step.kind !== "spotlight" || !coachPositionStyle) {
      lastCoachBoxRef.current = null;
      coachAnimationRef.current?.cancel();
      coachAnimationRef.current = null;
      return;
    }

    const node = coachCardRef.current;
    if (!node) return;

    const rememberCoachBox = () => {
      const settledBox = node.getBoundingClientRect();
      lastCoachBoxRef.current = settledBox;
      if (isCoachPositionResolved) {
        lastCoachPositionStyleRef.current = {
          left: settledBox.left,
          top: settledBox.top,
          right: "auto",
          bottom: "auto",
          transform: "none",
        };
      }
    };

    const nextBox = node.getBoundingClientRect();
    const previousBox = lastCoachBoxRef.current;
    lastCoachBoxRef.current = nextBox;
    if (isCoachPositionResolved) {
      lastCoachPositionStyleRef.current = {
        left: nextBox.left,
        top: nextBox.top,
        right: "auto",
        bottom: "auto",
        transform: "none",
      };
    }
    if (!previousBox) return;

    const dx = previousBox.left - nextBox.left;
    const dy = previousBox.top - nextBox.top;
    if (Math.hypot(dx, dy) < 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    coachAnimationRef.current?.cancel();
    const animation = node.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: "translate(0, 0)" },
      ],
      {
        duration: 350,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    );
    coachAnimationRef.current = animation;
    animation.onfinish = () => {
      if (coachAnimationRef.current !== animation) return;
      rememberCoachBox();
      coachAnimationRef.current = null;
    };
    animation.oncancel = () => {
      if (coachAnimationRef.current === animation) coachAnimationRef.current = null;
    };
  }, [coachPositionFingerprint, coachPositionStyle, isCoachPositionResolved, open, step.kind]);

  if (!open) return null;

  const accent = step.accent;
  const accentClass = ACCENT_CLASSES[accent];
  const Icon = step.icon;

  return (
    <div
      className="fixed inset-0 z-[200] animate-onboarding-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      {(() => {
        const reveal = step.kind === "spotlight" && (step as SpotlightStep).revealContent;
        const dimVar = isDark
          ? (isNavigating
              ? "rgba(2, 6, 14, 0.85)"
              : reveal
                ? "rgba(2, 6, 14, 0.32)"
                : "rgba(2, 6, 14, 0.65)")
          : (isNavigating
              ? "rgba(241, 245, 249, 0.92)"
              : reveal
                ? "rgba(15, 23, 42, 0.22)"
                : "rgba(241, 245, 249, 0.82)");
        const blur = isNavigating ? "blur(14px)" : reveal ? "blur(2px)" : "blur(8px)";
        const showFlatDim = step.kind !== "spotlight" || !rect;
        if (!showFlatDim) return null;
        return (
          <div
            className="absolute inset-0"
            style={{
              background: dimVar,
              backdropFilter: blur,
              transition: "background 400ms cubic-bezier(0.22, 1, 0.36, 1), backdrop-filter 400ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        );
      })()}

      {step.kind === "spotlight" && (
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: contentLeft,
            right: 0,
            top: 0,
            bottom: 0,
            background: "hsl(var(--background))",
            opacity: isNavigating ? 1 : 0,
            transition: "opacity 180ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      )}

      {step.kind === "spotlight" && rect && (() => {
        const reveal = (step as SpotlightStep).revealContent;
        const dimColor = isDark
          ? (isNavigating
              ? "rgba(2, 6, 14, 0.85)"
              : reveal
                ? "rgba(2, 6, 14, 0.32)"
                : "rgba(2, 6, 14, 0.65)")
          : (isNavigating
              ? "rgba(241, 245, 249, 0.92)"
              : reveal
                ? "rgba(15, 23, 42, 0.22)"
                : "rgba(241, 245, 249, 0.82)");
        const TR = "400ms cubic-bezier(0.22, 1, 0.36, 1)";
        const transitionGeom = `left ${TR}, top ${TR}, width ${TR}, height ${TR}`;
        const transitionDim = `box-shadow 400ms cubic-bezier(0.22, 1, 0.36, 1)`;
        return (
          <>
            <div
              className="pointer-events-none absolute rounded-xl"
              style={{
                left: rect.x, top: rect.y, width: rect.w, height: rect.h,
                boxShadow: `0 0 0 9999px ${dimColor}`,
                transition: `${transitionGeom}, ${transitionDim}`,
              }}
            />
            <div
              className={`pointer-events-none absolute rounded-xl ${accentClass.text}`}
              style={{
                left: rect.x - 4, top: rect.y - 4, width: rect.w + 8, height: rect.h + 8,
                border: "2px solid currentColor",
                boxShadow: "0 0 28px 6px currentColor, 0 0 12px 2px currentColor",
                opacity: 0.75,
                transition: transitionGeom,
              }}
            />
          </>
        );
      })()}

      <div className="absolute inset-0">
        {step.kind === "splash" && (
          <SplashCard step={step} onNext={next} onSkip={close} index={index} total={total} isDark={isDark} />
        )}
        {step.kind === "finale" && (
          <FinaleCard step={step} onClose={close} onJump={(p) => { close(); navigate(p); }} index={index} total={total} isDark={isDark} />
        )}
      </div>

      {step.kind === "spotlight" && (() => {
        const TR = "350ms cubic-bezier(0.22, 1, 0.36, 1)";
        if (!coachPositionStyle) return null;
        return (
        <div
          ref={coachCardRef}
          className={`tour-coach-card absolute z-10 w-[380px] max-w-[92vw] rounded-2xl border border-border bg-card shadow-[0_24px_60px_-15px_rgba(0,0,0,0.55)] ${accentClass.text}`}
          onPointerDown={stopTourEvent}
          onMouseDown={stopTourEvent}
          onClick={stopTourEvent}
          style={{
            ...coachPositionStyle,
            borderTop: "3px solid currentColor",
            transition: `border-top-color ${TR}`,
          }}
        >

          <div className="relative p-5 tour-coach-content">
            <div className="mb-3 flex items-center gap-2.5">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${accentClass.bg} ${accentClass.text}`} style={{ transition: `background ${TR}, color ${TR}` }}>
                <Icon className="h-5 w-5" />
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${accentClass.chip}`} style={{ transition: `background ${TR}, color ${TR}` }}>
                Step {index + 1} of {total}
              </span>
            </div>

            <h3
              id="onboarding-title"
              className="mb-1.5 text-foreground"
              style={{
                fontFamily: "'Geist', Georgia, serif",
                fontSize: 26,
                lineHeight: 1.1,
                letterSpacing: "-0.01em",
              }}
            >
              {step.title}
            </h3>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              {step.body}
            </p>

            <div className="relative mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
              <div
                className={`h-full rounded-full ${accentClass.bg} brightness-150`}
                style={{
                  width: `${((index + 1) / total) * 100}%`,
                  transition: `width 280ms cubic-bezier(0.22, 1, 0.36, 1), background ${TR}`,
                }}
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                data-tour-control="back"
                onPointerDown={(event) => {
                  if (event.button !== 0 || isFirst || isStepResolving) return;
                  event.preventDefault();
                  stopTourEvent(event);
                  prev();
                }}
                onClick={(event) => {
                  stopTourEvent(event);
                  if (event.detail === 0 && !isFirst && !isStepResolving) prev();
                }}
                disabled={isFirst || isStepResolving}
                className="gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  data-tour-control="skip"
                  onClick={(event) => {
                    stopTourEvent(event);
                    close();
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Skip
                </Button>
                <Button
                  size="sm"
                  data-tour-control={isLast ? "done" : "next"}
                  onPointerDown={(event) => {
                    if (event.button !== 0 || isStepResolving) return;
                    event.preventDefault();
                    stopTourEvent(event);
                    if (isLast) close();
                    else next();
                  }}
                  onClick={(event) => {
                    stopTourEvent(event);
                    if (event.detail !== 0 || isStepResolving) return;
                    if (isLast) close();
                    else next();
                  }}
                  disabled={isStepResolving}
                  className="gap-1.5"
                >
                  {isLast ? "Done" : "Next"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};
