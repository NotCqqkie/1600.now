import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QuestionNav } from "@/components/QuestionNav";
import { FormulaSheetDialog } from "@/components/FormulaSheetDialog";
import { DesmosDialog } from "@/components/DesmosDialog";
import { ExplanationDialog } from "@/components/ExplanationDialog";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
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
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Home
              </Button>
              <div className="h-6 w-px bg-border" />
              <h1 className="text-xl font-semibold">
                Question {questionNumber} of 100
              </h1>
            </div>
            <div className="flex gap-2">
              <FormulaSheetDialog />
              <DesmosDialog />
              <ExplanationDialog />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto p-8">
          {/* Question Content */}
          <div className="mb-8">
            <div className="prose prose-lg max-w-none">
              <div id="question-content">
                {/* Example LaTeX - Replace this with your actual question */}
                <p className="text-lg mb-4">
                  {"$$\\text{Solve for } x: \\quad 2x^2 + 5x - 3 = 0$$"}
                </p>
                <p className="text-base text-muted-foreground">
                  Use the quadratic formula or any other method to find the value(s) of x.
                </p>
              </div>
            </div>
          </div>

          {/* Answer Input Area - Customize based on question type */}
          <div className="mb-8 p-6 bg-muted rounded-lg">
            <label className="block text-sm font-medium mb-2">
              Your Answer:
            </label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-input rounded-md bg-background"
              placeholder="Enter your answer here..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button 
              onClick={handleCheck}
              className="flex-1"
              disabled={checked}
            >
              <Check className="mr-2 h-4 w-4" />
              {checked ? "Checked" : "Check Answer"}
            </Button>
          </div>
        </Card>

        {/* Navigation */}
        <div className="max-w-4xl mx-auto mt-8 flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={questionNumber === 1}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          <Button
            onClick={handleNext}
            disabled={questionNumber === 100}
          >
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </main>

      {/* Question Navigation Bar */}
      <QuestionNav currentQuestion={questionNumber} />
    </div>
  );
};

export default Question;
