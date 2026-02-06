import { useNavigate, useParams } from "react-router-dom";
import {
  getBankPool,
  getDomainCounts,
  getSkillCounts,
  getQuestionsByDomain,
  getQuestionsBySkill,
  mathDomainSkills,
  englishDomainSkills,
  allMathDomains,
  allEnglishDomains,
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

const OfficialBankBrowse = () => {
  const navigate = useNavigate();
  const { subject } = useParams<{ subject: BankSubject }>();
  const validSubject = subject === "math" || subject === "reading" ? subject : "math";
  
  const isMath = validSubject === "math";
  const domains: string[] = isMath ? [...allMathDomains] : [...allEnglishDomains];
  const domainSkillMap: Record<string, string[]> = isMath 
    ? Object.fromEntries(Object.entries(mathDomainSkills).map(([k, v]) => [k, [...v]]))
    : Object.fromEntries(Object.entries(englishDomainSkills).map(([k, v]) => [k, [...v]]));
  
  const domainCounts = getDomainCounts(validSubject);
  const skillCounts = getSkillCounts(validSubject);
  const totalQuestions = getBankPool(validSubject).length;

  const startPracticeSession = (questions: BankQuestion[]) => {
    if (questions.length === 0) return;
    
    // Store the practice set with full info for navigation
    const practiceSet = questions.map((q, index) => ({
      subject: q.category.subject === "Math" ? "math" : "reading",
      id: q.id,
      sourceId: q.sourceId,
      index: index + 1, // 1-based index within practice set
      isOfficial: true,
    }));
    sessionStorage.setItem('officialPracticeSet', JSON.stringify(practiceSet));
    sessionStorage.setItem('officialPracticeSetTotal', String(practiceSet.length));
    
    // Navigate to the first question in practice mode
    const first = practiceSet[0];
    navigate(`/official-bank/${first.subject}/${first.id}?practice=true&idx=1`);
  };

  const handleShuffleDomain = (domain: string) => {
      let questions = getQuestionsByDomain(validSubject, domain as MathDomain | EnglishDomain);
      // Fisher-Yates shuffle
      const shuffled = [...questions];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      startPracticeSession(shuffled);
  };

  const handleShuffleSkill = (skill: string) => {
    let questions = getQuestionsBySkill(validSubject, skill as MathSkill | EnglishSkill);
      // Fisher-Yates shuffle
      const shuffled = [...questions];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      startPracticeSession(shuffled);
  };
    
  const handleShuffleAll = () => {
    let questions = getBankPool(validSubject);
      // Fisher-Yates shuffle
      const shuffled = [...questions];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      startPracticeSession(shuffled);
  };

  const handleSkillClick = (skill: string) => {
    // Find the first question with this skill
    const questions = getQuestionsBySkill(validSubject, skill as MathSkill | EnglishSkill);
    if (questions.length > 0) {
      // Navigate to the browse filtered view
      navigate(`/official-bank/${validSubject}/skill/${encodeURIComponent(skill)}`);
    }
  };

  const handleDomainClick = (domain: string) => {
    navigate(`/official-bank/${validSubject}/domain/${encodeURIComponent(domain)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <section className="container mx-auto px-4 pt-8 pb-12">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/official-bank")}>
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
                  {isMath ? "Math" : "Reading & Writing"} Skills (Official)
                </h1>
                <p className="text-sm text-muted-foreground">
                  {totalQuestions} questions across {domains.length} domains
                </p>
              </div>
            </div>
          </div>

          {/* Toggle between Math and Reading */}
          <div className="flex gap-2">
            <Button
              variant={isMath ? "default" : "outline"}
              onClick={() => navigate("/official-bank/math/browse")}
            >
              <Calculator className="h-4 w-4 mr-2" />
              Math
            </Button>
            <Button
              variant={!isMath ? "default" : "outline"}
              onClick={() => navigate("/official-bank/reading/browse")}
            >
              <FileText className="h-4 w-4 mr-2" />
              Reading & Writing
            </Button>
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
                  className="border rounded-lg bg-card px-4"
                >
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-xl">{icon}</span>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{domain}</span>
                          <Badge variant="secondary" className="text-xs">
                            {domainCount} questions
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 mr-1"
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
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
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
              <Button onClick={() => navigate(`/official-bank/${validSubject}/1`)}>
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

export default OfficialBankBrowse;
