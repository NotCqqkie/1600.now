import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { loadDesmos, type DesmosCalculator } from "@/lib/desmosLoader";
import type { DesmosBounds, DesmosExpressionInput, DesmosTable } from "@/lib/desmosEmbed";
import { cn } from "@/lib/utils";

interface InlineDesmosProps {
  expressions: DesmosExpressionInput[];
  tables?: DesmosTable[];
  bounds?: DesmosBounds;
  degreeMode?: boolean;
  defaultLogModeRegressions?: boolean;
  preserveSquareUnits?: boolean;
  showGraphpaper?: boolean;
  height?: number;
  forwardScrollToPage?: boolean;
  className?: string;
}

type DesmosContainerElement = HTMLDivElement & {
  __desmosCalculator?: DesmosCalculator;
};

const DESMOS_EXPRESSION_COLORS = [
  "#2d70b3",
  "#388c46",
  "#fa7e19",
  "#c74440",
  "#6042a6",
] as const;

const EMPTY_DESMOS_TABLES: DesmosTable[] = [];

const squareBoundsForElement = (
  bounds: DesmosBounds,
  element: DesmosContainerElement,
): DesmosBounds => {
  const graphpaper = element.querySelector<HTMLElement>(".dcg-graph-inner");
  const width = graphpaper?.clientWidth ?? element.clientWidth;
  const height = graphpaper?.clientHeight ?? element.clientHeight;
  if (width <= 0 || height <= 0) return bounds;
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.bottom + bounds.top) / 2;
  let rangeX = bounds.right - bounds.left;
  let rangeY = bounds.top - bounds.bottom;
  const targetRatio = width / height;
  if (rangeX / rangeY < targetRatio) rangeX = rangeY * targetRatio;
  else rangeY = rangeX / targetRatio;
  return {
    left: centerX - rangeX / 2,
    right: centerX + rangeX / 2,
    bottom: centerY - rangeY / 2,
    top: centerY + rangeY / 2,
  };
};

export function InlineDesmos({
  expressions,
  tables = EMPTY_DESMOS_TABLES,
  bounds,
  degreeMode = true,
  defaultLogModeRegressions = false,
  preserveSquareUnits = false,
  showGraphpaper = true,
  height = 360,
  forwardScrollToPage = false,
  className,
}: InlineDesmosProps) {
  const containerRef = useRef<DesmosContainerElement>(null);
  const [ready, setReady] = useState(false);
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);
  const preferredHeight = tables.length ? Math.max(height, showGraphpaper ? 520 : 480) : height;
  const resolvedHeight = availableHeight === null
    ? preferredHeight
    : Math.min(preferredHeight, availableHeight);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const scrollRegion = container?.closest<HTMLElement>('[data-explanation-scroll-region="true"]');
    if (!scrollRegion) {
      setAvailableHeight(null);
      return;
    }
    const updateAvailableHeight = () => {
      setAvailableHeight(Math.max(240, scrollRegion.clientHeight - 32));
    };
    updateAvailableHeight();
    const observer = new ResizeObserver(updateAvailableHeight);
    observer.observe(scrollRegion);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!forwardScrollToPage) return;
    const node = containerRef.current;
    if (!node) return;

    let lastTouchX: number | null = null;
    let lastTouchY: number | null = null;
    const forwardPageScroll = (deltaX: number, deltaY: number) => {
      if (!deltaX && !deltaY) return;
      if (window.self !== window.top) {
        window.parent.postMessage({ type: "homeDemoScroll", deltaX, deltaY }, window.location.origin);
        return;
      }
      window.scrollBy({ left: deltaX, top: deltaY, behavior: "auto" });
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      forwardPageScroll(event.deltaX, event.deltaY);
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        lastTouchX = null;
        lastTouchY = null;
        return;
      }
      lastTouchX = event.touches[0].clientX;
      lastTouchY = event.touches[0].clientY;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1 || lastTouchX === null || lastTouchY === null) return;
      const touch = event.touches[0];
      const deltaX = lastTouchX - touch.clientX;
      const deltaY = lastTouchY - touch.clientY;
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
      if (Math.abs(deltaX) + Math.abs(deltaY) < 1) return;
      event.preventDefault();
      event.stopPropagation();
      forwardPageScroll(deltaX, deltaY);
    };
    const resetForwardedTouch = () => {
      lastTouchX = null;
      lastTouchY = null;
    };

    node.addEventListener("wheel", onWheel, { passive: false, capture: true });
    node.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    node.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    node.addEventListener("touchend", resetForwardedTouch, { capture: true });
    node.addEventListener("touchcancel", resetForwardedTouch, { capture: true });

    return () => {
      node.removeEventListener("wheel", onWheel, { capture: true });
      node.removeEventListener("touchstart", onTouchStart, { capture: true });
      node.removeEventListener("touchmove", onTouchMove, { capture: true });
      node.removeEventListener("touchend", resetForwardedTouch, { capture: true });
      node.removeEventListener("touchcancel", resetForwardedTouch, { capture: true });
    };
  }, [forwardScrollToPage]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let calc: DesmosCalculator | null = null;
    let outerRaf = 0;
    let innerRaf = 0;
    let boundsRaf = 0;
    let pendingCalculatorResize = false;
    let containerResizeObserver: ResizeObserver | null = null;
    let graphResizeObserver: ResizeObserver | null = null;
    let graphMutationObserver: MutationObserver | null = null;
    let observedGraphInner: HTMLElement | null = null;

    loadDesmos()
      .then(() => {
        if (cancelled || !window.Desmos) return;

        calc = window.Desmos.GraphingCalculator(container, {
          graphpaper: showGraphpaper,
          expressions: true,
          expressionsTopbar: false,
          settingsMenu: false,
          zoomButtons: true,
          pointsOfInterest: true,
          trace: true,
          degreeMode,
          defaultLogModeRegressions,
          images: false,
          folders: false,
          notes: false,
          links: false,
          qwertyKeyboard: true,
          lockViewport: false,
          border: false,
          expressionsCollapsed: false,
          backgroundColor: "#ffffff",
        });

        container.__desmosCalculator = calc;

        tables.forEach((table, tableIndex) => {
          calc?.setExpression({
            id: `table-${tableIndex}`,
            type: "table",
            columns: table.columns.map((column, columnIndex) => ({
              latex: column.latex,
              values: column.values,
              color: DESMOS_EXPRESSION_COLORS[(tableIndex + columnIndex) % DESMOS_EXPRESSION_COLORS.length],
            })),
          });
        });

        expressions.forEach((expression, i) => {
          const expressionState = typeof expression === "string" ? { latex: expression } : expression;
          const explicitLabel = expressionState.label?.trim()
            ? expressionState.label
            : undefined;
          const label = explicitLabel ?? (
            expressionState.showLabel === true ? expressionState.latex : undefined
          );
          calc?.setExpression({
            id: expressionState.id ?? `expr-${i}`,
            latex: expressionState.latex,
            color: expressionState.color ?? DESMOS_EXPRESSION_COLORS[i % DESMOS_EXPRESSION_COLORS.length],
            ...(label !== undefined ? { label } : {}),
            ...(expressionState.showLabel !== undefined
              ? { showLabel: expressionState.showLabel }
              : {}),
            ...(expressionState.hidden !== undefined
              ? { hidden: expressionState.hidden }
              : {}),
            ...(expressionState.sliderBounds
              ? { sliderBounds: expressionState.sliderBounds }
              : {}),
            ...(expressionState.playing !== undefined
              ? { playing: expressionState.playing }
              : {}),
          });
        });

        const applyBounds = () => {
          if (!bounds || !calc) return;
          const appliedBounds = preserveSquareUnits
            ? squareBoundsForElement(bounds, container)
            : bounds;
          calc.setMathBounds?.(appliedBounds);
          container.dataset.desmosAppliedBounds = JSON.stringify(appliedBounds);
        };

        const scheduleBounds = (resizeCalculator: boolean) => {
          pendingCalculatorResize ||= resizeCalculator;
          if (boundsRaf) cancelAnimationFrame(boundsRaf);
          boundsRaf = requestAnimationFrame(() => {
            boundsRaf = 0;
            if (pendingCalculatorResize) calc?.resize();
            pendingCalculatorResize = false;
            applyBounds();
          });
        };

        applyBounds();
        containerResizeObserver = new ResizeObserver(() => {
          scheduleBounds(true);
        });
        containerResizeObserver.observe(container);

        if (bounds && preserveSquareUnits) {
          graphResizeObserver = new ResizeObserver(() => {
            scheduleBounds(false);
          });
          const observeGraphInner = () => {
            const graphInner = container.querySelector<HTMLElement>(".dcg-graph-inner");
            if (graphInner === observedGraphInner) return;
            if (observedGraphInner) graphResizeObserver?.unobserve(observedGraphInner);
            observedGraphInner = graphInner;
            if (observedGraphInner) graphResizeObserver?.observe(observedGraphInner);
          };
          observeGraphInner();
          graphMutationObserver = new MutationObserver(observeGraphInner);
          graphMutationObserver.observe(container, { childList: true, subtree: true });
        }

        outerRaf = requestAnimationFrame(() => {
          innerRaf = requestAnimationFrame(() => {
            if (!cancelled) {
              applyBounds();
              setReady(true);
            }
          });
        });
      })
      .catch(() => {
      });

    return () => {
      cancelled = true;
      if (outerRaf) cancelAnimationFrame(outerRaf);
      if (innerRaf) cancelAnimationFrame(innerRaf);
      if (boundsRaf) cancelAnimationFrame(boundsRaf);
      containerResizeObserver?.disconnect();
      graphResizeObserver?.disconnect();
      graphMutationObserver?.disconnect();
      calc?.destroy();
      delete container.__desmosCalculator;
      setReady(false);
    };
  }, [bounds, defaultLogModeRegressions, degreeMode, expressions, preserveSquareUnits, showGraphpaper, tables]);

  return (
    <div className={cn("rounded-lg border border-primary/20 overflow-hidden bg-background", className)}>
      <div
        ref={containerRef}
        data-desmos-inline="true"
        data-desmos-ready={ready ? "true" : "false"}
        data-desmos-bounds={bounds ? JSON.stringify(bounds) : undefined}
        data-desmos-degree-mode={degreeMode ? "degrees" : "radians"}
        data-desmos-log-mode={defaultLogModeRegressions ? "true" : "false"}
        data-desmos-square-units={preserveSquareUnits ? "true" : "false"}
        data-desmos-graphpaper={showGraphpaper ? "true" : "false"}
        className="w-full"
        style={{
          height: resolvedHeight,
          opacity: ready ? 1 : 0,
          transition: "opacity 0.25s ease",
        }}
      />
    </div>
  );
}
