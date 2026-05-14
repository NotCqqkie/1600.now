import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BankNavigationSheet } from "@/components/BankNavigationSheet";
import { PracticeNavigationSheet } from "@/components/PracticeNavigationSheet";
import { ModulePracticeNavigationSheet } from "@/components/ModulePracticeNavigationSheet";
import { FormulaSheetDialog } from "@/components/FormulaSheetDialog";
import { DesmosDialog } from "@/components/DesmosDialog";
import { ExplanationWindow } from "@/components/ExplanationWindow";
import { ReadingPassageAnnotator } from "@/components/ReadingPassageAnnotator";
import { QuestionNotesWindow } from "@/components/QuestionNotesWindow";
import { ReportQuestionDialog } from "@/components/ReportQuestionDialog";
import { MultipleChoiceQuestion } from "@/components/MultipleChoiceQuestion";
import { PreviousAttemptsDialog } from "@/components/PreviousAttemptsDialog";
import { TransparentAwareImage } from "@/components/TransparentAwareImage";
import { ChevronLeft, ChevronRight, Check, Bookmark, Eye, EyeOff, Flag, Pause, Play, Strikethrough, Maximize2, Minimize2, Rows3, Columns3, Info, Highlighter, Moon, MoreHorizontal, StickyNote, Sun } from "lucide-react";
import { toast } from "sonner";
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
import { questions as originalQuestions } from "@/data/100 Hard";
import {
  getBankCounts,
  getBankPool,
  getBankQuestion,
  getBankQuestionBySourceId,
  normalizeBankSource,
  type BankSourceFilter,
} from "@/data/questionBank";
import { getSynthesizedPracticeQuestion } from "@/data/modulePracticeBank";
import { cn, normalizePublicAssetPath } from "@/lib/utils";
import { answersEquivalent } from "@/lib/answerEquivalence";
import { renderMixedContent } from "@/lib/mathRendering";
import { normalizeReadingDisplayText } from "@/lib/readingTextNormalization";
import { applyTheme } from "@/lib/theme";
import { getPracticeModule, getPracticeSet } from "@/data/modulePracticeBank";
import {
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
} from "@/lib/modulePracticeSession";
import {
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
  tickPracticeTestActiveModule,
  type PracticeTestSessionMeta,
} from "@/lib/practiceTestSession";
import { useUserProgress } from "@/hooks/useUserProgress";
import { useThemeMode } from "@/hooks/useThemeMode";
import "katex/dist/katex.min.css";

const hardQuestions = originalQuestions.map(q => ({
  ...q,
  uuid: `hard-${q.id}`
}));

type LowerThanHysteresisArgs = {
  currentState: boolean;
  value: number;
  enterThreshold: number;
  exitThreshold: number;
};

type GreaterThanHysteresisArgs = {
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

const getNextStateForGreaterThan = ({
  currentState,
  value,
  enterThreshold,
  exitThreshold,
}: GreaterThanHysteresisArgs) => {
  if (currentState) {
    return value >= exitThreshold;
  }
  return value > enterThreshold;
};

type PracticeSetItem = {
  id: number;
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

type OrderedNavigationItem = {
  id: number;
  storageId: string;
};

const getStoredQuestionStatus = (storageId: string): string =>
  localStorage.getItem(`${storageId}-status`) || "unanswered";

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

const formatTimer = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const boundaryRe = new RegExp(
    `(?:[.!?]|</u>|["”’)\\]])\\s+(?=(?:${startersAlt})\\b)`,
    "gi",
  );

  const boundaries = [...trimmed.matchAll(boundaryRe)];
  for (let i = boundaries.length - 1; i >= 0; i--) {
    const m = boundaries[i];
    const splitAt = m.index! + m[0].length;
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

const extractLeadingQuestionSentence = (text: string): { sentence?: string; remainder: string } => {
  const trimmed = text.trim();
  if (!trimmed) {
    return { remainder: trimmed };
  }

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

type QuestionViewMode = "vertical" | "horizontal";

const getDefaultQuestionViewMode = (
  subject: "math" | "reading",
  isBank: boolean,
): QuestionViewMode => {
  if (isBank) {
    return subject === "reading" ? "horizontal" : "vertical";
  }

  return "vertical";
};

const getQuestionViewModeStorageKey = (
  subject: "math" | "reading",
  isBank: boolean,
) => {
  if (isBank) return `question-view-mode:bank:${subject}`;
  return "question-view-mode:hard";
};

const getDefaultQuestionSplitPosition = (subject: "math" | "reading") =>
  subject === "reading" ? 55 : 50;

const READING_ANNOTATION_MODE_STORAGE_KEY = "question-reading-annotation-mode";

const EPHEMERAL_STORAGE: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  key: () => null,
};

function Question() {
  const { id, subject: rawSubject } = useParams<{ id: string; subject?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // The embed=1 mode is only intended for the homepage iframe preview. If a
  // user navigates here directly (top-level window), strip the embed param
  // and reload as a normal question page so they don't get the cropped/no-
  // scroll preview UI.
  const requestedEmbed = searchParams.get("embed") === "1";
  const inIframe = typeof window !== "undefined" && window.self !== window.top;
  useEffect(() => {
    if (!requestedEmbed || inIframe) return;
    const stripped = new URLSearchParams(searchParams);
    stripped.delete("embed");
    stripped.delete("theme");
    navigate(
      { pathname: location.pathname, search: stripped.toString() ? `?${stripped}` : "" },
      { replace: true },
    );
  }, [requestedEmbed, inIframe, navigate, location.pathname, searchParams]);
  const isEmbed = requestedEmbed && inIframe;
  const sharedIsDark = useThemeMode();
  const embedThemeParam = searchParams.get("theme");
  const [embedIsDark, setEmbedIsDark] = useState<boolean>(() =>
    embedThemeParam === "dark"
      ? true
      : embedThemeParam === "light"
        ? false
        : sharedIsDark,
  );
  // In embed mode: apply theme to THIS iframe's document only (no localStorage,
  // no event dispatch, so toggling inside the preview won't flip the parent).
  useEffect(() => {
    if (!isEmbed || typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("dark", embedIsDark);
    root.style.colorScheme = embedIsDark ? "dark" : "light";
  }, [isEmbed, embedIsDark]);
  // In embed mode: disable internal scrolling + forward wheel to parent page.
  // preventDefault + passive:false stops the browser from also bubbling the
  // wheel natively, which would double-scroll the parent.
  useEffect(() => {
    if (!isEmbed || typeof document === "undefined") return;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    const forwardWheel = (e: WheelEvent) => {
      e.preventDefault();
      try {
        window.parent?.postMessage(
          { type: "heroWheel", deltaY: e.deltaY, deltaX: e.deltaX },
          "*",
        );
      } catch {
        /* noop */
      }
    };
    window.addEventListener("wheel", forwardWheel, { passive: false });
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
      window.removeEventListener("wheel", forwardWheel);
    };
  }, [isEmbed]);
  const isDark = isEmbed ? embedIsDark : sharedIsDark;

  const isBank = location.pathname.startsWith('/bank');
  const is100Hard = !isBank;

  const isPracticeMode = searchParams.get('practice') === 'true';
  const modulePracticeSlug = searchParams.get("modulePractice");
  const modulePracticeSessionId = searchParams.get("moduleSession");
  const practiceTestSetId = searchParams.get("practiceTest");
  const practiceTestSessionId = searchParams.get("practiceTestSession");
  const bankSource = normalizeBankSource(searchParams.get("bankType"));
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
  const practiceExitTo = useMemo(
    () => sessionStorage.getItem("practiceExitTo"),
    [location.key],
  );
  const modulePracticeModule = useMemo(
    () => (modulePracticeSlug ? getPracticeModule(modulePracticeSlug) : null),
    [modulePracticeSlug],
  );
  const practiceTestSet = useMemo(
    () => (practiceTestSetId ? getPracticeSet(practiceTestSetId) : null),
    [practiceTestSetId],
  );
  const [modulePracticeSessionMeta, setModulePracticeSessionMeta] = useState<ModulePracticeSessionMeta | null>(() =>
    modulePracticeSlug ? getModulePracticeSession(modulePracticeSlug) : null,
  );
  const [practiceTestSessionMeta, setPracticeTestSessionMeta] = useState<PracticeTestSessionMeta | null>(() =>
    practiceTestSetId ? getPracticeTestSession(practiceTestSetId) : null,
  );

  const idParam = id || "1";
  const questionNumber = parseInt(idParam, 10);
  const subject = (rawSubject === "math" || rawSubject === "reading" ? rawSubject : "math") as "math" | "reading";

  const questionData = useMemo(() => {
    if (is100Hard) {
      return hardQuestions.find(q => q.id === questionNumber);
    }

    const q =
      getBankQuestionBySourceId(subject, idParam, bankSource) ??
      getSynthesizedPracticeQuestion(subject, idParam) ??
      (/^\d+$/.test(idParam) ? getBankQuestion(subject, questionNumber, bankSource) : null);

    if (!q) return null;
    return {
      ...q,
      uuid: q.stableId,
    };

  }, [is100Hard, idParam, questionNumber, subject, bankSource]);
  const currentQuestion = questionData;
  const currentPracticeIndex = useMemo(() => {
    if (!isPracticeMode || practiceSet.length === 0) return -1;
    return practiceSet.findIndex(
      (q) =>
        q.subject === subject &&
        (q.storageId
          ? q.storageId === currentQuestion?.uuid
          : q.id === questionNumber &&
            (!q.bankType || q.bankType === bankSource)),
    );
  }, [isPracticeMode, practiceSet, questionNumber, subject, bankSource, currentQuestion]);
  const effectivePracticeMode = !is100Hard && isPracticeMode && practiceSet.length > 0 && currentPracticeIndex >= 0;
  const modulePracticeStateSessionId = modulePracticeSessionId || modulePracticeSessionMeta?.sessionId || null;
  const practiceTestStateSessionId = practiceTestSessionId || practiceTestSessionMeta?.sessionId || null;
  const isModulePracticeMode = Boolean(
    effectivePracticeMode &&
      modulePracticeSlug &&
      modulePracticeStateSessionId,
  );
  const isPracticeTestMode = Boolean(
    effectivePracticeMode &&
      practiceTestSetId &&
      practiceTestStateSessionId,
  );
  const isAssessmentMode = isModulePracticeMode || isPracticeTestMode;
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

  const { progress, addAttempt, toggleReview } = useUserProgress();
  
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [freeResponseAnswer, setFreeResponseAnswer] = useState<string>("");
  const [strikeoutMode, setStrikeoutMode] = useState(false);
  const [struckOutChoiceIds, setStruckOutChoiceIds] = useState<string[]>([]);
  const [checkButtonState, setCheckButtonState] = useState<"idle" | "incorrect" | "correct-first" | "correct-later">("idle");
  const [checkFlashKey, setCheckFlashKey] = useState(0);
  const [checkColorVisible, setCheckColorVisible] = useState(false);
  const [checkedAnswers, setCheckedAnswers] = useState<Record<string, boolean>>({});
  const [splitScreenWindows, setSplitScreenWindows] = useState<Set<string>>(new Set());
  const [sidebarredWindows, setSidebarredWindows] = useState<Set<string>>(new Set());
  const [splitPosition, setSplitPosition] = useState(70);
  const [attemptCount, setAttemptCount] = useState(0);
  const [shouldCompress, setShouldCompress] = useState(false);
  const [topShouldCompress, setTopShouldCompress] = useState(false);
  const [shouldPinBottomNavCenter, setShouldPinBottomNavCenter] = useState(true);
  const [shouldPinTopTimerCenter, setShouldPinTopTimerCenter] = useState(true);
  const [windowOrder, setWindowOrder] = useState<string[]>(['referenceSheet', 'desmos', 'explanation', 'note']);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [questionViewMode, setQuestionViewMode] = useState<QuestionViewMode>(() =>
    getDefaultQuestionViewMode(subject, isBank),
  );
  const [questionSplitPosition, setQuestionSplitPosition] = useState(() =>
    getDefaultQuestionSplitPosition(subject),
  );
  const [isResizingQuestionSplit, setIsResizingQuestionSplit] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [isTimerVisible, setIsTimerVisible] = useState(true);
  const [isTimerExpiredOpen, setIsTimerExpiredOpen] = useState(false);
  const [groupedOrderVersion, setGroupedOrderVersion] = useState(0);
  const [isQuestionInfoOpen, setIsQuestionInfoOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isNoteWindowOpen, setIsNoteWindowOpen] = useState(false);
  const [isAnnotationModeEnabled, setIsAnnotationModeEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(READING_ANNOTATION_MODE_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  });
  const [modulePracticeMarkedForReview, setModulePracticeMarkedForReview] = useState(false);
  const bottomNavRef = useRef<HTMLDivElement>(null);
  const bottomNavGridRef = useRef<HTMLDivElement>(null);
  const bottomNavLeftRef = useRef<HTMLDivElement>(null);
  const bottomNavCenterRef = useRef<HTMLDivElement>(null);
  const bottomNavRightRef = useRef<HTMLDivElement>(null);
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
  const bottomCenterPinnedRef = useRef(true);
  const topTimerPinnedRef = useRef(true);
  const startTimeRef = useRef(Date.now());
  const questionVisitStartedAtRef = useRef(Date.now());
  const hasTimerExpiredRef = useRef(false);

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

  const currentProgress = currentQuestion ? (progress[currentQuestion.uuid] || { isMarkedForReview: false, attempts: [] }) : { isMarkedForReview: false, attempts: [] };
  const localStateKey = currentQuestion
    ? (is100Hard ? `question-${questionNumber}` : currentQuestion.uuid)
    : `question-${questionNumber}`;
  const readModulePracticeQuestionState = (): ModulePracticeQuestionState | null => {
    if (!currentQuestion) return null;
    if (isPracticeTestMode && practiceTestStateSessionId) {
      return getPracticeTestQuestionState(practiceTestStateSessionId, currentQuestion.uuid);
    }
    if (isModulePracticeMode && modulePracticeStateSessionId) {
      return getModulePracticeQuestionState(modulePracticeStateSessionId, currentQuestion.uuid);
    }
    return null;
  };
  const persistModulePracticeQuestionState = (
    updater: (
      previous: ModulePracticeQuestionState,
    ) => ModulePracticeQuestionState,
  ) => {
    if (!currentQuestion) return null;
    if (isPracticeTestMode && practiceTestStateSessionId) {
      const previous = getPracticeTestQuestionState(
        practiceTestStateSessionId,
        currentQuestion.uuid,
      );
      const next = updater(previous);
      savePracticeTestQuestionState(
        practiceTestStateSessionId,
        currentQuestion.uuid,
        next,
      );
      return next;
    }
    if (!isModulePracticeMode || !modulePracticeStateSessionId) return null;
    const previous = getModulePracticeQuestionState(
      modulePracticeStateSessionId,
      currentQuestion.uuid,
    );
    const next = updater(previous);
    saveModulePracticeQuestionState(
      modulePracticeStateSessionId,
      currentQuestion.uuid,
      next,
    );
    return next;
  };
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
      category?: {
        domain?: string;
        skill?: string;
      };
    }>;

    const sourceSubject = questionWithMetadata.subject || subject;
    const subjectLabel = sourceSubject === "reading" ? "Reading and Writing" : "Math";

    const fields: QuestionInfoField[] = [
      { label: "Section", value: subjectLabel },
      { label: "Difficulty", value: questionWithMetadata.difficulty || "Unassigned" },
      { label: "Domain", value: questionWithMetadata.category?.domain || "Unassigned" },
      { label: "Skill", value: questionWithMetadata.category?.skill || "Unassigned" },
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

    if (isBank) {
      return getBankPool(subject, bankSource)
        .filter((question) => !difficultyFilter || question.difficulty === difficultyFilter)
        .map((question) => ({
          id: question.id,
          storageId: question.stableId,
        }));
    }

    return [];
  }, [bankSource, difficultyFilter, is100Hard, isBank, subject]);

  const groupedOrderStorageKey = useMemo(
    () =>
      getGroupedQuestionOrderStorageKey({
        is100Hard,
        subject,
        bankSource,
      }),
    [bankSource, is100Hard, subject],
  );

  const orderedNavigationItems = useMemo<OrderedNavigationItem[]>(() => {
    if (baseNavigationItems.length === 0) return [];

    const defaultOrder = baseNavigationItems.map((item) => item.id);
    const resolvedOrder = reconcileQuestionOrder(
      defaultOrder,
      readStoredQuestionOrder(groupedOrderStorageKey),
    );
    const itemMap = new Map(baseNavigationItems.map((item) => [item.id, item]));

    return resolvedOrder
      .map((id) => itemMap.get(id))
      .filter((item): item is OrderedNavigationItem => Boolean(item));
  }, [baseNavigationItems, groupedOrderStorageKey, groupedOrderVersion]);

  // Items for the 100 Hard Questions navigator — storageId matches the
  // localStateKey format "question-N" so BankNavigationSheet reads the
  // same localStorage keys as the rest of the hard question logic.
  const orderedQuestionIds = useMemo(
    () => orderedNavigationItems.map((item) => item.id),
    [orderedNavigationItems],
  );

  useEffect(() => {
    const storageKey = getQuestionViewModeStorageKey(subject, isBank);
    const storedMode = sessionStorage.getItem(storageKey);
    const defaultMode = getDefaultQuestionViewMode(subject, isBank);
    setQuestionViewMode(
      storedMode === "horizontal" || storedMode === "vertical"
        ? storedMode
        : defaultMode,
    );
  }, [isBank, subject]);

  useEffect(() => {
    if (questionViewMode !== "horizontal") return;
    setQuestionSplitPosition(getDefaultQuestionSplitPosition(subject));
  }, [questionNumber, questionViewMode, subject, isBank]);

  useEffect(() => {
    localStorage.setItem(
      READING_ANNOTATION_MODE_STORAGE_KEY,
      String(isAnnotationModeEnabled),
    );
  }, [isAnnotationModeEnabled]);

  const handleQuestionViewModeChange = (mode: QuestionViewMode) => {
    const storageKey = getQuestionViewModeStorageKey(subject, isBank);
    sessionStorage.setItem(storageKey, mode);
    setQuestionViewMode(mode);
  };

  useEffect(() => {
    startTimeRef.current = Date.now();
    questionVisitStartedAtRef.current = Date.now();
    hasTimerExpiredRef.current = false;
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
    isPracticeTestMode,
    practiceTestActiveModule,
    isModulePracticeMode,
    modulePracticeSessionMeta?.sessionId,
    currentQuestion?.uuid,
  ]);

  useEffect(() => {
    if (isPracticeTestMode && practiceTestSessionMeta && practiceTestActiveModule) {
      if (practiceTestSessionMeta.status !== "active") {
        return;
      }

      const timerId = window.setInterval(() => {
        setPracticeTestSessionMeta((previous) => {
          if (!previous || previous.status !== "active") return previous;

          const next = tickPracticeTestActiveModule(previous);
          const nextActiveModule = next.modules[next.activeModuleIndex];
          if (!nextActiveModule) return previous;

          savePracticeTestSession(next);
          setElapsedSeconds(nextActiveModule.elapsedSeconds);
          return next;
        });
      }, 1000);

      return () => window.clearInterval(timerId);
    }

    if (isModulePracticeMode && modulePracticeSessionMeta) {
      const timerId = window.setInterval(() => {
        setModulePracticeSessionMeta((previous) => {
          if (!previous) return previous;
          if (previous.settings.timed && previous.remainingSeconds === 0) {
            if (!hasTimerExpiredRef.current) {
              hasTimerExpiredRef.current = true;
              setIsTimerExpiredOpen(true);
            }
            return previous;
          }

          const nextElapsed = previous.elapsedSeconds + 1;
          const nextRemaining =
            previous.settings.timed && previous.remainingSeconds !== null
              ? Math.max(0, previous.remainingSeconds - 1)
              : null;
          const next = {
            ...previous,
            elapsedSeconds: nextElapsed,
            remainingSeconds: nextRemaining,
          };
          saveModulePracticeSession(next);
          setElapsedSeconds(nextElapsed);
          if (nextRemaining === 0 && previous.remainingSeconds !== 0 && !hasTimerExpiredRef.current) {
            hasTimerExpiredRef.current = true;
            setIsTimerExpiredOpen(true);
          }
          return next;
        });
      }, 1000);

      return () => window.clearInterval(timerId);
    }

    if (isTimerPaused) return;

    const timerId = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [
    isPracticeTestMode,
    practiceTestSessionMeta?.sessionId,
    practiceTestSessionMeta?.status,
    isModulePracticeMode,
    isTimerPaused,
    modulePracticeSessionMeta?.sessionId,
  ]);

  const isSplitScreenActive = splitScreenWindows.size > 0;

  useLayoutEffect(() => {
    const checkSpace = () => {
      if (bottomNavRef.current && bottomMeasurementRef.current) {
        const containerWidth = bottomNavRef.current.offsetWidth;
        const buttonsNaturalWidth = bottomMeasurementRef.current.scrollWidth;
        const navSheet = bottomNavRef.current.querySelector('[data-nav-sheet]');
        const navSheetWidth = navSheet ? (navSheet as HTMLElement).offsetWidth : 120;
        const prevButtonWidth = 100;
        const requiredWidth = prevButtonWidth + navSheetWidth + buttonsNaturalWidth + 48;
        const currentlyCompressed = bottomCompressStateRef.current;

        const nextCompressed = getNextStateForLowerThan({
          currentState: currentlyCompressed,
          value: containerWidth,
          enterThreshold: requiredWidth + 12,
          exitThreshold: requiredWidth + 36,
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
        const containerWidth = bottomNavRef.current?.offsetWidth ?? 0;
        const leftWidth = bottomNavLeftRef.current.offsetWidth;
        const rightWidth = bottomNavRightRef.current.offsetWidth;
        const centerWidth = bottomNavCenterRef.current.offsetWidth;
        const centeredLeft = containerWidth / 2 - centerWidth / 2;
        const centeredRight = containerWidth / 2 + centerWidth / 2;
        const leftGap = centeredLeft - leftWidth;
        const rightGap = (containerWidth - rightWidth) - centeredRight;
        const currentlyPinned = bottomCenterPinnedRef.current;
        const splitThresholdBuffer = 30;
        const repinSlack = 12;

        const nextPinned = currentlyPinned
          ? leftGap >= gridGap + splitThresholdBuffer && rightGap >= gridGap + splitThresholdBuffer
          : leftGap >= gridGap + splitThresholdBuffer + repinSlack &&
            rightGap >= gridGap + splitThresholdBuffer + repinSlack;

        if (nextPinned !== currentlyPinned) {
          bottomCenterPinnedRef.current = nextPinned;
          setShouldPinBottomNavCenter(nextPinned);
        }
      }

      if (topNavRef.current && topLeftRef.current && topRightControlsRef.current && topTimerRef.current) {
        const containerWidth = topNavRef.current.offsetWidth;
        const leftWidth = topLeftRef.current.offsetWidth;
        const rightControlsWidth = topRightControlsRef.current.offsetWidth;
        const timerWidth = topTimerRef.current.offsetWidth;
        const navGap = Number.parseFloat(getComputedStyle(topNavRef.current).columnGap || "12") || 12;
        const centeredLeft = containerWidth / 2 - timerWidth / 2;
        const centeredRight = containerWidth / 2 + timerWidth / 2;
        const leftGap = centeredLeft - leftWidth;
        const rightGap = (containerWidth - rightControlsWidth) - centeredRight;
        const currentlyPinned = topTimerPinnedRef.current;
        const repinSlack = 12;

        const nextPinned = currentlyPinned
          ? leftGap >= navGap && rightGap >= navGap
          : leftGap >= navGap + repinSlack && rightGap >= navGap + repinSlack;

        if (nextPinned !== currentlyPinned) {
          topTimerPinnedRef.current = nextPinned;
          setShouldPinTopTimerCenter(nextPinned);
        }
      }

      if (topNavRef.current && topMeasurementRef.current && topLeftMeasurementRef.current) {
        const containerWidth = topNavRef.current.offsetWidth;
        const leftNaturalWidth = topLeftMeasurementRef.current.scrollWidth;
        const rightNaturalWidth = topMeasurementRef.current.scrollWidth;
        const requiredWidth = leftNaturalWidth + rightNaturalWidth + 40;
        const currentlyCompressed = topCompressStateRef.current;

        const nextCompressed = getNextStateForLowerThan({
          currentState: currentlyCompressed,
          value: containerWidth,
          enterThreshold: requiredWidth + 12,
          exitThreshold: requiredWidth + 40,
        });

        if (nextCompressed !== currentlyCompressed) {
          topCompressStateRef.current = nextCompressed;
          setTopShouldCompress(nextCompressed);
        }
      }
    };

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
    if (bottomMeasurementRef.current) resizeObserver.observe(bottomMeasurementRef.current);

    window.addEventListener('resize', scheduleCheck);
    scheduleCheck();

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      window.removeEventListener('resize', scheduleCheck);
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isResizingQuestionSplit) return;

    document.body.classList.add("noselect");

    const handleMouseMove = (e: MouseEvent) => {
      const availableWidth = isSplitScreenActive 
        ? (window.innerWidth * splitPosition) / 100 
        : window.innerWidth;
      const newPosition = (e.clientX / availableWidth) * 100;
      const clampedPosition = Math.max(25, Math.min(75, newPosition));
      setQuestionSplitPosition(clampedPosition);
    };

    const handleMouseUp = () => {
      setIsResizingQuestionSplit(false);
      document.body.classList.remove("noselect");
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove("noselect");
    };
  }, [isResizingQuestionSplit, isSplitScreenActive, splitPosition]);

  useEffect(() => {
    setIsFullscreen(Boolean(document.fullscreenElement));
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleSplitScreenChange = (isSplit: boolean, windowId: string) => {
    setSplitScreenWindows(prev => {
      const newSet = new Set(prev);
      if (isSplit) newSet.add(windowId);
      else newSet.delete(windowId);
      return newSet;
    });
  };

  const handleSidebarToggle = (windowId: string, shouldBeSidebarred: boolean) => {
    setSidebarredWindows(prev => {
      const newSet = new Set(prev);
      if (shouldBeSidebarred) newSet.add(windowId);
      else newSet.delete(windowId);
      return newSet;
    });
  };

  const handleSplitPositionChange = (newPosition: number) => {
    const roundedPosition = Math.round(newPosition * 4) / 4;
    setSplitPosition(prev => (Math.abs(prev - roundedPosition) < 0.25 ? prev : roundedPosition));
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      const request = document.documentElement.requestFullscreen?.();
      if (request && typeof (request as Promise<void>).catch === "function") {
        (request as Promise<void>).catch(() => {});
      }
    } else {
      const exit = document.exitFullscreen?.();
      if (exit && typeof (exit as Promise<void>).catch === "function") {
        (exit as Promise<void>).catch(() => {});
      }
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
    if (!isSplitScreenActive) {
      setSplitPosition(70);
    }
  }, [isSplitScreenActive]);

  useEffect(() => {
    if (isSplitScreenActive) {
      document.documentElement.style.setProperty('--modal-center-x', `${splitPosition / 2}%`);
      document.documentElement.style.setProperty('--sat-split-pct', `${splitPosition}%`);
    } else {
      document.documentElement.style.removeProperty('--modal-center-x');
      document.documentElement.style.removeProperty('--sat-split-pct');
    }
    return () => {
      document.documentElement.style.removeProperty('--modal-center-x');
      document.documentElement.style.removeProperty('--sat-split-pct');
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

    setSelectedAnswer("");
    setFreeResponseAnswer("");
    setCheckedAnswers({});
    setCheckButtonState("idle");
    setAttemptCount(0);
    setStruckOutChoiceIds([]);
  }, [isAssessmentMode, questionNumber, currentQuestion?.uuid]);

  useEffect(() => {
    if (checkButtonState === "idle") {
      setCheckColorVisible(false);
      return;
    }
    setCheckColorVisible(true);
    const fadeTimer = window.setTimeout(() => setCheckColorVisible(false), 3500);
    return () => window.clearTimeout(fadeTimer);
  }, [checkButtonState, checkFlashKey]);

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
      center?: boolean;
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
      center?: boolean;
      emphasizeHeaders?: boolean;
    } = {},
  ) => {
    if (!content) return null;
    const { center = false } = options;
    const html = getRenderedContentHtml(content, options);
    return (
      <div 
        className={cn("text-foreground break-words prose prose-stone dark:prose-invert max-w-none", center && "text-center")}
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
    if (subject) {
      const counts = getBankCounts(bankSource);
      return counts[subject] || 0;
    }
    return 0;
  }, [is100Hard, effectivePracticeMode, practiceSet, subject, bankSource]);

  const currentOrderedQuestionIndex = useMemo(
    () => orderedQuestionIds.indexOf(questionNumber),
    [orderedQuestionIds, questionNumber],
  );
  const displayQuestionNumber = isPracticeTestMode
    ? practiceTestQuestionNumberInModule || currentPracticeIndex + 1
    : effectivePracticeMode
      ? currentPracticeIndex + 1
      : questionNumber;
  const isAtPracticeTestModuleEnd = Boolean(
    isPracticeTestMode &&
      practiceTestCurrentModuleEndIndex >= 0 &&
      currentPracticeIndex === practiceTestCurrentModuleEndIndex,
  );
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

  const flushModulePracticeQuestionTime = () => {
    if (!isAssessmentMode || !currentQuestion) return;
    const delta = Math.max(
      0,
      Math.round((Date.now() - questionVisitStartedAtRef.current) / 1000),
    );
    if (!delta) return;
    persistModulePracticeQuestionState((previous) => ({
      ...previous,
      timeSpentSeconds: previous.timeSpentSeconds + delta,
    }));
    questionVisitStartedAtRef.current = Date.now();
  };

  useEffect(() => {
    if (isPracticeTestMode && practiceTestSessionMeta) {
      const nextCurrentIndex = currentPracticeIndex >= 0 ? currentPracticeIndex : 0;

      if (practiceTestSessionMeta.currentIndex === nextCurrentIndex) {
        return;
      }

      const nextSession = {
        ...practiceTestSessionMeta,
        currentIndex: nextCurrentIndex,
      };
      setPracticeTestSessionMeta(nextSession);
      savePracticeTestSession(nextSession);
      return;
    }

    if (!isModulePracticeMode || !modulePracticeSessionMeta) return;

    const nextSession = {
      ...modulePracticeSessionMeta,
      currentIndex: currentPracticeIndex >= 0 ? currentPracticeIndex : 0,
    };
    setModulePracticeSessionMeta(nextSession);
    saveModulePracticeSession(nextSession);
  }, [
    currentPracticeIndex,
    isPracticeTestMode,
    practiceTestSessionMeta,
    isModulePracticeMode,
  ]);

  useEffect(() => {
    if (!isAssessmentMode || !currentQuestion) return;
    questionVisitStartedAtRef.current = Date.now();
    return () => {
      flushModulePracticeQuestionTime();
    };
  }, [currentQuestion?.uuid, isAssessmentMode]);

  const navigateToPracticeIndex = (idx: number) => {
    if (!effectivePracticeMode || idx < 0 || idx >= practiceSet.length) return;
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

    const targetIdSegment = target.sourceId ?? target.id;
    navigate(`${base}/${target.subject}/${targetIdSegment}?${params.toString()}`);
  };

  const submitPracticeTestCurrentModule = useCallback((sessionToSubmit: PracticeTestSessionMeta) => {
    if (!isPracticeTestMode || !practiceTestSet) return;

    flushModulePracticeQuestionTime();

    const nextSession = buildPracticeTestSessionAfterCurrentModuleSubmit(sessionToSubmit);
    if (!nextSession) {
      const result = buildPracticeTestResult(practiceTestSet, {
        ...sessionToSubmit,
        status: "submitted",
      });
      savePracticeTestResult(result);
      clearPracticeTestSession(practiceTestSet.id);
      sessionStorage.removeItem("practiceSet");
      sessionStorage.removeItem("practiceExitTo");
      navigate(`/practice-tests/${practiceTestSet.id}/results?session=${result.sessionId}`);
      return;
    }

    setPracticeTestSessionMeta(nextSession);
    savePracticeTestSession(nextSession);
    navigate(
      `/practice-tests/${practiceTestSet.id}/transition?session=${sessionToSubmit.sessionId}&kind=${sessionToSubmit.activeModuleIndex === 1 ? "break" : "module"}`,
    );
  }, [flushModulePracticeQuestionTime, isPracticeTestMode, navigate, practiceTestSet]);

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

  const handlePrevious = () => {
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
  };

  const handleNext = () => {
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
  };

  const handleModulePracticeReview = () => {
    if (!isModulePracticeMode || !modulePracticeSessionMeta || !modulePracticeModule) return;
    flushModulePracticeQuestionTime();
    if (modulePracticeAllowsChecking) {
      const result = buildModulePracticeResult(modulePracticeModule, {
        ...modulePracticeSessionMeta,
        status: "submitted",
      });
      saveModulePracticeResult(result);
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

    const answeredItems = orderedNavigationItems.filter(
      (item) => getStoredQuestionStatus(item.storageId) !== "unanswered",
    );
    const unansweredItems = orderedNavigationItems.filter(
      (item) => getStoredQuestionStatus(item.storageId) === "unanswered",
    );
    const nextOrder = [...answeredItems, ...unansweredItems].map((item) => item.id);

    sessionStorage.setItem(groupedOrderStorageKey, JSON.stringify(nextOrder));
    setGroupedOrderVersion((version) => version + 1);

    const nextQuestionId = unansweredItems[0]?.id ?? answeredItems[0]?.id;
    if (!nextQuestionId || nextQuestionId === questionNumber) return;

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
    localStorage.setItem(`${currentQuestion.uuid}-flagged`, String(nextMarkedState));
  };

  const handleCheck = (overrideAnswer?: string) => {
    if (!currentQuestion) return;
    if (isAssessmentMode && !assessmentAllowsChecking) return;
    const userAnswer = overrideAnswer || (currentQuestion.type === 'multiple-choice' ? selectedAnswer : freeResponseAnswer);
    
    if (!userAnswer) {
      toast.error("Please provide an answer");
      return;
    }

    const alreadyCorrect = Object.values(checkedAnswers).some(Boolean);
    if (alreadyCorrect) return;
    if (checkedAnswers[userAnswer] !== undefined) {
      setCheckFlashKey((k) => k + 1);
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
    setCheckFlashKey((k) => k + 1);

    if (isCorrect) {
      const status = newAttemptCount === 1 ? 'correct-first' : 'correct-later';
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
        addAttempt(currentQuestion.uuid, "correct", duration, formattedAnswer);
        localStorage.setItem(`${localStateKey}-answer`, userAnswer);
        localStorage.setItem(`${localStateKey}-checkedAnswers`, JSON.stringify(newCheckedAnswers));
        localStorage.setItem(`${localStateKey}-status`, status);
      }
    } else {
      setCheckButtonState("incorrect");
      if (isAssessmentMode) {
        persistModulePracticeQuestionState((previous) => ({
          ...previous,
          answer: currentQuestion.type === "multiple-choice" ? userAnswer : previous.answer,
          freeResponseAnswer:
            currentQuestion.type === "free-response" ? userAnswer : previous.freeResponseAnswer,
          checkedAnswers: newCheckedAnswers,
          attemptCount: newAttemptCount,
          status: "incorrect",
        }));
      } else if (!isEmbed) {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        addAttempt(currentQuestion.uuid, "incorrect", duration, formattedAnswer);
        localStorage.setItem(`${localStateKey}-answer`, userAnswer);
        localStorage.setItem(`${localStateKey}-checkedAnswers`, JSON.stringify(newCheckedAnswers));
        localStorage.setItem(`${localStateKey}-status`, 'incorrect');
      }
    }
  };

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
          if (canGoNext) {
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
              localStorage.setItem(`${localStateKey}-answer`, nextId);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleNext,
    handlePrevious,
    handleCheck,
    currentQuestion,
    selectedAnswer,
    questionNumber,
    canGoNext,
    isPracticeTestMode,
    isModulePracticeMode,
    isAssessmentMode,
    assessmentAllowsChecking,
  ]);

  const hasSelection = currentQuestion
    ? currentQuestion.type === 'multiple-choice'
      ? Boolean(selectedAnswer)
      : Boolean(freeResponseAnswer)
    : false;
  const isCheckDisabled = !hasSelection || checkButtonState === "correct-first" || checkButtonState === "correct-later";

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
        return "bg-[#C8E6C9] hover:bg-[#A5D6A7] border-[#1B5E20] text-[#1B5E20] dark:bg-[#1B5E20] dark:hover:bg-[#144216] dark:border-[#2E7D32] dark:text-white disabled:opacity-100";
      case "correct-later":
        return "bg-[#FFE0B2] hover:bg-[#FFCC80] border-[#E65100] text-[#BF360C] dark:bg-[#5F2A00] dark:hover:bg-[#4C2100] dark:border-[#C75C00] dark:text-white disabled:opacity-100";
      case "incorrect":
        return "bg-[#FFCDD2] hover:bg-[#EF9A9A] border-[#B71C1C] text-[#2C1A1A] dark:bg-[#5C1010] dark:hover:bg-[#4A0D0D] dark:border-[#8B0000] dark:text-white";
      default:
        return hasSelection ? "bg-primary/10 hover:bg-primary/20 border-primary/40 text-foreground" : "bg-background text-foreground border-border";
    }
  };

  const questionWithBankFields = (currentQuestion ?? {}) as Partial<{
    prompt: string;
    questionText: string;
    passage: string;
    text: string;
    questionImages: { src: string; alt: string }[];
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
    : isBank
      ? EPHEMERAL_STORAGE
      : localStorage;
  const isReadingPassageAnnotatable = subject === "reading" && Boolean(readingPassageContent);
  const shouldReduceQuestionImageSize = isBank;
      
  const renderQuestionImages = () => {
    if (!questionImages?.length) return null;

    return (
      <div className="space-y-2">
        {questionImages.map((img, idx) => (
          <div key={`${img.src}-${idx}`} className="w-full flex justify-center">
            <TransparentAwareImage
              src={normalizePublicAssetPath(img.src)}
              alt={img.alt || `Question image ${idx + 1}`}
              className={cn(
                "h-auto object-contain",
                subject === "reading"
                  ? shouldReduceQuestionImageSize
                    ? "max-w-[91%] max-h-[420px]"
                    : "max-w-full max-h-[460px]"
                  : shouldReduceQuestionImageSize
                    ? "max-w-[91%] max-h-[309px]"
                    : "max-w-full max-h-[340px]",
              )}
              wrapperClassName={cn("max-w-full", shouldReduceQuestionImageSize && "flex justify-center")}
              loading="lazy"
              trimWhitespace={isBank && bankSource === 'unofficial'}
            />
          </div>
        ))}
      </div>
    );
  };
  
  const backDestination = practiceExitTo || (is100Hard ? "/hard" : isBank ? `/bank?bankType=${bankSource}` : "/bank");

  useEffect(() => {
    setIsNoteWindowOpen(noteStorageArea.getItem(noteWindowOpenKey) === "true");
  }, [noteStorageArea, noteWindowOpenKey]);

  if (!currentQuestion) {
    const fallbackDestination = practiceExitTo || (isBank ? `/bank?bankType=${bankSource}` : "/bank");
    return <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Question not found</h1>
        <Button onClick={() => navigate(fallbackDestination)}>Go Home</Button>
      </div>
    </div>;
  }

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
    if (isEmbed) {
      setEmbedIsDark((prev) => !prev);
      return;
    }
    applyTheme(!isDark);
  };
  const handleSaveAndExit = () => {
    if (isPracticeTestMode && practiceTestSessionMeta && practiceTestSet) {
      flushModulePracticeQuestionTime();
      const pausedSession = {
        ...practiceTestSessionMeta,
        status: "paused" as const,
        currentIndex: currentPracticeIndex >= 0 ? currentPracticeIndex : 0,
      };
      setPracticeTestSessionMeta(pausedSession);
      savePracticeTestSession(pausedSession);
      navigate(`/practice-tests/${practiceTestSet.id}/start`);
      return;
    }

    if (!isModulePracticeMode || !modulePracticeSessionMeta || !modulePracticeModule) {
      navigate(backDestination);
      return;
    }

    flushModulePracticeQuestionTime();
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
  const timerControls = (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => setIsTimerVisible((prev) => !prev)}
        title={isTimerVisible ? "Hide timer" : "Show timer"}
      >
        {isTimerVisible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
      </Button>
      <span className="min-w-[5ch] text-center text-xl font-semibold tabular-nums">
        {isTimerVisible ? formatTimer(displayedTimerSeconds) : "-:--"}
      </span>
      {!isAssessmentMode && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setIsTimerPaused((prev) => !prev)}
          title={isTimerPaused ? "Resume timer" : "Pause timer"}
        >
          {isTimerPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
        </Button>
      )}
    </>
  );
  const questionInfoDialog = questionInfo ? (
    <Dialog open={isQuestionInfoOpen} onOpenChange={setIsQuestionInfoOpen}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden border-white/10 bg-[#101010] p-7 text-white shadow-2xl sm:rounded-[28px] [&>button]:right-5 [&>button]:top-5 [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-2xl [&>button]:border [&>button]:border-white/30 [&>button]:bg-transparent [&>button]:p-0 [&>button]:text-white/80 [&>button]:opacity-100 [&>button]:ring-0 [&>button]:ring-offset-0 [&>button]:transition-colors [&>button]:hover:bg-white/10 [&>button]:hover:text-white [&>button_svg]:h-5 [&>button_svg]:w-5">
        <DialogHeader className="space-y-0">
          <DialogTitle className="text-[1.7rem] font-semibold tracking-[-0.025em] text-white">
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
                <p className="text-[0.82rem] font-medium tracking-[-0.01em] text-white/60">
                  {field.label}
                </p>
                <p className="break-words text-[1.15rem] font-medium leading-snug tracking-[-0.015em] text-white">
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
      <AlertDialogContent>
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
    localStorage.setItem(`${localStateKey}-answer`, answer);
  };
  const handleFreeResponseChange = (answer: string) => {
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
            : answer
              ? "answered"
              : "unanswered",
      }));
    } else {
      localStorage.setItem(`${localStateKey}-answer`, answer);
    }
  };
  const handleStrikeoutChange = (choiceIds: string[]) => {
    setStruckOutChoiceIds(choiceIds);
    if (!isAssessmentMode) return;
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
        key: `${item.subject}-${item.id}`,
        label: idx + 1,
        status,
        isFlagged: state.isMarkedForReview,
        isCurrent: idx === currentPracticeIndex,
        onSelect: () => navigateToPracticeIndex(idx),
        title: `${item.subject === "math" ? "Math" : "Reading"} Q${item.id}`,
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

  return (
    <div className={cn("min-h-screen bg-background flex flex-col relative", isEmbed && "h-screen overflow-hidden")}>
      {questionInfoDialog}
      {isModulePracticeMode && modulePracticeSessionMeta?.settings.timed ? timerExpiredDialog : null}
      <ReportQuestionDialog
        open={isReportOpen}
        onOpenChange={setIsReportOpen}
        questionId={currentQuestion?.uuid}
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
        constrainToLeft={isSplitScreenActive ? splitPosition : undefined}
      />
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div
          className="container mx-auto px-4 py-4"
          style={isSplitScreenActive ? { maxWidth: "var(--sat-split-pct, 70%)", marginLeft: 0 } : undefined}
        >
          <div className="relative flex items-center justify-between gap-1 sm:gap-3" ref={topNavRef}>
            <div ref={topLeftRef} data-header-left className="flex-shrink-0">
              {isEmbed ? null : isAssessmentMode ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <ChevronLeft className={topShouldCompress ? "h-4 w-4" : "mr-1 h-4 w-4"} />
                      {!topShouldCompress && "Save & Exit"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
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
                  onClick={() => navigate(backDestination)}
                >
                  <ChevronLeft className={topShouldCompress ? "h-4 w-4" : "mr-1 h-4 w-4"} />
                  {!topShouldCompress && "Home"}
                </Button>
              )}
            </div>
            {shouldPinTopTimerCenter && (
              <div ref={topTimerRef} className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
                {timerControls}
              </div>
            )}
            <div ref={topRightRef} className="flex items-center gap-1 sm:gap-2">
              {!shouldPinTopTimerCenter && (
                <div ref={topTimerRef} className="flex items-center gap-1 sm:gap-2 mr-0 sm:mr-1">
                  {timerControls}
                </div>
              )}
              <div ref={topRightControlsRef} className="flex items-center gap-1 sm:gap-2">
                {subject === "math" && (
                  <>
                    <FormulaSheetDialog
                      onSplitScreenChange={handleSplitScreenChange}
                      splitPosition={splitPosition}
                      onFocus={() => bringToFront('referenceSheet')}
                      zIndex={getZIndex('referenceSheet')}
                      constrainToLeft={isSplitScreenActive ? splitPosition : undefined}
                      compressed={topShouldCompress}
                    />
                    <DesmosDialog
                      onSplitScreenChange={handleSplitScreenChange}
                      onSplitPositionChange={handleSplitPositionChange}
                      splitPosition={splitPosition}
                      onFocus={() => bringToFront('desmos')}
                      zIndex={getZIndex('desmos')}
                      constrainToLeft={isSplitScreenActive ? splitPosition : undefined}
                      isSidebarred={sidebarredWindows.has('desmos')}
                      onSidebarToggle={handleSidebarToggle}
                      compressed={topShouldCompress}
                    />
                  </>
                )}
                {isReadingPassageAnnotatable && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      topShouldCompress ? "w-9 px-0" : "min-w-[112px]",
                      isAnnotationModeEnabled
                        ? "bg-[#B4E1FF] text-slate-900 hover:!bg-[#95D4FF] hover:!border-[#95D4FF] hover:text-slate-900"
                        : "bg-background text-foreground",
                    )}
                    onClick={() => setIsAnnotationModeEnabled((prev) => !prev)}
                    title={isAnnotationModeEnabled ? "Turn annotation mode off" : "Turn annotation mode on"}
                  >
                    <Highlighter className={topShouldCompress ? "h-4 w-4" : "mr-2 h-4 w-4"} />
                    {!topShouldCompress && "Annotate"}
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" title="More">
                      <MoreHorizontal className={topShouldCompress ? "h-4 w-4" : "mr-2 h-4 w-4"} />
                      {!topShouldCompress && "More"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>More</DropdownMenuLabel>
                    <DropdownMenuItem onClick={openNoteWindow}>
                      <StickyNote className="mr-2 h-4 w-4" />
                      Add Note
                    </DropdownMenuItem>
                    {questionInfo && (
                      <DropdownMenuItem onClick={() => setIsQuestionInfoOpen(true)}>
                        <Info className="mr-2 h-4 w-4" />
                        Question Info
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setIsReportOpen(true)}>
                      <Flag className="mr-2 h-4 w-4" />
                      Report Question
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>View Mode</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={questionViewMode}
                      onValueChange={(value) =>
                        handleQuestionViewModeChange(value as QuestionViewMode)
                      }
                    >
                      <DropdownMenuRadioItem value="vertical">
                        <Rows3 className="mr-2 h-4 w-4" />
                        Vertical
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="horizontal">
                        <Columns3 className="mr-2 h-4 w-4" />
                        Horizontal
                      </DropdownMenuRadioItem>
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
              style={{ visibility: 'hidden', pointerEvents: 'none' }}
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
              style={{ visibility: 'hidden', pointerEvents: 'none' }}
            >
              <div className="h-8 w-14 rounded-full border" />
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
              <div className="inline-flex items-center gap-2">
                <div className="h-9 w-9 rounded-md border" />
                <div className="w-[5ch]" />
                <div className="h-9 w-9 rounded-md border" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main
        className={`flex-1 pb-28 ${questionViewMode === 'horizontal' ? 'px-8 py-6' : 'px-4 py-8'}`}
        style={isSplitScreenActive ? { maxWidth: "var(--sat-split-pct, 70%)", marginLeft: 0 } : questionViewMode === 'horizontal' ? { width: "100%" } : { maxWidth: "1280px", margin: "0 auto", width: "100%" }}
      >
        <div 
          className={`relative ${questionViewMode === 'horizontal' ? 'p-6' : 'p-4 sm:p-6 md:p-8'}`}
          style={{ maxWidth: isSplitScreenActive || questionViewMode === 'horizontal' ? "100%" : "56rem", margin: isSplitScreenActive || questionViewMode === 'horizontal' ? "0" : "0 auto" }}
        >
          {questionViewMode === 'horizontal' ? (
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
                className="w-4 cursor-col-resize flex items-center justify-center group flex-shrink-0 self-stretch"
                onMouseDown={() => setIsResizingQuestionSplit(true)}
              >
                <div className="w-1 h-full bg-border group-hover:bg-primary/50 transition-colors rounded" />
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
                      className="h-7 rounded px-3 gap-2 font-normal text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-black/50"
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
                        onClick={() => setStrikeoutMode(!strikeoutMode)}
                        className={cn("h-7 w-7 rounded hover:bg-white/50 dark:hover:bg-black/50 text-muted-foreground hover:text-foreground", strikeoutMode && "bg-primary/20 text-primary")}
                        title="Toggle Strikethrough Mode"
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

                {currentQuestion.type === 'multiple-choice' && currentQuestion.choices ? (
                  <MultipleChoiceQuestion
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
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground">Your Answer:</label>
                    <Input
                      type="text"
                      value={freeResponseAnswer}
                      onChange={(e) => handleFreeResponseChange(e.target.value)}
                      placeholder="Enter your answer"
                      className="max-w-md"
                    />
                  </div>
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
                      className="h-9 rounded px-4 gap-2 font-normal text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-black/50"
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
                        onClick={() => setStrikeoutMode(!strikeoutMode)}
                        className={cn("h-8 w-8 rounded hover:bg-white/50 dark:hover:bg-black/50 text-muted-foreground hover:text-foreground", strikeoutMode && "bg-primary/20 text-primary")}
                        title="Toggle Strikethrough Mode"
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

              {currentQuestion.type === 'multiple-choice' && currentQuestion.choices ? (
                <MultipleChoiceQuestion
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
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">Your Answer:</label>
                  <Input
                    type="text"
                    value={freeResponseAnswer}
                    onChange={(e) => handleFreeResponseChange(e.target.value)}
                    placeholder="Enter your answer"
                    className="max-w-md"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <div
        ref={bottomNavRef}
        className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-border shadow-lg z-40"
        style={isSplitScreenActive ? { width: "var(--sat-split-pct, 70%)" } : undefined}
      >
        <div className="container mx-auto px-4 py-3">
          <div ref={bottomNavGridRef} className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
            <div ref={bottomNavLeftRef} className="shrink-0" style={{ minWidth: shouldCompress ? undefined : '100px' }}>
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={!canGoPrevious}
                className="h-10"
              >
                <ChevronLeft className={shouldCompress ? "h-4 w-4" : "mr-1 h-4 w-4"} />
                {!shouldCompress && <span>Previous</span>}
              </Button>
            </div>

            <div
              ref={bottomNavCenterRef}
              data-nav-sheet
              className={cn(
                "min-w-0 flex items-center justify-center gap-1 overflow-hidden px-1",
                shouldPinBottomNavCenter
                  ? "absolute left-1/2 -translate-x-1/2"
                  : "justify-self-end"
              )}
            >
              {!isEmbed && !isAssessmentMode && <PreviousAttemptsDialog attempts={currentProgress.attempts} />}
              {!isEmbed && (is100Hard ? (
                  <BankNavigationSheet
                    currentQuestion={questionNumber}
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
                      <ModulePracticeNavigationSheet
                        buttonLabel={
                          isPracticeTestMode
                            ? practiceTestReviewPhase
                              ? `Review ${practiceTestQuestionNumberInModule} of ${practiceTestModuleQuestionCount}`
                              : `Question ${practiceTestQuestionNumberInModule} of ${practiceTestModuleQuestionCount}`
                            : `Question ${currentPracticeIndex + 1} of ${practiceSet.length}`
                        }
                        title={isPracticeTestMode ? practiceTestNavigatorTitle : modulePracticeModule?.publicTitle || "Module Navigator"}
                        subtitle={isPracticeTestMode ? practiceTestNavigatorSubtitle : (
                          modulePracticeAllowsChecking
                            ? `${practiceSet.length} questions in this module`
                            : `${practiceSet.length} questions in this module`
                        )}
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
                        onJump={(idx) => navigateToPracticeIndex(idx)}
                        exitTo={practiceExitTo || `/bank?bankType=${bankSource}`}
                        isSplitScreenActive={isSplitScreenActive}
                        splitPosition={splitPosition}
                     />
                 )
              ) : (
                 <BankNavigationSheet
                    currentQuestion={questionNumber}
                    totalQuestions={totalQuestions}
                    onJump={(qNum) => {
                       const base = '/bank';
                       navigate(`${base}/${subject}/${qNum}${isBank ? bankQuerySuffix : ""}`);
                    }}
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
              className="ml-auto flex gap-2 shrink-0 justify-end"
              style={{ minWidth: shouldCompress ? undefined : '280px' }}
            >
              {!isAssessmentMode && (
                <ExplanationWindow
                  onSplitScreenChange={handleSplitScreenChange}
                  onSplitPositionChange={handleSplitPositionChange}
                  splitPosition={splitPosition}
                  compressed={shouldCompress}
                  onFocus={() => bringToFront('explanation')}
                  zIndex={getZIndex('explanation')}
                  constrainToLeft={isSplitScreenActive ? splitPosition : undefined}
                  isSidebarred={sidebarredWindows.has('explanation')}
                  onSidebarToggle={handleSidebarToggle}
                  correctAnswer={currentQuestion?.correctAnswer}
                  rationale={currentQuestion?.rationale}
                  questionType={currentQuestion?.type}
                  choices={currentQuestion?.choices}
                  questionId={currentQuestion?.uuid || currentQuestion?.id}
                  questionSection={currentQuestion?.section}
                  questionText={currentQuestion?.prompt}
                  questionDomain={currentQuestion?.domain}
                  questionSkill={currentQuestion?.skill}
                  questionDifficulty={currentQuestion?.difficulty}
                  questionImages={questionImages}
                />
              )}
              {(!isAssessmentMode || assessmentAllowsChecking) && (
                <Button 
                  onClick={() => handleCheck()}
                  disabled={isCheckDisabled}
                  variant="outline"
                  className={cn("h-10 border-2 transition-colors duration-700", getCheckButtonClasses())}
                >
                  <Check className={shouldCompress ? "h-4 w-4" : "mr-1 h-4 w-4"} />
                  {!shouldCompress && <span>Check</span>}
                </Button>
              )}
              <Button
                onClick={handlePrimaryAdvance}
                disabled={isAssessmentMode ? false : !canGoNext}
                variant="outline"
                className="h-10 transition-colors duration-200 ease-out"
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
              ref={bottomMeasurementRef}
              aria-hidden="true"
              className="absolute -left-[9999px] flex gap-2 whitespace-nowrap"
              style={{ visibility: 'hidden', pointerEvents: 'none' }}
            >
              {!isAssessmentMode && (
                <Button variant="secondary" size="default">
                  <span className="mr-2 h-4 w-4">▶</span>
                  Explanation
                </Button>
              )}
              {(!isAssessmentMode || assessmentAllowsChecking) && (
                <Button size="default">
                  <Check className="mr-1 h-4 w-4" />
                  <span>Check</span>
                </Button>
              )}
              <Button size="default">
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
