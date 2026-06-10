import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Columns2, Minus, Maximize2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DraggableWindowProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
  onSplitScreenChange?: (isSplit: boolean, windowId: string) => void;
  splitPosition?: number;
  onSplitPositionChange?: (newPosition: number) => void;
  enableSplitScreen?: boolean;
  diagonalResizeOnly?: boolean;
  lockAspectRatio?: boolean;
  windowId?: string;
  onFocus?: () => void;
  zIndex?: number;
  constrainToLeft?: number;
  isSidebarred?: boolean;
  onSidebarToggle?: (windowId: string, shouldBeSidebarred: boolean, reason?: "close") => void;
  isMaximized?: boolean;
  persistenceKey?: string;
  persistenceStorage?: Storage;
  portalContainer?: HTMLElement | null;
  boundsElement?: HTMLElement | null;
  centerOnExitSidebar?: boolean;
  keepMountedWhenClosed?: boolean;
}

interface PersistedWindowState {
  position: { x: number; y: number };
  size: { width: number; height: number };
  isMinimized: boolean;
}

export const DraggableWindow = ({
  isOpen,
  onClose,
  title,
  children,
  defaultWidth = 800,
  defaultHeight = 600,
  onSplitScreenChange,
  splitPosition = 50,
  onSplitPositionChange,
  enableSplitScreen = true,
  diagonalResizeOnly = false,
  lockAspectRatio = false,
  windowId = "default",
  onFocus,
  zIndex = 50,
  constrainToLeft,
  isSidebarred = false,
  onSidebarToggle,
  isMaximized = false,
  persistenceKey,
  persistenceStorage = localStorage,
  portalContainer,
  boundsElement,
  centerOnExitSidebar = false,
  keepMountedWhenClosed = false,
}: DraggableWindowProps) => {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });
  const [isReady, setIsReady] = useState(false);
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);
  const prevIsOpenRef = useRef(false);
  const lastSplitPositionRef = useRef<number | null>(null);
  const wasSidebarredRef = useRef(isSidebarred);
  const openedAsSidebarRef = useRef(false);
  const previousWindowStateRef = useRef<{
    position: { x: number; y: number };
    size: { width: number; height: number };
  } | null>(null);

  const readPersistedState = useCallback((): PersistedWindowState | null => {
    if (!persistenceKey || typeof window === "undefined") return null;
    try {
      const raw = persistenceStorage.getItem(persistenceKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<PersistedWindowState>;
      if (
        !parsed.position ||
        typeof parsed.position.x !== "number" ||
        typeof parsed.position.y !== "number" ||
        !parsed.size ||
        typeof parsed.size.width !== "number" ||
        typeof parsed.size.height !== "number"
      ) {
        return null;
      }
      return {
        position: parsed.position,
        size: parsed.size,
        isMinimized: typeof parsed.isMinimized === "boolean" ? parsed.isMinimized : false,
      };
    } catch {
      return null;
    }
  }, [persistenceKey, persistenceStorage]);

  const writePersistedState = useCallback(
    (nextState: PersistedWindowState) => {
      if (!persistenceKey || typeof window === "undefined") return;
      persistenceStorage.setItem(persistenceKey, JSON.stringify(nextState));
    },
    [persistenceKey, persistenceStorage],
  );
  const getBounds = useCallback(() => {
    const element = boundsElement ?? portalContainer;
    if (element) {
      const rect = element.getBoundingClientRect();
      return {
        width: element.clientWidth || rect.width || window.innerWidth,
        height: element.clientHeight || rect.height || window.innerHeight,
      };
    }
    return { width: window.innerWidth, height: window.innerHeight };
  }, [boundsElement, portalContainer]);
  const getBoundsPoint = useCallback((clientX: number, clientY: number) => {
    const element = boundsElement ?? portalContainer;
    if (!element) return { x: clientX, y: clientY };
    const rect = element.getBoundingClientRect();
    const width = element.clientWidth || rect.width || 1;
    const height = element.clientHeight || rect.height || 1;
    const scaleX = rect.width / width || 1;
    const scaleY = rect.height / height || 1;
    return {
      x: (clientX - rect.left) / scaleX,
      y: (clientY - rect.top) / scaleY,
    };
  }, [boundsElement, portalContainer]);
  const positionRef = useRef(position);
  const sizeRef = useRef(size);
  const dragOffsetRef = useRef(dragOffset);
  const resizeStartRef = useRef(resizeStart);
  const isMinimizedRef = useRef(isMinimized);
  const isDraggingRef = useRef(isDragging);
  const isResizingRef = useRef(isResizing);
  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { sizeRef.current = size; }, [size]);
  useEffect(() => { dragOffsetRef.current = dragOffset; }, [dragOffset]);
  useEffect(() => { resizeStartRef.current = resizeStart; }, [resizeStart]);
  useEffect(() => { isMinimizedRef.current = isMinimized; }, [isMinimized]);
  useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);
  useEffect(() => { isResizingRef.current = isResizing; }, [isResizing]);

  const persistCurrentFloatingState = useCallback(() => {
    writePersistedState({
      position: positionRef.current,
      size: sizeRef.current,
      isMinimized: isMinimizedRef.current,
    });
  }, [writePersistedState]);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      if (isSidebarred) {
        const persistedState = readPersistedState();
        previousWindowStateRef.current = persistedState
          ? {
              position: persistedState.position,
              size: persistedState.size,
            }
          : {
              position: positionRef.current,
              size: sizeRef.current,
            };
        openedAsSidebarRef.current = true;
        if (onSplitScreenChange) {
          onSplitScreenChange(true, windowId);
        }
        setIsReady(true);
      } else {
        openedAsSidebarRef.current = false;
        const bounds = getBounds();
        const availableWidth = constrainToLeft
          ? (bounds.width * constrainToLeft) / 100
          : bounds.width;
        const bottomBarHeight = 80;
        const persistedState = readPersistedState();

        if (persistedState) {
          const clampedWidth = Math.min(persistedState.size.width, availableWidth);
          const clampedHeight = Math.min(
            persistedState.size.height,
            bounds.height - bottomBarHeight,
          );
          const willBeMinimized = Boolean(persistedState.isMinimized);
          const effectiveHeight = willBeMinimized ? 56 : clampedHeight;
          const maxX = Math.max(0, availableWidth - clampedWidth);
          const maxY = Math.max(0, bounds.height - effectiveHeight - bottomBarHeight);

          setSize({ width: clampedWidth, height: clampedHeight });
          setPosition({
            x: Math.max(0, Math.min(persistedState.position.x, maxX)),
            y: Math.max(0, Math.min(persistedState.position.y, maxY)),
          });
          setIsMinimized(willBeMinimized);
        } else {
          const actualWidth = constrainToLeft
            ? Math.min(defaultWidth * 0.7, availableWidth - 40)
            : Math.min(defaultWidth, Math.max(320, availableWidth - 40));
          const actualHeight = constrainToLeft
            ? Math.min(defaultHeight * 0.7, bounds.height - bottomBarHeight)
            : Math.min(defaultHeight, Math.max(260, bounds.height - bottomBarHeight));

          const centerX = (availableWidth - actualWidth) / 2;
          const centerY = (bounds.height - actualHeight) / 2;

          setPosition({ x: Math.max(20, centerX), y: Math.max(60, centerY) });
          setSize({ width: actualWidth, height: actualHeight });
        }
        requestAnimationFrame(() => setIsReady(true));
      }
    }
    if (!isOpen && prevIsOpenRef.current) {
      if (!isSidebarred) {
        persistCurrentFloatingState();
      }
      setIsReady(false);
      setIsMinimized(false);
      if (isSidebarred) {
        if (onSplitScreenChange) {
          onSplitScreenChange(false, windowId);
        }
        if (onSidebarToggle) {
          onSidebarToggle(windowId, false, "close");
        }
      }
    }

    prevIsOpenRef.current = isOpen;
  }, [isOpen, defaultWidth, defaultHeight, windowId, constrainToLeft, isSidebarred, onSplitScreenChange, onSidebarToggle, readPersistedState, getBounds, persistCurrentFloatingState]);
  useEffect(() => {
    if (!isOpen) return;

    const wasSidebarred = wasSidebarredRef.current;

    if (!wasSidebarred && isSidebarred) {
      if (!openedAsSidebarRef.current) {
        previousWindowStateRef.current = {
          position: positionRef.current,
          size: sizeRef.current,
        };
        persistCurrentFloatingState();
      } else if (!previousWindowStateRef.current) {
        previousWindowStateRef.current = {
          position: positionRef.current,
          size: sizeRef.current,
        };
      }
    }

    if (isSidebarred) {
      const updateSidebarPosition = () => {
        const bounds = getBounds();
        const splitPixels = (bounds.width * splitPosition) / 100;
        const windowWidth = bounds.width - splitPixels;
        setPosition({ x: splitPixels, y: 0 });
        setSize({ width: windowWidth, height: bounds.height });
      };

      updateSidebarPosition();

      wasSidebarredRef.current = true;
      window.addEventListener('resize', updateSidebarPosition);
      return () => window.removeEventListener('resize', updateSidebarPosition);
    } else {
      if (wasSidebarred) {
        const savedState = previousWindowStateRef.current;
        if (savedState) {
          const bottomBarHeight = 80;
          const bounds = getBounds();
          const clampedWidth = Math.min(savedState.size.width, bounds.width);
          const clampedHeight = Math.min(savedState.size.height, Math.max(56, bounds.height - bottomBarHeight));
          const maxX = Math.max(0, bounds.width - clampedWidth);
          const maxY = Math.max(0, bounds.height - clampedHeight - bottomBarHeight);
          const centeredPosition = {
            x: Math.max(0, Math.min((bounds.width - clampedWidth) / 2, maxX)),
            y: Math.max(0, Math.min((bounds.height - clampedHeight) / 2, maxY)),
          };

          setSize({ width: clampedWidth, height: clampedHeight });
          setPosition(
            centerOnExitSidebar
              ? centeredPosition
              : {
                  x: Math.max(0, Math.min(savedState.position.x, maxX)),
                  y: Math.max(0, Math.min(savedState.position.y, maxY)),
                },
          );
        }
      }
      wasSidebarredRef.current = false;
      openedAsSidebarRef.current = false;
    }
  }, [splitPosition, isSidebarred, isOpen, getBounds, persistCurrentFloatingState, centerOnExitSidebar]);
  useEffect(() => {
    if (!isMinimized && isOpen && !isSidebarred && isReady) {
      const bottomBarHeight = 80;
      const bounds = getBounds();
      const maxX = bounds.width - size.width;
      const maxY = bounds.height - size.height - bottomBarHeight;

      const correctedX = Math.max(0, Math.min(position.x, maxX));
      const correctedY = Math.max(0, Math.min(position.y, maxY));

      if (correctedX !== position.x || correctedY !== position.y) {
        setPosition({ x: correctedX, y: correctedY });
      }
    }
  }, [isMinimized, isOpen, isSidebarred, isReady, size.width, size.height, position.x, position.y, getBounds]);

  useEffect(() => {
    if (!isOpen || isSidebarred || !isReady) return;
    const timeoutId = window.setTimeout(() => {
      writePersistedState({
        position,
        size,
        isMinimized,
      });
    }, 200);
    return () => window.clearTimeout(timeoutId);
  }, [isOpen, isReady, isSidebarred, position, size, isMinimized, writePersistedState]);
  useEffect(() => {
    if (!isSidebarred || !isResizingSplit) return;

    document.body.classList.add("noselect");
    let latestRoundedPosition: number | null = null;

    const updateFromClientX = (clientX: number) => {
      const bounds = getBounds();
      const point = getBoundsPoint(clientX, 0);
      const newPosition = (point.x / bounds.width) * 100;
      const clampedPosition = Math.max(35, Math.min(70, newPosition));
      const roundedPosition = Math.round(clampedPosition * 4) / 4;
      if (latestRoundedPosition === roundedPosition) return;
      latestRoundedPosition = roundedPosition;
      document.documentElement.style.setProperty("--sat-split-pct", `${roundedPosition}%`);
    };

    const handleMouseMove = (e: MouseEvent) => updateFromClientX(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      e.preventDefault();
      const touch = e.touches[0];
      updateFromClientX(touch.clientX);
    };

    const stop = () => {
      setIsResizingSplit(false);
      document.body.classList.remove("noselect");
      if (latestRoundedPosition !== null && onSplitPositionChange) {
        onSplitPositionChange(latestRoundedPosition);
      }
      lastSplitPositionRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stop);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', stop);
    document.addEventListener('touchcancel', stop);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stop);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', stop);
      document.removeEventListener('touchcancel', stop);
      document.body.classList.remove("noselect");
      lastSplitPositionRef.current = null;
    };
  }, [isResizingSplit, isSidebarred, onSplitPositionChange, getBounds, getBoundsPoint]);

  const beginDragFrom = (clientX: number, clientY: number, target: HTMLElement) => {
    const isHeader = Boolean(target.closest(".window-header"));
    const isInteractiveTarget = Boolean(
      target.closest("button, [role='button'], input, textarea, select, a")
    );

    if (!isSidebarred && isHeader && !isInteractiveTarget) {
      setIsDragging(true);
      const point = getBoundsPoint(clientX, clientY);
      const newDragOffset = {
        x: point.x - position.x,
        y: point.y - position.y,
      };
      setDragOffset(newDragOffset);
      dragOffsetRef.current = newDragOffset;
      return true;
    }
    return false;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (onFocus) onFocus();
    if (e.button !== 0) return;
    const started = beginDragFrom(e.clientX, e.clientY, e.target as HTMLElement);
    if (started) e.preventDefault();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (onFocus) onFocus();
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const started = beginDragFrom(touch.clientX, touch.clientY, e.target as HTMLElement);
    if (started) e.preventDefault();
  };

  const handleResizeStart = (e: React.MouseEvent, edge: string) => {
    if (isSidebarred) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(edge);
    const point = getBoundsPoint(e.clientX, e.clientY);
    const startData = {
      x: point.x,
      y: point.y,
      width: size.width,
      height: size.height,
      posX: position.x,
      posY: position.y,
    };
    setResizeStart(startData);
    resizeStartRef.current = startData;
  };

  const handleResizeTouchStart = (e: React.TouchEvent, edge: string) => {
    if (isSidebarred) return;
    if (e.touches.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    const point = getBoundsPoint(touch.clientX, touch.clientY);
    setIsResizing(edge);
    const startData = {
      x: point.x,
      y: point.y,
      width: size.width,
      height: size.height,
      posX: position.x,
      posY: position.y,
    };
    setResizeStart(startData);
    resizeStartRef.current = startData;
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      document.body.classList.add("noselect");
    } else {
      document.body.classList.remove("noselect");
    }

    const applyMove = (clientX: number, clientY: number) => {
      const point = getBoundsPoint(clientX, clientY);
      if (isDraggingRef.current) {
        const newX = point.x - dragOffsetRef.current.x;
        const newY = point.y - dragOffsetRef.current.y;
        const currentHeight = isMinimizedRef.current ? 56 : sizeRef.current.height;
        const bounds = getBounds();
        const maxX = bounds.width - sizeRef.current.width;
        const minX = 0;
        const bottomBarHeight = 80;
        const maxY = bounds.height - currentHeight - bottomBarHeight;

        setPosition({
          x: Math.max(minX, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY)),
        });
      }

      if (isResizingRef.current) {
        const currentResizeStart = resizeStartRef.current;
        const deltaX = point.x - currentResizeStart.x;
        const deltaY = point.y - currentResizeStart.y;

        let newWidth = currentResizeStart.width;
        let newHeight = currentResizeStart.height;
        let newX = currentResizeStart.posX;
        let newY = currentResizeStart.posY;
        const minWidth = 400;
        const minHeight = 300;
        const aspectRatio = currentResizeStart.width / currentResizeStart.height;
        const currentResizingEdge = isResizingRef.current;

        if (lockAspectRatio && diagonalResizeOnly) {
          let diagonalDelta = 0;

          if (currentResizingEdge.includes('right') && currentResizingEdge.includes('bottom')) {
            diagonalDelta = (deltaX + deltaY) / 2;
            newWidth = Math.max(minWidth, currentResizeStart.width + diagonalDelta * 1.5);
            newHeight = newWidth / aspectRatio;
          } else if (currentResizingEdge.includes('left') && currentResizingEdge.includes('bottom')) {
            diagonalDelta = (-deltaX + deltaY) / 2;
            newWidth = Math.max(minWidth, currentResizeStart.width + diagonalDelta * 1.5);
            newHeight = newWidth / aspectRatio;
            newX = currentResizeStart.posX + currentResizeStart.width - newWidth;
          } else if (currentResizingEdge.includes('right') && currentResizingEdge.includes('top')) {
            diagonalDelta = (deltaX - deltaY) / 2;
            newWidth = Math.max(minWidth, currentResizeStart.width + diagonalDelta * 1.5);
            newHeight = newWidth / aspectRatio;
            newY = currentResizeStart.posY + currentResizeStart.height - newHeight;
          } else if (currentResizingEdge.includes('left') && currentResizingEdge.includes('top')) {
            diagonalDelta = (-deltaX - deltaY) / 2;
            newWidth = Math.max(minWidth, currentResizeStart.width + diagonalDelta * 1.5);
            newHeight = newWidth / aspectRatio;
            newX = currentResizeStart.posX + currentResizeStart.width - newWidth;
            newY = currentResizeStart.posY + currentResizeStart.height - newHeight;
          }
          if (newHeight < minHeight) {
            newHeight = minHeight;
            newWidth = newHeight * aspectRatio;
            if (currentResizingEdge.includes('left')) {
              newX = currentResizeStart.posX + currentResizeStart.width - newWidth;
            }
            if (currentResizingEdge.includes('top')) {
              newY = currentResizeStart.posY + currentResizeStart.height - newHeight;
            }
          }
        } else {
          const bounds = getBounds();
          if (currentResizingEdge.includes('right')) {
            const maxWidth = bounds.width - currentResizeStart.posX;
            newWidth = Math.max(minWidth, Math.min(currentResizeStart.width + deltaX, maxWidth));
          }
          if (currentResizingEdge.includes('left')) {
            const proposedWidth = currentResizeStart.width - deltaX;
            newWidth = Math.max(minWidth, proposedWidth);
            newX = currentResizeStart.posX + currentResizeStart.width - newWidth;
          }
          if (currentResizingEdge.includes('bottom')) {
             const maxHeight = bounds.height - currentResizeStart.posY;
            newHeight = Math.max(minHeight, Math.min(currentResizeStart.height + deltaY, maxHeight));
          }
          if (currentResizingEdge.includes('top')) {
            const proposedHeight = currentResizeStart.height - deltaY;
            newHeight = Math.max(minHeight, proposedHeight);
            newY = currentResizeStart.posY + currentResizeStart.height - newHeight;
          }
        }

        setSize({ width: newWidth, height: newHeight });
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseMove = (e: MouseEvent) => applyMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      e.preventDefault();
      const touch = e.touches[0];
      applyMove(touch.clientX, touch.clientY);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      setIsResizing(null);
      document.body.classList.remove("noselect");
    };

    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handlePointerUp);
      document.addEventListener("touchmove", handleTouchMove, { passive: false });
      document.addEventListener("touchend", handlePointerUp);
      document.addEventListener("touchcancel", handlePointerUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handlePointerUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handlePointerUp);
      document.removeEventListener("touchcancel", handlePointerUp);
    };
  }, [isDragging, isResizing, lockAspectRatio, diagonalResizeOnly, getBounds, getBoundsPoint]);

  const toggleSidebar = () => {
    const newSidebarState = !isSidebarred;
    if (newSidebarState && isMinimized) {
      setIsMinimized(false);
    }

    if (onSidebarToggle) {
      onSidebarToggle(windowId, newSidebarState);
    }
    if (onSplitScreenChange) {
      onSplitScreenChange(newSidebarState, windowId);
    }
  };

  const handleClose = () => {
    if (isSidebarred) {
      if (onSidebarToggle) {
        onSidebarToggle(windowId, false, "close");
      }
      if (onSplitScreenChange) {
        onSplitScreenChange(false, windowId);
      }
    }
    setIsMinimized(false);
    onClose();
  };

  if (!isOpen && !keepMountedWhenClosed) return null;
  const windowStyle: React.CSSProperties = isSidebarred && !isMaximized
    ? {
        left: `var(--sat-split-pct, ${splitPosition}%)`,
        top: 0,
        width: `calc(100% - var(--sat-split-pct, ${splitPosition}%))`,
        height: "100%",
        zIndex,
        visibility: "visible",
        display: isOpen ? undefined : "none",
      }
    : {
        left: isMaximized ? 0 : position.x,
        top: isMaximized ? 0 : position.y,
        width: isMaximized ? '100%' : size.width,
        height: isMaximized ? '100%' : (isMinimized ? '56px' : size.height),
        zIndex: isMaximized ? 100 : zIndex,
        visibility: (isReady || isMaximized) ? 'visible' : 'hidden',
        display: isOpen ? undefined : 'none',
      };

  const resizeHandleClass = "absolute bg-transparent hover:bg-primary/20 transition-colors z-10";

  const handleNativeDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    if (target.closest(".window-header")) {
      e.preventDefault();
    }
  };

  const targetPortalContainer = portalContainer ?? document.body;

  return createPortal(
    <>
      {isSidebarred && isOpen && (
        <div
          className="fixed bottom-0 top-0 w-4 cursor-col-resize flex items-center justify-center group touch-none"
          style={{
            left: `calc(var(--sat-split-pct, ${splitPosition}%) - 8px)`,
            zIndex: zIndex + 10 // Always above this window
          }}
          onMouseDown={() => {
            lastSplitPositionRef.current = null;
            setIsResizingSplit(true);
          }}
          onTouchStart={(e) => {
            if (e.touches.length === 0) return;
            e.preventDefault();
            lastSplitPositionRef.current = null;
            setIsResizingSplit(true);
          }}
        >
          <div className="w-1 h-full bg-border group-hover:bg-primary/50 transition-colors" />
        </div>
      )}

      <div
        ref={windowRef}
        data-window-id={windowId}
        data-tour={`window-${windowId}`}
        className={cn(
          "fixed bg-card border-2 border-border rounded-lg shadow-2xl flex flex-col overflow-hidden",
          isDragging ? "cursor-grabbing" : "",
          isSidebarred ? "pointer-events-auto rounded-none border-l-2 border-t-0 border-r-0 border-b-0" : ""
        )}
        style={windowStyle}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDragStart={handleNativeDragStart}
      >
        {!isMinimized && !isSidebarred && (
          <>
            {!diagonalResizeOnly && (
              <>
                <div
                  className={cn(resizeHandleClass, "top-0 left-0 right-0 h-1 cursor-n-resize touch-none")}
                  onMouseDown={(e) => handleResizeStart(e, "top")}
                  onTouchStart={(e) => handleResizeTouchStart(e, "top")}
                />
                <div
                  className={cn(resizeHandleClass, "bottom-0 left-0 right-0 h-1 cursor-s-resize touch-none")}
                  onMouseDown={(e) => handleResizeStart(e, "bottom")}
                  onTouchStart={(e) => handleResizeTouchStart(e, "bottom")}
                />
                <div
                  className={cn(resizeHandleClass, "left-0 top-0 bottom-0 w-1 cursor-w-resize touch-none")}
                  onMouseDown={(e) => handleResizeStart(e, "left")}
                  onTouchStart={(e) => handleResizeTouchStart(e, "left")}
                />
                <div
                  className={cn(resizeHandleClass, "right-0 top-0 bottom-0 w-1 cursor-e-resize touch-none")}
                  onMouseDown={(e) => handleResizeStart(e, "right")}
                  onTouchStart={(e) => handleResizeTouchStart(e, "right")}
                />
              </>
            )}
            <div
              className={cn(resizeHandleClass, "top-0 left-0 w-3 h-3 cursor-nw-resize touch-none")}
              onMouseDown={(e) => handleResizeStart(e, "top-left")}
              onTouchStart={(e) => handleResizeTouchStart(e, "top-left")}
            />
            <div
              className={cn(resizeHandleClass, "top-0 right-0 w-3 h-3 cursor-ne-resize touch-none")}
              onMouseDown={(e) => handleResizeStart(e, "top-right")}
              onTouchStart={(e) => handleResizeTouchStart(e, "top-right")}
            />
            <div
              className={cn(resizeHandleClass, "bottom-0 left-0 w-3 h-3 cursor-sw-resize touch-none")}
              onMouseDown={(e) => handleResizeStart(e, "bottom-left")}
              onTouchStart={(e) => handleResizeTouchStart(e, "bottom-left")}
            />
            <div
              className={cn(resizeHandleClass, "bottom-0 right-0 w-3 h-3 cursor-se-resize touch-none")}
              onMouseDown={(e) => handleResizeStart(e, "bottom-right")}
              onTouchStart={(e) => handleResizeTouchStart(e, "bottom-right")}
            />
          </>
        )}

        <div className={cn(
          "window-header flex select-none items-center justify-between px-4 py-3 bg-muted border-b border-border",
          isSidebarred ? "cursor-default" : "cursor-grab active:cursor-grabbing"
        )}>
          <div className="flex min-w-0 items-center gap-2">
            {enableSplitScreen && (
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8 shrink-0", isSidebarred && "bg-primary/20")}
                onClick={toggleSidebar}
                data-tour={`sidebar-toggle-${windowId}`}
                title={isSidebarred ? "Hide away" : "Pop out"}
              >
                {isSidebarred ? <ChevronRight className="h-4 w-4" /> : <Columns2 className="h-4 w-4" />}
              </Button>
            )}
            <h3 className="truncate font-semibold text-foreground">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            {!isSidebarred && (
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", isMinimized && "bg-primary/20")}
                onClick={() => setIsMinimized((prev) => !prev)}
                title={isMinimized ? "Maximize" : "Minimize"}
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!isMinimized && (
          <div className="flex-1 overflow-hidden bg-background">{children}</div>
        )}
      </div>
    </>,
    targetPortalContainer
  );
};
