import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Youtube } from "lucide-react";
import { DraggableWindow } from "./DraggableWindow";
import { renderMixedContent } from "@/lib/utils";

interface ExplanationWindowProps {
  videoUrl?: string;
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
  questionId
}: ExplanationWindowProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);

  useEffect(() => {
    setIsAnswerRevealed(false);
  }, [questionId, correctAnswer]);

  const handleToggle = () => {
    if (!isOpen && onFocus) {
      onFocus(); // Bring to front when opening
    }
    // Keep split-screen state in sync when toggling from a sidebarred state
    if (isOpen && isSidebarred && onSplitScreenChange) {
      onSplitScreenChange(false, windowId);
    }
    setIsOpen(!isOpen);
  };

  const renderRationale = () => {
    if (!rationale) return null;
    return (
      <div className="flex flex-col gap-2">
        <div className="font-bold text-lg">Rationale</div>
        <div 
          className="pl-4 border-l-2 border-primary/50 text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: renderMixedContent(rationale) }}
        />
      </div>
    );
  };

  const getAnswerContent = () => {
    if (!correctAnswer) return null;

    if (questionType === "multiple-choice") {
      const choice = choices?.find(c => c.id === correctAnswer);
      const content = choice?.text || (choice?.image ? `<img src="${choice.image}" alt="Answer Image" class="max-w-full h-auto" />` : "");
      
      return (
        <div className="flex flex-col gap-2">
          <div className="font-bold text-lg">Correct Answer: {correctAnswer}</div>
          {content && (
            <div 
              className="pl-4 border-l-2 border-primary/50 text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: renderMixedContent(content) }}
            />
          )}
        </div>
      );
    } else {
      return (
        <div className="flex flex-col gap-2">
          <div className="font-bold text-lg">Correct Answer:</div>
          <div className="pl-4 border-l-2 border-primary/50 text-muted-foreground text-lg">
             {correctAnswer}
          </div>
        </div>
      );
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleToggle} className="h-10">
        <Youtube className={compressed ? "h-4 w-4" : "mr-2 h-4 w-4"} />
        {!compressed && "Explanation"}
      </Button>
      <DraggableWindow
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Explanation"
        defaultWidth={700}
        defaultHeight={440}
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
        <div className="w-full h-full flex flex-col overflow-y-auto">
          {/* Answer Section Removed Temporarily */}
          
          <div className="flex-1 w-full flex items-center justify-center bg-muted min-h-[300px]">
            <p className="text-muted-foreground">Explanation coming soon.</p>
          </div>
        </div>
      </DraggableWindow>
    </>
  );
};
