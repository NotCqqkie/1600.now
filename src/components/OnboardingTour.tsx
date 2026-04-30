import { useEffect, useState, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowRight,
  ArrowLeft,
  BarChart3,
  BookA,
  BookOpen,
  Calculator,
  ClipboardList,
  Compass,
  Flame,
  GraduationCap,
  HelpCircle,
  LayoutGrid,
  LineChart,
  MousePointer2,
  PartyPopper,
  Sparkles,
  SunMoon,
  Target,
  X,
} from "lucide-react";

type LucideIcon = React.ComponentType<{ className?: string }>;

type AccentName = "sky" | "violet" | "emerald" | "amber" | "rose" | "cyan" | "fuchsia" | "indigo" | "teal" | "orange";

const ACCENT_CLASSES: Record<AccentName, { text: string; ring: string; bg: string; chip: string; grad: string }> = {
  sky:      { text: "text-sky-500",     ring: "ring-sky-400/40",     bg: "bg-sky-500/15",     chip: "bg-sky-500/20 text-sky-400",     grad: "from-sky-500/30 via-sky-500/10 to-transparent" },
  violet:   { text: "text-violet-500",  ring: "ring-violet-400/40",  bg: "bg-violet-500/15",  chip: "bg-violet-500/20 text-violet-400", grad: "from-violet-500/30 via-violet-500/10 to-transparent" },
  emerald:  { text: "text-emerald-500", ring: "ring-emerald-400/40", bg: "bg-emerald-500/15", chip: "bg-emerald-500/20 text-emerald-400", grad: "from-emerald-500/30 via-emerald-500/10 to-transparent" },
  amber:    { text: "text-amber-500",   ring: "ring-amber-400/40",   bg: "bg-amber-500/15",   chip: "bg-amber-500/20 text-amber-400",   grad: "from-amber-500/30 via-amber-500/10 to-transparent" },
  rose:     { text: "text-rose-500",    ring: "ring-rose-400/40",    bg: "bg-rose-500/15",    chip: "bg-rose-500/20 text-rose-400",    grad: "from-rose-500/30 via-rose-500/10 to-transparent" },
  cyan:     { text: "text-cyan-500",    ring: "ring-cyan-400/40",    bg: "bg-cyan-500/15",    chip: "bg-cyan-500/20 text-cyan-400",    grad: "from-cyan-500/30 via-cyan-500/10 to-transparent" },
  fuchsia:  { text: "text-fuchsia-500", ring: "ring-fuchsia-400/40", bg: "bg-fuchsia-500/15", chip: "bg-fuchsia-500/20 text-fuchsia-400", grad: "from-fuchsia-500/30 via-fuchsia-500/10 to-transparent" },
  indigo:   { text: "text-indigo-500",  ring: "ring-indigo-400/40",  bg: "bg-indigo-500/15",  chip: "bg-indigo-500/20 text-indigo-400", grad: "from-indigo-500/30 via-indigo-500/10 to-transparent" },
  teal:     { text: "text-teal-500",    ring: "ring-teal-400/40",    bg: "bg-teal-500/15",    chip: "bg-teal-500/20 text-teal-400",    grad: "from-teal-500/30 via-teal-500/10 to-transparent" },
  orange:   { text: "text-orange-500",  ring: "ring-orange-400/40",  bg: "bg-orange-500/15",  chip: "bg-orange-500/20 text-orange-400", grad: "from-orange-500/30 via-orange-500/10 to-transparent" },
};

type StepKind = "splash" | "spotlight" | "panel" | "finale";

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
  pad?: number; // extra spotlight padding
}
interface PanelStep extends BaseStep { kind: "panel"; panel: "desmos" | "reference" | "modules" }
interface FinaleStep extends BaseStep { kind: "finale" }
type Step = SplashStep | SpotlightStep | PanelStep | FinaleStep;

const STEPS: Step[] = [
  {
    kind: "splash",
    key: "welcome",
    icon: Sparkles,
    title: "Welcome to 1600",
    body: "We'll take you on a quick tour so you know exactly where everything lives. Use the arrow keys, or just hit Next.",
    accent: "sky",
  },
  {
    kind: "spotlight",
    key: "sidebar",
    icon: LayoutGrid,
    title: "Your home base",
    body: "Every tool lives in this sidebar. It's always one click away — collapse it with the chevron when you want more room.",
    accent: "indigo",
    target: "sidebar",
    pad: 6,
  },
  {
    kind: "spotlight",
    key: "bank",
    icon: BookOpen,
    title: "Question Bank",
    body: "5,000+ real SAT questions, organized by skill and difficulty. Filter, study, and review at your own pace.",
    accent: "violet",
    target: "nav-bank",
    route: "/bank",
  },
  {
    kind: "spotlight",
    key: "modules",
    icon: GraduationCap,
    title: "Practice Tests",
    body: "Full-length, timed exams that mirror the real SAT. You get section scores and a breakdown when you're done.",
    accent: "emerald",
    target: "nav-modules",
    route: "/modules",
  },
  {
    kind: "panel",
    key: "in-test-tools",
    icon: Compass,
    title: "Tools inside the test",
    body: "While you take a practice test, you'll have the full SAT toolkit on screen — Desmos for graphing and the reference sheet for formulas.",
    accent: "cyan",
    panel: "modules",
  },
  {
    kind: "panel",
    key: "desmos",
    icon: LineChart,
    title: "Built-in Desmos",
    body: "The same Desmos calculator the real SAT ships with — drag it around, dock it, or split-screen it next to the question.",
    accent: "teal",
    panel: "desmos",
  },
  {
    kind: "panel",
    key: "reference",
    icon: ClipboardList,
    title: "Reference sheet",
    body: "Every formula the College Board hands out, one tap away. Pin it open during a section if you want it nearby.",
    accent: "fuchsia",
    panel: "reference",
  },
  {
    kind: "spotlight",
    key: "hard",
    icon: Flame,
    title: "100 Hard Math",
    body: "The 100 hardest math questions we could find. If you can crush these, you can crush the test.",
    accent: "rose",
    target: "nav-hard",
    route: "/hard",
  },
  {
    kind: "spotlight",
    key: "vocab",
    icon: BookA,
    title: "Vocabulary",
    body: "The words the SAT loves to test, with quick-fire flashcards and spaced repetition that actually stick.",
    accent: "amber",
    target: "nav-vocab",
    route: "/vocab",
  },
  {
    kind: "spotlight",
    key: "calc",
    icon: Calculator,
    title: "Score Calculator",
    body: "Plug in your raw scores and see exactly what you'd hit on the real test. No guesswork.",
    accent: "orange",
    target: "nav-calc",
    route: "/score-calculator",
  },
  {
    kind: "spotlight",
    key: "stats",
    icon: BarChart3,
    title: "Your statistics",
    body: "Track accuracy by skill, difficulty, and section over time. The data you actually need to study smarter.",
    accent: "violet",
    target: "nav-stats",
    route: "/analysis",
  },
  {
    kind: "spotlight",
    key: "theme",
    icon: SunMoon,
    title: "Light or dark — your call",
    body: "Toggle the theme any time. The whole app adapts, including charts and question rendering.",
    accent: "sky",
    target: "theme-toggle",
  },
  {
    kind: "spotlight",
    key: "replay",
    icon: HelpCircle,
    title: "Lost? Replay this tour",
    body: "Click here whenever you want to see this walkthrough again. No tour-FOMO.",
    accent: "emerald",
    target: "tour-replay",
  },
  {
    kind: "finale",
    key: "ready",
    icon: PartyPopper,
    title: "You're all set",
    body: "Head to the Question Bank to dive in, or pick anywhere from the sidebar. Good luck — we're rooting for you.",
    accent: "fuchsia",
  },
];

const tourKey = (uid: string | undefined) => `onboarding-seen:${uid ?? "anon"}`;

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

const waitForTarget = (target: string, pad: number, timeoutMs = 2500): Promise<Rect | null> => {
  return new Promise((resolve) => {
    const immediate = findTargetRect(target, pad);
    if (immediate) return resolve(immediate);
    const start = performance.now();
    const observer = new MutationObserver(() => {
      const r = findTargetRect(target, pad);
      if (r) {
        observer.disconnect();
        resolve(r);
      } else if (performance.now() - start > timeoutMs) {
        observer.disconnect();
        resolve(null);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => {
      observer.disconnect();
      resolve(findTargetRect(target, pad));
    }, timeoutMs);
  });
};

// Compute coach card position relative to a rect, picking the side with most room.
const computeCoachPos = (rect: Rect, cardW = 380, cardH = 240, gap = 18) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rightSpace = vw - (rect.x + rect.w);
  const leftSpace = rect.x;
  const bottomSpace = vh - (rect.y + rect.h);
  const topSpace = rect.y;

  let side: "right" | "left" | "bottom" | "top" = "right";
  const max = Math.max(rightSpace, leftSpace, bottomSpace, topSpace);
  if (max === rightSpace) side = "right";
  else if (max === leftSpace) side = "left";
  else if (max === bottomSpace) side = "bottom";
  else side = "top";

  let left = 0, top = 0;
  if (side === "right")  { left = rect.x + rect.w + gap; top = rect.y + rect.h / 2 - cardH / 2; }
  if (side === "left")   { left = rect.x - cardW - gap; top = rect.y + rect.h / 2 - cardH / 2; }
  if (side === "bottom") { top = rect.y + rect.h + gap; left = rect.x + rect.w / 2 - cardW / 2; }
  if (side === "top")    { top = rect.y - cardH - gap; left = rect.x + rect.w / 2 - cardW / 2; }

  // Clamp within viewport
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

const SplashCard = ({ step, onNext, onSkip, index, total }: {
  step: Step; onNext: () => void; onSkip: () => void; index: number; total: number;
}) => {
  const c = ACCENT_CLASSES[step.accent];
  const Icon = step.icon;
  return (
    <div className="relative flex h-full w-full items-center justify-center px-6">
      <FloatingBlobs accent={step.accent} />

      {/* Orbiting micro-icons */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
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
        <div className="relative mx-auto mb-8 h-24 w-24">
          <div className={`absolute inset-0 rounded-3xl ${c.bg} blur-xl tour-splash-orb`} />
          <div className={`relative flex h-24 w-24 items-center justify-center rounded-3xl border border-border/60 bg-card/80 backdrop-blur ${c.text} tour-splash-orb`}>
            <Icon className="h-12 w-12" />
          </div>
          {/* Spinning ring */}
          <div className={`pointer-events-none absolute -inset-3 rounded-full border border-dashed ${c.ring} tour-ring-spin`} />
        </div>
        <h2
          className="mb-4 text-foreground tour-splash-text"
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 56,
            lineHeight: 1.02,
          }}
        >
          {step.title}
        </h2>
        <p className="mx-auto max-w-md text-[15px] leading-relaxed text-muted-foreground tour-splash-text" style={{ animationDelay: "120ms" }}>
          {step.body}
        </p>

        <div className="mt-9 flex items-center justify-center gap-3 tour-splash-text" style={{ animationDelay: "240ms" }}>
          <Button variant="ghost" onClick={onSkip} className="text-muted-foreground hover:text-foreground">Skip tour</Button>
          <Button size="lg" onClick={onNext} className="gap-2 px-6">
            Take the tour
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-8 text-xs text-muted-foreground tabular-nums">{index + 1} / {total}</div>
      </div>
    </div>
  );
};

const FinaleCard = ({ step, onClose, onJump, index, total }: {
  step: Step; onClose: () => void; onJump: (path: string) => void; index: number; total: number;
}) => {
  const c = ACCENT_CLASSES[step.accent];
  const Icon = step.icon;
  return (
    <div className="relative flex h-full w-full items-center justify-center px-6">
      <FloatingBlobs accent={step.accent} />

      {/* Confetti burst */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
        {Array.from({ length: 28 }).map((_, i) => {
          const rot = (i * 360) / 28;
          const dist = 180 + (i % 5) * 40;
          const colors = ["#ec4899", "#a855f7", "#22d3ee", "#facc15", "#34d399", "#f97316"];
          const color = colors[i % colors.length];
          const delay = (i % 6) * 0.05;
          return (
            <span
              key={i}
              className="absolute h-2 w-3 rounded-sm"
              style={{
                left: 0, top: 0,
                background: color,
                ["--c-rot" as never]: `${rot}deg`,
                ["--c-dist" as never]: `${dist}px`,
                animation: `tour-confetti 1.4s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s forwards`,
              }}
            />
          );
        })}
      </div>

      <div className="relative z-10 max-w-xl text-center">
        <div className="relative mx-auto mb-8 h-28 w-28">
          <div className={`absolute inset-0 rounded-full ${c.bg} blur-xl tour-splash-orb`} />
          <div className={`relative flex h-28 w-28 items-center justify-center rounded-full border border-border/60 bg-card/80 backdrop-blur ${c.text} tour-splash-orb`}>
            <Icon className="h-14 w-14" />
          </div>
        </div>
        <h2
          className="mb-4 text-foreground tour-splash-text"
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 56,
            lineHeight: 1.02,
          }}
        >
          {step.title}
        </h2>
        <p className="mx-auto max-w-md text-[15px] leading-relaxed text-muted-foreground tour-splash-text" style={{ animationDelay: "120ms" }}>
          {step.body}
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3 tour-splash-text" style={{ animationDelay: "240ms" }}>
          <Button variant="outline" onClick={() => onJump("/bank")} className="gap-2">
            <BookOpen className="h-4 w-4" /> Question Bank
          </Button>
          <Button variant="outline" onClick={() => onJump("/modules")} className="gap-2">
            <GraduationCap className="h-4 w-4" /> Practice Tests
          </Button>
          <Button size="lg" onClick={onClose} className="gap-2 px-6">
            I'm ready
            <Sparkles className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-8 text-xs text-muted-foreground tabular-nums">{index + 1} / {total}</div>
      </div>
    </div>
  );
};

// ─── Mock panels for in-test tools ────────────────────────────────────

const MockQuestionPanel = ({ accent }: { accent: AccentName }) => {
  const c = ACCENT_CLASSES[accent];
  return (
    <div className="tour-mock-fade w-[min(640px,90vw)] rounded-2xl border border-border/70 bg-card/95 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`inline-block h-2 w-2 rounded-full ${c.bg}`} />
          Module 1 · Question 7 of 22
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-border/70 bg-background/60 px-2 py-1 text-[11px] text-muted-foreground">📐 Reference</span>
          <span className={`rounded-md border border-border/70 bg-background/60 px-2 py-1 text-[11px] ${c.text}`}>📊 Calculator</span>
          <span className="rounded-md border border-border/70 bg-background/60 px-2 py-1 text-[11px] text-muted-foreground tabular-nums">12:43</span>
        </div>
      </div>
      <div className="p-5">
        <div className="mb-3 h-3 w-2/3 rounded bg-muted/70" />
        <div className="mb-2 h-3 w-full rounded bg-muted/50" />
        <div className="mb-5 h-3 w-5/6 rounded bg-muted/50" />
        <div className="space-y-2">
          {["A", "B", "C", "D"].map((l, i) => (
            <div key={l} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${i === 1 ? `${c.ring} ring-2 border-transparent ${c.bg}` : "border-border/70 bg-background/40"}`}>
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border/70 text-[11px] font-semibold">{l}</span>
              <span className="h-3 flex-1 rounded bg-muted/40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MockReferenceSheet = ({ accent }: { accent: AccentName }) => {
  const c = ACCENT_CLASSES[accent];
  return (
    <div className={`tour-mock-fade tour-float-y w-[min(360px,80vw)] rounded-xl border ${c.ring} ring-2 bg-card/95 shadow-2xl backdrop-blur`}>
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-wider">Reference</span>
        <X className="h-3 w-3 opacity-50" />
      </div>
      <div className="space-y-3 p-4 text-[12px]">
        <div className="rounded-md bg-muted/40 p-3 font-mono">
          A = πr²
          <br />C = 2πr
        </div>
        <div className="rounded-md bg-muted/40 p-3 font-mono">
          a² + b² = c²
        </div>
        <div className="rounded-md bg-muted/40 p-3 font-mono">
          V = lwh
          <br />V = (4/3)πr³
        </div>
        <div className="rounded-md bg-muted/40 p-3 font-mono text-center text-[11px]">
          30°-60°-90° · 45°-45°-90°
        </div>
      </div>
    </div>
  );
};

const MockDesmos = ({ accent }: { accent: AccentName }) => {
  const c = ACCENT_CLASSES[accent];
  return (
    <div className={`tour-mock-fade tour-float-y w-[min(420px,85vw)] rounded-xl border ${c.ring} ring-2 bg-card/95 shadow-2xl backdrop-blur`}>
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-wider">Desmos</span>
        <X className="h-3 w-3 opacity-50" />
      </div>
      <div className="grid grid-cols-[110px_1fr]">
        <div className="space-y-1.5 border-r border-border/60 p-2 text-[11px]">
          <div className={`rounded-md ${c.bg} px-2 py-1.5 font-mono ${c.text}`}>y = x² − 3</div>
          <div className="rounded-md bg-muted/40 px-2 py-1.5 font-mono text-muted-foreground">y = 2x + 1</div>
          <div className="rounded-md bg-muted/40 px-2 py-1.5 font-mono text-muted-foreground">+ add</div>
        </div>
        <div className="relative h-[180px] overflow-hidden bg-background/40">
          {/* Grid */}
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 180" preserveAspectRatio="none">
            <defs>
              <pattern id="tourgrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-muted-foreground/30" />
              </pattern>
            </defs>
            <rect width="200" height="180" fill="url(#tourgrid)" />
            <line x1="0" y1="90" x2="200" y2="90" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/60" />
            <line x1="100" y1="0" x2="100" y2="180" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/60" />
            {/* Parabola */}
            <path
              d="M 20 30 Q 100 200 180 30"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className={c.text}
            />
            {/* Line */}
            <line x1="20" y1="150" x2="180" y2="40" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70" strokeDasharray="4 3" />
          </svg>
        </div>
      </div>
    </div>
  );
};

const MockModulesGrid = ({ accent }: { accent: AccentName }) => {
  const c = ACCENT_CLASSES[accent];
  return (
    <div className="tour-mock-fade w-[min(520px,90vw)] rounded-2xl border border-border/70 bg-card/95 p-4 shadow-2xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">Practice tests</span>
        <span className={`rounded-full ${c.chip} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider`}>Timed</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border border-border/70 bg-background/40 p-3">
            <div className={`mb-2 inline-flex h-7 w-7 items-center justify-center rounded-md ${c.bg} ${c.text}`}>
              <GraduationCap className="h-4 w-4" />
            </div>
            <div className="mb-1 h-3 w-3/4 rounded bg-muted/60" />
            <div className="mb-3 h-2.5 w-1/2 rounded bg-muted/40" />
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
              <div className={`h-full ${c.bg} brightness-150`} style={{ width: `${20 + i * 18}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PanelStage = ({ step }: { step: PanelStep }) => {
  return (
    <div className="relative flex h-full w-full items-center justify-center px-6">
      <FloatingBlobs accent={step.accent} />
      <div className="relative z-10 flex flex-col items-center gap-6">
        {step.panel === "modules" && (
          <div className="relative">
            <MockModulesGrid accent={step.accent} />
            <div className="absolute -bottom-3 -right-3 tour-cursor-tap">
              <MousePointer2 className="h-7 w-7 text-foreground drop-shadow-lg" />
            </div>
          </div>
        )}
        {step.panel === "desmos" && (
          <div className="relative">
            <MockQuestionPanel accent={step.accent} />
            <div className="absolute -right-10 -top-6 z-10">
              <MockDesmos accent={step.accent} />
            </div>
          </div>
        )}
        {step.panel === "reference" && (
          <div className="relative">
            <MockQuestionPanel accent={step.accent} />
            <div className="absolute -left-10 -top-6 z-10">
              <MockReferenceSheet accent={step.accent} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────

export const OnboardingTour = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const step = STEPS[index];
  const total = STEPS.length;

  // Open logic: first visit or post-signup pending flag
  useEffect(() => {
    if (loading || !user) return;
    const pending = sessionStorage.getItem("onboarding-pending");
    const seen = localStorage.getItem(tourKey(user.uid));
    if (pending === "1" || !seen) {
      setOpen(true);
      sessionStorage.removeItem("onboarding-pending");
    }
  }, [user, loading]);

  // External replay trigger (sidebar button)
  useEffect(() => {
    const replay = () => { setIndex(0); setRect(null); setOpen(true); };
    window.addEventListener("onboarding:replay", replay);
    return () => window.removeEventListener("onboarding:replay", replay);
  }, []);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const close = useCallback(() => {
    if (user) localStorage.setItem(tourKey(user.uid), "1");
    setOpen(false);
    setIndex(0);
    setRect(null);
  }, [user]);

  // Resolve target rect when step changes (with optional route navigation)
  useEffect(() => {
    if (!open) return;
    if (step.kind !== "spotlight") {
      setRect(null);
      return;
    }
    let cancelled = false;

    const run = async () => {
      if (step.route && step.route !== location.pathname) {
        navigate(step.route);
      }
      // Give the page a tick to mount
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const r = await waitForTarget(step.target, step.pad ?? 4);
      if (cancelled) return;
      setRect(r);
    };
    run();

    return () => { cancelled = true; };
  }, [open, index]);

  // Re-resolve rect on resize / scroll while on a spotlight step
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
    setIndex((i) => Math.min(i + 1, total - 1));
  }, [total]);
  const prev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

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
    if (!rect) return null;
    return computeCoachPos(rect);
  }, [rect]);

  if (!open) return null;

  const isFirst = index === 0;
  const isLast = index === total - 1;
  const accent = step.accent;
  const c = ACCENT_CLASSES[accent];
  const Icon = step.icon;

  // Render
  return (
    <div
      className="fixed inset-0 z-[200] animate-onboarding-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      {/* Backdrop layer (only used when there's NO spotlight; spotlight uses its own dimming) */}
      {step.kind !== "spotlight" && (
        <div
          className="absolute inset-0"
          style={{ background: "rgba(7, 11, 22, 0.78)", backdropFilter: "blur(10px)" }}
        />
      )}
      {step.kind === "spotlight" && !rect && (
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{ background: "rgba(7, 11, 22, 0.78)", backdropFilter: "blur(10px)" }}
        />
      )}

      {/* Spotlight cutout — uses massive box-shadow trick to dim everything outside the rect */}
      {step.kind === "spotlight" && rect && (
        <>
          <div
            className="tour-spot-pulse pointer-events-none absolute rounded-xl"
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              transition: "left 480ms cubic-bezier(0.22, 1, 0.36, 1), top 480ms cubic-bezier(0.22, 1, 0.36, 1), width 480ms cubic-bezier(0.22, 1, 0.36, 1), height 480ms cubic-bezier(0.22, 1, 0.36, 1)",
              backdropFilter: "blur(0px)",
            }}
          />
          {/* Animated dashed ring */}
          <div
            className={`pointer-events-none absolute rounded-xl border-2 border-dashed ${c.text}`}
            style={{
              left: rect.x - 6,
              top: rect.y - 6,
              width: rect.w + 12,
              height: rect.h + 12,
              transition: "left 480ms cubic-bezier(0.22, 1, 0.36, 1), top 480ms cubic-bezier(0.22, 1, 0.36, 1), width 480ms cubic-bezier(0.22, 1, 0.36, 1), height 480ms cubic-bezier(0.22, 1, 0.36, 1)",
              borderColor: "currentColor",
            }}
          />
          {/* Outer glow ring */}
          <div
            className={`pointer-events-none absolute rounded-2xl ${c.bg}`}
            style={{
              left: rect.x - 14,
              top: rect.y - 14,
              width: rect.w + 28,
              height: rect.h + 28,
              filter: "blur(14px)",
              opacity: 0.45,
              transition: "left 480ms cubic-bezier(0.22, 1, 0.36, 1), top 480ms cubic-bezier(0.22, 1, 0.36, 1), width 480ms cubic-bezier(0.22, 1, 0.36, 1), height 480ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
          {/* Animated cursor pointer */}
          <div
            className="pointer-events-none absolute"
            style={{
              left: rect.x + rect.w - 6,
              top: rect.y + rect.h - 6,
              transition: "left 480ms cubic-bezier(0.22, 1, 0.36, 1), top 480ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <div className="tour-cursor-tap">
              <MousePointer2 className={`h-6 w-6 ${c.text} drop-shadow-lg`} fill="currentColor" />
            </div>
          </div>
        </>
      )}

      {/* Splash / panel / finale stages */}
      <div className="absolute inset-0">
        {step.kind === "splash" && (
          <SplashCard step={step} onNext={next} onSkip={close} index={index} total={total} />
        )}
        {step.kind === "panel" && <PanelStage step={step as PanelStep} />}
        {step.kind === "finale" && (
          <FinaleCard
            step={step}
            onClose={close}
            onJump={(p) => { close(); navigate(p); }}
            index={index}
            total={total}
          />
        )}
      </div>

      {/* Coach card for spotlight + panel steps */}
      {(step.kind === "spotlight" || step.kind === "panel") && (
        <div
          key={step.key}
          className="tour-coach-in absolute z-10 w-[380px] max-w-[92vw] rounded-2xl border border-border bg-card shadow-[0_24px_60px_-15px_rgba(0,0,0,0.6),0_0_0_1px_hsl(var(--border))]"
          style={
            step.kind === "spotlight" && coachPos
              ? { left: coachPos.left, top: coachPos.top, transition: "left 380ms cubic-bezier(0.22, 1, 0.36, 1), top 380ms cubic-bezier(0.22, 1, 0.36, 1)" }
              : { left: "50%", top: "auto", bottom: 32, transform: "translateX(-50%)" }
          }
        >
          {/* Shimmer top border */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden rounded-t-2xl">
            <div className={`absolute inset-y-0 w-1/3 ${c.bg}`} style={{ animation: "tour-shimmer-sweep 2.4s ease-in-out infinite" }} />
          </div>

          <button
            onClick={close}
            aria-label="Skip tour"
            className="absolute right-2.5 top-2.5 z-10 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="p-5">
            <div className="mb-3 flex items-center gap-2.5">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${c.bg} ${c.text} animate-onboarding-icon`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${c.chip}`}>
                Step {index + 1} of {total}
              </span>
            </div>

            <h3
              id="onboarding-title"
              className="mb-1.5 text-foreground animate-onboarding-slide"
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: 26,
                lineHeight: 1.1,
                letterSpacing: "-0.01em",
              }}
            >
              {step.title}
            </h3>
            <p className="text-[14px] leading-relaxed text-muted-foreground animate-onboarding-slide" style={{ animationDelay: "60ms" }}>
              {step.body}
            </p>

            {/* Progress bar */}
            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-muted/40">
              <div
                className={`h-full rounded-full ${c.bg} brightness-150`}
                style={{
                  width: `${((index + 1) / total) * 100}%`,
                  transition: "width 380ms cubic-bezier(0.22, 1, 0.36, 1)",
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
      )}
    </div>
  );
};
