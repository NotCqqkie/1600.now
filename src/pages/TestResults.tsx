import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { SatScoreCard } from "@/components/practice/SatScoreCard";
import { getAllPracticeTestResults } from "@/lib/practice/practiceTestSession";
import { cn } from "@/lib/utils";

const formatTestDate = (timestamp: number) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));

const TestResults = () => {
  const [searchParams] = useSearchParams();
  const activeSessionId = searchParams.get("session");
  const results = useMemo(() => getAllPracticeTestResults(), []);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-display text-[clamp(34px,4.4vw,54px)] font-semibold leading-none tracking-[-0.035em] text-ink">
          Test Results
        </h1>
      </div>

      {results.length > 0 ? (
        <div className="flex flex-col gap-4">
          {results.map((result) => (
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
      ) : (
        <Card className="border-dashed border-border/70">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold">No full practice tests yet</h2>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TestResults;
