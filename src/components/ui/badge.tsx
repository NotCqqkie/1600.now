import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-[9px] py-[3px] font-sans text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ds-accent focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-ds-line bg-white text-ink-mid font-medium dark:bg-card dark:text-ink-mid",
        secondary: "border-transparent bg-ds-accent/40 text-ink",
        destructive: "border-transparent bg-ds-bad/12 text-bad",
        outline: "border-ds-line text-ink-mid",
        good: "border-transparent bg-ds-good/12 text-good",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
