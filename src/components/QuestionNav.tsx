import { NavLink } from "@/components/NavLink";
import { ScrollArea } from "@/components/ui/scroll-area";

export const QuestionNav = ({ currentQuestion }: { currentQuestion: number }) => {
  return (
    <div className="border-t border-border bg-card">
      <ScrollArea className="w-full">
        <div className="flex gap-2 p-4">
          {Array.from({ length: 100 }, (_, i) => i + 1).map((num) => (
            <NavLink
              key={num}
              to={`/question/${num}`}
              className="min-w-[40px] h-10 flex items-center justify-center rounded-md border border-border bg-background hover:bg-muted transition-colors text-sm font-medium"
              activeClassName="bg-primary text-primary-foreground border-primary hover:bg-primary"
            >
              {num}
            </NavLink>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
