"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({
  className,
  variant = "secondary",
  size = "md",
  ...props
}: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition",
        "rounded-[var(--radius)]",
        "focus-visible:shadow-[var(--studio-ring)]",
        "disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" ? "h-8 px-3 text-sm" : "h-9 px-4 text-sm",
        variant === "primary" &&
          "bg-primary text-primary-foreground hover:opacity-90",
        variant === "secondary" &&
          "bg-card text-foreground border border-border hover:bg-secondary",
        variant === "ghost" && "hover:bg-secondary",
        variant === "danger" &&
          "border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.06)] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.10)]",
        className
      )}
      {...props}
    />
  );
}
