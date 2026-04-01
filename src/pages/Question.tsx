import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useState, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NavigationSheet } from "@/components/NavigationSheet";
import { BankNavigationSheet } from "@/components/BankNavigationSheet";
import { OfficialPracticeNavigationSheet } from "@/components/OfficialPracticeNavigationSheet"; 
import { PracticeNavigationSheet } from "@/components/PracticeNavigationSheet"; 
import { FormulaSheetDialog } from "@/components/FormulaSheetDialog";
import { DesmosDialog } from "@/components/DesmosDialog";
import { ExplanationWindow } from "@/components/ExplanationWindow";
import { MultipleChoiceQuestion } from "@/components/MultipleChoiceQuestion";
import { PreviousAttemptsDialog } from "@/components/PreviousAttemptsDialog";
import { TransparentAwareImage } from "@/components/TransparentAwareImage";
import { ChevronLeft, ChevronRight, Check, Bookmark, Eye, EyeOff, Pause, Play, Strikethrough, Maximize2, Minimize2, Rows3, Columns3 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { questions as originalQuestions } from "@/data/100 Hard";
import {
  getBankCounts as getBankCountsNormal,
  getBankPool as getBankPoolNormal,
  getBankQuestion as getBankQuestionNormal,
  normalizeBankSource,
  type BankSourceId,
} from "@/data/questionBank";
import { getBankQuestion as getBankQuestionOfficial, bankCounts as officialBankCounts } from "@/data/officialQuestionBank";
import { cn, normalizePublicAssetPath, renderMixedContent } from "@/lib/utils";
import { useUserProgress } from "@/hooks/useUserProgress";
import "katex/dist/katex.min.css";

// Use original 100 hard questions with uuid for progress tracking
const hardQuestions = originalQuestions.map(q => ({
  ...q,
  uuid: `hard-${q.id}` // Unique ID for progress tracking
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
  bankType?: BankSourceId;
  sourceId?: string;
  storageId?: string;
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
];

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
  if (!trimmed || looksLikePassageBlock(trimmed)) {
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

function Question() {
  const { id, subject: rawSubject } = useParams<{ id: string; subject?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Mode detection
  const isBank = location.pathname.startsWith('/bank');
  const isOfficialBank = location.pathname.startsWith('/official-bank');
  const is100Hard = !isBank && !isOfficialBank;

  // Practice Mode detection
  const isPracticeMode = searchParams.get('practice') === 'true';
  const bankSource = normalizeBankSource(searchParams.get("bankType"));
  const bankQuerySuffix = isBank ? `?bankType=${bankSource}` : "";
  const practiceSet = useMemo<PracticeSetItem[]>(() => {
    if (!isPracticeMode) return [];
    try {
      return JSON.parse(sessionStorage.getItem('practiceSet') || '[]') as PracticeSetItem[];
    } catch {
      return [];
    }
  }, [isPracticeMode]);

  // If needed: const practiceIdx = parseInt(searchParams.get('idx') || '0', 10);

  const questionNumber = parseInt(id || "1", 10);
  const subject = (rawSubject === "math" || rawSubject === "reading" ? rawSubject : "math") as "math" | "reading";
  const currentPracticeIndex = useMemo(() => {
    if (!isPracticeMode || practiceSet.length === 0) return -1;
    return practiceSet.findIndex(
      (q) =>
        q.id === questionNumber &&
        q.subject === subject &&
        (isOfficialBank || !q.bankType || q.bankType === bankSource),
    );
  }, [isPracticeMode, practiceSet, questionNumber, subject, isOfficialBank, bankSource]);
  const effectivePracticeMode = !is100Hard && isPracticeMode && practiceSet.length > 0 && currentPracticeIndex >= 0;

  // Data fetching logic
  const questionData = useMemo(() => {
    if (is100Hard) {
      return hardQuestions.find(q => q.id === questionNumber);
    }
    
    // Bank / Official Bank Logic
    const getter = isOfficialBank ? getBankQuestionOfficial : getBankQuestionNormal;
    const q = isOfficialBank ? getter(subject, questionNumber) : getter(subject, questionNumber, bankSource);
    
    if (!q) return null;
    return {
      ...q,
      uuid: isOfficialBank ? `official-${subject}-${q.id}` : q.stableId,
    };

  }, [is100Hard, isBank, isOfficialBank, questionNumber, subject, bankSource]);

  const { progress, addAttempt, toggleReview } = useUserProgress();
  
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [freeResponseAnswer, setFreeResponseAnswer] = useState<string>("");
  const [strikeoutMode, setStrikeoutMode] = useState(false);
  const [checkButtonState, setCheckButtonState] = useState<"idle" | "incorrect" | "correct-first" | "correct-later">("idle");
  const [checkedAnswers, setCheckedAnswers] = useState<Record<string, boolean>>({});
  const [splitScreenWindows, setSplitScreenWindows] = useState<Set<string>>(new Set());
  const [sidebarredWindows, setSidebarredWindows] = useState<Set<string>>(new Set()); // Track which windows SHOULD be sidebarred
  const [splitPosition, setSplitPosition] = useState(50);
  const [attemptCount, setAttemptCount] = useState(0);
  const [shouldCompress, setShouldCompress] = useState(false);
  const [topShouldCompress, setTopShouldCompress] = useState(false);
  const [shouldPinBottomNavCenter, setShouldPinBottomNavCenter] = useState(true);
  const [shouldPinTopTimerCenter, setShouldPinTopTimerCenter] = useState(true);
  const [windowOrder, setWindowOrder] = useState<string[]>(['referenceSheet', 'desmos', 'explanation']);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [questionViewMode, setQuestionViewMode] = useState<'vertical' | 'horizontal'>('vertical');
  const [questionSplitPosition, setQuestionSplitPosition] = useState(50);
  const [isResizingQuestionSplit, setIsResizingQuestionSplit] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [isTimerVisible, setIsTimerVisible] = useState(true);
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

  const currentQuestion = questionData;
  const currentProgress = currentQuestion ? (progress[currentQuestion.uuid] || { isMarkedForReview: false, attempts: [] }) : { isMarkedForReview: false, attempts: [] };
  const markedForReview = currentProgress.isMarkedForReview;
  const localStateKey = currentQuestion
    ? (is100Hard ? `question-${questionNumber}` : currentQuestion.uuid)
    : `question-${questionNumber}`;
  const bankNavigationItems = useMemo(() => {
    if (!isBank) return [];
    return getBankPoolNormal(subject, bankSource).map((question) => ({
      id: question.id,
      storageId: question.stableId,
    }));
  }, [isBank, subject, bankSource]);

  // View Mode Defaulting for different subjects
  useEffect(() => {
     if (isBank || isOfficialBank) {
        if (subject === 'reading') setQuestionViewMode('horizontal');
        else setQuestionViewMode('vertical');
     } else {
        setQuestionViewMode('vertical'); // Default for 100 Hard
     }
  }, [isBank, isOfficialBank, subject, questionNumber]); 

  // Reset timer on question change
  useEffect(() => {
    startTimeRef.current = Date.now();
    setElapsedSeconds(0);
    setIsTimerPaused(false);
  }, [questionNumber, subject, isBank, isOfficialBank]);

  useEffect(() => {
    if (isTimerPaused) return;

    const timerId = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isTimerPaused]);

  // Compute if any window is in split screen mode
  const isSplitScreenActive = splitScreenWindows.size > 0;

  // Use hidden measurement controls plus hysteresis to avoid compression state thrash.
  useLayoutEffect(() => {
    const checkSpace = () => {
      // Bottom navigation compression
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

      // Keep center controls centered only while they have the same gap as neighboring controls.
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

      // Keep timer centered when possible and restore centering once enough room returns.
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

      // Top bar compression
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
      if (topLeftRef.current) {
        resizeObserver.observe(topLeftRef.current);
      }
      if (topRightRef.current) {
        resizeObserver.observe(topRightRef.current);
      }
      if (topRightControlsRef.current) {
        resizeObserver.observe(topRightControlsRef.current);
      }
      if (topTimerRef.current) {
        resizeObserver.observe(topTimerRef.current);
      }
    }
    if (bottomNavRef.current) {
      resizeObserver.observe(bottomNavRef.current);
      const navSheet = bottomNavRef.current.querySelector('[data-nav-sheet]');
      if (navSheet instanceof HTMLElement) {
        resizeObserver.observe(navSheet);
      }
      if (bottomNavLeftRef.current) {
        resizeObserver.observe(bottomNavLeftRef.current);
      }
      if (bottomNavCenterRef.current) {
        resizeObserver.observe(bottomNavCenterRef.current);
      }
      if (bottomNavRightRef.current) {
        resizeObserver.observe(bottomNavRightRef.current);
      }
    }
    if (topMeasurementRef.current) {
      resizeObserver.observe(topMeasurementRef.current);
    }
    if (bottomMeasurementRef.current) {
      resizeObserver.observe(bottomMeasurementRef.current);
    }

    window.addEventListener('resize', scheduleCheck);
    scheduleCheck();

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      window.removeEventListener('resize', scheduleCheck);
      resizeObserver.disconnect();
    };
  }, []);

  // Handle question split divider resizing (for horizontal view mode)
  useEffect(() => {
    if (!isResizingQuestionSplit) return;

    document.body.classList.add("noselect");

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate position relative to the available content area
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

  // Track fullscreen changes to keep button state in sync
  useEffect(() => {
    setIsFullscreen(Boolean(document.fullscreenElement));
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle split screen changes from windows
  const handleSplitScreenChange = (isSplit: boolean, windowId: string) => {
    setSplitScreenWindows(prev => {
      const newSet = new Set(prev);
      if (isSplit) {
        newSet.add(windowId);
      } else {
        newSet.delete(windowId);
      }
      return newSet;
    });
  };

  // Handle sidebar toggle from windows - controls whether a window SHOULD be sidebarred
  const handleSidebarToggle = (windowId: string, shouldBeSidebarred: boolean) => {
    setSidebarredWindows(prev => {
      const newSet = new Set(prev);
      if (shouldBeSidebarred) {
        newSet.add(windowId);
      } else {
        newSet.delete(windowId);
      }
      return newSet;
    });
  };

  // Handle split position changes from the divider inside DraggableWindow
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

  // Bring a window to front
  const bringToFront = (windowId: string) => {
    setWindowOrder(prev => {
      const newOrder = prev.filter(id => id !== windowId);
      newOrder.push(windowId);
      return newOrder;
    });
  };

  // Get z-index for a window - windows stack based on interaction order
  const getZIndex = (windowId: string) => {
    const index = windowOrder.indexOf(windowId);
    // Use larger gaps between windows for clearer layering
    return 50 + index * 20;
  };


  // Reset split position when split screen is deactivated
  useEffect(() => {
    if (!isSplitScreenActive) {
      setSplitPosition(50);
    }
  }, [isSplitScreenActive]);

  if (!currentQuestion) {
    const fallbackDestination = isOfficialBank ? "/official-bank" : isBank ? `/bank?bankType=${bankSource}` : "/";
    return <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Question not found</h1>
        <Button onClick={() => navigate(fallbackDestination)}>Go Home</Button>
      </div>
    </div>;
  }

  // Reset selection and visual states immediately on question change to avoid flashes
  useLayoutEffect(() => {
    setSelectedAnswer("");
    setFreeResponseAnswer("");
    setCheckedAnswers({});
    setCheckButtonState("idle");
    setAttemptCount(0);
  }, [questionNumber]);

  // Helper to render content with consistent styling
  const renderContent = (content: string, center: boolean = false) => {
    if (!content) return null;
    const html = renderMixedContent(content);
    return (
      <div 
        className={cn("text-foreground break-words prose prose-stone dark:prose-invert max-w-none", center && "text-center")}
        style={{ fontFamily: "'Noto Serif', serif", fontSize: "1.1rem", lineHeight: "1.8" }}
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
    if (effectivePracticeMode) {
      return practiceSet.length;
    }
    if (subject) {
      const counts = isOfficialBank ? officialBankCounts : getBankCountsNormal(bankSource);
      return counts[subject] || 0;
    }
    return 0;
  }, [is100Hard, effectivePracticeMode, practiceSet, isOfficialBank, subject, bankSource]);

  const displayQuestionNumber = effectivePracticeMode ? currentPracticeIndex + 1 : questionNumber;
  const canGoPrevious = is100Hard
    ? questionNumber > 1
    : effectivePracticeMode
      ? currentPracticeIndex > 0
      : questionNumber > 1;
  const canGoNext = is100Hard
    ? questionNumber < totalQuestions
    : effectivePracticeMode
      ? currentPracticeIndex < totalQuestions - 1
      : questionNumber < totalQuestions;

  const navigateToPracticeIndex = (idx: number) => {
    if (!effectivePracticeMode || idx < 0 || idx >= practiceSet.length) return;
    const target = practiceSet[idx];
    const base = isOfficialBank ? '/official-bank' : '/bank';
    const sourceQuery = !isOfficialBank && target.bankType ? `bankType=${target.bankType}&` : "";
    navigate(`${base}/${target.subject}/${target.id}?${sourceQuery}practice=true&idx=${idx + 1}`);
  };

  const handlePrevious = () => {
    if (!canGoPrevious) return;
    if (is100Hard) {
      navigate(`/hard/${questionNumber - 1}`);
      return;
    }

    if (effectivePracticeMode) {
      navigateToPracticeIndex(currentPracticeIndex - 1);
      return;
    }

    const base = isOfficialBank ? '/official-bank' : '/bank';
    navigate(`${base}/${subject}/${questionNumber - 1}${isBank ? bankQuerySuffix : ""}`);
  };

  const handleNext = () => {
    if (!canGoNext) return;
    if (is100Hard) {
      navigate(`/hard/${questionNumber + 1}`);
      return;
    }

    if (effectivePracticeMode) {
      navigateToPracticeIndex(currentPracticeIndex + 1);
      return;
    }

    const base = isOfficialBank ? '/official-bank' : '/bank';
    navigate(`${base}/${subject}/${questionNumber + 1}${isBank ? bankQuerySuffix : ""}`);
  };

  const handleToggleReview = () => {
    if (!currentQuestion || is100Hard) return;
    const nextMarkedState = !markedForReview;
    toggleReview(currentQuestion.uuid);
    localStorage.setItem(`${currentQuestion.uuid}-flagged`, String(nextMarkedState));
  };

  const handleCheck = (overrideAnswer?: string) => {
    const userAnswer = overrideAnswer || (currentQuestion.type === 'multiple-choice' ? selectedAnswer : freeResponseAnswer);
    
    if (!userAnswer) {
      toast.error("Please provide an answer");
      return;
    }

    // If we've already recorded a correct answer for this question in the current session,
    // ignore further checks until the user navigates away (choices reset on navigation).
    const alreadyCorrect = Object.values(checkedAnswers).some(Boolean);
    if (alreadyCorrect) {
      return;
    }

    // Don't re-check an already checked answer
    if (checkedAnswers[userAnswer] !== undefined) {
      return;
    }

    // If using override answer, also select it
    if (overrideAnswer && overrideAnswer !== selectedAnswer) {
      setSelectedAnswer(overrideAnswer);
    }

    const normalizeAnswer = (answer: string) => {
      return answer.toString().trim().toLowerCase().replace(/\s+/g, '');
    };

    const isCorrect = normalizeAnswer(userAnswer) === normalizeAnswer(currentQuestion.correctAnswer);
    
    // Format the answer for display (e.g., "A. answer text")
    let formattedAnswer = userAnswer;
    if (currentQuestion.type === "multiple-choice" && currentQuestion.choices) {
      const choice = currentQuestion.choices.find(c => c.id === userAnswer);
      if (choice) {
        formattedAnswer = `${userAnswer}. ${choice.text || ""}`.trim();
      }
    }
    
    // Add attempt
    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
    addAttempt(currentQuestion.uuid, isCorrect ? "correct" : "incorrect", duration, formattedAnswer);

    const newCheckedAnswers = { ...checkedAnswers, [userAnswer]: isCorrect };
    setCheckedAnswers(newCheckedAnswers);
    const newAttemptCount = attemptCount + 1;
    setAttemptCount(newAttemptCount);

    // Save answer state to localStorage
    localStorage.setItem(`${localStateKey}-answer`, userAnswer);
    localStorage.setItem(`${localStateKey}-checkedAnswers`, JSON.stringify(newCheckedAnswers));

    if (isCorrect) {
      const status = newAttemptCount === 1 ? 'correct-first' : 'correct-later';
      setCheckButtonState(status);
      
      // Save status to localStorage
      localStorage.setItem(`${localStateKey}-status`, status);
    } else {
      setCheckButtonState("incorrect");
      
      // Save incorrect status
      localStorage.setItem(`${localStateKey}-status`, 'incorrect');
    }
  };

  // Universal Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Don't interfere if user is typing in an input, unless it's Enter to submit
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        if (e.key === 'Enter') {
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
          handleNext();
          break;
        case 'Enter':
          e.preventDefault();
          handleCheck();
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
              // If no selection, Down starts at first, Up starts at last
              nextIndex = e.key === 'ArrowDown' ? 0 : choiceIds.length - 1;
            } else {
              if (e.key === 'ArrowUp') {
                // Cycle backward
                nextIndex = (currentIndex - 1 + choiceIds.length) % choiceIds.length;
              } else {
                // Cycle forward
                nextIndex = (currentIndex + 1) % choiceIds.length;
              }
            }
            
            const nextId = choiceIds[nextIndex];
            setSelectedAnswer(nextId);
            localStorage.setItem(`${localStateKey}-answer`, nextId);
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
    questionNumber
  ]);

  const hasSelection = currentQuestion.type === 'multiple-choice' ? Boolean(selectedAnswer) : Boolean(freeResponseAnswer);
  const isCheckDisabled = !hasSelection || checkButtonState === "correct-first" || checkButtonState === "correct-later";

  const getCheckButtonClasses = () => {
    if (!hasSelection && checkButtonState === "idle") {
      return "bg-background text-foreground border-border";
    }

    switch (checkButtonState) {
      case "correct-first":
        return "bg-[#C8E6C9] hover:bg-[#A5D6A7] border-[#1B5E20] text-[#1B5E20] dark:bg-[#1B5E20] dark:hover:bg-[#144216] dark:border-[#2E7D32] dark:text-white disabled:opacity-100";
      case "correct-later":
        return "bg-[#FFE0B2] hover:bg-[#FFCC80] border-[#E65100] text-[#BF360C] dark:bg-[#E65100] dark:hover:bg-[#BF360C] dark:border-[#EF6C00] dark:text-white disabled:opacity-100";
      case "incorrect":
        return "bg-[#FFCDD2] hover:bg-[#EF9A9A] border-[#B71C1C] text-[#2C1A1A] dark:bg-[#5C1010] dark:hover:bg-[#4A0D0D] dark:border-[#8B0000] dark:text-white";
      default:
        return hasSelection ? "bg-primary/10 hover:bg-primary/20 border-primary/40 text-foreground" : "bg-background text-foreground border-border";
    }
  };

  const questionWithBankFields = currentQuestion as Partial<{
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

  const extractedFromStem = subject === "reading" ? extractLeadingQuestionSentence(rawStemContent) : { remainder: rawStemContent };
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
  const renderQuestionImages = () => {
    if (!questionImages?.length) return null;

    return (
      <div className="space-y-2">
        {questionImages.map((img, idx) => (
          <div key={`${img.src}-${idx}`} className="w-full flex justify-center">
            <TransparentAwareImage
              src={normalizePublicAssetPath(img.src)}
              alt={img.alt || `Question image ${idx + 1}`}
              className="max-w-full h-auto max-h-[340px] rounded-md object-contain border border-border"
              wrapperClassName="max-w-full"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    );
  };
  const backDestination = isOfficialBank ? "/official-bank" : isBank ? `/bank?bankType=${bankSource}` : "/";
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
        {isTimerVisible ? formatTimer(elapsedSeconds) : "-:--"}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => setIsTimerPaused((prev) => !prev)}
        title={isTimerPaused ? "Resume timer" : "Pause timer"}
      >
        {isTimerPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
      </Button>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div 
          className="container mx-auto px-4 py-4"
          style={isSplitScreenActive ? { maxWidth: `${splitPosition}%`, marginLeft: 0 } : undefined}
        >
          <div className="relative flex items-center justify-between gap-3" ref={topNavRef}>
            <div ref={topLeftRef} data-header-left className="flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(backDestination)}
              >
                <ChevronLeft className={topShouldCompress ? "h-4 w-4" : "mr-1 h-4 w-4"} />
                {!topShouldCompress && "Home"}
              </Button>
            </div>
            {shouldPinTopTimerCenter && (
              <div ref={topTimerRef} className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
                {timerControls}
              </div>
            )}
            <div ref={topRightRef} className="flex items-center gap-2">
              {!shouldPinTopTimerCenter && (
                <div ref={topTimerRef} className="flex items-center gap-2 mr-1">
                  {timerControls}
                </div>
              )}
              <div ref={topRightControlsRef} className="flex items-center gap-2">
                <ThemeToggle />
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" title="Question View">
                      {questionViewMode === 'vertical' ? (
                        <Rows3 className={topShouldCompress ? "h-4 w-4" : "mr-2 h-4 w-4"} />
                      ) : (
                        <Columns3 className={topShouldCompress ? "h-4 w-4" : "mr-2 h-4 w-4"} />
                      )}
                      {!topShouldCompress && "View"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setQuestionViewMode('vertical')} className={questionViewMode === 'vertical' ? 'bg-muted' : ''}>
                      <Rows3 className="mr-2 h-4 w-4" />
                      Vertical
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setQuestionViewMode('horizontal')} className={questionViewMode === 'horizontal' ? 'bg-muted' : ''}>
                      <Columns3 className="mr-2 h-4 w-4" />
                      Horizontal
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Hidden measurements keep compression thresholds stable regardless of current UI mode */}
            <div
              ref={topLeftMeasurementRef}
              aria-hidden="true"
              className="absolute -left-[9999px] whitespace-nowrap"
              style={{ visibility: 'hidden', pointerEvents: 'none' }}
            >
              <Button variant="ghost" size="sm">
                <ChevronLeft className="mr-1 h-4 w-4" />
                Home
              </Button>
            </div>
            <div 
              ref={topMeasurementRef}
              aria-hidden="true"
              className="absolute -left-[9999px] flex items-center gap-2 whitespace-nowrap"
              style={{ visibility: 'hidden', pointerEvents: 'none' }}
            >
              <div className="h-8 w-14 rounded-full border" />
              <Button variant="outline" size="sm">
                <span className="mr-2 inline-block h-4 w-4" />
                Reference Sheet
              </Button>
              <Button variant="outline" size="sm">
                <span className="mr-2 inline-block h-4 w-4" />
                Desmos
              </Button>
              <Button variant="outline" size="sm">
                <span className="mr-2 inline-block h-4 w-4" />
                View
              </Button>
              <Button variant="outline" size="sm">
                <span className="inline-block h-4 w-4" />
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

      {/* Main Content */}
      <main 
        className={`flex-1 pb-28 ${questionViewMode === 'horizontal' ? 'px-8 py-6' : 'px-4 py-8'}`}
        style={isSplitScreenActive ? { maxWidth: `${splitPosition}%`, marginLeft: 0 } : questionViewMode === 'horizontal' ? { width: "100%" } : { maxWidth: "1280px", margin: "0 auto", width: "100%" }}
      >
        <div 
          className={`relative ${questionViewMode === 'horizontal' ? 'p-6' : 'p-4 sm:p-6 md:p-8'}`}
          style={{ maxWidth: isSplitScreenActive || questionViewMode === 'horizontal' ? "100%" : "56rem", margin: isSplitScreenActive || questionViewMode === 'horizontal' ? "0" : "0 auto" }}
        >
          {/* Horizontal Layout Mode */}
          {questionViewMode === 'horizontal' ? (
            <div className="flex relative" style={{ minHeight: '400px' }}>
              {/* Left Panel - Question Content */}
              <div 
                className="pr-4 overflow-y-auto space-y-4"
                style={{ width: `${questionSplitPosition}%` }}
              >
                  {renderContent(stemContent)}
                  {renderQuestionImages()}
              </div>

              {/* Horizontal Divider */}
              <div 
                className="w-4 cursor-col-resize flex items-center justify-center group flex-shrink-0 self-stretch"
                onMouseDown={() => setIsResizingQuestionSplit(true)}
              >
                <div className="w-1 h-full bg-border group-hover:bg-primary/50 transition-colors rounded" />
              </div>

              {/* Right Panel - Answer Area */}
              <div 
                className="pl-4 overflow-y-auto"
                style={{ width: `${100 - questionSplitPosition}%` }}
              >
                {/* Question Toolbar (Horizontal Box) */}
                <div className="bg-slate-100 dark:bg-slate-800 flex items-center justify-between mb-4 rounded-md overflow-hidden h-10 shadow-sm border border-slate-200 dark:border-slate-700 px-1">
                  <div className="flex items-center h-full gap-2">
                    <div className="bg-white dark:bg-black text-black dark:text-white h-full w-10 flex items-center justify-center font-bold text-lg shrink-0 border-r border-slate-200 dark:border-slate-700 mr-1 -ml-1">
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
                    {renderContent(readingQuestionSentence)}
                  </div>
                )}

                {currentQuestion.type === 'multiple-choice' && currentQuestion.choices ? (
                  <MultipleChoiceQuestion 
                    choices={currentQuestion.choices}
                    selectedAnswer={selectedAnswer}
                    onAnswerChange={(answer) => {
                      setSelectedAnswer(answer);
                      localStorage.setItem(`${localStateKey}-answer`, answer);
                    }}
                    onCheck={handleCheck}
                    strikeoutMode={strikeoutMode}
                    checkedAnswers={checkedAnswers}
                    questionId={is100Hard ? questionNumber : currentQuestion.uuid}
                  />
                ) : (
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground">Your Answer:</label>
                    <Input
                      type="text"
                      value={freeResponseAnswer}
                      onChange={(e) => setFreeResponseAnswer(e.target.value)}
                      placeholder="Enter your answer"
                      className="max-w-md"
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Vertical Layout Mode (default) */
            <>
               {/* Question Toolbar (Vertical Box) */}
                <div className="bg-slate-100 dark:bg-slate-800 flex items-center justify-between mb-6 rounded-md overflow-hidden h-12 shadow-sm border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center h-full gap-2">
                    <div className="bg-white dark:bg-black text-black dark:text-white h-full w-12 flex items-center justify-center font-bold text-xl shrink-0 border-r border-slate-200 dark:border-slate-700 mr-1">
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

              {/* Question Content */}
              <div className="mb-6 sm:mb-8">
                  {passageContent ? (
                    <>
                      {renderQuestionImages()}
                      {renderContent(passageContent)}
                      {showQuestionTextAboveChoices && readingQuestionSentence && (
                        <div className="mt-4">{renderContent(readingQuestionSentence)}</div>
                      )}
                    </>
                  ) : (
                    <>
                      {renderQuestionImages()}
                      {renderContent(stemContent)}
                    </>
                  )}
              </div>

              {/* Answer Area */}
              {currentQuestion.type === 'multiple-choice' && currentQuestion.choices ? (
                <MultipleChoiceQuestion 
                  choices={currentQuestion.choices}
                  selectedAnswer={selectedAnswer}
                  onAnswerChange={(answer) => {
                    setSelectedAnswer(answer);
                    localStorage.setItem(`${localStateKey}-answer`, answer);
                  }}
                  onCheck={handleCheck}
                  strikeoutMode={strikeoutMode}
                  checkedAnswers={checkedAnswers}
                  questionId={is100Hard ? questionNumber : currentQuestion.uuid}
                />
              ) : (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">Your Answer:</label>
                  <Input
                    type="text"
                    value={freeResponseAnswer}
                    onChange={(e) => setFreeResponseAnswer(e.target.value)}
                    placeholder="Enter your answer"
                    className="max-w-md"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Bottom Navigation - Fixed at bottom */}
      <div 
        ref={bottomNavRef}
        className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-border shadow-lg z-40"
        style={isSplitScreenActive ? { width: `${splitPosition}%` } : undefined}
      >
        <div className="container mx-auto px-4 py-3">
          <div ref={bottomNavGridRef} className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
            {/* Left: Previous Button - fixed width to prevent layout shift */}
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

            {/* Center: Navigation Sheet */}
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
              <PreviousAttemptsDialog attempts={currentProgress.attempts} />
              {is100Hard ? (
                  <NavigationSheet 
                    currentQuestion={questionNumber} 
                    isSplitScreenActive={isSplitScreenActive}
                    splitPosition={splitPosition}
                  />
              ) : effectivePracticeMode ? (
                 isOfficialBank ? (
                     <OfficialPracticeNavigationSheet 
                        currentIndex={currentPracticeIndex}
                        practiceSet={practiceSet}
                        onJump={(idx) => {
                             navigateToPracticeIndex(idx);
                        }}
                        storagePrefix={`official-bank-${subject}`}
                        isSplitScreenActive={isSplitScreenActive}
                        splitPosition={splitPosition}
                     />
                 ) : (
                     <PracticeNavigationSheet 
                        currentIndex={currentPracticeIndex}
                        practiceSet={practiceSet}
                        onJump={(idx) => {
                             navigateToPracticeIndex(idx);
                        }}
                        exitTo={`/bank?bankType=${bankSource}`}
                        isSplitScreenActive={isSplitScreenActive}
                        splitPosition={splitPosition} 
                     />
                 )
              ) : (
                 <BankNavigationSheet
                    currentQuestion={questionNumber}
                    totalQuestions={totalQuestions}
                    onJump={(qNum) => {
                       const base = isOfficialBank ? '/official-bank' : '/bank';
                       navigate(`${base}/${subject}/${qNum}${isBank ? bankQuerySuffix : ""}`);
                    }}
                    items={bankNavigationItems}
                    isSplitScreenActive={isSplitScreenActive}
                    splitPosition={splitPosition}
                 />
              )}
            </div>

            {/* Right: Explanation, Check, Next - fixed width to prevent layout shift */}
            <div
              ref={bottomNavRightRef}
              className="ml-auto flex gap-2 shrink-0 justify-end"
              style={{ minWidth: shouldCompress ? undefined : '280px' }}
            >
              <ExplanationWindow 
                videoUrl={currentQuestion?.explanationVideo}
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
              />
              <Button 
                onClick={() => handleCheck()}
                disabled={isCheckDisabled}
                variant="outline"
                className={cn("h-10 border-2 transition-colors", getCheckButtonClasses())}
              >
                <Check className={shouldCompress ? "h-4 w-4" : "mr-1 h-4 w-4"} />
                {!shouldCompress && <span>Check</span>}
              </Button>
              <Button
                onClick={handleNext}
                disabled={!canGoNext}
                variant="outline"
                className="h-10 transition-colors duration-200 ease-out"
              >
                {!shouldCompress && <span>Next</span>}
                <ChevronRight className={shouldCompress ? "h-4 w-4" : "ml-1 h-4 w-4"} />
              </Button>
            </div>
            
            {/* Hidden measurement div - renders full-size buttons off-screen to measure natural width */}
            <div 
              ref={bottomMeasurementRef}
              aria-hidden="true"
              className="absolute -left-[9999px] flex gap-2 whitespace-nowrap"
              style={{ visibility: 'hidden', pointerEvents: 'none' }}
            >
              <Button variant="secondary" size="default">
                <span className="mr-2 h-4 w-4">▶</span>
                Explanation
              </Button>
              <Button size="default">
                <Check className="mr-1 h-4 w-4" />
                <span>Check</span>
              </Button>
              <Button size="default">
                <span>Next</span>
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
