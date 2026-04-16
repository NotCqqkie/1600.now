import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getPracticeModule } from "@/data/modulePracticeBank";
import { classifyModuleCompletion, getModuleProgressCounts } from "@/lib/moduleProgress";
import { getModulePracticeSession } from "@/lib/modulePracticeSession";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, ArrowRight, BookOpen, Calculator } from "lucide-react";

const ModuleView = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();

  const module = useMemo(() => (moduleId ? getPracticeModule(moduleId) : null), [moduleId]);

  const progressCounts = useMemo(
    () => (module ? getModuleProgressCounts(module) : { correct: 0, incorrect: 0, correctAfterReview: 0 }),
    [module],
  );
  const savedSession = useMemo(
    () => (module ? getModulePracticeSession(module.slug) : null),
    [module],
  );

  const totalAnswered = progressCounts.correct + progressCounts.incorrect + progressCounts.correctAfterReview;
  const hasProgress = totalAnswered > 0;
  const completionStatus = module ? classifyModuleCompletion(progressCounts, module.questionCount) : "not-started";

  const startModule = () => {
    if (!module) return;
    navigate(`/modules/${module.slug}/start`);
  };

  if (!module) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
        <Button variant="ghost" asChild className="w-fit gap-2">
          <Link to="/modules">
            <ArrowLeft className="h-4 w-4" />
            Back to modules
          </Link>
        </Button>

        <Card className="border-dashed border-border/70">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold">Practice set not found</h2>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isMath = module.subject === "math";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Button variant="ghost" asChild className="w-fit gap-2 px-0">
        <Link to="/modules">
          <ArrowLeft className="h-4 w-4" />
          Back to modules
        </Link>
      </Button>

      <Card className="border-border/70">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isMath ? "default" : "secondary"} className="gap-1.5">
              {isMath ? <Calculator className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
              {module.subjectLabel}
            </Badge>
            <Badge variant="outline">Module {module.moduleNumber}</Badge>
          </div>

          <div>
            <h1
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: "clamp(28px, 3.5vw, 42px)",
                fontWeight: 400,
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                color: "hsl(var(--foreground))",
              }}
            >
              {module.publicTitle}
            </h1>
            <CardTitle className="mt-2 text-xl font-medium text-muted-foreground">
              {module.publicSubtitle}
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Questions</div>
              <div className="mt-2 text-3xl font-semibold">{module.questionCount}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Test date</div>
              <div className="mt-2 text-2xl font-semibold leading-tight">
                {module.month} {module.year}
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Subject</div>
              <div className="mt-2 text-2xl font-semibold leading-tight">{module.subjectLabel}</div>
            </div>
          </div>

          {hasProgress && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Your progress</span>
                <span className="text-sm text-muted-foreground">
                  {totalAnswered}/{module.questionCount} answered
                  {completionStatus === "completed" && (
                    <span className="ml-1.5 font-medium text-emerald-600">· Complete</span>
                  )}
                </span>
              </div>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${(progressCounts.correct / module.questionCount) * 100}%` }}
                />
                <div
                  className="bg-amber-400 transition-all"
                  style={{ width: `${(progressCounts.correctAfterReview / module.questionCount) * 100}%` }}
                />
                <div
                  className="bg-rose-500 transition-all"
                  style={{ width: `${(progressCounts.incorrect / module.questionCount) * 100}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  {progressCounts.correct} correct
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                  {progressCounts.correctAfterReview} after review
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
                  {progressCounts.incorrect} incorrect
                </span>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
            This module opens in the dedicated practice viewer with a timed or untimed option, saved progress, and an end-of-module review flow.
          </div>

          <Button size="lg" className="group w-full justify-between" onClick={startModule}>
            {savedSession
              ? "Resume saved session"
              : completionStatus === "completed"
                ? "Practice again"
                : completionStatus === "in-progress"
                  ? "Continue practice"
                  : "Start practice"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ModuleView;
