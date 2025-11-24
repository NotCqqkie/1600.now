import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import { MapPin, Square, Bookmark } from "lucide-react";

interface NavigationSheetProps {
  currentQuestion: number;
}

export const NavigationSheet = ({ currentQuestion }: NavigationSheetProps) => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="lg">
          Question {currentQuestion}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[60vh]">
        <SheetHeader>
          <SheetTitle>Question Navigator</SheetTitle>
        </SheetHeader>
        
        {/* Legend */}
        <div className="flex gap-6 items-center justify-center py-4 border-b mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            <span className="text-sm">Current</span>
          </div>
          <div className="flex items-center gap-2">
            <Square className="h-5 w-5" />
            <span className="text-sm">Unanswered</span>
          </div>
          <div className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 fill-destructive text-destructive" />
            <span className="text-sm">For Review</span>
          </div>
        </div>

        {/* Question Grid */}
        <div className="grid grid-cols-10 gap-2 overflow-auto max-h-[60vh]">
          {Array.from({ length: 100 }, (_, i) => i + 1).map((num) => (
            <NavLink
              key={num}
              to={`/question/${num}`}
              className="h-12 flex items-center justify-center rounded-md border-2 border-border bg-background hover:bg-muted transition-colors text-sm font-medium relative"
              activeClassName="border-primary border-2"
            >
              {num === currentQuestion && (
                <MapPin className="absolute -top-2 -left-2 h-5 w-5 fill-foreground" />
              )}
              {num}
            </NavLink>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};
