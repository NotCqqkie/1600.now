import { useEffect, useRef, useState } from "react";
import { loadDesmos, type DesmosCalculator } from "@/lib/desmosLoader";
import { cn } from "@/lib/utils";

interface InlineDesmosProps {
  expressions: string[];
  height?: number;
  forwardScrollToPage?: boolean;
  className?: string;
}

const DESMOS_EXPRESSION_COLORS = [
  "#2d70b3",
  "#388c46",
  "#fa7e19",
  "#c74440",
  "#6042a6",
] as const;

export function InlineDesmos({ expressions, height = 360, forwardScrollToPage = false, className }: InlineDesmosProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

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
    let cancelled = false;
    let calc: DesmosCalculator | null = null;
    let outerRaf = 0;
    let innerRaf = 0;

    loadDesmos()
      .then(() => {
        if (cancelled || !containerRef.current || !window.Desmos) return;

        calc = window.Desmos.GraphingCalculator(containerRef.current, {
          expressions: true,
          expressionsTopbar: false,
          settingsMenu: false,
          zoomButtons: true,
          pointsOfInterest: true,
          trace: true,
          degreeMode: true,
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

        expressions.forEach((latex, i) => {
          calc?.setExpression({
            id: `expr-${i}`,
            latex,
            color: DESMOS_EXPRESSION_COLORS[i % DESMOS_EXPRESSION_COLORS.length],
          });
        });

        outerRaf = requestAnimationFrame(() => {
          innerRaf = requestAnimationFrame(() => {
            if (!cancelled) setReady(true);
          });
        });
      })
      .catch(() => {
      });

    return () => {
      cancelled = true;
      if (outerRaf) cancelAnimationFrame(outerRaf);
      if (innerRaf) cancelAnimationFrame(innerRaf);
      calc?.destroy();
      setReady(false);
    };
  }, [expressions]);

  return (
    <div className={cn("rounded-lg border border-primary/20 overflow-hidden bg-background", className)}>
      <div
        ref={containerRef}
        className="w-full"
        style={{
          height,
          opacity: ready ? 1 : 0,
          transition: "opacity 0.25s ease",
        }}
      />
    </div>
  );
}
