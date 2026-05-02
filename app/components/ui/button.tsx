// app/components/ui/button.tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-[var(--radius)] text-sm font-medium",
    "transition-[box-shadow,background-color,border-color,color,opacity] duration-150",
    "focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-0",
    "disabled:pointer-events-none disabled:opacity-60 disabled:shadow-none",
    "select-none",
    "shadow-none",
    "hover:shadow-none",
    "active:shadow-none",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-primary/20 hover:bg-primary/92",
        secondary:
          "bg-secondary/88 text-secondary-foreground border border-border hover:bg-secondary/72",
        outline:
          "bg-background/88 text-foreground border border-border hover:bg-secondary/60",
        ghost:
          "bg-transparent text-foreground border border-transparent shadow-none hover:shadow-none hover:bg-secondary/60 active:translate-y-0",
        destructive:
          "bg-destructive text-destructive-foreground border border-destructive/30 hover:bg-destructive/92",
        link: "bg-transparent text-primary underline-offset-4 hover:underline shadow-none hover:shadow-none active:translate-y-0 border-transparent",
      },
      size: {
        default: "h-9 px-3.5 py-1.5",
        sm: "h-7 rounded-[calc(var(--radius)-2px)] px-2.5 text-xs",
        lg: "h-10 rounded-[var(--radius)] px-4",
        icon: "h-9 w-9 px-0",
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
