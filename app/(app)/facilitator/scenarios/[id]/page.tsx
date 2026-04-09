// app/(app)/facilitator/scenarios/[id]/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";

import {
  getScenario,
  updateScenario,
  listScenarioInjects,
  listScenarioRuleTemplates,
  createInject,
  attachInjectToScenario,
  detachScenarioInject,
  updateScenarioInject,
  createScenarioRuleTemplate,
  updateScenarioRuleTemplate,
  deleteScenarioRuleTemplate,
  type Scenario,
  type ScenarioInject,
  type Inject,
  type ScenarioRuleTemplate,
} from "@/lib/scenarios";

import { useRoleContext } from "@/app/components/useRoleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import HintTooltip from "@/app/components/HintTooltip";

import {
  ArrowLeft,
  RefreshCw,
  Save,
  FileText,
  Calendar,
  MapPin,
  AlertTriangle,
  Users,
  Plus,
  ChevronDown,
  ChevronUp,
  Settings2,
  Trash2,
  Link2Off,
  MoveUp,
  MoveDown,
  Sparkles,
} from "lucide-react";

const INJECT_KIND_OPTIONS: Array<NonNullable<Inject["inject_kind"]>> = [
  "operational",
  "media",
  "social",
  "intel",
  "internal",
  "system",
];

const SOURCE_TYPE_OPTIONS: Array<NonNullable<Inject["source_type"]>> = [
  "manual",
  "scheduled",
  "conditional",
  "consequence",
];

const VISIBILITY_SCOPE_OPTIONS = ["all", "facilitator_only", "role_specific"] as const;
const RULE_TRIGGER_OPTIONS = ["inject_released", "decision_recorded", "task_overdue", "manual"] as const;
const RULE_PRESETS = [
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
        channel: "media",
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
      task_title_includes: "",
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
        channel: "ops",
        severity: "high",
        inject_kind: "operational",
        requires_decision: true,
        decision_template_key: "overdue-task-recovery",
      },
    },
  },
] as const;

function Select({
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

function MiniBadge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "accent" | "warm";
  children: React.ReactNode;
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

function asInt(v: string) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

function toDatetimeLocal(iso: string | null | undefined) {
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

function fromDatetimeLocal(v: string) {
  const s = (v ?? "").trim();
  if (!s) return null;
  try {
    return new Date(s).toISOString();
  } catch {
    return null;
  }
}

function fmt(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function errMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

function jsonText(value: Record<string, unknown> | null | undefined) {
  return JSON.stringify(value ?? {}, null, 2);
}

function parseJsonConfig(raw: string, label: string) {
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

function presetRuleKey(baseKey: string) {
  return `${baseKey}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function FacilitatorScenarioEditorPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { loading: roleLoading, canFacilitate } = useRoleContext();
  const id = params?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [injects, setInjects] = useState<ScenarioInject[]>([]);
  const [rules, setRules] = useState<ScenarioRuleTemplate[]>([]);

  // drafts – scenario
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [timezone, setTimezone] = useState("");
  const [location, setLocation] = useState("");

  const [situationType, setSituationType] = useState("");
  const [shortDescription, setShortDescription] = useState("");

  const [injured, setInjured] = useState("0");
  const [fatalities, setFatalities] = useState("0");
  const [uninjured, setUninjured] = useState("0");
  const [unknown, setUnknown] = useState("0");

  // drafts – new inject
  const [niTitle, setNiTitle] = useState("");
  const [niBody, setNiBody] = useState("");
  const [niChannel, setNiChannel] = useState("ops");
  const [niSeverity, setNiSeverity] = useState<string>("");
  const [niSenderName, setNiSenderName] = useState<string>("Facilitator");
  const [niSenderOrg, setNiSenderOrg] = useState<string>("Decisionary");
  const [niScheduledLocal, setNiScheduledLocal] = useState<string>("");
  const [niInjectKind, setNiInjectKind] = useState<NonNullable<Inject["inject_kind"]>>("operational");
  const [niSourceType, setNiSourceType] = useState<NonNullable<Inject["source_type"]>>("manual");
  const [niEntityScope, setNiEntityScope] = useState("");
  const [niRequiresDecision, setNiRequiresDecision] = useState(false);
  const [niDecisionTemplateKey, setNiDecisionTemplateKey] = useState("");
  const [niVisibilityScope, setNiVisibilityScope] = useState<(typeof VISIBILITY_SCOPE_OPTIONS)[number]>("all");
  const [niBranchKey, setNiBranchKey] = useState("");

  // UI
  const [openSiId, setOpenSiId] = useState<string | null>(null);
  const [newInjectOpen, setNewInjectOpen] = useState(false);
  const [openRuleId, setOpenRuleId] = useState<string | null>(null);
  const [newRuleOpen, setNewRuleOpen] = useState(false);

  const [nrRuleKey, setNrRuleKey] = useState("");
  const [nrRuleName, setNrRuleName] = useState("");
  const [nrDescription, setNrDescription] = useState("");
  const [nrTriggerType, setNrTriggerType] = useState<(typeof RULE_TRIGGER_OPTIONS)[number]>("inject_released");
  const [nrTriggerConfig, setNrTriggerConfig] = useState('{\n  "inject_kind": "operational"\n}');
  const [nrConditionConfig, setNrConditionConfig] = useState("{}");
  const [nrEffectConfig, setNrEffectConfig] = useState('{\n  "create_consequence": true,\n  "severity": "medium"\n}');
  const [nrEnabled, setNrEnabled] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, si, ruleRows] = await Promise.all([
        getScenario(id),
        listScenarioInjects(id),
        listScenarioRuleTemplates(id),
      ]);
      setScenario(s);
      setInjects(si ?? []);
      setRules(ruleRows ?? []);

      // hydrate scenario drafts
      setTitle(s?.title ?? "");
      setDescription(s?.description ?? "");

      setEventDate(s?.event_date ?? "");
      setEventTime(s?.event_time ?? "");
      setTimezone(s?.timezone ?? "");
      setLocation(s?.location ?? "");

      setSituationType(s?.situation_type ?? "");
      setShortDescription(s?.short_description ?? "");

      setInjured(String(s?.injured ?? 0));
      setFatalities(String(s?.fatalities ?? 0));
      setUninjured(String(s?.uninjured ?? 0));
      setUnknown(String(s?.unknown ?? 0));
    } catch (e: unknown) {
      setError(errMessage(e, "Failed to load scenario."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (roleLoading || !canFacilitate) return;
    void load();
  }, [roleLoading, canFacilitate, load]);

  const sortedInjects = useMemo(() => {
    return [...injects].sort((a, b) => {
      const ao = a.order_index ?? 0;
      const bo = b.order_index ?? 0;
      if (ao !== bo) return ao - bo;
      return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
    });
  }, [injects]);

  const hasChanges = useMemo(() => {
    if (!scenario) return false;
    return (
      title !== (scenario.title ?? "") ||
      description !== (scenario.description ?? "") ||
      eventDate !== (scenario.event_date ?? "") ||
      eventTime !== (scenario.event_time ?? "") ||
      timezone !== (scenario.timezone ?? "") ||
      location !== (scenario.location ?? "") ||
      situationType !== (scenario.situation_type ?? "") ||
      shortDescription !== (scenario.short_description ?? "") ||
      asInt(injured) !== (scenario.injured ?? 0) ||
      asInt(fatalities) !== (scenario.fatalities ?? 0) ||
      asInt(uninjured) !== (scenario.uninjured ?? 0) ||
      asInt(unknown) !== (scenario.unknown ?? 0)
    );
  }, [
    scenario,
    title,
    description,
    eventDate,
    eventTime,
    timezone,
    location,
    situationType,
    shortDescription,
    injured,
    fatalities,
    uninjured,
    unknown,
  ]);

  async function onSaveScenario() {
    if (!scenario) return;

    setSaving(true);
    setError(null);
    try {
      const patch: Partial<Scenario> = {
        title: title.trim() || "Untitled scenario",
        description: description.trim() || null,

        event_date: eventDate.trim() || null,
        event_time: eventTime.trim() || null,
        timezone: timezone.trim() || null,
        location: location.trim() || null,

        situation_type: situationType.trim() || null,
        short_description: shortDescription.trim() || null,

        injured: asInt(injured),
        fatalities: asInt(fatalities),
        uninjured: asInt(uninjured),
        unknown: asInt(unknown),
      };

      const updated = await updateScenario(id, patch);
      setScenario(updated);

      // sync drafts
      setTitle(updated.title ?? "");
      setDescription(updated.description ?? "");

      setEventDate(updated.event_date ?? "");
      setEventTime(updated.event_time ?? "");
      setTimezone(updated.timezone ?? "");
      setLocation(updated.location ?? "");

      setSituationType(updated.situation_type ?? "");
      setShortDescription(updated.short_description ?? "");

      setInjured(String(updated.injured ?? 0));
      setFatalities(String(updated.fatalities ?? 0));
      setUninjured(String(updated.uninjured ?? 0));
      setUnknown(String(updated.unknown ?? 0));
    } catch (e: unknown) {
      setError(errMessage(e, "Failed to save scenario."));
    } finally {
      setSaving(false);
    }
  }

  async function onCreateScenarioInject() {
    if (!niTitle.trim() || !niBody.trim()) {
      setError("Inject title and body are required.");
      return;
    }

    setBusyKey("create-inject");
    setError(null);

    try {
      const inject = await createInject({
        title: niTitle.trim(),
        body: niBody.trim(),
        channel: niChannel.trim() || "ops",
        severity: niSeverity.trim() || null,
        sender_name: niSenderName.trim() || null,
        sender_org: niSenderOrg.trim() || null,
        inject_kind: niInjectKind,
        source_type: niSourceType,
        entity_scope: niEntityScope.trim() || null,
        requires_decision: niRequiresDecision,
        decision_template_key: niDecisionTemplateKey.trim() || null,
        visibility_scope: niVisibilityScope,
        branch_key: niBranchKey.trim() || null,
      });

      const scheduled_at = fromDatetimeLocal(niScheduledLocal);
      await attachInjectToScenario({
        scenarioId: id,
        injectId: inject.id,
        scheduled_at,
      });

      setNiTitle("");
      setNiBody("");
      setNiChannel("ops");
      setNiSeverity("");
      setNiSenderName("Facilitator");
      setNiSenderOrg("Decisionary");
      setNiScheduledLocal("");
      setNiInjectKind("operational");
      setNiSourceType("manual");
      setNiEntityScope("");
      setNiRequiresDecision(false);
      setNiDecisionTemplateKey("");
      setNiVisibilityScope("all");
      setNiBranchKey("");

      setNewInjectOpen(false);
      await load();
    } catch (e: unknown) {
      setError(errMessage(e, "Failed to create inject."));
    } finally {
      setBusyKey(null);
    }
  }

  async function onDetach(siId: string) {
    if (!confirm("Detach this inject from scenario?")) return;
    setBusyKey(`detach:${siId}`);
    setError(null);
    try {
      await detachScenarioInject(siId);
      await load();
    } catch (e: unknown) {
      setError(errMessage(e, "Failed to detach inject."));
    } finally {
      setBusyKey(null);
    }
  }

  async function onDeleteInject(injectId: string) {
    if (!confirm("Delete this inject (from injects table)? This may affect other scenarios.")) return;
    setBusyKey(`delinj:${injectId}`);
    setError(null);
    try {
      const { error } = await supabase.from("injects").delete().eq("id", injectId);
      if (error) throw error;
      await load();
    } catch (e: unknown) {
      setError(errMessage(e, "Failed to delete inject."));
    } finally {
      setBusyKey(null);
    }
  }

  async function onUpdateInject(injectId: string, patch: Partial<Inject>) {
    setBusyKey(`upd:${injectId}`);
    setError(null);
    try {
      const { error } = await supabase.from("injects").update(patch).eq("id", injectId);
      if (error) throw error;
      await load();
    } catch (e: unknown) {
      setError(errMessage(e, "Failed to update inject."));
    } finally {
      setBusyKey(null);
    }
  }

  async function onReschedule(siId: string, scheduledLocal: string) {
    setBusyKey(`sched:${siId}`);
    setError(null);
    try {
      await updateScenarioInject({
        id: siId,
        scheduled_at: fromDatetimeLocal(scheduledLocal),
      });
      await load();
    } catch (e: unknown) {
      setError(errMessage(e, "Failed to reschedule inject."));
    } finally {
      setBusyKey(null);
    }
  }

  async function onMove(siId: string, dir: -1 | 1) {
    const idx = sortedInjects.findIndex((x) => x.id === siId);
    if (idx < 0) return;

    const otherIdx = idx + dir;
    if (otherIdx < 0 || otherIdx >= sortedInjects.length) return;

    const a = sortedInjects[idx];
    const b = sortedInjects[otherIdx];

    setBusyKey(`move:${siId}`);
    setError(null);

    try {
      await Promise.all([
        updateScenarioInject({ id: a.id, order_index: b.order_index }),
        updateScenarioInject({ id: b.id, order_index: a.order_index }),
      ]);
      await load();
    } catch (e: unknown) {
      setError(errMessage(e, "Failed to reorder inject."));
    } finally {
      setBusyKey(null);
    }
  }

  async function onCreateRuleTemplate() {
    if (!nrRuleKey.trim() || !nrRuleName.trim()) {
      setError("Rule key and rule name are required.");
      return;
    }

    setBusyKey("create-rule");
    setError(null);

    try {
      await createScenarioRuleTemplate({
        scenarioId: id,
        ruleKey: nrRuleKey.trim(),
        ruleName: nrRuleName.trim(),
        description: nrDescription.trim() || null,
        triggerType: nrTriggerType,
        triggerConfig: parseJsonConfig(nrTriggerConfig, "Trigger config"),
        conditionConfig: parseJsonConfig(nrConditionConfig, "Condition config"),
        effectConfig: parseJsonConfig(nrEffectConfig, "Effect config"),
        enabled: nrEnabled,
      });

      setNrRuleKey("");
      setNrRuleName("");
      setNrDescription("");
      setNrTriggerType("inject_released");
      setNrTriggerConfig('{\n  "inject_kind": "operational"\n}');
      setNrConditionConfig("{}");
      setNrEffectConfig('{\n  "create_consequence": true,\n  "severity": "medium"\n}');
      setNrEnabled(true);
      setNewRuleOpen(false);
      await load();
    } catch (e: unknown) {
      setError(errMessage(e, "Failed to create rule template."));
    } finally {
      setBusyKey(null);
    }
  }

  async function onUpdateRuleTemplate(ruleId: string, patch: Partial<ScenarioRuleTemplate>) {
    setBusyKey(`rule:${ruleId}`);
    setError(null);
    try {
      await updateScenarioRuleTemplate({
        id: ruleId,
        ruleKey: patch.rule_key,
        ruleName: patch.rule_name,
        description: patch.description,
        triggerType: patch.trigger_type,
        triggerConfig: patch.trigger_config,
        conditionConfig: patch.condition_config,
        effectConfig: patch.effect_config,
        enabled: patch.enabled,
      });
      await load();
    } catch (e: unknown) {
      setError(errMessage(e, "Failed to update rule template."));
    } finally {
      setBusyKey(null);
    }
  }

  async function onDeleteRuleTemplate(ruleId: string) {
    if (!confirm("Delete this rule template?")) return;
    setBusyKey(`delrule:${ruleId}`);
    setError(null);
    try {
      await deleteScenarioRuleTemplate(ruleId);
      await load();
    } catch (e: unknown) {
      setError(errMessage(e, "Failed to delete rule template."));
    } finally {
      setBusyKey(null);
    }
  }

  function applyRulePreset(preset: (typeof RULE_PRESETS)[number]) {
    setNrRuleKey(presetRuleKey(preset.key));
    setNrRuleName(preset.name);
    setNrDescription(preset.description);
    setNrTriggerType(preset.triggerType as (typeof RULE_TRIGGER_OPTIONS)[number]);
    setNrTriggerConfig(JSON.stringify(preset.triggerConfig, null, 2));
    setNrConditionConfig(JSON.stringify(preset.conditionConfig, null, 2));
    setNrEffectConfig(JSON.stringify(preset.effectConfig, null, 2));
    setNrEnabled(true);
    setNewRuleOpen(true);
  }

  if (loading) {
    return <div className="text-sm text-[color:var(--studio-muted2)]">Loading…</div>;
  }

  if (!scenario) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-[color:var(--studio-muted2)]">Scenario not found.</div>
        <Button variant="secondary" onClick={() => router.push("/facilitator/scenarios")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden">
        <div className="relative px-5 py-5 md:px-6 md:py-6">
          <div className="pointer-events-none absolute right-0 top-0 h-28 w-52 rounded-bl-[28px] bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.08),transparent_62%)]" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--studio-border)] bg-background/80 px-3 py-1 text-xs font-semibold text-[color:var(--studio-muted)]">
                <Sparkles className="h-3.5 w-3.5" />
                Scenario editor
              </div>
              <div className="text-xs text-[color:var(--studio-muted2)]">
                Scenario • {id.slice(0, 8)} • Updated {fmt(scenario.updated_at)}
              </div>
              <h1 className="text-[28px] font-semibold tracking-tight truncate">
                {scenario.title ?? "Scenario"}
              </h1>
              <div className="max-w-[62ch] text-sm leading-7 text-[color:var(--studio-muted)]">
                Edit the scenario brief, shape the starting situation, and build the inject sequence that will drive the session.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => router.push("/facilitator/scenarios")} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>

              <Button variant="outline" onClick={load} disabled={saving} className="gap-2">
                <RefreshCw className="h-4 w-4 opacity-80" />
                Refresh
              </Button>

              <Button onClick={onSaveScenario} disabled={!hasChanges || saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? "…" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="border-t border-[var(--studio-border)] px-5 py-3">
            <div className="notice notice-error">
              {error}
            </div>
          </div>
        ) : null}
      </div>

      {/* Scenario details */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="surface shadow-soft border border-[var(--studio-border)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 opacity-80" />
              Basics
              <HintTooltip text="Set the scenario title and a short description that helps facilitators recognize it later." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="text-sm font-semibold">Title</div>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold">Description</div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[88px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm"
                placeholder="Optional…"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="surface shadow-soft border border-[var(--studio-border)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 opacity-80" />
              Event
              <HintTooltip text="Capture when and where the scenario takes place so the setup stays grounded in context." />
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-sm font-semibold">Date</div>
              <Input value={eventDate} onChange={(e) => setEventDate(e.target.value)} placeholder="YYYY-MM-DD" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold">Time</div>
              <Input value={eventTime} onChange={(e) => setEventTime(e.target.value)} placeholder="HH:MM" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <div className="text-sm font-semibold">Timezone</div>
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="e.g., Europe/Warsaw" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <div className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4 opacity-70" />
                Location
              </div>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Airport / city / region…" />
            </div>
          </CardContent>
        </Card>

        <Card className="surface shadow-soft border border-[var(--studio-border)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 opacity-80" />
              Situation
              <HintTooltip text="Describe the type of incident and summarize the operating picture at the start of the exercise." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="text-sm font-semibold">Situation type</div>
              <Input
                value={situationType}
                onChange={(e) => setSituationType(e.target.value)}
                placeholder="e.g., Accident, Disruption, Security…"
              />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold">Short description</div>
              <textarea
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                className="min-h-[88px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm"
                placeholder="1–2 sentences…"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="surface shadow-soft border border-[var(--studio-border)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 opacity-80" />
              Initial casualties
              <HintTooltip text="Use these starting numbers to frame the first operational picture for the scenario." />
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-sm font-semibold">Injured</div>
              <Input value={injured} onChange={(e) => setInjured(e.target.value)} />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold">Fatalities</div>
              <Input value={fatalities} onChange={(e) => setFatalities(e.target.value)} />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold">Uninjured</div>
              <Input value={uninjured} onChange={(e) => setUninjured(e.target.value)} />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold">Unknown</div>
              <Input value={unknown} onChange={(e) => setUnknown(e.target.value)} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Injects */}
      <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden border border-[var(--studio-border)]">
        <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-[var(--studio-border)]">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Settings2 className="h-4 w-4 opacity-80" />
                Injects
                <HintTooltip text="Create, edit, reorder, and schedule injects that drive the session forward." />
              </div>
            </div>

          <Button variant="outline" onClick={() => setNewInjectOpen((v) => !v)} className="gap-2">
            <Plus className="h-4 w-4" />
            New inject
            {newInjectOpen ? <ChevronUp className="h-4 w-4 opacity-70" /> : <ChevronDown className="h-4 w-4 opacity-70" />}
          </Button>
        </div>

        <div className="p-5 space-y-4">
          {/* NEW INJECT (collapsible) */}
          {newInjectOpen ? (
            <div className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] p-4 space-y-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4 opacity-80" />
                Create inject
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-sm font-semibold">Title</div>
                  <Input value={niTitle} onChange={(e) => setNiTitle(e.target.value)} />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-semibold">Scheduled at</div>
                  <Input type="datetime-local" value={niScheduledLocal} onChange={(e) => setNiScheduledLocal(e.target.value)} />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-semibold">Channel</div>
                  <Input value={niChannel} onChange={(e) => setNiChannel(e.target.value)} placeholder="ops / media / social / pulse…" />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-semibold">Kind</div>
                  <Select value={niInjectKind} onChange={(v) => setNiInjectKind(v as NonNullable<Inject["inject_kind"]>)}>
                    {INJECT_KIND_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-semibold">Severity</div>
                  <Input value={niSeverity} onChange={(e) => setNiSeverity(e.target.value)} placeholder="low / medium / high / critical…" />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-semibold">Source type</div>
                  <Select value={niSourceType} onChange={(v) => setNiSourceType(v as NonNullable<Inject["source_type"]>)}>
                    {SOURCE_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-semibold">Sender name</div>
                  <Input value={niSenderName} onChange={(e) => setNiSenderName(e.target.value)} />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-semibold">Sender org</div>
                  <Input value={niSenderOrg} onChange={(e) => setNiSenderOrg(e.target.value)} />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-semibold">Entity scope</div>
                  <Input
                    value={niEntityScope}
                    onChange={(e) => setNiEntityScope(e.target.value)}
                    placeholder="flight / airport / passengers / crew…"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-semibold">Visibility</div>
                  <Select value={niVisibilityScope} onChange={(v) => setNiVisibilityScope(v as (typeof VISIBILITY_SCOPE_OPTIONS)[number])}>
                    {VISIBILITY_SCOPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-semibold">Decision template key</div>
                  <Input
                    value={niDecisionTemplateKey}
                    onChange={(e) => setNiDecisionTemplateKey(e.target.value)}
                    placeholder="e.g., passenger-welfare-response"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-semibold">Branch key</div>
                  <Input value={niBranchKey} onChange={(e) => setNiBranchKey(e.target.value)} placeholder="Optional follow-up branch" />
                </div>

                <div className="space-y-2 rounded-[var(--radius)] border border-[var(--studio-border)] bg-background/80 px-3 py-3 md:col-span-2">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={niRequiresDecision}
                      onChange={(e) => setNiRequiresDecision(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border border-[var(--studio-border)]"
                    />
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">Requires decision</div>
                      <div className="text-xs leading-5 text-[color:var(--studio-muted2)]">
                        Turn this inject into a structured decision point so the live session can create follow-up work, not just log a message.
                      </div>
                    </div>
                  </label>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <div className="text-sm font-semibold">Body</div>
                  <textarea
                    value={niBody}
                    onChange={(e) => setNiBody(e.target.value)}
                    className="min-h-[120px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={onCreateScenarioInject} disabled={busyKey === "create-inject"} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {busyKey === "create-inject" ? "…" : "Create & attach"}
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => {
                    setNiTitle("");
                    setNiBody("");
                    setNiChannel("ops");
                    setNiSeverity("");
                    setNiSenderName("Facilitator");
                    setNiSenderOrg("Decisionary");
                    setNiScheduledLocal("");
                    setNiInjectKind("operational");
                    setNiSourceType("manual");
                    setNiEntityScope("");
                    setNiRequiresDecision(false);
                    setNiDecisionTemplateKey("");
                    setNiVisibilityScope("all");
                    setNiBranchKey("");
                  }}
                >
                  Clear
                </Button>

                <Button variant="outline" onClick={() => setNewInjectOpen(false)}>
                  Close
                </Button>
              </div>

              <div className="flex justify-end">
                <HintTooltip text="The datetime picker uses your local time, so you can schedule injects without converting timestamps manually." />
              </div>
            </div>
          ) : null}

          {/* LIST */}
          {sortedInjects.length === 0 ? (
            <div className="text-sm text-[color:var(--studio-muted2)]">No injects yet.</div>
          ) : (
            <div className="space-y-2">
              {sortedInjects.map((si, idx) => {
                const inj = si.injects;
                const isOpen = openSiId === si.id;

                const isBusy =
                  busyKey?.includes(`:${si.id}`) ||
                  (inj?.id && busyKey?.includes(`:${inj.id}`)) ||
                  busyKey === `move:${si.id}`;

                const scheduledLocal = toDatetimeLocal(si.scheduled_at);

                return (
                  <div key={si.id} className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface)] overflow-hidden">
                    <div className="px-4 py-3 flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {inj?.title ?? "Untitled inject"}
                          <span className="ml-2 text-xs text-[color:var(--studio-muted2)]">
                            #{si.order_index ?? 0}
                          </span>
                        </div>

                        <div className="mt-1 text-xs text-[color:var(--studio-muted2)]">
                          Channel: <span className="text-foreground/80 font-semibold">{inj?.channel ?? "—"}</span>
                          <span className="mx-2">•</span>
                          Severity: <span className="text-foreground/80 font-semibold">{inj?.severity ?? "—"}</span>
                          <span className="mx-2">•</span>
                          Scheduled: <span className="text-foreground/80 font-semibold">{si.scheduled_at ? fmt(si.scheduled_at) : "immediate"}</span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {inj?.inject_kind ? <MiniBadge>{inj.inject_kind}</MiniBadge> : null}
                          {inj?.entity_scope ? <MiniBadge>{inj.entity_scope}</MiniBadge> : null}
                          {inj?.requires_decision ? <MiniBadge tone="accent">Decision required</MiniBadge> : null}
                          {inj?.source_type && inj.source_type !== "manual" ? <MiniBadge tone="warm">{inj.source_type}</MiniBadge> : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onMove(si.id, -1)}
                          disabled={idx === 0 || !!isBusy}
                          title="Move up"
                          className="gap-2"
                        >
                          <MoveUp className="h-4 w-4" />
                          Up
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onMove(si.id, 1)}
                          disabled={idx === sortedInjects.length - 1 || !!isBusy}
                          title="Move down"
                          className="gap-2"
                        >
                          <MoveDown className="h-4 w-4" />
                          Down
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setOpenSiId(isOpen ? null : si.id)}
                          className="gap-2"
                        >
                          <Settings2 className="h-4 w-4" />
                          {isOpen ? "Close" : "Edit"}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDetach(si.id)}
                          disabled={!!isBusy}
                          className="gap-2"
                          title="Detach inject from scenario"
                        >
                          <Link2Off className="h-4 w-4" />
                          Detach
                        </Button>
                      </div>
                    </div>

                    {isOpen ? (
                      <div className="border-t border-[var(--studio-border)] p-4 grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Title</div>
                          <Input
                            defaultValue={inj?.title ?? ""}
                            onBlur={(e) => inj?.id && onUpdateInject(inj.id, { title: e.target.value })}
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Scheduled at</div>
                          <Input
                            type="datetime-local"
                            defaultValue={scheduledLocal}
                            onBlur={(e) => onReschedule(si.id, e.target.value)}
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Channel</div>
                          <Input
                            defaultValue={inj?.channel ?? ""}
                            onBlur={(e) => inj?.id && onUpdateInject(inj.id, { channel: e.target.value })}
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Kind</div>
                          <Select
                            value={inj?.inject_kind ?? "operational"}
                            onChange={(value) => inj?.id && onUpdateInject(inj.id, { inject_kind: value as Inject["inject_kind"] })}
                          >
                            {INJECT_KIND_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Severity</div>
                          <Input
                            defaultValue={inj?.severity ?? ""}
                            onBlur={(e) => inj?.id && onUpdateInject(inj.id, { severity: e.target.value || null })}
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Source type</div>
                          <Select
                            value={inj?.source_type ?? "manual"}
                            onChange={(value) => inj?.id && onUpdateInject(inj.id, { source_type: value as Inject["source_type"] })}
                          >
                            {SOURCE_TYPE_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Sender name</div>
                          <Input
                            defaultValue={inj?.sender_name ?? ""}
                            onBlur={(e) => inj?.id && onUpdateInject(inj.id, { sender_name: e.target.value || null })}
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Sender org</div>
                          <Input
                            defaultValue={inj?.sender_org ?? ""}
                            onBlur={(e) => inj?.id && onUpdateInject(inj.id, { sender_org: e.target.value || null })}
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Entity scope</div>
                          <Input
                            defaultValue={inj?.entity_scope ?? ""}
                            onBlur={(e) => inj?.id && onUpdateInject(inj.id, { entity_scope: e.target.value || null })}
                            placeholder="flight / airport / passengers / crew…"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Visibility</div>
                          <Select
                            value={inj?.visibility_scope ?? "all"}
                            onChange={(value) => inj?.id && onUpdateInject(inj.id, { visibility_scope: value })}
                          >
                            {VISIBILITY_SCOPE_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Decision template key</div>
                          <Input
                            defaultValue={inj?.decision_template_key ?? ""}
                            onBlur={(e) => inj?.id && onUpdateInject(inj.id, { decision_template_key: e.target.value || null })}
                            placeholder="Optional decision playbook key"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Branch key</div>
                          <Input
                            defaultValue={inj?.branch_key ?? ""}
                            onBlur={(e) => inj?.id && onUpdateInject(inj.id, { branch_key: e.target.value || null })}
                            placeholder="Optional consequence branch"
                          />
                        </div>

                        <div className="space-y-2 rounded-[var(--radius)] border border-[var(--studio-border)] bg-background/80 px-3 py-3 md:col-span-2">
                          <label className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={!!inj?.requires_decision}
                              onChange={(e) => inj?.id && onUpdateInject(inj.id, { requires_decision: e.target.checked })}
                              className="mt-1 h-4 w-4 rounded border border-[var(--studio-border)]"
                            />
                            <div className="space-y-1">
                              <div className="text-sm font-semibold">Requires decision</div>
                              <div className="text-xs leading-5 text-[color:var(--studio-muted2)]">
                                Use this for injects that should trigger a structured response and follow-up task during the live exercise.
                              </div>
                            </div>
                          </label>
                        </div>

                        <div className="space-y-1 md:col-span-2">
                          <div className="text-sm font-semibold">Body</div>
                          <textarea
                            defaultValue={inj?.body ?? ""}
                            onBlur={(e) => inj?.id && onUpdateInject(inj.id, { body: e.target.value })}
                            className="min-h-[140px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm"
                          />
                        </div>

                        <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                          <Button variant="secondary" size="sm" onClick={() => setOpenSiId(null)}>
                            Done
                          </Button>

                          {inj?.id ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => onDeleteInject(inj.id)}
                              disabled={!!isBusy}
                              className="gap-2"
                              title="Delete inject from injects table"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete inject
                            </Button>
                          ) : null}
                        </div>

                        <div className="md:col-span-2 flex justify-end">
                          <HintTooltip text="Changes are saved when the field loses focus, so click outside the field after editing." />
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 pb-4 text-sm text-[color:var(--studio-muted2)] whitespace-pre-wrap">
                        {inj?.body ?? ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden border border-[var(--studio-border)]">
        <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-[var(--studio-border)]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 opacity-80" />
              Rules & consequences
              <HintTooltip text="Define simple scenario rules that react to injects or decisions and describe the consequence payload you want the engine to use later." />
            </div>
            <div className="mt-1 text-xs text-[color:var(--studio-muted2)]">
              This is the first building block for branching logic and automated follow-up effects.
            </div>
          </div>

          <Button variant="outline" onClick={() => setNewRuleOpen((v) => !v)} className="gap-2">
            <Plus className="h-4 w-4" />
            New rule
            {newRuleOpen ? <ChevronUp className="h-4 w-4 opacity-70" /> : <ChevronDown className="h-4 w-4 opacity-70" />}
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-3">
            <div className="text-sm font-semibold">Quick presets</div>
            <div className="grid gap-3 xl:grid-cols-3">
              {RULE_PRESETS.map((preset) => (
                <div
                  key={preset.key}
                  className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] p-4"
                >
                  <div className="font-medium">{preset.name}</div>
                  <div className="mt-1 text-sm text-[color:var(--studio-muted)]">
                    {preset.description}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <MiniBadge>{preset.triggerType}</MiniBadge>
                    {"decision_type" in preset.triggerConfig ? (
                      <MiniBadge tone="accent">{String(preset.triggerConfig.decision_type)}</MiniBadge>
                    ) : null}
                    {"inject_kind" in preset.triggerConfig ? (
                      <MiniBadge tone="warm">{String(preset.triggerConfig.inject_kind)}</MiniBadge>
                    ) : null}
                  </div>
                  <div className="mt-4">
                    <Button variant="secondary" onClick={() => applyRulePreset(preset)} className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      Use preset
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] p-4">
            <div className="text-sm font-semibold">Available placeholders</div>
            <div className="mt-1 text-sm text-[color:var(--studio-muted)]">
              Use these inside effect titles, descriptions, task text, and generated inject text.
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "{{scenario_title}}",
                "{{inject_title}}",
                "{{inject_kind}}",
                "{{channel}}",
                "{{severity}}",
                "{{decision_type}}",
                "{{action_comment}}",
                "{{task_title}}",
                "{{task_due_at}}",
                "{{task_priority}}",
              ].map((token) => (
                <MiniBadge key={token} tone="warm">
                  {token}
                </MiniBadge>
              ))}
            </div>
          </div>

          {newRuleOpen ? (
            <div className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] p-4 space-y-3">
              <div className="text-sm font-semibold">Create rule template</div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-sm font-semibold">Rule key</div>
                  <Input value={nrRuleKey} onChange={(e) => setNrRuleKey(e.target.value)} placeholder="e.g., welfare-delay-escalation" />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-semibold">Rule name</div>
                  <Input value={nrRuleName} onChange={(e) => setNrRuleName(e.target.value)} placeholder="Passenger welfare escalates when unresolved" />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <div className="text-sm font-semibold">Description</div>
                  <textarea
                    value={nrDescription}
                    onChange={(e) => setNrDescription(e.target.value)}
                    className="min-h-[80px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm"
                    placeholder="What this rule is meant to model in the exercise."
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-semibold">Trigger type</div>
                  <Select value={nrTriggerType} onChange={(v) => setNrTriggerType(v as (typeof RULE_TRIGGER_OPTIONS)[number])}>
                    {RULE_TRIGGER_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2 rounded-[var(--radius)] border border-[var(--studio-border)] bg-background/80 px-3 py-3">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={nrEnabled}
                      onChange={(e) => setNrEnabled(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border border-[var(--studio-border)]"
                    />
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">Enabled</div>
                      <div className="text-xs leading-5 text-[color:var(--studio-muted2)]">
                        Keep the rule active when the engine starts evaluating scenario logic.
                      </div>
                    </div>
                  </label>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-semibold">Trigger config</div>
                  <textarea
                    value={nrTriggerConfig}
                    onChange={(e) => setNrTriggerConfig(e.target.value)}
                    className="min-h-[130px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-semibold">Condition config</div>
                  <textarea
                    value={nrConditionConfig}
                    onChange={(e) => setNrConditionConfig(e.target.value)}
                    className="min-h-[130px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <div className="text-sm font-semibold">Effect config</div>
                  <textarea
                    value={nrEffectConfig}
                    onChange={(e) => setNrEffectConfig(e.target.value)}
                    className="min-h-[150px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={onCreateRuleTemplate} disabled={busyKey === "create-rule"} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {busyKey === "create-rule" ? "…" : "Create rule"}
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => {
                    setNrRuleKey("");
                    setNrRuleName("");
                    setNrDescription("");
                    setNrTriggerType("inject_released");
                    setNrTriggerConfig('{\n  "inject_kind": "operational"\n}');
                    setNrConditionConfig("{}");
                    setNrEffectConfig('{\n  "create_consequence": true,\n  "severity": "medium"\n}');
                    setNrEnabled(true);
                  }}
                >
                  Clear
                </Button>

                <Button variant="outline" onClick={() => setNewRuleOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          ) : null}

          {rules.length === 0 ? (
            <div className="text-sm text-[color:var(--studio-muted2)]">No rule templates yet.</div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => {
                const isOpen = openRuleId === rule.id;
                const isBusy = busyKey === `rule:${rule.id}` || busyKey === `delrule:${rule.id}`;

                return (
                  <div key={rule.id} className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface)] overflow-hidden">
                    <div className="px-4 py-3 flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{rule.rule_name}</div>
                        <div className="mt-1 text-xs text-[color:var(--studio-muted2)]">
                          Key: <span className="font-semibold text-foreground/80">{rule.rule_key}</span>
                          <span className="mx-2">•</span>
                          Trigger: <span className="font-semibold text-foreground/80">{rule.trigger_type}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <MiniBadge>{rule.trigger_type}</MiniBadge>
                          <MiniBadge tone={rule.enabled ? "accent" : "neutral"}>
                            {rule.enabled ? "Enabled" : "Disabled"}
                          </MiniBadge>
                          <MiniBadge tone="warm">
                            {Object.keys(rule.effect_config ?? {}).length} effect field{Object.keys(rule.effect_config ?? {}).length === 1 ? "" : "s"}
                          </MiniBadge>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setOpenRuleId(isOpen ? null : rule.id)}
                          className="gap-2"
                        >
                          <Settings2 className="h-4 w-4" />
                          {isOpen ? "Close" : "Edit"}
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => onDeleteRuleTemplate(rule.id)}
                          disabled={!!isBusy}
                          className="gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>

                    {isOpen ? (
                      <div className="border-t border-[var(--studio-border)] p-4 grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Rule key</div>
                          <Input
                            defaultValue={rule.rule_key}
                            onBlur={(e) => onUpdateRuleTemplate(rule.id, { rule_key: e.target.value })}
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Rule name</div>
                          <Input
                            defaultValue={rule.rule_name}
                            onBlur={(e) => onUpdateRuleTemplate(rule.id, { rule_name: e.target.value })}
                          />
                        </div>

                        <div className="space-y-1 md:col-span-2">
                          <div className="text-sm font-semibold">Description</div>
                          <textarea
                            defaultValue={rule.description ?? ""}
                            onBlur={(e) => onUpdateRuleTemplate(rule.id, { description: e.target.value || null })}
                            className="min-h-[80px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Trigger type</div>
                          <Select value={rule.trigger_type} onChange={(value) => onUpdateRuleTemplate(rule.id, { trigger_type: value })}>
                            {RULE_TRIGGER_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </Select>
                        </div>

                        <div className="space-y-2 rounded-[var(--radius)] border border-[var(--studio-border)] bg-background/80 px-3 py-3">
                          <label className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={rule.enabled}
                              onChange={(e) => onUpdateRuleTemplate(rule.id, { enabled: e.target.checked })}
                              className="mt-1 h-4 w-4 rounded border border-[var(--studio-border)]"
                            />
                            <div className="space-y-1">
                              <div className="text-sm font-semibold">Enabled</div>
                              <div className="text-xs leading-5 text-[color:var(--studio-muted2)]">
                                Disable the rule without losing its configs.
                              </div>
                            </div>
                          </label>
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Trigger config</div>
                          <textarea
                            defaultValue={jsonText(rule.trigger_config)}
                            onBlur={(e) => {
                              try {
                                const value = parseJsonConfig(e.target.value, "Trigger config");
                                void onUpdateRuleTemplate(rule.id, { trigger_config: value });
                              } catch (error) {
                                setError(errMessage(error, "Trigger config must be valid JSON."));
                              }
                            }}
                            className="min-h-[130px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 font-mono text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Condition config</div>
                          <textarea
                            defaultValue={jsonText(rule.condition_config)}
                            onBlur={(e) => {
                              try {
                                const value = parseJsonConfig(e.target.value, "Condition config");
                                void onUpdateRuleTemplate(rule.id, { condition_config: value });
                              } catch (error) {
                                setError(errMessage(error, "Condition config must be valid JSON."));
                              }
                            }}
                            className="min-h-[130px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 font-mono text-xs"
                          />
                        </div>

                        <div className="space-y-1 md:col-span-2">
                          <div className="text-sm font-semibold">Effect config</div>
                          <textarea
                            defaultValue={jsonText(rule.effect_config)}
                            onBlur={(e) => {
                              try {
                                const value = parseJsonConfig(e.target.value, "Effect config");
                                void onUpdateRuleTemplate(rule.id, { effect_config: value });
                              } catch (error) {
                                setError(errMessage(error, "Effect config must be valid JSON."));
                              }
                            }}
                            className="min-h-[150px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 font-mono text-xs"
                          />
                        </div>

                        <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                          <Button variant="secondary" size="sm" onClick={() => setOpenRuleId(null)}>
                            Done
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 pb-4 text-sm text-[color:var(--studio-muted2)]">
                        {rule.description?.trim() || "No description yet."}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
