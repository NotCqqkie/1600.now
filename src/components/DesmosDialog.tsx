import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";
import { DraggableWindow } from "./DraggableWindow";

interface DesmosDialogProps {
  onSplitScreenChange?: (isSplit: boolean, windowId: string) => void;
  splitPosition?: number;
  onFocus?: () => void;
  zIndex?: number;
  constrainToLeft?: number;
}

export const DesmosDialog = ({ onSplitScreenChange, splitPosition, onFocus, zIndex = 50, constrainToLeft }: DesmosDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    if (!isOpen && onFocus) {
      onFocus(); // Bring to front when opening
    }
    setIsOpen(!isOpen);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleToggle}>
        <Calculator className="mr-2 h-4 w-4" />
        Desmos
      </Button>

      <DraggableWindow
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Desmos"
        defaultWidth={640}
        defaultHeight={460}
        onSplitScreenChange={onSplitScreenChange}
        splitPosition={splitPosition}
        enableSplitScreen={true}
        windowId="desmos"
        onFocus={onFocus}
        zIndex={zIndex}
        constrainToLeft={constrainToLeft}
      >
        <iframe
          src="https://www.desmos.com/testing/cb-sat-ap/graphing"
          className="w-full h-full border-0"
          title="Desmos Calculator"
        />
      </DraggableWindow>
    </>
  );
};
