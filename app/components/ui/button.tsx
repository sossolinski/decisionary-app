// app/components/ui/button.tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    // base
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] text-sm font-medium",
    "transition-colors transition-shadow",
    "disabled:pointer-events-none disabled:opacity-50",
    // focus ring (consistent)
    "focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]",
    // subtle press
    "active:translate-y-[0.5px]",
    // ensure icon sizes align
    "[&>svg]:pointer-events-none [&>svg]:shrink-0 [&>svg]:h-4 [&>svg]:w-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:bg-primary/85",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:bg-destructive/85",
        secondary:
          "bg-secondary text-secondary-foreground border border-border shadow-sm hover:bg-secondary/80 active:bg-secondary/70",
        outline:
          "border border-border bg-background shadow-sm hover:bg-secondary active:bg-secondary/80",
        ghost:
          "bg-transparent hover:bg-secondary hover:text-foreground active:bg-secondary/80",
        link: "bg-transparent text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-[calc(var(--radius)-2px)] px-3",
        lg: "h-11 rounded-[calc(var(--radius)+2px)] px-8",
        icon: "h-10 w-10 px-0", // icon-only button, consistent hitbox
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
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
