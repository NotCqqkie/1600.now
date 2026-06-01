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

const sources: BankSourceFilter[] = ["all", "unofficial", "past"];

export const BankSourceToggle = ({ value, onChange }: BankSourceToggleProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<BankSourceFilter, HTMLButtonElement>>(new Map());
  const [slider, setSlider] = useState({ left: 0, width: 0 });
  const [hasMeasured, setHasMeasured] = useState(false);
  const [transitionsEnabled, setTransitionsEnabled] = useState(false);

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
      className="relative inline-flex flex-nowrap rounded-[10px] border border-ds-line bg-white p-1 dark:bg-card dark:border-white/15"
    >
      {/* Animated slider — always-light accent fill (#9BD7F4). */}
      <div
        className="absolute top-1 bottom-1 rounded-[8px] bg-ds-accent shadow-sm"
        style={{
          left: slider.left,
          width: slider.width,
          visibility: hasMeasured ? "visible" : "hidden",
          transition: transitionsEnabled ? "left 300ms ease-out, width 300ms ease-out" : "none",
        }}
      />

      {sources.map((source) => (
        <button
          key={source}
          ref={(el) => {
            if (el) buttonRefs.current.set(source, el);
          }}
          type="button"
          onClick={() => {
            setTransitionsEnabled(true);
            onChange(source);
          }}
          className={cn(
            // Off: Inter 500 14px, ink-mid. On: Inter 600 ink-fixed (dark on
            // the always-light accent slider, even in dark mode).
            "relative z-10 rounded-[8px] px-[14px] py-[8px] font-sans text-[14px] transition-colors duration-200",
            value === source
              ? "font-semibold text-ink-fixed"
              : "font-medium text-ink-mid hover:text-ink",
          )}
        >
          {BANK_SOURCE_LABELS[source]}
        </button>
      ))}
    </div>
  );
};
