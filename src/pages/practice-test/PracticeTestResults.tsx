import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Lightbulb,
  Share2,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TransparentAwareImage } from "@/components/TransparentAwareImage";
import { StepByStepExplanation } from "@/components/question/StepByStepExplanation";
import { DraggableWindow } from "@/components/DraggableWindow";
import { usePracticeResultSplitCssVariable } from "@/hooks/usePracticeResultSplitCssVariable";
import {
  getLatestPracticeTestResult,
  getPracticeTestResult,
  type PracticeTestResult,
} from "@/lib/practice/practiceTestSession";
import {
  REVIEW_HTML_CLASS,
  RESULT_REVIEW_ANSWER_CHOICE_BASE_CLASS,
  RESULT_REVIEW_ANSWER_REVEAL_BUTTON_CLASS,
  RESULT_REVIEW_CHOICE_HTML_CLASS,
  RESULT_REVIEW_CHOICE_IMAGE_CLASS,
  RESULT_REVIEW_FREE_RESPONSE_CLASS,
  RESULT_REVIEW_QUESTION_IMAGE_CLASS,
  SECTION_LABEL_CLASS,
  answerLabel,
  getChoiceReviewClassName,
  getQuestionCorrectnessRank,
  getRenderedContentHtml,
  statusClasses,
  statusLabel,
  stripBankPrefix,
} from "@/lib/practice/resultReview";
import { formatPracticeResultTime } from "@/lib/practice/practiceTime";
import { getLoadedPracticeSet, getPracticeSet, loadPracticeSet } from "@/data/modulePracticeBank";
import { cn, normalizePublicAssetPath } from "@/lib/utils";
import {
  getReviewChoiceImageClassName,
  getReviewQuestionImageClassName,
} from "@/lib/questionImageDisplay";
import { useAuth } from "@/contexts/AuthContext";

const SHARE_URL = "https://1600.now";
const MODULES_PATH = "/modules";
const SCORE_RANGE_LABEL = "200 - 800";
const TOTAL_SCORE_RANGE_LABEL = "400 - 1600";
const RESULTS_ROOT_CLASS = "mx-auto flex min-h-screen w-full flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8";
const NOT_FOUND_SHELL_CLASS = "mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6";
const BACK_BUTTON_CLASS = "w-fit gap-2 px-0";
const RESULTS_HEADING_STYLE = {
  fontFamily: "'Geist', Georgia, serif",
  fontSize: "clamp(34px, 4.5vw, 56px)",
  fontWeight: 400,
  letterSpacing: "-0.04em",
  lineHeight: 1,
} as const;
const SHARE_BUTTON_CLASS = "shrink-0 self-end bg-transparent sm:self-start";
const SCORE_CARD_CLASS = "border-border/70 bg-gradient-to-br from-card to-muted/30";
const SCORE_GRID_CLASS = "grid gap-6 p-6 sm:grid-cols-3 sm:items-end";
const TOTAL_SCORE_LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground";
const SECTION_SCORE_LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground";
const TOTAL_SCORE_VALUE_CLASS = "mt-2 text-7xl font-semibold leading-none tracking-[-0.08em] text-foreground";
const SECTION_SCORE_VALUE_CLASS = "mt-2 text-5xl font-semibold leading-none tracking-[-0.05em] text-foreground";
const SCORE_RANGE_CLASS = "mt-2 text-sm font-medium text-muted-foreground";
const STANDARD_CARD_CLASS = "border-border/70 bg-card";
const MODULE_BREAKDOWN_GRID_CLASS = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4";
const MODULE_BREAKDOWN_CARD_CLASS = "rounded-2xl border border-border/60 bg-muted/30 p-5";
const CONTROL_ROW_CLASS = "flex flex-col gap-3 sm:flex-row sm:items-center";
const CONTROL_BUTTON_CLASS = "gap-2 bg-transparent";
const QUESTION_ROW_BASE_CLASS = "py-5";
const QUESTION_ROW_BORDER_CLASS = "border-b border-border/60";
const QUESTION_ROW_HEADER_CLASS = "flex cursor-pointer flex-col gap-3 sm:flex-row sm:items-start sm:justify-between";
const DIFFICULTY_BADGE_BASE_CLASS = "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider";
const CHEVRON_TOGGLE_CLASS = "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform";
const QUESTION_DETAIL_GRID_CLASS = "mt-5 grid gap-5 border-t border-border/60 pt-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]";
const STATUS_BADGE_BASE_CLASS = "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold";
const RATIONALE_CARD_CLASS = "col-span-full mt-1 rounded-xl border border-border/60 bg-muted/20 p-4";
const RATIONALE_HTML_CLASS = "question-html mt-2 break-words prose prose-stone max-w-none text-sm leading-7 text-foreground dark:prose-invert";
const EXPLANATION_BUTTON_ACTIVE_CLASS = "ring-2 ring-primary/50";
const FOOTER_ACTIONS_CLASS = "flex flex-wrap justify-end gap-3";
const EXPLANATION_WINDOW_ID = "review-explanation";

type QuestionSortMode = "seen" | "correct";
type QuestionSortDirection = "asc" | "desc";

const toggleStringSet = (previous: Set<string>, value: string): Set<string> => {
  const next = new Set(previous);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
};

const getResultDateLabel = (timestamp: number) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));

const getShareMessage = (result: PracticeTestResult) =>
  `I scored ${result.totalScore} on an SAT Practice Test. Come study with me on 1600.now!`;

const canUseNativeShareSheet = () =>
  typeof navigator !== "undefined" &&
  typeof navigator.share === "function" &&
  (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    window.matchMedia("(max-width: 768px) and (pointer: coarse)").matches);

const buildShareImageFile = async (result: PracticeTestResult) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#f7fbff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, 1200, 260);
  gradient.addColorStop(0, "#c7dcff");
  gradient.addColorStop(1, "#e9f1ff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1200, 260);

  ctx.fillStyle = "#202124";
  ctx.font = "900 64px Inter, Arial, sans-serif";
  ctx.fillText("1600.now", 72, 100);
  ctx.font = "600 30px Inter, Arial, sans-serif";
  ctx.fillText(`Practice Test ${result.practiceSetNumber} results`, 72, 154);
  ctx.font = "500 24px Inter, Arial, sans-serif";
  ctx.fillText(getResultDateLabel(result.submittedAt), 72, 198);

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(72, 320, 1056, 280, 34);
  ctx.fill();

  ctx.fillStyle = "#202124";
  ctx.font = "800 30px Inter, Arial, sans-serif";
  ctx.fillText("TOTAL SCORE", 124, 390);
  ctx.font = "900 132px Inter, Arial, sans-serif";
  ctx.fillText(String(result.totalScore), 118, 520);
  ctx.font = "600 24px Inter, Arial, sans-serif";
  ctx.fillText("400 - 1600", 126, 560);

  ctx.fillStyle = "#d8e7ff";
  ctx.fillRect(520, 374, 2, 172);

  ctx.fillStyle = "#202124";
  ctx.font = "700 27px Inter, Arial, sans-serif";
  ctx.fillText("Reading and Writing", 574, 410);
  ctx.font = "900 78px Inter, Arial, sans-serif";
  ctx.fillText(String(result.readingWritingScore), 574, 495);
  ctx.font = "600 22px Inter, Arial, sans-serif";
  ctx.fillText("200 - 800", 578, 536);

  ctx.font = "700 27px Inter, Arial, sans-serif";
  ctx.fillText("Math", 850, 410);
  ctx.font = "900 78px Inter, Arial, sans-serif";
  ctx.fillText(String(result.mathScore), 850, 495);
  ctx.font = "600 22px Inter, Arial, sans-serif";
  ctx.fillText("200 - 800", 854, 536);

  ctx.fillStyle = "#3350d4";
  ctx.font = "800 28px Inter, Arial, sans-serif";
  ctx.fillText(SHARE_URL, 72, 674);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((value) => resolve(value), "image/png"),
  );
  if (!blob) return null;
  return new File([blob], `1600-now-practice-test-${result.practiceSetNumber}-score.png`, {
    type: "image/png",
  });
};

const PracticeTestResults = () => {
  const { setId } = useParams<{ setId: string }>();
  const [searchParams] = useSearchParams();
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(() => new Set());
  const [hideCorrectAnswers, setHideCorrectAnswers] = useState(false);
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(() => new Set());
  const [activeExplanationStorageId, setActiveExplanationStorageId] = useState<string | null>(null);
  const [explanationSplitPosition, setExplanationSplitPosition] = useState(65);
  const [isExplanationSidebarred, setIsExplanationSidebarred] = useState(true);
  const [questionSortMode, setQuestionSortMode] = useState<QuestionSortMode>("seen");
  const [questionSortDirection, setQuestionSortDirection] = useState<QuestionSortDirection>("asc");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [isSharing, setIsSharing] = useState(false);
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const sessionId = searchParams.get("session");
  const practiceSet = useMemo(() => (setId ? getPracticeSet(setId) : null), [setId]);
  const [loadedPracticeSet, setLoadedPracticeSet] = useState(() =>
    setId ? getLoadedPracticeSet(setId) : null,
  );
  useEffect(() => {
    let cancelled = false;
    setLoadedPracticeSet(setId ? getLoadedPracticeSet(setId) : null);
    if (!setId) return;
    void loadPracticeSet(setId).then((loaded) => {
      if (!cancelled) setLoadedPracticeSet(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [setId]);
  const result = useMemo(() => {
    if (!practiceSet) return null;
    if (sessionId) {
      return getPracticeTestResult(sessionId, uid) ?? getLatestPracticeTestResult(practiceSet.id, uid);
    }
    return getLatestPracticeTestResult(practiceSet.id, uid);
  }, [practiceSet, sessionId, uid]);
  const sourceQuestionMap = useMemo(() => {
    if (!loadedPracticeSet) return new Map();
    return new Map(
      loadedPracticeSet.modules.flatMap((module) =>
        module.questions.map((entry) => [entry.bankQuestion.stableId, entry.bankQuestion] as const),
      ),
    );
  }, [loadedPracticeSet]);
  const orderedQuestions = useMemo(() => {
    if (!result) return [];
    const directionMultiplier = questionSortDirection === "asc" ? 1 : -1;

    const filtered =
      moduleFilter === "all"
        ? result.questions
        : result.questions.filter((question) => question.moduleSlug === moduleFilter);

    return [...filtered].sort((left, right) => {
      if (questionSortMode === "correct") {
        const correctnessDifference =
          (getQuestionCorrectnessRank(left, questionSortDirection) -
            getQuestionCorrectnessRank(right, questionSortDirection)) *
          directionMultiplier;
        if (correctnessDifference !== 0) return correctnessDifference;
      }

      return (left.globalQuestionNumber - right.globalQuestionNumber) * directionMultiplier;
    });
  }, [moduleFilter, questionSortDirection, questionSortMode, result]);
  const activeExplanationIndex = activeExplanationStorageId
    ? orderedQuestions.findIndex((question) => question.storageId === activeExplanationStorageId)
    : -1;
  const activeExplanationQuestion =
    activeExplanationIndex >= 0 ? orderedQuestions[activeExplanationIndex] : null;
  const hasActiveExplanationSource = activeExplanationQuestion
    ? sourceQuestionMap.has(activeExplanationQuestion.storageId)
    : false;
  const isExplanationOpen = activeExplanationQuestion !== null;
  const useSidebarLayout = isExplanationOpen && isExplanationSidebarred;

  usePracticeResultSplitCssVariable(useSidebarLayout, explanationSplitPosition);

  if (!practiceSet || !result) {
    return (
      <div className={NOT_FOUND_SHELL_CLASS}>
        <Button variant="ghost" asChild className={BACK_BUTTON_CLASS}>
          <Link to={MODULES_PATH}>
            <ArrowLeft className="h-4 w-4" />
            Back to modules
          </Link>
        </Button>
        <Card className="border-dashed border-border/70">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold">Practice test results not found</h2>
          </CardContent>
        </Card>
      </div>
    );
  }

  const toggleExpandedQuestion = (storageId: string) => {
    setExpandedQuestions((previous) => toggleStringSet(previous, storageId));
  };
  const areAllVisibleQuestionsExpanded =
    orderedQuestions.length > 0 &&
    orderedQuestions.every((question) => expandedQuestions.has(question.storageId));

  const toggleAllVisibleQuestions = () => {
    setExpandedQuestions((previous) => {
      const next = new Set(previous);
      if (areAllVisibleQuestionsExpanded) {
        orderedQuestions.forEach((question) => next.delete(question.storageId));
      } else {
        orderedQuestions.forEach((question) => next.add(question.storageId));
      }
      return next;
    });
  };

  const toggleRevealedAnswer = (storageId: string) => {
    setRevealedAnswers((previous) => toggleStringSet(previous, storageId));
  };

  const scrollToQuestion = (storageId: string) => {
    setExpandedQuestions((previous) => {
      const next = new Set(previous);
      next.add(storageId);
      return next;
    });
    requestAnimationFrame(() => {
      const target = document.getElementById(`question-review-${storageId}`);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const shareMessage = getShareMessage(result);

  const navigateExplanation = (delta: -1 | 1) => {
    if (activeExplanationIndex < 0) return;
    const nextIndex = activeExplanationIndex + delta;
    if (nextIndex < 0 || nextIndex >= orderedQuestions.length) return;
    setActiveExplanationStorageId(orderedQuestions[nextIndex].storageId);
    scrollToQuestion(orderedQuestions[nextIndex].storageId);
  };

  const copyShareMessage = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      toast.success("Share message copied");
    } catch {
      toast.error("Could not copy share message");
    }
  };

  const shareResult = async () => {
    setIsSharing(true);
    try {
      if (!canUseNativeShareSheet()) {
        await copyShareMessage();
        return;
      }

      const file = await buildShareImageFile(result);
      const shareData = {
        title: "1600.now practice test result",
        text: shareMessage,
      };

      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ ...shareData, files: [file] });
        return;
      }

      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await copyShareMessage();
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") {
        await copyShareMessage();
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div
      className={RESULTS_ROOT_CLASS}
      style={
        useSidebarLayout
          ? { maxWidth: `var(--sat-split-pct, ${explanationSplitPosition}%)`, marginLeft: 0, marginRight: 0 }
          : { maxWidth: "72rem" }
      }
    >
      <Button variant="ghost" asChild className={BACK_BUTTON_CLASS}>
        <Link to={MODULES_PATH}>
          <ArrowLeft className="h-4 w-4" />
          Back to modules
        </Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <h1 style={RESULTS_HEADING_STYLE}>
            Practice Test Results
          </h1>
          <div className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Practice Test {result.practiceSetNumber}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className={SHARE_BUTTON_CLASS}
          aria-label="Share results"
          disabled={isSharing}
          onClick={shareResult}
        >
          <Share2 className="h-5 w-5" />
        </Button>
      </div>

      <Card className={SCORE_CARD_CLASS}>
        <CardContent className={SCORE_GRID_CLASS}>
          <div>
            <div className={TOTAL_SCORE_LABEL_CLASS}>Total Score</div>
            <div className={TOTAL_SCORE_VALUE_CLASS}>
              {result.totalScore}
            </div>
            <div className={SCORE_RANGE_CLASS}>{TOTAL_SCORE_RANGE_LABEL}</div>
          </div>
          <div>
            <div className={SECTION_SCORE_LABEL_CLASS}>
              Reading & Writing
            </div>
            <div className={SECTION_SCORE_VALUE_CLASS}>
              {result.readingWritingScore}
            </div>
            <div className={SCORE_RANGE_CLASS}>{SCORE_RANGE_LABEL}</div>
          </div>
          <div>
            <div className={SECTION_SCORE_LABEL_CLASS}>
              Math
            </div>
            <div className={SECTION_SCORE_VALUE_CLASS}>
              {result.mathScore}
            </div>
            <div className={SCORE_RANGE_CLASS}>{SCORE_RANGE_LABEL}</div>
          </div>
        </CardContent>
      </Card>

      <Card className={STANDARD_CARD_CLASS}>
        <CardHeader>
          <CardTitle>Module Breakdown</CardTitle>
        </CardHeader>
        <CardContent className={MODULE_BREAKDOWN_GRID_CLASS}>
          {result.modules.map((module) => (
            <div
              key={module.moduleSlug}
              className={MODULE_BREAKDOWN_CARD_CLASS}
            >
              <div className="text-sm font-semibold text-foreground">{module.moduleTitle}</div>
              <div className="mt-3 text-sm text-muted-foreground">
                Raw {module.rawScore}/{module.questionCount}
              </div>
              <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                <div>{module.correctCount} correct</div>
                <div>{module.incorrectCount} incorrect</div>
                <div>{module.unansweredCount} unanswered</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className={STANDARD_CARD_CLASS}>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <CardTitle className="text-2xl tracking-[-0.03em]">Question Breakdown</CardTitle>
            <div className={CONTROL_ROW_CLASS}>
              <Button
                type="button"
                variant="outline"
                className={CONTROL_BUTTON_CLASS}
                disabled={!orderedQuestions.length}
                onClick={toggleAllVisibleQuestions}
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    areAllVisibleQuestionsExpanded && "rotate-180",
                  )}
                />
                {areAllVisibleQuestionsExpanded ? "Collapse All" : "Show All"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className={cn(CONTROL_BUTTON_CLASS, hideCorrectAnswers && "border-primary text-primary")}
                onClick={() => {
                  setHideCorrectAnswers((prev) => !prev);
                  setRevealedAnswers(new Set());
                }}
              >
                {hideCorrectAnswers ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {hideCorrectAnswers ? "Answers Hidden" : "Hide Answers"}
              </Button>
              <div className="w-full sm:w-[200px]">
                <Select
                  value={moduleFilter}
                  onValueChange={setModuleFilter}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modules</SelectItem>
                    {result.modules.map((module) => (
                      <SelectItem key={module.moduleSlug} value={module.moduleSlug}>
                        {module.moduleTitle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-[180px]">
                <Select
                  value={questionSortMode}
                  onValueChange={(value: QuestionSortMode) => setQuestionSortMode(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seen">Order Seen</SelectItem>
                    <SelectItem value="correct">Correct</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                className={CONTROL_BUTTON_CLASS}
                onClick={() =>
                  setQuestionSortDirection((previous) => (previous === "asc" ? "desc" : "asc"))
                }
              >
                {questionSortDirection === "asc" ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
                {questionSortDirection === "asc" ? "Ascending" : "Descending"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-0">
          {orderedQuestions.map((question, index) => {
            const sourceQuestion = sourceQuestionMap.get(question.storageId);
            const isExpanded = expandedQuestions.has(question.storageId);
            const isAnswerRevealed = revealedAnswers.has(question.storageId);
            const showCorrect = !hideCorrectAnswers || isAnswerRevealed;

            return (
              <div
                key={question.storageId}
                id={`question-review-${question.storageId}`}
                className={cn(
                  QUESTION_ROW_BASE_CLASS,
                  index !== orderedQuestions.length - 1 && QUESTION_ROW_BORDER_CLASS,
                )}
              >
                <div
                  className={QUESTION_ROW_HEADER_CLASS}
                  onClick={() => toggleExpandedQuestion(question.storageId)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex w-full items-start justify-between gap-3 text-left">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-base font-semibold tracking-[-0.01em] text-foreground">
                            {question.moduleTitle} · Question {question.moduleQuestionNumber}
                          </span>
                          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                            {question.skill}
                          </span>
                          {typeof sourceQuestion?.scoreBand === "number" && (
                            <span
                              className={cn(
                                DIFFICULTY_BADGE_BASE_CLASS,
                                sourceQuestion.scoreBand <= 4 &&
                                  "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                                sourceQuestion.scoreBand >= 5 && sourceQuestion.scoreBand <= 7 &&
                                  "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                                sourceQuestion.scoreBand >= 8 &&
                                  "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
                              )}
                            >
                              {sourceQuestion.scoreBand}/10
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronDown
                        className={cn(
                          CHEVRON_TOGGLE_CLASS,
                          isExpanded && "rotate-180",
                        )}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                      <span className="text-muted-foreground">
                        Time: <span className="font-medium text-foreground">{formatPracticeResultTime(question.timeSpentSeconds)}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Chosen: <span className="font-medium text-foreground">{answerLabel(question.userAnswer)}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Correct:{" "}
                        <span className={cn("font-medium", showCorrect ? "text-foreground" : "text-muted-foreground")}>
                          {showCorrect ? answerLabel(question.correctAnswer) : "—"}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <div
                      className={`${STATUS_BADGE_BASE_CLASS} ${statusClasses(question)}`}
                    >
                      {statusLabel(question)}
                    </div>
                  </div>
                </div>

                {isExpanded && sourceQuestion ? (
                  <div className={QUESTION_DETAIL_GRID_CLASS}>
                    <div className="space-y-4">
                      {sourceQuestion.questionImages?.length ? (
                        <div className="space-y-3">
	                          {sourceQuestion.questionImages.map((image, imageIndex) => (
	                            <div key={`${image.src}-${imageIndex}`} className="flex justify-center">
	                              <TransparentAwareImage
	                                src={normalizePublicAssetPath(image.src)}
	                                alt={image.alt || `SAT question ${question.globalQuestionNumber} image ${imageIndex + 1}`}
	                                optimizedSrc={image.optimizedSrc}
	                                srcSet={image.srcSet}
	                                sizes={image.sizes}
	                                width={image.width}
	                                height={image.height}
	                                intrinsicSize={image.width && image.height ? { width: image.width, height: image.height } : undefined}
	                                hasTransparency={image.hasTransparency}
	                                className={cn(
	                                  RESULT_REVIEW_QUESTION_IMAGE_CLASS,
	                                  getReviewQuestionImageClassName(image.displaySize),
	                                )}
	                                trimWhitespace={!image.optimizedSrc}
	                              />
	                            </div>
	                          ))}
                        </div>
                      ) : null}
                      {sourceQuestion.passage ? (
                        <div>
                          <div className={SECTION_LABEL_CLASS}>
                            Passage
                          </div>
                          <div
                            className={REVIEW_HTML_CLASS}
                            dangerouslySetInnerHTML={{
                              __html: getRenderedContentHtml(question.subject, sourceQuestion.passage),
                            }}
                          />
                        </div>
                      ) : null}
                      <div>
                        <div className={SECTION_LABEL_CLASS}>
                          Question
                        </div>
                        <div
                          className={REVIEW_HTML_CLASS}
                          dangerouslySetInnerHTML={{
                            __html: getRenderedContentHtml(
                              question.subject,
                              sourceQuestion.questionText || sourceQuestion.prompt,
                            ),
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <div className={SECTION_LABEL_CLASS}>
                          Answer Choices
                        </div>
                        {hideCorrectAnswers && (
                          <button
                            type="button"
                            onClick={() => toggleRevealedAnswer(question.storageId)}
                            className={RESULT_REVIEW_ANSWER_REVEAL_BUTTON_CLASS}
                          >
                            {isAnswerRevealed ? (
                              <><EyeOff className="h-3.5 w-3.5" /> Hide answer</>
                            ) : (
                              <><Eye className="h-3.5 w-3.5" /> Show answer</>
                            )}
                          </button>
                        )}
                      </div>
                      <div className="mt-3 space-y-2">
                        {sourceQuestion.type === "multiple-choice" && sourceQuestion.choices?.length ? (
                          sourceQuestion.choices.map((choice) => {
                            const isChosen = choice.id === question.userAnswer;
                            const isCorrect = choice.id === question.correctAnswer;
                            const hasText = Boolean(choice.text);
                            const hasImage = Boolean(choice.image);

                            return (
                              <div
                                key={choice.id}
                                className={cn(
                                  RESULT_REVIEW_ANSWER_CHOICE_BASE_CLASS,
                                  getChoiceReviewClassName(showCorrect, isCorrect, isChosen),
                                )}
                              >
                                <div className="font-semibold">{choice.id}</div>
                                {hasText ? (
                                  <div
                                    className={RESULT_REVIEW_CHOICE_HTML_CLASS}
                                    dangerouslySetInnerHTML={{
                                      __html: getRenderedContentHtml(question.subject, choice.text),
                                    }}
                                  />
                                ) : null}
                                {hasImage ? (
                                  <div className={cn("mt-2 flex justify-center", hasText && "pt-1")}>
	                                    <TransparentAwareImage
	                                      src={normalizePublicAssetPath(choice.image)}
	                                      alt={`SAT question ${question.globalQuestionNumber} choice ${choice.id} image`}
	                                      optimizedSrc={choice.imageOptimizedSrc}
	                                      srcSet={choice.imageSrcSet}
	                                      sizes={choice.imageSizes}
	                                      width={choice.imageWidth}
	                                      height={choice.imageHeight}
	                                      intrinsicSize={choice.imageWidth && choice.imageHeight ? { width: choice.imageWidth, height: choice.imageHeight } : undefined}
	                                      hasTransparency={choice.imageHasTransparency}
	                                      className={cn(
	                                        RESULT_REVIEW_CHOICE_IMAGE_CLASS,
	                                        getReviewChoiceImageClassName(choice.imageDisplaySize),
	                                      )}
	                                      trimWhitespace={!choice.imageOptimizedSrc}
	                                    />
                                  </div>
                                ) : null}
                              </div>
                            );
                          })
                        ) : (
                          <div className={RESULT_REVIEW_FREE_RESPONSE_CLASS}>
                            Free-response question
                          </div>
                        )}
                      </div>
                    </div>

                    {sourceQuestion.rationale && (
                      <div className={RATIONALE_CARD_CLASS}>
                        <div className={SECTION_LABEL_CLASS}>
                          Rationale
                        </div>
                        <div
                          className={RATIONALE_HTML_CLASS}
                          dangerouslySetInnerHTML={{
                            __html: getRenderedContentHtml(question.subject, sourceQuestion.rationale),
                          }}
                        />
                      </div>
                    )}

                    <div className="col-span-full mt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          CONTROL_BUTTON_CLASS,
                          activeExplanationIndex >= 0 &&
                            orderedQuestions[activeExplanationIndex]?.storageId === question.storageId &&
                            EXPLANATION_BUTTON_ACTIVE_CLASS,
                        )}
                        onClick={() => setActiveExplanationStorageId(question.storageId)}
                      >
                        <Lightbulb className="h-4 w-4" />
                        Show Step-by-Step Explanation
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className={FOOTER_ACTIONS_CLASS}>
        <Button asChild>
          <Link to={MODULES_PATH}>
            More practice
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {activeExplanationQuestion && hasActiveExplanationSource && (
        <DraggableWindow
          isOpen={isExplanationOpen}
          onClose={() => setActiveExplanationStorageId(null)}
          title={`${activeExplanationQuestion.moduleTitle} · Q${activeExplanationQuestion.moduleQuestionNumber} — Explanation`}
          defaultWidth={460}
          defaultHeight={560}
          isSidebarred={isExplanationSidebarred}
          onSidebarToggle={(_, sidebar) => setIsExplanationSidebarred(sidebar)}
          onSplitPositionChange={setExplanationSplitPosition}
          splitPosition={explanationSplitPosition}
          onSplitScreenChange={(active) => {
            if (!active) setIsExplanationSidebarred(false);
          }}
          windowId={EXPLANATION_WINDOW_ID}
          centerOnExitSidebar
        >
          <div className="flex h-full flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <StepByStepExplanation
                questionId={stripBankPrefix(activeExplanationQuestion.storageId)}
                correctAnswer={activeExplanationQuestion.correctAnswer}
              />
            </div>
            <div className="flex items-center justify-between border-t border-border/40 px-3 py-2">
              <Button
                variant="outline"
                size="sm"
                disabled={activeExplanationIndex === 0}
                onClick={() => navigateExplanation(-1)}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                {activeExplanationIndex + 1} / {orderedQuestions.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={activeExplanationIndex === orderedQuestions.length - 1}
                onClick={() => navigateExplanation(1)}
                className="gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DraggableWindow>
      )}
    </div>
  );
};

export default PracticeTestResults;
