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
} from "lucide-react";
import { cn } from "@/lib/utils";

// Filter state types
export type DifficultyFilterValue = "easy" | "medium" | "hard";
export const MAX_TIME_SPENT_FILTER_SECONDS = 600;
export const DEFAULT_TIME_SPENT_RANGE: [number, number] = [0, MAX_TIME_SPENT_FILTER_SECONDS];

export interface QuestionBankFilters {
  difficulty: DifficultyFilterValue[];
  timeSpentRange: [number, number];
  markedForReview: "all" | "yes" | "no";
  solved: "all" | "yes" | "no";
  answeredIncorrectly: "all" | "yes" | "no";
}

export const defaultFilters: QuestionBankFilters = {
  difficulty: [],
  timeSpentRange: DEFAULT_TIME_SPENT_RANGE,
  markedForReview: "all",
  solved: "all",
  answeredIncorrectly: "all",
};

export const hasActiveQuestionBankFilters = (filters: QuestionBankFilters): boolean =>
  filters.difficulty.length > 0 ||
  filters.timeSpentRange[0] !== DEFAULT_TIME_SPENT_RANGE[0] ||
  filters.timeSpentRange[1] !== DEFAULT_TIME_SPENT_RANGE[1] ||
  filters.markedForReview !== defaultFilters.markedForReview ||
  filters.solved !== defaultFilters.solved ||
  filters.answeredIncorrectly !== defaultFilters.answeredIncorrectly;

const difficultyOptions = [
  { label: "Easy", value: "easy" },
  { label: "Medium", value: "medium" },
  { label: "Hard", value: "hard" },
] as const;

const SLIDER_THUMB_SIZE_PX = 24;

interface FilterPanelProps {
  filters: QuestionBankFilters;
  onFiltersChange: (filters: QuestionBankFilters) => void;
  rightContent?: ReactNode;
}

const formatTimeSpentValue = (seconds: number, isUpperBound = false): string => {
  if (seconds === MAX_TIME_SPENT_FILTER_SECONDS && isUpperBound) return "10m+";
  if (seconds === 0) return "0s";
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
};

const getSliderBubbleLeft = (seconds: number): string => {
  const ratio = seconds / MAX_TIME_SPENT_FILTER_SECONDS;
  const pixelOffset = SLIDER_THUMB_SIZE_PX / 2 - ratio * SLIDER_THUMB_SIZE_PX;

  return `calc(${(ratio * 100).toFixed(4)}% + ${pixelOffset.toFixed(2)}px)`;
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
            isHighlighted && "border-[#B4E1FF] bg-[#B4E1FF] text-foreground hover:bg-[#9BD8FF] hover:border-[#9BD8FF] dark:border-[#2D5A87] dark:bg-[#1E3A5F] dark:text-foreground dark:hover:bg-[#24476F] dark:hover:border-[#356796]",
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
                <div className="space-y-3 pt-1">
                  <div className="relative px-3 pt-10">
                    <div
                      className="pointer-events-none absolute left-0 top-0 z-10 -translate-x-1/2"
                      style={{ left: getSliderBubbleLeft(minTimeSpent) }}
                    >
                      <span className="inline-flex min-w-[3.5rem] items-center justify-center rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
                        {formatTimeSpentValue(minTimeSpent)}
                      </span>
                    </div>
                    <div
                      className="pointer-events-none absolute left-0 top-0 z-10 -translate-x-1/2"
                      style={{ left: getSliderBubbleLeft(maxTimeSpent) }}
                    >
                      <span className="inline-flex min-w-[3.5rem] items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
                        {formatTimeSpentValue(maxTimeSpent, true)}
                      </span>
                    </div>
                    <Slider
                      value={[minTimeSpent, maxTimeSpent]}
                      min={0}
                      max={MAX_TIME_SPENT_FILTER_SECONDS}
                      step={5}
                      minStepsBetweenThumbs={1}
                      onValueChange={(value) => updateFilter("timeSpentRange", value as [number, number])}
                      aria-label={["Minimum time spent", "Maximum time spent"]}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Filter questions by total time spent per question.
                  </p>
                </div>
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
