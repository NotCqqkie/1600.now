import { useEffect, useRef } from "react";

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

  useEffect(() => {
    if (!containerRef.current || !window.Desmos) return;

    const calc = window.Desmos.GraphingCalculator(containerRef.current, {
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
      calc.setExpression({
        id: `expr-${i}`,
        latex,
        color: COLORS[i % COLORS.length],
      });
    });

    calcRef.current = calc;

    return () => {
      calc.destroy();
      calcRef.current = null;
    };
  }, [expressions]);

  return (
    <div className="rounded-lg border border-primary/20 overflow-hidden bg-background">
      <div ref={containerRef} className="w-full" style={{ height }} />
    </div>
  );
}
