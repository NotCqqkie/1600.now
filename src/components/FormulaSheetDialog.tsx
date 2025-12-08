import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import referenceSheet from "@/assets/sat-reference-sheet.png";
import { DraggableWindow } from "./DraggableWindow";

interface FormulaSheetDialogProps {
  onSplitScreenChange?: (isSplit: boolean, windowId: string) => void;
  splitPosition?: number;
  onFocus?: () => void;
  zIndex?: number;
}

export const FormulaSheetDialog = ({ onSplitScreenChange, splitPosition, onFocus, zIndex = 50 }: FormulaSheetDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(!isOpen)}>
        <FileText className="mr-2 h-4 w-4" />
        Reference Sheet
      </Button>

      <DraggableWindow
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Reference Sheet"
        defaultWidth={640}
        defaultHeight={400}
        onSplitScreenChange={onSplitScreenChange}
        splitPosition={splitPosition}
        enableSplitScreen={false}
        windowId="referenceSheet"
        onFocus={onFocus}
        zIndex={zIndex}
      >
        <div className="w-full h-full overflow-auto p-4">
          <img
            src={referenceSheet}
            alt="SAT Math Reference Formulas"
            className="w-full h-auto"
          />
        </div>
      </DraggableWindow>
    </>
  );
};
