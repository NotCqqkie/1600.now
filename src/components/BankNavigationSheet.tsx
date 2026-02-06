import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

interface BankNavigationSheetProps {
  currentQuestion: number;
  totalQuestions: number;
  onJump: (questionNumber: number) => void;
  isSplitScreenActive?: boolean;
  splitPosition?: number;
  storagePrefix: string;
}

const getQuestionStatus = (prefix: string, questionNum: number): string => {
  const status = localStorage.getItem(`${prefix}-${questionNum}-status`);
  return status || "unanswered";
};

const isQuestionFlagged = (prefix: string, questionNum: number): boolean => {
  return localStorage.getItem(`${prefix}-${questionNum}-flagged`) === "true";
};

export const BankNavigationSheet = ({
  currentQuestion,
  totalQuestions,
  onJump,
  isSplitScreenActive = false,
  splitPosition = 50,
  storagePrefix,
}: BankNavigationSheetProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [target, setTarget] = useState(String(currentQuestion));

  useEffect(() => {
    setTarget(String(currentQuestion));
  }, [currentQuestion]);

  const getCenterStyle = () => {
    if (isSplitScreenActive) {
      const leftPercent = splitPosition / 2;
      return {
        left: `${leftPercent}%`,
        transform: "translateX(-50%)",
      };
    }
    return {
      left: "50%",
      transform: "translateX(-50%)",
    };
  };

  const jump = () => {
    const num = parseInt(target, 10);
    if (!Number.isFinite(num)) return;
    if (num < 1 || num > totalQuestions) return;
    onJump(num);
    setIsOpen(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "correct-first":
        return "bg-[#C8E6C9] border-[#1B5E20] dark:bg-[#1B5E20] dark:border-[#2E7D32]";
      case "correct-later":
        return "bg-[#FFE0B2] border-[#E65100] dark:bg-[#E65100] dark:border-[#EF6C00]";
      case "incorrect":
        return "bg-[#FFCDD2] border-[#B71C1C] dark:bg-[#5C1010] dark:border-[#8B0000]";
      default:
        return "bg-background border-border";
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(!isOpen)}>
        Question {currentQuestion}
      </Button>

      {isOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed bottom-20 z-30 bg-card border-2 border-border rounded-xl shadow-xl p-4 w-[min(90vw,520px)] max-h-[55vh] overflow-hidden"
          style={getCenterStyle()}
        >
          <div className="flex items-center justify-between pb-3 border-b mb-3">
            <div>
              <h3 className="text-lg font-semibold">Question Navigator</h3>
              <p className="text-xs text-muted-foreground">Total: {totalQuestions}</p>
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              type="number"
              min={1}
              max={totalQuestions}
              className="w-28"
              aria-label="Jump to question"
            />
            <Button onClick={jump}>Go</Button>
            <Button variant="outline" onClick={() => { setTarget("1"); onJump(1); setIsOpen(false); }}>First</Button>
            <Button variant="outline" onClick={() => { setTarget(String(totalQuestions)); onJump(totalQuestions); setIsOpen(false); }}>Last</Button>
          </div>

          <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-2 overflow-auto max-h-[calc(55vh-160px)] p-1">
            {Array.from({ length: totalQuestions }, (_, i) => i + 1).map((num) => {
              const status = getQuestionStatus(storagePrefix, num);
              const isFlagged = isQuestionFlagged(storagePrefix, num);
              const isCurrent = num === currentQuestion;
              return (
                <button
                  key={num}
                  onClick={() => {
                    onJump(num);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "h-9 flex items-center justify-center rounded border-2 text-xs font-medium relative transition-colors",
                    getStatusColor(status),
                    isCurrent && "ring-2 ring-primary ring-offset-1"
                  )}
                >
                  {isFlagged && <Bookmark className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 bookmark-flag" />}
                  <span className="text-foreground dark:text-white">{num}</span>
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
