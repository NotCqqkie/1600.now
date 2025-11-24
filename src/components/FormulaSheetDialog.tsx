import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import referenceSheet from "@/assets/sat-reference-sheet.png";

export const FormulaSheetDialog = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="mr-2 h-4 w-4" />
          Formula Sheet
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>SAT Math Reference Sheet</DialogTitle>
        </DialogHeader>
        <div className="overflow-auto">
          <img 
            src={referenceSheet} 
            alt="SAT Math Reference Formulas" 
            className="w-full h-auto"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
