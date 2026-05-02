// app/components/SituationCard.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { SessionSituation } from "@/lib/sessions";
import type { Scenario } from "@/lib/scenarios";
import { supabase } from "@/lib/supabaseClient";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

import {
  AlertTriangle,
  Archive,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudRain,
  HelpCircle,
  Map,
  MapPin,
  Plane,
  Skull,
  Users,
  UserCheck,
  Pencil,
  Save,
  X,
} from "lucide-react";

function safeText(v: unknown, fallback = "—") {
  const s = typeof v === "string" ? v.trim() : v;
  return s ? String(s) : fallback;
}

function sentenceCase(v: string) {
  const text = v.trim();
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function splitLocationAndWeather(raw: string) {
  const location = raw.trim();
  if (!location || location === "—") return { location, weather: null as string | null };

  const weatherPatterns = [
    /\s+in\s+(low ceiling(?:\s+and\s+rain)?|deteriorating weather|heavy rain|rain|snow|fog|low visibility|thunderstorms?)$/i,
    /\s+(?:with|during)\s+(low ceiling(?:\s+and\s+rain)?|deteriorating weather|heavy rain|rain|snow|fog|low visibility|thunderstorms?)$/i,
  ];

  for (const pattern of weatherPatterns) {
    const match = location.match(pattern);
    if (!match || typeof match.index !== "number" || !match[1]) continue;

    const cleanLocation = location.slice(0, match.index).trim();
    if (!cleanLocation) continue;

    return {
      location: cleanLocation,
      weather: sentenceCase(match[1]),
    };
  }

  return { location, weather: null as string | null };
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
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

function fmtTimestamp(v: string | null | undefined) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);

  const date = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
  const time24 = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);

  return `${date}, ${time24}`;
}

function numOr(prev: number, raw: string) {
  const t = raw.trim();
  if (t === "") return prev;
  const n = Number(t);
  if (!Number.isFinite(n)) return prev;
  return Math.max(0, Math.floor(n));
}

function errMessage(e: unknown, fallback: string) {
  if (e instanceof Error) return e.message;
  if (typeof e === "string" && e.trim()) return e;
  if (e && typeof e === "object") {
    const maybe = e as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [maybe.message, maybe.details, maybe.hint, maybe.code]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .map((part) => part.trim());
    if (parts.length > 0) return parts.join(" · ");
  }
  return fallback;
}

function tileForLatLng(lat: number, lng: number, zoom: number) {
  const latRad = (lat * Math.PI) / 180;
  const scale = 2 ** zoom;
  return {
    x: Math.floor(((lng + 180) / 360) * scale),
    y: Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale),
  };
}

function LocationMap({
  lat,
  lng,
  label,
}: {
  lat: number | null | undefined;
  lng: number | null | undefined;
  label: string;
}) {
  const hasCoords = typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng);
  const osmHref = hasCoords
    ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=12/${lat}/${lng}`
    : `https://www.openstreetmap.org/search?query=${encodeURIComponent(label)}`;

  if (!hasCoords) {
    return (
      <a
        href={osmHref}
        target="_blank"
        rel="noreferrer"
        className="mt-1.5 flex min-h-0 flex-1 items-center justify-center rounded-[8px] border border-dashed border-[var(--studio-border)] bg-[hsl(var(--card))] text-xs font-medium text-[color:var(--studio-muted2)]"
      >
        Open location in OSM
      </a>
    );
  }

  const zoom = 11;
  const tile = tileForLatLng(lat, lng, zoom);
  const tileUrl = `https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`;

  return (
    <a
      href={osmHref}
      target="_blank"
      rel="noreferrer"
      className="relative mt-1.5 block min-h-0 flex-1 overflow-hidden rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--card))]"
    >
      <span
        className="absolute inset-0 bg-cover bg-center opacity-80 grayscale dark:opacity-55"
        style={{ backgroundImage: `url("${tileUrl}")` }}
        aria-hidden="true"
      />
      <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.35)]" />
      <span className="absolute bottom-1 right-1 rounded bg-[hsl(var(--background))]/90 px-1.5 py-0.5 text-[9px] font-medium text-[color:var(--studio-muted2)]">
        OSM
      </span>
    </a>
  );
}

function CompactMetric({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "warning" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-500/35 text-red-700 dark:text-red-200"
      : tone === "warning"
        ? "border-amber-500/35 text-amber-800 dark:text-amber-200"
        : "border-[var(--studio-border)] text-[color:var(--studio-ink)]";

  return (
    <div className={`min-h-[58px] rounded-[8px] border bg-[hsl(var(--background))] px-2.5 py-2 ${toneClass}`}>
      <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] opacity-65 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:stroke-[1.8]">
        {icon ? <span className="shrink-0 opacity-80">{icon}</span> : null}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-[1.55rem] font-semibold leading-none">
        {value}
      </div>
    </div>
  );
}

function DetailLine({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--background))] px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--studio-muted2)] [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:stroke-[1.8]">
        {icon ? <span className="shrink-0 opacity-75">{icon}</span> : null}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 truncate text-sm font-semibold leading-none text-[color:var(--studio-ink)]">
        {value}
      </div>
    </div>
  );
}

function EventTimeCard({ date, time }: { date: string; time: string }) {
  return (
    <div className="min-h-[58px] min-w-0 rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--background))] px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--studio-muted2)]">
        <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-75" />
        <span className="truncate">Event time</span>
      </div>
      <div className="mt-1 flex min-w-0 items-baseline gap-2">
        <span className="text-[1.35rem] font-semibold leading-none text-[color:var(--studio-ink)]">{time}</span>
        <span className="truncate text-xs font-semibold text-[color:var(--studio-muted2)]">{date}</span>
      </div>
    </div>
  );
}

function parseUtcOffsetMinutes(label: string) {
  const match = label.match(/^UTC([+-])(\d{1,2})(?::?(\d{2}))?$/i);
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return sign * (hours * 60 + minutes);
}

function TimezoneMiniMap({ timezone }: { timezone: string }) {
  const offsetMinutes = parseUtcOffsetMinutes(timezone);
  const offsetHours = offsetMinutes === null ? null : offsetMinutes / 60;
  const left = offsetHours === null ? 50 : Math.min(100, Math.max(0, ((offsetHours + 12) / 24) * 100));

  return (
    <div
      className="relative h-8 w-[146px] shrink-0 overflow-hidden rounded-[7px] border border-[var(--studio-border)] bg-[hsl(var(--card))]"
      aria-label={`Timezone map for ${timezone}`}
    >
      <div className="absolute inset-0 opacity-70">
        {Array.from({ length: 13 }).map((_, index) => (
          <span
            key={index}
            className="absolute top-0 h-full border-l border-[color:var(--studio-muted2)]/20"
            style={{ left: `${(index / 12) * 100}%` }}
          />
        ))}
      </div>
      <div className="absolute left-[9%] top-[10px] h-2.5 w-8 rounded-full bg-[color:var(--studio-muted2)]/20" />
      <div className="absolute left-[38%] top-[8px] h-3 w-10 rounded-full bg-[color:var(--studio-muted2)]/20" />
      <div className="absolute left-[66%] top-[10px] h-2.5 w-10 rounded-full bg-[color:var(--studio-muted2)]/20" />
      <div
        className="absolute top-0 h-full w-[7%] -translate-x-1/2 border-x border-sky-300/45 bg-sky-400/16"
        style={{ left: `${left}%` }}
      />
      <div
        className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-sky-300 shadow-[0_0_0_3px_rgba(125,211,252,0.16)]"
        style={{ left: `${left}%` }}
      />
      <div className="absolute bottom-0.5 left-1 text-[7px] font-semibold leading-none text-[color:var(--studio-muted2)]/70">-12</div>
      <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[7px] font-semibold leading-none text-[color:var(--studio-muted2)]/70">UTC</div>
      <div className="absolute bottom-0.5 right-1 text-[7px] font-semibold leading-none text-[color:var(--studio-muted2)]/70">+12</div>
    </div>
  );
}

function TimezoneCard({ timezone }: { timezone: string }) {
  return (
    <div className="min-h-[58px] min-w-0 rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--background))] px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--studio-muted2)]">
        <Clock className="h-3.5 w-3.5 shrink-0 opacity-75" />
        <span className="truncate">Timezone</span>
      </div>
      <div className="mt-1 flex min-w-0 items-center justify-between gap-3">
        <div className="truncate text-[1.2rem] font-semibold leading-none text-[color:var(--studio-ink)]">
          {timezone}
        </div>
        <TimezoneMiniMap timezone={timezone} />
      </div>
    </div>
  );
}

function inferLocationCoords(location: string, timezone: string | null | undefined) {
  const haystack = `${location} ${timezone ?? ""}`.toLowerCase();
  if (haystack.includes("katowice") || haystack.includes("epkt")) return { lat: 50.4743, lng: 19.08 };
  if (haystack.includes("heathrow") || haystack.includes("london")) return { lat: 51.47, lng: -0.4543 };
  if (haystack.includes("paris") || haystack.includes("europe/paris") || haystack.includes("major european airport")) {
    return { lat: 49.0097, lng: 2.5479 };
  }
  return { lat: null, lng: null };
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

function MicroStat({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null | undefined;
  tone?: "neutral" | "warning";
}) {
  return (
    <div
      className={[
        "min-w-0 rounded-[8px] border bg-[hsl(var(--background))] px-2.5 py-2",
        tone === "warning" ? "border-amber-500/35 text-amber-800 dark:text-amber-200" : "border-[var(--studio-border)] text-[color:var(--studio-ink)]",
      ].join(" ")}
    >
      <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] opacity-70 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:stroke-[1.8]">
        <span className="shrink-0 opacity-80">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-sm font-semibold leading-none">
        {typeof value === "number" ? value : "—"}
      </div>
    </div>
  );
}

export default function SituationCard({
  scenario,
  situation,
  onUpdateCasualties,
  onUpdateManifest,
}: {
  scenario?: Scenario | null;
  situation?: SessionSituation | null;
  onUpdateCasualties?: (p: {
    injured: number;
    fatalities: number;
    uninjured: number;
    unknown: number;
  }) => Promise<void> | void;
  onUpdateManifest?: (p: {
    passengerCount: number;
    crewCount: number;
    cargoWeightKg: number;
    dangerousGoodsCount: number;
    liveAnimalsCount: number;
  }) => Promise<void> | void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [manifestEditOpen, setManifestEditOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [updatedByLabel, setUpdatedByLabel] = useState<string | null>(null);

  const [injured, setInjured] = useState("");
  const [fatalities, setFatalities] = useState("");
  const [uninjured, setUninjured] = useState("");
  const [unknown, setUnknown] = useState("");
  const [passengerCount, setPassengerCount] = useState("");
  const [crewCount, setCrewCount] = useState("");
  const [cargoWeightKg, setCargoWeightKg] = useState("");
  const [dangerousGoodsCount, setDangerousGoodsCount] = useState("");
  const [liveAnimalsCount, setLiveAnimalsCount] = useState("");

  useEffect(() => {
    if (situation) {
      setInjured(String(situation.injured ?? 0));
      setFatalities(String(situation.fatalities ?? 0));
      setUninjured(String(situation.uninjured ?? 0));
      setUnknown(String(situation.unknown ?? 0));
      setPassengerCount(String(situation.passenger_count ?? 0));
      setCrewCount(String(situation.crew_count ?? 0));
      setCargoWeightKg(String(situation.cargo_weight_kg ?? 0));
      setDangerousGoodsCount(String(situation.dangerous_goods_count ?? 0));
      setLiveAnimalsCount(String(situation.live_animals_count ?? 0));
      return;
    }
    setInjured(String(scenario?.injured ?? 0));
    setFatalities(String(scenario?.fatalities ?? 0));
    setUninjured(String(scenario?.uninjured ?? 0));
    setUnknown(String(scenario?.unknown ?? 0));
    setPassengerCount(String(scenario?.passenger_count ?? 0));
    setCrewCount(String(scenario?.crew_count ?? 0));
    setCargoWeightKg(String(scenario?.cargo_weight_kg ?? 0));
    setDangerousGoodsCount(String(scenario?.dangerous_goods_count ?? 0));
    setLiveAnimalsCount(String(scenario?.live_animals_count ?? 0));
  }, [
    situation,
    situation?.updated_at,
    situation?.injured,
    situation?.fatalities,
    situation?.uninjured,
    situation?.unknown,
    situation?.passenger_count,
    situation?.crew_count,
    situation?.cargo_weight_kg,
    situation?.dangerous_goods_count,
    situation?.live_animals_count,
    scenario?.id,
    scenario?.injured,
    scenario?.fatalities,
    scenario?.uninjured,
    scenario?.unknown,
    scenario?.passenger_count,
    scenario?.crew_count,
    scenario?.cargo_weight_kg,
    scenario?.dangerous_goods_count,
    scenario?.live_animals_count,
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
          scenario.weather ||
          typeof scenario.injured === "number" ||
          typeof scenario.fatalities === "number" ||
          typeof scenario.uninjured === "number" ||
          typeof scenario.unknown === "number" ||
          typeof scenario.passenger_count === "number" ||
          typeof scenario.crew_count === "number" ||
          typeof scenario.cargo_weight_kg === "number" ||
          typeof scenario.dangerous_goods_count === "number" ||
          typeof scenario.live_animals_count === "number" ||
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

  const rawLocation = safeText(scenario?.location ?? s?.location);
  const splitLocation = splitLocationAndWeather(rawLocation);
  const location = splitLocation.location;
  const weather = safeText(scenario?.weather ?? s?.weather, splitLocation.weather ?? "");
  const inferredCoords = inferLocationCoords(rawLocation, tzRaw);
  const locationLat = typeof s?.location_lat === "number" ? s.location_lat : (scenario?.location_lat ?? inferredCoords.lat);
  const locationLng = typeof s?.location_lng === "number" ? s.location_lng : (scenario?.location_lng ?? inferredCoords.lng);

  const injuredVal = typeof s?.injured === "number" ? s?.injured : scenario?.injured;
  const fatalitiesVal = typeof s?.fatalities === "number" ? s?.fatalities : scenario?.fatalities;
  const uninjuredVal = typeof s?.uninjured === "number" ? s?.uninjured : scenario?.uninjured;
  const unknownVal = typeof s?.unknown === "number" ? s?.unknown : scenario?.unknown;
  const passengerCountVal =
    typeof s?.passenger_count === "number" ? s?.passenger_count : scenario?.passenger_count;
  const crewCountVal = typeof s?.crew_count === "number" ? s?.crew_count : scenario?.crew_count;
  const cargoWeightKgVal =
    typeof s?.cargo_weight_kg === "number" ? s?.cargo_weight_kg : scenario?.cargo_weight_kg;
  const dangerousGoodsCountVal =
    typeof s?.dangerous_goods_count === "number" ? s?.dangerous_goods_count : scenario?.dangerous_goods_count;
  const liveAnimalsCountVal =
    typeof s?.live_animals_count === "number" ? s?.live_animals_count : scenario?.live_animals_count;
  const soulsOnBoard =
    typeof passengerCountVal === "number" || typeof crewCountVal === "number"
      ? (passengerCountVal ?? 0) + (crewCountVal ?? 0)
      : null;

  const updatedAt = fmtTimestamp(s?.updated_at);
  const updatedBy = updatedByLabel ?? (s?.updated_by ? String(s.updated_by) : null);
  const knownCasualties =
    (fatalitiesVal ?? 0) + (injuredVal ?? 0) + (uninjuredVal ?? 0) + (unknownVal ?? 0);
  const criticalCasualties = (fatalitiesVal ?? 0) + (injuredVal ?? 0);
  const unclassifiedSouls =
    typeof soulsOnBoard === "number" ? Math.max(0, soulsOnBoard - knownCasualties) : 0;
  const hasManifestMismatch =
    typeof soulsOnBoard === "number" &&
    (criticalCasualties > soulsOnBoard || knownCasualties > soulsOnBoard);
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

  async function onSaveManifest() {
    if (!onUpdateManifest) return;

    setErr(null);
    setSaving(true);

    try {
      const basePassengerCount = typeof passengerCountVal === "number" ? passengerCountVal : 0;
      const baseCrewCount = typeof crewCountVal === "number" ? crewCountVal : 0;
      const baseCargoWeightKg = typeof cargoWeightKgVal === "number" ? cargoWeightKgVal : 0;
      const baseDangerousGoodsCount = typeof dangerousGoodsCountVal === "number" ? dangerousGoodsCountVal : 0;
      const baseLiveAnimalsCount = typeof liveAnimalsCountVal === "number" ? liveAnimalsCountVal : 0;

      await onUpdateManifest({
        passengerCount: numOr(basePassengerCount, passengerCount),
        crewCount: numOr(baseCrewCount, crewCount),
        cargoWeightKg: numOr(baseCargoWeightKg, cargoWeightKg),
        dangerousGoodsCount: numOr(baseDangerousGoodsCount, dangerousGoodsCount),
        liveAnimalsCount: numOr(baseLiveAnimalsCount, liveAnimalsCount),
      });
      setManifestEditOpen(false);
    } catch (e: unknown) {
      setErr(errMessage(e, "Update failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
      <section className="rounded-[8px] border border-[var(--studio-border-strong)] bg-[hsl(var(--card))] p-3">
        {s && (updatedAt || updatedBy) ? (
          <div className="text-xs font-medium leading-4 text-[color:var(--studio-muted2)]">
            {updatedAt ? `Updated ${updatedAt.replace(", ", " at ")}` : ""}
            {updatedAt && updatedBy ? " " : ""}
            {updatedBy ? `by ${updatedBy}` : ""}
          </div>
        ) : null}

        {hasManifestMismatch ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setValidationOpen((v) => !v);
                setDetailsOpen(true);
              }}
              className="inline-flex min-h-7 items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/5 px-3 py-1 text-left text-xs font-semibold text-amber-800 hover:border-amber-500/40 dark:text-amber-200"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Manifest totals need review
            </button>
          </div>
        ) : null}

        <div className="mt-3 grid items-start gap-2 xl:grid-cols-[minmax(0,0.7fr)_minmax(430px,0.72fr)]">
          <div className="grid content-start gap-2">
            <div className="grid items-start gap-2 sm:grid-cols-3 xl:grid-cols-[0.95fr_0.8fr_0.8fr]">
              <CompactMetric
                icon={<Users />}
                label="Souls on board"
                value={typeof soulsOnBoard === "number" ? soulsOnBoard : "—"}
              />
              <CompactMetric icon={<Skull />} label="Fatalities" value={fatalitiesVal ?? "—"} tone="danger" />
              <CompactMetric icon={<AlertTriangle />} label="Injured" value={injuredVal ?? "—"} tone="warning" />
            </div>
            <div className="grid gap-2 sm:grid-cols-[1.05fr_0.95fr]">
              <EventTimeCard date={date} time={time} />
              <TimezoneCard timezone={tz} />
            </div>
          </div>

          <div className="grid h-full items-stretch gap-2 md:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
            <div className="min-h-[124px] min-w-0 rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--background))] px-2.5 py-2">
              <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--studio-muted2)] [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:stroke-[1.8]">
                <MapPin className="shrink-0 opacity-75" />
                <span className="truncate">Location</span>
              </div>
              <div className="mt-2 text-sm font-semibold leading-5 text-[color:var(--studio-ink)]">
                {location}
              </div>
            </div>

            <div className="flex min-h-[124px] min-w-0 flex-col rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--background))] px-2.5 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--studio-muted2)] [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:stroke-[1.8]">
                  <Map className="shrink-0 opacity-75" />
                  <span className="truncate">Map</span>
                </div>
              </div>
              <LocationMap lat={locationLat} lng={locationLng} label={location} />
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--studio-border)] pt-2">
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--card))] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--studio-ink)] hover:border-[var(--studio-border-strong)]"
            aria-expanded={detailsOpen}
          >
            {detailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {detailsOpen ? "Hide details" : "Show details"}
          </button>
        </div>

        {detailsOpen ? (
          <div className="mt-2 rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--card))] p-2.5">
            {validationOpen && hasManifestMismatch ? (
              <div className="mb-2 rounded-[8px] border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-amber-800 dark:text-amber-200">
                Known casualty categories total {knownCasualties}, which is above the souls on board total of{" "}
                {typeof soulsOnBoard === "number" ? soulsOnBoard : "unknown"}. Review whether some values are estimates, duplicates, or pending reconciliation.
              </div>
            ) : null}

            {!hasManifestMismatch && unclassifiedSouls > 0 ? (
              <div className="mb-2 flex items-center gap-2 rounded-[8px] border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2 text-xs leading-5 text-amber-900 dark:text-amber-100">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 opacity-80" />
                <span>{unclassifiedSouls} souls are not yet classified in the casualty breakdown.</span>
              </div>
            ) : null}

            <div className="grid gap-1.5 lg:grid-cols-2">
              <DetailLine icon={<Plane className="h-3.5 w-3.5" />} label="Incident type" value={situationType} />
              {weather ? (
                <DetailLine icon={<CloudRain className="h-3.5 w-3.5" />} label="Weather / constraints" value={weather} />
              ) : null}
            </div>

            <div className="mt-1.5 rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--background))] px-3 py-2 text-sm leading-5 text-[color:var(--studio-muted)]">
              {shortDescription}
            </div>

            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              <div className="grid content-start gap-1.5">
                <div className="flex min-h-7 items-center justify-between gap-2 px-1">
                  <div className="text-xs font-semibold text-[color:var(--studio-muted2)]">Manifest breakdown</div>
                  {onUpdateManifest ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setManifestEditOpen((v) => !v);
                        setEditOpen(false);
                      }}
                      disabled={saving}
                      className="h-7 gap-1.5 px-2 text-[11px]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {manifestEditOpen ? "Close" : "Edit"}
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-5">
                  <DetailLine icon={<Users className="h-3.5 w-3.5" />} label="Passengers" value={passengerCountVal ?? "—"} />
                  <DetailLine icon={<UserCheck className="h-3.5 w-3.5" />} label="Crew" value={crewCountVal ?? "—"} />
                  <MicroStat icon={<Archive className="h-4 w-4" />} label="Cargo kg" value={cargoWeightKgVal ?? 0} />
                  <MicroStat
                    icon={<AlertTriangle className="h-4 w-4" />}
                    label="DG"
                    value={dangerousGoodsCountVal ?? 0}
                    tone={(dangerousGoodsCountVal ?? 0) > 0 ? "warning" : "neutral"}
                  />
                  <MicroStat icon={<UserCheck className="h-4 w-4" />} label="Live animals" value={liveAnimalsCountVal ?? 0} />
                </div>
              </div>

              <div className="grid content-start gap-1.5">
                <div className="flex min-h-7 items-center justify-between gap-2 px-1">
                  <div className="text-xs font-semibold text-[color:var(--studio-muted2)]">Casualty breakdown</div>
                  {onUpdateCasualties ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditOpen((v) => !v);
                        setManifestEditOpen(false);
                      }}
                      disabled={saving}
                      className="h-7 gap-1.5 px-2 text-[11px]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {editOpen ? "Close" : "Edit"}
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
                  <DetailLine icon={<Skull className="h-3.5 w-3.5" />} label="Fatalities" value={<span className="text-red-700 dark:text-red-200">{fatalitiesVal ?? "—"}</span>} />
                  <DetailLine icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Injured" value={<span className="text-amber-800 dark:text-amber-200">{injuredVal ?? "—"}</span>} />
                  <DetailLine icon={<UserCheck className="h-3.5 w-3.5" />} label="Uninjured" value={uninjuredVal ?? "—"} />
                  <DetailLine icon={<HelpCircle className="h-3.5 w-3.5" />} label="Unknown" value={unknownVal ?? "—"} />
                </div>
              </div>
            </div>
          </div>
        ) : null}

          {manifestEditOpen ? (
            <div className="mt-3 space-y-3 rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--card))] p-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-semibold text-[color:var(--studio-muted2)] mb-1">
                    Passengers
                  </div>
                  <Input
                    value={passengerCount}
                    onChange={(e) => setPassengerCount(e.target.value)}
                    placeholder="e.g. 72"
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[color:var(--studio-muted2)] mb-1">
                    Crew
                  </div>
                  <Input
                    value={crewCount}
                    onChange={(e) => setCrewCount(e.target.value)}
                    placeholder="e.g. 4"
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[color:var(--studio-muted2)] mb-1">
                    Cargo kg
                  </div>
                  <Input
                    value={cargoWeightKg}
                    onChange={(e) => setCargoWeightKg(e.target.value)}
                    placeholder="e.g. 1200"
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[color:var(--studio-muted2)] mb-1">
                    Dangerous goods
                  </div>
                  <Input
                    value={dangerousGoodsCount}
                    onChange={(e) => setDangerousGoodsCount(e.target.value)}
                    placeholder="e.g. 1"
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[color:var(--studio-muted2)] mb-1">
                    Live animals
                  </div>
                  <Input
                    value={liveAnimalsCount}
                    onChange={(e) => setLiveAnimalsCount(e.target.value)}
                    placeholder="e.g. 0"
                  />
                </div>
              </div>

              {err ? (
                <div className="notice notice-error px-3 py-2 text-xs font-semibold">
                  {err}
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setManifestEditOpen(false)} disabled={saving} className="gap-2">
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={onSaveManifest} disabled={saving} className="gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          ) : null}

          {editOpen ? (
            <div className="mt-4 space-y-3 rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--card))] p-3.5">
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
      </section>
  );
}
