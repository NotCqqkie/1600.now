import { startTransition, useDeferredValue, useState, useMemo, useCallback, useEffect, useRef, type Dispatch, type SetStateAction, type SyntheticEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { BankQuestion } from "@/data/questionBank";
import { mathDomainSkills, englishDomainSkills, allMathDomains, allEnglishDomains } from "@/data/questionCategories";
import { normalizeBankSource, type BankSubject, type BankSourceFilter } from "@/data/bankTypes";
import {
  getDefaultQuestionCountTree,
  getEmptyProgress,
  loadFilteredQuestionMetaCount,
  loadQuestionCountTree,
  type BankQuestionMeta,
} from "@/data/bankQuestionMetadata";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SegmentedToggle, type SegmentedToggleOption } from "@/components/ui/segmented-toggle";
import {
  Calculator,
  FileText,
  ChevronRight,
  ChevronDown,
  Play,
  Shuffle,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { QuestionBankFilterPanel } from "@/components/question/QuestionBankFilterPanel";
import {
  createDefaultQuestionBankFilters,
  hasActiveQuestionBankFilters,
  MAX_TIME_SPENT_FILTER_SECONDS,
  normalizeQuestionBankFilters,
  type QuestionBankFilters,
} from "@/lib/questionBankFilters";
import type {
  BankSearchProgressEntry,
  BankSearchResult,
  BankSearchWorkerResponse,
} from "@/lib/bankSearchTypes";
import { BankSourceToggle } from "@/components/question/BankSourceToggle";
import { spaceOutNearDuplicates, questionFingerprint } from "@/lib/text/nearDuplicateSpacing";
import {
  createBankPracticeSessionFromQuestions,
  launchCustomPracticeSet,
} from "@/lib/practice/customPracticeSets";
import { renderMixedContent } from "@/lib/text/mathRendering";
import {
  useUserProgress,
  isQuestionSolved,
  isQuestionAnsweredIncorrectly,
  QuestionProgress,
} from "@/hooks/useUserProgress";
import { PageSeo, buildBreadcrumbJsonLd } from "@/components/seo/PageSeo";
import { clearBankQuestionViewModeStorage } from "@/lib/questionViewModeStorage";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const loadBankPool = async (
  subject: BankSubject,
  bankSource: BankSourceFilter,
): Promise<BankQuestion[]> => {
  const { loadBankPool: loadPool } = await import("@/data/questionBank");
  return loadPool(subject, bankSource);
};
interface TopicSelectionState {
  math: {
    selected: boolean;
    domains: Record<string, { selected: boolean; skills: Record<string, boolean> }>;
  };
  reading: {
    selected: boolean;
    domains: Record<string, { selected: boolean; skills: Record<string, boolean> }>;
  };
}

const createEmptySelection = (): TopicSelectionState => {
  const mathDomains: Record<string, { selected: boolean; skills: Record<string, boolean> }> = {};
  for (const domain of allMathDomains) {
    mathDomains[domain] = {
      selected: false,
      skills: Object.fromEntries(mathDomainSkills[domain].map(s => [s, false])),
    };
  }

  const readingDomains: Record<string, { selected: boolean; skills: Record<string, boolean> }> = {};
  for (const domain of allEnglishDomains) {
    readingDomains[domain] = {
      selected: false,
      skills: Object.fromEntries(englishDomainSkills[domain].map(s => [s, false])),
    };
  }

  return {
    math: { selected: false, domains: mathDomains },
    reading: { selected: false, domains: readingDomains },
  };
};

const multiSelectModeCheckboxClass =
  "h-9 w-9 rounded-[8px] border-2 border-primary/45 bg-primary/5 text-primary shadow-sm transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:hover:border-cobalt data-[state=checked]:hover:bg-cobalt data-[state=checked]:hover:text-white hover:border-primary/70 hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-primary/55 dark:bg-primary/10 dark:data-[state=checked]:border-primary dark:data-[state=checked]:bg-primary sm:h-5 sm:w-5 sm:rounded-[5px]";

const topicCheckboxClass =
  `absolute left-0 top-0 ${multiSelectModeCheckboxClass}`;

const BANK_FILTERS_STORAGE_KEY = "question-bank-filters";
const BANK_SEARCH_RESULT_LIMIT = 50;
const BANK_SEARCH_MINOR_SUBJECT_MAX = 2;
const KEYWORD_PRACTICE_MIN_QUESTIONS = 5;
const KEYWORD_SEARCH_BUSY_DELAY_MS = 200;
const KEYWORD_SEARCH_BUSY_MIN_VISIBLE_MS = 200;
const HOME_DEMO_SKILLS_PER_DOMAIN = 2;
const HOME_FILTER_DEMO_ALLOW_SELECTOR = [
  '[data-tour="bank-filters"]',
  '[data-radix-popper-content-wrapper]',
  '[role="listbox"]',
  '[role="option"]',
  '[data-filter-demo-option]',
  '[cmdk-list]',
  '[cmdk-item]',
].join(",");

const keywordSubjectOptions: readonly SegmentedToggleOption<BankSubject>[] = [
  { value: "math", label: "Math", title: "Show Math questions" },
  { value: "reading", label: "Reading", title: "Show Reading questions" },
];

const shuffleQuestions = <T,>(questions: readonly T[]): T[] => {
  const shuffled = [...questions];
  for (let currentIndex = shuffled.length - 1; currentIndex > 0; currentIndex--) {
    const randomIndex = Math.floor(Math.random() * (currentIndex + 1));
    [shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
  }
  return shuffled;
};

const MATH_TOPIC_DISPLAY_LABELS: Record<string, string> = {
  "Linear equations in one variable": "Linear equations: one variable",
  "Linear equations in two variables": "Linear equations: two variables",
  "Systems of two linear equations in two variables": "Systems of linear equations",
  "Linear inequalities in one or two variables": "Linear inequalities: 1-2 variables",
  "Nonlinear equations in one variable and systems of equations in two variables": "Nonlinear equations & systems",
  "Ratios, rates, proportional relationships, and units": "Ratios, rates & units",
  "One-variable data: Distributions and measures of center and spread": "One-variable data: center & spread",
  "Two-variable data: Models and scatterplots": "Two-variable data: models & scatterplots",
  "Probability and conditional probability": "Probability & conditional probability",
  "Inference from sample statistics and margin of error": "Inference from samples & margin of error",
  "Evaluating statistical claims: Observational studies and experiments": "Evaluating statistical claims: studies",
  "Lines, angles, and triangles": "Lines, angles & triangles",
  "Right triangles and trigonometry": "Right triangles & trig",
};

const getTopicDisplayLabel = (subject: BankSubject, label: string) =>
  subject === "math" ? MATH_TOPIC_DISPLAY_LABELS[label] ?? label : label;

type KeywordSearchInfo = {
  results: BankSearchResult[];
  rawCount: number;
  mathCount: number;
  readingCount: number;
  preferredSubject: BankSubject | null;
  focusedSubject: BankSubject | null;
  filteredSubject: BankSubject | null;
  filteredSubjectCount: number;
};

const getKeywordSearchInfo = (results: BankSearchResult[]): KeywordSearchInfo => {
  const mathResults = results.filter((question) => question.subject === "math");
  const readingResults = results.filter((question) => question.subject === "reading");
  const dominantSubject: BankSubject = mathResults.length >= readingResults.length ? "math" : "reading";
  const focusedResults = dominantSubject === "math" ? mathResults : readingResults;
  const filteredSubject: BankSubject = dominantSubject === "math" ? "reading" : "math";
  const filteredSubjectCount = filteredSubject === "math" ? mathResults.length : readingResults.length;
  const shouldFocus =
    filteredSubjectCount > 0 &&
    filteredSubjectCount <= BANK_SEARCH_MINOR_SUBJECT_MAX &&
    focusedResults.length >= 4;
  const preferredSubject =
    results.length === 0
      ? null
      : shouldFocus
        ? dominantSubject
        : mathResults.length >= readingResults.length
          ? "math"
          : "reading";

  return {
    results: shouldFocus ? focusedResults : results,
    rawCount: results.length,
    mathCount: mathResults.length,
    readingCount: readingResults.length,
    preferredSubject,
    focusedSubject: shouldFocus ? dominantSubject : null,
    filteredSubject: shouldFocus ? filteredSubject : null,
    filteredSubjectCount: shouldFocus ? filteredSubjectCount : 0,
  };
};

const getKeywordSearchLoadingLabel = (query: string) => {
  const normalized = query.trim().replace(/\s+/g, " ");
  if (!normalized) return "Searching question text...";
  const displayQuery = normalized.length > 56 ? `${normalized.slice(0, 53)}...` : normalized;
  return `Searching for "${displayQuery}"...`;
};

const readStoredBankFilters = (): QuestionBankFilters | null => {
  try {
    const raw = sessionStorage.getItem(BANK_FILTERS_STORAGE_KEY);
    if (!raw) return null;
    return normalizeQuestionBankFilters(JSON.parse(raw));
  } catch {
    return null;
  }
};

const homeDemoHash = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const getHomeDemoProgress = (q: { stableId: string; subject: BankSubject }): QuestionProgress => {
  const key = q.stableId;
  const hash = homeDemoHash(key);
  const bucket = hash % 100;
  const solved = bucket < 42;
  const attempted = bucket < 84;
  const totalTimeSpentSeconds = 18 + (hash % 150);
  const result = solved ? "correct" : "incorrect";

  return {
    questionId: key,
    isMarkedForReview: bucket % 5 === 0 || bucket % 11 === 0,
    attempts: attempted
      ? [{
        timestamp: 1710000000000 - (hash % 10000000),
        durationSeconds: totalTimeSpentSeconds,
        result,
        answer: result === "correct" ? "C" : "B",
      }]
      : [],
    totalTimeSpentSeconds,
  };
};

const getTopicSkills = (subject: "math" | "reading", domain: string): string[] =>
  subject === "math"
    ? mathDomainSkills[domain as keyof typeof mathDomainSkills]
    : englishDomainSkills[domain as keyof typeof englishDomainSkills];

const TopicCheckboxSlot = ({
  visible,
  checked,
  onCheckedChange,
}: {
  visible: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) => (
  <div className="relative h-9 w-9 shrink-0 sm:h-5 sm:w-5">
    {visible && (
      <Checkbox
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(!!next)}
        onClick={(e) => e.stopPropagation()}
        className={topicCheckboxClass}
      />
    )}
  </div>
);

const AnimatedCount = ({ value, className }: { value: number; className?: string }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const displayValueRef = useRef(value);

  useEffect(() => {
    const from = displayValueRef.current;
    if (from === value) return;

    const start = performance.now();
    const duration = 420;
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(from + (value - from) * eased);
      displayValueRef.current = nextValue;
      setDisplayValue(nextValue);

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        displayValueRef.current = value;
        setDisplayValue(value);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className={className}>{displayValue.toLocaleString()}</span>;
};

type BankIndexProps = {
  homeFilterDemo?: boolean;
  homeFilterDemoFilters?: QuestionBankFilters;
  onHomeFilterDemoFiltersChange?: (filters: QuestionBankFilters) => void;
  onHomeFilterDemoReady?: () => void;
  homeFilterDemoCloseSignal?: number;
  onHomeFilterDemoControlOpenChange?: (control: string, open: boolean) => void;
};

export const BankIndex = ({
  homeFilterDemo = false,
  homeFilterDemoFilters,
  onHomeFilterDemoFiltersChange,
  onHomeFilterDemoReady,
  homeFilterDemoCloseSignal = 0,
  onHomeFilterDemoControlOpenChange,
}: BankIndexProps = {}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const bankSource = normalizeBankSource(searchParams.get("bankType"));
  const keywordSearchParam = searchParams.get("q") ?? "";
  const basePath = "/bank";

  const requestedEmbed = searchParams.get("embed") === "1";
  const inIframe = typeof window !== "undefined" && window.self !== window.top;
  const isEmbed = requestedEmbed && inIframe;
  const isIframeHomeFilterDemo = isEmbed && searchParams.get("homeFilterDemo") === "1";
  const isHomeFilterDemo = homeFilterDemo || isIframeHomeFilterDemo;
  const [homeDemoPortalContainer, setHomeDemoPortalContainer] = useState<HTMLDivElement | null>(null);
  const setHomeDemoRoot = useCallback((node: HTMLDivElement | null) => {
    setHomeDemoPortalContainer(node);
  }, []);
  const [keywordSearch, setKeywordSearch] = useState(keywordSearchParam);
  const deferredKeywordSearch = useDeferredValue(keywordSearch);
  const [rawKeywordSearchResults, setRawKeywordSearchResults] = useState<BankSearchResult[]>([]);
  const [rawKeywordSearchQuery, setRawKeywordSearchQuery] = useState("");
  const [isKeywordSearchLoading, setIsKeywordSearchLoading] = useState(false);
  const [showKeywordSearchBusy, setShowKeywordSearchBusy] = useState(false);
  const [isKeywordPracticeLoading, setIsKeywordPracticeLoading] = useState(false);
  const [isKeywordListCollapsed, setIsKeywordListCollapsed] = useState(false);
  const [keywordSubject, setKeywordSubject] = useState<BankSubject>("math");
  const [isKeywordSubjectPinned, setIsKeywordSubjectPinned] = useState(false);
  const isKeywordSearchPending = deferredKeywordSearch !== keywordSearch;
  const bankSearchWorkerRef = useRef<Worker | null>(null);
  const bankSearchRequestIdRef = useRef(0);
  const keywordSearchAreaRef = useRef<HTMLDivElement | null>(null);
  const keywordSearchBusyShownAtRef = useRef(0);

  const getBankSearchWorker = useCallback(() => {
    bankSearchWorkerRef.current ??= new Worker(
      new URL("../../lib/bankSearch.worker.ts", import.meta.url),
      { type: "module" },
    );
    return bankSearchWorkerRef.current;
  }, []);

  useEffect(() => () => {
    bankSearchWorkerRef.current?.terminate();
    bankSearchWorkerRef.current = null;
  }, []);

  useEffect(() => {
    setKeywordSearch(keywordSearchParam);
    setIsKeywordListCollapsed(false);
  }, [keywordSearchParam]);

  useEffect(() => {
    if (!isEmbed || typeof document === "undefined") return;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    let lastTouchX: number | null = null;
    let lastTouchY: number | null = null;
    const forwardScroll = (deltaX: number, deltaY: number) => {
      if (!deltaX && !deltaY) return;
      window.parent.postMessage(
        { type: "homeDemoScroll", deltaX, deltaY },
        window.location.origin,
      );
    };
    const forwardWheel = (event: WheelEvent) => {
      event.preventDefault();
      forwardScroll(event.deltaX, event.deltaY);
    };
    const forwardTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        lastTouchX = null;
        lastTouchY = null;
        return;
      }
      lastTouchX = event.touches[0].clientX;
      lastTouchY = event.touches[0].clientY;
    };
    const forwardTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1 || lastTouchX === null || lastTouchY === null) return;
      const touch = event.touches[0];
      const deltaX = lastTouchX - touch.clientX;
      const deltaY = lastTouchY - touch.clientY;
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
      if (Math.abs(deltaX) + Math.abs(deltaY) < 1) return;
      event.preventDefault();
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
  }, [isEmbed]);

  useEffect(() => {
    clearBankQuestionViewModeStorage();
  }, []);
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [internalFilters, setInternalFilters] = useState<QuestionBankFilters>(() => {
    if (isHomeFilterDemo) return homeFilterDemoFilters ?? createDefaultQuestionBankFilters();
    try {
      const raw = sessionStorage.getItem("bankFilterPreset");
      if (!raw) return readStoredBankFilters() ?? createDefaultQuestionBankFilters();
      const preset = JSON.parse(raw) as { difficulties?: string[] };
      if (preset.difficulties?.length) {
        return normalizeQuestionBankFilters({ difficulty: preset.difficulties });
      }
    } catch {
      return readStoredBankFilters() ?? createDefaultQuestionBankFilters();
    }
    return readStoredBankFilters() ?? createDefaultQuestionBankFilters();
  });
  const filters = homeFilterDemoFilters ?? internalFilters;
  const setFilters: Dispatch<SetStateAction<QuestionBankFilters>> = useCallback((value) => {
    setInternalFilters((current) => {
      const base = homeFilterDemoFilters ?? current;
      const next = typeof value === "function"
        ? (value as (current: QuestionBankFilters) => QuestionBankFilters)(base)
        : value;
      onHomeFilterDemoFiltersChange?.(next);
      return homeFilterDemoFilters ? current : next;
    });
  }, [homeFilterDemoFilters, onHomeFilterDemoFiltersChange]);

  useEffect(() => {
    if (homeFilterDemoFilters) setInternalFilters(homeFilterDemoFilters);
  }, [homeFilterDemoFilters]);

  useEffect(() => {
    if (isHomeFilterDemo) onHomeFilterDemoReady?.();
  }, [isHomeFilterDemo, onHomeFilterDemoReady]);

  useEffect(() => {
    if (isHomeFilterDemo) return;
    sessionStorage.setItem(BANK_FILTERS_STORAGE_KEY, JSON.stringify(filters));
  }, [filters, isHomeFilterDemo]);

  useEffect(() => {
    if (!isIframeHomeFilterDemo || typeof window === "undefined") return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== "homeFilterDemoSetFilters") return;
      setFilters((current) => normalizeQuestionBankFilters(data, current));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isIframeHomeFilterDemo, setFilters]);

  useEffect(() => {
    if (!isIframeHomeFilterDemo || typeof window === "undefined") return;
    window.parent.postMessage(
      { type: "homeFilterDemoState", filters },
      window.location.origin,
    );
  }, [filters, isIframeHomeFilterDemo]);

  const blockHomeDemoInteraction = useCallback((event: SyntheticEvent<HTMLElement>) => {
    if (!isHomeFilterDemo) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target || target.closest(HOME_FILTER_DEMO_ALLOW_SELECTOR)) return;
    event.preventDefault();
    event.stopPropagation();
  }, [isHomeFilterDemo]);
  const [topicSelection, setTopicSelection] = useState<TopicSelectionState>(() => {
    const base = createEmptySelection();
    try {
      const raw = sessionStorage.getItem("bankFilterPreset");
      if (!raw) return base;
      sessionStorage.removeItem("bankFilterPreset");
      const preset = JSON.parse(raw) as {
        skills?: { bankSkill: string; bankDomain: string; subject: string }[];
      };
      if (!preset.skills?.length) return base;
      for (const { bankSkill, bankDomain, subject } of preset.skills) {
        const subj = subject as "math" | "reading";
        if (!base[subj]?.domains[bankDomain]) continue;
        base[subj].domains[bankDomain].skills[bankSkill] = true;
        base[subj].domains[bankDomain].selected = true;
      }
    } catch {
      return base;
    }
    return base;
  });
  const createDefaultExpandedDomains = () => {
    const expanded: Record<string, boolean> = {};
    for (const domain of allMathDomains) {
      expanded[domain] = true;
    }
    for (const domain of allEnglishDomains) {
      expanded[domain] = true;
    }
    return expanded;
  };
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>(createDefaultExpandedDomains);
  const { progress: userProgress } = useUserProgress();
  const keywordSearchProgress = useMemo<Record<string, BankSearchProgressEntry>>(
    () => Object.fromEntries(
      Object.entries(userProgress).map(([stableId, progress]) => [
        stableId,
        {
          isMarkedForReview: progress.isMarkedForReview,
          attempts: progress.attempts.map((attempt) => ({ result: attempt.result })),
          totalTimeSpentSeconds: progress.totalTimeSpentSeconds,
        },
      ]),
    ),
    [userProgress],
  );
  const getQuestionProgress = useCallback((q: { stableId: string; subject: BankSubject }): QuestionProgress => {
    if (isHomeFilterDemo) return getHomeDemoProgress(q);
    const key = q.stableId;
    return userProgress[key] || {
      questionId: key,
      isMarkedForReview: false,
      attempts: [],
      totalTimeSpentSeconds: 0,
    };
  }, [isHomeFilterDemo, userProgress]);

  const getMetadataProgress = useMemo(
    () => (!isHomeFilterDemo && Object.keys(userProgress).length === 0
      ? getEmptyProgress
      : (question: BankQuestionMeta) => getQuestionProgress(question)),
    [getQuestionProgress, isHomeFilterDemo, userProgress],
  );

  const getCurrentSearchParams = useCallback(
    () => new URLSearchParams(typeof window === "undefined" ? searchParams : window.location.search),
    [searchParams],
  );

  const handleBankSourceChange = useCallback((nextSource: BankSourceFilter) => {
    const nextParams = getCurrentSearchParams();
    const trimmedSearch = keywordSearch.trim();
    nextParams.set("bankType", nextSource);
    if (trimmedSearch) {
      nextParams.set("q", keywordSearch);
    } else {
      nextParams.delete("q");
    }
    setSearchParams(nextParams);
  }, [getCurrentSearchParams, keywordSearch, setSearchParams]);

  const handleKeywordSearchChange = useCallback((nextSearch: string) => {
    setKeywordSearch(nextSearch);
    if (typeof window === "undefined") return;
    const nextParams = new URLSearchParams(window.location.search);
    const trimmed = nextSearch.trim();
    if (trimmed) {
      nextParams.set("q", nextSearch);
    } else {
      nextParams.delete("q");
    }
    const nextQuery = nextParams.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`,
    );
  }, []);

  const isQuestionActive = useCallback((q: BankQuestion): boolean => {
    return q.inPracticeTests === true;
  }, []);
  const questionPassesFilters = useCallback((q: BankQuestion): boolean => {
    const progress = getQuestionProgress(q);

    if (filters.difficulty.length > 0) {
      const normalizedDifficulty = (q.difficulty ?? "").trim().toLowerCase();
      if (!filters.difficulty.includes(normalizedDifficulty as typeof filters.difficulty[number])) return false;
    }
    if (filters.markedForReview !== "all") {
      if (filters.markedForReview === "yes" && !progress.isMarkedForReview) return false;
      if (filters.markedForReview === "no" && progress.isMarkedForReview) return false;
    }
    if (filters.solved !== "all") {
      const solved = isQuestionSolved(progress);
      if (filters.solved === "yes" && !solved) return false;
      if (filters.solved === "no" && solved) return false;
    }
    if (filters.answeredIncorrectly !== "all") {
      const incorrect = isQuestionAnsweredIncorrectly(progress);
      if (filters.answeredIncorrectly === "yes" && !incorrect) return false;
      if (filters.answeredIncorrectly === "no" && !isQuestionSolved(progress)) return false;
    }
    const [minTimeSpent, maxTimeSpent] = filters.timeSpentRange;
    if (progress.totalTimeSpentSeconds < minTimeSpent) return false;
    if (
      maxTimeSpent < MAX_TIME_SPENT_FILTER_SECONDS &&
      progress.totalTimeSpentSeconds > maxTimeSpent
    ) {
      return false;
    }

    if (filters.activeQuestions !== "all") {
      const isActive = isQuestionActive(q);
      if (filters.activeQuestions === "active" && !isActive) return false;
      if (filters.activeQuestions === "exclude-active" && isActive) return false;
    }

    return true;
  }, [filters, getQuestionProgress, isQuestionActive]);

  useEffect(() => {
    if (isHomeFilterDemo) return;

    let cancelled = false;
    const warm = () => {
      if (cancelled) return;
      getBankSearchWorker().postMessage({ type: "warm", bankSource });
    };
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (typeof idleWindow.requestIdleCallback === "function") {
      const handle = idleWindow.requestIdleCallback(warm, { timeout: 900 });
      return () => {
        cancelled = true;
        idleWindow.cancelIdleCallback?.(handle);
      };
    }

    const handle = window.setTimeout(warm, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [bankSource, getBankSearchWorker, isHomeFilterDemo]);

  useEffect(() => {
    const trimmedSearch = deferredKeywordSearch.trim();

    if (isHomeFilterDemo || trimmedSearch.length === 0) {
      startTransition(() => {
        setRawKeywordSearchResults([]);
        setRawKeywordSearchQuery("");
      });
      setIsKeywordSearchLoading(false);
      return;
    }

    let cancelled = false;
    const requestId = bankSearchRequestIdRef.current + 1;
    bankSearchRequestIdRef.current = requestId;
    const worker = getBankSearchWorker();
    setIsKeywordSearchLoading(true);

    const onMessage = (event: MessageEvent<BankSearchWorkerResponse>) => {
      if (cancelled || event.data.requestId !== requestId) return;
      startTransition(() => {
        setRawKeywordSearchResults(event.data.type === "result" ? event.data.results : []);
        setRawKeywordSearchQuery(event.data.type === "result" ? event.data.query : "");
      });
      setIsKeywordSearchLoading(false);
    };

    const onError = () => {
      if (cancelled) return;
      setIsKeywordSearchLoading(false);
      bankSearchWorkerRef.current?.terminate();
      bankSearchWorkerRef.current = null;
      toast({
        variant: "destructive",
        title: "Search unavailable",
        description: "Keyword search failed to run. Please try again.",
      });
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.addEventListener("messageerror", onError);
    worker.postMessage({
      type: "query",
      requestId,
      bankSource,
      query: deferredKeywordSearch,
      filters,
      progress: keywordSearchProgress,
    });

    return () => {
      cancelled = true;
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      worker.removeEventListener("messageerror", onError);
    };
  }, [
    bankSource,
    deferredKeywordSearch,
    filters,
    getBankSearchWorker,
    isHomeFilterDemo,
    keywordSearchProgress,
    toast,
  ]);
  const getFilteredQuestions = useCallback((questions: BankQuestion[]): BankQuestion[] => {
    return questions.filter(q => questionPassesFilters(q));
  }, [questionPassesFilters]);
  const [questionCounts, setQuestionCounts] = useState(() => getDefaultQuestionCountTree(bankSource));

  useEffect(() => {
    let cancelled = false;
    setQuestionCounts(getDefaultQuestionCountTree(bankSource));
    loadQuestionCountTree(bankSource, filters, getMetadataProgress).then((counts) => {
      if (!cancelled) setQuestionCounts(counts);
    });
    return () => {
      cancelled = true;
    };
  }, [bankSource, filters, getMetadataProgress]);
  const toggleSubject = useCallback((subject: "math" | "reading", checked: boolean) => {
    setTopicSelection(prev => {
      const domains = subject === "math" ? allMathDomains : allEnglishDomains;
      const newDomains: Record<string, { selected: boolean; skills: Record<string, boolean> }> = {};
      for (const domain of domains) {
        newDomains[domain] = {
          selected: checked,
          skills: Object.fromEntries(getTopicSkills(subject, domain).map((skillName) => [skillName, checked])),
        };
      }

      return {
        ...prev,
        [subject]: { selected: checked, domains: newDomains },
      };
    });
  }, []);

  const toggleDomain = useCallback((subject: "math" | "reading", domain: string, checked: boolean) => {
    setTopicSelection(prev => {
      const skills = getTopicSkills(subject, domain);

      const newDomains = {
        ...prev[subject].domains,
        [domain]: {
          selected: checked,
          skills: Object.fromEntries(skills.map(s => [s, checked])),
        },
      };
      const allDomains = subject === "math" ? allMathDomains : allEnglishDomains;
      const allSelected = allDomains.every(d =>
        d === domain ? checked : newDomains[d].selected
      );

      return {
        ...prev,
        [subject]: { selected: allSelected, domains: newDomains },
      };
    });
  }, []);

  const toggleSkill = useCallback((subject: "math" | "reading", domain: string, skill: string, checked: boolean) => {
    setTopicSelection(prev => {
      const skills = getTopicSkills(subject, domain);

      const newSkills = {
        ...prev[subject].domains[domain].skills,
        [skill]: checked,
      };
      const allSkillsSelected = skills.every(s => s === skill ? checked : newSkills[s]);

      const newDomains = {
        ...prev[subject].domains,
        [domain]: {
          selected: allSkillsSelected,
          skills: newSkills,
        },
      };
      const allDomains = subject === "math" ? allMathDomains : allEnglishDomains;
      const allDomainsSelected = allDomains.every(d => newDomains[d].selected);

      return {
        ...prev,
        [subject]: { selected: allDomainsSelected, domains: newDomains },
      };
    });
  }, []);
  const selectedTopicsInfo = useMemo(() => {
    let count = 0;
    const selectedSkills: { subject: "math" | "reading"; skill: string }[] = [];
    for (const domain of allMathDomains) {
      for (const skill of mathDomainSkills[domain]) {
        if (topicSelection.math.domains[domain]?.skills[skill]) {
          count++;
          selectedSkills.push({ subject: "math", skill });
        }
      }
    }
    for (const domain of allEnglishDomains) {
      for (const skill of englishDomainSkills[domain]) {
        if (topicSelection.reading.domains[domain]?.skills[skill]) {
          count++;
          selectedSkills.push({ subject: "reading", skill });
        }
      }
    }

    return { count, selectedSkills, totalSelected: count };
  }, [topicSelection]);

  const [selectedQuestionCount, setSelectedQuestionCount] = useState(0);

  useEffect(() => {
    if (selectedTopicsInfo.selectedSkills.length === 0) {
      setSelectedQuestionCount(0);
      return;
    }

    let cancelled = false;
    Promise.all(
      selectedTopicsInfo.selectedSkills.map(({ subject, skill }) =>
        loadFilteredQuestionMetaCount(subject, bankSource, filters, getMetadataProgress, { skill }),
      ),
    ).then((counts) => {
      if (!cancelled) setSelectedQuestionCount(counts.reduce((total, count) => total + count, 0));
    });

    return () => {
      cancelled = true;
    };
  }, [bankSource, filters, getMetadataProgress, selectedTopicsInfo.selectedSkills]);

  const getSelectedQuestions = useCallback(async (
    subjectOverride?: "math" | "reading",
    domainOverride?: string,
    skillOverride?: string
  ): Promise<BankQuestion[]> => {
    if (subjectOverride) {
      const questions = await loadBankPool(subjectOverride, bankSource);
      let filtered = getFilteredQuestions(questions);

      if (skillOverride) {
        filtered = filtered.filter(q => q.category.skill === skillOverride);
      } else if (domainOverride) {
        filtered = filtered.filter(q => q.category.domain === domainOverride);
      }
      return filtered;
    }

    const skillQuestionMap: Map<string, { subject: "math" | "reading"; questions: BankQuestion[] }> = new Map();
    const poolCache = new Map<BankSubject, BankQuestion[]>();

    const getSubjectPool = async (subject: BankSubject) => {
      const cached = poolCache.get(subject);
      if (cached) return cached;
      const pool = await loadBankPool(subject, bankSource);
      poolCache.set(subject, pool);
      return pool;
    };

    for (const { subject, skill } of selectedTopicsInfo.selectedSkills) {
      const pool = await getSubjectPool(subject);
      const filtered = getFilteredQuestions(pool).filter(q => q.category.skill === skill);
      const key = `${subject}-${skill}`;
      skillQuestionMap.set(key, { subject, questions: filtered });
    }

    const seed = selectedTopicsInfo.selectedSkills.length;
    const shuffled = Array.from(skillQuestionMap.entries()).sort((leftEntry, rightEntry) => {
      const hashA = leftEntry[0].split('').reduce((acc, char) => acc + char.charCodeAt(0), seed);
      const hashB = rightEntry[0].split('').reduce((acc, char) => acc + char.charCodeAt(0), seed);
      return hashA - hashB;
    });

    return shuffled.flatMap(([, { questions }]) => questions);
  }, [bankSource, getFilteredQuestions, selectedTopicsInfo.selectedSkills]);

  const startBankPracticeSession = useCallback((questions: BankQuestion[], exitTo = `/bank?bankType=${bankSource}`) => {
    if (isHomeFilterDemo || questions.length === 0) return;

    const spacedQuestions = spaceOutNearDuplicates<BankQuestion>(questions, questionFingerprint);

    const practiceSet = createBankPracticeSessionFromQuestions({
      questions: spacedQuestions,
    });
    launchCustomPracticeSet(practiceSet, navigate, exitTo);
  }, [bankSource, isHomeFilterDemo, navigate]);

  const handleCreatePracticeSet = useCallback(async (shouldShuffle: boolean = false) => {
    let questions = await getSelectedQuestions();

    if (shouldShuffle) {
      questions = shuffleQuestions(questions);
    }
    startBankPracticeSession(questions);
  }, [getSelectedQuestions, startBankPracticeSession]);

  const handleQuickStart = useCallback(async (subject: "math" | "reading", domain?: string, skill?: string, shouldShuffle: boolean = false) => {
    let questions = await getSelectedQuestions(subject, domain, skill);

    if (shouldShuffle) {
      questions = shuffleQuestions(questions);
    }
    questions = spaceOutNearDuplicates<BankQuestion>(questions, questionFingerprint);

    startBankPracticeSession(questions);
  }, [startBankPracticeSession, getSelectedQuestions]);

  const handleKeywordResultClick = useCallback((question: BankSearchResult) => {
    navigate(`${basePath}/${question.subject}/${question.id}?bankType=${bankSource}`);
  }, [bankSource, basePath, navigate]);

  const keywordSearchInfo = useMemo(
    () => getKeywordSearchInfo(rawKeywordSearchResults),
    [rawKeywordSearchResults],
  );
  const isKeywordResultCurrent =
    rawKeywordSearchQuery.trim() === deferredKeywordSearch.trim();
  const activeKeywordSubject =
    !isKeywordSubjectPinned &&
    isKeywordResultCurrent &&
    !isKeywordSearchLoading &&
    !isKeywordSearchPending &&
    keywordSearchInfo.preferredSubject
      ? keywordSearchInfo.preferredSubject
      : keywordSubject;

  useEffect(() => {
    if (!isKeywordSubjectPinned) return undefined;

    const shouldResetPinnedSubject = (target: EventTarget | null) => {
      const searchArea = keywordSearchAreaRef.current;
      return searchArea && target instanceof Node && !searchArea.contains(target);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (shouldResetPinnedSubject(event.target)) setIsKeywordSubjectPinned(false);
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (shouldResetPinnedSubject(event.target)) setIsKeywordSubjectPinned(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusin", handleFocusIn, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusin", handleFocusIn, true);
    };
  }, [isKeywordSubjectPinned]);

  const handleKeywordSubjectChange = useCallback((value: BankSubject) => {
    setIsKeywordSubjectPinned(true);
    setKeywordSubject(value);
  }, []);

  const keywordSearchResults = useMemo(
    () => rawKeywordSearchResults.filter((question) => question.subject === activeKeywordSubject),
    [activeKeywordSubject, rawKeywordSearchResults],
  );
  const keywordPracticeQuestions = useMemo(
    () => keywordSearchResults,
    [keywordSearchResults],
  );
  const canCreateKeywordPracticeSet =
    keywordPracticeQuestions.length >= KEYWORD_PRACTICE_MIN_QUESTIONS;

  const hydrateKeywordPracticeQuestions = useCallback(async (
    results: readonly BankSearchResult[],
  ): Promise<BankQuestion[]> => {
    const pool = await loadBankPool(activeKeywordSubject, bankSource);
    const byStableId = new Map(pool.map((question) => [question.stableId, question]));
    return results
      .map((result) => byStableId.get(result.stableId))
      .filter((question): question is BankQuestion => Boolean(question));
  }, [activeKeywordSubject, bankSource]);

  const handleCreateKeywordPracticeSet = useCallback(async (shuffle = false) => {
    const nextParams = new URLSearchParams();
    nextParams.set("bankType", bankSource);
    nextParams.set("q", keywordSearch.trim());
    const selectedResults = shuffle ? shuffleQuestions(keywordPracticeQuestions) : keywordPracticeQuestions;
    setIsKeywordPracticeLoading(true);
    try {
      const questions = await hydrateKeywordPracticeQuestions(selectedResults);
      startBankPracticeSession(
        questions,
        `/bank?${nextParams.toString()}`,
      );
    } finally {
      setIsKeywordPracticeLoading(false);
    }
  }, [
    bankSource,
    hydrateKeywordPracticeQuestions,
    keywordPracticeQuestions,
    keywordSearch,
    startBankPracticeSession,
  ]);


  const mathDomainsForDisplay = allMathDomains;
  const readingDomainsForDisplay = allEnglishDomains;
  const getSkillsForDisplay = (subject: "math" | "reading", domain: string) => {
    const skills = getTopicSkills(subject, domain);
    return isHomeFilterDemo ? skills.slice(0, HOME_DEMO_SKILLS_PER_DOMAIN) : skills;
  };

  const trimmedKeywordSearch = keywordSearch.trim();
  const isKeywordSearchActive = trimmedKeywordSearch.length > 0;
  const isKeywordSearchBusy = isKeywordSearchLoading || isKeywordSearchPending;
  const isKeywordActionBusy = isKeywordSearchBusy || isKeywordPracticeLoading;
  const shouldShowKeywordSubjectToggle =
    isKeywordSubjectPinned || (keywordSearchInfo.mathCount > 0 && keywordSearchInfo.readingCount > 0);
  const visibleKeywordSearchResults = keywordSearchResults.slice(0, BANK_SEARCH_RESULT_LIMIT);
  const keywordSearchLoadingLabel = getKeywordSearchLoadingLabel(trimmedKeywordSearch);
  const keywordResultCountLabel = showKeywordSearchBusy
    ? "Searching..."
    : `${keywordPracticeQuestions.length.toLocaleString()} question${keywordPracticeQuestions.length === 1 ? "" : "s"}`;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (isKeywordSearchBusy) {
      if (!showKeywordSearchBusy) {
        timer = setTimeout(() => {
          keywordSearchBusyShownAtRef.current = Date.now();
          setShowKeywordSearchBusy(true);
        }, KEYWORD_SEARCH_BUSY_DELAY_MS);
      }
    } else if (showKeywordSearchBusy) {
      const visibleForMs = Date.now() - keywordSearchBusyShownAtRef.current;
      timer = setTimeout(() => {
        keywordSearchBusyShownAtRef.current = 0;
        setShowKeywordSearchBusy(false);
      }, Math.max(0, KEYWORD_SEARCH_BUSY_MIN_VISIBLE_MS - visibleForMs));
    } else {
      keywordSearchBusyShownAtRef.current = 0;
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isKeywordSearchBusy, showKeywordSearchBusy]);

  const renderKeywordSearch = () => (
    <div
      ref={keywordSearchAreaRef}
      className="space-y-2"
    >
      <div className={cn(
        "grid gap-2",
        isKeywordSearchActive && "lg:grid-cols-[minmax(0,1fr)_31.5rem]",
      )}>
        <div className="group relative min-w-0 flex-1 rounded-[10px] transition-shadow duration-200 focus-within:shadow-[0_0_0_4px_rgb(var(--ds-accent)/0.26)]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted transition-colors duration-200 group-focus-within:text-cobalt-deep dark:group-focus-within:text-cobalt" />
          <Input
            value={keywordSearch}
            onChange={(event) => handleKeywordSearchChange(event.target.value)}
            placeholder="Search questions by keyword"
            aria-label="Search questions by keyword"
            className="h-10 pl-10 pr-10 focus-visible:border-ds-accent-deep/60 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {keywordSearch && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Clear keyword search"
              onClick={() => handleKeywordSearchChange("")}
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {isKeywordSearchActive && (
          <div className="flex flex-wrap gap-2 sm:grid sm:grid-cols-[8.75rem_9.25rem_9rem_2.5rem]">
            <span className="flex h-10 w-[8.75rem] shrink-0 items-center justify-center rounded-full border border-ds-line bg-white px-3 font-display text-[12px] font-semibold tabular-nums text-ink dark:bg-card">
              {keywordResultCountLabel}
            </span>
            <div className="w-[9.25rem]">
              <SegmentedToggle
                value={activeKeywordSubject}
                options={keywordSubjectOptions}
                onChange={handleKeywordSubjectChange}
                className={cn("h-10 w-full shrink-0", !shouldShowKeywordSubjectToggle && "invisible")}
                buttonClassName="h-[30px] px-3 py-0 text-[13px] leading-none"
                clippedActiveText
              />
            </div>
            <Button
              type="button"
              size="sm"
              disabled={isKeywordActionBusy || !canCreateKeywordPracticeSet}
              onClick={() => handleCreateKeywordPracticeSet(false)}
              className="h-10 w-36 shrink-0"
            >
              <Play className="h-4 w-4" />
              Practice {keywordPracticeQuestions.length.toLocaleString()}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={isKeywordActionBusy || !canCreateKeywordPracticeSet}
              onClick={() => handleCreateKeywordPracticeSet(true)}
              aria-label={`Shuffle practice ${keywordPracticeQuestions.length.toLocaleString()} questions`}
              title="Shuffle Practice"
              className="h-10 w-10 shrink-0"
            >
              <Shuffle className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      {isKeywordSearchActive && (
        <div className="overflow-hidden rounded-lg border border-ds-line bg-white dark:bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ds-line px-3 py-2">
            <div className="min-w-0">
              <h2 className="font-display text-[15px] font-semibold leading-tight text-ink">
                Search results
              </h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsKeywordListCollapsed((collapsed) => !collapsed)}
              className="h-8 shrink-0 gap-1 px-2"
            >
              {isKeywordListCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {isKeywordListCollapsed ? "Show list" : "Hide list"}
            </Button>
          </div>

          {isKeywordListCollapsed ? null : isKeywordSearchBusy && visibleKeywordSearchResults.length === 0 ? (
            <div className="p-10 text-center text-sm text-ink-muted">
              <span className={cn("inline-block max-w-full truncate", !showKeywordSearchBusy && "invisible")}>
                {keywordSearchLoadingLabel}
              </span>
            </div>
          ) : visibleKeywordSearchResults.length === 0 ? (
            <div className="p-10 text-center text-sm text-ink-muted">
              No questions found for that keyword with the current filters.
            </div>
          ) : (
            <div
              aria-busy={isKeywordSearchBusy ? "true" : undefined}
              className={`divide-y divide-ds-line${showKeywordSearchBusy ? " pointer-events-none opacity-60" : ""}`}
            >
              {visibleKeywordSearchResults.map((question) => {
                const isMathQuestionResult = question.subject === "math";
                const skillLabel = getTopicDisplayLabel(question.subject, question.category.skill);
                const previewHtml = renderMixedContent(question.previewText || "Question preview unavailable", {
                  convertTexLineBreaks: false,
                });
                return (
                  <button
                    key={question.stableId}
                    type="button"
                    onClick={() => handleKeywordResultClick(question)}
                    className="bank-result-row group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-l-2 border-l-ds-line px-3 py-2 text-left hover:border-l-ds-accent-deep hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-inset"
                  >
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${isMathQuestionResult ? "bg-primary/10" : "bg-secondary/10"}`}>
                      {isMathQuestionResult ? (
                        <Calculator className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-secondary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0 font-display text-[13px] font-semibold text-ink">
                          {isMathQuestionResult ? "Math" : "Reading"} #{question.id}
                        </span>
                        <span className="truncate text-xs font-medium text-ink-muted" title={skillLabel === question.category.skill ? undefined : question.category.skill}>
                          {skillLabel}
                        </span>
                        {question.difficulty && (
                          <span className="shrink-0 rounded-full border border-ds-line px-1.5 py-0.5 text-[11px] font-medium leading-none text-ink-muted">
                            {question.difficulty}
                          </span>
                        )}
                      </div>
                      <div
                        className="line-clamp-1 text-[13px] leading-5 text-ink-mid [&_.katex]:text-[0.95em]"
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                      />
                    </div>
                    <ChevronRight className="bank-result-arrow h-4 w-4 shrink-0 text-ink-muted" />
                  </button>
                );
              })}
              {keywordSearchResults.length > visibleKeywordSearchResults.length && (
                <div className="px-4 py-3 text-center text-xs font-medium text-ink-muted">
                  Showing first {visibleKeywordSearchResults.length.toLocaleString()} of {keywordSearchResults.length.toLocaleString()} matches.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
  const renderBrowseView = () => (
    <div
      className={`grid md:grid-cols-2 gap-6${isHomeFilterDemo ? " home-demo-question-list" : ""}`}
    >
      <div className={isHomeFilterDemo ? "min-w-0 p-2 md:order-2" : "min-w-0 p-3 sm:p-6 md:order-2"} data-home-demo-section={isHomeFilterDemo ? "true" : undefined}>
        <div className={isHomeFilterDemo ? "mb-3 flex items-start gap-1.5" : "flex items-center gap-3 mb-4"} data-home-demo-section-header={isHomeFilterDemo ? "true" : undefined}>
          <div
            className={`${isHomeFilterDemo ? "flex min-w-0 flex-1 items-start gap-1.5" : "flex items-center gap-3 flex-1"} ${isMultiSelect ? 'cursor-pointer' : ''}`}
            onClick={() => {
              if (isMultiSelect) {
                toggleSubject("math", !topicSelection.math.selected);
              }
            }}
          >
            <TopicCheckboxSlot
              visible={isMultiSelect}
              checked={topicSelection.math.selected}
              onCheckedChange={(checked) => toggleSubject("math", checked)}
            />
            <div className={isHomeFilterDemo ? "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ds-accent/30" : "p-2 rounded-lg bg-ds-accent/30"}>
              <Calculator className={isHomeFilterDemo ? "h-3.5 w-3.5 text-ink" : "h-6 w-6 text-ink"} />
            </div>
            <div className="min-w-0">
              <h2 className={isHomeFilterDemo ? "font-display text-[15px] font-semibold leading-[1.05] text-ink" : "font-display text-[22px] font-semibold leading-[1.1] tracking-[-0.015em] text-ink"}>Math</h2>
              <p
                className={isHomeFilterDemo ? "font-display text-[12px] leading-[1.15] tabular-nums" : "font-display text-[12px] leading-[1.3] tabular-nums"}
                data-home-demo-subject-count={isHomeFilterDemo ? "true" : undefined}
              >
                <AnimatedCount value={questionCounts.math.correct} className="font-semibold text-good" />
                <span className="mx-1 font-medium text-ink-muted">/</span>
                <AnimatedCount value={questionCounts.math.total} className="font-medium text-ink-muted" />
                <span className="font-medium text-ink-muted"> questions</span>
              </p>
            </div>
          </div>
          <div className={isHomeFilterDemo ? "hidden" : "flex gap-2"}>
            <Button
              size="sm"
              onClick={() => handleQuickStart("math")}
              className={isHomeFilterDemo ? "h-7 gap-1 px-2 text-[11px]" : "gap-1"}
            >
              <Play className={isHomeFilterDemo ? "h-3 w-3" : "h-4 w-4"} />
              Start All
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleQuickStart("math", undefined, undefined, true)}
              title="Shuffle Math Questions"
              className={isHomeFilterDemo ? "h-7 w-7 px-0" : undefined}
            >
              <Shuffle className={isHomeFilterDemo ? "h-3 w-3" : "h-4 w-4"} />
            </Button>
          </div>
        </div>

        <div className={isHomeFilterDemo ? "space-y-1.5" : "space-y-3"} data-home-demo-topic-list={isHomeFilterDemo ? "true" : undefined}>
          {mathDomainsForDisplay.map((domain) => {
            const domainLabel = getTopicDisplayLabel("math", domain);
            return (
              <div key={domain} className={isHomeFilterDemo ? "px-0 py-0" : "px-1 py-1"}>
                <div className={isHomeFilterDemo ? "group/domain-row flex items-start gap-1.5 rounded px-1.5 py-1.5 transition-colors hover:bg-muted" : "flex items-center gap-2 group/domain-row px-2 py-1.5 -mx-2 rounded hover:bg-muted transition-colors"} data-home-demo-domain-row={isHomeFilterDemo ? "true" : undefined}>
                  <TopicCheckboxSlot
                    visible={isMultiSelect}
                    checked={topicSelection.math.domains[domain]?.selected || false}
                    onCheckedChange={(checked) => toggleDomain("math", domain, checked)}
                  />
                  <div className={isHomeFilterDemo ? "flex min-w-0 flex-1 items-start justify-between gap-1" : "flex items-center justify-between flex-1"}>
                    <span
                      className={isHomeFilterDemo ? "min-w-0 flex-1 cursor-pointer break-words py-1 font-display text-[12px] font-semibold leading-[1.18] text-ink" : "font-display text-[17px] font-semibold leading-[1.3] tracking-[-0.01em] text-ink flex-1 py-1 cursor-pointer"}
                      title={domainLabel === domain ? undefined : domain}
                      onClick={() => {
                        if (isMultiSelect) {
                          toggleDomain("math", domain, !topicSelection.math.domains[domain]?.selected);
                        } else {
                          handleQuickStart("math", domain);
                        }
                      }}
                    >
                      {domainLabel}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={isHomeFilterDemo ? "hidden" : "h-6 w-6 mr-1 opacity-0 group-hover/domain-row:opacity-100 transition-opacity"}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickStart("math", domain, undefined, true);
                      }}
                      title="Shuffle Domain"
                    >
                      <Shuffle className="h-3 w-3" />
                    </Button>
                    <div
                      className={isHomeFilterDemo ? "flex shrink-0 cursor-pointer items-center gap-1 rounded px-0.5 py-1" : "flex items-center gap-2 cursor-pointer p-1 rounded"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedDomains(prev => ({ ...prev, [domain]: !prev[domain] }));
                      }}
                    >
                      <span className={isHomeFilterDemo ? "inline-block w-[9.5ch] shrink-0 whitespace-nowrap text-right font-display text-[11px] tabular-nums" : "font-display text-[14px] tabular-nums"}>
                        <AnimatedCount value={questionCounts.math.domains[domain]?.correct || 0} className="font-semibold text-good" />
                        <span className="font-medium text-ink-muted">/</span>
                        <AnimatedCount value={questionCounts.math.domains[domain]?.total || 0} className="font-medium text-ink-muted" />
                      </span>
                      <ChevronRight className={`bank-accordion-chevron h-[11px] w-[11px] text-ink-muted ${expandedDomains[domain] ? "bank-accordion-chevron-open" : ""}`} />
                    </div>
                  </div>
                </div>
                <div
                  aria-hidden={!expandedDomains[domain]}
                  className={`${isHomeFilterDemo ? "bank-accordion-panel ml-4" : "bank-accordion-panel ml-6"} ${expandedDomains[domain] ? "bank-accordion-panel-open" : ""}`}
                >
                  <div className={isHomeFilterDemo ? "bank-accordion-panel-inner space-y-1.5 pt-1.5" : "bank-accordion-panel-inner space-y-1 pt-2"}>
                    {getSkillsForDisplay("math", domain).map((skill) => {
                      const skillLabel = getTopicDisplayLabel("math", skill);
                      return (
                        <div
                          key={skill}
                          className={isHomeFilterDemo ? "group/skill flex min-h-[24px] cursor-pointer items-start gap-2 rounded px-1.5 py-[3px] hover:bg-muted" : "flex items-center gap-2 py-1.5 px-2 text-sm hover:bg-muted rounded group/skill cursor-pointer"}
                          onClick={() => {
                            if (isMultiSelect) {
                              toggleSkill("math", domain, skill, !topicSelection.math.domains[domain]?.skills[skill]);
                            } else {
                              handleQuickStart("math", domain, skill);
                            }
                          }}
                        >
                          <TopicCheckboxSlot
                            visible={isMultiSelect}
                            checked={topicSelection.math.domains[domain]?.skills[skill] || false}
                            onCheckedChange={(checked) => toggleSkill("math", domain, skill, checked)}
                          />
                          <span
                            className={isHomeFilterDemo ? "home-demo-skill-name min-w-0 flex-1 break-words pr-1 font-sans text-[11.25px] font-normal leading-[1.2] text-ink-mid" : "font-sans text-[13px] font-normal leading-[1.4] tracking-[-0.005em] text-ink-mid truncate flex-1 mr-2"}
                            title={skillLabel === skill ? undefined : skill}
                          >
                            {skillLabel}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={isHomeFilterDemo ? "hidden" : "h-6 w-6 shrink-0 opacity-0 group-hover/skill:opacity-100 transition-opacity"}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickStart("math", domain, skill, true);
                            }}
                            title="Shuffle Skill"
                          >
                            <Shuffle className="h-3 w-3" />
                          </Button>
                          <span className={isHomeFilterDemo ? "inline-block w-[8.5ch] shrink-0 whitespace-nowrap text-right font-display text-[10px] tabular-nums" : "font-display text-[13px] tabular-nums"}>
                            <AnimatedCount value={questionCounts.math.skills[skill]?.correct || 0} className="font-semibold text-good" />
                            <span className="font-medium text-ink-muted">/</span>
                            <AnimatedCount value={questionCounts.math.skills[skill]?.total || 0} className="font-medium text-ink-muted" />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={isHomeFilterDemo ? "min-w-0 p-2 md:order-1" : "min-w-0 p-3 sm:p-6 md:order-1"} data-home-demo-section={isHomeFilterDemo ? "true" : undefined}>
        <div className={isHomeFilterDemo ? "mb-3 flex items-start gap-1.5" : "flex items-center gap-3 mb-4"} data-home-demo-section-header={isHomeFilterDemo ? "true" : undefined}>
          <div
            className={`${isHomeFilterDemo ? "flex min-w-0 flex-1 items-start gap-1.5" : "flex items-center gap-3 flex-1"} ${isMultiSelect ? 'cursor-pointer' : ''}`}
            onClick={() => {
              if (isMultiSelect) {
                toggleSubject("reading", !topicSelection.reading.selected);
              }
            }}
          >
            <TopicCheckboxSlot
              visible={isMultiSelect}
              checked={topicSelection.reading.selected}
              onCheckedChange={(checked) => toggleSubject("reading", checked)}
            />
            <div className={isHomeFilterDemo ? "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ds-accent/30" : "p-2 rounded-lg bg-ds-accent/30"}>
              <FileText className={isHomeFilterDemo ? "h-3.5 w-3.5 text-ink" : "h-6 w-6 text-ink"} />
            </div>
            <div className="min-w-0">
              <h2 className={isHomeFilterDemo ? "font-display text-[15px] font-semibold leading-[1.05] text-ink" : "font-display text-[22px] font-semibold leading-[1.1] tracking-[-0.015em] text-ink"}>Reading & Writing</h2>
              <p
                className={isHomeFilterDemo ? "font-display text-[12px] leading-[1.15] tabular-nums" : "font-display text-[12px] leading-[1.3] tabular-nums"}
                data-home-demo-subject-count={isHomeFilterDemo ? "true" : undefined}
              >
                <AnimatedCount value={questionCounts.reading.correct} className="font-semibold text-good" />
                <span className="mx-1 font-medium text-ink-muted">/</span>
                <AnimatedCount value={questionCounts.reading.total} className="font-medium text-ink-muted" />
                <span className="font-medium text-ink-muted"> questions</span>
              </p>
            </div>
          </div>
          <div className={isHomeFilterDemo ? "hidden" : "flex gap-2"}>
            <Button
              size="sm"
              onClick={() => handleQuickStart("reading")}
              className={isHomeFilterDemo ? "h-7 gap-1 px-2 text-[11px]" : "gap-1"}
            >
              <Play className={isHomeFilterDemo ? "h-3 w-3" : "h-4 w-4"} />
              Start All
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleQuickStart("reading", undefined, undefined, true)}
              title="Shuffle Reading Questions"
              className={isHomeFilterDemo ? "h-7 w-7 px-0" : undefined}
            >
              <Shuffle className={isHomeFilterDemo ? "h-3 w-3" : "h-4 w-4"} />
            </Button>
          </div>
        </div>

        <div className={isHomeFilterDemo ? "space-y-1.5" : "space-y-3"} data-home-demo-topic-list={isHomeFilterDemo ? "true" : undefined}>
          {readingDomainsForDisplay.map((domain) => (
            <div key={domain} className={isHomeFilterDemo ? "px-0 py-0" : "px-1 py-1"}>
              <div className={isHomeFilterDemo ? "group/domain-row flex items-start gap-1.5 rounded px-1.5 py-1.5 transition-colors hover:bg-muted" : "flex items-center gap-2 group/domain-row px-2 py-1.5 -mx-2 rounded hover:bg-muted transition-colors"} data-home-demo-domain-row={isHomeFilterDemo ? "true" : undefined}>
                <TopicCheckboxSlot
                  visible={isMultiSelect}
                  checked={topicSelection.reading.domains[domain]?.selected || false}
                  onCheckedChange={(checked) => toggleDomain("reading", domain, checked)}
                />
                <div className={isHomeFilterDemo ? "flex min-w-0 flex-1 items-start justify-between gap-1" : "flex items-center justify-between flex-1"}>
                  <span
                    className={isHomeFilterDemo ? "min-w-0 flex-1 cursor-pointer break-words py-1 font-display text-[12px] font-semibold leading-[1.18] text-ink" : "font-display text-[17px] font-semibold leading-[1.3] tracking-[-0.01em] text-ink flex-1 py-1 cursor-pointer"}
                    onClick={() => {
                      if (isMultiSelect) {
                        toggleDomain("reading", domain, !topicSelection.reading.domains[domain]?.selected);
                      } else {
                        handleQuickStart("reading", domain);
                      }
                    }}
                  >
                    {domain}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={isHomeFilterDemo ? "hidden" : "h-6 w-6 mr-1 opacity-0 group-hover/domain-row:opacity-100 transition-opacity"}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickStart("reading", domain, undefined, true);
                    }}
                    title="Shuffle Domain"
                  >
                    <Shuffle className="h-3 w-3" />
                  </Button>
                  <div
                    className={isHomeFilterDemo ? "flex shrink-0 cursor-pointer items-center gap-1 rounded px-0.5 py-1" : "flex items-center gap-2 cursor-pointer p-1 rounded"}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedDomains(prev => ({ ...prev, [domain]: !prev[domain] }));
                    }}
                  >
                    <span className={isHomeFilterDemo ? "inline-block w-[9.5ch] shrink-0 whitespace-nowrap text-right font-display text-[11px] tabular-nums" : "font-display text-[14px] tabular-nums"}>
                      <AnimatedCount value={questionCounts.reading.domains[domain]?.correct || 0} className="font-semibold text-good" />
                      <span className="font-medium text-ink-muted">/</span>
                      <AnimatedCount value={questionCounts.reading.domains[domain]?.total || 0} className="font-medium text-ink-muted" />
                    </span>
                    <ChevronRight className={`bank-accordion-chevron h-[11px] w-[11px] text-ink-muted ${expandedDomains[domain] ? "bank-accordion-chevron-open" : ""}`} />
                  </div>
                </div>
              </div>
              <div
                aria-hidden={!expandedDomains[domain]}
                className={`${isHomeFilterDemo ? "bank-accordion-panel ml-4" : "bank-accordion-panel ml-6"} ${expandedDomains[domain] ? "bank-accordion-panel-open" : ""}`}
              >
                <div className={isHomeFilterDemo ? "bank-accordion-panel-inner space-y-1.5 pt-1.5" : "bank-accordion-panel-inner space-y-1 pt-2"}>
                  {getSkillsForDisplay("reading", domain).map((skill) => (
                    <div
                      key={skill}
                      className={isHomeFilterDemo ? "group/skill flex min-h-[24px] cursor-pointer items-start gap-2 rounded px-1.5 py-[3px] hover:bg-muted" : "flex items-center gap-2 py-1.5 px-2 text-sm hover:bg-muted rounded group/skill cursor-pointer"}
                      onClick={() => {
                        if (isMultiSelect) {
                          toggleSkill("reading", domain, skill, !topicSelection.reading.domains[domain]?.skills[skill]);
                        } else {
                          handleQuickStart("reading", domain, skill);
                        }
                      }}
                    >
                      <TopicCheckboxSlot
                        visible={isMultiSelect}
                        checked={topicSelection.reading.domains[domain]?.skills[skill] || false}
                        onCheckedChange={(checked) => toggleSkill("reading", domain, skill, checked)}
                      />
                      <span className={isHomeFilterDemo ? "home-demo-skill-name min-w-0 flex-1 break-words pr-1 font-sans text-[11.25px] font-normal leading-[1.2] text-ink-mid" : "font-sans text-[13px] font-normal leading-[1.4] tracking-[-0.005em] text-ink-mid truncate flex-1 mr-2"}>
                        {skill}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={isHomeFilterDemo ? "hidden" : "h-6 w-6 shrink-0 opacity-0 group-hover/skill:opacity-100 transition-opacity"}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickStart("reading", domain, skill, true);
                        }}
                        title="Shuffle Skill"
                      >
                       <Shuffle className="h-3 w-3" />
                      </Button>
                      <span className={isHomeFilterDemo ? "inline-block w-[8.5ch] shrink-0 whitespace-nowrap text-right font-display text-[10px] tabular-nums" : "font-display text-[13px] tabular-nums"}>
                        <AnimatedCount value={questionCounts.reading.skills[skill]?.correct || 0} className="font-semibold text-good" />
                        <span className="font-medium text-ink-muted">/</span>
                        <AnimatedCount value={questionCounts.reading.skills[skill]?.total || 0} className="font-medium text-ink-muted" />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const hasActiveFilters = hasActiveQuestionBankFilters(filters);

  return (
    <div
      ref={setHomeDemoRoot}
      className={isHomeFilterDemo ? "home-filter-demo-bank min-h-screen bg-transparent" : "min-h-screen bg-background"}
      style={isHomeFilterDemo ? { minHeight: "100%" } : undefined}
      onPointerDownCapture={blockHomeDemoInteraction}
      onClickCapture={blockHomeDemoInteraction}
    >
      {!isHomeFilterDemo && (
        <PageSeo
          id="bank-index"
          jsonLd={buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: "SAT Question Bank", url: "https://1600.now/bank" },
          ])}
        />
      )}
      {isHomeFilterDemo && (
        <style>
          {`
            .home-filter-demo-bank {
              -webkit-font-smoothing: antialiased;
              text-rendering: optimizeLegibility;
            }
            .home-filter-demo-bank,
            .home-filter-demo-bank * {
              letter-spacing: 0 !important;
            }
            .home-filter-demo-bank .home-demo-question-list [class*="tabular-nums"] {
              display: inline-block;
              min-width: 4.25ch;
              text-align: right;
              font-variant-numeric: tabular-nums;
              transition: color 220ms ease;
            }
            .home-filter-demo-bank [data-home-demo-subject-count="true"] {
              display: block;
              width: 17ch;
              min-width: 17ch;
              text-align: left;
              white-space: nowrap;
            }
            .home-filter-demo-bank [data-home-demo-section] button {
              border-radius: 8px;
            }
            .home-filter-demo-bank [data-home-demo-section] [data-slot="checkbox"] {
              width: 12px;
              height: 12px;
            }
            .home-filter-demo-bank .home-demo-skill-name {
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
              text-wrap: pretty;
            }
            .home-filter-demo-bank [data-home-demo-topic-list] {
              text-wrap: pretty;
            }
            .home-filter-demo-bank [data-home-demo-domain-row] svg {
              width: 9px;
              height: 9px;
            }
            .home-filter-demo-bank [data-radix-popper-content-wrapper] [data-state="closed"] {
              display: none !important;
            }
            .home-filter-demo-bank [data-radix-popper-content-wrapper] [data-state="open"] {
              animation: none !important;
            }
            .home-filter-demo-bank .bank-filter-panel-motion {
              height: auto !important;
              overflow: visible !important;
              pointer-events: auto;
              visibility: visible;
              transition: none !important;
            }
            .home-filter-demo-bank .bank-filter-panel-motion-inner {
              opacity: 1 !important;
              overflow: visible !important;
              transform: none !important;
              transition: none !important;
            }
            .home-filter-demo-bank [data-tour="bank-filters"] {
              margin-bottom: 0.25rem;
            }
            .home-filter-demo-bank [data-tour="bank-filters"] > div {
              row-gap: 0.35rem;
            }
            .home-filter-demo-bank [data-filter-demo-grid] {
              grid-template-columns: minmax(0,1fr) minmax(0,0.82fr) minmax(0,1fr) minmax(0,1fr) minmax(0,0.88fr) minmax(0,1fr) !important;
              gap: 0.48rem !important;
              align-items: end;
            }
            .home-filter-demo-bank .home-demo-question-list {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
            .home-filter-demo-bank [data-filter-demo-card] {
              gap: 0.32rem;
            }
            .home-filter-demo-bank [data-filter-demo-card] > div:first-child {
              gap: 0.22rem;
              min-height: 13px;
              font-size: 11px !important;
              line-height: 1.05;
            }
            .home-filter-demo-bank [data-filter-demo-card] svg {
              width: 11px;
              height: 11px;
            }
            .home-filter-demo-bank [data-tour="bank-filters"] [class*="rounded-lg"][class*="p-4"] {
              padding: 0.55rem !important;
            }
            .home-filter-demo-bank [data-tour="bank-filters"] button,
            .home-filter-demo-bank [data-tour="bank-filters"] [role="combobox"] {
              height: 30px;
              min-height: 30px;
              font-size: 13px;
              line-height: 1.1;
              padding-left: 0.52rem;
              padding-right: 0.52rem;
              white-space: nowrap;
            }
            .home-filter-demo-bank [data-tour="bank-filters"] .text-sm {
              font-size: 12px;
            }
            .home-filter-demo-bank [data-tour="bank-filters"] .text-xs {
              font-size: 10.5px;
            }
            .home-filter-demo-bank [data-tour="bank-filters"] [data-filter-demo-control="time"] {
              padding-left: 0.25rem;
              padding-right: 0.25rem;
            }
            .home-filter-demo-bank [data-tour="bank-filters"] [data-filter-demo-control="time"] + *,
            .home-filter-demo-bank [data-tour="bank-filters"] [data-filter-demo-control="time"] {
              min-height: auto;
            }
            .home-filter-demo-bank [data-filter-demo-card] [class*="space-y-3"] {
              gap: 0.3rem;
              padding-top: 0;
            }
            .home-filter-demo-bank [data-filter-demo-card] [class*="rounded-full"] {
              padding: 0.1rem 0.34rem;
              font-size: 10.5px;
              line-height: 1;
            }
            @media (max-width: 640px) {
              .home-filter-demo-bank [data-filter-demo-grid] {
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              }
              .home-filter-demo-bank .home-demo-question-list {
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              }
            }
          `}
        </style>
      )}
      <section className={isHomeFilterDemo ? "mx-auto px-0 pt-0 pb-0" : "container mx-auto px-4 pt-8 pb-12"}>
        <div className={isHomeFilterDemo ? "max-w-6xl mx-auto space-y-2" : "max-w-6xl mx-auto space-y-6"}>
          {!isHomeFilterDemo && (
            <div className="flex items-center gap-4">
              <div>
                <h1
                  style={{
                    fontFamily: "'Inter Tight', sans-serif",
                    fontSize: "clamp(32px, 3.8vw, 42px)",
                    fontWeight: 600,
                    letterSpacing: "-0.03em",
                    lineHeight: 1,
                    color: "rgb(var(--ink))",
                    marginBottom: 8,
                  }}
                >
                  Question Bank
                </h1>
                <p className="font-sans text-[14px] leading-[1.5] text-ink-mid">
                  <AnimatedCount
                    value={questionCounts.math.total + questionCounts.reading.total}
                    className="font-display font-semibold tabular-nums text-ink"
                  />
                  {" questions available"}
                </p>
              </div>
            </div>
          )}

          {!isHomeFilterDemo && renderKeywordSearch()}

          <div data-tour="bank-filters">
            <QuestionBankFilterPanel
              filters={filters}
              onFiltersChange={setFilters}
              showActivityFilter={true}
              defaultOpen={isEmbed}
              forceOpen={isHomeFilterDemo}
              compactLabels={isHomeFilterDemo}
              homeDemoMultiOpen={isHomeFilterDemo}
              homeDemoCloseSignal={homeFilterDemoCloseSignal}
              onHomeDemoControlOpenChange={onHomeFilterDemoControlOpenChange}
              portalContainer={isHomeFilterDemo ? homeDemoPortalContainer : undefined}
              rightContent={!isHomeFilterDemo ? (
                <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
                  <BankSourceToggle value={bankSource} onChange={handleBankSourceChange} />
                  <div className={`bank-filter-reset-actions w-full sm:w-auto ${hasActiveFilters ? "bank-filter-reset-actions-open" : ""}`}>
                    <div
                      className={`bank-filter-reset-slot ${hasActiveFilters ? "bank-filter-reset-slot-open" : ""}`}
                      aria-hidden={!hasActiveFilters}
                    >
                      <div className="bank-filter-reset-slot-inner">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFilters(createDefaultQuestionBankFilters())}
                          disabled={!hasActiveFilters}
                          tabIndex={hasActiveFilters ? undefined : -1}
                          className="h-10 gap-2 text-muted-foreground hover:text-foreground"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Reset Filters
                        </Button>
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-2 sm:flex-none sm:justify-start">
                      <Checkbox
                        id="multi-select-mode"
                        checked={isMultiSelect}
                        onCheckedChange={(checked) => setIsMultiSelect(!!checked)}
                        className={multiSelectModeCheckboxClass}
                      />
                      <Label htmlFor="multi-select-mode" className="cursor-pointer text-sm font-medium text-foreground">
                        <span className="sm:hidden">Multi-select</span>
                        <span className="hidden sm:inline">Select multiple topics</span>
                      </Label>
                    </div>
                  </div>
                </div>
              ) : undefined}
            />
          </div>

          {renderBrowseView()}
        </div>
      </section>

      {selectedTopicsInfo.totalSelected > 0 && (
        <div className="fixed bottom-6 left-4 right-4 z-50 flex justify-end gap-2 sm:left-auto sm:right-6">
          <Button
            size="icon"
            variant="outline"
            onClick={() => handleCreatePracticeSet(true)}
            className="ui-button-motion h-12 w-12 shrink-0 rounded-full shadow-lg transition-[background-color,border-color,color,box-shadow,transform] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
            title="Create Shuffled Practice Set"
          >
            <Shuffle className="h-5 w-5" />
          </Button>
          <Button
            size="lg"
            onClick={() => handleCreatePracticeSet(false)}
            className="ui-button-motion min-w-0 flex-1 gap-2 px-3 text-[13px] shadow-lg transition-[background-color,border-color,color,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_4px_14px_rgba(58,120,216,0.32)] active:translate-y-0 active:scale-[0.98] sm:flex-none sm:px-[22px] sm:text-[15px]"
          >
            <Play className="h-4 w-4 shrink-0" />
            <span className="truncate sm:hidden">Create Set ({selectedQuestionCount})</span>
            <span className="hidden sm:inline">Create Practice Set ({selectedQuestionCount} questions)</span>
          </Button>
        </div>
      )}
    </div>
  );
};

export default BankIndex;
