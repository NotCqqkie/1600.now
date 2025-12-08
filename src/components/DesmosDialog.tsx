import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";
import { DraggableWindow } from "./DraggableWindow";

interface DesmosDialogProps {
  onSplitScreenChange?: (isSplit: boolean, windowId: string) => void;
  splitPosition?: number;
  onFocus?: () => void;
  zIndex?: number;
}

export const DesmosDialog = ({ onSplitScreenChange, splitPosition, onFocus, zIndex = 50 }: DesmosDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(!isOpen)}>
        <Calculator className="mr-2 h-4 w-4" />
        Desmos
      </Button>

      <DraggableWindow
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Desmos"
        defaultWidth={720}
        defaultHeight={520}
        onSplitScreenChange={onSplitScreenChange}
        splitPosition={splitPosition}
        enableSplitScreen={true}
        windowId="desmos"
        onFocus={onFocus}
        zIndex={zIndex}
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
