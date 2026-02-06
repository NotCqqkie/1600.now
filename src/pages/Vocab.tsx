import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { vocabularySets } from "@/data/vocabulary";
import { ArrowLeftRight, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Clock, GraduationCap, Layers, Palette, Pointer, Repeat, Search, Shuffle, SpellCheck, Target, XCircle, Zap } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface FlattenedWord {
  word: string;
  definition: string;
  setId: string;
  setName: string;
}

interface MatchCard {
  id: string;
  pairId: string;
  content: string;
  type: "word" | "definition";
  matched: boolean;
  revealed: boolean;
}

type StudyStatus = "new" | "learning" | "mastered";

type PromptMode = "definition-to-word" | "word-to-definition" | "mixed";

type AnswerType = "typed" | "multiple-choice";

interface StudySettings {
  promptMode: PromptMode;
  acceptEitherSide: boolean;
  lenientTolerance: boolean;
  flashCount: number;
  learnCount: number;
  testCount: number;
  matchPairs: number;
  learnAnswerType: AnswerType;
  testAnswerType: AnswerType;
}

type NumericSettingKey = "flashCount" | "learnCount" | "testCount" | "matchPairs";

interface WordProgress {
  id: string;
  status: StudyStatus;
  correct: number;
  incorrect: number;
  lastSeen: number;
  streak?: number;
}

const PROGRESS_KEY = "vocab-progress";

const shuffleArray = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const getWordId = (word: FlattenedWord) => `${word.setId}::${word.word.toLowerCase()}`;

const sampleAdaptive = (pool: { word: FlattenedWord; weight: number }[], count: number) => {
  const result: FlattenedWord[] = [];
  const mutable = [...pool];
  while (result.length < count && mutable.length) {
    const totalWeight = mutable.reduce((sum, item) => sum + item.weight, 0);
    const target = Math.random() * totalWeight;
    let running = 0;
    let pickedIndex = 0;
    for (let i = 0; i < mutable.length; i += 1) {
      running += mutable[i].weight;
      if (running >= target) {
        pickedIndex = i;
        break;
      }
    }
    const [picked] = mutable.splice(pickedIndex, 1);
    result.push(picked.word);
  }
  return result;
};

const normalizeText = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const levenshteinDistance = (a: string, b: string) => {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[a.length][b.length];
};

const isAnswerCorrect = (input: string, answers: string[], lenient: boolean) => {
  const guess = normalizeText(input);
  return answers.some(answer => {
    const target = normalizeText(answer);
    if (!target) return false;
    if (guess === target) return true;
    if (!lenient) return false;
    const distance = levenshteinDistance(guess, target);
    const allowance = Math.max(1, Math.round(target.length * 0.25));
    return distance <= allowance || target.includes(guess) || guess.includes(target);
  });
};

const Vocab = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeSetId, setActiveSetId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("flashcards");
  const tabContentRef = useRef<HTMLDivElement>(null);

  // Handle tab change without scrolling to top
  const handleTabChange = (value: string) => {
    const scrollY = window.scrollY;
    setActiveTab(value);
    // Restore scroll position after React updates
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
  };

  const [studySettings, setStudySettings] = useState<StudySettings>({
    promptMode: "word-to-definition",
    acceptEitherSide: true,
    lenientTolerance: true,
    flashCount: 24,
    learnCount: 20,
    testCount: 12,
    matchPairs: 8,
    learnAnswerType: "typed",
    testAnswerType: "multiple-choice",
  });

  const updateSetting = <K extends keyof StudySettings>(key: K, value: StudySettings[K]) => {
    setStudySettings(prev => ({ ...prev, [key]: value }));
  };

  const tabOrder: { value: string; label: string }[] = [
    { value: "flashcards", label: "Flashcards" },
    { value: "learn", label: "Learn" },
    { value: "test", label: "Practice Test" },
    { value: "match", label: "Match" },
    { value: "browse", label: "Browse" },
  ];

  const sliderSettings: { key: NumericSettingKey; label: string; min: number; max: number; icon: React.ReactNode }[] = [
    { key: "flashCount", label: "Flashcards", min: 6, max: 60, icon: <Layers className="h-4 w-4" /> },
    { key: "learnCount", label: "Learn queue", min: 6, max: 50, icon: <GraduationCap className="h-4 w-4" /> },
    { key: "testCount", label: "Test questions", min: 6, max: 50, icon: <Target className="h-4 w-4" /> },
    { key: "matchPairs", label: "Match pairs", min: 4, max: 16, icon: <Zap className="h-4 w-4" /> },
  ];

  const tabsListRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [tabIndicator, setTabIndicator] = useState({ width: 0, left: 0 });

  const updateTabIndicator = useCallback(() => {
    const activeEl = tabRefs.current[activeTab];
    const container = tabsListRef.current;
    if (!activeEl || !container) return;
    const containerRect = container.getBoundingClientRect();
    const rect = activeEl.getBoundingClientRect();
    setTabIndicator({ width: rect.width, left: rect.left - containerRect.left });
  }, [activeTab]);

  useLayoutEffect(() => {
    updateTabIndicator();
  }, [updateTabIndicator]);

  useEffect(() => {
    const handleResize = () => updateTabIndicator();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateTabIndicator]);

  const visibleSets = useMemo(() => {
    const sets = vocabularySets.filter(set => activeSetId === "all" || set.id === activeSetId);
    return sets.length ? sets : vocabularySets;
  }, [activeSetId]);

  const allWords = useMemo<FlattenedWord[]>(() => {
    return visibleSets.flatMap(set =>
      set.words.map(word => ({
        ...word,
        setId: set.id,
        setName: set.name,
      }))
    );
  }, [visibleSets]);

  const [progress, setProgress] = useState<Record<string, WordProgress>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(PROGRESS_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, WordProgress>;
    } catch {
      return {};
    }
  });

  // Hydrate progress after mount in case storage wasn't available during SSR/initial render
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PROGRESS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, WordProgress>;
      setProgress(prev => (Object.keys(prev).length ? prev : parsed));
    } catch {
      // Ignore storage read errors
    }
  }, []);

  const saveProgress = (updater: (prev: Record<string, WordProgress>) => Record<string, WordProgress>) => {
    setProgress(prev => {
      const next = updater(prev);
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
        }
      } catch {
        // If storage is unavailable (e.g., private mode), fail silently.
      }
      return next;
    });
  };

  const touchProgress = (word: FlattenedWord, isCorrect: boolean) => {
    const id = getWordId(word);
    saveProgress(prev => {
      const current: WordProgress =
        prev[id] ?? { id, status: "new", correct: 0, incorrect: 0, lastSeen: 0, streak: 0 };
      const correct = current.correct + (isCorrect ? 1 : 0);
      const incorrect = current.incorrect + (isCorrect ? 0 : 1);
      const streak = isCorrect ? ((current as any).streak ?? 0) + 1 : 0;
      const total = correct + incorrect;
      const accuracy = correct / Math.max(total, 1);
      
      // Improved mastery algorithm:
      // - Mastered: 4+ correct with 80%+ accuracy OR 3+ consecutive correct
      // - Learning: at least 1 correct but not yet mastered
      // - New: never answered correctly
      // - If wrong, can demote from mastered to learning
      let status: StudyStatus = current.status;
      
      if (isCorrect) {
        if ((correct >= 4 && accuracy >= 0.8) || streak >= 3) {
          status = "mastered";
        } else if (correct >= 1) {
          status = "learning";
        }
      } else {
        // Wrong answer - demote if mastered, stay at learning if already there
        if (current.status === "mastered") {
          status = "learning";
        } else if (current.status === "new" && incorrect >= 1) {
          status = "learning"; // At least they've tried it
        }
      }
      
      return {
        ...prev,
        [id]: {
          id,
          status,
          correct,
          incorrect,
          lastSeen: Date.now(),
          streak,
        },
      };
    });
  };

  const filteredWords = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return allWords;
    return allWords.filter(({ word, definition }) =>
      word.toLowerCase().includes(term) || definition.toLowerCase().includes(term)
    );
  }, [allWords, query]);

  const progressSummary = useMemo(() => {
    const base = { new: 0, learning: 0, mastered: 0, total: allWords.length };
    return allWords.reduce((acc, word) => {
      const status = progress[getWordId(word)]?.status ?? "new";
      acc[status] += 1;
      return acc;
    }, base as Record<StudyStatus | "total", number>);
  }, [allWords, progress]);

  const selectedSetLabel = activeSetId === "all" ? "All sets" : visibleSets[0]?.name ?? "All sets";

  const adaptivePool = useMemo(() => {
    return filteredWords.map(word => {
      const state = progress[getWordId(word)];
      const status = state?.status ?? "new";
      const weight = status === "new" ? 3 : status === "learning" ? 2 : 1;
      return { word, weight };
    });
  }, [filteredWords, progress]);

  const adaptivePoolRef = useRef(adaptivePool);
  useEffect(() => {
    adaptivePoolRef.current = adaptivePool;
  }, [adaptivePool]);

  const computeDirection = useCallback(
    (index: number): Exclude<PromptMode, "mixed"> => {
      if (studySettings.promptMode === "mixed") {
        return index % 2 === 0 ? "definition-to-word" : "word-to-definition";
      }
      return studySettings.promptMode;
    },
    [studySettings.promptMode]
  );

  const buildPrompt = useCallback(
    (word: FlattenedWord, index: number) => {
      const direction = computeDirection(index);
      const prompt = direction === "definition-to-word" ? word.definition : word.word;
      const expected = direction === "definition-to-word" ? [word.word] : [word.definition];
      const enriched = studySettings.acceptEitherSide ? Array.from(new Set([...expected, word.word, word.definition])) : expected;
      const answerLabel = direction === "definition-to-word" ? "Word" : "Definition";
      return { direction, prompt, expected: enriched, answerLabel };
    },
    [computeDirection, studySettings.acceptEitherSide]
  );

  // Flashcards
  const [flashDeck, setFlashDeck] = useState<FlattenedWord[]>([]);
  const [flashIndex, setFlashIndex] = useState(0);
  const [flashFlipped, setFlashFlipped] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [flashDeckSeed, setFlashDeckSeed] = useState(0);
  const [flashSessionComplete, setFlashSessionComplete] = useState(false);
  const [flashSessionStats, setFlashSessionStats] = useState<{
    reviewed: number;
    gotIt: number;
    needPractice: number;
    noIdea: number;
    startProgress: Record<string, WordProgress>;
  }>({ reviewed: 0, gotIt: 0, needPractice: 0, noIdea: 0, startProgress: {} });

  // Compute what to show on front/back based on prompt mode
  const getFlashcardContent = useCallback((word: FlattenedWord) => {
    const direction = studySettings.promptMode === "mixed" 
      ? (flashIndex % 2 === 0 ? "definition-to-word" : "word-to-definition")
      : studySettings.promptMode;
    
    if (direction === "definition-to-word") {
      return { front: word.definition, back: word.word };
    } else {
      return { front: word.word, back: word.definition };
    }
  }, [studySettings.promptMode, flashIndex]);

  // Only rebuild deck when settings, search, or explicit seed changes - NOT on progress changes
  useEffect(() => {
    const count = Math.max(1, Math.min(studySettings.flashCount, filteredWords.length));
    const shuffled = shuffleArray(filteredWords).slice(0, count);
    setFlashDeck(shuffled);
    setFlashIndex(0);
    setFlashFlipped(false);
    setIsAnimating(false);
    setFlashSessionComplete(false);
    // Capture starting progress for this session
    setFlashSessionStats({
      reviewed: 0,
      gotIt: 0,
      needPractice: 0,
      noIdea: 0,
      startProgress: { ...progress },
    });
  }, [filteredWords, studySettings.flashCount, flashDeckSeed]);

  // Keyboard shortcuts for flashcards
  useEffect(() => {
    if (activeTab !== "flashcards") return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnimating || !flashDeck.length) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleFlashAdvance(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleFlashAdvance(1);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setFlashFlipped(prev => !prev);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, flashDeck.length, isAnimating]);

  const handleFlashAdvance = (delta: number) => {
    if (!flashDeck.length || isAnimating) return;
    
    const nextIndex = (flashIndex + delta + flashDeck.length) % flashDeck.length;
    
    // If card is flipped, change card immediately and unflip simultaneously
    // The card content changes instantly, but we see it as the flip animation plays
    if (flashFlipped) {
      setIsAnimating(true);
      setFlashIndex(nextIndex); // Change card content immediately
      setFlashFlipped(false); // Start unflip animation
      setTimeout(() => {
        setIsAnimating(false);
      }, 350); // Wait for flip animation to complete
    } else {
      // Card not flipped, just advance immediately
      setFlashIndex(nextIndex);
    }
  };

  const handleFlashShuffle = () => {
    if (isAnimating) return;
    setFlashDeckSeed(prev => prev + 1);
  };

  const handleFlashCardClick = () => {
    if (!flashDeck.length || isAnimating) return;
    setFlashFlipped(prev => !prev);
  };

  const markFlashResult = (status: "no-idea" | "need-practice" | "got-it") => {
    if (isAnimating || flashSessionComplete) return;
    const current = flashDeck[flashIndex];
    if (current) {
      // Map status to correct/incorrect for progress tracking
      const isCorrect = status === "got-it";
      touchProgress(current, isCorrect);
      
      // Update session stats
      setFlashSessionStats(prev => ({
        ...prev,
        reviewed: prev.reviewed + 1,
        gotIt: prev.gotIt + (status === "got-it" ? 1 : 0),
        needPractice: prev.needPractice + (status === "need-practice" ? 1 : 0),
        noIdea: prev.noIdea + (status === "no-idea" ? 1 : 0),
      }));
      
      // Check if this was the last card
      if (flashSessionStats.reviewed + 1 >= flashDeck.length) {
        // Session complete - show completion screen
        setIsAnimating(true);
        if (flashFlipped) {
          setFlashFlipped(false);
          setTimeout(() => {
            setFlashSessionComplete(true);
            setIsAnimating(false);
          }, 350);
        } else {
          setFlashSessionComplete(true);
          setIsAnimating(false);
        }
      } else {
        handleFlashAdvance(1);
      }
    }
  };
  
  // Calculate progress changes for completion screen
  const flashProgressChanges = useMemo(() => {
    const changes = { newToLearning: 0, learningToMastered: 0, masteredToLearning: 0 };
    if (!flashSessionComplete) return changes;
    
    flashDeck.forEach(word => {
      const id = getWordId(word);
      const before = flashSessionStats.startProgress[id]?.status ?? "new";
      const after = progress[id]?.status ?? "new";
      
      if (before === "new" && after === "learning") changes.newToLearning++;
      if (before === "new" && after === "mastered") changes.newToLearning++; // counts as progress
      if (before === "learning" && after === "mastered") changes.learningToMastered++;
      if (before === "mastered" && after === "learning") changes.masteredToLearning++;
    });
    
    return changes;
  }, [flashSessionComplete, flashDeck, flashSessionStats.startProgress, progress]);

  // Learn mode (type the word from the definition)
  const [learnAnswer, setLearnAnswer] = useState("");
  const [learnIndex, setLearnIndex] = useState(0);
  const [learnResult, setLearnResult] = useState<"correct" | "incorrect" | null>(null);
  const [learnSeed, setLearnSeed] = useState(0);
  const [learnQueue, setLearnQueue] = useState<FlattenedWord[]>([]);

  useEffect(() => {
    const pool = adaptivePoolRef.current;
    const poolLength = pool.length || filteredWords.length;
    const count = Math.max(1, Math.min(studySettings.learnCount, poolLength));
    const queue = pool.length ? sampleAdaptive(pool, Math.min(count, pool.length)) : [];
    setLearnQueue(queue.length ? queue : filteredWords.slice(0, count));
    setLearnIndex(0);
    setLearnAnswer("");
    setLearnResult(null);
  }, [filteredWords, learnSeed, studySettings.learnCount]);

  const currentLearnWord = learnQueue.length ? learnQueue[learnIndex % learnQueue.length] : null;
  const learnPromptData = currentLearnWord ? buildPrompt(currentLearnWord, learnIndex) : null;

  // Generate multiple choice options for learn mode (stable per word/prompt)
  const learnOptionsKey = currentLearnWord && learnPromptData ? `${getWordId(currentLearnWord)}::${learnPromptData.direction}` : null;
  const [learnOptionsCache, setLearnOptionsCache] = useState<{ key: string; options: string[] }>({ key: "", options: [] });
  useEffect(() => {
    if (!learnOptionsKey || !currentLearnWord || !learnPromptData) return;
    setLearnOptionsCache(prev => {
      if (prev.key === learnOptionsKey && prev.options.length) return prev;
      const answer = learnPromptData.direction === "definition-to-word" ? currentLearnWord.word : currentLearnWord.definition;
      const optionPool = learnPromptData.direction === "definition-to-word"
        ? filteredWords.map(w => w.word)
        : filteredWords.map(w => w.definition);
      const distractors = shuffleArray(optionPool.filter(opt => normalizeText(opt) !== normalizeText(answer))).slice(0, 3);
      return { key: learnOptionsKey, options: shuffleArray([answer, ...distractors]) };
    });
  }, [learnOptionsKey, currentLearnWord, learnPromptData, filteredWords]);
  const learnOptions = learnOptionsCache.key === learnOptionsKey ? learnOptionsCache.options : [];

  const submitLearn = () => {
    if (!currentLearnWord || !learnPromptData) return;
    if (!learnAnswer.trim()) return;
    const isCorrect = isAnswerCorrect(learnAnswer, learnPromptData.expected, studySettings.lenientTolerance);
    touchProgress(currentLearnWord, isCorrect);
    setLearnResult(isCorrect ? "correct" : "incorrect");
  };

  const handleLearnMCSelect = (option: string) => {
    if (learnResult) return;
    setLearnAnswer(option);
  };

  const submitLearnMC = (selectedOption?: string) => {
    if (!currentLearnWord || !learnPromptData) return;
    const answerToCheck = selectedOption ?? learnAnswer;
    if (!answerToCheck) return;
    setLearnAnswer(answerToCheck);
    const isCorrect = isAnswerCorrect(answerToCheck, learnPromptData.expected, studySettings.lenientTolerance);
    touchProgress(currentLearnWord, isCorrect);
    setLearnResult(isCorrect ? "correct" : "incorrect");
  };

  // Practice test (multiple choice with submit flow)
  const [testSeed, setTestSeed] = useState(0);
  const [testIndex, setTestIndex] = useState(0);
  const [testAnswers, setTestAnswers] = useState<Record<number, string>>({}); // Track answers for each question
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [testReviewMode, setTestReviewMode] = useState(false);

  const testQuestions = useMemo(() => {
    const count = Math.max(3, Math.min(studySettings.testCount, filteredWords.length));
    const shuffled = shuffleArray(filteredWords).slice(0, count);
    return shuffled.map((word, idx) => {
      const direction = computeDirection(idx);
      const prompt = direction === "definition-to-word" ? word.definition : word.word;
      const answer = direction === "definition-to-word" ? word.word : word.definition;
      const optionPool = direction === "definition-to-word" ? filteredWords.map(w => w.word) : filteredWords.map(w => w.definition);
      const distractors = shuffleArray(optionPool.filter(opt => normalizeText(opt) !== normalizeText(answer))).slice(0, 3);
      const options = shuffleArray([answer, ...distractors]);
      return { prompt, answer, options, word, direction };
    });
  }, [computeDirection, filteredWords, studySettings.testCount, testSeed]);

  useEffect(() => {
    setTestIndex(0);
    setTestAnswers({});
    setTestSubmitted(false);
    setTestReviewMode(false);
  }, [testQuestions]);

  const handleTestSelect = (option: string) => {
    if (testSubmitted) return;
    setTestAnswers(prev => ({ ...prev, [testIndex]: option }));
  };

  const handleTestPrev = () => {
    if (testIndex > 0) {
      setTestIndex(prev => prev - 1);
    }
  };

  const handleTestNext = () => {
    if (testIndex < testQuestions.length - 1) {
      setTestIndex(prev => prev + 1);
    }
  };

  const handleTestSubmit = () => {
    // Calculate score and update progress
    let score = 0;
    testQuestions.forEach((q, idx) => {
      const userAnswer = testAnswers[idx];
      const isCorrect = userAnswer && isAnswerCorrect(userAnswer, [q.answer], studySettings.lenientTolerance);
      if (isCorrect) score++;
      touchProgress(q.word, !!isCorrect);
    });
    setTestSubmitted(true);
    setTestReviewMode(true);
    setTestIndex(0);
  };

  const testScore = useMemo(() => {
    if (!testSubmitted) return 0;
    return testQuestions.reduce((acc, q, idx) => {
      const userAnswer = testAnswers[idx];
      const isCorrect = userAnswer && isAnswerCorrect(userAnswer, [q.answer], studySettings.lenientTolerance);
      return acc + (isCorrect ? 1 : 0);
    }, 0);
  }, [testSubmitted, testQuestions, testAnswers, studySettings.lenientTolerance]);

  const answeredCount = Object.keys(testAnswers).length;

  // Match mode
  const [matchSeed, setMatchSeed] = useState(0);
  const [matchCards, setMatchCards] = useState<MatchCard[]>([]);
  const [matchSelections, setMatchSelections] = useState<number[]>([]);
  const [matchLocked, setMatchLocked] = useState(false);
  const [matchStats, setMatchStats] = useState({ moves: 0, matches: 0, startedAt: Date.now() });

  useEffect(() => {
    const pairCount = Math.min(studySettings.matchPairs, Math.max(3, filteredWords.length));
    const primaryPairs = sampleAdaptive(adaptivePool, pairCount);
    const fallbackPairs = sampleAdaptive(filteredWords.map(word => ({ word, weight: 1 })), pairCount);
    const sourcePairs = primaryPairs.length ? primaryPairs : fallbackPairs;
    const builtCards: MatchCard[] = shuffleArray(
      sourcePairs.flatMap(word => [
        {
          id: `${word.word}-w`,
          pairId: word.word,
          content: word.word,
          type: "word" as const,
          matched: false,
          revealed: false,
        },
        {
          id: `${word.word}-d`,
          pairId: word.word,
          content: word.definition,
          type: "definition" as const,
          matched: false,
          revealed: false,
        },
      ])
    );
    setMatchCards(builtCards);
    setMatchSelections([]);
    setMatchLocked(false);
    setMatchStats({ moves: 0, matches: 0, startedAt: Date.now() });
  }, [filteredWords, adaptivePool, matchSeed, studySettings.matchPairs]);

  const handleMatchClick = (index: number) => {
    if (matchLocked) return;
    const card = matchCards[index];
    if (!card || card.matched || matchSelections.includes(index)) return;

    const updated = matchCards.map((c, i) => (i === index ? { ...c, revealed: true } : c));
    const selections = [...matchSelections, index];
    setMatchCards(updated);
    setMatchSelections(selections);

    if (selections.length === 2) {
      setMatchLocked(true);
      const [firstIndex, secondIndex] = selections;
      const first = updated[firstIndex];
      const second = updated[secondIndex];
      const isMatch = first.pairId === second.pairId && first.type !== second.type;
      setMatchStats(prev => ({ ...prev, moves: prev.moves + 1, matches: prev.matches + (isMatch ? 1 : 0) }));

      if (isMatch) {
        const found = filteredWords.find(w => w.word === first.pairId);
        if (found) {
          touchProgress(found, true);
        }
        setTimeout(() => {
          setMatchCards(prev =>
            prev.map((c, i) =>
              i === firstIndex || i === secondIndex ? { ...c, matched: true } : c
            )
          );
          setMatchSelections([]);
          setMatchLocked(false);
        }, 350);
      } else {
        setTimeout(() => {
          setMatchCards(prev =>
            prev.map((c, i) =>
              i === firstIndex || i === secondIndex ? { ...c, revealed: false } : c
            )
          );
          setMatchSelections([]);
          setMatchLocked(false);
        }, 700);
      }
    }
  };

  const allMatched = matchCards.length && matchCards.every(card => card.matched);

  const secondsElapsed = Math.max(0, Math.floor((Date.now() - matchStats.startedAt) / 1000));

  const masteredPercent = progressSummary.total
    ? Math.round((progressSummary.mastered / progressSummary.total) * 100)
    : 0;

  const getSliderConfig = (key: NumericSettingKey) => sliderSettings.find(setting => setting.key === key);

  const renderCountSlider = (key: NumericSettingKey, label?: string, description?: string) => {
    const setting = getSliderConfig(key);
    if (!setting) return null;
    const value = studySettings[key];
    const percentage = ((value - setting.min) / (setting.max - setting.min)) * 100;
    
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label ?? setting.label}</Label>
        </div>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        <div className="relative pt-8 pb-1">
          {/* Floating value indicator above slider thumb */}
          <div 
            className="absolute top-0 transform -translate-x-1/2 pointer-events-none"
            style={{ left: `calc(${percentage}% + ${(50 - percentage) * 0.15}px)` }}
          >
            <span className="text-sm font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full shadow-sm">
              {value}
            </span>
          </div>
          <Slider
            value={[value]}
            min={setting.min}
            max={setting.max}
            step={1}
            onValueChange={([val]) => updateSetting(key, val)}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{setting.min}</span>
          <span>{setting.max}</span>
        </div>
      </div>
    );
  };

  const renderAnswerToggles = (options: { includeEither?: boolean } = {}) => {
    const includeEither = options.includeEither ?? true;
    return (
      <div className={`grid gap-2 ${includeEither ? "sm:grid-cols-2" : "max-w-md"}`}>
        {includeEither && (
          <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Accept either side</p>
                <p className="text-xs text-muted-foreground">Word or definition counts.</p>
              </div>
            </div>
            <Switch checked={studySettings.acceptEitherSide} onCheckedChange={val => updateSetting("acceptEitherSide", val)} />
          </div>
        )}
        <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2">
            <SpellCheck className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium">Lenient tolerance</p>
              <p className="text-xs text-muted-foreground">Typos and near matches count.</p>
            </div>
          </div>
          <Switch checked={studySettings.lenientTolerance} onCheckedChange={val => updateSetting("lenientTolerance", val)} />
        </div>
      </div>
    );
  };

  const renderPromptSelect = () => (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Prompt mode</Label>
      <Select value={studySettings.promptMode} onValueChange={val => updateSetting("promptMode", val as PromptMode)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="definition-to-word">
            <span className="flex items-center gap-1.5">Definition <span className="text-primary">→</span> Word</span>
          </SelectItem>
          <SelectItem value="word-to-definition">
            <span className="flex items-center gap-1.5">Word <span className="text-primary">→</span> Definition</span>
          </SelectItem>
          <SelectItem value="mixed">Mixed</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-[11px] text-muted-foreground">Applies to flashcards, learn, and tests.</p>
    </div>
  );

  const renderModeSettings = () => {
    if (activeTab === "flashcards") {
      return (
        <Card className="mt-4 p-5 border border-border/60 bg-card/80 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold">Flashcards settings</p>
              <p className="text-xs text-muted-foreground">Deck length and prompt handling.</p>
            </div>
            <Badge variant="outline">Cards: {studySettings.flashCount}</Badge>
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-[1.4fr_1fr] md:items-end">
            {renderCountSlider("flashCount", "Cards per session")}
            {renderPromptSelect()}
          </div>
        </Card>
      );
    }
    if (activeTab === "learn") {
      return (
        <Card className="mt-4 p-5 border border-border/60 bg-card/80 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold">Learn mode settings</p>
              <p className="text-xs text-muted-foreground">Control queue length and answer format.</p>
            </div>
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-[1.4fr_1fr] md:items-end">
            {renderCountSlider("learnCount", "Words per round")}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Answer type</Label>
              <Select value={studySettings.learnAnswerType} onValueChange={val => updateSetting("learnAnswerType", val as AnswerType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="typed">Typed answer</SelectItem>
                  <SelectItem value="multiple-choice">Multiple choice</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-2 md:items-end">
            {renderPromptSelect()}
          </div>
          <div className="mt-3 border-t border-border/50 pt-3">{renderAnswerToggles()}</div>
        </Card>
      );
    }
    if (activeTab === "test") {
      return (
        <Card className="mt-4 p-5 border border-border/60 bg-card/80 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold">Practice test settings</p>
              <p className="text-xs text-muted-foreground">Set question count and answer format.</p>
            </div>
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-[1.4fr_1fr] md:items-end">
            {renderCountSlider("testCount", "Questions per set")}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Answer type</Label>
              <Select value={studySettings.testAnswerType} onValueChange={val => updateSetting("testAnswerType", val as AnswerType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="typed">Typed answer</SelectItem>
                  <SelectItem value="multiple-choice">Multiple choice</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-2 md:items-end">
            {renderPromptSelect()}
          </div>
          <div className="mt-3 border-t border-border/50 pt-3">{renderAnswerToggles({ includeEither: false })}</div>
        </Card>
      );
    }
    if (activeTab === "match") {
      return (
        <Card className="mt-4 p-5 border border-border/60 bg-card/80 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold">Match mode settings</p>
              <p className="text-xs text-muted-foreground">Choose how many pairs appear.</p>
            </div>
            <Badge variant="outline">Pairs: {studySettings.matchPairs}</Badge>
          </div>
          <div className="mt-3">{renderCountSlider("matchPairs", "Pairs on board")}</div>
        </Card>
      );
    }
    if (activeTab === "browse") {
      return (
        <Card className="mt-4 p-5 border border-border/60 bg-card/80 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold">Browse mode</p>
              <p className="text-xs text-muted-foreground">Search and explore all vocabulary words.</p>
            </div>
            <Badge variant="outline">Total: {allWords.length}</Badge>
          </div>
        </Card>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-foreground dark:from-[#0b162a] dark:via-[#0d1326] dark:to-[#0a1020]">
      <header className="sticky top-0 z-20 border-b border-primary/10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Home
            </Button>
            <span className="hidden sm:inline-flex text-sm text-muted-foreground">Vocabulary</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 space-y-6">
        <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-r from-primary/10 via-card to-accent/20 p-7 shadow-2xl">
          <div
            className="absolute inset-0 opacity-60 blur-3xl"
            style={{
              background:
                "radial-gradient(circle at 25% 30%, rgba(84,197,255,0.45), transparent 32%), radial-gradient(circle at 75% 15%, rgba(255,196,120,0.35), transparent 28%), radial-gradient(circle at 65% 80%, rgba(118,179,255,0.25), transparent 35%)",
            }}
          />
          <div className="relative flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
            <div className="space-y-4 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 text-sm font-semibold text-primary shadow-sm ring-1 ring-primary/30">
                <Palette className="h-4 w-4" />
                SAT Vocabulary Studio
              </div>
              <div className="space-y-2">
                <h1 className="text-4xl font-bold leading-tight text-foreground">Polished vocab lab for rapid recall</h1>
                <p className="text-base text-muted-foreground">
                  Flexible flashcards, smarter learn mode, configurable tests, and a refreshed color system tuned just for vocabulary practice.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">New: {progressSummary.new}</Badge>
                <Badge variant="outline">Learning: {progressSummary.learning}</Badge>
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100">
                  Mastered: {progressSummary.mastered}
                </Badge>
              </div>
              <div className="max-w-md space-y-2">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                  <span>Mastery progress</span>
                  <span>{masteredPercent}%</span>
                </div>
                <Progress value={masteredPercent} className="h-2" />
              </div>
            </div>
          </div>
        </div>

        <Card className="p-6 shadow-2xl border border-border/60 bg-card/80 backdrop-blur">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {filteredWords.length} of {allWords.length} words in {selectedSetLabel} ({visibleSets.length} set{visibleSets.length === 1 ? "" : "s"} selected).
            </div>
            <div className="w-full md:w-72">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Choose a set</Label>
              <Select value={activeSetId} onValueChange={setActiveSetId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All sets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sets ({vocabularySets.length})</SelectItem>
                  {vocabularySets.map(set => (
                    <SelectItem key={set.id} value={set.id}>
                      {set.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList
              ref={tabsListRef}
              className="relative w-full grid grid-cols-5 rounded-xl bg-muted/60 p-1 shadow-inner"
            >
              {/* Animated tab indicator */}
              <span
                className="vocab-tab-indicator absolute top-1 bottom-1 rounded-lg bg-background shadow-lg pointer-events-none"
                style={{
                  width: tabIndicator.width > 0 ? `${tabIndicator.width}px` : "calc(20% - 8px)",
                  left: tabIndicator.left > 0 ? `${tabIndicator.left}px` : "4px",
                }}
              />
              {tabOrder.map((tab, idx) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  ref={el => {
                    tabRefs.current[tab.value] = el;
                  }}
                  className="relative z-10 h-10 rounded-lg text-sm font-medium transition-colors duration-200 data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground hover:text-foreground/80"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {renderModeSettings()}

            {/* Tab content with ref for scroll management */}
            <div ref={tabContentRef} className="relative min-h-[400px]">
              <TabsContent
                value="flashcards"
                className="mt-6 space-y-4 focus-visible:outline-none focus-visible:ring-0 animate-fade-in"
                forceMount
                hidden={activeTab !== "flashcards"}
              >
                {flashSessionComplete ? (
                  /* Completion Screen */
                  <Card className="p-8 space-y-6 bg-gradient-to-br from-primary/5 via-card to-muted/40 shadow-xl rounded-3xl border-2 border-primary/10 max-w-2xl mx-auto">
                    <div className="text-center space-y-2">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/40 mb-2">
                        <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                      </div>
                      <h2 className="text-2xl font-bold text-foreground">Session Complete!</h2>
                      <p className="text-muted-foreground">You reviewed all {flashDeck.length} cards in this set.</p>
                    </div>
                    
                    {/* Session Stats */}
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">{flashSessionStats.gotIt}</div>
                        <div className="text-xs text-green-700 dark:text-green-300">Got it</div>
                      </div>
                      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                        <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{flashSessionStats.needPractice}</div>
                        <div className="text-xs text-amber-700 dark:text-amber-300">Need practice</div>
                      </div>
                      <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">{flashSessionStats.noIdea}</div>
                        <div className="text-xs text-red-700 dark:text-red-300">No idea</div>
                      </div>
                    </div>
                    
                    {/* Progress Changes */}
                    {(flashProgressChanges.newToLearning > 0 || flashProgressChanges.learningToMastered > 0 || flashProgressChanges.masteredToLearning > 0) && (
                      <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-2">
                        <p className="text-sm font-medium text-foreground">Progress Changes</p>
                        <div className="flex flex-wrap gap-2">
                          {flashProgressChanges.newToLearning > 0 && (
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100">
                              {flashProgressChanges.newToLearning} New → Learning
                            </Badge>
                          )}
                          {flashProgressChanges.learningToMastered > 0 && (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100">
                              {flashProgressChanges.learningToMastered} Learning → Mastered
                            </Badge>
                          )}
                          {flashProgressChanges.masteredToLearning > 0 && (
                            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-100">
                              {flashProgressChanges.masteredToLearning} Mastered → Learning
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button onClick={handleFlashShuffle} className="gap-2">
                        <Shuffle className="h-4 w-4" />
                        New Set
                      </Button>
                      <Button variant="outline" onClick={() => setActiveTab("learn")}>
                        <GraduationCap className="mr-2 h-4 w-4" />
                        Practice in Learn Mode
                      </Button>
                    </div>
                  </Card>
                ) : (
                  /* Normal Flashcard UI */
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="text-sm text-muted-foreground">
                        {flashDeck.length ? `Card ${flashIndex + 1} of ${flashDeck.length}` : "No cards to show"}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleFlashShuffle} disabled={!flashDeck.length || isAnimating}>
                          <Shuffle className="mr-2 h-4 w-4" />
                          Shuffle
                        </Button>
                      </div>
                    </div>

                    <Progress value={flashDeck.length ? ((flashSessionStats.reviewed + 1) / flashDeck.length) * 100 : 0} />

                    <div className="relative w-full max-w-3xl mx-auto [perspective:1400px]">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute -left-14 top-1/2 -translate-y-1/2 rounded-full border border-border/60 bg-background/80 shadow hover:bg-background"
                        onClick={() => handleFlashAdvance(-1)}
                        disabled={!flashDeck.length || isAnimating}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute -right-14 top-1/2 -translate-y-1/2 rounded-full border border-border/60 bg-background/80 shadow hover:bg-background"
                        onClick={() => handleFlashAdvance(1)}
                        disabled={!flashDeck.length || isAnimating}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>

                      <div
                        onClick={handleFlashCardClick}
                        className="vocab-flashcard relative h-full min-h-[320px] w-full cursor-pointer [transform-style:preserve-3d]"
                        style={{ 
                          transform: flashFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                          transition: isAnimating ? "transform 0.2s ease-out" : "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)"
                        }}
                      >
                        <Card className="vocab-flashcard-face absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-3xl bg-gradient-to-br from-primary/5 via-card to-muted/40 shadow-xl border-2 border-primary/10">
                          {flashDeck.length ? (
                            <>
                              {(() => {
                                const content = getFlashcardContent(flashDeck[flashIndex]);
                                return (
                                  <div className="text-3xl sm:text-4xl md:text-5xl font-semibold text-foreground text-center px-8 leading-relaxed">
                                    {content.front}
                                  </div>
                                );
                              })()}
                            </>
                          ) : (
                            <div className="text-muted-foreground">No cards match your search yet.</div>
                          )}
                        </Card>
                        <Card className="vocab-flashcard-face vocab-flashcard-back absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-3xl bg-gradient-to-br from-secondary/10 via-card to-primary/5 shadow-xl border-2 border-secondary/20">
                          {flashDeck.length ? (
                            <>
                              {(() => {
                                const content = getFlashcardContent(flashDeck[flashIndex]);
                                return (
                                  <div className="text-2xl sm:text-3xl font-medium text-foreground leading-relaxed text-center px-8">
                                    {content.back}
                                  </div>
                                );
                              })()}
                            </>
                          ) : null}
                        </Card>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 max-w-xl mx-auto">
                      <Button 
                        variant="outline" 
                        className="border-red-300 hover:bg-red-50 hover:border-red-400 dark:border-red-800 dark:hover:bg-red-950"
                        onClick={() => markFlashResult("no-idea")} 
                        disabled={!flashDeck.length || isAnimating}
                      >
                        <XCircle className="mr-2 h-4 w-4 text-red-500" />
                        No idea
                      </Button>
                      <Button 
                        variant="outline"
                        className="border-amber-300 hover:bg-amber-50 hover:border-amber-400 dark:border-amber-700 dark:hover:bg-amber-950"
                        onClick={() => markFlashResult("need-practice")} 
                        disabled={!flashDeck.length || isAnimating}
                      >
                        <Target className="mr-2 h-4 w-4 text-amber-500" />
                        Need practice
                      </Button>
                      <Button 
                        variant="outline"
                        className="border-green-300 hover:bg-green-50 hover:border-green-400 dark:border-green-700 dark:hover:bg-green-950"
                        onClick={() => markFlashResult("got-it")} 
                        disabled={!flashDeck.length || isAnimating}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                        Got it
                      </Button>
                    </div>
                  </>
                )}
            </TabsContent>

            <TabsContent
              value="learn"
              className="mt-6 space-y-4 focus-visible:outline-none focus-visible:ring-0 animate-fade-in"
              forceMount
              hidden={activeTab !== "learn"}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  {learnQueue.length ? `Word ${(learnIndex % learnQueue.length) + 1} of ${learnQueue.length}` : "No words to learn"}
                </div>
                <Button variant="outline" size="sm" onClick={() => setLearnSeed(prev => prev + 1)}>
                  <Shuffle className="mr-2 h-4 w-4" />
                  Shuffle
                </Button>
              </div>

              <Card className="p-6 space-y-4 bg-gradient-to-br from-muted/60 to-card shadow-inner rounded-2xl">
                {currentLearnWord && learnPromptData ? (
                  <>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-primary">
                      {learnPromptData.direction === "definition-to-word" ? "Definition → Word" : "Word → Definition"}
                    </div>
                    <div className="text-xl font-semibold leading-relaxed">{learnPromptData.prompt}</div>
                    
                    {/* Typed answer mode */}
                    {studySettings.learnAnswerType === "typed" ? (
                      <>
                        <Input
                          value={learnAnswer}
                          onChange={e => setLearnAnswer(e.target.value)}
                          placeholder={`Type the ${learnPromptData.answerLabel.toLowerCase()}`}
                          onKeyDown={e => {
                            if (e.key === "Enter") submitLearn();
                          }}
                          className={learnResult === "correct" ? "border-green-500 bg-green-50 dark:bg-green-950/30" : learnResult === "incorrect" ? "border-red-500 bg-red-50 dark:bg-red-950/30" : ""}
                        />
                        {learnResult === "correct" && (
                          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
                            <CheckCircle2 className="h-5 w-5" />
                            Correct!
                          </div>
                        )}
                        {learnResult === "incorrect" && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 font-medium">
                              <XCircle className="h-5 w-5" />
                              Not quite right
                            </div>
                            <div className="p-3 rounded-lg bg-muted/50 border border-border">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Correct answer:</p>
                              <p className="text-lg font-semibold text-foreground">{learnPromptData.expected[0]}</p>
                            </div>
                          </div>
                        )}
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Button onClick={submitLearn} disabled={!learnAnswer.trim() || learnResult === "correct"}>
                            Check
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setLearnIndex(prev => prev + 1);
                              setLearnAnswer("");
                              setLearnResult(null);
                            }}
                            disabled={!learnQueue.length}
                          >
                            {learnResult ? "Next word" : "Skip"}
                          </Button>
                        </div>
                      </>
                    ) : (
                      /* Multiple choice mode */
                      <>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {learnOptions.map((option, optIdx) => {
                            const isSelected = learnAnswer === option;
                            const isCorrectOption = isAnswerCorrect(option, learnPromptData.expected, studySettings.lenientTolerance);

                            let buttonVariant: "outline" | "default" | "destructive" = "outline";
                            let extraClasses = "";

                            if (learnResult) {
                              // After checking - show correct/incorrect
                              if (isCorrectOption) {
                                buttonVariant = "default";
                                extraClasses = "bg-green-600 hover:bg-green-600 border-green-600 text-white";
                              } else if (isSelected && !isCorrectOption) {
                                buttonVariant = "destructive";
                              }
                            } else if (isSelected) {
                              // Before checking - just highlight selected
                              extraClasses = "border-primary bg-primary/10 ring-2 ring-primary/30";
                            }

                            return (
                              <div key={`${option}-${optIdx}`} className="relative group">
                                <Button
                                  variant={buttonVariant}
                                  onClick={() => handleLearnMCSelect(option)}
                                  disabled={!!learnResult}
                                  className={`w-full justify-start text-left h-auto py-3 px-4 pr-16 whitespace-normal ${extraClasses}`}
                                >
                                  <span className="font-semibold mr-2 text-muted-foreground">{String.fromCharCode(65 + optIdx)}.</span>
                                  {option}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!!learnResult}
                                  onClick={e => {
                                    e.stopPropagation();
                                    submitLearnMC(option);
                                  }}
                                  className={`absolute right-2 top-1/2 -translate-y-1/2 transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}`}
                                >
                                  Check
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                        {learnResult === "correct" && (
                          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
                            <CheckCircle2 className="h-5 w-5" />
                            Correct! Moving to the next word...
                          </div>
                        )}
                        {learnResult === "incorrect" && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 font-medium">
                              <XCircle className="h-5 w-5" />
                              Not quite right
                            </div>
                            <div className="p-3 rounded-lg bg-muted/50 border border-border">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Correct answer:</p>
                              <p className="text-lg font-semibold text-foreground">{learnPromptData.expected[0]}</p>
                            </div>
                          </div>
                        )}
                        <div className="grid">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setLearnIndex(prev => prev + 1);
                                setLearnAnswer("");
                                setLearnResult(null);
                              }}
                              disabled={!learnQueue.length}
                              className="justify-center"
                            >
                            {learnResult ? "Next word" : "Skip"}
                            </Button>
                          </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="text-muted-foreground text-center py-8">No words available for learn mode.</div>
                )}
              </Card>
            </TabsContent>

            <TabsContent
              value="test"
              className="mt-6 space-y-4 focus-visible:outline-none focus-visible:ring-0 animate-fade-in"
              forceMount
              hidden={activeTab !== "test"}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  {testSubmitted 
                    ? `Review mode - Score: ${testScore}/${testQuestions.length}`
                    : `${answeredCount} of ${testQuestions.length} answered`
                  }
                </div>
                <Button variant="outline" size="sm" onClick={() => setTestSeed(prev => prev + 1)}>
                  <Shuffle className="mr-2 h-4 w-4" />
                  New test
                </Button>
              </div>

              {testQuestions.length ? (
                <Card className="p-6 space-y-5 shadow-md rounded-2xl">
                  {/* Progress bar */}
                  <Progress value={((testIndex + 1) / testQuestions.length) * 100} className="h-2" />
                  
                  {/* Question header */}
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-foreground">
                      Question {testIndex + 1} of {testQuestions.length}
                    </div>
                    {testSubmitted && (
                      <Badge className={testAnswers[testIndex] && isAnswerCorrect(testAnswers[testIndex], [testQuestions[testIndex].answer], studySettings.lenientTolerance)
                        ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-100"
                        : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-100"
                      }>
                        {testAnswers[testIndex] && isAnswerCorrect(testAnswers[testIndex], [testQuestions[testIndex].answer], studySettings.lenientTolerance) ? "Correct" : "Incorrect"}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Question prompt */}
                  <p className="text-xl font-semibold leading-relaxed">{testQuestions[testIndex].prompt}</p>
                  
                  {/* Typed answer mode */}
                  {studySettings.testAnswerType === "typed" ? (
                    <div className="space-y-3">
                      <Input
                        value={testAnswers[testIndex] ?? ""}
                        onChange={e => !testSubmitted && setTestAnswers(prev => ({ ...prev, [testIndex]: e.target.value }))}
                        placeholder="Type your answer..."
                        disabled={testSubmitted}
                        className={testSubmitted 
                          ? (testAnswers[testIndex] && isAnswerCorrect(testAnswers[testIndex], [testQuestions[testIndex].answer], studySettings.lenientTolerance)
                            ? "border-green-500 bg-green-50 dark:bg-green-950/30" 
                            : "border-red-500 bg-red-50 dark:bg-red-950/30")
                          : ""
                        }
                      />
                      {testSubmitted && testAnswers[testIndex] && !isAnswerCorrect(testAnswers[testIndex], [testQuestions[testIndex].answer], studySettings.lenientTolerance) && (
                        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                          <p className="text-xs uppercase tracking-wide text-green-700 dark:text-green-400 mb-1">Correct answer:</p>
                          <p className="font-semibold text-green-800 dark:text-green-300">{testQuestions[testIndex].answer}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Multiple choice mode */
                    <>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {testQuestions[testIndex].options.map((option, optIdx) => {
                          const isSelected = testAnswers[testIndex] === option;
                          const isCorrectAnswer = isAnswerCorrect(option, [testQuestions[testIndex].answer], studySettings.lenientTolerance);
                          
                          let buttonVariant: "outline" | "default" | "destructive" = "outline";
                          let extraClasses = "";
                          
                          if (testSubmitted) {
                            if (isCorrectAnswer) {
                              buttonVariant = "default";
                              extraClasses = "bg-green-600 hover:bg-green-600 border-green-600 text-white";
                            } else if (isSelected && !isCorrectAnswer) {
                              buttonVariant = "destructive";
                            }
                          } else if (isSelected) {
                            extraClasses = "border-primary bg-primary/10 ring-2 ring-primary/30";
                          }
                          
                          return (
                            <Button
                              key={`${option}-${optIdx}`}
                              variant={buttonVariant}
                              onClick={() => handleTestSelect(option)}
                              disabled={testSubmitted}
                              className={`justify-start text-left h-auto py-3 px-4 whitespace-normal ${extraClasses}`}
                            >
                              <span className="font-semibold mr-2 text-muted-foreground">{String.fromCharCode(65 + optIdx)}.</span>
                              {option}
                            </Button>
                          );
                        })}
                      </div>
                      
                      {/* Show correct answer in review mode if user was wrong */}
                      {testSubmitted && testAnswers[testIndex] && !isAnswerCorrect(testAnswers[testIndex], [testQuestions[testIndex].answer], studySettings.lenientTolerance) && (
                        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                          <p className="text-xs uppercase tracking-wide text-green-700 dark:text-green-400 mb-1">Correct answer:</p>
                          <p className="font-semibold text-green-800 dark:text-green-300">{testQuestions[testIndex].answer}</p>
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Navigation and submit */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <Button 
                      variant="outline" 
                      onClick={handleTestPrev}
                      disabled={testIndex === 0}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Previous
                    </Button>
                    
                    <div className="flex gap-2">
                      {!testSubmitted && answeredCount === testQuestions.length && (
                        <Button onClick={handleTestSubmit} className="bg-primary">
                          Submit Test
                        </Button>
                      )}
                      
                      {testIndex < testQuestions.length - 1 ? (
                        <Button variant="outline" onClick={handleTestNext}>
                          Next
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      ) : testSubmitted ? (
                        <Button variant="outline" onClick={() => setTestSeed(prev => prev + 1)}>
                          <Shuffle className="mr-2 h-4 w-4" />
                          Try again
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  
                  {/* Final results in review mode */}
                  {testSubmitted && testIndex === testQuestions.length - 1 && (
                    <div className="text-center p-4 rounded-xl bg-muted/50 space-y-2">
                      <p className="text-2xl font-bold text-foreground">{testScore} / {testQuestions.length}</p>
                      <p className="text-sm text-muted-foreground">
                        {testScore === testQuestions.length ? "Perfect score! 🎉" : 
                         testScore >= testQuestions.length * 0.8 ? "Great job! 👏" :
                         testScore >= testQuestions.length * 0.6 ? "Good effort! Keep practicing." :
                         "Keep studying, you'll improve!"}
                      </p>
                    </div>
                  )}
                </Card>
              ) : (
                <Card className="p-6 text-center text-muted-foreground">Not enough words to generate a test.</Card>
              )}
            </TabsContent>

            <TabsContent
              value="match"
              className="mt-6 space-y-4 focus-visible:outline-none focus-visible:ring-0 animate-fade-in"
              forceMount
              hidden={activeTab !== "match"}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground items-center">
                  <Badge variant="outline">Matches: {matchStats.matches}</Badge>
                  <Badge variant="outline">Moves: {matchStats.moves}</Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {secondsElapsed}s
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setMatchSeed(prev => prev + 1)} disabled={!filteredWords.length}>
                    <Repeat className="mr-2 h-4 w-4" />
                    New round
                  </Button>
                </div>
              </div>

              {matchCards.length ? (
                <>
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                    {matchCards.map((card, index) => (
                      <Card
                        key={card.id}
                        onClick={() => handleMatchClick(index)}
                        className={`p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                          card.matched
                            ? "border-green-500 bg-green-50 dark:bg-green-950/40"
                            : card.revealed
                              ? "border-primary shadow-sm"
                              : "hover:border-primary/60"
                        }`}
                      >
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                          {card.type === "word" ? "Word" : "Definition"}
                        </div>
                        <div className="text-base font-semibold leading-snug line-clamp-3">{card.revealed || card.matched ? card.content : "Tap to reveal"}</div>
                      </Card>
                    ))}
                  </div>
                  {allMatched && (
                    <div className="flex items-center gap-2 text-green-600 text-sm mt-2">
                      <Pointer className="h-4 w-4" />
                      Perfect! Start another round to keep matching.
                    </div>
                  )}
                </>
              ) : (
                <Card className="p-6 text-center text-muted-foreground">Add more words or clear your search to start matching.</Card>
              )}
            </TabsContent>

            <TabsContent
              value="browse"
              className="mt-6 focus-visible:outline-none focus-visible:ring-0 animate-fade-in"
              forceMount
              hidden={activeTab !== "browse"}
            >
              {/* Search bar for Browse tab */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search any word or definition..."
                    className="w-full pl-10 bg-background"
                  />
                </div>
                <Button variant="outline" onClick={() => setQuery("")} disabled={!query}>
                  Clear
                </Button>
              </div>
              
              <ScrollArea className="h-[60vh] pr-4">
                <div className="grid md:grid-cols-2 gap-3">
                  {filteredWords.map(word => {
                    const state = progress[getWordId(word)];
                    return (
                      <Card key={`${word.setId}-${word.word}`} className="p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-lg leading-tight">{word.word}</div>
                            <p className="text-sm text-muted-foreground leading-relaxed">{word.definition}</p>
                          </div>
                          <Badge
                            variant={
                              state?.status === "mastered"
                                ? "secondary"
                                : state?.status === "learning"
                                  ? "outline"
                                  : "default"
                            }
                            className="text-xs shrink-0 capitalize"
                          >
                            {state?.status ?? "new"}
                          </Badge>
                        </div>
                      </Card>
                    );
                  })}

                  {!filteredWords.length && (
                    <div className="col-span-2 text-center text-muted-foreground py-10">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mx-auto mb-3">
                        <Search className="h-6 w-6" />
                      </div>
                      <p>No words match your search yet.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
            </div>
          </Tabs>
        </Card>
      </main>
    </div>
  );
};

export default Vocab;
