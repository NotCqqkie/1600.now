import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Lightbulb } from "lucide-react";
import { DraggableWindow } from "@/components/DraggableWindow";
import { StepByStepExplanation } from "@/components/question/StepByStepExplanation";
import { renderMixedContent } from "@/lib/text/mathRendering";
import { normalizeReadingDisplayText } from "@/lib/text/readingTextNormalization";
import { normalizeExplanationData } from "@/lib/explanationApi";

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
  correctAnswer?: string | null;
  rationale?: string | null;
  questionId?: string | number;
  questionSection?: string;
  questionText?: string;
  windowPortalContainer?: HTMLElement | null;
  windowBoundsElement?: HTMLElement | null;
  contentSplitExitPosition?: number;
}

const EXPLANATION_WINDOW_ID = "explanation";

const getExplanationLookupId = (fullId: string) => {
  const parts = fullId.split("-");
  return parts[0] === "bank" && parts.length > 3 ? parts.slice(3).join("-") : fullId;
};

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
  correctAnswer,
  rationale,
  questionId,
  questionSection,
  questionText,
  windowPortalContainer,
  windowBoundsElement,
  contentSplitExitPosition,
}: ExplanationWindowProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasStructuredExplanation, setHasStructuredExplanation] = useState(false);
  const [explanationChecked, setExplanationChecked] = useState(false);
  const [searchParams] = useSearchParams();
  const autoExplain = searchParams.get("autoExplain") === "1";
  const autoOpenedRef = useRef(false);
  const windowId = EXPLANATION_WINDOW_ID;
  const shouldOpenInSidebar = !compressed;
  const rawQuestionId = typeof questionId === "string" || typeof questionId === "number"
    ? getExplanationLookupId(String(questionId))
    : "";
  const correctAnswerText = typeof correctAnswer === "string" ? correctAnswer.trim() : "";
  const renderCorrectAnswerBadge = () =>
    correctAnswerText ? (
      <div className="mb-3 inline-flex rounded-md border border-border bg-muted/30 px-2 py-1 text-xs font-medium text-muted-foreground">
        Correct answer: {correctAnswerText}
      </div>
    ) : null;

  useEffect(() => {
    setIsOpen(false);
    autoOpenedRef.current = false;
  }, [questionId]);
  useEffect(() => {
    if (!autoExplain || autoOpenedRef.current) return;
    if (!explanationChecked) return;
    autoOpenedRef.current = true;
    if (onFocus) onFocus();
    if (shouldOpenInSidebar) {
      if (onSplitScreenChange) onSplitScreenChange(true, windowId);
      if (onSidebarToggle) onSidebarToggle(windowId, true);
    }
    setIsOpen(true);
  }, [autoExplain, explanationChecked, onFocus, onSplitScreenChange, onSidebarToggle, shouldOpenInSidebar, windowId]);

  useEffect(() => {
    if (!questionId) {
      setHasStructuredExplanation(false);
      setExplanationChecked(true);
      return;
    }
    const fullId = String(questionId);
    setExplanationChecked(false);
    setHasStructuredExplanation(false);
    fetch(`/explanations/${rawQuestionId}.json`)
      .then(response => response.ok ? response.text() : null)
      .then(text => {
        if (fullId !== String(questionId)) return;
        if (text && text.trimStart().startsWith("{")) {
          try {
            const json = JSON.parse(text);
            const normalized = normalizeExplanationData(json);
            if (normalized) setHasStructuredExplanation(true);
          } catch {
            setHasStructuredExplanation(false);
          }
        }
        setExplanationChecked(true);
      })
      .catch(() => { if (fullId === String(questionId)) setExplanationChecked(true); });
  }, [questionId, rawQuestionId]);

  const handleToggle = () => {
    if (!isOpen) {
      if (onFocus) onFocus();
      if (shouldOpenInSidebar) {
        if (onSplitScreenChange) onSplitScreenChange(true, windowId);
        if (onSidebarToggle) onSidebarToggle(windowId, true);
      }
    } else if (isSidebarred) {
      if (onSplitScreenChange) onSplitScreenChange(false, windowId);
    }
    setIsOpen(prev => !prev);
  };
  const explanationQuestion = questionText && correctAnswerText ? {
    correctAnswer: correctAnswerText,
  } : null;
  const isMath = questionSection === "Math";
  const rationaleHtml = rationale
    ? renderMixedContent(isMath ? rationale : normalizeReadingDisplayText(rationale), {
        normalizeMath: isMath,
      })
    : "";

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleToggle} className={compressed ? "h-10 w-10 px-0" : "h-10"}>
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
        diagonalResizeOnly={true}
        lockAspectRatio={true}
        windowId={windowId}
        onFocus={onFocus}
        zIndex={zIndex}
        constrainToLeft={constrainToLeft}
        isSidebarred={isSidebarred}
        onSidebarToggle={onSidebarToggle}
        portalContainer={windowPortalContainer}
        boundsElement={windowBoundsElement}
        contentSplitExitPosition={contentSplitExitPosition}
      >
        <div className="w-full h-full flex flex-col overflow-hidden">
          {hasStructuredExplanation && explanationQuestion ? (
            <StepByStepExplanation
              questionId={rawQuestionId}
              correctAnswer={explanationQuestion.correctAnswer}
            />
          ) : explanationChecked && rationaleHtml ? (
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {renderCorrectAnswerBadge()}
              <div
                className="question-html break-words prose prose-stone max-w-none text-sm leading-7 text-foreground dark:prose-invert [&_img]:my-3 [&_img]:block [&_img]:max-w-full [&_img]:h-auto [&_img]:mx-auto [&_img]:object-contain"
                dangerouslySetInnerHTML={{ __html: rationaleHtml }}
              />
            </div>
          ) : explanationChecked ? (
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {renderCorrectAnswerBadge()}
              <div className="flex min-h-[180px] items-center justify-center">
                <p className="text-muted-foreground text-sm">No explanation available.</p>
              </div>
            </div>
          ) : null}
        </div>
      </DraggableWindow>
    </>
  );
};
