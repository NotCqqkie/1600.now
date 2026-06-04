import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useThemeMode } from "@/hooks/useThemeMode";
import {
  ArrowRight,
  ArrowLeft,
  BarChart3,
  BookA,
  BookOpen,
  BookOpenCheck,
  Calculator,
  ClipboardList,
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
  Target,
  Wand2,
} from "lucide-react";

type LucideIcon = React.ComponentType<{ className?: string }>;

type AccentName = "sky" | "violet" | "emerald" | "amber" | "rose" | "cyan" | "fuchsia" | "indigo" | "teal" | "orange";

// Tailwind 500-level for solid accents (text/border) — visible on both light & dark.
// /25 backgrounds and /30 chip backgrounds chosen so the tinted surfaces actually
// show against `bg-card` in dark mode without being garish in light mode.
// `chip` text uses 600 in light mode and 300 in dark via the `dark:` prefix,
// since the same tint reads differently on each canvas.
const ACCENT_CLASSES: Record<AccentName, { text: string; ring: string; bg: string; chip: string; grad: string }> = {
  sky:      { text: "text-sky-500",     ring: "ring-sky-400/40",     bg: "bg-sky-500/25",     chip: "bg-sky-500/30 text-sky-700 dark:text-sky-200",         grad: "from-sky-500/30 via-sky-500/10 to-transparent" },
  violet:   { text: "text-violet-500",  ring: "ring-violet-400/40",  bg: "bg-violet-500/25",  chip: "bg-violet-500/30 text-violet-700 dark:text-violet-200", grad: "from-violet-500/30 via-violet-500/10 to-transparent" },
  emerald:  { text: "text-emerald-600", ring: "ring-emerald-400/40", bg: "bg-emerald-500/25", chip: "bg-emerald-500/30 text-emerald-700 dark:text-emerald-200", grad: "from-emerald-500/30 via-emerald-500/10 to-transparent" },
  amber:    { text: "text-amber-500",   ring: "ring-amber-400/40",   bg: "bg-amber-500/25",   chip: "bg-amber-500/30 text-amber-700 dark:text-amber-200",   grad: "from-amber-500/30 via-amber-500/10 to-transparent" },
  rose:     { text: "text-rose-500",    ring: "ring-rose-400/40",    bg: "bg-rose-500/25",    chip: "bg-rose-500/30 text-rose-700 dark:text-rose-200",     grad: "from-rose-500/30 via-rose-500/10 to-transparent" },
  cyan:     { text: "text-cyan-600",    ring: "ring-cyan-400/40",    bg: "bg-cyan-500/25",    chip: "bg-cyan-500/30 text-cyan-700 dark:text-cyan-200",     grad: "from-cyan-500/30 via-cyan-500/10 to-transparent" },
  fuchsia:  { text: "text-fuchsia-500", ring: "ring-fuchsia-400/40", bg: "bg-fuchsia-500/25", chip: "bg-fuchsia-500/30 text-fuchsia-700 dark:text-fuchsia-200", grad: "from-fuchsia-500/30 via-fuchsia-500/10 to-transparent" },
  indigo:   { text: "text-indigo-500",  ring: "ring-indigo-400/40",  bg: "bg-indigo-500/25",  chip: "bg-indigo-500/30 text-indigo-700 dark:text-indigo-200", grad: "from-indigo-500/30 via-indigo-500/10 to-transparent" },
  teal:     { text: "text-teal-600",    ring: "ring-teal-400/40",    bg: "bg-teal-500/25",    chip: "bg-teal-500/30 text-teal-700 dark:text-teal-200",     grad: "from-teal-500/30 via-teal-500/10 to-transparent" },
  orange:   { text: "text-orange-500",  ring: "ring-orange-400/40",  bg: "bg-orange-500/25",  chip: "bg-orange-500/30 text-orange-700 dark:text-orange-200", grad: "from-orange-500/30 via-orange-500/10 to-transparent" },
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
  target: string; // data-tour value
  route?: string;
  pad?: number;
  /** data-tour key to click via JS after navigation but before resolving target.
   *  Used to programmatically open dialogs. */
  clickFirst?: string;
  /** data-tour key to click when leaving the step (toggles dialogs closed). */
  clickOnExit?: string;
  /** Position the coach card on the opposite side rather than auto-best */
  preferSide?: "right" | "left" | "bottom" | "top";
  /** When set, drop the dim opacity so the destination page content shows
   *  through, and pin the coach card to the bottom-right corner so it doesn't
   *  block what the user just landed on. Used for sidebar-nav steps. */
  revealContent?: boolean;
}
interface FinaleStep extends BaseStep { kind: "finale" }
type Step = SplashStep | SpotlightStep | FinaleStep;
type ActiveTour = "main" | "practice-set";

const MAIN_STEPS: Step[] = [
  // 0 — splash
  {
    kind: "splash",
    key: "welcome",
    icon: Sparkles,
    title: "Welcome to 1600.now",
    body: "Quick tour. We'll walk you through the real pages so you know exactly where everything is.",
    accent: "sky",
  },
  // 1 — sidebar overview
  // We pin a route here so the tour always lands on a known page with the
  // sidebar mounted before highlighting it. Without this, replaying the tour
  // from a page that doesn't render AppShell (or has the sidebar hidden
  // off-canvas) would point the spotlight at nothing.
  {
    kind: "spotlight",
    key: "sidebar",
    icon: LayoutGrid,
    title: "Your home base",
    body: "Every tool lives here. Always one click away — hit the arrow to collapse it when you need more room.",
    accent: "indigo",
    target: "sidebar",
    route: "/bank",
    pad: 6,
  },
  // 2 — Question Bank nav
  {
    kind: "spotlight",
    key: "bank",
    icon: BookOpen,
    title: "Question Bank",
    body: "Start here. Thousands of real SAT questions, sorted by skill and difficulty.",
    accent: "violet",
    target: "nav-bank",
    route: "/bank",
    revealContent: true,
  },
  // 3 — bank filters showcase
  {
    kind: "spotlight",
    key: "filters",
    icon: Filter,
    title: "Filter to what you need",
    body: "Pick by subject, difficulty, skill, source, or marked-for-review.",
    accent: "violet",
    target: "bank-filters",
    route: "/bank",
    pad: 8,
    preferSide: "bottom",
  },
  // 4 — Practice Tests nav
  {
    kind: "spotlight",
    key: "modules",
    icon: GraduationCap,
    title: "Practice Tests",
    body: "Full-length, timed exams that mirror the real SAT. Section scores and a full breakdown when you finish.",
    accent: "emerald",
    target: "nav-modules",
    route: "/modules",
    revealContent: true,
  },
  // 5 — 100 Hard Math
  {
    kind: "spotlight",
    key: "hard",
    icon: Flame,
    title: "100 Hard Math",
    body: "The 100 hardest math questions we could make. Beat these and the real test feels easy.",
    accent: "rose",
    target: "nav-hard",
    route: "/hard",
    revealContent: true,
  },
  // 6 — Vocab
  {
    kind: "spotlight",
    key: "vocab",
    icon: BookA,
    title: "Vocabulary",
    body: "Spaced-repetition flashcards on the words the SAT actually tests.",
    accent: "amber",
    target: "nav-vocab",
    route: "/vocab",
    revealContent: true,
  },
  // 7 — Statistics
  {
    kind: "spotlight",
    key: "stats",
    icon: BarChart3,
    title: "Your statistics",
    body: "Accuracy by skill, difficulty, and section — tracked over time. The data you need to study smarter.",
    accent: "indigo",
    target: "nav-stats",
    route: "/analysis",
    revealContent: true,
  },
  // 8 — Inside the question viewer (live page) — highlight reference button
  {
    kind: "spotlight",
    key: "question-toolbar",
    icon: Compass,
    title: "Inside a question",
    body: "You're now in a real question. Let's open the toolbar up.",
    accent: "cyan",
    target: "reference-button",
    route: "/hard/1",
    pad: 6,
    preferSide: "bottom",
  },
  // 9 — Live reference sheet
  {
    kind: "spotlight",
    key: "reference-window",
    icon: FileText,
    title: "Reference sheet",
    body: "Every formula and shape the College Board gives you, one click away.",
    accent: "fuchsia",
    target: "window-referenceSheet",
    clickFirst: "reference-button",
    clickOnExit: "reference-button",
    pad: 4,
  },
  // 10 — Desmos button
  {
    kind: "spotlight",
    key: "desmos-button",
    icon: Calculator,
    title: "Desmos lives here",
    body: "The exact calculator the real SAT ships with. Graph anything without leaving the page.",
    accent: "teal",
    target: "desmos-button",
    pad: 6,
    preferSide: "bottom",
  },
  // 11 — Live Desmos (floating). Window stays open for the next two steps.
  {
    kind: "spotlight",
    key: "desmos-window",
    icon: LineChart,
    title: "Built-in Desmos",
    body: "Drag it, resize it, graph anything.",
    accent: "teal",
    target: "window-desmos",
    clickFirst: "desmos-button",
    pad: 4,
  },
  // 12 — Highlight the sidebar-toggle button on the open Desmos window
  {
    kind: "spotlight",
    key: "desmos-sidebar-toggle",
    icon: PanelRight,
    title: "Or dock it to the side",
    body: "See the button at the top-left of the Desmos window? Click it to pin the calculator alongside your question.",
    accent: "teal",
    target: "sidebar-toggle-desmos",
    pad: 4,
    preferSide: "right",
  },
  // 13 — Click the toggle, show Desmos in sidebar mode
  {
    kind: "spotlight",
    key: "desmos-sidebarred",
    icon: Columns2,
    title: "Side-by-side mode",
    body: "Desmos is now docked next to your question. Click the same button to pop it back out.",
    accent: "teal",
    target: "window-desmos",
    clickFirst: "sidebar-toggle-desmos",
    clickOnExit: "desmos-button",
    pad: 4,
    preferSide: "right",
  },
  // 14 — Replay tour
  {
    kind: "spotlight",
    key: "replay",
    icon: HelpCircle,
    title: "Lost? Replay the tour",
    body: "Click here anytime to run this walkthrough again. No FOMO.",
    accent: "emerald",
    target: "tour-replay",
    route: "/bank",
  },
  // 13 — Finale
  {
    kind: "finale",
    key: "ready",
    icon: PartyPopper,
    title: "You're all set",
    body: "Head to the Question Bank to dive in, or pick anything from the sidebar. Good luck — we're rooting for you.",
    accent: "fuchsia",
  },
];

const PRACTICE_SET_STEPS: Step[] = [
  {
    kind: "spotlight",
    key: "practice-set-more",
    icon: MoreHorizontal,
    title: "Open More",
    body: "On a bank question, Create Practice Set uses that question's SAT skill and content type to find related bank questions.",
    accent: "sky",
    target: "question-more-menu",
    route: "/bank/math/1",
    pad: 6,
    preferSide: "bottom",
  },
  {
    kind: "spotlight",
    key: "practice-set-create",
    icon: BookOpenCheck,
    title: "Create Practice Set",
    body: "The saved set contains 5-20 questions from the same content group and appears in My Practice Sets for focused review.",
    accent: "emerald",
    target: "create-practice-set-menu-item",
    clickFirst: "question-more-menu",
    pad: 8,
    preferSide: "left",
  },
];

const tourKey = (uid: string | undefined) => `onboarding-seen:${uid ?? "anon"}`;
const ONBOARDING_REPLAY_REQUEST_KEY = "onboarding-replay-requested";
const PRACTICE_SET_HELP_REQUEST_KEY = "practice-set-help-requested";

/**
 * Warm the lazy-loaded route chunks the tour will visit. The pages in
 * App.tsx are wrapped in `React.lazy()`, which means `navigate("/bank")`
 * triggers a chunk fetch the first time. If we wait until the tour clicks
 * Next, the user stares at the navigation mask for as long as the network
 * round-trip takes (sometimes 1–2s on a cold cache).
 *
 * Calling these dynamic imports at tour open kicks off the fetches in
 * parallel and Vite caches the modules. By the time the user clicks
 * through, `navigate()` resolves the lazy boundary instantly.
 *
 * We deliberately ignore the promises — we don't need to *await* the
 * fetch, just start it. The browser does the rest.
 */
const preloadTourRoutes = () => {
  void import("@/pages/bank/BankIndex");
  void import("@/pages/modules/Modules");
  void import("@/pages/bank/HardQuestionsIntro");
  void import("@/pages/Vocab");
  void import("@/pages/Analysis");
  void import("@/pages/bank/Question");
};

type Rect = { x: number; y: number; w: number; h: number };

const findTargetRect = (target: string, pad = 4): Rect | null => {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return {
    x: r.left - pad,
    y: r.top - pad,
    w: r.width + pad * 2,
    h: r.height + pad * 2,
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
      const r = findTargetRect(target, pad);
      if (r) finish(r);
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
  // Synthesize a full MouseEvent — some component libraries listen on
  // `mousedown` only, and `el.click()` alone doesn't fire mousedown handlers.
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
  el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
};

const computeCoachPos = (rect: Rect, cardW = 380, cardH = 240, gap = 18, prefer?: "right" | "left" | "bottom" | "top") => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rightSpace = vw - (rect.x + rect.w);
  const leftSpace = rect.x;
  const bottomSpace = vh - (rect.y + rect.h);
  const topSpace = rect.y;

  let side: "right" | "left" | "bottom" | "top" = "right";
  if (prefer && (
    (prefer === "right" && rightSpace >= cardW + gap + 12) ||
    (prefer === "left" && leftSpace >= cardW + gap + 12) ||
    (prefer === "bottom" && bottomSpace >= cardH + gap + 12) ||
    (prefer === "top" && topSpace >= cardH + gap + 12)
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
  if (side === "right")  { left = rect.x + rect.w + gap; top = rect.y + rect.h / 2 - cardH / 2; }
  if (side === "left")   { left = rect.x - cardW - gap; top = rect.y + rect.h / 2 - cardH / 2; }
  if (side === "bottom") { top = rect.y + rect.h + gap; left = rect.x + rect.w / 2 - cardW / 2; }
  if (side === "top")    { top = rect.y - cardH - gap; left = rect.x + rect.w / 2 - cardW / 2; }

  left = Math.max(12, Math.min(left, vw - cardW - 12));
  top = Math.max(12, Math.min(top, vh - cardH - 12));
  return { left, top, side };
};

// ─── Sub-components ───────────────────────────────────────────────────

const FloatingBlobs = ({ accent }: { accent: AccentName }) => {
  const c = ACCENT_CLASSES[accent];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className={`absolute -top-32 -left-24 h-[26rem] w-[26rem] rounded-full ${c.bg} blur-3xl animate-onboarding-blob`} style={{ animationDuration: "9s" }} />
      <div className={`absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full ${c.bg} blur-3xl animate-onboarding-blob`} style={{ animationDuration: "11s", animationDelay: "1.2s" }} />
      <div className={`absolute top-1/3 right-1/4 h-72 w-72 rounded-full ${c.bg} blur-3xl animate-onboarding-blob opacity-60`} style={{ animationDuration: "13s", animationDelay: "0.4s" }} />
    </div>
  );
};

const SplashCard = ({ step, onNext, onSkip, index, total, isDark }: {
  step: Step; onNext: () => void; onSkip: () => void; index: number; total: number; isDark: boolean;
}) => {
  const c = ACCENT_CLASSES[step.accent];
  const titleColor = isDark ? "text-white" : "text-slate-900";
  const bodyColor = isDark ? "text-white/75" : "text-slate-700";
  const captionColor = isDark ? "text-white/60" : "text-slate-500";
  const skipColor = isDark
    ? "text-white/70 hover:text-white hover:bg-white/10"
    : "text-slate-600 hover:text-slate-900 hover:bg-slate-900/5";
  return (
    <div className="relative flex h-full w-full items-center justify-center px-6">
      <FloatingBlobs accent={step.accent} />

      {/* Orbiting micro-icons — z-[1] keeps them behind the z-10 center content */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[1]">
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const r = 180 + (i % 3) * 60;
          const dur = 18 + (i % 4) * 6;
          const delay = i * -3;
          const Glyph = [Sparkles, BookOpen, Target, GraduationCap, Calculator, BookA][i];
          return (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 h-7 w-7"
              style={{
                ["--orbit-r" as never]: `${r}px`,
                animation: `tour-orbit ${dur}s linear infinite`,
                animationDelay: `${delay}s`,
                opacity: 0.32,
              }}
            >
              <Glyph className={`h-7 w-7 ${c.text}`} />
            </div>
          );
        })}
      </div>

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
  step: Step; onClose: () => void; onJump: (path: string) => void; index: number; total: number; isDark: boolean;
}) => {
  const c = ACCENT_CLASSES[step.accent];
  const titleColor = isDark ? "text-white" : "text-slate-900";
  const bodyColor = isDark ? "text-white/75" : "text-slate-700";
  const captionColor = isDark ? "text-white/60" : "text-slate-500";
  const outlineBtn = isDark
    ? "border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
    : "border-slate-900/15 bg-white/70 text-slate-900 hover:bg-white hover:text-slate-900";
  return (
    <div className="relative flex h-full w-full items-center justify-center px-6">
      <FloatingBlobs accent={step.accent} />

      {/* Orbiting celebration glyphs — z-[1] keeps them behind the z-10 center content */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[1]">
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const r = 200 + (i % 3) * 60;
          const dur = 22 + (i % 4) * 6;
          const delay = i * -4;
          const Glyph = [Sparkles, PartyPopper, Wand2, Sparkles, Sparkles, PartyPopper][i];
          return (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 h-7 w-7"
              style={{
                ["--orbit-r" as never]: `${r}px`,
                animation: `tour-orbit ${dur}s linear infinite`,
                animationDelay: `${delay}s`,
                opacity: 0.32,
              }}
            >
              <Glyph className={`h-7 w-7 ${c.text}`} />
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

// ─── Main component ───────────────────────────────────────────────────

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

  // External replay
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

  // Lock scroll AND tag the body so we can target tour-only CSS adjustments
  // (e.g. crossfading the sidebar's active tab so it eases between items
  // along with the spotlight, instead of snapping).
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

  // Run leave-cleanup for the previous spotlight step (close any dialog it
  // opened) when the index actually changes. We use a ref-tracked previous
  // index so HMR / Fast-Refresh effect re-runs don't spuriously re-fire it.
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

  // Resolve target rect on each spotlight step. Gated by a ref so HMR /
  // Fast-Refresh re-runs of this effect don't re-click dialog buttons or
  // re-navigate.
  //
  // We deliberately do NOT clear `rect` to null between steps. Keeping the
  // previous rect lets the spotlight smoothly slide from the old element to
  // the new one (CSS transitions on left/top/width/height handle the rest).
  // Calling setRect(null) here would yank the spotlight to the corner and
  // back — that's the "snap" the user reported.
  //
  // `isNavigating` masks the brief moment when React Router is unmounting the
  // old route and mounting the new one. We darken the dim during that window
  // so the page swap doesn't flash through.
  const lastResolvedKeyRef = useRef<string>("");
  const [isNavigating, setIsNavigating] = useState(false);
  // The content-area mask spans from the sidebar's right edge to the viewport
  // right edge. We resolve this lazily right before each navigation so it
  // tracks sidebar collapse state and viewport changes.
  const [contentLeft, setContentLeft] = useState(0);
  useEffect(() => {
    if (!open) {
      lastResolvedKeyRef.current = "";
      setIsNavigating(false);
      return;
    }
    const fingerprint = `${index}:${step.key}`;
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
      // Navigate if needed. We snapshot location.pathname here because
      // including it in the effect deps would cancel this run() the moment
      // navigation completes and the path updates — leaving isNavigating
      // stuck at true and the content-area mask fully opaque (which is
      // exactly the "page doesn't render" bug).
      const startingPath = location.pathname;
      const willNavigate = step.route && step.route !== startingPath;
      if (willNavigate) {
        const aside = document.querySelector<HTMLElement>('aside[data-tour="sidebar"]');
        if (aside) setContentLeft(Math.round(aside.getBoundingClientRect().right));
        setIsNavigating(true);
        // Just slightly longer than the mask's CSS opacity transition (160ms)
        // so the mask is essentially opaque when navigate() fires. Going much
        // beyond this is what created the "weird waiting period" — the user
        // saw a fully-blank dark area for hundreds of extra ms while we
        // padded the mount + settle waits.
        await new Promise((r) => setTimeout(r, 170));
        if (cancelled) return;
        navigate(step.route!);
        // Pages mount fast in this app — 90ms is enough.
        await new Promise((r) => setTimeout(r, 90));
      } else {
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
      if (cancelled) return;

      // Programmatically click any "before" target (open a dialog)
      if (step.clickFirst) {
        // Wait for the click target to exist first
        await waitForTarget(step.clickFirst, 0, 2500);
        if (cancelled) return;
        clickByTour(step.clickFirst);
        await new Promise((r) => setTimeout(r, 220));
      }
      if (cancelled) return;

      const r = await waitForTarget(step.target, step.pad ?? 4);
      if (cancelled) return;
      // Only update rect if we found something — otherwise keep the previous
      // rect so the spotlight stays "anchored" on whatever it was last on.
      if (r) setRect(r);
      if (willNavigate) {
        // Brief settle so the spotlight rect has had time to start sliding
        // before we expose it again. Cut from 180 → 60ms.
        await new Promise((res) => setTimeout(res, 60));
        if (!cancelled) setIsNavigating(false);
      }
    };
    run();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index]);

  // Reposition on resize / scroll
  useEffect(() => {
    if (!open || step.kind !== "spotlight") return;
    const reposition = () => {
      const r = findTargetRect(step.target, step.pad ?? 4);
      if (r) setRect(r);
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, step]);

  const next = useCallback(() => {
    if (index === 0) preloadRoutesOnce();
    setIndex((i) => Math.min(i + 1, total - 1));
  }, [index, preloadRoutesOnce, total]);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" || e.key === "Enter") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, prev, close]);

  const coachPos = useMemo(() => {
    if (!rect || step.kind !== "spotlight") return null;
    return computeCoachPos(rect, 380, 260, 18, step.preferSide);
  }, [rect, step]);

  if (!open) return null;

  const isFirst = index === 0;
  const isLast = index === total - 1;
  const accent = step.accent;
  const c = ACCENT_CLASSES[accent];
  const Icon = step.icon;

  return (
    <div
      className="fixed inset-0 z-[200] animate-onboarding-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      {/* Backdrop. We tweak two things per step:
       *   - revealContent: drop dim opacity so the destination page shows.
       *   - isNavigating: temporarily darken to mask the route swap flash.
       * The transition is intentionally long (700ms) so changes feel like a
       * smooth gradient shift rather than a hard cut. */}
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
        // Non-spotlight steps OR spotlight steps without a rect still need a
        // full-screen backdrop. Spotlight WITH a rect gets dimming via the
        // box-shadow trick on the rect itself.
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

      {/* Content-area fade mask. During tour navigation we don't want the
       * destination page to flash in — instead, we fade the *content area*
       * (everything to the right of the persistent sidebar) to the app's
       * background color, let the new route mount behind it, then fade back.
       * The sidebar stays visible the whole time because it doesn't change
       * between routes. The mask renders unconditionally with opacity tied
       * to isNavigating, so the fade-in/out is just a CSS opacity transition. */}
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

      {/* Spotlight cutout. The rect itself paints a 9999px box-shadow in the
       * dim color — that's what darkens everything outside. The dim is
       * overall 25% lighter than before. Revealed content steps drop further
       * so the destination page is fully readable. */}
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
            {/* Dim cutout */}
            <div
              className="pointer-events-none absolute rounded-xl"
              style={{
                left: rect.x, top: rect.y, width: rect.w, height: rect.h,
                boxShadow: `0 0 0 9999px ${dimColor}`,
                transition: `${transitionGeom}, ${transitionDim}`,
              }}
            />
            {/* Bright accent border + outward glow. The glow is created via
             * box-shadow so it lives entirely OUTSIDE the rect — the element
             * inside stays free of any tint or fill. */}
            <div
              className={`pointer-events-none absolute rounded-xl ${c.text}`}
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

      {/* Splash / finale stages */}
      <div className="absolute inset-0">
        {step.kind === "splash" && (
          <SplashCard step={step} onNext={next} onSkip={close} index={index} total={total} isDark={isDark} />
        )}
        {step.kind === "finale" && (
          <FinaleCard step={step} onClose={close} onJump={(p) => { close(); navigate(p); }} index={index} total={total} isDark={isDark} />
        )}
      </div>

      {/* Coach card for spotlight steps. For revealContent steps we pin the
       * card to the bottom-right corner so it never blocks the destination
       * page — the user just landed on the page they're being told about and
       * we want them to actually see it. */}
      {step.kind === "spotlight" && (() => {
        const reveal = (step as SpotlightStep).revealContent;
        const TR = "350ms cubic-bezier(0.22, 1, 0.36, 1)";
        const allTR = `left ${TR}, top ${TR}, right ${TR}, bottom ${TR}, transform ${TR}`;
        let positionStyle: React.CSSProperties;
        if (reveal) {
          positionStyle = { right: 24, bottom: 24, left: "auto", top: "auto", transform: "none", transition: allTR };
        } else if (coachPos) {
          positionStyle = { left: coachPos.left, top: coachPos.top, right: "auto", bottom: "auto", transform: "none", transition: allTR };
        } else {
          positionStyle = { left: "50%", top: "auto", bottom: 32, right: "auto", transform: "translateX(-50%)", transition: allTR };
        }
        return (
        <div
          // Apply the step's accent class to the card itself so a 3px top
          // border can pick it up via currentColor. This makes the colored
          // accent FOLLOW the card's `rounded-2xl` curve at the corners
          // instead of sitting as a flat line that looks tacked-on.
          className={`tour-coach-card absolute z-10 w-[380px] max-w-[92vw] rounded-2xl border border-border bg-card shadow-[0_24px_60px_-15px_rgba(0,0,0,0.55)] ${c.text}`}
          style={{
            ...positionStyle,
            borderTop: "3px solid currentColor",
            transition: `${positionStyle.transition}, border-top-color ${TR}`,
          }}
        >

          <div className="relative p-5">
            <div className="mb-3 flex items-center gap-2.5">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${c.bg} ${c.text}`} style={{ transition: `background ${TR}, color ${TR}` }}>
                <Icon className="h-5 w-5" />
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${c.chip}`} style={{ transition: `background ${TR}, color ${TR}` }}>
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
                className={`h-full rounded-full ${c.bg} brightness-150`}
                style={{
                  width: `${((index + 1) / total) * 100}%`,
                  transition: `width 280ms cubic-bezier(0.22, 1, 0.36, 1), background ${TR}`,
                }}
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={prev} disabled={isFirst} className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={close} className="text-muted-foreground hover:text-foreground">
                  Skip
                </Button>
                <Button size="sm" onClick={isLast ? close : next} className="gap-1.5">
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
