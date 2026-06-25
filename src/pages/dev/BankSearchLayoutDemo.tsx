import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedToggle, type SegmentedToggleOption } from "@/components/ui/segmented-toggle";
import { cn } from "@/lib/utils";
import { ChevronRight, Play, Search, Shuffle, X } from "lucide-react";

type Subject = "math" | "reading";

const subjectOptions: readonly SegmentedToggleOption<Subject>[] = [
  { value: "math", label: "Math", title: "Show Math questions" },
  { value: "reading", label: "Reading", title: "Show Reading questions" },
];

const hashQuery = (query: string) => {
  let hash = 23;
  for (let index = 0; index < query.length; index += 1) {
    hash = (hash * 37 + query.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const getResultCount = (query: string, subject: Subject) => {
  const trimmed = query.trim();
  if (!trimmed) return 0;
  const base = hashQuery(`${subject}:${trimmed.toLowerCase()}`);
  return Math.max(3, (base % 1860) + trimmed.length * 9);
};

const SearchField = ({
  query,
  onQueryChange,
  className,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  className?: string;
}) => (
  <div className={cn("group relative min-w-0 rounded-[10px] transition-shadow duration-200 focus-within:shadow-[0_0_0_4px_rgb(var(--ds-accent)/0.26)]", className)}>
    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted transition-colors duration-200 group-focus-within:text-cobalt-deep" />
    <Input
      value={query}
      onChange={(event) => onQueryChange(event.target.value)}
      placeholder="Search questions by keyword"
      aria-label="Search questions by keyword"
      className="h-10 pl-10 pr-10 focus-visible:border-ds-accent-deep/60 focus-visible:ring-0 focus-visible:ring-offset-0"
    />
    {query && (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Clear keyword search"
        onClick={() => onQueryChange("")}
        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
      >
        <X className="h-4 w-4" />
      </Button>
    )}
  </div>
);

const CountBadge = ({
  text,
  className,
  overlay,
}: {
  text: string;
  className?: string;
  overlay?: boolean;
}) => (
  <span
    className={cn(
      "flex h-10 shrink-0 items-center justify-center rounded-full border border-ds-line bg-white px-3 font-display text-[12px] font-semibold tabular-nums text-ink dark:bg-card",
      overlay && "relative overflow-hidden",
      className,
    )}
  >
    {text}
  </span>
);

const SubjectToggle = ({
  subject,
  onSubjectChange,
  className,
}: {
  subject: Subject;
  onSubjectChange: (subject: Subject) => void;
  className?: string;
}) => (
  <SegmentedToggle
    value={subject}
    options={subjectOptions}
    onChange={onSubjectChange}
    className={cn("h-10 shrink-0", className)}
    buttonClassName="h-[30px] px-3 py-0 text-[13px] leading-none"
    clippedActiveText
  />
);

const PracticeButton = ({
  count,
  busy,
  className,
  compact = false,
  countInside = true,
}: {
  count: number;
  busy: boolean;
  className?: string;
  compact?: boolean;
  countInside?: boolean;
}) => (
  <Button
    type="button"
    size="sm"
    disabled={busy || count < 5}
    className={cn("h-10 shrink-0", className)}
  >
    <Play className="h-4 w-4" />
    {compact ? "Practice" : countInside ? `Practice ${count.toLocaleString()}` : "Practice"}
  </Button>
);

const ShuffleButton = ({
  count,
  busy,
  className,
}: {
  count: number;
  busy: boolean;
  className?: string;
}) => (
  <Button
    type="button"
    variant="outline"
    size="icon"
    disabled={busy || count < 5}
    aria-label={`Shuffle practice ${count.toLocaleString()} questions`}
    title="Shuffle Practice"
    className={cn("h-10 w-10 shrink-0", className)}
  >
    <Shuffle className="h-4 w-4" />
  </Button>
);

const Variant = ({
  title,
  idea,
  tradeoff,
  children,
}: {
  title: string;
  idea: string;
  tradeoff: string;
  children: ReactNode;
}) => (
  <section className="rounded-lg border border-ds-line bg-white p-4 shadow-sm dark:bg-card">
    <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0">
        <h2 className="font-display text-[17px] font-semibold leading-tight text-ink">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-ink-mid">{idea}</p>
      </div>
      <p className="text-sm leading-5 text-ink-muted">{tradeoff}</p>
    </div>
    <div className="rounded-lg border border-ds-line bg-background/70 p-3">{children}</div>
  </section>
);

const ResultPreview = ({
  subject,
  count,
}: {
  subject: Subject;
  count: number;
}) => (
  <div className="mt-2 overflow-hidden rounded-lg border border-ds-line bg-white dark:bg-card">
    <button
      type="button"
      className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-left"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/30">
        <span className="text-[12px] font-bold text-ink">{subject === "math" ? "M" : "R"}</span>
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 font-display text-[13px] font-semibold text-ink">
            {subject === "math" ? "Math" : "Reading"} #{Math.max(1, count % 987)}
          </span>
          <span className="truncate text-xs font-medium text-ink-muted">
            {subject === "math" ? "Linear equations in two variables" : "Words in context"}
          </span>
          <span className="shrink-0 rounded-full border border-ds-line px-1.5 py-0.5 text-[11px] font-medium leading-none text-ink-muted">
            medium
          </span>
        </div>
        <div className="line-clamp-1 text-[13px] leading-5 text-ink-mid">
          A search result row stays below the controls while the header layout is tested above it.
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" />
    </button>
  </div>
);

const BankSearchLayoutDemo = () => {
  const [query, setQuery] = useState("linear equations");
  const [subject, setSubject] = useState<Subject>("math");
  const [busy, setBusy] = useState(false);
  const trimmedQuery = query.trim();
  const isActive = trimmedQuery.length > 0;
  const count = useMemo(() => getResultCount(query, subject), [query, subject]);
  const otherSubjectCount = useMemo(
    () => getResultCount(query, subject === "math" ? "reading" : "math"),
    [query, subject],
  );
  const showSubjectToggle = isActive && (trimmedQuery.length % 3 !== 1 || otherSubjectCount > 250);
  const countText = busy ? "Searching..." : `${count.toLocaleString()} question${count === 1 ? "" : "s"}`;

  useEffect(() => {
    document.title = "Bank Search Layout Demo | 1600.now";
  }, []);

  useEffect(() => {
    if (!isActive) {
      setBusy(false);
      return;
    }
    setBusy(true);
    const timer = window.setTimeout(() => setBusy(false), 420);
    return () => window.clearTimeout(timer);
  }, [query, subject, isActive]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5">
        <h1 className="font-display text-[28px] font-semibold leading-tight text-ink">Bank Search Layout Demos</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-mid">
          Type in any search field. Each row receives the same query and simulated result changes.
        </p>
      </header>

      <div className="mb-5 rounded-lg border border-ds-line bg-white p-4 shadow-sm dark:bg-card">
        <SearchField query={query} onQueryChange={setQuery} />
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-ink-muted">
          <span className="rounded-full border border-ds-line bg-background px-2 py-1 tabular-nums">
            {countText}
          </span>
          <span className="rounded-full border border-ds-line bg-background px-2 py-1">
            subject toggle {showSubjectToggle ? "visible" : "reserved/hidden"}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <Variant
          title="Reference: Auto Flex"
          idea="This keeps the current behavior visible: every changing label owns its natural width."
          tradeoff="Useful as a baseline; it is the most likely to shift while typing."
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchField query={query} onQueryChange={setQuery} className="flex-1" />
            {isActive && (
              <div className="flex shrink-0 flex-wrap gap-2 sm:flex-nowrap">
                <CountBadge text={countText} />
                {showSubjectToggle && (
                  <SubjectToggle subject={subject} onSubjectChange={setSubject} />
                )}
                <PracticeButton count={count} busy={busy} className="flex-1 sm:flex-none" />
                <ShuffleButton count={count} busy={busy} />
              </div>
            )}
          </div>
          {isActive && <ResultPreview subject={subject} count={count} />}
        </Variant>

        <Variant
          title="Fixed Control Slots"
          idea="The count badge, subject switcher, Practice button, and shuffle button each get a stable width."
          tradeoff="Most direct fix; costs some unused space when labels are short."
        >
          <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_31.5rem]">
            <SearchField query={query} onQueryChange={setQuery} />
            <div className={cn("flex flex-wrap gap-2 sm:grid sm:grid-cols-[8.75rem_9.25rem_9rem_2.5rem]", !isActive && "invisible")}>
              <CountBadge text={countText} className="w-[8.75rem]" />
              <div className="w-[9.25rem]">
                <SubjectToggle
                  subject={subject}
                  onSubjectChange={setSubject}
                  className={cn("w-full", !showSubjectToggle && "invisible")}
                />
              </div>
              <PracticeButton count={count} busy={busy} className="w-36" />
              <ShuffleButton count={count} busy={busy} />
            </div>
          </div>
          {isActive && <ResultPreview subject={subject} count={count} />}
        </Variant>

        <Variant
          title="Compact Practice Label"
          idea="The changing number stays in one fixed badge; the main action always says Practice."
          tradeoff="Less detail in the button, but the row feels calmer."
        >
          <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_27rem]">
            <SearchField query={query} onQueryChange={setQuery} />
            <div className={cn("flex flex-wrap gap-2 sm:grid sm:grid-cols-[8.75rem_9.25rem_6.5rem_2.5rem]", !isActive && "invisible")}>
              <CountBadge text={countText} className="w-[8.75rem]" />
              <div className="w-[9.25rem]">
                <SubjectToggle
                  subject={subject}
                  onSubjectChange={setSubject}
                  className={cn("w-full", !showSubjectToggle && "invisible")}
                />
              </div>
              <PracticeButton count={count} busy={busy} compact className="w-[6.5rem]" />
              <ShuffleButton count={count} busy={busy} />
            </div>
          </div>
          {isActive && <ResultPreview subject={subject} count={count} />}
        </Variant>

        <Variant
          title="Overlay Status"
          idea="The count slot never changes size; Searching overlays the same fixed area instead of replacing layout."
          tradeoff="Needs slightly more CSS, but keeps the current copy model."
        >
          <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_31.5rem]">
            <SearchField query={query} onQueryChange={setQuery} />
            <div className={cn("flex flex-wrap gap-2 sm:grid sm:grid-cols-[8.75rem_9.25rem_9rem_2.5rem]", !isActive && "invisible")}>
              <span className="relative flex h-10 w-[8.75rem] shrink-0 items-center justify-center overflow-hidden rounded-full border border-ds-line bg-white px-3 font-display text-[12px] font-semibold tabular-nums text-ink dark:bg-card">
                <span className={cn("transition-opacity duration-150", busy && "opacity-0")}>
                  {count.toLocaleString()} question{count === 1 ? "" : "s"}
                </span>
                <span className={cn("absolute inset-0 flex items-center justify-center transition-opacity duration-150", busy ? "opacity-100" : "opacity-0")}>
                  Searching...
                </span>
              </span>
              <div className="w-[9.25rem]">
                <SubjectToggle
                  subject={subject}
                  onSubjectChange={setSubject}
                  className={cn("w-full", !showSubjectToggle && "invisible")}
                />
              </div>
              <PracticeButton count={count} busy={busy} className="w-36" />
              <ShuffleButton count={count} busy={busy} />
            </div>
          </div>
          {isActive && <ResultPreview subject={subject} count={count} />}
        </Variant>

        <Variant
          title="Two-Line Actions"
          idea="The search input owns the top row. Dynamic controls sit below it and cannot squeeze the search field."
          tradeoff="Takes more vertical space, especially on desktop."
        >
          <div className="space-y-2">
            <SearchField query={query} onQueryChange={setQuery} />
            <div className={cn("flex min-h-10 flex-wrap gap-2", !isActive && "invisible")}>
              <CountBadge text={countText} className="w-[8.75rem]" />
              <div className="w-[9.25rem]">
                <SubjectToggle
                  subject={subject}
                  onSubjectChange={setSubject}
                  className={cn("w-full", !showSubjectToggle && "invisible")}
                />
              </div>
              <PracticeButton count={count} busy={busy} className="w-36" />
              <ShuffleButton count={count} busy={busy} />
            </div>
          </div>
          {isActive && <ResultPreview subject={subject} count={count} />}
        </Variant>

        <Variant
          title="Reserved Right Rail"
          idea="The entire action cluster gets one fixed rail; inner controls can change without affecting search width."
          tradeoff="Good compromise if the exact sub-control widths need to remain flexible."
        >
          <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_31.5rem]">
            <SearchField query={query} onQueryChange={setQuery} />
            <div className={cn("flex h-10 w-full justify-end gap-2 overflow-hidden", !isActive && "invisible")}>
              <CountBadge text={countText} className="w-[8.75rem]" />
              <div className="w-[9.25rem]">
                <SubjectToggle
                  subject={subject}
                  onSubjectChange={setSubject}
                  className={cn("w-full", !showSubjectToggle && "invisible")}
                />
              </div>
              <PracticeButton count={count} busy={busy} className="w-36" />
              <ShuffleButton count={count} busy={busy} />
            </div>
          </div>
          {isActive && <ResultPreview subject={subject} count={count} />}
        </Variant>

        <Variant
          title="Icon-First Actions"
          idea="The action area is reduced to a fixed count badge, a fixed Practice button, and a shuffle icon."
          tradeoff="Removes the subject switcher from the tight row; it would need another place nearby."
        >
          <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_18.5rem]">
            <SearchField query={query} onQueryChange={setQuery} />
            <div className={cn("flex flex-wrap gap-2 sm:grid sm:grid-cols-[8.75rem_6.5rem_2.5rem]", !isActive && "invisible")}>
              <CountBadge text={countText} className="w-[8.75rem]" />
              <PracticeButton count={count} busy={busy} compact className="w-[6.5rem]" />
              <ShuffleButton count={count} busy={busy} />
            </div>
          </div>
          {isActive && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SubjectToggle subject={subject} onSubjectChange={setSubject} />
              <ResultPreview subject={subject} count={count} />
            </div>
          )}
        </Variant>
      </div>
    </main>
  );
};

export default BankSearchLayoutDemo;
