import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Youtube } from "lucide-react";
import { DraggableWindow } from "./DraggableWindow";

interface ExplanationWindowProps {
  videoUrl?: string;
  onSplitScreenChange?: (isSplit: boolean, windowId: string) => void;
  splitPosition?: number;
}

export const ExplanationWindow = ({ 
  videoUrl,
  onSplitScreenChange,
  splitPosition = 50
}: ExplanationWindowProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      <Button variant="secondary" onClick={handleToggle}>
        <Youtube className="mr-2 h-4 w-4" />
        Explanation
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
      >
        <div className="w-full h-full p-4">
          <div className="aspect-video bg-muted rounded-md flex items-center justify-center h-full">
            {videoUrl ? (
              <iframe
                src={videoUrl}
                className="w-full h-full rounded-md"
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
