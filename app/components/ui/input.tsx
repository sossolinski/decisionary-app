"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full px-3 text-sm",
        "rounded-[var(--radius)]",
        "border border-border bg-background",
        "placeholder:text-muted-foreground",
        "focus-visible:shadow-[var(--studio-ring)] focus-visible:outline-none",
        className
      )}
      {...props}
    />
  );
}
