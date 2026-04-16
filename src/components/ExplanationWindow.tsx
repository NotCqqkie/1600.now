import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Lightbulb } from "lucide-react";
import { DraggableWindow } from "./DraggableWindow";
import { StepByStepExplanation } from "./StepByStepExplanation";

interface ExplanationWindowProps {
  onSplitScreenChange?: (isSplit: boolean, windowId: string) => void;
  onSplitPositionChange?: (newPosition: number) => void;
  splitPosition?: number;
  compressed?: boolean;
  onFocus?: () => void;
  zIndex?: number;
  constrainToLeft?: number;
  isSidebarred?: boolean;
  onSidebarToggle?: (windowId: string, shouldBeSidebarred: boolean) => void;
  windowId?: string;
  correctAnswer?: string | null;
  rationale?: string | null;
  questionType?: "multiple-choice" | "free-response";
  choices?: { id: string; text?: string; image?: string }[];
  questionId?: string | number;
  // Question data for step-by-step explanation
  questionSection?: string;
  questionText?: string;
  questionDomain?: string;
  questionSkill?: string;
  questionDifficulty?: string | null;
  questionImages?: { src: string; alt: string }[];
}

export const ExplanationWindow = ({
  onSplitScreenChange,
  onSplitPositionChange,
  splitPosition = 50,
  compressed = false,
  onFocus,
  zIndex = 50,
  constrainToLeft,
  isSidebarred = false,
  onSidebarToggle,
  windowId = "explanation",
  correctAnswer,
  rationale,
  questionType,
  choices,
  questionId,
  questionSection,
  questionText,
  questionDomain,
  questionSkill,
  questionDifficulty,
  questionImages,
}: ExplanationWindowProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    if (!isOpen) {
      // Opening — always enter sidebar mode immediately (batches with setIsOpen in React 18)
      if (onFocus) onFocus();
      if (onSplitScreenChange) onSplitScreenChange(true, windowId);
      if (onSidebarToggle) onSidebarToggle(windowId, true);
    } else if (isSidebarred) {
      if (onSplitScreenChange) onSplitScreenChange(false, windowId);
    }
    setIsOpen(prev => !prev);
  };

  // Build the question object for the explanation API
  const explanationQuestion = questionText && correctAnswer ? {
    section: questionSection || "Math",
    passage: questionText,
    choices: choices?.map(c => ({ label: c.id, text: c.text || "", image: c.image })),
    correctAnswer: correctAnswer,
    domain: questionDomain,
    skill: questionSkill,
    difficulty: questionDifficulty ?? undefined,
  } : null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleToggle} className="h-10">
        <Lightbulb className={compressed ? "h-4 w-4" : "mr-2 h-4 w-4"} />
        {!compressed && "Explanation"}
      </Button>
      <DraggableWindow
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Explanation"
        defaultWidth={420}
        defaultHeight={500}
        onSplitScreenChange={onSplitScreenChange}
        onSplitPositionChange={onSplitPositionChange}
        splitPosition={splitPosition}
        enableSplitScreen={true}
        diagonalResizeOnly={true}
        lockAspectRatio={true}
        windowId={windowId}
        onFocus={onFocus}
        zIndex={zIndex}
        constrainToLeft={constrainToLeft}
        isSidebarred={isSidebarred}
        onSidebarToggle={onSidebarToggle}
      >
        <div className="w-full h-full flex flex-col overflow-hidden">
          {explanationQuestion ? (
            <StepByStepExplanation
              questionId={String(questionId || "")}
              question={explanationQuestion}
              questionImages={questionImages}
            />
          ) : (
            <div className="flex-1 w-full flex items-center justify-center">
              <p className="text-muted-foreground text-sm">No question data available.</p>
            </div>
          )}
        </div>
      </DraggableWindow>
    </>
  );
};
