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
}

const COLORS = [
  "#2d70b3", // blue
  "#388c46", // green
  "#fa7e19", // orange
  "#c74440", // red
  "#6042a6", // purple
];

export function InlineDesmos({ expressions, height = 360 }: InlineDesmosProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const calcRef = useRef<DesmosCalc | null>(null);
  const [ready, setReady] = useState(false);

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
