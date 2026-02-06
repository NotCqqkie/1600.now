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
import { ChevronLeft, ChevronRight, Check, Bookmark, Strikethrough, Maximize2, Minimize2, Rows3, Columns3 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { questions as originalQuestions } from "@/data/100 Hard";
import { getBankQuestion as getBankQuestionNormal, bankCounts as normalBankCounts } from "@/data/questionBank";
import { getBankQuestion as getBankQuestionOfficial, bankCounts as officialBankCounts } from "@/data/officialQuestionBank";
import { cn, renderMixedContent } from "@/lib/utils";
import { useUserProgress } from "@/hooks/useUserProgress";
import "katex/dist/katex.min.css";

// Use original 100 hard questions with uuid for progress tracking
const hardQuestions = originalQuestions.map(q => ({
  ...q,
  uuid: `hard-${q.id}` // Unique ID for progress tracking
}));

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
  const practiceSet = useMemo(() => {
    if (!isPracticeMode) return [];
    try { return JSON.parse(sessionStorage.getItem('practiceSet') || '[]'); } catch { return []; }
  }, [isPracticeMode]);

  // If needed: const practiceIdx = parseInt(searchParams.get('idx') || '0', 10);

  const questionNumber = parseInt(id || "1", 10);
  const subject = (rawSubject === "math" || rawSubject === "reading" ? rawSubject : "math") as "math" | "reading";

  // Data fetching logic
  const questionData = useMemo(() => {
    if (is100Hard) {
      return hardQuestions.find(q => q.id === questionNumber);
    }
    
    // Bank / Official Bank Logic
    const getter = isOfficialBank ? getBankQuestionOfficial : getBankQuestionNormal;
    const q = getter(subject, questionNumber);
    
    if (!q) return null;
    return {
      ...q,
      uuid: `${isOfficialBank ? 'official' : 'bank'}-${subject}-${q.id}` // Unique ID
    };

  }, [is100Hard, isBank, isOfficialBank, questionNumber, subject]);

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
  const [windowOrder, setWindowOrder] = useState<string[]>(['referenceSheet', 'desmos', 'explanation']);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [questionViewMode, setQuestionViewMode] = useState<'vertical' | 'horizontal'>('vertical');
  const [questionSplitPosition, setQuestionSplitPosition] = useState(50);
  const [isResizingQuestionSplit, setIsResizingQuestionSplit] = useState(false);
  const bottomNavRef = useRef<HTMLDivElement>(null);
  const bottomMeasurementRef = useRef<HTMLDivElement>(null);
  const topNavRef = useRef<HTMLDivElement>(null);
  const topMeasurementRef = useRef<HTMLDivElement>(null);
  const topCompressStateRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  const currentQuestion = questionData;
  const currentProgress = currentQuestion ? (progress[currentQuestion.uuid] || { isMarkedForReview: false, attempts: [] }) : { isMarkedForReview: false, attempts: [] };
  const markedForReview = currentProgress.isMarkedForReview;

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
  }, [questionNumber, subject, isBank, isOfficialBank]);

  // Compute if any window is in split screen mode
  const isSplitScreenActive = splitScreenWindows.size > 0;

  // Use hidden measurement div to determine if buttons need compression
  useEffect(() => {
    const checkSpace = () => {
      // Bottom navigation compression
      if (bottomNavRef.current && bottomMeasurementRef.current) {
        // Get the available width of the container
        const containerWidth = bottomNavRef.current.offsetWidth;
        
        // Get the natural width of all buttons at full size (from hidden measurement div)
        const buttonsNaturalWidth = bottomMeasurementRef.current.scrollWidth;
        
        // Calculate space taken by navigation sheet (roughly center element)
        const navSheet = bottomNavRef.current.querySelector('[data-nav-sheet]');
        const navSheetWidth = navSheet ? (navSheet as HTMLElement).offsetWidth : 120;
        
        // Previous button width (approximate at full size)
        const prevButtonWidth = 100;
        
        // Total width needed: prev button + nav sheet + right buttons + gaps + padding
        // Added extra 32px buffer to trigger compression slightly earlier before overlap occurs
        const totalNeeded = prevButtonWidth + navSheetWidth + buttonsNaturalWidth + 80;
        
        // Compress if we don't have enough space
        setShouldCompress(containerWidth < totalNeeded);
      }

      // Top bar compression
      if (topNavRef.current && topMeasurementRef.current) {
        const containerWidth = topNavRef.current.offsetWidth;
        const leftSection = topNavRef.current.querySelector('[data-header-left]') as HTMLElement | null;
        const leftWidth = leftSection ? leftSection.offsetWidth : 120;
        const buttonsNaturalWidth = topMeasurementRef.current.scrollWidth;
        // Aggressive threshold: force icons sooner by adding larger buffer
        // User requested: "turn int oi cons a bit sooner? be sure its detecting when the y cant compress any further"
        const totalNeeded = leftWidth + buttonsNaturalWidth + 200; 
        // Hysteresis buffer to prevent rapid toggling near the threshold
        const buffer = 24;
        const currentlyCompressed = topCompressStateRef.current;
        let nextCompressed = currentlyCompressed;
        if (!currentlyCompressed && containerWidth < totalNeeded - buffer) {
          nextCompressed = true;
        } else if (currentlyCompressed && containerWidth > totalNeeded + buffer) {
          nextCompressed = false;
        }
        if (nextCompressed !== currentlyCompressed) {
          topCompressStateRef.current = nextCompressed;
          setTopShouldCompress(nextCompressed);
        }
      }
    };
    
    checkSpace();
    window.addEventListener('resize', checkSpace);
    
    // Recheck after a short delay to ensure layout is settled
    const timeout = setTimeout(checkSpace, 100);
    
    return () => {
      window.removeEventListener('resize', checkSpace);
      clearTimeout(timeout);
    };
  }, [splitPosition, isSplitScreenActive]);

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
    setSplitPosition(newPosition);
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
    return <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Question not found</h1>
        <Button onClick={() => navigate("/")}>Go Home</Button>
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
    if (isPracticeMode) {
      try { return JSON.parse(sessionStorage.getItem('practiceSet') || '[]').length; } catch { return 0; }
    }
    if (subject) {
      const counts = isOfficialBank ? officialBankCounts : normalBankCounts;
      return counts[subject] || 0;
    }
    return 0;
  }, [is100Hard, isPracticeMode, isOfficialBank, subject]);

  const storagePrefix = useMemo(() => {
     if (is100Hard) return 'question';
     if (subject) return `${isOfficialBank ? 'official-bank' : 'bank'}-${subject}`;
     return 'bank'; 
  }, [is100Hard, subject, isOfficialBank]);

  const handlePrevious = () => {
    if (questionNumber > 1) {
       if (is100Hard) {
          navigate(`/question/${questionNumber - 1}`);
       } else {
           const base = isOfficialBank ? '/official-bank' : '/bank';
           if (isPracticeMode) {
             navigate(`${base}/${subject}/${questionNumber - 1}?${searchParams.toString()}`);
           } else {
             navigate(`${base}/${subject}/${questionNumber - 1}`);
           }
       }
    }
  };

  const handleNext = () => {
    if (questionNumber < totalQuestions) {
       if (is100Hard) {
          navigate(`/question/${questionNumber + 1}`);
       } else {
           const base = isOfficialBank ? '/official-bank' : '/bank';
           if (isPracticeMode) {
             navigate(`${base}/${subject}/${questionNumber + 1}?${searchParams.toString()}`);
           } else {
             navigate(`${base}/${subject}/${questionNumber + 1}`);
           }
       }
    }
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
    localStorage.setItem(`question-${questionNumber}-answer`, userAnswer);
    localStorage.setItem(`question-${questionNumber}-checkedAnswers`, JSON.stringify(newCheckedAnswers));

    if (isCorrect) {
      const status = newAttemptCount === 1 ? 'correct-first' : 'correct-later';
      setCheckButtonState(status);
      
      // Save status to localStorage
      localStorage.setItem(`question-${questionNumber}-status`, status);
    } else {
      setCheckButtonState("incorrect");
      
      // Save incorrect status
      localStorage.setItem(`question-${questionNumber}-status`, 'incorrect');
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
            localStorage.setItem(`question-${questionNumber}-answer`, nextId);
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

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div 
          className="container mx-auto px-4 py-4"
          style={isSplitScreenActive ? { maxWidth: `${splitPosition}%`, marginLeft: 0 } : undefined}
        >
          <div className="flex items-center justify-between gap-3" ref={topNavRef}>
            <div data-header-left className="flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
              >
                <ChevronLeft className={topShouldCompress ? "h-4 w-4" : "mr-1 h-4 w-4"} />
                {!topShouldCompress && "Home"}
              </Button>
            </div>
            <div className="flex items-center gap-2">
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
                  <Minimize2 className={topShouldCompress ? "h-4 w-4" : "mr-2 h-4 w-4"} />
                ) : (
                  <Maximize2 className={topShouldCompress ? "h-4 w-4" : "mr-2 h-4 w-4"} />
                )}
                {!topShouldCompress && (isFullscreen ? "Exit Fullscreen" : "Fullscreen")}
              </Button>
            </div>

            {/* Hidden measurement div to determine when to compress the top bar */}
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
                Fullscreen
              </Button>
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
                  {renderContent(currentQuestion.text)}
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
                      {questionNumber}
                    </div>
                    
                    <Button
                      variant="ghost"
                      onClick={() => toggleReview(currentQuestion.uuid)}
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

                {currentQuestion.type === 'multiple-choice' && currentQuestion.choices ? (
                  <MultipleChoiceQuestion 
                    choices={currentQuestion.choices}
                    selectedAnswer={selectedAnswer}
                    onAnswerChange={(answer) => {
                      setSelectedAnswer(answer);
                      localStorage.setItem(`question-${questionNumber}-answer`, answer);
                    }}
                    onCheck={handleCheck}
                    strikeoutMode={strikeoutMode}
                    checkedAnswers={checkedAnswers}
                    questionId={questionNumber}
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
                      {questionNumber}
                    </div>
                    
                    <Button
                      variant="ghost"
                      onClick={() => toggleReview(currentQuestion.uuid)}
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
                  {renderContent(currentQuestion.text)}
              </div>

              {/* Answer Area */}
              {currentQuestion.type === 'multiple-choice' && currentQuestion.choices ? (
                <MultipleChoiceQuestion 
                  choices={currentQuestion.choices}
                  selectedAnswer={selectedAnswer}
                  onAnswerChange={(answer) => {
                    setSelectedAnswer(answer);
                    localStorage.setItem(`question-${questionNumber}-answer`, answer);
                  }}
                  onCheck={handleCheck}
                  strikeoutMode={strikeoutMode}
                  checkedAnswers={checkedAnswers}
                  questionId={questionNumber}
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
          <div className="flex items-center gap-2 justify-between">
            {/* Left: Previous Button - fixed width to prevent layout shift */}
            <div className="shrink-0" style={{ minWidth: shouldCompress ? undefined : '100px' }}>
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={questionNumber === 1}
                className="h-10"
              >
                <ChevronLeft className={shouldCompress ? "h-4 w-4" : "mr-1 h-4 w-4"} />
                {!shouldCompress && <span>Previous</span>}
              </Button>
            </div>

            {/* Center: Navigation Sheet */}
            <div data-nav-sheet className="flex items-center gap-1">
              <PreviousAttemptsDialog attempts={currentProgress.attempts} />
              {is100Hard ? (
                  <NavigationSheet 
                    currentQuestion={questionNumber} 
                    isSplitScreenActive={isSplitScreenActive}
                    splitPosition={splitPosition}
                  />
              ) : isPracticeMode ? (
                 isOfficialBank ? (
                     <OfficialPracticeNavigationSheet 
                        currentIndex={practiceSet.findIndex((q: any) => q.id === questionNumber && q.subject === subject)}
                        practiceSet={practiceSet}
                        onJump={(idx) => {
                             const item = practiceSet[idx];
                             if (item) navigate(`/official-bank/${item.subject}/${item.id}?practice=true`);
                        }}
                        storagePrefix={`official-bank-${subject}`}
                        isSplitScreenActive={isSplitScreenActive}
                        splitPosition={splitPosition}
                     />
                 ) : (
                     <PracticeNavigationSheet 
                        currentIndex={practiceSet.findIndex((q: any) => q.id === questionNumber && q.subject === subject)}
                        practiceSet={practiceSet}
                        onJump={(idx) => {
                             const item = practiceSet[idx];
                             if (item) navigate(`/bank/${item.subject}/${item.id}?practice=true`);
                        }}
                        storagePrefix={`bank-${subject}`}
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
                       navigate(`${base}/${subject}/${qNum}`);
                    }}
                    storagePrefix={storagePrefix}
                    isSplitScreenActive={isSplitScreenActive}
                    splitPosition={splitPosition}
                 />
              )}
            </div>

            {/* Right: Explanation, Check, Next - fixed width to prevent layout shift */}
            <div className="flex gap-2 shrink-0 justify-end" style={{ minWidth: shouldCompress ? undefined : '280px' }}>
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
                disabled={questionNumber >= totalQuestions}
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
