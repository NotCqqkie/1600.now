import { useState, useRef, useEffect } from "react";
import { X, Columns2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DraggableWindowProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
  onSplitScreenChange?: (isSplit: boolean) => void;
  splitPosition?: number;
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
}: DraggableWindowProps) => {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight });
  const [isSplitScreen, setIsSplitScreen] = useState(false);
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
        onSplitScreenChange(false);
      }
    }
  }, [isOpen, defaultWidth, defaultHeight, onSplitScreenChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isSplitScreen && (e.target as HTMLElement).closest(".window-header")) {
      e.preventDefault();
      const offsetX = e.clientX - position.x;
      const offsetY = e.clientY - position.y;
      
      const handleMouseMove = (moveEvent: MouseEvent) => {
        const newX = moveEvent.clientX - offsetX;
        const newY = moveEvent.clientY - offsetY;
        
        // Keep window within viewport bounds
        const maxX = window.innerWidth - size.width;
        const maxY = window.innerHeight - size.height;
        
        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY)),
        });
      };
      
      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  };

  const handleResizeStart = (e: React.MouseEvent, edge: string) => {
    if (isSplitScreen) return; // Don't allow resizing in split screen mode
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;
    const startPosX = position.x;
    const startPosY = position.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startPosX;
      let newY = startPosY;

      // Minimum sizes
      const minWidth = 400;
      const minHeight = 300;

      if (edge.includes('right')) {
        newWidth = Math.max(minWidth, Math.min(startWidth + deltaX, window.innerWidth - startPosX));
      }
      if (edge.includes('left')) {
        const proposedWidth = startWidth - deltaX;
        if (proposedWidth >= minWidth) {
          newWidth = proposedWidth;
          newX = startPosX + deltaX;
        }
      }
      if (edge.includes('bottom')) {
        newHeight = Math.max(minHeight, Math.min(startHeight + deltaY, window.innerHeight - startPosY));
      }
      if (edge.includes('top')) {
        const proposedHeight = startHeight - deltaY;
        if (proposedHeight >= minHeight) {
          newHeight = proposedHeight;
          newY = startPosY + deltaY;
        }
      }

      setSize({ width: newWidth, height: newHeight });
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

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
      onSplitScreenChange(newSplitState);
    }
  };

  if (!isOpen) return null;

  const resizeHandleClass = "absolute bg-transparent hover:bg-primary/20 transition-colors";

  return (
    <div
      ref={windowRef}
      className={cn(
        "fixed bg-card border-2 border-border rounded-lg shadow-2xl flex flex-col overflow-hidden z-50",
        isSplitScreen ? "pointer-events-auto" : ""
      )}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Resize Handles - Only show when NOT in split screen mode */}
      {!isSplitScreen && (
        <>
          {/* Top */}
          <div
            className={cn(resizeHandleClass, "top-0 left-0 right-0 h-2 cursor-n-resize z-20")}
            onMouseDown={(e) => handleResizeStart(e, "top")}
          />
          {/* Bottom */}
          <div
            className={cn(resizeHandleClass, "bottom-0 left-0 right-0 h-2 cursor-s-resize z-20")}
            onMouseDown={(e) => handleResizeStart(e, "bottom")}
          />
          {/* Left */}
          <div
            className={cn(resizeHandleClass, "left-0 top-0 bottom-0 w-2 cursor-w-resize z-20")}
            onMouseDown={(e) => handleResizeStart(e, "left")}
          />
          {/* Right */}
          <div
            className={cn(resizeHandleClass, "right-0 top-0 bottom-0 w-2 cursor-e-resize z-20")}
            onMouseDown={(e) => handleResizeStart(e, "right")}
          />
          {/* Top-Left Corner */}
          <div
            className={cn(resizeHandleClass, "top-0 left-0 w-4 h-4 cursor-nw-resize z-20")}
            onMouseDown={(e) => handleResizeStart(e, "top-left")}
          />
          {/* Top-Right Corner */}
          <div
            className={cn(resizeHandleClass, "top-0 right-0 w-4 h-4 cursor-ne-resize z-20")}
            onMouseDown={(e) => handleResizeStart(e, "top-right")}
          />
          {/* Bottom-Left Corner */}
          <div
            className={cn(resizeHandleClass, "bottom-0 left-0 w-4 h-4 cursor-sw-resize z-20")}
            onMouseDown={(e) => handleResizeStart(e, "bottom-left")}
          />
          {/* Bottom-Right Corner */}
          <div
            className={cn(resizeHandleClass, "bottom-0 right-0 w-4 h-4 cursor-se-resize z-20")}
            onMouseDown={(e) => handleResizeStart(e, "bottom-right")}
          />
        </>
      )}

      {/* Window Header */}
      <div className={cn(
        "window-header flex items-center justify-between px-4 py-3 bg-muted border-b border-border relative z-30",
        isSplitScreen ? "cursor-default" : "cursor-grab active:cursor-grabbing"
      )}>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", isSplitScreen && "bg-primary/20")}
            onClick={toggleSplitScreen}
            title={isSplitScreen ? "Exit split screen" : "Split screen"}
          >
            <Columns2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setIsSplitScreen(false);
              if (onSplitScreenChange) {
                onSplitScreenChange(false);
              }
              onClose();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Window Content */}
      <div className="flex-1 overflow-hidden bg-background">{children}</div>
    </div>
  );
};
