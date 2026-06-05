import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Clock3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SatScoreCard } from "@/components/practice/SatScoreCard";
import { getAllPracticeTestResults } from "@/lib/practice/practiceTestSession";
import { getAllModulePracticeResults, type ModulePracticeResult } from "@/lib/practice/modulePracticeSession";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

type ResultType = "full" | "modules";

const formatTestDate = (timestamp: number) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));

const formatTime = (seconds: number) => {
  if (!seconds) return "0s";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (!minutes) return `${remainder}s`;
  return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
};

const ModuleResultCard = ({
  result,
  active,
}: {
  result: ModulePracticeResult;
  active: boolean;
}) => (
  <Card
    className={cn(
      "overflow-hidden border-border/70 bg-card transition-shadow hover:shadow-md",
      active && "ring-4 ring-[#3350d4]/30",
    )}
  >
    <CardContent className="p-0">
      <div className="bg-[#c7dcff] px-5 py-4 text-[#202124] dark:bg-[#243b63] dark:text-white">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-80">
          {result.subject === "math" ? "Math Module" : "Reading & Writing Module"}
        </div>
        <h2 className="mt-2 text-2xl font-black leading-none tracking-[-0.045em]">
          {result.moduleTitle}
        </h2>
        <div className="mt-2 text-sm font-medium opacity-80">
          {formatTestDate(result.submittedAt)}
        </div>
      </div>

      <div className="grid gap-5 px-5 py-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[-0.01em] text-muted-foreground">
              Accuracy
            </div>
            <div className="mt-2 text-5xl font-black leading-none tracking-[-0.06em] text-foreground">
              {result.accuracy}%
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[-0.01em] text-muted-foreground">
              Correct
            </div>
            <div className="mt-2 text-3xl font-black leading-none tracking-[-0.06em] text-foreground">
              {result.correctCount}/{result.questionCount}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[-0.01em] text-muted-foreground">
              Time
            </div>
            <div className="mt-2 flex items-center gap-2 text-2xl font-black leading-none tracking-[-0.05em] text-foreground">
              <Clock3 className="h-5 w-5 text-muted-foreground" />
              {formatTime(result.elapsedSeconds)}
            </div>
          </div>
        </div>

        <Link
          to={`/modules/${result.moduleSlug}/results?session=${result.sessionId}`}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border-2 border-[#3350d4] px-5 text-sm font-bold text-[#3350d4] transition-colors hover:bg-[#3350d4] hover:text-white dark:border-[#8fb7ff] dark:text-[#a9c8ff] dark:hover:bg-[#8fb7ff] dark:hover:text-[#101827]"
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
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const activeSessionId = searchParams.get("session");
  const requestedType = searchParams.get("type");
  const resultType: ResultType = requestedType === "modules" ? "modules" : "full";
  const fullTestResults = useMemo(() => getAllPracticeTestResults(uid), [uid]);
  const moduleResults = useMemo(() => getAllModulePracticeResults(uid), [uid]);
  const showingModules = resultType === "modules";

  const setResultType = (value: ResultType) => {
    const next = new URLSearchParams(searchParams);
    if (value === "full") next.delete("type");
    else next.set("type", value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="font-display text-[clamp(34px,4.4vw,54px)] font-semibold leading-none tracking-[-0.035em] text-ink">
          Test Results
        </h1>
        <div className="w-full sm:w-[220px]">
          <Select value={resultType} onValueChange={(value: ResultType) => setResultType(value)}>
            <SelectTrigger aria-label="Result type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Full-Length Tests</SelectItem>
              <SelectItem value="modules">Modules</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!showingModules && fullTestResults.length > 0 ? (
        <div className="flex flex-col gap-4">
          {fullTestResults.map((result) => (
            <SatScoreCard
              key={result.sessionId}
              title={`Practice Test ${result.practiceSetNumber}`}
              dateLabel={formatTestDate(result.submittedAt)}
              totalScore={result.totalScore}
              readingWritingScore={result.readingWritingScore}
              mathScore={result.mathScore}
              detailsTo={`/practice-tests/${result.practiceSetId}/results?session=${result.sessionId}`}
              compact
              className={cn(
                "transition-shadow",
                activeSessionId === result.sessionId && "ring-4 ring-[#3350d4]/30",
              )}
            />
          ))}
        </div>
      ) : null}

      {showingModules && moduleResults.length > 0 ? (
        <div className="flex flex-col gap-4">
          {moduleResults.map((result) => (
            <ModuleResultCard
              key={result.sessionId}
              result={result}
              active={activeSessionId === result.sessionId}
            />
          ))}
        </div>
      ) : null}

      {!showingModules && fullTestResults.length === 0 ? (
        <Card className="border-dashed border-border/70">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold">No full practice tests yet</h2>
          </CardContent>
        </Card>
      ) : null}

      {showingModules && moduleResults.length === 0 ? (
        <Card className="border-dashed border-border/70">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold">No module results yet</h2>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

export default TestResults;
