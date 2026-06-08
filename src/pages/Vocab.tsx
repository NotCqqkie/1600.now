import { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback, type CSSProperties } from "react";
import { vocabularySets } from "@/data/vocabulary";
import { useThemeMode } from "@/hooks/useThemeMode";
import { useAuth } from "@/contexts/AuthContext";
import { vocabStorageKey } from "@/hooks/useUserProgress";
import { db } from "@/lib/firebase/firebaseDb";
import { doc, setDoc } from "firebase/firestore";

type Pos = "adj" | "verb" | "noun";
type Mode = "flashcards" | "learn" | "match" | "test" | "browse";
type PracticeMode = Exclude<Mode, "browse">;
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
  mastery: number;
  etym: string;
  setName: string;
}

interface StoredProgress {
  [wordId: string]: StoredWordProgress;
}

interface StoredWordProgress {
  status: StudyStatus;
  confirmations: number;
  modes: Partial<Record<PracticeMode, number>>;
}

const textColor = "hsl(var(--foreground))";
const mutedTextColor = "hsl(var(--mutedTextColor-foreground))";
const cardBackground = "hsl(var(--card))";
const borderColor = "hsl(var(--border))";
const mutedSurface = "hsl(var(--mutedTextColor))";
const primary = "hsl(var(--primary))";
const primaryTint = "hsl(var(--primary) / 0.1)";
const successColor = "hsl(122 50% 35%)";
const successBackground = "hsl(122 50% 96%)";
const errorColor = "hsl(0 70% 50%)";
const errorBackground = "hsl(0 70% 97%)";
const MASTERY_CONFIRMATIONS = 3;
const MASTERY_MODE_COUNT = 2;
const PRACTICE_MODES: PracticeMode[] = ["flashcards", "learn", "match", "test"];

const TAG_LIGHT: Record<Pos, { bg: string; textColor: string }> = {
  adj: { bg: "hsl(201 100% 94%)", textColor: "hsl(201 100% 32%)" },
  verb: { bg: "hsl(32 100% 92%)", textColor: "hsl(24 70% 30%)" },
  noun: { bg: "hsl(122 40% 92%)", textColor: "hsl(122 40% 24%)" },
};
const TAG_DARK: Record<Pos, { bg: string; textColor: string }> = {
  adj: { bg: "hsl(201 70% 18%)", textColor: "hsl(201 100% 72%)" },
  verb: { bg: "hsl(32 60% 18%)", textColor: "hsl(32 100% 70%)" },
  noun: { bg: "hsl(122 35% 16%)", textColor: "hsl(122 55% 65%)" },
};

function hashStr(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index++) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function isStudyStatus(value: unknown): value is StudyStatus {
  return value === "new" || value === "learning" || value === "mastered";
}

function countModes(modes: Partial<Record<PracticeMode, number>>): number {
  return PRACTICE_MODES.filter(mode => (modes[mode] ?? 0) > 0).length;
}

function isMasteredProgress(progress: StoredWordProgress): boolean {
  return progress.confirmations >= MASTERY_CONFIRMATIONS && countModes(progress.modes) >= MASTERY_MODE_COUNT;
}

function deriveStatus(
  confirmations: number,
  modes: Partial<Record<PracticeMode, number>>,
  touched: boolean,
): StudyStatus {
  if (confirmations >= MASTERY_CONFIRMATIONS && countModes(modes) >= MASTERY_MODE_COUNT) return "mastered";
  if (confirmations > 0 || touched) return "learning";
  return "new";
}

function progressFromStatus(status: StudyStatus): StoredWordProgress {
  if (status === "mastered") {
    return {
      status: "mastered",
      confirmations: MASTERY_CONFIRMATIONS,
      modes: { flashcards: 1, learn: 1 },
    };
  }
  if (status === "learning") {
    return { status: "learning", confirmations: 1, modes: { flashcards: 1 } };
  }
  return { status: "new", confirmations: 0, modes: {} };
}

function normalizeProgressValue(value: unknown): StoredWordProgress | null {
  if (isStudyStatus(value)) return progressFromStatus(value);
  if (!value || typeof value !== "object") return null;

  const raw = value as {
    status?: unknown;
    confirmations?: unknown;
    modes?: unknown;
  };
  const modes: Partial<Record<PracticeMode, number>> = {};
  if (raw.modes && typeof raw.modes === "object") {
    for (const mode of PRACTICE_MODES) {
      const count = Number((raw.modes as Partial<Record<PracticeMode, unknown>>)[mode]);
      if (Number.isFinite(count) && count > 0) modes[mode] = Math.floor(count);
    }
  }
  let confirmations = Number(raw.confirmations);
  confirmations = Number.isFinite(confirmations) ? Math.max(0, Math.floor(confirmations)) : 0;

  if (raw.status === "mastered" && (confirmations < MASTERY_CONFIRMATIONS || countModes(modes) < MASTERY_MODE_COUNT)) {
    confirmations = Math.max(confirmations, MASTERY_CONFIRMATIONS);
    modes.flashcards = Math.max(modes.flashcards ?? 0, 1);
    modes.learn = Math.max(modes.learn ?? 0, 1);
  }

  const status = isStudyStatus(raw.status)
    ? raw.status
    : deriveStatus(confirmations, modes, confirmations > 0);

  return {
    status: status === "mastered" && !isMasteredProgress({ status, confirmations, modes })
      ? "learning"
      : deriveStatus(confirmations, modes, status !== "new"),
    confirmations,
    modes,
  };
}

function progressToMastery(progress?: StoredWordProgress): number {
  if (!progress) return 0;
  if (progress.status === "mastered") return 1;
  if (progress.status === "new") return 0;
  const confirmationScore = Math.min(progress.confirmations, MASTERY_CONFIRMATIONS) / MASTERY_CONFIRMATIONS;
  const modeScore = Math.min(countModes(progress.modes), MASTERY_MODE_COUNT) / MASTERY_MODE_COUNT;
  return Math.min(0.75, Math.max(0.25, confirmationScore * 0.65 + modeScore * 0.15));
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
  progress?: StoredWordProgress,
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
    mastery: progressToMastery(progress),
    etym: raw.setName,
    setName: raw.setName,
  };
}

function Tag({ pos, isDark }: { pos: Pos; isDark: boolean }) {
  const tagColors = (isDark ? TAG_DARK : TAG_LIGHT)[pos];
  return (
    <span
      style={{
        display: "inline-block",
        width: "fit-content",
        fontFamily: "'Inter', sans-serif",
        fontSize: 11,
        padding: "4px 12px",
        borderRadius: 999,
        background: tagColors.bg,
        color: tagColors.textColor,
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
  const filledDots = Math.round(v * 5);
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: i < filledDots ? primary : "hsl(var(--border))",
          }}
        />
      ))}
    </span>
  );
}
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
const btnIcon: CSSProperties = {
  ...btnBase,
  background: cardBackground,
  color: "rgb(var(--ink-mid))",
  fontSize: 16,
  height: 44,
  width: 44,
};
const btnSecondary: CSSProperties = {
  ...btnBase,
  background: cardBackground,
  color: "rgb(var(--ink))",
};
const btnPrimary: CSSProperties = {
  ...btnBase,
  background: "#0E2138",
  color: "#fff",
  borderColor: "#0E2138",
};

function MasteredSetPrompt({
  setName,
  onReset,
}: {
  setName?: string;
  onReset: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
      <div
        style={{
          padding: "32px 28px",
          borderRadius: 16,
          background: cardBackground,
          border: `1px solid ${borderColor}`,
          boxShadow: "0 12px 32px -18px rgba(15,23,42,.12)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: textColor }}>Set mastered</h2>
        <p style={{ color: successColor, margin: "10px 0 22px", fontSize: 13, fontWeight: 500 }}>
          You've mastered every word{setName ? ` in ${setName}` : ""}.
        </p>
        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            style={{ ...btnSecondary, padding: "0 24px", color: mutedTextColor, width: "100%" }}
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
              onClick={() => {
                onReset();
                setConfirmReset(false);
              }}
              style={{
                ...btnPrimary,
                padding: "0 18px",
                flex: 1,
                background: errorColor,
                borderColor: errorColor,
              }}
            >
              Confirm reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

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
  for (const setOption of setOptions) {
    const nameParts = setOption.name.match(/^(.+?)\s+(\S+)$/);
    if (nameParts && (TIER_ORDER as readonly string[]).includes(nameParts[1])) {
      const tierGroup = groups.get(nameParts[1]) ?? [];
      tierGroup.push({ id: setOption.id, num: nameParts[2], raw: setOption.name });
      groups.set(nameParts[1], tierGroup);
    } else {
      ungrouped.push(setOption);
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        right: 0,
        background: cardBackground,
        border: `1px solid ${borderColor}`,
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
      <div style={{ display: "flex", gap: 10, padding: "0 2px 2px", borderBottom: `1px solid ${borderColor}`, paddingBottom: 10 }}>
        {(Object.keys(SET_STATUS_META) as SetPickerStatus[]).map(status => (
          <div key={status} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: mutedTextColor, whiteSpace: "nowrap" }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: SET_STATUS_META[status].color,
                boxShadow: `0 0 0 1px ${borderColor}`,
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
                color: mutedTextColor,
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
                      border: `1px solid ${on ? textColor : borderColor}`,
                      background: on ? textColor : "transparent",
                      color: on ? "hsl(var(--background))" : textColor,
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
                        boxShadow: `0 0 0 1px ${on ? "hsl(var(--background))" : cardBackground}`,
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
        <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 6, borderTop: `1px solid ${borderColor}` }}>
          {ungrouped.map(setOption => {
            const on = setOption.id === activeSetId;
            const status = setStatuses[setOption.id] ?? "nothing";
            return (
              <button
                key={setOption.id}
                onClick={() => onPick(setOption.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: on ? mutedSurface : "transparent",
                  color: textColor,
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
                    boxShadow: `0 0 0 1px ${borderColor}`,
                    flexShrink: 0,
                  }}
                />
                {setOption.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModeTabs({
  modes,
  mode,
  setMode,
  mutedSurface,
  borderColor,
}: {
  modes: [Mode, string][];
  mode: Mode;
  setMode: (m: Mode) => void;
  mutedSurface: string;
  borderColor: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Map<Mode, HTMLButtonElement>>(new Map());
  const [slider, setSlider] = useState({ left: 0, width: 0 });
  const [ready, setReady] = useState(false);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const activeButton = btnRefs.current.get(mode);
    if (!container || !activeButton) return;
    const containerRect = container.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    setSlider({ left: buttonRect.left - containerRect.left, width: buttonRect.width });
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
        background: mutedSurface,
        border: `1px solid ${borderColor}`,
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
          background: cardBackground,
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
    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => document.removeEventListener("mousedown", handleDocumentMouseDown);
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
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              background: cardBackground,
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
      <ModeTabs modes={modes} mode={mode} setMode={setMode} mutedSurface={mutedSurface} borderColor={borderColor} />
    </div>
  );
}

const FLASHCARD_GROUP_SIZE = 10;

function isFlashcardSetComplete(deck: Word[]): boolean {
  return deck.length > 0 && deck.every(word => word.mastery >= 0.8);
}

function getFlashcardRoundIds(deck: Word[], requestedStart: number): { ids: string[]; start: number } {
  if (deck.length === 0 || isFlashcardSetComplete(deck)) return { ids: [], start: 0 };
  const start = requestedStart >= 0 && requestedStart < deck.length ? requestedStart : 0;
  return {
    ids: deck.slice(start, start + FLASHCARD_GROUP_SIZE).map(word => word.id),
    start,
  };
}

function Flashcards({
  deck,
  isDark,
  onMark,
  onResetSet,
  setName,
}: {
  deck: Word[];
  isDark: boolean;
  onMark: (id: string, status: StudyStatus, mode: PracticeMode) => void;
  onResetSet: () => void;
  setName: string;
}) {
  const [queue, setQueue] = useState<string[]>([]);
  const [roundTotal, setRoundTotal] = useState(0);
  const [roundStart, setRoundStart] = useState(0);
  const [knownThisRound, setKnownThisRound] = useState<Set<string>>(new Set());
  const [learningThisRound, setLearningThisRound] = useState<Set<string>>(new Set());
  const [flipped, setFlipped] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const wordsById = useMemo(() => {
    const wordMap = new Map<string, Word>();
    for (const word of deck) wordMap.set(word.id, word);
    return wordMap;
  }, [deck]);
  const deckRef = useRef(deck);
  deckRef.current = deck;
  const deckIds = deck.map(word => word.id).join("|");

  const startGroup = (requestedStart: number) => {
    const currentDeck = deckRef.current;
    const round = getFlashcardRoundIds(currentDeck, requestedStart);
    setRoundStart(round.start);
    setQueue(round.ids);
    setRoundTotal(round.ids.length);
    setKnownThisRound(new Set());
    setLearningThisRound(new Set());
    setFlipped(false);
    setConfirmReset(false);
  };

  useEffect(() => {
    startGroup(0);
  }, [deckIds]);

  const cardId = queue[0];
  const card = cardId ? wordsById.get(cardId) : undefined;
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
    onMark(id, "mastered", "flashcards");
    setKnownThisRound(currentKnown => {
      const nextKnown = new Set(currentKnown);
      nextKnown.add(id);
      return nextKnown;
    });
    animate(() => setQueue(currentQueue => currentQueue.slice(1)));
  };

  const markStudyAgain = () => {
    if (!card) return;
    const id = card.id;
    onMark(id, "learning", "flashcards");
    setLearningThisRound(currentLearning => {
      const nextLearning = new Set(currentLearning);
      nextLearning.add(id);
      return nextLearning;
    });
    animate(() =>
      setQueue(currentQueue => {
        if (currentQueue.length <= 1) return currentQueue;
        const [first, ...rest] = currentQueue;
        return [...rest, first];
      }),
    );
  };

  const skipNext = () => animate(() =>
    setQueue(currentQueue => {
      if (currentQueue.length <= 1) return currentQueue;
      const [first, ...rest] = currentQueue;
      return [...rest, first];
    }),
  );
  const skipPrev = () => animate(() =>
    setQueue(currentQueue => {
      if (currentQueue.length <= 1) return currentQueue;
      const last = currentQueue[currentQueue.length - 1];
      return [last, ...currentQueue.slice(0, -1)];
    }),
  );

  const restartFull = () => {
    startGroup(roundStart);
  };

  const restartLearning = () => {
    const ids = Array.from(learningThisRound).filter(id => !knownThisRound.has(id));
    if (ids.length === 0) return;
    setQueue(ids);
    setRoundTotal(ids.length);
    setKnownThisRound(new Set());
    setLearningThisRound(new Set());
    setFlipped(false);
  };

  const resetAndStart = () => {
    onResetSet();
    const nextQueue = deckRef.current.map(word => word.id).slice(0, FLASHCARD_GROUP_SIZE);
    setRoundStart(0);
    setQueue(nextQueue);
    setRoundTotal(nextQueue.length);
    setKnownThisRound(new Set());
    setLearningThisRound(new Set());
    setFlipped(false);
    setConfirmReset(false);
  };
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const targetTag = (event.target as HTMLElement)?.tagName;
      if (targetTag === "INPUT" || targetTag === "TEXTAREA") return;
      if (!card) return;
      if (event.key === " ") {
        event.preventDefault();
        setFlipped(currentFlipped => !currentFlipped);
      } else if (event.key === "ArrowRight") skipNext();
      else if (event.key === "ArrowLeft") skipPrev();
      else if (event.key === "1") markStudyAgain();
      else if (event.key === "2") markGotIt();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [card, markGotIt, markStudyAgain, skipNext, skipPrev]);

  if (deck.length === 0) {
    return <div style={{ color: mutedTextColor, textAlign: "center", padding: 40 }}>No words in this set.</div>;
  }

  if (done) {
    const knownCount = knownThisRound.size;
    const stillLearningCount = Array.from(learningThisRound).filter(id => !knownThisRound.has(id)).length;
    const allMastered = isFlashcardSetComplete(deck);
    const nextStart = roundStart + FLASHCARD_GROUP_SIZE;
    const hasNextGroup = nextStart < deck.length;
    const nextGroupSize = Math.min(
      FLASHCARD_GROUP_SIZE,
      hasNextGroup ? deck.length - nextStart : deck.length,
    );
    const startNextGroup = () => startGroup(hasNextGroup ? nextStart : 0);

    return (
      <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
        <div
          style={{
            padding: "32px 28px",
            borderRadius: 16,
            background: cardBackground,
            border: `1px solid ${borderColor}`,
            boxShadow: "0 12px 32px -18px rgba(15,23,42,.12)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: textColor }}>
            {allMastered ? "Set mastered" : "Round complete"}
          </h2>
          <p style={{ margin: "10px 0 6px", color: mutedTextColor, fontSize: 15 }}>
            {knownCount > 0 && <>{knownCount} marked known</>}
            {knownCount > 0 && stillLearningCount > 0 && " · "}
            {stillLearningCount > 0 && <>{stillLearningCount} still learning</>}
            {knownCount === 0 && stillLearningCount === 0 && (
              allMastered ? "Reset this set to study it from scratch." : "No cards reviewed."
            )}
          </p>
          {allMastered && (
            <p style={{ color: successColor, margin: "10px 0 22px", fontSize: 13, fontWeight: 500 }}>
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
            {!allMastered && (
              <button onClick={startNextGroup} style={{ ...btnSecondary, padding: "0 24px" }}>
                {hasNextGroup ? "Next round" : "Start next pass"} ({nextGroupSize})
              </button>
            )}
            {allMastered && (
              !confirmReset ? (
                <button
                  onClick={() => setConfirmReset(true)}
                  style={{
                    ...btnSecondary,
                    padding: "0 24px",
                    color: mutedTextColor,
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
                      background: errorColor,
                      borderColor: errorColor,
                    }}
                  >
                    Confirm reset
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!card) return null;

  const totalForBar = roundTotal || deck.length;
  const remaining = queue.length;
  const reviewedThisRound = Math.max(0, totalForBar - remaining);
  const progressPct = (reviewedThisRound / Math.max(totalForBar, 1)) * 100;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
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
          {" this round · "}
          <span style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "rgb(var(--ink))" }}>{knownThisRound.size}</span> marked known
        </span>
        <div
          style={{ flex: 1, height: 3, borderRadius: 2, background: "hsl(var(--border))", overflow: "hidden" }}
          title={`${reviewedThisRound} of ${totalForBar} reviewed this round`}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPct}%`,
              background: primary,
              transition: "width .3s",
            }}
          />
        </div>
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
            minHeight: 36,
            borderRadius: 8,
            padding: "8px 10px",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgb(var(--ink))")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgb(var(--ink-mid))")}
        >
          ↺ Restart round
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
              background: cardBackground,
              borderRadius: 20,
              border: `1px solid ${borderColor}`,
              boxShadow: "0 12px 32px -16px rgba(15,23,42,.15)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "32px 40px",
            }}
          >
            <Tag pos={card.pos} isDark={isDark} />
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
  const bg = isDark ? "hsl(217 33% 14%)" : cardBackground;
  const textMain = isDark ? "#fff" : textColor;
  const headAccent = isDark ? "hsl(201 100% 75%)" : primary;
  const labelAccent = isDark ? "hsl(201 100% 70%)" : primary;
  const divider = isDark ? "#ffffff18" : borderColor;
  const softPanel = isDark ? "#ffffff0c" : mutedSurface;
  const softPanelBorderAccent = isDark ? "hsl(39 100% 57%)" : "hsl(39 90% 45%)";
  const exTextColor = isDark ? "#ffffffdd" : textColor;
  const synColor = isDark ? "hsl(201 100% 70%)" : primary;
  const antColor = isDark ? "hsl(0 80% 72%)" : "hsl(0 70% 45%)";
  const pillBg = isDark ? "#ffffff10" : mutedSurface;
  const pillBorder = isDark ? "#ffffff18" : borderColor;
  const pillText = isDark ? "#fff" : textColor;
  const footBg = isDark ? "#00000025" : "hsl(var(--mutedTextColor))";
  const footLabel = isDark ? "#ffffff80" : mutedTextColor;
  const footText = isDark ? "#ffffffcc" : textColor;
  const subDivider = isDark ? "#ffffff18" : borderColor;
  const gridBg = isDark ? "#ffffff05" : "transparent";
  const posColor = isDark ? "#ffffff88" : mutedTextColor;

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
        border: isDark ? "none" : `1px solid ${borderColor}`,
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

const LEARN_ROUND_SIZE = 10;

function buildLearnRound(deck: Word[]): string[] {
  const unmastered = deck.filter(word => word.mastery < 0.8);
  const ids = unmastered.map(word => word.id);
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
  onMark: (id: string, s: StudyStatus, mode: PracticeMode) => void;
  onResetSet: () => void;
}) {
  const successText = isDark ? "hsl(122 60% 65%)" : successColor;
  const successFill = isDark ? "hsl(122 40% 15%)" : successBackground;
  const errorText = isDark ? "hsl(0 70% 68%)" : errorColor;
  const errorFill = isDark ? "hsl(0 50% 17%)" : errorBackground;

  const [round, setRound] = useState<string[]>([]);
  const [pos, setPos] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctIds, setCorrectIds] = useState<Set<string>>(new Set());
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const [confirmReset, setConfirmReset] = useState(false);

  const deckRef = useRef(deck);
  deckRef.current = deck;
  const wordsById = useMemo(() => {
    const wordMap = new Map<string, Word>();
    for (const word of deck) wordMap.set(word.id, word);
    return wordMap;
  }, [deck]);

  const deckIds = deck.map(word => word.id).join("|");
  useEffect(() => {
    setRound(buildLearnRound(deckRef.current));
    setPos(0);
    setPicked(null);
    setCorrectIds(new Set());
    setWrongIds(new Set());
    setConfirmReset(false);
  }, [deckIds]);

  const currentWord = round[pos] ? wordsById.get(round[pos]) : undefined;
  const total = round.length;
  const done = total > 0 && pos >= total;
  const { options, correct } = useMemo(() => {
    if (!currentWord) return { options: [] as string[], correct: 0 };
    const otherWords = deckRef.current.filter(word => word.id !== currentWord.id);
    const seed = hashStr(currentWord.w + "::learn");
    const distractors: string[] = [];
    const seen = new Set<string>();
    let attempt = 0;
    while (distractors.length < 3 && otherWords.length) {
      const pick = otherWords[(seed + attempt * 7) % otherWords.length];
      attempt++;
      if (attempt > 1000) break;
      if (!pick || seen.has(pick.id)) continue;
      seen.add(pick.id);
      distractors.push(pick.def);
    }
    const correctIndex = seed % 4;
    const choices: string[] = [];
    let distractorIndex = 0;
    for (let optionIndex = 0; optionIndex < 4; optionIndex++) {
      if (optionIndex === correctIndex) choices.push(currentWord.def);
      else choices.push(distractors[distractorIndex++] ?? "—");
    }
    return { options: choices, correct: correctIndex };
  }, [currentWord?.id, currentWord?.w, currentWord?.def]);

  const revealed = picked !== null;

  const choose = (optionIndex: number) => {
    if (!currentWord || revealed) return;
    setPicked(optionIndex);
    if (optionIndex === correct) {
      onMark(currentWord.id, "mastered", "learn");
      setCorrectIds(currentCorrectIds => {
        const nextCorrectIds = new Set(currentCorrectIds);
        nextCorrectIds.add(currentWord.id);
        return nextCorrectIds;
      });
    } else {
      onMark(currentWord.id, "learning", "learn");
      setWrongIds(currentWrongIds => {
        const nextWrongIds = new Set(currentWrongIds);
        nextWrongIds.add(currentWord.id);
        return nextWrongIds;
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
    setRound(deckRef.current.map(word => word.id).slice(0, LEARN_ROUND_SIZE));
    setPos(0);
    setPicked(null);
    setCorrectIds(new Set());
    setWrongIds(new Set());
    setConfirmReset(false);
  };

  if (deck.length === 0) {
    return <div style={{ color: mutedTextColor, textAlign: "center", padding: 40 }}>No words.</div>;
  }
  if (deck.every(word => word.mastery >= 0.8) && !done) {
    return <MasteredSetPrompt setName={deck[0]?.setName} onReset={resetAndStart} />;
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
            background: cardBackground,
            border: `1px solid ${borderColor}`,
            boxShadow: "0 12px 32px -18px rgba(15,23,42,.12)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: textColor }}>Round complete</h2>
          <p style={{ margin: "10px 0 22px", color: mutedTextColor, fontSize: 15 }}>
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
                style={{ ...btnSecondary, padding: "0 24px", color: mutedTextColor }}
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
                  style={{ ...btnPrimary, padding: "0 18px", flex: 1, background: errorColor, borderColor: errorColor }}
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

  if (!currentWord) return null;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          fontSize: 13,
          color: mutedTextColor,
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
        <Tag pos={currentWord.pos} isDark={isDark} />
        <h2 style={{ margin: "10px 0 4px", fontSize: 40, fontWeight: 500, letterSpacing: "-.02em", color: textColor }}>
          {currentWord.w}
        </h2>
        <p style={{ margin: 0, fontSize: 15, color: mutedTextColor }}>Which meaning fits?</p>
      </div>

      <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
        {options.map((option, optionIndex) => {
          const isPicked = picked === optionIndex;
          const isCorrect = revealed && optionIndex === correct;
          const isWrong = revealed && isPicked && optionIndex !== correct;
          let optionBorder = borderColor;
          let optionBackground = cardBackground;
          if (isPicked && !revealed) {
            optionBorder = primary;
            optionBackground = primaryTint;
          }
          if (isCorrect) {
            optionBorder = successText;
            optionBackground = successFill;
          }
          if (isWrong) {
            optionBorder = errorText;
            optionBackground = errorFill;
          }
          return (
            <button
              key={optionIndex}
              onClick={() => choose(optionIndex)}
              style={{
                textAlign: "left",
                padding: "16px 18px",
                borderRadius: 12,
                border: `1.5px solid ${optionBorder}`,
                background: optionBackground,
                cursor: revealed ? "default" : "pointer",
                fontFamily: "inherit",
                fontSize: 15,
                color: textColor,
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
                  border: `1.5px solid ${optionBorder}`,
                  background: isCorrect ? successText : isWrong ? errorText : isPicked ? primary : "transparent",
                  color: isCorrect || isWrong || isPicked ? "#fff" : textColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  fontSize: 12,
                  flexShrink: 0,
                }}
              >
                {String.fromCharCode(65 + optionIndex)}
              </span>
              <span style={{ flex: 1 }}>{option}</span>
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

const MATCH_POOL_SIZE = 6;

function buildMatchPool(deck: Word[]): Word[] {
  const unmastered = deck.filter(word => word.mastery < 0.8);
  if (!unmastered.length) return [];
  const mastered = deck.filter(word => word.mastery >= 0.8);
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
  onResetSet,
}: {
  deck: Word[];
  isDark: boolean;
  onMark: (id: string, s: StudyStatus, mode: PracticeMode) => void;
  onResetSet: () => void;
}) {
  const successText = isDark ? "hsl(122 60% 65%)" : successColor;
  const successFill = isDark ? "hsl(122 40% 15%)" : successBackground;
  const errorText = isDark ? "hsl(0 70% 68%)" : errorColor;
  const errorFill = isDark ? "hsl(0 50% 17%)" : errorBackground;

  const deckRef = useRef(deck);
  deckRef.current = deck;

  const [pool, setPool] = useState<Word[]>([]);
  const [defOrder, setDefOrder] = useState<number[]>([]);
  const [links, setLinks] = useState<Record<number, number>>({});
  const [missCounts, setMissCounts] = useState<Record<number, number>>({});
  const [missedPair, setMissedPair] = useState<{ wordIndex: number; slot: number } | null>(null);
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

  const resetAndStart = () => {
    onResetSet();
    window.setTimeout(startRound, 0);
  };

  const deckIds = deck.map(word => word.id).join("|");
  useEffect(() => {
    startRound();
  }, [deckIds]);

  const pick = (wordIndex: number) => {
    if (links[wordIndex] !== undefined) return;
    setSelected(wordIndex);
  };

  const drop = (slot: number) => {
    if (selected === null) return;
    if (Object.values(links).includes(slot)) return;
    const wordIndex = selected;
    const correct = wordIndex === defOrder[slot];
    if (!correct) {
      setMissCounts(prev => ({ ...prev, [wordIndex]: (prev[wordIndex] ?? 0) + 1 }));
      setMissedPair({ wordIndex, slot });
      window.setTimeout(() => {
        setMissedPair(current => (current?.wordIndex === wordIndex && current.slot === slot ? null : current));
      }, 500);
      return;
    }
    setLinks(prev => ({ ...prev, [wordIndex]: slot }));
    setSelected(null);
    setMissedPair(null);
    const target = pool[wordIndex];
    if (target) onMark(target.id, (missCounts[wordIndex] ?? 0) > 0 ? "learning" : "mastered", "match");
  };

  const matched = (wordIndex: number, slot: number) => wordIndex === defOrder[slot];
  const resolved = Object.keys(links).length;
  const total = pool.length;
  const correctCount = resolved;
  const wrongCount = Object.values(missCounts).reduce((sum, count) => sum + count, 0);
  const practicedAgainCount = Object.keys(missCounts).length;
  const done = total > 0 && resolved >= total;

  if (deck.length === 0) {
    return <div style={{ color: mutedTextColor, textAlign: "center", padding: 40 }}>No words.</div>;
  }
  if (deck.every(word => word.mastery >= 0.8) && pool.length === 0) {
    return <MasteredSetPrompt setName={deck[0]?.setName} onReset={resetAndStart} />;
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
          color: mutedTextColor,
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
              color: mutedTextColor,
              cursor: "pointer",
              fontSize: 13,
              minHeight: 36,
              borderRadius: 8,
              padding: "8px 10px",
              fontFamily: "inherit",
            }}
          >
            ↺ Restart
          </button>
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ display: "grid", gap: 10 }}>
          {pool.map((word, wordIndex) => {
            const linked = links[wordIndex] !== undefined;
            const isSelected = selected === wordIndex;
            const correct = linked && matched(wordIndex, links[wordIndex]);
            const isMissed = missedPair?.wordIndex === wordIndex;
            const wordBorder = correct ? successText : isMissed ? errorText : isSelected ? primary : borderColor;
            const wordBackground = correct ? successFill : isMissed ? errorFill : isSelected ? primaryTint : cardBackground;
            return (
              <button
                key={wordIndex}
                onClick={() => pick(wordIndex)}
                disabled={linked}
                style={{
                  padding: "16px 18px",
                  borderRadius: 12,
                  cursor: linked ? "default" : "pointer",
                  textAlign: "left",
                  border: `1.5px solid ${wordBorder}`,
                  background: wordBackground,
                  opacity: linked ? 0.9 : 1,
                  transition: "all .15s",
                  fontFamily: "inherit",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  color: textColor,
                }}
              >
                <span style={{ fontSize: 18, fontWeight: 500 }}>{word.w}</span>
                {linked && (
                  <span style={{ fontSize: 16, color: successText }}>✓</span>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {defOrder.map((wordIndex, slot) => {
            const definitionText = pool[wordIndex]?.def ?? "";
            const linkedWord = Object.entries(links).find(([, linkedSlot]) => linkedSlot === slot);
            const filled = linkedWord !== undefined;
            const correct = filled && matched(Number(linkedWord![0]), slot);
            const isMissed = missedPair?.slot === slot;
            const definitionBorder = correct ? successText : isMissed ? errorText : selected !== null ? primary : borderColor;
            const definitionBackground = correct ? successFill : isMissed ? errorFill : cardBackground;
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
                  border: `1.5px solid ${definitionBorder}`,
                  background: definitionBackground,
                  transition: "all .15s",
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: textColor,
                  fontFamily: "inherit",
                }}
              >
                {definitionText}
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
            background: cardBackground,
            border: `1px solid ${borderColor}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: textColor }}>
              {correctCount} of {total} correct
            </div>
            <div style={{ fontSize: 13, color: mutedTextColor, marginTop: 4 }}>
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

const TEST_QUESTION_COUNT = 12;
const TEST_PER_Q_SECONDS = 45;
type TestQuestionType = "definition-to-word" | "word-to-definition" | "sentence-completion" | "synonym" | "antonym";

type TestQuestion = {
  id: string;
  word: Word;
  type: TestQuestionType;
  prompt: string;
  context?: string;
  choices: string[];
  correct: number;
  answer: string;
};

const TEST_TYPE_ORDER: TestQuestionType[] = [
  "definition-to-word",
  "sentence-completion",
  "word-to-definition",
  "synonym",
  "antonym",
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function blankExample(word: Word): string | null {
  const wordPattern = new RegExp(`\\b${escapeRegExp(word.w)}\\b`, "i");
  if (!wordPattern.test(word.ex)) return null;
  return word.ex.replace(wordPattern, "_____");
}

function buildChoices(correct: string, distractors: string[], seed: number): { choices: string[]; correct: number } {
  const unique = distractors.filter((value, index, arr) => value && value !== correct && arr.indexOf(value) === index);
  const picked: string[] = [];
  let attempt = 0;
  while (picked.length < 3 && unique.length) {
    const candidate = unique[(seed + attempt * 7) % unique.length];
    attempt++;
    if (!picked.includes(candidate)) picked.push(candidate);
    if (attempt > 1000) break;
  }
  const correctIndex = seed % 4;
  const choices: string[] = [];
  let distractorIndex = 0;
  for (let optionIndex = 0; optionIndex < 4; optionIndex++) {
    choices.push(optionIndex === correctIndex ? correct : picked[distractorIndex++] ?? "—");
  }
  return { choices, correct: correctIndex };
}

function availableTestTypes(word: Word): TestQuestionType[] {
  return TEST_TYPE_ORDER.filter(type => {
    if (type === "sentence-completion") return blankExample(word) !== null;
    if (type === "synonym") return word.syn.length > 0;
    if (type === "antonym") return word.ant.length > 0;
    return true;
  });
}

function pickTestType(word: Word, index: number): TestQuestionType {
  const available = availableTestTypes(word);
  const preferred = TEST_TYPE_ORDER[index % TEST_TYPE_ORDER.length];
  if (available.includes(preferred)) return preferred;
  return available[hashStr(`${word.id}:${index}`) % available.length] ?? "definition-to-word";
}

function buildTestQuestion(word: Word, deck: Word[], index: number): TestQuestion {
  const type = pickTestType(word, index);
  const seed = hashStr(`${word.id}:${type}:${index}`);
  const otherWords = deck.filter(otherWord => otherWord.id !== word.id);
  const wordChoices = () => buildChoices(word.w, otherWords.map(otherWord => otherWord.w), seed);
  const definitionChoices = () => buildChoices(word.def, otherWords.map(otherWord => otherWord.def), seed);

  if (type === "word-to-definition") {
    const { choices, correct } = definitionChoices();
    return {
      id: `${word.id}:definition:${index}`,
      word,
      type,
      prompt: `Which definition best matches "${word.w}"?`,
      choices,
      correct,
      answer: word.def,
    };
  }

  if (type === "sentence-completion") {
    const { choices, correct } = wordChoices();
    return {
      id: `${word.id}:sentence:${index}`,
      word,
      type,
      prompt: "Which word best completes the sentence?",
      context: blankExample(word) ?? word.ex,
      choices,
      correct,
      answer: word.w,
    };
  }

  if (type === "synonym") {
    const clue = word.syn[seed % word.syn.length];
    const { choices, correct } = wordChoices();
    return {
      id: `${word.id}:synonym:${index}`,
      word,
      type,
      prompt: `Which word is closest in meaning to "${clue}"?`,
      choices,
      correct,
      answer: word.w,
    };
  }

  if (type === "antonym") {
    const clue = word.ant[seed % word.ant.length];
    const { choices, correct } = wordChoices();
    return {
      id: `${word.id}:antonym:${index}`,
      word,
      type,
      prompt: `Which word is most nearly opposite in meaning to "${clue}"?`,
      choices,
      correct,
      answer: word.w,
    };
  }

  const { choices, correct } = wordChoices();
  return {
    id: `${word.id}:word:${index}`,
    word,
    type,
    prompt: `Which word means "${word.def}"?`,
    choices,
    correct,
    answer: word.w,
  };
}

function buildTestQuestions(deck: Word[]): TestQuestion[] {
  const unmastered = deck.filter(word => word.mastery < 0.8);
  if (!unmastered.length) return [];
  const mastered = deck.filter(word => word.mastery >= 0.8);
  const shuffle = (words: Word[]) => {
    const shuffled = [...words];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };
  const pool = shuffle(unmastered);
  if (pool.length < TEST_QUESTION_COUNT) pool.push(...shuffle(mastered));
  return pool
    .slice(0, Math.min(TEST_QUESTION_COUNT, pool.length))
    .map((word, index) => buildTestQuestion(word, deck, index));
}

type TestResult = {
  question: TestQuestion;
  correctAnswer: string;
  pickedAnswer: string | null;
  correct: boolean;
};

function Test({
  deck,
  onMark,
  onResetSet,
  setName,
}: {
  deck: Word[];
  onMark: (id: string, s: StudyStatus, mode: PracticeMode) => void;
  onResetSet: () => void;
  setName: string;
}) {
  const deckRef = useRef(deck);
  deckRef.current = deck;

  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [timeLeft, setTimeLeft] = useState(TEST_PER_Q_SECONDS);
  const [done, setDone] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const deckIds = deck.map(word => word.id).join("|");
  useEffect(() => {
    setQuestions(buildTestQuestions(deckRef.current));
    setQuestionIndex(0);
    setSelectedChoice(null);
    setResults([]);
    setTimeLeft(TEST_PER_Q_SECONDS);
    setDone(false);
    setConfirmReset(false);
  }, [deckIds]);

  const currentQuestion = questions[questionIndex];

  const optionState = useMemo(() => {
    if (!currentQuestion) return { choices: [] as string[], correct: 0 };
    return { choices: currentQuestion.choices, correct: currentQuestion.correct };
  }, [currentQuestion?.id, currentQuestion?.correct, currentQuestion?.choices]);

  const goNext = useCallback((wasCorrect: boolean) => {
    if (currentQuestion) {
      onMark(currentQuestion.word.id, wasCorrect ? "mastered" : "learning", "test");
      setResults(previousResults => [
        ...previousResults,
        {
          question: currentQuestion,
          correctAnswer: currentQuestion.answer,
          pickedAnswer: selectedChoice !== null ? optionState.choices[selectedChoice] : null,
          correct: wasCorrect,
        },
      ]);
    }
    if (questionIndex + 1 >= questions.length) {
      setDone(true);
    } else {
      setQuestionIndex(currentIndex => currentIndex + 1);
    }
  }, [currentQuestion, onMark, optionState.choices, questionIndex, questions.length, selectedChoice]);

  useEffect(() => {
    setTimeLeft(TEST_PER_Q_SECONDS);
    setSelectedChoice(null);
  }, [questionIndex]);

  useEffect(() => {
    if (done) return;
    if (!questions.length) return;
    if (timeLeft <= 0) {
      goNext(false);
      return;
    }
    const timerId = window.setTimeout(() => setTimeLeft(secondsLeft => secondsLeft - 1), 1000);
    return () => window.clearTimeout(timerId);
  }, [timeLeft, done, questions.length, goNext]);

  const restart = () => {
    setQuestions(buildTestQuestions(deckRef.current));
    setQuestionIndex(0);
    setSelectedChoice(null);
    setResults([]);
    setTimeLeft(TEST_PER_Q_SECONDS);
    setDone(false);
  };

  const resetAndStart = () => {
    onResetSet();
    setTimeout(() => {
      setQuestions(buildTestQuestions(deckRef.current));
      setQuestionIndex(0);
      setSelectedChoice(null);
      setResults([]);
      setTimeLeft(TEST_PER_Q_SECONDS);
      setDone(false);
      setConfirmReset(false);
    }, 0);
  };

  if (!deck.length) return <div style={{ color: mutedTextColor, textAlign: "center", padding: 40 }}>No words.</div>;
  if (deck.every(word => word.mastery >= 0.8) && !done && questions.length === 0) {
    return <MasteredSetPrompt setName={setName} onReset={resetAndStart} />;
  }

  if (done) {
    const correctCount = results.filter(result => result.correct).length;
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div
          style={{
            padding: "32px 28px",
            borderRadius: 16,
            background: cardBackground,
            border: `1px solid ${borderColor}`,
            boxShadow: "0 12px 32px -18px rgba(15,23,42,.12)",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: textColor }}>Session complete</h2>
            <p style={{ margin: "10px 0 24px", color: mutedTextColor, fontSize: 15 }}>
              {correctCount} / {results.length} correct
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {results.map((result, resultIndex) => (
              <div
                key={`${result.question.id}-${resultIndex}`}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: result.correct ? successBackground : errorBackground,
                  border: `1px solid ${result.correct ? successColor : errorColor}33`,
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: result.correct ? successColor : errorColor,
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
                  {result.correct ? "✓" : "✕"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: textColor }}>{result.question.word.w}</div>
                  <div style={{ fontSize: 13, color: mutedTextColor, marginTop: 2, lineHeight: 1.45 }}>
                    Correct: {result.correctAnswer}
                  </div>
                  {!result.correct && (
                    <div style={{ fontSize: 12, color: errorColor, marginTop: 3, lineHeight: 1.45 }}>
                      You picked: {result.pickedAnswer ?? "—"}
                    </div>
                  )}
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
              style={{ ...btnSecondary, padding: "0 24px", color: mutedTextColor }}
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
                background: cardBackground,
                border: `1px solid ${borderColor}`,
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
                  background: `${errorColor}1a`,
                  color: errorColor,
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
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: textColor, textAlign: "center" }}>
                Reset progress for this set?
              </h2>
              <p style={{ margin: "12px 0 8px", color: textColor, fontSize: 14, textAlign: "center", lineHeight: 1.55 }}>
                Mastery and learning history for{" "}
                <span style={{ fontWeight: 600 }}>{setName || "this set"}</span> will be cleared.
              </p>
              <p style={{ margin: "0 0 22px", color: mutedTextColor, fontSize: 13, textAlign: "center", lineHeight: 1.5 }}>
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
                    background: errorColor,
                    borderColor: errorColor,
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

  if (!currentQuestion) return null;

  const isTimeLow = timeLeft < 10;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeLabel = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          fontSize: 14,
          color: mutedTextColor,
        }}
      >
        <span>
          Question {questionIndex + 1} of {questions.length}
        </span>
        <span style={{ color: isTimeLow ? errorColor : mutedTextColor, fontWeight: 500 }}>{timeLabel} left</span>
      </div>

      <div
        style={{
          padding: "28px 32px",
          borderRadius: 16,
          background: cardBackground,
          border: `1px solid ${borderColor}`,
          boxShadow: "0 12px 32px -18px rgba(15,23,42,.12)",
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <p
            style={{
              fontFamily: '"Source Serif 4",serif',
              fontSize: 20,
              lineHeight: 1.55,
              margin: 0,
              color: textColor,
            }}
          >
            {currentQuestion.prompt}
          </p>
          {currentQuestion.context && (
            <div
              style={{
                marginTop: 14,
                padding: "14px 16px",
                borderRadius: 10,
                background: mutedSurface,
                border: `1px solid ${borderColor}`,
                color: textColor,
                fontSize: 15,
                lineHeight: 1.55,
              }}
            >
              {currentQuestion.context}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {optionState.choices.map((choice, choiceIndex) => {
            const isSelected = selectedChoice === choiceIndex;
            return (
              <button
                key={choiceIndex}
                onClick={() => setSelectedChoice(choiceIndex)}
                style={{
                  padding: "14px 16px",
                  borderRadius: 10,
                  cursor: "pointer",
                  textAlign: "left",
                  border: `1.5px solid ${isSelected ? primary : borderColor}`,
                  background: isSelected ? primaryTint : cardBackground,
                  color: textColor,
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
                    background: isSelected ? primary : "transparent",
                    border: `1.5px solid ${isSelected ? primary : mutedTextColor}`,
                    color: isSelected ? "#fff" : textColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 600,
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  {String.fromCharCode(65 + choiceIndex)}
                </span>
                <span style={{ fontSize: 15, lineHeight: 1.45 }}>{choice}</span>
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
            {Array.from({ length: questions.length }).map((_, stepIndex) => (
              <div
                key={stepIndex}
                style={{
                  width: 18,
                  height: 4,
                  borderRadius: 2,
                  background:
                    stepIndex < questionIndex
                      ? primary
                      : stepIndex === questionIndex
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
              disabled={selectedChoice === null}
              onClick={() => goNext(selectedChoice === optionState.correct)}
              style={{
                ...btnPrimary,
                padding: "0 22px",
                height: 42,
                opacity: selectedChoice === null ? 0.5 : 1,
                cursor: selectedChoice === null ? "not-allowed" : "pointer",
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

function Browse({
  deck,
  isDark,
  onResetSet,
}: {
  deck: Word[];
  isDark: boolean;
  onResetSet: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "new" | "learning" | "mastered">("all");
  const [confirmReset, setConfirmReset] = useState(false);

  const filtered = useMemo(() => {
    return deck.filter(word => {
      const normalizedSearch = searchQuery.toLowerCase();
      if (searchQuery && !word.w.toLowerCase().includes(normalizedSearch) && !word.def.toLowerCase().includes(normalizedSearch))
        return false;
      if (filter === "mastered") return word.mastery >= 0.8;
      if (filter === "learning") return word.mastery > 0 && word.mastery < 0.8;
      if (filter === "new") return word.mastery === 0;
      return true;
    });
  }, [searchQuery, filter, deck]);

  const filters: [typeof filter, string, number][] = [
    ["all", "All", deck.length],
    ["new", "New", deck.filter(word => word.mastery === 0).length],
    ["learning", "Learning", deck.filter(word => word.mastery > 0 && word.mastery < 0.8).length],
    ["mastered", "Mastered", deck.filter(word => word.mastery >= 0.8).length],
  ];

  const hasProgress = deck.some(word => word.mastery > 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={searchQuery}
          onChange={event => setSearchQuery(event.target.value)}
          placeholder="Search words or definitions"
          style={{
            flex: "1 1 280px",
            height: 44,
            borderRadius: 10,
            border: `1px solid ${borderColor}`,
            padding: "0 16px",
            fontSize: 14,
            fontFamily: "inherit",
            background: cardBackground,
            color: textColor,
          }}
        />
        <div
          style={{
            display: "flex",
            gap: 2,
            padding: 3,
            borderRadius: 10,
            background: mutedSurface,
            border: `1px solid ${borderColor}`,
            flexWrap: "wrap",
          }}
        >
          {filters.map(([id, label, count]) => {
            const isActive = filter === id;
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 7,
                  border: isActive ? `1px solid ${borderColor}` : "1px solid transparent",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  background: isActive ? "hsl(var(--background))" : "transparent",
                  color: isActive ? textColor : mutedTextColor,
                  boxShadow: isActive ? "0 1px 2px rgba(0,0,0,.1)" : "none",
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
                    background: isActive ? "hsl(var(--primary) / 0.15)" : "hsl(var(--border))",
                    color: isActive ? "hsl(var(--primary))" : mutedTextColor,
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
                border: `1px solid ${borderColor}`,
                background: cardBackground,
                color: mutedTextColor,
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
                  border: `1px solid ${borderColor}`,
                  background: cardBackground,
                  color: textColor,
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
                  border: `1px solid ${errorColor}`,
                  background: errorColor,
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

      <div style={{ borderRadius: 12, border: `1px solid ${borderColor}`, background: cardBackground, overflow: "hidden" }}>
        {filtered.map((word, rowIndex) => (
          <div
            key={word.id}
            className="vocab-row"
            style={{
              display: "grid",
              gridTemplateColumns: "200px auto 1fr",
              gap: 20,
              padding: "16px 20px",
              alignItems: "center",
              borderBottom: rowIndex < filtered.length - 1 ? `1px solid ${borderColor}` : "none",
              transition: "background .15s",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 500, color: textColor, letterSpacing: "-.01em" }}>{word.w}</div>
            <Tag pos={word.pos} isDark={isDark} />
            <div style={{ fontSize: 14, color: textColor, opacity: 0.8, lineHeight: 1.4 }}>{word.def}</div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: mutedTextColor, fontSize: 14 }}>No words match.</div>
        )}
      </div>
    </div>
  );
}

const Vocab = () => {
  const isDark = useThemeMode();
  const { user } = useAuth();
  const uid = user?.id ?? null;

  const [mode, setMode] = useState<Mode>("flashcards");
  const [activeSetId, setActiveSetId] = useState<string>(vocabularySets[0]?.id ?? "");
  const [progress, setProgress] = useState<StoredProgress>({});
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
          const next: StoredProgress = {};
          for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
            const normalized = normalizeProgressValue(v);
            if (normalized) next[k] = normalized;
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
    }

    if (user && db) {
      const ref = doc(db, "user_progress", user.id);
      setDoc(ref, { user_id: user.id, vocab: progress }, { merge: true }).catch(
        (err) => console.error("Failed to sync vocab to Firestore:", err),
      );
    }
  }, [progress, uid, user]);

  const markWord = (id: string, status: StudyStatus, mode: PracticeMode) => {
    setProgress(prev => {
      const current = prev[id] ?? progressFromStatus("new");
      const modes = { ...current.modes };
      let confirmations = current.confirmations;
      if (status === "mastered") {
        confirmations += 1;
        modes[mode] = (modes[mode] ?? 0) + 1;
      } else {
        confirmations = Math.max(0, confirmations - 1);
      }
      const next: StoredWordProgress = {
        status: deriveStatus(confirmations, modes, true),
        confirmations,
        modes,
      };
      if (
        current.status === next.status &&
        current.confirmations === next.confirmations &&
        PRACTICE_MODES.every(key => (current.modes[key] ?? 0) === (next.modes[key] ?? 0))
      ) {
        return prev;
      }
      return { ...prev, [id]: next };
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

  const activeSet = vocabularySets.find(set => set.id === activeSetId) ?? vocabularySets[0];

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
        progress[`${activeSet.id}::${w.word.toLowerCase()}`],
      ),
    );
  }, [activeSet, progress]);

  const setOptions = vocabularySets.map(s => ({ id: s.id, name: s.name }));
  const setStatuses = useMemo(() => {
    const next: Record<string, SetPickerStatus> = {};
    for (const set of vocabularySets) {
      const wordIds = set.words.map(w => `${set.id}::${w.word.toLowerCase()}`);
      const progressed = wordIds.filter(id => progress[id] && progress[id].status !== "new").length;
      const mastered = wordIds.filter(id => progress[id]?.status === "mastered").length;
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
    content = <Match deck={deck} isDark={isDark} onMark={markWord} onResetSet={resetActive} />;
  else if (mode === "test")
    content = (
      <Test deck={deck} onMark={markWord} onResetSet={resetActive} setName={activeSet?.name ?? ""} />
    );
  else if (mode === "browse") content = <Browse deck={deck} isDark={isDark} onResetSet={resetActive} />;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 40px 80px" }}>
      <style>{`.vocab-row:hover { background: hsl(var(--mutedTextColor)); }`}</style>
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
