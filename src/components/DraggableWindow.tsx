import { useState, useRef, useEffect, useCallback } from "react";
import { X, Columns2, Minus, Maximize2 } from "lucide-react";
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
  enableSplitScreen?: boolean;
  diagonalResizeOnly?: boolean;
  lockAspectRatio?: boolean;
  windowId?: string;
  onFocus?: () => void;
  zIndex?: number;
  constrainToLeft?: number; // Percentage of screen to constrain window to (when something else is sidebarred)
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
  enableSplitScreen = true,
  diagonalResizeOnly = false,
  lockAspectRatio = false,
  windowId = "default",
  onFocus,
  zIndex = 50,
  constrainToLeft,
}: DraggableWindowProps) => {
const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [isSplitScreen, setIsSplitScreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });
  const [isReady, setIsReady] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);
  const wasSplitScreenRef = useRef(false);
  const prevIsOpenRef = useRef(false);

  // Calculate initial position and size when window opens
  useEffect(() => {
    // Window just opened
    if (isOpen && !prevIsOpenRef.current) {
      const availableWidth = constrainToLeft 
        ? (window.innerWidth * constrainToLeft) / 100 
        : window.innerWidth;
      
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
      // Always reset to non-split-screen when opening
      setIsSplitScreen(false);
      wasSplitScreenRef.current = false;
      // Show window after position is set
      requestAnimationFrame(() => setIsReady(true));
    }
    
    // Window just closed
    if (!isOpen && prevIsOpenRef.current) {
      setIsReady(false);
      // Clean up split-screen state when window closes
      if (wasSplitScreenRef.current && onSplitScreenChange) {
        onSplitScreenChange(false, windowId);
      }
      wasSplitScreenRef.current = false;
    }
    
    prevIsOpenRef.current = isOpen;
  }, [isOpen, defaultWidth, defaultHeight, windowId, constrainToLeft, onSplitScreenChange]);

  // Track split screen state changes
  useEffect(() => {
    wasSplitScreenRef.current = isSplitScreen;
  }, [isSplitScreen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Bring window to front on any click
    if (onFocus) {
      onFocus();
    }
    
    if (!isSplitScreen && (e.target as HTMLElement).closest(".window-header")) {
      // Allow dragging even when minimized
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleResizeStart = (e: React.MouseEvent, edge: string) => {
    if (isSplitScreen) return; // Don't allow resizing in split screen mode
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(edge);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
      posX: position.x,
      posY: position.y,
    });
  };

  useEffect(() => {
    // Add/remove noselect class
    if (isDragging || isResizing) {
      document.body.classList.add("noselect");
    } else {
      document.body.classList.remove("noselect");
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;
        
        // Keep window fully within viewport bounds (can't go off any edge)
        const currentHeight = isMinimized ? 56 : size.height;
        const maxX = window.innerWidth - size.width;
        const minX = 0;
        // Reserve space for the bottom navigation bar (approx 80px)
        const bottomBarHeight = 80;
        const maxY = window.innerHeight - currentHeight - bottomBarHeight;
        
        setPosition({
          x: Math.max(minX, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY)),
        });
      }

      if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        
        let newWidth = size.width;
        let newHeight = size.height;
        let newX = position.x;
        let newY = position.y;

        // Minimum sizes
        const minWidth = 400;
        const minHeight = 300;
        
        // Calculate aspect ratio for locked resizing
        const aspectRatio = resizeStart.width / resizeStart.height;

        if (lockAspectRatio && diagonalResizeOnly) {
          // Use combined diagonal movement for smooth aspect-ratio-locked resizing
          // Calculate the diagonal delta based on the direction
          let diagonalDelta = 0;
          
          if (isResizing.includes('right') && isResizing.includes('bottom')) {
            diagonalDelta = (deltaX + deltaY) / 2;
            newWidth = Math.max(minWidth, resizeStart.width + diagonalDelta * 1.5);
            newHeight = newWidth / aspectRatio;
          } else if (isResizing.includes('left') && isResizing.includes('bottom')) {
            diagonalDelta = (-deltaX + deltaY) / 2;
            newWidth = Math.max(minWidth, resizeStart.width + diagonalDelta * 1.5);
            newHeight = newWidth / aspectRatio;
            newX = resizeStart.posX + resizeStart.width - newWidth;
          } else if (isResizing.includes('right') && isResizing.includes('top')) {
            diagonalDelta = (deltaX - deltaY) / 2;
            newWidth = Math.max(minWidth, resizeStart.width + diagonalDelta * 1.5);
            newHeight = newWidth / aspectRatio;
            newY = resizeStart.posY + resizeStart.height - newHeight;
          } else if (isResizing.includes('left') && isResizing.includes('top')) {
            diagonalDelta = (-deltaX - deltaY) / 2;
            newWidth = Math.max(minWidth, resizeStart.width + diagonalDelta * 1.5);
            newHeight = newWidth / aspectRatio;
            newX = resizeStart.posX + resizeStart.width - newWidth;
            newY = resizeStart.posY + resizeStart.height - newHeight;
          }
          
          // Ensure minimum height is also respected
          if (newHeight < minHeight) {
            newHeight = minHeight;
            newWidth = newHeight * aspectRatio;
            if (isResizing.includes('left')) {
              newX = resizeStart.posX + resizeStart.width - newWidth;
            }
            if (isResizing.includes('top')) {
              newY = resizeStart.posY + resizeStart.height - newHeight;
            }
          }
        } else {
          // Normal resizing
          if (isResizing.includes('right')) {
            newWidth = Math.max(minWidth, Math.min(resizeStart.width + deltaX, window.innerWidth - position.x));
          }
          if (isResizing.includes('left')) {
            const proposedWidth = resizeStart.width - deltaX;
            if (proposedWidth >= minWidth) {
              newWidth = proposedWidth;
              newX = resizeStart.posX + deltaX;
            }
          }
          if (isResizing.includes('bottom')) {
            newHeight = Math.max(minHeight, Math.min(resizeStart.height + deltaY, window.innerHeight - position.y));
          }
          if (isResizing.includes('top')) {
            const proposedHeight = resizeStart.height - deltaY;
            if (proposedHeight >= minHeight) {
              newHeight = proposedHeight;
              newY = resizeStart.posY + deltaY;
            }
          }
        }

        setSize({ width: newWidth, height: newHeight });
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(null);
      document.body.classList.remove("noselect");
    };

    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, position, size, resizeStart]);

  // Update window position when split position changes OR viewport resizes
  useEffect(() => {
    if (!isSplitScreen || !isOpen) return;
    
    const updateSplitPosition = () => {
      const splitPixels = (window.innerWidth * splitPosition) / 100;
      const windowWidth = window.innerWidth - splitPixels;
      setPosition({ x: splitPixels, y: 0 });
      setSize({ width: windowWidth, height: window.innerHeight });
    };
    
    updateSplitPosition();
    
    // Listen for viewport resize to update split screen windows
    window.addEventListener('resize', updateSplitPosition);
    return () => window.removeEventListener('resize', updateSplitPosition);
  }, [splitPosition, isSplitScreen, isOpen]);

  const toggleSplitScreen = () => {
    const newSplitState = !isSplitScreen;
    setIsSplitScreen(newSplitState);
    
    if (newSplitState) {
      // Enable split screen - start at 50%
      const halfWidth = window.innerWidth * 0.5;
      setPosition({ x: halfWidth, y: 0 });
      setSize({ width: halfWidth, height: window.innerHeight });
    } else {
      // Disable split screen - return to center
      const centerX = (window.innerWidth - defaultWidth) / 2;
      const centerY = (window.innerHeight - defaultHeight) / 2;
      setPosition({ x: Math.max(0, centerX), y: Math.max(0, centerY) });
      setSize({ width: defaultWidth, height: defaultHeight });
    }
    
    // Notify parent component
    if (onSplitScreenChange) {
      onSplitScreenChange(newSplitState, windowId);
    }
  };

  if (!isOpen) return null;

  // Hide window until position is calculated to prevent flash
  const windowStyle = {
    left: position.x,
    top: position.y,
    width: size.width,
    height: isMinimized ? '56px' : size.height,
    zIndex: zIndex,
    visibility: isReady || isSplitScreen ? 'visible' as const : 'hidden' as const,
  };

  const resizeHandleClass = "absolute bg-transparent hover:bg-primary/20 transition-colors z-10";

  return (
    <div
      ref={windowRef}
      className={cn(
        "fixed bg-card border-2 border-border rounded-lg shadow-2xl flex flex-col overflow-hidden",
        isDragging ? "cursor-grabbing" : "",
        isSplitScreen ? "pointer-events-auto" : ""
      )}
      style={windowStyle}
      onMouseDown={handleMouseDown}
    >
      {/* Resize Handles - hidden when minimized */}
      {!isMinimized && (
        <>
          {/* Edge handles - hidden when diagonalResizeOnly is true */}
          {!diagonalResizeOnly && (
            <>
              {/* Top */}
              <div
                className={cn(resizeHandleClass, "top-0 left-0 right-0 h-1 cursor-n-resize")}
                onMouseDown={(e) => handleResizeStart(e, "top")}
              />
              {/* Bottom */}
              <div
                className={cn(resizeHandleClass, "bottom-0 left-0 right-0 h-1 cursor-s-resize")}
                onMouseDown={(e) => handleResizeStart(e, "bottom")}
              />
              {/* Left */}
              <div
                className={cn(resizeHandleClass, "left-0 top-0 bottom-0 w-1 cursor-w-resize")}
                onMouseDown={(e) => handleResizeStart(e, "left")}
              />
              {/* Right */}
              <div
                className={cn(resizeHandleClass, "right-0 top-0 bottom-0 w-1 cursor-e-resize")}
                onMouseDown={(e) => handleResizeStart(e, "right")}
              />
            </>
          )}
          {/* Corner handles - always available */}
          {/* Top-Left Corner */}
          <div
            className={cn(resizeHandleClass, "top-0 left-0 w-3 h-3 cursor-nw-resize")}
            onMouseDown={(e) => handleResizeStart(e, "top-left")}
          />
          {/* Top-Right Corner */}
          <div
            className={cn(resizeHandleClass, "top-0 right-0 w-3 h-3 cursor-ne-resize")}
            onMouseDown={(e) => handleResizeStart(e, "top-right")}
          />
          {/* Bottom-Left Corner */}
          <div
            className={cn(resizeHandleClass, "bottom-0 left-0 w-3 h-3 cursor-sw-resize")}
            onMouseDown={(e) => handleResizeStart(e, "bottom-left")}
          />
          {/* Bottom-Right Corner */}
          <div
            className={cn(resizeHandleClass, "bottom-0 right-0 w-3 h-3 cursor-se-resize")}
            onMouseDown={(e) => handleResizeStart(e, "bottom-right")}
          />
        </>
      )}

      {/* Window Header */}
      <div className={cn(
        "window-header flex items-center justify-between px-4 py-3 bg-muted border-b border-border",
        isSplitScreen ? "cursor-default" : "cursor-grab active:cursor-grabbing"
      )}>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <div className="flex items-center gap-2">
          {enableSplitScreen && (
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", isSplitScreen && "bg-primary/20")}
              onClick={toggleSplitScreen}
              title={isSplitScreen ? "Exit split screen" : "Split screen"}
            >
              <Columns2 className="h-4 w-4" />
            </Button>
          )}
          {!isSplitScreen && (
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", isMinimized && "bg-primary/20")}
              onClick={() => setIsMinimized(!isMinimized)}
              title={isMinimized ? "Maximize" : "Minimize"}
            >
              {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              if (isSplitScreen && onSplitScreenChange) {
                onSplitScreenChange(false, windowId);
              }
              setIsSplitScreen(false);
              setIsMinimized(false);
              onClose();
            }}
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
  );
};
