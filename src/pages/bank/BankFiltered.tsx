import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useDeferredValue, useState, useMemo, useEffect } from "react";
import {
  loadQuestionsByDomain,
  loadQuestionsBySkill,
  normalizeBankSource,
  BANK_SOURCE_LABELS,
  type BankSubject,
  type BankQuestion,
  type BankSourceFilter,
  type MathDomain,
  type EnglishDomain,
  type MathSkill,
  type EnglishSkill,
} from "@/data/questionBank";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Calculator,
  FileText,
  ChevronRight,
  Search,
  Flag,
  CheckCircle2,
  BookOpen,
} from "lucide-react";
import { BankSourceToggle } from "@/components/question/BankSourceToggle";
import { useAuth } from "@/contexts/AuthContext";
import {
  getQuestionUiStateMap,
  subscribeToQuestionUiState,
  type QuestionUiState,
  type QuestionUiStateMap,
} from "@/lib/practice/questionUiState";
import { clearBankQuestionViewModeStorage } from "@/lib/questionViewModeStorage";
import { getSatSkillGuide } from "@/lib/seo-data/satSkillsData";

const isAnsweredQuestionState = (state: QuestionUiState | undefined) =>
  Boolean(state?.answer) ||
  state?.status === "answered" ||
  state?.status === "correct-first" ||
  state?.status === "correct-later" ||
  state?.status === "incorrect";

const QUESTIONS_PER_PAGE = 50;

const BankFiltered = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { subject, filterType, filterValue } = useParams<{
    subject: BankSubject;
    filterType: "domain" | "skill";
    filterValue: string;
  }>();

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const deferredSearch = useDeferredValue(search);
  const [questionUiStateMap, setQuestionUiStateMap] = useState<QuestionUiStateMap>(() =>
    getQuestionUiStateMap(uid),
  );
  const [questions, setQuestions] = useState<BankQuestion[]>([]);

  const validSubject = subject === "math" || subject === "reading" ? subject : "math";
  const isMath = validSubject === "math";
  const decodedFilter = filterValue || "";
  const bankSource = normalizeBankSource(searchParams.get("bankType"));
  const skillGuide = filterType === "skill" ? getSatSkillGuide(decodedFilter) : undefined;
  const basePath = "/bank";
  const bankQuerySuffix = `?bankType=${bankSource}`;

  useEffect(() => {
    clearBankQuestionViewModeStorage();
  }, []);

  useEffect(() => {
    setQuestionUiStateMap(getQuestionUiStateMap(uid));

    return subscribeToQuestionUiState(() => {
      setQuestionUiStateMap(getQuestionUiStateMap(uid));
    });
  }, [uid]);

  useEffect(() => {
    let cancelled = false;
    setQuestions([]);
    const loadQuestions =
      filterType === "domain"
        ? loadQuestionsByDomain(validSubject, decodedFilter as MathDomain | EnglishDomain, bankSource)
        : loadQuestionsBySkill(validSubject, decodedFilter as MathSkill | EnglishSkill, bankSource);

    loadQuestions.then((loadedQuestions) => {
      if (!cancelled) setQuestions(loadedQuestions);
    });

    return () => {
      cancelled = true;
    };
  }, [validSubject, filterType, decodedFilter, bankSource]);

  const answeredCount = useMemo(
    () =>
      questions.reduce((count, question) => {
        const state = questionUiStateMap[question.stableId];
        return isAnsweredQuestionState(state) ? count + 1 : count;
      }, 0),
    [questionUiStateMap, questions],
  );

  const handleBankSourceChange = (nextSource: BankSourceFilter) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("bankType", nextSource);
    setSearchParams(nextParams);
  };

  const filteredQuestions = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    if (!normalizedSearch) return questions;
    return questions.filter(
      (question) =>
        question.prompt.toLowerCase().includes(normalizedSearch) ||
        question.passage?.toLowerCase().includes(normalizedSearch) ||
        question.questionText?.toLowerCase().includes(normalizedSearch) ||
        question.choices?.some((choice) => choice.text?.toLowerCase().includes(normalizedSearch)) ||
        question.correctAnswer?.toLowerCase().includes(normalizedSearch)
    );
  }, [deferredSearch, questions]);

  const totalPages = Math.ceil(filteredQuestions.length / QUESTIONS_PER_PAGE);
  const safeCurrentPage = totalPages === 0 ? 1 : Math.min(currentPage, totalPages);
  const paginatedQuestions = filteredQuestions.slice(
    (safeCurrentPage - 1) * QUESTIONS_PER_PAGE,
    safeCurrentPage * QUESTIONS_PER_PAGE
  );

  useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [currentPage, safeCurrentPage]);

  const handleQuestionClick = (question: BankQuestion) => {
    navigate(`${basePath}/${validSubject}/${question.id}${bankQuerySuffix}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <section className="container mx-auto px-4 pt-8 pb-12">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => navigate(`${basePath}/${validSubject}/browse${bankQuerySuffix}`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3 flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isMath ? "bg-primary/10" : "bg-secondary/10"
                }`}
              >
                {isMath ? (
                  <Calculator className="h-5 w-5 text-primary" />
                ) : (
                  <FileText className="h-5 w-5 text-secondary" />
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  {`${BANK_SOURCE_LABELS[bankSource]} \u2022 `}{filterType === "domain" ? "Domain" : "Skill"}
                </p>
                <h1 className="text-xl font-bold">{decodedFilter}</h1>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{questions.length}</p>
              <p className="text-xs text-muted-foreground">questions</p>
            </div>
          </div>

          <BankSourceToggle value={bankSource} onChange={handleBankSourceChange} />

          {skillGuide && (
            <Card className="flex items-start gap-3 p-4">
              <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="font-semibold">Review the {skillGuide.name} guide</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Read the core rules and shortcuts, then return here for targeted practice.
                </p>
                <Link
                  to={`/sat-skill/${skillGuide.slug}`}
                  className="mt-2 inline-block text-sm font-semibold underline"
                >
                  Learn {skillGuide.name}
                </Link>
              </div>
            </Card>
          )}

          <Card className="p-4 flex items-center gap-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">
                {answeredCount} / {questions.length} completed
              </span>
            </div>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }}
              />
            </div>
            <Button
              size="sm"
              onClick={() => {
                const firstUnanswered = questions.find(
                  (question) => {
                    const state = questionUiStateMap[question.stableId];
                    return !isAnsweredQuestionState(state);
                  }
                );
                if (firstUnanswered) {
                  handleQuestionClick(firstUnanswered);
                } else if (questions[0]) {
                  handleQuestionClick(questions[0]);
                }
              }}
            >
              Continue
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Card>

          <div className="group relative rounded-[10px] transition-shadow duration-200 focus-within:shadow-[0_0_0_4px_rgb(var(--ds-accent)/0.26)]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors duration-200 group-focus-within:text-cobalt-deep dark:group-focus-within:text-cobalt" />
            <Input
              placeholder="Search questions..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 focus-visible:border-ds-accent-deep/60 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          <Card className="overflow-hidden">
            <ScrollArea className="h-[500px]">
              {paginatedQuestions.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  No questions found matching your search.
                </div>
              ) : (
                <div className="divide-y">
                  {paginatedQuestions.map((question) => {
                    const state = questionUiStateMap[question.stableId];
                    const answered = isAnsweredQuestionState(state);
                    const flagged = state?.flagged === true;
                    return (
                      <button
                        type="button"
                        key={question.id}
                        className="bank-result-row group flex w-full cursor-pointer items-center gap-4 border-l-2 border-l-transparent p-4 text-left hover:border-l-ds-accent-deep hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        onClick={() => handleQuestionClick(question)}
                      >
                        <span className="sr-only">{answered ? "Answered" : "Unanswered"} question</span>
                        <span className="flex items-center gap-2">
                          {answered ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" aria-hidden="true" />
                          ) : (
                            <span className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" aria-hidden="true" />
                          )}
                          <span className="font-mono text-muted-foreground w-8">
                            #{question.id}
                          </span>
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="mb-1 flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground line-clamp-1">
                              {question.category.skill}
                            </span>
                            {flagged ? (
                              <>
                                <Flag className="h-3 w-3 fill-red-500 text-red-500" aria-hidden="true" />
                                <span className="sr-only">Marked for review</span>
                              </>
                            ) : null}
                          </span>
                          <span className="line-clamp-2 text-sm">
                            {question.prompt}
                          </span>
                        </span>

                        <span className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-[9px] py-[3px] text-xs font-semibold ${
                              question.category.confidence === "high"
                                ? "border-green-500/50"
                                : question.category.confidence === "medium"
                                ? "border-yellow-500/50"
                                : "border-red-500/50"
                            }`}
                          >
                            {question.category.confidence}
                          </span>
                          <ChevronRight className="bank-result-arrow h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm font-medium px-4">
                Page {safeCurrentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={safeCurrentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default BankFiltered;
