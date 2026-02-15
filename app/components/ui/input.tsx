// app/components/ui/input.tsx
import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          [
            "flex h-10 w-full rounded-[var(--radius)] px-3 py-2 text-sm",
            "border border-[var(--studio-border)]",
            "bg-[var(--studio-surface2)]",
            "text-foreground placeholder:text-[color:var(--studio-muted2)]",
            "shadow-none",
            "transition",
            "focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          ].join(" "),
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
