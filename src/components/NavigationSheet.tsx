import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Bookmark, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
        return 'bg-[#A5D6A7] hover:bg-[#81C784] border-[#66BB6A]';
      case 'correct-later':
        return 'bg-[#FFE0B2] hover:bg-[#FFCC80] border-[#FFB74D]';
      case 'incorrect':
        return 'bg-[#EF9A9A] hover:bg-[#E57373] border-[#EF5350]';
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
  return <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(!isOpen)}>
        Question {currentQuestion}
      </Button>

      {/* Overlay - positioned above bottom nav, centered within question area */}
      {isOpen && <div 
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
              <div className="w-4 h-4 bg-[#A5D6A7] rounded border border-[#66BB6A]" />
              <span>Correct </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-[#FFE0B2] rounded border border-[#FFB74D]" />
              <span>Correct (after attempts)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-[#EF9A9A] rounded border border-[#EF5350]" />
              <span>Incorrect</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-background rounded border-2 border-border" />
              <span>Unanswered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Bookmark className="h-4 w-4 fill-[#FF7043] text-[#FF7043]" />
              <span>Marked for Review</span>
            </div>
          </div>

          {/* Question Grid - Compact */}
          <div className="grid grid-cols-10 gap-2 overflow-auto max-h-[calc(50vh-150px)] p-2">
            {Array.from({
          length: 100
        }, (_, i) => i + 1).map(num => {
          const status = getQuestionStatus(num);
          const isFlagged = isQuestionFlagged(num);
          const isCurrent = num === currentQuestion;
          return <button key={num} onClick={() => {
            navigate(`/question/${num}`);
            setIsOpen(false);
          }} className={cn("h-9 flex items-center justify-center rounded border-2 transition-colors text-xs font-medium relative", getStatusColor(status), isCurrent && "ring-2 ring-primary ring-offset-1")}>
                  {isFlagged && <Bookmark className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 fill-[#FF7043] text-[#FF7043]" />}
                  <span className="text-foreground">{num}</span>
                </button>;
        })}
          </div>
        </div>}
    </>;
};