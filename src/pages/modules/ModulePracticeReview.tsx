import { useEffect, useMemo } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Bookmark } from "lucide-react";
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
  buildModulePracticeResult,
  clearModulePracticeSession,
  getModulePracticeQuestionState,
  getModulePracticeSession,
  saveModulePracticeResult,
} from "@/lib/practice/modulePracticeSession";
import { getPracticeModule, loadPracticeModule } from "@/data/modulePracticeBank";
import { buildModulePracticeQuestionRoute } from "@/lib/practice/practiceBankRoutes";
import {
  PRACTICE_EXIT_TO_STORAGE_KEY,
  PRACTICE_SET_STORAGE_KEY,
} from "@/lib/practice/practiceRunStorage";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const NOT_FOUND_SHELL_CLASS = "mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 bg-background px-4 py-12 text-foreground sm:px-6";
const NOT_FOUND_CARD_CLASS = "rounded-[28px] border border-border bg-card p-10 text-center";
const PAGE_SHELL_CLASS = "min-h-screen bg-background text-foreground";
const PAGE_CONTENT_CLASS = "mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8";
const REVIEW_CARD_CLASS = "rounded-[28px] border border-border bg-card p-5 shadow-sm sm:p-6";
const LEGEND_ITEM_CLASS = "flex items-center gap-1.5";
const UNANSWERED_SWATCH_CLASS = "h-4 w-4 rounded-md border-2 border-dashed border-border bg-background/40";
const ANSWERED_SWATCH_CLASS = "h-4 w-4 rounded-md border border-border bg-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]";
const QUESTION_TILE_BASE_CLASS = "relative flex h-10 items-center justify-center rounded-lg text-base font-semibold transition-colors sm:h-11 sm:text-lg";
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
  const module = useMemo(
    () => (moduleId ? getPracticeModule(moduleId) : null),
    [moduleId],
  );
  const sessionId = searchParams.get("session");
  const session = module ? getModulePracticeSession(module.slug) : null;

  useEffect(() => {
    if (module) void loadPracticeModule(module.slug);
  }, [module]);

  if (!module || !session || !sessionId || session.sessionId !== sessionId) {
    return (
      <div className={NOT_FOUND_SHELL_CLASS}>
        <div className={NOT_FOUND_CARD_CLASS}>
          <h1 className="text-2xl font-semibold">Review session not found</h1>
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
    const loadedModule = await loadPracticeModule(module.slug);
    if (!loadedModule) return;
    const submittedSession = {
      ...session,
      status: "submitted" as const,
    };
    const result = buildModulePracticeResult(loadedModule, submittedSession);
    saveModulePracticeResult(result, user?.id ?? null);
    clearModulePracticeSession(module.slug);
    clearModuleReviewSessionStorage();
    navigate(`/modules/${module.slug}/results?session=${result.sessionId}`);
  };

  return (
    <div className={PAGE_SHELL_CLASS}>
      <div className={PAGE_CONTENT_CLASS}>
        <div className="space-y-3 text-center">
          <h1 style={REVIEW_HEADING_STYLE}>
            Review Questions
          </h1>
          <div className="space-y-1.5 text-base text-muted-foreground">
            <p>On test day, you would stay in the module until time runs out.</p>
            <p>
              For this practice module, you can move on when you feel ready and submit
              once you have checked your work.
            </p>
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

          <div className="grid grid-cols-[repeat(auto-fit,minmax(42px,1fr))] gap-2.5">
            {questions.map((question) => (
              <button
                key={question.stableId}
                onClick={() =>
                  navigate(
                    getQuestionPath(question.sourceId, question.bankType, question.number),
                  )
                }
                className={cn(
                  QUESTION_TILE_BASE_CLASS,
                  question.answered ? QUESTION_TILE_ANSWERED_CLASS : QUESTION_TILE_UNANSWERED_CLASS,
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
            asChild
          >
            <Link to={backQuestion ? getQuestionPath(backQuestion.sourceId, backQuestion.bankType, session.currentIndex + 1) : "/modules"}>
              Back
            </Link>
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="min-w-[140px]">Submit</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Submit this module?</AlertDialogTitle>
                <AlertDialogDescription>
                  Once you submit, this session will end and you will move to the review page.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep reviewing</AlertDialogCancel>
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
