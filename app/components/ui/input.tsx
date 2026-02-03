// app/components/ui/input.tsx
import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          [
            // base
            "flex h-10 w-full rounded-[var(--radius)] border border-input bg-background px-3 py-2 text-sm",
            "text-foreground shadow-sm",
            "placeholder:text-muted-foreground",
            // hover / focus
            "transition-colors transition-shadow",
            "hover:border-border",
            "focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)] focus-visible:border-primary/40",
            // file input
            "file:border-0 file:bg-transparent file:text-sm file:font-medium",
            // disabled
            "disabled:cursor-not-allowed disabled:opacity-50",
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
