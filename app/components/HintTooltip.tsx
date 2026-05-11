"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

type HintTooltipProps = {
  text: string;
  label?: string;
  className?: string;
  side?: "bottom" | "right" | "top" | "left";
};

export default function HintTooltip({
  text,
  label = "Show help",
  className,
  side = "bottom",
}: HintTooltipProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const tooltipId = useId();
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;

    const gap = 8;
    const viewportPadding = 12;

    function placeTooltip() {
      const button = buttonRef.current;
      const tooltip = tooltipRef.current;
      if (!button || !tooltip) return;

      const anchor = button.getBoundingClientRect();
      const tooltipWidth = tooltip.offsetWidth;
      const tooltipHeight = tooltip.offsetHeight;
      const maxLeft = window.innerWidth - tooltipWidth - viewportPadding;
      const maxTop = window.innerHeight - tooltipHeight - viewportPadding;

      let nextLeft = viewportPadding;
      let nextTop = viewportPadding;

      if (side === "right") {
        nextLeft = anchor.right + gap;
        nextTop = anchor.top + anchor.height / 2 - tooltipHeight / 2;
      } else if (side === "left") {
        nextLeft = anchor.left - tooltipWidth - gap;
        nextTop = anchor.top + anchor.height / 2 - tooltipHeight / 2;
      } else if (side === "top") {
        nextLeft = anchor.left;
        nextTop = anchor.top - tooltipHeight - gap;
      } else {
        nextLeft = anchor.left;
        nextTop = anchor.bottom + gap;
      }

      if (nextLeft < viewportPadding) nextLeft = viewportPadding;
      if (nextLeft > maxLeft) nextLeft = maxLeft;
      if (nextTop < viewportPadding) nextTop = viewportPadding;
      if (nextTop > maxTop) nextTop = maxTop;

      setPosition({ top: nextTop, left: nextLeft });
    }

    placeTooltip();
    window.addEventListener("resize", placeTooltip);
    window.addEventListener("scroll", placeTooltip, true);
    return () => {
      window.removeEventListener("resize", placeTooltip);
      window.removeEventListener("scroll", placeTooltip, true);
    };
  }, [open, side, text]);

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
      className={cn("relative inline-flex shrink-0 items-center align-middle", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        className={[
          "inline-flex h-5 w-5 items-center justify-center rounded-[6px]",
          "border border-[color:var(--studio-border)] bg-[var(--studio-surface2)] text-[color:var(--studio-muted2)]",
          "transition-colors hover:border-[color:var(--studio-border-strong)] hover:text-foreground",
          "focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]",
          "shrink-0 normal-case tracking-normal",
        ].join(" ")}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((value) => !value)}
      >
        <Info className="h-3 w-3 stroke-[1.8]" />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <span
              id={tooltipId}
              ref={tooltipRef}
              role="tooltip"
              className={[
                "fixed z-[120] w-56 max-w-[min(18rem,calc(100vw-2rem))] rounded-[14px]",
                "border border-[color:var(--studio-border)] bg-[color:var(--studio-surface)] px-3 py-2.5 text-left",
                "text-[12px] font-medium normal-case tracking-normal leading-5 text-[color:var(--studio-muted)] shadow-[0_14px_32px_hsl(220_20%_20%/0.08)] backdrop-blur-sm",
                "whitespace-normal",
              ].join(" ")}
              style={
                position
                  ? {
                      top: `${position.top}px`,
                      left: `${position.left}px`,
                    }
                  : {
                      top: "-9999px",
                      left: "-9999px",
                    }
              }
            >
              {text}
            </span>,
            document.body
          )
        : null}
    </span>
  );
}
