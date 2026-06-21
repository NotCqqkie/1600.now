import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getPracticeSets,
  type PracticeModule,
  type PracticeSet,
} from "@/data/modulePracticeBank";
import {
  getModuleCompletionStatus,
  type ModuleCompletionStatus,
} from "@/lib/practice/moduleProgress";
import {
  clearModulePracticeSession,
  getModulePracticeSession,
} from "@/lib/practice/modulePracticeSession";
import { launchModulePractice } from "@/lib/practice/modulePracticeNavigation";
import {
  clearPracticeTestSession,
  getPracticeTestSession,
  type PracticeTestSessionMeta,
} from "@/lib/practice/practiceTestSession";
import { launchPracticeTest } from "@/lib/practice/practiceTestNavigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { useAuth } from "@/contexts/AuthContext";
import { PageSeo, buildBreadcrumbJsonLd } from "@/components/seo/PageSeo";

const practiceSets = getPracticeSets();
const MODULES_RETURN_SCROLL_Y_STORAGE_KEY = "modules:returnScrollY";

type SubjectFilter = "all" | "reading" | "math";
type ModuleFilter = "all" | "1" | "2";
type CompletionFilter = "all" | ModuleCompletionStatus;
type ModuleResumeSession = NonNullable<ReturnType<typeof getModulePracticeSession>>;
type ResumeEntry =
  | {
      kind: "module";
      startedAt: number;
      module: PracticeModule;
      session: ModuleResumeSession;
    }
  | {
      kind: "test";
      startedAt: number;
      practiceSet: PracticeSet;
      session: PracticeTestSessionMeta;
    };

const formatResumeTimeLeft = (seconds: number): string => {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")} left`;
};

const Modules = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilter>("all");
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("all");
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>("all");
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
    const stored = sessionStorage.getItem(MODULES_RETURN_SCROLL_Y_STORAGE_KEY);
    if (stored === null) return;
    sessionStorage.removeItem(MODULES_RETURN_SCROLL_Y_STORAGE_KEY);
    const scrollY = Number.parseInt(stored, 10);
    if (Number.isNaN(scrollY)) return;
    const run = () => window.scrollTo(0, scrollY);
    setTimeout(run, 0);
    setTimeout(run, 50);
  }, []);

  const rememberScrollAnd = (run: () => void): void => {
    sessionStorage.setItem(MODULES_RETURN_SCROLL_Y_STORAGE_KEY, String(window.scrollY));
    run();
  };

  const moduleCompletionBySlug = useMemo(() => {
    void progressRefreshKey;
    return new Map(
      practiceSets.flatMap((practiceSet) =>
        practiceSet.modules.map((module) => [module.slug, getModuleCompletionStatus(module, uid)] as const),
      ),
    );
  }, [progressRefreshKey, uid]);

  const mostRecentSession = useMemo<ResumeEntry | null>(() => {
    void progressRefreshKey;
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

    return [...moduleEntries, ...testEntries].sort((leftEntry, rightEntry) => rightEntry.startedAt - leftEntry.startedAt)[0] ?? null;
  }, [progressRefreshKey]);

  const filteredPracticeSets = useMemo(() => {
    return practiceSets
      .map((practiceSet) => ({
        ...practiceSet,
        modules: practiceSet.modules.filter((module) => {
          if (subjectFilter !== "all" && module.subject !== subjectFilter) return false;
          if (moduleFilter !== "all" && String(module.moduleNumber) !== moduleFilter) return false;
          if (completionFilter !== "all") {
            const status = moduleCompletionBySlug.get(module.slug) ?? "not-started";
            if (status !== completionFilter) return false;
          }
          return true;
        }),
      }))
      .filter((practiceSet) => practiceSet.modules.length > 0);
  }, [moduleFilter, subjectFilter, completionFilter, moduleCompletionBySlug]);

  const openModule = (module: PracticeModule): void => {
    navigate(`/modules/${module.slug}`);
  };

  const resumeMostRecentSession = (): void => {
    if (!mostRecentSession) return;
    if (mostRecentSession.kind === "module") {
      launchModulePractice({
        module: mostRecentSession.module,
        navigate,
        resumeExisting: true,
        savedSession: mostRecentSession.session,
      });
      return;
    }
    launchPracticeTest({
      practiceSet: mostRecentSession.practiceSet,
      navigate,
      resumeExisting: true,
      savedSession: mostRecentSession.session,
    });
  };

  const discardMostRecentSession = (): void => {
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
      <PageSeo
        id="modules-index"
        jsonLd={buildBreadcrumbJsonLd([
          { name: "Home", url: "https://1600.now/" },
          { name: "SAT Practice Tests", url: "https://1600.now/modules" },
        ])}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
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
          <p className="mt-2 font-sans text-[16px] leading-[1.5] text-ink-mid max-w-[600px]">
            Full SAT practice tests organized by subject and module.
          </p>
        </div>
      </div>

      {mostRecentSession ? (() => {
          const isModule = mostRecentSession.kind === "module";
          const label = isModule ? "Resume Most Recent Module" : "Resume Most Recent Practice Test";
          const title = isModule
            ? mostRecentSession.module.publicTitle
            : `Practice Test ${mostRecentSession.practiceSet.setNumber}`;
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
                  {timed ? formatResumeTimeLeft(remainingSeconds) : "Untimed"}
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
        <Select value={subjectFilter} onValueChange={(value) => setSubjectFilter(value as SubjectFilter)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            <SelectItem value="reading">English</SelectItem>
            <SelectItem value="math">Math</SelectItem>
          </SelectContent>
        </Select>

        <Select value={moduleFilter} onValueChange={(value) => setModuleFilter(value as ModuleFilter)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Module" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            <SelectItem value="1">Module 1</SelectItem>
            <SelectItem value="2">Module 2</SelectItem>
          </SelectContent>
        </Select>

        <Select value={completionFilter} onValueChange={(value) => setCompletionFilter(value as CompletionFilter)}>
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
          const rwModules = practiceSet.modules.filter((module) => module.subject === "reading");
          const mathModules = practiceSet.modules.filter((module) => module.subject === "math");
          return (
            <div
              key={practiceSet.id}
              className="group flex flex-col gap-3 rounded-xl border border-border/60 bg-card/60 p-4 transition-colors hover:border-border hover:bg-card"
            >
              <div
                className="font-display text-[24px] font-semibold leading-[1.1] tracking-[-0.02em] tabular-nums text-ink"
              >
                Practice Test {practiceSet.setNumber}
              </div>

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
                <div className="font-sans text-[11px] uppercase tracking-[0.18em] text-ink-muted font-semibold">
                  Individual Modules
                </div>
                <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
                  {rwModules.length > 0 && (
                    <>
                      <span className="font-sans text-[14px] font-medium text-ink-muted">
                        English
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
            <h3 className="font-display text-[22px] font-semibold leading-[1.15] tracking-[-0.015em] text-ink">
              No practice tests match
            </h3>
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
