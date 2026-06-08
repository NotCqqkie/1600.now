export const PERSONALIZATION_STORAGE_KEY = "personalization-preferences";
export const PERSONALIZATION_EVENT = "app-personalization-change";

export type QuestionFontId =
  | "default"
  | "georgia"
  | "times"
  | "inter"
  | "helvetica"
  | "mono";
export type QuestionTextSize =
  | "xsmall"
  | "small"
  | "default"
  | "large"
  | "xlarge";

export interface PersonalizationPreferences {
  font: QuestionFontId;
  textSize: QuestionTextSize;
}

export const DEFAULT_PERSONALIZATION: PersonalizationPreferences = {
  font: "default",
  textSize: "default",
};

export const FONT_OPTIONS: {
  id: QuestionFontId;
  label: string;
  stack: string;
}[] = [
  { id: "default", label: "Default (Noto Serif)", stack: "'Noto Serif', Georgia, 'Times New Roman', serif" },
  { id: "georgia", label: "Georgia", stack: "Georgia, 'Times New Roman', serif" },
  { id: "times", label: "Times New Roman", stack: "'Times New Roman', Times, serif" },
  { id: "inter", label: "Inter", stack: "Inter, 'Helvetica Neue', Arial, sans-serif" },
  { id: "helvetica", label: "Helvetica", stack: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { id: "mono", label: "Menlo (Mono)", stack: "Menlo, Consolas, 'Courier New', monospace" },
];

export const TEXT_SIZE_OPTIONS: {
  id: QuestionTextSize;
  label: string;
  scale: number;
}[] = [
  { id: "xsmall", label: "Extra Small", scale: 0.94 },
  { id: "small", label: "Small", scale: 1.06 },
  { id: "default", label: "Default", scale: 1.15 },
  { id: "large", label: "Large", scale: 1.32 },
  { id: "xlarge", label: "Extra Large", scale: 1.55 },
];

const fontStackFor = (id: QuestionFontId) =>
  FONT_OPTIONS.find((f) => f.id === id)?.stack ?? FONT_OPTIONS[0].stack;

const scaleFor = (id: QuestionTextSize) =>
  TEXT_SIZE_OPTIONS.find((s) => s.id === id)?.scale ?? 1;
let cachedRaw: string | null = null;
let cachedPrefs: PersonalizationPreferences = DEFAULT_PERSONALIZATION;

export const getPersonalizationPreferences = (): PersonalizationPreferences => {
  if (typeof window === "undefined") return DEFAULT_PERSONALIZATION;
  const raw = localStorage.getItem(PERSONALIZATION_STORAGE_KEY);
  if (raw === cachedRaw) return cachedPrefs;
  cachedRaw = raw;
  if (!raw) {
    cachedPrefs = DEFAULT_PERSONALIZATION;
    return cachedPrefs;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PersonalizationPreferences>;
    cachedPrefs = {
      font: FONT_OPTIONS.some((f) => f.id === parsed.font)
        ? (parsed.font as QuestionFontId)
        : DEFAULT_PERSONALIZATION.font,
      textSize: TEXT_SIZE_OPTIONS.some((s) => s.id === parsed.textSize)
        ? (parsed.textSize as QuestionTextSize)
        : DEFAULT_PERSONALIZATION.textSize,
    };
  } catch {
    cachedPrefs = DEFAULT_PERSONALIZATION;
  }
  return cachedPrefs;
};

const writePrefsToDocument = (prefs: PersonalizationPreferences) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--question-font-family", fontStackFor(prefs.font));
  root.style.setProperty("--question-font-scale", String(scaleFor(prefs.textSize)));
};

export const applyPersonalizationPreferences = (
  prefs: PersonalizationPreferences,
) => {
  writePrefsToDocument(prefs);

  if (typeof window !== "undefined") {
    localStorage.setItem(PERSONALIZATION_STORAGE_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new Event(PERSONALIZATION_EVENT));
  }
};
export const resetPersonalizationPreferences = () => {
  writePrefsToDocument(DEFAULT_PERSONALIZATION);

  if (typeof window !== "undefined") {
    localStorage.removeItem(PERSONALIZATION_STORAGE_KEY);
    window.dispatchEvent(new Event(PERSONALIZATION_EVENT));
  }
};

export const subscribeToPersonalization = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  const handleStorage = (event: StorageEvent) => {
    if (event.key === PERSONALIZATION_STORAGE_KEY) callback();
  };
  window.addEventListener(PERSONALIZATION_EVENT, callback);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(PERSONALIZATION_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
  };
};
if (typeof document !== "undefined") {
  const prefs = getPersonalizationPreferences();
  const root = document.documentElement;
  root.style.setProperty("--question-font-family", fontStackFor(prefs.font));
  root.style.setProperty("--question-font-scale", String(scaleFor(prefs.textSize)));
}
