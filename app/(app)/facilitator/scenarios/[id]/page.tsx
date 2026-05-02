// app/(app)/facilitator/scenarios/[id]/page.tsx
"use client";

import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
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
import {
  deleteInjectMedia,
  reorderInjectMedia,
  updateInjectMediaMetadata,
  uploadInjectMediaFiles,
  type InjectMedia,
  type PendingInjectMedia,
} from "@/lib/injectMedia";

import { useRoleContext } from "@/app/components/useRoleContext";
import useAutoRefresh from "@/app/components/useAutoRefresh";
import { Button } from "@/app/components/ui/button";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import ScenarioDetailsSection from "@/app/components/facilitator-scenarios/ScenarioDetailsSection";
import ScenarioInjectsSection from "@/app/components/facilitator-scenarios/ScenarioInjectsSection";
import ScenarioRulesSection from "@/app/components/facilitator-scenarios/ScenarioRulesSection";
import {
  RULE_PRESETS,
  RULE_TRIGGER_OPTIONS,
  asInt,
  errMessage,
  fmt,
  parseJsonConfig,
  presetRuleKey,
} from "@/app/components/facilitator-scenarios/scenarioEditorUi";

import { ArrowLeft, Save, Sparkles } from "lucide-react";

type PendingConfirm = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "default" | "destructive";
  onConfirm: () => Promise<void>;
};

function asNullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function FacilitatorScenarioEditorPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { loading: roleLoading, canFacilitate } = useRoleContext();
  const id = params?.id ?? "";
  const formId = useId();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [injects, setInjects] = useState<ScenarioInject[]>([]);
  const [rules, setRules] = useState<ScenarioRuleTemplate[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [timezone, setTimezone] = useState("");
  const [location, setLocation] = useState("");
  const [locationLat, setLocationLat] = useState("");
  const [locationLng, setLocationLng] = useState("");
  const [weather, setWeather] = useState("");
  const [situationType, setSituationType] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [injured, setInjured] = useState("0");
  const [fatalities, setFatalities] = useState("0");
  const [uninjured, setUninjured] = useState("0");
  const [unknown, setUnknown] = useState("0");
  const [passengerCount, setPassengerCount] = useState("0");
  const [crewCount, setCrewCount] = useState("0");
  const [cargoWeightKg, setCargoWeightKg] = useState("0");
  const [dangerousGoodsCount, setDangerousGoodsCount] = useState("0");
  const [liveAnimalsCount, setLiveAnimalsCount] = useState("0");

  const [niTitle, setNiTitle] = useState("");
  const [niBody, setNiBody] = useState("");
  const [niChannel, setNiChannel] = useState("inbox");
  const [niSeverity, setNiSeverity] = useState<string>("");
  const [niSenderName, setNiSenderName] = useState<string>("Facilitator");
  const [niSenderOrg, setNiSenderOrg] = useState<string>("Decisionary");
  const [niReleaseOffsetMinutes, setNiReleaseOffsetMinutes] = useState<string>("");
  const [niInjectKind, setNiInjectKind] = useState<NonNullable<Inject["inject_kind"]>>("operational");
  const [niSourceType, setNiSourceType] = useState<NonNullable<Inject["source_type"]>>("manual");
  const [niEntityScope, setNiEntityScope] = useState("");
  const [niRequiresDecision, setNiRequiresDecision] = useState(false);
  const [niDecisionTemplateKey, setNiDecisionTemplateKey] = useState("");
  const [niVisibilityScope, setNiVisibilityScope] = useState<"all" | "facilitator_only" | "role_specific">("all");
  const [niBranchKey, setNiBranchKey] = useState("");
  const [niMediaFiles, setNiMediaFiles] = useState<PendingInjectMedia[]>([]);

  const [openSiId, setOpenSiId] = useState<string | null>(null);
  const [newInjectOpen, setNewInjectOpen] = useState(false);
  const [openRuleId, setOpenRuleId] = useState<string | null>(null);
  const [newRuleOpen, setNewRuleOpen] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const [nrRuleKey, setNrRuleKey] = useState("");
  const [nrRuleName, setNrRuleName] = useState("");
  const [nrDescription, setNrDescription] = useState("");
  const [nrTriggerType, setNrTriggerType] = useState<(typeof RULE_TRIGGER_OPTIONS)[number]>("inject_released");
  const [nrTriggerConfig, setNrTriggerConfig] = useState('{\n  "inject_kind": "operational"\n}');
  const [nrConditionConfig, setNrConditionConfig] = useState("{}");
  const [nrEffectConfig, setNrEffectConfig] = useState('{\n  "create_consequence": true,\n  "severity": "medium"\n}');
  const [nrEnabled, setNrEnabled] = useState(true);

  const basicsTitleId = `${formId}-basics-title`;
  const basicsDescriptionId = `${formId}-basics-description`;
  const eventDateId = `${formId}-event-date`;
  const eventTimeId = `${formId}-event-time`;
  const eventTimezoneId = `${formId}-event-timezone`;
  const eventLocationId = `${formId}-event-location`;
  const eventLocationLatId = `${formId}-event-location-lat`;
  const eventLocationLngId = `${formId}-event-location-lng`;
  const eventWeatherId = `${formId}-event-weather`;
  const situationTypeId = `${formId}-situation-type`;
  const shortDescriptionId = `${formId}-short-description`;
  const injuredId = `${formId}-injured`;
  const fatalitiesId = `${formId}-fatalities`;
  const uninjuredId = `${formId}-uninjured`;
  const unknownId = `${formId}-unknown`;
  const passengerCountId = `${formId}-passenger-count`;
  const crewCountId = `${formId}-crew-count`;
  const cargoWeightKgId = `${formId}-cargo-weight-kg`;
  const dangerousGoodsCountId = `${formId}-dangerous-goods-count`;
  const liveAnimalsCountId = `${formId}-live-animals-count`;
  const newInjectPanelId = `${formId}-new-inject-panel`;
  const newRulePanelId = `${formId}-new-rule-panel`;
  const niTitleId = `${formId}-new-inject-title`;
  const niScheduledId = `${formId}-new-inject-scheduled`;
  const niChannelId = `${formId}-new-inject-channel`;
  const niKindId = `${formId}-new-inject-kind`;
  const niSeverityId = `${formId}-new-inject-severity`;
  const niSourceTypeId = `${formId}-new-inject-source-type`;
  const niSenderNameId = `${formId}-new-inject-sender-name`;
  const niSenderOrgId = `${formId}-new-inject-sender-org`;
  const niEntityScopeId = `${formId}-new-inject-entity-scope`;
  const niVisibilityId = `${formId}-new-inject-visibility`;
  const niDecisionTemplateKeyId = `${formId}-new-inject-decision-template-key`;
  const niBranchKeyId = `${formId}-new-inject-branch-key`;
  const niRequiresDecisionId = `${formId}-new-inject-requires-decision`;
  const niBodyId = `${formId}-new-inject-body`;
  const nrRuleKeyId = `${formId}-new-rule-key`;
  const nrRuleNameId = `${formId}-new-rule-name`;
  const nrDescriptionId = `${formId}-new-rule-description`;
  const nrTriggerTypeId = `${formId}-new-rule-trigger-type`;
  const nrEnabledId = `${formId}-new-rule-enabled`;
  const nrTriggerConfigId = `${formId}-new-rule-trigger-config`;
  const nrConditionConfigId = `${formId}-new-rule-condition-config`;
  const nrEffectConfigId = `${formId}-new-rule-effect-config`;

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

      setTitle(s?.title ?? "");
      setDescription(s?.description ?? "");
      setEventDate(s?.event_date ?? "");
      setEventTime(s?.event_time ?? "");
      setTimezone(s?.timezone ?? "");
      setLocation(s?.location ?? "");
      setLocationLat(s?.location_lat == null ? "" : String(s.location_lat));
      setLocationLng(s?.location_lng == null ? "" : String(s.location_lng));
      setWeather(s?.weather ?? "");
      setSituationType(s?.situation_type ?? "");
      setShortDescription(s?.short_description ?? "");
      setInjured(String(s?.injured ?? 0));
      setFatalities(String(s?.fatalities ?? 0));
      setUninjured(String(s?.uninjured ?? 0));
      setUnknown(String(s?.unknown ?? 0));
      setPassengerCount(String(s?.passenger_count ?? 0));
      setCrewCount(String(s?.crew_count ?? 0));
      setCargoWeightKg(String(s?.cargo_weight_kg ?? 0));
      setDangerousGoodsCount(String(s?.dangerous_goods_count ?? 0));
      setLiveAnimalsCount(String(s?.live_animals_count ?? 0));
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

  useAutoRefresh(
    async () => {
      await load();
    },
    { enabled: !roleLoading && canFacilitate && !saving, intervalMs: 30000 }
  );

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
      asNullableNumber(locationLat) !== (scenario.location_lat ?? null) ||
      asNullableNumber(locationLng) !== (scenario.location_lng ?? null) ||
      weather !== (scenario.weather ?? "") ||
      situationType !== (scenario.situation_type ?? "") ||
      shortDescription !== (scenario.short_description ?? "") ||
      asInt(injured) !== (scenario.injured ?? 0) ||
      asInt(fatalities) !== (scenario.fatalities ?? 0) ||
      asInt(uninjured) !== (scenario.uninjured ?? 0) ||
      asInt(unknown) !== (scenario.unknown ?? 0) ||
      asInt(passengerCount) !== (scenario.passenger_count ?? 0) ||
      asInt(crewCount) !== (scenario.crew_count ?? 0) ||
      asInt(cargoWeightKg) !== (scenario.cargo_weight_kg ?? 0) ||
      asInt(dangerousGoodsCount) !== (scenario.dangerous_goods_count ?? 0) ||
      asInt(liveAnimalsCount) !== (scenario.live_animals_count ?? 0)
    );
  }, [
    scenario,
    title,
    description,
    eventDate,
    eventTime,
    timezone,
    location,
    locationLat,
    locationLng,
    weather,
    situationType,
    shortDescription,
    injured,
    fatalities,
    uninjured,
    unknown,
    passengerCount,
    crewCount,
    cargoWeightKg,
    dangerousGoodsCount,
    liveAnimalsCount,
  ]);

  function clearNewInjectDraft() {
    setNiTitle("");
    setNiBody("");
    setNiChannel("inbox");
    setNiSeverity("");
    setNiSenderName("Facilitator");
    setNiSenderOrg("Decisionary");
    setNiReleaseOffsetMinutes("");
    setNiInjectKind("operational");
    setNiSourceType("manual");
    setNiEntityScope("");
    setNiRequiresDecision(false);
    setNiDecisionTemplateKey("");
    setNiVisibilityScope("all");
    setNiBranchKey("");
    setNiMediaFiles([]);
  }

  function clearNewRuleDraft() {
    setNrRuleKey("");
    setNrRuleName("");
    setNrDescription("");
    setNrTriggerType("inject_released");
    setNrTriggerConfig('{\n  "inject_kind": "operational"\n}');
    setNrConditionConfig("{}");
    setNrEffectConfig('{\n  "create_consequence": true,\n  "severity": "medium"\n}');
    setNrEnabled(true);
  }

  function parseReleaseOffsetMinutes(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

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
        location_lat: asNullableNumber(locationLat),
        location_lng: asNullableNumber(locationLng),
        weather: weather.trim() || null,
        situation_type: situationType.trim() || null,
        short_description: shortDescription.trim() || null,
        injured: asInt(injured),
        fatalities: asInt(fatalities),
        uninjured: asInt(uninjured),
        unknown: asInt(unknown),
        passenger_count: asInt(passengerCount),
        crew_count: asInt(crewCount),
        cargo_weight_kg: asInt(cargoWeightKg),
        dangerous_goods_count: asInt(dangerousGoodsCount),
        live_animals_count: asInt(liveAnimalsCount),
      };

      const updated = await updateScenario(id, patch);
      setScenario(updated);
      setTitle(updated.title ?? "");
      setDescription(updated.description ?? "");
      setEventDate(updated.event_date ?? "");
      setEventTime(updated.event_time ?? "");
      setTimezone(updated.timezone ?? "");
      setLocation(updated.location ?? "");
      setLocationLat(updated.location_lat == null ? "" : String(updated.location_lat));
      setLocationLng(updated.location_lng == null ? "" : String(updated.location_lng));
      setWeather(updated.weather ?? "");
      setSituationType(updated.situation_type ?? "");
      setShortDescription(updated.short_description ?? "");
      setInjured(String(updated.injured ?? 0));
      setFatalities(String(updated.fatalities ?? 0));
      setUninjured(String(updated.uninjured ?? 0));
      setUnknown(String(updated.unknown ?? 0));
      setPassengerCount(String(updated.passenger_count ?? 0));
      setCrewCount(String(updated.crew_count ?? 0));
      setCargoWeightKg(String(updated.cargo_weight_kg ?? 0));
      setDangerousGoodsCount(String(updated.dangerous_goods_count ?? 0));
      setLiveAnimalsCount(String(updated.live_animals_count ?? 0));
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
    let createdInjectId: string | null = null;

    try {
      const inject = await createInject({
        title: niTitle.trim(),
        body: niBody.trim(),
        channel: niChannel === "pulse" ? "pulse" : "inbox",
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
      createdInjectId = inject.id;

      if (niMediaFiles.length > 0) {
        await uploadInjectMediaFiles({
          injectId: inject.id,
          files: niMediaFiles,
          altTextBase: niTitle.trim(),
        });
      }

      await attachInjectToScenario({
        scenarioId: id,
        injectId: inject.id,
        scheduled_at: null,
        release_offset_minutes: parseReleaseOffsetMinutes(niReleaseOffsetMinutes),
      });

      clearNewInjectDraft();
      setNewInjectOpen(false);
      await load();
    } catch (e: unknown) {
      if (createdInjectId) {
        await supabase.from("injects").delete().eq("id", createdInjectId);
      }
      setError(errMessage(e, "Failed to create inject."));
    } finally {
      setBusyKey(null);
    }
  }

  async function onDetach(siId: string) {
    const scenarioInject = injects.find((item) => item.id === siId);
    setPendingConfirm({
      title: "Detach inject?",
      description: `This removes "${scenarioInject?.injects?.title ?? "Untitled inject"}" from this scenario, but keeps the inject in the library.`,
      confirmLabel: "Detach inject",
      onConfirm: () => detachNow(siId),
    });
  }

  async function detachNow(siId: string) {
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
    const scenarioInject = injects.find((item) => item.injects?.id === injectId || item.inject_id === injectId);
    setPendingConfirm({
      title: "Delete inject?",
      description: `This permanently deletes "${scenarioInject?.injects?.title ?? "Untitled inject"}" from the inject library and may affect other scenarios using it.`,
      confirmLabel: "Delete inject",
      tone: "destructive",
      onConfirm: () => deleteInjectNow(injectId),
    });
  }

  async function deleteInjectNow(injectId: string) {
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

  async function onUploadInjectMedia(injectId: string, files: File[]) {
    setBusyKey(`media:${injectId}`);
    setError(null);
    try {
      await uploadInjectMediaFiles({ injectId, files });
      await load();
    } catch (e: unknown) {
      setError(errMessage(e, "Failed to upload inject images."));
    } finally {
      setBusyKey(null);
    }
  }

  async function onDeleteInjectMedia(injectId: string, media: InjectMedia) {
    setBusyKey(`media:${injectId}`);
    setError(null);
    try {
      await deleteInjectMedia(media);
      await load();
    } catch (e: unknown) {
      setError(errMessage(e, "Failed to delete inject image."));
    } finally {
      setBusyKey(null);
    }
  }

  async function onUpdateInjectMediaAlt(injectId: string, media: InjectMedia, altText: string) {
    setBusyKey(`media:${injectId}`);
    setError(null);
    try {
      await updateInjectMediaMetadata(media.id, { alt_text: altText });
      await load();
    } catch (e: unknown) {
      setError(errMessage(e, "Failed to update image description."));
    } finally {
      setBusyKey(null);
    }
  }

  async function onReorderInjectMedia(injectId: string, fromId: string, toId: string) {
    const scenarioInject = injects.find((item) => item.inject_id === injectId || item.injects?.id === injectId);
    const media = [...(scenarioInject?.injects?.media ?? [])];
    const fromIndex = media.findIndex((item) => item.id === fromId);
    const toIndex = media.findIndex((item) => item.id === toId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

    setBusyKey(`media:${injectId}`);
    setError(null);
    try {
      const next = [...media];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      await reorderInjectMedia(injectId, next);
      await load();
    } catch (e: unknown) {
      setError(errMessage(e, "Failed to reorder images."));
    } finally {
      setBusyKey(null);
    }
  }

  async function onReschedule(siId: string, releaseOffsetMinutes: string) {
    setBusyKey(`sched:${siId}`);
    setError(null);
    try {
      await updateScenarioInject({
        id: siId,
        scheduled_at: null,
        release_offset_minutes: parseReleaseOffsetMinutes(releaseOffsetMinutes),
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

      clearNewRuleDraft();
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
    const rule = rules.find((item) => item.id === ruleId);
    setPendingConfirm({
      title: "Delete rule?",
      description: `This removes "${rule?.rule_name ?? "Untitled rule"}" from the scenario rule set. Existing session history will remain unchanged.`,
      confirmLabel: "Delete rule",
      tone: "destructive",
      onConfirm: () => deleteRuleTemplateNow(ruleId),
    });
  }

  async function deleteRuleTemplateNow(ruleId: string) {
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
      <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden">
        <div className="relative px-5 py-5 md:px-6 md:py-6">
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="ui-eyebrow">
                <Sparkles className="h-3.5 w-3.5" />
                Scenario editor
              </div>
              <div className="text-xs text-[color:var(--studio-muted2)]">
                Scenario • {id.slice(0, 8)} • Updated {fmt(scenario.updated_at)}
              </div>
              <h1 className="text-[28px] font-semibold tracking-tight truncate">{scenario.title ?? "Scenario"}</h1>
              <div className="max-w-[62ch] text-sm leading-7 text-[color:var(--studio-muted)]">
                Edit the scenario brief, shape the starting situation, and build the inject sequence that will drive the session.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => router.push("/facilitator/scenarios")} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
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
            <div className="notice notice-error" role="alert" aria-live="assertive">
              {error}
            </div>
          </div>
        ) : null}
      </div>

      <ScenarioDetailsSection
        basicsTitleId={basicsTitleId}
        basicsDescriptionId={basicsDescriptionId}
        eventDateId={eventDateId}
        eventTimeId={eventTimeId}
        eventTimezoneId={eventTimezoneId}
        eventLocationId={eventLocationId}
        eventLocationLatId={eventLocationLatId}
        eventLocationLngId={eventLocationLngId}
        eventWeatherId={eventWeatherId}
        situationTypeId={situationTypeId}
        shortDescriptionId={shortDescriptionId}
        injuredId={injuredId}
        fatalitiesId={fatalitiesId}
        uninjuredId={uninjuredId}
        unknownId={unknownId}
        passengerCountId={passengerCountId}
        crewCountId={crewCountId}
        cargoWeightKgId={cargoWeightKgId}
        dangerousGoodsCountId={dangerousGoodsCountId}
        liveAnimalsCountId={liveAnimalsCountId}
        title={title}
        setTitle={setTitle}
        description={description}
        setDescription={setDescription}
        eventDate={eventDate}
        setEventDate={setEventDate}
        eventTime={eventTime}
        setEventTime={setEventTime}
        timezone={timezone}
        setTimezone={setTimezone}
        location={location}
        setLocation={setLocation}
        locationLat={locationLat}
        setLocationLat={setLocationLat}
        locationLng={locationLng}
        setLocationLng={setLocationLng}
        weather={weather}
        setWeather={setWeather}
        situationType={situationType}
        setSituationType={setSituationType}
        shortDescription={shortDescription}
        setShortDescription={setShortDescription}
        injured={injured}
        setInjured={setInjured}
        fatalities={fatalities}
        setFatalities={setFatalities}
        uninjured={uninjured}
        setUninjured={setUninjured}
        unknown={unknown}
        setUnknown={setUnknown}
        passengerCount={passengerCount}
        setPassengerCount={setPassengerCount}
        crewCount={crewCount}
        setCrewCount={setCrewCount}
        cargoWeightKg={cargoWeightKg}
        setCargoWeightKg={setCargoWeightKg}
        dangerousGoodsCount={dangerousGoodsCount}
        setDangerousGoodsCount={setDangerousGoodsCount}
        liveAnimalsCount={liveAnimalsCount}
        setLiveAnimalsCount={setLiveAnimalsCount}
      />

      <ScenarioInjectsSection
        formId={formId}
        newInjectPanelId={newInjectPanelId}
        niTitleId={niTitleId}
        niScheduledId={niScheduledId}
        niChannelId={niChannelId}
        niKindId={niKindId}
        niSeverityId={niSeverityId}
        niSourceTypeId={niSourceTypeId}
        niSenderNameId={niSenderNameId}
        niSenderOrgId={niSenderOrgId}
        niEntityScopeId={niEntityScopeId}
        niVisibilityId={niVisibilityId}
        niDecisionTemplateKeyId={niDecisionTemplateKeyId}
        niBranchKeyId={niBranchKeyId}
        niRequiresDecisionId={niRequiresDecisionId}
        niBodyId={niBodyId}
        sortedInjects={sortedInjects}
        busyKey={busyKey}
        openSiId={openSiId}
        setOpenSiId={setOpenSiId}
        newInjectOpen={newInjectOpen}
        setNewInjectOpen={setNewInjectOpen}
        onCreateScenarioInject={onCreateScenarioInject}
        onDetach={onDetach}
        onDeleteInject={onDeleteInject}
        onUpdateInject={onUpdateInject}
        onUploadInjectMedia={onUploadInjectMedia}
        onDeleteInjectMedia={onDeleteInjectMedia}
        onUpdateInjectMediaAlt={onUpdateInjectMediaAlt}
        onReorderInjectMedia={onReorderInjectMedia}
        onReschedule={onReschedule}
        onMove={onMove}
        clearNewInjectDraft={clearNewInjectDraft}
        niTitle={niTitle}
        setNiTitle={setNiTitle}
        niBody={niBody}
        setNiBody={setNiBody}
        niChannel={niChannel}
        setNiChannel={setNiChannel}
        niSeverity={niSeverity}
        setNiSeverity={setNiSeverity}
        niSenderName={niSenderName}
        setNiSenderName={setNiSenderName}
        niSenderOrg={niSenderOrg}
        setNiSenderOrg={setNiSenderOrg}
        niReleaseOffsetMinutes={niReleaseOffsetMinutes}
        setNiReleaseOffsetMinutes={setNiReleaseOffsetMinutes}
        niInjectKind={niInjectKind}
        setNiInjectKind={setNiInjectKind}
        niSourceType={niSourceType}
        setNiSourceType={setNiSourceType}
        niEntityScope={niEntityScope}
        setNiEntityScope={setNiEntityScope}
        niRequiresDecision={niRequiresDecision}
        setNiRequiresDecision={setNiRequiresDecision}
        niDecisionTemplateKey={niDecisionTemplateKey}
        setNiDecisionTemplateKey={setNiDecisionTemplateKey}
        niVisibilityScope={niVisibilityScope}
        setNiVisibilityScope={setNiVisibilityScope}
        niBranchKey={niBranchKey}
        setNiBranchKey={setNiBranchKey}
        niMediaFiles={niMediaFiles}
        setNiMediaFiles={setNiMediaFiles}
      />

      <ScenarioRulesSection
        formId={formId}
        newRulePanelId={newRulePanelId}
        nrRuleKeyId={nrRuleKeyId}
        nrRuleNameId={nrRuleNameId}
        nrDescriptionId={nrDescriptionId}
        nrTriggerTypeId={nrTriggerTypeId}
        nrEnabledId={nrEnabledId}
        nrTriggerConfigId={nrTriggerConfigId}
        nrConditionConfigId={nrConditionConfigId}
        nrEffectConfigId={nrEffectConfigId}
        rules={rules}
        busyKey={busyKey}
        openRuleId={openRuleId}
        setOpenRuleId={setOpenRuleId}
        newRuleOpen={newRuleOpen}
        setNewRuleOpen={setNewRuleOpen}
        nrRuleKey={nrRuleKey}
        setNrRuleKey={setNrRuleKey}
        nrRuleName={nrRuleName}
        setNrRuleName={setNrRuleName}
        nrDescription={nrDescription}
        setNrDescription={setNrDescription}
        nrTriggerType={nrTriggerType}
        setNrTriggerType={setNrTriggerType}
        nrTriggerConfig={nrTriggerConfig}
        setNrTriggerConfig={setNrTriggerConfig}
        nrConditionConfig={nrConditionConfig}
        setNrConditionConfig={setNrConditionConfig}
        nrEffectConfig={nrEffectConfig}
        setNrEffectConfig={setNrEffectConfig}
        nrEnabled={nrEnabled}
        setNrEnabled={setNrEnabled}
        onCreateRuleTemplate={onCreateRuleTemplate}
        onUpdateRuleTemplate={onUpdateRuleTemplate}
        onDeleteRuleTemplate={onDeleteRuleTemplate}
        applyRulePreset={applyRulePreset}
        clearNewRuleDraft={clearNewRuleDraft}
        setError={setError}
      />

      <ConfirmDialog
        open={Boolean(pendingConfirm)}
        title={pendingConfirm?.title ?? ""}
        description={pendingConfirm?.description ?? ""}
        confirmLabel={pendingConfirm?.confirmLabel}
        tone={pendingConfirm?.tone}
        onOpenChange={(open) => {
          if (!open) setPendingConfirm(null);
        }}
        onConfirm={async () => {
          await pendingConfirm?.onConfirm();
        }}
      />
    </div>
  );
}
