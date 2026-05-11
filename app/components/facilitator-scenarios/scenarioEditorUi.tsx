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
export const EDITOR_ICON = {
  eyebrow: "h-3.5 w-3.5 shrink-0 text-[color:var(--studio-muted2)] stroke-[1.8]",
  section: "h-4 w-4 shrink-0 text-[color:var(--studio-muted2)] stroke-[1.8]",
  field: "h-4 w-4 shrink-0 text-[color:var(--studio-muted2)] stroke-[1.8]",
  action: "h-4 w-4 shrink-0 stroke-[1.8]",
  chevron: "h-4 w-4 shrink-0 text-[color:var(--studio-muted2)] stroke-[1.8]",
  drag: "h-4 w-4 shrink-0 text-[color:var(--studio-muted2)] stroke-[1.8]",
} as const;
export const RULE_PRESETS = [
  {
    key: "urgent-inbox-escalation",
    name: "Urgent inbox escalation",
    description: "When participants escalate an urgent inbox update, create visible operational pressure and a short-deadline coordination task.",
    triggerType: "decision_recorded",
    triggerConfig: {
      source: "inbox",
      inject_kind: "operational",
      severity: "high",
      decision_type: "escalate",
    },
    conditionConfig: {
      decision_required: true,
    },
    effectConfig: {
      consequence_type: "escalation_pressure",
      severity: "high",
      title: "Escalation pressure rises around {{inject_title}}",
      description: "The team escalated {{inject_title}}. Leadership, operations, and communications now need a coordinated response path.",
      create_task: {
        title: "Coordinate response for {{inject_title}}",
        description: "Assign owners, confirm the escalation path, and prepare the next operational update.",
        priority: "high",
        assigned_role: "facilitator",
        due_in_minutes: 10,
      },
    },
  },
  {
    key: "pulse-confirmed-public-pressure",
    name: "Confirmed Pulse creates public pressure",
    description: "When a Pulse item is confirmed, add media pressure and send an inbox request for an official line.",
    triggerType: "decision_recorded",
    triggerConfig: {
      source: "pulse",
      severity: "high",
      decision_type: "confirm",
    },
    conditionConfig: {},
    effectConfig: {
      consequence_type: "media_pressure",
      severity: "high",
      title: "Public pressure intensifies after confirming {{inject_title}}",
      description: "Confirmation gives the Pulse item operational weight. External attention is now likely to move faster than internal coordination.",
      send_inject: {
        title: "Comms requests an official line on {{inject_title}}",
        body: "Communications asks for approved wording, spokesperson availability, and timing for the next update after {{decision_type}}.",
        channel: "inbox",
        severity: "high",
        inject_kind: "operational",
        entity_scope: "brand",
        requires_decision: true,
        decision_template_key: "media-holding-statement",
      },
    },
  },
  {
    key: "critical-update-released",
    name: "Critical update lands",
    description: "When a critical update is released, create immediate session pressure and a task to stabilize the operating picture.",
    triggerType: "inject_released",
    triggerConfig: {
      channel: "inbox",
      severity: "critical",
      inject_kind: "operational",
    },
    conditionConfig: {},
    effectConfig: {
      consequence_type: "operational_pressure",
      severity: "critical",
      title: "Critical operating pressure: {{inject_title}}",
      description: "{{inject_title}} has entered the session as a critical update. The facilitator should expect faster decisions and tighter coordination.",
      create_task: {
        title: "Stabilize response to {{inject_title}}",
        description: "Confirm ownership, next update timing, and immediate dependencies for the critical update.",
        priority: "critical",
        assigned_role: "facilitator",
        due_in_minutes: 5,
      },
    },
  },
  {
    key: "overdue-follow-up-recovery",
    name: "Overdue follow-up recovery",
    description: "When an open follow-up becomes overdue, create pressure and prompt the facilitator to recover the work.",
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
      description: "{{task_title}} has passed its due time. The exercise should now reflect friction, delay, or leadership attention.",
      create_task: {
        title: "Recover overdue task: {{task_title}}",
        description: "Find the blocker, assign an owner, and decide what the next update should say.",
        priority: "high",
        assigned_role: "facilitator",
        due_in_minutes: 10,
      },
      send_inject: {
        title: "Teams request a revised timeline for {{task_title}}",
        body: "{{task_title}} is overdue. Affected teams ask whether priorities have changed and when they should expect direction.",
        channel: "inbox",
        severity: "high",
        inject_kind: "operational",
        requires_decision: true,
        decision_template_key: "overdue-task-recovery",
      },
    },
  },
  {
    key: "blocked-workstream",
    name: "Blocked workstream",
    description: "When a task is marked blocked, create a consequence and ask for a workaround decision.",
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
      title: "Workstream blocked: {{task_title}}",
      description: "{{task_title}} is blocked. The session should now surface dependency pressure and force a workaround or escalation.",
      create_task: {
        title: "Choose workaround for {{task_title}}",
        description: "Identify the blocker, pick a workaround, and update affected roles.",
        priority: "high",
        assigned_role: "facilitator",
        due_in_minutes: 10,
      },
      send_inject: {
        title: "Leadership asks for blocker options on {{task_title}}",
        body: "{{task_title}} is blocked. Leadership asks for options, trade-offs, and a recommended next move.",
        channel: "inbox",
        severity: "high",
        inject_kind: "operational",
        requires_decision: true,
        decision_template_key: "blocked-task-response",
      },
    },
  },
  {
    key: "completed-task-next-development",
    name: "Completed task reveals next development",
    description: "When a task is completed, send a new inbox update that moves the scenario forward.",
    triggerType: "task_status_changed",
    triggerConfig: {
      task_status: "done",
    },
    conditionConfig: {},
    effectConfig: {
      consequence_type: "scenario_development",
      severity: "medium",
      title: "Progress made on {{task_title}}",
      description: "{{task_title}} is complete. The exercise can now reveal the next operational development.",
      send_inject: {
        title: "New development after {{task_title}}",
        body: "Completion of {{task_title}} changes the operating picture. Stakeholders now need direction on the next step.",
        channel: "inbox",
        severity: "medium",
        inject_kind: "operational",
        requires_decision: false,
      },
    },
  },
  {
    key: "manual-facilitator-complication",
    name: "Manual complication",
    description: "A facilitator-triggered pressure card for moments when the room needs a realistic complication.",
    triggerType: "manual",
    triggerConfig: {},
    conditionConfig: {},
    effectConfig: {
      consequence_type: "scenario_development",
      severity: "medium",
      title: "Facilitator complication",
      description: "The facilitator introduces a new constraint or stakeholder pressure to keep the exercise moving.",
      send_inject: {
        title: "New constraint enters the exercise",
        body: "A new operational constraint has emerged. Teams should reassess priorities, dependencies, and the next public or internal update.",
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
