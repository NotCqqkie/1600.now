import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
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
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Track window resize
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Compute if any window is in split screen mode
  const isSplitScreenActive = splitScreenWindows.size > 0;

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
      {/* Split Screen Divider */}
      {isSplitScreenActive && (
        <div 
          className="fixed top-0 bottom-0 w-1 bg-border hover:bg-primary/50 cursor-col-resize z-30 transition-colors"
          style={{ left: `${splitPosition}%` }}
          onMouseDown={() => setIsResizingSplit(true)}
        />
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
              />
              <DesmosDialog 
                onSplitScreenChange={handleSplitScreenChange}
                splitPosition={splitPosition}
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
      {(() => {
        // Calculate actual available width in pixels
        const availableWidth = isSplitScreenActive 
          ? (windowWidth * splitPosition) / 100 
          : windowWidth;
        // Compress buttons when available width is less than 580px
        const shouldCompress = availableWidth < 580;
        
        return (
          <div 
            className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-border shadow-lg z-40"
            style={isSplitScreenActive ? { width: `${splitPosition}%` } : undefined}
          >
            <div className="container mx-auto px-4 py-3">
              <div className="flex items-center gap-2 justify-between">
                {/* Left: Previous Button */}
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={questionNumber === 1}
                  className="shrink-0"
                  size={shouldCompress ? "sm" : "default"}
                >
                  <ChevronLeft className={shouldCompress ? "h-4 w-4" : "mr-1 h-4 w-4"} />
                  {!shouldCompress && <span>Previous</span>}
                </Button>

                {/* Center: Navigation Sheet */}
                <NavigationSheet currentQuestion={questionNumber} />

                {/* Right: Explanation, Check, Next */}
                <div className="flex gap-2 shrink-0">
                  <ExplanationWindow 
                    onSplitScreenChange={handleSplitScreenChange}
                    splitPosition={splitPosition}
                  />
                  <Button 
                    onClick={handleCheck}
                    disabled={checked && checkButtonVariant === "success"}
                    variant={checkButtonVariant === "destructive" ? "destructive" : checkButtonVariant === "success" ? "default" : "default"}
                    className={checkButtonVariant === "success" ? "bg-green-600 hover:bg-green-700" : ""}
                    size={shouldCompress ? "sm" : "default"}
                  >
                    <Check className={shouldCompress ? "h-4 w-4" : "mr-1 h-4 w-4"} />
                    {!shouldCompress && <span>Check</span>}
                  </Button>
                  <Button
                    onClick={handleNext}
                    disabled={questionNumber === 100}
                    size={shouldCompress ? "sm" : "default"}
                  >
                    {!shouldCompress && <span>Next</span>}
                    <ChevronRight className={shouldCompress ? "h-4 w-4" : "ml-1 h-4 w-4"} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default Question;
