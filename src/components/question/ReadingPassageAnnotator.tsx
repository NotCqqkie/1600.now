import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/text/sanitizeHtml";

type AnnotationColor = "yellow" | "green" | "blue" | "pink";

type PassageAnnotation = {
  id: string;
  start: number;
  end: number;
  color: AnnotationColor;
  text: string;
};

type FloatingPoint = {
  x: number;
  aboveY: number;
  belowY: number;
};

interface ReadingPassageAnnotatorProps {
  html: string;
  storageKey: string;
  enabled: boolean;
  className?: string;
  storageArea?: Storage;
}

const ANNOTATION_COLORS: Record<
  AnnotationColor,
  { label: string; fill: string; border: string; chip: string }
> = {
  yellow: {
    label: "Yellow",
    fill: "rgba(250, 204, 21, 0.38)",
    border: "rgba(202, 138, 4, 0.55)",
    chip: "bg-yellow-300",
  },
  green: {
    label: "Green",
    fill: "rgba(74, 222, 128, 0.32)",
    border: "rgba(22, 163, 74, 0.48)",
    chip: "bg-green-400",
  },
  blue: {
    label: "Blue",
    fill: "rgba(96, 165, 250, 0.32)",
    border: "rgba(37, 99, 235, 0.44)",
    chip: "bg-blue-400",
  },
  pink: {
    label: "Pink",
    fill: "rgba(244, 114, 182, 0.28)",
    border: "rgba(219, 39, 119, 0.4)",
    chip: "bg-pink-400",
  },
};

const clampPopupY = (y: number) => Math.max(16, y);
const POPUP_GAP = 8;
const POPUP_SHADOW = "shadow-[0_18px_40px_rgba(15,23,42,0.18)]";

const isAnnotationColor = (value: unknown): value is AnnotationColor =>
  value === "yellow" || value === "green" || value === "blue" || value === "pink";

const loadAnnotations = (storageArea: Storage, storageKey: string): PassageAnnotation[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = storageArea.getItem(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item): item is PassageAnnotation =>
          Boolean(item) &&
          typeof item.id === "string" &&
          typeof item.start === "number" &&
          typeof item.end === "number" &&
          item.end > item.start &&
          typeof item.text === "string" &&
          isAnnotationColor(item.color),
      )
      .sort((a, b) => a.start - b.start);
  } catch {
    return [];
  }
};

const saveAnnotations = (
  storageArea: Storage,
  storageKey: string,
  annotations: PassageAnnotation[],
) => {
  if (typeof window === "undefined") return;
  storageArea.setItem(storageKey, JSON.stringify(annotations));
};

const getTextLength = (root: HTMLElement) => root.textContent?.length ?? 0;

const getPopupPlacement = (anchor: FloatingPoint, expanded: boolean) => {
  if (typeof window === "undefined") {
    return {
      left: anchor.x,
      top: anchor.aboveY,
      transform: "translate(-50%, calc(-100% - 0.5rem))",
    };
  }

  const shouldOpenBelow = anchor.aboveY < (expanded ? 240 : 96);

  if (shouldOpenBelow) {
    return {
      left: anchor.x,
      top: Math.min(window.innerHeight - 16, anchor.belowY + POPUP_GAP),
      transform: "translate(-50%, 0)",
    };
  }

  return {
    left: anchor.x,
    top: anchor.aboveY,
    transform: "translate(-50%, calc(-100% - 0.5rem))",
  };
};

const createAnnotationMarkup = (html: string, annotations: PassageAnnotation[]) => {
  if (typeof window === "undefined") return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div data-annotation-root="true">${html}</div>`, "text/html");
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return html;

  for (const annotation of annotations) {
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const matchingNodes: Array<{ node: Text; start: number; end: number }> = [];
    let currentNode = walker.nextNode();
    let offset = 0;

    while (currentNode) {
      const textNode = currentNode as Text;
      const textLength = textNode.textContent?.length ?? 0;
      const nextOffset = offset + textLength;

      if (textLength > 0 && annotation.start < nextOffset && annotation.end > offset) {
        matchingNodes.push({ node: textNode, start: offset, end: nextOffset });
      }

      offset = nextOffset;
      currentNode = walker.nextNode();
    }

    for (const nodeInfo of matchingNodes.reverse()) {
      const nodeText = nodeInfo.node.textContent ?? "";
      const localStart = Math.max(0, annotation.start - nodeInfo.start);
      const localEnd = Math.min(nodeText.length, annotation.end - nodeInfo.start);

      if (localStart >= localEnd) continue;

      let selectedNode = nodeInfo.node;

      if (localEnd < selectedNode.length) {
        selectedNode.splitText(localEnd);
      }

      if (localStart > 0) {
        selectedNode = selectedNode.splitText(localStart);
      }

      const span = doc.createElement("span");
      span.setAttribute("data-annotation-id", annotation.id);
      span.setAttribute("data-annotation-color", annotation.color);
      span.setAttribute("title", "Open annotation actions");
      span.style.backgroundColor = ANNOTATION_COLORS[annotation.color].fill;
      span.style.boxShadow = `inset 0 -1px 0 ${ANNOTATION_COLORS[annotation.color].border}`;
      span.style.boxDecorationBreak = "clone";
      span.style.setProperty("-webkit-box-decoration-break", "clone");
      span.style.cursor = "pointer";
      span.style.font = "inherit";
      span.style.letterSpacing = "inherit";
      span.style.lineHeight = "inherit";
      span.style.margin = "0";
      span.style.padding = "0";
      span.style.verticalAlign = "baseline";
      span.style.whiteSpace = "inherit";
      span.style.wordSpacing = "inherit";
      span.style.transition = "filter 120ms ease";
      span.className = "reading-annotation";

      selectedNode.parentNode?.replaceChild(span, selectedNode);
      span.appendChild(selectedNode);
    }
  }

  return root.innerHTML;
};

export const ReadingPassageAnnotator = ({
  html,
  storageKey,
  enabled,
  className,
  storageArea = localStorage,
}: ReadingPassageAnnotatorProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const selectionPopupRef = useRef<HTMLDivElement>(null);
  const annotationPopupRef = useRef<HTMLDivElement>(null);
  const [annotations, setAnnotations] = useState<PassageAnnotation[]>(() =>
    loadAnnotations(storageArea, storageKey),
  );
  const [pendingSelection, setPendingSelection] = useState<{
    start: number;
    end: number;
    text: string;
    anchor: FloatingPoint;
  } | null>(null);
  const [activeAnnotation, setActiveAnnotation] = useState<{
    id: string;
    anchor: FloatingPoint;
  } | null>(null);

  useEffect(() => {
    setAnnotations(loadAnnotations(storageArea, storageKey));
    setPendingSelection(null);
    setActiveAnnotation(null);
  }, [storageArea, storageKey]);

  useEffect(() => {
    saveAnnotations(storageArea, storageKey, annotations);
  }, [annotations, storageArea, storageKey]);

  useEffect(() => {
    if (enabled) return;
    setPendingSelection(null);
    setActiveAnnotation(null);
  }, [enabled]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const clickedInsideSelectionPopup = Boolean(selectionPopupRef.current?.contains(target));
      const clickedInsideAnnotationPopup = Boolean(annotationPopupRef.current?.contains(target));
      const clickedAnnotation = Boolean(target.closest("[data-annotation-id]"));
      const clickedInsideRoot = Boolean(rootRef.current?.contains(target));

      if (!clickedInsideSelectionPopup && !clickedInsideRoot) {
        setPendingSelection(null);
      }

      if (!clickedInsideAnnotationPopup && !clickedAnnotation) {
        setActiveAnnotation(null);
      }
    };

    const handleRepositionSensitiveChange = () => {
      setPendingSelection(null);
      setActiveAnnotation(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("scroll", handleRepositionSensitiveChange, true);
    window.addEventListener("resize", handleRepositionSensitiveChange);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("scroll", handleRepositionSensitiveChange, true);
      window.removeEventListener("resize", handleRepositionSensitiveChange);
    };
  }, []);

  const annotatedHtml = useMemo(
    () => sanitizeHtml(createAnnotationMarkup(html, annotations)),
    [annotations, html],
  );

  const handleMouseUp = () => {
    if (!enabled || !rootRef.current) {
      setPendingSelection(null);
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setPendingSelection(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const commonAncestor = range.commonAncestorContainer;
    const withinRoot =
      commonAncestor === rootRef.current || rootRef.current.contains(commonAncestor);

    if (!withinRoot) {
      setPendingSelection(null);
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      setPendingSelection(null);
      return;
    }

    const prefixRange = range.cloneRange();
    prefixRange.selectNodeContents(rootRef.current);
    prefixRange.setEnd(range.startContainer, range.startOffset);
    const start = prefixRange.toString().length;
    const end = start + range.toString().length;

    if (start === end) {
      setPendingSelection(null);
      return;
    }

    const rootTextLength = getTextLength(rootRef.current);
    if (end > rootTextLength) {
      setPendingSelection(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    setActiveAnnotation(null);
    setPendingSelection({
      start,
      end,
      text,
      anchor: {
        x: rect.left + rect.width / 2,
        aboveY: clampPopupY(rect.top - 14),
        belowY: rect.bottom + 14,
      },
    });
  };

  const addAnnotation = (color: AnnotationColor) => {
    if (!pendingSelection) return;

    const overlapsExisting = annotations.some(
      (annotation) =>
        pendingSelection.start < annotation.end && pendingSelection.end > annotation.start,
    );

    if (overlapsExisting) {
      toast.error("Highlights cannot overlap. Delete the existing one first.");
      return;
    }

    const nextAnnotation: PassageAnnotation = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      start: pendingSelection.start,
      end: pendingSelection.end,
      color,
      text: pendingSelection.text,
    };

    setAnnotations((prev) => [...prev, nextAnnotation].sort((a, b) => a.start - b.start));
    setActiveAnnotation({
      id: nextAnnotation.id,
      anchor: pendingSelection.anchor,
    });
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleAnnotationClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const annotationElement = target.closest("[data-annotation-id]") as HTMLElement | null;

    if (!annotationElement) return;

    event.preventDefault();
    event.stopPropagation();
    window.getSelection()?.removeAllRanges();
    setPendingSelection(null);

    const id = annotationElement.dataset.annotationId;
    if (!id) return;

    const rect = annotationElement.getBoundingClientRect();
    setActiveAnnotation({
      id,
      anchor: {
        x: rect.left + rect.width / 2,
        aboveY: clampPopupY(rect.top - 14),
        belowY: rect.bottom + 14,
      },
    });
  };

  const removeAnnotation = () => {
    if (!activeAnnotation) return;
    setAnnotations((prev) => prev.filter((annotation) => annotation.id !== activeAnnotation.id));
    setActiveAnnotation(null);
  };

  const updateActiveAnnotation = (updater: (annotation: PassageAnnotation) => PassageAnnotation) => {
    if (!activeAnnotation) return;

    setAnnotations((prev) =>
      prev.map((annotation) =>
        annotation.id === activeAnnotation.id ? updater(annotation) : annotation,
      ),
    );
  };

  const selectedAnnotation = activeAnnotation
    ? annotations.find((annotation) => annotation.id === activeAnnotation.id) ?? null
    : null;
  const pendingSelectionPlacement = pendingSelection
    ? getPopupPlacement(pendingSelection.anchor, false)
    : null;
  const activeAnnotationPlacement = activeAnnotation
    ? getPopupPlacement(activeAnnotation.anchor, false)
    : null;

  return (
    <>
      <div
        ref={rootRef}
        className={cn(
          "text-foreground break-words prose prose-stone dark:prose-invert max-w-none",
          enabled && "selection:bg-amber-200/60 dark:selection:bg-amber-500/40",
          className,
        )}
        style={{ fontFamily: "var(--question-font-family, 'Noto Serif', serif)", fontSize: "calc(1rem * var(--question-font-scale, 1))", lineHeight: "1.73" }}
        onMouseUp={handleMouseUp}
        onClick={handleAnnotationClick}
      >
        <span
          style={{ display: "block", width: "100%" }}
          dangerouslySetInnerHTML={{ __html: annotatedHtml }}
        />
      </div>

      {pendingSelection && (
        <div
          ref={selectionPopupRef}
          className={cn(
            "fixed z-[150] border border-border bg-background/95 backdrop-blur rounded-full px-2 py-1.5",
            POPUP_SHADOW,
          )}
          style={pendingSelectionPlacement ?? undefined}
        >
          <div className="flex items-center gap-2">
            {(
              Object.entries(ANNOTATION_COLORS) as Array<
                [AnnotationColor, (typeof ANNOTATION_COLORS)[AnnotationColor]]
              >
            ).map(([color, meta]) => (
              <button
                key={color}
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                style={{ backgroundColor: meta.fill, boxShadow: `inset 0 0 0 1px ${meta.border}` }}
                title={`Highlight ${meta.label}`}
                aria-label={`Highlight ${meta.label}`}
                onClick={() => addAnnotation(color)}
              >
                <span className={cn("h-7 w-7 rounded-full", meta.chip)} />
              </button>
            ))}
          </div>
        </div>
      )}

      {activeAnnotation && selectedAnnotation && (
        <div
          ref={annotationPopupRef}
          className={cn(
            "fixed z-[150] border border-border bg-background/95 backdrop-blur rounded-full px-2 py-1.5",
            POPUP_SHADOW,
          )}
          style={activeAnnotationPlacement ?? undefined}
        >
          <div className="flex items-center gap-2">
            {(
              Object.entries(ANNOTATION_COLORS) as Array<
                [AnnotationColor, (typeof ANNOTATION_COLORS)[AnnotationColor]]
              >
            ).map(([color, meta]) => {
              const isActiveColor = selectedAnnotation.color === color;

              return (
                <button
                  key={color}
                  type="button"
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isActiveColor
                      ? "border-foreground/20 shadow-[0_4px_14px_rgba(15,23,42,0.18)]"
                      : "border-black/10",
                  )}
                  style={{
                    backgroundColor: meta.fill,
                    boxShadow: `inset 0 0 0 1px ${meta.border}`,
                  }}
                  title={`Change to ${meta.label}`}
                  aria-label={`Change to ${meta.label}`}
                  onClick={() =>
                    updateActiveAnnotation((annotation) => ({
                      ...annotation,
                      color,
                    }))
                  }
                >
                  <span className={cn("h-7 w-7 rounded-full", meta.chip)} />
                </button>
              );
            })}

            <button
              type="button"
              className="ml-auto flex h-10 w-10 items-center justify-center rounded-full border border-foreground/15 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 dark:hover:bg-red-950/50"
              aria-label="Delete annotation"
              title="Delete annotation"
              onClick={removeAnnotation}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
