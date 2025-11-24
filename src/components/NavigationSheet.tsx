import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavigationSheetProps {
  currentQuestion: number;
}

// Status types: 'unanswered' | 'correct-first' | 'correct-later' | 'incorrect'
const getQuestionStatus = (questionNum: number): string => {
  const status = localStorage.getItem(`question-${questionNum}-status`);
  return status || 'unanswered';
};

const isQuestionFlagged = (questionNum: number): boolean => {
  return localStorage.getItem(`question-${questionNum}-flagged`) === 'true';
};

export const NavigationSheet = ({ currentQuestion }: NavigationSheetProps) => {
  const navigate = useNavigate();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'correct-first':
        return 'bg-green-500 hover:bg-green-600 border-green-600';
      case 'correct-later':
        return 'bg-yellow-500 hover:bg-yellow-600 border-yellow-600';
      case 'incorrect':
        return 'bg-red-500 hover:bg-red-600 border-red-600';
      default:
        return 'bg-background hover:bg-muted border-border';
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          Question {currentQuestion}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-auto max-h-[400px]">
        <SheetHeader className="pb-3">
          <SheetTitle className="text-lg">Question Navigator</SheetTitle>
        </SheetHeader>
        
        {/* Color Key */}
        <div className="flex flex-wrap gap-3 items-center justify-center py-2 border-b mb-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 bg-green-500 rounded border border-green-600" />
            <span>Correct (1st)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 bg-yellow-500 rounded border border-yellow-600" />
            <span>Correct (Later)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 bg-red-500 rounded border border-red-600" />
            <span>Incorrect</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 bg-background rounded border-2 border-border" />
            <span>Unanswered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Flag className="h-4 w-4 fill-destructive text-destructive" />
            <span>Flagged</span>
          </div>
        </div>

        {/* Question Grid - Compact */}
        <div className="grid grid-cols-10 gap-1.5 overflow-auto max-h-[250px] pb-2">
          {Array.from({ length: 100 }, (_, i) => i + 1).map((num) => {
            const status = getQuestionStatus(num);
            const isFlagged = isQuestionFlagged(num);
            const isCurrent = num === currentQuestion;

            return (
              <button
                key={num}
                onClick={() => navigate(`/question/${num}`)}
                className={cn(
                  "h-9 flex items-center justify-center rounded border-2 transition-colors text-xs font-medium relative",
                  getStatusColor(status),
                  isCurrent && "ring-2 ring-primary ring-offset-2"
                )}
              >
                {isFlagged && (
                  <Flag className="absolute -top-1 -right-1 h-3 w-3 fill-destructive text-destructive" />
                )}
                <span className={status !== 'unanswered' ? 'text-white' : ''}>{num}</span>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};
