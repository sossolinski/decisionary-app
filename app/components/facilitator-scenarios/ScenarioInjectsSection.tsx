"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Link2Off, MoveDown, MoveUp, Plus, Settings2, Trash2 } from "lucide-react";

import Collapsible from "@/app/components/Collapsible";
import InjectMediaField from "@/app/components/InjectMediaField";
import HintTooltip from "@/app/components/HintTooltip";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import type { Inject, ScenarioInject } from "@/lib/scenarios";
import { createPendingInjectMedia, type InjectMedia, type PendingInjectMedia } from "@/lib/injectMedia";

import {
  formatReleaseOffset,
  INJECT_KIND_OPTIONS,
  MiniBadge,
  SOURCE_TYPE_OPTIONS,
  Select,
  VISIBILITY_SCOPE_OPTIONS,
  fmt,
} from "./scenarioEditorUi";

function formatStreamLabel(channel: string | null | undefined) {
  return String(channel ?? "").toLowerCase() === "pulse" ? "Pulse" : "Inbox";
}

type NewInjectState = {
  niTitle: string;
  setNiTitle: (value: string) => void;
  niBody: string;
  setNiBody: (value: string) => void;
  niChannel: string;
  setNiChannel: (value: string) => void;
  niSeverity: string;
  setNiSeverity: (value: string) => void;
  niSenderName: string;
  setNiSenderName: (value: string) => void;
  niSenderOrg: string;
  setNiSenderOrg: (value: string) => void;
  niReleaseOffsetMinutes: string;
  setNiReleaseOffsetMinutes: (value: string) => void;
  niInjectKind: NonNullable<Inject["inject_kind"]>;
  setNiInjectKind: (value: NonNullable<Inject["inject_kind"]>) => void;
  niSourceType: NonNullable<Inject["source_type"]>;
  setNiSourceType: (value: NonNullable<Inject["source_type"]>) => void;
  niEntityScope: string;
  setNiEntityScope: (value: string) => void;
  niRequiresDecision: boolean;
  setNiRequiresDecision: (value: boolean) => void;
  niDecisionTemplateKey: string;
  setNiDecisionTemplateKey: (value: string) => void;
  niVisibilityScope: (typeof VISIBILITY_SCOPE_OPTIONS)[number];
  setNiVisibilityScope: (value: (typeof VISIBILITY_SCOPE_OPTIONS)[number]) => void;
  niBranchKey: string;
  setNiBranchKey: (value: string) => void;
  niMediaFiles: PendingInjectMedia[];
  setNiMediaFiles: React.Dispatch<React.SetStateAction<PendingInjectMedia[]>>;
};

type ScenarioInjectsSectionProps = NewInjectState & {
  formId: string;
  newInjectPanelId: string;
  niTitleId: string;
  niScheduledId: string;
  niChannelId: string;
  niKindId: string;
  niSeverityId: string;
  niSourceTypeId: string;
  niSenderNameId: string;
  niSenderOrgId: string;
  niEntityScopeId: string;
  niVisibilityId: string;
  niDecisionTemplateKeyId: string;
  niBranchKeyId: string;
  niRequiresDecisionId: string;
  niBodyId: string;
  sortedInjects: ScenarioInject[];
  busyKey: string | null;
  openSiId: string | null;
  setOpenSiId: (value: string | null) => void;
  newInjectOpen: boolean;
  setNewInjectOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  onCreateScenarioInject: () => void;
  onDetach: (scenarioInjectId: string) => void;
  onDeleteInject: (injectId: string) => void;
  onUpdateInject: (injectId: string, patch: Partial<Inject>) => void;
  onUploadInjectMedia: (injectId: string, files: File[]) => void;
  onDeleteInjectMedia: (injectId: string, media: InjectMedia) => void;
  onUpdateInjectMediaAlt: (injectId: string, media: InjectMedia, altText: string) => void;
  onReorderInjectMedia: (injectId: string, fromId: string, toId: string) => void;
  onReschedule: (scenarioInjectId: string, releaseOffsetMinutes: string) => void;
  onMove: (scenarioInjectId: string, direction: -1 | 1) => void;
  clearNewInjectDraft: () => void;
};

export default function ScenarioInjectsSection({
  formId,
  newInjectPanelId,
  niTitleId,
  niScheduledId,
  niChannelId,
  niKindId,
  niSeverityId,
  niSourceTypeId,
  niSenderNameId,
  niSenderOrgId,
  niEntityScopeId,
  niVisibilityId,
  niDecisionTemplateKeyId,
  niBranchKeyId,
  niRequiresDecisionId,
  niBodyId,
  sortedInjects,
  busyKey,
  openSiId,
  setOpenSiId,
  newInjectOpen,
  setNewInjectOpen,
  onCreateScenarioInject,
  onDetach,
  onDeleteInject,
  onUpdateInject,
  onUploadInjectMedia,
  onDeleteInjectMedia,
  onUpdateInjectMediaAlt,
  onReorderInjectMedia,
  onReschedule,
  onMove,
  clearNewInjectDraft,
  niTitle,
  setNiTitle,
  niBody,
  setNiBody,
  niChannel,
  setNiChannel,
  niSeverity,
  setNiSeverity,
  niSenderName,
  setNiSenderName,
  niSenderOrg,
  setNiSenderOrg,
  niReleaseOffsetMinutes,
  setNiReleaseOffsetMinutes,
  niInjectKind,
  setNiInjectKind,
  niSourceType,
  setNiSourceType,
  niEntityScope,
  setNiEntityScope,
  niRequiresDecision,
  setNiRequiresDecision,
  niDecisionTemplateKey,
  setNiDecisionTemplateKey,
  niVisibilityScope,
  setNiVisibilityScope,
  niBranchKey,
  setNiBranchKey,
  niMediaFiles,
  setNiMediaFiles,
}: ScenarioInjectsSectionProps) {
  const [createAdvancedOpen, setCreateAdvancedOpen] = useState(false);
  const [openInjectAdvancedIds, setOpenInjectAdvancedIds] = useState<Record<string, boolean>>({});

  return (
    <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden border border-[var(--studio-border)]">
      <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-[var(--studio-border)]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Settings2 className="h-4 w-4 opacity-80" />
            Injects
            <HintTooltip text="Create, edit, reorder, and schedule injects that drive the session forward." />
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => setNewInjectOpen((v) => !v)}
          className="gap-2"
          aria-expanded={newInjectOpen}
          aria-controls={newInjectPanelId}
        >
          <Plus className="h-4 w-4" />
          New inject
          {newInjectOpen ? <ChevronUp className="h-4 w-4 opacity-70" /> : <ChevronDown className="h-4 w-4 opacity-70" />}
        </Button>
      </div>

      <div className="p-5 space-y-4">
        {newInjectOpen ? (
          <div
            id={newInjectPanelId}
            role="region"
            aria-label="Create inject"
            className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] p-4 space-y-3"
          >
            <div className="text-sm font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 opacity-80" />
              Create inject
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor={niTitleId} className="text-sm font-semibold">Title</label>
                <Input id={niTitleId} value={niTitle} onChange={(e) => setNiTitle(e.target.value)} />
              </div>

              <div className="space-y-1">
                <label htmlFor={niScheduledId} className="text-sm font-semibold">Release at T+</label>
                <Input
                  id={niScheduledId}
                  type="number"
                  min="0"
                  step="1"
                  value={niReleaseOffsetMinutes}
                  onChange={(e) => setNiReleaseOffsetMinutes(e.target.value)}
                  placeholder="Minutes from session start"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor={niChannelId} className="text-sm font-semibold">Stream</label>
                <Select id={niChannelId} value={niChannel === "pulse" ? "pulse" : "inbox"} onChange={setNiChannel}>
                  <option value="inbox">Inbox</option>
                  <option value="pulse">Pulse</option>
                </Select>
              </div>

              <div className="space-y-1">
                <label htmlFor={niKindId} className="text-sm font-semibold">Kind</label>
                <Select id={niKindId} value={niInjectKind} onChange={(v) => setNiInjectKind(v as NonNullable<Inject["inject_kind"]>)}>
                  {INJECT_KIND_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label htmlFor={niBodyId} className="text-sm font-semibold">Body</label>
                <textarea
                  id={niBodyId}
                  value={niBody}
                  onChange={(e) => setNiBody(e.target.value)}
                  className="min-h-[120px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface)]">
              <button
                type="button"
                onClick={() => setCreateAdvancedOpen((value) => !value)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                aria-expanded={createAdvancedOpen}
              >
                <div>
                  <div className="text-sm font-semibold">Advanced routing & metadata</div>
                  <div className="mt-1 text-xs text-[color:var(--studio-muted2)]">
                    Open this only when the inject needs decision flow, visibility, branch, severity, or sender tuning.
                  </div>
                </div>
                {createAdvancedOpen ? <ChevronUp className="h-4 w-4 opacity-70" /> : <ChevronDown className="h-4 w-4 opacity-70" />}
              </button>
              <Collapsible open={createAdvancedOpen}>
                <div className="border-t border-[var(--studio-border)] p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label htmlFor={niSeverityId} className="text-sm font-semibold">Severity</label>
                      <Input id={niSeverityId} value={niSeverity} onChange={(e) => setNiSeverity(e.target.value)} placeholder="low / medium / high / critical…" />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor={niSourceTypeId} className="text-sm font-semibold">Source type</label>
                      <Select id={niSourceTypeId} value={niSourceType} onChange={(v) => setNiSourceType(v as NonNullable<Inject["source_type"]>)}>
                        {SOURCE_TYPE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor={niSenderNameId} className="text-sm font-semibold">Sender name</label>
                      <Input id={niSenderNameId} value={niSenderName} onChange={(e) => setNiSenderName(e.target.value)} />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor={niSenderOrgId} className="text-sm font-semibold">Sender org</label>
                      <Input id={niSenderOrgId} value={niSenderOrg} onChange={(e) => setNiSenderOrg(e.target.value)} />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor={niEntityScopeId} className="text-sm font-semibold">Entity scope</label>
                      <Input
                        id={niEntityScopeId}
                        value={niEntityScope}
                        onChange={(e) => setNiEntityScope(e.target.value)}
                        placeholder="flight / airport / passengers / crew…"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor={niVisibilityId} className="text-sm font-semibold">Visibility</label>
                      <Select id={niVisibilityId} value={niVisibilityScope} onChange={(v) => setNiVisibilityScope(v as (typeof VISIBILITY_SCOPE_OPTIONS)[number])}>
                        {VISIBILITY_SCOPE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor={niDecisionTemplateKeyId} className="text-sm font-semibold">Decision template key</label>
                      <Input
                        id={niDecisionTemplateKeyId}
                        value={niDecisionTemplateKey}
                        onChange={(e) => setNiDecisionTemplateKey(e.target.value)}
                        placeholder="e.g., passenger-welfare-response"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor={niBranchKeyId} className="text-sm font-semibold">Branch key</label>
                      <Input id={niBranchKeyId} value={niBranchKey} onChange={(e) => setNiBranchKey(e.target.value)} placeholder="Optional follow-up branch" />
                    </div>

                    <div className="space-y-2 rounded-[var(--radius)] border border-[var(--studio-border)] bg-background/80 px-3 py-3 md:col-span-2">
                      <label className="flex items-start gap-3">
                        <input
                          id={niRequiresDecisionId}
                          type="checkbox"
                          checked={niRequiresDecision}
                          onChange={(e) => setNiRequiresDecision(e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border border-[var(--studio-border)]"
                        />
                        <div className="space-y-1">
                          <div className="text-sm font-semibold">
                            <span className="sr-only">Checkbox:</span> Requires decision
                          </div>
                          <div className="text-xs leading-5 text-[color:var(--studio-muted2)]">
                            Turn this inject into a structured decision point so the live session can create follow-up work, not just log a message.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </Collapsible>
            </div>

            <InjectMediaField
              existingMedia={[]}
              pendingFiles={niMediaFiles}
              onAddFiles={(files) =>
                setNiMediaFiles((prev) => [...prev, ...createPendingInjectMedia(files, niTitle)])
              }
              onMovePending={(fromIndex, toIndex) =>
                setNiMediaFiles((prev) => {
                  if (toIndex < 0 || toIndex >= prev.length || fromIndex === toIndex) return prev;
                  const next = [...prev];
                  const [moved] = next.splice(fromIndex, 1);
                  next.splice(toIndex, 0, moved);
                  return next;
                })
              }
              onUpdatePendingAlt={(index, altText) =>
                setNiMediaFiles((prev) =>
                  prev.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, alt_text: altText } : item
                  )
                )
              }
              onRemovePending={(index) =>
                setNiMediaFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index))
              }
              disabled={busyKey === "create-inject"}
            />

            <div className="flex flex-wrap gap-2">
              <Button onClick={onCreateScenarioInject} disabled={busyKey === "create-inject"} className="gap-2">
                <Plus className="h-4 w-4" />
                {busyKey === "create-inject" ? "…" : "Create & attach"}
              </Button>

              <Button variant="secondary" onClick={clearNewInjectDraft}>
                Clear
              </Button>

              <Button variant="outline" onClick={() => setNewInjectOpen(false)}>
                Close
              </Button>
            </div>

            <div className="flex justify-end">
              <HintTooltip text="Use minutes from session start. Leave empty for an immediate inject that can appear at T+0." />
            </div>
          </div>
        ) : null}

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
              const releaseOffsetValue =
                typeof si.release_offset_minutes === "number" ? String(si.release_offset_minutes) : "";
              const injectAdvancedOpen = openInjectAdvancedIds[si.id] ?? false;

              return (
                <div key={si.id} className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface)] overflow-hidden">
                  <div className="px-4 py-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {inj?.title ?? "Untitled inject"}
                        <span className="ml-2 text-xs text-[color:var(--studio-muted2)]">#{si.order_index ?? 0}</span>
                      </div>

                      <div className="mt-1 text-xs text-[color:var(--studio-muted2)]">
                        Stream: <span className="text-foreground/80 font-semibold">{formatStreamLabel(inj?.channel)}</span>
                        <span className="mx-2">•</span>
                        Severity: <span className="text-foreground/80 font-semibold">{inj?.severity ?? "—"}</span>
                        <span className="mx-2">•</span>
                        Release: <span className="text-foreground/80 font-semibold">{formatReleaseOffset(si.release_offset_minutes)}</span>
                        {si.release_offset_minutes == null && si.scheduled_at ? (
                          <>
                            <span className="mx-2">•</span>
                            Legacy time: <span className="text-foreground/80 font-semibold">{fmt(si.scheduled_at)}</span>
                          </>
                        ) : null}
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
                        aria-label={`Move inject ${inj?.title ?? "Untitled inject"} up`}
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
                        aria-label={`Move inject ${inj?.title ?? "Untitled inject"} down`}
                        className="gap-2"
                      >
                        <MoveDown className="h-4 w-4" />
                        Down
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setOpenSiId(isOpen ? null : si.id)}
                        aria-expanded={isOpen}
                        aria-controls={`${formId}-inject-editor-${si.id}`}
                        aria-label={`${isOpen ? "Close" : "Edit"} inject ${inj?.title ?? "Untitled inject"}`}
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
                        aria-label={`Detach inject ${inj?.title ?? "Untitled inject"} from scenario`}
                      >
                        <Link2Off className="h-4 w-4" />
                        Detach
                      </Button>
                    </div>
                  </div>

                  {isOpen ? (
                    <div
                      id={`${formId}-inject-editor-${si.id}`}
                      role="region"
                      aria-label={`Edit inject ${inj?.title ?? "Untitled inject"}`}
                      className="border-t border-[var(--studio-border)] p-4 grid gap-3 md:grid-cols-2"
                    >
                      <div className="space-y-1">
                        <label htmlFor={`${formId}-inject-title-${si.id}`} className="text-sm font-semibold">Title</label>
                        <Input
                          id={`${formId}-inject-title-${si.id}`}
                          defaultValue={inj?.title ?? ""}
                          onBlur={(e) => inj?.id && onUpdateInject(inj.id, { title: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor={`${formId}-inject-scheduled-${si.id}`} className="text-sm font-semibold">Release at T+</label>
                        <Input
                          id={`${formId}-inject-scheduled-${si.id}`}
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={releaseOffsetValue}
                          onBlur={(e) => onReschedule(si.id, e.target.value)}
                          placeholder="Minutes from session start"
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor={`${formId}-inject-channel-${si.id}`} className="text-sm font-semibold">Stream</label>
                        <Select
                          id={`${formId}-inject-channel-${si.id}`}
                          value={inj?.channel === "pulse" ? "pulse" : "inbox"}
                          onChange={(value) => inj?.id && onUpdateInject(inj.id, { channel: value === "pulse" ? "pulse" : "inbox" })}
                        >
                          <option value="inbox">Inbox</option>
                          <option value="pulse">Pulse</option>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <label htmlFor={`${formId}-inject-kind-${si.id}`} className="text-sm font-semibold">Kind</label>
                        <Select
                          id={`${formId}-inject-kind-${si.id}`}
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

                      <div className="space-y-1 md:col-span-2">
                        <label htmlFor={`${formId}-inject-body-${si.id}`} className="text-sm font-semibold">Body</label>
                        <textarea
                          id={`${formId}-inject-body-${si.id}`}
                          defaultValue={inj?.body ?? ""}
                          onBlur={(e) => inj?.id && onUpdateInject(inj.id, { body: e.target.value })}
                          className="min-h-[140px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <InjectMediaField
                          existingMedia={inj?.media ?? []}
                          pendingFiles={[]}
                          onAddFiles={(files) => {
                            if (inj?.id) void onUploadInjectMedia(inj.id, files);
                          }}
                          onRemovePending={() => undefined}
                          onRemoveExisting={(media) => {
                            if (inj?.id) void onDeleteInjectMedia(inj.id, media);
                          }}
                          onUpdateExistingAlt={(media, altText) => {
                            if (inj?.id) void onUpdateInjectMediaAlt(inj.id, media, altText);
                          }}
                          onMoveExisting={(fromId, toId) => {
                            if (inj?.id) void onReorderInjectMedia(inj.id, fromId, toId);
                          }}
                          disabled={!!isBusy}
                        />
                      </div>

                      <div className="md:col-span-2 overflow-hidden rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)]">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenInjectAdvancedIds((prev) => ({
                              ...prev,
                              [si.id]: !injectAdvancedOpen,
                            }))
                          }
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                          aria-expanded={injectAdvancedOpen}
                        >
                          <div>
                            <div className="text-sm font-semibold">Advanced routing & metadata</div>
                            <div className="mt-1 text-xs text-[color:var(--studio-muted2)]">
                              Open this only when you need to tune sender, visibility, source, or decision wiring.
                            </div>
                          </div>
                          {injectAdvancedOpen ? <ChevronUp className="h-4 w-4 opacity-70" /> : <ChevronDown className="h-4 w-4 opacity-70" />}
                        </button>
                        <Collapsible open={injectAdvancedOpen}>
                          <div className="border-t border-[var(--studio-border)] p-4 grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                              <label htmlFor={`${formId}-inject-severity-${si.id}`} className="text-sm font-semibold">Severity</label>
                              <Input
                                id={`${formId}-inject-severity-${si.id}`}
                                defaultValue={inj?.severity ?? ""}
                                onBlur={(e) => inj?.id && onUpdateInject(inj.id, { severity: e.target.value || null })}
                              />
                            </div>

                            <div className="space-y-1">
                              <label htmlFor={`${formId}-inject-source-type-${si.id}`} className="text-sm font-semibold">Source type</label>
                              <Select
                                id={`${formId}-inject-source-type-${si.id}`}
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
                              <label htmlFor={`${formId}-inject-sender-name-${si.id}`} className="text-sm font-semibold">Sender name</label>
                              <Input
                                id={`${formId}-inject-sender-name-${si.id}`}
                                defaultValue={inj?.sender_name ?? ""}
                                onBlur={(e) => inj?.id && onUpdateInject(inj.id, { sender_name: e.target.value || null })}
                              />
                            </div>

                            <div className="space-y-1">
                              <label htmlFor={`${formId}-inject-sender-org-${si.id}`} className="text-sm font-semibold">Sender org</label>
                              <Input
                                id={`${formId}-inject-sender-org-${si.id}`}
                                defaultValue={inj?.sender_org ?? ""}
                                onBlur={(e) => inj?.id && onUpdateInject(inj.id, { sender_org: e.target.value || null })}
                              />
                            </div>

                            <div className="space-y-1">
                              <label htmlFor={`${formId}-inject-entity-scope-${si.id}`} className="text-sm font-semibold">Entity scope</label>
                              <Input
                                id={`${formId}-inject-entity-scope-${si.id}`}
                                defaultValue={inj?.entity_scope ?? ""}
                                onBlur={(e) => inj?.id && onUpdateInject(inj.id, { entity_scope: e.target.value || null })}
                                placeholder="flight / airport / passengers / crew…"
                              />
                            </div>

                            <div className="space-y-1">
                              <label htmlFor={`${formId}-inject-visibility-${si.id}`} className="text-sm font-semibold">Visibility</label>
                              <Select
                                id={`${formId}-inject-visibility-${si.id}`}
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
                              <label htmlFor={`${formId}-inject-decision-template-key-${si.id}`} className="text-sm font-semibold">Decision template key</label>
                              <Input
                                id={`${formId}-inject-decision-template-key-${si.id}`}
                                defaultValue={inj?.decision_template_key ?? ""}
                                onBlur={(e) => inj?.id && onUpdateInject(inj.id, { decision_template_key: e.target.value || null })}
                                placeholder="Optional decision playbook key"
                              />
                            </div>

                            <div className="space-y-1">
                              <label htmlFor={`${formId}-inject-branch-key-${si.id}`} className="text-sm font-semibold">Branch key</label>
                              <Input
                                id={`${formId}-inject-branch-key-${si.id}`}
                                defaultValue={inj?.branch_key ?? ""}
                                onBlur={(e) => inj?.id && onUpdateInject(inj.id, { branch_key: e.target.value || null })}
                                placeholder="Optional consequence branch"
                              />
                            </div>

                            <div className="space-y-2 rounded-[var(--radius)] border border-[var(--studio-border)] bg-background/80 px-3 py-3 md:col-span-2">
                              <label className="flex items-start gap-3">
                                <input
                                  id={`${formId}-inject-requires-decision-${si.id}`}
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
                          </div>
                        </Collapsible>
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
                            aria-label={`Delete inject ${inj.title ?? "Untitled inject"} from the library`}
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
  );
}
