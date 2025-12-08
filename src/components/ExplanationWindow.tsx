import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Youtube } from "lucide-react";
import { DraggableWindow } from "./DraggableWindow";

interface ExplanationWindowProps {
  videoUrl?: string;
  onSplitScreenChange?: (isSplit: boolean, windowId: string) => void;
  splitPosition?: number;
  compressed?: boolean;
  onFocus?: () => void;
  zIndex?: number;
}

export const ExplanationWindow = ({ 
  videoUrl,
  onSplitScreenChange,
  splitPosition = 50,
  compressed = false,
  onFocus,
  zIndex = 50
}: ExplanationWindowProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      <Button variant="secondary" onClick={handleToggle} size={compressed ? "sm" : "default"}>
        <Youtube className={compressed ? "h-4 w-4" : "mr-2 h-4 w-4"} />
        {!compressed && "Explanation"}
      </Button>
      <DraggableWindow
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Explanation"
        defaultWidth={800}
        defaultHeight={500}
        onSplitScreenChange={onSplitScreenChange}
        splitPosition={splitPosition}
        enableSplitScreen={true}
        diagonalResizeOnly={true}
        lockAspectRatio={true}
        windowId="explanation"
        onFocus={onFocus}
        zIndex={zIndex}
      >
        <div className="w-full h-full flex flex-col">
          <div className="flex-1 w-full flex items-center justify-center bg-muted">
            {videoUrl ? (
              <iframe
                src={videoUrl}
                className="w-full h-full"
                title="Explanation Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <p className="text-muted-foreground">Video explanation coming soon</p>
            )}
          </div>
        </div>
      </DraggableWindow>
    </>
  );
};
