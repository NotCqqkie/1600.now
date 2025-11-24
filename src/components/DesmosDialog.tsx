import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";

export const DesmosDialog = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Calculator className="mr-2 h-4 w-4" />
          Desmos Calculator
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Desmos Graphing Calculator</DialogTitle>
        </DialogHeader>
        <div className="h-[70vh]">
          <iframe
            src="https://www.desmos.com/testing/cb-sat-ap/graphing"
            className="w-full h-full border-0 rounded-md"
            title="Desmos Calculator"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
