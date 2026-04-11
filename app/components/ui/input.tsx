// app/components/ui/input.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          [
            "flex h-10 w-full rounded-[var(--radius)] px-3 py-2 text-sm",
            "bg-[var(--studio-surface2)] text-foreground",
            "border border-[var(--studio-border)]",
            "shadow-[0_1px_2px_hsl(220_20%_20%/0.06)]",
            "placeholder:text-muted-foreground/80",
            "transition-[box-shadow,border-color,background-color] duration-150",
            "hover:border-[var(--studio-border-strong)]",
            "focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]",
            "disabled:cursor-not-allowed disabled:opacity-65 disabled:bg-secondary/70 disabled:text-muted-foreground",
          ].join(" "),
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
