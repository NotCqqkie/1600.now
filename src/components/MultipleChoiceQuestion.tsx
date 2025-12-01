import { useState, useEffect, useRef } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import katex from "katex";
import "katex/dist/katex.min.css";

interface Choice {
  id: string;
  text: string;
}

interface MultipleChoiceQuestionProps {
  choices: Choice[];
  selectedAnswer?: string;
  onAnswerChange?: (answer: string) => void;
  strikeoutMode?: boolean;
}

export const MultipleChoiceQuestion = ({ 
  choices, 
  selectedAnswer,
  onAnswerChange,
  strikeoutMode = false
}: MultipleChoiceQuestionProps) => {
  const [struckOut, setStruckOut] = useState<Set<string>>(new Set());
  const choiceRefs = useRef<{ [key: string]: HTMLSpanElement | null }>({});

  useEffect(() => {
    // Render KaTeX for each choice
    choices.forEach((choice) => {
      const element = choiceRefs.current[choice.id];
      if (element) {
        try {
          const renderedHtml = katex.renderToString(choice.text, {
            displayMode: false,
            throwOnError: false,
            trust: true,
            strict: false
          });
          element.innerHTML = `<span style="font-size:clamp(12px, 2.2vw, 22px); display: inline-block; max-width: 100%;">${renderedHtml}</span>`;
        } catch (error) {
          console.error('KaTeX rendering error:', error);
          element.innerHTML = `<span style="font-size:clamp(12px, 2.2vw, 22px)">${choice.text}</span>`;
        }
      }
    });
  }, [choices]);

  const toggleStrikeout = (choiceId: string) => {
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
    <RadioGroup value={selectedAnswer} onValueChange={onAnswerChange}>
      <div className="space-y-3">
        {choices.map((choice) => (
          <div
            key={choice.id}
            className={cn(
              "flex items-center space-x-3 rounded-lg border-2 border-border p-4 hover:bg-muted/50 transition-colors cursor-pointer",
              selectedAnswer === choice.id && "border-primary bg-primary/5"
            )}
            onClick={(e) => {
              if (strikeoutMode) {
                toggleStrikeout(choice.id);
              } else {
                onAnswerChange?.(choice.id);
              }
            }}
          >
            <RadioGroupItem value={choice.id} id={choice.id} />
            <Label 
              htmlFor={choice.id} 
              className={cn(
                "flex-1 cursor-pointer font-medium break-words overflow-wrap-anywhere",
                struckOut.has(choice.id) && "line-through text-muted-foreground"
              )}
            >
              <span className="font-semibold mr-2">{choice.id})</span>
              <span 
                ref={(el) => choiceRefs.current[choice.id] = el}
                className="break-words"
              />
            </Label>
          </div>
        ))}
      </div>
    </RadioGroup>
  );
};