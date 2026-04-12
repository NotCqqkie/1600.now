import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  buildModulePracticeSet,
  getPracticeSets,
  type PracticeModule,
} from "@/data/modulePracticeBank";
import {
  classifyModuleCompletion,
  getModuleProgressCounts,
} from "@/lib/moduleProgress";
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
import { ArrowRight } from "lucide-react";

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
    const practiceSet = buildModulePracticeSet(module.slug);
    if (!practiceSet || practiceSet.length === 0) return;

    sessionStorage.setItem("practiceExitTo", "/modules");
    sessionStorage.setItem("practiceSet", JSON.stringify(practiceSet));
    const first = practiceSet[0];
    navigate(`/bank/${first.subject}/${first.id}?bankType=past&practice=true&idx=0`);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <h1
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: "clamp(32px, 4vw, 48px)",
            fontWeight: 400,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            color: "hsl(var(--foreground))",
          }}
        >
          SAT Module Practice
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
          Practice full SAT modules grouped into complete reading and math sets.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Select value={subjectFilter} onValueChange={(value) => setSubjectFilter(value as typeof subjectFilter)}>
          <SelectTrigger>
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            <SelectItem value="reading">Reading &amp; Writing</SelectItem>
            <SelectItem value="math">Math</SelectItem>
          </SelectContent>
        </Select>

        <Select value={moduleFilter} onValueChange={(value) => setModuleFilter(value as typeof moduleFilter)}>
          <SelectTrigger>
            <SelectValue placeholder="Module" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            <SelectItem value="1">Module 1</SelectItem>
            <SelectItem value="2">Module 2</SelectItem>
          </SelectContent>
        </Select>

        <Select value={completionFilter} onValueChange={(value) => setCompletionFilter(value as typeof completionFilter)}>
          <SelectTrigger>
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

      <div className="flex flex-col gap-4">
        {filteredPracticeSets.map((practiceSet) => (
          <Card key={practiceSet.id} className="border-border/70 bg-background/90">
            <CardHeader className="pb-3">
              <div className="text-lg font-semibold">Practice Set {practiceSet.setNumber}</div>
            </CardHeader>
            <CardContent className="flex flex-col">
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
                  <div
                    key={module.slug}
                    className="group border-b border-border/60 py-4 last:border-b-0"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-semibold">{module.publicTitle}</div>
                        <div className="mt-2">
                          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            {hasProgress && (
                              <>
                                <div
                                  className="bg-emerald-500 transition-all"
                                  style={{
                                    width: `${(progressCounts.correct / module.questionCount) * 100}%`,
                                  }}
                                />
                                <div
                                  className="bg-amber-400 transition-all"
                                  style={{
                                    width: `${(progressCounts.correctAfterReview / module.questionCount) * 100}%`,
                                  }}
                                />
                                <div
                                  className="bg-rose-500 transition-all"
                                  style={{
                                    width: `${(progressCounts.incorrect / module.questionCount) * 100}%`,
                                  }}
                                />
                              </>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {totalAnswered}/{module.questionCount} answered
                            {isCompleted && (
                              <span className="ml-1.5 font-medium text-emerald-600">· Complete</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Button className="group/btn gap-2" onClick={() => openModule(module)}>
                          Enter module
                          <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
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
