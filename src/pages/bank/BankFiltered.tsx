import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { BankSourceToggle } from "@/components/question/BankSourceToggle";
import { useAuth } from "@/contexts/AuthContext";
import {
  getQuestionUiStateMap,
  subscribeToQuestionUiState,
  type QuestionUiState,
  type QuestionUiStateMap,
} from "@/lib/practice/questionUiState";

const isAnsweredQuestionState = (state: QuestionUiState | undefined) =>
  Boolean(state?.answer) ||
  state?.status === "answered" ||
  state?.status === "correct-first" ||
  state?.status === "correct-later" ||
  state?.status === "incorrect";

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
  const questionsPerPage = 50;
  const deferredSearch = useDeferredValue(search);
  const [questionUiStateMap, setQuestionUiStateMap] = useState<QuestionUiStateMap>(() =>
    getQuestionUiStateMap(uid),
  );
  const [questions, setQuestions] = useState<BankQuestion[]>([]);

  const validSubject = subject === "math" || subject === "reading" ? subject : "math";
  const isMath = validSubject === "math";
  const decodedFilter = filterValue || "";
  const bankSource = normalizeBankSource(searchParams.get("bankType"));
  const basePath = "/bank";
  const bankQuerySuffix = `?bankType=${bankSource}`;

  useEffect(() => {
    sessionStorage.removeItem(`question-view-mode:bank:math`);
    sessionStorage.removeItem(`question-view-mode:bank:reading`);
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

  const totalPages = Math.ceil(filteredQuestions.length / questionsPerPage);
  const safeCurrentPage = totalPages === 0 ? 1 : Math.min(currentPage, totalPages);
  const paginatedQuestions = filteredQuestions.slice(
    (safeCurrentPage - 1) * questionsPerPage,
    safeCurrentPage * questionsPerPage
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

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search questions..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
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
                      <div
                        key={question.id}
                        className="p-4 hover:bg-muted/50 cursor-pointer transition-colors flex items-center gap-4 group"
                        onClick={() => handleQuestionClick(question)}
                      >
                        <div className="flex items-center gap-2">
                          {answered ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                          )}
                          <span className="font-mono text-muted-foreground w-8">
                            #{question.id}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-muted-foreground line-clamp-1">
                              {question.category.skill}
                            </span>
                            {flagged && <Flag className="h-3 w-3 text-red-500 fill-red-500" />}
                          </div>
                          <p className="line-clamp-2 text-sm">
                            {question.prompt}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              question.category.confidence === "high"
                                ? "border-green-500/50"
                                : question.category.confidence === "medium"
                                ? "border-yellow-500/50"
                                : "border-red-500/50"
                            }`}
                          >
                            {question.category.confidence}
                          </Badge>
                          <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
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
