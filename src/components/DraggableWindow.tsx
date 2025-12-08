import { useState, useRef, useEffect } from "react";
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
  windowId?: string;
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
  windowId = "default",
}: DraggableWindowProps) => {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [isSplitScreen, setIsSplitScreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Center the window when opened
      const centerX = (window.innerWidth - defaultWidth) / 2;
      const centerY = (window.innerHeight - defaultHeight) / 2;
      setPosition({ x: Math.max(0, centerX), y: Math.max(0, centerY) });
      setSize({ width: defaultWidth, height: defaultHeight });
      setIsSplitScreen(false);
      if (onSplitScreenChange) {
        onSplitScreenChange(false, windowId);
      }
    }
  }, [isOpen, defaultWidth, defaultHeight, windowId]);

  const handleMouseDown = (e: React.MouseEvent) => {
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
        
        // Keep window within viewport bounds
        const currentHeight = isMinimized ? 56 : size.height;
        // Ensure at least 100px of window width stays visible horizontally
        const minVisibleWidth = 100;
        const maxX = window.innerWidth - minVisibleWidth;
        const minX = -(size.width - minVisibleWidth);
        const maxY = window.innerHeight - currentHeight;
        
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

  // Update window position when split position changes
  useEffect(() => {
    if (isSplitScreen && isOpen) {
      const splitPixels = (window.innerWidth * splitPosition) / 100;
      const windowWidth = window.innerWidth - splitPixels;
      setPosition({ x: splitPixels, y: 0 });
      setSize({ width: windowWidth, height: window.innerHeight });
    }
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

  const resizeHandleClass = "absolute bg-transparent hover:bg-primary/20 transition-colors z-10";

  return (
    <div
      ref={windowRef}
      className={cn(
        "fixed bg-card border-2 border-border rounded-lg shadow-2xl flex flex-col overflow-hidden z-50",
        isDragging ? "cursor-grabbing" : "",
        isSplitScreen ? "pointer-events-auto" : ""
      )}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: isMinimized ? '56px' : size.height,
      }}
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
