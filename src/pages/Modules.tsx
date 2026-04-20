import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getPracticeModule,
  getPracticeSets,
  type PracticeModule,
} from "@/data/modulePracticeBank";
import {
  classifyModuleCompletion,
  getModuleProgressCounts,
} from "@/lib/moduleProgress";
import { getModulePracticeSession } from "@/lib/modulePracticeSession";
import { launchModulePractice } from "@/lib/modulePracticeNavigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, PlayCircle } from "lucide-react";

const practiceSets = getPracticeSets();

const Modules = () => {
  const navigate = useNavigate();
  const [subjectFilter, setSubjectFilter] = useState<"all" | "reading" | "math">("all");
  const [moduleFilter, setModuleFilter] = useState<"all" | "1" | "2">("all");
  const [completionFilter, setCompletionFilter] = useState<"all" | "not-started" | "in-progress" | "completed">("all");
  const [progressRefreshKey, setProgressRefreshKey] = useState(0);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setProgressRefreshKey((k) => k + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const moduleProgressBySlug = useMemo(() => {
    return new Map(
      practiceSets.flatMap((practiceSet) =>
        practiceSet.modules.map((module) => [module.slug, getModuleProgressCounts(module)] as const),
      ),
    );
  }, [progressRefreshKey]);

  const mostRecentSession = useMemo(() => {
    const sessions = practiceSets
      .flatMap((practiceSet) => practiceSet.modules)
      .map((module) => ({
        module,
        session: getModulePracticeSession(module.slug),
      }))
      .filter(
        (entry): entry is { module: PracticeModule; session: NonNullable<ReturnType<typeof getModulePracticeSession>> } =>
          Boolean(entry.session) && entry.session.status !== "submitted",
      )
      .sort((left, right) => right.session.startedAt - left.session.startedAt);

    return sessions[0] ?? null;
  }, [progressRefreshKey]);

  const filteredPracticeSets = useMemo(() => {
    return practiceSets
      .map((practiceSet) => ({
        ...practiceSet,
        modules: practiceSet.modules.filter((module) => {
          if (subjectFilter !== "all" && module.subject !== subjectFilter) return false;
          if (moduleFilter !== "all" && String(module.moduleNumber) !== moduleFilter) return false;
          if (completionFilter !== "all") {
            const counts = moduleProgressBySlug.get(module.slug) ?? {
              correct: 0,
              incorrect: 0,
              correctAfterReview: 0,
            };
            const status = classifyModuleCompletion(counts, module.questionCount);
            if (status !== completionFilter) return false;
          }
          return true;
        }),
      }))
      .filter((practiceSet) => practiceSet.modules.length > 0);
  }, [moduleFilter, subjectFilter, completionFilter, moduleProgressBySlug]);

  const openModule = (module: PracticeModule) => {
    navigate(`/modules/${module.slug}`);
  };

  const resumeMostRecentSession = () => {
    if (!mostRecentSession) return;
    const module = getPracticeModule(mostRecentSession.module.slug);
    if (!module) return;

    launchModulePractice({
      module,
      navigate,
      resumeExisting: true,
      savedSession: mostRecentSession.session,
      settings: mostRecentSession.session.settings,
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <h1
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: "clamp(26px, 3vw, 34px)",
              fontWeight: 400,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              color: "hsl(var(--foreground))",
            }}
          >
            SAT Module Practice
          </h1>
          <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">
            Practice full SAT modules grouped into complete reading and math sets.
          </p>
        </div>
      </div>

      {mostRecentSession ? (
        <Card className="border-border/70 bg-gradient-to-br from-card to-muted/30">
          <CardContent className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Resume Most Recent Module
              </div>
              <div className="mt-0.5 text-base font-semibold tracking-[-0.02em] text-foreground">
                {mostRecentSession.module.publicTitle}
              </div>
              <div className="text-xs text-muted-foreground">
                Question {mostRecentSession.session.currentIndex + 1} of {mostRecentSession.session.questionCount}
                {" · "}
                {mostRecentSession.session.settings.timed
                  ? `${Math.max(0, Math.floor((mostRecentSession.session.remainingSeconds ?? 0) / 60))} min remaining`
                  : "Untimed"}
              </div>
            </div>

            <Button size="sm" className="gap-2 self-start sm:self-auto" onClick={resumeMostRecentSession}>
              <PlayCircle className="h-4 w-4" />
              Continue
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <Select value={subjectFilter} onValueChange={(value) => setSubjectFilter(value as typeof subjectFilter)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            <SelectItem value="reading">Reading &amp; Writing</SelectItem>
            <SelectItem value="math">Math</SelectItem>
          </SelectContent>
        </Select>

        <Select value={moduleFilter} onValueChange={(value) => setModuleFilter(value as typeof moduleFilter)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Module" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            <SelectItem value="1">Module 1</SelectItem>
            <SelectItem value="2">Module 2</SelectItem>
          </SelectContent>
        </Select>

        <Select value={completionFilter} onValueChange={(value) => setCompletionFilter(value as typeof completionFilter)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="not-started">Not started</SelectItem>
            <SelectItem value="in-progress">In progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-3">
        {filteredPracticeSets.map((practiceSet) => (
          <Card key={practiceSet.id} className="border-border/70 bg-background/90">
            <CardHeader className="py-3">
              <div className="flex flex-row items-center gap-3">
                <div className="w-32 shrink-0 text-base font-semibold">Practice Set {practiceSet.setNumber}</div>
                <Button
                  size="sm"
                  variant="default"
                  className="gap-2"
                  onClick={() => navigate(`/practice-tests/${practiceSet.id}/start`)}
                >
                  Full Practice Test
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pb-3 pt-0">
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {practiceSet.modules.map((module) => {
                  const progressCounts = moduleProgressBySlug.get(module.slug) ?? {
                    correct: 0,
                    incorrect: 0,
                    correctAfterReview: 0,
                  };
                  const totalAnswered =
                    progressCounts.correct + progressCounts.incorrect + progressCounts.correctAfterReview;
                  const hasProgress = totalAnswered > 0;
                  const isCompleted = totalAnswered >= module.questionCount;

                  return (
                    <button
                      key={module.slug}
                      type="button"
                      onClick={() => openModule(module)}
                      className="group flex flex-col gap-1.5 rounded-md border border-border/60 bg-card px-3 py-2 text-left transition-colors hover:border-border hover:bg-muted/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-semibold">{module.publicTitle}</div>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </div>
                      <div className="flex h-1 w-full overflow-hidden rounded-full bg-muted">
                        {hasProgress && (
                          <>
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
                          </>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {totalAnswered}/{module.questionCount}
                        {isCompleted && (
                          <span className="ml-1 font-medium text-emerald-600">· Complete</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPracticeSets.length === 0 && (
        <Card className="border-dashed border-border/70">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No practice sets matched those filters.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Modules;
