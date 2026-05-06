import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";
import { DraggableWindow } from "./DraggableWindow";
import { loadDesmos } from "@/lib/desmosLoader";

declare global {
  interface Window {
    Desmos: {
      GraphingCalculator: (
        el: HTMLElement,
        options?: Record<string, unknown>
      ) => DesmosCalculator;
    };
  }
}

interface DesmosCalculator {
  destroy: () => void;
  resize: () => void;
  setExpression: (expr: { id: string; latex?: string }) => void;
}

interface DesmosDialogProps {
  onSplitScreenChange?: (isSplit: boolean, windowId: string) => void;
  onSplitPositionChange?: (newPosition: number) => void;
  splitPosition?: number;
  onFocus?: () => void;
  zIndex?: number;
  constrainToLeft?: number;
  isSidebarred?: boolean;
  onSidebarToggle?: (windowId: string, shouldBeSidebarred: boolean) => void;
  compressed?: boolean;
}

export const DesmosDialog = ({
  onSplitScreenChange,
  onSplitPositionChange,
  splitPosition,
  onFocus,
  zIndex = 50,
  constrainToLeft,
  isSidebarred = false,
  onSidebarToggle,
  compressed = false,
}: DesmosDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasEverOpened, setHasEverOpened] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const calcRef = useRef<DesmosCalculator | null>(null);

  const handleToggle = () => {
    if (!isOpen && onFocus) onFocus();
    setIsOpen((prev) => {
      const next = !prev;
      if (next) setHasEverOpened(true);
      return next;
    });
  };

  // Initialize the calculator exactly once on the first open. After that the
  // window is kept mounted (display:none when closed), so the instance and the
  // user's expressions persist for the lifetime of the page.
  useEffect(() => {
    if (!hasEverOpened) return;
    if (calcRef.current) return;

    let cancelled = false;
    loadDesmos()
      .then(() => {
        if (cancelled || !containerRef.current || !window.Desmos) return;
        calcRef.current = window.Desmos.GraphingCalculator(containerRef.current, {
          expressions: true,
          expressionsTopbar: true,
          settingsMenu: true,
          zoomButtons: true,
          pointsOfInterest: true,
          trace: true,
          degreeMode: true,
          images: false,
          folders: false,
          notes: false,
          links: false,
          qwertyKeyboard: true,
          lockViewport: false,
          border: false,
          expressionsCollapsed: false,
          backgroundColor: "#ffffff",
        });
      })
      .catch(() => {
        // Desmos failed to load — dialog stays open but graph area is empty
      });

    return () => {
      cancelled = true;
    };
  }, [hasEverOpened]);

  // Tear down only on full unmount of this component (route change, etc).
  useEffect(() => {
    return () => {
      calcRef.current?.destroy();
      calcRef.current = null;
    };
  }, []);

  // Resize the calculator after the window becomes visible or its layout
  // changes, since Desmos needs to be told its container resized.
  useEffect(() => {
    if (!isOpen || !calcRef.current) return;
    const timer = setTimeout(() => calcRef.current?.resize(), 100);
    return () => clearTimeout(timer);
  }, [isOpen, isSidebarred, splitPosition]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleToggle} data-tour="desmos-button">
        <Calculator className={compressed ? "h-4 w-4" : "mr-2 h-4 w-4"} />
        {!compressed && "Desmos"}
      </Button>

      <DraggableWindow
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Desmos"
        defaultWidth={640}
        defaultHeight={460}
        onSplitScreenChange={onSplitScreenChange}
        onSplitPositionChange={onSplitPositionChange}
        splitPosition={splitPosition}
        enableSplitScreen={true}
        windowId="desmos"
        onFocus={onFocus}
        zIndex={zIndex}
        constrainToLeft={constrainToLeft}
        isSidebarred={isSidebarred}
        onSidebarToggle={onSidebarToggle}
        keepMountedWhenClosed={hasEverOpened}
      >
        <div ref={containerRef} className="w-full h-full" />
      </DraggableWindow>
    </>
  );
};
