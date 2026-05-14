import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Lightbulb } from "lucide-react";
import { DraggableWindow } from "@/components/DraggableWindow";
import { StepByStepExplanation } from "@/components/question/StepByStepExplanation";
import { renderMixedContent } from "@/lib/text/mathRendering";
import { normalizeReadingDisplayText } from "@/lib/text/readingTextNormalization";
import type { ExplanationData } from "@/lib/explanationApi";

interface ExplanationWindowProps {
  onSplitScreenChange?: (isSplit: boolean, windowId: string) => void;
  onSplitPositionChange?: (newPosition: number) => void;
  splitPosition?: number;
  compressed?: boolean;
  onFocus?: () => void;
  zIndex?: number;
  constrainToLeft?: number;
  isSidebarred?: boolean;
  onSidebarToggle?: (windowId: string, shouldBeSidebarred: boolean) => void;
  windowId?: string;
  correctAnswer?: string | null;
  rationale?: string | null;
  questionType?: "multiple-choice" | "free-response";
  choices?: { id: string; text?: string; image?: string }[];
  questionId?: string | number;
  // Question data for step-by-step explanation
  questionSection?: string;
  questionText?: string;
  questionDomain?: string;
  questionSkill?: string;
  questionDifficulty?: string | null;
  questionImages?: { src: string; alt: string }[];
}

export const ExplanationWindow = ({
  onSplitScreenChange,
  onSplitPositionChange,
  splitPosition = 50,
  compressed = false,
  onFocus,
  zIndex = 50,
  constrainToLeft,
  isSidebarred = false,
  onSidebarToggle,
  windowId = "explanation",
  correctAnswer,
  rationale,
  questionType,
  choices,
  questionId,
  questionSection,
  questionText,
  questionDomain,
  questionSkill,
  questionDifficulty,
  questionImages,
}: ExplanationWindowProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<ExplanationData | null>(null);
  const [aiChecked, setAiChecked] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [questionId]);

  // Probe for an AI-generated explanation. If one exists, prefer it over the
  // College Board rationale. App passes ids like `bank-{type}-{subject}-{rawId}`;
  // generated files are named `{rawId}.json` — strip the 3-token prefix.
  useEffect(() => {
    if (!questionId) {
      setAiExplanation(null);
      setAiChecked(true);
      return;
    }
    const fullId = String(questionId);
    const parts = fullId.split("-");
    const rawId = parts[0] === "bank" && parts.length > 3 ? parts.slice(3).join("-") : fullId;
    setAiChecked(false);
    setAiExplanation(null);
    fetch(`/explanations/${rawId}.json`)
      .then(r => r.ok ? r.text() : null)
      .then(text => {
        if (fullId !== String(questionId)) return;
        if (text && text.trimStart().startsWith("{")) {
          try {
            const json = JSON.parse(text);
            if (json?.steps?.length) setAiExplanation(json);
          } catch {/* ignore non-JSON SPA fallback */}
        }
        setAiChecked(true);
      })
      .catch(() => { if (fullId === String(questionId)) setAiChecked(true); });
  }, [questionId]);

  const handleToggle = () => {
    if (!isOpen) {
      // Opening — always enter sidebar mode immediately (batches with setIsOpen in React 18)
      if (onFocus) onFocus();
      if (onSplitScreenChange) onSplitScreenChange(true, windowId);
      if (onSidebarToggle) onSidebarToggle(windowId, true);
    } else if (isSidebarred) {
      if (onSplitScreenChange) onSplitScreenChange(false, windowId);
    }
    setIsOpen(prev => !prev);
  };

  // Build the question object for the explanation API
  const explanationQuestion = questionText && correctAnswer ? {
    section: questionSection || "Math",
    passage: questionText,
    choices: choices?.map(c => ({ label: c.id, text: c.text || "", image: c.image })),
    correctAnswer: correctAnswer,
    domain: questionDomain,
    skill: questionSkill,
    difficulty: questionDifficulty ?? undefined,
  } : null;
  const isMath = questionSection === "Math";
  const rationaleHtml = rationale
    ? renderMixedContent(isMath ? rationale : normalizeReadingDisplayText(rationale), {
        normalizeMath: isMath,
      })
    : "";

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleToggle} className="h-10">
        <Lightbulb className={compressed ? "h-4 w-4" : "mr-2 h-4 w-4"} />
        {!compressed && "Explanation"}
      </Button>
      <DraggableWindow
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Explanation"
        defaultWidth={420}
        defaultHeight={500}
        onSplitScreenChange={onSplitScreenChange}
        onSplitPositionChange={onSplitPositionChange}
        splitPosition={splitPosition}
        enableSplitScreen={true}
        diagonalResizeOnly={true}
        lockAspectRatio={true}
        windowId={windowId}
        onFocus={onFocus}
        zIndex={zIndex}
        constrainToLeft={constrainToLeft}
        isSidebarred={isSidebarred}
        onSidebarToggle={onSidebarToggle}
      >
        <div className="w-full h-full flex flex-col overflow-hidden">
          {aiExplanation && explanationQuestion ? (
            <StepByStepExplanation
              questionId={(() => {
                const f = String(questionId || "");
                const p = f.split("-");
                return p[0] === "bank" && p.length > 3 ? p.slice(3).join("-") : f;
              })()}
              question={explanationQuestion}
              questionImages={questionImages}
            />
          ) : aiChecked && rationaleHtml ? (
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {correctAnswer && (
                <div className="mb-3 inline-flex rounded-md border border-border bg-muted/30 px-2 py-1 text-xs font-medium text-muted-foreground">
                  Answer: {correctAnswer}
                </div>
              )}
              <div
                className="question-html break-words prose prose-stone max-w-none text-sm leading-7 text-foreground dark:prose-invert [&_img]:my-3 [&_img]:block [&_img]:max-w-full [&_img]:h-auto [&_img]:mx-auto [&_img]:object-contain"
                dangerouslySetInnerHTML={{ __html: rationaleHtml }}
              />
            </div>
          ) : aiChecked ? (
            <div className="flex-1 w-full flex items-center justify-center">
              <p className="text-muted-foreground text-sm">No explanation available.</p>
            </div>
          ) : null}
        </div>
      </DraggableWindow>
    </>
  );
};
