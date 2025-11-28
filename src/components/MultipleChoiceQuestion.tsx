import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
                className="break-words"
                dangerouslySetInnerHTML={{ __html: `$$${choice.text}$$` }}
              />
            </Label>
          </div>
        ))}
      </div>
    </RadioGroup>
  );
};
