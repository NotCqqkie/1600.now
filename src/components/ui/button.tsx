import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Inter, weight 600, sentence-case, radius 10px. Tabular-nums inherited from body.
  "inline-flex min-w-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-sans text-[14px] font-semibold tracking-[-0.005em] ring-offset-background transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [-webkit-user-drag:none] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary CTA — ink-FIXED text on accent fill. Text colour stays dark
        // in both themes because the accent fill is the same in both. Hover
        // ramps to cobalt #6BA7E8 (white text), press cobalt-deep #3A78D8.
        default:
          "bg-ds-accent text-ink-fixed hover:bg-cobalt hover:text-white hover:shadow-[0_4px_14px_rgba(58,120,216,0.32)] active:bg-cobalt-deep active:text-white active:scale-[0.98]",
        // Destructive — bad on bad-tint, with full red fill on confirm modals.
        destructive: "bg-ds-bad text-white hover:bg-ds-bad/90",
        // Secondary — ink on white with a soft 1px line. Hover rides up to
        // sky-soft surface + cobalt text/border so the affordance registers.
        outline:
          "border border-ds-line bg-white text-ink hover:bg-primary/15 hover:border-primary hover:text-cobalt-deep dark:bg-card dark:text-ink dark:border-ds-line dark:hover:bg-primary/15 dark:hover:border-primary/60 dark:hover:text-cobalt",
        // Tertiary / sentence-style secondary used in older surfaces.
        secondary:
          "border border-ds-line bg-white text-ink hover:bg-primary/15 hover:border-primary hover:text-cobalt-deep dark:bg-card dark:text-ink dark:hover:bg-primary/15 dark:hover:border-primary/60 dark:hover:text-cobalt",
        // Ghost — no fill, just label.
        ghost:
          "text-ink hover:bg-primary/15 hover:text-cobalt-deep dark:text-ink dark:hover:bg-primary/15 dark:hover:text-cobalt",
        // Inline link — accent-deep, hover ramps to cobalt-deep.
        link: "text-accent-deep underline-offset-4 hover:underline hover:text-cobalt-deep dark:hover:text-cobalt",
        // Success surface (kept for callers).
        success: "bg-ds-good/15 text-ink border border-ds-good/30 hover:bg-ds-good/25",
        // Dark solid — white text on a fixed dark ink fill. Stays dark in
        // both themes; used inside the flashcard footer to signal commitment.
        dark: "bg-ink-fixed text-white hover:bg-ink-fixed/90",
      },
      size: {
        // 12–14px y × 18–22px x per spec; default sits in the middle.
        default: "h-11 px-[20px] py-[12px] text-[14px]",
        sm: "h-9 px-[14px] text-[13px]",
        lg: "h-12 px-[22px] text-[15px]",
        icon: "h-[38px] w-[38px] rounded-[10px]",
        "icon-lg": "h-11 w-11 rounded-[10px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
