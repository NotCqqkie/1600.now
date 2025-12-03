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
}

export const MultipleChoiceQuestion = ({ 
  choices, 
  selectedAnswer,
  onAnswerChange,
  onCheck,
  strikeoutMode = false
}: MultipleChoiceQuestionProps) => {
  const [struckOut, setStruckOut] = useState<Set<string>>(new Set());
  const choiceRefs = useRef<{ [key: string]: HTMLSpanElement | null }>({});

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
    setStruckOut(prev => {
      const newSet = new Set(prev);
      if (newSet.has(choiceId)) {
        newSet.delete(choiceId);
      } else {
        newSet.add(choiceId);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-3">
      {choices.map((choice) => {
        const isSelected = selectedAnswer === choice.id;
        const isStruckOut = struckOut.has(choice.id);
        
        return (
          <div key={choice.id} className="flex items-center gap-2">
            {/* Main choice card */}
            <div
              className={cn(
                "flex-1 flex items-center gap-3 rounded-xl border-2 border-border p-4 hover:bg-muted/50 transition-colors cursor-pointer",
                isSelected && "border-primary bg-primary/5"
              )}
              onClick={() => {
                if (!strikeoutMode) {
                  onAnswerChange?.(choice.id);
                }
              }}
            >
              {/* Circle with letter */}
              <div
                className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center font-semibold text-sm transition-colors",
                  isSelected 
                    ? "bg-primary border-primary text-primary-foreground" 
                    : "border-muted-foreground/50 text-foreground"
                )}
              >
                {choice.id}
              </div>
              
              {/* Choice text */}
              <div 
                className={cn(
                  "flex-1 break-words overflow-wrap-anywhere",
                  isStruckOut && "line-through text-muted-foreground"
                )}
              >
                <span 
                  ref={(el) => choiceRefs.current[choice.id] = el}
                  className="choice-content break-words"
                />
              </div>
              
              {/* Check button - only shows on selected choice */}
              {isSelected && onCheck && (
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
            
            {/* Strikethrough button on the right */}
            <button
              className={cn(
                "flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors hover:bg-muted/50",
                isStruckOut 
                  ? "border-primary text-primary" 
                  : "border-muted-foreground/30 text-muted-foreground"
              )}
              onClick={(e) => toggleStrikeout(choice.id, e)}
              title="Strike out this choice"
            >
              <div className="relative w-5 h-5 flex items-center justify-center">
                <span className="text-xs font-semibold">{choice.id}</span>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={cn(
                    "w-full h-0.5 bg-current rotate-[-45deg]",
                    isStruckOut ? "bg-primary" : "bg-muted-foreground"
                  )} />
                </div>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
};
