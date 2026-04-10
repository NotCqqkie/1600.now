import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Bookmark, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

interface NavigationSheetProps {
  currentQuestion: number;
  isSplitScreenActive?: boolean;
  splitPosition?: number;
}

// Status types: 'unanswered' | 'correct-first' | 'correct-later' | 'incorrect'
const getQuestionStatus = (questionNum: number): string => {
  const status = localStorage.getItem(`question-${questionNum}-status`);
  return status || 'unanswered';
};
const isQuestionFlagged = (questionNum: number): boolean => {
  return localStorage.getItem(`question-${questionNum}-flagged`) === 'true';
};
export const NavigationSheet = ({
  currentQuestion,
  isSplitScreenActive = false,
  splitPosition = 50
}: NavigationSheetProps) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  
  // Calculate horizontal center position based on splitscreen state
  const getCenterStyle = () => {
    if (isSplitScreenActive) {
      // Center within the question area (left side of split)
      const leftPercent = splitPosition / 2;
      return {
        left: `${leftPercent}%`,
        transform: 'translateX(-50%)'
      };
    }
    // Default: center of page
    return {
      left: '50%',
      transform: 'translateX(-50%)'
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'correct-first':
        return 'bg-[#C8E6C9] hover:bg-[#A5D6A7] border-[#1B5E20] dark:bg-[#1B5E20] dark:hover:bg-[#144216] dark:border-[#2E7D32]';
      case 'correct-later':
        return 'bg-[#FFE0B2] hover:bg-[#FFCC80] border-[#E65100] dark:bg-[#5F2A00] dark:hover:bg-[#4C2100] dark:border-[#C75C00]';
      case 'incorrect':
        return 'bg-[#FFCDD2] hover:bg-[#EF9A9A] border-[#B71C1C] dark:bg-[#5C1010] dark:hover:bg-[#4A0D0D] dark:border-[#8B0000]';
      default:
        return 'bg-background hover:bg-muted border-border';
    }
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    gridRef.current?.scrollTo({ top: 0 });
  }, [isOpen]);
  return <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(!isOpen)}>
        Question {currentQuestion}
      </Button>

      {/* Overlay - rendered in a portal so nav container transforms/overflow can't clip it */}
      {isOpen && typeof document !== "undefined" && createPortal(<div 
        className="fixed bottom-20 z-30 bg-card border-2 border-border rounded-xl shadow-xl p-4 max-w-[520px] max-h-[50vh] overflow-hidden"
        style={{
          ...getCenterStyle(),
          width: isSplitScreenActive ? `min(90vw, ${splitPosition - 5}%)` : '90vw'
        }}
      >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b mb-3">
            <h3 className="text-lg font-semibold">Question Navigator</h3>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Color Key */}
          <div className="flex flex-wrap gap-3 items-center justify-center py-2 border-b mb-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-[#C8E6C9] dark:bg-[#1B5E20] rounded border border-[#1B5E20] dark:border-[#2E7D32]" />
              <span>Correct </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-[#FFE0B2] dark:bg-[#5F2A00] rounded border border-[#E65100] dark:border-[#C75C00]" />
              <span>Correct (after attempts)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-[#FFCDD2] dark:bg-[#5C1010] rounded border border-[#B71C1C] dark:border-[#8B0000]" />
              <span>Incorrect</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-background rounded border-2 border-border" />
              <span>Unanswered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Bookmark className="h-4 w-4 bookmark-flag" />
              <span>Marked for Review</span>
            </div>
          </div>

          {/* Question Grid - Compact */}
          <div
            ref={gridRef}
            className="grid grid-cols-10 gap-2 overflow-auto max-h-[calc(50vh-150px)] p-2"
          >
            {Array.from({
          length: 100
        }, (_, i) => i + 1).map(num => {
          const status = getQuestionStatus(num);
          const isFlagged = isQuestionFlagged(num);
          const isCurrent = num === currentQuestion;
          return <button key={num} onClick={() => {
            navigate(`/hard/${num}`);
            setIsOpen(false);
          }} className={cn("h-9 min-w-[2.75rem] px-1.5 flex items-center justify-center rounded border-2 transition-colors text-[11px] font-medium tabular-nums relative", getStatusColor(status), isCurrent && "ring-2 ring-primary ring-offset-1")}>
                  {isFlagged && (
                    <Bookmark className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 bookmark-flag" />
                  )}
                  <span className="text-foreground dark:text-white">{num}</span>
                </button>;
        })}
          </div>
        </div>, document.body)}
    </>;
};
