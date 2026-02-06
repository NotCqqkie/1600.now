import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Bookmark, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";

interface PracticeSetItem {
  subject: string;
  id: number;
  sourceId: string;
  index: number;
}

interface PracticeNavigationSheetProps {
  currentIndex: number;
  practiceSet: PracticeSetItem[];
  onJump: (index: number) => void;
  isSplitScreenActive?: boolean;
  splitPosition?: number;
  storagePrefix: string;
}

const getQuestionStatus = (prefix: string, questionId: number): string => {
  const status = localStorage.getItem(`${prefix}-${questionId}-status`);
  return status || "unanswered";
};

const isQuestionFlagged = (prefix: string, questionId: number): boolean => {
  return localStorage.getItem(`${prefix}-${questionId}-flagged`) === "true";
};

export const PracticeNavigationSheet = ({
  currentIndex,
  practiceSet,
  onJump,
  isSplitScreenActive = false,
  splitPosition = 50,
  storagePrefix,
}: PracticeNavigationSheetProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

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

  const handleExitPractice = () => {
    sessionStorage.removeItem('practiceSet');
    sessionStorage.removeItem('practiceSetTotal');
    navigate('/bank');
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(!isOpen)}>
        Question {currentIndex + 1} of {practiceSet.length}
      </Button>

      {isOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed bottom-20 z-30 bg-card border-2 border-border rounded-xl shadow-xl p-4 w-[min(90vw,520px)] max-h-[55vh] overflow-hidden"
          style={getCenterStyle()}
        >
          <div className="flex items-center justify-between pb-3 border-b mb-3">
            <div>
              <h3 className="text-lg font-semibold">Practice Set Navigator</h3>
              <p className="text-xs text-muted-foreground">
                {practiceSet.length} questions in this set
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExitPractice} className="gap-1">
                <Home className="h-4 w-4" />
                Exit Practice
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-2 overflow-auto max-h-[calc(55vh-100px)] p-1">
            {practiceSet.map((item, idx) => {
              const prefix = `bank-${item.subject}`;
              const status = getQuestionStatus(prefix, item.id);
              const isFlagged = isQuestionFlagged(prefix, item.id);
              const isCurrent = idx === currentIndex;
              return (
                <button
                  key={`${item.subject}-${item.id}`}
                  onClick={() => {
                    onJump(idx);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "h-9 flex items-center justify-center rounded border-2 text-xs font-medium relative transition-colors",
                    getStatusColor(status),
                    isCurrent && "ring-2 ring-primary ring-offset-1"
                  )}
                  title={`${item.subject === 'math' ? 'Math' : 'Reading'} Q${item.id}`}
                >
                  {isFlagged && <Bookmark className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 bookmark-flag" />}
                  <span className="text-foreground dark:text-white">{idx + 1}</span>
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
