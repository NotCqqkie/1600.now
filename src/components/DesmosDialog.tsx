import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";
import { DraggableWindow } from "./DraggableWindow";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const calcRef = useRef<DesmosCalculator | null>(null);

  const handleToggle = () => {
    if (!isOpen && onFocus) {
      onFocus();
    }
    setIsOpen(!isOpen);
  };

  // Initialize Desmos calculator when the window opens
  useEffect(() => {
    if (!isOpen || !containerRef.current || !window.Desmos) return;

    // SAT-matching configuration:
    // Mirrors College Board's Desmos restrictions for the Digital SAT
    const calc = window.Desmos.GraphingCalculator(containerRef.current, {
      // Core graphing features
      expressions: true,
      expressionsTopbar: true,
      settingsMenu: true,
      zoomButtons: true,
      pointsOfInterest: true,
      trace: true,

      // Angle mode: degrees by default (SAT standard)
      degreeMode: true,

      // Disabled features (matching CB SAT restrictions)
      images: false,          // No image upload
      folders: false,         // No folders
      notes: false,           // No notes
      links: false,           // No sharing links
      qwertyKeyboard: true,   // On-screen keyboard available

      // UI restrictions
      lockViewport: false,    // Allow panning/zooming
      border: false,          // Clean look
      expressionsCollapsed: false,

      // Colors and theming — follow app theme
      backgroundColor: "#ffffff",
    });

    calcRef.current = calc;

    return () => {
      calc.destroy();
      calcRef.current = null;
    };
  }, [isOpen]);

  // Resize calculator when the window dimensions change
  useEffect(() => {
    if (isOpen && calcRef.current) {
      const timer = setTimeout(() => calcRef.current?.resize(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isSidebarred, splitPosition]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleToggle}>
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
      >
        <div ref={containerRef} className="w-full h-full" />
      </DraggableWindow>
    </>
  );
};
