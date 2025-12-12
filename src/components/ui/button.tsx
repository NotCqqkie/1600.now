import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-[#B4E1FF] hover:border-[#B4E1FF] hover:text-foreground dark:hover:bg-[#1E3A5F] dark:hover:border-[#2D5A87] dark:hover:text-foreground",
        secondary: "bg-[#FFF3E0] text-foreground border border-[#FFE0B2] hover:bg-[#FFE0B2] hover:border-[#FFCC80] dark:bg-[#5D4037] dark:border-[#6D4C41] dark:hover:bg-[#4E342E] dark:hover:border-[#5D4037] dark:text-white",
        ghost: "hover:bg-[#B4E1FF] hover:text-foreground dark:hover:bg-[#1E3A5F] dark:hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-[#E8F5E9] text-foreground border border-[#C8E6C9] hover:bg-[#C8E6C9] hover:border-[#A5D6A7] dark:bg-[#2E7D32] dark:border-[#388E3C] dark:hover:bg-[#1B5E20] dark:hover:border-[#2E7D32] dark:text-white",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
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
