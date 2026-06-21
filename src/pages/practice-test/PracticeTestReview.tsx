import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Bookmark, Eye, EyeOff, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
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
  type PracticeTestQuestionItem,
} from "@/data/modulePracticeBank";
import { buildPracticeTestQuestionRoute } from "@/lib/practice/practiceBankRoutes";
import {
  buildPracticeTestSessionAfterCurrentModuleSubmit,
  buildPracticeTestResult,
  clearPracticeTestSession,
  getPracticeTestQuestionState,
  getPracticeTestSession,
  savePracticeTestSession,
  savePracticeTestResult,
  tickPracticeTestActiveModule,
  type PracticeTestSessionMeta,
} from "@/lib/practice/practiceTestSession";
import { clearDesmosUiState } from "@/lib/practice/desmosSessionState";
import {
  PRACTICE_EXIT_TO_STORAGE_KEY,
  PRACTICE_MODULES_EXIT_PATH,
  PRACTICE_SET_STORAGE_KEY,
  writePracticeLaunchStorage,
} from "@/lib/practice/practiceRunStorage";
import { formatPracticeClock } from "@/lib/practice/practiceTime";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const PRACTICE_TEST_DESMOS_SCOPE_PREFIX = "practice-test:";
const NOT_FOUND_SHELL_CLASS = "mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6";
const PAGE_SHELL_CLASS = "min-h-screen bg-background text-foreground";
const TIMER_HEADER_CLASS = "sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60";
const TIMER_HEADER_INNER_CLASS = "mx-auto flex w-full max-w-6xl items-center justify-center px-4 py-2 sm:px-6 lg:px-8";
const TIMER_CONTROLS_CLASS = "flex items-center gap-2";
const TIMER_BUTTON_CLASS = "h-9 w-9";
const TIMER_ICON_CLASS = "h-5 w-5";
const TIMER_VALUE_CLASS = "min-w-[5ch] text-center text-xl font-semibold tabular-nums";
const PAGE_CONTENT_CLASS = "mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8";
const REVIEW_CARD_CLASS = "rounded-[28px] border border-border bg-card p-5 shadow-sm sm:p-6";
const LEGEND_ITEM_CLASS = "flex items-center gap-1.5";
const UNANSWERED_SWATCH_CLASS = "h-4 w-4 rounded-md border-2 border-dashed border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/20";
const ANSWERED_SWATCH_CLASS = "h-4 w-4 rounded-md border border-emerald-500/40 bg-emerald-500/10";
const LEGEND_BOOKMARK_ICON_CLASS = "h-3.5 w-3.5 bookmark-flag";
const QUESTION_GRID_CLASS = "grid grid-cols-[repeat(auto-fit,minmax(42px,1fr))] gap-2.5";
const QUESTION_TILE_BASE_CLASS = "relative flex h-10 items-center justify-center rounded-lg text-base font-semibold transition-colors sm:h-11 sm:text-lg";
const QUESTION_TILE_ANSWERED_CLASS = "border border-emerald-500/40 bg-emerald-500/10 text-foreground hover:bg-emerald-500/20";
const QUESTION_TILE_UNANSWERED_CLASS = "border-2 border-dashed border-amber-400/60 bg-amber-50/30 text-muted-foreground hover:bg-amber-100/40 dark:bg-amber-950/20 dark:hover:bg-amber-950/30";
const MARKED_ICON_CLASS = "absolute right-1 top-1 h-3 w-3 bookmark-flag";
const FOOTER_ACTIONS_CLASS = "flex flex-wrap justify-between gap-3";
const SUBMIT_ACTION_BUTTON_CLASS = "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-cobalt hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
const REVIEW_HEADING_STYLE = {
  fontFamily: "'Geist', Georgia, serif",
  fontSize: "clamp(34px, 4.3vw, 60px)",
  fontWeight: 400,
  letterSpacing: "-0.05em",
  lineHeight: 0.96,
} as const;

const getPracticeTestDesmosScope = (sessionId: string): string =>
  `${PRACTICE_TEST_DESMOS_SCOPE_PREFIX}${sessionId}`;

const clearPracticeReviewSessionStorage = () => {
  sessionStorage.removeItem(PRACTICE_SET_STORAGE_KEY);
  sessionStorage.removeItem(PRACTICE_EXIT_TO_STORAGE_KEY);
};

const buildPracticeTestReviewQuestionPath = (
  question: Pick<PracticeTestQuestionItem, "subject" | "sourceId" | "bankType">,
  idx: number,
  practiceSetId: string,
  practiceTestSessionId: string,
): string =>
  buildPracticeTestQuestionRoute({
    subject: question.subject,
    sourceId: question.sourceId,
    bankType: question.bankType,
    idx,
    practiceSetId,
    practiceTestSessionId,
  });

const buildPracticeTestResultPath = (practiceSetId: string, sessionId: string): string =>
  `/practice-tests/${practiceSetId}/results?session=${sessionId}`;

const buildPracticeTestTransitionPath = (
  practiceSetId: string,
  sessionId: string,
  activeModuleIndex: number,
): string =>
  `/practice-tests/${practiceSetId}/transition?session=${sessionId}&kind=${activeModuleIndex === 1 ? "break" : "module"}`;

const PracticeTestReviewNotFound = () => (
  <div className={NOT_FOUND_SHELL_CLASS}>
    <Card className="border-dashed border-border/70">
      <CardContent className="py-12 text-center">
        <h2 className="text-xl font-semibold">Practice test review not found</h2>
      </CardContent>
    </Card>
  </div>
);

const PracticeTestReview = () => {
  const { setId } = useParams<{ setId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.id ?? null;
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
    if (!questionSet) return;
    writePracticeLaunchStorage(questionSet, PRACTICE_MODULES_EXIT_PATH);
  }, [questionSet]);

  useEffect(() => {
    setSession(practiceSet ? getPracticeTestSession(practiceSet.id) : null);
  }, [practiceSet, sessionId]);

  const submitCurrentModule = useCallback((sessionToSubmit: PracticeTestSessionMeta | null) => {
    if (!practiceSet || !sessionToSubmit) return;

    if (sessionToSubmit.activeModuleIndex === sessionToSubmit.modules.length - 1) {
      const result = buildPracticeTestResult(practiceSet, {
        ...sessionToSubmit,
        status: "submitted",
      });
      clearDesmosUiState(sessionStorage, getPracticeTestDesmosScope(sessionToSubmit.sessionId));
      savePracticeTestResult(result, uid);
      clearPracticeTestSession(practiceSet.id);
      clearPracticeReviewSessionStorage();
      navigate(buildPracticeTestResultPath(practiceSet.id, result.sessionId));
      return;
    }

    const nextSession = buildPracticeTestSessionAfterCurrentModuleSubmit(sessionToSubmit);
    if (!nextSession) return;

    clearDesmosUiState(sessionStorage, getPracticeTestDesmosScope(sessionToSubmit.sessionId));
    setSession(nextSession);
    savePracticeTestSession(nextSession);
    navigate(
      buildPracticeTestTransitionPath(
        practiceSet.id,
        sessionToSubmit.sessionId,
        sessionToSubmit.activeModuleIndex,
      ),
    );
  }, [navigate, practiceSet, uid]);

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

  if (!practiceSet || !session || !sessionId || session.sessionId !== sessionId || !questionSet || !activeModule) {
    return <PracticeTestReviewNotFound />;
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
    <div className={PAGE_SHELL_CLASS}>
      <div className={TIMER_HEADER_CLASS}>
        <div className={TIMER_HEADER_INNER_CLASS}>
          <div className={TIMER_CONTROLS_CLASS}>
            <Button
              variant="ghost"
              size="icon"
              className={TIMER_BUTTON_CLASS}
              onClick={() => setIsTimerVisible((prev) => !prev)}
              title={isTimerVisible ? "Hide timer" : "Show timer"}
            >
              {isTimerVisible ? <Eye className={TIMER_ICON_CLASS} /> : <EyeOff className={TIMER_ICON_CLASS} />}
            </Button>
            <span className={TIMER_VALUE_CLASS}>
              {isTimerVisible ? formatPracticeClock(displayedTimerSeconds) : "-:--"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className={TIMER_BUTTON_CLASS}
              onClick={() => setIsTimerPaused((prev) => !prev)}
              title={isTimerPaused ? "Resume timer" : "Pause timer"}
            >
              {isTimerPaused ? <Play className={TIMER_ICON_CLASS} /> : <Pause className={TIMER_ICON_CLASS} />}
            </Button>
          </div>
        </div>
      </div>

      <div className={PAGE_CONTENT_CLASS}>
        <div className="space-y-3 text-center">
          <h1 style={REVIEW_HEADING_STYLE}>
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

        <div className={REVIEW_CARD_CLASS}>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-2xl font-semibold tracking-[-0.03em]">{activeModule.moduleTitle}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{answeredCount}</span> of {moduleQuestions.length} answered
              </div>
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
                <Bookmark className={LEGEND_BOOKMARK_ICON_CLASS} />
                For Review
              </div>
            </div>
          </div>

          <div className={QUESTION_GRID_CLASS}>
            {moduleQuestions.map((question) => {
              const state = getPracticeTestQuestionState(session.sessionId, question.storageId);
              const answered = Boolean(state.answer || state.freeResponseAnswer);

              return (
                <button
                  key={question.storageId}
                  onClick={() =>
                    navigate(
                      buildPracticeTestReviewQuestionPath(
                        question,
                        question.globalQuestionNumber,
                        practiceSet.id,
                        session.sessionId,
                      ),
                    )
                  }
                  className={cn(
                    QUESTION_TILE_BASE_CLASS,
                    answered ? QUESTION_TILE_ANSWERED_CLASS : QUESTION_TILE_UNANSWERED_CLASS,
                  )}
                >
                  {state.isMarkedForReview ? (
                    <Bookmark className={MARKED_ICON_CLASS} />
                  ) : null}
                  {question.moduleQuestionNumber}
                </button>
              );
            })}
          </div>
        </div>

        <div className={FOOTER_ACTIONS_CLASS}>
          <Button variant="outline" className="bg-transparent" asChild>
            <Link
              to={buildPracticeTestReviewQuestionPath(
                currentQuestion,
                session.currentIndex + 1,
                practiceSet.id,
                session.sessionId,
              )}
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
                  onClick={() => submitCurrentModule(session)}
                  className={SUBMIT_ACTION_BUTTON_CLASS}
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
