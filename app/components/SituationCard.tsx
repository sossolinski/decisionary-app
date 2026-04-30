// app/components/SituationCard.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { SessionSituation } from "@/lib/sessions";
import type { Scenario } from "@/lib/scenarios";
import { supabase } from "@/lib/supabaseClient";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";

import {
  AlertTriangle,
  CalendarDays,
  Clock,
  MapPin,
  FileText,
  Users,
  Skull,
  UserCheck,
  HelpCircle,
  Pencil,
  Save,
  X,
} from "lucide-react";

function useMediaQuery(query: string) {
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

function safeText(v: unknown, fallback = "—") {
  const s = typeof v === "string" ? v.trim() : v;
  return s ? String(s) : fallback;
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString();
}

// accepts time-only like "12:27:39.831712" and returns "12:27"
function fmtTimeLoose(v: string | null | undefined) {
  if (!v) return "—";
  if (/^\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(v)) {
    const noMicros = v.includes(".") ? v.split(".")[0] : v;
    const parts = noMicros.split(":");
    if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
    return noMicros;
  }
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return String(v);
}

function numOr(prev: number, raw: string) {
  const t = raw.trim();
  if (t === "") return prev;
  const n = Number(t);
  if (!Number.isFinite(n)) return prev;
  return Math.max(0, Math.floor(n));
}

function errMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

function formatProfileLabel(profile: { full_name: string | null; email: string | null } | null, fallbackId: string | null) {
  if (profile?.full_name?.trim()) return profile.full_name.trim();
  if (profile?.email?.trim()) {
    const local = profile.email.split("@")[0] ?? "";
    return local.trim() || profile.email;
  }
  return fallbackId;
}

/**
 * Converts IANA tz ("Europe/Warsaw") to "UTC+01:00" / "UTC+02:00"
 * Uses event_date (if provided) to get correct DST offset.
 */
function tzToUtcOffsetLabel(timeZone: string | null | undefined, eventDateISO?: string | null) {
  const tz = (timeZone ?? "").trim();
  if (!tz || tz === "—") return "—";

  // If user already stored "UTC+1" etc, keep as is (normalize a bit)
  if (
    /^utc\s*[+-]?\d{1,2}(:?\d{2})?$/i.test(tz) ||
    /^gmt\s*[+-]?\d{1,2}(:?\d{2})?$/i.test(tz)
  ) {
    return tz.toUpperCase().replace("GMT", "UTC").replace(/\s+/g, "");
  }

  const base = eventDateISO ? new Date(eventDateISO) : new Date();
  const d = Number.isNaN(base.getTime()) ? new Date() : base;

  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const parts = dtf.formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";

    const y = Number(get("year"));
    const m = Number(get("month"));
    const da = Number(get("day"));
    const hh = Number(get("hour"));
    const mm = Number(get("minute"));
    const ss = Number(get("second"));

    // as-if local time in that tz, but interpreted as UTC -> lets us derive offset
    const asUTC = Date.UTC(y, m - 1, da, hh, mm, ss);
    const offsetMin = Math.round((asUTC - d.getTime()) / 60000);

    const sign = offsetMin >= 0 ? "+" : "-";
    const abs = Math.abs(offsetMin);
    const oh = String(Math.floor(abs / 60)).padStart(2, "0");
    const om = String(abs % 60).padStart(2, "0");

    return `UTC${sign}${oh}:${om}`;
  } catch {
    return tz;
  }
}

function SmallStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null | undefined;
}) {
  return (
    <div className="rounded-[14px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-3 py-2.5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-[color:var(--studio-muted2)]">
        <span className="opacity-80">{icon}</span>
        <span className="font-semibold">{label}</span>
      </div>
      <div className="mt-1.5 text-[1.15rem] font-semibold leading-none text-[color:var(--studio-ink)]">
        {typeof value === "number" ? value : "—"}
      </div>
    </div>
  );
}

function FieldRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[14px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-3 py-2.5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-[color:var(--studio-muted2)]">
        <span className="opacity-80">{icon}</span>
        <span className="font-semibold">{label}</span>
      </div>
      <div className="mt-1.5 text-sm font-semibold leading-5 text-[color:var(--studio-ink)]">{value}</div>
    </div>
  );
}

export default function SituationCard({
  scenario,
  situation,
  onUpdateCasualties,
}: {
  scenario?: Scenario | null;
  situation?: SessionSituation | null;
  onUpdateCasualties?: (p: {
    injured: number;
    fatalities: number;
    uninjured: number;
    unknown: number;
  }) => Promise<void> | void;
}) {
  const isMobile = useMediaQuery("(max-width: 980px)");

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [updatedByLabel, setUpdatedByLabel] = useState<string | null>(null);

  const [injured, setInjured] = useState("");
  const [fatalities, setFatalities] = useState("");
  const [uninjured, setUninjured] = useState("");
  const [unknown, setUnknown] = useState("");

  useEffect(() => {
    if (situation) {
      setInjured(String(situation.injured ?? 0));
      setFatalities(String(situation.fatalities ?? 0));
      setUninjured(String(situation.uninjured ?? 0));
      setUnknown(String(situation.unknown ?? 0));
      return;
    }
    setInjured(String(scenario?.injured ?? 0));
    setFatalities(String(scenario?.fatalities ?? 0));
    setUninjured(String(scenario?.uninjured ?? 0));
    setUnknown(String(scenario?.unknown ?? 0));
  }, [
    situation,
    situation?.updated_at,
    situation?.injured,
    situation?.fatalities,
    situation?.uninjured,
    situation?.unknown,
    scenario?.id,
    scenario?.injured,
    scenario?.fatalities,
    scenario?.uninjured,
    scenario?.unknown,
  ]);

  useEffect(() => {
    const updatedBy = situation?.updated_by?.trim() ?? null;
    if (!updatedBy) {
      setUpdatedByLabel(null);
      return;
    }

    let alive = true;

    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name,email")
        .eq("user_id", updatedBy)
        .maybeSingle();

      if (!alive) return;
      if (error) {
        setUpdatedByLabel(updatedBy);
        return;
      }

      setUpdatedByLabel(
        formatProfileLabel(
          (data as { full_name: string | null; email: string | null } | null) ?? null,
          updatedBy
        )
      );
    })();

    return () => {
      alive = false;
    };
  }, [situation?.updated_by]);

  const hasScenarioFallback = useMemo(() => {
    return Boolean(
      scenario &&
        (scenario.situation_type ||
          scenario.short_description ||
          scenario.location ||
          typeof scenario.injured === "number" ||
          typeof scenario.fatalities === "number" ||
          typeof scenario.uninjured === "number" ||
          typeof scenario.unknown === "number" ||
          scenario.event_date ||
          scenario.event_time ||
          scenario.timezone)
    );
  }, [scenario]);

  if (!situation && !hasScenarioFallback) {
    return <div className="text-sm text-[color:var(--studio-muted2)]">Loading…</div>;
  }

  const s = situation;

  const situationType = safeText(scenario?.situation_type ?? s?.situation_type);
  const shortDescription = safeText(scenario?.short_description ?? s?.short_description, " ");

  const dateISO = (scenario?.event_date ?? s?.event_date) ?? null;
  const date = fmtDate(dateISO);
  const time = fmtTimeLoose(scenario?.event_time ?? s?.event_time);

  const tzRaw = scenario?.timezone ?? s?.timezone;
  const tz = tzToUtcOffsetLabel(tzRaw, dateISO);

  const location = safeText(scenario?.location ?? s?.location);

  const injuredVal = typeof s?.injured === "number" ? s?.injured : scenario?.injured;
  const fatalitiesVal = typeof s?.fatalities === "number" ? s?.fatalities : scenario?.fatalities;
  const uninjuredVal = typeof s?.uninjured === "number" ? s?.uninjured : scenario?.uninjured;
  const unknownVal = typeof s?.unknown === "number" ? s?.unknown : scenario?.unknown;

  const updatedAt = s?.updated_at ? new Date(s.updated_at).toLocaleString() : null;
  const updatedBy = updatedByLabel ?? (s?.updated_by ? String(s.updated_by) : null);

  async function onSave() {
    if (!onUpdateCasualties) return;

    setErr(null);
    setSaving(true);

    try {
      const baseInjured = typeof injuredVal === "number" ? injuredVal : 0;
      const baseFatalities = typeof fatalitiesVal === "number" ? fatalitiesVal : 0;
      const baseUninjured = typeof uninjuredVal === "number" ? uninjuredVal : 0;
      const baseUnknown = typeof unknownVal === "number" ? unknownVal : 0;

      const payload = {
        injured: numOr(baseInjured, injured),
        fatalities: numOr(baseFatalities, fatalities),
        uninjured: numOr(baseUninjured, uninjured),
        unknown: numOr(baseUnknown, unknown),
      };

      await onUpdateCasualties(payload);
      setEditOpen(false);
    } catch (e: unknown) {
      setErr(errMessage(e, "Update failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={isMobile ? "grid grid-cols-1 gap-4" : "grid grid-cols-12 gap-4"}>
      {/* LEFT */}
      <div className={isMobile ? "" : "col-span-8"}>
        <Card className="border border-[var(--studio-border)] shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 opacity-80" />
              Situation
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <FieldRow
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Situation type"
              value={situationType}
            />

            <FieldRow
              icon={<MapPin className="h-4 w-4" />}
              label="Location"
              value={location}
            />

            <div className={isMobile ? "grid grid-cols-1 gap-3" : "grid grid-cols-3 gap-2.5"}>
              <FieldRow
                icon={<CalendarDays className="h-4 w-4" />}
                label="Date"
                value={date}
              />
              <FieldRow
                icon={<Clock className="h-4 w-4" />}
                label="Time"
                value={time}
              />
              <FieldRow
                icon={<Clock className="h-4 w-4" />}
                label="Timezone"
                value={tz}
              />
            </div>

            <div className="ui-subtle-panel px-3.5 py-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-[color:var(--studio-muted2)]">
                <FileText className="h-4 w-4 opacity-80" />
                <span className="font-semibold">Short description</span>
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--studio-ink)]">{shortDescription}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT */}
      <div className={isMobile ? "" : "col-span-4"}>
        <Card className="border border-[var(--studio-border)] shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 opacity-80" />
              Casualties
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <SmallStat
                icon={<AlertTriangle className="h-4 w-4" />}
                label="Injured"
                value={injuredVal ?? null}
              />
              <SmallStat
                icon={<Skull className="h-4 w-4" />}
                label="Fatalities"
                value={fatalitiesVal ?? null}
              />
              <SmallStat
                icon={<UserCheck className="h-4 w-4" />}
                label="Uninjured"
                value={uninjuredVal ?? null}
              />
              <SmallStat
                icon={<HelpCircle className="h-4 w-4" />}
                label="Unknown"
                value={unknownVal ?? null}
              />
            </div>

            {onUpdateCasualties ? (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={() => setEditOpen((v) => !v)}
                  disabled={saving}
                  className="gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  {editOpen ? "Close" : "Update counts"}
                </Button>

                {s && (updatedAt || updatedBy) ? (
                  <div className="text-xs leading-5 text-[color:var(--studio-muted2)] text-right">
                    {updatedAt ? `Last updated: ${updatedAt}` : ""}
                    {updatedAt && updatedBy ? " · " : ""}
                    {updatedBy ? `By: ${updatedBy}` : ""}
                  </div>
                ) : null}
              </div>
            ) : null}

            {editOpen ? (
              <div className="space-y-3 rounded-[16px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] p-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-semibold text-[color:var(--studio-muted2)] mb-1">
                      Injured
                    </div>
                    <Input
                      value={injured}
                      onChange={(e) => setInjured(e.target.value)}
                      placeholder="e.g. 2"
                    />
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-[color:var(--studio-muted2)] mb-1">
                      Fatalities
                    </div>
                    <Input
                      value={fatalities}
                      onChange={(e) => setFatalities(e.target.value)}
                      placeholder="e.g. 0"
                    />
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-[color:var(--studio-muted2)] mb-1">
                      Uninjured
                    </div>
                    <Input
                      value={uninjured}
                      onChange={(e) => setUninjured(e.target.value)}
                      placeholder="e.g. 20"
                    />
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-[color:var(--studio-muted2)] mb-1">
                      Unknown
                    </div>
                    <Input
                      value={unknown}
                      onChange={(e) => setUnknown(e.target.value)}
                      placeholder="e.g. 1"
                    />
                  </div>
                </div>

                {err ? (
                  <div className="notice notice-error px-3 py-2 text-xs font-semibold">
                    {err}
                  </div>
                ) : null}

                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => setEditOpen(false)} disabled={saving} className="gap-2">
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                  <Button onClick={onSave} disabled={saving} className="gap-2">
                    <Save className="h-4 w-4" />
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
