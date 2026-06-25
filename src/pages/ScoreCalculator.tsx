import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { ScoreCalculatorSeoContent } from "@/components/seo/ScoreCalculatorSeoContent";
import { satCalculatorYears } from "@/data/satCalculator";
import { useThemeMode } from "@/lib/theme";
import { MOBILE_MEDIA_QUERY } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const digitalSatSections = satCalculatorYears[0].sections;
const rwSections = digitalSatSections.slice(0, 2);
const mathSections = digitalSatSections.slice(2, 4);

const lerp = (start: number, end: number, amount: number) =>
  start + (end - start) * amount;

const getScoreAccent = (score: number, maxScore: number) => {
  const normalized = Math.max(0, Math.min(score / maxScore, 1));
  const hue = lerp(8, 268, normalized);
  const saturation = lerp(68, 78, normalized);
  const lightness = lerp(48, 58, normalized);

  return `hsl(${hue.toFixed(1)} ${saturation.toFixed(1)}% ${lightness.toFixed(1)}%)`;
};

const SCORE_RING_TRANSITION = "box-shadow 0.24s ease";
const SCORE_TEXT_TRANSITION = "color 0.24s ease";
const ScoreCalculator = () => {
  const isDarkMode = useThemeMode();
  const [isPhone, setIsPhone] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.matchMedia(MOBILE_MEDIA_QUERY).matches
      : false,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(MOBILE_MEDIA_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsPhone(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  const [rawScores, setRawScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      digitalSatSections.map((section, secIdx) => [
        String(secIdx),
        Math.round(section.maxRaw / 2),
      ]),
    ),
  );

  const scores = useMemo(() => {
    const readingWriting =
      (digitalSatSections[0].scores[rawScores["0"] ?? 0] ?? 0) +
      (digitalSatSections[1].scores[rawScores["1"] ?? 0] ?? 0);
    const math =
      (digitalSatSections[2].scores[rawScores["2"] ?? 0] ?? 0) +
      (digitalSatSections[3].scores[rawScores["3"] ?? 0] ?? 0);
    const total = readingWriting + math;
    return {
      readingWriting,
      math,
      total,
      totalColor: getScoreAccent(total, 1600),
    };
  }, [rawScores]);

  const moduleProgress = useMemo(
    () =>
      digitalSatSections.map((section, secIdx) => {
        const value = rawScores[String(secIdx)] ?? 0;
        return {
          title: section.title,
          value,
          maxRaw: section.maxRaw,
          progress: (value / section.maxRaw) * 100,
        };
      }),
    [rawScores],
  );

  const updateScore = (sectionIndex: number, nextValue: number) => {
    setRawScores((prev) => ({ ...prev, [String(sectionIndex)]: nextValue }));
  };

  const resetScores = () => {
    setRawScores(
      Object.fromEntries(
        digitalSatSections.map((section, secIdx) => [
          String(secIdx),
          Math.round(section.maxRaw / 2),
        ]),
      ),
    );
  };

  const themeColors = useMemo(
    () => ({
      pageBg: isDarkMode ? "hsl(var(--background))" : "#ffffff",
      surfaceBg: isDarkMode ? "rgba(15,23,42,0.8)" : "#ffffff",
      innerSurfaceBg: isDarkMode ? "hsl(var(--background))" : "#ffffff",
      textColor: isDarkMode ? "#f8fafc" : "#0f172a",
      mutedText: isDarkMode ? "rgba(226,232,240,0.72)" : "#64748b",
      borderColor: isDarkMode ? "rgba(148,163,184,0.16)" : "rgba(15,23,42,0.08)",
      railColor: isDarkMode ? "rgba(71,85,105,0.72)" : "rgba(148,163,184,0.2)",
      buttonBg: isDarkMode ? "#e2e8f0" : "#0f172a",
      buttonText: isDarkMode ? "#0f172a" : "#ffffff",
      thumbClass: isDarkMode
        ? "[&_[role=slider]]:border-slate-900 [&_[role=slider]]:bg-slate-100"
        : "[&_[role=slider]]:border-white [&_[role=slider]]:bg-white",
      trackClass: isDarkMode
        ? "[&_[data-orientation=horizontal]]:bg-slate-700"
        : "[&_[data-orientation=horizontal]]:bg-slate-200",
      stepperBg: isDarkMode ? "rgba(15,23,42,0.92)" : "#ffffff",
      stepperShadow: isDarkMode ? "0 8px 18px rgba(2,6,23,0.32)" : "0 8px 18px rgba(15,23,42,0.08)",
      summaryBorder: isDarkMode ? "1px solid rgba(148,163,184,0.14)" : "1px solid rgba(148,163,184,0.15)",
    }),
    [isDarkMode],
  );

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: themeColors.pageBg }}>
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: isPhone ? "20px 12px 56px" : "32px 24px 80px" }}>
        <div style={{ display: "flex", flexDirection: isPhone ? "column" : "row", gap: isPhone ? 18 : 28, alignItems: "stretch" }}>
          <div style={{ flex: "1 1 0", display: "flex", flexDirection: "column", gap: isPhone ? 16 : 24, minWidth: 0 }}>
            <SubjectPanel
              label="Reading & Writing"
              accent="#60a5fa"
              sections={rwSections}
              sectionOffset={0}
              rawScores={rawScores}
              onUpdate={updateScore}
              themeColors={themeColors}
            />

            <SubjectPanel
              label="Math"
              accent="hsl(201,100%,74%)"
              sections={mathSections}
              sectionOffset={2}
              rawScores={rawScores}
              onUpdate={updateScore}
              themeColors={themeColors}
            />
          </div>

          <div style={{ flexShrink: 0, width: isPhone ? "100%" : 420, display: "flex", flexDirection: "column" }}>
            <ScoreSummaryCard
              scores={scores}
              modules={moduleProgress}
              onReset={resetScores}
              themeColors={themeColors}
            />
          </div>
        </div>
      </main>
      <ScoreCalculatorSeoContent />
    </div>
  );
};

interface SubjectPanelProps {
  label: string;
  accent: string;
  sections: (typeof digitalSatSections)[number][];
  sectionOffset: number;
  rawScores: Record<string, number>;
  onUpdate: (idx: number, val: number) => void;
  themeColors: {
    surfaceBg: string;
    textColor: string;
    borderColor: string;
    thumbClass: string;
    trackClass: string;
    stepperBg: string;
    stepperShadow: string;
  };
}

interface ScoreSummaryCardProps {
  scores: {
    readingWriting: number;
    math: number;
    total: number;
    totalColor: string;
  };
  modules: {
    title: string;
    value: number;
    maxRaw: number;
    progress: number;
  }[];
  onReset: () => void;
  themeColors: {
    surfaceBg: string;
    innerSurfaceBg: string;
    textColor: string;
    mutedText: string;
    borderColor: string;
    railColor: string;
    buttonBg: string;
    buttonText: string;
    summaryBorder: string;
  };
}

const SubjectPanel = ({
  label,
  accent,
  sections,
  sectionOffset,
  rawScores,
  onUpdate,
  themeColors,
}: SubjectPanelProps) => {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            width: 3,
            height: 20,
            borderRadius: 2,
            background: accent,
            flexShrink: 0,
          }}
        />
        <h2
          style={{
            fontFamily: "'Inter Tight', sans-serif",
            fontSize: 15,
            fontWeight: 600,
            lineHeight: 1.4,
            color: "rgb(var(--ink))",
            margin: 0,
          }}
        >
          {label}
        </h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {sections.map((section, i) => {
          const globalIdx = sectionOffset + i;
          const value = rawScores[String(globalIdx)] ?? 0;

          return (
            <div
              key={section.title}
              style={{
                background: themeColors.surfaceBg,
                border: `1px solid ${themeColors.borderColor}`,
                borderRadius: 18,
                padding: "20px",
                boxShadow: "0 12px 30px rgba(15,23,42,0.04)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <p
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "rgb(var(--ink))",
                    margin: 0,
                  }}
                >
                  {section.title}
                </p>
                <span
                  style={{
                    fontFamily: "'Inter Tight', sans-serif",
                    fontSize: 36,
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.025em",
                    lineHeight: 1,
                    color: "rgb(var(--ink))",
                    flexShrink: 0,
                  }}
                >
                  {value}
                  <span style={{ fontSize: 13, fontWeight: 400, fontFamily: "'Inter', sans-serif", color: "rgb(var(--ink-muted))", marginLeft: 6 }}>
                    out of {section.maxRaw}
                  </span>
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  style={getStepperBtn(themeColors)}
                  onClick={() => onUpdate(globalIdx, Math.max(0, value - 1))}
                  aria-label={`Decrease ${section.title}`}
                >
                  −
                </button>

                <div style={{ flex: 1 }}>
                  <Slider
                    value={[value]}
                    min={0}
                    max={section.maxRaw}
                    step={1}
                    onValueChange={([next]) => onUpdate(globalIdx, next)}
                    className={cn(
                      "py-4",
                      "[&_[role=slider]]:h-9 [&_[role=slider]]:w-9 [&_[role=slider]]:border-[4px]",
                      themeColors.thumbClass,
                      "[&_[role=slider]]:shadow-[0_14px_30px_rgba(15,23,42,0.18)] [&_[role=slider]]:hover:scale-110",
                      "[&_[data-orientation=horizontal]]:h-4 [&_[data-orientation=horizontal]]:border-0",
                      themeColors.trackClass,
                    )}
                  />
                </div>

                <button
                  type="button"
                  style={getStepperBtn(themeColors)}
                  onClick={() =>
                    onUpdate(globalIdx, Math.min(section.maxRaw, value + 1))
                  }
                  aria-label={`Increase ${section.title}`}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ScoreSummaryCard = ({
  scores,
  modules,
  onReset,
  themeColors,
}: ScoreSummaryCardProps) => {
  const totalProgress = Math.max(0, Math.min((scores.total / 1600) * 100, 100));
  const ringAngle = totalProgress * 3.6;
  const ringRailColor = "rgba(148,163,184,0.18)";
  const ringBackground = `conic-gradient(${scores.totalColor} 0deg, ${scores.totalColor} ${ringAngle}deg, ${ringRailColor} ${ringAngle}deg, ${ringRailColor} 360deg)`;

  return (
    <div
      style={{
        background: themeColors.surfaceBg,
        border: `1px solid ${themeColors.borderColor}`,
        borderRadius: 24,
        padding: "24px 20px",
        boxShadow: "0 18px 50px rgba(15,23,42,0.08)",
        display: "flex",
        flexDirection: "column",
        flex: 1,
      }}
    >
      <div style={{ display: "grid", placeItems: "center", marginBottom: 20 }}>
        <div
          style={{
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: ringBackground,
            padding: 12,
            boxShadow: `0 0 50px ${scores.totalColor}22`,
            transition: SCORE_RING_TRANSITION,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: themeColors.innerSurfaceBg,
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              border: themeColors.summaryBorder,
            }}
          >
            <div>
              <div
                className="score-number"
                style={
                  {
                    fontFamily: "'Inter Tight', sans-serif",
                    fontWeight: 700,
                    letterSpacing: "-0.045em",
                    fontVariantNumeric: "tabular-nums",
                    fontSize: "clamp(40px, 5vw, 64px)",
                    lineHeight: 1,
                    color: scores.totalColor,
                    transition: SCORE_TEXT_TRANSITION,
                    "--score-glow": `${scores.totalColor}55`,
                  } as CSSProperties
                }
              >
                {scores.total}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Reading & Writing", value: scores.readingWriting },
          { label: "Math", value: scores.math },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "12px 14px",
              borderRadius: 14,
              background: themeColors.surfaceBg,
              border: `1px solid ${themeColors.borderColor}`,
            }}
          >
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, color: "rgb(var(--ink))" }}>
              {item.label}
            </span>
            <span
              style={{
                fontFamily: "'Inter Tight', sans-serif",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.02em",
                fontSize: 22,
                fontWeight: 700,
                color: "rgb(var(--ink))",
                flexShrink: 0,
              }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, marginBottom: 20 }}>
        {modules.map((module) => (
          <div key={module.title}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
                gap: 8,
              }}
            >
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgb(var(--ink-mid))", fontWeight: 500 }}>
                {module.title}
              </span>
              <span
                style={{
                  fontFamily: "'Inter Tight', sans-serif",
                  fontVariantNumeric: "tabular-nums",
                  fontSize: 11,
                  color: "rgb(var(--ink))",
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {module.value}/{module.maxRaw}
              </span>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 999,
                background: themeColors.railColor,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${module.progress}%`,
                  borderRadius: 999,
                  background: scores.totalColor,
                  transition: "width 0.45s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onReset}
        style={{
          width: "100%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "11px 18px",
          borderRadius: 999,
          background: themeColors.buttonBg,
          border: "none",
          color: themeColors.buttonText,
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "'Geist', sans-serif",
          transition: "transform 0.15s ease, opacity 0.15s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
          (e.currentTarget as HTMLButtonElement).style.opacity = "0.92";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "none";
          (e.currentTarget as HTMLButtonElement).style.opacity = "1";
        }}
      >
        <RotateCcw size={14} />
        Reset to defaults
      </button>
    </div>
  );
};

const getStepperBtn = (themeColors: {
  borderColor: string;
  stepperBg: string;
  textColor: string;
  stepperShadow: string;
}): CSSProperties => ({
  width: 40,
  height: 40,
  borderRadius: "50%",
  border: `1.5px solid ${themeColors.borderColor}`,
  background: themeColors.stepperBg,
  color: themeColors.textColor,
  fontSize: 20,
  fontWeight: 400,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  lineHeight: 1,
  transition: "background 0.15s, border-color 0.15s, transform 0.15s ease",
  boxShadow: themeColors.stepperShadow,
});

export default ScoreCalculator;
