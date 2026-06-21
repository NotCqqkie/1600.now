import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Clock3, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SatScoreCard } from "@/components/practice/SatScoreCard";
import {
  discardPracticeTestResult,
  getAllPracticeTestResults,
  type PracticeTestResult,
} from "@/lib/practice/practiceTestSession";
import { getAllModulePracticeResults, type ModulePracticeResult } from "@/lib/practice/modulePracticeSession";
import { formatPracticeResultTime } from "@/lib/practice/practiceTime";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const FULL_RESULT_TYPE = "full";
const MODULES_RESULT_TYPE = "modules";
const RESULT_TYPE_QUERY_KEY = "type";
type ResultType = typeof FULL_RESULT_TYPE | typeof MODULES_RESULT_TYPE;

const ACTIVE_RESULT_RING_CLASS = "ring-4 ring-[#3350d4]/30";
const RESULT_LIST_CLASS = "flex flex-col gap-4";
const MODULE_STAT_LABEL_CLASS = "text-[10px] font-bold uppercase tracking-[-0.01em] text-muted-foreground";
const EMPTY_CARD_CLASS = "border-dashed border-border/70";
const EMPTY_CARD_CONTENT_CLASS = "py-12 text-center";
const EMPTY_TITLE_CLASS = "text-xl font-semibold";
const MODULE_RESULT_CARD_CLASS = "overflow-hidden border-border/70 bg-card transition-shadow hover:shadow-md";
const MODULE_RESULT_HEADER_CLASS = "bg-[#c7dcff] px-5 py-4 text-[#202124] dark:bg-[#243b63] dark:text-white";
const MODULE_RESULT_EYEBROW_CLASS = "text-[11px] font-bold uppercase tracking-[0.16em] opacity-80";
const MODULE_RESULT_TITLE_CLASS = "mt-2 text-2xl font-black leading-none tracking-[-0.045em]";
const MODULE_RESULT_DATE_CLASS = "mt-2 text-sm font-medium opacity-80";
const MODULE_RESULT_BODY_CLASS = "grid gap-5 px-5 py-5 sm:grid-cols-[1fr_auto] sm:items-end";
const MODULE_RESULT_STATS_CLASS = "grid gap-4 sm:grid-cols-3";
const MODULE_ACCURACY_VALUE_CLASS = "mt-2 text-5xl font-black leading-none tracking-[-0.06em] text-foreground";
const MODULE_CORRECT_VALUE_CLASS = "mt-2 text-3xl font-black leading-none tracking-[-0.06em] text-foreground";
const MODULE_TIME_VALUE_CLASS = "mt-2 flex items-center gap-2 text-2xl font-black leading-none tracking-[-0.05em] text-foreground";
const MODULE_TIME_ICON_CLASS = "h-5 w-5 text-muted-foreground";
const MODULE_RESULT_LINK_CLASS = "inline-flex h-10 items-center justify-center gap-2 rounded-full border-2 border-[#3350d4] px-5 text-sm font-bold text-[#3350d4] transition-colors hover:bg-[#3350d4] hover:text-white dark:border-[#8fb7ff] dark:text-[#a9c8ff] dark:hover:bg-[#8fb7ff] dark:hover:text-[#101827]";
const RESULTS_PAGE_CLASS = "mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8";
const RESULTS_HEADER_CLASS = "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between";
const RESULTS_TITLE_CLASS = "font-display text-[clamp(34px,4.4vw,54px)] font-semibold leading-none tracking-[-0.035em] text-ink";
const RESULT_TYPE_SELECT_WRAP_CLASS = "w-full sm:w-[220px]";
const FULL_SCORE_CARD_BASE_CLASS = "transition-shadow";
const FULL_RESULT_CARD_WRAP_CLASS = "relative";
const DISCARD_TEST_BUTTON_CLASS = "absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center bg-transparent p-0 text-[#202124]/65 transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/35 dark:text-white/70 dark:hover:text-destructive";
const DISCARD_TEST_ICON_CLASS = "h-4 w-4";
const TEST_DATE_FORMAT_OPTIONS = {
  month: "long",
  day: "numeric",
  year: "numeric",
} as const;

const formatTestDate = (timestamp: number): string =>
  new Intl.DateTimeFormat("en-US", TEST_DATE_FORMAT_OPTIONS).format(new Date(timestamp));

const getResultType = (searchParams: URLSearchParams): ResultType =>
  searchParams.get(RESULT_TYPE_QUERY_KEY) === MODULES_RESULT_TYPE
    ? MODULES_RESULT_TYPE
    : FULL_RESULT_TYPE;

const updateResultTypeSearchParams = (
  searchParams: URLSearchParams,
  value: ResultType,
): URLSearchParams => {
  const next = new URLSearchParams(searchParams);
  if (value === FULL_RESULT_TYPE) next.delete(RESULT_TYPE_QUERY_KEY);
  else next.set(RESULT_TYPE_QUERY_KEY, value);
  return next;
};

const buildPracticeTestResultPath = (
  result: Pick<PracticeTestResult, "practiceSetId" | "sessionId">,
): string =>
  `/practice-tests/${result.practiceSetId}/results?session=${result.sessionId}`;

const buildModuleResultPath = (
  result: Pick<ModulePracticeResult, "moduleSlug" | "sessionId">,
): string =>
  `/modules/${result.moduleSlug}/results?session=${result.sessionId}`;

type ModuleResultCardProps = Readonly<{
  result: Pick<
    ModulePracticeResult,
    | "subject"
    | "moduleTitle"
    | "submittedAt"
    | "accuracy"
    | "correctCount"
    | "questionCount"
    | "elapsedSeconds"
    | "moduleSlug"
    | "sessionId"
  >;
  active: boolean;
}>;

type EmptyResultsCardProps = Readonly<{
  title: string;
}>;

type FullTestResultCardProps = Readonly<{
  result: PracticeTestResult;
  active: boolean;
  onDiscard: (result: PracticeTestResult) => void;
}>;

const EmptyResultsCard = ({ title }: EmptyResultsCardProps) => (
  <Card className={EMPTY_CARD_CLASS}>
    <CardContent className={EMPTY_CARD_CONTENT_CLASS}>
      <h2 className={EMPTY_TITLE_CLASS}>{title}</h2>
    </CardContent>
  </Card>
);

const FullTestResultCard = ({
  result,
  active,
  onDiscard,
}: FullTestResultCardProps) => (
  <AlertDialog>
    <div className={FULL_RESULT_CARD_WRAP_CLASS}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className={DISCARD_TEST_BUTTON_CLASS}
          aria-label={`Discard Practice Test ${result.practiceSetNumber} result`}
        >
          <Trash2 className={DISCARD_TEST_ICON_CLASS} />
        </button>
      </AlertDialogTrigger>

      <SatScoreCard
        title={`Practice Test ${result.practiceSetNumber}`}
        dateLabel={formatTestDate(result.submittedAt)}
        totalScore={result.totalScore}
        readingWritingScore={result.readingWritingScore}
        mathScore={result.mathScore}
        detailsTo={buildPracticeTestResultPath(result)}
        compact
        className={cn(
          FULL_SCORE_CARD_BASE_CLASS,
          active && ACTIVE_RESULT_RING_CLASS,
        )}
      />
    </div>

    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Discard this test result?</AlertDialogTitle>
        <AlertDialogDescription>
          This will permanently remove Practice Test {result.practiceSetNumber} from your saved test results.
          This cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          onClick={() => onDiscard(result)}
        >
          Discard test
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

const ModuleResultCard = ({
  result,
  active,
}: ModuleResultCardProps) => (
  <Card
    className={cn(
      MODULE_RESULT_CARD_CLASS,
      active && ACTIVE_RESULT_RING_CLASS,
    )}
  >
    <CardContent className="p-0">
      <div className={MODULE_RESULT_HEADER_CLASS}>
        <div className={MODULE_RESULT_EYEBROW_CLASS}>
          {result.subject === "math" ? "Math Module" : "English Module"}
        </div>
        <h2 className={MODULE_RESULT_TITLE_CLASS}>
          {result.moduleTitle}
        </h2>
        <div className={MODULE_RESULT_DATE_CLASS}>
          {formatTestDate(result.submittedAt)}
        </div>
      </div>

      <div className={MODULE_RESULT_BODY_CLASS}>
        <div className={MODULE_RESULT_STATS_CLASS}>
          <div>
            <div className={MODULE_STAT_LABEL_CLASS}>
              Accuracy
            </div>
            <div className={MODULE_ACCURACY_VALUE_CLASS}>
              {result.accuracy}%
            </div>
          </div>
          <div>
            <div className={MODULE_STAT_LABEL_CLASS}>
              Correct
            </div>
            <div className={MODULE_CORRECT_VALUE_CLASS}>
              {result.correctCount}/{result.questionCount}
            </div>
          </div>
          <div>
            <div className={MODULE_STAT_LABEL_CLASS}>
              Time
            </div>
            <div className={MODULE_TIME_VALUE_CLASS}>
              <Clock3 className={MODULE_TIME_ICON_CLASS} />
              {formatPracticeResultTime(result.elapsedSeconds)}
            </div>
          </div>
        </div>

        <Link
          to={buildModuleResultPath(result)}
          className={MODULE_RESULT_LINK_CLASS}
          aria-label={`View breakdown for ${result.moduleTitle}`}
        >
          View Breakdown
          <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    </CardContent>
  </Card>
);

const TestResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const activeSessionId = searchParams.get("session");
  const resultType = getResultType(searchParams);
  const fullTestResults = useMemo(() => getAllPracticeTestResults(uid), [uid, refreshKey]);
  const moduleResults = useMemo(() => getAllModulePracticeResults(uid), [uid]);
  const showingModules = resultType === MODULES_RESULT_TYPE;
  const hasFullTestResults = fullTestResults.length > 0;
  const hasModuleResults = moduleResults.length > 0;

  const setResultType = (value: ResultType) => {
    setSearchParams(updateResultTypeSearchParams(searchParams, value), { replace: true });
  };

  const handleDiscardFullTestResult = (result: PracticeTestResult) => {
    discardPracticeTestResult(result, uid);
    setRefreshKey((key) => key + 1);

    if (activeSessionId === result.sessionId) {
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.delete("session");
      setSearchParams(nextSearchParams, { replace: true });
    }
  };

  return (
    <div className={RESULTS_PAGE_CLASS}>
      <div className={RESULTS_HEADER_CLASS}>
        <h1 className={RESULTS_TITLE_CLASS}>
          Test Results
        </h1>
        <div className={RESULT_TYPE_SELECT_WRAP_CLASS}>
          <Select value={resultType} onValueChange={(value: ResultType) => setResultType(value)}>
            <SelectTrigger aria-label="Result type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FULL_RESULT_TYPE}>Full-Length Tests</SelectItem>
              <SelectItem value={MODULES_RESULT_TYPE}>Modules</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!showingModules && hasFullTestResults ? (
        <div className={RESULT_LIST_CLASS}>
          {fullTestResults.map((result) => (
            <FullTestResultCard
              key={result.sessionId}
              result={result}
              active={activeSessionId === result.sessionId}
              onDiscard={handleDiscardFullTestResult}
            />
          ))}
        </div>
      ) : null}

      {showingModules && hasModuleResults ? (
        <div className={RESULT_LIST_CLASS}>
          {moduleResults.map((result) => (
            <ModuleResultCard
              key={result.sessionId}
              result={result}
              active={activeSessionId === result.sessionId}
            />
          ))}
        </div>
      ) : null}

      {!showingModules && !hasFullTestResults ? (
        <EmptyResultsCard title="No full practice tests yet" />
      ) : null}

      {showingModules && !hasModuleResults ? (
        <EmptyResultsCard title="No module results yet" />
      ) : null}
    </div>
  );
};

export default TestResults;
