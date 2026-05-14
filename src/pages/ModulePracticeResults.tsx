import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, Clock3, Eye, EyeOff, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TransparentAwareImage } from "@/components/TransparentAwareImage";
import { StepByStepExplanation } from "@/components/question/StepByStepExplanation";
import { getPracticeModule } from "@/data/modulePracticeBank";
import {
  getLatestModulePracticeResult,
  getModulePracticeResult,
  type ModulePracticeQuestionResult,
} from "@/lib/practice/modulePracticeSession";
import { cn, normalizePublicAssetPath } from "@/lib/utils";
import { renderMixedContent } from "@/lib/text/mathRendering";
import { normalizeReadingDisplayText } from "@/lib/text/readingTextNormalization";

const formatTime = (seconds: number) => {
  if (!seconds) return "0s";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (!minutes) return `${remainder}s`;
  return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
};

const statusLabel = (question: ModulePracticeQuestionResult) => {
  if (!question.isAnswered) return "Unanswered";
  return question.isCorrect ? "Correct" : "Incorrect";
};

const statusClasses = (question: ModulePracticeQuestionResult) => {
  if (!question.isAnswered) return "border-border bg-muted/30 text-muted-foreground";
  return question.isCorrect
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
};

const answerLabel = (answer: string) => (answer?.trim() ? answer : "No answer");
const getQuestionCorrectnessRank = (question: ModulePracticeQuestionResult) => {
  if (!question.isAnswered) return -1;
  return question.isCorrect ? 1 : 0;
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

const ModulePracticeResults = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const [searchParams] = useSearchParams();
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(() => new Set());
  const [hideCorrectAnswers, setHideCorrectAnswers] = useState(false);
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(() => new Set());
  const [showExplanation, setShowExplanation] = useState<Set<string>>(() => new Set());
  const [questionSortMode, setQuestionSortMode] = useState<"seen" | "correct">("seen");
  const [questionSortDirection, setQuestionSortDirection] = useState<"asc" | "desc">("asc");
  const sessionId = searchParams.get("session");
  const module = useMemo(
    () => (moduleId ? getPracticeModule(moduleId) : null),
    [moduleId],
  );
  const result = useMemo(() => {
    if (!module) return null;
    if (sessionId) {
      return getModulePracticeResult(sessionId) ?? getLatestModulePracticeResult(module.slug);
    }
    return getLatestModulePracticeResult(module.slug);
  }, [module, sessionId]);
  const orderedQuestions = useMemo(() => {
    if (!result) return [];
    const directionMultiplier = questionSortDirection === "asc" ? 1 : -1;

    return [...result.questions].sort((left, right) => {
      if (questionSortMode === "correct") {
        const correctnessDifference =
          (getQuestionCorrectnessRank(left) - getQuestionCorrectnessRank(right)) * directionMultiplier;
        if (correctnessDifference !== 0) return correctnessDifference;
      }

      return (left.questionNumber - right.questionNumber) * directionMultiplier;
    });
  }, [questionSortDirection, questionSortMode, result]);

  if (!module || !result) {
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
            <h2 className="text-xl font-semibold">Results not found</h2>
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
  const toggleRevealedAnswer = (storageId: string) => {
    setRevealedAnswers((previous) => {
      const next = new Set(previous);
      if (next.has(storageId)) {
        next.delete(storageId);
      } else {
        next.add(storageId);
      }
      return next;
    });
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
  const lowestTimeQuestions = [...timedQuestions].reverse().slice(0, 3);
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

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Button variant="ghost" asChild className="w-fit gap-2 px-0">
        <Link to="/modules">
          <ArrowLeft className="h-4 w-4" />
          Back to modules
        </Link>
      </Button>

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
          Module Review
        </h1>
        <div className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {module.publicTitle}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-border/70 bg-card">
            <CardContent className="pt-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Accuracy</div>
              <div className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-foreground">{result.accuracy}%</div>
              <div className="mt-2 text-sm text-muted-foreground">
                {result.correctCount} of {result.questionCount} correct
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card">
            <CardContent className="pt-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Answered</div>
              <div className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-foreground">{result.answeredCount}</div>
              <div className="mt-2 text-sm text-muted-foreground">
                {result.unansweredCount} unanswered
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card">
            <CardContent className="pt-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Time Used</div>
              <div className="mt-3 flex items-center gap-2 text-3xl font-semibold tracking-[-0.03em] text-foreground">
                <Clock3 className="h-6 w-6 text-muted-foreground" />
                {formatTime(result.elapsedSeconds)}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {result.timeLimitSeconds ? `${Math.round(result.timeLimitSeconds / 60)} minute limit` : "Untimed session"}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/70 bg-gradient-to-br from-card to-muted/30">
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
                  <div className="text-base font-semibold text-foreground">{formatTime(Math.round(entry.averageSeconds))}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/70">
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
                    <span>{formatTime(Math.round(domain.averageSeconds))} avg</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-xl tracking-[-0.02em]">Pacing Notes</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-muted/25 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Most Time Taken</div>
              <div className="mt-3 space-y-3">
                {highestTimeQuestions.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No timed data recorded.</div>
                ) : (
                  highestTimeQuestions.map((question) => (
                    <button
                      key={question.storageId}
                      type="button"
                      onClick={() => scrollToQuestion(question.storageId)}
                      className="block w-full rounded-lg px-2 py-1 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="text-base font-semibold text-foreground">
                        Question {question.questionNumber}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {question.skill} · {formatTime(question.timeSpentSeconds)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-xl bg-muted/25 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Least Time Taken</div>
              <div className="mt-3 space-y-3">
                {lowestTimeQuestions.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No timed data recorded.</div>
                ) : (
                  lowestTimeQuestions.map((question) => (
                    <button
                      key={question.storageId}
                      type="button"
                      onClick={() => scrollToQuestion(question.storageId)}
                      className="block w-full rounded-lg px-2 py-1 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="text-base font-semibold text-foreground">
                        Question {question.questionNumber}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {question.skill} · {formatTime(question.timeSpentSeconds)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <CardTitle className="text-2xl tracking-[-0.03em]">Question Breakdown</CardTitle>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
            const sourceQuestion = module.questions.find(
              (entry) => entry.bankQuestion.stableId === question.storageId,
            )?.bankQuestion;
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleExpandedQuestion(question.storageId)}
                      className="flex w-full items-start justify-between gap-3 text-left"
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
                          "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          isExpanded && "rotate-180",
                        )}
                      />
                    </button>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
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
                  <div
                    className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(question)}`}
                  >
                    {statusLabel(question)}
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
                                alt={image.alt || `SAT question ${question.questionNumber} image ${imageIndex + 1}`}
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
                                __html: getRenderedContentHtml(module.subject, sourceQuestion.passage),
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
                              module.subject,
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
                                        module.subject,
                                        choice.text ?? "",
                                      ),
                                    }}
                                  />
                                ) : null}
                                {hasImage ? (
                                  <div className={cn("mt-2 flex justify-center", hasText && "pt-1")}>
                                    <TransparentAwareImage
                                      src={normalizePublicAssetPath(choice.image)}
                                      alt={`SAT question ${question.questionNumber} choice ${choice.id} image`}
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

                    <div className="col-span-full mt-1">
                      {!showExplanation.has(question.storageId) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 bg-transparent"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowExplanation((prev) => new Set(prev).add(question.storageId));
                          }}
                        >
                          <Lightbulb className="h-4 w-4" />
                          Show Step-by-Step Explanation
                        </Button>
                      ) : (
                        <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              <Lightbulb className="h-3.5 w-3.5" />
                              Step-by-Step Explanation
                            </div>
                            <button
                              type="button"
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowExplanation((prev) => {
                                  const next = new Set(prev);
                                  next.delete(question.storageId);
                                  return next;
                                });
                              }}
                            >
                              Hide
                            </button>
                          </div>
                          <StepByStepExplanation
                            questionId={question.storageId}
                            question={{
                              section: module.subject === "math" ? "Math" : "Reading and Writing",
                              passage: sourceQuestion.passage || "",
                              questionText: sourceQuestion.questionText || sourceQuestion.prompt,
                              choices: sourceQuestion.choices?.map((c) => ({
                                label: c.id,
                                text: c.text ?? "",
                                image: c.image,
                              })),
                              correctAnswer: question.correctAnswer,
                              domain: question.domain || sourceQuestion.domain,
                              skill: question.skill,
                              difficulty: sourceQuestion.difficulty,
                              isFillInBlank: sourceQuestion.type === "fill-in-blank",
                            }}
                            questionImages={sourceQuestion.questionImages}
                          />
                        </div>
                      )}
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
    </div>
  );
};

export default ModulePracticeResults;
