import {
  BANK_SOURCE_LABELS,
  type BankSourceFilter,
} from "@/data/bankTypes";
import { SegmentedToggle, type SegmentedToggleOption } from "@/components/ui/segmented-toggle";

interface BankSourceToggleProps {
  value: BankSourceFilter;
  onChange: (value: BankSourceFilter) => void;
}

const sourceOptions: readonly SegmentedToggleOption<BankSourceFilter>[] = (["all", "unofficial", "past"] as const).map(
  (source) => ({
    value: source,
    label: BANK_SOURCE_LABELS[source],
  }),
);

export const BankSourceToggle = ({ value, onChange }: BankSourceToggleProps) => (
  <SegmentedToggle value={value} options={sourceOptions} onChange={onChange} />
);
