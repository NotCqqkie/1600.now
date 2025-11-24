import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";

export const DesmosDialog = () => {
  const handleOpenDesmos = () => {
    window.open(
      'https://www.desmos.com/testing/cb-sat-ap/graphing',
      'desmosCalculator',
      'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes'
    );
  };

  return (
    <Button variant="outline" size="sm" onClick={handleOpenDesmos}>
      <Calculator className="mr-2 h-4 w-4" />
      Desmos Calculator
    </Button>
  );
};
