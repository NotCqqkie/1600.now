import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Inter, 15px when typed (larger than UI default for comfort),
          // weight 500. Padding 11px × 14px, 1px line, radius 9px.
          "flex h-11 w-full rounded-[9px] border border-ds-line bg-white px-[14px] py-[11px] font-sans text-[15px] font-medium text-ink ring-offset-background placeholder:font-normal placeholder:text-ink-muted file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-card dark:text-ink",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
