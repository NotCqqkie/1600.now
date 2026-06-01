import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { DraggableWindow } from "@/components/DraggableWindow";

interface FormulaSheetDialogProps {
  onSplitScreenChange?: (isSplit: boolean, windowId: string) => void;
  splitPosition?: number;
  onFocus?: () => void;
  zIndex?: number;
  constrainToLeft?: number;
  compressed?: boolean;
  windowPortalContainer?: HTMLElement | null;
  windowBoundsElement?: HTMLElement | null;
}

const REFERENCE_SHEET_PANELS = [
  { id: 1, src: "/reference-sheet/1.png", width: 282, height: 460 },
  { id: 2, src: "/reference-sheet/2.png", width: 324, height: 460 },
  { id: 3, src: "/reference-sheet/3.png", width: 340, height: 460 },
  { id: 4, src: "/reference-sheet/4.png", width: 374, height: 460 },
  { id: 5, src: "/reference-sheet/5.png", width: 392, height: 340 },
  { id: 6, src: "/reference-sheet/6.png", width: 342, height: 340 },
  { id: 7, src: "/reference-sheet/7.png", width: 374, height: 460 },
  { id: 8, src: "/reference-sheet/8.png", width: 372, height: 460 },
  { id: 9, src: "/reference-sheet/9.png", width: 334, height: 460 },
  { id: 10, src: "/reference-sheet/10.png", width: 344, height: 460 },
  { id: 11, src: "/reference-sheet/11.png", width: 394, height: 460 },
  { id: 12, src: "/reference-sheet/12.png", width: 1638, height: 90 },
  { id: 13, src: "/reference-sheet/13.png", width: 1640, height: 90 },
  { id: 14, src: "/reference-sheet/14.png", width: 1640, height: 90 },
] as const;

const getDefaultPanelWidth = (width: number) => `${Math.round(width / 2)}px`;

export const FormulaSheetDialog = ({ onSplitScreenChange, splitPosition, onFocus, zIndex = 50, constrainToLeft, compressed = false, windowPortalContainer, windowBoundsElement }: FormulaSheetDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    if (!isOpen && onFocus) {
      onFocus(); // Bring to front when opening
    }
    setIsOpen(!isOpen);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleToggle} data-tour="reference-button">
        <FileText className={compressed ? "h-4 w-4" : "mr-2 h-4 w-4"} />
        {!compressed && "Reference Sheet"}
      </Button>

      <DraggableWindow
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Reference Sheet"
        defaultWidth={760}
        defaultHeight={560}
        onSplitScreenChange={onSplitScreenChange}
        splitPosition={splitPosition}
        enableSplitScreen={false}
        windowId="referenceSheet"
        onFocus={onFocus}
        zIndex={zIndex}
        constrainToLeft={constrainToLeft}
        portalContainer={windowPortalContainer}
        boundsElement={windowBoundsElement}
      >
        <div className="h-full w-full overflow-y-auto overflow-x-hidden bg-white p-4 select-none sm:p-5">
          <div className="mx-auto w-full max-w-[1400px]">
            <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
              {REFERENCE_SHEET_PANELS.map((panel) => {
                const shouldAlwaysStack = panel.id >= 12;

                return (
                  <div
                    key={panel.id}
                    className={shouldAlwaysStack ? "basis-full" : "shrink-0"}
                    style={{
                      width: `min(100%, ${getDefaultPanelWidth(panel.width)})`,
                      marginInline: shouldAlwaysStack ? "auto" : undefined,
                    }}
                  >
                    <img
                      src={panel.src}
                      alt={`SAT reference sheet panel ${panel.id}`}
                      className="block h-auto w-full pointer-events-none"
                      draggable={false}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DraggableWindow>
    </>
  );
};
