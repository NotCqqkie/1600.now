import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { cn, normalizePublicAssetPath } from "@/lib/utils";
import { renderMixedContent } from "@/lib/text/mathRendering";
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
  subject?: "math" | "reading";
  struckOutChoiceIds?: string[];
  onStruckOutChange?: (choiceIds: string[]) => void;
}

export const MultipleChoiceQuestion = ({ 
  choices, 
  selectedAnswer,
  onAnswerChange,
  onCheck,
  strikeoutMode = false,
  checkedAnswers = {},
  questionId,
  subject = "math",
  struckOutChoiceIds,
  onStruckOutChange,
}: MultipleChoiceQuestionProps) => {
  const [internalStruckOut, setInternalStruckOut] = useState<Set<string>>(new Set());
  const choiceRefs = useRef<{ [key: string]: HTMLSpanElement | null }>({});
  const hasCorrectAnswerLocked = Object.values(checkedAnswers).some((isCorrect) => isCorrect === true);
  const struckOut = struckOutChoiceIds
    ? new Set(struckOutChoiceIds)
    : internalStruckOut;
  const updateStruckOut = (next: Set<string>) => {
    if (onStruckOutChange) {
      onStruckOutChange([...next]);
      return;
    }
    setInternalStruckOut(next);
  };

  // Reset strikeouts immediately when the question changes to avoid flash of old state
  useLayoutEffect(() => {
    if (!onStruckOutChange) {
      setInternalStruckOut(new Set());
    }
  }, [onStruckOutChange, questionId]);

  useEffect(() => {
    // Render mixed content (HTML text + KaTeX math) for each choice
    choices.forEach((choice) => {
      if (!choice.text) return;
      const element = choiceRefs.current[choice.id];
      if (element) {
        const renderedHtml = renderMixedContent(choice.text, {
          normalizeMath: subject === "math",
        });
        element.innerHTML = `<span style="line-height: 1.54; display: inline-block; max-width: 100%;">${renderedHtml}</span>`;
      }
    });
  }, [choices, questionId, subject]);

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
                "w-auto max-w-full h-auto max-h-[220px] sm:max-h-[260px] object-contain block",
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
    
    const newSet = new Set(struckOut);
    if (newSet.has(choiceId)) {
      newSet.delete(choiceId);
    } else {
      newSet.add(choiceId);
      if (isCurrentlySelected && onAnswerChange) {
        onAnswerChange("");
      }
    }
    updateStruckOut(newSet);
  };

  return (
    <div className="space-y-2 sm:space-y-3">
      {choices.map((choice) => {
        const isSelected = selectedAnswer === choice.id;
        const isStruckOut = struckOut.has(choice.id);
        const wasChecked = checkedAnswers[choice.id] !== undefined;
        const showCorrect = wasChecked && checkedAnswers[choice.id] === true;
        const showIncorrect = wasChecked && checkedAnswers[choice.id] === false;
        const hasImage = Boolean(choice.image);
        const shouldReserveInlineCheck = Boolean(onCheck) && !hasCorrectAnswerLocked;
        const canInlineCheck = shouldReserveInlineCheck && !wasChecked;
        
        if (isStruckOut) {
          return (
            <div key={choice.id} className={cn("relative flex min-w-0 items-center gap-2", strikeoutMode && "pr-14")}>
              <div
                className={cn(
                  "flex min-w-0 flex-1 gap-3 rounded-xl border-2 border-border bg-muted/30 p-3 sm:p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                  hasImage ? "items-start" : "items-center"
                )}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const newSet = new Set(struckOut);
                  newSet.delete(choice.id);
                  updateStruckOut(newSet);
                  if (onAnswerChange) {
                    onAnswerChange(choice.id);
                  }
                }}
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center font-semibold text-sm text-muted-foreground/50">
                  {choice.id}
                </div>
                
                <div className="relative min-w-0 flex-1 overflow-wrap-anywhere">
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
          <div key={choice.id} className={cn("relative flex min-w-0 items-center gap-2", strikeoutMode && "pr-14")}>
            <div
              className={cn(
                "group relative flex min-w-0 flex-1 gap-3 rounded-xl border-2 border-border p-3 sm:p-4 transition-colors",
                shouldReserveInlineCheck && "md:pr-28",
                hasImage ? "items-start" : "items-center",
                !isLocked && "hover:bg-muted/50 cursor-pointer",
                isLocked && "cursor-not-allowed opacity-80",
                isSelected && !showCorrect && !showIncorrect && "border-primary bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/15",
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
              
              <div className="min-w-0 flex-1 break-words overflow-wrap-anywhere">
                {renderChoiceContent(choice)}
              </div>

              {canInlineCheck && (
                <div
                  className={cn(
                    "pointer-events-none absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 md:flex",
                    isSelected
                      ? "opacity-100"
                      : "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
                  )}
                >
                  <Button
                    size="sm"
                    variant="outline"
                    className="pointer-events-auto px-4"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCheck(choice.id);
                    }}
                  >
                    Check
                  </Button>
                </div>
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
