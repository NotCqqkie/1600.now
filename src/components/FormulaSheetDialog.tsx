import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import referenceSheet from "@/assets/sat-reference-sheet.png";

export const FormulaSheetDialog = () => {
  const handleOpenFormulaSheet = () => {
    window.open(
      referenceSheet,
      'formulaSheet',
      'width=900,height=1000,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes'
    );
  };

  return (
    <Button variant="outline" size="sm" onClick={handleOpenFormulaSheet}>
      <FileText className="mr-2 h-4 w-4" />
      Formula Sheet
    </Button>
  );
};
