"use client";

import type { ReactNode } from "react";

import type { Inject } from "@/lib/scenarios";

export const INJECT_KIND_OPTIONS: Array<NonNullable<Inject["inject_kind"]>> = [
  "operational",
  "media",
  "social",
  "intel",
  "internal",
  "system",
];

export const SOURCE_TYPE_OPTIONS: Array<NonNullable<Inject["source_type"]>> = [
  "manual",
  "scheduled",
  "conditional",
  "consequence",
];

export const VISIBILITY_SCOPE_OPTIONS = ["all", "facilitator_only", "role_specific"] as const;
export const RULE_TRIGGER_OPTIONS = ["inject_released", "decision_recorded", "task_overdue", "task_status_changed", "manual"] as const;
export const RULE_PRESETS = [
  {
    key: "ops-escalation-after-escalate",
    name: "Operational escalation after ESCALATE",
    description: "When an operational inject is escalated, create a high-priority consequence and follow-up task.",
    triggerType: "decision_recorded",
    triggerConfig: {
      inject_kind: "operational",
      decision_type: "escalate",
    },
    conditionConfig: {
      decision_required: true,
    },
    effectConfig: {
      consequence_type: "escalation_pressure",
      severity: "high",
      title: "Operational escalation triggered for {{inject_title}}",
      description: "The issue {{inject_title}} has been escalated and needs coordinated cross-functional follow-up.",
      create_task: {
        title: "Coordinate escalation response for {{inject_title}}",
        description: "Assign owners, confirm escalation path, and track external dependencies after {{decision_type}}.",
        priority: "high",
        assigned_role: "facilitator",
        due_in_minutes: 10,
      },
    },
  },
  {
    key: "media-pressure-after-confirm",
    name: "Media pressure after CONFIRM",
    description: "A confirmed public signal raises media pressure and emits a follow-up media inject.",
    triggerType: "decision_recorded",
    triggerConfig: {
      source: "pulse",
      decision_type: "confirm",
    },
    conditionConfig: {},
    effectConfig: {
      consequence_type: "media_pressure",
      severity: "high",
      title: "Media pressure intensifies around {{inject_title}}",
      description: "Confirmation creates immediate external attention and press follow-up for {{inject_title}}.",
      send_inject: {
        title: "Media desk requests official line on {{inject_title}}",
        body: "External media requests a confirmed statement, spokesperson availability, and timing for the next update after {{decision_type}}.",
        channel: "inbox",
        severity: "high",
        inject_kind: "media",
        entity_scope: "brand",
        requires_decision: true,
        decision_template_key: "media-holding-statement",
      },
    },
  },
  {
    key: "social-ripple-on-release",
    name: "Social ripple on release",
    description: "A social inject automatically creates a monitoring consequence when it appears in the session.",
    triggerType: "inject_released",
    triggerConfig: {
      inject_kind: "social",
    },
    conditionConfig: {},
    effectConfig: {
      consequence_type: "social_monitoring",
      severity: "medium",
      title: "Social chatter is building around {{inject_title}}",
      description: "Social activity around {{inject_title}} needs monitoring and a quick decision on whether to respond.",
      create_task: {
        title: "Assess social response posture for {{inject_title}}",
        description: "Review the signal, estimate spread risk, and decide if a response is required for {{channel}}.",
        priority: "medium",
        assigned_role: "facilitator",
        due_in_minutes: 15,
      },
    },
  },
  {
    key: "task-overdue-escalation",
    name: "Task overdue escalation",
    description: "When a live follow-up task passes its due time, create a consequence and a fresh escalation task.",
    triggerType: "task_overdue",
    triggerConfig: {
      task_status: "open",
    },
    conditionConfig: {
      task_title_excludes: "Recover overdue task:",
    },
    effectConfig: {
      consequence_type: "task_overdue",
      severity: "high",
      title: "Follow-up task overdue: {{task_title}}",
      description: "The task {{task_title}} has passed its due time and needs active intervention.",
      create_task: {
        title: "Recover overdue task: {{task_title}}",
        description: "Review why {{task_title}} is overdue, assign an owner, and push the next update.",
        priority: "high",
        assigned_role: "facilitator",
        due_in_minutes: 10,
      },
      send_inject: {
        title: "Operational pressure increases around {{task_title}}",
        body: "The follow-up item {{task_title}} is overdue. Teams request direction and a revised timeline.",
        channel: "inbox",
        severity: "high",
        inject_kind: "operational",
        requires_decision: true,
        decision_template_key: "overdue-task-recovery",
      },
    },
  },
  {
    key: "blocked-task-escalation",
    name: "Blocked task escalation",
    description: "When a follow-up task becomes blocked, create pressure and prompt the next operational decision.",
    triggerType: "task_status_changed",
    triggerConfig: {
      task_status: "blocked",
    },
    conditionConfig: {
      task_title_excludes: "Unblock ",
    },
    effectConfig: {
      consequence_type: "blocked_task",
      severity: "high",
      title: "Task blocked: {{task_title}}",
      description: "The team marked {{task_title}} as blocked and needs intervention to unblock progress.",
      create_task: {
        title: "Unblock {{task_title}}",
        description: "Identify blockers, assign support, and restore momentum for {{task_title}}.",
        priority: "high",
        assigned_role: "facilitator",
        due_in_minutes: 10,
      },
      send_inject: {
        title: "Leadership asks how to unblock {{task_title}}",
        body: "The workstream tied to {{task_title}} is blocked. Teams need a decision, a workaround, or additional support right now.",
        channel: "inbox",
        severity: "high",
        inject_kind: "operational",
        requires_decision: true,
        decision_template_key: "blocked-task-response",
      },
    },
  },
  {
    key: "completed-task-follow-up",
    name: "Completed task follow-up",
    description: "When a key task is completed, generate a follow-up update to move the scenario forward.",
    triggerType: "task_status_changed",
    triggerConfig: {
      task_status: "done",
    },
    conditionConfig: {},
    effectConfig: {
      consequence_type: "task_completed",
      severity: "medium",
      title: "Task completed: {{task_title}}",
      description: "{{task_title}} is marked complete, so the scenario can advance to the next development.",
      send_inject: {
        title: "New development after {{task_title}}",
        body: "The completion of {{task_title}} changes the operating picture. Stakeholders now want an update on the next move and downstream effects.",
        channel: "inbox",
        severity: "medium",
        inject_kind: "operational",
        requires_decision: false,
      },
    },
  },
] as const;

export function Select({
  id,
  value,
  onChange,
  children,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={[
        "h-10 w-full rounded-[var(--radius)] px-3 text-sm",
        "border border-[var(--studio-border)]",
        "bg-background text-foreground",
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

export function MiniBadge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "accent" | "warm";
  children: ReactNode;
}) {
  const toneClass =
    tone === "accent"
      ? "border-[hsl(var(--primary)/0.22)] bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]"
      : tone === "warm"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-[var(--studio-border)] bg-[var(--studio-surface2)] text-[color:var(--studio-muted)]";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}>
      {children}
    </span>
  );
}

export function asInt(v: string) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

export function toDatetimeLocal(iso: string | null | undefined) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (x: number) => String(x).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  } catch {
    return "";
  }
}

export function formatReleaseOffset(minutes: number | null | undefined) {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) {
    return "Immediate";
  }

  const totalMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(totalMinutes / 60);
  const remainder = totalMinutes % 60;

  if (hours > 0 && remainder > 0) {
    return `T+${hours}h ${remainder}m`;
  }
  if (hours > 0) {
    return `T+${hours}h`;
  }
  return `T+${remainder}m`;
}

export function fromDatetimeLocal(v: string) {
  const s = (v ?? "").trim();
  if (!s) return null;
  try {
    return new Date(s).toISOString();
  } catch {
    return null;
  }
}

export function fmt(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function errMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

export function jsonText(value: Record<string, unknown> | null | undefined) {
  return JSON.stringify(value ?? {}, null, 2);
}

export function parseJsonConfig(raw: string, label: string) {
  const source = raw.trim();
  if (!source) return {};
  try {
    const parsed = JSON.parse(source) as unknown;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error(`${label} must be a JSON object.`);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error && error.message.includes("must be a JSON object")) {
      throw error;
    }
    throw new Error(`${label} must be valid JSON.`);
  }
}

export function presetRuleKey(baseKey: string) {
  return `${baseKey}-${Math.random().toString(36).slice(2, 6)}`;
}
