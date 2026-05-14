import { useEffect, useRef, useState } from "react";
import { DraggableWindow } from "@/components/DraggableWindow";

interface QuestionNotesWindowProps {
  isOpen: boolean;
  onClose: () => void;
  storageKey: string;
  storageArea?: Storage;
  windowStateKey?: string;
  onFocus?: () => void;
  zIndex?: number;
  constrainToLeft?: number;
}

export const QuestionNotesWindow = ({
  isOpen,
  onClose,
  storageKey,
  storageArea = localStorage,
  windowStateKey,
  onFocus,
  zIndex = 50,
  constrainToLeft,
}: QuestionNotesWindowProps) => {
  const [note, setNote] = useState("");
  const writeTimerRef = useRef<number | null>(null);
  const pendingValueRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setNote(storageArea.getItem(storageKey) || "");
  }, [storageArea, storageKey]);

  useEffect(() => {
    return () => {
      if (writeTimerRef.current !== null) {
        window.clearTimeout(writeTimerRef.current);
        if (pendingValueRef.current !== null) {
          storageArea.setItem(storageKey, pendingValueRef.current);
        }
      }
    };
  }, [storageArea, storageKey]);

  const handleChange = (value: string) => {
    setNote(value);
    if (typeof window === "undefined") return;
    pendingValueRef.current = value;
    if (writeTimerRef.current !== null) {
      window.clearTimeout(writeTimerRef.current);
    }
    writeTimerRef.current = window.setTimeout(() => {
      if (pendingValueRef.current !== null) {
        storageArea.setItem(storageKey, pendingValueRef.current);
        pendingValueRef.current = null;
      }
      writeTimerRef.current = null;
    }, 250);
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
      persistenceKey={windowStateKey}
      persistenceStorage={storageArea}
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
