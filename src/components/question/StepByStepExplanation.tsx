import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown } from "lucide-react";
import { renderMixedContent } from "@/lib/text/mathRendering";
import {
  getCachedExplanation,
  normalizeExplanationData,
  type ExplanationData,
  type ExplanationStep,
} from "@/lib/explanationApi";
import { InlineDesmos } from "@/components/tools/InlineDesmos";
import type { QuestionImageDisplaySize } from "@/data/questionImageSizing.generated";
import "katex/dist/katex.min.css";
interface StepByStepExplanationProps {
  questionId: string;
  question: {
    section: string;
    passage: string;
    questionText?: string | null;
    choices?: { label: string; text: string; image?: string; imageDisplaySize?: QuestionImageDisplaySize }[];
    correctAnswer: string;
    domain?: string;
    skill?: string;
    difficulty?: string;
    isFillInBlank?: boolean;
  };
  questionImages?: { src: string; alt: string; displaySize?: QuestionImageDisplaySize }[];
}

export function StepByStepExplanation({ questionId, question }: StepByStepExplanationProps) {
  const [data, setData] = useState<ExplanationData | null>(null);
  const [revealedUpTo, setRevealedUpTo] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    const cached = normalizeExplanationData(getCachedExplanation(questionId));
    if (cached) {
      setData(cached);
      setRevealedUpTo(0);
      setCurrentStep(0);
      return;
    }
    setData(null);
    setRevealedUpTo(0);
    setCurrentStep(0);
    const id = questionId;
    fetch(`/explanations/${questionId}.json`)
      .then(response => response.ok ? response.json() : null)
      .then(payload => {
        const normalized = normalizeExplanationData(payload);
        if (normalized && id === questionId) setData(normalized);
      })
      .catch(() => {
        if (id === questionId) setData(null);
      });
  }, [questionId]);
  const [searchParams] = useSearchParams();
  const autoStep = searchParams.get("autoStep") === "1";
  const userTookOverRef = useRef(false);

  const goToStep = useCallback((target: number, dir: 1 | -1) => {
    setDirection(dir);
    setCurrentStep(target);
    setAnimKey(animationKey => animationKey + 1);
  }, []);

  const handleNext = useCallback(() => {
    if (!data) return;
    userTookOverRef.current = true;
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
      userTookOverRef.current = true;
      goToStep(currentStep - 1, -1);
    }
  }, [currentStep, goToStep]);

  useEffect(() => {
    if (!data || !autoStep || userTookOverRef.current) return;
    if (currentStep >= data.steps.length - 1) return;
    const timerId = setTimeout(() => {
      if (userTookOverRef.current) return;
      setRevealedUpTo((prev) => Math.max(prev, currentStep + 1));
      goToStep(currentStep + 1, 1);
    }, 1400);
    return () => clearTimeout(timerId);
  }, [data, autoStep, currentStep, goToStep]);

  if (!data || data.steps.length === 0) return null;

  const totalSteps = data.steps.length;
  const isAllRevealed = revealedUpTo >= totalSteps - 1;
  const isOnLastRevealed = currentStep === revealedUpTo;
  const step = data.steps[Math.min(currentStep, totalSteps - 1)];
  const correctAnswer = question.correctAnswer || data.correctAnswer;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-background/95 backdrop-blur-sm shrink-0">
        {correctAnswer ? (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            Correct answer: {correctAnswer}
          </Badge>
        ) : <span />}
        <div className="flex gap-1.5">
          {data.steps.map((_, stepIndex) => (
            <button
              key={stepIndex}
              onClick={() => { if (stepIndex <= revealedUpTo) goToStep(stepIndex, stepIndex > currentStep ? 1 : -1); }}
              className={`rounded-full transition-all duration-300 ${
                stepIndex === currentStep
                  ? "w-3 h-1.5 bg-primary"
                  : stepIndex <= revealedUpTo
                  ? "w-1.5 h-1.5 bg-primary/40 hover:bg-primary/70 cursor-pointer"
                  : "w-1.5 h-1.5 bg-muted-foreground/20 cursor-default"
              }`}
            />
          ))}
        </div>
      </div>

      <div
        className="flex-1 overflow-hidden relative"
      >
        <div
          key={animKey}
          className="absolute inset-0 overflow-y-auto px-3 py-4 step-animate"
          style={{ "--step-dir": direction } as React.CSSProperties}
        >
          <StepContent step={step} stepIndex={currentStep} totalSteps={totalSteps} />
        </div>
      </div>

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
function cleanStepContent(raw: unknown): string {
  let s = typeof raw === "string" ? raw : "";
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, "");
  s = s.replace(/<\/?think>/gi, "");
  s = s.replace(/(?:^|\n)>\s*(?:Reasoning|Think|Note to self|Internal)[^\n]*/gi, "");
  s = s.replace(/\*\*(?:Reasoning|Internal note)\*\*:?[^\n]*/gi, "");
  s = s.replace(/\s*[—–-]+\s*<strong>[A-Z]<\/strong>\s+is\s+(?:correct|the\s+answer|right)\.?/gi, ".");
  s = s.replace(/\s*[—–-]+\s*[A-Z]\s+is\s+(?:correct|the\s+answer|right)\.?/g, ".");
  s = s.replace(/(<\/strong>)\s*[—–-]+\s*[^<.]{1,30}?\s+is\s+(?:correct|the\s+answer|right)\.?/gi, "$1.");
  s = s.replace(/\b(matches\s+choice\s+)([A-Z])\b(?!<\/strong>)/gi, "$1<strong>$2</strong>");
  return s.trim();
}
function StepContent({ step, stepIndex, totalSteps }: { step: ExplanationStep; stepIndex: number; totalSteps: number }) {
  const cleaned = cleanStepContent(step.content);
  const contentHtml = renderMixedContent(cleaned, { convertTexLineBreaks: false });
  const title = typeof step.title === "string" ? step.title : `Step ${stepIndex + 1}`;
  const titleHtml = renderMixedContent(title.replace(/^Step\s*\d+\s*:\s*/i, ""), { convertTexLineBreaks: false });

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

      {step.formula && (
        <div className="ml-9 p-2 rounded-lg bg-primary/5 border border-primary/20">
          <div className="text-center text-base" dangerouslySetInnerHTML={{ __html: renderMixedContent(step.formula, { convertTexLineBreaks: false }) }} />
        </div>
      )}

      <div
        className="text-[15px] leading-snug pl-9 explanation-content"
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />

      {step.desmosExpressions && step.desmosExpressions.length > 0 && (
        <div className="ml-9 mt-2">
          <InlineDesmos expressions={step.desmosExpressions} />
        </div>
      )}

      {step.desmosGraphs && step.desmosGraphs.length > 0 && (
        <div className="ml-9 mt-3 flex flex-col gap-4">
          {step.desmosGraphs.map((graph, graphIndex) => (
            <figure key={graphIndex} className="generated-graph-panel">
              <figcaption className="generated-graph-header">
                <span className="generated-graph-badge">Generated graph</span>
                {graph.label && <span className="generated-graph-title">{graph.label}</span>}
              </figcaption>
              <InlineDesmos expressions={graph.expressions} height={380} className="generated-graph-canvas" />
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
