import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StepByStepExplanation } from "@/components/StepByStepExplanation";
import { renderMixedContent } from "@/lib/mathRendering";
import { ChevronLeft, ChevronRight, BookOpen, Calculator, Lightbulb } from "lucide-react";
import "katex/dist/katex.min.css";

const TRIAL_QUESTIONS = [
  {
    id: "trial-math-1",
    section: "Math",
    domain: "Problem-Solving and Data Analysis",
    skill: "Ratios, rates, proportional relationships, and units",
    difficulty: "Easy",
    passage: "$s = 50 + 4t$\nThe equation gives the speed $s$, in miles per hour, of a certain car $t$ seconds after it began to accelerate. What is the speed, in miles per hour, of the car 5 seconds after it began to accelerate?",
    questionText: null,
    choices: [
      { label: "A", text: "50" },
      { label: "B", text: "54" },
      { label: "C", text: "55" },
      { label: "D", text: "70" },
    ],
    correctAnswer: "D",
  },
  {
    id: "trial-math-2",
    section: "Math",
    domain: "Advanced Math",
    skill: "Nonlinear functions",
    difficulty: "Easy",
    passage: "The function $f$ is defined by $f(x) = x^2 + 15$. What is the value of $f(2)$?",
    questionText: null,
    choices: [
      { label: "A", text: "2" },
      { label: "B", text: "15" },
      { label: "C", text: "17" },
      { label: "D", text: "19" },
    ],
    correctAnswer: "D",
  },
  {
    id: "trial-math-3",
    section: "Math",
    domain: "Algebra",
    skill: "Linear equations in one variable",
    difficulty: "Easy",
    passage: "$\\sqrt{w} + 34 = 40$\nWhat is the solution to the given equation?",
    questionText: null,
    choices: [
      { label: "A", text: "2" },
      { label: "B", text: "3" },
      { label: "C", text: "12" },
      { label: "D", text: "36" },
    ],
    correctAnswer: "D",
  },
  {
    id: "trial-math-4",
    section: "Math",
    domain: "Advanced Math",
    skill: "Equivalent expressions",
    difficulty: "Easy",
    passage: "An aquarium uses small and large tanks to temporarily hold a total of 37 fish. Each small tank holds 1 fish, and each large tank holds 2 fish. Which equation represents this situation, where $s$ is the number of small tanks and $b$ is the number of large tanks the aquarium uses?",
    questionText: null,
    choices: [
      { label: "A", text: "$s + 2b = 37$" },
      { label: "B", text: "$s + b = 37$" },
      { label: "C", text: "$2s + b = 37$" },
      { label: "D", text: "$2s + 2b = 37$" },
    ],
    correctAnswer: "A",
  },
  {
    id: "trial-math-5",
    section: "Math",
    domain: "Algebra",
    skill: "Linear inequalities in one or two variables",
    difficulty: "Medium",
    passage: "To win a game show, a contestant needs to score at least 100 total points from two rounds. Correct responses in the first round are worth 2 points each, and correct responses in the second round are worth 5 points each. Which inequality models this situation, where $f$ is the number of correct responses in the first round and $s$ is the number of correct responses in the second round?",
    questionText: null,
    choices: [
      { label: "A", text: "$f + s \\leq 100$" },
      { label: "B", text: "$2f + 5s \\geq 100$" },
      { label: "C", text: "$5f + s \\geq 100$" },
      { label: "D", text: "$5f + 2s \\leq 100$" },
    ],
    correctAnswer: "B",
  },
  {
    id: "trial-reading-1",
    section: "Reading and Writing",
    domain: "Craft and Structure",
    skill: "Words in Context",
    difficulty: "Easy",
    passage: "Which choice completes the text with the most logical and precise word or phrase?\nBecoming a member of the organization Indigenous Photograph has helped Sara Aliaga Ticona (Aymara) to ______ her work with an audience beyond Bolivia, where she's from. The organization's database of members is used by photography editors and others in the media industry around the world.",
    questionText: "Which choice completes the text with the most logical and precise word or phrase?",
    choices: [
      { label: "A", text: "share" },
      { label: "B", text: "split" },
      { label: "C", text: "challenge" },
      { label: "D", text: "examine" },
    ],
    correctAnswer: "A",
  },
  {
    id: "trial-reading-2",
    section: "Reading and Writing",
    domain: "Craft and Structure",
    skill: "Words in Context",
    difficulty: "Easy",
    passage: "Which choice completes the text with the most logical and precise word or phrase?\nSince the Hubble Space Telescope was launched into space in 1990, astronauts have needed to complete regular missions to repair the telescope and keep it working smoothly. Researchers hope that robots will soon be able to make these repairs. Employing robots instead of humans to make repairs will be helpful, as ______ astronauts to maintain the telescope can be expensive.",
    questionText: "Which choice completes the text with the most logical and precise word or phrase?",
    choices: [
      { label: "A", text: "straightening" },
      { label: "B", text: "relying on" },
      { label: "C", text: "reducing" },
      { label: "D", text: "forgetting about" },
    ],
    correctAnswer: "B",
  },
  {
    id: "trial-reading-3",
    section: "Reading and Writing",
    domain: "Craft and Structure",
    skill: "Words in Context",
    difficulty: "Easy",
    passage: "Which choice completes the text with the most logical and precise word or phrase?\nIn 1776, the United States sent Benjamin Franklin to France to try to win the country's support in the United States' fight for independence from Great Britain. Franklin was very popular in France. This ______ surely helped him to convince France to assist the United States.",
    questionText: "Which choice completes the text with the most logical and precise word or phrase?",
    choices: [
      { label: "A", text: "controversy" },
      { label: "B", text: "sincerity" },
      { label: "C", text: "esteem" },
      { label: "D", text: "thoughtfulness" },
    ],
    correctAnswer: "C",
  },
  {
    id: "trial-reading-4",
    section: "Reading and Writing",
    domain: "Craft and Structure",
    skill: "Words in Context",
    difficulty: "Medium",
    passage: "Which choice completes the text with the most logical and precise word or phrase?\nThe creation of Lotte Reiniger's 1926 animated film *The Adventures of Prince Achmed* was ______ process. Over the course of three years, Reiniger and her collaborators painstakingly made more than 250,000 individual images of hand-cut paper silhouettes and repeatedly had to invent entirely new methods and tools to create the special effects Reiniger envisioned.",
    questionText: "Which choice completes the text with the most logical and precise word or phrase?",
    choices: [
      { label: "A", text: "a haphazard" },
      { label: "B", text: "a contentious" },
      { label: "C", text: "an ineffectual" },
      { label: "D", text: "an arduous" },
    ],
    correctAnswer: "D",
  },
  {
    id: "trial-reading-5",
    section: "Reading and Writing",
    domain: "Craft and Structure",
    skill: "Text Structure and Purpose",
    difficulty: "Medium",
    passage: "Which choice best describes the function of the reference to Brown's biography in the text as a whole?\nThe following text is from Yung Wing's 1909 memoir *My Life in China and America*. Yung Wing was the first American college graduate of Chinese heritage; Phoebe Brown was the first prominent female hymn writer in the United States. I look back upon my acquaintance with Mrs. Phoebe H. Brown with a mingled feeling of respect and admiration. She certainly was a remarkable New England woman-a woman of surpassing strength of moral and religious character. Those who have had the rare privilege of reading her stirring biography, will, I am sure, bear me out in this statement. She went through the crucible of unprecedented adversities and trials of life and came out one of the rare shining lights that beautify the New England sky.",
    questionText: "Which choice best describes the function of the reference to Brown's biography in the text as a whole?",
    choices: [
      { label: "A", text: "It emphasizes that Brown's life has been a popular subject for writers because it was so remarkable." },
      { label: "B", text: "It suggests that other people who are familiar with Brown's life would share the author's view of her." },
      { label: "C", text: "It explains why Brown was unique amongst her peers." },
      { label: "D", text: "It describes the nature of the relationship between Yung and Brown." },
    ],
    correctAnswer: "B",
  },
];

export default function ExplanationTrial() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isChecked, setIsChecked] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const q = TRIAL_QUESTIONS[currentIndex];
  const isMath = q.section === "Math";

  const handleSelectAnswer = (label: string) => {
    if (isChecked) return;
    setSelectedAnswer(label);
  };

  const handleCheck = () => {
    if (!selectedAnswer) return;
    setIsChecked(true);
  };

  const handleNavigate = (idx: number) => {
    setCurrentIndex(idx);
    setSelectedAnswer(null);
    setIsChecked(false);
    setShowExplanation(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold">Step-by-Step Walkthrough Trial</h1>
            <Badge variant="secondary" className="text-xs">
              {currentIndex + 1} / {TRIAL_QUESTIONS.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            {TRIAL_QUESTIONS.map((tq, i) => (
              <button
                key={i}
                onClick={() => handleNavigate(i)}
                className={`w-8 h-8 rounded-md text-xs font-medium transition-all flex items-center justify-center ${
                  i === currentIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                }`}
              >
                {tq.section === "Math" ? (
                  <Calculator className="w-3.5 h-3.5" />
                ) : (
                  <BookOpen className="w-3.5 h-3.5" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Question */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={isMath ? "default" : "secondary"}>
                {q.section}
              </Badge>
              <Badge variant="outline">{q.domain}</Badge>
              <Badge variant="outline">{q.skill}</Badge>
              {q.difficulty && (
                <Badge
                  variant="outline"
                  className={
                    q.difficulty === "Easy"
                      ? "border-green-500/50 text-green-500"
                      : q.difficulty === "Medium"
                        ? "border-yellow-500/50 text-yellow-500"
                        : "border-red-500/50 text-red-500"
                  }
                >
                  {q.difficulty}
                </Badge>
              )}
            </div>

            {/* Passage - uses renderMixedContent for KaTeX, same as rest of app */}
            <div className="bg-card rounded-lg border border-border p-4">
              <div
                className="text-sm leading-relaxed prose-content"
                dangerouslySetInnerHTML={{ __html: renderMixedContent(q.passage) }}
              />
            </div>

            {/* Answer choices */}
            <div className="space-y-2">
              {q.choices.map((c) => {
                const isSelected = selectedAnswer === c.label;
                const isCorrect = c.label === q.correctAnswer;
                let choiceStyle = "border-border hover:border-primary/50 hover:bg-primary/5";

                if (isChecked) {
                  if (isCorrect) {
                    choiceStyle = "border-green-500 bg-green-500/10";
                  } else if (isSelected && !isCorrect) {
                    choiceStyle = "border-red-500 bg-red-500/10";
                  } else {
                    choiceStyle = "border-border opacity-50";
                  }
                } else if (isSelected) {
                  choiceStyle = "border-primary bg-primary/10";
                }

                return (
                  <button
                    key={c.label}
                    onClick={() => handleSelectAnswer(c.label)}
                    className={`w-full text-left p-3 rounded-lg border transition-all flex items-start gap-3 ${choiceStyle}`}
                  >
                    <span
                      className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-muted-foreground/30"
                      }`}
                    >
                      {c.label}
                    </span>
                    <span
                      className="text-sm pt-0.5"
                      dangerouslySetInnerHTML={{ __html: renderMixedContent(c.text) }}
                    />
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {!isChecked ? (
                <Button onClick={handleCheck} disabled={!selectedAnswer} className="gap-2">
                  Check Answer
                </Button>
              ) : (
                <Button
                  onClick={() => setShowExplanation(!showExplanation)}
                  variant={showExplanation ? "outline" : "default"}
                  className="gap-2"
                >
                  <Lightbulb className="w-4 h-4" />
                  {showExplanation ? "Hide Explanation" : "Show Step-by-Step"}
                </Button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="outline" size="icon"
                  onClick={() => handleNavigate(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline" size="icon"
                  onClick={() => handleNavigate(Math.min(TRIAL_QUESTIONS.length - 1, currentIndex + 1))}
                  disabled={currentIndex === TRIAL_QUESTIONS.length - 1}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Right: Step-by-step explanation */}
          <div
            className={`bg-card rounded-lg border border-border overflow-hidden transition-all ${
              showExplanation ? "opacity-100" : "opacity-40 pointer-events-none"
            }`}
            style={{ minHeight: 400 }}
          >
            {showExplanation ? (
              <StepByStepExplanation
                questionId={q.id}
                question={{
                  section: q.section,
                  passage: q.passage,
                  questionText: q.questionText,
                  choices: q.choices,
                  correctAnswer: q.correctAnswer,
                  domain: q.domain,
                  skill: q.skill,
                  difficulty: q.difficulty,
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-16 gap-3">
                <Lightbulb className="w-12 h-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Check your answer to unlock the step-by-step walkthrough
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
