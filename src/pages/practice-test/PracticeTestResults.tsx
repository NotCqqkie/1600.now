import { useLayoutEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, Lightbulb, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TransparentAwareImage } from "@/components/TransparentAwareImage";
import { StepByStepExplanation } from "@/components/question/StepByStepExplanation";
import { DraggableWindow } from "@/components/DraggableWindow";
import {
  getLatestPracticeTestResult,
  getPracticeTestResult,
  type PracticeTestResult,
  type PracticeTestQuestionResult,
} from "@/lib/practice/practiceTestSession";
import { getPracticeSet } from "@/data/modulePracticeBank";
import { cn, normalizePublicAssetPath } from "@/lib/utils";
import { renderMixedContent } from "@/lib/text/mathRendering";
import { normalizeReadingDisplayText } from "@/lib/text/readingTextNormalization";

const lerp = (start: number, end: number, amount: number) =>
  start + (end - start) * amount;

const SHARE_URL = "https://1600.now";

const getScoreAccent = (score: number, maxScore: number) => {
  const normalized = Math.max(0, Math.min(score / maxScore, 1));
  const hue = lerp(8, 268, normalized);
  const saturation = lerp(68, 78, normalized);
  const lightness = lerp(48, 58, normalized);
  return `hsl(${hue.toFixed(1)} ${saturation.toFixed(1)}% ${lightness.toFixed(1)}%)`;
};

const formatTime = (seconds: number) => {
  if (!seconds) return "0s";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (!minutes) return `${remainder}s`;
  return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
};

const statusLabel = (question: PracticeTestQuestionResult) => {
  if (!question.isAnswered) return "Unanswered";
  return question.isCorrect ? "Correct" : "Incorrect";
};

const statusClasses = (question: PracticeTestQuestionResult) => {
  if (!question.isAnswered) return "border-border bg-muted/30 text-muted-foreground";
  return question.isCorrect
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
};

const answerLabel = (answer: string) => (answer?.trim() ? answer : "No answer");

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

const getQuestionCorrectnessRank = (
  question: PracticeTestQuestionResult,
  direction: "asc" | "desc",
) => {
  if (question.isCorrect) return 2;
  if (question.isAnswered) return direction === "asc" ? 0 : 1;
  return direction === "asc" ? 1 : 0;
};

const getRenderedContentHtml = (
  subject: "math" | "reading",
  content: string,
) => {
  if (!content) return "";
  const formattedContent =
    subject === "reading" ? normalizeReadingDisplayText(content) : content;
  return renderMixedContent(formattedContent, {
    normalizeMath: subject === "math",
  });
};

const PracticeTestResults = () => {
  const { setId } = useParams<{ setId: string }>();
  const [searchParams] = useSearchParams();
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(() => new Set());
  const [hideCorrectAnswers, setHideCorrectAnswers] = useState(false);
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(() => new Set());
  const [activeExplanationIndex, setActiveExplanationIndex] = useState<number | null>(null);
  const [explanationSplitPosition, setExplanationSplitPosition] = useState(65);
  const [isExplanationSidebarred, setIsExplanationSidebarred] = useState(true);
  const [questionSortMode, setQuestionSortMode] = useState<"seen" | "correct">("seen");
  const [questionSortDirection, setQuestionSortDirection] = useState<"asc" | "desc">("asc");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [isSharing, setIsSharing] = useState(false);
  const sessionId = searchParams.get("session");
  const practiceSet = useMemo(() => (setId ? getPracticeSet(setId) : null), [setId]);
  const result = useMemo(() => {
    if (!practiceSet) return null;
    if (sessionId) {
      return getPracticeTestResult(sessionId) ?? getLatestPracticeTestResult(practiceSet.id);
    }
    return getLatestPracticeTestResult(practiceSet.id);
  }, [practiceSet, sessionId]);
  const sourceQuestionMap = useMemo(() => {
    if (!practiceSet) return new Map();
    return new Map(
      practiceSet.modules.flatMap((module) =>
        module.questions.map((entry) => [entry.bankQuestion.stableId, entry.bankQuestion] as const),
      ),
    );
  }, [practiceSet]);
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
  const activeExplanationQuestion =
    activeExplanationIndex !== null ? orderedQuestions[activeExplanationIndex] : null;
  const activeExplanationSource = activeExplanationQuestion
    ? sourceQuestionMap.get(activeExplanationQuestion.storageId)
    : null;
  const isExplanationOpen = activeExplanationQuestion !== null;
  const useSidebarLayout = isExplanationOpen && isExplanationSidebarred;

  useLayoutEffect(() => {
    if (!useSidebarLayout) {
      document.documentElement.style.removeProperty("--sat-split-pct");
      return;
    }
    document.documentElement.style.setProperty("--sat-split-pct", `${explanationSplitPosition}%`);
    return () => {
      document.documentElement.style.removeProperty("--sat-split-pct");
    };
  }, [explanationSplitPosition, useSidebarLayout]);

  if (!practiceSet || !result) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
        <Button variant="ghost" asChild className="w-fit gap-2 px-0">
          <Link to="/modules">
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
    setExpandedQuestions((previous) => {
      const next = new Set(previous);
      if (next.has(storageId)) {
        next.delete(storageId);
      } else {
        next.add(storageId);
      }
      return next;
    });
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
    setRevealedAnswers((previous) => {
      const next = new Set(previous);
      if (next.has(storageId)) next.delete(storageId);
      else next.add(storageId);
      return next;
    });
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

  const stripBankPrefix = (id: string) => {
    const parts = id.split("-");
    return parts[0] === "bank" && parts.length > 3 ? parts.slice(3).join("-") : id;
  };

  const navigateExplanation = (delta: -1 | 1) => {
    if (activeExplanationIndex === null) return;
    const nextIndex = activeExplanationIndex + delta;
    if (nextIndex < 0 || nextIndex >= orderedQuestions.length) return;
    setActiveExplanationIndex(nextIndex);
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
      className="mx-auto flex min-h-screen w-full flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8"
      style={
        useSidebarLayout
          ? { maxWidth: `var(--sat-split-pct, ${explanationSplitPosition}%)`, marginLeft: 0, marginRight: 0 }
          : { maxWidth: "72rem" }
      }
    >
      <Button variant="ghost" asChild className="w-fit gap-2 px-0">
        <Link to="/modules">
          <ArrowLeft className="h-4 w-4" />
          Back to modules
        </Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <h1
            style={{
              fontFamily: "'Geist', Georgia, serif",
              fontSize: "clamp(34px, 4.5vw, 56px)",
              fontWeight: 400,
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
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
          className="shrink-0 self-end bg-transparent sm:self-start"
          aria-label="Share results"
          disabled={isSharing}
          onClick={shareResult}
        >
          <Share2 className="h-5 w-5" />
        </Button>
      </div>

      <Card className="border-border/70 bg-gradient-to-br from-card to-muted/30">
        <CardContent className="grid gap-6 p-6 sm:grid-cols-3 sm:items-end">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Total Score</div>
            <div className="mt-2 text-7xl font-semibold leading-none tracking-[-0.08em] text-foreground">
              {result.totalScore}
            </div>
            <div className="mt-2 text-sm font-medium text-muted-foreground">400 - 1600</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Reading & Writing
            </div>
            <div className="mt-2 text-5xl font-semibold leading-none tracking-[-0.05em] text-foreground">
              {result.readingWritingScore}
            </div>
            <div className="mt-2 text-sm font-medium text-muted-foreground">200 - 800</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Math
            </div>
            <div className="mt-2 text-5xl font-semibold leading-none tracking-[-0.05em] text-foreground">
              {result.mathScore}
            </div>
            <div className="mt-2 text-sm font-medium text-muted-foreground">200 - 800</div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card">
        <CardHeader>
          <CardTitle>Module Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {result.modules.map((module) => (
            <div
              key={module.moduleSlug}
              className="rounded-2xl border border-border/60 bg-muted/30 p-5"
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

      <Card className="border-border/70 bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <CardTitle className="text-2xl tracking-[-0.03em]">Question Breakdown</CardTitle>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                className="gap-2 bg-transparent"
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
                className={cn("gap-2 bg-transparent", hideCorrectAnswers && "border-primary text-primary")}
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
                  onValueChange={(value: string) => setModuleFilter(value)}
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
                  onValueChange={(value: "seen" | "correct") => setQuestionSortMode(value)}
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
                className="gap-2 bg-transparent"
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
                  "py-5",
                  index !== orderedQuestions.length - 1 && "border-b border-border/60",
                )}
              >
                <div
                  className="flex cursor-pointer flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
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
                          {sourceQuestion?.difficulty && (
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                                sourceQuestion.difficulty === "Easy" &&
                                  "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                                sourceQuestion.difficulty === "Medium" &&
                                  "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                                sourceQuestion.difficulty === "Hard" &&
                                  "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
                              )}
                            >
                              {sourceQuestion.difficulty}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronDown
                        className={cn(
                          "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          isExpanded && "rotate-180",
                        )}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                      <span className="text-muted-foreground">
                        Time: <span className="font-medium text-foreground">{formatTime(question.timeSpentSeconds)}</span>
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
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(question)}`}
                    >
                      {statusLabel(question)}
                    </div>
                  </div>
                </div>

                {isExpanded && sourceQuestion ? (
                  <div className="mt-5 grid gap-5 border-t border-border/60 pt-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
                    <div className="space-y-4">
                      {sourceQuestion.questionImages?.length ? (
                        <div className="space-y-3">
                          {sourceQuestion.questionImages.map((image, imageIndex) => (
                            <div key={`${image.src}-${imageIndex}`} className="flex justify-center">
                              <TransparentAwareImage
                                src={normalizePublicAssetPath(image.src)}
                                alt={image.alt || `SAT question ${question.globalQuestionNumber} image ${imageIndex + 1}`}
                                className="max-h-[340px] w-auto max-w-full rounded-[10px] border border-border object-contain"
                                wrapperClassName="max-w-full"
                                loading="lazy"
                                trimWhitespace
                              />
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {sourceQuestion.passage ? (
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Passage
                          </div>
                          <div
                            className="question-html mt-2 break-words prose prose-stone max-w-none text-sm leading-7 text-foreground dark:prose-invert [&_img]:my-3 [&_img]:block [&_img]:max-w-full [&_img]:h-auto [&_img]:mx-auto [&_img]:object-contain"
                            dangerouslySetInnerHTML={{
                              __html: getRenderedContentHtml(question.subject, sourceQuestion.passage),
                            }}
                          />
                        </div>
                      ) : null}
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Question
                        </div>
                        <div
                          className="question-html mt-2 break-words prose prose-stone max-w-none text-sm leading-7 text-foreground dark:prose-invert [&_img]:my-3 [&_img]:block [&_img]:max-w-full [&_img]:h-auto [&_img]:mx-auto [&_img]:object-contain"
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
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Answer Choices
                        </div>
                        {hideCorrectAnswers && (
                          <button
                            type="button"
                            onClick={() => toggleRevealedAnswer(question.storageId)}
                            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
                                  "rounded-xl px-3 py-3 text-sm",
                                  showCorrect && isCorrect
                                    ? "bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/30"
                                    : isChosen
                                      ? "bg-rose-500/10 text-foreground ring-1 ring-rose-500/30"
                                      : "bg-muted/25 text-foreground ring-1 ring-border/60",
                                )}
                              >
                                <div className="font-semibold">{choice.id}</div>
                                {hasText ? (
                                  <div
                                    className="question-html mt-1 break-words prose prose-stone max-w-none leading-6 text-muted-foreground dark:prose-invert [&_img]:my-2 [&_img]:block [&_img]:max-w-full [&_img]:h-auto [&_img]:mx-auto [&_img]:object-contain"
                                    dangerouslySetInnerHTML={{
                                      __html: getRenderedContentHtml(
                                        question.subject,
                                        choice.text ?? "",
                                      ),
                                    }}
                                  />
                                ) : null}
                                {hasImage ? (
                                  <div className={cn("mt-2 flex justify-center", hasText && "pt-1")}>
                                    <TransparentAwareImage
                                      src={normalizePublicAssetPath(choice.image)}
                                      alt={`SAT question ${question.globalQuestionNumber} choice ${choice.id} image`}
                                      className="max-h-[195px] w-auto max-w-full rounded-[10px] object-contain"
                                      wrapperClassName="max-w-full"
                                      loading="lazy"
                                      trimWhitespace
                                    />
                                  </div>
                                ) : null}
                              </div>
                            );
                          })
                        ) : (
                          <div className="rounded-xl bg-muted/25 px-3 py-3 text-sm text-muted-foreground ring-1 ring-border/60">
                            Free-response question
                          </div>
                        )}
                      </div>
                    </div>

                    {sourceQuestion.rationale && (
                      <div className="col-span-full mt-1 rounded-xl border border-border/60 bg-muted/20 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Rationale
                        </div>
                        <div
                          className="question-html mt-2 break-words prose prose-stone max-w-none text-sm leading-7 text-foreground dark:prose-invert"
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
                          "gap-2 bg-transparent",
                          activeExplanationIndex !== null &&
                            orderedQuestions[activeExplanationIndex]?.storageId === question.storageId &&
                            "ring-2 ring-primary/50",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          const idx = orderedQuestions.findIndex((q) => q.storageId === question.storageId);
                          if (idx >= 0) setActiveExplanationIndex(idx);
                        }}
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

      <div className="flex flex-wrap justify-end gap-3">
        <Button asChild>
          <Link to="/modules">
            More practice
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {activeExplanationQuestion && activeExplanationSource && (
        <DraggableWindow
          isOpen={isExplanationOpen}
          onClose={() => setActiveExplanationIndex(null)}
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
          windowId="review-explanation"
        >
          <div className="flex h-full flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <StepByStepExplanation
                questionId={stripBankPrefix(activeExplanationQuestion.storageId)}
                question={{
                  section:
                    activeExplanationQuestion.subject === "math"
                      ? "Math"
                      : "Reading and Writing",
                  passage: activeExplanationSource.passage || "",
                  questionText:
                    activeExplanationSource.questionText || activeExplanationSource.prompt,
                  choices: activeExplanationSource.choices?.map((c) => ({
                    label: c.id,
                    text: c.text ?? "",
                    image: c.image,
                  })),
                  correctAnswer: activeExplanationQuestion.correctAnswer,
                  domain: activeExplanationQuestion.domain || activeExplanationSource.domain,
                  skill: activeExplanationQuestion.skill,
                  difficulty: activeExplanationSource.difficulty,
                  isFillInBlank: activeExplanationSource.type === "free-response",
                }}
                questionImages={activeExplanationSource.questionImages}
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
                {(activeExplanationIndex ?? 0) + 1} / {orderedQuestions.length}
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
