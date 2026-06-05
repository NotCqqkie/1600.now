import { type ReactNode, useMemo, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProgress } from "@/hooks/useUserProgress";
import type { BankSubject } from "@/data/bankTypes";
import { getBankQuestionMetaRows } from "@/data/bankQuestionMetadata";
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
  ArrowRight,
  TrendingDown,
  TrendingUp,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useThemeMode } from "@/hooks/useThemeMode";
import {
  getAllPracticeTestResults,
  type PracticeTestResult,
} from "@/lib/practice/practiceTestSession";

// ─── Category map (same as Profile.tsx) ───────────────────────────────────

type CategoryMapItem = { subject: BankSubject; domain: string; skill: string };

let cachedLiveCategoryMap: Record<string, CategoryMapItem> | null = null;

const buildLiveCategoryMap = (): Record<string, CategoryMapItem> => {
  if (cachedLiveCategoryMap) return cachedLiveCategoryMap;
  const map: Record<string, CategoryMapItem> = {};
  try {
    for (const q of getBankQuestionMetaRows("math", "all")) {
      map[q.stableId] = {
        subject: "math",
        domain: q.category.domain,
        skill: q.category.skill,
      };
    }
    for (const q of getBankQuestionMetaRows("reading", "all")) {
      map[q.stableId] = {
        subject: "reading",
        domain: q.category.domain,
        skill: q.category.skill,
      };
    }
  } catch {
    // Bank not loaded yet
  }
  cachedLiveCategoryMap = map;
  return map;
};

// ─── Helpers ──────────────────────────────────────────────────────────────

const fmtTime = (seconds: number): string => {
  if (!seconds) return "0s";
  const d = intervalToDuration({ start: 0, end: seconds * 1000 });
  if (d.hours) return `${d.hours}h ${d.minutes}m`;
  if (d.minutes) return `${d.minutes}m ${d.seconds || 0}s`;
  return `${d.seconds}s`;
};

const accuracyColor = (pct: number) =>
  pct >= 70 ? "#2F8F3F" : pct >= 50 ? "#B57600" : "#B73B3B";

type InsightItem = {
  title: string;
  meta: string;
  value: string;
  valueColor: string;
  placeholder?: boolean;
};

const subjectLabel = (subject: BankSubject) =>
  subject === "math" ? "Math" : "Reading & Writing";

const InsightGroup = ({
  title,
  items,
}: {
  title: string;
  items: InsightItem[];
}) => (
  <div>
    <div
      style={{
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "hsl(var(--muted-foreground))",
        marginBottom: 10,
      }}
    >
      {title}
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {items.map((item, index) => (
        <div
          key={`${title}-${item.title}-${index}`}
          style={{
            borderBottom: index === items.length - 1 ? "none" : "1px solid hsl(var(--border))",
            padding: "12px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            opacity: item.placeholder ? 0.7 : 1,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: item.placeholder
                  ? "hsl(var(--muted-foreground))"
                  : "hsl(var(--foreground))",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                margin: "0 0 3px",
              }}
            >
              {item.title}
            </p>
            <p
              style={{
                fontSize: 11,
                color: "hsl(var(--muted-foreground))",
                margin: 0,
              }}
            >
              {item.meta}
            </p>
          </div>
          {!item.placeholder && (
            <div
              style={{
                flexShrink: 0,
                minWidth: 58,
                textAlign: "right",
                fontFamily: "'Inter Tight', sans-serif",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "-0.04em",
                fontVariantNumeric: "tabular-nums",
                fontFeatureSettings: "'tnum'",
                color: item.valueColor,
              }}
            >
              {item.value}
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
);

const SubjectInsightCard = ({
  title,
  accent,
  groups,
}: {
  title: string;
  accent: string;
  groups: Array<{ title: string; items: InsightItem[] }>;
}) => (
  <div
    style={{
      background: "hsl(var(--card))",
      border: "1px solid hsl(var(--border))",
      borderRadius: 16,
      padding: "24px",
      display: "flex",
      flexDirection: "column",
      gap: 18,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
        {title}
      </span>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {groups.map((group) => (
        <InsightGroup key={group.title} title={group.title} items={group.items} />
      ))}
    </div>
  </div>
);

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
      display: "flex",
      flexDirection: "column",
      gap: 10,
      padding: "4px 0",
      minHeight: 0,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        color: isDarkMode ? "rgba(255,255,255,0.42)" : "rgba(15,23,42,0.5)",
        fontSize: 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        fontWeight: 500,
      }}
    >
      <span>{label}</span>
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          color: isDarkMode ? "hsl(201,100%,78%)" : "hsl(201,100%,40%)",
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
    </div>
    <div
      style={{
        fontFamily: "'Inter Tight', sans-serif",
        fontSize: "clamp(24px, 2.4vw, 32px)",
        fontWeight: 600,
        color: empty
          ? (isDarkMode ? "rgba(255,255,255,0.2)" : "rgba(15,23,42,0.2)")
          : color ?? (isDarkMode ? "white" : "hsl(var(--foreground))"),
        letterSpacing: "-0.04em",
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
        fontFeatureSettings: "'tnum'",
      }}
    >
      {empty ? "—" : value}
    </div>
    <div
      style={{
        width: 36,
        height: 2,
        borderRadius: 999,
        background: empty
          ? (isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.12)")
          : color ?? "hsl(201,100%,74%)",
        opacity: empty ? 0.5 : 0.95,
      }}
    />
  </div>
);

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<{
    count: number;
    dateStr: string;
    left: number;
    top: number;
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
    <div ref={containerRef} style={{ position: "relative" }}>
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
                        if (isFuture) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const containerRect = containerRef.current?.getBoundingClientRect();
                        if (!containerRect) return;

                        setTooltip({
                          count,
                          dateStr,
                          left: rect.left - containerRect.left + rect.width / 2,
                          top: rect.top - containerRect.top - 10,
                        });
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

      {/* Tooltip — outside the scroll container, anchored to the heatmap container */}
      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: tooltip.left,
            top: tooltip.top,
            transform: "translate(-50%, -100%)",
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
            fontFamily: "'Geist', sans-serif",
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

// ─── Past tests strip ─────────────────────────────────────────────────────

const formatTestDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const PastTestsStrip = ({ results }: { results: PracticeTestResult[] }) => {
  const navigate = useNavigate();
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const scrollBy = (delta: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollLeft += delta;
  };

  return (
    <section className="stats-fade" style={{ animationDelay: "0s" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, gap: 12 }}>
        <div>
          <h2
            style={{
              fontFamily: "'Geist', Georgia, serif",
              fontSize: "clamp(20px, 2.5vw, 28px)",
              fontWeight: 400,
              color: "hsl(var(--foreground))",
              margin: "0 0 4px",
            }}
          >
            Past practice tests
          </h2>
          <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", margin: 0 }}>
            {results.length} full test{results.length === 1 ? "" : "s"} completed
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => scrollBy(-320)}
            aria-label="Scroll past tests left"
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(320)}
            aria-label="Scroll past tests right"
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div
        ref={scrollerRef}
        style={{
          display: "flex",
          gap: 16,
          overflowX: "auto",
          overflowY: "hidden",
          scrollSnapType: "x proximity",
          paddingBottom: 8,
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "thin",
        }}
      >
        {results.map((result) => (
          <div
            key={result.sessionId}
            style={{
              flex: "0 0 auto",
              width: 280,
              scrollSnapAlign: "start",
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 16,
              padding: "20px 22px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "hsl(var(--muted-foreground))",
                  fontWeight: 500,
                }}
              >
                Practice Test {result.practiceSetNumber} · {formatTestDate(result.submittedAt)}
              </span>
              <div
                style={{
                  fontFamily: "'Inter Tight', sans-serif",
                  fontSize: 40,
                  fontWeight: 600,
                  color: "hsl(var(--foreground))",
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                  fontFeatureSettings: "'tnum'",
                }}
              >
                {result.totalScore}
              </div>
              <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                Total score · out of 1600
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                paddingTop: 12,
                borderTop: "1px solid hsl(var(--border))",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "hsl(var(--muted-foreground))",
                    marginBottom: 2,
                  }}
                >
                  Reading & Writing
                </div>
                <div
                  style={{
                    fontFamily: "'Inter Tight', sans-serif",
                    fontSize: 18,
                    fontWeight: 600,
                    letterSpacing: "-0.04em",
                    fontVariantNumeric: "tabular-nums",
                    fontFeatureSettings: "'tnum'",
                    color: "#E0913C",
                  }}
                >
                  {result.readingWritingScore}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "hsl(var(--muted-foreground))",
                    marginBottom: 2,
                  }}
                >
                  Math
                </div>
                <div
                  style={{
                    fontFamily: "'Inter Tight', sans-serif",
                    fontSize: 18,
                    fontWeight: 600,
                    letterSpacing: "-0.04em",
                    fontVariantNumeric: "tabular-nums",
                    fontFeatureSettings: "'tnum'",
                    color: "#4F8DE0",
                  }}
                >
                  {result.mathScore}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                navigate(`/practice-tests/${result.practiceSetId}/results?session=${result.sessionId}`)
              }
              className="gap-2"
            >
              Review
              <ArrowRight size={14} />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
};

// ─── Main component ────────────────────────────────────────────────────────

const Analysis = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const { progress } = useUserProgress();
  const isDarkMode = useThemeMode();
  const liveCategoryMap = useMemo(() => buildLiveCategoryMap(), []);
  const pastTests = useMemo(() => getAllPracticeTestResults(uid), [uid]);

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

  const stats = useMemo(() => {
    const allProgress = Object.values(progress);

    let totalAttempted = 0,
      totalCorrect = 0,
      totalTime = 0,
      correctFirstTry = 0,
      solvedCount = 0;

    const subjectTotals: Record<
      BankSubject,
      { attempted: number; totalTime: number; correct: number }
    > = {
      math: { attempted: 0, totalTime: 0, correct: 0 },
      reading: { attempted: 0, totalTime: 0, correct: 0 },
    };

    const domainStats: Record<
      string,
      { attempted: number; correct: number; subject: BankSubject; totalTime: number }
    > = {};
    const skillStats: Record<
      string,
      { attempted: number; correct: number; domain: string; subject: BankSubject; totalTime: number }
    > = {};

    // Group attempts by date (YYYY-MM-DD) for progression chart
    const byDate: Record<string, { total: number; correct: number }> = {};
    // All attempts per day for the activity heatmap
    const dailyCounts: Record<string, number> = {};

    allProgress.forEach((qp) => {
      if (qp.attempts.length === 0) return;

      const meta = liveCategoryMap[qp.questionId];
      const firstCorrectAttemptIndex = qp.attempts.findIndex((a) => a.result === "correct");
      const isSolved = firstCorrectAttemptIndex >= 0;
      const isFirstTry = firstCorrectAttemptIndex === 0;

      totalAttempted++;
      totalTime += qp.totalTimeSpentSeconds;
      if (isSolved) {
        totalCorrect++;
        solvedCount++;
        if (isFirstTry) correctFirstTry++;
      }

      if (meta) {
        const { subject, domain, skill } = meta;
        subjectTotals[subject].attempted++;
        subjectTotals[subject].totalTime += qp.totalTimeSpentSeconds;
        if (isSolved) subjectTotals[subject].correct++;

        if (!domainStats[domain])
          domainStats[domain] = { attempted: 0, correct: 0, subject, totalTime: 0 };
        domainStats[domain].attempted++;
        domainStats[domain].totalTime += qp.totalTimeSpentSeconds;
        if (isSolved) domainStats[domain].correct++;

        if (!skillStats[skill])
          skillStats[skill] = { attempted: 0, correct: 0, domain, subject, totalTime: 0 };
        skillStats[skill].attempted++;
        skillStats[skill].totalTime += qp.totalTimeSpentSeconds;
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

    const domainsBySubject = (subject: BankSubject) =>
      Object.entries(domainStats)
      .filter(([, v]) => v.subject === subject)
      .map(([name, v]) => ({
        name,
        ...v,
        accuracy:
          v.attempted > 0 ? Math.round((v.correct / v.attempted) * 100) : 0,
        avgTime: v.attempted > 0 ? v.totalTime / v.attempted : 0,
      }))
      .sort((a, b) => b.attempted - a.attempted);

    const skillsBySubject = (subject: BankSubject) =>
      Object.entries(skillStats)
      .filter(([, v]) => v.subject === subject)
      .map(([name, v]) => ({
        name,
        ...v,
        accuracy:
          v.attempted > 0 ? Math.round((v.correct / v.attempted) * 100) : 0,
        avgTime: v.attempted > 0 ? v.totalTime / v.attempted : 0,
      }))
      .sort((a, b) => b.attempted - a.attempted);

    const mathDomains = domainsBySubject("math");
    const readingDomains = domainsBySubject("reading");
    const rankTop = <T,>(items: T[], compare: (left: T, right: T) => number) =>
      [...items].sort(compare).slice(0, 3);

    const avgTimePerQuestion = {
      math:
        subjectTotals.math.attempted > 0
          ? subjectTotals.math.totalTime / subjectTotals.math.attempted
          : null,
      reading:
        subjectTotals.reading.attempted > 0
          ? subjectTotals.reading.totalTime / subjectTotals.reading.attempted
          : null,
    };

    const subjectAccuracy = {
      math:
        subjectTotals.math.attempted > 0
          ? Math.round((subjectTotals.math.correct / subjectTotals.math.attempted) * 100)
          : null,
      reading:
        subjectTotals.reading.attempted > 0
          ? Math.round((subjectTotals.reading.correct / subjectTotals.reading.attempted) * 100)
          : null,
    };

    const buildAccuracyItems = (
      subject: BankSubject,
      direction: "asc" | "desc",
    ): InsightItem[] => {
      const ranked: InsightItem[] = rankTop(
        domainsBySubject(subject).filter((entry) => entry.attempted > 0),
        (left, right) =>
          direction === "asc"
            ? left.accuracy - right.accuracy || right.attempted - left.attempted
            : right.accuracy - left.accuracy || right.attempted - left.attempted,
      ).map((entry) => ({
        title: entry.name,
        meta: `${entry.attempted} attempted`,
        value: `${entry.accuracy}%`,
        valueColor: accuracyColor(entry.accuracy),
      }));

      while (ranked.length < 3) {
        ranked.push({
          title: "More answers needed",
          meta: `Answer more ${subjectLabel(subject)} questions to unlock a fuller report.`,
          value: "",
          valueColor: "hsl(var(--muted-foreground))",
          placeholder: true,
        });
      }

      return ranked;
    };

    const buildTimeItems = (
      subject: BankSubject,
      direction: "asc" | "desc",
      source: "domain" | "skill",
    ): InsightItem[] => {
      const entries =
        source === "domain"
          ? domainsBySubject(subject).filter((entry) => entry.attempted > 0)
          : skillsBySubject(subject).filter((entry) => entry.attempted > 0);
      const ranked: InsightItem[] = rankTop(
        entries,
        (left, right) =>
          direction === "asc"
            ? left.avgTime - right.avgTime || right.attempted - left.attempted
            : right.avgTime - left.avgTime || right.attempted - left.attempted,
      ).map((entry) => ({
        title: entry.name,
        meta:
          source === "skill" && "domain" in entry
            ? `${entry.domain} · ${entry.attempted} attempted`
            : `${entry.attempted} attempted`,
        value: fmtTime(Math.round(entry.avgTime)),
        valueColor: direction === "asc" ? "#4F8DE0" : "#E0913C",
      }));

      while (ranked.length < 3) {
        ranked.push({
          title: "More answers needed",
          meta: `Answer more ${subjectLabel(subject)} questions to unlock a fuller report.`,
          value: "",
          valueColor: "hsl(var(--muted-foreground))",
          placeholder: true,
        });
      }

      return ranked;
    };

    return {
      totalAttempted,
      totalCorrect,
      totalTime,
      correctFirstTry,
      avgTimePerQuestion,
      subjectAccuracy,
      progressionData,
      mathDomains,
      readingDomains,
      mathAccuracyLow: buildAccuracyItems("math", "asc"),
      mathAccuracyHigh: buildAccuracyItems("math", "desc"),
      readingAccuracyLow: buildAccuracyItems("reading", "asc"),
      readingAccuracyHigh: buildAccuracyItems("reading", "desc"),
      mathTimeHigh: buildTimeItems("math", "desc", "domain"),
      mathTimeLow: buildTimeItems("math", "asc", "domain"),
      readingTimeHigh: buildTimeItems("reading", "desc", "domain"),
      readingTimeLow: buildTimeItems("reading", "asc", "domain"),
      mathQuickestTypes: buildTimeItems("math", "asc", "skill"),
      mathSlowestTypes: buildTimeItems("math", "desc", "skill"),
      readingQuickestTypes: buildTimeItems("reading", "asc", "skill"),
      readingSlowestTypes: buildTimeItems("reading", "desc", "skill"),
      dailyCounts,
    };
  }, [liveCategoryMap, progress]);

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
      style={{ fontFamily: "'Geist', sans-serif" }}
    >
      {/* ── DARK HERO BANNER ─────────────────────────────────────────── */}
      {user && (
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
              fontFamily: "'Geist', Georgia, serif",
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

          <div
            className="grid grid-cols-2 md:grid-cols-4"
            style={{
              background: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.8)",
              border: isDarkMode
                ? "1px solid rgba(255,255,255,0.1)"
                : "1px solid rgba(15,23,42,0.08)",
              borderRadius: 24,
              padding: "22px 24px",
              boxShadow: isDarkMode ? "none" : "0 22px 48px rgba(15,23,42,0.08)",
              columnGap: 28,
              rowGap: 20,
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
            <StatTile
              value={fmtTime(Math.round(stats.avgTimePerQuestion.math ?? 0))}
              label="Math Time / Q"
              icon={<Clock size={13} />}
              empty={isEmpty || stats.avgTimePerQuestion.math == null}
              isDarkMode={isDarkMode}
            />
            <StatTile
              value={fmtTime(Math.round(stats.avgTimePerQuestion.reading ?? 0))}
              label="Reading Time / Q"
              icon={<Clock size={13} />}
              empty={isEmpty || stats.avgTimePerQuestion.reading == null}
              isDarkMode={isDarkMode}
            />
            <StatTile
              value={`${stats.subjectAccuracy.math ?? 0}%`}
              label="Math Accuracy"
              icon={<TrendingUp size={13} />}
              color={accuracyColor(stats.subjectAccuracy.math ?? 0)}
              empty={isEmpty || stats.subjectAccuracy.math == null}
              isDarkMode={isDarkMode}
            />
            <StatTile
              value={`${stats.subjectAccuracy.reading ?? 0}%`}
              label="Reading Accuracy"
              icon={<TrendingDown size={13} />}
              color={accuracyColor(stats.subjectAccuracy.reading ?? 0)}
              empty={isEmpty || stats.subjectAccuracy.reading == null}
              isDarkMode={isDarkMode}
            />
          </div>
        </div>

        {/* Fade to background */}
        <div
          style={{
            height: 112,
            background: isDarkMode
              ? "linear-gradient(to bottom, rgba(15,23,42,0) 0%, rgba(15,23,42,0.32) 42%, hsl(var(--background)) 100%)"
              : "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.52) 42%, hsl(var(--background)) 100%)",
          }}
        />
      </section>
      )}

      {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
      <main
        style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 88px" }}
      >
        {user && pastTests.length > 0 && (
          <div style={{ paddingTop: 4, marginBottom: 40 }}>
            <PastTestsStrip results={pastTests} />
          </div>
        )}

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
                fontFamily: "'Geist', serif",
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
                fontFamily: "'Geist', serif",
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
          <div style={{ display: "flex", flexDirection: "column", gap: 40, paddingTop: 4 }}>

            {/* Activity heatmap */}
            <section className="stats-fade" style={{ animationDelay: "0s" }}>
              <div style={{ marginBottom: 20 }}>
                <h2
                  style={{
                    fontFamily: "'Geist', Georgia, serif",
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
                      fontFamily: "'Geist', Georgia, serif",
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
                          fontFamily: "'Geist', sans-serif",
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

            <section className="stats-fade" style={{ animationDelay: "0.1s" }}>
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    marginBottom: 4,
                  }}
                >
                  <TrendingDown size={16} style={{ color: "#B73B3B" }} />
                  <h3
                    style={{
                      fontFamily: "'Geist', serif",
                      fontSize: "clamp(18px, 2vw, 24px)",
                      fontWeight: 400,
                      color: "hsl(var(--foreground))",
                      margin: 0,
                    }}
                  >
                    Focus areas
                  </h3>
                </div>
                <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>
                  Least and most accurate sections for each subject
                </p>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  gap: 20,
                }}
              >
                <SubjectInsightCard
                  title="Math"
                  accent="#4F8DE0"
                  groups={[
                    { title: "Least accurate sections", items: stats.mathAccuracyLow },
                    { title: "Highest accuracy sections", items: stats.mathAccuracyHigh },
                  ]}
                />
                <SubjectInsightCard
                  title="Reading & Writing"
                  accent="#E0913C"
                  groups={[
                    { title: "Least accurate sections", items: stats.readingAccuracyLow },
                    { title: "Highest accuracy sections", items: stats.readingAccuracyHigh },
                  ]}
                />
              </div>
            </section>

            <section className="stats-fade" style={{ animationDelay: "0.15s" }}>
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    marginBottom: 4,
                  }}
                >
                  <TrendingUp size={16} style={{ color: "#2F8F3F" }} />
                  <h3
                    style={{
                      fontFamily: "'Geist', serif",
                      fontSize: "clamp(18px, 2vw, 24px)",
                      fontWeight: 400,
                      color: "hsl(var(--foreground))",
                      margin: 0,
                    }}
                  >
                    Question type pacing
                  </h3>
                </div>
                <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>
                  The question types you're quickest and slowest at in each subject
                </p>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  gap: 20,
                }}
              >
                <SubjectInsightCard
                  title="Math"
                  accent="#4F8DE0"
                  groups={[
                    { title: "Quickest question types", items: stats.mathQuickestTypes },
                    { title: "Slowest question types", items: stats.mathSlowestTypes },
                  ]}
                />
                <SubjectInsightCard
                  title="Reading & Writing"
                  accent="#E0913C"
                  groups={[
                    { title: "Quickest question types", items: stats.readingQuickestTypes },
                    { title: "Slowest question types", items: stats.readingSlowestTypes },
                  ]}
                />
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default Analysis;
