import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  buildModulePracticeSet,
  getPracticeSets,
  type PracticeModule,
} from "@/data/modulePracticeBank";
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

const getModuleProgressCounts = (module: PracticeModule) => {
  return module.questions.reduce(
    (counts, entry) => {
      const status = localStorage.getItem(`${entry.bankQuestion.stableId}-status`);
      if (status === "correct-first") counts.correct += 1;
      if (status === "incorrect") counts.incorrect += 1;
      if (status === "correct-later") counts.correctAfterReview += 1;
      return counts;
    },
    { correct: 0, incorrect: 0, correctAfterReview: 0 },
  );
};

const Modules = () => {
  const navigate = useNavigate();
  const [subjectFilter, setSubjectFilter] = useState<"all" | "reading" | "math">("all");
  const [moduleFilter, setModuleFilter] = useState<"all" | "1" | "2">("all");

  const filteredPracticeSets = useMemo(() => {
    return practiceSets
      .map((practiceSet) => ({
        ...practiceSet,
        modules: practiceSet.modules.filter((module) => {
          if (subjectFilter !== "all" && module.subject !== subjectFilter) return false;
          if (moduleFilter !== "all" && String(module.moduleNumber) !== moduleFilter) return false;
          return true;
        }),
      }))
      .filter((practiceSet) => practiceSet.modules.length > 0);
  }, [moduleFilter, subjectFilter]);

  const moduleProgressBySlug = useMemo(() => {
    return new Map(
      practiceSets.flatMap((practiceSet) =>
        practiceSet.modules.map((module) => [module.slug, getModuleProgressCounts(module)] as const),
      ),
    );
  }, []);

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

      <Card className="border-border/70">
        <CardContent className="p-6">
          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {filteredPracticeSets.map((practiceSet) => (
          <Card key={practiceSet.id} className="border-border/70 bg-background/90">
            <CardHeader className="pb-3">
              <div className="text-lg font-semibold">Practice Set {practiceSet.setNumber}</div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {practiceSet.modules.map((module) => {
                const progressCounts = moduleProgressBySlug.get(module.slug) ?? {
                  correct: 0,
                  incorrect: 0,
                  correctAfterReview: 0,
                };
                const hasProgress =
                  progressCounts.correct > 0 ||
                  progressCounts.incorrect > 0 ||
                  progressCounts.correctAfterReview > 0;

                return (
                  <div
                    key={module.slug}
                    className="px-1 py-2"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold">
                          {module.publicTitle}
                          {hasProgress && (
                            <span className="ml-2 text-sm font-medium text-muted-foreground">
                              <span className="text-emerald-600">{progressCounts.correct} correct</span>
                              {" · "}
                              <span className="text-rose-600">{progressCounts.incorrect} incorrect</span>
                              {" · "}
                              <span className="text-sky-600">{progressCounts.correctAfterReview} after review</span>
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {module.subjectLabel} • Module {module.moduleNumber} • {module.questionCount} questions
                        </div>
                      </div>

                      <Button
                        className="group shrink-0 justify-between gap-2 sm:min-w-[180px]"
                        onClick={() => openModule(module)}
                      >
                        Enter module
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </Button>
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
