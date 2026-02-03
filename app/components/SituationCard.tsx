// app/components/SituationCard.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { SessionSituation } from "@/lib/sessions";
import type { Scenario } from "@/lib/scenarios";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";

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

function safeText(v: any, fallback = "—") {
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

/**
 * Converts IANA tz ("Europe/Warsaw") to "UTC+01:00" / "UTC+02:00"
 * Uses event_date (if provided) to get correct DST offset.
 */
function tzToUtcOffsetLabel(
  timeZone: string | null | undefined,
  eventDateISO?: string | null
) {
  const tz = (timeZone ?? "").trim();
  if (!tz || tz === "—") return "—";

  // If user already stored "UTC+1" etc, keep as is (normalize a bit)
  if (
    /^utc\s*[+-]?\d{1,2}(:?\d{2})?$/i.test(tz) ||
    /^gmt\s*[+-]?\d{1,2}(:?\d{2})?$/i.test(tz)
  ) {
    return tz.toUpperCase().replace("GMT", "UTC").replace(/\s+/g, "");
  }

  // Compute offset via Intl for the given timezone at the event date (or now)
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
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "00";

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
    // fallback: show IANA if we can't compute
    return tz;
  }
}

function SmallStat({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card px-3 py-2">
      <div className="text-[11px] font-semibold text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-bold">
        {typeof value === "number" ? value : "—"}
      </div>
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
  }, [situation?.updated_at, scenario?.id]);

  const hasScenarioFallback = useMemo(() => {
    return (
      !!scenario &&
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
    return (
      <div className="rounded-[var(--radius)] border border-border bg-card p-3 text-xs font-semibold text-muted-foreground">
        Loading…
      </div>
    );
  }

  const s = situation;

  const situationType = safeText(scenario?.situation_type ?? s?.situation_type);

  // Single description (no duplication)
  const shortDescription = safeText(
    scenario?.short_description ?? s?.short_description,
    " "
  );

  const dateISO = (scenario?.event_date ?? s?.event_date) ?? null;
  const date = fmtDate(dateISO);
  const time = fmtTimeLoose(scenario?.event_time ?? s?.event_time);

  const tzRaw = scenario?.timezone ?? s?.timezone;
  const tz = tzToUtcOffsetLabel(tzRaw, dateISO);

  const location = safeText(scenario?.location ?? s?.location);

  const injuredVal =
    typeof s?.injured === "number" ? s?.injured : scenario?.injured;
  const fatalitiesVal =
    typeof s?.fatalities === "number" ? s?.fatalities : scenario?.fatalities;
  const uninjuredVal =
    typeof s?.uninjured === "number" ? s?.uninjured : scenario?.uninjured;
  const unknownVal =
    typeof s?.unknown === "number" ? s?.unknown : scenario?.unknown;

  const updatedAt = s?.updated_at
    ? new Date(s.updated_at).toLocaleString()
    : null;
  const updatedBy = s?.updated_by ? String(s.updated_by) : null;

  async function onSave() {
    if (!onUpdateCasualties) return;
    setErr(null);
    setSaving(true);

    try {
      const baseInjured = typeof injuredVal === "number" ? injuredVal : 0;
      const baseFatalities =
        typeof fatalitiesVal === "number" ? fatalitiesVal : 0;
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
    } catch (e: any) {
      setErr(e?.message ?? "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
      {/* LEFT: Situation */}
      <Card className="surface shadow-soft border border-[var(--studio-border)]">
        <CardHeader>
          <CardTitle>Situation</CardTitle>
          <CardDescription>Classification and summary</CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-muted-foreground">
                Situation type
              </div>
              <div className="rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-sm font-semibold">
                {situationType}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-muted-foreground">
                Location
              </div>
              <div className="rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-sm font-semibold">
                {location}
              </div>
            </div>
          </div>

          {/* Event mini row */}
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-[var(--radius)] border border-border bg-secondary/20 px-3 py-2">
              <div className="text-[11px] font-semibold text-muted-foreground">
                Date
              </div>
              <div className="mt-0.5 text-sm font-bold">{date}</div>
            </div>
            <div className="rounded-[var(--radius)] border border-border bg-secondary/20 px-3 py-2">
              <div className="text-[11px] font-semibold text-muted-foreground">
                Time
              </div>
              <div className="mt-0.5 text-sm font-bold">{time}</div>
            </div>
            <div className="rounded-[var(--radius)] border border-border bg-secondary/20 px-3 py-2">
              <div className="text-[11px] font-semibold text-muted-foreground">
                Timezone
              </div>
              <div className="mt-0.5 text-sm font-bold">{tz}</div>
            </div>
          </div>

          {/* SINGLE description */}
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-muted-foreground">
              Short description
            </div>
            <div className="whitespace-pre-wrap rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-sm leading-relaxed">
              {shortDescription}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RIGHT: Casualties */}
      <Card className="surface shadow-soft border border-[var(--studio-border)]">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>Casualties</CardTitle>
            <CardDescription>Current numbers</CardDescription>
          </div>

          {onUpdateCasualties ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditOpen((v) => !v)}
              disabled={saving}
            >
              {editOpen ? "Close" : "Edit"}
            </Button>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-3">
          <div
            className={["grid gap-2", isMobile ? "grid-cols-2" : "grid-cols-2"].join(
              " "
            )}
          >
            <SmallStat label="Injured" value={injuredVal as any} />
            <SmallStat label="Fatalities" value={fatalitiesVal as any} />
            <SmallStat label="Uninjured" value={uninjuredVal as any} />
            <SmallStat label="Unknown" value={unknownVal as any} />
          </div>

          {editOpen ? (
            <div className="space-y-2 rounded-[var(--radius)] border border-border bg-secondary/20 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-muted-foreground">
                    Injured
                  </div>
                  <Input
                    value={injured}
                    onChange={(e) => setInjured(e.target.value)}
                    placeholder="e.g. 2"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-muted-foreground">
                    Fatalities
                  </div>
                  <Input
                    value={fatalities}
                    onChange={(e) => setFatalities(e.target.value)}
                    placeholder="e.g. 0"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-muted-foreground">
                    Uninjured
                  </div>
                  <Input
                    value={uninjured}
                    onChange={(e) => setUninjured(e.target.value)}
                    placeholder="e.g. 20"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-muted-foreground">
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
                <div className="rounded-[var(--radius)] border border-border bg-destructive/5 p-2 text-xs font-semibold text-destructive">
                  {err}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onSave}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          ) : null}

          {s && (updatedAt || updatedBy) ? (
            <div className="text-[11px] text-muted-foreground">
              {updatedAt ? `Last updated: ${updatedAt}` : ""}
              {updatedAt && updatedBy ? " · " : ""}
              {updatedBy ? `By: ${updatedBy}` : ""}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
