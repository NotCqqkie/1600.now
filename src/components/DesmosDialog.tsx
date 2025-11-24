import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";
import { DraggableWindow } from "./DraggableWindow";

export const DesmosDialog = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <Calculator className="mr-2 h-4 w-4" />
        Desmos Calculator
      </Button>

      <DraggableWindow
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Desmos Graphing Calculator"
        defaultWidth={900}
        defaultHeight={650}
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
