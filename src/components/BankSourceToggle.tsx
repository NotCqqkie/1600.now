import { Button } from "@/components/ui/button";
import {
  BANK_SOURCE_LABELS,
  type BankSourceId,
} from "@/data/questionBank";

interface BankSourceToggleProps {
  value: BankSourceId;
  onChange: (value: BankSourceId) => void;
}

export const BankSourceToggle = ({ value, onChange }: BankSourceToggleProps) => {
  const sources: BankSourceId[] = ["unofficial", "past"];

  return (
    <div className="inline-flex rounded-lg border bg-card p-1">
      {sources.map((source) => (
        <Button
          key={source}
          variant={value === source ? "default" : "ghost"}
          size="sm"
          onClick={() => onChange(source)}
          className="h-8"
        >
          {BANK_SOURCE_LABELS[source]}
        </Button>
      ))}
    </div>
  );
};
