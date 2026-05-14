import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getPracticeModule,
  getPracticeSets,
  type PracticeModule,
  type PracticeSet,
} from "@/data/modulePracticeBank";
import {
  classifyModuleCompletion,
  getModuleProgressCounts,
} from "@/lib/moduleProgress";
import {
  clearModulePracticeSession,
  getModulePracticeSession,
} from "@/lib/modulePracticeSession";
import { launchModulePractice } from "@/lib/modulePracticeNavigation";
import {
  clearPracticeTestSession,
  getPracticeTestSession,
  type PracticeTestSessionMeta,
} from "@/lib/practiceTestSession";
import { launchPracticeTest } from "@/lib/practiceTestNavigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, PlayCircle, Trash2 } from "lucide-react";

const practiceSets = getPracticeSets();

const Modules = () => {
  const navigate = useNavigate();
  const [subjectFilter, setSubjectFilter] = useState<"all" | "reading" | "math">("all");
  const [moduleFilter, setModuleFilter] = useState<"all" | "1" | "2">("all");
  const [completionFilter, setCompletionFilter] = useState<"all" | "not-started" | "in-progress" | "completed">("all");
  const [progressRefreshKey, setProgressRefreshKey] = useState(0);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setProgressRefreshKey((k) => k + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem("modules:returnScrollY");
    if (stored === null) return;
    sessionStorage.removeItem("modules:returnScrollY");
    const y = Number.parseInt(stored, 10);
    if (Number.isNaN(y)) return;
    // Defer past ScrollToTop's navigation-driven scrollTo(0,0) with a microtask
    // chain that survives tab-backgrounding (rAF stalls when tab is hidden).
    const run = () => window.scrollTo(0, y);
    setTimeout(run, 0);
    setTimeout(run, 50);
  }, []);

  const rememberScrollAnd = (run: () => void) => {
    sessionStorage.setItem("modules:returnScrollY", String(window.scrollY));
    run();
  };

  const moduleProgressBySlug = useMemo(() => {
    return new Map(
      practiceSets.flatMap((practiceSet) =>
        practiceSet.modules.map((module) => [module.slug, getModuleProgressCounts(module)] as const),
      ),
    );
  }, [progressRefreshKey]);

  type ResumeEntry =
    | {
        kind: "module";
        startedAt: number;
        module: PracticeModule;
        session: NonNullable<ReturnType<typeof getModulePracticeSession>>;
      }
    | {
        kind: "test";
        startedAt: number;
        practiceSet: PracticeSet;
        session: PracticeTestSessionMeta;
      };

  const mostRecentSession = useMemo<ResumeEntry | null>(() => {
    const moduleEntries: ResumeEntry[] = practiceSets
      .flatMap((practiceSet) => practiceSet.modules)
      .map((module) => ({ module, session: getModulePracticeSession(module.slug) }))
      .filter(
        (entry): entry is { module: PracticeModule; session: NonNullable<ReturnType<typeof getModulePracticeSession>> } =>
          Boolean(entry.session) && entry.session.status !== "submitted",
      )
      .map((entry) => ({
        kind: "module" as const,
        startedAt: entry.session.startedAt,
        module: entry.module,
        session: entry.session,
      }));

    const testEntries: ResumeEntry[] = practiceSets
      .map((practiceSet) => ({ practiceSet, session: getPracticeTestSession(practiceSet.id) }))
      .filter(
        (entry): entry is { practiceSet: PracticeSet; session: PracticeTestSessionMeta } =>
          Boolean(entry.session) && entry.session.status !== "submitted",
      )
      .map((entry) => ({
        kind: "test" as const,
        startedAt: entry.session.startedAt,
        practiceSet: entry.practiceSet,
        session: entry.session,
      }));

    return [...moduleEntries, ...testEntries].sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;
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
    if (mostRecentSession.kind === "module") {
      const module = getPracticeModule(mostRecentSession.module.slug);
      if (!module) return;
      launchModulePractice({
        module,
        navigate,
        resumeExisting: true,
        savedSession: mostRecentSession.session,
        settings: mostRecentSession.session.settings,
      });
      return;
    }
    launchPracticeTest({
      practiceSet: mostRecentSession.practiceSet,
      navigate,
      resumeExisting: true,
      savedSession: mostRecentSession.session,
      settings: mostRecentSession.session.settings,
    });
  };

  const discardMostRecentSession = () => {
    if (!mostRecentSession) return;
    if (mostRecentSession.kind === "module") {
      clearModulePracticeSession(mostRecentSession.module.slug);
    } else {
      clearPracticeTestSession(mostRecentSession.practiceSet.id);
    }
    setProgressRefreshKey((k) => k + 1);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          {/* Page title — Inter Tight 600, 54px responsive, tracking -3.5%. */}
          <h1
            style={{
              fontFamily: "'Inter Tight', sans-serif",
              fontSize: "clamp(34px, 4.4vw, 54px)",
              fontWeight: 600,
              letterSpacing: "-0.035em",
              lineHeight: 1,
              color: "rgb(var(--ink))",
            }}
          >
            Practice Tests
          </h1>
          {/* Subtitle — Inter 400, 16px, leading 1.5, ink-mid. */}
          <p className="mt-2 font-sans text-[16px] leading-[1.5] text-ink-mid max-w-[600px]">
            Full SAT practice tests grouped by year, form, subject, and module.
          </p>
        </div>
      </div>

      {mostRecentSession ? (() => {
          const isModule = mostRecentSession.kind === "module";
          const label = isModule ? "Resume Most Recent Module" : "Resume Most Recent Practice Test";
          const title = isModule
            ? mostRecentSession.module.publicTitle
            : `Practice Set ${mostRecentSession.practiceSet.setNumber}`;
          const activeModule = !isModule
            ? mostRecentSession.session.modules[mostRecentSession.session.activeModuleIndex]
            : null;
          const questionCount = isModule
            ? mostRecentSession.module.questionCount
            : (activeModule?.questionCount ?? 0);
          const currentIndex = isModule
            ? mostRecentSession.session.currentIndex
            : mostRecentSession.session.currentIndex - (activeModule?.startIndex ?? 0);
          const timed = mostRecentSession.session.settings.timed;
          const remainingSeconds = isModule
            ? mostRecentSession.session.remainingSeconds ?? 0
            : mostRecentSession.session.modules[mostRecentSession.session.activeModuleIndex]?.remainingSeconds ?? 0;
          const formatTime = (secs: number) => {
            const safe = Math.max(0, secs);
            const m = Math.floor(safe / 60);
            const s = safe % 60;
            return `${m}:${String(s).padStart(2, "0")} left`;
          };
          const activeModuleTitle = !isModule
            ? mostRecentSession.session.modules[mostRecentSession.session.activeModuleIndex]?.moduleTitle
            : null;
          return (
        <>
          <Card className="border-border/70 bg-gradient-to-br from-card to-muted/30">
            <CardContent className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {label}
                </div>
                <div className="mt-0.5 text-base font-semibold tracking-[-0.02em] text-foreground">
                  {title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {activeModuleTitle ? `${activeModuleTitle} · ` : ""}
                  Question {currentIndex + 1} of {questionCount}
                  {" · "}
                  {timed ? formatTime(remainingSeconds) : "Untimed"}
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-muted-foreground hover:text-destructive"
                  onClick={() => setDiscardDialogOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Discard
                </Button>
                <Button size="sm" className="gap-2" onClick={resumeMostRecentSession}>
                  <PlayCircle className="h-4 w-4" />
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>

          <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Discard saved session?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your saved progress for{" "}
                  <strong>{title}</strong> (question{" "}
                  {currentIndex + 1} of {questionCount}). This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={discardMostRecentSession}
                >
                  Discard session
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
          );
        })() : null}

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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {filteredPracticeSets.map((practiceSet) => {
          const rwModules = practiceSet.modules.filter((m) => m.subject === "reading");
          const mathModules = practiceSet.modules.filter((m) => m.subject === "math");
          return (
            <div
              key={practiceSet.id}
              className="group flex flex-col gap-3 rounded-xl border border-border/60 bg-card/60 p-4 transition-colors hover:border-border hover:bg-card"
            >
              {/* Card title — Inter Tight 600, 24px, tracking -2%. */}
              <div
                className="font-display text-[24px] font-semibold leading-[1.1] tracking-[-0.02em] tabular-nums text-ink"
              >
                Practice Set {practiceSet.setNumber}
              </div>

              {/* Primary CTA — ink on accent, arrow right-aligned (justify-between). */}
              <Button
                size="default"
                variant="default"
                className="w-full justify-between gap-2"
                onClick={() =>
                  rememberScrollAnd(() => navigate(`/practice-tests/${practiceSet.id}/start`))
                }
              >
                Full Practice Test
                <ArrowRight className="h-4 w-4" />
              </Button>

              <div className="flex flex-col gap-2 border-t border-ds-line pt-[14px]">
                {/* INDIVIDUAL MODULES caption — Inter 600, 11px, +18% tracking. */}
                <div className="font-sans text-[11px] uppercase tracking-[0.18em] text-ink-muted font-semibold">
                  Individual Modules
                </div>
                <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
                  {rwModules.length > 0 && (
                    <>
                      {/* Module row label — Inter 500, 14px, muted. */}
                      <span className="font-sans text-[14px] font-medium text-ink-muted">
                        Reading
                      </span>
                      <div className="flex items-center gap-2">
                        {rwModules.map((module) => (
                          <Button
                            key={module.slug}
                            size="sm"
                            variant="outline"
                            className="h-9 flex-1 tabular-nums"
                            onClick={() => rememberScrollAnd(() => openModule(module))}
                          >
                            Module {module.moduleNumber}
                          </Button>
                        ))}
                      </div>
                    </>
                  )}
                  {mathModules.length > 0 && (
                    <>
                      <span className="font-sans text-[14px] font-medium text-ink-muted">
                        Math
                      </span>
                      <div className="flex items-center gap-2">
                        {mathModules.map((module) => (
                          <Button
                            key={module.slug}
                            size="sm"
                            variant="outline"
                            className="h-9 flex-1 tabular-nums"
                            onClick={() => rememberScrollAnd(() => openModule(module))}
                          >
                            Module {module.moduleNumber}
                          </Button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredPracticeSets.length === 0 && (
        <Card className="border-dashed border-ds-line">
          <CardContent className="py-12 text-center">
            {/* Empty headline — Inter Tight 600, ink. */}
            <h3 className="font-display text-[22px] font-semibold leading-[1.15] tracking-[-0.015em] text-ink">
              No practice sets match
            </h3>
            {/* Helper — Inter 400, 13px, ink-mid. Always followed by a reset action. */}
            <p className="mt-2 font-sans text-[13px] leading-[1.55] text-ink-mid">
              Try clearing the subject, module, or status filters.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Modules;
