import { useEffect, useRef, useState } from "react";
import { loadDesmos } from "@/lib/desmosLoader";

interface DesmosCalc {
  destroy: () => void;
  resize: () => void;
  setExpression: (expr: { id: string; latex?: string; color?: string }) => void;
}

interface InlineDesmosProps {
  expressions: string[];
  height?: number;
  forwardScrollToPage?: boolean;
}

const COLORS = [
  "#2d70b3", // blue
  "#388c46", // green
  "#fa7e19", // orange
  "#c74440", // red
  "#6042a6", // purple
];

export function InlineDesmos({ expressions, height = 360, forwardScrollToPage = false }: InlineDesmosProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const calcRef = useRef<DesmosCalc | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!forwardScrollToPage) return;
    const node = containerRef.current;
    if (!node) return;

    let lastTouchX: number | null = null;
    let lastTouchY: number | null = null;
    const forwardScroll = (deltaX: number, deltaY: number) => {
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
      forwardScroll(event.deltaX, event.deltaY);
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
      forwardScroll(deltaX, deltaY);
    };
    const resetTouch = () => {
      lastTouchX = null;
      lastTouchY = null;
    };

    node.addEventListener("wheel", onWheel, { passive: false, capture: true });
    node.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    node.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    node.addEventListener("touchend", resetTouch, { capture: true });
    node.addEventListener("touchcancel", resetTouch, { capture: true });

    return () => {
      node.removeEventListener("wheel", onWheel, { capture: true });
      node.removeEventListener("touchstart", onTouchStart, { capture: true });
      node.removeEventListener("touchmove", onTouchMove, { capture: true });
      node.removeEventListener("touchend", resetTouch, { capture: true });
      node.removeEventListener("touchcancel", resetTouch, { capture: true });
    };
  }, [forwardScrollToPage]);

  useEffect(() => {
    let cancelled = false;
    let calc: DesmosCalc | null = null;
    let raf = 0;

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
        }) as DesmosCalc;

        expressions.forEach((latex, i) => {
          calc?.setExpression({
            id: `expr-${i}`,
            latex,
            color: COLORS[i % COLORS.length],
          });
        });

        calcRef.current = calc;

        raf = requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (!cancelled) setReady(true);
          })
        );
      })
      .catch(() => {
        // Desmos failed to load — leave graph area empty
      });

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      calc?.destroy();
      calcRef.current = null;
      setReady(false);
    };
  }, [expressions]);

  return (
    <div className="rounded-lg border border-primary/20 overflow-hidden bg-background">
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
