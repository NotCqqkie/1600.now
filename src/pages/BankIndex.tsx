import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import {
  getBankPool as getBankPoolNormal,
  mathDomainSkills,
  englishDomainSkills,
  allMathDomains,
  allEnglishDomains,
  normalizeBankSource,
  BANK_SOURCE_LABELS,
  type BankQuestion,
  type BankSubject,
  type BankSourceFilter,
} from "@/data/questionBank";
import { activePastQuestionSourceIds } from "@/data/modulePracticeBank";
import {
  getBankPool as getBankPoolOfficial,
  type BankQuestion as OfficialBankQuestion,
} from "@/data/officialQuestionBank";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Calculator,
  FileText,
  ChevronRight,
  ChevronDown,
  Home,
  Play,
  Shuffle,
  RotateCcw,
} from "lucide-react";
import {
  QuestionBankFilterPanel,
  QuestionBankFilters,
  defaultFilters,
  hasActiveQuestionBankFilters,
  MAX_TIME_SPENT_FILTER_SECONDS,
} from "@/components/QuestionBankFilterPanel";
import { BankSourceToggle } from "@/components/BankSourceToggle";
import {
  getUserProgressStatic,
  isQuestionSolved,
  isQuestionAnsweredIncorrectly,
  QuestionProgress,
} from "@/hooks/useUserProgress";

// Topic selection state
interface TopicSelectionState {
  math: {
    selected: boolean;
    domains: Record<string, { selected: boolean; skills: Record<string, boolean> }>;
  };
  reading: {
    selected: boolean;
    domains: Record<string, { selected: boolean; skills: Record<string, boolean> }>;
  };
}

const createEmptySelection = (): TopicSelectionState => {
  const mathDomains: Record<string, { selected: boolean; skills: Record<string, boolean> }> = {};
  for (const domain of allMathDomains) {
    mathDomains[domain] = {
      selected: false,
      skills: Object.fromEntries(mathDomainSkills[domain].map(s => [s, false])),
    };
  }

  const readingDomains: Record<string, { selected: boolean; skills: Record<string, boolean> }> = {};
  for (const domain of allEnglishDomains) {
    readingDomains[domain] = {
      selected: false,
      skills: Object.fromEntries(englishDomainSkills[domain].map(s => [s, false])),
    };
  }

  return {
    math: { selected: false, domains: mathDomains },
    reading: { selected: false, domains: readingDomains },
  };
};

const topicCheckboxClass =
  "absolute left-0 top-0 h-5 w-5 rounded-md border border-sky-300/70 bg-white/90 text-sky-600 shadow-sm transition-all duration-200 data-[state=checked]:border-sky-400 data-[state=checked]:bg-sky-100 data-[state=checked]:text-sky-700 hover:border-sky-400 hover:bg-sky-50 focus-visible:ring-2 focus-visible:ring-sky-300/70 focus-visible:ring-offset-0 dark:border-slate-500 dark:bg-slate-900 dark:text-sky-200 dark:data-[state=checked]:border-sky-400 dark:data-[state=checked]:bg-slate-800 dark:data-[state=checked]:text-sky-100 dark:hover:border-sky-400 dark:hover:bg-slate-800 dark:shadow-[0_0_0_1px_rgba(148,163,184,0.08)]";

const topicCheckboxIndicatorClass =
  "h-full w-full";

const multiSelectModeCheckboxClass =
  "h-5 w-5 rounded-md border-sky-400/80 bg-white text-sky-700 shadow-sm data-[state=checked]:border-sky-500 data-[state=checked]:bg-sky-100 data-[state=checked]:text-sky-700 hover:border-sky-500 hover:bg-sky-50 focus-visible:ring-sky-300/70 dark:border-slate-500 dark:bg-slate-900 dark:text-sky-100 dark:data-[state=checked]:border-sky-400 dark:data-[state=checked]:bg-slate-800";

const TopicCheckboxSlot = ({
  visible,
  checked,
  onCheckedChange,
}: {
  visible: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) => (
  <div className="relative h-5 w-5 shrink-0">
    {visible && (
      <Checkbox
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(!!next)}
        onClick={(e) => e.stopPropagation()}
        className={topicCheckboxClass}
        indicatorClassName={topicCheckboxIndicatorClass}
        indicator={
          <span className="h-2.5 w-2.5 rounded-[4px] bg-current shadow-[0_0_0_1px_rgba(255,255,255,0.35)]" />
        }
      />
    )}
  </div>
);

const BankIndex = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isOfficial = location.pathname.startsWith("/official-bank");
  const bankSource = normalizeBankSource(searchParams.get("bankType"));
  const basePath = isOfficial ? "/official-bank" : "/bank";

  useEffect(() => {
    const prefix = isOfficial ? "official" : "bank";
    sessionStorage.removeItem(`question-view-mode:${prefix}:math`);
    sessionStorage.removeItem(`question-view-mode:${prefix}:reading`);
  }, [isOfficial]);
  
  // Selection Mode State
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState<QuestionBankFilters>(defaultFilters);
  
  // Topic selection state (inline checkboxes)
  const [topicSelection, setTopicSelection] = useState<TopicSelectionState>(createEmptySelection);
  // Initialize with all domains expanded by default
  const createDefaultExpandedDomains = () => {
    const expanded: Record<string, boolean> = {};
    for (const domain of allMathDomains) {
      expanded[domain] = true;
    }
    for (const domain of allEnglishDomains) {
      expanded[domain] = true;
    }
    return expanded;
  };
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>(createDefaultExpandedDomains);
  
  // Get all questions
  const allMathQuestions = useMemo(
    () => isOfficial ? getBankPoolOfficial("math") as unknown as BankQuestion[] : getBankPoolNormal("math", bankSource),
    [bankSource, isOfficial]
  );
  const allReadingQuestions = useMemo(
    () => isOfficial ? getBankPoolOfficial("reading") as unknown as BankQuestion[] : getBankPoolNormal("reading", bankSource),
    [bankSource, isOfficial]
  );

  // Get user progress for filtering
  const userProgress = useMemo(() => getUserProgressStatic(), []);

  // Helper to get progress for a question
  const getQuestionProgress = useCallback((q: BankQuestion, subject: BankSubject): QuestionProgress => {
    const key = isOfficial ? `official-bank-${subject}-${q.sourceId}` : q.stableId;
    return userProgress[key] || {
      questionId: key,
      isMarkedForReview: false,
      attempts: [],
      totalTimeSpentSeconds: 0,
    };
  }, [userProgress, isOfficial]);

  const handleBankSourceChange = useCallback((nextSource: BankSourceFilter) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("bankType", nextSource);
    setSearchParams(nextParams);
  }, [searchParams, setSearchParams]);

  const isQuestionActive = useCallback((q: BankQuestion): boolean => {
    if (q.bankType === "past") {
      return activePastQuestionSourceIds.has(q.sourceId);
    }

    return q.active === true;
  }, []);

  // Check if question passes filters
  const questionPassesFilters = useCallback((q: BankQuestion, subject: BankSubject): boolean => {
    const progress = getQuestionProgress(q, subject);

    if (filters.difficulty.length > 0) {
      const normalizedDifficulty = (q.difficulty ?? "").trim().toLowerCase();
      if (!filters.difficulty.includes(normalizedDifficulty as typeof filters.difficulty[number])) return false;
    }

    // Marked for review filter
    if (filters.markedForReview !== "all") {
      if (filters.markedForReview === "yes" && !progress.isMarkedForReview) return false;
      if (filters.markedForReview === "no" && progress.isMarkedForReview) return false;
    }

    // Solved filter
    if (filters.solved !== "all") {
      const solved = isQuestionSolved(progress);
      if (filters.solved === "yes" && !solved) return false;
      if (filters.solved === "no" && solved) return false;
    }

    // Answered incorrectly filter
    if (filters.answeredIncorrectly !== "all") {
      const incorrect = isQuestionAnsweredIncorrectly(progress);
      if (filters.answeredIncorrectly === "yes" && !incorrect) return false;
      if (filters.answeredIncorrectly === "no" && incorrect) return false;
    }

    // Time spent filter
    const [minTimeSpent, maxTimeSpent] = filters.timeSpentRange;
    if (progress.totalTimeSpentSeconds < minTimeSpent) return false;
    if (
      maxTimeSpent < MAX_TIME_SPENT_FILTER_SECONDS &&
      progress.totalTimeSpentSeconds > maxTimeSpent
    ) {
      return false;
    }

    if (filters.activeQuestions !== "all") {
      const isActive = isQuestionActive(q);
      if (filters.activeQuestions === "active" && !isActive) return false;
      if (filters.activeQuestions === "exclude-active" && isActive) return false;
    }

    return true;
  }, [filters, getQuestionProgress, isQuestionActive]);

  // Get filtered questions
  const getFilteredQuestions = useCallback((
    questions: BankQuestion[],
    subject: BankSubject
  ): BankQuestion[] => {
    return questions.filter(q => questionPassesFilters(q, subject));
  }, [questionPassesFilters]);

  // Calculate counts for each subject/domain/skill
  const questionCounts = useMemo(() => {
    const mathFiltered = getFilteredQuestions(allMathQuestions, "math");
    const readingFiltered = getFilteredQuestions(allReadingQuestions, "reading");

    const result = {
      math: {
        total: mathFiltered.length,
        correct: mathFiltered.filter(q => isQuestionSolved(getQuestionProgress(q, "math"))).length,
        domains: {} as Record<string, { total: number; correct: number }>,
        skills: {} as Record<string, { total: number; correct: number }>,
      },
      reading: {
        total: readingFiltered.length,
        correct: readingFiltered.filter(q => isQuestionSolved(getQuestionProgress(q, "reading"))).length,
        domains: {} as Record<string, { total: number; correct: number }>,
        skills: {} as Record<string, { total: number; correct: number }>,
      },
    };

    // Math domains and skills
    for (const domain of allMathDomains) {
      const domainQuestions = mathFiltered.filter(q => q.category.domain === domain);
      result.math.domains[domain] = {
        total: domainQuestions.length,
        correct: domainQuestions.filter(q => isQuestionSolved(getQuestionProgress(q, "math"))).length,
      };
      
      for (const skill of mathDomainSkills[domain]) {
        const skillQuestions = mathFiltered.filter(q => q.category.skill === skill);
        result.math.skills[skill] = {
          total: skillQuestions.length,
          correct: skillQuestions.filter(q => isQuestionSolved(getQuestionProgress(q, "math"))).length,
        };
      }
    }

    // Reading domains and skills
    for (const domain of allEnglishDomains) {
      const domainQuestions = readingFiltered.filter(q => q.category.domain === domain);
      result.reading.domains[domain] = {
        total: domainQuestions.length,
        correct: domainQuestions.filter(q => isQuestionSolved(getQuestionProgress(q, "reading"))).length,
      };
      
      for (const skill of englishDomainSkills[domain]) {
        const skillQuestions = readingFiltered.filter(q => q.category.skill === skill);
        result.reading.skills[skill] = {
          total: skillQuestions.length,
          correct: skillQuestions.filter(q => isQuestionSolved(getQuestionProgress(q, "reading"))).length,
        };
      }
    }

    return result;
  }, [allMathQuestions, allReadingQuestions, getFilteredQuestions, getQuestionProgress]);

  // Topic selection helpers
  const toggleSubject = useCallback((subject: "math" | "reading", checked: boolean) => {
    setTopicSelection(prev => {
      const domains = subject === "math" ? allMathDomains : allEnglishDomains;
      const skillsMap = subject === "math" ? mathDomainSkills : englishDomainSkills;
      
      const newDomains: Record<string, { selected: boolean; skills: Record<string, boolean> }> = {};
      for (const domain of domains) {
        newDomains[domain] = {
          selected: checked,
          skills: Object.fromEntries((skillsMap as any)[domain].map((s: string) => [s, checked])),
        };
      }
      
      return {
        ...prev,
        [subject]: { selected: checked, domains: newDomains },
      };
    });
  }, []);

  const toggleDomain = useCallback((subject: "math" | "reading", domain: string, checked: boolean) => {
    setTopicSelection(prev => {
      const skillsMap = subject === "math" ? mathDomainSkills : englishDomainSkills;
      const skills = (skillsMap as any)[domain] as string[];
      
      const newDomains = {
        ...prev[subject].domains,
        [domain]: {
          selected: checked,
          skills: Object.fromEntries(skills.map(s => [s, checked])),
        },
      };
      
      // Check if all domains are now selected
      const allDomains = subject === "math" ? allMathDomains : allEnglishDomains;
      const allSelected = allDomains.every(d => 
        d === domain ? checked : newDomains[d].selected
      );
      
      return {
        ...prev,
        [subject]: { selected: allSelected, domains: newDomains },
      };
    });
  }, []);

  const toggleSkill = useCallback((subject: "math" | "reading", domain: string, skill: string, checked: boolean) => {
    setTopicSelection(prev => {
      const skillsMap = subject === "math" ? mathDomainSkills : englishDomainSkills;
      const skills = (skillsMap as any)[domain] as string[];
      
      const newSkills = {
        ...prev[subject].domains[domain].skills,
        [skill]: checked,
      };
      
      // Check if all skills in domain are selected
      const allSkillsSelected = skills.every(s => s === skill ? checked : newSkills[s]);
      
      const newDomains = {
        ...prev[subject].domains,
        [domain]: {
          selected: allSkillsSelected,
          skills: newSkills,
        },
      };
      
      // Check if all domains are now selected
      const allDomains = subject === "math" ? allMathDomains : allEnglishDomains;
      const allDomainsSelected = allDomains.every(d => newDomains[d].selected);
      
      return {
        ...prev,
        [subject]: { selected: allDomainsSelected, domains: newDomains },
      };
    });
  }, []);

  // Count selected topics and get selected questions
  const selectedTopicsInfo = useMemo(() => {
    let count = 0;
    const selectedSkills: { subject: "math" | "reading"; skill: string }[] = [];
    
    // Math
    for (const domain of allMathDomains) {
      for (const skill of mathDomainSkills[domain]) {
        if (topicSelection.math.domains[domain]?.skills[skill]) {
          count++;
          selectedSkills.push({ subject: "math", skill });
        }
      }
    }
    
    // Reading
    for (const domain of allEnglishDomains) {
      for (const skill of englishDomainSkills[domain]) {
        if (topicSelection.reading.domains[domain]?.skills[skill]) {
          count++;
          selectedSkills.push({ subject: "reading", skill });
        }
      }
    }
    
    return { count, selectedSkills, totalSelected: count };
  }, [topicSelection]);

  // Get questions for practice set based on selection - grouped by skill, chronological within skill
  const selectedQuestions = useMemo((): BankQuestion[] => {
    // Group questions by skill, maintaining order within each skill
    const skillQuestionMap: Map<string, { subject: "math" | "reading"; questions: BankQuestion[] }> = new Map();
    
    for (const { subject, skill } of selectedTopicsInfo.selectedSkills) {
      const pool = subject === "math" ? allMathQuestions : allReadingQuestions;
      const filtered = getFilteredQuestions(pool, subject).filter(q => q.category.skill === skill);
      // Questions are already in order by their id/questionNumber within the pool
      const key = `${subject}-${skill}`;
      skillQuestionMap.set(key, { subject, questions: filtered });
    }
    
    // Get all skills as array
    const skillEntries = Array.from(skillQuestionMap.entries());
    
    // Use a simple seeded shuffle based on the number of selected skills for consistency
    // This gives consistent ordering for the same selection
    const seed = selectedTopicsInfo.selectedSkills.length;
    const shuffled = [...skillEntries].sort((a, b) => {
      // Create a deterministic but shuffled order based on skill names
      const hashA = a[0].split('').reduce((acc, char) => acc + char.charCodeAt(0), seed);
      const hashB = b[0].split('').reduce((acc, char) => acc + char.charCodeAt(0), seed);
      return hashA - hashB;
    });
    
    // Flatten: for each skill, add its questions in order
    const result: BankQuestion[] = [];
    for (const [, { questions }] of shuffled) {
      result.push(...questions);
    }
    
    return result;
  }, [selectedTopicsInfo.selectedSkills, allMathQuestions, allReadingQuestions, getFilteredQuestions]);

  const getSelectedQuestions = useCallback((
    // Optional overrides for quick start mode
    subjectOverride?: "math" | "reading",
    domainOverride?: string,
    skillOverride?: string
  ): BankQuestion[] => {
    // If overrides are provided, use them to generate selection
    if (subjectOverride) {
      const questions = subjectOverride === "math" ? allMathQuestions : allReadingQuestions;
      let filtered = getFilteredQuestions(questions, subjectOverride);

      if (skillOverride) {
        filtered = filtered.filter(q => q.category.skill === skillOverride);
      } else if (domainOverride) {
        filtered = filtered.filter(q => q.category.domain === domainOverride);
      }
      return filtered;
    }

    // Otherwise use selection state
    return selectedQuestions;
  }, [selectedQuestions, allMathQuestions, allReadingQuestions, getFilteredQuestions]);

  // Handle create practice set with optional direct params
  const startPracticeSession = useCallback((questions: BankQuestion[]) => {
    if (questions.length === 0) return;

    if (isOfficial) {
      const practiceSet = questions.map((q, index) => ({
        subject: (q as unknown as OfficialBankQuestion).category.subject === "Math" ? "math" : "reading",
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
        subject: q.subject,
        id: q.id,
        sourceId: q.sourceId,
        bankType: bankSource,
        storageId: q.stableId,
        index: index + 1,
      }));
      sessionStorage.removeItem('practiceExitTo');
      sessionStorage.setItem('practiceSet', JSON.stringify(practiceSet));
      sessionStorage.setItem('practiceSetTotal', String(practiceSet.length));
      const first = practiceSet[0];
      navigate(`/bank/${first.subject}/${first.id}?bankType=${first.bankType}&practice=true&idx=1`);
    }
  }, [bankSource, navigate, isOfficial]);

  const handleCreatePracticeSet = useCallback((shuffle: boolean = false) => {
    let questions = getSelectedQuestions();

    if (shuffle) {
      // Fisher-Yates shuffle
      const shuffled = [...questions];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      questions = shuffled;
    }

    startPracticeSession(questions);
  }, [startPracticeSession, getSelectedQuestions]);
  
  const handleQuickStart = useCallback((subject: "math" | "reading", domain?: string, skill?: string, shuffle: boolean = false) => {
    let questions = getSelectedQuestions(subject, domain, skill);

    if (shuffle) {
      // Fisher-Yates shuffle
      const shuffled = [...questions];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      questions = shuffled;
    }

    startPracticeSession(questions);
  }, [startPracticeSession, getSelectedQuestions]);

  // Handle create practice set





  // Render browse view with topics and inline checkboxes
  const renderBrowseView = () => (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Math Section */}
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div 
            className={`flex items-center gap-3 flex-1 ${isMultiSelect ? 'cursor-pointer' : ''}`}
            onClick={() => {
              if (isMultiSelect) {
                toggleSubject("math", !topicSelection.math.selected);
              }
            }}
          >
            <TopicCheckboxSlot
              visible={isMultiSelect}
              checked={topicSelection.math.selected}
              onCheckedChange={(checked) => toggleSubject("math", checked)}
            />
            <div className="p-2 rounded-lg bg-primary/10">
              <Calculator className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Math</h3>
              <p className="text-sm text-muted-foreground">
                <span className="text-green-600 font-medium">{questionCounts.math.correct}</span>
                <span className="mx-1">/</span>
                <span>{questionCounts.math.total} questions</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              onClick={() => handleQuickStart("math")}
              className="gap-1"
            >
              <Play className="h-4 w-4" />
              Start All
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => handleQuickStart("math", undefined, undefined, true)}
              title="Shuffle Math Questions"
            >
              <Shuffle className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {allMathDomains.map((domain) => (
            <div key={domain} className="px-1 py-1">
              <div className="flex items-center gap-2 group/domain-row px-2 py-1.5 -mx-2 rounded hover:bg-muted transition-colors">
                <TopicCheckboxSlot
                  visible={isMultiSelect}
                  checked={topicSelection.math.domains[domain]?.selected || false}
                  onCheckedChange={(checked) => toggleDomain("math", domain, checked)}
                />
                <div className="flex items-center justify-between flex-1">
                  <span 
                    className="font-medium flex-1 py-1 cursor-pointer"
                    onClick={() => {
                      if (isMultiSelect) {
                        toggleDomain("math", domain, !topicSelection.math.domains[domain]?.selected);
                      } else {
                        handleQuickStart("math", domain);
                      }
                    }}
                  >
                    {domain}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 mr-1 opacity-0 group-hover/domain-row:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickStart("math", domain, undefined, true);
                    }}
                    title="Shuffle Domain"
                  >
                    <Shuffle className="h-3 w-3" />
                  </Button>
                  <div
                    className="flex items-center gap-2 cursor-pointer p-1 rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedDomains(prev => ({ ...prev, [domain]: !prev[domain] }));
                    }}
                  >
                    <span className="text-sm text-muted-foreground">
                      <span className="text-green-600">{questionCounts.math.domains[domain]?.correct || 0}</span>
                      /{questionCounts.math.domains[domain]?.total || 0}
                    </span>
                    {expandedDomains[domain] ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>
              {expandedDomains[domain] && (
                <div className="mt-2 ml-6 space-y-1">
                  {mathDomainSkills[domain].map((skill) => (
                    <div
                      key={skill}
                      className="flex items-center gap-2 py-1.5 px-2 text-sm hover:bg-muted rounded group/skill cursor-pointer"
                      onClick={() => {
                        if (isMultiSelect) {
                          toggleSkill("math", domain, skill, !topicSelection.math.domains[domain]?.skills[skill]);
                        } else {
                          handleQuickStart("math", domain, skill);
                        }
                      }}
                    >
                      <TopicCheckboxSlot
                        visible={isMultiSelect}
                        checked={topicSelection.math.domains[domain]?.skills[skill] || false}
                        onCheckedChange={(checked) => toggleSkill("math", domain, skill, checked)}
                      />
                      <span className="text-foreground truncate flex-1 mr-2">
                        {skill}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 opacity-0 group-hover/skill:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickStart("math", domain, skill, true);
                        }}
                        title="Shuffle Skill"
                      >
                        <Shuffle className="h-3 w-3" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        <span className="text-green-600">{questionCounts.math.skills[skill]?.correct || 0}</span>
                        /{questionCounts.math.skills[skill]?.total || 0}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Reading Section */}
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div 
            className={`flex items-center gap-3 flex-1 ${isMultiSelect ? 'cursor-pointer' : ''}`}
            onClick={() => {
              if (isMultiSelect) {
                toggleSubject("reading", !topicSelection.reading.selected);
              }
            }}
          >
            <TopicCheckboxSlot
              visible={isMultiSelect}
              checked={topicSelection.reading.selected}
              onCheckedChange={(checked) => toggleSubject("reading", checked)}
            />
            <div className="p-2 rounded-lg bg-secondary/10">
              <FileText className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Reading & Writing</h3>
              <p className="text-sm text-muted-foreground">
                <span className="text-green-600 font-medium">{questionCounts.reading.correct}</span>
                <span className="mx-1">/</span>
                <span>{questionCounts.reading.total} questions</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              onClick={() => handleQuickStart("reading")}
              className="gap-1"
            >
              <Play className="h-4 w-4" />
              Start All
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => handleQuickStart("reading", undefined, undefined, true)}
              title="Shuffle Reading Questions"
            >
              <Shuffle className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {allEnglishDomains.map((domain) => (
            <div key={domain} className="px-1 py-1">
              <div className="flex items-center gap-2 group/domain-row px-2 py-1.5 -mx-2 rounded hover:bg-muted transition-colors">
                <TopicCheckboxSlot
                  visible={isMultiSelect}
                  checked={topicSelection.reading.domains[domain]?.selected || false}
                  onCheckedChange={(checked) => toggleDomain("reading", domain, checked)}
                />
                <div className="flex items-center justify-between flex-1">
                  <span 
                    className="font-medium flex-1 py-1 cursor-pointer"
                    onClick={() => {
                      if (isMultiSelect) {
                        toggleDomain("reading", domain, !topicSelection.reading.domains[domain]?.selected);
                      } else {
                        handleQuickStart("reading", domain);
                      }
                    }}
                  >
                    {domain}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 mr-1 opacity-0 group-hover/domain-row:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickStart("reading", domain, undefined, true);
                    }}
                    title="Shuffle Domain"
                  >
                    <Shuffle className="h-3 w-3" />
                  </Button>
                  <div
                    className="flex items-center gap-2 cursor-pointer p-1 rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedDomains(prev => ({ ...prev, [domain]: !prev[domain] }));
                    }}
                  >
                    <span className="text-sm text-muted-foreground">
                      <span className="text-green-600">{questionCounts.reading.domains[domain]?.correct || 0}</span>
                      /{questionCounts.reading.domains[domain]?.total || 0}
                    </span>
                    {expandedDomains[domain] ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>
              {expandedDomains[domain] && (
                <div className="mt-2 ml-6 space-y-1">
                  {englishDomainSkills[domain].map((skill) => (
                    <div
                      key={skill}
                      className="flex items-center gap-2 py-1.5 px-2 text-sm hover:bg-muted rounded group/skill cursor-pointer"
                      onClick={() => {
                        if (isMultiSelect) {
                          toggleSkill("reading", domain, skill, !topicSelection.reading.domains[domain]?.skills[skill]);
                        } else {
                          handleQuickStart("reading", domain, skill);
                        }
                      }}
                    >
                      <TopicCheckboxSlot
                        visible={isMultiSelect}
                        checked={topicSelection.reading.domains[domain]?.skills[skill] || false}
                        onCheckedChange={(checked) => toggleSkill("reading", domain, skill, checked)}
                      />
                      <span className="text-foreground truncate flex-1 mr-2">
                        {skill}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 opacity-0 group-hover/skill:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickStart("reading", domain, skill, true);
                        }}
                        title="Shuffle Skill"
                      >
                       <Shuffle className="h-3 w-3" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        <span className="text-green-600">{questionCounts.reading.skills[skill]?.correct || 0}</span>
                        /{questionCounts.reading.skills[skill]?.total || 0}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );



  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <section className="container mx-auto px-4 pt-8 pb-12">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            {isOfficial && (
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <Home className="h-5 w-5" />
              </Button>
            )}
            <div>
              <h1
                style={{
                  fontFamily: "'Instrument Serif', Georgia, serif",
                  fontSize: "clamp(26px, 3.5vw, 36px)",
                  fontWeight: 400,
                  letterSpacing: "-0.02em",
                  color: "hsl(var(--foreground))",
                  marginBottom: 4,
                }}
              >
                {isOfficial ? "Official Question Bank" : "Question Bank"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {!isOfficial && `${BANK_SOURCE_LABELS[bankSource]} \u00b7 `}{questionCounts.math.total + questionCounts.reading.total} questions available
              </p>
            </div>
          </div>

          {/* Filter Panel */}
          <QuestionBankFilterPanel
            filters={filters}
            onFiltersChange={setFilters}
            showActivityFilter={!isOfficial}
            rightContent={
              <div className="flex items-center gap-4">
                {!isOfficial && <BankSourceToggle value={bankSource} onChange={handleBankSourceChange} />}
                {hasActiveQuestionBankFilters(filters) && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setFilters(defaultFilters)}
                    className="gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset Filters
                  </Button>
                )}
                <div className="flex items-center space-x-2 border-l pl-4">
                  <Checkbox
                    id="multi-select-mode"
                    checked={isMultiSelect}
                    onCheckedChange={(checked) => setIsMultiSelect(!!checked)}
                    className={multiSelectModeCheckboxClass}
                  />
                  <Label htmlFor="multi-select-mode">Select multiple topics</Label>
                </div>
              </div>
            }
          />

          {/* Main Content */}
          {renderBrowseView()}
        </div>
      </section>

      {/* Create Practice Set Button - Fixed at bottom right */}
      {selectedTopicsInfo.totalSelected > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex gap-2">
          <Button 
            size="icon" 
            variant="secondary"
            onClick={() => handleCreatePracticeSet(true)}
            className="shadow-lg h-12 w-12 rounded-full"
            title="Create Shuffled Practice Set"
          >
            <Shuffle className="h-5 w-5" />
          </Button>
          <Button 
            size="lg" 
            onClick={() => handleCreatePracticeSet(false)}
            className="shadow-lg gap-2"
          >
            <Play className="h-4 w-4" />
            Create Practice Set ({selectedQuestions.length} questions)
          </Button>
        </div>
      )}
    </div>
  );
};

export default BankIndex;
