// app/components/ui/button.tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-[var(--radius)] text-sm font-medium",
    "transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "select-none",
    // tactile feel
    "shadow-[0_1px_0_hsl(0_0%_100%/0.5),0_1px_2px_hsl(220_20%_20%/0.06)]",
    "hover:shadow-[0_1px_0_hsl(0_0%_100%/0.55),0_8px_18px_hsl(220_20%_20%/0.10)]",
    "active:translate-y-[1px] active:shadow-[0_1px_0_hsl(0_0%_100%/0.45),0_2px_6px_hsl(220_20%_20%/0.10)]",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-primary/20 hover:bg-primary/92",
        secondary:
          "bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80",
        outline:
          "bg-background text-foreground border border-border hover:bg-secondary/60",
        ghost:
          "bg-transparent text-foreground border border-transparent shadow-none hover:shadow-none hover:bg-secondary/60 active:translate-y-0",
        destructive:
          "bg-destructive text-destructive-foreground border border-destructive/30 hover:bg-destructive/92",
        link: "bg-transparent text-primary underline-offset-4 hover:underline shadow-none hover:shadow-none active:translate-y-0 border-transparent",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-[calc(var(--radius)-2px)] px-3",
        lg: "h-11 rounded-[calc(var(--radius)+2px)] px-5",
        icon: "h-10 w-10 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
