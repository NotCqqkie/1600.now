import { useEffect, useState } from "react";
import { DraggableWindow } from "./DraggableWindow";

interface QuestionNotesWindowProps {
  isOpen: boolean;
  onClose: () => void;
  storageKey: string;
  onFocus?: () => void;
  zIndex?: number;
  constrainToLeft?: number;
}

export const QuestionNotesWindow = ({
  isOpen,
  onClose,
  storageKey,
  onFocus,
  zIndex = 50,
  constrainToLeft,
}: QuestionNotesWindowProps) => {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setNote(localStorage.getItem(storageKey) || "");
  }, [storageKey]);

  const handleChange = (value: string) => {
    setNote(value);
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, value);
    }
  };

  return (
    <DraggableWindow
      isOpen={isOpen}
      onClose={onClose}
      title="Note"
      defaultWidth={420}
      defaultHeight={320}
      enableSplitScreen={false}
      windowId="note"
      onFocus={onFocus}
      zIndex={zIndex}
      constrainToLeft={constrainToLeft}
    >
      <div className="flex h-full flex-col bg-background">
        <div className="flex-1 p-4">
          <textarea
            value={note}
            onChange={(event) => handleChange(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
            }}
            placeholder="Write a note..."
            className="h-full w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
    </DraggableWindow>
  );
};
