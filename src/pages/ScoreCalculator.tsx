import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { getSatScoreColor, satCalculatorYears } from "@/data/satCalculator";

const digitalSatSections = satCalculatorYears[0].sections;
const rwSections = digitalSatSections.slice(0, 2);
const mathSections = digitalSatSections.slice(2, 4);

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
    return { readingWriting, math, total, color: getSatScoreColor(total) };
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
      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 24px 80px" }}>
        <div
          className="grid gap-7 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,380px)]"
          style={{ alignItems: "start" }}
        >
          <div style={{ minWidth: 0 }}>
            <div className="grid gap-6 xl:grid-cols-2">
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
          </div>

          <ScoreSummaryCard
            scores={scores}
            modules={moduleProgress}
            onReset={resetScores}
          />
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
    color: string;
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
                      "py-3",
                      "[&_[role=slider]]:h-7 [&_[role=slider]]:w-7 [&_[role=slider]]:border-[4px] [&_[role=slider]]:bg-background",
                      "[&_[role=slider]]:shadow-[0_14px_30px_rgba(15,23,42,0.18)] [&_[role=slider]]:hover:scale-110",
                      "[&_[data-orientation=horizontal]]:h-3 [&_[data-orientation=horizontal]]:border-0 [&_[data-orientation=horizontal]]:bg-muted/70",
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
  const ringBackground = `conic-gradient(${scores.color} 0deg, ${scores.color} ${totalProgress * 3.6}deg, rgba(148,163,184,0.18) ${totalProgress * 3.6}deg, rgba(148,163,184,0.18) 360deg)`;

  return (
    <aside className="lg:sticky lg:top-6">
      <div
        style={{
          background:
            "linear-gradient(180deg, hsl(var(--card)) 0%, color-mix(in srgb, hsl(var(--card)) 88%, white 12%) 100%)",
          border: "1px solid hsl(var(--border))",
          borderRadius: 24,
          padding: 24,
          boxShadow: "0 18px 50px rgba(15,23,42,0.08)",
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "hsl(var(--muted-foreground))",
            margin: "0 0 18px",
          }}
        >
          Score estimate
        </p>

        <div
          style={{
            display: "grid",
            placeItems: "center",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 220,
              height: 220,
              borderRadius: "50%",
              background: ringBackground,
              padding: 14,
              boxShadow: `0 0 50px ${scores.color}22`,
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                background:
                  "radial-gradient(circle at top, rgba(255,255,255,0.1), rgba(255,255,255,0.02) 58%, rgba(255,255,255,0)) , hsl(var(--card))",
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
                      fontSize: 74,
                      lineHeight: 0.9,
                      color: scores.color,
                      marginBottom: 6,
                      transition: "color 0.4s ease",
                      "--score-glow": `${scores.color}55`,
                    } as React.CSSProperties
                  }
                >
                  {scores.total}
                </div>
                <div
                  style={{
                    fontSize: 12,
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

        <div
          style={{
            display: "grid",
            gap: 12,
            marginBottom: 20,
          }}
        >
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
                gap: 16,
                padding: "14px 16px",
                borderRadius: 16,
                background: "hsl(var(--muted)/0.35)",
                border: "1px solid hsl(var(--border))",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "hsl(var(--foreground))",
                }}
              >
                {item.label}
              </span>
              <span
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 24,
                  fontWeight: 700,
                  color: "hsl(var(--foreground))",
                }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
            marginBottom: 24,
          }}
        >
          {modules.map((module) => (
            <div key={module.title}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 6,
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: "hsl(var(--muted-foreground))",
                    fontWeight: 600,
                  }}
                >
                  {module.title}
                </span>
                <span
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 12,
                    color: "hsl(var(--foreground))",
                    fontWeight: 700,
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
                    background: `linear-gradient(90deg, ${scores.color}99, ${scores.color})`,
                    transition: "width 0.2s ease",
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
            padding: "12px 18px",
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
            (e.currentTarget as HTMLButtonElement).style.transform =
              "translateY(-1px)";
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
    </aside>
  );
};

const stepperBtn: React.CSSProperties = {
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
