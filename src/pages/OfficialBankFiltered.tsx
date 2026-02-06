import { useNavigate, useParams } from "react-router-dom";
import { useState, useMemo } from "react";
import {
  getQuestionsByDomain,
  getQuestionsBySkill,
  type BankSubject,
  type BankQuestion,
  type MathDomain,
  type EnglishDomain,
  type MathSkill,
  type EnglishSkill,
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

const OfficialBankFiltered = () => {
  const navigate = useNavigate();
  const { subject, filterType, filterValue } = useParams<{
    subject: BankSubject;
    filterType: "domain" | "skill";
    filterValue: string;
  }>();
  
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const questionsPerPage = 50;

  const validSubject = subject === "math" || subject === "reading" ? subject : "math";
  const isMath = validSubject === "math";
  const decodedFilter = decodeURIComponent(filterValue || "");

  const questions = useMemo(() => {
    if (filterType === "domain") {
      return getQuestionsByDomain(validSubject, decodedFilter as MathDomain | EnglishDomain);
    } else {
      return getQuestionsBySkill(validSubject, decodedFilter as MathSkill | EnglishSkill);
    }
  }, [validSubject, filterType, decodedFilter]);

  // Get answered/flagged states from localStorage
  const getQuestionState = (q: BankQuestion) => {
    // IMPORTANT: Changed storage prefix for official bank
    const prefix = `official-bank-${validSubject}`;
    const answered = localStorage.getItem(`${prefix}-answer-${q.id}`);
    const flagged = localStorage.getItem(`${prefix}-flag-${q.id}`) === "true";
    return { answered: !!answered, flagged };
  };

  const filteredQuestions = useMemo(() => {
    if (!search.trim()) return questions;
    const lower = search.toLowerCase();
    return questions.filter(
      (q) =>
        q.prompt.toLowerCase().includes(lower) ||
        q.testName.toLowerCase().includes(lower) ||
        q.questionNumber.toString().includes(lower)
    );
  }, [questions, search]);

  const totalPages = Math.ceil(filteredQuestions.length / questionsPerPage);
  const paginatedQuestions = filteredQuestions.slice(
    (currentPage - 1) * questionsPerPage,
    currentPage * questionsPerPage
  );

  const handleQuestionClick = (q: BankQuestion) => {
    // Navigate to the question, but we need to use the pool-relative ID
    navigate(`/official-bank/${validSubject}/${q.id}`);
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
              onClick={() => navigate(`/official-bank/${validSubject}/browse`)}
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
                  {filterType === "domain" ? "Domain" : "Skill"}
                </p>
                <h1 className="text-xl font-bold">{decodedFilter}</h1>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{questions.length}</p>
              <p className="text-xs text-muted-foreground">questions</p>
            </div>
          </div>

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
                style={{ width: `${(answeredCount / questions.length) * 100}%` }}
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
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search in these questions..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9"
            />
          </div>

          {/* Questions List */}
          <Card className="overflow-hidden">
             {paginatedQuestions.length === 0 ? (
               <div className="p-12 text-center text-muted-foreground">
                 No questions found matching your search.
               </div>
             ) : (
               <div className="divide-y">
                 {paginatedQuestions.map((q) => {
                   const { answered, flagged } = getQuestionState(q);
                   return (
                     <div
                       key={q.id}
                       onClick={() => handleQuestionClick(q)}
                       className="p-4 hover:bg-muted/50 transition-colors cursor-pointer flex items-center gap-4 group"
                     >
                       <div className="flex items-center gap-2">
                         {answered ? (
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
                          </span>
                          {flagged && <Flag className="h-3 w-3 text-red-500 fill-red-500" />}
                         </div>
                         <p className="line-clamp-2 text-sm">
                           {q.prompt}
                         </p>
                       </div>

                       <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                     </div>
                   );
                 })}
               </div>
             )}
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(c => Math.max(1, c - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))}
                disabled={currentPage === totalPages}
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

export default OfficialBankFiltered;
