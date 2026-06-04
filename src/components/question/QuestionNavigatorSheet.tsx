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
  statusMode?: "default" | "answered-unanswered";
}

const getStatusColor = (
  status: string,
  statusMode: "default" | "answered-unanswered",
) => {
  if (statusMode === "answered-unanswered") {
    return status === "answered"
      ? "bg-primary/10 border-primary/40"
      : "bg-background border-border";
  }

  switch (status) {
    case "correct-first":
      return "bg-[#C8E6C9] border-[#1B5E20] dark:bg-[#1B5E20] dark:border-[#2E7D32]";
    case "correct-later":
      return "bg-[#FFE0B2] border-[#E65100] dark:bg-[#7A3B00] dark:border-[#FB8C00]";
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
  statusMode = "default",
}: QuestionNavigatorSheetProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    gridRef.current?.scrollTo({ top: 0 });
    // Move focus into the panel so subsequent ESC goes to the panel-scoped
    // listener rather than competing with global handlers (e.g. OnboardingTour).
    panelRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
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
      <Button
        ref={triggerRef}
        variant="outline"
        size="sm"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        {buttonLabel}
      </Button>

      {isOpen && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-label={title}
          className="fixed bottom-20 z-30 w-[min(90vw,520px)] max-h-[55vh] overflow-hidden rounded-xl border-2 border-border bg-card p-4 shadow-xl outline-none"
          style={getCenterStyle()}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setIsOpen(false);
              triggerRef.current?.focus();
            }
          }}
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
            {statusMode === "answered-unanswered" ? (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="h-4 w-4 rounded border border-primary/40 bg-primary/10" />
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-4 w-4 rounded border-2 border-border bg-background" />
                  <span>Unanswered</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="h-4 w-4 rounded border border-[#1B5E20] bg-[#C8E6C9] dark:border-[#2E7D32] dark:bg-[#1B5E20]" />
                  <span>Correct first try</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-4 w-4 rounded border border-[#E65100] bg-[#FFE0B2] dark:border-[#FB8C00] dark:bg-[#7A3B00]" />
                  <span>Correct after retry</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-4 w-4 rounded border border-[#B71C1C] bg-[#FFCDD2] dark:border-[#8B0000] dark:bg-[#5C1010]" />
                  <span>Incorrect</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-4 w-4 rounded border-2 border-border bg-background" />
                  <span>Unanswered</span>
                </div>
              </>
            )}
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
                  getStatusColor(item.status, statusMode),
                  item.isCurrent && "ring-2 ring-primary ring-offset-1"
                )}
              >
                {item.isFlagged ? (
                  <Bookmark className="pointer-events-none absolute right-0.5 top-0.5 z-10 h-3 w-3 bookmark-flag" />
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
