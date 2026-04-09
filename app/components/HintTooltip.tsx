"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

type HintTooltipProps = {
  text: string;
  label?: string;
  className?: string;
};

export default function HintTooltip({
  text,
  label = "Show guidance",
  className,
}: HintTooltipProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      className={cn("relative inline-flex items-center align-middle", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        className={[
          "inline-flex h-4 w-4 items-center justify-center rounded-full",
          "border border-[color:var(--studio-border)] bg-[var(--studio-surface2)] text-[color:var(--studio-muted2)]",
          "transition-colors hover:border-[color:var(--studio-border-strong)] hover:text-foreground",
          "focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]",
        ].join(" ")}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((value) => !value)}
      >
        <Info className="h-2.5 w-2.5" />
      </button>

      {open ? (
        <span
          id={tooltipId}
          role="tooltip"
          className={[
            "absolute left-1/2 top-[calc(100%+0.45rem)] z-50 w-56 -translate-x-1/2 rounded-[12px]",
            "border border-[color:var(--studio-border)] bg-[var(--studio-surface2)] px-3 py-2 text-left",
            "text-[11px] leading-5 text-[color:var(--studio-muted)] shadow-soft backdrop-blur-sm",
          ].join(" ")}
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
