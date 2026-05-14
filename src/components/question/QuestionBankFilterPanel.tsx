import { type ElementType, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import { Slider } from "@/components/ui/slider";
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
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Filter state types
export type DifficultyFilterValue = "easy" | "medium" | "hard";
export const MAX_TIME_SPENT_FILTER_SECONDS = 180;
export const DEFAULT_TIME_SPENT_RANGE: [number, number] = [0, MAX_TIME_SPENT_FILTER_SECONDS];

export interface QuestionBankFilters {
  difficulty: DifficultyFilterValue[];
  timeSpentRange: [number, number];
  activeQuestions: "all" | "active" | "exclude-active";
  markedForReview: "all" | "yes" | "no";
  solved: "all" | "yes" | "no";
  answeredIncorrectly: "all" | "yes" | "no";
}

export const defaultFilters: QuestionBankFilters = {
  difficulty: [],
  timeSpentRange: DEFAULT_TIME_SPENT_RANGE,
  activeQuestions: "all",
  markedForReview: "all",
  solved: "all",
  answeredIncorrectly: "all",
};

export const hasActiveQuestionBankFilters = (filters: QuestionBankFilters): boolean =>
  filters.difficulty.length > 0 ||
  filters.timeSpentRange[0] !== DEFAULT_TIME_SPENT_RANGE[0] ||
  filters.timeSpentRange[1] !== DEFAULT_TIME_SPENT_RANGE[1] ||
  filters.activeQuestions !== defaultFilters.activeQuestions ||
  filters.markedForReview !== defaultFilters.markedForReview ||
  filters.solved !== defaultFilters.solved ||
  filters.answeredIncorrectly !== defaultFilters.answeredIncorrectly;

const difficultyOptions = [
  { label: "Easy", value: "easy" },
  { label: "Medium", value: "medium" },
  { label: "Hard", value: "hard" },
] as const;

interface FilterPanelProps {
  filters: QuestionBankFilters;
  onFiltersChange: (filters: QuestionBankFilters) => void;
  showActivityFilter?: boolean;
  rightContent?: ReactNode;
}

const formatTimeSpentValue = (seconds: number, isUpperBound = false): string => {
  if (seconds === MAX_TIME_SPENT_FILTER_SECONDS && isUpperBound) return "3m+";
  if (seconds === 0) return "0s";
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
};

// Filter card component for consistent styling
function FilterCard({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: ElementType;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
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
  showActivityFilter = true,
  rightContent,
}: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasActiveFilters = hasActiveQuestionBankFilters(filters);
  const isHighlighted = isOpen || hasActiveFilters;
  const [minTimeSpent, maxTimeSpent] = filters.timeSpentRange;

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
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "gap-2 transition-colors",
            isHighlighted && "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:border-primary/90",
          )}
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
            {/* Filter Grid - 2 columns on mobile */}
            <div className={cn(
              "grid grid-cols-2 gap-4",
              showActivityFilter
                ? "md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"
                : "md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]",
            )}>
              <FilterCard icon={BarChart3} label="Difficulty" className="min-w-0">
                <MultiSelect
                  options={[...difficultyOptions]}
                  selected={filters.difficulty}
                  onChange={(value) => updateFilter("difficulty", value as QuestionBankFilters["difficulty"])}
                  placeholder="Any Difficulty"
                  hideSearch
                />
              </FilterCard>

              <FilterCard icon={Clock} label="Time Spent Solving" className="min-w-0">
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                    <span className="inline-flex min-w-0 items-center justify-center rounded-full border border-border/60 bg-background px-3 py-1 text-foreground shadow-sm">
                      {formatTimeSpentValue(minTimeSpent)}
                    </span>
                    <span className="inline-flex min-w-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-foreground shadow-sm">
                      {formatTimeSpentValue(maxTimeSpent, true)}
                    </span>
                  </div>
                  <div className="px-2">
                    <Slider
                      value={[minTimeSpent, maxTimeSpent]}
                      min={0}
                      max={MAX_TIME_SPENT_FILTER_SECONDS}
                      step={5}
                      onValueChange={(value) => updateFilter("timeSpentRange", value as [number, number])}
                      aria-label={["Minimum time spent", "Maximum time spent"]}
                    />
                  </div>
                </div>
              </FilterCard>

              {showActivityFilter && (
                <FilterCard icon={Zap} label="Question Activity" className="min-w-0">
                  <Select
                    value={filters.activeQuestions}
                    onValueChange={(v) => updateFilter("activeQuestions", v as typeof filters.activeQuestions)}
                  >
                    <SelectTrigger className="w-full pl-4 pr-3 text-left [&>span]:grow [&>span]:text-left">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-0">
                      <SelectItem value="all">All Questions</SelectItem>
                      <SelectItem value="active">Active Questions</SelectItem>
                      <SelectItem value="exclude-active">Exclude Active Questions</SelectItem>
                    </SelectContent>
                  </Select>
                </FilterCard>
              )}

              <FilterCard icon={Bookmark} label="Marked for Review" className="min-w-0">
                <Select
                  value={filters.markedForReview}
                  onValueChange={(v) => updateFilter("markedForReview", v as typeof filters.markedForReview)}
                >
                  <SelectTrigger className="w-full pl-4 pr-3 text-left [&>span]:grow [&>span]:text-left">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-0">
                    <SelectItem value="all">Any</SelectItem>
                    <SelectItem value="yes">Marked Only</SelectItem>
                    <SelectItem value="no">Not Marked</SelectItem>
                  </SelectContent>
                </Select>
              </FilterCard>

              <FilterCard icon={CheckCircle} label="Solved" className="min-w-0">
                <Select
                  value={filters.solved}
                  onValueChange={(v) => updateFilter("solved", v as typeof filters.solved)}
                >
                  <SelectTrigger className="w-full pl-4 pr-3 text-left [&>span]:grow [&>span]:text-left">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-0">
                    <SelectItem value="all">Any</SelectItem>
                    <SelectItem value="yes">Solved Only</SelectItem>
                    <SelectItem value="no">Unsolved Only</SelectItem>
                  </SelectContent>
                </Select>
              </FilterCard>

              <FilterCard icon={XCircle} label="Answered Incorrectly" className="min-w-0">
                <Select
                  value={filters.answeredIncorrectly}
                  onValueChange={(v) => updateFilter("answeredIncorrectly", v as typeof filters.answeredIncorrectly)}
                >
                  <SelectTrigger className="w-full pl-4 pr-3 text-left [&>span]:grow [&>span]:text-left">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-0">
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
