import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Bookmark, Eye, EyeOff, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  buildPracticeTestQuestionSet,
  getPracticeSet,
} from "@/data/modulePracticeBank";
import {
  buildPracticeTestSessionAfterCurrentModuleSubmit,
  buildPracticeTestResult,
  clearPracticeTestSession,
  getPracticeTestQuestionState,
  getPracticeTestSession,
  savePracticeTestSession,
  savePracticeTestResult,
  tickPracticeTestActiveModule,
} from "@/lib/practice/practiceTestSession";
import { cn } from "@/lib/utils";

const formatClock = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

const PracticeTestReview = () => {
  const { setId } = useParams<{ setId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const practiceSet = useMemo(() => (setId ? getPracticeSet(setId) : null), [setId]);
  const sessionId = searchParams.get("session");
  const [session, setSession] = useState(
    () => (practiceSet ? getPracticeTestSession(practiceSet.id) : null),
  );
  const questionSet = useMemo(
    () => (practiceSet ? buildPracticeTestQuestionSet(practiceSet.id) : null),
    [practiceSet],
  );
  const activeModule = session ? session.modules[session.activeModuleIndex] : null;
  const [isTimerVisible, setIsTimerVisible] = useState(true);
  const [isTimerPaused, setIsTimerPaused] = useState(false);

  useEffect(() => {
    if (!practiceSet || !questionSet) return;
    sessionStorage.setItem("practiceExitTo", `/practice-tests/${practiceSet.id}/start`);
    sessionStorage.setItem("practiceSet", JSON.stringify(questionSet));
  }, [practiceSet, questionSet]);

  useEffect(() => {
    setSession(practiceSet ? getPracticeTestSession(practiceSet.id) : null);
  }, [practiceSet, sessionId]);

  const submitCurrentModule = useCallback((sessionToSubmit: typeof session) => {
    if (!practiceSet || !sessionToSubmit) return;

    if (sessionToSubmit.activeModuleIndex === sessionToSubmit.modules.length - 1) {
      const result = buildPracticeTestResult(practiceSet, {
        ...sessionToSubmit,
        status: "submitted",
      });
      savePracticeTestResult(result);
      clearPracticeTestSession(practiceSet.id);
      sessionStorage.removeItem("practiceSet");
      sessionStorage.removeItem("practiceExitTo");
      navigate(`/practice-tests/${practiceSet.id}/results?session=${result.sessionId}`);
      return;
    }

    const nextSession = buildPracticeTestSessionAfterCurrentModuleSubmit(sessionToSubmit);
    if (!nextSession) return;

    setSession(nextSession);
    savePracticeTestSession(nextSession);
    navigate(
      `/practice-tests/${practiceSet.id}/transition?session=${sessionToSubmit.sessionId}&kind=${sessionToSubmit.activeModuleIndex === 1 ? "break" : "module"}`,
    );
  }, [navigate, practiceSet]);

  const handleSubmit = useCallback(() => {
    submitCurrentModule(session);
  }, [session, submitCurrentModule]);

  useEffect(() => {
    if (!practiceSet || !session || !sessionId || session.sessionId !== sessionId) return;
    if (session.status !== "active" || !activeModule) return;
    if (isTimerPaused) return;

    const timerId = window.setInterval(() => {
      const latestSession = getPracticeTestSession(practiceSet.id);
      if (!latestSession || latestSession.sessionId !== sessionId || latestSession.status !== "active") {
        window.clearInterval(timerId);
        return;
      }

      const nextSession = tickPracticeTestActiveModule(latestSession);
      setSession(nextSession);
      savePracticeTestSession(nextSession);
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [activeModule, practiceSet, session, sessionId, isTimerPaused]);

  useEffect(() => {
    if (!session || session.status !== "active" || !session.settings.timed || !activeModule) return;
    if (activeModule.remainingSeconds !== 0) return;
    submitCurrentModule(session);
  }, [activeModule, session, submitCurrentModule]);

  if (!practiceSet || !session || !sessionId || session.sessionId !== sessionId || !questionSet) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
        <Card className="border-dashed border-border/70">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold">Practice test review not found</h2>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!activeModule) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
        <Card className="border-dashed border-border/70">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold">Practice test review not found</h2>
          </CardContent>
        </Card>
      </div>
    );
  }

  const moduleQuestions = questionSet.filter(
    (item) => item.moduleSlug === activeModule.moduleSlug,
  );
  const answeredCount = moduleQuestions.reduce((count, item) => {
    const state = getPracticeTestQuestionState(session.sessionId, item.storageId);
    return count + (state.answer || state.freeResponseAnswer ? 1 : 0);
  }, 0);
  const currentQuestion =
    questionSet[Math.min(session.currentIndex, activeModule.endIndex)] ?? moduleQuestions[0];
  const isLastModule = session.activeModuleIndex === session.modules.length - 1;
  const displayedTimerSeconds = session.settings.timed
    ? activeModule.remainingSeconds ?? 0
    : activeModule.elapsedSeconds;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Fixed timer header */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-center px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setIsTimerVisible((prev) => !prev)}
              title={isTimerVisible ? "Hide timer" : "Show timer"}
            >
              {isTimerVisible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </Button>
            <span className="min-w-[5ch] text-center text-xl font-semibold tabular-nums">
              {isTimerVisible ? formatClock(displayedTimerSeconds) : "-:--"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setIsTimerPaused((prev) => !prev)}
              title={isTimerPaused ? "Resume timer" : "Pause timer"}
            >
              {isTimerPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-3 text-center">
          <h1
            style={{
              fontFamily: "'Geist', Georgia, serif",
              fontSize: "clamp(34px, 4.3vw, 60px)",
              fontWeight: 400,
              letterSpacing: "-0.05em",
              lineHeight: 0.96,
            }}
          >
            Review Questions
          </h1>
          <div className="space-y-1.5 text-base text-muted-foreground">
            <p>On test day, you would stay in the module until time runs out.</p>
            <p>
              For this practice test, you can move on when you feel ready and submit
              once you have checked your work.
            </p>
          </div>
        </div>

        <div className="rounded-[28px] border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-2xl font-semibold tracking-[-0.03em]">{activeModule.moduleTitle}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{answeredCount}</span> of {moduleQuestions.length} answered
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[13px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-4 rounded-md border-2 border-dashed border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/20" />
                Unanswered
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-4 rounded-md border border-emerald-500/40 bg-emerald-500/10" />
                Answered
              </div>
              <div className="flex items-center gap-1.5">
                <Bookmark className="h-3.5 w-3.5 bookmark-flag" />
                For Review
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(42px,1fr))] gap-2.5">
            {moduleQuestions.map((question) => {
              const state = getPracticeTestQuestionState(session.sessionId, question.storageId);
              const answered = Boolean(state.answer || state.freeResponseAnswer);

              return (
                <button
                  key={question.storageId}
                  onClick={() =>
                    navigate(
                      `/bank/${question.subject}/${question.sourceId}?bankType=past&practice=true&idx=${question.globalQuestionNumber}&practiceTest=${practiceSet.id}&practiceTestSession=${session.sessionId}`,
                    )
                  }
                  className={cn(
                    "relative flex h-10 items-center justify-center rounded-lg text-base font-semibold transition-colors sm:h-11 sm:text-lg",
                    answered
                      ? "border border-emerald-500/40 bg-emerald-500/10 text-foreground hover:bg-emerald-500/20"
                      : "border-2 border-dashed border-amber-400/60 bg-amber-50/30 text-muted-foreground hover:bg-amber-100/40 dark:bg-amber-950/20 dark:hover:bg-amber-950/30",
                  )}
                >
                  {state.isMarkedForReview ? (
                    <Bookmark className="absolute right-1 top-1 h-3 w-3 bookmark-flag" />
                  ) : null}
                  {question.moduleQuestionNumber}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-3">
          <Button variant="outline" className="bg-transparent" asChild>
            <Link
              to={`/bank/${currentQuestion.subject}/${currentQuestion.sourceId}?bankType=past&practice=true&idx=${session.currentIndex + 1}&practiceTest=${practiceSet.id}&practiceTestSession=${session.sessionId}`}
            >
              Back
            </Link>
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="min-w-[140px]">Submit</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {isLastModule ? "Submit this practice test?" : "Submit this module?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {isLastModule
                    ? "This will calculate the score and open results."
                    : "Once you submit, this module will end and the next section will begin."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep reviewing</AlertDialogCancel>
                <button
                  onClick={handleSubmit}
                  className="inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                >
                  {isLastModule ? "Submit test" : "Submit module"}
                </button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

export default PracticeTestReview;
