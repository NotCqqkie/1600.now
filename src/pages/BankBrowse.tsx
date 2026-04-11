import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import {
  getBankPool as getBankPoolNormal,
  getDomainCounts as getDomainCountsNormal,
  getSkillCounts as getSkillCountsNormal,
  getQuestionsByDomain as getQuestionsByDomainNormal,
  getQuestionsBySkill as getQuestionsBySkillNormal,
  mathDomainSkills,
  englishDomainSkills,
  allMathDomains,
  allEnglishDomains,
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
  getBankPool as getBankPoolOfficial,
  getDomainCounts as getDomainCountsOfficial,
  getSkillCounts as getSkillCountsOfficial,
  getQuestionsByDomain as getQuestionsByDomainOfficial,
  getQuestionsBySkill as getQuestionsBySkillOfficial,
  type BankQuestion as OfficialBankQuestion,
} from "@/data/officialQuestionBank";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowLeft,
  Calculator,
  FileText,
  ChevronRight,
  Layers,
  Target,
  Shuffle,
} from "lucide-react";
import { BankSourceToggle } from "@/components/BankSourceToggle";

const domainIcons: Record<string, string> = {
  "Algebra": "📐",
  "Advanced Math": "📊",
  "Problem-Solving and Data Analysis": "📈",
  "Geometry and Trigonometry": "📏",
  "Craft and Structure": "🔍",
  "Expression of Ideas": "✏️",
  "Information and Ideas": "💡",
  "Standard English Conventions": "📝",
};

const BankBrowse = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { subject } = useParams<{ subject: BankSubject }>();
  const validSubject = subject === "math" || subject === "reading" ? subject : "math";

  const isOfficial = location.pathname.startsWith("/official-bank");
  const bankSource = normalizeBankSource(searchParams.get("bankType"));
  const basePath = isOfficial ? "/official-bank" : "/bank";
  const bankQuerySuffix = isOfficial ? "" : `?bankType=${bankSource}`;

  useEffect(() => {
    const prefix = isOfficial ? "official" : "bank";
    sessionStorage.removeItem(`question-view-mode:${prefix}:math`);
    sessionStorage.removeItem(`question-view-mode:${prefix}:reading`);
  }, [isOfficial]);

  const isMath = validSubject === "math";
  const domains: string[] = isMath ? [...allMathDomains] : [...allEnglishDomains];
  const domainSkillMap: Record<string, string[]> = isMath
    ? Object.fromEntries(Object.entries(mathDomainSkills).map(([k, v]) => [k, [...v]]))
    : Object.fromEntries(Object.entries(englishDomainSkills).map(([k, v]) => [k, [...v]]));

  const domainCounts = isOfficial
    ? getDomainCountsOfficial(validSubject)
    : getDomainCountsNormal(validSubject, bankSource);
  const skillCounts = isOfficial
    ? getSkillCountsOfficial(validSubject)
    : getSkillCountsNormal(validSubject, bankSource);
  const totalQuestions = isOfficial
    ? getBankPoolOfficial(validSubject).length
    : getBankPoolNormal(validSubject, bankSource).length;

  const handleBankSourceChange = (nextSource: BankSourceFilter) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("bankType", nextSource);
    setSearchParams(nextParams);
  };

  const startPracticeSession = (questions: (BankQuestion | OfficialBankQuestion)[]) => {
    if (questions.length === 0) return;

    if (isOfficial) {
      const practiceSet = questions.map((q, index) => ({
        subject: (q as OfficialBankQuestion).category.subject === "Math" ? "math" : "reading",
        id: q.id,
        sourceId: q.sourceId,
        index: index + 1,
        isOfficial: true,
      }));
      sessionStorage.setItem('officialPracticeSet', JSON.stringify(practiceSet));
      sessionStorage.setItem('officialPracticeSetTotal', String(practiceSet.length));
      const first = practiceSet[0];
      navigate(`/official-bank/${first.subject}/${first.id}?practice=true&idx=1`);
    } else {
      const practiceSet = questions.map((q, index) => ({
        subject: (q as BankQuestion).subject,
        id: q.id,
        sourceId: q.sourceId,
        bankType: bankSource,
        storageId: (q as BankQuestion).stableId,
        index: index + 1,
      }));
      sessionStorage.setItem('practiceSet', JSON.stringify(practiceSet));
      sessionStorage.setItem('practiceSetTotal', String(practiceSet.length));
      const first = practiceSet[0];
      navigate(`/bank/${first.subject}/${first.id}?bankType=${first.bankType}&practice=true&idx=1`);
    }
  };

  const shuffleArray = <T,>(arr: T[]): T[] => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const handleShuffleDomain = (domain: string) => {
    const questions = isOfficial
      ? getQuestionsByDomainOfficial(validSubject, domain as MathDomain | EnglishDomain)
      : getQuestionsByDomainNormal(validSubject, domain as MathDomain | EnglishDomain, bankSource);
    startPracticeSession(shuffleArray(questions));
  };

  const handleShuffleSkill = (skill: string) => {
    const questions = isOfficial
      ? getQuestionsBySkillOfficial(validSubject, skill as MathSkill | EnglishSkill)
      : getQuestionsBySkillNormal(validSubject, skill as MathSkill | EnglishSkill, bankSource);
    startPracticeSession(shuffleArray(questions));
  };

  const handleShuffleAll = () => {
    const questions = isOfficial
      ? getBankPoolOfficial(validSubject)
      : getBankPoolNormal(validSubject, bankSource);
    startPracticeSession(shuffleArray(questions));
  };

  const handleSkillClick = (skill: string) => {
    const questions = isOfficial
      ? getQuestionsBySkillOfficial(validSubject, skill as MathSkill | EnglishSkill)
      : getQuestionsBySkillNormal(validSubject, skill as MathSkill | EnglishSkill, bankSource);
    if (questions.length > 0) {
      navigate(`${basePath}/${validSubject}/skill/${encodeURIComponent(skill)}${bankQuerySuffix}`);
    }
  };

  const handleDomainClick = (domain: string) => {
    navigate(`${basePath}/${validSubject}/domain/${encodeURIComponent(domain)}${bankQuerySuffix}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <section className="container mx-auto px-4 pt-8 pb-12">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(basePath)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isMath ? "bg-primary/10" : "bg-secondary/10"
              }`}>
                {isMath ? (
                  <Calculator className="h-5 w-5 text-primary" />
                ) : (
                  <FileText className="h-5 w-5 text-secondary" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold">
                  {isMath ? "Math" : "Reading & Writing"} Skills{isOfficial ? " (Official)" : ""}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {!isOfficial && `${BANK_SOURCE_LABELS[bankSource]} \u2022 `}{totalQuestions} questions across {domains.length} domains
                </p>
              </div>
            </div>
          </div>

          {/* Toggle between Math and Reading */}
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              variant={isMath ? "default" : "outline"}
              onClick={() => navigate(`${basePath}/math/browse${bankQuerySuffix}`)}
            >
              <Calculator className="h-4 w-4 mr-2" />
              Math
            </Button>
            <Button
              variant={!isMath ? "default" : "outline"}
              onClick={() => navigate(`${basePath}/reading/browse${bankQuerySuffix}`)}
            >
              <FileText className="h-4 w-4 mr-2" />
              Reading & Writing
            </Button>
            {!isOfficial && <BankSourceToggle value={bankSource} onChange={handleBankSourceChange} />}
          </div>

          {/* Domain Accordion */}
          <Accordion type="multiple" defaultValue={domains} className="space-y-3">
            {domains.map((domain) => {
              const skills = domainSkillMap[domain] || [];
              const domainCount = domainCounts[domain] || 0;
              const icon = domainIcons[domain] || "📚";

              return (
                <AccordionItem
                  key={domain}
                  value={domain}
                  className="overflow-hidden rounded-xl border bg-card px-0"
                >
                  <AccordionTrigger className="px-4 py-0 hover:no-underline">
                    <div className="flex min-h-[5rem] w-full items-center gap-3">
                      <span className="text-xl">{icon}</span>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{domain}</span>
                          <Badge variant="secondary" className="text-xs">
                            {domainCount} questions
                          </Badge>
                        </div>
                      </div>
                      <div className="mr-2 flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShuffleDomain(domain);
                          }}
                          title="Shuffle Domain"
                        >
                          <Shuffle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDomainClick(domain);
                          }}
                          className="text-xs"
                        >
                          Practice All
                          <ChevronRight className="ml-1 h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="grid gap-2 pl-8">
                      {skills.map((skill) => {
                        const count = skillCounts[skill] || 0;
                        return (
                          <Card
                            key={skill}
                            className="p-3 flex items-center justify-between hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => handleSkillClick(skill)}
                          >
                            <div className="flex items-center gap-2">
                              <Target className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{skill}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleShuffleSkill(skill);
                                }}
                                title="Shuffle Skill"
                              >
                                <Shuffle className="h-3 w-3" />
                              </Button>
                              <Badge variant="outline" className="text-xs">
                                {count}
                              </Badge>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {/* Quick Actions */}
          <Card className="p-4 bg-muted/30">
            <div className="flex items-center gap-3">
              <Layers className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Practice All {isMath ? "Math" : "Reading"}</p>
                <p className="text-xs text-muted-foreground">
                  Jump into all {totalQuestions} questions in order
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleShuffleAll}
                title="Shuffle All"
              >
                  <Shuffle className="h-4 w-4" />
              </Button>
              <Button onClick={() => navigate(`${basePath}/${validSubject}/1`)}>
                Start
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default BankBrowse;
