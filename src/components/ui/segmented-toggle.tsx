import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SegmentedToggleOption<T extends string> = {
  value: T;
  label: ReactNode;
  title?: string;
};

type SegmentedToggleProps<T extends string> = {
  value: T;
  options: readonly SegmentedToggleOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  buttonClassName?: string;
  clippedActiveText?: boolean;
  activeTextClassName?: string;
};

export function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  className,
  buttonClassName,
  clippedActiveText = false,
  activeTextClassName,
}: SegmentedToggleProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<T, HTMLButtonElement>>(new Map());
  const [slider, setSlider] = useState({ left: 0, width: 0, right: 0 });
  const [hasMeasured, setHasMeasured] = useState(false);
  const [transitionsEnabled, setTransitionsEnabled] = useState(false);

  const measureSlider = useCallback(() => {
    const container = containerRef.current;
    const btn = buttonRefs.current.get(value);
    if (!container || !btn) return;
    const containerRect = container.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const left = btnRect.left - containerRect.left - container.clientLeft;
    const width = btnRect.width;
    setSlider({
      left,
      width,
      right: Math.max(0, container.clientWidth - left - width),
    });
    setHasMeasured(true);
  }, [value]);

  useLayoutEffect(() => {
    measureSlider();
  }, [measureSlider, options]);

  const transition = transitionsEnabled ? "left 300ms ease-out, width 300ms ease-out" : "none";
  const baseButtonClassName =
    "relative z-10 inline-flex items-center justify-center rounded-[8px] px-[14px] py-[8px] font-sans text-[14px] transition-colors duration-200";
  const clippedButtonClassName = cn(
    baseButtonClassName,
    "font-semibold text-ink hover:text-ink",
    buttonClassName,
  );

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
          transition,
        }}
      />

      {clippedActiveText && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[10px]"
          style={{
            clipPath: `inset(4px ${slider.right}px 4px ${slider.left}px round 8px)`,
            visibility: hasMeasured ? "visible" : "hidden",
            transition: transitionsEnabled ? "clip-path 300ms ease-out" : "none",
          }}
        >
          <div className="inline-flex flex-nowrap items-stretch p-1">
            {options.map((option) => (
              <span
                key={option.value}
                className={cn(
                  clippedButtonClassName,
                  "text-ink-fixed hover:text-ink-fixed",
                  activeTextClassName,
                )}
              >
                {option.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {options.map((option) => (
        <button
          key={option.value}
          ref={(el) => {
            if (el) buttonRefs.current.set(option.value, el);
          }}
          type="button"
          title={option.title}
          onClick={() => {
            setTransitionsEnabled(true);
            onChange(option.value);
          }}
          className={cn(
            clippedActiveText
              ? clippedButtonClassName
              : cn(
                  baseButtonClassName,
                  value === option.value
                    ? "font-semibold text-ink-fixed"
                    : "font-medium text-ink-mid hover:text-ink",
                  buttonClassName,
                ),
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
