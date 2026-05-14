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
  isSidebarred?: boolean; // Controlled sidebar state from parent
  onSidebarToggle?: (windowId: string, shouldBeSidebarred: boolean) => void;
  isMaximized?: boolean; // New prop to control maximization externally
  persistenceKey?: string;
  persistenceStorage?: Storage;
  // When true, keep the window mounted in the DOM after close so child state
  // (e.g. a Desmos calculator instance) survives. The window is hidden via
  // display:none instead of unmounted.
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
  
  // Refs for event handlers to access latest state without re-binding listeners
  const positionRef = useRef(position);
  const sizeRef = useRef(size);
  const dragOffsetRef = useRef(dragOffset);
  const resizeStartRef = useRef(resizeStart);
  const isMinimizedRef = useRef(isMinimized);
  const isDraggingRef = useRef(isDragging);
  const isResizingRef = useRef(isResizing);

  // Keep refs in sync with state
  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { sizeRef.current = size; }, [size]);
  useEffect(() => { dragOffsetRef.current = dragOffset; }, [dragOffset]);
  useEffect(() => { resizeStartRef.current = resizeStart; }, [resizeStart]);
  useEffect(() => { isMinimizedRef.current = isMinimized; }, [isMinimized]);
  useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);
  useEffect(() => { isResizingRef.current = isResizing; }, [isResizing]);

  // Calculate initial position and size when window opens (only for non-sidebarred windows)
  useEffect(() => {
    // Window just opened
    if (isOpen && !prevIsOpenRef.current) {
      // If opening as sidebarred, let the sidebar effect handle positioning
      if (isSidebarred) {
        // Notify parent that we're in sidebar mode
        if (onSplitScreenChange) {
          onSplitScreenChange(true, windowId);
        }
        setIsReady(true);
      } else {
        const availableWidth = constrainToLeft 
          ? (window.innerWidth * constrainToLeft) / 100 
          : window.innerWidth;
        const bottomBarHeight = 80;
        const persistedState = readPersistedState();

        if (persistedState) {
          const clampedWidth = Math.min(persistedState.size.width, availableWidth);
          const clampedHeight = Math.min(
            persistedState.size.height,
            window.innerHeight - bottomBarHeight,
          );
          const willBeMinimized = Boolean(persistedState.isMinimized);
          const effectiveHeight = willBeMinimized ? 56 : clampedHeight;
          const maxX = Math.max(0, availableWidth - clampedWidth);
          const maxY = Math.max(0, window.innerHeight - effectiveHeight - bottomBarHeight);

          setSize({ width: clampedWidth, height: clampedHeight });
          setPosition({
            x: Math.max(0, Math.min(persistedState.position.x, maxX)),
            y: Math.max(0, Math.min(persistedState.position.y, maxY)),
          });
          setIsMinimized(willBeMinimized);
        } else {
          const actualWidth = constrainToLeft 
            ? Math.min(defaultWidth * 0.7, availableWidth - 40) 
            : defaultWidth;
          const actualHeight = constrainToLeft 
            ? defaultHeight * 0.7 
            : defaultHeight;
          
          const centerX = (availableWidth - actualWidth) / 2;
          const centerY = (window.innerHeight - actualHeight) / 2;
          
          setPosition({ x: Math.max(20, centerX), y: Math.max(60, centerY) });
          setSize({ width: actualWidth, height: actualHeight });
        }
        requestAnimationFrame(() => setIsReady(true));
      }
    }
    
    // Window just closed (via toggle button or any other means)
    if (!isOpen && prevIsOpenRef.current) {
      setIsReady(false);
      setIsMinimized(false);
      // Clean up splitscreen state when window closes while sidebarred
      if (isSidebarred) {
        if (onSplitScreenChange) {
          onSplitScreenChange(false, windowId);
        }
      }
    }
    
    prevIsOpenRef.current = isOpen;
  }, [isOpen, defaultWidth, defaultHeight, windowId, constrainToLeft, isSidebarred, onSplitScreenChange, readPersistedState]);

  // Handle sidebar mode changes - position window in sidebar
  useEffect(() => {
    if (!isOpen) return;

    const wasSidebarred = wasSidebarredRef.current;

    if (!wasSidebarred && isSidebarred) {
      // Save the current floating window geometry before entering sidebar mode.
      previousWindowStateRef.current = {
        position: positionRef.current,
        size: sizeRef.current,
      };
    }

    if (isSidebarred) {
      const updateSidebarPosition = () => {
        const splitPixels = (window.innerWidth * splitPosition) / 100;
        const windowWidth = window.innerWidth - splitPixels;
        setPosition({ x: splitPixels, y: 0 });
        setSize({ width: windowWidth, height: window.innerHeight });
      };
      
      updateSidebarPosition();

      wasSidebarredRef.current = true;
      window.addEventListener('resize', updateSidebarPosition);
      return () => window.removeEventListener('resize', updateSidebarPosition);
    } else {
      // Restore prior floating geometry when exiting sidebar mode.
      if (wasSidebarred) {
        const savedState = previousWindowStateRef.current;
        if (savedState) {
          const bottomBarHeight = 80;
          const maxX = window.innerWidth - savedState.size.width;
          const maxY = window.innerHeight - savedState.size.height - bottomBarHeight;

          setSize(savedState.size);
          setPosition({
            x: Math.max(0, Math.min(savedState.position.x, maxX)),
            y: Math.max(0, Math.min(savedState.position.y, maxY)),
          });
        }
      }
      wasSidebarredRef.current = false;
    }
  }, [splitPosition, isSidebarred, isOpen]);

  // Immediately check and correct position when un-minimizing
  useEffect(() => {
    if (!isMinimized && isOpen && !isSidebarred && isReady) {
      // Check if window is out of bounds and correct it
      const bottomBarHeight = 80;
      const maxX = window.innerWidth - size.width;
      const maxY = window.innerHeight - size.height - bottomBarHeight;
      
      const correctedX = Math.max(0, Math.min(position.x, maxX));
      const correctedY = Math.max(0, Math.min(position.y, maxY));
      
      if (correctedX !== position.x || correctedY !== position.y) {
        setPosition({ x: correctedX, y: correctedY });
      }
    }
  }, [isMinimized, isOpen, isSidebarred, isReady, size.width, size.height, position.x, position.y]);

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

  // Handle split divider resizing (mouse + touch).
  // Layout follows the `--sat-split-pct` CSS variable, so we update that on
  // every move for instant visual feedback. The React state commit is
  // deferred to drag-end so the heavy parent doesn't re-render mid-drag.
  useEffect(() => {
    if (!isSidebarred || !isResizingSplit) return;

    document.body.classList.add("noselect");
    let latestRoundedPosition: number | null = null;

    const updateFromClientX = (clientX: number) => {
      const newPosition = (clientX / window.innerWidth) * 100;
      // Allow the left pane to shrink further so the sidebar can grow up to ~65% of the screen
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
      updateFromClientX(e.touches[0].clientX);
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
  }, [isResizingSplit, isSidebarred, onSplitPositionChange]);

  const beginDragFrom = (clientX: number, clientY: number, target: HTMLElement) => {
    const isHeader = Boolean(target.closest(".window-header"));
    const isInteractiveTarget = Boolean(
      target.closest("button, [role='button'], input, textarea, select, a")
    );

    if (!isSidebarred && isHeader && !isInteractiveTarget) {
      setIsDragging(true);
      const newDragOffset = {
        x: clientX - position.x,
        y: clientY - position.y,
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
    const t = e.touches[0];
    const started = beginDragFrom(t.clientX, t.clientY, e.target as HTMLElement);
    if (started) e.preventDefault();
  };

  const handleResizeStart = (e: React.MouseEvent, edge: string) => {
    if (isSidebarred) return; // Don't allow resizing in sidebar mode
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(edge);
    const startData = {
      x: e.clientX,
      y: e.clientY,
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
    const t = e.touches[0];
    setIsResizing(edge);
    const startData = {
      x: t.clientX,
      y: t.clientY,
      width: size.width,
      height: size.height,
      posX: position.x,
      posY: position.y,
    };
    setResizeStart(startData);
    resizeStartRef.current = startData;
  };

  useEffect(() => {
    // Add/remove noselect class
    if (isDragging || isResizing) {
      document.body.classList.add("noselect");
    } else {
      document.body.classList.remove("noselect");
    }

    const applyMove = (clientX: number, clientY: number) => {
      // Use Refs to access current state inside the closure
      if (isDraggingRef.current) {
        const newX = clientX - dragOffsetRef.current.x;
        const newY = clientY - dragOffsetRef.current.y;
        
        // Keep window fully within viewport bounds (can't go off any edge)
        const currentHeight = isMinimizedRef.current ? 56 : sizeRef.current.height;
        const maxX = window.innerWidth - sizeRef.current.width;
        const minX = 0;
        // Reserve space for the bottom navigation bar (approx 80px)
        const bottomBarHeight = 80;
        const maxY = window.innerHeight - currentHeight - bottomBarHeight;
        
        setPosition({
          x: Math.max(minX, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY)),
        });
      }

      if (isResizingRef.current) {
        const currentResizeStart = resizeStartRef.current;
        const deltaX = clientX - currentResizeStart.x;
        const deltaY = clientY - currentResizeStart.y;
        
        let newWidth = currentResizeStart.width; // Use value from start of resize
        let newHeight = currentResizeStart.height; // Use value from start of resize
        let newX = currentResizeStart.posX;
        let newY = currentResizeStart.posY;

        // Minimum sizes
        const minWidth = 400;
        const minHeight = 300;
        
        // Calculate aspect ratio for locked resizing
        const aspectRatio = currentResizeStart.width / currentResizeStart.height;
        const currentResizingEdge = isResizingRef.current;

        if (lockAspectRatio && diagonalResizeOnly) {
          // Use combined diagonal movement for smooth aspect-ratio-locked resizing
          // Calculate the diagonal delta based on the direction
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
          
          // Ensure minimum height is also respected
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
          // Normal resizing
          if (currentResizingEdge.includes('right')) {
            // Cap width to prevent going off screen right
            // but we need to use the current position x, not the started position x?
            // Actually usually X doesn't change when resizing right.
            const maxWidth = window.innerWidth - currentResizeStart.posX;
            newWidth = Math.max(minWidth, Math.min(currentResizeStart.width + deltaX, maxWidth));
          }
          if (currentResizingEdge.includes('left')) {
            const proposedWidth = currentResizeStart.width - deltaX;
            if (proposedWidth >= minWidth) {
              newWidth = proposedWidth;
              newX = currentResizeStart.posX + deltaX;
            }
          }
          if (currentResizingEdge.includes('bottom')) {
             const maxHeight = window.innerHeight - currentResizeStart.posY;
            newHeight = Math.max(minHeight, Math.min(currentResizeStart.height + deltaY, maxHeight));
          }
          if (currentResizingEdge.includes('top')) {
            const proposedHeight = currentResizeStart.height - deltaY;
            if (proposedHeight >= minHeight) {
              newHeight = proposedHeight;
              newY = currentResizeStart.posY + deltaY;
            }
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
      applyMove(e.touches[0].clientX, e.touches[0].clientY);
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
  }, [isDragging, isResizing, lockAspectRatio, diagonalResizeOnly]);

  const toggleSidebar = () => {
    const newSidebarState = !isSidebarred;
    
    // Auto-maximize when entering splitscreen mode
    if (newSidebarState && isMinimized) {
      setIsMinimized(false);
    }
    
    if (onSidebarToggle) {
      onSidebarToggle(windowId, newSidebarState);
    }
    
    // Notify parent of split screen change
    if (onSplitScreenChange) {
      onSplitScreenChange(newSidebarState, windowId);
    }
  };

  const handleClose = () => {
    // When closing via X button, fully exit sidebar mode
    if (isSidebarred) {
      if (onSidebarToggle) {
        onSidebarToggle(windowId, false);
      }
      if (onSplitScreenChange) {
        onSplitScreenChange(false, windowId);
      }
    }
    setIsMinimized(false);
    onClose();
  };

  if (!isOpen && !keepMountedWhenClosed) return null;

  // Hide window until position is calculated to prevent flash.
  // When sidebarred, drive layout from the --sat-split-pct CSS variable so
  // dragging the split divider repaints instantly without a React render.
  const windowStyle: React.CSSProperties = isSidebarred && !isMaximized
    ? {
        left: "var(--sat-split-pct, 70%)",
        top: 0,
        width: "calc(100vw - var(--sat-split-pct, 70%))",
        height: "100vh",
        zIndex,
        visibility: "visible",
        display: isOpen ? undefined : "none",
      }
    : {
        left: isMaximized ? 0 : position.x,
        top: isMaximized ? 0 : position.y,
        width: isMaximized ? '100vw' : size.width,
        height: isMaximized ? '100vh' : (isMinimized ? '56px' : size.height),
        zIndex: isMaximized ? 100 : zIndex, // Ensure maximized window is on top
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

  // Use portal to render directly to body, bypassing any stacking context issues
  return createPortal(
    <>
      {/* Split Screen Divider - rendered by the sidebarred window */}
      {isSidebarred && (
        <div
          className="fixed inset-y-0 w-4 cursor-col-resize flex items-center justify-center group touch-none"
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
        {/* Resize Handles - hidden when minimized or sidebarred */}
        {!isMinimized && !isSidebarred && (
          <>
            {/* Edge handles - hidden when diagonalResizeOnly is true */}
            {!diagonalResizeOnly && (
              <>
                {/* Top */}
                <div
                  className={cn(resizeHandleClass, "top-0 left-0 right-0 h-1 cursor-n-resize touch-none")}
                  onMouseDown={(e) => handleResizeStart(e, "top")}
                  onTouchStart={(e) => handleResizeTouchStart(e, "top")}
                />
                {/* Bottom */}
                <div
                  className={cn(resizeHandleClass, "bottom-0 left-0 right-0 h-1 cursor-s-resize touch-none")}
                  onMouseDown={(e) => handleResizeStart(e, "bottom")}
                  onTouchStart={(e) => handleResizeTouchStart(e, "bottom")}
                />
                {/* Left */}
                <div
                  className={cn(resizeHandleClass, "left-0 top-0 bottom-0 w-1 cursor-w-resize touch-none")}
                  onMouseDown={(e) => handleResizeStart(e, "left")}
                  onTouchStart={(e) => handleResizeTouchStart(e, "left")}
                />
                {/* Right */}
                <div
                  className={cn(resizeHandleClass, "right-0 top-0 bottom-0 w-1 cursor-e-resize touch-none")}
                  onMouseDown={(e) => handleResizeStart(e, "right")}
                  onTouchStart={(e) => handleResizeTouchStart(e, "right")}
                />
              </>
            )}
            {/* Corner handles - always available */}
            {/* Top-Left Corner */}
            <div
              className={cn(resizeHandleClass, "top-0 left-0 w-3 h-3 cursor-nw-resize touch-none")}
              onMouseDown={(e) => handleResizeStart(e, "top-left")}
              onTouchStart={(e) => handleResizeTouchStart(e, "top-left")}
            />
            {/* Top-Right Corner */}
            <div
              className={cn(resizeHandleClass, "top-0 right-0 w-3 h-3 cursor-ne-resize touch-none")}
              onMouseDown={(e) => handleResizeStart(e, "top-right")}
              onTouchStart={(e) => handleResizeTouchStart(e, "top-right")}
            />
            {/* Bottom-Left Corner */}
            <div
              className={cn(resizeHandleClass, "bottom-0 left-0 w-3 h-3 cursor-sw-resize touch-none")}
              onMouseDown={(e) => handleResizeStart(e, "bottom-left")}
              onTouchStart={(e) => handleResizeTouchStart(e, "bottom-left")}
            />
            {/* Bottom-Right Corner */}
            <div
              className={cn(resizeHandleClass, "bottom-0 right-0 w-3 h-3 cursor-se-resize touch-none")}
              onMouseDown={(e) => handleResizeStart(e, "bottom-right")}
              onTouchStart={(e) => handleResizeTouchStart(e, "bottom-right")}
            />
          </>
        )}

        {/* Window Header */}
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

        {/* Window Content */}
        {!isMinimized && (
          <div className="flex-1 overflow-hidden bg-background">{children}</div>
        )}
      </div>
    </>,
    document.body
  );
};
