import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { satCalculatorYears } from "@/data/satCalculator";
import { cn } from "@/lib/utils";

const digitalSatSections = satCalculatorYears[0].sections;
const rwSections = digitalSatSections.slice(0, 2);
const mathSections = digitalSatSections.slice(2, 4);

const lerp = (start: number, end: number, amount: number) =>
  start + (end - start) * amount;

const getScoreAccent = (score: number, maxScore: number) => {
  const normalized = Math.max(0, Math.min(score / maxScore, 1));

  // Low scores skew warm/red, mid scores move amber/green, high scores shift blue/violet.
  const hue = lerp(8, 268, normalized);
  const saturation = lerp(68, 78, normalized);
  const lightness = lerp(48, 58, normalized);

  return `hsl(${hue.toFixed(1)} ${saturation.toFixed(1)}% ${lightness.toFixed(1)}%)`;
};

const SCORE_TRANSITION = "color 0.24s ease, background 0.24s ease, box-shadow 0.24s ease";

const ScoreCalculator = () => {
  const [rawScores, setRawScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      digitalSatSections.map((section, secIdx) => [
        String(secIdx),
        Math.round(section.maxRaw / 2),
      ]),
    ),
  );

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.id = "calc-keyframes";
    style.textContent = `
      @keyframes scoreGlowPulse {
        0%, 100% { text-shadow: 0 0 40px var(--score-glow, rgba(125,211,252,0.3)); }
        50% { text-shadow: 0 0 70px var(--score-glow, rgba(125,211,252,0.5)); }
      }
      .score-number { animation: scoreGlowPulse 4s ease-in-out infinite; }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(link);
      document.getElementById("calc-keyframes")?.remove();
    };
  }, []);

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
      readingWritingColor: getScoreAccent(readingWriting, 800),
      mathColor: getScoreAccent(math, 800),
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

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "'Outfit', sans-serif" }}>
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 80px" }}>
        {/* Side-by-side: sliders left, score info right — both stretch to equal height */}
        <div style={{ display: "flex", gap: 28, alignItems: "stretch" }}>
          {/* Left: all 4 sliders */}
          <div style={{ flex: "1 1 0", display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
            <SubjectPanel
              label="Reading & Writing"
              accent="#60a5fa"
              sections={rwSections}
              sectionOffset={0}
              rawScores={rawScores}
              onUpdate={updateScore}
            />

            <SubjectPanel
              label="Math"
              accent="hsl(201,100%,74%)"
              sections={mathSections}
              sectionOffset={2}
              rawScores={rawScores}
              onUpdate={updateScore}
            />
          </div>

          {/* Right: score summary, stretches to match slider column height */}
          <div style={{ flexShrink: 0, width: 420, display: "flex", flexDirection: "column" }}>
            <ScoreSummaryCard
              scores={scores}
              modules={moduleProgress}
              onReset={resetScores}
            />
          </div>
        </div>
      </main>
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
}

interface ScoreSummaryCardProps {
  scores: {
    readingWriting: number;
    math: number;
    total: number;
    totalColor: string;
    readingWritingColor: string;
    mathColor: string;
  };
  modules: {
    title: string;
    value: number;
    maxRaw: number;
    progress: number;
  }[];
  onReset: () => void;
}

const SubjectPanel = ({
  label,
  accent,
  sections,
  sectionOffset,
  rawScores,
  onUpdate,
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
            fontSize: 15,
            fontWeight: 600,
            color: "hsl(var(--foreground))",
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
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
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
                    fontSize: 13,
                    fontWeight: 600,
                    color: "hsl(var(--foreground))",
                    margin: 0,
                  }}
                >
                  {section.title}
                </p>
                <span
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 20,
                    fontWeight: 700,
                    color: "hsl(var(--foreground))",
                    flexShrink: 0,
                  }}
                >
                  {value}/{section.maxRaw}
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
                  style={stepperBtn}
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
                      "[&_[role=slider]]:h-9 [&_[role=slider]]:w-9 [&_[role=slider]]:border-[4px] [&_[role=slider]]:bg-background",
                      "[&_[role=slider]]:shadow-[0_14px_30px_rgba(15,23,42,0.18)] [&_[role=slider]]:hover:scale-110",
                      "[&_[data-orientation=horizontal]]:h-4 [&_[data-orientation=horizontal]]:border-0 [&_[data-orientation=horizontal]]:bg-muted/70",
                    )}
                  />
                </div>

                <button
                  type="button"
                  style={stepperBtn}
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
}: ScoreSummaryCardProps) => {
  const totalProgress = (scores.total / 1600) * 100;
  const ringBackground = `conic-gradient(${scores.totalColor} 0deg, ${scores.totalColor} ${totalProgress * 3.6}deg, rgba(148,163,184,0.18) ${totalProgress * 3.6}deg, rgba(148,163,184,0.18) 360deg)`;

  return (
    <div
      style={{
        background:
          "linear-gradient(180deg, hsl(var(--card)) 0%, color-mix(in srgb, hsl(var(--card)) 88%, white 12%) 100%)",
        border: "1px solid hsl(var(--border))",
        borderRadius: 24,
        padding: "24px 20px",
        boxShadow: "0 18px 50px rgba(15,23,42,0.08)",
        display: "flex",
        flexDirection: "column",
        flex: 1,
      }}
    >
      {/* Ring */}
      <div style={{ display: "grid", placeItems: "center", marginBottom: 20 }}>
        <div
          style={{
            width: 180,
            height: 180,
            borderRadius: "50%",
            background: ringBackground,
            padding: 12,
            boxShadow: `0 0 50px ${scores.totalColor}22`,
            transition: SCORE_TRANSITION,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background:
                "radial-gradient(circle at top, rgba(255,255,255,0.1), rgba(255,255,255,0.02) 58%, rgba(255,255,255,0)), hsl(var(--card))",
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              border: "1px solid rgba(148,163,184,0.15)",
            }}
          >
            <div>
              <div
                className="score-number"
                style={
                  {
                    fontFamily: "'Instrument Serif', Georgia, serif",
                    fontSize: 64,
                    lineHeight: 0.9,
                    color: scores.totalColor,
                    marginBottom: 6,
                    transition: SCORE_TRANSITION,
                    "--score-glow": `${scores.totalColor}55`,
                  } as CSSProperties
                }
              >
                {scores.total}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "hsl(var(--muted-foreground))",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  fontWeight: 700,
                }}
              >
                out of 1600
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section scores */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {[
          {
            label: "Reading & Writing",
            value: scores.readingWriting,
            color: scores.readingWritingColor,
          },
          { label: "Math", value: scores.math, color: scores.mathColor },
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
              background: "hsl(var(--muted)/0.35)",
              border: "1px solid hsl(var(--border))",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))" }}>
              {item.label}
            </span>
            <span
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 22,
                fontWeight: 700,
                color: item.color,
                flexShrink: 0,
                transition: SCORE_TRANSITION,
              }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* Module progress bars — flex-grows to fill remaining space */}
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
              <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", fontWeight: 600 }}>
                {module.title}
              </span>
              <span
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 11,
                  color: "hsl(var(--foreground))",
                  fontWeight: 700,
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
                background: "hsl(var(--muted))",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${module.progress}%`,
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${scores.totalColor}99, ${scores.totalColor})`,
                  transition: "width 0.24s ease, background 0.24s ease",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Reset button — pinned to bottom */}
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
          background: "hsl(var(--foreground))",
          border: "none",
          color: "hsl(var(--background))",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "'Outfit', sans-serif",
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

const stepperBtn: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: "50%",
  border: "1.5px solid hsl(var(--border))",
  background: "hsl(var(--background))",
  color: "hsl(var(--foreground))",
  fontSize: 20,
  fontWeight: 400,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  lineHeight: 1,
  transition: "background 0.15s, border-color 0.15s, transform 0.15s ease",
  boxShadow: "0 8px 18px rgba(15,23,42,0.08)",
};

export default ScoreCalculator;
