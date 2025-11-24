import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NavigationSheet } from "@/components/NavigationSheet";
import { FormulaSheetDialog } from "@/components/FormulaSheetDialog";
import { DesmosDialog } from "@/components/DesmosDialog";
import { ExplanationDialog } from "@/components/ExplanationDialog";
import { MultipleChoiceQuestion } from "@/components/MultipleChoiceQuestion";
import { ChevronLeft, ChevronRight, Check, Bookmark, Slash } from "lucide-react";
import { toast } from "sonner";

declare global {
  interface Window {
    MathJax: any;
  }
}

const Question = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const questionNumber = parseInt(id || "1");
  const [checked, setChecked] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [markedForReview, setMarkedForReview] = useState(false);
  const [strikeoutMode, setStrikeoutMode] = useState(false);

  // Example multiple choice options
  const choices = [
    { id: "A", text: "-3" },
    { id: "B", text: "6" },
    { id: "C", text: "18" },
    { id: "D", text: "30" },
  ];

  useEffect(() => {
    // Load MathJax
    if (!window.MathJax) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
      script.async = true;
      document.head.appendChild(script);
    } else {
      window.MathJax.typesetPromise?.();
    }
    setChecked(false);
    setSelectedAnswer("");
  }, [questionNumber]);

  const handlePrevious = () => {
    if (questionNumber > 1) {
      navigate(`/question/${questionNumber - 1}`);
    }
  };

  const handleNext = () => {
    if (questionNumber < 100) {
      navigate(`/question/${questionNumber + 1}`);
    }
  };

  const handleCheck = () => {
    setChecked(true);
    toast.success("Answer checked! Add your answer verification logic here.");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Home
            </Button>
            <div className="flex gap-2">
              <FormulaSheetDialog />
              <DesmosDialog />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto p-8 relative">
          {/* Question Number Badge */}
          <div className="absolute -top-4 -left-4 bg-foreground text-background rounded-full w-12 h-12 flex items-center justify-center font-bold text-xl shadow-lg">
            {questionNumber}
          </div>

          {/* Mark for Review and Strikeout */}
          <div className="flex justify-end gap-2 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMarkedForReview(!markedForReview)}
              className={markedForReview ? "text-destructive" : ""}
            >
              <Bookmark className={markedForReview ? "fill-current" : ""} />
              Mark for Review
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStrikeoutMode(!strikeoutMode)}
              className={strikeoutMode ? "bg-muted" : ""}
            >
              <Slash className="h-4 w-4" />
            </Button>
          </div>

          {/* Question Content */}
          <div className="mb-8">
            <div className="prose prose-lg max-w-none">
              <div id="question-content">
                {/* Example LaTeX - Replace this with your actual question */}
                <p className="text-lg mb-4">
                  {"$$3x = 12$$"}
                  {"$$-3x + y = -6$$"}
                </p>
                <p className="text-base text-foreground mb-6">
                  The solution to the given system of equations is (x, y). What is the value of y?
                </p>
              </div>
            </div>
          </div>

          {/* Multiple Choice Answer Area */}
          <MultipleChoiceQuestion 
            choices={choices}
            selectedAnswer={selectedAnswer}
            onAnswerChange={setSelectedAnswer}
          />
        </Card>

        {/* Bottom Navigation */}
        <div className="max-w-4xl mx-auto mt-8 flex justify-between items-center">
          {/* Left: Previous Button */}
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={questionNumber === 1}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          {/* Center: Navigation Sheet */}
          <NavigationSheet currentQuestion={questionNumber} />

          {/* Right: Explanation, Check, Next */}
          <div className="flex gap-2">
            <ExplanationDialog />
            <Button 
              onClick={handleCheck}
              disabled={checked}
            >
              <Check className="mr-2 h-4 w-4" />
              Check
            </Button>
            <Button
              onClick={handleNext}
              disabled={questionNumber === 100}
            >
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Question;
