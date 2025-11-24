import { useState, useRef, useEffect } from "react";
import { X, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DraggableWindowProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
}

export const DraggableWindow = ({
  isOpen,
  onClose,
  title,
  children,
  defaultWidth = 800,
  defaultHeight = 600,
}: DraggableWindowProps) => {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Center the window when opened
      const centerX = (window.innerWidth - defaultWidth) / 2;
      const centerY = (window.innerHeight - defaultHeight) / 2;
      setPosition({ x: Math.max(0, centerX), y: Math.max(0, centerY) });
    }
  }, [isOpen, defaultWidth, defaultHeight]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".window-header")) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && !isMaximized) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;
        
        // Keep window within viewport bounds
        const maxX = window.innerWidth - defaultWidth;
        const maxY = window.innerHeight - defaultHeight;
        
        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY)),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset, position, defaultWidth, defaultHeight, isMaximized]);

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={windowRef}
      className={cn(
        "fixed bg-card border-2 border-border rounded-lg shadow-2xl z-50 flex flex-col overflow-hidden",
        isDragging ? "cursor-grabbing" : "",
        isMaximized ? "inset-4" : ""
      )}
      style={
        isMaximized
          ? undefined
          : {
              left: position.x,
              top: position.y,
              width: defaultWidth,
              height: defaultHeight,
            }
      }
      onMouseDown={handleMouseDown}
    >
      {/* Window Header */}
      <div className="window-header flex items-center justify-between px-4 py-3 bg-muted border-b border-border cursor-grab active:cursor-grabbing">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleMaximize}
          >
            {isMaximized ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
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
