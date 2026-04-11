import { useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import {
  getQuestionsByDomain as getQuestionsByDomainNormal,
  getQuestionsBySkill as getQuestionsBySkillNormal,
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
import {
  getQuestionsByDomain as getQuestionsByDomainOfficial,
  getQuestionsBySkill as getQuestionsBySkillOfficial,
  type BankQuestion as OfficialBankQuestion,
} from "@/data/officialQuestionBank";
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
import { BankSourceToggle } from "@/components/BankSourceToggle";

type AnyBankQuestion = BankQuestion | OfficialBankQuestion;

const BankFiltered = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { subject, filterType, filterValue } = useParams<{
    subject: BankSubject;
    filterType: "domain" | "skill";
    filterValue: string;
  }>();

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const questionsPerPage = 50;

  const isOfficial = location.pathname.startsWith("/official-bank");
  const validSubject = subject === "math" || subject === "reading" ? subject : "math";
  const isMath = validSubject === "math";
  const decodedFilter = decodeURIComponent(filterValue || "");
  const bankSource = normalizeBankSource(searchParams.get("bankType"));
  const basePath = isOfficial ? "/official-bank" : "/bank";
  const bankQuerySuffix = isOfficial ? "" : `?bankType=${bankSource}`;

  useEffect(() => {
    const prefix = isOfficial ? "official" : "bank";
    sessionStorage.removeItem(`question-view-mode:${prefix}:math`);
    sessionStorage.removeItem(`question-view-mode:${prefix}:reading`);
  }, [isOfficial]);

  const questions = useMemo((): AnyBankQuestion[] => {
    if (filterType === "domain") {
      return isOfficial
        ? getQuestionsByDomainOfficial(validSubject, decodedFilter as MathDomain | EnglishDomain)
        : getQuestionsByDomainNormal(validSubject, decodedFilter as MathDomain | EnglishDomain, bankSource);
    } else {
      return isOfficial
        ? getQuestionsBySkillOfficial(validSubject, decodedFilter as MathSkill | EnglishSkill)
        : getQuestionsBySkillNormal(validSubject, decodedFilter as MathSkill | EnglishSkill, bankSource);
    }
  }, [validSubject, filterType, decodedFilter, bankSource, isOfficial]);

  const getQuestionState = (q: AnyBankQuestion) => {
    if (isOfficial) {
      const prefix = `official-bank-${validSubject}`;
      const answered = localStorage.getItem(`${prefix}-answer-${q.id}`);
      const flagged = localStorage.getItem(`${prefix}-flag-${q.id}`) === "true";
      return { answered: !!answered, flagged };
    } else {
      const stableId = (q as BankQuestion).stableId;
      const answered = localStorage.getItem(`${stableId}-answer`);
      const flagged = localStorage.getItem(`${stableId}-flagged`) === "true";
      return { answered: !!answered, flagged };
    }
  };

  const handleBankSourceChange = (nextSource: BankSourceFilter) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("bankType", nextSource);
    setSearchParams(nextParams);
  };

  const filteredQuestions = useMemo(() => {
    if (!search.trim()) return questions;
    const lower = search.toLowerCase();
    return questions.filter(
      (q) =>
        q.prompt.toLowerCase().includes(lower) ||
        q.testName.toLowerCase().includes(lower) ||
        (isOfficial
          ? (q as OfficialBankQuestion).questionNumber.toString().includes(lower)
          : (q as BankQuestion).sourceId.toLowerCase().includes(lower))
    );
  }, [questions, search, isOfficial]);

  const totalPages = Math.ceil(filteredQuestions.length / questionsPerPage);
  const paginatedQuestions = filteredQuestions.slice(
    (currentPage - 1) * questionsPerPage,
    currentPage * questionsPerPage
  );

  const handleQuestionClick = (q: AnyBankQuestion) => {
    navigate(`${basePath}/${validSubject}/${q.id}${bankQuerySuffix}`);
  };

  const answeredCount = questions.filter((q) => getQuestionState(q).answered).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <section className="container mx-auto px-4 pt-8 pb-12">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
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
                  {!isOfficial && `${BANK_SOURCE_LABELS[bankSource]} \u2022 `}{filterType === "domain" ? "Domain" : "Skill"}
                </p>
                <h1 className="text-xl font-bold">{decodedFilter}</h1>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{questions.length}</p>
              <p className="text-xs text-muted-foreground">questions</p>
            </div>
          </div>

          {!isOfficial && <BankSourceToggle value={bankSource} onChange={handleBankSourceChange} />}

          {/* Stats Bar */}
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
                  (q) => !getQuestionState(q).answered
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

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search questions..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
            />
          </div>

          {/* Question List */}
          <Card className="overflow-hidden">
            <ScrollArea className="h-[500px]">
              {paginatedQuestions.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  No questions found matching your search.
                </div>
              ) : (
                <div className="divide-y">
                  {paginatedQuestions.map((q) => {
                    const state = getQuestionState(q);
                    return (
                      <div
                        key={q.id}
                        className="p-4 hover:bg-muted/50 cursor-pointer transition-colors flex items-center gap-4 group"
                        onClick={() => handleQuestionClick(q)}
                      >
                        <div className="flex items-center gap-2">
                          {state.answered ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                          )}
                          <span className="font-mono text-muted-foreground w-8">
                            #{q.id}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-muted-foreground line-clamp-1">
                              {q.testName}
                              {!isOfficial && ` \u2022 ${(q as BankQuestion).bankLabel} \u2022 ID ${(q as BankQuestion).sourceId}`}
                            </span>
                            {state.flagged && <Flag className="h-3 w-3 text-red-500 fill-red-500" />}
                          </div>
                          <p className="line-clamp-2 text-sm">
                            {q.prompt}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              q.category.confidence === "high"
                                ? "border-green-500/50"
                                : q.category.confidence === "medium"
                                ? "border-yellow-500/50"
                                : "border-red-500/50"
                            }`}
                          >
                            {q.category.confidence}
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

          {/* Pagination */}
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
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
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
