import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SegmentedToggleOption<T extends string> = {
  value: T;
  label: ReactNode;
  ariaLabel?: string;
  title?: string;
};

type SegmentedToggleProps<T extends string> = {
  value: T;
  options: readonly SegmentedToggleOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  buttonClassName?: string;
};

export function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  className,
  buttonClassName,
}: SegmentedToggleProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<T, HTMLButtonElement>>(new Map());
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
      left: btnRect.left - containerRect.left - container.clientLeft,
      width: btnRect.width,
    });
    setHasMeasured(true);
  }, [value]);

  useLayoutEffect(() => {
    measureSlider();
  }, [measureSlider, options]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative inline-flex flex-nowrap items-stretch rounded-[10px] border border-ds-line bg-white p-1 dark:border-white/15 dark:bg-card",
        className,
      )}
    >
      <div
        className="absolute bottom-1 top-1 rounded-[8px] bg-ds-accent shadow-sm"
        style={{
          left: slider.left,
          width: slider.width,
          visibility: hasMeasured ? "visible" : "hidden",
          transition: transitionsEnabled ? "left 300ms ease-out, width 300ms ease-out" : "none",
        }}
      />

      {options.map((option) => (
        <button
          key={option.value}
          ref={(el) => {
            if (el) buttonRefs.current.set(option.value, el);
          }}
          type="button"
          aria-label={option.ariaLabel}
          title={option.title}
          onClick={() => {
            setTransitionsEnabled(true);
            onChange(option.value);
          }}
          className={cn(
            "relative z-10 inline-flex items-center justify-center rounded-[8px] px-[14px] py-[8px] font-sans text-[14px] transition-colors duration-200",
            value === option.value
              ? "font-semibold text-ink-fixed"
              : "font-medium text-ink-mid hover:text-ink",
            buttonClassName,
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
