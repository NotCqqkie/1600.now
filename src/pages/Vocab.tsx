import { useState, useMemo, useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import { vocabularySets } from "@/data/vocabulary";
import { useThemeMode } from "@/hooks/useThemeMode";
import { useAuth } from "@/contexts/AuthContext";
import { vocabStorageKey } from "@/hooks/useUserProgress";
import { db } from "@/lib/firebase/firebaseDb";
import { doc, setDoc } from "firebase/firestore";

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


const TAG_LIGHT: Record<Pos, { bg: string; fg: string }> = {
  adj: { bg: "hsl(201 100% 94%)", fg: "hsl(201 100% 32%)" },
  verb: { bg: "hsl(32 100% 92%)", fg: "hsl(24 70% 30%)" },
  noun: { bg: "hsl(122 40% 92%)", fg: "hsl(122 40% 24%)" },
};
const TAG_DARK: Record<Pos, { bg: string; fg: string }> = {
  adj: { bg: "hsl(201 70% 18%)", fg: "hsl(201 100% 72%)" },
  verb: { bg: "hsl(32 60% 18%)", fg: "hsl(32 100% 70%)" },
  noun: { bg: "hsl(122 35% 16%)", fg: "hsl(122 55% 65%)" },
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

function statusToMastery(s: StudyStatus): number {
  if (s === "mastered") return 1;
  if (s === "learning") return 0.5;
  return 0;
}

function synthesizeWord(
  raw: {
    word: string;
    definition: string;
    pos: Pos;
    synonyms: string[];
    antonyms: string[];
    inUse: string;
    difficulty: number;
    setId: string;
    setName: string;
  },
  status: StudyStatus,
): Word {
  return {
    id: `${raw.setId}::${raw.word.toLowerCase()}`,
    w: raw.word,
    pos: raw.pos,
    def: raw.definition,
    ex: raw.inUse,
    syn: raw.synonyms,
    ant: raw.antonyms,
    freq: Math.round((11 - raw.difficulty) * 10),
    mastery: statusToMastery(status),
    etym: raw.setName,
    setName: raw.setName,
  };
}

/* ═══════════════════════════════════════════════
   Shared UI bits
   ═══════════════════════════════════════════════ */

function Tag({ pos, isDark }: { pos: Pos; isDark: boolean }) {
  const c = (isDark ? TAG_DARK : TAG_LIGHT)[pos];
  return (
    // Part-of-speech pill — Inter 600, 11px, padding 4×12, radius 999, ALWAYS lowercase.
    <span
      style={{
        display: "inline-block",
        width: "fit-content",
        fontFamily: "'Inter', sans-serif",
        fontSize: 11,
        padding: "4px 12px",
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: "nowrap",
        textTransform: "lowercase",
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

// Flashcard footer buttons — Inter 600, 15px, padding 14×24.
const btnBase: CSSProperties = {
  height: 48,
  borderRadius: 10,
  cursor: "pointer",
  fontFamily: "'Inter', sans-serif",
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: "-0.005em",
  border: `1px solid rgba(14,33,56,0.10)`,
  transition: "all .15s",
};
// Prev/next icon buttons — 44×44, ink-mid glyph on white.
const btnIcon: CSSProperties = {
  ...btnBase,
  background: cardBg,
  color: "rgb(var(--ink-mid))",
  fontSize: 16,
  height: 44,
  width: 44,
};
// "Study again" — secondary, ink on white.
const btnSecondary: CSSProperties = {
  ...btnBase,
  background: cardBg,
  color: "rgb(var(--ink))",
};
// "Got it" — dark solid, white on ink. The only place in the app with this combo.
// Hardcoded so it stays dark in both light and dark mode (signals commitment).
const btnPrimary: CSSProperties = {
  ...btnBase,
  background: "#0E2138",
  color: "#fff",
  borderColor: "#0E2138",
};

/* ═══════════════════════════════════════════════
   Set picker (tier × number grid)
   ═══════════════════════════════════════════════ */

const TIER_ORDER = ["Foundational", "Intermediate", "Advanced", "Expert"] as const;
type SetPickerStatus = "nothing" | "in-progress" | "done";
const SET_STATUS_META: Record<SetPickerStatus, { label: string; color: string }> = {
  nothing: { label: "No progress", color: "hsl(215 16% 65%)" },
  "in-progress": { label: "In progress", color: "hsl(38 92% 50%)" },
  done: { label: "Done", color: "hsl(145 63% 39%)" },
};

function SetPicker({
  setOptions,
  activeSetId,
  setStatuses,
  onPick,
}: {
  setOptions: { id: string; name: string }[];
  activeSetId: string;
  setStatuses: Record<string, SetPickerStatus>;
  onPick: (id: string) => void;
}) {
  const groups = new Map<string, { id: string; num: string; raw: string }[]>();
  const ungrouped: { id: string; name: string }[] = [];
  for (const s of setOptions) {
    const m = s.name.match(/^(.+?)\s+(\S+)$/);
    if (m && (TIER_ORDER as readonly string[]).includes(m[1])) {
      const arr = groups.get(m[1]) ?? [];
      arr.push({ id: s.id, num: m[2], raw: s.name });
      groups.set(m[1], arr);
    } else {
      ungrouped.push(s);
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        right: 0,
        background: cardBg,
        border: `1px solid ${borderC}`,
        borderRadius: 12,
        boxShadow: "0 12px 32px -16px rgba(15,23,42,.25)",
        padding: 12,
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        width: "max-content",
      }}
    >
      <div style={{ display: "flex", gap: 10, padding: "0 2px 2px", borderBottom: `1px solid ${borderC}`, paddingBottom: 10 }}>
        {(Object.keys(SET_STATUS_META) as SetPickerStatus[]).map(status => (
          <div key={status} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: muted, whiteSpace: "nowrap" }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: SET_STATUS_META[status].color,
                boxShadow: `0 0 0 1px ${borderC}`,
                flexShrink: 0,
              }}
            />
            {SET_STATUS_META[status].label}
          </div>
        ))}
      </div>
      {TIER_ORDER.filter(t => groups.has(t)).map(tier => {
        const items = groups.get(tier)!;
        return (
          <div key={tier} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: ".04em",
                textTransform: "uppercase",
                color: muted,
                width: 92,
                flexShrink: 0,
              }}
            >
              {tier}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {items.map(it => {
                const on = it.id === activeSetId;
                const status = setStatuses[it.id] ?? "nothing";
                const statusColor = SET_STATUS_META[status].color;
                return (
                  <button
                    key={it.id}
                    onClick={() => onPick(it.id)}
                    title={`${it.raw} · ${SET_STATUS_META[status].label}`}
                    style={{
                      position: "relative",
                      width: 30,
                      height: 30,
                      borderRadius: 7,
                      border: `1px solid ${on ? fg : borderC}`,
                      background: on ? fg : "transparent",
                      color: on ? "hsl(var(--background))" : fg,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: 13,
                      fontWeight: on ? 600 : 500,
                      padding: 0,
                      transition: "all .15s",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 3,
                        right: 3,
                        width: 7,
                        height: 7,
                        borderRadius: 999,
                        background: statusColor,
                        boxShadow: `0 0 0 1px ${on ? "hsl(var(--background))" : cardBg}`,
                      }}
                    />
                    {it.num}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {ungrouped.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 6, borderTop: `1px solid ${borderC}` }}>
          {ungrouped.map(s => {
            const on = s.id === activeSetId;
            const status = setStatuses[s.id] ?? "nothing";
            return (
              <button
                key={s.id}
                onClick={() => onPick(s.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: on ? surface : "transparent",
                  color: fg,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: on ? 600 : 500,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: SET_STATUS_META[status].color,
                    boxShadow: `0 0 0 1px ${borderC}`,
                    flexShrink: 0,
                  }}
                />
                {s.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Header
   ═══════════════════════════════════════════════ */

function ModeTabs({
  modes,
  mode,
  setMode,
  surface,
  borderC,
}: {
  modes: [Mode, string][];
  mode: Mode;
  setMode: (m: Mode) => void;
  surface: string;
  borderC: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Map<Mode, HTMLButtonElement>>(new Map());
  const [slider, setSlider] = useState({ left: 0, width: 0 });
  const [ready, setReady] = useState(false);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const c = containerRef.current;
    const b = btnRefs.current.get(mode);
    if (!c || !b) return;
    const cr = c.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    setSlider({ left: br.left - cr.left, width: br.width });
    setReady(true);
  }, [mode]);

  useEffect(() => {
    if (!ready || animate) return;
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [ready, animate]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
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
      <div
        style={{
          position: "absolute",
          top: 4,
          bottom: 4,
          left: slider.left,
          width: slider.width,
          borderRadius: 8,
          background: cardBg,
          border: `1px solid rgba(14,33,56,0.08)`,
          boxShadow: "0 1px 2px rgba(14,33,56,0.06)",
          transition: animate ? "left .25s ease-out, width .25s ease-out" : "none",
          visibility: ready ? "visible" : "hidden",
          pointerEvents: "none",
        }}
      />
      {modes.map(([id, label]) => {
        const on = mode === id;
        return (
          <button
            key={id}
            ref={(el) => { if (el) btnRefs.current.set(id, el); }}
            onClick={() => setMode(id)}
            style={{
              position: "relative",
              zIndex: 1,
              padding: "10px 18px",
              borderRadius: 8,
              border: "1px solid transparent",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
              fontWeight: on ? 600 : 500,
              color: on ? "rgb(var(--ink))" : "rgb(var(--ink-mid))",
              transition: "color .15s, font-weight .15s",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Header({
  mode,
  setMode,
  setName,
  wordCount,
  setOptions,
  activeSetId,
  setStatuses,
  onSetChange,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  setName: string;
  wordCount: number;
  setOptions: { id: string; name: string }[];
  activeSetId: string;
  setStatuses: Record<string, SetPickerStatus>;
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
          {/* Page title — Inter Tight 600, 42px, tracking -3%. */}
          <h1 style={{
            margin: 0,
            fontFamily: "'Inter Tight', sans-serif",
            fontSize: "clamp(32px, 3.8vw, 42px)",
            fontWeight: 600,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            color: "rgb(var(--ink))",
          }}>
            Vocabulary
          </h1>
          {/* Subtitle — Inter 400, 14px, leading 1.5, ink-mid. Number uses tabular nums + weight 500. */}
          <p style={{
            margin: "8px 0 0",
            fontFamily: "'Inter', sans-serif",
            color: "rgb(var(--ink-mid))",
            fontSize: 14,
            lineHeight: 1.5,
          }}>
            {setName} ·{" "}
            <span style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
              {wordCount}
            </span>
            {" "}words
          </p>
        </div>
        <div ref={ref} style={{ position: "relative" }}>
          {/* Change set — secondary button: Inter 600, 14px, ink on white. */}
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              background: cardBg,
              border: `1px solid rgba(14,33,56,0.10)`,
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "-0.005em",
              color: "rgb(var(--ink))",
              whiteSpace: "nowrap",
            }}
          >
            Change set
          </button>
          {open && (
            <SetPicker
              setOptions={setOptions}
              activeSetId={activeSetId}
              setStatuses={setStatuses}
              onPick={id => {
                onSetChange(id);
                setOpen(false);
              }}
            />
          )}
        </div>
      </div>
      <ModeTabs modes={modes} mode={mode} setMode={setMode} surface={surface} borderC={borderC} />
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
  onResetSet,
  setName,
}: {
  deck: Word[];
  isDark: boolean;
  onMark: (id: string, status: StudyStatus) => void;
  onResetSet: () => void;
  setName: string;
}) {
  // Session-only state. Queue holds IDs of cards still to be answered this round.
  // mastered/learning are sets tracking what the user did this round, used for the summary
  // and for "continue with still-learning" restart.
  const [queue, setQueue] = useState<string[]>([]);
  const [masteredThisRound, setMasteredThisRound] = useState<Set<string>>(new Set());
  const [learningThisRound, setLearningThisRound] = useState<Set<string>>(new Set());
  const [flipped, setFlipped] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const byId = useMemo(() => {
    const m = new Map<string, Word>();
    for (const w of deck) m.set(w.id, w);
    return m;
  }, [deck]);

  // Hold the latest deck in a ref so we can read mastery during init without
  // adding `deck` to the effect deps (which would reset the round on every mark).
  const deckRef = useRef(deck);
  deckRef.current = deck;

  // Reset round only when the active SET changes. Word IDs are stable while
  // mastery values update, so a join of IDs gives us a deck-identity dep.
  const deckIds = deck.map(w => w.id).join("|");

  useEffect(() => {
    const d = deckRef.current;
    const unmastered = d.filter(w => w.mastery < 0.8).map(w => w.id);
    setQueue(unmastered.length > 0 ? unmastered : d.map(w => w.id));
    setMasteredThisRound(new Set());
    setLearningThisRound(new Set());
    setFlipped(false);
    setConfirmReset(false);
  }, [deckIds]);

  const cardId = queue[0];
  const card = cardId ? byId.get(cardId) : undefined;
  const done = !card && deck.length > 0;

  const animate = (after: () => void) => {
    if (flipped) {
      setFlipped(false);
      setTimeout(after, 150);
    } else {
      after();
    }
  };

  const markGotIt = () => {
    if (!card) return;
    const id = card.id;
    onMark(id, "mastered");
    setMasteredThisRound(s => {
      const n = new Set(s);
      n.add(id);
      return n;
    });
    animate(() => setQueue(q => q.slice(1)));
  };

  const markStudyAgain = () => {
    if (!card) return;
    const id = card.id;
    onMark(id, "learning");
    setLearningThisRound(s => {
      const n = new Set(s);
      n.add(id);
      return n;
    });
    animate(() =>
      setQueue(q => {
        if (q.length <= 1) return q;
        const [first, ...rest] = q;
        return [...rest, first];
      }),
    );
  };

  const skipNext = () => animate(() =>
    setQueue(q => {
      if (q.length <= 1) return q;
      const [first, ...rest] = q;
      return [...rest, first];
    }),
  );
  const skipPrev = () => animate(() =>
    setQueue(q => {
      if (q.length <= 1) return q;
      const last = q[q.length - 1];
      return [last, ...q.slice(0, -1)];
    }),
  );

  const restartFull = () => {
    setQueue(deckRef.current.map(w => w.id));
    setMasteredThisRound(new Set());
    setLearningThisRound(new Set());
    setFlipped(false);
  };

  const restartLearning = () => {
    const ids = Array.from(learningThisRound).filter(id => !masteredThisRound.has(id));
    if (ids.length === 0) return;
    setQueue(ids);
    setMasteredThisRound(new Set());
    setLearningThisRound(new Set());
    setFlipped(false);
  };

  const resetAndStart = () => {
    onResetSet();
    setQueue(deckRef.current.map(w => w.id));
    setMasteredThisRound(new Set());
    setLearningThisRound(new Set());
    setFlipped(false);
    setConfirmReset(false);
  };

  // Keyboard shortcuts: Space flips, ←/→ navigate, 1 = study again, 2 = got it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (!card) return;
      if (e.key === " ") {
        e.preventDefault();
        setFlipped(f => !f);
      } else if (e.key === "ArrowRight") skipNext();
      else if (e.key === "ArrowLeft") skipPrev();
      else if (e.key === "1") markStudyAgain();
      else if (e.key === "2") markGotIt();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id, queue.length, flipped]);

  if (deck.length === 0) {
    return <div style={{ color: muted, textAlign: "center", padding: 40 }}>No words in this set.</div>;
  }

  if (done) {
    const masteredCount = masteredThisRound.size;
    const stillLearningCount = Array.from(learningThisRound).filter(id => !masteredThisRound.has(id)).length;
    const allMastered = deck.every(w => w.mastery >= 0.8);

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
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: fg }}>Round complete</h2>
          <p style={{ margin: "10px 0 6px", color: muted, fontSize: 15 }}>
            {masteredCount > 0 && <>{masteredCount} mastered</>}
            {masteredCount > 0 && stillLearningCount > 0 && " · "}
            {stillLearningCount > 0 && <>{stillLearningCount} still learning</>}
            {masteredCount === 0 && stillLearningCount === 0 && "No cards reviewed."}
          </p>
          {allMastered && (
            <p style={{ color: okFg, margin: "10px 0 22px", fontSize: 13, fontWeight: 500 }}>
              You've mastered every word in {setName}.
            </p>
          )}
          {!allMastered && <div style={{ height: 16 }} />}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {stillLearningCount > 0 && (
              <button onClick={restartLearning} style={{ ...btnPrimary, padding: "0 24px" }}>
                Continue with still-learning ({stillLearningCount})
              </button>
            )}
            <button onClick={restartFull} style={{ ...btnSecondary, padding: "0 24px" }}>
              Restart full set ({deck.length})
            </button>
            {!confirmReset ? (
              <button
                onClick={() => setConfirmReset(true)}
                style={{
                  ...btnSecondary,
                  padding: "0 24px",
                  color: muted,
                }}
              >
                Reset progress for this set
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setConfirmReset(false)}
                  style={{ ...btnSecondary, padding: "0 18px", flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  onClick={resetAndStart}
                  style={{
                    ...btnPrimary,
                    padding: "0 18px",
                    flex: 1,
                    background: errFg,
                    borderColor: errFg,
                  }}
                >
                  Confirm reset
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!card) return null;

  const totalForBar = deck.length;
  const masteredAllTime = deck.filter(w => w.mastery >= 0.8).length;
  const remaining = queue.length;
  const masteredPct = (masteredAllTime / Math.max(totalForBar, 1)) * 100;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* Progress strip — numbers in Inter Tight 600 + tabular nums, labels in Inter 400. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
          fontFamily: "'Inter', sans-serif",
          fontSize: 13,
          color: "rgb(var(--ink-mid))",
          gap: 16,
        }}
      >
        <span style={{ whiteSpace: "nowrap" }}>
          <span style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "rgb(var(--ink))" }}>{remaining}</span> left
          {" · "}
          <span style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "rgb(var(--ink))" }}>{masteredThisRound.size}</span> this round
        </span>
        <div
          style={{ flex: 1, height: 3, borderRadius: 2, background: "hsl(var(--border))", overflow: "hidden" }}
          title={`${masteredAllTime} of ${totalForBar} mastered overall`}
        >
          <div
            style={{
              height: "100%",
              width: `${masteredPct}%`,
              background: primary,
              transition: "width .3s",
            }}
          />
        </div>
        {/* Restart link — Inter 500, 13px, ink-mid. Hover flips to ink. No underline. */}
        <button
          onClick={restartFull}
          title="Restart this round"
          style={{
            background: "transparent",
            border: "none",
            color: "rgb(var(--ink-mid))",
            cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            fontWeight: 500,
            padding: "2px 6px",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgb(var(--ink))")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgb(var(--ink-mid))")}
        >
          ↺ Restart
        </button>
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
            <Tag pos={card.pos} isDark={isDark} />
            {/* The word — Inter Tight 500, lowercase, tracking -3.5%. Cap kept
                low enough that the longest SAT vocab words (17 chars, e.g.
                "counterproductive") still fit the flashcard inner width;
                overflowWrap is the safety net for anything longer. */}
            <h2
              style={{
                margin: "18px 0 0",
                fontFamily: "'Inter Tight', sans-serif",
                fontSize: "clamp(40px, 6vw, 76px)",
                fontWeight: 500,
                letterSpacing: "-0.035em",
                color: "rgb(var(--ink))",
                textAlign: "center",
                lineHeight: 1.05,
                textTransform: "lowercase",
                maxWidth: "100%",
                overflowWrap: "anywhere",
              }}
            >
              {card.w}
            </h2>
            {/* Helper — Inter 500, 14px, accent-deep (only place in the flashcard where accent-deep is text). */}
            <div style={{
              marginTop: 32,
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
              fontWeight: 500,
              lineHeight: 1.4,
              color: "rgb(var(--ds-accent-deep))",
            }}>
              Tap to reveal
            </div>
          </div>
          <FlashcardBack card={card} isDark={isDark} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 1fr 48px", gap: 10 }}>
        <button onClick={skipPrev} style={btnIcon} aria-label="Previous" title="Previous (←)">
          ←
        </button>
        <button onClick={markStudyAgain} style={btnSecondary} title="Study again (1)">
          Study again
        </button>
        <button onClick={markGotIt} style={btnPrimary} title="Got it (2)">
          Got it
        </button>
        <button onClick={skipNext} style={btnIcon} aria-label="Next" title="Next (→)">
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
            fontFamily: '"Geist",serif',
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

const LEARN_ROUND_SIZE = 10;

function buildLearnRound(deck: Word[]): string[] {
  // Prefer unmastered words; if none, use the full deck. Within each pool we shuffle.
  const unmastered = deck.filter(w => w.mastery < 0.8);
  const fallback = unmastered.length ? unmastered : deck;
  const ids = fallback.map(w => w.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, Math.min(LEARN_ROUND_SIZE, ids.length));
}

function Learn({
  deck,
  isDark,
  onMark,
  onResetSet,
}: {
  deck: Word[];
  isDark: boolean;
  onMark: (id: string, s: StudyStatus) => void;
  onResetSet: () => void;
}) {
  const okFgL = isDark ? "hsl(122 60% 65%)" : okFg;
  const okBgL = isDark ? "hsl(122 40% 15%)" : okBg;
  const errFgL = isDark ? "hsl(0 70% 68%)" : errFg;
  const errBgL = isDark ? "hsl(0 50% 17%)" : errBg;

  const [round, setRound] = useState<string[]>([]);
  const [pos, setPos] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctIds, setCorrectIds] = useState<Set<string>>(new Set());
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const [confirmReset, setConfirmReset] = useState(false);

  const deckRef = useRef(deck);
  deckRef.current = deck;
  const byId = useMemo(() => {
    const m = new Map<string, Word>();
    for (const w of deck) m.set(w.id, w);
    return m;
  }, [deck]);

  const deckIds = deck.map(w => w.id).join("|");
  useEffect(() => {
    setRound(buildLearnRound(deckRef.current));
    setPos(0);
    setPicked(null);
    setCorrectIds(new Set());
    setWrongIds(new Set());
    setConfirmReset(false);
  }, [deckIds]);

  const w = round[pos] ? byId.get(round[pos]) : undefined;
  const total = round.length;
  const done = total > 0 && pos >= total;

  // Generate options with stable seed so re-renders don't reshuffle.
  const { options, correct } = useMemo(() => {
    if (!w) return { options: [] as string[], correct: 0 };
    const others = deckRef.current.filter(d => d.id !== w.id);
    const h = hashStr(w.w + "::learn");
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
  }, [w?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const revealed = picked !== null;

  const choose = (i: number) => {
    if (!w || revealed) return;
    setPicked(i);
    if (i === correct) {
      onMark(w.id, "mastered");
      setCorrectIds(s => {
        const n = new Set(s);
        n.add(w.id);
        return n;
      });
    } else {
      onMark(w.id, "learning");
      setWrongIds(s => {
        const n = new Set(s);
        n.add(w.id);
        return n;
      });
    }
  };

  const advance = () => {
    setPicked(null);
    setPos(p => p + 1);
  };

  const restart = () => {
    setRound(buildLearnRound(deckRef.current));
    setPos(0);
    setPicked(null);
    setCorrectIds(new Set());
    setWrongIds(new Set());
  };

  const restartWrongOnly = () => {
    const ids = Array.from(wrongIds).filter(id => !correctIds.has(id));
    if (ids.length === 0) return;
    setRound(ids);
    setPos(0);
    setPicked(null);
    setCorrectIds(new Set());
    setWrongIds(new Set());
  };

  const resetAndStart = () => {
    onResetSet();
    setRound(deckRef.current.map(w => w.id).slice(0, LEARN_ROUND_SIZE));
    setPos(0);
    setPicked(null);
    setCorrectIds(new Set());
    setWrongIds(new Set());
    setConfirmReset(false);
  };

  if (deck.length === 0) {
    return <div style={{ color: muted, textAlign: "center", padding: 40 }}>No words.</div>;
  }

  if (done) {
    const correctCount = correctIds.size;
    const missedCount = Array.from(wrongIds).filter(id => !correctIds.has(id)).length;
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
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: fg }}>Round complete</h2>
          <p style={{ margin: "10px 0 22px", color: muted, fontSize: 15 }}>
            {correctCount} correct · {missedCount} missed
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {missedCount > 0 && (
              <button onClick={restartWrongOnly} style={{ ...btnPrimary, padding: "0 24px" }}>
                Practice missed ({missedCount})
              </button>
            )}
            <button onClick={restart} style={{ ...btnSecondary, padding: "0 24px" }}>
              New round
            </button>
            {!confirmReset ? (
              <button
                onClick={() => setConfirmReset(true)}
                style={{ ...btnSecondary, padding: "0 24px", color: muted }}
              >
                Reset progress for this set
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setConfirmReset(false)}
                  style={{ ...btnSecondary, padding: "0 18px", flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  onClick={resetAndStart}
                  style={{ ...btnPrimary, padding: "0 18px", flex: 1, background: errFg, borderColor: errFg }}
                >
                  Confirm reset
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!w) return null;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          fontSize: 13,
          color: muted,
        }}
      >
        <span>
          Question {pos + 1} of {total}
        </span>
        <span>
          {correctIds.size} correct · {wrongIds.size} wrong
        </span>
      </div>

      <div style={{ marginBottom: 24 }}>
        <Tag pos={w.pos} isDark={isDark} />
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
            b = okFgL;
            bg = okBgL;
          }
          if (isWrong) {
            b = errFgL;
            bg = errBgL;
          }
          return (
            <button
              key={i}
              onClick={() => choose(i)}
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
                  background: isCorrect ? okFgL : isWrong ? errFgL : isPicked ? primary : "transparent",
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

      <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10 }}>
        {!revealed && (
          <button onClick={advance} style={{ ...btnSecondary, padding: "0 18px" }}>
            Skip
          </button>
        )}
        <button
          onClick={advance}
          disabled={!revealed && picked === null}
          style={{
            ...btnPrimary,
            padding: "0 24px",
            opacity: !revealed ? 0.5 : 1,
            cursor: !revealed ? "not-allowed" : "pointer",
          }}
        >
          {pos + 1 >= total ? "See results" : "Next word"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Match — pick-then-drop
   ═══════════════════════════════════════════════ */

const MATCH_POOL_SIZE = 6;

function buildMatchPool(deck: Word[]): Word[] {
  const unmastered = deck.filter(w => w.mastery < 0.8);
  const mastered = deck.filter(w => w.mastery >= 0.8);
  const shuffled = [...unmastered];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const out = shuffled.slice(0, MATCH_POOL_SIZE);
  if (out.length < MATCH_POOL_SIZE && mastered.length) {
    const fill = [...mastered];
    for (let i = fill.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [fill[i], fill[j]] = [fill[j], fill[i]];
    }
    out.push(...fill.slice(0, MATCH_POOL_SIZE - out.length));
  }
  return out;
}

function Match({
  deck,
  isDark,
  onMark,
}: {
  deck: Word[];
  isDark: boolean;
  onMark: (id: string, s: StudyStatus) => void;
}) {
  const okFgL = isDark ? "hsl(122 60% 65%)" : okFg;
  const okBgL = isDark ? "hsl(122 40% 15%)" : okBg;
  const errFgL = isDark ? "hsl(0 70% 68%)" : errFg;
  const errBgL = isDark ? "hsl(0 50% 17%)" : errBg;

  const deckRef = useRef(deck);
  deckRef.current = deck;

  const [pool, setPool] = useState<Word[]>([]);
  const [defOrder, setDefOrder] = useState<number[]>([]);
  const [links, setLinks] = useState<Record<number, number>>({});
  const [missCounts, setMissCounts] = useState<Record<number, number>>({});
  const [missedPair, setMissedPair] = useState<{ wi: number; slot: number } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const startRound = () => {
    const next = buildMatchPool(deckRef.current);
    const order = next.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    setPool(next);
    setDefOrder(order);
    setLinks({});
    setMissCounts({});
    setMissedPair(null);
    setSelected(null);
  };

  const deckIds = deck.map(w => w.id).join("|");
  useEffect(() => {
    startRound();
  }, [deckIds]);

  const pick = (wi: number) => {
    if (links[wi] !== undefined) return;
    setSelected(wi);
  };

  const drop = (slot: number) => {
    if (selected === null) return;
    if (Object.values(links).includes(slot)) return;
    const wi = selected;
    const correct = wi === defOrder[slot];
    if (!correct) {
      setMissCounts(prev => ({ ...prev, [wi]: (prev[wi] ?? 0) + 1 }));
      setMissedPair({ wi, slot });
      window.setTimeout(() => {
        setMissedPair(current => (current?.wi === wi && current.slot === slot ? null : current));
      }, 500);
      return;
    }
    setLinks(prev => ({ ...prev, [wi]: slot }));
    setSelected(null);
    setMissedPair(null);
    const target = pool[wi];
    if (target) onMark(target.id, (missCounts[wi] ?? 0) > 0 ? "learning" : "mastered");
  };

  const matched = (wi: number, slot: number) => wi === defOrder[slot];
  const resolved = Object.keys(links).length;
  const total = pool.length;
  const correctCount = resolved;
  const wrongCount = Object.values(missCounts).reduce((sum, count) => sum + count, 0);
  const practicedAgainCount = Object.keys(missCounts).length;
  const done = total > 0 && resolved >= total;

  if (deck.length === 0) {
    return <div style={{ color: muted, textAlign: "center", padding: 40 }}>No words.</div>;
  }

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
          flexWrap: "wrap",
        }}
      >
        <span>Pair each word with its meaning</span>
        <span style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <span style={{ whiteSpace: "nowrap" }}>
            {resolved} / {total}
          </span>
          <button
            onClick={startRound}
            title="Restart round"
            style={{
              background: "transparent",
              border: "none",
              color: muted,
              cursor: "pointer",
              fontSize: 13,
              padding: "2px 6px",
              fontFamily: "inherit",
            }}
          >
            ↺ Restart
          </button>
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ display: "grid", gap: 10 }}>
          {pool.map((w, i) => {
            const linked = links[i] !== undefined;
            const isSel = selected === i;
            const correct = linked && matched(i, links[i]);
            const isMissed = missedPair?.wi === i;
            const b = correct ? okFgL : isMissed ? errFgL : isSel ? primary : borderC;
            const bg = correct ? okBgL : isMissed ? errBgL : isSel ? primary2 : cardBg;
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
                  <span style={{ fontSize: 16, color: okFgL }}>✓</span>
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
            const isMissed = missedPair?.slot === slot;
            const b = correct ? okFgL : isMissed ? errFgL : selected !== null ? primary : borderC;
            const bg = correct ? okBgL : isMissed ? errBgL : cardBg;
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

      {done && (
        <div
          style={{
            marginTop: 22,
            padding: "20px 22px",
            borderRadius: 14,
            background: cardBg,
            border: `1px solid ${borderC}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: fg }}>
              {correctCount} of {total} correct
            </div>
            <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>
              {wrongCount === 0
                ? "No retry attempts."
                : `${wrongCount} retry attempt${wrongCount === 1 ? "" : "s"} across ${practicedAgainCount} word${practicedAgainCount === 1 ? "" : "s"}.`}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={startRound} style={{ ...btnPrimary, padding: "0 22px", height: 42 }}>
              Next round
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Test
   ═══════════════════════════════════════════════ */

const TEST_QUESTION_COUNT = 12;
const TEST_PER_Q_SECONDS = 45;

function buildTestQuestions(deck: Word[]): Word[] {
  const unmastered = deck.filter(w => w.mastery < 0.8);
  const mastered = deck.filter(w => w.mastery >= 0.8);
  const shuffle = (arr: Word[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const pool = shuffle(unmastered);
  if (pool.length < TEST_QUESTION_COUNT) pool.push(...shuffle(mastered));
  return pool.slice(0, Math.min(TEST_QUESTION_COUNT, pool.length));
}

type TestResult = {
  word: Word;
  correctWord: string;
  pickedWord: string | null;
  correct: boolean;
};

function Test({
  deck,
  onMark,
  onResetSet,
  setName,
}: {
  deck: Word[];
  onMark: (id: string, s: StudyStatus) => void;
  onResetSet: () => void;
  setName: string;
}) {
  const deckRef = useRef(deck);
  deckRef.current = deck;

  const [questions, setQuestions] = useState<Word[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [timeLeft, setTimeLeft] = useState(TEST_PER_Q_SECONDS);
  const [done, setDone] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const deckIds = deck.map(w => w.id).join("|");
  useEffect(() => {
    setQuestions(buildTestQuestions(deckRef.current));
    setQIdx(0);
    setSel(null);
    setResults([]);
    setTimeLeft(TEST_PER_Q_SECONDS);
    setDone(false);
    setConfirmReset(false);
  }, [deckIds]);

  const q = questions[qIdx];

  const options = useMemo(() => {
    if (!q) return { words: [] as string[], correct: 0 };
    const others = deckRef.current.filter(d => d.id !== q.id);
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
  }, [q?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTimeLeft(TEST_PER_Q_SECONDS);
    setSel(null);
  }, [qIdx]);

  useEffect(() => {
    if (done) return;
    if (!questions.length) return;
    if (timeLeft <= 0) {
      goNext(false);
      return;
    }
    const t = window.setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, done, questions.length]);

  const goNext = (wasCorrect: boolean) => {
    if (q) {
      onMark(q.id, wasCorrect ? "mastered" : "learning");
      setResults(prev => [
        ...prev,
        {
          word: q,
          correctWord: q.w,
          pickedWord: sel !== null ? options.words[sel] : null,
          correct: wasCorrect,
        },
      ]);
    }
    if (qIdx + 1 >= questions.length) {
      setDone(true);
    } else {
      setQIdx(i => i + 1);
    }
  };

  const restart = () => {
    setQuestions(buildTestQuestions(deckRef.current));
    setQIdx(0);
    setSel(null);
    setResults([]);
    setTimeLeft(TEST_PER_Q_SECONDS);
    setDone(false);
  };

  const resetAndStart = () => {
    onResetSet();
    setTimeout(() => {
      setQuestions(buildTestQuestions(deckRef.current));
      setQIdx(0);
      setSel(null);
      setResults([]);
      setTimeLeft(TEST_PER_Q_SECONDS);
      setDone(false);
      setConfirmReset(false);
    }, 0);
  };

  if (!deck.length) return <div style={{ color: muted, textAlign: "center", padding: 40 }}>No words.</div>;

  if (done) {
    const correctCount = results.filter(r => r.correct).length;
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div
          style={{
            padding: "32px 28px",
            borderRadius: 16,
            background: cardBg,
            border: `1px solid ${borderC}`,
            boxShadow: "0 12px 32px -18px rgba(15,23,42,.12)",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: fg }}>Session complete</h2>
            <p style={{ margin: "10px 0 24px", color: muted, fontSize: 15 }}>
              {correctCount} / {results.length} correct
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {results.map((r, i) => (
              <div
                key={`${r.word.id}-${i}`}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: r.correct ? okBg : errBg,
                  border: `1px solid ${r.correct ? okFg : errFg}33`,
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: r.correct ? okFg : errFg,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {r.correct ? "✓" : "✕"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: fg }}>{r.correctWord}</span>
                    {!r.correct && (
                      <span style={{ fontSize: 12, color: errFg, whiteSpace: "nowrap" }}>
                        you picked: {r.pickedWord ?? "—"}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: muted, marginTop: 2, lineHeight: 1.45 }}>{r.word.def}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={restart} style={{ ...btnPrimary, padding: "0 24px" }}>
              New test
            </button>
            <button
              onClick={() => setConfirmReset(true)}
              style={{ ...btnSecondary, padding: "0 24px", color: muted }}
            >
              Reset progress for this set
            </button>
          </div>
        </div>

        {confirmReset && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.55)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
              zIndex: 1000,
            }}
            onClick={() => setConfirmReset(false)}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                maxWidth: 460,
                width: "100%",
                background: cardBg,
                border: `1px solid ${borderC}`,
                borderRadius: 16,
                padding: "28px 28px 24px",
                boxShadow: "0 24px 64px -24px rgba(15,23,42,.4)",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  background: `${errFg}1a`,
                  color: errFg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  fontWeight: 700,
                  margin: "0 auto 14px",
                }}
              >
                !
              </div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: fg, textAlign: "center" }}>
                Reset progress for this set?
              </h2>
              <p style={{ margin: "12px 0 8px", color: fg, fontSize: 14, textAlign: "center", lineHeight: 1.55 }}>
                Mastery and learning history for{" "}
                <span style={{ fontWeight: 600 }}>{setName || "this set"}</span> will be cleared.
              </p>
              <p style={{ margin: "0 0 22px", color: muted, fontSize: 13, textAlign: "center", lineHeight: 1.5 }}>
                Only this set is affected. Your progress on other sets stays intact.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setConfirmReset(false)}
                  style={{ ...btnSecondary, padding: "0 18px", flex: 1, height: 44 }}
                >
                  Cancel
                </button>
                <button
                  onClick={resetAndStart}
                  style={{
                    ...btnPrimary,
                    padding: "0 18px",
                    flex: 1,
                    height: 44,
                    background: errFg,
                    borderColor: errFg,
                  }}
                >
                  Reset this set
                </button>
              </div>
            </div>
          </div>
        )}
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

function Browse({
  deck,
  isDark,
  onResetSet,
}: {
  deck: Word[];
  isDark: boolean;
  onResetSet: () => void;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "new" | "learning" | "mastered">("all");
  const [confirmReset, setConfirmReset] = useState(false);

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

  const hasProgress = deck.some(w => w.mastery > 0);

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
        {hasProgress && (
          !confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              style={{
                padding: "0 14px",
                height: 36,
                borderRadius: 8,
                border: `1px solid ${borderC}`,
                background: cardBg,
                color: muted,
                fontSize: 13,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              Reset progress
            </button>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => setConfirmReset(false)}
                style={{
                  padding: "0 12px",
                  height: 36,
                  borderRadius: 8,
                  border: `1px solid ${borderC}`,
                  background: cardBg,
                  color: fg,
                  fontSize: 13,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onResetSet();
                  setConfirmReset(false);
                }}
                style={{
                  padding: "0 14px",
                  height: 36,
                  borderRadius: 8,
                  border: `1px solid ${errFg}`,
                  background: errFg,
                  color: "#fff",
                  fontSize: 13,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Confirm reset
              </button>
            </div>
          )
        )}
      </div>

      <div style={{ borderRadius: 12, border: `1px solid ${borderC}`, background: cardBg, overflow: "hidden" }}>
        {filtered.map((w, i) => (
          <div
            key={w.id}
            className="vocab-row"
            style={{
              display: "grid",
              gridTemplateColumns: "200px auto 1fr",
              gap: 20,
              padding: "16px 20px",
              alignItems: "center",
              borderBottom: i < filtered.length - 1 ? `1px solid ${borderC}` : "none",
              transition: "background .15s",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 500, color: fg, letterSpacing: "-.01em" }}>{w.w}</div>
            <Tag pos={w.pos} isDark={isDark} />
            <div style={{ fontSize: 14, color: fg, opacity: 0.8, lineHeight: 1.4 }}>{w.def}</div>
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

  // Single load+persist effect. The loadedUidRef guards against the
  // load/persist race when uid changes: the persist branch only runs
  // when `progress` corresponds to the currently-active uid, so we
  // never write the previous user's data into the new user's slot.
  const loadedUidRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (loadedUidRef.current !== uid) {
      loadedUidRef.current = uid;
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
      return;
    }

    try {
      window.localStorage.setItem(vocabStorageKey(uid), JSON.stringify(progress));
    } catch {
      // ignore quota errors
    }

    if (user && db) {
      const ref = doc(db, "user_progress", user.id);
      setDoc(ref, { user_id: user.id, vocab: progress }, { merge: true }).catch(
        (err) => console.error("Failed to sync vocab to Firestore:", err),
      );
    }
  }, [progress, uid, user]);

  const markWord = (id: string, status: StudyStatus) => {
    setProgress(prev => {
      if (prev[id] === status) return prev;
      return { ...prev, [id]: status };
    });
  };

  const resetSet = (setId: string) => {
    setProgress(prev => {
      const prefix = `${setId}::`;
      const next: StoredProgress = {};
      let changed = false;
      for (const [k, v] of Object.entries(prev)) {
        if (k.startsWith(prefix)) {
          changed = true;
          continue;
        }
        next[k] = v;
      }
      return changed ? next : prev;
    });
  };

  const activeSet = vocabularySets.find(s => s.id === activeSetId) ?? vocabularySets[0];

  const deck: Word[] = useMemo(() => {
    if (!activeSet) return [];
    return activeSet.words.map(w =>
      synthesizeWord(
        {
          word: w.word,
          definition: w.definition,
          pos: w.pos,
          synonyms: w.synonyms,
          antonyms: w.antonyms,
          inUse: w.inUse,
          difficulty: w.difficulty,
          setId: activeSet.id,
          setName: activeSet.name,
        },
        progress[`${activeSet.id}::${w.word.toLowerCase()}`] ?? "new",
      ),
    );
  }, [activeSet, progress]);

  const setOptions = vocabularySets.map(s => ({ id: s.id, name: s.name }));
  const setStatuses = useMemo(() => {
    const next: Record<string, SetPickerStatus> = {};
    for (const set of vocabularySets) {
      const wordIds = set.words.map(w => `${set.id}::${w.word.toLowerCase()}`);
      const progressed = wordIds.filter(id => progress[id] && progress[id] !== "new").length;
      const mastered = wordIds.filter(id => progress[id] === "mastered").length;
      next[set.id] = mastered === wordIds.length && wordIds.length > 0
        ? "done"
        : progressed > 0
          ? "in-progress"
          : "nothing";
    }
    return next;
  }, [progress]);

  const resetActive = () => {
    if (activeSet) resetSet(activeSet.id);
  };

  let content: React.ReactNode = null;
  if (mode === "flashcards")
    content = (
      <Flashcards
        deck={deck}
        isDark={isDark}
        onMark={markWord}
        onResetSet={resetActive}
        setName={activeSet?.name ?? ""}
      />
    );
  else if (mode === "learn")
    content = <Learn deck={deck} isDark={isDark} onMark={markWord} onResetSet={resetActive} />;
  else if (mode === "match")
    content = <Match deck={deck} isDark={isDark} onMark={markWord} />;
  else if (mode === "test")
    content = (
      <Test deck={deck} onMark={markWord} onResetSet={resetActive} setName={activeSet?.name ?? ""} />
    );
  else if (mode === "browse") content = <Browse deck={deck} isDark={isDark} onResetSet={resetActive} />;

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
        setStatuses={setStatuses}
        onSetChange={setActiveSetId}
      />
      {content}
    </div>
  );
};

export default Vocab;
