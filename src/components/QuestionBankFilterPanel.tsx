import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Filter,
  ChevronDown,
  ChevronUp,
  Clock,
  Bookmark,
  CheckCircle,
  XCircle,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Filter state types
export type DifficultyFilterValue = "easy" | "medium" | "hard";
export type TimeSpentFilterValue = "none" | "0-20s" | "20-40s" | "40s-1m" | "1m-2m" | "2m-3m" | "3m-5m" | "5m+";

export interface QuestionBankFilters {
  difficulty: DifficultyFilterValue[];
  timeSpent: TimeSpentFilterValue[];
  markedForReview: "all" | "yes" | "no";
  solved: "all" | "yes" | "no";
  answeredIncorrectly: "all" | "yes" | "no";
}

export const defaultFilters: QuestionBankFilters = {
  difficulty: [],
  timeSpent: [],
  markedForReview: "all",
  solved: "all",
  answeredIncorrectly: "all",
};

export const hasActiveQuestionBankFilters = (filters: QuestionBankFilters): boolean =>
  filters.difficulty.length > 0 ||
  filters.timeSpent.length > 0 ||
  filters.markedForReview !== defaultFilters.markedForReview ||
  filters.solved !== defaultFilters.solved ||
  filters.answeredIncorrectly !== defaultFilters.answeredIncorrectly;

const difficultyOptions = [
  { label: "Easy", value: "easy" },
  { label: "Medium", value: "medium" },
  { label: "Hard", value: "hard" },
] as const;

const timeSpentOptions = [
  { label: "Not Attempted", value: "none" },
  { label: "0-20 seconds", value: "0-20s" },
  { label: "20-40 seconds", value: "20-40s" },
  { label: "40s - 1 minute", value: "40s-1m" },
  { label: "1-2 minutes", value: "1m-2m" },
  { label: "2-3 minutes", value: "2m-3m" },
  { label: "3-5 minutes", value: "3m-5m" },
  { label: "5+ minutes", value: "5m+" },
] as const;

interface FilterPanelProps {
  filters: QuestionBankFilters;
  onFiltersChange: (filters: QuestionBankFilters) => void;
  rightContent?: React.ReactNode;
}

// Filter card component for consistent styling
function FilterCard({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-card border rounded-lg p-4 space-y-2", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

export function QuestionBankFilterPanel({
  filters,
  onFiltersChange,
  rightContent,
}: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = <K extends keyof QuestionBankFilters>(
    key: K,
    value: QuestionBankFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <Button
          variant={isOpen ? "secondary" : "outline"}
          onClick={() => setIsOpen(!isOpen)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        {rightContent}
      </div>

      {/* Collapsible Filter Panel */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleContent>
          <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
            {/* Filter Grid - 2 columns on mobile, 5 on desktop */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <FilterCard icon={BarChart3} label="Difficulty">
                <MultiSelect
                  options={[...difficultyOptions]}
                  selected={filters.difficulty}
                  onChange={(value) => updateFilter("difficulty", value as QuestionBankFilters["difficulty"])}
                  placeholder="Any Difficulty"
                />
              </FilterCard>

              <FilterCard icon={Clock} label="Time Spent Solving">
                <MultiSelect
                  options={[...timeSpentOptions]}
                  selected={filters.timeSpent}
                  onChange={(value) => updateFilter("timeSpent", value as QuestionBankFilters["timeSpent"])}
                  placeholder="Any Time"
                />
              </FilterCard>

              <FilterCard icon={Bookmark} label="Marked for Review">
                <Select
                  value={filters.markedForReview}
                  onValueChange={(v) => updateFilter("markedForReview", v as typeof filters.markedForReview)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any</SelectItem>
                    <SelectItem value="yes">Marked Only</SelectItem>
                    <SelectItem value="no">Not Marked</SelectItem>
                  </SelectContent>
                </Select>
              </FilterCard>

              <FilterCard icon={CheckCircle} label="Solved">
                <Select
                  value={filters.solved}
                  onValueChange={(v) => updateFilter("solved", v as typeof filters.solved)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any</SelectItem>
                    <SelectItem value="yes">Solved Only</SelectItem>
                    <SelectItem value="no">Unsolved Only</SelectItem>
                  </SelectContent>
                </Select>
              </FilterCard>

              <FilterCard icon={XCircle} label="Answered Incorrectly">
                <Select
                  value={filters.answeredIncorrectly}
                  onValueChange={(v) => updateFilter("answeredIncorrectly", v as typeof filters.answeredIncorrectly)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any</SelectItem>
                    <SelectItem value="yes">Incorrect Only</SelectItem>
                    <SelectItem value="no">Not Incorrect</SelectItem>
                  </SelectContent>
                </Select>
              </FilterCard>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
