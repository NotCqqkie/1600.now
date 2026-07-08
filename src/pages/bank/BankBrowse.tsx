import { useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  mathDomainSkills,
  englishDomainSkills,
  allMathDomains,
  allEnglishDomains,
  normalizeBankSource,
  BANK_SOURCE_LABELS,
  type BankSubject,
  type BankSourceFilter,
  type MathDomain,
  type EnglishDomain,
  type MathSkill,
  type EnglishSkill,
} from "@/data/questionBank";
import { getDefaultQuestionCountTree, getEmptyProgress } from "@/data/bankQuestionMetadata";
import {
  bankPracticeDupFingerprint,
  loadFilteredBankPracticeRefs,
  type BankPracticeQuestionRef,
} from "@/lib/practice/bankPracticeRefs";
import { createDefaultQuestionBankFilters } from "@/lib/questionBankFilters";
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
import { BankSourceToggle } from "@/components/question/BankSourceToggle";
import { spaceOutNearDuplicates } from "@/lib/text/nearDuplicateSpacing";
import { PageSeo, buildBreadcrumbJsonLd } from "@/components/seo/PageSeo";
import {
  buildPracticeRunId,
  PRACTICE_EXIT_TO_STORAGE_KEY,
  PRACTICE_RUN_STORAGE_KEY,
  PRACTICE_SET_STORAGE_KEY,
  PRACTICE_SET_TOTAL_STORAGE_KEY,
} from "@/lib/practice/practiceRunStorage";
import { buildPracticeBankQuestionRoute } from "@/lib/practice/practiceBankRoutes";
import { clearBankQuestionViewModeStorage } from "@/lib/questionViewModeStorage";

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

const countTotal = (count: number | { total: number } | undefined): number =>
  typeof count === "number" ? count : count?.total ?? 0;

type BankBrowseDomain = MathDomain | EnglishDomain;
type BankBrowseSkill = MathSkill | EnglishSkill;
type BankBrowsePracticeSetItem = Readonly<{
  subject: BankSubject;
  id: number;
  sourceId: string;
  bankType: BankSourceFilter;
  storageId: string;
  index: number;
}>;

const BankBrowse = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { subject } = useParams<{ subject: BankSubject }>();
  const validSubject = subject === "math" || subject === "reading" ? subject : "math";

  const bankSource = normalizeBankSource(searchParams.get("bankType"));
  const basePath = "/bank";
  const bankQuerySuffix = `?bankType=${bankSource}`;

  useEffect(() => {
    clearBankQuestionViewModeStorage();
  }, []);

  const isMath = validSubject === "math";
  const domains: BankBrowseDomain[] = isMath ? [...allMathDomains] : [...allEnglishDomains];
  const domainSkillMap: Partial<Record<BankBrowseDomain, BankBrowseSkill[]>> = isMath
    ? Object.fromEntries(Object.entries(mathDomainSkills).map(([k, v]) => [k, [...v]]))
    : Object.fromEntries(Object.entries(englishDomainSkills).map(([k, v]) => [k, [...v]]));

  const questionCounts = useMemo(
    () => getDefaultQuestionCountTree(bankSource)[validSubject],
    [bankSource, validSubject],
  );
  const domainCounts = questionCounts.domains;
  const skillCounts = questionCounts.skills;
  const totalQuestions = questionCounts.total;

  const handleBankSourceChange = (nextSource: BankSourceFilter): void => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("bankType", nextSource);
    setSearchParams(nextParams);
  };

  const startPracticeSession = (questions: BankPracticeQuestionRef[]): void => {
    if (questions.length === 0) return;

    const spacedQuestions = spaceOutNearDuplicates(questions, bankPracticeDupFingerprint);

    const practiceSet: BankBrowsePracticeSetItem[] = spacedQuestions.map((q, index) => ({
      subject: q.subject,
      id: q.id,
      sourceId: q.sourceId,
      bankType: bankSource,
      storageId: q.stableId,
      index: index + 1,
    }));
    sessionStorage.removeItem(PRACTICE_EXIT_TO_STORAGE_KEY);
    sessionStorage.setItem(PRACTICE_SET_STORAGE_KEY, JSON.stringify(practiceSet));
    sessionStorage.setItem(PRACTICE_SET_TOTAL_STORAGE_KEY, String(practiceSet.length));
    sessionStorage.setItem(PRACTICE_RUN_STORAGE_KEY, buildPracticeRunId(validSubject));
    const first = practiceSet[0];
    navigate(buildPracticeBankQuestionRoute({
      subject: first.subject,
      sourceId: first.sourceId,
      bankType: first.bankType,
      idx: 1,
    }));
  };

  const shuffleArray = (arr: BankPracticeQuestionRef[]): BankPracticeQuestionRef[] => {
    const shuffled = [...arr];
    for (let currentIndex = shuffled.length - 1; currentIndex > 0; currentIndex--) {
      const randomIndex = Math.floor(Math.random() * (currentIndex + 1));
      [shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
    }
    return spaceOutNearDuplicates(shuffled, bankPracticeDupFingerprint);
  };

  const startShuffledPracticeSession = (questions: BankPracticeQuestionRef[]): void => {
    startPracticeSession(shuffleArray(questions));
  };

  const loadPracticeRefs = (options: { domain?: string; skill?: string } = {}) =>
    loadFilteredBankPracticeRefs(
      validSubject,
      bankSource,
      createDefaultQuestionBankFilters(),
      getEmptyProgress,
      options,
    );

  const handleShuffleDomain = async (domain: BankBrowseDomain): Promise<void> => {
    startShuffledPracticeSession(await loadPracticeRefs({ domain }));
  };

  const handleShuffleSkill = async (skill: BankBrowseSkill): Promise<void> => {
    startShuffledPracticeSession(await loadPracticeRefs({ skill }));
  };

  const handleShuffleAll = async (): Promise<void> => {
    startShuffledPracticeSession(await loadPracticeRefs());
  };

  const handleSkillClick = (skill: BankBrowseSkill): void => {
    if (countTotal(skillCounts[skill]) > 0) {
      navigate(`${basePath}/${validSubject}/skill/${encodeURIComponent(skill)}${bankQuerySuffix}`);
    }
  };

  const handleDomainClick = (domain: BankBrowseDomain): void => {
    navigate(`${basePath}/${validSubject}/domain/${encodeURIComponent(domain)}${bankQuerySuffix}`);
  };

  const subjectLabel = isMath ? "Math" : "Reading and Writing";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <PageSeo
        id={`bank-browse-${validSubject}`}
        jsonLd={buildBreadcrumbJsonLd([
          { name: "Home", url: "https://1600.now/" },
          { name: "SAT Question Bank", url: "https://1600.now/bank" },
          {
            name: `${subjectLabel} Skills`,
            url: `https://1600.now/bank/${validSubject}/browse`,
          },
        ])}
      />
      <section className="container mx-auto px-4 pt-8 pb-12">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => navigate(basePath)}>
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
                  {isMath ? "Math" : "Reading & Writing"} Skills
                </h1>
                <p className="text-sm text-muted-foreground">
                  {`${BANK_SOURCE_LABELS[bankSource]} \u2022 `}{totalQuestions} questions across {domains.length} domains
                </p>
              </div>
            </div>
          </div>

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
            <BankSourceToggle value={bankSource} onChange={handleBankSourceChange} />
          </div>

          <Accordion type="multiple" defaultValue={domains} className="space-y-3">
            {domains.map((domain) => {
              const skills = domainSkillMap[domain] || [];
              const domainCount = countTotal(domainCounts[domain]);
              const icon = domainIcons[domain] || "📚";

              return (
                <AccordionItem
                  key={domain}
                  value={domain}
                  className="relative overflow-hidden rounded-xl border bg-card px-0"
                >
                  <AccordionTrigger className="px-4 py-0 pr-10 hover:no-underline sm:pr-48">
                    <div className="flex min-h-[5rem] w-full min-w-0 items-center gap-3 py-3">
                      <span className="shrink-0 text-xl">{icon}</span>
                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="min-w-0 break-words font-semibold">{domain}</span>
                          <Badge variant="secondary" className="text-xs">
                            {domainCount} questions
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <div className="flex items-center gap-2 border-t border-border/60 px-4 py-3 sm:absolute sm:right-12 sm:top-10 sm:z-10 sm:-translate-y-1/2 sm:border-t-0 sm:p-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 sm:h-8 sm:w-8"
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
                      className="h-10 flex-1 text-xs sm:h-9 sm:flex-none"
                    >
                      Practice All
                      <ChevronRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                  <AccordionContent className="pb-4">
                    <div className="grid gap-2 px-3 sm:pl-8 sm:pr-4">
                      {skills.map((skill) => {
                        const count = countTotal(skillCounts[skill]);
                        return (
                          <Card
                            key={skill}
                            className="flex min-w-0 cursor-pointer items-center justify-between gap-3 p-3 transition-colors hover:bg-muted/50"
                            onClick={() => handleSkillClick(skill)}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <Target className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="min-w-0 break-words text-sm">{skill}</span>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 sm:h-7 sm:w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleShuffleSkill(skill);
                                }}
                                title="Shuffle Skill"
                              >
                                <Shuffle className="h-3.5 w-3.5" />
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

          <Card className="p-4 bg-muted/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Layers className="h-5 w-5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Practice All {isMath ? "Math" : "Reading"}</p>
                <p className="text-xs text-muted-foreground">
                  Jump into all {totalQuestions} questions in order
                </p>
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleShuffleAll}
                  title="Shuffle All"
                  className="h-11 w-11 shrink-0"
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
                <Button className="flex-1 sm:flex-none" onClick={() => navigate(`${basePath}/${validSubject}/1${bankQuerySuffix}`)}>
                  Start
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default BankBrowse;
