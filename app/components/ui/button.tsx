// app/components/ui/button.tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-[var(--radius)] text-sm font-medium transition",
    "focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]",
    "disabled:pointer-events-none disabled:opacity-50",
    "select-none",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "text-[color:var(--primary-foreground)]",
          "border border-transparent",
          "shadow-soft",
          // subtle gradient like landing CTAs
          "bg-[linear-gradient(135deg,var(--studio-accent-blue),var(--studio-accent-purple))]",
          "hover:opacity-95",
        ].join(" "),
        destructive: [
          "bg-destructive text-destructive-foreground shadow-soft",
          "hover:opacity-95",
        ].join(" "),
        outline: [
          "surface2",
          "text-foreground",
          "hover:bg-secondary/60",
        ].join(" "),
        secondary: [
          "bg-secondary text-secondary-foreground border border-[var(--studio-border)]",
          "hover:bg-secondary/70",
        ].join(" "),
        ghost: [
          "text-foreground",
          "hover:bg-secondary/60",
        ].join(" "),
        link: [
          "text-primary underline-offset-4 hover:underline",
        ].join(" "),
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-[calc(var(--radius)-2px)] px-3",
        lg: "h-11 rounded-[calc(var(--radius)+2px)] px-6",
        icon: "h-10 w-10",
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
