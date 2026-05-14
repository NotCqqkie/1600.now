import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Calculator,
  FileText,
  ChevronRight,
  ChevronDown,
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
} from "@/components/question/QuestionBankFilterPanel";
import { BankSourceToggle } from "@/components/question/BankSourceToggle";
import { spaceOutNearDuplicates, questionFingerprint } from "@/lib/text/nearDuplicateSpacing";
import {
  useUserProgress,
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

const multiSelectModeCheckboxClass =
  "h-5 w-5 rounded-[5px] border-2 border-primary/45 bg-primary/5 text-primary shadow-sm transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground hover:border-primary/70 hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-primary/55 dark:bg-primary/10 dark:data-[state=checked]:border-primary dark:data-[state=checked]:bg-primary";

const topicCheckboxClass =
  `absolute left-0 top-0 ${multiSelectModeCheckboxClass}`;

const getTopicSkills = (subject: "math" | "reading", domain: string): string[] =>
  subject === "math"
    ? mathDomainSkills[domain as keyof typeof mathDomainSkills]
    : englishDomainSkills[domain as keyof typeof englishDomainSkills];

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
      />
    )}
  </div>
);

const BankIndex = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const bankSource = normalizeBankSource(searchParams.get("bankType"));
  const basePath = "/bank";

  useEffect(() => {
    sessionStorage.removeItem(`question-view-mode:bank:math`);
    sessionStorage.removeItem(`question-view-mode:bank:reading`);
  }, []);
  
  // Selection Mode State
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  
  // Filter state — may be pre-populated from home page via sessionStorage
  const [filters, setFilters] = useState<QuestionBankFilters>(() => {
    try {
      const raw = sessionStorage.getItem("bankFilterPreset");
      if (!raw) return defaultFilters;
      const preset = JSON.parse(raw) as { difficulties?: string[] };
      if (preset.difficulties?.length) {
        return { ...defaultFilters, difficulty: preset.difficulties as QuestionBankFilters["difficulty"] };
      }
    } catch { /* ignore */ }
    return defaultFilters;
  });

  // Topic selection state (inline checkboxes) — may be pre-populated from home page
  const [topicSelection, setTopicSelection] = useState<TopicSelectionState>(() => {
    const base = createEmptySelection();
    try {
      const raw = sessionStorage.getItem("bankFilterPreset");
      if (!raw) return base;
      sessionStorage.removeItem("bankFilterPreset");
      const preset = JSON.parse(raw) as {
        skills?: { bankSkill: string; bankDomain: string; subject: string }[];
      };
      if (!preset.skills?.length) return base;
      for (const { bankSkill, bankDomain, subject } of preset.skills) {
        const subj = subject as "math" | "reading";
        if (!base[subj]?.domains[bankDomain]) continue;
        base[subj].domains[bankDomain].skills[bankSkill] = true;
        // Mark domain selected if any skill is selected
        base[subj].domains[bankDomain].selected = true;
      }
    } catch { /* ignore */ }
    return base;
  });
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
    () => getBankPoolNormal("math", bankSource),
    [bankSource]
  );
  const allReadingQuestions = useMemo(
    () => getBankPoolNormal("reading", bankSource),
    [bankSource]
  );

  // Get user progress for filtering — scoped to the active user via the hook.
  const { progress: userProgress } = useUserProgress();

  // Helper to get progress for a question
  const getQuestionProgress = useCallback((q: BankQuestion, _subject: BankSubject): QuestionProgress => {
    const key = q.stableId;
    return userProgress[key] || {
      questionId: key,
      isMarkedForReview: false,
      attempts: [],
      totalTimeSpentSeconds: 0,
    };
  }, [userProgress]);

  const handleBankSourceChange = useCallback((nextSource: BankSourceFilter) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("bankType", nextSource);
    setSearchParams(nextParams);
  }, [searchParams, setSearchParams]);

  const isQuestionActive = useCallback((q: BankQuestion): boolean => {
    return q.inPracticeTests === true || activePastQuestionSourceIds.has(q.sourceId);
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
      const newDomains: Record<string, { selected: boolean; skills: Record<string, boolean> }> = {};
      for (const domain of domains) {
        newDomains[domain] = {
          selected: checked,
          skills: Object.fromEntries(getTopicSkills(subject, domain).map((s) => [s, checked])),
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
      const skills = getTopicSkills(subject, domain);
      
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
      const skills = getTopicSkills(subject, domain);
      
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

    questions = spaceOutNearDuplicates(questions, questionFingerprint);

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
  }, [bankSource, navigate]);

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
    questions = spaceOutNearDuplicates(questions, questionFingerprint);

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
    questions = spaceOutNearDuplicates(questions, questionFingerprint);

    startPracticeSession(questions);
  }, [startPracticeSession, getSelectedQuestions]);

  // Handle create practice set





  // Render browse view with topics and inline checkboxes
  const renderBrowseView = () => (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Math Section */}
      <div className="min-w-0 p-3 sm:p-6 md:order-2">
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
            <div className="p-2 rounded-lg bg-ds-accent/30">
              <Calculator className="h-6 w-6 text-ink" />
            </div>
            <div>
              {/* Column title — Inter Tight 600, 22px, tracking -1.5%. */}
              <h3 className="font-display text-[22px] font-semibold leading-[1.1] tracking-[-0.015em] text-ink">Math</h3>
              {/* Column count — tabular nums, 12px. Completed weight 600 good; rest weight 500 muted. */}
              <p className="font-display text-[12px] leading-[1.3] tabular-nums">
                <span className="font-semibold text-good">{questionCounts.math.correct.toLocaleString()}</span>
                <span className="mx-1 font-medium text-ink-muted">/</span>
                <span className="font-medium text-ink-muted">{questionCounts.math.total.toLocaleString()} questions</span>
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
                    className="font-display text-[17px] font-semibold leading-[1.3] tracking-[-0.01em] text-ink flex-1 py-1 cursor-pointer"
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
                    {/* Domain count — tabular nums, 14px. Completed weight 600 good; total weight 500 muted. */}
                    <span className="font-display text-[14px] tabular-nums">
                      <span className="font-semibold text-good">{(questionCounts.math.domains[domain]?.correct || 0).toLocaleString()}</span>
                      <span className="font-medium text-ink-muted">/{(questionCounts.math.domains[domain]?.total || 0).toLocaleString()}</span>
                    </span>
                    {expandedDomains[domain] ? (
                      <ChevronDown className="h-[11px] w-[11px] text-ink-muted" />
                    ) : (
                      <ChevronRight className="h-[11px] w-[11px] text-ink-muted" />
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
                      {/* Skill name — Inter 400, 13px, ink-mid. Light weight so eye scans counts on the right. */}
                      <span className="font-sans text-[13px] font-normal leading-[1.4] tracking-[-0.005em] text-ink-mid truncate flex-1 mr-2">
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
                      {/* Skill count — tabular nums, 13px. Right-aligned, numerators align via tnum. */}
                      <span className="font-display text-[13px] tabular-nums">
                        <span className="font-semibold text-good">{(questionCounts.math.skills[skill]?.correct || 0).toLocaleString()}</span>
                        <span className="font-medium text-ink-muted">/{(questionCounts.math.skills[skill]?.total || 0).toLocaleString()}</span>
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
      <div className="min-w-0 p-3 sm:p-6 md:order-1">
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
            <div className="p-2 rounded-lg bg-ds-accent/30">
              <FileText className="h-6 w-6 text-ink" />
            </div>
            <div>
              <h3 className="font-display text-[22px] font-semibold leading-[1.1] tracking-[-0.015em] text-ink">Reading & Writing</h3>
              <p className="font-display text-[12px] leading-[1.3] tabular-nums">
                <span className="font-semibold text-good">{questionCounts.reading.correct.toLocaleString()}</span>
                <span className="mx-1 font-medium text-ink-muted">/</span>
                <span className="font-medium text-ink-muted">{questionCounts.reading.total.toLocaleString()} questions</span>
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
                    className="font-display text-[17px] font-semibold leading-[1.3] tracking-[-0.01em] text-ink flex-1 py-1 cursor-pointer"
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
                    <span className="font-display text-[14px] tabular-nums">
                      <span className="font-semibold text-good">{(questionCounts.reading.domains[domain]?.correct || 0).toLocaleString()}</span>
                      <span className="font-medium text-ink-muted">/{(questionCounts.reading.domains[domain]?.total || 0).toLocaleString()}</span>
                    </span>
                    {expandedDomains[domain] ? (
                      <ChevronDown className="h-[11px] w-[11px] text-ink-muted" />
                    ) : (
                      <ChevronRight className="h-[11px] w-[11px] text-ink-muted" />
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
                      <span className="font-sans text-[13px] font-normal leading-[1.4] tracking-[-0.005em] text-ink-mid truncate flex-1 mr-2">
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
                      <span className="font-display text-[13px] tabular-nums">
                        <span className="font-semibold text-good">{(questionCounts.reading.skills[skill]?.correct || 0).toLocaleString()}</span>
                        <span className="font-medium text-ink-muted">/{(questionCounts.reading.skills[skill]?.total || 0).toLocaleString()}</span>
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
            <div>
              {/* Page title \u2014 Inter Tight 600, 42px, tracking -3%. */}
              <h1
                style={{
                  fontFamily: "'Inter Tight', sans-serif",
                  fontSize: "clamp(32px, 3.8vw, 42px)",
                  fontWeight: 600,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                  color: "rgb(var(--ink))",
                  marginBottom: 8,
                }}
              >
                Question Bank
              </h1>
              {/* Subtitle \u2014 Inter 400, 14px, ink-mid. The count wraps in Inter Tight 600 + tnum. */}
              <p className="font-sans text-[14px] leading-[1.5] text-ink-mid">
                {`${BANK_SOURCE_LABELS[bankSource]} \u00b7 `}
                <span className="font-display font-semibold tabular-nums text-ink">
                  {(questionCounts.math.total + questionCounts.reading.total).toLocaleString()}
                </span>
                {" questions available"}
              </p>
            </div>
          </div>

          {/* Filter Panel */}
          <div data-tour="bank-filters">
          <QuestionBankFilterPanel
            filters={filters}
            onFiltersChange={setFilters}
            showActivityFilter={true}
            rightContent={
              <div className="flex items-center gap-4">
                <BankSourceToggle value={bankSource} onChange={handleBankSourceChange} />
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
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="multi-select-mode"
                    checked={isMultiSelect}
                    onCheckedChange={(checked) => setIsMultiSelect(!!checked)}
                    className={multiSelectModeCheckboxClass}
                  />
                  <Label htmlFor="multi-select-mode" className="cursor-pointer text-sm font-medium text-foreground">
                    Select multiple topics
                  </Label>
                </div>
              </div>
            }
          />
          </div>

          {/* Main Content */}
          {renderBrowseView()}
        </div>
      </section>

      {/* Create Practice Set Button - Fixed at bottom right */}
      {selectedTopicsInfo.totalSelected > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex gap-2">
          <Button
            size="icon"
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
