import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Youtube, Eye, EyeOff, Maximize2, Minimize2 } from "lucide-react";
import { DraggableWindow } from "./DraggableWindow";
import { renderMixedContent } from "@/lib/utils";

interface ExplanationWindowProps {
  videoUrl?: string;
  onSplitScreenChange?: (isSplit: boolean, windowId: string) => void;
  onSplitPositionChange?: (newPosition: number) => void;
  splitPosition?: number;
  compressed?: boolean;
  onFocus?: () => void;
  zIndex?: number;
  constrainToLeft?: number;
  isSidebarred?: boolean;
  onSidebarToggle?: (windowId: string, shouldBeSidebarred: boolean) => void;
  windowId?: string;
  correctAnswer?: string | null;
  rationale?: string | null;
  questionType?: "multiple-choice" | "free-response";
  choices?: { id: string; text?: string; image?: string }[];
  questionId?: string | number;
}

export const ExplanationWindow = ({ 
  videoUrl,
  onSplitScreenChange,
  onSplitPositionChange,
  splitPosition = 50,
  compressed = false,
  onFocus,
  zIndex = 50,
  constrainToLeft,
  isSidebarred = false,
  onSidebarToggle,
  windowId = "explanation",
  correctAnswer,
  rationale,
  questionType,
  choices,
  questionId
}: ExplanationWindowProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsAnswerRevealed(false);
  }, [questionId, correctAnswer]);

  const toggleFullscreen = () => {
    setIsMaximized(!isMaximized);
  };

  const handleToggle = () => {
    if (!isOpen && onFocus) {
      onFocus(); // Bring to front when opening
    }
    // Keep split-screen state in sync when toggling from a sidebarred state
    if (isOpen && isSidebarred && onSplitScreenChange) {
      onSplitScreenChange(false, windowId);
    }
    setIsOpen(!isOpen);
  };

  const renderRationale = () => {
    if (!rationale) return null;
    return (
      <div className="flex flex-col gap-2">
        <div className="font-bold text-lg">Rationale</div>
        <div 
          className="pl-4 border-l-2 border-primary/50 text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: renderMixedContent(rationale) }}
        />
      </div>
    );
  };

  const getAnswerContent = () => {
    if (!correctAnswer) return null;

    if (questionType === "multiple-choice") {
      const choice = choices?.find(c => c.id === correctAnswer);
      const content = choice?.text || (choice?.image ? `<img src="${choice.image}" alt="Answer Image" class="max-w-full h-auto" />` : "");
      
      return (
        <div className="flex flex-col gap-2">
          <div className="font-bold text-lg">Correct Answer: {correctAnswer}</div>
          {content && (
            <div 
              className="pl-4 border-l-2 border-primary/50 text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: renderMixedContent(content) }}
            />
          )}
        </div>
      );
    } else {
      return (
        <div className="flex flex-col gap-2">
          <div className="font-bold text-lg">Correct Answer:</div>
          <div className="pl-4 border-l-2 border-primary/50 text-muted-foreground text-lg">
             {correctAnswer}
          </div>
        </div>
      );
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleToggle} className="h-10">
        <Youtube className={compressed ? "h-4 w-4" : "mr-2 h-4 w-4"} />
        {!compressed && "Explanation"}
      </Button>
      <DraggableWindow
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Explanation"
        defaultWidth={700}
        defaultHeight={440}
        onSplitScreenChange={onSplitScreenChange}
        onSplitPositionChange={onSplitPositionChange}
        splitPosition={splitPosition}
        enableSplitScreen={true}
        diagonalResizeOnly={true}
        lockAspectRatio={true}
        windowId={windowId}
        onFocus={onFocus}
        zIndex={zIndex}
        constrainToLeft={constrainToLeft}
        isSidebarred={isSidebarred}
        onSidebarToggle={onSidebarToggle}
        isMaximized={isMaximized}
      >
        <div className="w-full h-full flex flex-col overflow-y-auto">
          {/* Answer Section Removed Temporarily */}
          
          <div 
            ref={videoContainerRef} 
            className="flex-1 w-full flex items-center justify-center bg-black min-h-[300px] relative group/video"
          >
            {videoUrl && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10 opacity-0 group-hover/video:opacity-100 transition-opacity bg-black/40 hover:bg-black/60 text-white"
                onClick={toggleFullscreen}
                title={isMaximized ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            )}

            {videoUrl ? (
              videoUrl.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                <video 
                  src={videoUrl} 
                  controls 
                  className="w-full h-full object-contain" 
                />
              ) : (
                <iframe
                  src={videoUrl}
                  className="w-full h-full"
                  title="Explanation Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )
            ) : (
              <p className="text-muted-foreground">Video explanation coming soon</p>
            )}
          </div>
        </div>
      </DraggableWindow>
    </>
  );
};