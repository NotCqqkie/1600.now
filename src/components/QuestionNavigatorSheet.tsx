import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bookmark, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface QuestionNavigatorItem {
  key: string | number;
  label: string | number;
  status: string;
  isFlagged: boolean;
  isCurrent: boolean;
  onSelect: () => void;
  title?: string;
}

interface QuestionNavigatorSheetProps {
  buttonLabel: string;
  title?: string;
  subtitle?: string;
  items: QuestionNavigatorItem[];
  isSplitScreenActive?: boolean;
  splitPosition?: number;
  headerActions?: ReactNode;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "correct-first":
      return "bg-[#C8E6C9] border-[#1B5E20] dark:bg-[#1B5E20] dark:border-[#2E7D32]";
    case "correct-later":
      return "bg-[#FFE0B2] border-[#E65100] dark:bg-[#5F2A00] dark:border-[#C75C00]";
    case "incorrect":
      return "bg-[#FFCDD2] border-[#B71C1C] dark:bg-[#5C1010] dark:border-[#8B0000]";
    default:
      return "bg-background border-border";
  }
};

export const QuestionNavigatorSheet = ({
  buttonLabel,
  title = "Question Navigator",
  subtitle,
  items,
  isSplitScreenActive = false,
  splitPosition = 50,
  headerActions,
}: QuestionNavigatorSheetProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    gridRef.current?.scrollTo({ top: 0 });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

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

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen((prev) => !prev)}>
        {buttonLabel}
      </Button>

      {isOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed bottom-20 z-30 w-[min(90vw,520px)] max-h-[55vh] overflow-hidden rounded-xl border-2 border-border bg-card p-4 shadow-xl"
          style={getCenterStyle()}
        >
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="text-lg font-semibold">{title}</h3>
              {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              {headerActions}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-center gap-3 border-b py-2 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded border border-[#1B5E20] bg-[#C8E6C9] dark:border-[#2E7D32] dark:bg-[#1B5E20]" />
              <span>Correct</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded border border-[#E65100] bg-[#FFE0B2] dark:border-[#C75C00] dark:bg-[#5F2A00]" />
              <span>Correct (after attempts)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded border border-[#B71C1C] bg-[#FFCDD2] dark:border-[#8B0000] dark:bg-[#5C1010]" />
              <span>Incorrect</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded border-2 border-border bg-background" />
              <span>Unanswered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Bookmark className="h-4 w-4 bookmark-flag" />
              <span>Marked for Review</span>
            </div>
          </div>

          <div
            ref={gridRef}
            className="overflow-y-auto overflow-x-hidden max-h-[calc(55vh-180px)] p-1"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(2.5rem, 1fr))", gap: "0.5rem" }}
          >
            {items.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  item.onSelect();
                  setIsOpen(false);
                }}
                title={item.title}
                className={cn(
                  "relative flex h-9 w-full items-center justify-center rounded border-2 text-[11px] font-medium tabular-nums transition-colors",
                  getStatusColor(item.status),
                  item.isCurrent && "ring-2 ring-primary ring-offset-1"
                )}
              >
                {item.isFlagged ? (
                  <Bookmark className="absolute -right-1.5 -top-1.5 h-3.5 w-3.5 bookmark-flag" />
                ) : null}
                <span className="text-foreground dark:text-white">{item.label}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
