"use client";

import { useState } from "react";
import {
  BellRing,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileText,
  GitBranch,
  ListChecks,
  MessageSquarePlus,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";

import Collapsible from "@/app/components/Collapsible";
import HintTooltip from "@/app/components/HintTooltip";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import type { ScenarioRuleTemplate } from "@/lib/scenarios";

import {
  EDITOR_ICON,
  jsonText,
  MiniBadge,
  parseJsonConfig,
  RULE_PRESETS,
  RULE_TRIGGER_OPTIONS,
  Select,
} from "./scenarioEditorUi";

type TriggerType = (typeof RULE_TRIGGER_OPTIONS)[number];
type JsonObject = Record<string, unknown>;

type ScenarioRulesSectionProps = {
  formId: string;
  newRulePanelId: string;
  nrRuleKeyId: string;
  nrRuleNameId: string;
  nrDescriptionId: string;
  nrTriggerTypeId: string;
  nrEnabledId: string;
  nrTriggerConfigId: string;
  nrConditionConfigId: string;
  nrEffectConfigId: string;
  rules: ScenarioRuleTemplate[];
  busyKey: string | null;
  openRuleId: string | null;
  setOpenRuleId: (value: string | null) => void;
  newRuleOpen: boolean;
  setNewRuleOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  nrRuleKey: string;
  setNrRuleKey: (value: string) => void;
  nrRuleName: string;
  setNrRuleName: (value: string) => void;
  nrDescription: string;
  setNrDescription: (value: string) => void;
  nrTriggerType: TriggerType;
  setNrTriggerType: (value: TriggerType) => void;
  nrTriggerConfig: string;
  setNrTriggerConfig: (value: string) => void;
  nrConditionConfig: string;
  setNrConditionConfig: (value: string) => void;
  nrEffectConfig: string;
  setNrEffectConfig: (value: string) => void;
  nrEnabled: boolean;
  setNrEnabled: (value: boolean) => void;
  onCreateRuleTemplate: () => void;
  onUpdateRuleTemplate: (ruleId: string, patch: Partial<ScenarioRuleTemplate>) => void;
  onDeleteRuleTemplate: (ruleId: string) => void;
  applyRulePreset: (preset: (typeof RULE_PRESETS)[number]) => void;
  clearNewRuleDraft: () => void;
  setError: (value: string | null) => void;
};

const TRIGGER_OPTIONS: Array<{
  value: TriggerType;
  label: string;
  description: string;
}> = [
  {
    value: "inject_released",
    label: "An update is released",
    description: "Use this when a specific kind of inbox or pulse update should change the exercise.",
  },
  {
    value: "decision_recorded",
    label: "A decision is recorded",
    description: "Use this when confirm, deny, escalate, act, or ignore should create follow-up pressure.",
  },
  {
    value: "task_overdue",
    label: "A task becomes overdue",
    description: "Use this when missed follow-up work should produce escalation.",
  },
  {
    value: "task_status_changed",
    label: "A task status changes",
    description: "Use this when done, blocked, or in-progress work should move the scenario forward.",
  },
  {
    value: "manual",
    label: "Facilitator runs it",
    description: "Use this as a controlled button the facilitator can fire during a live run.",
  },
];

const INJECT_KIND_OPTIONS = ["", "operational", "media", "social", "intel", "internal", "system"] as const;
const STREAM_OPTIONS = ["", "inbox", "pulse"] as const;
const SEVERITY_OPTIONS = ["", "low", "medium", "high", "critical"] as const;
const DECISION_OPTIONS = ["", "ignore", "escalate", "act", "confirm", "deny"] as const;
const TASK_STATUS_OPTIONS = ["", "open", "in_progress", "blocked", "done", "cancelled"] as const;
const ROLE_OPTIONS = ["", "facilitator", "operations", "communications", "customer_support", "leadership"] as const;
const CONSEQUENCE_TYPES = [
  "scenario_development",
  "operational_pressure",
  "media_pressure",
  "escalation_pressure",
  "task_overdue",
  "blocked_task",
  "social_monitoring",
] as const;

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function parseDraftJson(value: string): JsonObject {
  try {
    return asObject(JSON.parse(value || "{}"));
  } catch {
    return {};
  }
}

function cleanObject(value: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => {
      if (item == null) return false;
      if (typeof item === "string") return item.trim().length > 0;
      if (typeof item === "object" && !Array.isArray(item)) return Object.keys(cleanObject(asObject(item))).length > 0;
      return true;
    })
  );
}

function jsonSet(obj: JsonObject, key: string, value: unknown): JsonObject {
  const next = { ...obj };
  if (value === "" || value == null) {
    delete next[key];
  } else {
    next[key] = value;
  }
  return cleanObject(next);
}

function nestedSet(obj: JsonObject, nestedKey: string, field: string, value: unknown): JsonObject {
  const nested = asObject(obj[nestedKey]);
  const nextNested = jsonSet(nested, field, value);
  const next = { ...obj };
  if (Object.keys(nextNested).length === 0) {
    delete next[nestedKey];
  } else {
    next[nestedKey] = nextNested;
  }
  return cleanObject(next);
}

function getString(obj: JsonObject, key: string, fallback = "") {
  return typeof obj[key] === "string" ? obj[key] : fallback;
}

function getBool(obj: JsonObject, key: string) {
  return typeof obj[key] === "boolean" ? obj[key] : false;
}

function getNestedString(obj: JsonObject, nestedKey: string, field: string, fallback = "") {
  return getString(asObject(obj[nestedKey]), field, fallback);
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 52) || "scenario-rule"
  );
}

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function summarizeWhen(triggerType: string, trigger: JsonObject, condition: JsonObject) {
  const parts = [TRIGGER_OPTIONS.find((item) => item.value === triggerType)?.label ?? humanize(triggerType)];
  const filters = [
    getString(trigger, "inject_kind"),
    getString(trigger, "channel"),
    getString(trigger, "severity"),
    getString(trigger, "decision_type"),
    getString(trigger, "task_status"),
    getString(trigger, "task_priority"),
    getString(trigger, "assigned_role"),
    getString(condition, "title_includes") ? `title includes "${getString(condition, "title_includes")}"` : "",
    getString(condition, "comment_includes") ? `comment includes "${getString(condition, "comment_includes")}"` : "",
    getString(condition, "task_title_includes") ? `task includes "${getString(condition, "task_title_includes")}"` : "",
  ].filter(Boolean);
  if (filters.length) parts.push(filters.join(", "));
  return parts.join(" / ");
}

function summarizeThen(effect: JsonObject) {
  const items = ["consequence"];
  if (Object.keys(asObject(effect.create_task)).length > 0) items.push("task");
  if (Object.keys(asObject(effect.send_inject)).length > 0) items.push("inject");
  return items.join(" + ");
}

function TriggerPicker({
  value,
  onChange,
}: {
  value: TriggerType;
  onChange: (value: TriggerType) => void;
}) {
  const selectedOption = TRIGGER_OPTIONS.find((option) => option.value === value) ?? TRIGGER_OPTIONS[0];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {TRIGGER_OPTIONS.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={[
                "h-9 rounded-[8px] border px-3 text-sm font-semibold transition",
                active
                  ? "border-primary/35 bg-primary/10 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.12)]"
                  : "border-[var(--studio-border)] bg-[var(--studio-surface2)] text-[color:var(--studio-muted)] hover:border-[var(--studio-border-strong)] hover:text-foreground",
              ].join(" ")}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <div className="rounded-[8px] border border-dashed border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 py-2 text-xs leading-5 text-[color:var(--studio-muted2)]">
        {selectedOption.description}
      </div>
    </div>
  );
}

function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-semibold">{label}</label>
      <Select value={value} onChange={onChange}>
        {options.map((option) => (
          <option key={option || "all"} value={option}>
            {option ? humanize(option) : "Any"}
          </option>
        ))}
      </Select>
    </div>
  );
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-semibold">{label}</label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} placeholder={placeholder} />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-semibold">{label}</div>
      <div className="min-h-10 rounded-[var(--radius)] border border-border bg-background px-3 py-2 font-mono text-xs leading-5 text-[color:var(--studio-muted)]">
        {value}
      </div>
    </div>
  );
}

function ToggleRow({
  checked,
  title,
  description,
  onChange,
  compact = false,
}: {
  checked: boolean;
  title: string;
  description: string;
  onChange: (checked: boolean) => void;
  compact?: boolean;
}) {
  return (
    <label
      className={[
        "flex gap-3 rounded-[8px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3",
        compact ? "items-center py-2" : "items-start py-3",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className={[compact ? "" : "mt-1", "h-4 w-4 rounded border border-[var(--studio-border)]"].join(" ")}
      />
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        {compact ? null : <span className="mt-1 block text-xs leading-5 text-[color:var(--studio-muted2)]">{description}</span>}
      </span>
    </label>
  );
}

function RuleDesigner({
  mode,
  rule,
  name,
  setName,
  description,
  setDescription,
  triggerType,
  setTriggerType,
  triggerConfig,
  setTriggerConfig,
  conditionConfig,
  setConditionConfig,
  effectConfig,
  setEffectConfig,
  enabled,
  setEnabled,
  advancedOpen,
  setAdvancedOpen,
  triggerConfigId,
  conditionConfigId,
  effectConfigId,
  setError,
  onPatch,
}: {
  mode: "create" | "edit";
  rule?: ScenarioRuleTemplate;
  name: string;
  setName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  triggerType: TriggerType;
  setTriggerType: (value: TriggerType) => void;
  triggerConfig: JsonObject;
  setTriggerConfig: (value: JsonObject) => void;
  conditionConfig: JsonObject;
  setConditionConfig: (value: JsonObject) => void;
  effectConfig: JsonObject;
  setEffectConfig: (value: JsonObject) => void;
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  advancedOpen: boolean;
  setAdvancedOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  triggerConfigId: string;
  conditionConfigId: string;
  effectConfigId: string;
  setError: (value: string | null) => void;
  onPatch?: (patch: Partial<ScenarioRuleTemplate>) => void;
}) {
  const [draftName, setDraftName] = useState(name);
  const [draftDescription, setDraftDescription] = useState(description);
  const [draftTriggerType, setDraftTriggerType] = useState(triggerType);
  const [draftTriggerConfig, setDraftTriggerConfig] = useState(triggerConfig);
  const [draftConditionConfig, setDraftConditionConfig] = useState(conditionConfig);
  const [draftEffectConfig, setDraftEffectConfig] = useState(effectConfig);
  const [draftEnabled, setDraftEnabled] = useState(enabled);

  const currentName = mode === "create" ? name : draftName;
  const currentDescription = mode === "create" ? description : draftDescription;
  const currentTriggerType = mode === "create" ? triggerType : draftTriggerType;
  const currentTriggerConfig = mode === "create" ? triggerConfig : draftTriggerConfig;
  const currentConditionConfig = mode === "create" ? conditionConfig : draftConditionConfig;
  const currentEffectConfig = mode === "create" ? effectConfig : draftEffectConfig;
  const currentEnabled = mode === "create" ? enabled : draftEnabled;
  const createTask = asObject(currentEffectConfig.create_task);
  const sendInject = asObject(currentEffectConfig.send_inject);
  const hasTask = Object.keys(createTask).length > 0;
  const hasInject = Object.keys(sendInject).length > 0;

  function updateTrigger(next: JsonObject, commit = true) {
    if (mode === "create") setTriggerConfig(next);
    else setDraftTriggerConfig(next);
    if (commit) onPatch?.({ trigger_config: next });
  }

  function updateCondition(next: JsonObject, commit = true) {
    if (mode === "create") setConditionConfig(next);
    else setDraftConditionConfig(next);
    if (commit) onPatch?.({ condition_config: next });
  }

  function updateEffect(next: JsonObject, commit = true) {
    if (mode === "create") setEffectConfig(next);
    else setDraftEffectConfig(next);
    if (commit) onPatch?.({ effect_config: next });
  }

  function updateName(value: string) {
    if (mode === "create") setName(value);
    else setDraftName(value);
  }

  function updateDescription(value: string) {
    if (mode === "create") setDescription(value);
    else setDraftDescription(value);
  }

  function updateTriggerType(value: TriggerType) {
    if (mode === "create") setTriggerType(value);
    else setDraftTriggerType(value);
    if (mode === "edit") onPatch?.({ trigger_type: value });
  }

  function updateEnabled(value: boolean) {
    if (mode === "create") setEnabled(value);
    else setDraftEnabled(value);
    if (mode === "edit") onPatch?.({ enabled: value });
  }

  function commitTextPatch() {
    if (mode !== "edit") return;
    onPatch?.({
      rule_name: draftName.trim() || "Untitled rule",
      description: draftDescription.trim() || null,
      trigger_config: draftTriggerConfig,
      condition_config: draftConditionConfig,
      effect_config: draftEffectConfig,
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <TextField
          label="Rule name"
          value={currentName}
          onChange={updateName}
          onBlur={commitTextPatch}
          placeholder="e.g., Media pressure after confirmation"
        />
        <div className="min-w-[150px] space-y-1">
          <div className="text-sm font-semibold">Status</div>
          <ToggleRow
            checked={currentEnabled}
            title={currentEnabled ? "Enabled" : "Disabled"}
            description={currentEnabled ? "This rule can run in live sessions." : "Keep it as draft without deleting it."}
            onChange={updateEnabled}
            compact
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="text-sm font-semibold">Designer note</label>
          <textarea
            value={currentDescription}
            onChange={(event) => updateDescription(event.target.value)}
            onBlur={commitTextPatch}
            className="min-h-[60px] w-full rounded-[var(--radius)] border border-border bg-[var(--studio-surface2)] px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]"
            placeholder="What should this rule model during the exercise?"
          />
        </div>
      </div>

      <div className="space-y-3 rounded-[8px] border border-[var(--studio-border)] bg-[var(--studio-inset)] p-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <GitBranch className={EDITOR_ICON.section} />
          When
        </div>
        <TriggerPicker value={currentTriggerType} onChange={updateTriggerType} />
      </div>

      <div className="space-y-3 rounded-[8px] border border-[var(--studio-border)] bg-[var(--studio-inset)] p-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks className={EDITOR_ICON.section} />
          If
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {(currentTriggerType === "inject_released" || currentTriggerType === "decision_recorded") ? (
            <>
              <FieldSelect
                label="Inject kind"
                value={getString(currentTriggerConfig, "inject_kind")}
                options={INJECT_KIND_OPTIONS}
                onChange={(value) => updateTrigger(jsonSet(currentTriggerConfig, "inject_kind", value))}
              />
              <FieldSelect
                label="Stream"
                value={getString(currentTriggerConfig, "channel") || getString(currentTriggerConfig, "source")}
                options={STREAM_OPTIONS}
                onChange={(value) =>
                  updateTrigger(
                    currentTriggerType === "decision_recorded"
                      ? jsonSet(currentTriggerConfig, "source", value)
                      : jsonSet(currentTriggerConfig, "channel", value)
                  )
                }
              />
              <FieldSelect
                label="Severity"
                value={getString(currentTriggerConfig, "severity") || getString(currentConditionConfig, "severity")}
                options={SEVERITY_OPTIONS}
                onChange={(value) => updateTrigger(jsonSet(currentTriggerConfig, "severity", value))}
              />
              <TextField
                label="Title includes"
                value={getString(currentConditionConfig, "title_includes")}
                placeholder="Optional keyword"
                onChange={(value) => updateCondition(jsonSet(currentConditionConfig, "title_includes", value), mode === "create")}
                onBlur={commitTextPatch}
              />
              <TextField
                label="Body/comment includes"
                value={getString(currentConditionConfig, currentTriggerType === "decision_recorded" ? "comment_includes" : "body_includes")}
                placeholder="Optional phrase"
                onChange={(value) =>
                  updateCondition(
                    jsonSet(currentConditionConfig, currentTriggerType === "decision_recorded" ? "comment_includes" : "body_includes", value),
                    mode === "create"
                  )
                }
                onBlur={commitTextPatch}
              />
            </>
          ) : null}

          {currentTriggerType === "decision_recorded" ? (
            <FieldSelect
              label="Decision"
              value={getString(currentTriggerConfig, "decision_type")}
              options={DECISION_OPTIONS}
              onChange={(value) => updateTrigger(jsonSet(currentTriggerConfig, "decision_type", value))}
            />
          ) : null}

          {(currentTriggerType === "task_overdue" || currentTriggerType === "task_status_changed") ? (
            <>
              <FieldSelect
                label="Task status"
                value={getString(currentTriggerConfig, "task_status")}
                options={TASK_STATUS_OPTIONS}
                onChange={(value) => updateTrigger(jsonSet(currentTriggerConfig, "task_status", value))}
              />
              <FieldSelect
                label="Task priority"
                value={getString(currentTriggerConfig, "task_priority")}
                options={SEVERITY_OPTIONS}
                onChange={(value) => updateTrigger(jsonSet(currentTriggerConfig, "task_priority", value))}
              />
              <FieldSelect
                label="Assigned role"
                value={getString(currentTriggerConfig, "assigned_role")}
                options={ROLE_OPTIONS}
                onChange={(value) => updateTrigger(jsonSet(currentTriggerConfig, "assigned_role", value))}
              />
              <TextField
                label="Task title includes"
                value={getString(currentConditionConfig, "task_title_includes")}
                placeholder="Optional keyword"
                onChange={(value) => updateCondition(jsonSet(currentConditionConfig, "task_title_includes", value), mode === "create")}
                onBlur={commitTextPatch}
              />
            </>
          ) : null}

          {currentTriggerType === "manual" ? (
            <div className="md:col-span-3 rounded-[8px] border border-dashed border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 py-3 text-sm leading-6 text-[color:var(--studio-muted)]">
              Manual rules are intentionally simple: facilitators choose when to run them from the live session tools.
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 rounded-[8px] border border-[var(--studio-border)] bg-[var(--studio-inset)] p-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BellRing className={EDITOR_ICON.section} />
          Then
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <FieldSelect
            label="Consequence type"
            value={getString(currentEffectConfig, "consequence_type", "scenario_development")}
            options={CONSEQUENCE_TYPES}
            onChange={(value) => updateEffect(jsonSet(currentEffectConfig, "consequence_type", value))}
          />
          <FieldSelect
            label="Consequence severity"
            value={getString(currentEffectConfig, "severity", "medium")}
            options={SEVERITY_OPTIONS.filter(Boolean)}
            onChange={(value) => updateEffect(jsonSet(currentEffectConfig, "severity", value))}
          />
          <TextField
            label="Consequence title"
            value={getString(currentEffectConfig, "title")}
            placeholder="Defaults to rule name"
            onChange={(value) => updateEffect(jsonSet(currentEffectConfig, "title", value), mode === "create")}
            onBlur={commitTextPatch}
          />
          <div className="space-y-1 md:col-span-3">
            <label className="text-sm font-semibold">Consequence description</label>
            <textarea
              value={getString(currentEffectConfig, "description")}
              onChange={(event) => updateEffect(jsonSet(currentEffectConfig, "description", event.target.value), mode === "create")}
              onBlur={commitTextPatch}
              className="min-h-[76px] w-full rounded-[var(--radius)] border border-border bg-[var(--studio-surface2)] px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]"
              placeholder="What changes in the operating picture?"
            />
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-3 rounded-[8px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] p-3">
            <ToggleRow
              checked={hasTask}
              title="Create follow-up task"
              description="Use this when teams need an owner, priority, and deadline."
              onChange={(checked) => {
                updateEffect(
                  checked
                    ? {
                        ...currentEffectConfig,
                        create_task: {
                          title: "Follow-up: {{inject_title}}",
                          description: "{{inject_title}} needs coordinated action.",
                          priority: "medium",
                          assigned_role: "facilitator",
                          due_in_minutes: 10,
                        },
                      }
                    : jsonSet(currentEffectConfig, "create_task", null)
                );
              }}
              compact
            />
            {hasTask ? (
              <div className="grid gap-3 md:grid-cols-2">
                <TextField
                  label="Task title"
                  value={getNestedString(currentEffectConfig, "create_task", "title")}
                  onChange={(value) => updateEffect(nestedSet(currentEffectConfig, "create_task", "title", value), mode === "create")}
                  onBlur={commitTextPatch}
                />
                <FieldSelect
                  label="Priority"
                  value={getNestedString(currentEffectConfig, "create_task", "priority", "medium")}
                  options={SEVERITY_OPTIONS.filter(Boolean)}
                  onChange={(value) => updateEffect(nestedSet(currentEffectConfig, "create_task", "priority", value))}
                />
                <FieldSelect
                  label="Owner role"
                  value={getNestedString(currentEffectConfig, "create_task", "assigned_role", "facilitator")}
                  options={ROLE_OPTIONS.filter(Boolean)}
                  onChange={(value) => updateEffect(nestedSet(currentEffectConfig, "create_task", "assigned_role", value))}
                />
                <TextField
                  label="Due in minutes"
                  value={String(createTask.due_in_minutes ?? "")}
                  onChange={(value) =>
                    updateEffect(nestedSet(currentEffectConfig, "create_task", "due_in_minutes", value ? Number(value) : null), mode === "create")
                  }
                  onBlur={commitTextPatch}
                />
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-semibold">Task description</label>
                  <textarea
                    value={getNestedString(currentEffectConfig, "create_task", "description")}
                    onChange={(event) => updateEffect(nestedSet(currentEffectConfig, "create_task", "description", event.target.value), mode === "create")}
                    onBlur={commitTextPatch}
                    className="min-h-[64px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 rounded-[8px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] p-3">
            <ToggleRow
              checked={hasInject}
              title="Send generated inject"
              description="Use this to add a new update into the live stream after the rule fires."
              onChange={(checked) => {
                updateEffect(
                  checked
                    ? {
                        ...currentEffectConfig,
                        send_inject: {
                          title: "New development: {{inject_title}}",
                          body: "A new development follows {{inject_title}}.",
                          channel: "inbox",
                          severity: "medium",
                          inject_kind: "operational",
                          requires_decision: false,
                        },
                      }
                    : jsonSet(currentEffectConfig, "send_inject", null)
                );
              }}
              compact
            />
            {hasInject ? (
              <div className="grid gap-3 md:grid-cols-2">
                <TextField
                  label="Inject title"
                  value={getNestedString(currentEffectConfig, "send_inject", "title")}
                  onChange={(value) => updateEffect(nestedSet(currentEffectConfig, "send_inject", "title", value), mode === "create")}
                  onBlur={commitTextPatch}
                />
                <FieldSelect
                  label="Stream"
                  value={getNestedString(currentEffectConfig, "send_inject", "channel", "inbox")}
                  options={STREAM_OPTIONS.filter(Boolean)}
                  onChange={(value) => updateEffect(nestedSet(currentEffectConfig, "send_inject", "channel", value))}
                />
                <FieldSelect
                  label="Severity"
                  value={getNestedString(currentEffectConfig, "send_inject", "severity", "medium")}
                  options={SEVERITY_OPTIONS.filter(Boolean)}
                  onChange={(value) => updateEffect(nestedSet(currentEffectConfig, "send_inject", "severity", value))}
                />
                <FieldSelect
                  label="Inject kind"
                  value={getNestedString(currentEffectConfig, "send_inject", "inject_kind", "operational")}
                  options={INJECT_KIND_OPTIONS.filter(Boolean)}
                  onChange={(value) => updateEffect(nestedSet(currentEffectConfig, "send_inject", "inject_kind", value))}
                />
                <div className="md:col-span-2">
                  <ToggleRow
                    checked={getBool(sendInject, "requires_decision")}
                    title="Requires participant decision"
                    description="Show this generated inject as a decision point."
                    onChange={(checked) => updateEffect(nestedSet(currentEffectConfig, "send_inject", "requires_decision", checked))}
                    compact
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-semibold">Inject body</label>
                  <textarea
                    value={getNestedString(currentEffectConfig, "send_inject", "body")}
                    onChange={(event) => updateEffect(nestedSet(currentEffectConfig, "send_inject", "body", event.target.value), mode === "create")}
                    onBlur={commitTextPatch}
                    className="min-h-[76px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[8px] border border-[var(--studio-border)] bg-[var(--studio-inset)]">
        <button
          type="button"
          onClick={() => setAdvancedOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
          aria-expanded={advancedOpen}
        >
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <FileText className={EDITOR_ICON.section} />
              Advanced JSON
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-[color:var(--studio-muted2)]">
              Technical override for precise trigger, condition, and effect data.
            </span>
          </span>
          {advancedOpen ? <ChevronUp className={EDITOR_ICON.chevron} /> : <ChevronDown className={EDITOR_ICON.chevron} />}
        </button>
        <Collapsible open={advancedOpen}>
          <div className="grid gap-3 border-t border-[var(--studio-border)] p-3 md:grid-cols-2">
            {mode === "create" ? (
              <ReadOnlyField
                label="Rule key"
                value={rule?.rule_key ?? slugify(name)}
              />
            ) : null}
            <div className="space-y-1">
              <label htmlFor={triggerConfigId} className="text-sm font-semibold">Trigger config</label>
              <textarea
                id={triggerConfigId}
                value={jsonText(currentTriggerConfig)}
                onChange={(event) => {
                  try {
                    const parsed = parseJsonConfig(event.target.value, "Trigger config");
                    updateTrigger(parsed);
                    setError(null);
                  } catch {
                    setError("Trigger config must be valid JSON.");
                  }
                }}
                className="min-h-[96px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 font-mono text-[11px] leading-5"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={conditionConfigId} className="text-sm font-semibold">Condition config</label>
              <textarea
                id={conditionConfigId}
                value={jsonText(currentConditionConfig)}
                onChange={(event) => {
                  try {
                    const parsed = parseJsonConfig(event.target.value, "Condition config");
                    updateCondition(parsed);
                    setError(null);
                  } catch {
                    setError("Condition config must be valid JSON.");
                  }
                }}
                className="min-h-[96px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 font-mono text-[11px] leading-5"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label htmlFor={effectConfigId} className="text-sm font-semibold">Effect config</label>
              <textarea
                id={effectConfigId}
                value={jsonText(currentEffectConfig)}
                onChange={(event) => {
                  try {
                    const parsed = parseJsonConfig(event.target.value, "Effect config");
                    updateEffect(parsed);
                    setError(null);
                  } catch {
                    setError("Effect config must be valid JSON.");
                  }
                }}
                className="max-h-[220px] min-h-[118px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 font-mono text-[11px] leading-5"
              />
            </div>
          </div>
        </Collapsible>
      </div>
    </div>
  );
}

export default function ScenarioRulesSection({
  formId,
  newRulePanelId,
  nrRuleKeyId,
  nrRuleNameId,
  nrDescriptionId,
  nrTriggerTypeId,
  nrEnabledId,
  nrTriggerConfigId,
  nrConditionConfigId,
  nrEffectConfigId,
  rules,
  busyKey,
  openRuleId,
  setOpenRuleId,
  newRuleOpen,
  setNewRuleOpen,
  nrRuleKey,
  setNrRuleKey,
  nrRuleName,
  setNrRuleName,
  nrDescription,
  setNrDescription,
  nrTriggerType,
  setNrTriggerType,
  nrTriggerConfig,
  setNrTriggerConfig,
  nrConditionConfig,
  setNrConditionConfig,
  nrEffectConfig,
  setNrEffectConfig,
  nrEnabled,
  setNrEnabled,
  onCreateRuleTemplate,
  onUpdateRuleTemplate,
  onDeleteRuleTemplate,
  applyRulePreset,
  clearNewRuleDraft,
  setError,
}: ScenarioRulesSectionProps) {
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [placeholdersOpen, setPlaceholdersOpen] = useState(false);
  const [newAdvancedOpen, setNewAdvancedOpen] = useState(false);
  const [advancedRuleIds, setAdvancedRuleIds] = useState<Record<string, boolean>>({});

  const draftTriggerConfig = parseDraftJson(nrTriggerConfig);
  const draftConditionConfig = parseDraftJson(nrConditionConfig);
  const draftEffectConfig = parseDraftJson(nrEffectConfig);

  function syncDraftName(value: string) {
    setNrRuleName(value);
    if (!nrRuleKey.trim() || nrRuleKey === slugify(nrRuleName)) {
      setNrRuleKey(slugify(value));
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--studio-shadow)]">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className={EDITOR_ICON.section} />
            Rules & consequences
            <HintTooltip text="Rules are scenario logic: when something happens, optionally check conditions, then create consequences, tasks, or follow-up injects." />
          </div>
          <div className="mt-1 text-sm leading-6 text-[color:var(--studio-muted)]">
            Build simple when/then behavior for the live run. Advanced JSON stays available when you need precise control.
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => setNewRuleOpen((value) => !value)}
          className="gap-2"
          aria-expanded={newRuleOpen}
          aria-controls={newRulePanelId}
        >
          <Plus className={EDITOR_ICON.action} />
          New rule
          {newRuleOpen ? <ChevronUp className={EDITOR_ICON.chevron} /> : <ChevronDown className={EDITOR_ICON.chevron} />}
        </Button>
      </div>

      <div className="space-y-4 p-5">
        <div className="overflow-hidden rounded-[8px] border border-[var(--studio-border)] bg-[var(--studio-inset)]">
          <button
            type="button"
            onClick={() => setPresetsOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            aria-expanded={presetsOpen}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className={EDITOR_ICON.section} />
              Playbook starters
              <HintTooltip text="Pick a starter when you want a known pattern and then tune it with the designer." />
            </span>
            {presetsOpen ? <ChevronUp className={EDITOR_ICON.chevron} /> : <ChevronDown className={EDITOR_ICON.chevron} />}
          </button>
          <Collapsible open={presetsOpen}>
            <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-4">
              {RULE_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyRulePreset(preset)}
                  className="rounded-[8px] border border-[var(--studio-border)] bg-background p-3 text-left transition hover:border-[var(--studio-border-strong)]"
                >
                  <div className="text-sm font-semibold">{preset.name}</div>
                  <div className="mt-1 overflow-hidden text-xs leading-5 text-[color:var(--studio-muted)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                    {preset.description}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <MiniBadge>{humanize(preset.triggerType)}</MiniBadge>
                    {"decision_type" in preset.triggerConfig ? <MiniBadge tone="accent">{String(preset.triggerConfig.decision_type)}</MiniBadge> : null}
                    {"inject_kind" in preset.triggerConfig ? <MiniBadge tone="warm">{String(preset.triggerConfig.inject_kind)}</MiniBadge> : null}
                  </div>
                </button>
              ))}
            </div>
          </Collapsible>
        </div>

        {newRuleOpen ? (
          <div
            id={newRulePanelId}
            role="region"
            aria-label="Create rule template"
            className="space-y-3 rounded-[8px] border border-[var(--studio-border)] bg-[var(--studio-inset)] p-3"
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquarePlus className={EDITOR_ICON.section} />
              Create rule
            </div>
            <RuleDesigner
              key="new-rule-designer"
              mode="create"
              name={nrRuleName}
              setName={syncDraftName}
              description={nrDescription}
              setDescription={setNrDescription}
              triggerType={nrTriggerType}
              setTriggerType={setNrTriggerType}
              triggerConfig={draftTriggerConfig}
              setTriggerConfig={(value) => setNrTriggerConfig(JSON.stringify(value, null, 2))}
              conditionConfig={draftConditionConfig}
              setConditionConfig={(value) => setNrConditionConfig(JSON.stringify(value, null, 2))}
              effectConfig={draftEffectConfig}
              setEffectConfig={(value) => setNrEffectConfig(JSON.stringify(value, null, 2))}
              enabled={nrEnabled}
              setEnabled={setNrEnabled}
              advancedOpen={newAdvancedOpen}
              setAdvancedOpen={setNewAdvancedOpen}
              triggerConfigId={nrTriggerConfigId}
              conditionConfigId={nrConditionConfigId}
              effectConfigId={nrEffectConfigId}
              setError={setError}
            />

            <div className="flex flex-wrap gap-2">
              <Button onClick={onCreateRuleTemplate} disabled={busyKey === "create-rule"} className="gap-2">
                <Plus className={EDITOR_ICON.action} />
                {busyKey === "create-rule" ? "…" : "Create rule"}
              </Button>
              <Button variant="secondary" onClick={clearNewRuleDraft}>
                Clear
              </Button>
              <Button variant="outline" onClick={() => setNewRuleOpen(false)}>
                Close
              </Button>
              <input id={nrRuleKeyId} value={nrRuleKey} readOnly hidden />
              <input id={nrRuleNameId} value={nrRuleName} readOnly hidden />
              <input id={nrDescriptionId} value={nrDescription} readOnly hidden />
              <input id={nrTriggerTypeId} value={nrTriggerType} readOnly hidden />
              <input id={nrEnabledId} checked={nrEnabled} readOnly hidden type="checkbox" />
            </div>
          </div>
        ) : null}

        {rules.length === 0 && !newRuleOpen ? (
          <div className="rounded-[8px] border border-dashed border-[var(--studio-border)] bg-[var(--studio-inset)] px-5 py-6 text-sm text-[color:var(--studio-muted)]">
            No rules yet. Add one only where automation makes the exercise clearer.
          </div>
        ) : rules.length > 0 ? (
          <div className="space-y-2">
            {rules.map((rule) => {
              const isOpen = openRuleId === rule.id;
              const isBusy = busyKey === `rule:${rule.id}` || busyKey === `delrule:${rule.id}`;
              const advancedOpen = advancedRuleIds[rule.id] ?? false;

              return (
                <div key={rule.id} className="overflow-hidden rounded-[8px] border border-[var(--studio-border)] bg-[var(--studio-inset)]">
                  <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate font-semibold">{rule.rule_name}</div>
                        <MiniBadge tone={rule.enabled ? "accent" : "neutral"}>{rule.enabled ? "Enabled" : "Disabled"}</MiniBadge>
                      </div>
                      <div className="mt-1 text-xs leading-5 text-[color:var(--studio-muted2)]">
                        When: <span className="text-foreground/80">{summarizeWhen(rule.trigger_type, rule.trigger_config, rule.condition_config)}</span>
                      </div>
                      <div className="mt-1 text-xs leading-5 text-[color:var(--studio-muted2)]">
                        Then: <span className="text-foreground/80">{summarizeThen(rule.effect_config)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setOpenRuleId(isOpen ? null : rule.id)}
                        aria-expanded={isOpen}
                        aria-controls={`${formId}-rule-editor-${rule.id}`}
                        aria-label={`${isOpen ? "Close" : "Edit"} rule ${rule.rule_name}`}
                        className="gap-2"
                      >
                        <Settings2 className={EDITOR_ICON.action} />
                        {isOpen ? "Close" : "Edit"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onDeleteRuleTemplate(rule.id)}
                        disabled={!!isBusy}
                        className="gap-2"
                        aria-label={`Delete rule ${rule.rule_name}`}
                      >
                        <Trash2 className={EDITOR_ICON.action} />
                        Delete
                      </Button>
                    </div>
                  </div>

                  {isOpen ? (
                    <div id={`${formId}-rule-editor-${rule.id}`} className="border-t border-[var(--studio-border)] p-4">
                      <RuleDesigner
                        key={rule.id}
                        mode="edit"
                        rule={rule}
                        name={rule.rule_name}
                        setName={() => undefined}
                        description={rule.description ?? ""}
                        setDescription={() => undefined}
                        triggerType={rule.trigger_type as TriggerType}
                        setTriggerType={() => undefined}
                        triggerConfig={rule.trigger_config}
                        setTriggerConfig={() => undefined}
                        conditionConfig={rule.condition_config}
                        setConditionConfig={() => undefined}
                        effectConfig={rule.effect_config}
                        setEffectConfig={() => undefined}
                        enabled={rule.enabled}
                        setEnabled={() => undefined}
                        advancedOpen={advancedOpen}
                        setAdvancedOpen={(value) =>
                          setAdvancedRuleIds((current) => ({
                            ...current,
                            [rule.id]: typeof value === "function" ? value(current[rule.id] ?? false) : value,
                          }))
                        }
                        triggerConfigId={`${formId}-rule-trigger-config-${rule.id}`}
                        conditionConfigId={`${formId}-rule-condition-config-${rule.id}`}
                        effectConfigId={`${formId}-rule-effect-config-${rule.id}`}
                        setError={setError}
                        onPatch={(patch) => onUpdateRuleTemplate(rule.id, patch)}
                      />
                    </div>
                  ) : rule.description?.trim() ? (
                    <div className="px-4 pb-4 text-sm leading-6 text-[color:var(--studio-muted)]">{rule.description}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[8px] border border-[var(--studio-border)] bg-[var(--studio-inset)]">
          <button
            type="button"
            onClick={() => setPlaceholdersOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            aria-expanded={placeholdersOpen}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Clock3 className={EDITOR_ICON.section} />
              Template tokens
              <HintTooltip text="Use these in titles and descriptions when you want generated output to mention the triggering update, decision, or task." />
            </span>
            {placeholdersOpen ? <ChevronUp className={EDITOR_ICON.chevron} /> : <ChevronDown className={EDITOR_ICON.chevron} />}
          </button>
          <Collapsible open={placeholdersOpen}>
            <div className="flex flex-wrap gap-2 p-4">
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
          </Collapsible>
        </div>
      </div>
    </section>
  );
}
