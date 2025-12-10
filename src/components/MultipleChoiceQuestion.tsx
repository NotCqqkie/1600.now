import { useState, useEffect, useRef } from "react";
import { cn, renderMixedContent } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import "katex/dist/katex.min.css";

interface Choice {
  id: string;
  text: string;
}

interface MultipleChoiceQuestionProps {
  choices: Choice[];
  selectedAnswer?: string;
  onAnswerChange?: (answer: string) => void;
  onCheck?: () => void;
  strikeoutMode?: boolean;
  checkedAnswers?: Record<string, boolean>;
  questionId: number;
}

export const MultipleChoiceQuestion = ({ 
  choices, 
  selectedAnswer,
  onAnswerChange,
  onCheck,
  strikeoutMode = false,
  checkedAnswers = {},
  questionId
}: MultipleChoiceQuestionProps) => {
  const [struckOut, setStruckOut] = useState<Set<string>>(new Set());
  const choiceRefs = useRef<{ [key: string]: HTMLSpanElement | null }>({});

  // Load strikeouts from localStorage on mount and when questionId changes
  useEffect(() => {
    const saved = localStorage.getItem(`question-${questionId}-strikeouts`);
    if (saved) {
      setStruckOut(new Set(JSON.parse(saved)));
    } else {
      setStruckOut(new Set());
    }
  }, [questionId]);

  useEffect(() => {
    // Render mixed content (HTML text + KaTeX math) for each choice
    choices.forEach((choice) => {
      const element = choiceRefs.current[choice.id];
      if (element) {
        const renderedHtml = renderMixedContent(choice.text);
        element.innerHTML = `<span style="font-size:clamp(12px, 2.2vw, 22px); display: inline-block; max-width: 100%;">${renderedHtml}</span>`;
      }
    });
  }, [choices]);

  const toggleStrikeout = (choiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isCurrentlySelected = selectedAnswer === choiceId;
    
    setStruckOut(prev => {
      const newSet = new Set(prev);
      if (newSet.has(choiceId)) {
        newSet.delete(choiceId);
      } else {
        newSet.add(choiceId);
        // If striking out the selected answer, unselect it
        if (isCurrentlySelected && onAnswerChange) {
          onAnswerChange("");
        }
      }
      // Save to localStorage
      localStorage.setItem(`question-${questionId}-strikeouts`, JSON.stringify([...newSet]));
      return newSet;
    });
  };

  return (
    <div className="space-y-3">
      {choices.map((choice) => {
        const isSelected = selectedAnswer === choice.id;
        const isStruckOut = struckOut.has(choice.id);
        const wasChecked = checkedAnswers[choice.id] !== undefined;
        const showCorrect = wasChecked && checkedAnswers[choice.id] === true;
        const showIncorrect = wasChecked && checkedAnswers[choice.id] === false;
        
        // If struck out, show the strikethrough view
        if (isStruckOut) {
          return (
            <div key={choice.id} className={cn("relative flex items-center gap-3", strikeoutMode && "pr-14")}>
              {/* Main choice card - clickable to unstrikeout and select */}
              <div 
                className="flex-1 flex items-center gap-3 rounded-xl border-2 border-border bg-muted/30 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Unstrikeout
                  setStruckOut(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(choice.id);
                    localStorage.setItem(`question-${questionId}-strikeouts`, JSON.stringify([...newSet]));
                    return newSet;
                  });
                  // Select the answer
                  if (onAnswerChange) {
                    onAnswerChange(choice.id);
                  }
                }}
              >
                {/* Circle with letter - dimmed */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center font-semibold text-sm text-muted-foreground/50">
                  {choice.id}
                </div>
                
                {/* Choice text with line through entire row */}
                <div className="flex-1 relative">
                  <span 
                    ref={(el) => choiceRefs.current[choice.id] = el}
                    className="choice-content break-words text-muted-foreground/50"
                  />
                </div>
              </div>
              {/* Full-width strikethrough line - extends equally beyond both edges of the box */}
              <div className={cn(
                "absolute top-1/2 h-[2px] bg-muted-foreground/40 -translate-y-1/2 pointer-events-none",
                strikeoutMode ? "left-[-8px] right-[48px]" : "left-[-8px] right-[-8px]"
              )} />
              
              {/* Undo button - only shows when strikeout mode is active */}
              {strikeoutMode && (
                <button
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-foreground underline font-medium text-sm hover:text-primary transition-colors shrink-0"
                  onClick={(e) => toggleStrikeout(choice.id, e)}
                >
                  Undo
                </button>
              )}
            </div>
          );
        }
        
        // If already checked, don't allow selection
        const isLocked = wasChecked;
        
        return (
          <div key={choice.id} className={cn("relative flex items-center gap-2", strikeoutMode && "pr-14")}>
            {/* Main choice card */}
            <div
              className={cn(
                "flex-1 flex items-center gap-3 rounded-xl border-2 border-border p-4 transition-colors",
                !isLocked && "hover:bg-muted/50 cursor-pointer",
                isLocked && "cursor-not-allowed opacity-80",
                isSelected && !showCorrect && !showIncorrect && "border-primary bg-primary/5",
                showCorrect && "border-green-500 bg-green-500/10",
                showIncorrect && "border-destructive bg-destructive/10"
              )}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Don't allow selection if already checked
                if (isLocked) return;
                if (onAnswerChange) {
                  onAnswerChange(choice.id);
                }
              }}
            >
              {/* Circle with letter */}
              <div
                className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center font-semibold text-sm transition-colors",
                  showCorrect 
                    ? "bg-green-500 border-green-500 text-white"
                    : showIncorrect
                    ? "bg-destructive border-destructive text-white"
                    : isSelected 
                    ? "bg-primary border-primary text-primary-foreground" 
                    : "border-muted-foreground/50 text-foreground"
                )}
              >
                {choice.id}
              </div>
              
              {/* Choice text */}
              <div className="flex-1 break-words overflow-wrap-anywhere">
                <span 
                  ref={(el) => choiceRefs.current[choice.id] = el}
                  className="choice-content break-words"
                />
              </div>
              
              {/* Check button - only shows on selected choice when not already checked */}
              {isSelected && onCheck && !wasChecked && (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-2 px-4"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCheck();
                  }}
                >
                  Check
                </Button>
              )}
            </div>
            
            {/* Strikethrough button on the right - only shows when strikeout mode is active */}
            {strikeoutMode && (
              <button
                className="absolute right-0 top-1/2 -translate-y-1/2 flex-shrink-0 w-8 h-8 flex items-center justify-center transition-colors hover:opacity-70"
                onClick={(e) => toggleStrikeout(choice.id, e)}
                title="Strike out this choice"
              >
                {/* Circle with letter */}
                <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/50 flex items-center justify-center font-semibold text-sm text-muted-foreground">
                  {choice.id}
                </div>
                {/* Strikethrough line extending beyond circle - semi-transparent */}
                <div className="absolute top-1/2 -left-1 -right-1 h-[2px] bg-muted-foreground/50 -translate-y-1/2" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};
