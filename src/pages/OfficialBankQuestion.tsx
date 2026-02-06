import { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BankSubject, bankCounts, getBankPool, getBankQuestion } from "@/data/officialQuestionBank";
import { MultipleChoiceQuestion } from "@/components/MultipleChoiceQuestion";
import { FormulaSheetDialog } from "@/components/FormulaSheetDialog";
import { DesmosDialog } from "@/components/DesmosDialog";
import { ExplanationWindow } from "@/components/ExplanationWindow";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BankNavigationSheet } from "@/components/BankNavigationSheet";
import { OfficialPracticeNavigationSheet } from "@/components/OfficialPracticeNavigationSheet";
import { cn, renderMixedContent } from "@/lib/utils";
import { Bookmark, Check, ChevronLeft, ChevronRight, Minimize2, Maximize2, Strikethrough, Rows3, Columns3 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import "katex/dist/katex.min.css";

const OfficialBankQuestion = () => {
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
    // Note: ensure id comparison works for string/number types
    return practiceSet.findIndex(q => String(q.id) === rawId && q.subject === rawSubject);
  }, [isPracticeMode, practiceSet, rawId, rawSubject]);

  const subject = (rawSubject === "math" || rawSubject === "reading" ? rawSubject : null) as BankSubject | null;
  // Handle string IDs for official bank
  const questionId = rawId || "1";
  
  // For total count, if using official bank, might differ.
  // bankCounts might be correct if officialQuestionBank updates it.
  const totalQuestions = isPracticeMode ? practiceTotal : (subject ? bankCounts[subject] : 0);
  
  const question = subject ? getBankQuestion(subject, questionId) : null;

  const storagePrefix = subject ? `official-bank-${subject}` : "official-bank";
  const questionKey = `${storagePrefix}-${question?.id || questionId}`;
  
  // Official questions might use UUIDs, so simple addition for strikeoutId won't work.
  // We'll use the ID string directly as a suffix if it's a string, or a hash.
  // But MultipleChoiceQuestion just needs a unique ID scope.
  const strikeoutId = question?.id || questionKey;

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

  useEffect(() => {
    if (!isSplitScreenActive) {
      setSplitPosition(50);
    }
  }, [isSplitScreenActive]);

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
    navigate(`/official-bank/${target.subject}/${target.id}?practice=true&idx=${idx + 1}`);
  };

  // Navigation for normal mode
  const goTo = (targetId: string | number) => {
    if (isPracticeMode && practiceSet) {
      // In practice mode, num is the 1-based index in the practice set  <-- comment from original, logic slightly different for ID
      // This is "go to Nth question" or "go to question ID"?
      // The original BankQuestion expected `num` (an integer index for the pool).
      // Here `targetId` in official bank might be string.
      // If `goTo` is called with a number, and official bank relies on array index, we need similar logic.
      // Original: navigate(`/bank/${subject}/${num}`);
      // getBankQuestion(subject, num) expects 1-based index if it's the sequential bank.
      // If official bank is just an array, then strict ID might be needed.
      // Let's assume getBankQuestion handles "id" which might be "1", "2", etc OR "uuid".
      // If "official-bank" behavior mimics "bank", then "num" is likely an index 1...N.
      
      if (!subject) return;
       navigate(`/official-bank/${subject}/${targetId}`);
    } else {
      // Logic for sequential navigation in pool
      // If official bank allows sequential by index (1..N), we use that.
      if (!subject) return;
      navigate(`/official-bank/${subject}/${targetId}`);
    }
  };

  // Assuming sequential integer IDs for now if next/prev logic is needed based on +1/-1
  // If IDs are strings/UUIDs, next/prev requires finding current index in global pool.
  // The original `getBankQuestion(subject, id)`:
  // "returns the question at that index (1-based) OR with that ID".
  // `getBankPool(subject)` returns array.
  
  const pool = subject ? getBankPool(subject) : [];
  const currentPoolIndex = useMemo(() => {
     if (!question || !pool.length) return -1;
     return pool.findIndex(q => String(q.id) === String(question.id));
  }, [question, pool]);

  const handlePrevious = () => {
    if (isPracticeMode && practiceSet) {
      goToPracticeIndex(currentPracticeIndex - 1);
    } else {
        if (currentPoolIndex > 0) {
            const prevQ = pool[currentPoolIndex - 1];
            goTo(prevQ.id);
        }
    }
  };

  const handleNext = () => {
    if (isPracticeMode && practiceSet) {
      goToPracticeIndex(currentPracticeIndex + 1);
    } else {
        if (currentPoolIndex < pool.length - 1) {
            const nextQ = pool[currentPoolIndex + 1];
            goTo(nextQ.id);
        }
    }
  };
  
  // Re-calc basic nav flags based on pool index
  const canGoPrevious = isPracticeMode ? currentPracticeIndex > 0 : currentPoolIndex > 0;
  const canGoNext = isPracticeMode ? currentPracticeIndex < practiceTotal - 1 : currentPoolIndex < pool.length - 1;
  const displayQuestionNumber = isPracticeMode ? (currentPracticeIndex + 1) : (currentPoolIndex + 1); // 1-based index in pool

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

  if (!subject || !question) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-lg">Question not found.</p>
        <Button onClick={() => navigate("/official-bank")}>Back to Bank Home</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div 
          className={cn("container mx-auto px-4 py-4 transition-all duration-300 ease-linear", isSplitScreenActive && "mx-0 max-w-none")}
          style={isSplitScreenActive ? { width: `${splitPosition}%` } : undefined}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/official-bank")}>Home</Button>
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
                {/* Use passage if available, otherwise prompt (legacy) */}
                {renderContent(question.passage !== undefined ? question.passage : question.prompt)}
                
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
                {question.questionText && (
                  <div className="mb-6">
                    {renderContent(question.questionText)}
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
                 {question.passage ? (
                    <>
                       {renderContent(question.passage)}
                       {question.questionText && <div className="mt-4">{renderContent(question.questionText)}</div>}
                    </>
                 ) : (
                    renderContent(question.prompt)
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
            </>
          )}

          <footer className="mt-8 flex items-center justify-between border-t border-border pt-6">
            <div className="flex gap-2 relative">
             <Button
                variant="outline"
                onClick={handlePrevious}
                className="w-24 group overflow-hidden"
              >
                <div className="flex items-center gap-1 transition-transform duration-300 group-hover:-translate-x-1">
                     <ChevronLeft className="h-4 w-4" />
                     Previous
                </div>
              </Button>
              
              {isPracticeMode ? (
                  <OfficialPracticeNavigationSheet
                    currentIndex={currentPracticeIndex}
                    practiceSet={practiceSet || []}
                    onJump={goToPracticeIndex}
                    storagePrefix={`official-bank-${subject}`}
                    isSplitScreenActive={isSplitScreenActive}
                    splitPosition={splitPosition}
                  />
              ) : (
                  <BankNavigationSheet
                    currentQuestion={isPracticeMode ? currentPracticeIndex + 1 : currentPoolIndex + 1}
                    totalQuestions={totalQuestions}
                    onJump={(idx) => {
                         // BankNavigationSheet usually sends idx (1-based)
                         // logic: onJump needs to map to ID or Index.
                         // Standard Bank: onJump(num). goTo(num).
                         // Here process is:
                         if (pool[idx - 1]) {
                             goTo(pool[idx - 1].id);
                         }
                    }}
                    storagePrefix={storagePrefix}
                    isSplitScreenActive={isSplitScreenActive}
                    splitPosition={splitPosition}
                  />
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => handleCheck()}
                disabled={isCheckDisabled}
                className={cn(
                  "w-32 transition-all duration-200 relative overflow-hidden",
                  checkButtonState === "correct-first" && "bg-green-600 hover:bg-green-700 text-white border-green-700",
                  checkButtonState === "correct-later" && "bg-orange-500 hover:bg-orange-600 text-white border-orange-600",
                  checkButtonState === "incorrect" && "bg-red-600 hover:bg-red-700 text-white border-red-700"
                )}
              >
                <div className="flex items-center justify-center gap-2">
                   {checkButtonState === "correct-first" || checkButtonState === "correct-later" ? (
                      <>
                        <Check className="h-4 w-4" />
                        Correct!
                      </>
                   ) : checkButtonState === "incorrect" ? (
                      "Try Again"
                   ) : (
                      "Check"
                   )}
                </div>
              </Button>

              <Button
                onClick={handleNext}
               className="w-24 group overflow-hidden" 
              >
                 <div className="flex items-center gap-1 transition-transform duration-300 group-hover:translate-x-1">
                   Next
                   <ChevronRight className="h-4 w-4" />
                 </div>
              </Button>
            </div>
          </footer>
          
          <ExplanationWindow
             question={question}
             userAnswer={question.type === "multiple-choice" ? selectedAnswer : freeResponseAnswer}
             isCorrect={checkButtonState === "correct-first" || checkButtonState === "correct-later"}
             showExplanation={checkButtonState === "correct-first" || checkButtonState === "correct-later" || attemptCount >= 3}
          />

        </div>
      </main>
    </div>
  );
};

export default OfficialBankQuestion;
