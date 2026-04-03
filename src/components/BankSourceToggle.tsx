import { Button } from "@/components/ui/button";
import {
  BANK_SOURCE_LABELS,
  type BankSourceFilter,
} from "@/data/questionBank";

interface BankSourceToggleProps {
  value: BankSourceFilter;
  onChange: (value: BankSourceFilter) => void;
}

export const BankSourceToggle = ({ value, onChange }: BankSourceToggleProps) => {
  const sources: BankSourceFilter[] = ["unofficial", "past", "all"];

  return (
    <div className="inline-flex flex-wrap rounded-lg border bg-card p-1">
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
