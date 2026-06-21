import { type CSSProperties, type ElementType, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
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
  Filter,
  ChevronDown,
  ChevronUp,
  Clock,
  Bookmark,
  CheckCircle,
  Percent,
  BarChart3,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  hasActiveQuestionBankFilters,
  MAX_TIME_SPENT_FILTER_SECONDS,
  type QuestionBankFilters,
} from "@/lib/questionBankFilters";

const difficultyOptions = [
  { label: "Easy", value: "easy" },
  { label: "Medium", value: "medium" },
  { label: "Hard", value: "hard" },
] as const;

const FILTER_SELECT_TRIGGER_CLASS =
  "w-full pl-4 pr-3 text-left transition-[background-color,border-color,color,box-shadow] duration-300 ease-out hover:border-primary hover:bg-primary/15 hover:text-cobalt-deep dark:hover:border-primary/60 dark:hover:bg-primary/15 dark:hover:text-cobalt [&>span]:grow [&>span]:text-left [&>svg]:transition-colors hover:[&>svg]:text-cobalt-deep dark:hover:[&>svg]:text-cobalt";
const FILTER_SELECT_CONTENT_CLASS = "w-[var(--radix-select-trigger-width)] min-w-0";
const FILTER_SELECT_ITEM_CLASS =
  "focus:bg-cobalt focus:text-white data-[highlighted]:bg-cobalt data-[highlighted]:text-white data-[highlighted]:[&_svg]:text-white focus:[&_svg]:text-white";
const FILTER_CONTROL_CLASS =
  "bank-filter-control transition-[background-color,border-color,color,box-shadow] duration-300 ease-out focus:outline-0 focus:ring-0 focus:ring-offset-0 focus-visible:outline-0 focus-visible:ring-0 focus-visible:ring-offset-0";
const ACTIVE_FILTER_CONTROL_CLASS =
  "border-primary bg-primary text-primary-foreground shadow-sm hover:!border-cobalt hover:!bg-cobalt hover:!text-white dark:border-primary dark:bg-primary dark:text-primary-foreground dark:hover:!border-cobalt dark:hover:!bg-cobalt dark:hover:!text-white [&_svg]:text-primary-foreground [&_span]:text-primary-foreground hover:[&_svg]:!text-white hover:[&_span]:!text-white";

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
  homeDemoCloseSignal?: number;
  onHomeDemoControlOpenChange?: (control: string, open: boolean) => void;
}

const formatTimeSpentValue = (seconds: number, isUpperBound = false): string => {
  if (seconds === MAX_TIME_SPENT_FILTER_SECONDS && isUpperBound) return "3m+";
  if (seconds === 0) return "0s";
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
};
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
  homeDemoCloseSignal = 0,
  onHomeDemoControlOpenChange,
}: FilterPanelProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [homeDemoOpenControls, setHomeDemoOpenControls] = useState<string[]>([]);
  const filterPanelInnerRef = useRef<HTMLDivElement | null>(null);
  const [filterPanelHeight, setFilterPanelHeight] = useState(0);
  const isOpen = forceOpen || internalOpen;
  const hasActiveFilters = hasActiveQuestionBankFilters(filters);
  const isHighlighted = isOpen || hasActiveFilters;
  const [minTimeSpent, maxTimeSpent] = filters.timeSpentRange;
  const hasTimeSpentFilter = minTimeSpent !== 0 || maxTimeSpent !== MAX_TIME_SPENT_FILTER_SECONDS;
  const getSelectTriggerClass = (isActive: boolean) => cn(
    FILTER_SELECT_TRIGGER_CLASS,
    FILTER_CONTROL_CLASS,
    isActive && ACTIVE_FILTER_CONTROL_CLASS,
  );
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
    onHomeDemoControlOpenChange?.(control, nextOpen);
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

  useEffect(() => {
    if (homeDemoMultiOpen) setHomeDemoOpenControls([]);
  }, [homeDemoCloseSignal, homeDemoMultiOpen]);

  useLayoutEffect(() => {
    const panel = filterPanelInnerRef.current;
    if (!panel) return;

    const updatePanelHeight = () => setFilterPanelHeight(panel.scrollHeight);
    updatePanelHeight();

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(updatePanelHeight)
      : null;
    resizeObserver?.observe(panel);
    window.addEventListener("resize", updatePanelHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updatePanelHeight);
    };
  }, [compactLabels, showActivityFilter]);

  const filterPanelStyle = {
    "--bank-filter-panel-height": `${filterPanelHeight}px`,
  } as CSSProperties;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Button
          variant="outline"
          onClick={() => setOpen(!isOpen)}
          data-filter-demo-toggle
          data-filter-demo-open={isOpen ? "true" : "false"}
          className={cn(
            FILTER_CONTROL_CLASS,
            "gap-2 transition-[background-color,border-color,color,box-shadow] duration-300 ease-out",
            isHighlighted && "border-primary bg-primary text-primary-foreground hover:!border-cobalt hover:!bg-cobalt hover:!text-white",
          )}
        >
          <Filter className="h-4 w-4" />
          Filters
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        {rightContent}
      </div>

      <div
        aria-hidden={!isOpen}
        className={cn("bank-filter-panel-motion", isOpen && "bank-filter-panel-motion-open")}
        style={filterPanelStyle}
      >
        <div ref={filterPanelInnerRef} className="bank-filter-panel-motion-inner">
          <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
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
                  preventAutoFocusScroll={homeDemoMultiOpen}
                  className={cn(
                    FILTER_CONTROL_CLASS,
                    filters.difficulty.length > 0 && ACTIVE_FILTER_CONTROL_CLASS,
                  )}
                  open={homeDemoMultiOpen ? homeDemoOpenControls.includes("difficulty") : undefined}
                  onOpenChange={(nextOpen) => openHomeDemoControl("difficulty", nextOpen)}
                />
              </FilterCard>

              <FilterCard icon={Clock} label={compactLabels ? "Time Spent" : "Time Spent Solving"} className="min-w-0">
                <div className="space-y-3 pt-1">
                  <div className={cn(
                    compactLabels ? "grid grid-cols-2 gap-2" : "flex items-center justify-between gap-2",
                    "text-xs font-semibold",
                  )}>
                    <span className={cn(
                      "inline-flex min-w-0 items-center justify-center rounded-full border border-border/60 bg-background px-3 py-1 text-foreground shadow-sm transition-[background-color,border-color,color,box-shadow] duration-300 ease-out",
                      compactLabels && "w-full whitespace-nowrap px-1 tabular-nums",
                      hasTimeSpentFilter && "border-primary/35 bg-primary text-primary-foreground",
                    )}>
                      {formatTimeSpentValue(minTimeSpent)}
                    </span>
                    <span className={cn(
                      "inline-flex min-w-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-foreground shadow-sm transition-[background-color,border-color,color,box-shadow] duration-300 ease-out",
                      compactLabels && "w-full whitespace-nowrap px-1 tabular-nums",
                      hasTimeSpentFilter && "border-primary/35 bg-primary text-primary-foreground",
                    )}>
                      {formatTimeSpentValue(maxTimeSpent, true)}
                    </span>
                  </div>
                  <div
                    className="rounded-[10px] border border-transparent px-2 py-1"
                    data-filter-demo-control="time"
                  >
                    <Slider
                      value={[minTimeSpent, maxTimeSpent]}
                      min={0}
                      max={MAX_TIME_SPENT_FILTER_SECONDS}
                      step={5}
                      onValueChange={(value) => updateFilter("timeSpentRange", value as [number, number])}
                      aria-label="Time spent range"
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
                    <SelectTrigger data-filter-demo-control="activity" className={getSelectTriggerClass(filters.activeQuestions !== "all")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      container={portalContainer}
                      className={FILTER_SELECT_CONTENT_CLASS}
                    >
                      <SelectItem className={FILTER_SELECT_ITEM_CLASS} data-filter-demo-option="activity:all" value="all">{compactLabels ? "All" : "All Questions"}</SelectItem>
                      <SelectItem className={FILTER_SELECT_ITEM_CLASS} data-filter-demo-option="activity:active" value="active">{compactLabels ? "Active" : "Active Questions"}</SelectItem>
                      <SelectItem className={FILTER_SELECT_ITEM_CLASS} data-filter-demo-option="activity:exclude-active" value="exclude-active">{compactLabels ? "Exclude" : "Exclude Active Questions"}</SelectItem>
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
                  <SelectTrigger data-filter-demo-control="marked" className={getSelectTriggerClass(filters.markedForReview !== "all")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    container={portalContainer}
                    className={FILTER_SELECT_CONTENT_CLASS}
                  >
                    <SelectItem className={FILTER_SELECT_ITEM_CLASS} data-filter-demo-option="marked:all" value="all">Any</SelectItem>
                    <SelectItem className={FILTER_SELECT_ITEM_CLASS} data-filter-demo-option="marked:yes" value="yes">Marked Only</SelectItem>
                    <SelectItem className={FILTER_SELECT_ITEM_CLASS} data-filter-demo-option="marked:no" value="no">Not Marked</SelectItem>
                  </SelectContent>
                </Select>
              </FilterCard>

              <FilterCard icon={CheckCircle} label="Solved" className="min-w-0">
                <Select
                  value={filters.solved}
                  onValueChange={(v) => updateFilter("solved", v as typeof filters.solved)}
                  {...homeDemoSelectOpenProps("solved")}
                >
                  <SelectTrigger data-filter-demo-control="solved" className={getSelectTriggerClass(filters.solved !== "all")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    container={portalContainer}
                    className={FILTER_SELECT_CONTENT_CLASS}
                  >
                    <SelectItem className={FILTER_SELECT_ITEM_CLASS} data-filter-demo-option="solved:all" value="all">Any</SelectItem>
                    <SelectItem className={FILTER_SELECT_ITEM_CLASS} data-filter-demo-option="solved:yes" value="yes">Solved Only</SelectItem>
                    <SelectItem className={FILTER_SELECT_ITEM_CLASS} data-filter-demo-option="solved:no" value="no">Unsolved Only</SelectItem>
                  </SelectContent>
                </Select>
              </FilterCard>

              <FilterCard icon={Percent} label="Correct" className="min-w-0">
                <Select
                  value={filters.answeredIncorrectly}
                  onValueChange={(v) => updateFilter("answeredIncorrectly", v as typeof filters.answeredIncorrectly)}
                  {...homeDemoSelectOpenProps("incorrect")}
                >
                  <SelectTrigger data-filter-demo-control="incorrect" className={getSelectTriggerClass(filters.answeredIncorrectly !== "all")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    container={portalContainer}
                    className={FILTER_SELECT_CONTENT_CLASS}
                  >
                    <SelectItem className={FILTER_SELECT_ITEM_CLASS} data-filter-demo-option="incorrect:all" value="all">Any</SelectItem>
                    <SelectItem className={FILTER_SELECT_ITEM_CLASS} data-filter-demo-option="incorrect:no" value="no">Correct</SelectItem>
                    <SelectItem className={FILTER_SELECT_ITEM_CLASS} data-filter-demo-option="incorrect:yes" value="yes">Incorrect</SelectItem>
                  </SelectContent>
                </Select>
              </FilterCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
