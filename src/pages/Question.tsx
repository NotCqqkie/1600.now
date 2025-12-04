import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NavigationSheet } from "@/components/NavigationSheet";
import { FormulaSheetDialog } from "@/components/FormulaSheetDialog";
import { DesmosDialog } from "@/components/DesmosDialog";
import { ExplanationDialog } from "@/components/ExplanationDialog";
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
  const [isSplitScreenActive, setIsSplitScreenActive] = useState(false);
  const [splitPosition, setSplitPosition] = useState(50);
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);

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
    
    // Load saved answer state from localStorage
    const savedAnswer = localStorage.getItem(`question-${questionNumber}-answer`);
    const savedCheckedAnswers = localStorage.getItem(`question-${questionNumber}-checkedAnswers`);
    const savedFlagged = localStorage.getItem(`question-${questionNumber}-flagged`);
    
    if (savedAnswer) {
      if (currentQuestion?.type === 'multiple-choice') {
        setSelectedAnswer(savedAnswer);
      } else {
        setFreeResponseAnswer(savedAnswer);
      }
    } else {
      setSelectedAnswer("");
      setFreeResponseAnswer("");
    }
    
    if (savedCheckedAnswers) {
      const parsed = JSON.parse(savedCheckedAnswers);
      setCheckedAnswers(parsed);
      // Set button variant based on if any answer was correct
      const hasCorrect = Object.values(parsed).some(v => v === true);
      if (hasCorrect) {
        setChecked(true);
        setCheckButtonVariant("success");
      } else if (Object.keys(parsed).length > 0) {
        setChecked(true);
        setCheckButtonVariant("destructive");
      } else {
        setChecked(false);
        setCheckButtonVariant("default");
      }
    } else {
      setCheckedAnswers({});
      setChecked(false);
      setCheckButtonVariant("default");
    }
    
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
          className="fixed top-0 bottom-0 w-1 bg-border hover:bg-primary/50 cursor-col-resize z-50 transition-colors"
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
                onSplitScreenChange={setIsSplitScreenActive}
                splitPosition={splitPosition}
              />
              <DesmosDialog 
                onSplitScreenChange={setIsSplitScreenActive}
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
              className={markedForReview ? "text-destructive" : ""}
            >
              <Bookmark className={markedForReview ? "fill-current" : ""} />
              Mark for Review
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
        className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-border shadow-lg z-20"
        style={isSplitScreenActive ? { width: `${splitPosition}%` } : undefined}
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center gap-4">
            {/* Left: Previous Button */}
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={questionNumber === 1}
              className="shrink-0"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>

            {/* Center: Navigation Sheet */}
            <NavigationSheet currentQuestion={questionNumber} />

            {/* Right: Explanation, Check, Next */}
            <div className="flex gap-2 shrink-0">
              <ExplanationDialog />
              <Button 
                onClick={handleCheck}
                disabled={checked && checkButtonVariant === "success"}
                variant={checkButtonVariant === "destructive" ? "destructive" : checkButtonVariant === "success" ? "default" : "default"}
                className={checkButtonVariant === "success" ? "bg-green-600 hover:bg-green-700" : ""}
              >
                <Check className="mr-2 h-4 w-4" />
                Check
              </Button>
              <Button
                onClick={handleNext}
                disabled={questionNumber === 100}
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Question;
