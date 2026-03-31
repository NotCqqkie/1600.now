import { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BankSubject, bankCounts, getBankPool, getBankQuestion } from "@/data/questionBank";
import { MultipleChoiceQuestion } from "@/components/MultipleChoiceQuestion";
import { FormulaSheetDialog } from "@/components/FormulaSheetDialog";
import { DesmosDialog } from "@/components/DesmosDialog";
import { ExplanationWindow } from "@/components/ExplanationWindow";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BankNavigationSheet } from "@/components/BankNavigationSheet";
import { PracticeNavigationSheet } from "@/components/PracticeNavigationSheet";
import { cn, renderMixedContent } from "@/lib/utils";
import { useUserProgress } from "@/hooks/useUserProgress";
import { Bookmark, Check, ChevronLeft, ChevronRight, Eye, EyeOff, Minimize2, Maximize2, Pause, Play, Strikethrough, Rows3, Columns3 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import "katex/dist/katex.min.css";

const SUBJECT_BASE_ID: Record<BankSubject, number> = {
  math: 200000,
  reading: 300000,
};

const formatTimer = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const BankQuestion = () => {
  const { subject: rawSubject, id: rawId } = useParams<{ subject: string; id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Check if in practice mode
  const isPracticeMode = searchParams.get('practice') === 'true';
  const practiceIdx = parseInt(searchParams.get('idx') || '0', 10);

  // Get practice set from sessionStorage
  const practiceSet = useMemo(() => {
    if (!isPracticeMode) return null;
    try {
      const stored = sessionStorage.getItem('practiceSet');
      return stored ? JSON.parse(stored) as Array<{ subject: string; id: number; sourceId: string; index: number }> : null;
    } catch {
      return null;
    }
  }, [isPracticeMode]);

  const practiceTotal = practiceSet?.length || 0;

  // Find current position in practice set
  const currentPracticeIndex = useMemo(() => {
    if (!isPracticeMode || !practiceSet) return -1;
    return practiceSet.findIndex(q => q.id === Number.parseInt(rawId || '0', 10) && q.subject === rawSubject);
  }, [isPracticeMode, practiceSet, rawId, rawSubject]);
  const effectivePracticeMode = Boolean(isPracticeMode && practiceSet && practiceSet.length > 0 && currentPracticeIndex >= 0);

  const subject = (rawSubject === "math" || rawSubject === "reading" ? rawSubject : null) as BankSubject | null;
  const questionNumber = Number.parseInt(rawId || "1", 10);
  const totalQuestions = effectivePracticeMode ? practiceTotal : (subject ? bankCounts[subject] : 0);
  const question = subject ? getBankQuestion(subject, questionNumber) : null;

  const storagePrefix = subject ? `bank-${subject}` : "bank";
  const questionKey = `${storagePrefix}-${question?.id || questionNumber}`;
  const strikeoutId = (subject ? SUBJECT_BASE_ID[subject] : 400000) + (question?.id || 0);

  const { addAttempt } = useUserProgress();

  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [freeResponseAnswer, setFreeResponseAnswer] = useState<string>("");
  const [markedForReview, setMarkedForReview] = useState(false);
  const [strikeoutMode, setStrikeoutMode] = useState(false);
  const [checkedAnswers, setCheckedAnswers] = useState<Record<string, boolean>>({});
  const [checkButtonState, setCheckButtonState] = useState<"idle" | "incorrect" | "correct-first" | "correct-later">("idle");
  const [attemptCount, setAttemptCount] = useState(0);

  const [splitScreenWindows, setSplitScreenWindows] = useState<Set<string>>(new Set());
  const [sidebarredWindows, setSidebarredWindows] = useState<Set<string>>(new Set());
  const [splitPosition, setSplitPosition] = useState(50);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Default to vertical for math, horizontal for reading
  const [questionViewMode, setQuestionViewMode] = useState<'vertical' | 'horizontal'>(() => {
    return rawSubject === 'reading' ? 'horizontal' : 'vertical';
  });
  
  const [questionSplitPosition, setQuestionSplitPosition] = useState(50);
  const [isResizingQuestionSplit, setIsResizingQuestionSplit] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [isTimerVisible, setIsTimerVisible] = useState(true);
  const isSplitScreenActive = splitScreenWindows.size > 0;

  const questionContentRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    setIsFullscreen(Boolean(document.fullscreenElement));
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!subject || !question) return;
    // load persisted state
    const savedFlagged = localStorage.getItem(`${questionKey}-flagged`);
    setMarkedForReview(savedFlagged === "true");

    // intentionally NOT loading previous answers to force a "fresh practice" experience
    // while keeping the aggregated stats/history in localStorage
    setSelectedAnswer("");
    setFreeResponseAnswer("");
    setCheckedAnswers({});
    setCheckButtonState("idle"); 

    const savedAttempts = localStorage.getItem(`${questionKey}-attempts`);
    setAttemptCount(savedAttempts ? Number.parseInt(savedAttempts, 10) || 0 : 0);
  }, [subject, questionKey, question]);

  // Removed manual innerHTML injection in favor of renderContent helper used in JSX

  useEffect(() => {
    if (!isSplitScreenActive) {
      setSplitPosition(50);
    }
  }, [isSplitScreenActive]);

  useEffect(() => {
    setElapsedSeconds(0);
    setIsTimerPaused(false);
  }, [questionKey]);

  useEffect(() => {
    if (isTimerPaused) return;

    const timerId = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isTimerPaused]);

  // Handle question split divider resizing (for horizontal view mode)
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

  const handleSplitScreenChange = (isSplit: boolean, windowId: string) => {
    setSplitScreenWindows((prev) => {
      const next = new Set(prev);
      if (isSplit) next.add(windowId);
      else next.delete(windowId);
      return next;
    });
  };

  const handleSidebarToggle = (windowId: string, shouldBeSidebarred: boolean) => {
    setSidebarredWindows((prev) => {
      const next = new Set(prev);
      if (shouldBeSidebarred) next.add(windowId);
      else next.delete(windowId);
      return next;
    });
  };

  const handleSplitPositionChange = (pos: number) => setSplitPosition(pos);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  // Navigation for practice mode
  const goToPracticeIndex = (idx: number) => {
    if (!practiceSet || idx < 0 || idx >= practiceSet.length) return;
    const target = practiceSet[idx];
    navigate(`/bank/${target.subject}/${target.id}?practice=true&idx=${idx + 1}`);
  };

  // Navigation for normal mode
  const goTo = (num: number) => {
    if (effectivePracticeMode && practiceSet) {
      // In practice mode, num is the 1-based index in the practice set
      goToPracticeIndex(num - 1);
    } else {
      if (!subject) return;
      if (num < 1 || num > totalQuestions) return;
      navigate(`/bank/${subject}/${num}`);
    }
  };

  const handlePrevious = () => {
    if (effectivePracticeMode && practiceSet) {
      goToPracticeIndex(currentPracticeIndex - 1);
    } else {
      goTo(questionNumber - 1);
    }
  };

  const handleNext = () => {
    if (effectivePracticeMode && practiceSet) {
      goToPracticeIndex(currentPracticeIndex + 1);
    } else {
      goTo(questionNumber + 1);
    }
  };

  // Get current position for display
  const displayQuestionNumber = effectivePracticeMode ? (currentPracticeIndex + 1) : questionNumber;
  const canGoPrevious = effectivePracticeMode ? currentPracticeIndex > 0 : questionNumber > 1;
  const canGoNext = effectivePracticeMode ? currentPracticeIndex < practiceTotal - 1 : questionNumber < totalQuestions;

  const handleCheck = (overrideAnswer?: string) => {
    if (!question) return;
    const userAnswer = overrideAnswer || (question.type === "multiple-choice" ? selectedAnswer : freeResponseAnswer);
    if (!userAnswer) return;

    const alreadyCorrect = Object.values(checkedAnswers).some(Boolean);
    if (alreadyCorrect) return;
    if (checkedAnswers[userAnswer] !== undefined) return;

    if (overrideAnswer && overrideAnswer !== selectedAnswer && question.type === "multiple-choice") {
      setSelectedAnswer(overrideAnswer);
    }

    const normalize = (s: string) => s.toString().trim().toLowerCase().replace(/\s+/g, "");
    const isCorrect = question.correctAnswer ? normalize(userAnswer) === normalize(question.correctAnswer) : false;

    const newChecked = { ...checkedAnswers, [userAnswer]: isCorrect };
    const newAttempts = attemptCount + 1;
    setCheckedAnswers(newChecked);
    setAttemptCount(newAttempts);

    localStorage.setItem(`${questionKey}-answer`, userAnswer);
    localStorage.setItem(`${questionKey}-checkedAnswers`, JSON.stringify(newChecked));
    localStorage.setItem(`${questionKey}-attempts`, String(newAttempts));

    if (isCorrect) {
      const status = newAttempts === 1 ? "correct-first" : "correct-later";
      setCheckButtonState(status);
      localStorage.setItem(`${questionKey}-status`, status);
    } else {
      setCheckButtonState("incorrect");
      localStorage.setItem(`${questionKey}-status`, "incorrect");
    }

    // Track in useUserProgress (powers the Profile statistics page).
    // Only record the first attempt per session to avoid double-counting.
    if (newAttempts === 1 || !Object.values(checkedAnswers).some(Boolean)) {
      addAttempt(questionKey, isCorrect ? "correct" : "incorrect", elapsedSeconds, userAnswer);
    }
  };

  const hasSelection = question?.type === "multiple-choice" ? Boolean(selectedAnswer) : Boolean(freeResponseAnswer);
  const isCheckDisabled = !hasSelection || checkButtonState === "correct-first" || checkButtonState === "correct-later";

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
          if (canGoPrevious) handlePrevious();
          break;
        case 'ArrowRight':
          if (canGoNext) handleNext();
          break;
        case 'Enter':
          e.preventDefault();
          handleCheck();
          break;
        case 'ArrowUp':
        case 'ArrowDown':
          if (question && question.type === 'multiple-choice' && question.choices) {
            e.preventDefault();
            const choiceIds = question.choices.map(c => c.id);
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
            localStorage.setItem(`${questionKey}-answer`, nextId);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    canGoNext, 
    canGoPrevious, 
    handleNext, 
    handlePrevious, 
    handleCheck, 
    question, 
    selectedAnswer, 
    questionKey
  ]);

  if (!subject || !question || Number.isNaN(questionNumber)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-lg">Question not found.</p>
        <Button onClick={() => navigate("/bank")}>Back to Bank Home</Button>
      </div>
    );
  }

  const passageContent = question.passage;
  const promptContent = question.prompt?.trim() ? question.prompt : undefined;
  const questionTextContent = question.questionText?.trim() ? question.questionText : undefined;
  const stemContent = passageContent !== undefined ? passageContent : (promptContent ?? questionTextContent ?? "");
  const showQuestionTextAboveChoices =
    Boolean(questionTextContent) &&
    (passageContent !== undefined || !promptContent || questionTextContent !== promptContent);

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div 
          className={cn("container mx-auto px-4 py-4 transition-all duration-300 ease-linear", isSplitScreenActive && "mx-0 max-w-none")}
          style={isSplitScreenActive ? { width: `${splitPosition}%` } : undefined}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/bank")}>Home</Button>
              <span className="text-sm text-muted-foreground">{subject === "math" ? "Math" : "Reading/Writing"}</span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {subject !== "reading" && (
                <>
                  <FormulaSheetDialog
                    onSplitScreenChange={handleSplitScreenChange}
                    splitPosition={splitPosition}
                    onFocus={() => {}}
                    zIndex={60}
                    constrainToLeft={isSplitScreenActive ? splitPosition : undefined}
                  />
                  <DesmosDialog
                    onSplitScreenChange={handleSplitScreenChange}
                    onSplitPositionChange={handleSplitPositionChange}
                    splitPosition={splitPosition}
                    onFocus={() => {}}
                    zIndex={70}
                    constrainToLeft={isSplitScreenActive ? splitPosition : undefined}
                    isSidebarred={sidebarredWindows.has("desmos")}
                    onSidebarToggle={handleSidebarToggle}
                  />
                </>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" title="Question View">
                    {questionViewMode === 'vertical' ? (
                      <Rows3 className="h-4 w-4" />
                    ) : (
                      <Columns3 className="h-4 w-4" />
                    )}
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
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setIsTimerVisible((prev) => !prev)}
              title={isTimerVisible ? "Hide timer" : "Show timer"}
            >
              {isTimerVisible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </Button>
            <span className="min-w-[7ch] text-center text-3xl font-bold tracking-wide tabular-nums">
              {isTimerVisible ? formatTimer(elapsedSeconds) : ""}
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
          </div>
        </div>
      </header>

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
              {/* Left Panel - Passage Content */}
              <div 
                className="pr-4 overflow-y-auto space-y-4"
                style={{ width: `${questionSplitPosition}%` }}
              >
                {/* Use passage if available, otherwise prompt/question text fallback */}
                {renderContent(stemContent)}
                
                {question.questionImages && question.questionImages.length > 0 && (
                  <div className="space-y-2">
                    {question.questionImages.map((img, idx) => (
                      <div key={idx} className="w-full flex justify-center">
                        <img
                          src={img.src}
                          alt={img.alt || `Question image ${idx + 1}`}
                          className="max-w-full h-auto max-h-[340px] rounded-md object-contain border border-border"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Horizontal Divider */}
              <div 
                className="w-4 cursor-col-resize flex items-center justify-center group flex-shrink-0 self-stretch"
                onMouseDown={() => setIsResizingQuestionSplit(true)}
              >
                <div className="w-1 h-full bg-border group-hover:bg-primary/50 transition-colors rounded" />
              </div>

              {/* Right Panel - Question + Answer Area */}
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
                      onClick={() => {
                        const newValue = !markedForReview;
                        setMarkedForReview(newValue);
                        localStorage.setItem(`${questionKey}-flagged`, newValue.toString());
                      }}
                      className="h-7 rounded px-3 gap-2 font-normal text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-black/50"
                    >
                      <Bookmark className={cn("h-3.5 w-3.5", markedForReview && "bookmark-flag")} />
                      <span className="text-xs font-medium">Mark for Review</span>
                    </Button>
                  </div>

                  <div className="flex items-center h-full gap-1">
                    {question.type === "multiple-choice" && (
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

                {/* Specific Question Text above choices */}
                {showQuestionTextAboveChoices && questionTextContent && (
                  <div className="mb-6">
                    {renderContent(questionTextContent)}
                  </div>
                )}

                {question.type === "multiple-choice" && question.choices ? (
                  <MultipleChoiceQuestion
                    choices={question.choices}
                    selectedAnswer={selectedAnswer}
                    onAnswerChange={(answer) => {
                      setSelectedAnswer(answer);
                      localStorage.setItem(`${questionKey}-answer`, answer);
                    }}
                    onCheck={handleCheck}
                    strikeoutMode={strikeoutMode}
                    checkedAnswers={checkedAnswers}
                    questionId={strikeoutId}
                  />
                ) : (
                  <div className="space-y-3">
                    <label className="text-base font-medium text-foreground">Your Answer:</label>
                    <Input
                      type="text"
                      value={freeResponseAnswer}
                      onChange={(e) => {
                        setFreeResponseAnswer(e.target.value);
                        localStorage.setItem(`${questionKey}-answer`, e.target.value);
                      }}
                      placeholder="Enter your answer"
                      className="max-w-md text-base md:text-base"
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
                      onClick={() => {
                        const newValue = !markedForReview;
                        setMarkedForReview(newValue);
                        localStorage.setItem(`${questionKey}-flagged`, newValue.toString());
                      }}
                      className="h-9 rounded px-4 gap-2 font-normal text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-black/50"
                    >
                      <Bookmark className={cn("h-4 w-4", markedForReview && "bookmark-flag")} />
                      <span className="text-sm font-medium">Mark for Review</span>
                    </Button>
                  </div>

                  <div className="flex items-center h-full pr-2 gap-1">
                    {question.type === "multiple-choice" && (
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
                 {/* Stacked content: Passage/Context + Question */}
                 {passageContent ? (
                    <>
                       {renderContent(passageContent)}
                       {showQuestionTextAboveChoices && questionTextContent && <div className="mt-4">{renderContent(questionTextContent)}</div>}
                    </>
                 ) : (
                    renderContent(stemContent)
                 )}

                {question.questionImages && question.questionImages.length > 0 && (
                  <div className="space-y-2">
                    {question.questionImages.map((img, idx) => (
                      <div key={idx} className="w-full flex justify-center">
                        <img
                          src={img.src}
                          alt={img.alt || `Question image ${idx + 1}`}
                          className="max-w-full h-auto max-h-[340px] rounded-md object-contain border border-border"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {question.type === "multiple-choice" && question.choices ? (
                <MultipleChoiceQuestion
                  choices={question.choices}
                  selectedAnswer={selectedAnswer}
                  onAnswerChange={(answer) => {
                    setSelectedAnswer(answer);
                    localStorage.setItem(`${questionKey}-answer`, answer);
                  }}
                  onCheck={handleCheck}
                  strikeoutMode={strikeoutMode}
                  checkedAnswers={checkedAnswers}
                  questionId={strikeoutId}
                />
              ) : (
                <div className="space-y-3">
                  <label className="text-base font-medium text-foreground">Your Answer:</label>
                  <Input
                    type="text"
                    value={freeResponseAnswer}
                    onChange={(e) => {
                      setFreeResponseAnswer(e.target.value);
                      localStorage.setItem(`${questionKey}-answer`, e.target.value);
                    }}
                    placeholder="Enter your answer"
                    className="max-w-md text-base md:text-base"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <div
        className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-border shadow-lg z-40"
        style={isSplitScreenActive ? { width: `${splitPosition}%` } : undefined}
      >
        <div className="container mx-auto px-4 py-3">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
            <div className="shrink-0">
              <Button variant="outline" onClick={handlePrevious} disabled={!canGoPrevious} className="h-10">
                <ChevronLeft className="mr-1 h-4 w-4" />
                <span>Previous</span>
              </Button>
            </div>

            <div className="min-w-0 overflow-hidden px-1 flex justify-center">
              {effectivePracticeMode && practiceSet ? (
                <PracticeNavigationSheet
                  currentIndex={currentPracticeIndex}
                  practiceSet={practiceSet}
                  onJump={goToPracticeIndex}
                  isSplitScreenActive={isSplitScreenActive}
                  splitPosition={splitPosition}
                  storagePrefix={storagePrefix}
                />
              ) : (
                <BankNavigationSheet
                  currentQuestion={questionNumber}
                  totalQuestions={totalQuestions}
                  onJump={goTo}
                  isSplitScreenActive={isSplitScreenActive}
                  splitPosition={splitPosition}
                  storagePrefix={storagePrefix}
                />
              )}
            </div>

            <div className="flex gap-2 shrink-0 justify-end">
              <ExplanationWindow
                onSplitScreenChange={handleSplitScreenChange}
                onSplitPositionChange={handleSplitPositionChange}
                splitPosition={splitPosition}
                onFocus={() => {}}
                zIndex={80}
                constrainToLeft={isSplitScreenActive ? splitPosition : undefined}
                isSidebarred={sidebarredWindows.has("explanation")}
                onSidebarToggle={handleSidebarToggle}
                correctAnswer={question?.correctAnswer}
                rationale={question?.rationale}
                questionType={question?.type}
                choices={question?.choices}
                questionId={questionKey}
              />
              <Button
                onClick={() => handleCheck()}
                disabled={isCheckDisabled}
                variant="outline"
                className={cn("h-10 border-2 transition-colors", {
                  "bg-[#C8E6C9] hover:bg-[#A5D6A7] border-[#1B5E20] text-[#1B5E20] dark:bg-[#1B5E20] dark:hover:bg-[#144216] dark:border-[#2E7D32] dark:text-white disabled:opacity-100": checkButtonState === "correct-first",
                  "bg-[#FFE0B2] hover:bg-[#FFCC80] border-[#E65100] text-[#BF360C] dark:bg-[#E65100] dark:hover:bg-[#BF360C] dark:border-[#EF6C00] dark:text-white disabled:opacity-100": checkButtonState === "correct-later",
                  "bg-[#FFCDD2] hover:bg-[#EF9A9A] border-[#B71C1C] text-[#2C1A1A] dark:bg-[#5C1010] dark:hover:bg-[#4A0D0D] dark:border-[#8B0000] dark:text-white": checkButtonState === "incorrect",
                })}
              >
                <Check className="mr-1 h-4 w-4" />
                <span>Check</span>
              </Button>
              <Button onClick={handleNext} disabled={!canGoNext} variant="outline" className="h-10">
                <span>Next</span>
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankQuestion;
