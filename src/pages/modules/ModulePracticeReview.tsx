import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Bookmark } from "lucide-react";
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
import {
  advanceModulePracticeSessionTimer,
  buildModulePracticeResult,
  clearModulePracticeSession,
  getModulePracticeQuestionState,
  getModulePracticeSession,
  resumeModulePracticeSession,
  saveModulePracticeSession,
  saveModulePracticeResult,
} from "@/lib/practice/modulePracticeSession";
import { formatPracticeClock } from "@/lib/practice/practiceTime";
import { getPracticeModule, loadPracticeModule } from "@/data/modulePracticeBank";
import { buildModulePracticeQuestionRoute } from "@/lib/practice/practiceBankRoutes";
import {
  PRACTICE_EXIT_TO_STORAGE_KEY,
  PRACTICE_SET_STORAGE_KEY,
} from "@/lib/practice/practiceRunStorage";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  completeStudyPlanModuleAssignment,
  getMatchingStudyPlanAssignmentSession,
  pauseStudyPlanAssignment,
  resumeStudyPlanAssignment,
} from "@/lib/studyPlan/assignmentContext";

const NOT_FOUND_SHELL_CLASS = "mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 bg-background px-4 py-12 text-foreground sm:px-6";
const NOT_FOUND_CARD_CLASS = "rounded-[28px] border border-border bg-card p-10 text-center";
const PAGE_SHELL_CLASS = "min-h-screen bg-background text-foreground";
const PAGE_CONTENT_CLASS = "mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8";
const REVIEW_CARD_CLASS = "rounded-[28px] border border-border bg-card p-5 shadow-sm sm:p-6";
const LEGEND_ITEM_CLASS = "flex items-center gap-1.5";
const UNANSWERED_SWATCH_CLASS = "h-4 w-4 rounded-md border-2 border-dashed border-border bg-background/40";
const ANSWERED_SWATCH_CLASS = "h-4 w-4 rounded-md border border-border bg-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]";
const QUESTION_TILE_BASE_CLASS = "relative flex h-11 min-w-11 items-center justify-center rounded-lg text-base font-semibold transition-colors sm:text-lg";
const QUESTION_TILE_ANSWERED_CLASS = "border border-border bg-muted text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-muted/85";
const QUESTION_TILE_UNANSWERED_CLASS = "border-2 border-dashed border-border bg-background/50 text-muted-foreground hover:bg-muted/25";
const MARKED_ICON_CLASS = "absolute right-1 top-1 h-3 w-3 bookmark-flag";
const REVIEW_HEADING_STYLE = {
  fontFamily: "'Geist', Georgia, serif",
  fontSize: "clamp(34px, 4.3vw, 60px)",
  fontWeight: 400,
  letterSpacing: "-0.05em",
  lineHeight: 0.96,
} as const;

const getBackQuestionIndex = (currentIndex: number, questionCount: number): number =>
  Math.min(currentIndex, questionCount - 1);

const clearModuleReviewSessionStorage = () => {
  sessionStorage.removeItem(PRACTICE_SET_STORAGE_KEY);
  sessionStorage.removeItem(PRACTICE_EXIT_TO_STORAGE_KEY);
};

const ModulePracticeReview = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const ownerUid = user?.uid ?? null;
  const module = useMemo(
    () => (moduleId ? getPracticeModule(moduleId) : null),
    [moduleId],
  );
  const sessionId = searchParams.get("session");
  const [session, setSession] = useState(() =>
    module ? getModulePracticeSession(module.slug, ownerUid) : null,
  );
  const sessionRef = useRef(session);
  const timerLastSyncedAtRef = useRef(Date.now());
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const studyPlanAssignment = getMatchingStudyPlanAssignmentSession({
    ownerUid,
    moduleSlug: module?.slug ?? moduleId,
    moduleSessionId: session?.sessionId ?? sessionId,
  });
  const isStudyPlanTimedModule = Boolean(
    studyPlanAssignment?.context.source.kind === "module" &&
      session?.settings.timed &&
      session.settings.timeLimitSeconds,
  );
  const isStudyPlanTimerExpired = Boolean(
    isStudyPlanTimedModule && session?.remainingSeconds === 0,
  );
  const isStudyPlanModulePaused = Boolean(
    studyPlanAssignment && session?.status === "paused",
  );

  const syncReviewTimer = useCallback((now = Date.now()) => {
    const current = sessionRef.current;
    const elapsedMs = Math.max(0, now - (current?.timerUpdatedAt ?? timerLastSyncedAtRef.current));
    timerLastSyncedAtRef.current = now;
    if (!isStudyPlanTimedModule || !current || current.status !== "active" || !elapsedMs) {
      return current;
    }
    const next = advanceModulePracticeSessionTimer(current, elapsedMs, now);
    if (next === current) return current;
    sessionRef.current = next;
    setSession(next);
    saveModulePracticeSession(next);
    return next;
  }, [isStudyPlanTimedModule]);

  useEffect(() => {
    if (module) void loadPracticeModule(module.slug);
  }, [module]);

  useEffect(() => {
    const next = module ? getModulePracticeSession(module.slug, ownerUid) : null;
    sessionRef.current = next;
    timerLastSyncedAtRef.current = Date.now();
    setSession(next);
    setIsSubmitDialogOpen(false);
  }, [module, ownerUid, sessionId]);

  useEffect(() => {
    if (!isStudyPlanModulePaused) return;
    const currentSession = sessionRef.current;
    if (!currentSession || currentSession.status !== "paused") return;

    const resumedAt = Date.now();
    const resumedSession = resumeModulePracticeSession(currentSession, resumedAt);
    sessionRef.current = resumedSession;
    timerLastSyncedAtRef.current = resumedAt;
    setSession(resumedSession);
    saveModulePracticeSession(resumedSession);
    resumeStudyPlanAssignment(ownerUid);
  }, [isStudyPlanModulePaused, ownerUid, session?.sessionId]);

  useEffect(() => {
    if (!isStudyPlanTimedModule || !sessionRef.current) return;
    timerLastSyncedAtRef.current = Date.now();
    const timerId = window.setInterval(() => syncReviewTimer(), 250);
    return () => {
      syncReviewTimer();
      window.clearInterval(timerId);
    };
  }, [isStudyPlanTimedModule, session?.sessionId, syncReviewTimer]);

  useEffect(() => {
    if (isStudyPlanTimerExpired) setIsSubmitDialogOpen(true);
  }, [isStudyPlanTimerExpired]);

  if (isStudyPlanModulePaused) {
    return (
      <div className={NOT_FOUND_SHELL_CLASS} role="status" aria-live="polite">
        <div className={NOT_FOUND_CARD_CLASS}>Resuming assignment…</div>
      </div>
    );
  }

  if (!module || !session || !sessionId || session.sessionId !== sessionId) {
    return (
      <div className={NOT_FOUND_SHELL_CLASS}>
        <div className={NOT_FOUND_CARD_CLASS}>
          <h1 className="text-2xl font-semibold">Review session not found</h1>
          {studyPlanAssignment ? (
            <Button className="mt-6" onClick={() => navigate(studyPlanAssignment.context.returnPath)}>
              Return to study plan
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const questions = module.questions.map((entry) => {
    const state = getModulePracticeQuestionState(session.sessionId, entry.bankQuestion.stableId);
    const answer =
      entry.bankQuestion.type === "free-response" ? state.freeResponseAnswer : state.answer;
    return {
      number: entry.slot,
      answered: Boolean(answer),
      marked: state.isMarkedForReview,
      stableId: entry.bankQuestion.stableId,
      sourceId: entry.bankQuestion.sourceId,
      bankType: entry.bankQuestion.bankType,
    };
  });

  const getQuestionPath = (sourceId: string, bankType: "past" | "unofficial", idx: number) =>
    buildModulePracticeQuestionRoute({
      subject: module.subject,
      sourceId,
      bankType,
      idx,
      moduleSlug: module.slug,
      moduleSessionId: session.sessionId,
    });

  const backQuestionIndex = getBackQuestionIndex(session.currentIndex, module.questions.length);
  const backQuestion = module.questions[backQuestionIndex]?.bankQuestion;

  const handleSubmit = async () => {
    const currentSession = syncReviewTimer() ?? sessionRef.current ?? session;
    if (!currentSession) return;
    const submittedSession = {
      ...currentSession,
      status: "submitted" as const,
    };
    if (isStudyPlanTimedModule) {
      sessionRef.current = submittedSession;
      setSession(submittedSession);
      saveModulePracticeSession(submittedSession);
    }
    const loadedModule = await loadPracticeModule(module.slug);
    if (!loadedModule) return;
    const result = buildModulePracticeResult(loadedModule, submittedSession);
    saveModulePracticeResult(result, user?.id ?? null);
    completeStudyPlanModuleAssignment(result, ownerUid);
    clearModulePracticeSession(module.slug, ownerUid);
    clearModuleReviewSessionStorage();
    navigate(`/modules/${module.slug}/results?session=${result.sessionId}`);
  };

  const handleReturnToStudyPlan = () => {
    if (!studyPlanAssignment) return;
    const currentSession = syncReviewTimer() ?? sessionRef.current ?? session;
    if (!currentSession) return;
    const pausedSession = { ...currentSession, status: "paused" as const };
    sessionRef.current = pausedSession;
    saveModulePracticeSession(pausedSession);
    pauseStudyPlanAssignment(ownerUid);
    navigate(studyPlanAssignment.context.returnPath);
  };

  return (
    <div className={PAGE_SHELL_CLASS}>
      <div className={PAGE_CONTENT_CLASS}>
        {studyPlanAssignment ? (
          <Button variant="ghost" className="w-fit gap-2 px-0" onClick={handleReturnToStudyPlan}>
            <ArrowLeft className="h-4 w-4" />
            Return to study plan
          </Button>
        ) : null}

        <div className="space-y-3 text-center">
          <h1 style={REVIEW_HEADING_STYLE}>
            Review Questions
          </h1>
          <div className="space-y-1.5 text-base text-muted-foreground">
            {isStudyPlanTimedModule ? (
              <>
                <p>Your assignment timer continues while you review.</p>
                <p className="font-semibold tabular-nums text-foreground" role="timer" aria-live="polite">
                  {formatPracticeClock(session.remainingSeconds ?? 0)} remaining
                </p>
              </>
            ) : (
              <>
                <p>On test day, you would stay in the module until time runs out.</p>
                <p>
                  For this practice module, you can move on when you feel ready and submit
                  once you have checked your work.
                </p>
              </>
            )}
          </div>
        </div>

        <div className={REVIEW_CARD_CLASS}>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-2xl font-semibold tracking-[-0.03em]">{module.publicTitle}</div>
              <div className="mt-1 text-sm text-muted-foreground">{module.questionCount} questions</div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[13px] text-muted-foreground">
              <div className={LEGEND_ITEM_CLASS}>
                <div className={UNANSWERED_SWATCH_CLASS} />
                Unanswered
              </div>
              <div className={LEGEND_ITEM_CLASS}>
                <div className={ANSWERED_SWATCH_CLASS} />
                Answered
              </div>
              <div className={LEGEND_ITEM_CLASS}>
                <Bookmark className="h-3.5 w-3.5 bookmark-flag" />
                For Review
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(44px,1fr))] gap-2.5">
            {questions.map((question) => (
              <button
                key={question.stableId}
                disabled={isStudyPlanTimerExpired}
                onClick={() =>
                  navigate(
                    getQuestionPath(question.sourceId, question.bankType, question.number),
                  )
                }
                className={cn(
                  QUESTION_TILE_BASE_CLASS,
                  question.answered ? QUESTION_TILE_ANSWERED_CLASS : QUESTION_TILE_UNANSWERED_CLASS,
                  isStudyPlanTimerExpired && "cursor-not-allowed opacity-60",
                )}
              >
                {question.marked ? (
                  <Bookmark className={MARKED_ICON_CLASS} />
                ) : null}
                {question.number}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-3">
          <Button
            variant="outline"
            className="bg-transparent"
            disabled={isStudyPlanTimerExpired || !backQuestion}
            onClick={() => {
              if (!isStudyPlanTimerExpired && backQuestion) {
                navigate(getQuestionPath(backQuestion.sourceId, backQuestion.bankType, session.currentIndex + 1));
              }
            }}
          >
            Back
          </Button>

          <AlertDialog
            open={isSubmitDialogOpen}
            onOpenChange={(open) => {
              if (!open && isStudyPlanTimerExpired) return;
              setIsSubmitDialogOpen(open);
            }}
          >
            <AlertDialogTrigger asChild>
              <Button className="min-w-[140px]">Submit</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Submit this module?</AlertDialogTitle>
                <AlertDialogDescription>
                  {isStudyPlanTimerExpired
                    ? "Time has expired. Submit now to finish this study-plan assignment."
                    : "Once you submit, this session will end and you will move to the review page."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                {!isStudyPlanTimerExpired ? <AlertDialogCancel>Keep reviewing</AlertDialogCancel> : null}
                <AlertDialogAction onClick={handleSubmit}>Submit module</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

export default ModulePracticeReview;
