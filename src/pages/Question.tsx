import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NavigationSheet } from "@/components/NavigationSheet";
import { FormulaSheetDialog } from "@/components/FormulaSheetDialog";
import { DesmosDialog } from "@/components/DesmosDialog";
import { ExplanationWindow } from "@/components/ExplanationWindow";
import { MultipleChoiceQuestion } from "@/components/MultipleChoiceQuestion";
import { ChevronLeft, ChevronRight, Check, Bookmark, Strikethrough } from "lucide-react";
import { toast } from "sonner";
import { questions } from "@/data/questions";
import { renderMixedContent } from "@/lib/utils";
import "katex/dist/katex.min.css";

function Question() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const questionNumber = parseInt(id || "1");
  const [checked, setChecked] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [freeResponseAnswer, setFreeResponseAnswer] = useState<string>("");
  const [markedForReview, setMarkedForReview] = useState(false);
  const [strikeoutMode, setStrikeoutMode] = useState(false);
  const [checkButtonVariant, setCheckButtonVariant] = useState<"default" | "destructive" | "success">("default");
  const [checkedAnswers, setCheckedAnswers] = useState<Record<string, boolean>>({});
  const [splitScreenWindows, setSplitScreenWindows] = useState<Set<string>>(new Set());
  const [splitPosition, setSplitPosition] = useState(50);
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [shouldCompress, setShouldCompress] = useState(false);
  const [windowOrder, setWindowOrder] = useState<string[]>(['referenceSheet', 'desmos', 'explanation']);
  const bottomNavRef = useRef<HTMLDivElement>(null);
  const measurementRef = useRef<HTMLDivElement>(null);

  // Compute if any window is in split screen mode
  const isSplitScreenActive = splitScreenWindows.size > 0;

  // Use hidden measurement div to determine if buttons need compression
  useEffect(() => {
    const checkSpace = () => {
      if (!bottomNavRef.current || !measurementRef.current) return;
      
      // Get the available width of the container
      const containerWidth = bottomNavRef.current.offsetWidth;
      
      // Get the natural width of all buttons at full size (from hidden measurement div)
      const buttonsNaturalWidth = measurementRef.current.scrollWidth;
      
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
    return 100 + index * 10;
  };

  // Get divider z-index - should be just below the topmost window but above others
  const getDividerZIndex = () => {
    // Topmost window has highest z-index: 100 + (length-1) * 10
    // Divider should be 5 below that, so it's above other windows but below the top one
    const topWindowZIndex = 100 + (windowOrder.length - 1) * 10;
    return topWindowZIndex - 5;
  };

  // Reset split position when split screen is deactivated
  useEffect(() => {
    if (!isSplitScreenActive) {
      setSplitPosition(50);
    }
  }, [isSplitScreenActive]);

  const currentQuestion = questions.find(q => q.id === questionNumber);
  
  if (!currentQuestion) {
    return <div>Question not found</div>;
  }

  useEffect(() => {
    // Render mixed content (HTML text + KaTeX math)
    const questionElement = document.getElementById('question-content');
    if (questionElement && currentQuestion) {
      const renderedHtml = renderMixedContent(currentQuestion.text);
      questionElement.innerHTML = `<span style="font-size:clamp(12px, 2.2vw, 22px); display: inline-block; max-width: 100%;">${renderedHtml}</span>`;
    }
    
    // Load saved flagged state from localStorage, but reset answer/check state
    const savedFlagged = localStorage.getItem(`question-${questionNumber}-flagged`);
    
    // Always reset selection and check states when navigating to a question
    setSelectedAnswer("");
    setFreeResponseAnswer("");
    setCheckedAnswers({});
    setChecked(false);
    setCheckButtonVariant("default");
    
    setMarkedForReview(savedFlagged === 'true');
    setAttemptCount(0);
  }, [questionNumber, currentQuestion]);

  useEffect(() => {
    if (!isSplitScreenActive) return;

    // Add/remove noselect class during splitscreen resize
    if (isResizingSplit) {
      document.body.classList.add("noselect");
    } else {
      document.body.classList.remove("noselect");
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSplit) {
        const newPosition = (e.clientX / window.innerWidth) * 100;
        // Limit between 50% and 70% to prevent button overlap
        setSplitPosition(Math.max(50, Math.min(70, newPosition)));
      }
    };

    const handleMouseUp = () => {
      setIsResizingSplit(false);
      document.body.classList.remove("noselect");
    };

    if (isResizingSplit) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSplit, isSplitScreenActive]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const choices = ['A', 'B', 'C', 'D'];

      if (e.key === 'ArrowLeft') {
        if (questionNumber > 1) {
          navigate(`/question/${questionNumber - 1}`);
        }
      } else if (e.key === 'ArrowRight') {
        if (questionNumber < 100) {
          navigate(`/question/${questionNumber + 1}`);
        }
      } else if (e.key === 'ArrowUp') {
        // Cycle to previous answer choice if one is selected
        if (currentQuestion.type === 'multiple-choice' && selectedAnswer) {
          const currentIndex = choices.indexOf(selectedAnswer);
          if (currentIndex > 0) {
            const newChoice = choices[currentIndex - 1];
            if (!checkedAnswers[newChoice]) {
              setSelectedAnswer(newChoice);
            }
          }
        }
      } else if (e.key === 'ArrowDown') {
        // Cycle to next answer choice if one is selected
        if (currentQuestion.type === 'multiple-choice' && selectedAnswer) {
          const currentIndex = choices.indexOf(selectedAnswer);
          if (currentIndex < choices.length - 1) {
            const newChoice = choices[currentIndex + 1];
            if (!checkedAnswers[newChoice]) {
              setSelectedAnswer(newChoice);
            }
          }
        }
      } else if (e.key === 'Enter') {
        const userAnswer = currentQuestion.type === 'multiple-choice' ? selectedAnswer : freeResponseAnswer;
        if (userAnswer && checkedAnswers[userAnswer] === undefined) {
          handleCheck();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [questionNumber, navigate, selectedAnswer, freeResponseAnswer, currentQuestion, checkedAnswers]);

  const handlePrevious = () => {
    if (questionNumber > 1) {
      navigate(`/question/${questionNumber - 1}`);
    }
  };

  const handleNext = () => {
    if (questionNumber < 100) {
      navigate(`/question/${questionNumber + 1}`);
    }
  };

  const handleCheck = () => {
    const userAnswer = currentQuestion.type === 'multiple-choice' ? selectedAnswer : freeResponseAnswer;
    
    if (!userAnswer) {
      toast.error("Please provide an answer");
      return;
    }

    // Don't re-check an already checked answer
    if (checkedAnswers[userAnswer] !== undefined) {
      return;
    }

    const normalizeAnswer = (answer: string) => {
      return answer.toString().trim().toLowerCase().replace(/\s+/g, '');
    };

    const isCorrect = normalizeAnswer(userAnswer) === normalizeAnswer(currentQuestion.correctAnswer);

    setChecked(true);
    const newCheckedAnswers = { ...checkedAnswers, [userAnswer]: isCorrect };
    setCheckedAnswers(newCheckedAnswers);
    const newAttemptCount = attemptCount + 1;
    setAttemptCount(newAttemptCount);

    // Save answer state to localStorage
    localStorage.setItem(`question-${questionNumber}-answer`, userAnswer);
    localStorage.setItem(`question-${questionNumber}-checkedAnswers`, JSON.stringify(newCheckedAnswers));

    if (isCorrect) {
      setCheckButtonVariant("success");
      
      // Save status to localStorage
      const status = newAttemptCount === 1 ? 'correct-first' : 'correct-later';
      localStorage.setItem(`question-${questionNumber}-status`, status);
    } else {
      setCheckButtonVariant("destructive");
      
      // Save incorrect status
      localStorage.setItem(`question-${questionNumber}-status`, 'incorrect');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      {/* Split Screen Divider - below focused window, above unfocused windows */}
      {isSplitScreenActive && (
        <div 
          className="fixed inset-y-0 w-4 cursor-col-resize flex items-center justify-center group"
          style={{ left: `calc(${splitPosition}% - 8px)`, zIndex: getDividerZIndex() }}
          onMouseDown={() => setIsResizingSplit(true)}
        >
          <div className="w-1 h-full bg-border group-hover:bg-primary/50 transition-colors" />
        </div>
      )}

      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div 
          className="container mx-auto px-4 py-4"
          style={isSplitScreenActive ? { maxWidth: `${splitPosition}%`, marginLeft: 0 } : undefined}
        >
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Home
            </Button>
            <div className="flex gap-2">
              <FormulaSheetDialog 
                onSplitScreenChange={handleSplitScreenChange}
                splitPosition={splitPosition}
                onFocus={() => bringToFront('referenceSheet')}
                zIndex={getZIndex('referenceSheet')}
              />
              <DesmosDialog 
                onSplitScreenChange={handleSplitScreenChange}
                splitPosition={splitPosition}
                onFocus={() => bringToFront('desmos')}
                zIndex={getZIndex('desmos')}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main 
        className="flex-1 px-4 py-8 pb-28"
        style={isSplitScreenActive ? { maxWidth: `${splitPosition}%`, marginLeft: 0 } : { maxWidth: "1280px", margin: "0 auto", width: "100%" }}
      >
        <Card className="p-4 sm:p-6 md:p-8 relative" style={{ maxWidth: isSplitScreenActive ? "100%" : "56rem", margin: isSplitScreenActive ? "0" : "0 auto" }}>
          {/* Question Number Badge */}
          <div className="absolute -top-4 -left-4 bg-foreground text-background rounded-full w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center font-bold text-lg sm:text-xl shadow-lg">
            {questionNumber}
          </div>

          {/* Mark for Review and Strikeout */}
          <div className="flex justify-end gap-2 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const newValue = !markedForReview;
                setMarkedForReview(newValue);
                localStorage.setItem(`question-${questionNumber}-flagged`, newValue.toString());
              }}
              className="text-foreground hover:bg-transparent hover:text-foreground"
            >
              <Bookmark className={markedForReview ? "text-destructive fill-destructive" : "text-foreground"} />
              <span className="text-foreground">Mark for Review</span>
            </Button>
            {currentQuestion.type === 'multiple-choice' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStrikeoutMode(!strikeoutMode)}
                className={strikeoutMode ? "bg-muted" : ""}
              >
                <Strikethrough className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Question Content */}
          <div className="mb-6 sm:mb-8">
            <div className="prose prose-sm sm:prose-base lg:prose-lg max-w-none overflow-x-auto">
              <div 
                id="question-content"
                className="text-foreground mb-4 sm:mb-6 break-words"
              />
            </div>
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
        </Card>
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
            <div data-nav-sheet>
              <NavigationSheet currentQuestion={questionNumber} />
            </div>

            {/* Right: Explanation, Check, Next - fixed width to prevent layout shift */}
            <div className="flex gap-2 shrink-0 justify-end" style={{ minWidth: shouldCompress ? undefined : '280px' }}>
              <ExplanationWindow 
                onSplitScreenChange={handleSplitScreenChange}
                splitPosition={splitPosition}
                compressed={shouldCompress}
                onFocus={() => bringToFront('explanation')}
                zIndex={getZIndex('explanation')}
              />
              <Button 
                onClick={handleCheck}
                disabled={checked && checkButtonVariant === "success"}
                variant={checkButtonVariant === "destructive" ? "destructive" : checkButtonVariant === "success" ? "default" : "default"}
                className={`${checkButtonVariant === "success" ? "bg-green-600 hover:bg-green-700" : ""} h-10`}
              >
                <Check className={shouldCompress ? "h-4 w-4" : "mr-1 h-4 w-4"} />
                {!shouldCompress && <span>Check</span>}
              </Button>
              <Button
                onClick={handleNext}
                disabled={questionNumber === 100}
                className="h-10"
              >
                {!shouldCompress && <span>Next</span>}
                <ChevronRight className={shouldCompress ? "h-4 w-4" : "ml-1 h-4 w-4"} />
              </Button>
            </div>
            
            {/* Hidden measurement div - renders full-size buttons off-screen to measure natural width */}
            <div 
              ref={measurementRef}
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
