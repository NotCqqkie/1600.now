import { useRef, useState, useLayoutEffect, useCallback } from "react";
import {
  BANK_SOURCE_LABELS,
  type BankSourceFilter,
} from "@/data/questionBank";
import { cn } from "@/lib/utils";

interface BankSourceToggleProps {
  value: BankSourceFilter;
  onChange: (value: BankSourceFilter) => void;
}

const sources: BankSourceFilter[] = ["unofficial", "past", "all"];

export const BankSourceToggle = ({ value, onChange }: BankSourceToggleProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<BankSourceFilter, HTMLButtonElement>>(new Map());
  const [slider, setSlider] = useState({ left: 0, width: 0 });
  const [hasMeasured, setHasMeasured] = useState(false);

  const measureSlider = useCallback(() => {
    const container = containerRef.current;
    const btn = buttonRefs.current.get(value);
    if (!container || !btn) return;
    const containerRect = container.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setSlider({
      left: btnRect.left - containerRect.left,
      width: btnRect.width,
    });
    setHasMeasured(true);
  }, [value]);

  useLayoutEffect(() => {
    measureSlider();
  }, [measureSlider]);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex flex-wrap rounded-lg border bg-card p-1"
    >
      {/* Animated slider background */}
      <div
        className={cn(
          "absolute top-1 bottom-1 rounded-md bg-primary shadow-sm ease-out",
          hasMeasured ? "transition-all duration-300" : "transition-none",
        )}
        style={{ left: slider.left, width: slider.width }}
      />

      {sources.map((source) => (
        <button
          key={source}
          ref={(el) => {
            if (el) buttonRefs.current.set(source, el);
          }}
          type="button"
          onClick={() => onChange(source)}
          className={cn(
            "relative z-10 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-200",
            value === source
              ? "text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {BANK_SOURCE_LABELS[source]}
        </button>
      ))}
    </div>
  );
};
