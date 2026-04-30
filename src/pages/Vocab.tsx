import { useState, useMemo, useEffect, useRef, type CSSProperties } from "react";
import { vocabularySets } from "@/data/vocabulary";
import { useThemeMode } from "@/hooks/useThemeMode";
import { useAuth } from "@/contexts/AuthContext";
import { vocabStorageKey } from "@/hooks/useUserProgress";

/* ═══════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════ */

type Pos = "adj" | "verb" | "noun";
type Mode = "flashcards" | "learn" | "match" | "test" | "browse";
type StudyStatus = "new" | "learning" | "mastered";

interface Word {
  id: string;
  w: string;
  pos: Pos;
  def: string;
  ex: string;
  syn: string[];
  ant: string[];
  freq: number;
  mastery: number; // 0-1
  etym: string; // used as fallback label (set name)
  setName: string;
}

interface StoredProgress {
  [wordId: string]: StudyStatus;
}

/* ═══════════════════════════════════════════════
   Constants / tokens
   ═══════════════════════════════════════════════ */

const fg = "hsl(var(--foreground))";
const muted = "hsl(var(--muted-foreground))";
const cardBg = "hsl(var(--card))";
const borderC = "hsl(var(--border))";
const surface = "hsl(var(--muted))";
const primary = "hsl(var(--primary))";
const primary2 = "hsl(var(--primary) / 0.1)";
const okFg = "hsl(122 50% 35%)";
const okBg = "hsl(122 50% 96%)";
const errFg = "hsl(0 70% 50%)";
const errBg = "hsl(0 70% 97%)";


const TAG: Record<Pos, { bg: string; fg: string }> = {
  adj: { bg: "hsl(201 100% 94%)", fg: "hsl(201 100% 32%)" },
  verb: { bg: "hsl(32 100% 92%)", fg: "hsl(24 70% 30%)" },
  noun: { bg: "hsl(122 40% 92%)", fg: "hsl(122 40% 24%)" },
};

/* ═══════════════════════════════════════════════
   Data synthesis
   ═══════════════════════════════════════════════ */

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

const POS_CHOICES: Pos[] = ["adj", "verb", "noun"];

function statusToMastery(s: StudyStatus): number {
  if (s === "mastered") return 1;
  if (s === "learning") return 0.5;
  return 0;
}

function synthesizeWord(
  raw: { word: string; definition: string; setId: string; setName: string },
  status: StudyStatus,
): Word {
  const h = hashStr(raw.word);
  const pos = POS_CHOICES[h % 3];
  const freq = 50 + (h % 46); // 50..95
  return {
    id: `${raw.setId}::${raw.word.toLowerCase()}`,
    w: raw.word,
    pos,
    def: raw.definition,
    ex: "",
    syn: [],
    ant: [],
    freq,
    mastery: statusToMastery(status),
    etym: raw.setName,
    setName: raw.setName,
  };
}

/* ═══════════════════════════════════════════════
   Shared UI bits
   ═══════════════════════════════════════════════ */

function Tag({ pos }: { pos: Pos }) {
  const c = TAG[pos];
  return (
    <span
      style={{
        fontSize: 11,
        padding: "3px 9px",
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        fontWeight: 600,
        letterSpacing: ".02em",
      }}
    >
      {pos}
    </span>
  );
}

function MasteryDots({ v }: { v: number }) {
  const f = Math.round(v * 5);
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: i < f ? primary : "hsl(var(--border))",
          }}
        />
      ))}
    </span>
  );
}

const btnBase: CSSProperties = {
  height: 48,
  borderRadius: 12,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: 500,
  border: `1px solid ${borderC}`,
  transition: "all .15s",
};
const btnIcon: CSSProperties = { ...btnBase, background: cardBg, color: muted, fontSize: 16 };
const btnSecondary: CSSProperties = { ...btnBase, background: cardBg, color: fg };
const btnPrimary: CSSProperties = {
  ...btnBase,
  background: fg,
  color: "hsl(var(--background))",
  borderColor: fg,
  fontWeight: 600,
};

/* ═══════════════════════════════════════════════
   Header
   ═══════════════════════════════════════════════ */

function Header({
  mode,
  setMode,
  setName,
  wordCount,
  setOptions,
  activeSetId,
  onSetChange,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  setName: string;
  wordCount: number;
  setOptions: { id: string; name: string }[];
  activeSetId: string;
  onSetChange: (id: string) => void;
}) {
  const modes: [Mode, string][] = [
    ["flashcards", "Flashcards"],
    ["learn", "Learn"],
    ["match", "Match"],
    ["test", "Test"],
    ["browse", "Browse"],
  ];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 22,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, letterSpacing: "-.015em", color: fg }}>
            Vocabulary
          </h1>
          <p style={{ margin: "4px 0 0", color: muted, fontSize: 14 }}>
            {setName} · {wordCount} words
          </p>
        </div>
        <div ref={ref} style={{ position: "relative" }}>
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              background: cardBg,
              border: `1px solid ${borderC}`,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 13,
              color: fg,
              whiteSpace: "nowrap",
            }}
          >
            Change set
          </button>
          {open && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                background: cardBg,
                border: `1px solid ${borderC}`,
                borderRadius: 10,
                boxShadow: "0 12px 32px -16px rgba(15,23,42,.25)",
                minWidth: 240,
                padding: 4,
                zIndex: 20,
              }}
            >
              {setOptions.map(s => {
                const on = s.id === activeSetId;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      onSetChange(s.id);
                      setOpen(false);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "9px 12px",
                      borderRadius: 7,
                      border: "none",
                      background: on ? surface : "transparent",
                      color: fg,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: 13,
                      fontWeight: on ? 600 : 500,
                    }}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: 4,
          borderRadius: 12,
          background: surface,
          border: `1px solid ${borderC}`,
          width: "fit-content",
          maxWidth: "100%",
          overflowX: "auto",
        }}
      >
        {modes.map(([id, label]) => {
          const on = mode === id;
          return (
            <button
              key={id}
              onClick={() => setMode(id)}
              style={{
                padding: "9px 18px",
                borderRadius: 8,
                border: on ? `1px solid ${borderC}` : "1px solid transparent",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: on ? 600 : 500,
                background: on ? "hsl(var(--background))" : "transparent",
                color: on ? fg : muted,
                boxShadow: on ? "0 1px 2px rgba(0,0,0,.12)" : "none",
                transition: "all .15s",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Flashcards
   ═══════════════════════════════════════════════ */

function Flashcards({
  deck,
  isDark,
  onMark,
}: {
  deck: Word[];
  isDark: boolean;
  onMark: (id: string, status: StudyStatus) => void;
}) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const safeI = deck.length ? i % deck.length : 0;
  const card = deck[safeI];

  const next = () => {
    setFlipped(false);
    setTimeout(() => setI(x => (x + 1) % Math.max(deck.length, 1)), 150);
  };
  const prev = () => {
    setFlipped(false);
    setTimeout(() => setI(x => (x - 1 + deck.length) % Math.max(deck.length, 1)), 150);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === " ") {
        e.preventDefault();
        setFlipped(f => !f);
      } else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deck.length]);

  if (!card) return <div style={{ color: muted, textAlign: "center", padding: 40 }}>No words in this set.</div>;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
          fontSize: 13,
          color: muted,
          gap: 16,
        }}
      >
        <span style={{ whiteSpace: "nowrap" }}>
          {safeI + 1} of {deck.length}
        </span>
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: "hsl(var(--border))", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${((safeI + 1) / deck.length) * 100}%`,
              background: primary,
              transition: "width .3s",
            }}
          />
        </div>
        <span style={{ whiteSpace: "nowrap" }}>Space to flip</span>
      </div>

      <div
        onClick={() => setFlipped(f => !f)}
        style={{ perspective: 2000, cursor: "pointer", height: 420, marginBottom: 18 }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transition: "transform .6s cubic-bezier(.4,0,.2,1)",
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "none",
          }}
        >
          {/* Front */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              background: cardBg,
              borderRadius: 20,
              border: `1px solid ${borderC}`,
              boxShadow: "0 12px 32px -16px rgba(15,23,42,.15)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "32px 40px",
            }}
          >
            <Tag pos={card.pos} />
            <h2
              style={{
                margin: "18px 0 0",
                fontSize: "clamp(48px,7vw,80px)",
                fontWeight: 500,
                letterSpacing: "-.025em",
                color: fg,
                textAlign: "center",
                lineHeight: 1,
              }}
            >
              {card.w}
            </h2>
            <div style={{ marginTop: 14, fontSize: 13, color: muted }}>Tap to reveal</div>
          </div>
          {/* Back */}
          <FlashcardBack card={card} isDark={isDark} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 1fr 48px", gap: 10 }}>
        <button onClick={prev} style={btnIcon} aria-label="Previous">
          ←
        </button>
        <button
          onClick={() => {
            onMark(card.id, "learning");
            next();
          }}
          style={btnSecondary}
        >
          Study again
        </button>
        <button
          onClick={() => {
            onMark(card.id, "mastered");
            next();
          }}
          style={btnPrimary}
        >
          Got it
        </button>
        <button onClick={next} style={btnIcon} aria-label="Next">
          →
        </button>
      </div>
    </div>
  );
}

function FlashcardBack({ card, isDark }: { card: Word; isDark: boolean }) {
  // Dark variant — mockup exact. Light variant — mirror using theme tokens.
  const bg = isDark ? "hsl(217 33% 14%)" : cardBg;
  const textMain = isDark ? "#fff" : fg;
  const headAccent = isDark ? "hsl(201 100% 75%)" : primary;
  const labelAccent = isDark ? "hsl(201 100% 70%)" : primary;
  const divider = isDark ? "#ffffff18" : borderC;
  const softPanel = isDark ? "#ffffff0c" : surface;
  const softPanelBorderAccent = isDark ? "hsl(39 100% 57%)" : "hsl(39 90% 45%)";
  const exTextColor = isDark ? "#ffffffdd" : fg;
  const synColor = isDark ? "hsl(201 100% 70%)" : primary;
  const antColor = isDark ? "hsl(0 80% 72%)" : "hsl(0 70% 45%)";
  const pillBg = isDark ? "#ffffff10" : surface;
  const pillBorder = isDark ? "#ffffff18" : borderC;
  const pillText = isDark ? "#fff" : fg;
  const footBg = isDark ? "#00000025" : "hsl(var(--muted))";
  const footLabel = isDark ? "#ffffff80" : muted;
  const footText = isDark ? "#ffffffcc" : fg;
  const subDivider = isDark ? "#ffffff18" : borderC;
  const gridBg = isDark ? "#ffffff05" : "transparent";
  const posColor = isDark ? "#ffffff88" : muted;

  const exText = card.ex || card.def;
  const etymText = card.etym || card.setName;

  const pillStyle: CSSProperties = {
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 999,
    background: pillBg,
    border: `1px solid ${pillBorder}`,
    color: pillText,
  };

  const renderPills = (items: string[]) => {
    if (!items.length) {
      return (
        <span style={{ ...pillStyle, opacity: 0.55 }}>—</span>
      );
    }
    return items.map(w => (
      <span key={w} style={pillStyle}>
        {w}
      </span>
    ));
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backfaceVisibility: "hidden",
        transform: "rotateY(180deg)",
        background: bg,
        color: textMain,
        borderRadius: 20,
        border: isDark ? "none" : `1px solid ${borderC}`,
        boxShadow: isDark
          ? "0 1px 0 hsl(217 33% 14% / .05), 0 40px 80px -30px hsl(201 100% 30% / .35)"
          : "0 12px 32px -16px rgba(15,23,42,.15)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "22px 30px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: `1px solid ${divider}`,
        }}
      >
        <span
          style={{
            fontFamily: '"Instrument Serif",serif',
            fontStyle: "italic",
            fontSize: 26,
            color: headAccent,
            letterSpacing: "-.02em",
          }}
        >
          {card.w}
        </span>
        <span
          style={{
            fontSize: 11,
            color: posColor,
            textTransform: "uppercase",
            letterSpacing: ".18em",
          }}
        >
          {card.pos}
        </span>
      </div>
      <div style={{ padding: "28px 30px 20px" }}>
        <div
          style={{
            fontSize: 11,
            color: labelAccent,
            textTransform: "uppercase",
            letterSpacing: ".18em",
            marginBottom: 10,
            fontWeight: 600,
          }}
        >
          Definition
        </div>
        <p
          style={{
            fontFamily: '"Source Serif 4",Georgia,serif',
            fontSize: 26,
            lineHeight: 1.3,
            margin: 0,
            fontWeight: 400,
            color: textMain,
          }}
        >
          {card.def}
        </p>
      </div>
      <div style={{ padding: "0 30px 20px" }}>
        <div
          style={{
            padding: "16px 18px",
            borderRadius: 12,
            background: softPanel,
            borderLeft: `3px solid ${softPanelBorderAccent}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: softPanelBorderAccent,
              textTransform: "uppercase",
              letterSpacing: ".18em",
              marginBottom: 6,
              fontWeight: 600,
            }}
          >
            In use
          </div>
          <p
            style={{
              fontFamily: '"Source Serif 4",serif',
              fontStyle: "italic",
              fontSize: 15,
              lineHeight: 1.5,
              margin: 0,
              color: exTextColor,
            }}
          >
            {exText}
          </p>
        </div>
      </div>
      <div
        style={{
          marginTop: "auto",
          padding: "20px 30px",
          borderTop: `1px solid ${subDivider}`,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          background: gridBg,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: synColor,
              textTransform: "uppercase",
              letterSpacing: ".18em",
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            Synonyms
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{renderPills(card.syn)}</div>
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              color: antColor,
              textTransform: "uppercase",
              letterSpacing: ".18em",
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            Antonyms
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{renderPills(card.ant)}</div>
        </div>
      </div>
      <div
        style={{
          padding: "14px 30px",
          background: footBg,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: footLabel,
            textTransform: "uppercase",
            letterSpacing: ".2em",
            fontWeight: 600,
          }}
        >
          Etym
        </span>
        <span
          style={{
            fontSize: 12,
            color: footText,
            fontStyle: "italic",
            fontFamily: '"Source Serif 4",serif',
          }}
        >
          {etymText}
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Learn
   ═══════════════════════════════════════════════ */

function Learn({ deck, onMark }: { deck: Word[]; onMark: (id: string, s: StudyStatus) => void }) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const safeIdx = deck.length ? idx % deck.length : 0;
  const w = deck[safeIdx];

  const { options, correct } = useMemo(() => {
    if (!w) return { options: [] as string[], correct: 0 };
    const others = deck.filter(d => d.id !== w.id);
    // pseudo-random but deterministic per word
    const h = hashStr(w.w);
    const distractors: string[] = [];
    const seen = new Set<string>();
    let k = 0;
    while (distractors.length < 3 && others.length) {
      const pick = others[(h + k * 7) % others.length];
      k++;
      if (k > 1000) break;
      if (!pick || seen.has(pick.id)) continue;
      seen.add(pick.id);
      distractors.push(pick.def);
    }
    const correctIdx = h % 4;
    const opts: string[] = [];
    let di = 0;
    for (let i = 0; i < 4; i++) {
      if (i === correctIdx) opts.push(w.def);
      else opts.push(distractors[di++] ?? "—");
    }
    return { options: opts, correct: correctIdx };
  }, [w, deck]);

  const revealed = picked !== null;

  const advance = () => {
    setPicked(null);
    setIdx(i => (i + 1) % Math.max(deck.length, 1));
  };

  if (!w) return <div style={{ color: muted, textAlign: "center", padding: 40 }}>No words.</div>;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Tag pos={w.pos} />
        <h2 style={{ margin: "10px 0 4px", fontSize: 40, fontWeight: 500, letterSpacing: "-.02em", color: fg }}>
          {w.w}
        </h2>
        <p style={{ margin: 0, fontSize: 15, color: muted }}>Which meaning fits?</p>
      </div>

      <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
        {options.map((opt, i) => {
          const isPicked = picked === i;
          const isCorrect = revealed && i === correct;
          const isWrong = revealed && isPicked && i !== correct;
          let b = borderC;
          let bg = cardBg;
          if (isPicked && !revealed) {
            b = primary;
            bg = primary2;
          }
          if (isCorrect) {
            b = okFg;
            bg = okBg;
          }
          if (isWrong) {
            b = errFg;
            bg = errBg;
          }
          return (
            <button
              key={i}
              onClick={() => {
                if (!revealed) {
                  setPicked(i);
                  onMark(w.id, i === correct ? "mastered" : "learning");
                }
              }}
              style={{
                textAlign: "left",
                padding: "16px 18px",
                borderRadius: 12,
                border: `1.5px solid ${b}`,
                background: bg,
                cursor: revealed ? "default" : "pointer",
                fontFamily: "inherit",
                fontSize: 15,
                color: fg,
                display: "flex",
                alignItems: "center",
                gap: 14,
                transition: "all .15s",
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  border: `1.5px solid ${b}`,
                  background: isCorrect ? okFg : isWrong ? errFg : isPicked ? primary : "transparent",
                  color: isCorrect || isWrong || isPicked ? "#fff" : fg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  fontSize: 12,
                  flexShrink: 0,
                }}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span style={{ flex: 1 }}>{opt}</span>
            </button>
          );
        })}
      </div>

      {revealed && (
        <div style={{ padding: "16px 18px", borderRadius: 12, background: surface, border: `1px solid ${borderC}` }}>
          <div style={{ fontSize: 13, color: muted, marginBottom: 6 }}>Why it sticks</div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: fg }}>
            The key meaning: {w.def}.
          </p>
        </div>
      )}

      <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
        <button onClick={advance} style={{ ...btnPrimary, padding: "0 24px" }}>
          {revealed ? "Next word" : "Skip"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Match — pick-then-drop
   ═══════════════════════════════════════════════ */

function Match({ deck, onMark }: { deck: Word[]; onMark: (id: string, s: StudyStatus) => void }) {
  const pool = useMemo(() => deck.slice(0, Math.min(6, deck.length)), [deck]);
  const [defOrder, setDefOrder] = useState<number[]>([]);
  const [links, setLinks] = useState<Record<number, number>>({});
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    // shuffle def order deterministically on pool change
    const order = pool.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    setDefOrder(order);
    setLinks({});
    setSelected(null);
  }, [pool]);

  const pick = (wi: number) => {
    if (links[wi] !== undefined) return;
    setSelected(wi);
  };
  const drop = (slot: number) => {
    if (selected === null) return;
    if (Object.values(links).includes(slot)) return;
    const wi = selected;
    const correct = wi === defOrder[slot];
    setLinks(prev => ({ ...prev, [wi]: slot }));
    setSelected(null);
    const target = pool[wi];
    if (target) onMark(target.id, correct ? "mastered" : "learning");
  };
  const matched = (wi: number, slot: number) => wi === defOrder[slot];
  const resolved = Object.keys(links).length;

  if (!pool.length) return <div style={{ color: muted, textAlign: "center", padding: 40 }}>No words.</div>;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          fontSize: 14,
          color: muted,
          gap: 16,
        }}
      >
        <span>Pair each word with its meaning</span>
        <span style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
          {resolved} / {pool.length}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ display: "grid", gap: 10 }}>
          {pool.map((w, i) => {
            const linked = links[i] !== undefined;
            const isSel = selected === i;
            const correct = linked && matched(i, links[i]);
            const b = correct ? okFg : linked ? errFg : isSel ? primary : borderC;
            const bg = correct ? okBg : linked ? errBg : isSel ? primary2 : cardBg;
            return (
              <button
                key={i}
                onClick={() => pick(i)}
                disabled={linked}
                style={{
                  padding: "16px 18px",
                  borderRadius: 12,
                  cursor: linked ? "default" : "pointer",
                  textAlign: "left",
                  border: `1.5px solid ${b}`,
                  background: bg,
                  opacity: linked ? 0.9 : 1,
                  transition: "all .15s",
                  fontFamily: "inherit",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  color: fg,
                }}
              >
                <span style={{ fontSize: 18, fontWeight: 500 }}>{w.w}</span>
                {linked && (
                  <span style={{ fontSize: 16, color: correct ? okFg : errFg }}>{correct ? "✓" : "✕"}</span>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {defOrder.map((realIdx, slot) => {
            const defText = pool[realIdx]?.def ?? "";
            const linkedFrom = Object.entries(links).find(([, v]) => v === slot);
            const filled = linkedFrom !== undefined;
            const correct = filled && matched(Number(linkedFrom![0]), slot);
            const b = correct ? okFg : filled ? errFg : selected !== null ? primary : borderC;
            const bg = correct ? okBg : filled ? errBg : cardBg;
            return (
              <button
                key={slot}
                onClick={() => drop(slot)}
                disabled={filled}
                style={{
                  padding: "16px 18px",
                  borderRadius: 12,
                  cursor: filled ? "default" : "pointer",
                  textAlign: "left",
                  border: `1.5px solid ${b}`,
                  background: bg,
                  transition: "all .15s",
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: fg,
                  fontFamily: "inherit",
                }}
              >
                {defText}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Test
   ═══════════════════════════════════════════════ */

const TEST_QUESTION_COUNT = 12;
const TEST_PER_Q_SECONDS = 45;

function Test({ deck, onMark }: { deck: Word[]; onMark: (id: string, s: StudyStatus) => void }) {
  const questions = useMemo(() => {
    const pool = [...deck];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, Math.min(TEST_QUESTION_COUNT, pool.length));
  }, [deck]);

  const [qIdx, setQIdx] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [answered, setAnswered] = useState<boolean[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TEST_PER_Q_SECONDS);
  const [done, setDone] = useState(false);

  const q = questions[qIdx];

  const options = useMemo(() => {
    if (!q) return { words: [] as string[], correct: 0 };
    const others = deck.filter(d => d.id !== q.id);
    const h = hashStr(q.w + "opts");
    const seen = new Set<string>();
    const distractors: string[] = [];
    let k = 0;
    while (distractors.length < 3 && others.length) {
      const pick = others[(h + k * 11) % others.length];
      k++;
      if (k > 1000) break;
      if (!pick || seen.has(pick.id)) continue;
      seen.add(pick.id);
      distractors.push(pick.w);
    }
    const correctIdx = h % 4;
    const words: string[] = [];
    let di = 0;
    for (let i = 0; i < 4; i++) {
      if (i === correctIdx) words.push(q.w);
      else words.push(distractors[di++] ?? "—");
    }
    return { words, correct: correctIdx };
  }, [q, deck]);

  // Reset timer when question changes
  useEffect(() => {
    setTimeLeft(TEST_PER_Q_SECONDS);
    setSel(null);
  }, [qIdx]);

  // Tick
  useEffect(() => {
    if (done) return;
    if (timeLeft <= 0) {
      // auto-advance as skip
      goNext(false);
      return;
    }
    const t = window.setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [timeLeft, done]);

  const goNext = (wasCorrect: boolean) => {
    if (q) onMark(q.id, wasCorrect ? "mastered" : "learning");
    setAnswered(prev => {
      const next = [...prev];
      next[qIdx] = true;
      return next;
    });
    if (wasCorrect) setCorrectCount(c => c + 1);
    if (qIdx + 1 >= questions.length) {
      setDone(true);
    } else {
      setQIdx(i => i + 1);
    }
  };

  const restart = () => {
    setQIdx(0);
    setSel(null);
    setAnswered([]);
    setCorrectCount(0);
    setTimeLeft(TEST_PER_Q_SECONDS);
    setDone(false);
  };

  if (!deck.length) return <div style={{ color: muted, textAlign: "center", padding: 40 }}>No words.</div>;

  if (done) {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
        <div
          style={{
            padding: "32px 28px",
            borderRadius: 16,
            background: cardBg,
            border: `1px solid ${borderC}`,
            boxShadow: "0 12px 32px -18px rgba(15,23,42,.12)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: fg }}>Session complete</h2>
          <p style={{ margin: "10px 0 22px", color: muted, fontSize: 15 }}>
            {correctCount} / {questions.length} correct
          </p>
          <button onClick={restart} style={{ ...btnPrimary, padding: "0 24px" }}>
            Study again
          </button>
        </div>
      </div>
    );
  }

  if (!q) return null;

  const timeLow = timeLeft < 10;
  const mm = Math.floor(timeLeft / 60);
  const ss = timeLeft % 60;
  const timeStr = `${mm}:${ss.toString().padStart(2, "0")}`;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          fontSize: 14,
          color: muted,
        }}
      >
        <span>
          Question {qIdx + 1} of {questions.length}
        </span>
        <span style={{ color: timeLow ? errFg : muted, fontWeight: 500 }}>{timeStr} left</span>
      </div>

      <div
        style={{
          padding: "28px 32px",
          borderRadius: 16,
          background: cardBg,
          border: `1px solid ${borderC}`,
          boxShadow: "0 12px 32px -18px rgba(15,23,42,.12)",
        }}
      >
        <p
          style={{
            fontFamily: '"Source Serif 4",serif',
            fontSize: 20,
            lineHeight: 1.55,
            margin: "0 0 24px",
            color: fg,
          }}
        >
          Which word means "{q.def}"? The answer is{" "}
          <span
            style={{
              borderBottom: `2px solid ${primary}`,
              padding: "0 8px",
              color: sel !== null ? fg : "transparent",
              fontWeight: 500,
            }}
          >
            {sel !== null ? options.words[sel] : "_____"}
          </span>
          .
        </p>

        <div style={{ display: "grid", gap: 10 }}>
          {options.words.map((wd, i) => {
            const on = sel === i;
            return (
              <button
                key={i}
                onClick={() => setSel(i)}
                style={{
                  padding: "14px 16px",
                  borderRadius: 10,
                  cursor: "pointer",
                  textAlign: "left",
                  border: `1.5px solid ${on ? primary : borderC}`,
                  background: on ? primary2 : cardBg,
                  color: fg,
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  transition: "all .15s",
                }}
              >
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    background: on ? primary : "transparent",
                    border: `1.5px solid ${on ? primary : muted}`,
                    color: on ? "#fff" : fg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 600,
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span style={{ fontSize: 16 }}>{wd}</span>
              </button>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 3 }}>
            {Array.from({ length: questions.length }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 18,
                  height: 4,
                  borderRadius: 2,
                  background:
                    i < qIdx
                      ? primary
                      : i === qIdx
                      ? "hsl(var(--primary) / 0.5)"
                      : "hsl(var(--border))",
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => goNext(false)} style={{ ...btnSecondary, padding: "0 18px", height: 42 }}>
              Skip
            </button>
            <button
              disabled={sel === null}
              onClick={() => goNext(sel === options.correct)}
              style={{
                ...btnPrimary,
                padding: "0 22px",
                height: 42,
                opacity: sel === null ? 0.5 : 1,
                cursor: sel === null ? "not-allowed" : "pointer",
              }}
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Browse
   ═══════════════════════════════════════════════ */

function Browse({ deck }: { deck: Word[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "new" | "learning" | "mastered">("all");

  const filtered = useMemo(() => {
    return deck.filter(w => {
      if (q && !w.w.toLowerCase().includes(q.toLowerCase()) && !w.def.toLowerCase().includes(q.toLowerCase()))
        return false;
      if (filter === "mastered") return w.mastery >= 0.8;
      if (filter === "learning") return w.mastery > 0 && w.mastery < 0.8;
      if (filter === "new") return w.mastery === 0;
      return true;
    });
  }, [q, filter, deck]);

  const filters: [typeof filter, string, number][] = [
    ["all", "All", deck.length],
    ["new", "New", deck.filter(w => w.mastery === 0).length],
    ["learning", "Learning", deck.filter(w => w.mastery > 0 && w.mastery < 0.8).length],
    ["mastered", "Mastered", deck.filter(w => w.mastery >= 0.8).length],
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search words or definitions"
          style={{
            flex: "1 1 280px",
            height: 44,
            borderRadius: 10,
            border: `1px solid ${borderC}`,
            padding: "0 16px",
            fontSize: 14,
            fontFamily: "inherit",
            background: cardBg,
            color: fg,
          }}
        />
        <div
          style={{
            display: "flex",
            gap: 2,
            padding: 3,
            borderRadius: 10,
            background: surface,
            border: `1px solid ${borderC}`,
            flexWrap: "wrap",
          }}
        >
          {filters.map(([id, label, count]) => {
            const on = filter === id;
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 7,
                  border: on ? `1px solid ${borderC}` : "1px solid transparent",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: on ? 600 : 500,
                  background: on ? "hsl(var(--background))" : "transparent",
                  color: on ? fg : muted,
                  boxShadow: on ? "0 1px 2px rgba(0,0,0,.1)" : "none",
                  display: "inline-flex",
                  gap: 6,
                  alignItems: "center",
                  transition: "all .15s",
                }}
              >
                {label}
                <span
                  style={{
                    fontSize: 11,
                    padding: "1px 6px",
                    borderRadius: 999,
                    background: on ? "hsl(var(--primary) / 0.15)" : "hsl(var(--border))",
                    color: on ? "hsl(var(--primary))" : muted,
                    fontWeight: 600,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ borderRadius: 12, border: `1px solid ${borderC}`, background: cardBg, overflow: "hidden" }}>
        {filtered.map((w, i) => (
          <div
            key={w.id}
            className="vocab-row"
            style={{
              display: "grid",
              gridTemplateColumns: "200px 70px 1fr 120px 90px",
              gap: 20,
              padding: "16px 20px",
              alignItems: "center",
              borderBottom: i < filtered.length - 1 ? `1px solid ${borderC}` : "none",
              transition: "background .15s",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 500, color: fg, letterSpacing: "-.01em" }}>{w.w}</div>
            <Tag pos={w.pos} />
            <div style={{ fontSize: 14, color: fg, opacity: 0.8, lineHeight: 1.4 }}>{w.def}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: "hsl(var(--border))", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${w.freq}%`, background: primary }} />
              </div>
              <span style={{ fontSize: 12, color: muted, minWidth: 28, textAlign: "right", fontWeight: 500 }}>
                {w.freq}%
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <MasteryDots v={w.mastery} />
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: muted, fontSize: 14 }}>No words match.</div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Main
   ═══════════════════════════════════════════════ */

const Vocab = () => {
  const isDark = useThemeMode();
  const { user } = useAuth();
  const uid = user?.id ?? null;

  const [mode, setMode] = useState<Mode>("flashcards");
  const [activeSetId, setActiveSetId] = useState<string>(vocabularySets[0]?.id ?? "");
  const [progress, setProgress] = useState<StoredProgress>({});

  // Load persisted progress whenever the active user changes (login/logout/switch).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(vocabStorageKey(uid));
      if (!raw) {
        setProgress({});
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        // Accept either the new flat {id: status} shape or the legacy {id: {status,...}} shape
        const next: StoredProgress = {};
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof v === "string" && (v === "new" || v === "learning" || v === "mastered")) {
            next[k] = v;
          } else if (v && typeof v === "object" && "status" in (v as object)) {
            const s = (v as { status?: unknown }).status;
            if (s === "new" || s === "learning" || s === "mastered") next[k] = s;
          }
        }
        setProgress(next);
      } else {
        setProgress({});
      }
    } catch {
      setProgress({});
    }
  }, [uid]);

  // Persist
  useEffect(() => {
    try {
      window.localStorage.setItem(vocabStorageKey(uid), JSON.stringify(progress));
    } catch {
      // ignore
    }
  }, [progress, uid]);

  const markWord = (id: string, status: StudyStatus) => {
    setProgress(prev => {
      if (prev[id] === status) return prev;
      return { ...prev, [id]: status };
    });
  };

  const activeSet = vocabularySets.find(s => s.id === activeSetId) ?? vocabularySets[0];

  const deck: Word[] = useMemo(() => {
    if (!activeSet) return [];
    return activeSet.words.map(w =>
      synthesizeWord(
        { word: w.word, definition: w.definition, setId: activeSet.id, setName: activeSet.name },
        progress[`${activeSet.id}::${w.word.toLowerCase()}`] ?? "new",
      ),
    );
  }, [activeSet, progress]);

  const setOptions = vocabularySets.map(s => ({ id: s.id, name: s.name }));

  let content: React.ReactNode = null;
  if (mode === "flashcards") content = <Flashcards deck={deck} isDark={isDark} onMark={markWord} />;
  else if (mode === "learn") content = <Learn deck={deck} onMark={markWord} />;
  else if (mode === "match") content = <Match deck={deck} onMark={markWord} />;
  else if (mode === "test") content = <Test deck={deck} onMark={markWord} />;
  else if (mode === "browse") content = <Browse deck={deck} />;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 40px 80px" }}>
      <style>{`.vocab-row:hover { background: hsl(var(--muted)); }`}</style>
      <Header
        mode={mode}
        setMode={setMode}
        setName={activeSet?.name ?? ""}
        wordCount={deck.length}
        setOptions={setOptions}
        activeSetId={activeSet?.id ?? ""}
        onSetChange={setActiveSetId}
      />
      {content}
    </div>
  );
};

export default Vocab;
