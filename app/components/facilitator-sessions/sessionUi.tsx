"use client";

import { useState, type ReactNode, type RefObject } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/app/components/ui/button";
import { normalizeSessionStatus, type SessionStatus } from "@/lib/sessionStatus";

export type StatusFilter = "all" | "live" | "ended";

export function toStatusFilter(value: string): StatusFilter {
  return value === "live" || value === "ended" ? value : "all";
}

export function fmt(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function statusTone(status?: SessionStatus | null) {
  const s = normalizeSessionStatus(status);
  if (s === "live") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (s === "ended") {
    return "border-border bg-secondary/50 text-foreground";
  }
  if (s === "unknown") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-[var(--studio-border)] bg-[var(--studio-surface2)] text-foreground";
}

export function StatusPill({ status }: { status?: SessionStatus | null }) {
  const s = normalizeSessionStatus(status);
  const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide";
  return <span className={`${base} ${statusTone(s)}`}>{s.toUpperCase()}</span>;
}

export function ModePill({ mode }: { mode: "rehearsal" | "live" }) {
  const cls =
    mode === "rehearsal"
      ? "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300"
      : "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide ${cls}`}>
      {mode === "rehearsal" ? "REHEARSAL" : "LIVE EXERCISE"}
    </span>
  );
}

export function Select({
  id,
  inputRef,
  value,
  onChange,
  children,
}: {
  id?: string;
  inputRef?: RefObject<HTMLSelectElement | null>;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      id={id}
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={[
        "h-10 w-full rounded-[var(--radius)] px-3 text-sm",
        "border border-[var(--studio-border)]",
        "bg-[var(--studio-surface2)] text-foreground",
        "shadow-[0_1px_2px_hsl(220_20%_20%/0.06)]",
        "hover:border-[var(--studio-border-strong)]",
        "focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]",
        "transition-[box-shadow,border-color,background-color] duration-150",
      ].join(" ")}
    >
      {children}
    </select>
  );
}

export function Chip({
  label,
  onClear,
  title,
}: {
  label: string;
  onClear: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      title={title}
      className="inline-flex items-center gap-1 rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-2.5 py-1 text-xs font-medium hover:bg-secondary/60 transition"
    >
      <span className="truncate max-w-[220px]">{label}</span>
      <span aria-hidden="true" className="opacity-70">×</span>
    </button>
  );
}

export function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        } catch {}
      }}
      title={value}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copied" : label}
    </Button>
  );
}
