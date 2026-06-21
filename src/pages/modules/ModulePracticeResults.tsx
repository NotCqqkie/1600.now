import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TransparentAwareImage } from "@/components/TransparentAwareImage";
import { StepByStepExplanation } from "@/components/question/StepByStepExplanation";
import { DraggableWindow } from "@/components/DraggableWindow";
import { usePracticeResultSplitCssVariable } from "@/hooks/usePracticeResultSplitCssVariable";
import { getPracticeModule } from "@/data/modulePracticeBank";
import {
  getLatestModulePracticeResult,
  getModulePracticeResult,
} from "@/lib/practice/modulePracticeSession";
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
import { cn, normalizePublicAssetPath } from "@/lib/utils";
import {
  getReviewChoiceImageClassName,
  getReviewQuestionImageClassName,
} from "@/lib/questionImageDisplay";
import { useAuth } from "@/contexts/AuthContext";

const MODULES_PATH = "/modules";
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
const SUMMARY_GRID_CLASS = "grid gap-4 sm:grid-cols-3";
const SUMMARY_CARD_CLASS = "border-border/70 bg-card";
const SUMMARY_CARD_CONTENT_CLASS = "pt-6";
const SUMMARY_LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground";
const SUMMARY_VALUE_CLASS = "mt-3 text-4xl font-semibold tracking-[-0.04em] text-foreground";
const SUMMARY_DESCRIPTION_CLASS = "mt-2 text-sm text-muted-foreground";
const TIME_USED_VALUE_CLASS = "mt-3 flex items-center gap-2 text-3xl font-semibold tracking-[-0.03em] text-foreground";
const TIME_ICON_CLASS = "h-6 w-6 text-muted-foreground";
const AVERAGE_TIME_CARD_CLASS = "border-border/70 bg-gradient-to-br from-card to-muted/30";
const INSIGHT_GRID_CLASS = "grid gap-6 xl:grid-cols-2";
const PLAIN_CARD_CLASS = "border-border/70";
const MUTED_PANEL_CLASS = "rounded-xl bg-muted/25 px-4 py-4";
const PANEL_LABEL_CLASS = "text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground";
const PANEL_LIST_CLASS = "mt-3 space-y-3";
const PACING_QUESTION_BUTTON_CLASS = "block w-full rounded-lg px-2 py-1 text-left transition-colors hover:bg-muted/40";
const PACING_QUESTION_META_CLASS = "mt-1 text-sm text-muted-foreground";
const CONTROL_ROW_CLASS = "flex flex-col gap-3 sm:flex-row sm:items-center";
const CONTROL_BUTTON_CLASS = "gap-2 bg-transparent";
const QUESTION_ROW_BASE_CLASS = "py-5";
const QUESTION_ROW_BORDER_CLASS = "border-b border-border/60";
const QUESTION_ROW_HEADER_CLASS = "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between";
const QUESTION_TOGGLE_CLASS = "flex w-full items-start justify-between gap-3 text-left";
const CHEVRON_TOGGLE_CLASS = "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform";
const STATUS_BADGE_BASE_CLASS = "inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-semibold";
const QUESTION_DETAIL_GRID_CLASS = "mt-5 grid gap-5 border-t border-border/60 pt-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]";
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

const addStringSetValue = (previous: Set<string>, value: string): Set<string> => {
  const next = new Set(previous);
  next.add(value);
  return next;
};

const ModulePracticeResults = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const [searchParams] = useSearchParams();
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(() => new Set());
  const [hideCorrectAnswers, setHideCorrectAnswers] = useState(false);
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(() => new Set());
  const [activeExplanationStorageId, setActiveExplanationStorageId] = useState<string | null>(null);
  const [explanationSplitPosition, setExplanationSplitPosition] = useState(65);
  const [isExplanationSidebarred, setIsExplanationSidebarred] = useState(true);
  const [questionSortMode, setQuestionSortMode] = useState<QuestionSortMode>("seen");
  const [questionSortDirection, setQuestionSortDirection] = useState<QuestionSortDirection>("asc");
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const sessionId = searchParams.get("session");
  const module = useMemo(
    () => (moduleId ? getPracticeModule(moduleId) : null),
    [moduleId],
  );
  const result = useMemo(() => {
    if (!module) return null;
    if (sessionId) {
      return getModulePracticeResult(sessionId, uid) ?? getLatestModulePracticeResult(module.slug, uid);
    }
    return getLatestModulePracticeResult(module.slug, uid);
  }, [module, sessionId, uid]);
  const orderedQuestions = useMemo(() => {
    if (!result) return [];
    const directionMultiplier = questionSortDirection === "asc" ? 1 : -1;

    return [...result.questions].sort((left, right) => {
      if (questionSortMode === "correct") {
        const correctnessDifference =
          (getQuestionCorrectnessRank(left, questionSortDirection) -
            getQuestionCorrectnessRank(right, questionSortDirection)) *
          directionMultiplier;
        if (correctnessDifference !== 0) return correctnessDifference;
      }

      return (left.questionNumber - right.questionNumber) * directionMultiplier;
    });
  }, [questionSortDirection, questionSortMode, result]);
  const activeExplanationIndex = activeExplanationStorageId
    ? orderedQuestions.findIndex((question) => question.storageId === activeExplanationStorageId)
    : -1;
  const activeExplanationQuestion =
    activeExplanationIndex >= 0 ? orderedQuestions[activeExplanationIndex] : null;
  const hasActiveExplanationSource =
    activeExplanationQuestion && module
      ? module.questions.some(
          (entry) => entry.bankQuestion.stableId === activeExplanationQuestion.storageId,
        )
      : false;
  const isExplanationOpen = activeExplanationQuestion !== null;
  const useSidebarLayout = isExplanationOpen && isExplanationSidebarred;

  usePracticeResultSplitCssVariable(useSidebarLayout, explanationSplitPosition);

  if (!module || !result) {
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
            <h2 className="text-xl font-semibold">Results not found</h2>
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

  const averageTimeByDomain = result.questions.reduce<
    Array<{ domain: string; averageSeconds: number; answered: number }>
  >((accumulator, question) => {
    if (!question.isAnswered) return accumulator;
    const existing = accumulator.find((entry) => entry.domain === question.domain);
    if (existing) {
      const totalTime = existing.averageSeconds * existing.answered + question.timeSpentSeconds;
      existing.answered += 1;
      existing.averageSeconds = totalTime / existing.answered;
      return accumulator;
    }
    accumulator.push({
      domain: question.domain,
      averageSeconds: question.timeSpentSeconds,
      answered: 1,
    });
    return accumulator;
  }, []).sort((left, right) => right.averageSeconds - left.averageSeconds);

  const domainPerformance = result.questions.reduce<
    Array<{ domain: string; answered: number; correct: number; averageSeconds: number }>
  >((accumulator, question) => {
    if (!question.isAnswered) return accumulator;
    const existing = accumulator.find((entry) => entry.domain === question.domain);
    if (existing) {
      const totalTime = existing.averageSeconds * existing.answered + question.timeSpentSeconds;
      existing.answered += 1;
      existing.correct += question.isCorrect ? 1 : 0;
      existing.averageSeconds = totalTime / existing.answered;
      return accumulator;
    }
    accumulator.push({
      domain: question.domain,
      answered: 1,
      correct: question.isCorrect ? 1 : 0,
      averageSeconds: question.timeSpentSeconds,
    });
    return accumulator;
  }, []).sort((left, right) => (right.correct / right.answered) - (left.correct / left.answered));

  const timedQuestions = [...result.questions]
    .filter((question) => question.timeSpentSeconds > 0)
    .sort((left, right) => right.timeSpentSeconds - left.timeSpentSeconds);
  const highestTimeQuestions = timedQuestions.slice(0, 3);
  const lowestTimeQuestions = timedQuestions.slice(-3).reverse();
  const scrollToQuestion = (storageId: string) => {
    setExpandedQuestions((previous) => addStringSetValue(previous, storageId));

    requestAnimationFrame(() => {
      const target = document.getElementById(`question-review-${storageId}`);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const navigateExplanation = (delta: -1 | 1) => {
    if (activeExplanationIndex < 0) return;
    const nextIndex = activeExplanationIndex + delta;
    if (nextIndex < 0 || nextIndex >= orderedQuestions.length) return;
    setActiveExplanationStorageId(orderedQuestions[nextIndex].storageId);
    scrollToQuestion(orderedQuestions[nextIndex].storageId);
  };

  return (
    <div
      className={RESULTS_ROOT_CLASS}
      style={
        useSidebarLayout
          ? { maxWidth: `var(--sat-split-pct, ${explanationSplitPosition}%)`, marginLeft: 0, marginRight: 0 }
          : { maxWidth: "80rem" }
      }
    >
      <Button variant="ghost" asChild className={BACK_BUTTON_CLASS}>
        <Link to={MODULES_PATH}>
          <ArrowLeft className="h-4 w-4" />
          Back to modules
        </Link>
      </Button>

      <div className="space-y-3">
        <h1 style={RESULTS_HEADING_STYLE}>
          Module Review
        </h1>
        <div className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {module.publicTitle}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className={SUMMARY_GRID_CLASS}>
          <Card className={SUMMARY_CARD_CLASS}>
            <CardContent className={SUMMARY_CARD_CONTENT_CLASS}>
              <div className={SUMMARY_LABEL_CLASS}>Accuracy</div>
              <div className={SUMMARY_VALUE_CLASS}>{result.accuracy}%</div>
              <div className={SUMMARY_DESCRIPTION_CLASS}>
                {result.correctCount} of {result.questionCount} correct
              </div>
            </CardContent>
          </Card>
          <Card className={SUMMARY_CARD_CLASS}>
            <CardContent className={SUMMARY_CARD_CONTENT_CLASS}>
              <div className={SUMMARY_LABEL_CLASS}>Answered</div>
              <div className={SUMMARY_VALUE_CLASS}>{result.answeredCount}</div>
              <div className={SUMMARY_DESCRIPTION_CLASS}>
                {result.unansweredCount} unanswered
              </div>
            </CardContent>
          </Card>
          <Card className={SUMMARY_CARD_CLASS}>
            <CardContent className={SUMMARY_CARD_CONTENT_CLASS}>
              <div className={SUMMARY_LABEL_CLASS}>Time Used</div>
              <div className={TIME_USED_VALUE_CLASS}>
                <Clock3 className={TIME_ICON_CLASS} />
                {formatPracticeResultTime(result.elapsedSeconds)}
              </div>
              <div className={SUMMARY_DESCRIPTION_CLASS}>
                {result.timeLimitSeconds ? `${Math.round(result.timeLimitSeconds / 60)} minute limit` : "Untimed session"}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className={AVERAGE_TIME_CARD_CLASS}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg tracking-[-0.02em]">Average Time by Question Type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {averageTimeByDomain.length === 0 ? (
              <p className="text-sm text-muted-foreground">No answered questions yet.</p>
            ) : (
              averageTimeByDomain.map((entry) => (
                <div key={entry.domain} className="flex items-center justify-between gap-4 border-b border-border/50 pb-3 last:border-b-0 last:pb-0">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{entry.domain}</div>
                    <div className="text-xs text-muted-foreground">{entry.answered} answered</div>
                  </div>
                  <div className="text-base font-semibold text-foreground">{formatPracticeResultTime(Math.round(entry.averageSeconds))}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className={INSIGHT_GRID_CLASS}>
        <Card className={PLAIN_CARD_CLASS}>
          <CardHeader>
            <CardTitle className="text-xl tracking-[-0.02em]">Skill Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {domainPerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground">No answered questions yet.</p>
            ) : (
              domainPerformance.map((domain) => (
                <div key={domain.domain} className="rounded-xl bg-muted/25 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold tracking-[-0.01em] text-foreground">{domain.domain}</div>
                      <div className="mt-0.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">General topic</div>
                    </div>
                    <div className="text-lg font-semibold text-foreground">
                      {Math.round((domain.correct / domain.answered) * 100)}%
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                    <span>{domain.correct}/{domain.answered} correct</span>
                    <span>{formatPracticeResultTime(Math.round(domain.averageSeconds))} avg</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className={PLAIN_CARD_CLASS}>
          <CardHeader>
            <CardTitle className="text-xl tracking-[-0.02em]">Pacing Notes</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className={MUTED_PANEL_CLASS}>
              <div className={PANEL_LABEL_CLASS}>Most Time Taken</div>
              <div className={PANEL_LIST_CLASS}>
                {highestTimeQuestions.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No timed data recorded.</div>
                ) : (
                  highestTimeQuestions.map((question) => (
                    <button
                      key={question.storageId}
                      type="button"
                      onClick={() => scrollToQuestion(question.storageId)}
                      className={PACING_QUESTION_BUTTON_CLASS}
                    >
                      <div className="text-base font-semibold text-foreground">
                        Question {question.questionNumber}
                      </div>
                      <div className={PACING_QUESTION_META_CLASS}>
                        {question.skill} · {formatPracticeResultTime(question.timeSpentSeconds)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className={MUTED_PANEL_CLASS}>
              <div className={PANEL_LABEL_CLASS}>Least Time Taken</div>
              <div className={PANEL_LIST_CLASS}>
                {lowestTimeQuestions.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No timed data recorded.</div>
                ) : (
                  lowestTimeQuestions.map((question) => (
                    <button
                      key={question.storageId}
                      type="button"
                      onClick={() => scrollToQuestion(question.storageId)}
                      className={PACING_QUESTION_BUTTON_CLASS}
                    >
                      <div className="text-base font-semibold text-foreground">
                        Question {question.questionNumber}
                      </div>
                      <div className={PACING_QUESTION_META_CLASS}>
                        {question.skill} · {formatPracticeResultTime(question.timeSpentSeconds)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className={PLAIN_CARD_CLASS}>
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
                  setRevealedAnswers(new Set<string>());
                }}
              >
                {hideCorrectAnswers ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {hideCorrectAnswers ? "Answers Hidden" : "Hide Answers"}
              </Button>
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
            const isExpanded = expandedQuestions.has(question.storageId);
            const sourceQuestion = isExpanded
              ? module.questions.find(
                  (entry) => entry.bankQuestion.stableId === question.storageId,
                )?.bankQuestion
              : null;
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
                <div className={QUESTION_ROW_HEADER_CLASS}>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleExpandedQuestion(question.storageId)}
                      className={QUESTION_TOGGLE_CLASS}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-base font-semibold tracking-[-0.01em] text-foreground">
                            Question {question.questionNumber}
                          </span>
                          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                            {question.skill}
                          </span>
                        </div>
                      </div>
                      <ChevronDown
                        className={cn(
                          CHEVRON_TOGGLE_CLASS,
                          isExpanded && "rotate-180",
                        )}
                      />
                    </button>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
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
                  <div
                    className={`${STATUS_BADGE_BASE_CLASS} ${statusClasses(question)}`}
                  >
                    {statusLabel(question)}
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
                                alt={image.alt || `SAT question ${question.questionNumber} image ${imageIndex + 1}`}
                                className={cn(
                                  RESULT_REVIEW_QUESTION_IMAGE_CLASS,
                                  getReviewQuestionImageClassName(image.displaySize),
                                )}
                                trimWhitespace
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
                              __html: getRenderedContentHtml(module.subject, sourceQuestion.passage),
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
                              module.subject,
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
                                      __html: getRenderedContentHtml(module.subject, choice.text),
                                    }}
                                  />
                                ) : null}
                                {hasImage ? (
                                  <div className={cn("mt-2 flex justify-center", hasText && "pt-1")}>
                                    <TransparentAwareImage
                                      src={normalizePublicAssetPath(choice.image)}
                                      alt={`SAT question ${question.questionNumber} choice ${choice.id} image`}
                                      className={cn(
                                        RESULT_REVIEW_CHOICE_IMAGE_CLASS,
                                        getReviewChoiceImageClassName(choice.imageDisplaySize),
                                      )}
                                      trimWhitespace
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
          title={`Question ${activeExplanationQuestion.questionNumber} — Explanation`}
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

export default ModulePracticeResults;
