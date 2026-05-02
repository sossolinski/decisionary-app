"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";

import type { SessionConsequence, SessionTask } from "@/lib/sessionEngine";

export function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    onChange();
    m.addEventListener?.("change", onChange);
    return () => m.removeEventListener?.("change", onChange);
  }, [query]);
  return matches;
}

export function fmt(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

export function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
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
      <X className="h-3.5 w-3.5 opacity-70" />
    </button>
  );
}

export function Badge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="ml-2 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] leading-none px-2 h-5">
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function RuntimeMetric({
  label,
  value,
  icon,
  compact = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        compact
          ? "min-w-[184px] rounded-[10px] bg-card/72 px-3 py-2 shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.035)]"
          : "ui-metric-card shadow-none px-4 py-3",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="ui-metric-label">{label}</div>
          <div className={compact ? "mt-0.5 text-[15px] font-semibold" : "mt-1 text-xl font-semibold"}>
            {value}
          </div>
        </div>
        <div
          className={[
            "flex items-center justify-center rounded-[10px] bg-secondary/55 text-[color:var(--studio-ink)]",
            compact ? "h-7 w-7" : "h-9 w-9",
          ].join(" ")}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export function taskPriorityTone(priority: SessionTask["priority"]) {
  if (priority === "critical") return "text-red-600 dark:text-red-300 bg-red-500/10 border-red-500/20";
  if (priority === "high") return "text-orange-700 dark:text-orange-300 bg-orange-500/10 border-orange-500/20";
  if (priority === "medium") return "text-yellow-700 dark:text-yellow-300 bg-yellow-500/10 border-yellow-500/20";
  return "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/20";
}

export function consequenceSeverityTone(severity: SessionConsequence["severity"]) {
  if (severity === "critical") return "text-red-600 dark:text-red-300 bg-red-500/10 border-red-500/20";
  if (severity === "high") return "text-orange-700 dark:text-orange-300 bg-orange-500/10 border-orange-500/20";
  if (severity === "medium") return "text-yellow-700 dark:text-yellow-300 bg-yellow-500/10 border-yellow-500/20";
  return "text-sky-700 dark:text-sky-300 bg-sky-500/10 border-sky-500/20";
}

export function taskStatusTone(status: SessionTask["status"]) {
  if (status === "done") return "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/20";
  if (status === "in_progress") return "text-sky-700 dark:text-sky-300 bg-sky-500/10 border-sky-500/20";
  if (status === "blocked") return "text-red-600 dark:text-red-300 bg-red-500/10 border-red-500/20";
  if (status === "cancelled") return "text-slate-600 dark:text-slate-300 bg-slate-500/10 border-slate-500/20";
  return "text-yellow-700 dark:text-yellow-300 bg-yellow-500/10 border-yellow-500/20";
}

export function consequenceTypeLabel(item: SessionConsequence) {
  if (item.consequence_type === "decision_recorded") return "Decision rule";
  if (item.consequence_type === "inject_released") return "Inject rule";
  if (item.consequence_type === "task_overdue") return "Overdue rule";
  return item.consequence_type;
}

export function consequenceImpactLabel(item: SessionConsequence) {
  if (item.task_id) return "Created or updated follow-up";
  if (item.decision_id) return "Changed decision pressure";
  if (item.session_inject_id) return "Changed update chain";
  return "Added session pressure";
}

export function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

export function humanActionLabel(actionType: string | null | undefined) {
  if (actionType === "ignore") return "Monitoring update";
  if (actionType === "escalate") return "Escalation";
  if (actionType === "act") return "Action taken";
  return "Team response";
}

export function humanDecisionLabel(decisionType: string | null | undefined) {
  if (decisionType === "ignore") return "Decision to monitor";
  if (decisionType === "escalate") return "Decision to escalate";
  if (decisionType === "act") return "Decision to act";
  if (decisionType === "confirm") return "Confirmed update";
  if (decisionType === "deny") return "Dismissed update";
  return "Team decision";
}
