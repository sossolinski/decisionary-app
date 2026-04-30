"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Settings2, Sparkles, Trash2 } from "lucide-react";

import Collapsible from "@/app/components/Collapsible";
import HintTooltip from "@/app/components/HintTooltip";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import type { ScenarioRuleTemplate } from "@/lib/scenarios";

import {
  jsonText,
  MiniBadge,
  parseJsonConfig,
  RULE_PRESETS,
  RULE_TRIGGER_OPTIONS,
  Select,
} from "./scenarioEditorUi";

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
  nrTriggerType: (typeof RULE_TRIGGER_OPTIONS)[number];
  setNrTriggerType: (value: (typeof RULE_TRIGGER_OPTIONS)[number]) => void;
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
  const [presetsOpen, setPresetsOpen] = useState(true);
  const [placeholdersOpen, setPlaceholdersOpen] = useState(false);

  return (
    <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden border border-[var(--studio-border)]">
      <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-[var(--studio-border)]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 opacity-80" />
            Rules & consequences
            <HintTooltip text="Define simple scenario rules that react to injects or decisions and describe the consequence payload you want the engine to use later." />
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => setNewRuleOpen((v) => !v)}
          className="gap-2"
          aria-expanded={newRuleOpen}
          aria-controls={newRulePanelId}
        >
          <Plus className="h-4 w-4" />
          New rule
          {newRuleOpen ? <ChevronUp className="h-4 w-4 opacity-70" /> : <ChevronDown className="h-4 w-4 opacity-70" />}
        </Button>
      </div>

      <div className="p-5 space-y-4">
        <div className="overflow-hidden rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)]">
          <button
            type="button"
            onClick={() => setPresetsOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            aria-expanded={presetsOpen}
          >
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                Quick presets
                <HintTooltip text="Use these when you want a fast starting point instead of writing rule JSON from scratch." />
              </div>
            </div>
            {presetsOpen ? <ChevronUp className="h-4 w-4 opacity-70" /> : <ChevronDown className="h-4 w-4 opacity-70" />}
          </button>
          <Collapsible open={presetsOpen}>
            <div className="border-t border-[var(--studio-border)] p-4">
              <div className="grid gap-3 xl:grid-cols-3">
                {RULE_PRESETS.map((preset) => (
                  <div key={preset.key} className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface)] p-4">
                    <div className="font-medium">{preset.name}</div>
                    <div className="mt-1 text-sm text-[color:var(--studio-muted)]">{preset.description}</div>
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
          </Collapsible>
        </div>

        <div className="overflow-hidden rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)]">
          <button
            type="button"
            onClick={() => setPlaceholdersOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            aria-expanded={placeholdersOpen}
          >
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                Available placeholders
                <HintTooltip text="Helpful only when you are writing dynamic text for consequences, tasks, and generated injects." />
              </div>
            </div>
            {placeholdersOpen ? <ChevronUp className="h-4 w-4 opacity-70" /> : <ChevronDown className="h-4 w-4 opacity-70" />}
          </button>
          <Collapsible open={placeholdersOpen}>
            <div className="border-t border-[var(--studio-border)] p-4">
              <div className="flex flex-wrap gap-2">
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
          </Collapsible>
        </div>

        {newRuleOpen ? (
          <div
            id={newRulePanelId}
            role="region"
            aria-label="Create rule template"
            className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] p-4 space-y-3"
          >
            <div className="text-sm font-semibold">Create rule template</div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor={nrRuleKeyId} className="text-sm font-semibold">Rule key</label>
                <Input id={nrRuleKeyId} value={nrRuleKey} onChange={(e) => setNrRuleKey(e.target.value)} placeholder="e.g., welfare-delay-escalation" />
              </div>

              <div className="space-y-1">
                <label htmlFor={nrRuleNameId} className="text-sm font-semibold">Rule name</label>
                <Input id={nrRuleNameId} value={nrRuleName} onChange={(e) => setNrRuleName(e.target.value)} placeholder="Passenger welfare escalates when unresolved" />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label htmlFor={nrDescriptionId} className="text-sm font-semibold">Description</label>
                <textarea
                  id={nrDescriptionId}
                  value={nrDescription}
                  onChange={(e) => setNrDescription(e.target.value)}
                  className="min-h-[80px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm"
                  placeholder="What this rule is meant to model in the exercise."
                />
              </div>

              <div className="space-y-1">
                <label htmlFor={nrTriggerTypeId} className="text-sm font-semibold">Trigger type</label>
                <Select id={nrTriggerTypeId} value={nrTriggerType} onChange={(v) => setNrTriggerType(v as (typeof RULE_TRIGGER_OPTIONS)[number])}>
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
                    id={nrEnabledId}
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
                <label htmlFor={nrTriggerConfigId} className="text-sm font-semibold">Trigger config</label>
                <textarea
                  id={nrTriggerConfigId}
                  value={nrTriggerConfig}
                  onChange={(e) => setNrTriggerConfig(e.target.value)}
                  className="min-h-[130px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor={nrConditionConfigId} className="text-sm font-semibold">Condition config</label>
                <textarea
                  id={nrConditionConfigId}
                  value={nrConditionConfig}
                  onChange={(e) => setNrConditionConfig(e.target.value)}
                  className="min-h-[130px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 font-mono text-xs"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label htmlFor={nrEffectConfigId} className="text-sm font-semibold">Effect config</label>
                <textarea
                  id={nrEffectConfigId}
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

              <Button variant="secondary" onClick={clearNewRuleDraft}>
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
                        aria-expanded={isOpen}
                        aria-controls={`${formId}-rule-editor-${rule.id}`}
                        aria-label={`${isOpen ? "Close" : "Edit"} rule ${rule.rule_name}`}
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
                        aria-label={`Delete rule ${rule.rule_name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  {isOpen ? (
                    <div
                      id={`${formId}-rule-editor-${rule.id}`}
                      role="region"
                      aria-label={`Edit rule ${rule.rule_name}`}
                      className="border-t border-[var(--studio-border)] p-4 grid gap-3 md:grid-cols-2"
                    >
                      <div className="space-y-1">
                        <label htmlFor={`${formId}-rule-key-${rule.id}`} className="text-sm font-semibold">Rule key</label>
                        <Input
                          id={`${formId}-rule-key-${rule.id}`}
                          defaultValue={rule.rule_key}
                          onBlur={(e) => onUpdateRuleTemplate(rule.id, { rule_key: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor={`${formId}-rule-name-${rule.id}`} className="text-sm font-semibold">Rule name</label>
                        <Input
                          id={`${formId}-rule-name-${rule.id}`}
                          defaultValue={rule.rule_name}
                          onBlur={(e) => onUpdateRuleTemplate(rule.id, { rule_name: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <label htmlFor={`${formId}-rule-description-${rule.id}`} className="text-sm font-semibold">Description</label>
                        <textarea
                          id={`${formId}-rule-description-${rule.id}`}
                          defaultValue={rule.description ?? ""}
                          onBlur={(e) => onUpdateRuleTemplate(rule.id, { description: e.target.value || null })}
                          className="min-h-[80px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor={`${formId}-rule-trigger-type-${rule.id}`} className="text-sm font-semibold">Trigger type</label>
                        <Select
                          id={`${formId}-rule-trigger-type-${rule.id}`}
                          value={rule.trigger_type}
                          onChange={(value) => onUpdateRuleTemplate(rule.id, { trigger_type: value })}
                        >
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
                            id={`${formId}-rule-enabled-${rule.id}`}
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
                        <label htmlFor={`${formId}-rule-trigger-config-${rule.id}`} className="text-sm font-semibold">Trigger config</label>
                        <textarea
                          id={`${formId}-rule-trigger-config-${rule.id}`}
                          defaultValue={jsonText(rule.trigger_config)}
                          onBlur={(e) => {
                            try {
                              const value = parseJsonConfig(e.target.value, "Trigger config");
                              void onUpdateRuleTemplate(rule.id, { trigger_config: value });
                            } catch (error) {
                              setError(error instanceof Error ? error.message : "Trigger config must be valid JSON.");
                            }
                          }}
                          className="min-h-[130px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 font-mono text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor={`${formId}-rule-condition-config-${rule.id}`} className="text-sm font-semibold">Condition config</label>
                        <textarea
                          id={`${formId}-rule-condition-config-${rule.id}`}
                          defaultValue={jsonText(rule.condition_config)}
                          onBlur={(e) => {
                            try {
                              const value = parseJsonConfig(e.target.value, "Condition config");
                              void onUpdateRuleTemplate(rule.id, { condition_config: value });
                            } catch (error) {
                              setError(error instanceof Error ? error.message : "Condition config must be valid JSON.");
                            }
                          }}
                          className="min-h-[130px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 font-mono text-xs"
                        />
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <label htmlFor={`${formId}-rule-effect-config-${rule.id}`} className="text-sm font-semibold">Effect config</label>
                        <textarea
                          id={`${formId}-rule-effect-config-${rule.id}`}
                          defaultValue={jsonText(rule.effect_config)}
                          onBlur={(e) => {
                            try {
                              const value = parseJsonConfig(e.target.value, "Effect config");
                              void onUpdateRuleTemplate(rule.id, { effect_config: value });
                            } catch (error) {
                              setError(error instanceof Error ? error.message : "Effect config must be valid JSON.");
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
  );
}
