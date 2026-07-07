import { useParams, useNavigate, useLocation, useSearchParams, type NavigateOptions, type To } from "react-router-dom";
import { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BankNavigationSheet } from "@/components/question/BankNavigationSheet";
import { PracticeNavigationSheet } from "@/components/practice/PracticeNavigationSheet";
import { QuestionNavigatorSheet } from "@/components/question/QuestionNavigatorSheet";
import { FormulaSheetDialog } from "@/components/tools/FormulaSheetDialog";
import { DesmosDialog } from "@/components/tools/DesmosDialog";
import { ExplanationWindow } from "@/components/question/ExplanationWindow";
import { ReadingPassageAnnotator } from "@/components/question/ReadingPassageAnnotator";
import { QuestionNotesWindow } from "@/components/question/QuestionNotesWindow";
import { ReportQuestionDialog } from "@/components/question/ReportQuestionDialog";
import { MultipleChoiceQuestion } from "@/components/question/MultipleChoiceQuestion";
import { PreviousAttemptsDialog } from "@/components/question/PreviousAttemptsDialog";
import { TransparentAwareImage } from "@/components/TransparentAwareImage";
import { PageSeo, buildBreadcrumbJsonLd } from "@/components/seo/PageSeo";
import { BookOpenCheck, ChevronLeft, ChevronRight, Check, Bookmark, Eye, EyeOff, Flag, Pause, Play, Strikethrough, Maximize2, Minimize2, Rows3, Columns3, Info, Highlighter, Moon, MoreHorizontal, StickyNote, Sun } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { questions as originalQuestions } from "@/data/hardQuestions";
import {
  getBankCounts,
  getResolvedAllSourceBankQuestions,
  getResolvedBankPool,
  loadBankQuestionRouteRefs,
  loadAllSourceBankQuestions,
  loadBankPool,
  loadQuestionSimilarityMeta,
  loadRouteIndexedBankQuestion,
  normalizeBankSource,
  type BankQuestion,
  type BankQuestionRouteRef,
  type BankQuestionSimilarityMeta,
  type BankSourceFilter,
} from "@/data/questionBank";
import type { LoadedPracticeModule, LoadedPracticeSet } from "@/data/modulePracticeBank";
import { PRACTICE_RUN_STORAGE_KEY } from "@/lib/practice/practiceRunStorage";
import { formatPracticeClock, formatPracticeClockPlaceholder } from "@/lib/practice/practiceTime";
import {
  getStoredQuestionViewMode,
  setStoredQuestionViewMode,
  type QuestionViewMode,
} from "@/lib/questionViewModeStorage";
import { cn, normalizePublicAssetPath } from "@/lib/utils";
import { getQuestionImageClassName } from "@/lib/questionImageDisplay";
import {
  questionImageAssetMetadataBySrc,
  questionImageDimensionsBySrc,
  type QuestionImageDisplaySize,
} from "@/data/questionImageSizing.generated";
import { collectQuestionImageUrls, preloadQuestionImages } from "@/lib/questionImagePreload";
import { answersEquivalent } from "@/lib/text/answerEquivalence";
import { renderMixedContent } from "@/lib/text/mathRendering";
import { normalizeReadingDisplayText } from "@/lib/text/readingTextNormalization";
import { applyTheme, useThemeMode } from "@/lib/theme";
import {
  advanceModulePracticeSessionTimer,
  buildModulePracticeResult,
  clearModulePracticeSession,
  getModulePracticeAnnotationStorageKey,
  getModulePracticeNoteStorageKey,
  getModulePracticeQuestionState,
  getModulePracticeSession,
  saveModulePracticeQuestionState,
  saveModulePracticeResult,
  saveModulePracticeSession,
  type ModulePracticeQuestionState,
  type ModulePracticeSessionMeta,
} from "@/lib/practice/modulePracticeSession";
import {
  advancePracticeTestActiveModuleTimer,
  buildPracticeTestSessionAfterCurrentModuleSubmit,
  buildPracticeTestResult,
  clearPracticeTestSession,
  getPracticeTestAnnotationStorageKey,
  getPracticeTestNoteStorageKey,
  getPracticeTestQuestionState,
  getPracticeTestSession,
  savePracticeTestQuestionState,
  savePracticeTestResult,
  savePracticeTestSession,
  type PracticeTestSessionMeta,
} from "@/lib/practice/practiceTestSession";
import { clearDesmosUiState, getDesmosStorageKeys } from "@/lib/practice/desmosSessionState";
import { useUserProgress } from "@/hooks/useUserProgress";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  getQuestionStatus as getStoredQuestionUiStatus,
  getQuestionUiState,
  getQuestionUiStates,
  saveQuestionUiState,
} from "@/lib/practice/questionUiState";

const HIDDEN_MEASUREMENT_STYLE = { visibility: 'hidden', pointerEvents: 'none' } as const;
const COUNT_UP_IDLE_PAUSE_MS = 15 * 60 * 1000;
const COUNT_UP_IDLE_DEMO_PAUSE_MS = 5 * 1000;

const getVisibleElementWidth = (element: HTMLElement) => {
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  return Math.min(element.offsetWidth, viewportWidth);
};

const setElementStyleProperty = (element: HTMLElement, property: string, value: string) => {
  if (element.style.getPropertyValue(property) !== value) {
    element.style.setProperty(property, value);
  }
};

const canScrollLockedPageTarget = (target: EventTarget | null, deltaY: number) => {
  if (!(target instanceof Element) || Math.abs(deltaY) < 1) return false;

  let element: Element | null = target;
  while (element && element !== document.body && element !== document.documentElement) {
    if (element instanceof HTMLElement) {
      const { overflowY } = window.getComputedStyle(element);
      const scrollable = overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
      const maxScrollTop = element.scrollHeight - element.clientHeight;

      if (scrollable && maxScrollTop > 1) {
        if (deltaY > 0 && element.scrollTop < maxScrollTop - 1) return true;
        if (deltaY < 0 && element.scrollTop > 1) return true;
      }
    }
    element = element.parentElement;
  }

  return false;
};

const hardQuestions = originalQuestions.map(originalQuestion => ({
  ...originalQuestion,
  uuid: `hard-${originalQuestion.id}`
}));

type ModulePracticeBankApi = typeof import("@/data/modulePracticeBank");
let loadedModulePracticeBank: ModulePracticeBankApi | null = null;
let modulePracticeBankPromise: Promise<ModulePracticeBankApi> | null = null;

const loadModulePracticeBank = (practiceDataTarget: string) => {
  const apiPromise = loadedModulePracticeBank
    ? Promise.resolve(loadedModulePracticeBank)
    : (modulePracticeBankPromise ??= import("@/data/modulePracticeBank").then((mod) => {
        loadedModulePracticeBank = mod;
        return mod;
      }));
  return apiPromise.then((mod) =>
    mod.ensurePracticeDataLoaded(practiceDataTarget).then(() => mod),
  );
};

type QuestionPreviewEmbedConfig = {
  subject: "math" | "reading";
  id: string;
  bankType?: BankSourceFilter;
  isDarkMode: boolean;
  onNavigate?: (to: string) => void;
  onOpenBank?: () => void;
  onReady?: () => void;
  questionLimit?: number;
};

type QuestionProps = {
  previewEmbed?: QuestionPreviewEmbedConfig;
};

const SAT_STYLE_IMAGE_BASE = "/images/SAT-Style%20Questions/";
const WHITE_BACKGROUND_BANK_IMAGE_PATTERN = /\.(?:png|jpe?g|webp)(?:$|[?#])/i;

const shouldReserveWhiteQuestionImageSpace = (src: string) =>
  src.startsWith(SAT_STYLE_IMAGE_BASE) && WHITE_BACKGROUND_BANK_IMAGE_PATTERN.test(src);

type LowerThanHysteresisArgs = {
  currentState: boolean;
  value: number;
  enterThreshold: number;
  exitThreshold: number;
};

const getNextStateForLowerThan = ({
  currentState,
  value,
  enterThreshold,
  exitThreshold,
}: LowerThanHysteresisArgs) => {
  if (currentState) {
    return value <= exitThreshold;
  }
  return value < enterThreshold;
};

type CenterOffsetArgs = {
  containerWidth: number;
  leftWidth: number;
  rightWidth: number;
  centerWidth: number;
  gap: number;
};

const getPushedCenterOffset = ({
  containerWidth,
  leftWidth,
  rightWidth,
  centerWidth,
  gap,
}: CenterOffsetArgs) => {
  const desiredLeft = containerWidth / 2 - centerWidth / 2;
  const minLeft = leftWidth + gap;
  const maxLeft = containerWidth - rightWidth - gap - centerWidth;
  const pushedLeft = minLeft <= maxLeft
    ? Math.min(Math.max(desiredLeft, minLeft), maxLeft)
    : Math.max(0, Math.min(containerWidth - centerWidth, (minLeft + maxLeft) / 2));

  return Math.round(pushedLeft - desiredLeft);
};

type PracticeSetItem = {
  id: number;
  index?: number;
  subject: "math" | "reading";
  bankType?: BankSourceFilter;
  sourceId?: string;
  storageId?: string;
  practiceSetId?: string;
  practiceSetNumber?: number;
  moduleSlug?: string;
  moduleNumber?: 1 | 2;
  moduleTitle?: string;
  moduleQuestionNumber?: number;
  globalQuestionNumber?: number;
};

type QuestionInfoField = {
  label: string;
  value: string;
};

const isBankQuestionWithUuid = (question: unknown): question is BankQuestion & { uuid: string } =>
  Boolean(question && typeof question === "object" && "stableId" in question);

type OrderedNavigationItem = {
  id: number;
  storageId: string;
};

type LoadedBankQuestionPoolState = {
  requestKey: string | null;
  questions: BankQuestion[];
  isLoading: boolean;
};

type LoadedBankRouteRefsState = {
  requestKey: string | null;
  refs: BankQuestionRouteRef[];
  isLoading: boolean;
};

type LoadedRouteIndexedQuestionState = {
  requestKey: string | null;
  question: BankQuestion | null;
  isLoading: boolean;
};

type CheckedQuestionStatus = "incorrect" | "correct-first" | "correct-later";
type CorrectQuestionStatus = "correct-first" | "correct-later";

const checkedQuestionStatuses = new Set<CheckedQuestionStatus>(["incorrect", "correct-first", "correct-later"]);
const correctQuestionStatuses = new Set<CorrectQuestionStatus>(["correct-first", "correct-later"]);

const isCheckedQuestionStatus = (status: string | undefined): status is CheckedQuestionStatus =>
  checkedQuestionStatuses.has(status as CheckedQuestionStatus);

const isCorrectQuestionStatus = (status: string | undefined): status is CorrectQuestionStatus =>
  correctQuestionStatuses.has(status as CorrectQuestionStatus);

const getNavigationOnlyQuestionUiPatch = (status: string) => ({
  answer: undefined,
  checkedAnswers: undefined,
  attemptCount: undefined,
  status,
});

const getGroupedQuestionOrderStorageKey = ({
  is100Hard,
  subject,
  bankSource,
}: {
  is100Hard: boolean;
  subject: "math" | "reading";
  bankSource: BankSourceFilter;
}) => {
  if (is100Hard) return "question-order:hard";
  return `question-order:bank:${subject}:${bankSource}`;
};

const readStoredQuestionOrder = (storageKey: string): number[] | null => {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is number => typeof value === "number") : null;
  } catch {
    return null;
  }
};

const reconcileQuestionOrder = (defaultOrder: number[], storedOrder: number[] | null): number[] => {
  if (!storedOrder || storedOrder.length === 0) return defaultOrder;

  const validIds = new Set(defaultOrder);
  const seen = new Set<number>();
  const ordered = storedOrder.filter((id) => {
    if (!validIds.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  if (ordered.length === 0) return defaultOrder;
  return [...ordered, ...defaultOrder.filter((id) => !seen.has(id))];
};

const QUESTION_SENTENCE_PATTERNS = [
  /^which choice\b/i,
  /^based on the\b/i,
  /^based on both texts\b/i,
  /^based on the two texts\b/i,
  /^according to the\b/i,
  /^what\b/i,
  /^which\b/i,
  /^how would the author\b/i,
  /^how does the author\b/i,
  /^how does the text\b/i,
  /^the student wants\b/i,
  /^as used in the text\b/i,
];

const TRAILING_QUESTION_STARTERS = [
  "which",
  "based on",
  "according to",
  "how would the author",
  "how does the author",
  "how does the text",
  "the student wants",
  "as used in the text",
  "what",
];

const extractTrailingQuestionSentence = (
  text: string,
): { sentence?: string; remainder: string } => {
  const trimmed = text.trim();
  if (!trimmed || !trimmed.endsWith("?")) {
    return { remainder: trimmed };
  }

  const startersAlt = TRAILING_QUESTION_STARTERS
    .map((starter) => starter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const boundaryRe = new RegExp(
    `(?:[.!?]|</u>|["”’)\\]])\\s+(?=(?:${startersAlt})\\b)`,
    "gi",
  );

  const boundaries = [...trimmed.matchAll(boundaryRe)];
  for (let boundaryIndex = boundaries.length - 1; boundaryIndex >= 0; boundaryIndex--) {
    const boundaryMatch = boundaries[boundaryIndex];
    const splitAt = boundaryMatch.index! + boundaryMatch[0].length;
    const before = trimmed.slice(0, splitAt).trim();
    const sentence = trimmed.slice(splitAt).trim();
    if (!before || !sentence) continue;
    if (!looksLikeQuestionSentence(sentence)) continue;
    return { sentence, remainder: before };
  }

  return { remainder: trimmed };
};

const PASSAGE_BLOCK_PATTERNS = [
  /^text 1\b/i,
  /^text 2\b/i,
  /^while researching a topic\b/i,
  /^the (?:table|graph|figure|chart)\b/i,
  /^for each data category\b/i,
  /^•\s/m,
];

const looksLikeQuestionSentence = (text: string): boolean => {
  const trimmed = text.trim();
  if (!trimmed || !trimmed.endsWith("?")) return false;
  return QUESTION_SENTENCE_PATTERNS.some((pattern) => pattern.test(trimmed));
};

const looksLikePassageBlock = (text: string): boolean => {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (PASSAGE_BLOCK_PATTERNS.some((pattern) => pattern.test(trimmed))) return true;
  if (/^text\s+\d+\b/im.test(trimmed)) return true;
  if (trimmed.includes("\n")) return true;
  if (!trimmed.endsWith("?") && trimmed.split(/\s+/).length >= 25) return true;
  return false;
};

const extractLeadingQuestionBeforePassageMarker = (
  text: string,
): { sentence?: string; remainder: string } | null => {
  const trimmed = text.trim();
  const match = trimmed.match(/^([\s\S]+?\?)\s+(Text\s+[1-4]\b[\s\S]*)$/i);
  if (!match) return null;

  const sentence = match[1].trim();
  const remainder = match[2].trim();
  if (!looksLikeQuestionSentence(sentence) || !looksLikePassageBlock(remainder)) return null;

  return { sentence, remainder };
};

const extractLeadingQuestionSentence = (text: string): { sentence?: string; remainder: string } => {
  const trimmed = text.trim();
  if (!trimmed) {
    return { remainder: trimmed };
  }

  const leadingQuestionBeforeMarker = extractLeadingQuestionBeforePassageMarker(trimmed);
  if (leadingQuestionBeforeMarker) return leadingQuestionBeforeMarker;

  const newlineIndex = trimmed.indexOf("\n");
  if (newlineIndex !== -1) {
    const firstLine = trimmed.slice(0, newlineIndex).trim();
    const rest = trimmed.slice(newlineIndex + 1).trim();
    if (
      firstLine &&
      rest &&
      looksLikeQuestionSentence(firstLine) &&
      looksLikePassageBlock(rest)
    ) {
      return { sentence: firstLine, remainder: rest };
    }
  }

  const lastNewlineIndex = trimmed.lastIndexOf("\n");
  if (lastNewlineIndex !== -1 && trimmed.endsWith("?")) {
    const before = trimmed.slice(0, lastNewlineIndex).trim();
    const lastLine = trimmed.slice(lastNewlineIndex + 1).trim();
    if (
      before &&
      lastLine &&
      looksLikeQuestionSentence(lastLine) &&
      looksLikePassageBlock(before)
    ) {
      return { sentence: lastLine, remainder: before };
    }
  }

  if (looksLikePassageBlock(trimmed)) {
    return { remainder: trimmed };
  }

  const match = trimmed.match(/^(.+?\?)(?:\s+|$)([\s\S]*)$/);
  if (!match) {
    return { remainder: trimmed };
  }

  const sentence = match[1].trim();
  const remainder = (match[2] || "").trim();

  if (!looksLikeQuestionSentence(sentence)) {
    return { remainder: trimmed };
  }

  if (remainder && !looksLikePassageBlock(remainder)) {
    return { remainder: trimmed };
  }

  return { sentence, remainder };
};

const extractReadingQuestionSentence = (text: string): { sentence?: string; remainder: string } => {
  const leading = extractLeadingQuestionSentence(text);
  if (leading.sentence) return leading;
  return extractTrailingQuestionSentence(text);
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const stripDuplicatedLeadingQuestion = (
  passage: string,
  questionSentence?: string,
): string => {
  const trimmedPassage = passage.trim();
  const trimmedQuestion = questionSentence?.trim();

  if (!trimmedPassage || !trimmedQuestion) {
    return trimmedPassage;
  }

  if (trimmedPassage === trimmedQuestion) {
    return trimmedPassage;
  }

  const duplicatePrefixPattern = new RegExp(
    `^${escapeRegExp(trimmedQuestion)}(?:\\s+|\\n+)+`,
    "i",
  );

  return trimmedPassage.replace(duplicatePrefixPattern, "").trim();
};

const getDefaultQuestionSplitPosition = (subject: "math" | "reading") =>
  subject === "reading" ? 55 : 50;

const READING_ANNOTATION_MODE_STORAGE_KEY = "question-reading-annotation-mode";
const QUESTION_BANK_HIDE_CHOICES_STORAGE_KEY = "question-bank-hide-answer-choices";
const QUESTION_BANK_STRIKEOUT_MODE_STORAGE_KEY = "question-bank-strikeout-mode";
const DESMOS_DEFAULT_SPLIT_POSITION = 70;
const QUESTION_HEADER_CONTAINER_MAX_WIDTH = 1400;
const QUESTION_CONTENT_MAX_WIDTH = 1280;

const questionBankViewerStorageData = new Map<string, string>();
let isQuestionBankViewerStorageActive = true;

const activateQuestionBankViewerStorage = () => {
  isQuestionBankViewerStorageActive = true;
};

const clearQuestionBankViewerStorage = () => {
  questionBankViewerStorageData.clear();
  isQuestionBankViewerStorageActive = false;
};

const isQuestionViewerPath = (pathname: string) =>
  /^\/hard\/[^/]+$/.test(pathname) ||
  /^\/bank\/(?:math|reading)\/(?!browse$)[^/]+$/.test(pathname);

const QUESTION_BANK_VIEWER_STORAGE: Storage = {
  get length() {
    return questionBankViewerStorageData.size;
  },
  clear: () => {
    questionBankViewerStorageData.clear();
  },
  getItem: (key) => questionBankViewerStorageData.get(key) ?? null,
  setItem: (key, value) => {
    if (!isQuestionBankViewerStorageActive) return;
    questionBankViewerStorageData.set(key, value);
  },
  removeItem: (key) => {
    questionBankViewerStorageData.delete(key);
  },
  key: (index) => Array.from(questionBankViewerStorageData.keys())[index] ?? null,
};

export function Question({ previewEmbed }: QuestionProps = {}) {
  const { id, subject: rawSubject } = useParams<{ id: string; subject?: string }>();
  const routerNavigate = useNavigate();
  const navigate = useCallback((to: To | number, options?: NavigateOptions) => {
    if (previewEmbed) {
      if (typeof to === "string") previewEmbed.onNavigate?.(to);
      return;
    }
    if (typeof to === "number") {
      routerNavigate(to);
      return;
    }
    routerNavigate(to, options);
  }, [previewEmbed, routerNavigate]);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isNativeEmbed = Boolean(previewEmbed);
  const [questionRootElement, setQuestionRootElement] = useState<HTMLDivElement | null>(null);
  const handleQuestionRootRef = useCallback((node: HTMLDivElement | null) => {
    setQuestionRootElement((current) => (current === node ? current : node));
  }, []);
  const requestedEmbed = isNativeEmbed || searchParams.get("embed") === "1";
  const inIframe = typeof window !== "undefined" && window.self !== window.top;
  useEffect(() => {
    if (!requestedEmbed || inIframe || isNativeEmbed) return;
    const stripped = new URLSearchParams(searchParams);
    stripped.delete("embed");
    stripped.delete("theme");
    navigate(
      { pathname: location.pathname, search: stripped.toString() ? `?${stripped}` : "" },
      { replace: true },
    );
  }, [requestedEmbed, inIframe, isNativeEmbed, navigate, location.pathname, searchParams]);
  const isEmbed = requestedEmbed && (inIframe || isNativeEmbed);
  const sharedIsDark = useThemeMode();
  const embedThemeParam = searchParams.get("theme");
  const [embedIsDark, setEmbedIsDark] = useState<boolean>(() =>
    previewEmbed
      ? previewEmbed.isDarkMode
      : embedThemeParam === "dark"
      ? true
      : embedThemeParam === "light"
        ? false
        : sharedIsDark,
  );
  const previewEmbedIsDarkMode = previewEmbed?.isDarkMode;
  useEffect(() => {
    if (previewEmbedIsDarkMode !== undefined) setEmbedIsDark(previewEmbedIsDarkMode);
  }, [previewEmbedIsDarkMode]);
  useEffect(() => {
    if (!isEmbed || isNativeEmbed || typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("dark", embedIsDark);
    root.style.colorScheme = embedIsDark ? "dark" : "light";
  }, [isEmbed, isNativeEmbed, embedIsDark]);
  useEffect(() => {
    if (!isEmbed || isNativeEmbed || typeof document === "undefined") return;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    let lastTouchX: number | null = null;
    let lastTouchY: number | null = null;
    const forwardScroll = (deltaX: number, deltaY: number) => {
      if (!deltaX && !deltaY) return;
      window.parent?.postMessage(
        { type: "homeDemoScroll", deltaX, deltaY },
        window.location.origin,
      );
    };
    const forwardWheel = (e: WheelEvent) => {
      e.preventDefault();
      forwardScroll(e.deltaX, e.deltaY);
    };
    const forwardTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        lastTouchX = null;
        lastTouchY = null;
        return;
      }
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
    };
    const forwardTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1 || lastTouchX === null || lastTouchY === null) return;
      const touch = e.touches[0];
      const deltaX = lastTouchX - touch.clientX;
      const deltaY = lastTouchY - touch.clientY;
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
      if (Math.abs(deltaX) + Math.abs(deltaY) < 1) return;
      e.preventDefault();
      forwardScroll(deltaX, deltaY);
    };
    const resetTouch = () => {
      lastTouchX = null;
      lastTouchY = null;
    };
    window.addEventListener("wheel", forwardWheel, { passive: false, capture: true });
    window.addEventListener("touchstart", forwardTouchStart, { passive: true, capture: true });
    window.addEventListener("touchmove", forwardTouchMove, { passive: false, capture: true });
    window.addEventListener("touchend", resetTouch, { capture: true });
    window.addEventListener("touchcancel", resetTouch, { capture: true });
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
      window.removeEventListener("wheel", forwardWheel, { capture: true });
      window.removeEventListener("touchstart", forwardTouchStart, { capture: true });
      window.removeEventListener("touchmove", forwardTouchMove, { capture: true });
      window.removeEventListener("touchend", resetTouch, { capture: true });
      window.removeEventListener("touchcancel", resetTouch, { capture: true });
    };
  }, [isEmbed, isNativeEmbed]);
  const isDark = isEmbed ? embedIsDark : sharedIsDark;
  const windowPortalContainer = isNativeEmbed ? questionRootElement : undefined;
  const windowBoundsElement = isNativeEmbed ? questionRootElement : undefined;

  const isBank = previewEmbed ? true : location.pathname.startsWith('/bank');
  const is100Hard = !isBank;

  const isPracticeMode = searchParams.get('practice') === 'true';
  const modulePracticeSlug = searchParams.get("modulePractice");
  const modulePracticeSessionId = searchParams.get("moduleSession");
  const practiceTestSetId = searchParams.get("practiceTest");
  const practiceTestSessionId = searchParams.get("practiceTestSession");
  const customPracticeId = searchParams.get("customPractice");
  const rawPracticeIndex = searchParams.get("idx");
  const bankSource = previewEmbed?.bankType ?? normalizeBankSource(searchParams.get("bankType"));
  const previewQuestionLimit = previewEmbed?.questionLimit ?? null;
  const embedNextClicksRef = useRef(0);
  const [showEmbedUpsell, setShowEmbedUpsell] = useState(false);
  const rawDifficulty = searchParams.get("difficulty");
  const difficultyFilter: "Easy" | "Medium" | "Hard" | null =
    rawDifficulty === "Easy" || rawDifficulty === "Medium" || rawDifficulty === "Hard"
      ? rawDifficulty
      : null;
  const bankQuerySuffix = isBank
    ? `?bankType=${bankSource}${isEmbed ? "&embed=1" : ""}${difficultyFilter ? `&difficulty=${difficultyFilter}` : ""}`
    : "";
  const practiceSet = useMemo<PracticeSetItem[]>(() => {
    if (!isPracticeMode) return [];
    try {
      return JSON.parse(sessionStorage.getItem('practiceSet') || '[]') as PracticeSetItem[];
    } catch {
      return [];
    }
  }, [isPracticeMode]);
  const hasActivePracticeSet = isPracticeMode && practiceSet.length > 0;
  const practiceRunId = isPracticeMode ? sessionStorage.getItem(PRACTICE_RUN_STORAGE_KEY) : null;
  const [practiceExitTo, setPracticeExitTo] = useState(() => sessionStorage.getItem("practiceExitTo"));
  useEffect(() => {
    setPracticeExitTo(sessionStorage.getItem("practiceExitTo"));
  }, [location.key]);
  const needsModulePracticeBank = Boolean(modulePracticeSlug || practiceTestSetId);
  const modulePracticeBankTarget = modulePracticeSlug ?? practiceTestSetId;
  const [modulePracticeBank, setModulePracticeBank] = useState<ModulePracticeBankApi | null>(() =>
    modulePracticeBankTarget && loadedModulePracticeBank?.isPracticeDataLoaded(modulePracticeBankTarget)
      ? loadedModulePracticeBank
      : null,
  );
  useEffect(() => {
    let cancelled = false;
    if (!modulePracticeBankTarget) {
      setModulePracticeBank(null);
      return;
    }
    if (loadedModulePracticeBank?.isPracticeDataLoaded(modulePracticeBankTarget)) {
      setModulePracticeBank(loadedModulePracticeBank);
      return;
    }
    setModulePracticeBank(null);
    loadModulePracticeBank(modulePracticeBankTarget).then((mod) => {
      if (!cancelled) setModulePracticeBank(mod);
    });
    return () => {
      cancelled = true;
    };
  }, [modulePracticeBankTarget]);
  const modulePracticeModule = useMemo<LoadedPracticeModule | null>(
    () => (modulePracticeSlug && modulePracticeBank ? modulePracticeBank.getLoadedPracticeModule(modulePracticeSlug) : null),
    [modulePracticeBank, modulePracticeSlug],
  );
  const practiceTestSet = useMemo<LoadedPracticeSet | null>(
    () => (practiceTestSetId && modulePracticeBank ? modulePracticeBank.getLoadedPracticeSet(practiceTestSetId) : null),
    [modulePracticeBank, practiceTestSetId],
  );
  const [modulePracticeSessionMeta, setModulePracticeSessionMeta] = useState<ModulePracticeSessionMeta | null>(() =>
    modulePracticeSlug ? getModulePracticeSession(modulePracticeSlug) : null,
  );
  const [practiceTestSessionMeta, setPracticeTestSessionMeta] = useState<PracticeTestSessionMeta | null>(() =>
    practiceTestSetId ? getPracticeTestSession(practiceTestSetId) : null,
  );

  const idParam = previewEmbed?.id ?? (id || "1");
  const hasNumericIdParam = /^\d+$/.test(idParam);
  const questionNumber = parseInt(idParam, 10);
  const subject = previewEmbed?.subject ?? ((rawSubject === "math" || rawSubject === "reading" ? rawSubject : "math") as "math" | "reading");
  const isMobile = useIsMobile();

  const moduleQuestion = useMemo(
    () =>
      modulePracticeBank && (modulePracticeSlug || practiceTestSetId)
        ? modulePracticeBank.getSynthesizedPracticeQuestion(subject, idParam, bankSource === "unofficial" ? "unofficial" : "past")
        : null,
    [bankSource, idParam, modulePracticeBank, modulePracticeSlug, practiceTestSetId, subject],
  );
  const bankQuestionPoolMode = hasActivePracticeSet ? "source" : "visible";
  const bankQuestionPoolRequestKey = useMemo(
    () => [subject, bankSource, bankQuestionPoolMode].join(":"),
    [bankQuestionPoolMode, bankSource, subject],
  );
  const needsBankQuestionPool =
    !is100Hard &&
    !moduleQuestion &&
    !(needsModulePracticeBank && !modulePracticeBank);
  const canUseRouteIndexedBankQuestion = needsBankQuestionPool && !hasActivePracticeSet;
  const bankRouteRefsRequestKey = useMemo(
    () => [subject, bankSource].join(":"),
    [bankSource, subject],
  );
  const routeIndexedQuestionRequestKey = useMemo(
    () => [subject, bankSource, idParam].join(":"),
    [bankSource, idParam, subject],
  );
  const [loadedBankRouteRefsData, setLoadedBankRouteRefsData] = useState<LoadedBankRouteRefsState>({
    requestKey: null,
    refs: [],
    isLoading: false,
  });
  const currentBankRouteRefs =
    loadedBankRouteRefsData.requestKey === bankRouteRefsRequestKey
      ? loadedBankRouteRefsData.refs
      : null;
  const [loadedRouteIndexedQuestionData, setLoadedRouteIndexedQuestionData] = useState<LoadedRouteIndexedQuestionState>({
    requestKey: null,
    question: null,
    isLoading: false,
  });
  const currentRouteIndexedQuestion =
    loadedRouteIndexedQuestionData.requestKey === routeIndexedQuestionRequestKey
      ? loadedRouteIndexedQuestionData.question
      : null;
  const isRouteIndexedQuestionLoading =
    canUseRouteIndexedBankQuestion &&
    (loadedRouteIndexedQuestionData.isLoading || loadedRouteIndexedQuestionData.requestKey !== routeIndexedQuestionRequestKey);
  const [loadedBankQuestionPoolData, setLoadedBankQuestionPoolData] = useState<LoadedBankQuestionPoolState>(() => {
    if (!needsBankQuestionPool) {
      return {
        requestKey: null,
        questions: [],
        isLoading: false,
      };
    }

    const resolvedQuestions = hasActivePracticeSet
      ? getResolvedAllSourceBankQuestions(subject, bankSource)
      : getResolvedBankPool(subject, bankSource);

    return resolvedQuestions
      ? {
          requestKey: bankQuestionPoolRequestKey,
          questions: resolvedQuestions,
          isLoading: false,
        }
      : {
          requestKey: null,
          questions: [],
          isLoading: false,
        };
  });
  const currentLoadedBankQuestionPool =
    loadedBankQuestionPoolData.requestKey === bankQuestionPoolRequestKey
      ? loadedBankQuestionPoolData.questions
      : null;
  const bankQuestionBySourceId = useMemo(() => {
    if (!currentLoadedBankQuestionPool) return null;
    return new Map(currentLoadedBankQuestionPool.map((question) => [question.sourceId, question]));
  }, [currentLoadedBankQuestionPool]);
  const isBankQuestionPoolLoading =
    needsBankQuestionPool &&
    (loadedBankQuestionPoolData.isLoading || loadedBankQuestionPoolData.requestKey !== bankQuestionPoolRequestKey);

  useEffect(() => {
    if (!canUseRouteIndexedBankQuestion) {
      setLoadedBankRouteRefsData({
        requestKey: null,
        refs: [],
        isLoading: false,
      });
      setLoadedRouteIndexedQuestionData({
        requestKey: null,
        question: null,
        isLoading: false,
      });
      return;
    }

    let cancelled = false;
    setLoadedBankRouteRefsData((current) =>
      current.requestKey === bankRouteRefsRequestKey
        ? current
        : {
            requestKey: bankRouteRefsRequestKey,
            refs: [],
            isLoading: true,
          },
    );
    setLoadedRouteIndexedQuestionData((current) =>
      current.requestKey === routeIndexedQuestionRequestKey
        ? current
        : {
            requestKey: routeIndexedQuestionRequestKey,
            question: null,
            isLoading: true,
          },
    );

    const refsPromise = loadBankQuestionRouteRefs(subject, bankSource);
    refsPromise
      .then((refs) => {
        if (cancelled) return;
        setLoadedBankRouteRefsData({
          requestKey: bankRouteRefsRequestKey,
          refs,
          isLoading: false,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load bank question route refs:', error);
        setLoadedBankRouteRefsData({
          requestKey: bankRouteRefsRequestKey,
          refs: [],
          isLoading: false,
        });
      });

    loadRouteIndexedBankQuestion(subject, idParam, bankSource)
      .then((question) => {
        if (cancelled) return;
        setLoadedRouteIndexedQuestionData({
          requestKey: routeIndexedQuestionRequestKey,
          question,
          isLoading: false,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load bank question:', error);
        setLoadedRouteIndexedQuestionData({
          requestKey: routeIndexedQuestionRequestKey,
          question: null,
          isLoading: false,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    bankRouteRefsRequestKey,
    bankSource,
    canUseRouteIndexedBankQuestion,
    idParam,
    routeIndexedQuestionRequestKey,
    subject,
  ]);

  useEffect(() => {
    if (!needsBankQuestionPool) return;
    if (canUseRouteIndexedBankQuestion) {
      setLoadedBankQuestionPoolData((current) =>
        current.requestKey === null && current.questions.length === 0 && !current.isLoading
          ? current
          : {
              requestKey: null,
              questions: [],
              isLoading: false,
            },
      );
      return;
    }

    const resolvedQuestions = hasActivePracticeSet
      ? getResolvedAllSourceBankQuestions(subject, bankSource)
      : getResolvedBankPool(subject, bankSource);

    if (resolvedQuestions) {
      setLoadedBankQuestionPoolData((current) =>
        current.requestKey === bankQuestionPoolRequestKey && current.questions === resolvedQuestions && !current.isLoading
          ? current
          : {
              requestKey: bankQuestionPoolRequestKey,
              questions: resolvedQuestions,
              isLoading: false,
            },
      );
      return;
    }

    let cancelled = false;
    setLoadedBankQuestionPoolData((current) =>
      current.requestKey === bankQuestionPoolRequestKey
        ? current
        : {
            requestKey: bankQuestionPoolRequestKey,
            questions: [],
            isLoading: true,
          },
    );

    const poolPromise = hasActivePracticeSet
      ? loadAllSourceBankQuestions(subject, bankSource)
      : loadBankPool(subject, bankSource);

    poolPromise
      .then((questions) => {
        if (cancelled) return;
        setLoadedBankQuestionPoolData({
          requestKey: bankQuestionPoolRequestKey,
          questions,
          isLoading: false,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load bank question pool:', error);
        setLoadedBankQuestionPoolData({
          requestKey: bankQuestionPoolRequestKey,
          questions: [],
          isLoading: false,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    bankQuestionPoolRequestKey,
    bankSource,
    canUseRouteIndexedBankQuestion,
    hasActivePracticeSet,
    needsBankQuestionPool,
    subject,
  ]);

  const questionData = useMemo(() => {
    if (is100Hard) {
      return hardQuestions.find(question => question.id === questionNumber) ?? null;
    }

    if (moduleQuestion) {
      return {
        ...moduleQuestion,
        uuid: moduleQuestion.stableId,
      };
    }

    if (canUseRouteIndexedBankQuestion && currentRouteIndexedQuestion) {
      return {
        ...currentRouteIndexedQuestion,
        uuid: currentRouteIndexedQuestion.stableId,
      };
    }

    if (!currentLoadedBankQuestionPool) return null;

    const sourceQuestionById = bankQuestionBySourceId?.get(idParam);
    const question =
      sourceQuestionById ??
      (hasNumericIdParam ? currentLoadedBankQuestionPool[questionNumber - 1] : null);

    return question ? { ...question, uuid: question.stableId } : null;
  }, [
    bankQuestionBySourceId,
    canUseRouteIndexedBankQuestion,
    currentLoadedBankQuestionPool,
    currentRouteIndexedQuestion,
    hasNumericIdParam,
    idParam,
    is100Hard,
    moduleQuestion,
    questionNumber,
  ]);
  const lastResolvedQuestionDataRef = useRef<typeof questionData>(null);
  const displayedQuestionData =
    questionData ?? (isRouteIndexedQuestionLoading ? lastResolvedQuestionDataRef.current : null);
  if (questionData) {
    lastResolvedQuestionDataRef.current = questionData;
  }
  const currentQuestionStableId = isBankQuestionWithUuid(displayedQuestionData) ? displayedQuestionData.stableId : null;
  const [similarityMetaByStableId, setSimilarityMetaByStableId] = useState<Record<string, BankQuestionSimilarityMeta | null>>({});
  const ensureCurrentSimilarityMeta = useCallback(async () => {
    if (!currentQuestionStableId || is100Hard) return null;
    if (Object.prototype.hasOwnProperty.call(similarityMetaByStableId, currentQuestionStableId)) {
      return similarityMetaByStableId[currentQuestionStableId] ?? null;
    }

    const meta = await loadQuestionSimilarityMeta(currentQuestionStableId);
    setSimilarityMetaByStableId((current) => ({
      ...current,
      [currentQuestionStableId]: meta,
    }));
    return meta;
  }, [currentQuestionStableId, is100Hard, similarityMetaByStableId]);
  const currentQuestion = useMemo(() => {
    if (!isBankQuestionWithUuid(displayedQuestionData)) return displayedQuestionData;
    const similarityMeta = similarityMetaByStableId[displayedQuestionData.stableId];
    return similarityMeta ? { ...displayedQuestionData, ...similarityMeta } : displayedQuestionData;
  }, [displayedQuestionData, similarityMetaByStableId]);
  const currentQuestionId = currentQuestion?.uuid;
  const resolvedQuestionNumber = (() => {
    if (!currentQuestion || is100Hard || !isBankQuestionWithUuid(currentQuestion)) {
      return questionNumber;
    }

    if (currentQuestion.id > 0) {
      return currentQuestion.id;
    }

    const sourceQuestionNumber = Number.parseInt(String(currentQuestion.questionNumber), 10);
    return Number.isFinite(sourceQuestionNumber) && sourceQuestionNumber > 0
      ? sourceQuestionNumber
      : questionNumber;
  })();
  useEffect(() => {
    if (previewEmbed && currentQuestion) previewEmbed.onReady?.();
  }, [currentQuestion, previewEmbed]);
  const isBankQuestionView = isBank && !modulePracticeSlug && !practiceTestSetId;
  const usesTransientQuestionAnswerUi = is100Hard || isBankQuestionView;
  const currentBankQuestion = !is100Hard && isBankQuestionWithUuid(currentQuestion) && currentQuestion.similarityGroupId
    ? currentQuestion
    : null;
  const currentExplanationQuestion = isBankQuestionWithUuid(currentQuestion) ? currentQuestion : null;
  const canCreateSimilarPracticeSet = Boolean(!isEmbed && isBankQuestionView && currentBankQuestion);
  const currentPracticeIndex = useMemo(() => {
    if (!isPracticeMode || practiceSet.length === 0) return -1;
    const matchesPracticeQuestion = (practiceQuestion: PracticeSetItem | undefined) => {
      if (!practiceQuestion || practiceQuestion.subject !== subject) return false;

      const matchesBankType = !practiceQuestion.bankType || practiceQuestion.bankType === bankSource;
      if (matchesBankType && practiceQuestion.sourceId === idParam) return true;
      if (practiceQuestion.storageId && practiceQuestion.storageId === currentQuestionId) return true;
      return hasNumericIdParam && matchesBankType && practiceQuestion.id === questionNumber;
    };
    const requestedIndex =
      rawPracticeIndex && /^\d+$/.test(rawPracticeIndex)
        ? Number.parseInt(rawPracticeIndex, 10) - 1
        : -1;

    if (
      requestedIndex >= 0 &&
      requestedIndex < practiceSet.length &&
      matchesPracticeQuestion(practiceSet[requestedIndex])
    ) {
      return requestedIndex;
    }

    return practiceSet.findIndex(matchesPracticeQuestion);
  }, [
    bankSource,
    currentQuestionId,
    hasNumericIdParam,
    idParam,
    isPracticeMode,
    practiceSet,
    questionNumber,
    rawPracticeIndex,
    subject,
  ]);
  const effectivePracticeMode = !is100Hard && isPracticeMode && practiceSet.length > 0 && currentPracticeIndex >= 0;
  const activeModulePracticeSessionId = modulePracticeSessionMeta?.sessionId ?? null;
  const modulePracticeSessionMatchesRoute =
    !modulePracticeSessionId || modulePracticeSessionId === activeModulePracticeSessionId;
  const modulePracticeStateSessionId =
    modulePracticeSessionMatchesRoute ? activeModulePracticeSessionId : null;
  const activePracticeTestSessionId = practiceTestSessionMeta?.sessionId ?? null;
  const practiceTestSessionMatchesRoute =
    !practiceTestSessionId || practiceTestSessionId === activePracticeTestSessionId;
  const practiceTestStateSessionId =
    practiceTestSessionMatchesRoute ? activePracticeTestSessionId : null;
  const isModulePracticeMode = Boolean(
    effectivePracticeMode &&
      modulePracticeSlug &&
      modulePracticeSessionMeta &&
      modulePracticeStateSessionId,
  );
  const isPracticeTestMode = Boolean(
    effectivePracticeMode &&
      practiceTestSetId &&
      practiceTestSessionMeta &&
      practiceTestStateSessionId,
  );
  const isAssessmentMode = isModulePracticeMode || isPracticeTestMode;
  const shouldUseSessionDesmosStorage = Boolean(
    !is100Hard &&
      isPracticeMode &&
      (practiceTestSetId || modulePracticeSlug || practiceSet.length > 0 || practiceRunId),
  );
  const desmosStorageArea = shouldUseSessionDesmosStorage
    ? sessionStorage
    : QUESTION_BANK_VIEWER_STORAGE;
  const desmosStorageScope = useMemo(() => {
    if (practiceTestStateSessionId) return `practice-test:${practiceTestStateSessionId}`;
    if (practiceTestSetId) return `practice-test:${practiceTestSetId}`;
    if (modulePracticeSlug) return `module-practice:${modulePracticeStateSessionId ?? modulePracticeSlug}`;
    if (!is100Hard && isPracticeMode) return `practice-set:${practiceRunId ?? "active"}`;
    if (isBank) return `question-bank:${bankSource}`;
    return "hard-questions";
  }, [
    bankSource,
    isBank,
    is100Hard,
    isPracticeMode,
    modulePracticeStateSessionId,
    modulePracticeSlug,
    practiceRunId,
    practiceTestSetId,
    practiceTestStateSessionId,
  ]);
  const desmosStorageKeys = useMemo(() => getDesmosStorageKeys(desmosStorageScope), [desmosStorageScope]);
  const desmosWindowStateKey = desmosStorageKeys.window;
  const desmosLayoutStateKey = desmosStorageKeys.layout;
  const desmosOpenStateKey = desmosStorageKeys.open;
  const desmosSplitPositionKey = desmosStorageKeys.splitPosition;
  const desmosCalculatorStorageScope = useMemo(() => {
    if (isPracticeTestMode && practiceTestStateSessionId && currentQuestionId) {
      return `practice-test:${practiceTestStateSessionId}:desmos:question:${currentQuestionId}`;
    }
    if (isModulePracticeMode && modulePracticeStateSessionId && currentQuestionId) {
      return `module-practice:${modulePracticeStateSessionId}:desmos:question:${currentQuestionId}`;
    }
    return null;
  }, [
    currentQuestionId,
    isModulePracticeMode,
    isPracticeTestMode,
    modulePracticeStateSessionId,
    practiceTestStateSessionId,
  ]);
  const desmosCalculatorStateKey = useMemo(
    () => (desmosCalculatorStorageScope ? getDesmosStorageKeys(desmosCalculatorStorageScope).calculator : undefined),
    [desmosCalculatorStorageScope],
  );
  const desmosCalculatorIdentityKey =
    desmosCalculatorStorageScope ?? `${desmosStorageScope}:transient-question:${currentQuestionId ?? "none"}`;
  const clearCurrentDesmosUiState = useCallback(() => {
    clearDesmosUiState(desmosStorageArea, desmosStorageScope);
  }, [desmosStorageArea, desmosStorageScope]);
  const restoreDesmosSplitPosition = useCallback(() => {
    const raw = desmosStorageArea.getItem(desmosSplitPositionKey);
    const stored = raw === null ? NaN : Number(raw);
    const nextPosition = Number.isFinite(stored)
      ? Math.max(35, Math.min(70, stored))
      : DESMOS_DEFAULT_SPLIT_POSITION;
    setSplitPosition(nextPosition);
  }, [desmosSplitPositionKey, desmosStorageArea]);
  const modulePracticeAllowsChecking = Boolean(
    isModulePracticeMode && modulePracticeSessionMeta?.settings.allowCheckingAnswers,
  );
  const practiceTestAllowsChecking = Boolean(
    isPracticeTestMode && practiceTestSessionMeta?.settings.allowCheckingAnswers,
  );
  const assessmentAllowsChecking = modulePracticeAllowsChecking || practiceTestAllowsChecking;
  const practiceTestIsTimed = Boolean(
    isPracticeTestMode && practiceTestSessionMeta?.settings.timed,
  );
  const practiceTestReviewPhase = Boolean(
    isPracticeTestMode && practiceTestSessionMeta?.phase === "review",
  );
  const practiceTestActiveModuleIndex = practiceTestSessionMeta?.activeModuleIndex ?? -1;
  const practiceTestActiveModule = useMemo(() => {
    if (!practiceTestSessionMeta || practiceTestActiveModuleIndex < 0) return null;
    return practiceTestSessionMeta.modules[practiceTestActiveModuleIndex] ?? null;
  }, [practiceTestActiveModuleIndex, practiceTestSessionMeta]);
  const practiceTestCurrentModuleStartIndex = practiceTestActiveModule?.startIndex ?? -1;
  const practiceTestCurrentModuleEndIndex = practiceTestActiveModule?.endIndex ?? -1;
  const practiceTestModuleQuestionCount = practiceTestActiveModule?.questionCount ?? 0;
  const practiceTestQuestionNumberInModule =
    practiceTestActiveModule && currentPracticeIndex >= 0
      ? currentPracticeIndex - practiceTestActiveModule.startIndex + 1
      : 0;

  const { user } = useAuth();
  const uid = user?.id ?? null;
  const { progress, addAttempt, toggleReview } = useUserProgress();

  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [freeResponseAnswer, setFreeResponseAnswer] = useState<string>("");
  const [strikeoutMode, setStrikeoutMode] = useState(
    () => QUESTION_BANK_VIEWER_STORAGE.getItem(QUESTION_BANK_STRIKEOUT_MODE_STORAGE_KEY) === "true",
  );
  const [hideAnswerChoices, setHideAnswerChoices] = useState(
    () => QUESTION_BANK_VIEWER_STORAGE.getItem(QUESTION_BANK_HIDE_CHOICES_STORAGE_KEY) === "true",
  );
  const [struckOutChoiceIds, setStruckOutChoiceIds] = useState<string[]>([]);
  const [checkButtonState, setCheckButtonState] = useState<"idle" | "incorrect" | "correct-first" | "correct-later">("idle");
  const [checkColorVisible, setCheckColorVisible] = useState(false);
  const [checkedAnswers, setCheckedAnswers] = useState<Record<string, boolean>>({});
  const [splitScreenWindows, setSplitScreenWindows] = useState<Set<string>>(new Set());
  const [sidebarredWindows, setSidebarredWindows] = useState<Set<string>>(new Set());
  const [splitPosition, setSplitPosition] = useState(DESMOS_DEFAULT_SPLIT_POSITION);
  const [attemptCount, setAttemptCount] = useState(0);
  const [shouldCompress, setShouldCompress] = useState(false);
  const [topShouldCompress, setTopShouldCompress] = useState(false);
  const [windowOrder, setWindowOrder] = useState<string[]>(['referenceSheet', 'desmos', 'explanation', 'note']);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [questionViewMode, setQuestionViewMode] = useState<QuestionViewMode>(() =>
    getStoredQuestionViewMode(subject, isBank),
  );
  const effectiveQuestionViewMode = isMobile ? "vertical" : questionViewMode;
  const questionSplitExitPosition =
    effectiveQuestionViewMode === "horizontal" || typeof window === "undefined"
      ? 100
      : Math.min(100, (1280 / Math.max(window.innerWidth, 1)) * 100);
  const sidebarExitContentSplitPosition =
    splitScreenWindows.size <= 1 ? questionSplitExitPosition : splitPosition;
  const effectiveTopShouldCompress = topShouldCompress;
  const [questionSplitPosition, setQuestionSplitPosition] = useState(() =>
    getDefaultQuestionSplitPosition(subject),
  );
  const [isResizingQuestionSplit, setIsResizingQuestionSplit] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [isTimerVisible, setIsTimerVisible] = useState(true);
  const [isIdleTimerPaused, setIsIdleTimerPaused] = useState(false);
  const [isIdleTimerPromptOpen, setIsIdleTimerPromptOpen] = useState(false);
  const [isTimerExpiredOpen, setIsTimerExpiredOpen] = useState(false);
  const [groupedOrderVersion, setGroupedOrderVersion] = useState(0);
  const [isQuestionInfoOpen, setIsQuestionInfoOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  useEffect(() => {
    setIsMoreMenuOpen(false);
  }, [currentQuestionId]);
  const [isNoteWindowOpen, setIsNoteWindowOpen] = useState(false);
  const [isAnnotationModeEnabled, setIsAnnotationModeEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(READING_ANNOTATION_MODE_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  });
  const [modulePracticeMarkedForReview, setModulePracticeMarkedForReview] = useState(false);
  const bottomNavRef = useRef<HTMLDivElement>(null);
  const questionContentRef = useRef<HTMLDivElement>(null);
  const bottomNavGridRef = useRef<HTMLDivElement>(null);
  const bottomNavLeftRef = useRef<HTMLDivElement>(null);
  const bottomNavCenterRef = useRef<HTMLDivElement>(null);
  const bottomNavRightRef = useRef<HTMLDivElement>(null);
  const bottomLeftMeasurementRef = useRef<HTMLDivElement>(null);
  const bottomMeasurementRef = useRef<HTMLDivElement>(null);
  const topNavRef = useRef<HTMLDivElement>(null);
  const topLeftRef = useRef<HTMLDivElement>(null);
  const topRightRef = useRef<HTMLDivElement>(null);
  const topRightControlsRef = useRef<HTMLDivElement>(null);
  const topTimerRef = useRef<HTMLDivElement>(null);
  const topLeftMeasurementRef = useRef<HTMLDivElement>(null);
  const topMeasurementRef = useRef<HTMLDivElement>(null);
  const topCompressStateRef = useRef(false);
  const bottomCompressStateRef = useRef(false);
  const toolbarSpaceCheckRef = useRef<(() => void) | null>(null);
  const startTimeRef = useRef(Date.now());
  const questionVisitStartedAtRef = useRef(Date.now());
  const timerLastSyncedAtRef = useRef(Date.now());
  const idleLastActivityAtRef = useRef(Date.now());
  const idleHiddenAtRef = useRef<number | null>(null);
  const idlePauseStartedAtRef = useRef<number | null>(null);
  const isIdleTimerPausedRef = useRef(false);
  const hasIdleTimerPromptShownRef = useRef(false);
  const manualTimerPauseStartedAtRef = useRef<number | null>(null);
  const isTimerPausedRef = useRef(false);
  const modulePracticeSessionMetaRef = useRef<ModulePracticeSessionMeta | null>(modulePracticeSessionMeta);
  const practiceTestSessionMetaRef = useRef<PracticeTestSessionMeta | null>(practiceTestSessionMeta);
  const hasTimerExpiredRef = useRef(false);
  const usesCountdownTimer = Boolean(
    (isPracticeTestMode && practiceTestIsTimed) ||
      (isModulePracticeMode && modulePracticeSessionMeta?.settings.timed),
  );
  const idleTimerMsParam = searchParams.get("idleTimerMs");
  const idleTimerDemoParam = searchParams.get("idleTimerDemo");
  const idleTimerTimeoutOverride = Number.parseInt(idleTimerMsParam || "", 10);
  const idleTimerTimeoutMs = Number.isFinite(idleTimerTimeoutOverride) && idleTimerTimeoutOverride >= 1000
    ? idleTimerTimeoutOverride
    : idleTimerDemoParam === "1"
      ? COUNT_UP_IDLE_DEMO_PAUSE_MS
      : COUNT_UP_IDLE_PAUSE_MS;
  const shouldUseIdleTimerPause = Boolean(currentQuestionId && !isEmbed && !usesCountdownTimer);

  useEffect(() => {
    modulePracticeSessionMetaRef.current = modulePracticeSessionMeta;
  }, [modulePracticeSessionMeta]);

  useEffect(() => {
    practiceTestSessionMetaRef.current = practiceTestSessionMeta;
  }, [practiceTestSessionMeta]);

  useEffect(() => {
    isIdleTimerPausedRef.current = isIdleTimerPaused;
  }, [isIdleTimerPaused]);

  useEffect(() => {
    isTimerPausedRef.current = isTimerPaused;
  }, [isTimerPaused]);

  useEffect(() => {
    if (!modulePracticeSlug) {
      setModulePracticeSessionMeta(null);
      return;
    }
    setModulePracticeSessionMeta(getModulePracticeSession(modulePracticeSlug));
  }, [location.key, modulePracticeSlug]);

  useEffect(() => {
    if (!practiceTestSetId) {
      setPracticeTestSessionMeta(null);
      return;
    }
    setPracticeTestSessionMeta(getPracticeTestSession(practiceTestSetId));
  }, [location.key, practiceTestSetId]);

  const syncAssessmentTimer = useCallback((now = Date.now(), updateState = true) => {
    const elapsedMs = Math.max(0, now - timerLastSyncedAtRef.current);
    timerLastSyncedAtRef.current = now;
    if (!elapsedMs) return null;
    if (isIdleTimerPausedRef.current || isTimerPausedRef.current) {
      if (isPracticeTestMode) return practiceTestSessionMetaRef.current;
      if (isModulePracticeMode) return modulePracticeSessionMetaRef.current;
      return null;
    }

    if (isPracticeTestMode) {
      const previous = practiceTestSessionMetaRef.current;
      if (!previous || previous.status !== "active") return previous;

      const next = advancePracticeTestActiveModuleTimer(previous, elapsedMs);
      if (next === previous) return previous;

      practiceTestSessionMetaRef.current = next;
      savePracticeTestSession(next);

      const nextActiveModule = next.modules[next.activeModuleIndex];
      if (updateState) {
        setPracticeTestSessionMeta(next);
      }
      if (updateState && nextActiveModule) {
        setElapsedSeconds(nextActiveModule.elapsedSeconds);
      }
      return next;
    }

    if (isModulePracticeMode) {
      const previous = modulePracticeSessionMetaRef.current;
      if (!previous || previous.status !== "active") return previous;
      if (previous.settings.timed && previous.remainingSeconds === 0) {
        if (updateState && !hasTimerExpiredRef.current) {
          hasTimerExpiredRef.current = true;
          setIsTimerExpiredOpen(true);
        }
        return previous;
      }

      const next = advanceModulePracticeSessionTimer(previous, elapsedMs);
      if (next === previous) return previous;

      modulePracticeSessionMetaRef.current = next;
      saveModulePracticeSession(next);
      if (updateState) {
        setModulePracticeSessionMeta(next);
        setElapsedSeconds(next.elapsedSeconds);
      }

      if (updateState && next.remainingSeconds === 0 && previous.remainingSeconds !== 0 && !hasTimerExpiredRef.current) {
        hasTimerExpiredRef.current = true;
        setIsTimerExpiredOpen(true);
      }
      return next;
    }

    return null;
  }, [isModulePracticeMode, isPracticeTestMode]);

  const currentProgress = currentQuestionId ? (progress[currentQuestionId] || { isMarkedForReview: false, attempts: [] }) : { isMarkedForReview: false, attempts: [] };
  const localStateKey = currentQuestion
    ? (is100Hard ? `question-${questionNumber}` : currentQuestion.uuid)
    : `question-${questionNumber}`;
  const readModulePracticeQuestionState = useCallback((): ModulePracticeQuestionState | null => {
    if (!currentQuestionId) return null;
    if (isPracticeTestMode && practiceTestStateSessionId) {
      return getPracticeTestQuestionState(practiceTestStateSessionId, currentQuestionId);
    }
    if (isModulePracticeMode && modulePracticeStateSessionId) {
      return getModulePracticeQuestionState(modulePracticeStateSessionId, currentQuestionId);
    }
    return null;
  }, [
    currentQuestionId,
    isModulePracticeMode,
    isPracticeTestMode,
    modulePracticeStateSessionId,
    practiceTestStateSessionId,
  ]);
  const persistModulePracticeQuestionState = useCallback((
    updater: (
      previous: ModulePracticeQuestionState,
    ) => ModulePracticeQuestionState,
  ) => {
    if (!currentQuestionId) return null;
    if (isPracticeTestMode && practiceTestStateSessionId) {
      const previous = getPracticeTestQuestionState(
        practiceTestStateSessionId,
        currentQuestionId,
      );
      const next = updater(previous);
      savePracticeTestQuestionState(
        practiceTestStateSessionId,
        currentQuestionId,
        next,
      );
      return next;
    }
    if (!isModulePracticeMode || !modulePracticeStateSessionId) return null;
    const previous = getModulePracticeQuestionState(
      modulePracticeStateSessionId,
      currentQuestionId,
    );
    const next = updater(previous);
    saveModulePracticeQuestionState(
      modulePracticeStateSessionId,
      currentQuestionId,
      next,
    );
    return next;
  }, [
    currentQuestionId,
    isModulePracticeMode,
    isPracticeTestMode,
    modulePracticeStateSessionId,
    practiceTestStateSessionId,
  ]);
  const markedForReview = isAssessmentMode
    ? modulePracticeMarkedForReview
    : currentProgress.isMarkedForReview;
  const questionInfo = useMemo(() => {
    if (!currentQuestion || is100Hard || isAssessmentMode) return null;

    const questionWithMetadata = currentQuestion as Partial<{
      bankLabel: string;
      subject: "math" | "reading";
      sourceId: string;
      correctAnswer?: string | null;
      difficulty?: "Easy" | "Medium" | "Hard" | null;
      scoreBand?: number | null;
      similarityTag?: string | null;
      similarityGroupLabel?: string | null;
      category?: {
        domain?: string;
        skill?: string;
      };
    }>;

    const sourceSubject = questionWithMetadata.subject || subject;
    const subjectLabel = sourceSubject === "reading" ? "Reading and Writing" : "Math";

    const fields: QuestionInfoField[] = [
      { label: "Section", value: subjectLabel },
      {
        label: "Difficulty",
        value: typeof questionWithMetadata.scoreBand === "number"
          ? `${questionWithMetadata.scoreBand} / 10`
          : "Unassigned",
      },
      { label: "Domain", value: questionWithMetadata.category?.domain || "Unassigned" },
      { label: "Skill", value: questionWithMetadata.category?.skill || "Unassigned" },
      { label: "Similarity Tag", value: questionWithMetadata.similarityGroupLabel || questionWithMetadata.similarityTag || "Unassigned" },
    ];

    return {
      fields,
    };
  }, [currentQuestion, is100Hard, isAssessmentMode, subject]);
  const baseNavigationItems = useMemo<OrderedNavigationItem[]>(() => {
    if (is100Hard) {
      return Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        storageId: `question-${i + 1}`,
      }));
    }

    if (isBank && previewQuestionLimit !== null) {
      return Array.from({ length: previewQuestionLimit }, (_, index) => ({
        id: index + 1,
        storageId: `preview-${subject}-${bankSource}-${index + 1}`,
      }));
    }

    if (isBank) {
      if (currentBankRouteRefs) {
        return currentBankRouteRefs
          .filter((question) => !difficultyFilter || question.difficulty === difficultyFilter)
          .map((question) => ({
            id: question.id,
            storageId: question.stableId,
          }));
      }

      return (currentLoadedBankQuestionPool ?? [])
        .filter((question) => !difficultyFilter || question.difficulty === difficultyFilter)
        .map((question) => ({
          id: question.id,
          storageId: question.stableId,
        }));
    }

    return [];
  }, [
    bankSource,
    currentBankRouteRefs,
    currentLoadedBankQuestionPool,
    difficultyFilter,
    is100Hard,
    isBank,
    previewQuestionLimit,
    subject,
  ]);

  const groupedOrderStorageKey = useMemo(
    () =>
      getGroupedQuestionOrderStorageKey({
        is100Hard,
        subject,
        bankSource,
      }),
    [bankSource, is100Hard, subject],
  );

  const groupedQuestionOrder = useMemo(
    () => {
      void groupedOrderVersion;
      return readStoredQuestionOrder(groupedOrderStorageKey);
    },
    [groupedOrderStorageKey, groupedOrderVersion],
  );

  const orderedNavigationItems = useMemo<OrderedNavigationItem[]>(() => {
    if (baseNavigationItems.length === 0) return [];
    if (previewQuestionLimit !== null) return baseNavigationItems;

    const defaultOrder = baseNavigationItems.map((item) => item.id);
    const resolvedOrder = reconcileQuestionOrder(
      defaultOrder,
      groupedQuestionOrder,
    );
    const itemMap = new Map(baseNavigationItems.map((item) => [item.id, item]));

    return resolvedOrder
      .map((id) => itemMap.get(id))
      .filter((item): item is OrderedNavigationItem => Boolean(item));
  }, [baseNavigationItems, groupedQuestionOrder, previewQuestionLimit]);
  const orderedQuestionIds = useMemo(
    () => orderedNavigationItems.map((item) => item.id),
    [orderedNavigationItems],
  );
  const orderedQuestionIndexById = useMemo(
    () => new Map(orderedQuestionIds.map((id, index) => [id, index])),
    [orderedQuestionIds],
  );

  useEffect(() => {
    setQuestionViewMode(getStoredQuestionViewMode(subject, isBank));
  }, [isBank, subject]);

  useEffect(() => {
    if (effectiveQuestionViewMode !== "horizontal") return;
    setQuestionSplitPosition(getDefaultQuestionSplitPosition(subject));
  }, [effectiveQuestionViewMode, idParam, subject, isBank]);

  useEffect(() => {
    localStorage.setItem(
      READING_ANNOTATION_MODE_STORAGE_KEY,
      String(isAnnotationModeEnabled),
    );
  }, [isAnnotationModeEnabled]);

  const handleQuestionViewModeChange = (mode: QuestionViewMode) => {
    if (isMobile && mode === "horizontal") return;
    setStoredQuestionViewMode(subject, isBank, mode);
    setQuestionViewMode(mode);
  };

  const handleStrikeoutModeToggle = () => {
    setStrikeoutMode((prev) => {
      const next = !prev;
      QUESTION_BANK_VIEWER_STORAGE.setItem(QUESTION_BANK_STRIKEOUT_MODE_STORAGE_KEY, String(next));
      return next;
    });
  };

  const handleHideAnswerChoicesChange = (checked: boolean) => {
    QUESTION_BANK_VIEWER_STORAGE.setItem(QUESTION_BANK_HIDE_CHOICES_STORAGE_KEY, String(checked));
    setHideAnswerChoices(checked);
  };

  useEffect(() => {
    startTimeRef.current = Date.now();
    questionVisitStartedAtRef.current = Date.now();
    timerLastSyncedAtRef.current = Date.now();
    idleLastActivityAtRef.current = Date.now();
    idleHiddenAtRef.current = null;
    idlePauseStartedAtRef.current = null;
    isIdleTimerPausedRef.current = false;
    hasIdleTimerPromptShownRef.current = false;
    manualTimerPauseStartedAtRef.current = null;
    isTimerPausedRef.current = false;
    hasTimerExpiredRef.current = false;
    setIsIdleTimerPaused(false);
    setIsIdleTimerPromptOpen(false);
    setIsTimerExpiredOpen(false);

    if (isPracticeTestMode && practiceTestActiveModule) {
      setElapsedSeconds(practiceTestActiveModule.elapsedSeconds);
      setIsTimerPaused(false);
      return;
    }

    if (isModulePracticeMode && modulePracticeSessionMeta) {
      setElapsedSeconds(modulePracticeSessionMeta.elapsedSeconds);
      setIsTimerPaused(false);
      return;
    }

    setElapsedSeconds(0);
    setIsTimerPaused(false);
    setIsTimerVisible(true);
  }, [
    currentQuestionId,
    isModulePracticeMode,
    isPracticeTestMode,
    modulePracticeSessionMeta?.sessionId,
    practiceTestActiveModule?.moduleSlug,
    practiceTestSessionMeta?.sessionId,
  ]);

  useEffect(() => {
    if (isIdleTimerPaused) return;
    if (isTimerPaused) return;

    if (isPracticeTestMode && practiceTestSessionMeta && practiceTestActiveModule) {
      if (practiceTestSessionMeta.status !== "active") {
        return;
      }

      timerLastSyncedAtRef.current = Date.now();
      const timerId = window.setInterval(() => {
        if (idleHiddenAtRef.current !== null) return;
        syncAssessmentTimer();
      }, 1000);

      return () => {
        syncAssessmentTimer(Date.now(), false);
        window.clearInterval(timerId);
      };
    }

    if (isModulePracticeMode && modulePracticeSessionMeta) {
      timerLastSyncedAtRef.current = Date.now();
      const timerId = window.setInterval(() => {
        if (idleHiddenAtRef.current !== null) return;
        syncAssessmentTimer();
      }, 1000);

      return () => {
        syncAssessmentTimer(Date.now(), false);
        window.clearInterval(timerId);
      };
    }

    const timerId = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.round((Date.now() - startTimeRef.current) / 1000)));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [
    isIdleTimerPaused,
    isTimerPaused,
    isModulePracticeMode,
    isPracticeTestMode,
    modulePracticeSessionMeta,
    practiceTestActiveModule,
    practiceTestSessionMeta,
    modulePracticeSessionMeta?.sessionId,
    syncAssessmentTimer,
  ]);

  const isSplitScreenActive = splitScreenWindows.size > 0;

  useLayoutEffect(() => {
    if (!isBank || isEmbed) return;

    const root = document.documentElement;
    const body = document.body;
    let frameId: number | null = null;
    let scrollResetFrameId: number | null = null;
    let isScrollLocked = false;

    const resetScrollPosition = () => {
      if (scrollResetFrameId !== null) return;
      scrollResetFrameId = requestAnimationFrame(() => {
        scrollResetFrameId = null;
        if (isScrollLocked && window.scrollY !== 0) {
          window.scrollTo({ left: window.scrollX, top: 0 });
        }
      });
    };

    const setScrollLocked = (locked: boolean) => {
      isScrollLocked = locked;
      root.classList.toggle("question-page-scroll-locked", locked);
      body.classList.toggle("question-page-scroll-locked", locked);
      if (locked) {
        resetScrollPosition();
      }
    };

    const preventLockedScroll = (event: WheelEvent | TouchEvent) => {
      if (!isScrollLocked) return;
      if ("touches" in event && event.touches.length >= 2) return;
      if ("deltaY" in event && canScrollLockedPageTarget(event.target, event.deltaY)) return;
      event.preventDefault();
      resetScrollPosition();
    };

    const preventLockedKeyScroll = (event: KeyboardEvent) => {
      if (!isScrollLocked) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, [contenteditable='true']")) return;
      if (![" ", "PageDown", "PageUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      resetScrollPosition();
    };

    const handleLockedScroll = () => {
      if (!isScrollLocked || window.scrollY === 0) return;
      resetScrollPosition();
    };

    const updateScrollLock = () => {
      frameId = null;
      const content = questionContentRef.current;
      const bottomNav = bottomNavRef.current;
      if (!content || !bottomNav) {
        setScrollLocked(false);
        return;
      }

      const contentRect = content.getBoundingClientRect();
      const bottomNavRect = bottomNav.getBoundingClientRect();
      const contentDocumentTop = contentRect.top + window.scrollY;
      const availableContentHeight = window.innerHeight - bottomNavRect.height - contentDocumentTop;

      setScrollLocked(contentRect.height <= availableContentHeight + 1);
    };

    const scheduleScrollLockUpdate = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(updateScrollLock);
    };

    const resizeObserver = new ResizeObserver(scheduleScrollLockUpdate);
    if (questionContentRef.current) resizeObserver.observe(questionContentRef.current);
    if (bottomNavRef.current) resizeObserver.observe(bottomNavRef.current);
    window.addEventListener("resize", scheduleScrollLockUpdate);
    window.visualViewport?.addEventListener("resize", scheduleScrollLockUpdate);
    window.addEventListener("wheel", preventLockedScroll, { capture: true, passive: false });
    window.addEventListener("touchmove", preventLockedScroll, { capture: true, passive: false });
    window.addEventListener("keydown", preventLockedKeyScroll, { capture: true });
    window.addEventListener("scroll", handleLockedScroll, { passive: true });
    scheduleScrollLockUpdate();
    const settleCheckIds = [50, 150, 300].map((delay) => window.setTimeout(scheduleScrollLockUpdate, delay));

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      if (scrollResetFrameId !== null) cancelAnimationFrame(scrollResetFrameId);
      settleCheckIds.forEach((id) => window.clearTimeout(id));
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleScrollLockUpdate);
      window.visualViewport?.removeEventListener("resize", scheduleScrollLockUpdate);
      window.removeEventListener("wheel", preventLockedScroll, { capture: true });
      window.removeEventListener("touchmove", preventLockedScroll, { capture: true });
      window.removeEventListener("keydown", preventLockedKeyScroll, { capture: true });
      window.removeEventListener("scroll", handleLockedScroll);
      setScrollLocked(false);
    };
  }, [
    currentQuestionId,
    effectiveQuestionViewMode,
    isBank,
    isEmbed,
    isSplitScreenActive,
    subject,
  ]);

  useEffect(() => {
    restoreDesmosSplitPosition();
  }, [restoreDesmosSplitPosition]);

  useLayoutEffect(() => {
    const checkSpace = () => {
      if (
        bottomNavGridRef.current &&
        bottomNavCenterRef.current &&
        bottomLeftMeasurementRef.current &&
        bottomMeasurementRef.current
      ) {
        const gridGap = Number.parseFloat(getComputedStyle(bottomNavGridRef.current).columnGap || "8") || 8;
        const containerWidth = getVisibleElementWidth(bottomNavGridRef.current);
        const leftNaturalWidth = bottomLeftMeasurementRef.current.scrollWidth;
        const rightNaturalWidth = bottomMeasurementRef.current.scrollWidth;
        const navSheetButton = bottomNavCenterRef.current.querySelector<HTMLElement>("[data-question-navigator-trigger]");
        const navSheetWidth = navSheetButton
          ? Math.max(navSheetButton.scrollWidth, navSheetButton.offsetWidth)
          : 120;
        const requiredWidth = leftNaturalWidth + navSheetWidth + rightNaturalWidth + gridGap * 2;
        const currentlyCompressed = bottomCompressStateRef.current;
        const nextCompressed = getNextStateForLowerThan({
          currentState: currentlyCompressed,
          value: containerWidth,
          enterThreshold: requiredWidth,
          exitThreshold: requiredWidth + 24,
        });

        if (nextCompressed !== currentlyCompressed) {
          bottomCompressStateRef.current = nextCompressed;
          setShouldCompress(nextCompressed);
        }
      }

      if (
        bottomNavCenterRef.current &&
        bottomNavLeftRef.current &&
        bottomNavRightRef.current &&
        bottomNavGridRef.current
      ) {
        const gridGap = Number.parseFloat(getComputedStyle(bottomNavGridRef.current).columnGap || "8") || 8;
        const containerWidth = getVisibleElementWidth(bottomNavGridRef.current);
        const leftWidth = bottomNavLeftRef.current.offsetWidth;
        const rightWidth = bottomNavRightRef.current.offsetWidth;
        const navSheetButton = bottomNavCenterRef.current.querySelector<HTMLElement>("[data-question-navigator-trigger]");
        const centerWidth = navSheetButton
          ? Math.max(navSheetButton.scrollWidth, navSheetButton.offsetWidth)
          : bottomNavCenterRef.current.offsetWidth;

        const nextOffset = getPushedCenterOffset({
          containerWidth,
          leftWidth,
          rightWidth,
          centerWidth,
          gap: gridGap,
        });

        setElementStyleProperty(bottomNavCenterRef.current, "--sat-bottom-center-offset", `${nextOffset}px`);
      }

      if (topNavRef.current && topLeftRef.current && topRightControlsRef.current && topTimerRef.current) {
        const containerWidth = getVisibleElementWidth(topNavRef.current);
        const leftWidth = topLeftRef.current.offsetWidth;
        const rightControlsWidth = topRightControlsRef.current.offsetWidth;
        const timerWidth = topTimerRef.current.offsetWidth;
        const navGap = Number.parseFloat(getComputedStyle(topNavRef.current).columnGap || "12") || 12;

        const nextOffset = getPushedCenterOffset({
          containerWidth,
          leftWidth,
          rightWidth: rightControlsWidth,
          centerWidth: timerWidth,
          gap: navGap,
        });

        setElementStyleProperty(topTimerRef.current, "--sat-top-timer-offset", `${nextOffset}px`);
      }

      if (topNavRef.current && topMeasurementRef.current && topLeftMeasurementRef.current && topTimerRef.current) {
        const containerWidth = getVisibleElementWidth(topNavRef.current);
        const navGap = Number.parseFloat(getComputedStyle(topNavRef.current).columnGap || "12") || 12;
        const leftNaturalWidth = topLeftMeasurementRef.current.scrollWidth;
        const rightNaturalWidth = topMeasurementRef.current.scrollWidth;
        const timerWidth = topTimerRef.current.offsetWidth;
        const requiredWidth = leftNaturalWidth + timerWidth + rightNaturalWidth + navGap * 2;
        const currentlyCompressed = topCompressStateRef.current;

        const nextCompressed = getNextStateForLowerThan({
          currentState: currentlyCompressed,
          value: containerWidth,
          enterThreshold: requiredWidth,
          exitThreshold: requiredWidth + 24,
        });

        if (nextCompressed !== currentlyCompressed) {
          topCompressStateRef.current = nextCompressed;
          setTopShouldCompress(nextCompressed);
        }
      }
    };

    toolbarSpaceCheckRef.current = checkSpace;

    let frameId: number | null = null;
    const scheduleCheck = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(() => {
        frameId = null;
        checkSpace();
      });
    };

    const resizeObserver = new ResizeObserver(() => {
      scheduleCheck();
    });

    if (topNavRef.current) {
      resizeObserver.observe(topNavRef.current);
      if (topLeftRef.current) resizeObserver.observe(topLeftRef.current);
      if (topRightRef.current) resizeObserver.observe(topRightRef.current);
      if (topRightControlsRef.current) resizeObserver.observe(topRightControlsRef.current);
      if (topTimerRef.current) resizeObserver.observe(topTimerRef.current);
    }
    if (bottomNavRef.current) {
      resizeObserver.observe(bottomNavRef.current);
      const navSheet = bottomNavRef.current.querySelector('[data-nav-sheet]');
      if (navSheet instanceof HTMLElement) resizeObserver.observe(navSheet);
      if (bottomNavLeftRef.current) resizeObserver.observe(bottomNavLeftRef.current);
      if (bottomNavCenterRef.current) resizeObserver.observe(bottomNavCenterRef.current);
      if (bottomNavRightRef.current) resizeObserver.observe(bottomNavRightRef.current);
    }
    if (topMeasurementRef.current) resizeObserver.observe(topMeasurementRef.current);
    if (topLeftMeasurementRef.current) resizeObserver.observe(topLeftMeasurementRef.current);
    if (bottomLeftMeasurementRef.current) resizeObserver.observe(bottomLeftMeasurementRef.current);
    if (bottomMeasurementRef.current) resizeObserver.observe(bottomMeasurementRef.current);

    window.addEventListener('resize', scheduleCheck);
    window.visualViewport?.addEventListener('resize', scheduleCheck);
    scheduleCheck();
    const settleCheckIds = [50, 150, 300].map((delay) => window.setTimeout(scheduleCheck, delay));

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      if (toolbarSpaceCheckRef.current === checkSpace) toolbarSpaceCheckRef.current = null;
      settleCheckIds.forEach((id) => window.clearTimeout(id));
      window.removeEventListener('resize', scheduleCheck);
      window.visualViewport?.removeEventListener('resize', scheduleCheck);
      resizeObserver.disconnect();
    };
  }, [
    assessmentAllowsChecking,
    currentProgress.attempts.length,
    currentPracticeIndex,
    currentQuestionId,
    effectivePracticeMode,
    isAssessmentMode,
    isEmbed,
    isMobile,
    orderedNavigationItems.length,
    practiceSet.length,
    subject,
  ]);

  useLayoutEffect(() => {
    toolbarSpaceCheckRef.current?.();
  });

  useEffect(() => {
    if (!isResizingQuestionSplit) return;

    document.body.classList.add("noselect", "col-resize-active");

    const handleMouseMove = (e: MouseEvent) => {
      const availableWidth = isSplitScreenActive
        ? (window.innerWidth * splitPosition) / 100
        : window.innerWidth;
      const newPosition = (e.clientX / availableWidth) * 100;
      const clampedPosition = Math.max(25, Math.min(75, newPosition));
      setQuestionSplitPosition(clampedPosition);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      e.preventDefault();
      const touch = e.touches[0];
      const availableWidth = isSplitScreenActive
        ? (window.innerWidth * splitPosition) / 100
        : window.innerWidth;
      const newPosition = (touch.clientX / availableWidth) * 100;
      const clampedPosition = Math.max(25, Math.min(75, newPosition));
      setQuestionSplitPosition(clampedPosition);
    };

    const stopResizing = () => {
      setIsResizingQuestionSplit(false);
      document.body.classList.remove("noselect", "col-resize-active");
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', stopResizing);
    document.addEventListener('touchcancel', stopResizing);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResizing);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', stopResizing);
      document.removeEventListener('touchcancel', stopResizing);
      document.body.classList.remove("noselect", "col-resize-active");
    };
  }, [isResizingQuestionSplit, isSplitScreenActive, splitPosition]);

  useEffect(() => {
    setIsFullscreen(Boolean(document.fullscreenElement));
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleSplitScreenChange = useCallback((isSplit: boolean, windowId: string) => {
    setSplitScreenWindows(prev => {
      const newSet = new Set(prev);
      if (isSplit) newSet.add(windowId);
      else newSet.delete(windowId);
      return newSet;
    });
  }, []);

  const handleSidebarToggle = useCallback((windowId: string, shouldBeSidebarred: boolean) => {
    setSidebarredWindows(prev => {
      const newSet = new Set(prev);
      if (shouldBeSidebarred) newSet.add(windowId);
      else newSet.delete(windowId);
      return newSet;
    });
  }, []);

  const handleSplitPositionChange = useCallback((newPosition: number) => {
    const roundedPosition = Math.round(newPosition * 4) / 4;
    setSplitPosition(prev => (Math.abs(prev - roundedPosition) < 0.25 ? prev : roundedPosition));
    requestAnimationFrame(() => toolbarSpaceCheckRef.current?.());
    if (sidebarredWindows.has("desmos")) {
      desmosStorageArea.setItem(desmosSplitPositionKey, String(roundedPosition));
    }
  }, [desmosSplitPositionKey, desmosStorageArea, sidebarredWindows]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen?.();
    } else {
      void document.exitFullscreen?.();
    }
  };

  const bringToFront = (windowId: string) => {
    setWindowOrder(prev => {
      const newOrder = prev.filter(id => id !== windowId);
      newOrder.push(windowId);
      return newOrder;
    });
  };

  const getZIndex = (windowId: string) => {
    const index = windowOrder.indexOf(windowId);
    return 50 + index * 20;
  };

  useEffect(() => {
    if (isSplitScreenActive) {
      document.documentElement.style.setProperty('--modal-center-x', `${splitPosition / 2}%`);
      document.documentElement.style.setProperty('--sat-split-pct', `${splitPosition}%`);
      document.documentElement.style.setProperty('--sat-content-split-pct', `${splitPosition}%`);
      document.documentElement.style.setProperty('--sat-nav-split-pct', `${splitPosition}%`);
    } else {
      document.documentElement.style.removeProperty('--modal-center-x');
      document.documentElement.style.removeProperty('--sat-split-pct');
      document.documentElement.style.removeProperty('--sat-content-split-pct');
      document.documentElement.style.removeProperty('--sat-nav-split-pct');
      document.documentElement.style.removeProperty('--sat-header-content-width');
      document.documentElement.style.removeProperty('--sat-header-content-offset-x');
      document.documentElement.style.removeProperty('--sat-main-content-width');
      document.documentElement.style.removeProperty('--sat-main-content-offset-x');
    }
    return () => {
      document.documentElement.style.removeProperty('--modal-center-x');
      document.documentElement.style.removeProperty('--sat-split-pct');
      document.documentElement.style.removeProperty('--sat-content-split-pct');
      document.documentElement.style.removeProperty('--sat-nav-split-pct');
      document.documentElement.style.removeProperty('--sat-header-content-width');
      document.documentElement.style.removeProperty('--sat-header-content-offset-x');
      document.documentElement.style.removeProperty('--sat-main-content-width');
      document.documentElement.style.removeProperty('--sat-main-content-offset-x');
    };
  }, [isSplitScreenActive, splitPosition]);

  useLayoutEffect(() => {
    if (!currentQuestion) return;
    if (isAssessmentMode) {
      const state = readModulePracticeQuestionState();
      setSelectedAnswer(state?.answer || "");
      setFreeResponseAnswer(state?.freeResponseAnswer || "");
      setCheckedAnswers(state?.checkedAnswers || {});
      setAttemptCount(state?.attemptCount || 0);
      setStruckOutChoiceIds(state?.struckOutChoiceIds || []);
      setModulePracticeMarkedForReview(Boolean(state?.isMarkedForReview));
      if (
        state?.status === "incorrect" ||
        state?.status === "correct-first" ||
        state?.status === "correct-later"
      ) {
        setCheckButtonState(state.status);
      } else {
        setCheckButtonState("idle");
      }
      return;
    }

    const state = getQuestionUiState(localStateKey, uid);
    if (usesTransientQuestionAnswerUi) {
      const storedStatus = state.status || "unanswered";
      if (state.answer !== undefined || state.checkedAnswers !== undefined || state.attemptCount !== undefined) {
        saveQuestionUiState(
          localStateKey,
          getNavigationOnlyQuestionUiPatch(storedStatus),
          uid,
          { notify: false },
        );
      }
      setSelectedAnswer("");
      setFreeResponseAnswer("");
      setCheckedAnswers({});
      setCheckButtonState("idle");
      setAttemptCount(0);
      setStruckOutChoiceIds([]);
      return;
    }

    setSelectedAnswer(currentQuestion.type === "multiple-choice" ? state.answer || "" : "");
    setFreeResponseAnswer(currentQuestion.type === "free-response" ? state.answer || "" : "");
    setCheckedAnswers(state.checkedAnswers || {});
    if (
      state.status === "incorrect" ||
      state.status === "correct-first" ||
      state.status === "correct-later"
    ) {
      setCheckButtonState(state.status);
    } else {
      setCheckButtonState("idle");
    }
    setAttemptCount(state.attemptCount || Object.keys(state.checkedAnswers || {}).length);
    setStruckOutChoiceIds([]);
  }, [currentQuestion, isAssessmentMode, localStateKey, questionNumber, readModulePracticeQuestionState, uid, usesTransientQuestionAnswerUi]);

  useEffect(() => {
    if (checkButtonState === "idle") {
      setCheckColorVisible(false);
      return;
    }
    setCheckColorVisible(true);
  }, [checkButtonState]);

  const emphasizeReadingHeaders = (content: string): string => {
    const fullLineHeaderPatterns = [
      /^text\s*\d+$/i,
      /^while researching a topic, a student has taken the following notes:?$/i,
      /^notes:?$/i,
      /^impact of .+$/i,
    ];

    const partialLineHeaderPatterns = [
      /^the following text(?:s)?\b/i,
      /^the student wants\b/i,
    ];

    const findIntroBoundary = (line: string): number | null => {
      const sentenceBoundaryMatch = line.match(/[.?!]["”’')\]]?(?=\s+[A-Z["“'(<])/);
      if (sentenceBoundaryMatch?.index !== undefined) {
        return sentenceBoundaryMatch.index + sentenceBoundaryMatch[0].length;
      }

      const colonBoundaryMatch = line.match(/:(?=\s+[A-Z["“'(<])/);
      if (colonBoundaryMatch?.index !== undefined) {
        return colonBoundaryMatch.index + 1;
      }

      return null;
    };

    let seenContent = false;
    return content
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        const normalizedHeader = trimmed.replace(/^text\s*(\d+)$/i, "Text $1");
        if (fullLineHeaderPatterns.some((pattern) => pattern.test(trimmed) || pattern.test(normalizedHeader))) {
          const style = seenContent
            ? "display:block;line-height:1.45;margin-top:1.2em;margin-bottom:0.35em;"
            : "display:block;line-height:1.45;margin-bottom:0.35em;";
          seenContent = true;
          return line.replace(trimmed, `<strong style="${style}">${normalizedHeader}</strong>`);
        }

        seenContent = true;

        if (!partialLineHeaderPatterns.some((pattern) => pattern.test(trimmed))) {
          return line;
        }

        const boundary = findIntroBoundary(trimmed);
        if (!boundary) {
          return line.replace(trimmed, `<strong>${trimmed}</strong>`);
        }

        const intro = trimmed.slice(0, boundary).trimEnd();
        const remainder = trimmed.slice(boundary);
        return line.replace(trimmed, `<strong>${intro}</strong>${remainder}`);
      })
      .join("\n")
      .replace(/(<strong style="display:block[^"]*">[^<]*<\/strong>)\n+/g, "$1")
      .replace(/\n+(<strong style="display:block)/g, "$1")
      .replace(/^\n+/, "");
  };

  const promoteLeadingReadingHeader = (html: string): string => {
    if (subject !== "reading" || !html) return html;

    return html.replace(
      /^\s*<strong>([\s\S]*?)<\/strong>(?:<br\s*\/?>\s*)?/i,
      (_match, inner: string) =>
        `<strong style="display:block;line-height:1.45;margin-bottom:0.35em;">${inner.trim()}</strong>`,
    );
  };

  const getRenderedContentHtml = (
    content: string,
    options: {
      emphasizeHeaders?: boolean;
    } = {},
  ) => {
    if (!content) return "";
    const { emphasizeHeaders = true } = options;
    const formattedContent =
      subject === "reading"
        ? emphasizeHeaders
          ? emphasizeReadingHeaders(normalizeReadingDisplayText(content))
          : normalizeReadingDisplayText(content)
        : content;
    return promoteLeadingReadingHeader(
      renderMixedContent(formattedContent, {
        normalizeMath: subject === "math",
      }),
    );
  };

  const renderContent = (
    content: string,
    options: {
      emphasizeHeaders?: boolean;
    } = {},
  ) => {
    if (!content) return null;
    const html = getRenderedContentHtml(content, options);
    return (
      <div
        className="text-foreground break-words prose prose-stone dark:prose-invert max-w-none"
        style={{ fontFamily: "var(--question-font-family, 'Noto Serif', serif)", fontSize: "calc(1rem * var(--question-font-scale, 1))", lineHeight: "1.73" }}
      >
        <span
          style={{ display: "block", width: "100%" }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  };

  const totalQuestions = useMemo(() => {
    if (is100Hard) return 100;
    if (effectivePracticeMode) return practiceSet.length;
    if (previewQuestionLimit !== null) return previewQuestionLimit;
    if (isBank && orderedNavigationItems.length > 0) return orderedNavigationItems.length;
    if (subject) {
      const counts = getBankCounts(bankSource);
      return counts[subject] || 0;
    }
    return 0;
  }, [is100Hard, effectivePracticeMode, practiceSet, previewQuestionLimit, isBank, orderedNavigationItems, subject, bankSource]);

  const currentOrderedQuestionIndex = useMemo(
    () => orderedQuestionIndexById.get(resolvedQuestionNumber) ?? -1,
    [orderedQuestionIndexById, resolvedQuestionNumber],
  );
  useEffect(() => {
    preloadQuestionImages(collectQuestionImageUrls(currentQuestion), "high");
  }, [currentQuestion]);
  useEffect(() => {
    let cancelled = false;
    const preloadAdjacentQuestion = (
      adjacentSubject: "math" | "reading",
      adjacentId: string | number | undefined,
      adjacentBankSource: BankSourceFilter,
    ) => {
      if (adjacentId === undefined || adjacentId === null) return;
      loadRouteIndexedBankQuestion(adjacentSubject, String(adjacentId), adjacentBankSource)
        .then((question) => {
          if (!cancelled) {
            preloadQuestionImages(collectQuestionImageUrls(question), "low");
          }
        })
        .catch(() => {
          // Adjacent-question image preload is best-effort; ignore failures.
        });
    };

    if (effectivePracticeMode) {
      [practiceSet[currentPracticeIndex - 1], practiceSet[currentPracticeIndex + 1]].forEach((item) => {
        if (!item) return;
        preloadAdjacentQuestion(
          item.subject,
          item.sourceId ?? item.id,
          item.bankType ?? bankSource,
        );
      });
    } else if (canUseRouteIndexedBankQuestion && currentOrderedQuestionIndex >= 0) {
      [orderedQuestionIds[currentOrderedQuestionIndex - 1], orderedQuestionIds[currentOrderedQuestionIndex + 1]]
        .forEach((adjacentId) => preloadAdjacentQuestion(subject, adjacentId, bankSource));
    }

    return () => {
      cancelled = true;
    };
  }, [
    bankSource,
    canUseRouteIndexedBankQuestion,
    currentOrderedQuestionIndex,
    currentPracticeIndex,
    effectivePracticeMode,
    orderedQuestionIds,
    practiceSet,
    subject,
  ]);
  const displayQuestionNumber = isPracticeTestMode
    ? practiceTestQuestionNumberInModule || currentPracticeIndex + 1
    : effectivePracticeMode
      ? currentPracticeIndex + 1
      : resolvedQuestionNumber;
  const canGoPrevious = is100Hard
    ? currentOrderedQuestionIndex > 0
    : isPracticeTestMode
      ? currentPracticeIndex > practiceTestCurrentModuleStartIndex
    : effectivePracticeMode
      ? currentPracticeIndex > 0
      : currentOrderedQuestionIndex > 0;
  const canGoNext = is100Hard
    ? currentOrderedQuestionIndex >= 0 && currentOrderedQuestionIndex < totalQuestions - 1
    : isPracticeTestMode
      ? currentPracticeIndex < practiceTestCurrentModuleEndIndex
    : effectivePracticeMode
      ? currentPracticeIndex < totalQuestions - 1
      : currentOrderedQuestionIndex >= 0 && currentOrderedQuestionIndex < totalQuestions - 1;
  const isAtPreviewQuestionLimit = Boolean(
    previewQuestionLimit !== null &&
      currentOrderedQuestionIndex >= previewQuestionLimit - 1,
  );
  const shouldShowEmbedUpsellBeforeAdvance = useCallback(() => {
    if (!isEmbed) return false;
    if (previewQuestionLimit !== null) return isAtPreviewQuestionLimit;
    const nextClicks = embedNextClicksRef.current + 1;
    embedNextClicksRef.current = nextClicks;
    return nextClicks >= 2;
  }, [isAtPreviewQuestionLimit, isEmbed, previewQuestionLimit]);

  const flushModulePracticeQuestionTime = useCallback((updateState = true, now = Date.now()) => {
    syncAssessmentTimer(now, updateState);
    if (!isAssessmentMode || !currentQuestionId) return;
    if (isIdleTimerPausedRef.current) {
      questionVisitStartedAtRef.current = now;
      return;
    }
    const delta = Math.max(
      0,
      Math.round((now - questionVisitStartedAtRef.current) / 1000),
    );
    if (!delta) return;
    persistModulePracticeQuestionState((previous) => ({
      ...previous,
      timeSpentSeconds: previous.timeSpentSeconds + delta,
    }));
    questionVisitStartedAtRef.current = now;
  }, [currentQuestionId, isAssessmentMode, persistModulePracticeQuestionState, syncAssessmentTimer]);

  const resumeIdleTimer = useCallback(() => {
    const now = Date.now();
    const pausedAt = idlePauseStartedAtRef.current;
    if (pausedAt !== null) {
      startTimeRef.current += Math.max(0, now - pausedAt);
    }
    idlePauseStartedAtRef.current = null;
    idleLastActivityAtRef.current = now;
    questionVisitStartedAtRef.current = now;
    timerLastSyncedAtRef.current = now;
    isIdleTimerPausedRef.current = false;
    setIsIdleTimerPaused(false);
    setIsIdleTimerPromptOpen(false);
  }, []);

  const pauseTimerForIdle = useCallback((pauseAt = Date.now()) => {
    if (isIdleTimerPausedRef.current || isTimerPausedRef.current || hasIdleTimerPromptShownRef.current || !shouldUseIdleTimerPause) return;
    if (isAssessmentMode) {
      flushModulePracticeQuestionTime(true, pauseAt);
    } else {
      setElapsedSeconds(Math.max(0, Math.round((pauseAt - startTimeRef.current) / 1000)));
    }
    questionVisitStartedAtRef.current = pauseAt;
    timerLastSyncedAtRef.current = pauseAt;
    idlePauseStartedAtRef.current = pauseAt;
    isIdleTimerPausedRef.current = true;
    hasIdleTimerPromptShownRef.current = true;
    setIsIdleTimerPaused(true);
    setIsIdleTimerPromptOpen(true);
  }, [flushModulePracticeQuestionTime, isAssessmentMode, shouldUseIdleTimerPause]);

  const pauseCountUpTimer = useCallback(() => {
    const now = Date.now();
    if (isAssessmentMode) {
      flushModulePracticeQuestionTime(true, now);
    } else {
      setElapsedSeconds(Math.max(0, Math.round((now - startTimeRef.current) / 1000)));
    }
    manualTimerPauseStartedAtRef.current = now;
    questionVisitStartedAtRef.current = now;
    timerLastSyncedAtRef.current = now;
    isTimerPausedRef.current = true;
    setIsTimerPaused(true);
  }, [flushModulePracticeQuestionTime, isAssessmentMode]);

  const resumeCountUpTimer = useCallback(() => {
    const now = Date.now();
    const pausedAt = manualTimerPauseStartedAtRef.current;
    if (pausedAt !== null) {
      startTimeRef.current += Math.max(0, now - pausedAt);
    }
    manualTimerPauseStartedAtRef.current = null;
    idleLastActivityAtRef.current = now;
    questionVisitStartedAtRef.current = now;
    timerLastSyncedAtRef.current = now;
    isTimerPausedRef.current = false;
    setIsTimerPaused(false);
  }, []);

  useEffect(() => {
    if (shouldUseIdleTimerPause) return;
    idleHiddenAtRef.current = null;
    idlePauseStartedAtRef.current = null;
    isIdleTimerPausedRef.current = false;
    hasIdleTimerPromptShownRef.current = false;
    setIsIdleTimerPaused(false);
    setIsIdleTimerPromptOpen(false);
  }, [shouldUseIdleTimerPause]);

  useEffect(() => {
    if (!shouldUseIdleTimerPause || isTimerPaused) return;

    idleLastActivityAtRef.current = Date.now();
    idleHiddenAtRef.current = document.visibilityState === "hidden" ? Date.now() : null;

    const recordActivity = () => {
      if (isIdleTimerPausedRef.current || idleHiddenAtRef.current !== null) return;
      idleLastActivityAtRef.current = Date.now();
    };
    const events = [
      "keydown",
      "mousedown",
      "mousemove",
      "pointerdown",
      "pointermove",
      "scroll",
      "touchstart",
      "touchmove",
      "wheel",
      "input",
    ];
    const listenerOptions = { capture: true, passive: true } as const;
    events.forEach((eventName) => {
      window.addEventListener(eventName, recordActivity, listenerOptions);
    });
    const handleVisibilityChange = () => {
      const now = Date.now();
      if (document.visibilityState === "hidden") {
        if (idleHiddenAtRef.current === null) {
          idleHiddenAtRef.current = now;
        }
        return;
      }
      const hiddenAt = idleHiddenAtRef.current;
      idleHiddenAtRef.current = null;
      idleLastActivityAtRef.current = now;
      if (
        hiddenAt !== null &&
        !isIdleTimerPausedRef.current &&
        now - hiddenAt >= idleTimerTimeoutMs
      ) {
        pauseTimerForIdle(hiddenAt);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const idleCheckId = window.setInterval(() => {
      if (isIdleTimerPausedRef.current || idleHiddenAtRef.current !== null) return;
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - idleLastActivityAtRef.current >= idleTimerTimeoutMs) {
        pauseTimerForIdle(Math.min(now, idleLastActivityAtRef.current + idleTimerTimeoutMs));
      }
    }, 250);

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, recordActivity, listenerOptions);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(idleCheckId);
      idleHiddenAtRef.current = null;
    };
  }, [
    currentQuestionId,
    idleTimerTimeoutMs,
    isTimerPaused,
    pauseTimerForIdle,
    shouldUseIdleTimerPause,
  ]);

  useEffect(() => {
    if (isPracticeTestMode && practiceTestSessionMeta) {
      if (currentPracticeIndex < 0) return;

      if (practiceTestSessionMeta.currentIndex === currentPracticeIndex) {
        return;
      }

      const nextSession = {
        ...practiceTestSessionMeta,
        currentIndex: currentPracticeIndex,
      };
      setPracticeTestSessionMeta(nextSession);
      savePracticeTestSession(nextSession);
      return;
    }

    if (!isModulePracticeMode || !modulePracticeSessionMeta) return;
    if (currentPracticeIndex < 0) return;

    if (modulePracticeSessionMeta.currentIndex === currentPracticeIndex) {
      return;
    }

    const nextSession = {
      ...modulePracticeSessionMeta,
      currentIndex: currentPracticeIndex,
    };
    setModulePracticeSessionMeta(nextSession);
    saveModulePracticeSession(nextSession);
  }, [
    currentPracticeIndex,
    isPracticeTestMode,
    practiceTestSessionMeta,
    isModulePracticeMode,
    modulePracticeSessionMeta,
  ]);

  useEffect(() => {
    if (!isAssessmentMode || !currentQuestionId) return;
    questionVisitStartedAtRef.current = Date.now();
    return () => {
      flushModulePracticeQuestionTime(false);
    };
  }, [currentQuestionId, flushModulePracticeQuestionTime, isAssessmentMode]);

  const navigateToPracticeIndex = useCallback((idx: number) => {
    if (!effectivePracticeMode || idx < 0 || idx >= practiceSet.length) return;
    flushModulePracticeQuestionTime();
    const target = practiceSet[idx];
    const base = '/bank';
    const params = new URLSearchParams();

    if (target.bankType) {
      params.set("bankType", target.bankType);
    }

    params.set("practice", "true");
    params.set("idx", String(idx + 1));

    if (modulePracticeSlug) {
      params.set("modulePractice", modulePracticeSlug);
    }

    if (modulePracticeStateSessionId) {
      params.set("moduleSession", modulePracticeStateSessionId);
    }

    if (practiceTestSetId) {
      params.set("practiceTest", practiceTestSetId);
    }

    if (practiceTestStateSessionId) {
      params.set("practiceTestSession", practiceTestStateSessionId);
    }

    if (customPracticeId && !modulePracticeSlug && !practiceTestSetId) {
      params.set("customPractice", customPracticeId);
    }

    if (idleTimerMsParam) {
      params.set("idleTimerMs", idleTimerMsParam);
    }

    if (idleTimerDemoParam) {
      params.set("idleTimerDemo", idleTimerDemoParam);
    }

    const targetIdSegment = target.sourceId ?? target.id;
    navigate(`${base}/${target.subject}/${targetIdSegment}?${params.toString()}`);
  }, [
    customPracticeId,
    effectivePracticeMode,
    flushModulePracticeQuestionTime,
    idleTimerDemoParam,
    idleTimerMsParam,
    modulePracticeSlug,
    modulePracticeStateSessionId,
    navigate,
    practiceSet,
    practiceTestSetId,
    practiceTestStateSessionId,
  ]);

  const submitPracticeTestCurrentModule = useCallback((sessionToSubmit: PracticeTestSessionMeta) => {
    if (!isPracticeTestMode || !practiceTestSet) return;

    flushModulePracticeQuestionTime();

    const nextSession = buildPracticeTestSessionAfterCurrentModuleSubmit(sessionToSubmit);
    if (!nextSession) {
      const result = buildPracticeTestResult(practiceTestSet, {
        ...sessionToSubmit,
        status: "submitted",
      });
      clearCurrentDesmosUiState();
      savePracticeTestResult(result, uid);
      clearPracticeTestSession(practiceTestSet.id);
      sessionStorage.removeItem("practiceSet");
      sessionStorage.removeItem("practiceExitTo");
      navigate(`/practice-tests/${practiceTestSet.id}/results?session=${result.sessionId}`);
      return;
    }

    clearCurrentDesmosUiState();
    setPracticeTestSessionMeta(nextSession);
    savePracticeTestSession(nextSession);
    navigate(
      `/practice-tests/${practiceTestSet.id}/transition?session=${sessionToSubmit.sessionId}&kind=${sessionToSubmit.activeModuleIndex === 1 ? "break" : "module"}`,
    );
  }, [clearCurrentDesmosUiState, flushModulePracticeQuestionTime, isPracticeTestMode, navigate, practiceTestSet, uid]);

  const handlePracticeTestPhaseAdvance = useCallback(() => {
    if (!isPracticeTestMode || !practiceTestSessionMeta || !practiceTestSet || !practiceTestActiveModule) return;

    flushModulePracticeQuestionTime();

    if (practiceTestReviewPhase) {
      navigate(`/practice-tests/${practiceTestSet.id}/review?session=${practiceTestSessionMeta.sessionId}`);
      return;
    }

    const nextSession = {
      ...practiceTestSessionMeta,
      phase: "review" as const,
      currentIndex: currentPracticeIndex >= 0 ? currentPracticeIndex : practiceTestSessionMeta.currentIndex,
    };
    setPracticeTestSessionMeta(nextSession);
    savePracticeTestSession(nextSession);
    navigate(`/practice-tests/${practiceTestSet.id}/review?session=${practiceTestSessionMeta.sessionId}`);
  }, [
    currentPracticeIndex,
    flushModulePracticeQuestionTime,
    isPracticeTestMode,
    navigate,
    practiceTestActiveModule,
    practiceTestReviewPhase,
    practiceTestSessionMeta,
    practiceTestSet,
  ]);

  useEffect(() => {
    if (
      !isPracticeTestMode ||
      !practiceTestIsTimed ||
      !practiceTestSessionMeta ||
      practiceTestSessionMeta.status !== "active" ||
      !practiceTestActiveModule ||
      practiceTestActiveModule.remainingSeconds !== 0 ||
      hasTimerExpiredRef.current
    ) {
      return;
    }

    hasTimerExpiredRef.current = true;
    submitPracticeTestCurrentModule(practiceTestSessionMeta);
  }, [
    isPracticeTestMode,
    practiceTestIsTimed,
    practiceTestSessionMeta,
    practiceTestActiveModule,
    submitPracticeTestCurrentModule,
  ]);

  const handlePrevious = useCallback(() => {
    if (!canGoPrevious) return;
    flushModulePracticeQuestionTime();
    if (is100Hard) {
      const previousQuestionId = orderedQuestionIds[currentOrderedQuestionIndex - 1];
      if (previousQuestionId) navigate(`/hard/${previousQuestionId}`);
      return;
    }
    if (isPracticeTestMode) {
      navigateToPracticeIndex(currentPracticeIndex - 1);
      return;
    }
    if (effectivePracticeMode) {
      navigateToPracticeIndex(currentPracticeIndex - 1);
      return;
    }
    const base = '/bank';
    const previousQuestionId = orderedQuestionIds[currentOrderedQuestionIndex - 1];
    if (previousQuestionId) {
      navigate(`${base}/${subject}/${previousQuestionId}${isBank ? bankQuerySuffix : ""}`);
    }
  }, [
    bankQuerySuffix,
    canGoPrevious,
    currentOrderedQuestionIndex,
    currentPracticeIndex,
    effectivePracticeMode,
    flushModulePracticeQuestionTime,
    is100Hard,
    isBank,
    isPracticeTestMode,
    navigate,
    navigateToPracticeIndex,
    orderedQuestionIds,
    subject,
  ]);

  const handleNext = useCallback(() => {
    if (!canGoNext) return;
    flushModulePracticeQuestionTime();
    if (is100Hard) {
      const nextQuestionId = orderedQuestionIds[currentOrderedQuestionIndex + 1];
      if (nextQuestionId) navigate(`/hard/${nextQuestionId}`);
      return;
    }
    if (isPracticeTestMode) {
      navigateToPracticeIndex(currentPracticeIndex + 1);
      return;
    }
    if (effectivePracticeMode) {
      navigateToPracticeIndex(currentPracticeIndex + 1);
      return;
    }
    const base = '/bank';
    const nextQuestionId = orderedQuestionIds[currentOrderedQuestionIndex + 1];
    if (nextQuestionId) {
      navigate(`${base}/${subject}/${nextQuestionId}${isBank ? bankQuerySuffix : ""}`);
    }
  }, [
    bankQuerySuffix,
    canGoNext,
    currentOrderedQuestionIndex,
    currentPracticeIndex,
    effectivePracticeMode,
    flushModulePracticeQuestionTime,
    is100Hard,
    isBank,
    isPracticeTestMode,
    navigate,
    navigateToPracticeIndex,
    orderedQuestionIds,
    subject,
  ]);
  const handleBankNavigatorJump = useCallback((qNum: number) => {
    const base = '/bank';
    navigate(`${base}/${subject}/${qNum}${isBank ? bankQuerySuffix : ""}`);
  }, [bankQuerySuffix, isBank, navigate, subject]);

  const handleEmbedAwareNext = useCallback(() => {
    if (shouldShowEmbedUpsellBeforeAdvance()) {
      setShowEmbedUpsell(true);
      return;
    }
    handleNext();
  }, [handleNext, shouldShowEmbedUpsellBeforeAdvance]);

  const handleModulePracticeReview = () => {
    if (!isModulePracticeMode || !modulePracticeSessionMeta || !modulePracticeModule) return;
    flushModulePracticeQuestionTime();
    if (modulePracticeAllowsChecking) {
      const result = buildModulePracticeResult(modulePracticeModule, {
        ...modulePracticeSessionMeta,
        status: "submitted",
      });
      clearCurrentDesmosUiState();
      saveModulePracticeResult(result, uid);
      sessionStorage.removeItem("practiceSet");
      sessionStorage.removeItem("practiceExitTo");
      clearModulePracticeSession(modulePracticeModule.slug);
      navigate(`/modules/${modulePracticeModule.slug}/results?session=${result.sessionId}`);
      return;
    }

    navigate(`/modules/${modulePracticeModule.slug}/review?session=${modulePracticeSessionMeta.sessionId}`);
  };

  const handleGroupAnswered = () => {
    if (effectivePracticeMode || orderedNavigationItems.length === 0) return;

    const stateByStorageId = getQuestionUiStates(
      orderedNavigationItems.map((item) => item.storageId),
      uid,
    );
    const getItemStatus = (storageId: string) =>
      stateByStorageId[storageId]?.status || "unanswered";
    const answeredItems = orderedNavigationItems.filter(
      (item) => getItemStatus(item.storageId) !== "unanswered",
    );
    const unansweredItems = orderedNavigationItems.filter(
      (item) => getItemStatus(item.storageId) === "unanswered",
    );
    const nextOrder = [...answeredItems, ...unansweredItems].map((item) => item.id);

    sessionStorage.setItem(groupedOrderStorageKey, JSON.stringify(nextOrder));
    setGroupedOrderVersion((version) => version + 1);

    const nextQuestionId = unansweredItems[0]?.id ?? answeredItems[0]?.id;
    if (!nextQuestionId || nextQuestionId === resolvedQuestionNumber) return;

    if (is100Hard) {
      navigate(`/hard/${nextQuestionId}`);
      return;
    }

    const base = "/bank";
    navigate(`${base}/${subject}/${nextQuestionId}${isBank ? bankQuerySuffix : ""}`);
  };

  const handleToggleReview = () => {
    if (!currentQuestion) return;
    if (isAssessmentMode) {
      const nextMarkedState = !modulePracticeMarkedForReview;
      setModulePracticeMarkedForReview(nextMarkedState);
      persistModulePracticeQuestionState((previous) => ({
        ...previous,
        isMarkedForReview: nextMarkedState,
      }));
      return;
    }
    const nextMarkedState = !markedForReview;
    toggleReview(currentQuestion.uuid);
    saveQuestionUiState(localStateKey, { flagged: nextMarkedState }, uid);
  };

  const handleCheck = useCallback((overrideAnswer?: string) => {
    if (!currentQuestion) return;
    if (isAssessmentMode && !assessmentAllowsChecking) return;
    if (isIdleTimerPausedRef.current) {
      resumeIdleTimer();
    }
    const rawUserAnswer = overrideAnswer || (currentQuestion.type === 'multiple-choice' ? selectedAnswer : freeResponseAnswer);
    const userAnswer = currentQuestion.type === "free-response" ? rawUserAnswer.trim() : rawUserAnswer;

    if (!userAnswer) {
      toast.error("Please provide an answer");
      return;
    }

    const alreadyCorrect = Object.values(checkedAnswers).some(Boolean);
    const storedQuestionStatus = !isAssessmentMode && !isEmbed
      ? getStoredQuestionUiStatus(localStateKey, uid)
      : undefined;
    const alreadyCorrectStatus = isCorrectQuestionStatus(checkButtonState)
      ? checkButtonState
      : isCorrectQuestionStatus(storedQuestionStatus)
        ? storedQuestionStatus
        : null;
    if (checkedAnswers[userAnswer] !== undefined) {
      return;
    }

    if (overrideAnswer && overrideAnswer !== selectedAnswer) {
      setSelectedAnswer(overrideAnswer);
    }

    const isCorrect = answersEquivalent(userAnswer, currentQuestion.correctAnswer);

    let formattedAnswer = userAnswer;
    if (currentQuestion.type === "multiple-choice" && currentQuestion.choices) {
      const choice = currentQuestion.choices.find(c => c.id === userAnswer);
      if (choice) {
        formattedAnswer = `${userAnswer}. ${choice.text || ""}`.trim();
      }
    }

    const newCheckedAnswers = { ...checkedAnswers, [userAnswer]: isCorrect };
    setCheckedAnswers(newCheckedAnswers);
    const newAttemptCount = attemptCount + 1;
    setAttemptCount(newAttemptCount);

    if (isCorrect) {
      const status = alreadyCorrectStatus ?? (newAttemptCount === 1 ? 'correct-first' : 'correct-later');
      setCheckButtonState(status);
      if (isAssessmentMode) {
        persistModulePracticeQuestionState((previous) => ({
          ...previous,
          answer: currentQuestion.type === "multiple-choice" ? userAnswer : previous.answer,
          freeResponseAnswer:
            currentQuestion.type === "free-response" ? userAnswer : previous.freeResponseAnswer,
          checkedAnswers: newCheckedAnswers,
          attemptCount: newAttemptCount,
          status,
        }));
      } else if (!isEmbed) {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        if (!alreadyCorrect) {
          addAttempt(currentQuestion.uuid, "correct", duration, formattedAnswer);
        }
        saveQuestionUiState(
          localStateKey,
          usesTransientQuestionAnswerUi
            ? getNavigationOnlyQuestionUiPatch(status)
            : {
                answer: userAnswer,
                checkedAnswers: newCheckedAnswers,
                attemptCount: newAttemptCount,
                status,
              },
          uid,
        );
      }
    } else {
      const buttonStatus = "incorrect";
      const savedStatus = alreadyCorrectStatus ?? (alreadyCorrect ? "correct-later" : buttonStatus);
      setCheckButtonState(buttonStatus);
      if (isAssessmentMode) {
        persistModulePracticeQuestionState((previous) => ({
          ...previous,
          answer: currentQuestion.type === "multiple-choice" ? userAnswer : previous.answer,
          freeResponseAnswer:
            currentQuestion.type === "free-response" ? userAnswer : previous.freeResponseAnswer,
          checkedAnswers: newCheckedAnswers,
          attemptCount: newAttemptCount,
          status: isCorrectQuestionStatus(previous.status) ? previous.status : savedStatus,
        }));
      } else if (!isEmbed) {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        if (!alreadyCorrect) {
          addAttempt(currentQuestion.uuid, "incorrect", duration, formattedAnswer);
        }
        saveQuestionUiState(
          localStateKey,
          usesTransientQuestionAnswerUi
            ? getNavigationOnlyQuestionUiPatch(savedStatus)
            : {
                answer: userAnswer,
                checkedAnswers: newCheckedAnswers,
                attemptCount: newAttemptCount,
                status: savedStatus,
              },
          uid,
        );
      }
    }
  }, [
    addAttempt,
    assessmentAllowsChecking,
    attemptCount,
    checkButtonState,
    checkedAnswers,
    currentQuestion,
    freeResponseAnswer,
    isAssessmentMode,
    isEmbed,
    localStateKey,
    persistModulePracticeQuestionState,
    resumeIdleTimer,
    selectedAnswer,
    uid,
    usesTransientQuestionAnswerUi,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.isContentEditable || target.closest('[contenteditable="true"]')) {
        return;
      }

      if (target.tagName === 'INPUT') {
        if (e.key === 'Enter' && currentQuestion && (!isAssessmentMode || assessmentAllowsChecking)) {
          e.preventDefault();
          handleCheck();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'ArrowRight':
          if (isEmbed && (canGoNext || isAtPreviewQuestionLimit)) {
            e.preventDefault();
            handleEmbedAwareNext();
          } else if (canGoNext) {
            handleNext();
          }
          break;
        case 'Enter':
          if (!isAssessmentMode || assessmentAllowsChecking) {
            e.preventDefault();
            handleCheck();
          }
          break;
        case 'ArrowUp':
        case 'ArrowDown':
          if (isAssessmentMode && !assessmentAllowsChecking) {
            return;
          }
          if (currentQuestion && currentQuestion.type === 'multiple-choice' && currentQuestion.choices) {
            e.preventDefault();
            const choiceIds = currentQuestion.choices.map(c => c.id);
            if (choiceIds.length === 0) return;

            const currentIndex = choiceIds.indexOf(selectedAnswer);
            let nextIndex = 0;

            if (currentIndex === -1) {
              nextIndex = e.key === 'ArrowDown' ? 0 : choiceIds.length - 1;
            } else {
              if (e.key === 'ArrowUp') {
                nextIndex = (currentIndex - 1 + choiceIds.length) % choiceIds.length;
              } else {
                nextIndex = (currentIndex + 1) % choiceIds.length;
              }
            }

            const nextId = choiceIds[nextIndex];
            setSelectedAnswer(nextId);
            if (isAssessmentMode) {
              persistModulePracticeQuestionState((previous) => ({
                ...previous,
                answer: nextId,
                status:
                  assessmentAllowsChecking &&
                  (previous.status === "incorrect" ||
                    previous.status === "correct-first" ||
                    previous.status === "correct-later")
                    ? previous.status
                    : nextId
                      ? "answered"
                      : "unanswered",
              }));
            } else {
              const storedStatus = getStoredQuestionUiStatus(localStateKey, uid);
              saveQuestionUiState(
                localStateKey,
                usesTransientQuestionAnswerUi
                  ? getNavigationOnlyQuestionUiPatch(
                      isCheckedQuestionStatus(storedStatus)
                        ? storedStatus
                        : nextId
                          ? "answered"
                          : "unanswered",
                    )
                  : { answer: nextId },
                uid,
              );
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleNext,
    handleEmbedAwareNext,
    handlePrevious,
    handleCheck,
    currentQuestion,
    selectedAnswer,
    questionNumber,
    canGoNext,
    isAtPreviewQuestionLimit,
    isEmbed,
    isPracticeTestMode,
    isModulePracticeMode,
    isAssessmentMode,
    assessmentAllowsChecking,
    localStateKey,
    persistModulePracticeQuestionState,
    uid,
    usesTransientQuestionAnswerUi,
  ]);

  const freeResponseAnswerForCheck = freeResponseAnswer.trim();
  const hasSelection = currentQuestion
    ? currentQuestion.type === 'multiple-choice'
      ? Boolean(selectedAnswer)
      : freeResponseAnswerForCheck.length > 0
    : false;
  const canCheckAnswers = !isAssessmentMode || assessmentAllowsChecking;
  const isCheckDisabled = !hasSelection;
  const showInlineFreeResponseCheck =
    currentQuestion?.type === "free-response" &&
    canCheckAnswers &&
    freeResponseAnswerForCheck.length > 0;
  const freeResponseCheckedResult =
    currentQuestion?.type === "free-response" && freeResponseAnswerForCheck
      ? checkedAnswers[freeResponseAnswerForCheck]
      : undefined;
  const selectedAnswerForCheck =
    currentQuestion?.type === "multiple-choice" ? selectedAnswer : freeResponseAnswerForCheck;
  const selectedAnswerWasChecked = selectedAnswerForCheck
    ? checkedAnswers[selectedAnswerForCheck] !== undefined
    : false;
  const useNeutralCheckedButtonHover =
    hasSelection && checkColorVisible && checkButtonState !== "idle" && !selectedAnswerWasChecked;
  const freeResponseAnswerStateClassName = cn(
    freeResponseCheckedResult === true &&
      "border-2 border-[#1B5E20] bg-[#C8E6C9]/20 dark:border-[#2E7D32] dark:bg-[#1B5E20]/20",
    freeResponseCheckedResult === false &&
      "border-2 border-[#B71C1C] bg-[#FFCDD2]/20 dark:border-[#8B0000] dark:bg-[#5C1010]/20",
  );
  const freeResponseInlineCheckStateClassName = cn(
    freeResponseCheckedResult === true &&
      "border-[#1B5E20] bg-[#C8E6C9]/20 ring-1 ring-inset ring-[#1B5E20] dark:border-[#2E7D32] dark:bg-[#1B5E20]/20 dark:ring-[#2E7D32]",
    freeResponseCheckedResult === false &&
      "border-[#B71C1C] bg-[#FFCDD2]/20 ring-1 ring-inset ring-[#B71C1C] dark:border-[#8B0000] dark:bg-[#5C1010]/20 dark:ring-[#8B0000]",
  );
  const freeResponseInputClassName = cn(
    "max-w-md flex-[1_1_16rem] transition-colors duration-150 ease-out",
    freeResponseAnswerStateClassName,
  );
  const freeResponseInlineCheckButtonClassName = cn(
    "h-11 shrink-0 rounded-[9px] border border-ds-line bg-white px-[14px] py-[11px] font-sans text-[15px] font-medium text-ink shadow-none transition-colors duration-150 ease-out hover:border-ds-line hover:bg-white hover:text-ink dark:border-ds-line dark:bg-card dark:text-ink dark:hover:border-ds-line dark:hover:bg-card dark:hover:text-ink",
    freeResponseInlineCheckStateClassName,
    freeResponseCheckedResult === true &&
      "hover:border-[#1B5E20] hover:bg-[#C8E6C9]/20 hover:text-ink dark:hover:border-[#2E7D32] dark:hover:bg-[#1B5E20]/20 dark:hover:text-ink",
    freeResponseCheckedResult === false &&
      "hover:border-[#B71C1C] hover:bg-[#FFCDD2]/20 hover:text-ink dark:hover:border-[#8B0000] dark:hover:bg-[#5C1010]/20 dark:hover:text-ink",
  );

  const getCheckButtonClasses = () => {
    if (!hasSelection && checkButtonState === "idle") {
      return "bg-background text-foreground border-border";
    }

    if (!checkColorVisible) {
      return hasSelection
        ? "bg-primary/10 hover:bg-primary/20 border-primary/40 text-foreground"
        : "bg-background text-foreground border-border";
    }

    switch (checkButtonState) {
      case "correct-first":
        return cn(
          "bg-[#C8E6C9] border-[#1B5E20] text-[#1B5E20] dark:bg-[#1B5E20] dark:border-[#2E7D32] dark:text-white disabled:opacity-100",
          useNeutralCheckedButtonHover
            ? "hover:border-ds-line hover:bg-muted/60 hover:text-foreground dark:hover:border-ds-line dark:hover:bg-white/10 dark:hover:text-white"
            : "hover:bg-[#A5D6A7] dark:hover:bg-[#144216]",
        );
      case "correct-later":
        return cn(
          "bg-[#C8E6C9] border-[#1B5E20] text-[#1B5E20] dark:bg-[#1B5E20] dark:border-[#2E7D32] dark:text-white disabled:opacity-100",
          useNeutralCheckedButtonHover
            ? "hover:border-ds-line hover:bg-muted/60 hover:text-foreground dark:hover:border-ds-line dark:hover:bg-white/10 dark:hover:text-white"
            : "hover:bg-[#A5D6A7] dark:hover:bg-[#144216]",
        );
      case "incorrect":
        return cn(
          "bg-[#FFCDD2] border-[#B71C1C] text-[#2C1A1A] dark:bg-[#5C1010] dark:border-[#8B0000] dark:text-white",
          useNeutralCheckedButtonHover
            ? "hover:border-ds-line hover:bg-muted/60 hover:text-foreground dark:hover:border-ds-line dark:hover:bg-white/10 dark:hover:text-white"
            : "hover:bg-[#EF9A9A] dark:hover:bg-[#4A0D0D]",
        );
      default:
        return hasSelection ? "bg-primary/10 hover:bg-primary/20 border-primary/40 text-foreground" : "bg-background text-foreground border-border";
    }
  };

  const renderFreeResponseAnswerControls = () => (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">Your Answer:</label>
      <div className="flex w-full flex-wrap items-center gap-2">
        <Input
          key={localStateKey}
          type="text"
          value={freeResponseAnswer}
          onChange={(e) => handleFreeResponseChange(e.target.value)}
          placeholder="Enter your answer"
          className={freeResponseInputClassName}
        />
        {showInlineFreeResponseCheck && (
          <Button
            onClick={() => handleCheck()}
            disabled={isCheckDisabled}
            variant="outline"
            className={freeResponseInlineCheckButtonClassName}
          >
            <Check className="mr-1 h-4 w-4" />
            <span>Check</span>
          </Button>
        )}
      </div>
    </div>
  );

  const questionWithBankFields = (currentQuestion ?? {}) as Partial<{
    prompt: string;
    questionText: string;
    passage: string;
    text: string;
    questionImages: {
      src: string;
      alt: string;
      displaySize?: QuestionImageDisplaySize;
      width?: number;
      height?: number;
      hasTransparency?: boolean;
      optimizedSrc?: string;
      srcSet?: string;
      sizes?: string;
    }[];
  }>;

  const promptContent = typeof questionWithBankFields.prompt === "string" && questionWithBankFields.prompt.trim()
    ? questionWithBankFields.prompt
    : undefined;
  const questionTextContent = typeof questionWithBankFields.questionText === "string" && questionWithBankFields.questionText.trim()
    ? questionWithBankFields.questionText
    : undefined;
  const passageContent = typeof questionWithBankFields.passage === "string"
    ? questionWithBankFields.passage
    : undefined;
  const legacyTextContent = typeof questionWithBankFields.text === "string" && questionWithBankFields.text.trim()
    ? questionWithBankFields.text
    : "";
  const rawStemContent = passageContent !== undefined
    ? passageContent
    : (promptContent ?? questionTextContent ?? legacyTextContent);
  const questionImages = Array.isArray(questionWithBankFields.questionImages)
    ? questionWithBankFields.questionImages
    : undefined;

  const extractedFromStem = subject === "reading" ? extractReadingQuestionSentence(rawStemContent) : { remainder: rawStemContent };
  const readingQuestionSentence =
    subject === "reading"
      ? (questionTextContent?.trim() || extractedFromStem.sentence)
      : questionTextContent;

  let stemContent = rawStemContent;
  if (subject === "reading" && extractedFromStem.sentence) {
    const normalizedQuestionSentence = (readingQuestionSentence || "").trim();
    const normalizedExtractedSentence = extractedFromStem.sentence.trim();
    if (!normalizedQuestionSentence || normalizedQuestionSentence === normalizedExtractedSentence) {
      stemContent = extractedFromStem.remainder || rawStemContent;
    }
  }

  const showQuestionTextAboveChoices = subject === "reading"
    ? Boolean(readingQuestionSentence)
    : Boolean(questionTextContent) &&
      (passageContent !== undefined || !promptContent || questionTextContent !== promptContent);
  const readingPassageContent = subject === "reading"
    ? stripDuplicatedLeadingQuestion(stemContent, readingQuestionSentence)
    : undefined;
  const readingPassageHtml = readingPassageContent
    ? getRenderedContentHtml(readingPassageContent)
    : "";
  const annotationStorageKey =
    isPracticeTestMode && practiceTestStateSessionId
      ? getPracticeTestAnnotationStorageKey(practiceTestStateSessionId, localStateKey)
      : isModulePracticeMode && modulePracticeStateSessionId
      ? getModulePracticeAnnotationStorageKey(modulePracticeStateSessionId, localStateKey)
      : `${localStateKey}-passage-annotations`;
  const noteStorageKey =
    isPracticeTestMode && practiceTestStateSessionId
      ? getPracticeTestNoteStorageKey(practiceTestStateSessionId, localStateKey)
      : isModulePracticeMode && modulePracticeStateSessionId
      ? getModulePracticeNoteStorageKey(modulePracticeStateSessionId, localStateKey)
      : `${localStateKey}-note`;
  const noteWindowStateKey = `${noteStorageKey}:window`;
  const noteWindowOpenKey = `${noteStorageKey}:open`;
  const noteStorageArea = isAssessmentMode
    ? sessionStorage
    : QUESTION_BANK_VIEWER_STORAGE;
  const clearQuestionBankViewerNotes = useCallback(() => {
    if (!isAssessmentMode) {
      clearQuestionBankViewerStorage();
    }
  }, [isAssessmentMode]);
  const isReadingPassageAnnotatable = subject === "reading" && Boolean(readingPassageContent);
  const shouldReduceQuestionImageSize = isBank;
  const isQuestionDataLoading =
    (needsModulePracticeBank && !modulePracticeBank) ||
    (canUseRouteIndexedBankQuestion ? isRouteIndexedQuestionLoading : isBankQuestionPoolLoading);
  const shouldShowQuestionDataLoading = !currentQuestion && isQuestionDataLoading;

  const renderQuestionImages = () => {
    if (!questionImages?.length) return null;

    return (
      <div className="space-y-2">
        {questionImages.map((img, idx) => {
          const src = normalizePublicAssetPath(img.src);
          const metadata = questionImageAssetMetadataBySrc[src];
          const optimizedSrc = img.optimizedSrc ?? metadata?.optimizedSrc;
          const imageWidth = img.width ?? metadata?.optimizedWidth ?? metadata?.width ?? questionImageDimensionsBySrc[src]?.width;
          const imageHeight = img.height ?? metadata?.optimizedHeight ?? metadata?.height ?? questionImageDimensionsBySrc[src]?.height;
          const intrinsicSize = imageWidth && imageHeight ? { width: imageWidth, height: imageHeight } : undefined;
          const reserveWhiteBackground = isBank && shouldReserveWhiteQuestionImageSpace(src);

          return (
            <div key={`${img.src}-${idx}`} className="w-full flex justify-center">
              <TransparentAwareImage
                src={src}
                alt={img.alt || `Question image ${idx + 1}`}
                loading="eager"
                fetchPriority={idx === 0 ? "high" : "auto"}
                optimizedSrc={optimizedSrc}
                srcSet={img.srcSet ?? metadata?.srcSet}
                sizes={img.sizes ?? metadata?.sizes}
                width={imageWidth}
                height={imageHeight}
                hasTransparency={img.hasTransparency ?? metadata?.hasTransparentPixel}
                className={cn(
                  "h-auto object-contain",
                  getQuestionImageClassName(img.displaySize ?? metadata?.displaySize, subject, shouldReduceQuestionImageSize),
                )}
                wrapperClassName={cn("max-w-full", shouldReduceQuestionImageSize && "flex justify-center")}
                trimWhitespace={isBank && bankSource === 'unofficial' && !optimizedSrc}
                reserveWhiteBackground={reserveWhiteBackground}
                intrinsicSize={intrinsicSize}
              />
            </div>
          );
        })}
      </div>
    );
  };

  const backDestination = practiceExitTo || (is100Hard ? "/hard" : isBank ? `/bank?bankType=${bankSource}` : "/bank");

  useEffect(() => {
    setIsNoteWindowOpen(noteStorageArea.getItem(noteWindowOpenKey) === "true");
  }, [noteStorageArea, noteWindowOpenKey]);

  useEffect(() => {
    activateQuestionBankViewerStorage();
    const handleBeforeUnload = () => {
      clearQuestionBankViewerStorage();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (isQuestionViewerPath(window.location.pathname)) return;
      clearQuestionBankViewerStorage();
    };
  }, []);

  if (shouldShowQuestionDataLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!currentQuestion) {
    const fallbackDestination = practiceExitTo || (isBank ? `/bank?bankType=${bankSource}` : "/bank");
    return <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Question not found</h1>
        <Button
          onClick={() => {
            clearQuestionBankViewerNotes();
            clearCurrentDesmosUiState();
            navigate(fallbackDestination);
          }}
        >
          Go Home
        </Button>
      </div>
    </div>;
  }

  const shouldHideAnswerChoices =
    subject === "reading" &&
    hideAnswerChoices &&
    currentQuestion.type === "multiple-choice" &&
    Boolean(currentQuestion.choices);
  const renderHiddenAnswerChoices = () => (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-muted/25 p-6 text-center text-sm text-muted-foreground">
      <span>Answer choices hidden</span>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 bg-background"
        onClick={() => handleHideAnswerChoicesChange(false)}
      >
        <Eye className="h-3.5 w-3.5" />
        Show choices
      </Button>
    </div>
  );

  const openNoteWindow = () => {
    bringToFront("note");
    setIsNoteWindowOpen(true);
    noteStorageArea.setItem(noteWindowOpenKey, "true");
  };
  const handleCloseNoteWindow = () => {
    setIsNoteWindowOpen(false);
    noteStorageArea.setItem(noteWindowOpenKey, "false");
  };
  const toggleTheme = () => {
    if (isNativeEmbed) {
      applyTheme(!isDark);
      return;
    }
    if (isEmbed) {
      setEmbedIsDark((prev) => !prev);
      return;
    }
    applyTheme(!isDark);
  };
  const handleCreateSimilarPracticeSet = async () => {
    if (!currentQuestion || !isBankQuestionWithUuid(currentQuestion)) return;
    const similarityMeta = await ensureCurrentSimilarityMeta();
    const questionWithSimilarity = similarityMeta
      ? { ...currentQuestion, ...similarityMeta }
      : currentQuestion;
    if (!questionWithSimilarity.similarityGroupId) return;

    const { createCustomPracticeSetForQuestion } = await import("@/lib/practice/customPracticeSets");
    await createCustomPracticeSetForQuestion(questionWithSimilarity, uid);
    toast.success("Practice set created");
    navigate("/my-practice-sets");
  };
  const handleSaveAndExit = () => {
    if (isPracticeTestMode && practiceTestSessionMeta && practiceTestSet) {
      flushModulePracticeQuestionTime();
      clearCurrentDesmosUiState();
      const pausedSession = {
        ...practiceTestSessionMeta,
        status: "paused" as const,
        currentIndex: currentPracticeIndex >= 0 ? currentPracticeIndex : 0,
      };
      setPracticeTestSessionMeta(pausedSession);
      savePracticeTestSession(pausedSession);
      navigate("/modules");
      return;
    }

    if (!isModulePracticeMode || !modulePracticeSessionMeta || !modulePracticeModule) {
      clearQuestionBankViewerNotes();
      clearCurrentDesmosUiState();
      navigate(backDestination);
      return;
    }

    flushModulePracticeQuestionTime();
    clearCurrentDesmosUiState();
    const pausedSession = {
      ...modulePracticeSessionMeta,
      status: "paused" as const,
      currentIndex: currentPracticeIndex >= 0 ? currentPracticeIndex : 0,
    };
    setModulePracticeSessionMeta(pausedSession);
    saveModulePracticeSession(pausedSession);
    navigate("/modules");
  };
  const handleTimerExpiredSubmit = () => {
    setIsTimerExpiredOpen(false);
    handleModulePracticeReview();
  };
  const displayedTimerSeconds =
    isPracticeTestMode
      ? practiceTestIsTimed
        ? practiceTestActiveModule?.remainingSeconds ?? 0
        : practiceTestActiveModule?.elapsedSeconds ?? elapsedSeconds
      : isModulePracticeMode && modulePracticeSessionMeta?.settings.timed
      ? modulePracticeSessionMeta.remainingSeconds ?? 0
      : elapsedSeconds;
  const isTimerControlPaused = isIdleTimerPaused || isTimerPaused;
  const shouldShowTimerPauseControl = !usesCountdownTimer;
  const timerControls = (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => setIsTimerVisible((prev) => !prev)}
        title={isTimerVisible ? "Hide timer" : "Show timer"}
      >
        {isTimerVisible ? (
          <Eye className="h-5 w-5" />
        ) : (
          <EyeOff className="h-5 w-5" />
        )}
      </Button>
      <span className={cn(
        "text-center font-semibold tabular-nums",
        "min-w-[5ch] text-xl",
      )}>
        {isTimerVisible ? formatPracticeClock(displayedTimerSeconds) : formatPracticeClockPlaceholder(displayedTimerSeconds)}
      </span>
      {shouldShowTimerPauseControl && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => {
            if (isIdleTimerPaused) {
              resumeIdleTimer();
              return;
            }
            if (isTimerPaused) {
              resumeCountUpTimer();
              return;
            }
            pauseCountUpTimer();
          }}
          title={isTimerControlPaused ? "Resume timer" : "Pause timer"}
        >
          {isTimerControlPaused ? (
            <Play className="h-5 w-5" />
          ) : (
            <Pause className="h-5 w-5" />
          )}
        </Button>
      )}
    </>
  );
  const questionInfoDialog = questionInfo ? (
    <Dialog
      open={isQuestionInfoOpen}
      onOpenChange={(open) => {
        setIsQuestionInfoOpen(open);
        if (open) void ensureCurrentSimilarityMeta();
      }}
    >
      <DialogContent container={windowPortalContainer} overlayClassName="z-[210]" className="z-[220] max-h-[85vh] max-w-3xl overflow-hidden border-border bg-card p-7 text-card-foreground shadow-2xl sm:rounded-[28px] dark:border-white/10 dark:bg-[#101010] dark:text-white [&>button]:right-5 [&>button]:top-5 [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-2xl [&>button]:border [&>button]:border-border [&>button]:bg-background/80 [&>button]:p-0 [&>button]:text-muted-foreground [&>button]:opacity-100 [&>button]:ring-0 [&>button]:ring-offset-0 [&>button]:transition-colors [&>button]:hover:bg-muted [&>button]:hover:text-foreground dark:[&>button]:border-white/30 dark:[&>button]:bg-transparent dark:[&>button]:text-white/80 dark:[&>button]:hover:bg-white/10 dark:[&>button_svg]:h-5 [&>button_svg]:w-5">
        <DialogHeader className="space-y-0">
          <DialogTitle className="text-[1.7rem] font-semibold tracking-[-0.025em] text-foreground dark:text-white">
            Question Info
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto pt-2">
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {questionInfo.fields.map((field) => (
              <div
                key={field.label}
                className="min-w-0 space-y-1.5"
              >
                <p className="text-[0.82rem] font-medium tracking-[-0.01em] text-muted-foreground dark:text-white/60">
                  {field.label}
                </p>
                <p className="break-words text-[1.15rem] font-medium leading-snug tracking-[-0.015em] text-foreground dark:text-white">
                  {field.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  ) : null;
  const timerExpiredDialog = (
    <AlertDialog open={isTimerExpiredOpen} onOpenChange={setIsTimerExpiredOpen}>
      <AlertDialogContent container={windowPortalContainer} overlayClassName="z-[210]" className="z-[220]">
        <AlertDialogHeader>
          <AlertDialogTitle>Time has expired</AlertDialogTitle>
          <AlertDialogDescription>
            {isPracticeTestMode
              ? "On the real SAT, this module would end when time runs out. You can move to the next phase now or continue working."
              : "On the real SAT, this module would auto-submit when time runs out. You can submit now or continue working."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setIsTimerExpiredOpen(false)}>
            Continue working
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleTimerExpiredSubmit}>
            Submit module
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  const handleAnswerSelectionChange = (answer: string) => {
    setSelectedAnswer(answer);
    if (isAssessmentMode) {
      persistModulePracticeQuestionState((previous) => ({
        ...previous,
        answer,
        status:
          assessmentAllowsChecking &&
          (previous.status === "incorrect" ||
            previous.status === "correct-first" ||
            previous.status === "correct-later")
            ? previous.status
            : answer
              ? "answered"
              : "unanswered",
      }));
      return;
    }
    const storedStatus = getStoredQuestionUiStatus(localStateKey, uid);
    saveQuestionUiState(
      localStateKey,
      usesTransientQuestionAnswerUi
        ? getNavigationOnlyQuestionUiPatch(
            isCheckedQuestionStatus(storedStatus)
              ? storedStatus
              : answer
                ? "answered"
                : "unanswered",
          )
        : { answer },
      uid,
    );
  };
  const handleFreeResponseChange = (answer: string) => {
    const hasAnswer = answer.trim().length > 0;
    setFreeResponseAnswer(answer);
    if (isAssessmentMode) {
      persistModulePracticeQuestionState((previous) => ({
        ...previous,
        freeResponseAnswer: answer,
        status:
          assessmentAllowsChecking &&
          (previous.status === "incorrect" ||
            previous.status === "correct-first" ||
            previous.status === "correct-later")
            ? previous.status
            : hasAnswer
              ? "answered"
              : "unanswered",
      }));
    } else {
      const storedStatus = getStoredQuestionUiStatus(localStateKey, uid);
      saveQuestionUiState(
        localStateKey,
        usesTransientQuestionAnswerUi
          ? getNavigationOnlyQuestionUiPatch(
              isCheckedQuestionStatus(storedStatus)
                ? storedStatus
                : hasAnswer
                  ? "answered"
                  : "unanswered",
            )
          : { answer },
        uid,
      );
    }
  };
  const handleStrikeoutChange = (choiceIds: string[]) => {
    setStruckOutChoiceIds(choiceIds);
    persistModulePracticeQuestionState((previous) => ({
      ...previous,
      struckOutChoiceIds: choiceIds,
    }));
  };
  const modulePracticeNavigatorItems = (() => {
    if (isPracticeTestMode && practiceTestStateSessionId) {
      const navigatorItems = practiceSet
        .slice(practiceTestCurrentModuleStartIndex, practiceTestCurrentModuleEndIndex + 1)
        .map((item, idx) => ({ item, absoluteIndex: practiceTestCurrentModuleStartIndex + idx }));

      return navigatorItems.map(({ item, absoluteIndex }, idx) => {
        const storageId = item.storageId || `bank-${item.subject}-${item.sourceId || item.id}`;
        const state = getPracticeTestQuestionState(practiceTestStateSessionId, storageId);
        const answer = state.answer || state.freeResponseAnswer;
        const status = practiceTestAllowsChecking
          ? state.status === "correct-first" ||
            state.status === "correct-later" ||
            state.status === "incorrect"
            ? state.status
            : "unanswered"
          : answer
            ? "answered"
            : "unanswered";

        return {
          key: `${item.subject}-${item.id}-${absoluteIndex}`,
          label: item.moduleQuestionNumber ?? idx + 1,
          status,
          isFlagged: state.isMarkedForReview,
          isCurrent: absoluteIndex === currentPracticeIndex,
          onSelect: () => navigateToPracticeIndex(absoluteIndex),
          title: `${item.moduleTitle || (item.subject === "math" ? "Math" : "Reading")} · Q${item.moduleQuestionNumber ?? idx + 1}`,
        };
      });
    }

    if (!isModulePracticeMode || !modulePracticeStateSessionId) return [];

    return practiceSet.map((item, idx) => {
      const storageId = item.storageId || `bank-${item.subject}-${item.sourceId || item.id}`;
      const state = getModulePracticeQuestionState(modulePracticeStateSessionId, storageId);
      const answer = item.subject === "math" || item.subject === "reading"
        ? state.answer || state.freeResponseAnswer
        : state.answer;
      const status = modulePracticeAllowsChecking
        ? state.status === "correct-first" ||
          state.status === "correct-later" ||
          state.status === "incorrect"
          ? state.status
          : "unanswered"
        : answer
          ? "answered"
          : "unanswered";

      return {
        key: `${item.subject}-${item.sourceId || item.id}-${idx}`,
        label: idx + 1,
        status,
        isFlagged: state.isMarkedForReview,
        isCurrent: idx === currentPracticeIndex,
        onSelect: () => navigateToPracticeIndex(idx),
        title: `${item.subject === "math" ? "Math" : "Reading"} Q${idx + 1}`,
      };
    });
  })();
  const practiceTestAdvanceLabel =
    isPracticeTestMode && !canGoNext
      ? practiceTestSessionMeta && practiceTestSessionMeta.activeModuleIndex === practiceTestSessionMeta.modules.length - 1
          ? "Review"
          : "Review"
      : isModulePracticeMode && !canGoNext
        ? "Review"
        : "Next";
  const handlePrimaryAdvance =
    isPracticeTestMode && !canGoNext
      ? handlePracticeTestPhaseAdvance
      : isModulePracticeMode && !canGoNext
        ? handleModulePracticeReview
        : handleNext;
  const openRealBankFromEmbed = () => {
    if (previewEmbed) {
      previewEmbed.onOpenBank?.();
      return;
    }
    if (isEmbed && window.parent) {
      window.parent.postMessage({ type: "openBank" }, "*");
      return;
    }
    navigate(`/bank?bankType=${bankSource}`);
  };
  const handleEmbedAwareAdvance = () => {
    if (shouldShowEmbedUpsellBeforeAdvance()) {
      setShowEmbedUpsell(true);
      return;
    }
    handlePrimaryAdvance();
  };
  const practiceTestNavigatorTitle = practiceTestReviewPhase
    ? practiceTestActiveModule?.moduleTitle || "Review Questions"
    : practiceTestActiveModule?.moduleTitle || "Test Navigator";
  const practiceTestNavigatorSubtitle = practiceTestReviewPhase
    ? assessmentAllowsChecking
      ? `${practiceTestModuleQuestionCount} questions in this module`
      : `${practiceTestModuleQuestionCount} questions in this module`
    : assessmentAllowsChecking
      ? `${practiceTestModuleQuestionCount} questions in this module`
      : `${practiceTestModuleQuestionCount} questions in this module`;

  const isIndexableBankRoute =
    (rawSubject === "math" || rawSubject === "reading") &&
    !isAssessmentMode &&
    !is100Hard;
  const bankSubjectLabel = subject === "reading" ? "Reading and Writing" : "Math";

  return (
    <div ref={handleQuestionRootRef} className={cn("bg-background flex flex-col relative", isEmbed ? (isNativeEmbed ? "h-full min-h-full overflow-hidden" : "h-screen overflow-hidden") : "min-h-screen")}>
      {isIndexableBankRoute ? (
        <PageSeo
          id={`bank-question-${subject}-${idParam}`}
          jsonLd={buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: "SAT Question Bank", url: "https://1600.now/bank" },
            {
              name: `${bankSubjectLabel} Skills`,
              url: `https://1600.now/bank/${subject}/browse`,
            },
            {
              name: `Question #${idParam}`,
              url: `https://1600.now/bank/${subject}/${idParam}`,
            },
          ])}
        />
      ) : null}
      {questionInfoDialog}
      {isModulePracticeMode && modulePracticeSessionMeta?.settings.timed ? timerExpiredDialog : null}
      {isIdleTimerPromptOpen && createPortal(
        <div
          className={cn(isNativeEmbed ? "absolute" : "fixed", "pointer-events-auto inset-y-0 left-0 z-[300] flex items-center justify-center bg-background/45 p-3 backdrop-blur-[2px] sm:p-6")}
          style={isSplitScreenActive ? {
            width: "var(--sat-main-content-width, var(--sat-content-split-pct, 70%))",
            marginLeft: "var(--sat-main-content-offset-x, 0px)",
          } : { width: "100%" }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="idle-timer-title"
            className="w-full max-w-2xl rounded-2xl border border-border bg-card p-7 text-card-foreground shadow-2xl sm:p-8"
          >
            <h2 id="idle-timer-title" className="text-xl font-semibold text-foreground">
              Still here?
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              We paused the timer so your stats stay clean while you're away.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="outline" className="h-11" onClick={() => setIsIdleTimerPromptOpen(false)}>
                Keep it paused
              </Button>
              <Button className="h-11" onClick={resumeIdleTimer}>
                I'm here
              </Button>
            </div>
          </div>
        </div>,
        windowPortalContainer ?? document.body,
      )}
      {showEmbedUpsell && createPortal(
        <div className={cn(isNativeEmbed ? "absolute" : "fixed", "pointer-events-auto inset-0 z-[280] flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm")}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center shadow-2xl">
            <h2 className="mb-2 text-xl font-semibold text-foreground">Want to keep going?</h2>
            <p className="mb-5 text-sm leading-6 text-muted-foreground">
              Open the full question bank to keep practicing with the complete viewer.
            </p>
            <Button onClick={openRealBankFromEmbed} className="w-full">
              Open question bank
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>,
        windowPortalContainer ?? document.body,
      )}
      <ReportQuestionDialog
        open={isReportOpen}
        onOpenChange={setIsReportOpen}
        questionId={currentQuestion?.uuid}
        portalContainer={windowPortalContainer}
      />
      <QuestionNotesWindow
        key={noteStorageKey}
        isOpen={isNoteWindowOpen}
        onClose={handleCloseNoteWindow}
        storageKey={noteStorageKey}
        storageArea={noteStorageArea}
        windowStateKey={noteWindowStateKey}
        onFocus={() => bringToFront("note")}
        zIndex={getZIndex("note")}
        windowPortalContainer={windowPortalContainer}
        windowBoundsElement={windowBoundsElement}
      />
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div
          className="sat-resize-transition w-full max-w-none px-4 py-4 transition-[max-width,margin-left] duration-200 ease-out motion-reduce:transition-none"
          style={isSplitScreenActive ? {
            maxWidth: "var(--sat-header-content-width, var(--sat-content-split-pct, 70%))",
            marginLeft: "var(--sat-header-content-offset-x, 0px)",
          } : { maxWidth: "100%", marginLeft: "0px" }}
        >
          <div className="relative flex items-center justify-between gap-1 sm:gap-3" ref={topNavRef}>
            <div ref={topLeftRef} data-header-left className="shrink-0">
              {isEmbed ? null : isAssessmentMode ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className={effectiveTopShouldCompress ? "w-9 px-0" : undefined}>
                      <ChevronLeft className={effectiveTopShouldCompress ? "h-4 w-4" : "mr-1 h-4 w-4"} />
                      {!effectiveTopShouldCompress && "Save & Exit"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent container={windowPortalContainer} overlayClassName="z-[210]" className="z-[220]">
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {isPracticeTestMode ? "Save and exit this practice test?" : "Save and exit this module?"}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Your selected answers, notes, highlights, and marked questions will stay saved.
                        {isPracticeTestMode
                          ? "The current test session will pause until you come back."
                          : "The timer will stop until you come back."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep working</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSaveAndExit}>Save and exit</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className={effectiveTopShouldCompress ? "w-9 px-0" : undefined}
                  onClick={() => {
                    clearQuestionBankViewerNotes();
                    clearCurrentDesmosUiState();
                    navigate(backDestination);
                  }}
                >
                  <ChevronLeft className={effectiveTopShouldCompress ? "h-4 w-4" : "mr-1 h-4 w-4"} />
                  {!effectiveTopShouldCompress && "Home"}
                </Button>
              )}
            </div>
            <div
              ref={topTimerRef}
              data-header-center
              className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1 sm:gap-2"
              style={{ transform: "translateX(calc(-50% + var(--sat-top-timer-offset, 0px)))" }}
            >
              {timerControls}
            </div>
            <div ref={topRightRef} className="ml-auto flex min-w-0 items-center justify-end">
              <div ref={topRightControlsRef} className="flex min-w-0 items-center justify-end gap-1 sm:gap-2">
                {subject === "math" && (
                  <>
                    <FormulaSheetDialog
                      onFocus={() => bringToFront('referenceSheet')}
                      zIndex={getZIndex('referenceSheet')}
                      compressed={effectiveTopShouldCompress}
                      windowPortalContainer={windowPortalContainer}
                      windowBoundsElement={windowBoundsElement}
                    />
                    <DesmosDialog
                      onSplitScreenChange={handleSplitScreenChange}
                      onSplitPositionChange={handleSplitPositionChange}
                      splitPosition={splitPosition}
                      onFocus={() => bringToFront('desmos')}
                      zIndex={getZIndex('desmos')}
                      isSidebarred={sidebarredWindows.has('desmos')}
                      onSidebarToggle={handleSidebarToggle}
                      compressed={effectiveTopShouldCompress}
                      windowPortalContainer={windowPortalContainer}
                      windowBoundsElement={windowBoundsElement}
                      storageArea={desmosStorageArea}
                      calculatorStateKey={desmosCalculatorStateKey}
                      calculatorIdentityKey={desmosCalculatorIdentityKey}
                      windowStateKey={desmosWindowStateKey}
                      layoutStateKey={desmosLayoutStateKey}
                      openStateKey={desmosOpenStateKey}
                      onRestoreSidebarPosition={restoreDesmosSplitPosition}
                      contentSplitExitPosition={sidebarExitContentSplitPosition}
                      sidebarExitHeaderMaxWidth={QUESTION_HEADER_CONTAINER_MAX_WIDTH}
                      sidebarExitMainMaxWidth={effectiveQuestionViewMode === "horizontal" ? undefined : QUESTION_CONTENT_MAX_WIDTH}
                    />
                  </>
                )}
                {isReadingPassageAnnotatable && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      effectiveTopShouldCompress ? "w-9 px-0" : "min-w-[112px]",
                      isAnnotationModeEnabled
                        ? "border-primary bg-primary text-primary-foreground shadow-sm hover:!border-cobalt hover:!bg-cobalt hover:!text-white dark:border-primary dark:bg-primary dark:text-primary-foreground dark:hover:!border-cobalt dark:hover:!bg-cobalt dark:hover:!text-white"
                        : "bg-background text-foreground dark:border-white/20",
                    )}
                    onClick={() => setIsAnnotationModeEnabled((prev) => !prev)}
                    title={isAnnotationModeEnabled ? "Turn annotation mode off" : "Turn annotation mode on"}
                    aria-pressed={isAnnotationModeEnabled}
                  >
                    <Highlighter className={effectiveTopShouldCompress ? "h-4 w-4" : "mr-2 h-4 w-4"} />
                    {!effectiveTopShouldCompress && "Annotate"}
                  </Button>
                )}
                <DropdownMenu modal={false} open={isMoreMenuOpen} onOpenChange={(open) => {
                  setIsMoreMenuOpen(open);
                  if (open) void ensureCurrentSimilarityMeta();
                }}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      title="More"
                      data-tour="question-more-menu"
                      className={effectiveTopShouldCompress ? "w-9 px-0" : undefined}
                    >
                      <MoreHorizontal className={effectiveTopShouldCompress ? "h-4 w-4" : "mr-2 h-4 w-4"} />
                      {!effectiveTopShouldCompress && "More"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="z-[160] w-56" container={windowPortalContainer}>
                    <DropdownMenuLabel>More</DropdownMenuLabel>
                    <DropdownMenuItem onClick={openNoteWindow}>
                      <StickyNote className="mr-2 h-4 w-4" />
                      Add Note
                    </DropdownMenuItem>
                    {subject === "reading" && currentQuestion.type === "multiple-choice" && currentQuestion.choices && (
                      <DropdownMenuCheckboxItem
                        checked={hideAnswerChoices}
                        onCheckedChange={(checked) => handleHideAnswerChoicesChange(checked === true)}
                      >
                        Hide Answer Choices
                      </DropdownMenuCheckboxItem>
                    )}
                    {questionInfo && (
                      <DropdownMenuItem onClick={() => setIsQuestionInfoOpen(true)}>
                        <Info className="mr-2 h-4 w-4" />
                        Question Info
                      </DropdownMenuItem>
                    )}
                    {canCreateSimilarPracticeSet && (
                      <DropdownMenuItem
                        data-tour="create-practice-set-menu-item"
                        onClick={handleCreateSimilarPracticeSet}
                      >
                        <BookOpenCheck className="mr-2 h-4 w-4" />
                        Create Practice Set
                      </DropdownMenuItem>
                    )}
                    {!isEmbed && (
                      <DropdownMenuItem onClick={() => setIsReportOpen(true)}>
                        <Flag className="mr-2 h-4 w-4" />
                        Report Question
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>View Mode</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={effectiveQuestionViewMode}
                      onValueChange={(value) =>
                        handleQuestionViewModeChange(value as QuestionViewMode)
                      }
                    >
                      <DropdownMenuRadioItem value="vertical">
                        <Rows3 className="mr-2 h-4 w-4" />
                        Vertical
                      </DropdownMenuRadioItem>
                      {!isMobile && (
                        <DropdownMenuRadioItem value="horizontal">
                          <Columns3 className="mr-2 h-4 w-4" />
                          Horizontal
                        </DropdownMenuRadioItem>
                      )}
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={toggleTheme}>
                      {isDark ? (
                        <Moon className="mr-2 h-4 w-4" />
                      ) : (
                        <Sun className="mr-2 h-4 w-4" />
                      )}
                      {isDark ? "Light Mode" : "Dark Mode"}
                    </DropdownMenuItem>
                    {!isEmbed && (
                      <DropdownMenuItem onClick={toggleFullscreen}>
                        {isFullscreen ? (
                          <Minimize2 className="mr-2 h-4 w-4" />
                        ) : (
                          <Maximize2 className="mr-2 h-4 w-4" />
                        )}
                        {isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div
              ref={topLeftMeasurementRef}
              aria-hidden="true"
              className="absolute -left-[9999px] whitespace-nowrap"
              style={HIDDEN_MEASUREMENT_STYLE}
            >
              <Button variant="ghost" size="sm">
                <ChevronLeft className="mr-1 h-4 w-4" />
                {isAssessmentMode ? "Save & Exit" : "Home"}
              </Button>
            </div>
            <div
              ref={topMeasurementRef}
              aria-hidden="true"
              className="absolute -left-[9999px] flex items-center gap-2 whitespace-nowrap"
              style={HIDDEN_MEASUREMENT_STYLE}
            >
              {subject === "math" && (
                <>
                  <Button variant="outline" size="sm">
                    <span className="mr-2 inline-block h-4 w-4" />
                    Reference Sheet
                  </Button>
                  <Button variant="outline" size="sm">
                    <span className="mr-2 inline-block h-4 w-4" />
                    Desmos
                  </Button>
                </>
              )}
              {isReadingPassageAnnotatable && (
                <Button variant="outline" size="sm">
                  <span className="mr-2 inline-block h-4 w-4" />
                  Annotate
                </Button>
              )}
              <Button variant="outline" size="sm">
                <span className="mr-2 inline-block h-4 w-4" />
                More
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main
        className={`sat-resize-transition flex-1 pb-28 transition-[max-width,width,margin-left] duration-200 ease-out motion-reduce:transition-none ${effectiveQuestionViewMode === 'horizontal' ? 'px-8 py-6' : 'px-4 py-8'}`}
        style={isSplitScreenActive ? {
          maxWidth: "var(--sat-main-content-width, var(--sat-content-split-pct, 70%))",
          marginLeft: "var(--sat-main-content-offset-x, 0px)",
        } : effectiveQuestionViewMode === 'horizontal' ? { width: "100%" } : { maxWidth: "1280px", margin: "0 auto", width: "100%" }}
      >
        <div
          ref={questionContentRef}
          className={`relative ${effectiveQuestionViewMode === 'horizontal' ? 'p-6' : 'p-4 sm:p-6 md:p-8'}`}
          style={{ maxWidth: effectiveQuestionViewMode === 'horizontal' ? "100%" : "56rem", margin: effectiveQuestionViewMode === 'horizontal' ? "0" : "0 auto" }}
        >
          {effectiveQuestionViewMode === 'horizontal' ? (
            <div className="flex relative" style={{ minHeight: '400px' }}>
              <div
                className={cn("pr-4 space-y-4", isEmbed && "overflow-y-auto")}
                style={{ width: `${questionSplitPosition}%` }}
              >
                {renderQuestionImages()}
                {subject === "reading" ? (
                  <ReadingPassageAnnotator
                    html={readingPassageHtml}
                    storageKey={annotationStorageKey}
                    enabled={isAnnotationModeEnabled}
                    storageArea={noteStorageArea}
                  />
                ) : (
                  renderContent(stemContent)
                )}
              </div>

              <div
                className={cn(
                  "w-4 cursor-col-resize flex items-center justify-center group flex-shrink-0 self-stretch touch-none",
                  isResizingQuestionSplit && "pointer-events-none",
                )}
                onMouseDown={(event) => {
                  event.preventDefault();
                  setIsResizingQuestionSplit(true);
                }}
                onTouchStart={(event) => {
                  if (event.touches.length === 0) return;
                  event.preventDefault();
                  setIsResizingQuestionSplit(true);
                }}
              >
                <div className={cn("w-1 h-full rounded", isResizingQuestionSplit ? "bg-primary/50 transition-none" : "bg-border transition-colors group-hover:bg-primary/50")} />
              </div>

              <div
                className={cn("pl-4", isEmbed && "overflow-y-auto")}
                style={{ width: `${100 - questionSplitPosition}%` }}
              >
                <div className="bg-slate-100 dark:bg-slate-800 flex items-center justify-between mb-4 rounded-md overflow-hidden h-10 shadow-sm border border-slate-200 dark:border-slate-700 px-1">
                  <div className="flex items-center h-full gap-2">
                    <div className="bg-white dark:bg-black text-black dark:text-white h-full min-w-[3.75rem] px-2 flex items-center justify-center font-bold text-lg tabular-nums shrink-0 border-r border-slate-200 dark:border-slate-700 mr-1 -ml-1">
                      {displayQuestionNumber}
                    </div>

                    <Button
                      variant="ghost"
                      onClick={handleToggleReview}
                      className="h-7 rounded px-3 gap-2 font-normal text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-white/10"
                    >
                      <Bookmark className={cn("h-3.5 w-3.5", markedForReview && "bookmark-flag")} />
                      <span className="text-xs font-medium">Mark for Review</span>
                    </Button>
                  </div>

                  <div className="flex items-center h-full gap-1">
                    {currentQuestion.type === "multiple-choice" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleStrikeoutModeToggle}
                        className={cn(
                          "h-7 w-7 rounded text-muted-foreground hover:bg-white/50 hover:text-foreground dark:hover:bg-white/10",
                          strikeoutMode && "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/40 hover:!bg-cobalt hover:!text-white hover:ring-cobalt/45 dark:bg-primary dark:text-primary-foreground dark:hover:!bg-cobalt dark:hover:!text-white",
                        )}
                        title={strikeoutMode ? "Turn strikethrough mode off" : "Turn strikethrough mode on"}
                        aria-pressed={strikeoutMode}
                      >
                        <Strikethrough className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {showQuestionTextAboveChoices && readingQuestionSentence && (
                  <div className="mb-6">
                    {renderContent(readingQuestionSentence, { emphasizeHeaders: false })}
                  </div>
                )}

                {shouldHideAnswerChoices ? (
                  renderHiddenAnswerChoices()
                ) : currentQuestion.type === 'multiple-choice' && currentQuestion.choices ? (
                  <MultipleChoiceQuestion
                    key={localStateKey}
                    choices={currentQuestion.choices}
                    selectedAnswer={selectedAnswer}
                    onAnswerChange={handleAnswerSelectionChange}
                    onCheck={assessmentAllowsChecking || !isAssessmentMode ? handleCheck : undefined}
                    strikeoutMode={strikeoutMode}
                    checkedAnswers={checkedAnswers}
                    questionId={is100Hard ? questionNumber : currentQuestion.uuid}
                    struckOutChoiceIds={isAssessmentMode ? struckOutChoiceIds : undefined}
                    onStruckOutChange={isAssessmentMode ? handleStrikeoutChange : undefined}
                  />
                ) : (
                  renderFreeResponseAnswerControls()
                )}
              </div>
            </div>
          ) : (
            <>
               <div className="bg-slate-100 dark:bg-slate-800 flex items-center justify-between mb-6 rounded-md overflow-hidden h-12 shadow-sm border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center h-full gap-2">
                    <div className="bg-white dark:bg-black text-black dark:text-white h-full min-w-[4.25rem] px-2 flex items-center justify-center font-bold text-xl tabular-nums shrink-0 border-r border-slate-200 dark:border-slate-700 mr-1">
                      {displayQuestionNumber}
                    </div>

                    <Button
                      variant="ghost"
                      onClick={handleToggleReview}
                      className="h-9 rounded px-4 gap-2 font-normal text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-white/10"
                    >
                      <Bookmark className={cn("h-4 w-4", markedForReview && "bookmark-flag")} />
                      <span className="text-sm font-medium">Mark for Review</span>
                    </Button>
                  </div>

                  <div className="flex items-center h-full pr-2 gap-1">
                    {currentQuestion.type === "multiple-choice" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleStrikeoutModeToggle}
                        className={cn(
                          "h-9 w-9 rounded text-muted-foreground hover:bg-white/50 hover:text-foreground dark:hover:bg-white/10",
                          strikeoutMode && "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/40 hover:!bg-cobalt hover:!text-white hover:ring-cobalt/45 dark:bg-primary dark:text-primary-foreground dark:hover:!bg-cobalt dark:hover:!text-white",
                        )}
                        title={strikeoutMode ? "Turn strikethrough mode off" : "Turn strikethrough mode on"}
                        aria-pressed={strikeoutMode}
                      >
                        <Strikethrough className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

              <div className="mb-6 sm:mb-8 space-y-4">
                  {passageContent ? (
                    <>
                      {renderQuestionImages()}
                      <ReadingPassageAnnotator
                        html={readingPassageHtml}
                        storageKey={annotationStorageKey}
                        enabled={isAnnotationModeEnabled}
                        storageArea={noteStorageArea}
                      />
                      {showQuestionTextAboveChoices && readingQuestionSentence && (
                        <div className="mt-4">{renderContent(readingQuestionSentence, { emphasizeHeaders: false })}</div>
                      )}
                    </>
                  ) : (
                    <>
                      {renderQuestionImages()}
                      {subject === "reading" ? (
                        <ReadingPassageAnnotator
                          html={readingPassageHtml}
                          storageKey={annotationStorageKey}
                          enabled={isAnnotationModeEnabled}
                          storageArea={noteStorageArea}
                        />
                      ) : (
                        renderContent(stemContent)
                      )}
                    </>
                  )}
              </div>

              {shouldHideAnswerChoices ? (
                renderHiddenAnswerChoices()
              ) : currentQuestion.type === 'multiple-choice' && currentQuestion.choices ? (
                <MultipleChoiceQuestion
                  key={localStateKey}
                  choices={currentQuestion.choices}
                  selectedAnswer={selectedAnswer}
                  onAnswerChange={handleAnswerSelectionChange}
                  onCheck={assessmentAllowsChecking || !isAssessmentMode ? handleCheck : undefined}
                  strikeoutMode={strikeoutMode}
                  checkedAnswers={checkedAnswers}
                  questionId={is100Hard ? questionNumber : currentQuestion.uuid}
                  subject={subject}
                  struckOutChoiceIds={isAssessmentMode ? struckOutChoiceIds : undefined}
                  onStruckOutChange={isAssessmentMode ? handleStrikeoutChange : undefined}
                />
              ) : (
                renderFreeResponseAnswerControls()
              )}
            </>
          )}
        </div>
      </main>

      <div
        ref={bottomNavRef}
        className={cn(isNativeEmbed ? "absolute" : "fixed", "sat-resize-transition bottom-0 left-0 right-0 bg-card border-t-2 border-border shadow-lg z-40 transition-[width] duration-200 ease-out motion-reduce:transition-none")}
        style={isSplitScreenActive ? { width: "var(--sat-nav-split-pct, 70%)" } : { width: "100%" }}
      >
        <div className="w-full max-w-none px-2 py-3 sm:px-4">
          <div ref={bottomNavGridRef} className="relative flex items-center justify-between gap-1 sm:gap-2">
            <div ref={bottomNavLeftRef} className="shrink-0">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={!canGoPrevious}
                className={cn("h-10", shouldCompress && "w-10 px-0")}
              >
                <ChevronLeft className={shouldCompress ? "h-4 w-4" : "mr-1 h-4 w-4"} />
                {!shouldCompress && <span>Previous</span>}
              </Button>
            </div>

            <div
              ref={bottomNavCenterRef}
              data-nav-sheet
              className="absolute left-1/2 flex items-center justify-center overflow-visible px-1"
              style={{
                transform: "translateX(calc(-50% + var(--sat-bottom-center-offset, 0px)))",
              }}
            >
              {!isEmbed && !isAssessmentMode && currentProgress.attempts.length > 0 && (
                <div className="absolute right-full mr-1 flex shrink-0 items-center">
                  <PreviousAttemptsDialog attempts={currentProgress.attempts} />
                </div>
              )}
              {!isEmbed && (is100Hard ? (
                  <BankNavigationSheet
                    currentQuestion={resolvedQuestionNumber}
                    totalQuestions={100}
                    onJump={(qNum) => navigate(`/hard/${qNum}`)}
                    items={orderedNavigationItems}
                    isSplitScreenActive={isSplitScreenActive}
                    splitPosition={splitPosition}
                    headerActions={(
                      <Button variant="outline" size="sm" onClick={handleGroupAnswered}>
                        Group Answered
                      </Button>
                    )}
                  />
              ) : effectivePracticeMode ? (
                 isAssessmentMode ? (
                      <QuestionNavigatorSheet
                        buttonLabel={
                          isPracticeTestMode
                            ? practiceTestReviewPhase
                              ? `Review ${practiceTestQuestionNumberInModule} of ${practiceTestModuleQuestionCount}`
                              : `Question ${practiceTestQuestionNumberInModule} of ${practiceTestModuleQuestionCount}`
                            : `Question ${currentPracticeIndex + 1} of ${practiceSet.length}`
                        }
                        title={isPracticeTestMode ? practiceTestNavigatorTitle : modulePracticeModule?.publicTitle || "Module Navigator"}
                        subtitle={isPracticeTestMode ? practiceTestNavigatorSubtitle : `${practiceSet.length} questions in this module`}
                        items={modulePracticeNavigatorItems}
                        isSplitScreenActive={isSplitScreenActive}
                        splitPosition={splitPosition}
                        statusMode={assessmentAllowsChecking ? "default" : "answered-unanswered"}
                        headerActions={
                          isPracticeTestMode && !practiceTestReviewPhase ? (
                            <Button variant="outline" size="sm" onClick={handlePracticeTestPhaseAdvance}>
                              Review Questions
                            </Button>
                          ) : isModulePracticeMode && !modulePracticeAllowsChecking ? (
                            <Button variant="outline" size="sm" onClick={handleModulePracticeReview}>
                              Review Questions
                            </Button>
                          ) : null
                        }
                     />
                 ) : (
                     <PracticeNavigationSheet
                        currentIndex={currentPracticeIndex}
                        practiceSet={practiceSet}
                        onJump={navigateToPracticeIndex}
                        isSplitScreenActive={isSplitScreenActive}
                        splitPosition={splitPosition}
                     />
                 )
              ) : (
                 <BankNavigationSheet
                    currentQuestion={resolvedQuestionNumber}
                    totalQuestions={totalQuestions}
                    onJump={handleBankNavigatorJump}
                    items={orderedNavigationItems}
                    isSplitScreenActive={isSplitScreenActive}
                    splitPosition={splitPosition}
                    headerActions={(
                      <Button variant="outline" size="sm" onClick={handleGroupAnswered}>
                        Group Answered
                      </Button>
                    )}
                 />
              ))}
            </div>

            <div
              ref={bottomNavRightRef}
              className={cn("ml-auto flex shrink-0 justify-end", shouldCompress ? "gap-1" : "gap-2")}
            >
              {!isAssessmentMode && (
                <ExplanationWindow
                  onSplitScreenChange={handleSplitScreenChange}
                  onSplitPositionChange={handleSplitPositionChange}
                  splitPosition={splitPosition}
                  compressed={shouldCompress}
                  onFocus={() => bringToFront('explanation')}
                  zIndex={getZIndex('explanation')}
                  isSidebarred={sidebarredWindows.has('explanation')}
                  onSidebarToggle={handleSidebarToggle}
                  correctAnswer={currentQuestion?.correctAnswer}
                  rationale={currentExplanationQuestion?.rationale}
                  questionId={currentQuestion?.uuid || currentQuestion?.id}
                  questionSection={currentExplanationQuestion?.category.subject}
                  questionText={currentExplanationQuestion?.prompt}
                  windowPortalContainer={windowPortalContainer}
                  windowBoundsElement={windowBoundsElement}
                  contentSplitExitPosition={sidebarExitContentSplitPosition}
                  sidebarExitHeaderMaxWidth={QUESTION_HEADER_CONTAINER_MAX_WIDTH}
                  sidebarExitMainMaxWidth={effectiveQuestionViewMode === "horizontal" ? undefined : QUESTION_CONTENT_MAX_WIDTH}
                />
              )}
              {(!isAssessmentMode || assessmentAllowsChecking) && (
                <Button
                  onClick={() => handleCheck()}
                  disabled={isCheckDisabled}
                  variant="outline"
                  className={cn("h-10 border-2 transition-colors duration-150 ease-out", shouldCompress && "w-10 px-0", getCheckButtonClasses())}
                >
                  <Check className={shouldCompress ? "h-4 w-4" : "mr-1 h-4 w-4"} />
                  {!shouldCompress && <span>Check</span>}
                </Button>
              )}
              <Button
                onClick={handleEmbedAwareAdvance}
                disabled={isAssessmentMode ? false : !canGoNext && !isAtPreviewQuestionLimit}
                variant="outline"
                className={cn("h-10 transition-colors duration-200 ease-out", shouldCompress && "w-10 px-0")}
              >
                {!shouldCompress && (
                  <span>
                    {practiceTestAdvanceLabel}
                  </span>
                )}
                <ChevronRight className={shouldCompress ? "h-4 w-4" : "ml-1 h-4 w-4"} />
              </Button>
            </div>

            <div
              ref={bottomLeftMeasurementRef}
              aria-hidden="true"
              className="absolute -left-[9999px] whitespace-nowrap"
              style={HIDDEN_MEASUREMENT_STYLE}
            >
              <Button variant="outline" className="h-10">
                <ChevronLeft className="mr-1 h-4 w-4" />
                <span>Previous</span>
              </Button>
            </div>
            <div
              ref={bottomMeasurementRef}
              aria-hidden="true"
              className="absolute -left-[9999px] flex gap-2 whitespace-nowrap"
              style={HIDDEN_MEASUREMENT_STYLE}
            >
              {!isAssessmentMode && (
                <Button variant="outline" size="sm" className="h-10">
                  <span className="mr-2 inline-block h-4 w-4" />
                  Explanation
                </Button>
              )}
              {(!isAssessmentMode || assessmentAllowsChecking) && (
                <Button variant="outline" className="h-10 border-2">
                  <Check className="mr-1 h-4 w-4" />
                  <span>Check</span>
                </Button>
              )}
              <Button variant="outline" className="h-10">
                <span>{practiceTestAdvanceLabel}</span>
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Question;
