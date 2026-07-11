import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";
import { DraggableWindow } from "@/components/DraggableWindow";
import { loadDesmos, type DesmosCalculator } from "@/lib/desmosLoader";

declare global {
  interface Window {
    Desmos?: import("@/lib/desmosLoader").DesmosApi;
  }
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
  calculatorIdentityKey?: string;
  windowStateKey?: string;
  layoutStateKey?: string;
  openStateKey?: string;
  onRestoreSidebarPosition?: () => void;
  contentSplitExitPosition?: number;
  sidebarExitMainMaxWidth?: number;
}

type DesmosLoadStatus = "idle" | "loading" | "ready" | "error";

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
  calculatorIdentityKey,
  windowStateKey,
  layoutStateKey,
  openStateKey,
  onRestoreSidebarPosition,
  contentSplitExitPosition,
  sidebarExitMainMaxWidth,
}: DesmosDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasEverOpened, setHasEverOpened] = useState(false);
  const [calculatorResetKey, setCalculatorResetKey] = useState(0);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadStatus, setLoadStatus] = useState<DesmosLoadStatus>("idle");
  const containerRef = useRef<HTMLDivElement>(null);
  const calcRef = useRef<DesmosCalculator | null>(null);
  const blankCalculatorStateRef = useRef<unknown | null>(null);
  const writeTimerRef = useRef<number | null>(null);
  const removeChangeObserverRef = useRef<(() => void) | null>(null);
  const calculatorStateKeyRef = useRef(calculatorStateKey);
  const storageAreaRef = useRef(storageArea);
  const onSplitScreenChangeRef = useRef(onSplitScreenChange);
  const onSidebarToggleRef = useRef(onSidebarToggle);
  const previousCalculatorStateKeyRef = useRef(calculatorStateKey);
  const previousCalculatorIdentityKeyRef = useRef(calculatorIdentityKey ?? calculatorStateKey);
  const previousStorageAreaRef = useRef(storageArea);
  const restoredOpenStateKeyRef = useRef<string | undefined>(undefined);
  const isOpenRef = useRef(isOpen);
  const effectiveCalculatorIdentityKey = calculatorIdentityKey ?? calculatorStateKey;

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

  const applyCalculatorStateForCurrentKey = useCallback(() => {
    const calc = calcRef.current;
    if (!calc?.setState) return;
    const savedState = readCalculatorState();
    const nextState = savedState ?? blankCalculatorStateRef.current;
    if (nextState) {
      calc.setState(nextState, { allowUndo: false });
    }
    window.requestAnimationFrame(() => calcRef.current?.resize());
  }, [readCalculatorState]);

  const writeOpenState = useCallback(
    (nextOpen: boolean) => {
      if (!openStateKey || !storageArea) return;
      storageArea.setItem(openStateKey, nextOpen ? "true" : "false");
    },
    [openStateKey, storageArea],
  );

  const shouldOpenInSidebar = useCallback(() => {
    if (!layoutStateKey || !storageArea) return false;
    return storageArea.getItem(layoutStateKey) !== "floating";
  }, [layoutStateKey, storageArea]);

  const openInSidebar = useCallback(() => {
    if (layoutStateKey && storageArea) {
      storageArea.setItem(layoutStateKey, "sidebar");
    }
    onRestoreSidebarPosition?.();
    onSidebarToggle?.("desmos", true);
    onSplitScreenChange?.(true, "desmos");
  }, [layoutStateKey, onRestoreSidebarPosition, onSidebarToggle, onSplitScreenChange, storageArea]);

  const retryDesmosLoad = useCallback(() => {
    setLoadStatus("loading");
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  const handleToggle = () => {
    if (isOpen) {
      flushCalculatorState();
      writeOpenState(false);
      setIsOpen(false);
      return;
    }

    if (onFocus) onFocus();
    if (loadStatus === "error") retryDesmosLoad();

    openInSidebar();

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
        if (!(reason === "close" && !shouldBeSidebarred)) {
          storageArea.setItem(layoutStateKey, shouldBeSidebarred ? "sidebar" : "floating");
        }
      }
      onSidebarToggle?.(windowId, shouldBeSidebarred, reason);
    },
    [layoutStateKey, onSidebarToggle, storageArea],
  );
  useEffect(() => {
    if (!hasEverOpened) return;
    if (calcRef.current) {
      setLoadStatus("ready");
      return;
    }

    let cancelled = false;
    setLoadStatus("loading");
    loadDesmos()
      .then(() => {
        if (cancelled) return;
        if (!containerRef.current || !window.Desmos) {
          setLoadStatus("error");
          return;
        }
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
        blankCalculatorStateRef.current = calc.getState?.() ?? blankCalculatorStateRef.current;
        const savedState = readCalculatorState();
        if (savedState && calc.setState) {
          calc.setState(savedState, { allowUndo: false });
        }
        const handleCalculatorChange = () => {
          if (writeTimerRef.current !== null) {
            window.clearTimeout(writeTimerRef.current);
          }
          writeTimerRef.current = window.setTimeout(() => {
            flushCalculatorState();
            writeTimerRef.current = null;
          }, 250);
        };
        calc.observeEvent?.("change", handleCalculatorChange);
        removeChangeObserverRef.current = () => calc.unobserveEvent?.("change", handleCalculatorChange);
        setLoadStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        removeChangeObserverRef.current?.();
        removeChangeObserverRef.current = null;
        calcRef.current?.destroy();
        calcRef.current = null;
        setLoadStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [calculatorResetKey, flushCalculatorState, hasEverOpened, loadAttempt, readCalculatorState]);

  useEffect(() => {
    if (!openStateKey || !storageArea) return;
    if (restoredOpenStateKeyRef.current === openStateKey) return;
    restoredOpenStateKeyRef.current = openStateKey;
    if (storageArea.getItem(openStateKey) !== "true") return;

    if (shouldOpenInSidebar()) {
      openInSidebar();
    }

    setHasEverOpened(true);
    setIsOpen(true);
  }, [openInSidebar, openStateKey, shouldOpenInSidebar, storageArea]);

  useEffect(() => {
    const previousKey = previousCalculatorStateKeyRef.current;
    const previousIdentityKey = previousCalculatorIdentityKeyRef.current;
    const previousArea = previousStorageAreaRef.current;
    if (
      previousKey === calculatorStateKey &&
      previousIdentityKey === effectiveCalculatorIdentityKey &&
      previousArea === storageArea
    ) {
      return;
    }
    const wasOpen = isOpenRef.current;

    flushCalculatorState(previousKey, previousArea);
    if (writeTimerRef.current !== null) {
      window.clearTimeout(writeTimerRef.current);
      writeTimerRef.current = null;
    }
    if (calcRef.current?.setState) {
      applyCalculatorStateForCurrentKey();
    } else if (wasOpen) {
      setHasEverOpened(true);
      setIsOpen(true);
      setCalculatorResetKey((key) => key + 1);
    }
    previousCalculatorStateKeyRef.current = calculatorStateKey;
    previousCalculatorIdentityKeyRef.current = effectiveCalculatorIdentityKey;
    previousStorageAreaRef.current = storageArea;
  }, [applyCalculatorStateForCurrentKey, calculatorStateKey, effectiveCalculatorIdentityKey, flushCalculatorState, storageArea]);

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
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggle}
        data-tour="desmos-button"
        aria-label={compressed ? "Desmos calculator" : undefined}
        className={compressed ? "w-9 px-0" : undefined}
      >
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
        contentSplitExitPosition={contentSplitExitPosition}
        sidebarExitMainMaxWidth={sidebarExitMainMaxWidth}
      >
        {loadStatus === "error" ? (
          <div className="flex h-full w-full items-center justify-center bg-background p-6 text-center" role="alert">
            <div className="max-w-sm">
              <p className="font-semibold text-foreground">Desmos could not load</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Check your connection, then try loading the calculator again.
              </p>
              <Button className="mt-4" onClick={retryDesmosLoad}>Try again</Button>
            </div>
          </div>
        ) : (
          <div className="relative h-full w-full bg-white" aria-busy={loadStatus !== "ready"}>
            <div ref={containerRef} className="h-full w-full" />
            {loadStatus !== "ready" ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white text-sm text-slate-600" role="status">
                Loading Desmos…
              </div>
            ) : null}
          </div>
        )}
      </DraggableWindow>
    </>
  );
};
