import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { cn, normalizePublicAssetPath } from "@/lib/utils";
import { renderMixedContent } from "@/lib/mathRendering";
import { Button } from "@/components/ui/button";
import { TransparentAwareImage } from "@/components/TransparentAwareImage";
import "katex/dist/katex.min.css";

interface Choice {
  id: string;
  text?: string;
  image?: string;
}

interface MultipleChoiceQuestionProps {
  choices: Choice[];
  selectedAnswer?: string;
  onAnswerChange?: (answer: string) => void;
  onCheck?: (overrideAnswer?: string) => void;
  strikeoutMode?: boolean;
  checkedAnswers?: Record<string, boolean>;
  questionId: number | string;
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
  const hasCorrectAnswerLocked = Object.values(checkedAnswers).some((isCorrect) => isCorrect === true);

  // Reset strikeouts immediately when the question changes to avoid flash of old state
  useLayoutEffect(() => {
    setStruckOut(new Set());
  }, [questionId]);

  useEffect(() => {
    // Render mixed content (HTML text + KaTeX math) for each choice
    choices.forEach((choice) => {
      if (!choice.text) return;
      const element = choiceRefs.current[choice.id];
      if (element) {
        const renderedHtml = renderMixedContent(choice.text);
        element.innerHTML = `<span style="font-family: 'Noto Serif', serif; font-size: 1.1rem; line-height: 1.6; display: inline-block; max-width: 100%;">${renderedHtml}</span>`;
      }
    });
  }, [choices, questionId]);

  const renderChoiceContent = (choice: Choice, dimmed = false) => {
    const hasText = Boolean(choice.text);
    const hasImage = Boolean(choice.image);

    return (
      <div className={hasImage && !hasText ? "" : "flex flex-col gap-2"}>
        {hasText && (
          <span 
            ref={(el) => choiceRefs.current[choice.id] = el}
            className={cn("choice-content break-words", dimmed && "text-muted-foreground/50")}
          />
        )}
        {hasImage && (
          <div className="w-full -mx-1 flex justify-center">
            <TransparentAwareImage
              src={normalizePublicAssetPath(choice.image)}
              alt={`SAT question ${questionId} choice ${choice.id} image`}
              className={cn(
                "w-auto max-w-full h-auto max-h-[220px] sm:max-h-[260px] rounded-[10px] object-contain block",
                dimmed && "opacity-60"
              )}
              wrapperClassName="max-w-full"
              loading="lazy"
              trimWhitespace
            />
          </div>
        )}
      </div>
    );
  };

  const toggleStrikeout = (choiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isCurrentlySelected = selectedAnswer === choiceId;
    
    setStruckOut(prev => {
      const newSet = new Set(prev);
      if (newSet.has(choiceId)) {
        newSet.delete(choiceId);
      } else {
        newSet.add(choiceId);
        if (isCurrentlySelected && onAnswerChange) {
          onAnswerChange("");
        }
      }
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
        const hasImage = Boolean(choice.image);
        
        if (isStruckOut) {
          return (
            <div key={choice.id} className={cn("relative flex items-center gap-2", strikeoutMode && "pr-14")}>
              <div 
                className={cn(
                  "flex-1 flex gap-3 rounded-xl border-2 border-border bg-muted/30 p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                  hasImage ? "items-start" : "items-center"
                )}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setStruckOut(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(choice.id);
                    return newSet;
                  });
                  if (onAnswerChange) {
                    onAnswerChange(choice.id);
                  }
                }}
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center font-semibold text-sm text-muted-foreground/50">
                  {choice.id}
                </div>
                
                <div className="flex-1 relative overflow-wrap-anywhere">
                  {renderChoiceContent(choice, true)}
                </div>
              </div>
              <div className={cn(
                "absolute top-1/2 h-[2px] bg-muted-foreground/40 -translate-y-1/2 pointer-events-none",
                strikeoutMode ? "left-[-8px] right-[48px]" : "left-[-8px] right-[-8px]"
              )} />
              
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
        
        const isLocked = wasChecked || hasCorrectAnswerLocked;
        
        return (
          <div key={choice.id} className={cn("relative flex items-center gap-2", strikeoutMode && "pr-14")}>
            <div
              className={cn(
                "group flex-1 flex gap-3 rounded-xl border-2 border-border p-4 transition-colors",
                hasImage ? "items-start" : "items-center",
                !isLocked && "hover:bg-muted/50 cursor-pointer",
                isLocked && "cursor-not-allowed opacity-80",
                isSelected && !showCorrect && !showIncorrect && "border-primary bg-primary/5",
                showCorrect && "border-[#1B5E20] bg-[#C8E6C9]/20 dark:border-[#2E7D32] dark:bg-[#1B5E20]/20",
                showIncorrect && "border-[#B71C1C] bg-[#FFCDD2]/20 dark:border-[#8B0000] dark:bg-[#5C1010]/20"
              )}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isLocked) return;
                if (onAnswerChange) {
                  onAnswerChange(isSelected ? "" : choice.id);
                }
              }}
            >
              <div
                className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center font-semibold text-sm transition-colors",
                  showCorrect 
                    ? "bg-[#1B5E20] border-[#1B5E20] text-white dark:bg-[#2E7D32] dark:border-[#2E7D32]"
                    : showIncorrect
                    ? "bg-[#B71C1C] border-[#B71C1C] text-white dark:bg-[#8B0000] dark:border-[#8B0000]"
                    : isSelected 
                    ? "bg-primary border-primary text-primary-foreground" 
                    : "border-muted-foreground/50 text-foreground"
                )}
              >
                {choice.id}
              </div>
              
              <div className="flex-1 break-words overflow-wrap-anywhere">
                {renderChoiceContent(choice)}
              </div>
              
              {onCheck && !wasChecked && !hasCorrectAnswerLocked && (
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    "ml-2 px-4 transition-opacity",
                    isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCheck(choice.id);
                  }}
                >
                  Check
                </Button>
              )}
            </div>
            
            {strikeoutMode && (
              <button
                className="absolute right-0 top-1/2 -translate-y-1/2 flex-shrink-0 w-8 h-8 flex items-center justify-center transition-colors hover:opacity-70"
                onClick={(e) => toggleStrikeout(choice.id, e)}
                title="Strike out this choice"
              >
                <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/50 flex items-center justify-center font-semibold text-sm text-muted-foreground">
                  {choice.id}
                </div>
                <div className="absolute top-1/2 -left-1 -right-1 h-[2px] bg-muted-foreground/50 -translate-y-1/2" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};
