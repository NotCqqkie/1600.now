import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";
import { DraggableWindow } from "@/components/DraggableWindow";
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
  getState?: () => unknown;
  setState?: (state: unknown, options?: { allowUndo?: boolean }) => void;
  observeEvent?: (eventName: string, callback: () => void) => void;
  unobserveEvent?: (eventName: string, callback: () => void) => void;
}

interface DesmosDialogProps {
  onSplitScreenChange?: (isSplit: boolean, windowId: string) => void;
  onSplitPositionChange?: (newPosition: number) => void;
  splitPosition?: number;
  onFocus?: () => void;
  zIndex?: number;
  constrainToLeft?: number;
  isSidebarred?: boolean;
  onSidebarToggle?: (windowId: string, shouldBeSidebarred: boolean, reason?: "close") => void;
  compressed?: boolean;
  windowPortalContainer?: HTMLElement | null;
  windowBoundsElement?: HTMLElement | null;
  storageArea?: Storage;
  calculatorStateKey?: string;
  windowStateKey?: string;
  layoutStateKey?: string;
  openStateKey?: string;
  closeSignal?: string | number;
  onRestoreSidebarPosition?: () => void;
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
  windowPortalContainer,
  windowBoundsElement,
  storageArea = typeof window !== "undefined" ? window.localStorage : undefined,
  calculatorStateKey,
  windowStateKey,
  layoutStateKey,
  openStateKey,
  closeSignal,
  onRestoreSidebarPosition,
}: DesmosDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasEverOpened, setHasEverOpened] = useState(false);
  const [calculatorResetKey, setCalculatorResetKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const calcRef = useRef<DesmosCalculator | null>(null);
  const writeTimerRef = useRef<number | null>(null);
  const removeChangeObserverRef = useRef<(() => void) | null>(null);
  const calculatorStateKeyRef = useRef(calculatorStateKey);
  const storageAreaRef = useRef(storageArea);
  const onSplitScreenChangeRef = useRef(onSplitScreenChange);
  const onSidebarToggleRef = useRef(onSidebarToggle);
  const previousCalculatorStateKeyRef = useRef(calculatorStateKey);
  const previousStorageAreaRef = useRef(storageArea);
  const previousCloseSignalRef = useRef(closeSignal);
  const restoredOpenStateKeyRef = useRef<string | undefined>(undefined);
  const suppressNextLayoutPersistRef = useRef(false);
  const isOpenRef = useRef(isOpen);

  calculatorStateKeyRef.current = calculatorStateKey;
  storageAreaRef.current = storageArea;
  onSplitScreenChangeRef.current = onSplitScreenChange;
  onSidebarToggleRef.current = onSidebarToggle;
  isOpenRef.current = isOpen;

  const flushCalculatorState = useCallback((key = calculatorStateKeyRef.current, area = storageAreaRef.current) => {
    if (!key || !area || !calcRef.current?.getState) return;
    try {
      area.setItem(key, JSON.stringify(calcRef.current.getState()));
    } catch {
      return;
    }
  }, []);

  const readCalculatorState = useCallback(() => {
    const key = calculatorStateKeyRef.current;
    const area = storageAreaRef.current;
    if (!key || !area) return null;
    try {
      const raw = area.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const writeOpenState = useCallback(
    (nextOpen: boolean) => {
      if (!openStateKey || !storageArea) return;
      storageArea.setItem(openStateKey, nextOpen ? "true" : "false");
    },
    [openStateKey, storageArea],
  );

  const handleToggle = () => {
    if (isOpen) {
      flushCalculatorState();
      writeOpenState(false);
      setIsOpen(false);
      return;
    }

    if (onFocus) onFocus();

    if (layoutStateKey && storageArea?.getItem(layoutStateKey) === "sidebar") {
      onRestoreSidebarPosition?.();
      onSidebarToggle?.("desmos", true);
      onSplitScreenChange?.(true, "desmos");
    }

    setHasEverOpened(true);
    writeOpenState(true);
    setIsOpen(true);
  };

  const handleClose = () => {
    flushCalculatorState();
    writeOpenState(false);
    setIsOpen(false);
  };

  const handleSidebarToggle = useCallback(
    (windowId: string, shouldBeSidebarred: boolean, reason?: "close") => {
      if (layoutStateKey && storageArea) {
        if ((suppressNextLayoutPersistRef.current || reason === "close") && !shouldBeSidebarred) {
          suppressNextLayoutPersistRef.current = false;
        } else {
          storageArea.setItem(layoutStateKey, shouldBeSidebarred ? "sidebar" : "floating");
        }
      }
      onSidebarToggle?.(windowId, shouldBeSidebarred, reason);
    },
    [layoutStateKey, onSidebarToggle, storageArea],
  );
  useEffect(() => {
    if (!hasEverOpened) return;
    if (calcRef.current) return;

    let cancelled = false;
    loadDesmos()
      .then(() => {
        if (cancelled || !containerRef.current || !window.Desmos) return;
        const calc = window.Desmos.GraphingCalculator(containerRef.current, {
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
        calcRef.current = calc;
        const savedState = readCalculatorState();
        if (savedState && calc.setState) {
          calc.setState(savedState, { allowUndo: false });
        }
        const handleChange = () => {
          if (writeTimerRef.current !== null) {
            window.clearTimeout(writeTimerRef.current);
          }
          writeTimerRef.current = window.setTimeout(() => {
            flushCalculatorState();
            writeTimerRef.current = null;
          }, 250);
        };
        calc.observeEvent?.("change", handleChange);
        removeChangeObserverRef.current = () => calc.unobserveEvent?.("change", handleChange);
      })
      .catch(() => {
      });

    return () => {
      cancelled = true;
    };
  }, [calculatorResetKey, flushCalculatorState, hasEverOpened, readCalculatorState]);

  useEffect(() => {
    if (!openStateKey || !storageArea) return;
    if (restoredOpenStateKeyRef.current === openStateKey) return;
    restoredOpenStateKeyRef.current = openStateKey;
    if (storageArea.getItem(openStateKey) !== "true") return;

    if (layoutStateKey && storageArea.getItem(layoutStateKey) === "sidebar") {
      onRestoreSidebarPosition?.();
      onSidebarToggle?.("desmos", true);
      onSplitScreenChange?.(true, "desmos");
    }

    setHasEverOpened(true);
    setIsOpen(true);
  }, [layoutStateKey, onRestoreSidebarPosition, onSidebarToggle, onSplitScreenChange, openStateKey, storageArea]);

  useEffect(() => {
    const previousKey = previousCalculatorStateKeyRef.current;
    const previousArea = previousStorageAreaRef.current;
    if (previousKey === calculatorStateKey && previousArea === storageArea) return;
    const wasOpen = isOpenRef.current;

    flushCalculatorState(previousKey, previousArea);
    if (writeTimerRef.current !== null) {
      window.clearTimeout(writeTimerRef.current);
      writeTimerRef.current = null;
    }
    removeChangeObserverRef.current?.();
    removeChangeObserverRef.current = null;
    calcRef.current?.destroy();
    calcRef.current = null;
    setHasEverOpened(wasOpen);
    setIsOpen(wasOpen);
    if (wasOpen) {
      setCalculatorResetKey((key) => key + 1);
    } else {
      onSplitScreenChange?.(false, "desmos");
      onSidebarToggle?.("desmos", false);
    }
    previousCalculatorStateKeyRef.current = calculatorStateKey;
    previousStorageAreaRef.current = storageArea;
  }, [calculatorStateKey, flushCalculatorState, onSidebarToggle, onSplitScreenChange, storageArea]);

  useEffect(() => {
    if (previousCloseSignalRef.current === closeSignal) return;
    previousCloseSignalRef.current = closeSignal;
    if (!isOpen) return;

    flushCalculatorState();
    suppressNextLayoutPersistRef.current = true;
    writeOpenState(false);
    setIsOpen(false);
  }, [closeSignal, flushCalculatorState, isOpen, writeOpenState]);
  useEffect(() => {
    return () => {
      flushCalculatorState();
      if (writeTimerRef.current !== null) {
        window.clearTimeout(writeTimerRef.current);
        writeTimerRef.current = null;
      }
      removeChangeObserverRef.current?.();
      removeChangeObserverRef.current = null;
      calcRef.current?.destroy();
      calcRef.current = null;
      onSplitScreenChangeRef.current?.(false, "desmos");
      onSidebarToggleRef.current?.("desmos", false);
    };
  }, [flushCalculatorState]);
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
        onClose={handleClose}
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
        onSidebarToggle={handleSidebarToggle}
        persistenceKey={windowStateKey}
        persistenceStorage={storageArea}
        keepMountedWhenClosed={hasEverOpened}
        portalContainer={windowPortalContainer}
        boundsElement={windowBoundsElement}
        centerOnExitSidebar
      >
        <div ref={containerRef} className="w-full h-full" />
      </DraggableWindow>
    </>
  );
};
