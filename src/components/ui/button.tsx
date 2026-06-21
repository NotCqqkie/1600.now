import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "ui-button-polish inline-flex min-w-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-sans text-[14px] font-semibold tracking-[-0.005em] ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [-webkit-user-drag:none] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-ds-accent text-ink-fixed hover:bg-cobalt hover:text-white active:bg-cobalt-deep active:text-white",
        destructive: "bg-ds-bad text-white hover:bg-ds-bad/90",
        outline:
          "border border-ds-line bg-white text-ink hover:bg-primary/15 hover:border-primary hover:text-cobalt-deep dark:bg-card dark:text-ink dark:border-ds-line dark:hover:bg-primary/15 dark:hover:border-primary/60 dark:hover:text-cobalt",
        secondary:
          "border border-ds-line bg-white text-ink hover:bg-primary/15 hover:border-primary hover:text-cobalt-deep dark:bg-card dark:text-ink dark:hover:bg-primary/15 dark:hover:border-primary/60 dark:hover:text-cobalt",
        ghost:
          "text-ink hover:bg-primary/15 hover:text-cobalt-deep dark:text-ink dark:hover:bg-primary/15 dark:hover:text-cobalt",
        link: "text-accent-deep underline-offset-4 hover:underline hover:text-cobalt-deep dark:hover:text-cobalt",
        success: "bg-ds-good/15 text-ink border border-ds-good/30 hover:bg-ds-good/25",
        dark: "bg-ink-fixed text-white hover:bg-ink-fixed/90",
      },
      size: {
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
