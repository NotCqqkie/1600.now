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
import {
  defaultFilters,
  hasActiveQuestionBankFilters,
  MAX_TIME_SPENT_FILTER_SECONDS,
  type QuestionBankFilters,
} from "@/components/question/questionBankFilterModel";

export {
  defaultFilters,
  hasActiveQuestionBankFilters,
  MAX_TIME_SPENT_FILTER_SECONDS,
  type DifficultyFilterValue,
  type QuestionBankFilters,
} from "@/components/question/questionBankFilterModel";

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
  defaultOpen?: boolean;
  forceOpen?: boolean;
  portalContainer?: HTMLElement | null;
  compactLabels?: boolean;
  homeDemoMultiOpen?: boolean;
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
    <div data-filter-demo-card className={cn("min-w-0 space-y-2", className)}>
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate whitespace-nowrap">{label}</span>
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
  defaultOpen = false,
  forceOpen = false,
  portalContainer,
  compactLabels = false,
  homeDemoMultiOpen = false,
}: FilterPanelProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [homeDemoOpenControls, setHomeDemoOpenControls] = useState<string[]>([]);
  const isOpen = forceOpen || internalOpen;
  const hasActiveFilters = hasActiveQuestionBankFilters(filters);
  const isHighlighted = isOpen || hasActiveFilters;
  const [minTimeSpent, maxTimeSpent] = filters.timeSpentRange;
  const setOpen = (nextOpen: boolean) => {
    if (!forceOpen) setInternalOpen(nextOpen);
  };

  const updateFilter = <K extends keyof QuestionBankFilters>(
    key: K,
    value: QuestionBankFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
    if (homeDemoMultiOpen) setHomeDemoOpenControls([]);
  };
  const openHomeDemoControl = (control: string, nextOpen: boolean) => {
    if (!homeDemoMultiOpen) return;
    setHomeDemoOpenControls((current) => {
      if (!nextOpen) return current.filter((item) => item !== control);
      return [control];
    });
  };
  const homeDemoSelectOpenProps = (control: string) => (
    homeDemoMultiOpen
      ? {
        open: homeDemoOpenControls.includes(control),
        onOpenChange: (nextOpen: boolean) => openHomeDemoControl(control, nextOpen),
      }
      : {}
  );

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <Button
          variant="outline"
          onClick={() => setOpen(!isOpen)}
          data-filter-demo-toggle
          data-filter-demo-open={isOpen ? "true" : "false"}
          className={cn(
            "gap-2 transition-colors",
            isHighlighted && "border-primary bg-primary text-primary-foreground hover:!border-cobalt hover:!bg-cobalt hover:!text-white",
          )}
        >
          <Filter className="h-4 w-4" />
          Filters
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        {rightContent}
      </div>

      {/* Collapsible Filter Panel */}
      <Collapsible open={isOpen} onOpenChange={setOpen}>
        <CollapsibleContent>
          <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
            {/* Filter Grid - 2 columns on mobile */}
            <div className={cn(
              "grid grid-cols-2 gap-4",
              showActivityFilter
                ? "md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"
                : "md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]",
            )} data-filter-demo-grid>
              <FilterCard icon={BarChart3} label="Difficulty" className="min-w-0">
                <MultiSelect
                  options={[...difficultyOptions]}
                  selected={filters.difficulty}
                  onChange={(value) => updateFilter("difficulty", value as QuestionBankFilters["difficulty"])}
                  placeholder={compactLabels ? "Any" : "Any Difficulty"}
                  hideSearch
                  portalContainer={portalContainer}
                  demoControl="difficulty"
                  demoOptionPrefix="difficulty"
                  closeOnSelect={compactLabels}
                  open={homeDemoMultiOpen ? homeDemoOpenControls.includes("difficulty") : undefined}
                  onOpenChange={(nextOpen) => openHomeDemoControl("difficulty", nextOpen)}
                />
              </FilterCard>

              <FilterCard icon={Clock} label={compactLabels ? "Time Spent" : "Time Spent Solving"} className="min-w-0">
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                    <span className="inline-flex min-w-0 items-center justify-center rounded-full border border-border/60 bg-background px-3 py-1 text-foreground shadow-sm">
                      {formatTimeSpentValue(minTimeSpent)}
                    </span>
                    <span className="inline-flex min-w-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-foreground shadow-sm">
                      {formatTimeSpentValue(maxTimeSpent, true)}
                    </span>
                  </div>
                  <div className="px-2" data-filter-demo-control="time">
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
                <FilterCard icon={Zap} label={compactLabels ? "Activity" : "Question Activity"} className="min-w-0">
                  <Select
                    value={filters.activeQuestions}
                    onValueChange={(v) => updateFilter("activeQuestions", v as typeof filters.activeQuestions)}
                    {...homeDemoSelectOpenProps("activity")}
                  >
                    <SelectTrigger data-filter-demo-control="activity" className="w-full pl-4 pr-3 text-left [&>span]:grow [&>span]:text-left">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      container={portalContainer}
                      className="w-[var(--radix-select-trigger-width)] min-w-0"
                    >
                      <SelectItem data-filter-demo-option="activity:all" value="all">{compactLabels ? "All" : "All Questions"}</SelectItem>
                      <SelectItem data-filter-demo-option="activity:active" value="active">{compactLabels ? "Active" : "Active Questions"}</SelectItem>
                      <SelectItem data-filter-demo-option="activity:exclude-active" value="exclude-active">{compactLabels ? "Exclude" : "Exclude Active Questions"}</SelectItem>
                    </SelectContent>
                  </Select>
                </FilterCard>
              )}

              <FilterCard icon={Bookmark} label={compactLabels ? "Marked" : "Marked for Review"} className="min-w-0">
                <Select
                  value={filters.markedForReview}
                  onValueChange={(v) => updateFilter("markedForReview", v as typeof filters.markedForReview)}
                  {...homeDemoSelectOpenProps("marked")}
                >
                  <SelectTrigger data-filter-demo-control="marked" className="w-full pl-4 pr-3 text-left [&>span]:grow [&>span]:text-left">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    container={portalContainer}
                    className="w-[var(--radix-select-trigger-width)] min-w-0"
                  >
                    <SelectItem data-filter-demo-option="marked:all" value="all">Any</SelectItem>
                    <SelectItem data-filter-demo-option="marked:yes" value="yes">Marked Only</SelectItem>
                    <SelectItem data-filter-demo-option="marked:no" value="no">Not Marked</SelectItem>
                  </SelectContent>
                </Select>
              </FilterCard>

              <FilterCard icon={CheckCircle} label="Solved" className="min-w-0">
                <Select
                  value={filters.solved}
                  onValueChange={(v) => updateFilter("solved", v as typeof filters.solved)}
                  {...homeDemoSelectOpenProps("solved")}
                >
                  <SelectTrigger data-filter-demo-control="solved" className="w-full pl-4 pr-3 text-left [&>span]:grow [&>span]:text-left">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    container={portalContainer}
                    className="w-[var(--radix-select-trigger-width)] min-w-0"
                  >
                    <SelectItem data-filter-demo-option="solved:all" value="all">Any</SelectItem>
                    <SelectItem data-filter-demo-option="solved:yes" value="yes">Solved Only</SelectItem>
                    <SelectItem data-filter-demo-option="solved:no" value="no">Unsolved Only</SelectItem>
                  </SelectContent>
                </Select>
              </FilterCard>

              <FilterCard icon={XCircle} label={compactLabels ? "Incorrect" : "Answered Incorrectly"} className="min-w-0">
                <Select
                  value={filters.answeredIncorrectly}
                  onValueChange={(v) => updateFilter("answeredIncorrectly", v as typeof filters.answeredIncorrectly)}
                  {...homeDemoSelectOpenProps("incorrect")}
                >
                  <SelectTrigger data-filter-demo-control="incorrect" className="w-full pl-4 pr-3 text-left [&>span]:grow [&>span]:text-left">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    container={portalContainer}
                    className="w-[var(--radix-select-trigger-width)] min-w-0"
                  >
                    <SelectItem data-filter-demo-option="incorrect:all" value="all">Any</SelectItem>
                    <SelectItem data-filter-demo-option="incorrect:yes" value="yes">Incorrect Only</SelectItem>
                    <SelectItem data-filter-demo-option="incorrect:no" value="no">Not Incorrect</SelectItem>
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
