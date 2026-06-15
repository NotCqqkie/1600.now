import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  BookOpenCheck,
  Info,
  MoreHorizontal,
  MousePointerClick,
  Play,
  StickyNote,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  deleteCustomPracticeSet,
  getCustomPracticeSets,
  launchCustomPracticeSet,
  type CustomPracticeSet,
} from "@/lib/practice/customPracticeSets";
import {
  getQuestionAnswered,
  getQuestionStatus,
} from "@/lib/practice/questionUiState";
import { useUserProgress, type QuestionProgress } from "@/hooks/useUserProgress";
import { useAuth } from "@/contexts/AuthContext";

const formatDate = (timestamp: number) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));

const subjectLabel = (subject: CustomPracticeSet["subject"]) =>
  subject === "math" ? "Math" : subject === "reading" ? "Reading & Writing" : "Mixed";

const PRACTICE_SET_HELP_REQUEST_KEY = "practice-set-help-requested";
const PRACTICE_SET_HELP_EVENT = "onboarding:practice-set-help";
const completedQuestionStatuses = new Set(["correct-first", "correct-later", "incorrect"]);

const getPracticeSetProgress = (
  set: CustomPracticeSet,
  progress: Record<string, QuestionProgress>,
  uid: string | null | undefined,
) => {
  let completedCount = 0;
  let started = false;
  let firstIncompleteIndex = -1;

  set.items.forEach((item, index) => {
    const questionProgress = progress[item.storageId];
    const hasAttempt = Boolean(questionProgress?.attempts.length);
    const status = getQuestionStatus(item.storageId, uid);
    const hasCompletedStatus = Boolean(status && completedQuestionStatuses.has(status));
    const hasSavedAnswer = getQuestionAnswered(item.storageId, uid);
    const isComplete = hasAttempt || hasCompletedStatus;

    if (isComplete) completedCount += 1;
    if (isComplete || hasSavedAnswer) started = true;
    if (!isComplete && firstIncompleteIndex === -1) firstIncompleteIndex = index;
  });

  return {
    completedCount,
    totalCount: set.items.length,
    started,
    resumeIndex: firstIncompleteIndex === -1 ? 0 : firstIncompleteIndex,
  };
};

const tutorialSteps = [
  {
    title: "Open a question",
    body: "Use any Question Bank problem you want more practice on.",
  },
  {
    title: "Tap More",
    body: "Create Practice Set uses that question's SAT skill and content type to find related bank questions.",
  },
  {
    title: "Create Practice Set",
    body: "The saved set appears here for focused review.",
  },
];

const MyPracticeSets = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const { progress } = useUserProgress();
  const [refreshKey, setRefreshKey] = useState(0);
  const practiceSets = useMemo(() => {
    void refreshKey;
    return getCustomPracticeSets(uid);
  }, [refreshKey, uid]);

  const handleDelete = (setId: string) => {
    deleteCustomPracticeSet(setId, uid);
    setRefreshKey((key) => key + 1);
  };

  const handleShowPracticeSetHelp = () => {
    sessionStorage.setItem(PRACTICE_SET_HELP_REQUEST_KEY, "1");
    window.dispatchEvent(new CustomEvent(PRACTICE_SET_HELP_EVENT));
    window.setTimeout(() => {
      if (sessionStorage.getItem(PRACTICE_SET_HELP_REQUEST_KEY) === "1") {
        window.dispatchEvent(new CustomEvent(PRACTICE_SET_HELP_EVENT));
      }
    }, 0);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-display text-[clamp(34px,4.4vw,54px)] font-semibold leading-none tracking-[-0.035em] text-ink">
          My Practice Sets
        </h1>
      </div>

      {practiceSets.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {practiceSets.map((set) => {
            const setProgress = getPracticeSetProgress(set, progress, uid);
            const progressPercent = setProgress.totalCount
              ? Math.round((setProgress.completedCount / setProgress.totalCount) * 100)
              : 0;
            const actionLabel = setProgress.started ? "Resume" : "Start";

            return (
              <Card key={set.id} className="border-border/70 bg-card">
                <CardContent className="flex h-full flex-col gap-5 pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <BookOpenCheck className="h-4 w-4" />
                        {subjectLabel(set.subject)}
                      </div>
                      <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-foreground">
                        {set.title}
                      </h2>
                      <div className="mt-2 text-sm text-muted-foreground">
                        {set.questionCount} questions · {formatDate(set.updatedAt)}
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Delete practice set"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this practice set?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove "{set.title}" from My Practice Sets. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDelete(set.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-foreground">
                        {setProgress.completedCount} / {setProgress.totalCount} complete
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {progressPercent}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-sky-500 transition-[width] duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs font-medium">
                    <span className="rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-muted-foreground">
                      {set.domain}
                    </span>
                    <span className="rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-muted-foreground">
                      {set.skill}
                    </span>
                  </div>

                  <div className="mt-auto flex justify-end">
                    <Button
                      type="button"
                      className="gap-2"
                      onClick={() => launchCustomPracticeSet(set, navigate, "/my-practice-sets", setProgress.resumeIndex)}
                    >
                      <Play className="h-4 w-4" />
                      {actionLabel}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden border-border/70 bg-card">
          <CardContent className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-200">
                <BookOpenCheck className="h-3.5 w-3.5" />
                Practice sets
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-[-0.025em] text-foreground sm:text-3xl">
                Make your first practice set from any question
              </h2>

              <div className="mt-6 space-y-3">
                {tutorialSteps.map((step, index) => (
                  <div key={step.title} className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-xs font-semibold text-background">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{step.title}</div>
                      <div className="text-sm text-muted-foreground">{step.body}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                <Button type="button" className="gap-2" onClick={handleShowPracticeSetHelp}>
                  <MousePointerClick className="h-4 w-4" />
                  Show me
                </Button>
                <Button type="button" variant="outline" className="gap-2" onClick={() => navigate("/bank")}>
                  <BookOpen className="h-4 w-4" />
                  Open Question Bank
                </Button>
              </div>
            </div>

            <div aria-hidden="true" className="relative min-h-[320px] overflow-hidden rounded-lg border border-border bg-background p-4 shadow-sm">
              <div className="absolute inset-x-0 top-0 h-1 bg-sky-500" />
              <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-12 items-center justify-center rounded-md border border-border bg-card text-sm font-bold tabular-nums">
                    12
                  </div>
                  <div className="h-3 w-24 rounded-full bg-muted" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden h-8 w-20 rounded-md border border-border bg-card sm:block" />
                  <div className="hidden h-8 w-20 rounded-md border border-border bg-card sm:block" />
                  <div className="flex h-8 items-center gap-1 rounded-md border-2 border-sky-500 bg-sky-500/10 px-2 text-xs font-semibold text-sky-700 shadow-[0_0_24px_rgba(14,165,233,0.28)] dark:text-sky-200">
                    <MoreHorizontal className="h-4 w-4" />
                    More
                  </div>
                </div>
              </div>

              <div className="mt-7 max-w-[58%] space-y-3">
                <div className="h-3 w-full rounded-full bg-muted" />
                <div className="h-3 w-11/12 rounded-full bg-muted" />
                <div className="h-3 w-4/5 rounded-full bg-muted" />
                <div className="mt-5 space-y-2">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="h-8 rounded-md border border-border/70 bg-card" />
                  ))}
                </div>
              </div>

              <div className="tour-coach-card absolute left-4 right-4 top-20 rounded-lg border border-border bg-card p-2 shadow-xl sm:left-auto sm:right-5 sm:w-64">
                <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  More
                </div>
                <div className="flex items-center gap-2 rounded-md px-2 py-2 text-xs text-muted-foreground">
                  <StickyNote className="h-4 w-4" />
                  Add Note
                </div>
                <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                  <BookOpenCheck className="h-4 w-4" />
                  Create Practice Set
                </div>
                <div className="mt-1 flex items-center gap-2 rounded-md px-2 py-2 text-xs text-muted-foreground">
                  <Info className="h-4 w-4" />
                  Question Info
                </div>
              </div>

            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MyPracticeSets;
