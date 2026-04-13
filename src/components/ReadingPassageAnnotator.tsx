import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  y: number;
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
      span.style.borderRadius = "0.25rem";
      span.style.padding = "0 0.05em";
      span.style.cursor = "pointer";
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
  const deletePopupRef = useRef<HTMLDivElement>(null);
  const [annotations, setAnnotations] = useState<PassageAnnotation[]>(() =>
    loadAnnotations(storageArea, storageKey),
  );
  const [pendingSelection, setPendingSelection] = useState<{
    start: number;
    end: number;
    text: string;
    anchor: FloatingPoint;
  } | null>(null);
  const [annotationToDelete, setAnnotationToDelete] = useState<{
    id: string;
    anchor: FloatingPoint;
  } | null>(null);

  useEffect(() => {
    setAnnotations(loadAnnotations(storageArea, storageKey));
    setPendingSelection(null);
    setAnnotationToDelete(null);
  }, [storageArea, storageKey]);

  useEffect(() => {
    saveAnnotations(storageArea, storageKey, annotations);
  }, [annotations, storageArea, storageKey]);

  useEffect(() => {
    if (enabled) return;
    setPendingSelection(null);
  }, [enabled]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const clickedInsideSelectionPopup = Boolean(selectionPopupRef.current?.contains(target));
      const clickedInsideDeletePopup = Boolean(deletePopupRef.current?.contains(target));
      const clickedAnnotation = Boolean(target.closest("[data-annotation-id]"));
      const clickedInsideRoot = Boolean(rootRef.current?.contains(target));

      if (!clickedInsideSelectionPopup && !clickedInsideRoot) {
        setPendingSelection(null);
      }

      if (!clickedInsideDeletePopup && !clickedAnnotation) {
        setAnnotationToDelete(null);
      }
    };

    const handleRepositionSensitiveChange = () => {
      setPendingSelection(null);
      setAnnotationToDelete(null);
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

  const annotatedHtml = useMemo(() => createAnnotationMarkup(html, annotations), [annotations, html]);

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
    setAnnotationToDelete(null);
    setPendingSelection({
      start,
      end,
      text,
      anchor: {
        x: rect.left + rect.width / 2,
        y: clampPopupY(rect.top - 14),
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
    setAnnotationToDelete({
      id,
      anchor: {
        x: rect.left + rect.width / 2,
        y: clampPopupY(rect.top - 14),
      },
    });
  };

  const removeAnnotation = () => {
    if (!annotationToDelete) return;
    setAnnotations((prev) => prev.filter((annotation) => annotation.id !== annotationToDelete.id));
    setAnnotationToDelete(null);
  };

  return (
    <>
      <div
        ref={rootRef}
        className={cn(
          "text-foreground break-words prose prose-stone dark:prose-invert max-w-none",
          enabled && "selection:bg-amber-200/60 dark:selection:bg-amber-500/40",
          className,
        )}
        style={{ fontFamily: "'Noto Serif', serif", fontSize: "1rem", lineHeight: "1.73" }}
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
          className="fixed z-[90] flex items-center gap-2 rounded-full border border-border bg-background/95 px-2 py-1.5 shadow-xl backdrop-blur"
          style={{
            left: pendingSelection.anchor.x,
            top: pendingSelection.anchor.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          {(
            Object.entries(ANNOTATION_COLORS) as Array<
              [AnnotationColor, (typeof ANNOTATION_COLORS)[AnnotationColor]]
            >
          ).map(([color, meta]) => (
            <button
              key={color}
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              style={{ backgroundColor: meta.fill, boxShadow: `inset 0 0 0 1px ${meta.border}` }}
              title={`Highlight ${meta.label}`}
              aria-label={`Highlight ${meta.label}`}
              onClick={() => addAnnotation(color)}
            >
              <span className={cn("h-3.5 w-3.5 rounded-full", meta.chip)} />
            </button>
          ))}
        </div>
      )}

      {annotationToDelete && (
        <div
          ref={deletePopupRef}
          className="fixed z-[90] rounded-full border border-border bg-background/95 p-1 shadow-xl backdrop-blur"
          style={{
            left: annotationToDelete.anchor.x,
            top: annotationToDelete.anchor.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 dark:hover:bg-red-950/50"
            aria-label="Delete annotation"
            title="Delete annotation"
            onClick={removeAnnotation}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
};
