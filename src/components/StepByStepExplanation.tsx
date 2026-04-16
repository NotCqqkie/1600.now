import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronUp,
  ChevronDown,
  Loader2,
  Lightbulb,
  AlertTriangle,
} from "lucide-react";
import { renderMixedContent } from "@/lib/mathRendering";
import {
  generateExplanation,
  getCachedExplanation,
  type ExplanationData,
  type ExplanationStep,
} from "@/lib/explanationApi";
import { InlineDesmos } from "./InlineDesmos";
import "katex/dist/katex.min.css";

// ── Main component ───────────────────────────────────────────────────
interface StepByStepExplanationProps {
  questionId: string;
  question: {
    section: string;
    passage: string;
    questionText?: string | null;
    choices?: { label: string; text: string; image?: string }[];
    correctAnswer: string;
    domain?: string;
    skill?: string;
    difficulty?: string;
    isFillInBlank?: boolean;
  };
  questionImages?: { src: string; alt: string }[];
}

export function StepByStepExplanation({ questionId, question, questionImages }: StepByStepExplanationProps) {
  const [data, setData] = useState<ExplanationData | null>(null);
  const [revealedUpTo, setRevealedUpTo] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [animKey, setAnimKey] = useState(0);
  const isWheelCooldownRef = useRef(false);

  useEffect(() => {
    const cached = getCachedExplanation(questionId);
    if (cached) {
      setData(cached);
      setRevealedUpTo(0);
      setCurrentStep(0);
      setError(null);
    } else {
      setData(null);
      setRevealedUpTo(0);
      setCurrentStep(0);
    }
  }, [questionId]);

  const goToStep = useCallback((target: number, dir: 1 | -1) => {
    setDirection(dir);
    setCurrentStep(target);
    setAnimKey(k => k + 1);
  }, []);

  const handleNext = useCallback(() => {
    if (!data) return;
    if (currentStep < revealedUpTo) {
      goToStep(currentStep + 1, 1);
    } else if (revealedUpTo < data.steps.length - 1) {
      const next = revealedUpTo + 1;
      setRevealedUpTo(next);
      goToStep(next, 1);
    }
  }, [data, currentStep, revealedUpTo, goToStep]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      goToStep(currentStep - 1, -1);
    }
  }, [currentStep, goToStep]);

  // Wheel / trackpad snap: one page per scroll gesture
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (isWheelCooldownRef.current) return;
    const threshold = 30;
    if (Math.abs(e.deltaY) < threshold) return;
    isWheelCooldownRef.current = true;
    if (e.deltaY > 0) handleNext();
    else handlePrev();
    setTimeout(() => { isWheelCooldownRef.current = false; }, 400);
  }, [handleNext, handlePrev]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const imageUrls: string[] = [];
      if (questionImages) {
        for (const img of questionImages) {
          imageUrls.push(img.src);
        }
      }
      if (question.choices) {
        for (const c of question.choices) {
          if (c.image) imageUrls.push(c.image);
        }
      }
      const result = await generateExplanation(questionId, question, imageUrls);
      setData(result);
      setRevealedUpTo(0);
      setCurrentStep(0);
    } catch (err: any) {
      setError(err.message || "Failed to generate explanation");
    } finally {
      setLoading(false);
    }
  };

  // ── Not generated yet ────────────────────────────────────────────
  if (!data && !loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8 px-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Lightbulb className="w-7 h-7 text-primary" />
        </div>
        <div className="text-center">
          <h3 className="text-base font-semibold">Step-by-Step Walkthrough</h3>
          <p className="text-xs text-muted-foreground mt-1">
            AI-powered breakdown of this question
          </p>
        </div>
        <Button onClick={handleGenerate} className="gap-2">
          <Lightbulb className="w-4 h-4" />
          Generate Explanation
        </Button>
        {error && (
          <div className="flex items-center gap-2 text-destructive text-xs mt-2 px-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        )}
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground animate-pulse">Generating explanation...</p>
      </div>
    );
  }

  if (!data) return null;

  const totalSteps = data.steps.length;
  const isAllRevealed = revealedUpTo >= totalSteps - 1;
  const isOnLastRevealed = currentStep === revealedUpTo;
  const step = data.steps[currentStep];

  return (
    <div className="flex flex-col h-full">
      {/* Header — correct answer badge + step dots */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-background/95 backdrop-blur-sm shrink-0">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          Answer: {data.correctAnswer}
        </Badge>
        <div className="flex gap-1.5">
          {data.steps.map((_, i) => (
            <button
              key={i}
              onClick={() => { if (i <= revealedUpTo) goToStep(i, i > currentStep ? 1 : -1); }}
              className={`rounded-full transition-all duration-300 ${
                i === currentStep
                  ? "w-3 h-1.5 bg-primary"
                  : i <= revealedUpTo
                  ? "w-1.5 h-1.5 bg-primary/40 hover:bg-primary/70 cursor-pointer"
                  : "w-1.5 h-1.5 bg-muted-foreground/20 cursor-default"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Single full-page step view — one step visible at a time, fills entire panel */}
      <div
        className="flex-1 overflow-hidden relative"
        onWheel={handleWheel}
      >
        <div
          key={animKey}
          className="absolute inset-0 overflow-y-auto px-3 py-4 step-animate"
          style={{ "--step-dir": direction } as React.CSSProperties}
        >
          <StepContent step={step} stepIndex={currentStep} totalSteps={totalSteps} />
        </div>
      </div>

      {/* Navigation footer */}
      <div className="px-3 py-2 border-t border-border/50 shrink-0 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePrev}
          disabled={currentStep === 0}
          className="flex-1 gap-1"
        >
          <ChevronUp className="w-4 h-4" />
          Back
        </Button>

        {isOnLastRevealed && isAllRevealed ? (
          <span className="flex-1 text-center text-xs text-muted-foreground">
            End of explanation
          </span>
        ) : (
          <Button onClick={handleNext} size="sm" className="flex-1 gap-1">
            {isOnLastRevealed ? "Next Step" : "Next"}
            <ChevronDown className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Strip reasoning artifacts from LLM output ──────────────────────
function cleanStepContent(raw: string): string {
  let s = raw;
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, "");
  s = s.replace(/<\/?think>/gi, "");
  s = s.replace(/(?:^|\n)>\s*(?:Reasoning|Think|Note to self|Internal)[^\n]*/gi, "");
  s = s.replace(/\*\*(?:Reasoning|Internal note)\*\*:?[^\n]*/gi, "");
  return s.trim();
}

// ── Single step renderer ─────────────────────────────────────────────
// Content is from our own API response (renderMixedContent sanitizes via KaTeX rendering)
function StepContent({ step, stepIndex, totalSteps }: { step: ExplanationStep; stepIndex: number; totalSteps: number }) {
  const cleaned = cleanStepContent(step.content);
  const contentHtml = renderMixedContent(cleaned, { convertTexLineBreaks: false });
  const titleHtml = renderMixedContent(step.title.replace(/^Step\s*\d+\s*:\s*/i, ""), { convertTexLineBreaks: false });

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0 mt-0.5">
          {stepIndex + 1}
        </div>
        <div>
          <h3 className="font-semibold text-base leading-snug" dangerouslySetInnerHTML={{ __html: titleHtml }} />
          <span className="text-xs text-muted-foreground">Step {stepIndex + 1} of {totalSteps}</span>
        </div>
      </div>

      <div
        className="text-[15px] leading-snug pl-9 explanation-content"
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />

      {step.formula && (
        <div className="ml-9 p-2 rounded-lg bg-primary/5 border border-primary/20">
          <div className="text-center text-base" dangerouslySetInnerHTML={{ __html: renderMixedContent(step.formula, { convertTexLineBreaks: false }) }} />
        </div>
      )}

      {step.desmosExpressions && step.desmosExpressions.length > 0 && (
        <div className="ml-9 mt-2">
          <InlineDesmos expressions={step.desmosExpressions} />
        </div>
      )}
    </div>
  );
}
