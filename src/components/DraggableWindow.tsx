import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Columns2, Minus, Maximize2, ExternalLink } from "lucide-react";
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
  persistenceKey?: string;
  persistenceStorage?: Storage;
  portalContainer?: HTMLElement | null;
  boundsElement?: HTMLElement | null;
  centerOnExitSidebar?: boolean;
  keepMountedWhenClosed?: boolean;
  contentSplitExitPosition?: number;
  sidebarExitMainMaxWidth?: number;
}

interface PersistedWindowState {
  position: { x: number; y: number };
  size: { width: number; height: number };
  isMinimized: boolean;
}

interface WindowRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface SidebarDockAnimation {
  rect: WindowRect;
  transitioning: boolean;
}

const SIDEBAR_SPLIT_MIN = 35;
const SIDEBAR_SPLIT_MAX = 70;
const SIDEBAR_DISMISS_EDGE_MIN_PX = 56;
const SIDEBAR_DISMISS_EDGE_MAX_PX = 128;
const SIDEBAR_DISMISS_EDGE_RATIO = 0.08;
const SIDEBAR_EXIT_MS = 200;
const SIDEBAR_DOCK_MS = 260;
const SIDEBAR_EXIT_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const SIDEBAR_DOCK_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const FLOATING_BOTTOM_GUTTER = 80;
const FLOATING_MIN_WIDTH = 400;
const FLOATING_MIN_HEIGHT = 300;

const getSidebarDismissEdgePx = (width: number) =>
  Math.max(
    SIDEBAR_DISMISS_EDGE_MIN_PX,
    Math.min(SIDEBAR_DISMISS_EDGE_MAX_PX, width * SIDEBAR_DISMISS_EDGE_RATIO),
  );

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
  persistenceKey,
  persistenceStorage = localStorage,
  portalContainer,
  boundsElement,
  centerOnExitSidebar = false,
  keepMountedWhenClosed = false,
  contentSplitExitPosition,
  sidebarExitMainMaxWidth,
}: DraggableWindowProps) => {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const [isSidebarExiting, setIsSidebarExiting] = useState(false);
  const [sidebarExitSplitPosition, setSidebarExitSplitPosition] = useState<number | null>(null);
  const [isSidebarDocking, setIsSidebarDocking] = useState(false);
  const [sidebarDockAnimation, setSidebarDockAnimation] = useState<SidebarDockAnimation | null>(null);
  const prevIsOpenRef = useRef(false);
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
  const getFloatingArea = useCallback(() => {
    const bounds = getBounds();
    return {
      width: Math.max(1, bounds.width),
      height: Math.max(56, bounds.height - FLOATING_BOTTOM_GUTTER),
    };
  }, [getBounds]);
  const clampFloatingRect = useCallback((rect: WindowRect): WindowRect => {
    const area = getFloatingArea();
    const minWidth = Math.min(FLOATING_MIN_WIDTH, area.width);
    const minHeight = Math.min(FLOATING_MIN_HEIGHT, area.height);
    const width = Math.min(Math.max(rect.width, minWidth), area.width);
    const height = Math.min(Math.max(rect.height, minHeight), area.height);
    const maxLeft = Math.max(0, area.width - width);
    const maxTop = Math.max(0, area.height - height);
    return {
      left: Math.max(0, Math.min(rect.left, maxLeft)),
      top: Math.max(0, Math.min(rect.top, maxTop)),
      width,
      height,
    };
  }, [getFloatingArea]);
  const positionRef = useRef(position);
  const sizeRef = useRef(size);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });
  const isMinimizedRef = useRef(isMinimized);
  const isDraggingRef = useRef(isDragging);
  const isResizingRef = useRef(isResizing);
  const sidebarExitTimerRef = useRef<number | null>(null);
  const sidebarDockTimerRef = useRef<number | null>(null);
  const sidebarDockFrameRef = useRef<number | null>(null);
  const isClosingFromSidebarRef = useRef(false);
  const windowRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { sizeRef.current = size; }, [size]);
  useEffect(() => { isMinimizedRef.current = isMinimized; }, [isMinimized]);
  useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);
  useEffect(() => { isResizingRef.current = isResizing; }, [isResizing]);
  const renderAsSidebar = isSidebarred || isSidebarExiting;
  const clearSidebarDockTimer = useCallback(() => {
    if (sidebarDockTimerRef.current !== null) {
      window.clearTimeout(sidebarDockTimerRef.current);
      sidebarDockTimerRef.current = null;
    }
    if (sidebarDockFrameRef.current !== null) {
      window.cancelAnimationFrame(sidebarDockFrameRef.current);
      sidebarDockFrameRef.current = null;
    }
  }, []);

  const getSidebarWindowRect = useCallback((position = splitPosition): WindowRect => {
    const bounds = getBounds();
    const splitPixels = (bounds.width * position) / 100;
    return {
      left: splitPixels,
      top: 0,
      width: bounds.width - splitPixels,
      height: bounds.height,
    };
  }, [getBounds, splitPosition]);

  const getFloatingWindowRect = useCallback((): WindowRect => {
    const savedState = previousWindowStateRef.current ?? {
      position: positionRef.current,
      size: sizeRef.current,
    };
    const area = getFloatingArea();
    const sizedRect = clampFloatingRect({
      left: 0,
      top: 0,
      width: savedState.size.width,
      height: savedState.size.height,
    });
    const maxX = Math.max(0, area.width - sizedRect.width);
    const maxY = Math.max(0, area.height - sizedRect.height);
    const centeredPosition = {
      x: Math.max(0, Math.min((area.width - sizedRect.width) / 2, maxX)),
      y: Math.max(0, Math.min((area.height - sizedRect.height) / 2, maxY)),
    };
    const nextPosition = centerOnExitSidebar
      ? centeredPosition
      : {
          x: Math.max(0, Math.min(savedState.position.x, maxX)),
          y: Math.max(0, Math.min(savedState.position.y, maxY)),
        };

    return clampFloatingRect({
      left: nextPosition.x,
      top: nextPosition.y,
      width: sizedRect.width,
      height: sizedRect.height,
    });
  }, [centerOnExitSidebar, clampFloatingRect, getFloatingArea]);

  const startSidebarDockAnimation = useCallback((targetRect: WindowRect, onDone?: () => void) => {
    clearSidebarDockTimer();
    const sourceDomRect = windowRef.current?.getBoundingClientRect();
    const sourceRect = sourceDomRect
      ? {
          left: sourceDomRect.left,
          top: sourceDomRect.top,
          width: sourceDomRect.width,
          height: sourceDomRect.height,
        }
      : targetRect;
    setIsSidebarDocking(true);
    setSidebarDockAnimation({ rect: sourceRect, transitioning: false });
    sidebarDockFrameRef.current = window.requestAnimationFrame(() => {
      sidebarDockFrameRef.current = null;
      setSidebarDockAnimation({ rect: targetRect, transitioning: true });
    });
    sidebarDockTimerRef.current = window.setTimeout(() => {
      sidebarDockTimerRef.current = null;
      setIsSidebarDocking(false);
      setSidebarDockAnimation(null);
      onDone?.();
    }, SIDEBAR_DOCK_MS + 40);
  }, [clearSidebarDockTimer]);

  const persistCurrentFloatingState = useCallback(() => {
    writePersistedState({
      position: positionRef.current,
      size: sizeRef.current,
      isMinimized: isMinimizedRef.current,
    });
  }, [writePersistedState]);

  const setSplitCssPosition = useCallback((position: number) => {
    document.documentElement.style.setProperty("--sat-split-pct", `${position}%`);
    document.documentElement.style.setProperty("--sat-content-split-pct", `${position}%`);
    document.documentElement.style.setProperty("--sat-nav-split-pct", `${position}%`);
  }, []);

  const setSidebarExitCssPosition = useCallback((sidebarPosition: number, contentPosition: number) => {
    const bounds = getBounds();
    const root = document.documentElement;
    const targetContentWidth = (bounds.width * contentPosition) / 100;
    const targetMainWidth = sidebarExitMainMaxWidth
      ? Math.min(targetContentWidth, sidebarExitMainMaxWidth)
      : targetContentWidth;
    const targetMainOffset = sidebarExitMainMaxWidth
      ? Math.max(0, (bounds.width - targetMainWidth) / 2)
      : 0;
    const targetHeaderWidth = bounds.width;

    root.style.setProperty("--sat-split-pct", `${sidebarPosition}%`);
    root.style.setProperty("--sat-content-split-pct", `${contentPosition}%`);
    root.style.setProperty("--sat-nav-split-pct", "100%");
    root.style.setProperty("--sat-header-content-width", `${targetHeaderWidth}px`);
    root.style.setProperty("--sat-header-content-offset-x", "0px");
    root.style.setProperty("--sat-main-content-width", `${targetMainWidth}px`);
    root.style.setProperty("--sat-main-content-offset-x", `${targetMainOffset}px`);
  }, [getBounds, sidebarExitMainMaxWidth]);

  const releaseSidebarLayoutClose = useCallback(() => {
    window.setTimeout(() => {
      document.body.classList.remove("sat-sidebar-close-active");
    }, 80);
  }, []);

  const startSidebarExit = useCallback((closeOpenWindow: boolean, preservedSplitPosition = splitPosition) => {
    if (sidebarExitTimerRef.current !== null) return;
    document.body.classList.add("sat-sidebar-close-active");
    setSidebarExitCssPosition(preservedSplitPosition, contentSplitExitPosition ?? 100);
    if (onSidebarToggle) {
      onSidebarToggle(windowId, false, closeOpenWindow ? "close" : undefined);
    }
    isClosingFromSidebarRef.current = closeOpenWindow;
    setIsMinimized(false);
    setIsResizingSplit(false);
    setSidebarExitSplitPosition(preservedSplitPosition);
    setIsSidebarExiting(true);
    sidebarExitTimerRef.current = window.setTimeout(() => {
      sidebarExitTimerRef.current = null;
      if (closeOpenWindow) {
        onClose();
      }
      if (!closeOpenWindow) {
        setIsSidebarExiting(false);
      }
      setSidebarExitSplitPosition(null);
      if (onSplitPositionChange) {
        onSplitPositionChange(preservedSplitPosition);
      }
      if (onSplitScreenChange) {
        onSplitScreenChange(false, windowId);
      }
      releaseSidebarLayoutClose();
    }, SIDEBAR_EXIT_MS);
  }, [
    contentSplitExitPosition,
    onSplitPositionChange,
    onClose,
    onSidebarToggle,
    onSplitScreenChange,
    releaseSidebarLayoutClose,
    setSidebarExitCssPosition,
    splitPosition,
    windowId,
  ]);

  const closeWindow = useCallback(() => {
    if (renderAsSidebar) {
      startSidebarExit(true);
      return;
    }
    setIsMinimized(false);
    onClose();
  }, [renderAsSidebar, onClose, startSidebarExit]);

  useEffect(() => {
    return () => {
      if (sidebarExitTimerRef.current !== null) {
        window.clearTimeout(sidebarExitTimerRef.current);
      }
      clearSidebarDockTimer();
      document.body.classList.remove("sat-sidebar-close-active");
    };
  }, [clearSidebarDockTimer]);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      isClosingFromSidebarRef.current = false;
      setIsSidebarExiting(false);
      setSidebarExitSplitPosition(null);
      if (isSidebarred) {
        const persistedState = readPersistedState();
        previousWindowStateRef.current = persistedState
          ? {
              position: persistedState.position,
              size: persistedState.size,
            }
          : {
              position: { x: 100, y: 100 },
              size: { width: defaultWidth, height: defaultHeight },
            };
        openedAsSidebarRef.current = true;
        if (onSplitScreenChange) {
          onSplitScreenChange(true, windowId);
        }
        setIsReady(true);
      } else {
        openedAsSidebarRef.current = false;
        const persistedState = readPersistedState();

        if (persistedState) {
          const willBeMinimized = Boolean(persistedState.isMinimized);
          const nextRect = clampFloatingRect({
            left: persistedState.position.x,
            top: persistedState.position.y,
            width: persistedState.size.width,
            height: persistedState.size.height,
          });
          const minimizedRect = willBeMinimized
            ? clampFloatingRect({ ...nextRect, height: 56 })
            : nextRect;

          setSize({ width: nextRect.width, height: nextRect.height });
          setPosition({ x: minimizedRect.left, y: minimizedRect.top });
          setIsMinimized(willBeMinimized);
        } else {
          const area = getFloatingArea();
          const actualWidth = constrainToLeft
            ? Math.min(defaultWidth * 0.7, Math.max(320, area.width - 40))
            : Math.min(defaultWidth, Math.max(320, area.width - 40));
          const actualHeight = constrainToLeft
            ? Math.min(defaultHeight * 0.7, area.height)
            : Math.min(defaultHeight, Math.max(260, area.height));

          const centerX = (area.width - actualWidth) / 2;
          const centerY = (area.height - actualHeight) / 2;
          const nextRect = clampFloatingRect({
            left: Math.max(20, centerX),
            top: Math.max(60, centerY),
            width: actualWidth,
            height: actualHeight,
          });

          setPosition({ x: nextRect.left, y: nextRect.top });
          setSize({ width: nextRect.width, height: nextRect.height });
        }
        requestAnimationFrame(() => setIsReady(true));
      }
    }
    if (!isOpen && prevIsOpenRef.current) {
      const wasClosingFromSidebar = isClosingFromSidebarRef.current;
      if (!isSidebarred && !wasClosingFromSidebar) {
        persistCurrentFloatingState();
      }
      setIsReady(false);
      setIsMinimized(false);
      setIsSidebarExiting(false);
      setSidebarExitSplitPosition(null);
      if (isSidebarred || wasClosingFromSidebar) {
        if (onSplitScreenChange) {
          onSplitScreenChange(false, windowId);
        }
        if (onSidebarToggle) {
          onSidebarToggle(windowId, false, "close");
        }
      }
      isClosingFromSidebarRef.current = false;
    }

    prevIsOpenRef.current = isOpen;
  }, [isOpen, defaultWidth, defaultHeight, windowId, constrainToLeft, isSidebarred, onSplitScreenChange, onSidebarToggle, readPersistedState, getFloatingArea, clampFloatingRect, persistCurrentFloatingState]);
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
          position: { x: 100, y: 100 },
          size: { width: defaultWidth, height: defaultHeight },
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
        if (isClosingFromSidebarRef.current || isSidebarExiting) {
          wasSidebarredRef.current = false;
          openedAsSidebarRef.current = false;
          return;
        }
        const savedState = previousWindowStateRef.current;
        if (savedState) {
          const area = getFloatingArea();
          const sizedRect = clampFloatingRect({
            left: 0,
            top: 0,
            width: savedState.size.width,
            height: savedState.size.height,
          });
          const maxX = Math.max(0, area.width - sizedRect.width);
          const maxY = Math.max(0, area.height - sizedRect.height);
          const centeredPosition = {
            x: Math.max(0, Math.min((area.width - sizedRect.width) / 2, maxX)),
            y: Math.max(0, Math.min((area.height - sizedRect.height) / 2, maxY)),
          };
          const nextRect = clampFloatingRect({
            left: centerOnExitSidebar ? centeredPosition.x : savedState.position.x,
            top: centerOnExitSidebar ? centeredPosition.y : savedState.position.y,
            width: sizedRect.width,
            height: sizedRect.height,
          });

          setSize({ width: nextRect.width, height: nextRect.height });
          setPosition({ x: nextRect.left, y: nextRect.top });
        }
      }
      wasSidebarredRef.current = false;
      openedAsSidebarRef.current = false;
    }
  }, [splitPosition, isSidebarred, isOpen, isSidebarExiting, getBounds, getFloatingArea, clampFloatingRect, persistCurrentFloatingState, centerOnExitSidebar, defaultWidth, defaultHeight]);
  useEffect(() => {
    if (!isMinimized && isOpen && !renderAsSidebar && isReady) {
      const correctedRect = clampFloatingRect({
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      });

      if (correctedRect.left !== position.x || correctedRect.top !== position.y) {
        setPosition({ x: correctedRect.left, y: correctedRect.top });
      }
      if (correctedRect.width !== size.width || correctedRect.height !== size.height) {
        setSize({ width: correctedRect.width, height: correctedRect.height });
      }
    }
  }, [isMinimized, isOpen, renderAsSidebar, isReady, size.width, size.height, position.x, position.y, clampFloatingRect]);

  useEffect(() => {
    if (!isOpen || renderAsSidebar || !isReady) return;
    const timeoutId = window.setTimeout(() => {
      writePersistedState({
        position,
        size,
        isMinimized,
      });
    }, 200);
    return () => window.clearTimeout(timeoutId);
  }, [isOpen, isReady, renderAsSidebar, position, size, isMinimized, writePersistedState]);
  useEffect(() => {
    if (!isSidebarred || !isResizingSplit) return;

    document.body.classList.add("noselect", "col-resize-active", "col-resize-cursor-active");
    let latestCommitPosition: number | null = null;
    let latestCssPosition: number | null = null;
    let latestClientX: number | null = null;
    let frameId: number | null = null;
    let dismissedDuringDrag = false;
    let keepCursorUntilRelease = false;

    const cancelPendingFrame = () => {
      if (frameId === null) return;
      window.cancelAnimationFrame(frameId);
      frameId = null;
    };

    const releaseCursor = () => {
      keepCursorUntilRelease = false;
      document.body.classList.remove("col-resize-cursor-active");
      window.removeEventListener("mouseup", releaseCursor);
      window.removeEventListener("touchend", releaseCursor);
      window.removeEventListener("touchcancel", releaseCursor);
    };

    const releaseCursorOnPointerUp = () => {
      if (keepCursorUntilRelease) return;
      keepCursorUntilRelease = true;
      window.addEventListener("mouseup", releaseCursor, { once: true });
      window.addEventListener("touchend", releaseCursor, { once: true });
      window.addEventListener("touchcancel", releaseCursor, { once: true });
    };

    const startSidebarDismiss = () => {
      if (dismissedDuringDrag) return;
      dismissedDuringDrag = true;
      cancelPendingFrame();
      document.body.classList.remove("noselect", "col-resize-active");
      startSidebarExit(true, latestCssPosition ?? latestCommitPosition ?? splitPosition);
      releaseCursorOnPointerUp();
    };

    const applyClientX = (clientX: number) => {
      const bounds = getBounds();
      const point = getBoundsPoint(clientX, 0);
      if (point.x >= bounds.width - getSidebarDismissEdgePx(bounds.width)) {
        startSidebarDismiss();
        return;
      }
      const newPosition = (point.x / bounds.width) * 100;
      const clampedPosition = Math.max(SIDEBAR_SPLIT_MIN, Math.min(SIDEBAR_SPLIT_MAX, newPosition));
      const cssPosition = Math.round(clampedPosition * 100) / 100;
      latestCommitPosition = Math.round(clampedPosition * 4) / 4;
      if (latestCssPosition === cssPosition) return;
      latestCssPosition = cssPosition;
      setSplitCssPosition(cssPosition);
    };

    const updateFromClientX = (clientX: number) => {
      latestClientX = clientX;
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        if (latestClientX === null || dismissedDuringDrag) return;
        applyClientX(latestClientX);
      });
    };

    const handleMouseMove = (e: MouseEvent) => updateFromClientX(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      e.preventDefault();
      const touch = e.touches[0];
      updateFromClientX(touch.clientX);
    };

    const stop = () => {
      if (dismissedDuringDrag) return;
      cancelPendingFrame();
      if (latestClientX !== null) {
        applyClientX(latestClientX);
      }
      if (dismissedDuringDrag) return;
      setIsResizingSplit(false);
      document.body.classList.remove("noselect", "col-resize-active", "col-resize-cursor-active");
      if (onSidebarToggle) {
        onSidebarToggle(windowId, true);
      }
      if (onSplitScreenChange) {
        onSplitScreenChange(true, windowId);
      }
      if (latestCommitPosition !== null && onSplitPositionChange) {
        onSplitPositionChange(latestCommitPosition);
      }
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
      cancelPendingFrame();
      document.body.classList.remove("noselect", "col-resize-active");
      if (!keepCursorUntilRelease) document.body.classList.remove("col-resize-cursor-active");
    };
  }, [isResizingSplit, isSidebarred, onSplitPositionChange, getBounds, getBoundsPoint, setSplitCssPosition, splitPosition, startSidebarExit]);

  const beginDragFrom = (clientX: number, clientY: number, target: HTMLElement) => {
    const isHeader = Boolean(target.closest(".window-header"));
    const isInteractiveTarget = Boolean(
      target.closest("button, [role='button'], input, textarea, select, a")
    );

    if (!isSidebarred && !isSidebarExiting && isHeader && !isInteractiveTarget) {
      setIsDragging(true);
      const point = getBoundsPoint(clientX, clientY);
      const newDragOffset = {
        x: point.x - position.x,
        y: point.y - position.y,
      };
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
    if (isSidebarred || isSidebarExiting) return;
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
    resizeStartRef.current = startData;
  };

  const handleResizeTouchStart = (e: React.TouchEvent, edge: string) => {
    if (isSidebarred || isSidebarExiting) return;
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
    resizeStartRef.current = startData;
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      document.body.classList.add("noselect");
    } else {
      document.body.classList.remove("noselect");
    }
    if (isDragging) {
      document.body.classList.add("window-drag-active");
    } else {
      document.body.classList.remove("window-drag-active");
    }

    const applyMove = (clientX: number, clientY: number) => {
      const point = getBoundsPoint(clientX, clientY);
      if (isDraggingRef.current) {
        const newX = point.x - dragOffsetRef.current.x;
        const newY = point.y - dragOffsetRef.current.y;
        const currentHeight = isMinimizedRef.current ? 56 : sizeRef.current.height;
        const nextRect = clampFloatingRect({
          left: newX,
          top: newY,
          width: sizeRef.current.width,
          height: currentHeight,
        });

        setPosition({ x: nextRect.left, y: nextRect.top });
        if (!isMinimizedRef.current && (nextRect.width !== sizeRef.current.width || nextRect.height !== sizeRef.current.height)) {
          setSize({ width: nextRect.width, height: nextRect.height });
        }
      }

      if (isResizingRef.current) {
        const currentResizeStart = resizeStartRef.current;
        const deltaX = point.x - currentResizeStart.x;
        const deltaY = point.y - currentResizeStart.y;

        let newWidth = currentResizeStart.width;
        let newHeight = currentResizeStart.height;
        let newX = currentResizeStart.posX;
        let newY = currentResizeStart.posY;
        const area = getFloatingArea();
        const minWidth = Math.min(FLOATING_MIN_WIDTH, area.width);
        const minHeight = Math.min(FLOATING_MIN_HEIGHT, area.height);
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
          if (currentResizingEdge.includes('right')) {
            const maxWidth = area.width - currentResizeStart.posX;
            newWidth = Math.max(minWidth, Math.min(currentResizeStart.width + deltaX, maxWidth));
          }
          if (currentResizingEdge.includes('left')) {
            const proposedWidth = currentResizeStart.width - deltaX;
            newWidth = Math.max(minWidth, proposedWidth);
            newX = currentResizeStart.posX + currentResizeStart.width - newWidth;
          }
          if (currentResizingEdge.includes('bottom')) {
             const maxHeight = area.height - currentResizeStart.posY;
            newHeight = Math.max(minHeight, Math.min(currentResizeStart.height + deltaY, maxHeight));
          }
          if (currentResizingEdge.includes('top')) {
            const proposedHeight = currentResizeStart.height - deltaY;
            newHeight = Math.max(minHeight, proposedHeight);
            newY = currentResizeStart.posY + currentResizeStart.height - newHeight;
          }
        }

        const nextRect = clampFloatingRect({
          left: newX,
          top: newY,
          width: newWidth,
          height: newHeight,
        });

        setSize({ width: nextRect.width, height: nextRect.height });
        setPosition({ x: nextRect.left, y: nextRect.top });
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
      document.body.classList.remove("noselect", "window-drag-active");
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
      document.body.classList.remove("window-drag-active");
    };
  }, [isDragging, isResizing, lockAspectRatio, diagonalResizeOnly, getBoundsPoint, getFloatingArea, clampFloatingRect]);

  const toggleSidebar = () => {
    const newSidebarState = !isSidebarred;
    isClosingFromSidebarRef.current = false;
    if (!newSidebarState && renderAsSidebar) {
      setIsMinimized(false);
      const targetRect = getFloatingWindowRect();
      setSidebarExitCssPosition(splitPosition, contentSplitExitPosition ?? 100);
      setSize({ width: targetRect.width, height: targetRect.height });
      setPosition({ x: targetRect.left, y: targetRect.top });
      startSidebarDockAnimation(targetRect, () => {
        if (onSplitScreenChange) {
          onSplitScreenChange(false, windowId);
        }
      });
      if (onSidebarToggle) {
        onSidebarToggle(windowId, false);
      }
      return;
    }
    if (newSidebarState && isMinimized) {
      setIsMinimized(false);
    }

    const targetRect = getSidebarWindowRect();
    startSidebarDockAnimation(targetRect);
    if (onSidebarToggle) {
      onSidebarToggle(windowId, newSidebarState);
    }
    if (onSplitScreenChange && newSidebarState) {
      onSplitScreenChange(newSidebarState, windowId);
    }
  };

  const handleClose = closeWindow;

  if (!isOpen && !keepMountedWhenClosed) return null;
  const effectiveSidebarSplitPosition =
    isSidebarExiting && sidebarExitSplitPosition !== null
      ? sidebarExitSplitPosition
      : splitPosition;
  const sidebarDockTransition = sidebarDockAnimation?.transitioning
    ? [
        `left ${SIDEBAR_DOCK_MS}ms ${SIDEBAR_DOCK_EASING}`,
        `top ${SIDEBAR_DOCK_MS}ms ${SIDEBAR_DOCK_EASING}`,
        `width ${SIDEBAR_DOCK_MS}ms ${SIDEBAR_DOCK_EASING}`,
        `height ${SIDEBAR_DOCK_MS}ms ${SIDEBAR_DOCK_EASING}`,
        `border-radius ${SIDEBAR_DOCK_MS}ms ${SIDEBAR_DOCK_EASING}`,
      ].join(", ")
    : undefined;
  const windowStyle: React.CSSProperties = sidebarDockAnimation
    ? {
        left: sidebarDockAnimation.rect.left,
        top: sidebarDockAnimation.rect.top,
        width: sidebarDockAnimation.rect.width,
        height: sidebarDockAnimation.rect.height,
        zIndex,
        visibility: "visible",
        display: isOpen ? undefined : "none",
        transition: sidebarDockTransition ?? "none",
        willChange: "left, top, width, height, border-radius",
        pointerEvents: "none",
      }
    : renderAsSidebar
    ? {
        left: `var(--sat-split-pct, ${effectiveSidebarSplitPosition}%)`,
        top: 0,
        width: `calc(100% - var(--sat-split-pct, ${effectiveSidebarSplitPosition}%))`,
        height: "100%",
        zIndex,
        visibility: "visible",
        display: isOpen ? undefined : "none",
        opacity: isSidebarExiting ? 0 : 1,
        transform: isSidebarExiting ? "translateX(100%)" : "translateX(0)",
        transition: isResizingSplit
          ? "none"
          : isSidebarExiting
            ? `transform ${SIDEBAR_EXIT_MS}ms ${SIDEBAR_EXIT_EASING}, opacity ${SIDEBAR_EXIT_MS}ms ease-out`
            : sidebarDockTransition,
        willChange: isSidebarDocking ? "left, top, width, height, border-radius" : "transform, opacity",
        pointerEvents: isSidebarDocking ? "none" : undefined,
      }
    : {
        left: position.x,
        top: position.y,
        width: size.width,
        height: isMinimized ? '56px' : size.height,
        zIndex,
        visibility: isReady ? 'visible' : 'hidden',
        display: isOpen ? undefined : 'none',
        transition: sidebarDockTransition,
        willChange: isSidebarDocking ? "left, top, width, height, border-radius" : undefined,
        pointerEvents: isSidebarDocking ? "none" : undefined,
      };

  const resizeHandleClass = "absolute bg-transparent hover:bg-primary/20 transition-colors z-10";

  const handleNativeDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    if (target.closest(".window-header")) {
      e.preventDefault();
    }
  };

  const targetPortalContainer = portalContainer ?? document.body;
  const topLeftResizeCornerStyle: React.CSSProperties = {
    clipPath: "polygon(0 0, 100% 0, 100% 25%, 25% 25%, 25% 100%, 0 100%)",
  };
  const topRightResizeCornerStyle: React.CSSProperties = {
    clipPath: "polygon(0 0, 100% 0, 100% 100%, 75% 100%, 75% 25%, 0 25%)",
  };
  const bottomLeftResizeCornerStyle: React.CSSProperties = {
    clipPath: "polygon(0 0, 25% 0, 25% 75%, 100% 75%, 100% 100%, 0 100%)",
  };
  const bottomRightResizeCornerStyle: React.CSSProperties = {
    clipPath: "polygon(75% 0, 100% 0, 100% 100%, 0 100%, 0 75%, 75% 75%)",
  };

  return createPortal(
    <>
      {isSidebarred && isOpen && !isSidebarExiting && !isSidebarDocking && (
        <div
          className={cn(
            "fixed bottom-0 top-0 w-4 cursor-col-resize flex items-center justify-center group touch-none",
            isResizingSplit && "pointer-events-none",
          )}
          style={{
            left: `calc(var(--sat-split-pct, ${splitPosition}%) - 8px)`,
            zIndex: zIndex + 10 // Always above this window
          }}
          onMouseDown={() => {
            setIsResizingSplit(true);
          }}
          onTouchStart={(e) => {
            if (e.touches.length === 0) return;
            e.preventDefault();
            setIsResizingSplit(true);
          }}
        >
          <div className={cn("w-1 h-full", isResizingSplit ? "bg-primary/50 transition-none" : "bg-border transition-colors group-hover:bg-primary/50")} />
        </div>
      )}

      <div
        ref={windowRef}
        data-window-id={windowId}
        data-tour={`window-${windowId}`}
        className={cn(
          "fixed bg-card border-2 border-border rounded-lg shadow-2xl flex flex-col overflow-hidden",
          isDragging ? "cursor-grabbing" : "",
          renderAsSidebar ? "pointer-events-auto rounded-none border-l-2 border-t-0 border-r-0 border-b-0" : ""
        )}
        style={windowStyle}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDragStart={handleNativeDragStart}
      >
        {!isMinimized && !renderAsSidebar && (
          <>
            {!diagonalResizeOnly && (
              <>
                <div
                  className={cn(resizeHandleClass, "top-0 left-0 right-0 h-2 cursor-n-resize touch-none")}
                  onMouseDown={(e) => handleResizeStart(e, "top")}
                  onTouchStart={(e) => handleResizeTouchStart(e, "top")}
                />
                <div
                  className={cn(resizeHandleClass, "bottom-0 left-0 right-0 h-2 cursor-s-resize touch-none")}
                  onMouseDown={(e) => handleResizeStart(e, "bottom")}
                  onTouchStart={(e) => handleResizeTouchStart(e, "bottom")}
                />
                <div
                  className={cn(resizeHandleClass, "left-0 top-0 bottom-0 w-2 cursor-w-resize touch-none")}
                  onMouseDown={(e) => handleResizeStart(e, "left")}
                  onTouchStart={(e) => handleResizeTouchStart(e, "left")}
                />
                <div
                  className={cn(resizeHandleClass, "right-0 top-0 bottom-0 w-2 cursor-e-resize touch-none")}
                  onMouseDown={(e) => handleResizeStart(e, "right")}
                  onTouchStart={(e) => handleResizeTouchStart(e, "right")}
                />
              </>
            )}
            <div
              className={cn(resizeHandleClass, "top-0 left-0 h-8 w-8 cursor-nw-resize touch-none")}
              style={topLeftResizeCornerStyle}
              onMouseDown={(e) => handleResizeStart(e, "top-left")}
              onTouchStart={(e) => handleResizeTouchStart(e, "top-left")}
            />
            <div
              className={cn(resizeHandleClass, "top-0 right-0 h-8 w-8 cursor-ne-resize touch-none")}
              style={topRightResizeCornerStyle}
              onMouseDown={(e) => handleResizeStart(e, "top-right")}
              onTouchStart={(e) => handleResizeTouchStart(e, "top-right")}
            />
            <div
              className={cn(resizeHandleClass, "bottom-0 left-0 h-8 w-8 cursor-sw-resize touch-none")}
              style={bottomLeftResizeCornerStyle}
              onMouseDown={(e) => handleResizeStart(e, "bottom-left")}
              onTouchStart={(e) => handleResizeTouchStart(e, "bottom-left")}
            />
            <div
              className={cn(resizeHandleClass, "bottom-0 right-0 h-8 w-8 cursor-se-resize touch-none")}
              style={bottomRightResizeCornerStyle}
              onMouseDown={(e) => handleResizeStart(e, "bottom-right")}
              onTouchStart={(e) => handleResizeTouchStart(e, "bottom-right")}
            />
          </>
        )}

        <div className={cn(
          "window-header flex select-none items-center justify-between px-4 py-3 bg-muted border-b border-border",
          renderAsSidebar ? "cursor-default" : "cursor-grab active:cursor-grabbing"
        )}>
          <div className="flex min-w-0 items-center gap-2">
            {enableSplitScreen && (
              <Button
                variant="ghost"
                size="icon"
                className="group relative h-8 w-8 shrink-0 overflow-visible hover:bg-transparent"
                onClick={toggleSidebar}
                data-tour={`sidebar-toggle-${windowId}`}
                title={renderAsSidebar ? "Pop out" : "Dock to sidebar"}
                aria-label={renderAsSidebar ? "Pop out" : "Dock to sidebar"}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute h-6 w-6 rounded-md bg-primary/15 opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100",
                    renderAsSidebar ? "left-[3px] top-[5px]" : "left-1 top-1"
                  )}
                />
                {renderAsSidebar ? <ExternalLink className="relative z-10 h-4 w-4" /> : <Columns2 className="relative z-10 h-4 w-4" />}
              </Button>
            )}
            <h3 className="truncate font-semibold text-foreground">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            {!renderAsSidebar && (
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
