import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import referenceSheet from "@/assets/sat-reference-sheet.png";
import { DraggableWindow } from "./DraggableWindow";

interface FormulaSheetDialogProps {
  onSplitScreenChange?: (isSplit: boolean) => void;
}

export const FormulaSheetDialog = ({ onSplitScreenChange }: FormulaSheetDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(!isOpen)}>
        <FileText className="mr-2 h-4 w-4" />
        Formula Sheet
      </Button>

      <DraggableWindow
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="SAT Math Reference Sheet"
        defaultWidth={800}
        defaultHeight={700}
        onSplitScreenChange={onSplitScreenChange}
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
