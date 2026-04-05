import { type ReactNode, useMemo, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProgress } from "@/hooks/useUserProgress";
import { getBankPool } from "@/data/questionBank";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { intervalToDuration } from "date-fns";
import {
  Target,
  Clock,
  Zap,
  BookOpen,
  BarChart3,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  User,
} from "lucide-react";
import {
  getPreferredDarkMode,
  THEME_EVENT,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

// ─── Category map (same as Profile.tsx) ───────────────────────────────────

type CategoryMapItem = { subject: string; domain: string; skill: string };

const buildLiveCategoryMap = (): Record<string, CategoryMapItem> => {
  const map: Record<string, CategoryMapItem> = {};
  try {
    for (const q of getBankPool("math", "all")) {
      map[q.stableId] = {
        subject: "Math",
        domain: q.category.domain,
        skill: q.category.skill,
      };
    }
    for (const q of getBankPool("reading", "all")) {
      map[q.stableId] = {
        subject: "English",
        domain: q.category.domain,
        skill: q.category.skill,
      };
    }
  } catch {
    // Bank not loaded yet
  }
  return map;
};

const liveCategoryMap = buildLiveCategoryMap();

// ─── Helpers ──────────────────────────────────────────────────────────────

const fmtTime = (seconds: number): string => {
  if (!seconds) return "0s";
  const d = intervalToDuration({ start: 0, end: seconds * 1000 });
  if (d.hours) return `${d.hours}h ${d.minutes}m`;
  if (d.minutes) return `${d.minutes}m ${d.seconds || 0}s`;
  return `${d.seconds}s`;
};

const accuracyColor = (pct: number) =>
  pct >= 70 ? "#4ade80" : pct >= 50 ? "#fbbf24" : "#f87171";

// ─── Sub-components ────────────────────────────────────────────────────────

const StatTile = ({
  value,
  label,
  icon,
  color,
  empty,
  isDarkMode,
}: {
  value: string;
  label: string;
  icon: ReactNode;
  color?: string;
  empty?: boolean;
  isDarkMode: boolean;
}) => (
  <div
    style={{
      background: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.82)",
      border: isDarkMode
        ? "1px solid rgba(255,255,255,0.09)"
        : "1px solid rgba(15,23,42,0.08)",
      borderRadius: 14,
      padding: "20px 22px",
      boxShadow: isDarkMode ? "none" : "0 12px 28px rgba(15,23,42,0.06)",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 12,
        color: isDarkMode ? "rgba(255,255,255,0.4)" : "rgba(15,23,42,0.45)",
        fontSize: 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        fontWeight: 500,
      }}
    >
      {icon}
      {label}
    </div>
    <div
      style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: "clamp(24px, 3vw, 36px)",
        fontWeight: 700,
        color: empty
          ? (isDarkMode ? "rgba(255,255,255,0.2)" : "rgba(15,23,42,0.2)")
          : color ?? (isDarkMode ? "white" : "hsl(var(--foreground))"),
        letterSpacing: "-0.025em",
        lineHeight: 1,
      }}
    >
      {empty ? "—" : value}
    </div>
  </div>
);

// ─── Activity Heatmap (GitHub-style) ──────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_LABELS = ["","Mon","","Wed","","Fri",""];
const CELL = 13;
const GAP = 3;

// Relative-intensity color levels using the primary cyan
const LEVEL_COLORS = [
  "rgba(148,163,184,0.18)",  // 0: empty
  "rgba(125,211,252,0.28)",  // 1: light
  "rgba(125,211,252,0.55)",  // 2: medium
  "rgba(125,211,252,0.80)",  // 3: strong
  "rgba(125,211,252,1.00)",  // 4: max
];

function getActivityLevel(count: number, max: number): number {
  if (count === 0 || max === 0) return 0;
  const ratio = count / max;
  if (ratio <= 0.12) return 1;
  if (ratio <= 0.35) return 2;
  if (ratio <= 0.65) return 3;
  return 4;
}

interface HeatCell {
  date: Date;
  dateStr: string;
  count: number;
}

const ActivityHeatmap = ({ dailyCounts }: { dailyCounts: Record<string, number> }) => {
  const [tooltip, setTooltip] = useState<{
    count: number;
    dateStr: string;
    rect: DOMRect;
  } | null>(null);

  // Build a grid of 53 weeks × 7 days, ending on today
  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start of the current week (Sunday)
    const startOfThisWeek = new Date(today);
    startOfThisWeek.setDate(startOfThisWeek.getDate() - today.getDay());

    // Go back 52 full weeks
    const startDate = new Date(startOfThisWeek);
    startDate.setDate(startDate.getDate() - 52 * 7);

    const weeks: HeatCell[][] = [];
    const cur = new Date(startDate);

    while (cur <= today) {
      const week: HeatCell[] = [];
      for (let d = 0; d < 7; d++) {
        const dateStr =
          `${cur.getFullYear()}-` +
          `${String(cur.getMonth() + 1).padStart(2, "0")}-` +
          `${String(cur.getDate()).padStart(2, "0")}`;
        week.push({ date: new Date(cur), dateStr, count: dailyCounts[dateStr] ?? 0 });
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
    }

    // Month label: show at the first week where the first day crosses into a new month
    const monthLabels: Record<number, string> = {};
    let lastMonth = -1;
    weeks.forEach((week, wi) => {
      const m = week[0].date.getMonth();
      if (m !== lastMonth) {
        monthLabels[wi] = MONTHS[m];
        lastMonth = m;
      }
    });

    return { weeks, monthLabels };
  }, [dailyCounts]);

  const maxCount = useMemo(
    () => Math.max(1, ...Object.values(dailyCounts)),
    [dailyCounts],
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    // Outer wrapper: non-overflowing, contains both scroll area and portal-free tooltip
    <div style={{ position: "relative" }}>
      {/* Scrollable grid only — tooltip lives outside this div */}
      <div style={{ overflowX: "auto", overflowY: "visible", paddingBottom: 4 }}>
        {/* Month labels row */}
        <div style={{ display: "flex", marginLeft: 30, marginBottom: 5 }}>
          {weeks.map((_, wi) => (
            <div
              key={wi}
              style={{
                width: CELL,
                marginRight: GAP,
                flexShrink: 0,
                fontSize: 10,
                color: "hsl(var(--muted-foreground))",
                whiteSpace: "nowrap",
                overflow: "visible",
              }}
            >
              {monthLabels[wi] ?? ""}
            </div>
          ))}
        </div>

        {/* Grid: day labels + week columns */}
        <div style={{ display: "flex", gap: 0 }}>
          {/* Day-of-week labels */}
          <div style={{ display: "flex", flexDirection: "column", gap: GAP, marginRight: 6, flexShrink: 0 }}>
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                style={{
                  height: CELL,
                  width: 24,
                  fontSize: 10,
                  lineHeight: `${CELL}px`,
                  color: "hsl(var(--muted-foreground))",
                  textAlign: "right",
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Week columns */}
          <div style={{ display: "flex", gap: GAP }}>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap: GAP }}>
                {week.map(({ date, dateStr, count }) => {
                  const isFuture = date > today;
                  const level = isFuture ? -1 : getActivityLevel(count, maxCount);
                  return (
                    <div
                      key={dateStr}
                      onMouseEnter={(e) => {
                        if (!isFuture)
                          setTooltip({ count, dateStr, rect: e.currentTarget.getBoundingClientRect() });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      style={{
                        width: CELL,
                        height: CELL,
                        borderRadius: 3,
                        background: isFuture ? "transparent" : LEVEL_COLORS[level],
                        flexShrink: 0,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend — outside the scroll container so it doesn't stretch it */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          marginTop: 10,
          justifyContent: "flex-end",
        }}
      >
        <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>Less</span>
        {LEVEL_COLORS.map((color, i) => (
          <div
            key={i}
            style={{ width: CELL, height: CELL, borderRadius: 3, background: color, flexShrink: 0 }}
          />
        ))}
        <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>More</span>
      </div>

      {/* Tooltip — outside the scroll container, fixed to viewport */}
      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.rect.left + tooltip.rect.width / 2,
            top: tooltip.rect.top - 10,
            transform: "translateX(-50%) translateY(-100%)",
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            padding: "6px 11px",
            fontSize: 12,
            color: "hsl(var(--popover-foreground))",
            pointerEvents: "none",
            zIndex: 9999,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          <strong style={{ color: "hsl(var(--foreground))" }}>
            {tooltip.count} question{tooltip.count !== 1 ? "s" : ""}
          </strong>
          {" on "}
          {new Date(tooltip.dateStr + "T12:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      )}
    </div>
  );
};

const DomainBar = ({
  name,
  accuracy,
  attempted,
}: {
  name: string;
  accuracy: number;
  attempted: number;
}) => {
  const col = accuracyColor(accuracy);
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "hsl(var(--foreground))",
          }}
        >
          {name}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontSize: 11,
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {attempted} attempted
          </span>
          <span
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 13,
              fontWeight: 700,
              color: col,
            }}
          >
            {accuracy}%
          </span>
        </div>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: "hsl(var(--muted))",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 3,
            width: `${accuracy}%`,
            background: col,
            transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>
    </div>
  );
};

// ─── Main component ────────────────────────────────────────────────────────

const Analysis = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { progress } = useUserProgress();
  const [isDarkMode, setIsDarkMode] = useState(getPreferredDarkMode);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.id = "analysis-keyframes";
    style.textContent = `
      @keyframes statsFadeUp {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .stats-fade { animation: statsFadeUp 0.6s ease both; }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(link);
      document.getElementById("analysis-keyframes")?.remove();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    const syncTheme = () => setIsDarkMode(getPreferredDarkMode());
    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) syncTheme();
    };

    const handleThemeEvent = () => syncTheme();

    window.addEventListener("storage", handleStorage);
    window.addEventListener(THEME_EVENT, handleThemeEvent);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(THEME_EVENT, handleThemeEvent);
    };
  }, []);

  const stats = useMemo(() => {
    const allProgress = Object.values(progress);

    let totalAttempted = 0,
      totalCorrect = 0,
      totalTime = 0,
      correctFirstTry = 0;

    const domainStats: Record<
      string,
      { attempted: number; correct: number; subject: string }
    > = {};
    const skillStats: Record<
      string,
      { attempted: number; correct: number; domain: string; subject: string }
    > = {};

    // Group attempts by date (YYYY-MM-DD) for progression chart
    const byDate: Record<string, { total: number; correct: number }> = {};
    // All attempts per day for the activity heatmap
    const dailyCounts: Record<string, number> = {};

    allProgress.forEach((qp) => {
      if (qp.attempts.length === 0) return;

      const meta = liveCategoryMap[qp.questionId];
      const isSolved = qp.attempts.some((a) => a.result === "correct");
      const isFirstTry = qp.attempts[0]?.result === "correct";

      totalAttempted++;
      totalTime += qp.totalTimeSpentSeconds;
      if (isSolved) {
        totalCorrect++;
        if (isFirstTry) correctFirstTry++;
      }

      if (meta) {
        const { subject, domain, skill } = meta;

        if (!domainStats[domain])
          domainStats[domain] = { attempted: 0, correct: 0, subject };
        domainStats[domain].attempted++;
        if (isSolved) domainStats[domain].correct++;

        if (!skillStats[skill])
          skillStats[skill] = { attempted: 0, correct: 0, domain, subject };
        skillStats[skill].attempted++;
        if (isSolved) skillStats[skill].correct++;
      }

      const firstAttempt = qp.attempts[0];
      if (firstAttempt) {
        const d = new Date(firstAttempt.timestamp);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (!byDate[key]) byDate[key] = { total: 0, correct: 0 };
        byDate[key].total++;
        if (isSolved) byDate[key].correct++;
      }

      // Count ALL attempts per day for the activity heatmap
      for (const attempt of qp.attempts) {
        const d = new Date(attempt.timestamp);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        dailyCounts[key] = (dailyCounts[key] || 0) + 1;
      }
    });

    const progressionData = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-60)
      .map(([key, { total, correct }]) => {
        const [, month, day] = key.split("-");
        const months = [
          "Jan","Feb","Mar","Apr","May","Jun",
          "Jul","Aug","Sep","Oct","Nov","Dec",
        ];
        return {
          date: `${months[parseInt(month) - 1]} ${parseInt(day)}`,
          accuracy: Math.round((correct / total) * 100),
          count: total,
        };
      });

    const mathDomains = Object.entries(domainStats)
      .filter(([, v]) => v.subject === "Math")
      .map(([name, v]) => ({
        name,
        ...v,
        accuracy:
          v.attempted > 0 ? Math.round((v.correct / v.attempted) * 100) : 0,
      }))
      .sort((a, b) => b.attempted - a.attempted);

    const englishDomains = Object.entries(domainStats)
      .filter(([, v]) => v.subject === "English")
      .map(([name, v]) => ({
        name,
        ...v,
        accuracy:
          v.attempted > 0 ? Math.round((v.correct / v.attempted) * 100) : 0,
      }))
      .sort((a, b) => b.attempted - a.attempted);

    const weakSkills = Object.entries(skillStats)
      .filter(([, v]) => v.attempted >= 3)
      .map(([name, v]) => ({
        name,
        ...v,
        accuracy: Math.round((v.correct / v.attempted) * 100),
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 6);

    const strongSkills = Object.entries(skillStats)
      .filter(([, v]) => v.attempted >= 3)
      .map(([name, v]) => ({
        name,
        ...v,
        accuracy: Math.round((v.correct / v.attempted) * 100),
      }))
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 3);

    return {
      totalAttempted,
      totalCorrect,
      totalTime,
      correctFirstTry,
      progressionData,
      mathDomains,
      englishDomains,
      weakSkills,
      strongSkills,
      dailyCounts,
    };
  }, [progress]);

  const accuracy =
    stats.totalAttempted > 0
      ? Math.round((stats.totalCorrect / stats.totalAttempted) * 100)
      : 0;
  const firstTryRate =
    stats.totalAttempted > 0
      ? Math.round((stats.correctFirstTry / stats.totalAttempted) * 100)
      : 0;

  const isEmpty = stats.totalAttempted === 0;

  return (
    <div
      className="min-h-screen"
      style={{ fontFamily: "'Outfit', sans-serif" }}
    >
      {/* ── DARK HERO BANNER ─────────────────────────────────────────── */}
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
        {/* Ambient glow */}
        <div
          style={{
            position: "absolute",
            top: "-30%",
            left: "35%",
            width: 600,
            height: 400,
            borderRadius: "50%",
            background: isDarkMode
              ? "radial-gradient(ellipse, rgba(125,211,252,0.07) 0%, transparent 68%)"
              : "radial-gradient(ellipse, rgba(56,189,248,0.18) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            maxWidth: 1080,
            margin: "0 auto",
            padding: "48px 24px 52px",
          }}
        >
          {/* Label */}
          <div style={{ marginBottom: 14 }}>
            <span
              style={{
                display: "inline-block",
                padding: "3px 12px",
                borderRadius: 100,
                background: isDarkMode ? "rgba(125,211,252,0.1)" : "rgba(56,189,248,0.1)",
                border: isDarkMode
                  ? "1px solid rgba(125,211,252,0.18)"
                  : "1px solid rgba(56,189,248,0.25)",
                fontSize: 11,
                color: isDarkMode ? "hsl(201,100%,78%)" : "hsl(201,100%,40%)",
                fontWeight: 500,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Your Progress
            </span>
          </div>

          <h1
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: "clamp(30px, 4.5vw, 52px)",
              fontWeight: 400,
              color: isDarkMode ? "white" : "hsl(220,35%,15%)",
              letterSpacing: "-0.02em",
              margin: "0 0 32px",
              lineHeight: 1.1,
            }}
          >
            Performance overview
          </h1>

          {/* 4 key stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
              gap: 14,
            }}
          >
            <StatTile
              value={stats.totalAttempted.toLocaleString()}
              label="Questions"
              icon={<BookOpen size={13} />}
              empty={isEmpty}
              isDarkMode={isDarkMode}
            />
            <StatTile
              value={`${accuracy}%`}
              label="Accuracy"
              icon={<Target size={13} />}
              color={accuracyColor(accuracy)}
              empty={isEmpty}
              isDarkMode={isDarkMode}
            />
            <StatTile
              value={`${firstTryRate}%`}
              label="First Try"
              icon={<Zap size={13} />}
              color={accuracyColor(firstTryRate)}
              empty={isEmpty}
              isDarkMode={isDarkMode}
            />
            <StatTile
              value={fmtTime(stats.totalTime)}
              label="Time Studied"
              icon={<Clock size={13} />}
              empty={isEmpty}
              isDarkMode={isDarkMode}
            />
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

      {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
      <main
        style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 88px" }}
      >
        {!user ? (
          /* Not signed in */
          <div
            style={{ textAlign: "center", padding: "72px 0" }}
            className="stats-fade"
          >
            <User
              size={48}
              style={{
                margin: "0 auto 20px",
                display: "block",
                opacity: 0.2,
                color: "hsl(var(--foreground))",
              }}
            />
            <p
              style={{
                fontSize: 20,
                fontFamily: "'Instrument Serif', serif",
                fontWeight: 400,
                color: "hsl(var(--foreground))",
                marginBottom: 10,
              }}
            >
              Sign in to track your progress
            </p>
            <p
              style={{
                fontSize: 14,
                color: "hsl(var(--muted-foreground))",
                marginBottom: 32,
              }}
            >
              Your stats are saved to your account across all devices.
            </p>
            <Button
              onClick={() => navigate("/login")}
              className="gap-2"
            >
              Sign in
              <ArrowRight size={14} />
            </Button>
          </div>
        ) : isEmpty ? (
          /* Signed in but no data */
          <div
            style={{ textAlign: "center", padding: "72px 0" }}
            className="stats-fade"
          >
            <Target
              size={48}
              style={{
                margin: "0 auto 20px",
                display: "block",
                opacity: 0.2,
                color: "hsl(var(--foreground))",
              }}
            />
            <p
              style={{
                fontSize: 20,
                fontFamily: "'Instrument Serif', serif",
                fontWeight: 400,
                color: "hsl(var(--foreground))",
                marginBottom: 10,
              }}
            >
              No questions attempted yet
            </p>
            <p
              style={{
                fontSize: 14,
                color: "hsl(var(--muted-foreground))",
                marginBottom: 32,
              }}
            >
              Head to the question bank and start practicing to see your stats
              here.
            </p>
            <Button onClick={() => navigate("/bank")} className="gap-2">
              Go to Question Bank
              <ArrowRight size={14} />
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 48, paddingTop: 16 }}>

            {/* Activity heatmap */}
            <section className="stats-fade" style={{ animationDelay: "0s" }}>
              <div style={{ marginBottom: 20 }}>
                <h2
                  style={{
                    fontFamily: "'Instrument Serif', Georgia, serif",
                    fontSize: "clamp(20px, 2.5vw, 28px)",
                    fontWeight: 400,
                    color: "hsl(var(--foreground))",
                    margin: "0 0 4px",
                  }}
                >
                  Activity
                </h2>
                <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>
                  Questions answered per day over the past year
                </p>
              </div>
              <div
                style={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 16,
                  padding: "20px 24px 16px",
                }}
              >
                <ActivityHeatmap dailyCounts={stats.dailyCounts} />
              </div>
            </section>

            {/* Accuracy over time */}
            {stats.progressionData.length > 1 && (
              <section className="stats-fade" style={{ animationDelay: "0.05s" }}>
                <div style={{ marginBottom: 20 }}>
                  <h2
                    style={{
                      fontFamily: "'Instrument Serif', Georgia, serif",
                      fontSize: "clamp(20px, 2.5vw, 28px)",
                      fontWeight: 400,
                      color: "hsl(var(--foreground))",
                      margin: "0 0 4px",
                    }}
                  >
                    Accuracy over time
                  </h2>
                  <p
                    style={{
                      fontSize: 13,
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    Daily accuracy across all practice sessions
                  </p>
                </div>
                <div
                  style={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 16,
                    padding: "24px 20px 12px",
                  }}
                >
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart
                      data={stats.progressionData}
                      margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="accuracyGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="hsl(201,100%,74%)"
                            stopOpacity={0.28}
                          />
                          <stop
                            offset="95%"
                            stopColor="hsl(201,100%,74%)"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        opacity={0.5}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{
                          fontSize: 11,
                          fill: "hsl(var(--muted-foreground))",
                        }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{
                          fontSize: 11,
                          fill: "hsl(var(--muted-foreground))",
                        }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${v}%`}
                        width={38}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                          fontFamily: "'Outfit', sans-serif",
                        }}
                        formatter={(value: number, _name: string) => [
                          `${value}%`,
                          "Accuracy",
                        ]}
                        labelStyle={{
                          color: "hsl(var(--foreground))",
                          fontWeight: 600,
                          marginBottom: 4,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="accuracy"
                        stroke="hsl(201,100%,74%)"
                        strokeWidth={2}
                        fill="url(#accuracyGrad)"
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* Domain breakdown */}
            <section className="stats-fade" style={{ animationDelay: "0.1s" }}>
              <div style={{ marginBottom: 20 }}>
                <h2
                  style={{
                    fontFamily: "'Instrument Serif', Georgia, serif",
                    fontSize: "clamp(20px, 2.5vw, 28px)",
                    fontWeight: 400,
                    color: "hsl(var(--foreground))",
                    margin: "0 0 4px",
                  }}
                >
                  Accuracy by domain
                </h2>
                <p
                  style={{
                    fontSize: 13,
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  How you're doing across Math and English topic areas
                </p>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 20,
                }}
              >
                {(
                  [
                    {
                      label: "Math",
                      domains: stats.mathDomains,
                      accent: "#60a5fa",
                    },
                    {
                      label: "English",
                      domains: stats.englishDomains,
                      accent: "#fb923c",
                    },
                  ] as const
                ).map(({ label, domains, accent }) => (
                  <div
                    key={label}
                    style={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 16,
                      padding: "24px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 22,
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: accent,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: "hsl(var(--foreground))",
                        }}
                      >
                        {label}
                      </span>
                    </div>
                    {domains.length === 0 ? (
                      <p
                        style={{
                          color: "hsl(var(--muted-foreground))",
                          fontSize: 13,
                        }}
                      >
                        No {label} questions attempted yet.
                      </p>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 18,
                        }}
                      >
                        {domains.map((d) => (
                          <DomainBar
                            key={d.name}
                            name={d.name}
                            accuracy={d.accuracy}
                            attempted={d.attempted}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Weak + Strong areas */}
            {(stats.weakSkills.length > 0 || stats.strongSkills.length > 0) && (
              <section
                className="stats-fade"
                style={{ animationDelay: "0.15s" }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: 20,
                  }}
                >
                  {/* Needs work */}
                  {stats.weakSkills.length > 0 && (
                    <div>
                      <div style={{ marginBottom: 16 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            marginBottom: 4,
                          }}
                        >
                          <TrendingDown size={16} style={{ color: "#f87171" }} />
                          <h3
                            style={{
                              fontFamily: "'Instrument Serif', serif",
                              fontSize: "clamp(18px, 2vw, 24px)",
                              fontWeight: 400,
                              color: "hsl(var(--foreground))",
                              margin: 0,
                            }}
                          >
                            Focus areas
                          </h3>
                        </div>
                        <p
                          style={{
                            fontSize: 13,
                            color: "hsl(var(--muted-foreground))",
                          }}
                        >
                          Skills with the most room to improve
                        </p>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        {stats.weakSkills.map((skill) => {
                          const col = accuracyColor(skill.accuracy);
                          return (
                            <div
                              key={skill.name}
                              style={{
                                background: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: 12,
                                padding: "14px 16px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: "hsl(var(--foreground))",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    margin: "0 0 3px",
                                  }}
                                >
                                  {skill.name}
                                </p>
                                <p
                                  style={{
                                    fontSize: 11,
                                    color: "hsl(var(--muted-foreground))",
                                    margin: 0,
                                  }}
                                >
                                  {skill.domain} · {skill.attempted} attempts
                                </p>
                              </div>
                              <div
                                style={{
                                  flexShrink: 0,
                                  width: 46,
                                  height: 46,
                                  borderRadius: "50%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  border: `2px solid ${col}`,
                                  background:
                                    skill.accuracy < 50
                                      ? "rgba(248,113,113,0.08)"
                                      : "rgba(251,191,36,0.08)",
                                }}
                              >
                                <span
                                  style={{
                                    fontFamily: "'Space Mono', monospace",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: col,
                                  }}
                                >
                                  {skill.accuracy}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Strengths */}
                  {stats.strongSkills.length > 0 && (
                    <div>
                      <div style={{ marginBottom: 16 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            marginBottom: 4,
                          }}
                        >
                          <TrendingUp size={16} style={{ color: "#4ade80" }} />
                          <h3
                            style={{
                              fontFamily: "'Instrument Serif', serif",
                              fontSize: "clamp(18px, 2vw, 24px)",
                              fontWeight: 400,
                              color: "hsl(var(--foreground))",
                              margin: 0,
                            }}
                          >
                            Your strengths
                          </h3>
                        </div>
                        <p
                          style={{
                            fontSize: 13,
                            color: "hsl(var(--muted-foreground))",
                          }}
                        >
                          Topics where you're performing well
                        </p>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        {stats.strongSkills.map((skill) => {
                          const col = accuracyColor(skill.accuracy);
                          return (
                            <div
                              key={skill.name}
                              style={{
                                background: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: 12,
                                padding: "14px 16px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: "hsl(var(--foreground))",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    margin: "0 0 3px",
                                  }}
                                >
                                  {skill.name}
                                </p>
                                <p
                                  style={{
                                    fontSize: 11,
                                    color: "hsl(var(--muted-foreground))",
                                    margin: 0,
                                  }}
                                >
                                  {skill.domain} · {skill.attempted} attempts
                                </p>
                              </div>
                              <div
                                style={{
                                  flexShrink: 0,
                                  width: 46,
                                  height: 46,
                                  borderRadius: "50%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  border: `2px solid ${col}`,
                                  background: "rgba(74,222,128,0.08)",
                                }}
                              >
                                <span
                                  style={{
                                    fontFamily: "'Space Mono', monospace",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: col,
                                  }}
                                >
                                  {skill.accuracy}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Analysis;
