"use client";

import { useEffect, useMemo, useState } from "react";
import type { SessionSituation } from "@/lib/sessions";
import type { Scenario } from "@/lib/scenarios";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

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

function safe(v: any, fallback = "—") {
  const s = typeof v === "string" ? v.trim() : v;
  return s ? s : fallback;
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString();
}

function fmtTimeLoose(v: string | null | undefined) {
  if (!v) return "—";

  // time-only like "12:27:39.831712" or "12:27:39"
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

function StatRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-1">
      <div className="text-[11px] font-semibold text-muted-foreground">{k}</div>
      <div className="text-sm font-semibold text-foreground">{v}</div>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">
        {typeof value === "number" ? value : "—"}
      </span>
    </div>
  );
}

function SectionShell({
  title,
  right,
  children,
  footer,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-foreground">{title}</div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="grid gap-2">{children}</div>
      {footer ? (
        <div className="mt-3 border-t border-dashed border-border pt-3">{footer}</div>
      ) : null}
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
    return <div className="text-sm font-semibold text-muted-foreground">Loading…</div>;
  }

  const s = situation;

  const eventName = safe(scenario?.situation_type ?? s?.situation_type);
  const date = fmtDate(scenario?.event_date ?? s?.event_date);
  const time = fmtTimeLoose(scenario?.event_time ?? s?.event_time);
  const tz = safe(scenario?.timezone ?? s?.timezone);
  const location = safe(scenario?.location ?? s?.location);
  const description = safe(scenario?.short_description ?? s?.short_description);

  const injuredVal = typeof s?.injured === "number" ? s?.injured : scenario?.injured;
  const fatalitiesVal = typeof s?.fatalities === "number" ? s?.fatalities : scenario?.fatalities;
  const uninjuredVal = typeof s?.uninjured === "number" ? s?.uninjured : scenario?.uninjured;
  const unknownVal = typeof s?.unknown === "number" ? s?.unknown : scenario?.unknown;

  const updatedAt = s?.updated_at ? new Date(s.updated_at).toLocaleString() : null;
  const updatedBy = s?.updated_by ? String(s.updated_by) : null;

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
    } catch (e: any) {
      setErr(e?.message ?? "Update failed");
    } finally {
      setSaving(false);
    }
  }

  const casualtiesFooter =
    s && (updatedAt || updatedBy) ? (
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
        <span>{updatedAt ? `Last updated: ${updatedAt}` : ""}</span>
        <span>{updatedBy ? `By: ${updatedBy}` : ""}</span>
      </div>
    ) : null;

  return (
    <div
      className={[
        "grid gap-4",
        isMobile ? "grid-cols-1" : "grid-cols-[320px_minmax(360px,1fr)_260px]",
      ].join(" ")}
    >
      <SectionShell title="Event">
        <StatRow k="Event name" v={eventName} />
        <StatRow k="Date" v={date} />
        <StatRow k="Time" v={time} />
        <StatRow k="Time zone" v={tz} />
        <StatRow k="Location" v={location} />
      </SectionShell>

      <SectionShell title="Event description">
        <div className="min-h-[72px] whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {description}
        </div>
      </SectionShell>

      <SectionShell
        title="Casualties"
        right={
          onUpdateCasualties ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditOpen((v) => !v)}
              disabled={saving}
            >
              {editOpen ? "Close" : "Edit"}
            </Button>
          ) : null
        }
        footer={casualtiesFooter}
      >
        <SmallStat label="Injured" value={injuredVal ?? null} />
        <SmallStat label="Fatalities" value={fatalitiesVal ?? null} />
        <SmallStat label="Uninjured" value={uninjuredVal ?? null} />
        <SmallStat label="Unknown" value={unknownVal ?? null} />

        {editOpen ? (
          <div className="mt-3 space-y-3">
            <div className={["grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-2"].join(" ")}>
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-muted-foreground">Injured</div>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={injured}
                  onChange={(e) => setInjured(e.target.value)}
                  placeholder="e.g. 2"
                />
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-muted-foreground">Fatalities</div>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={fatalities}
                  onChange={(e) => setFatalities(e.target.value)}
                  placeholder="e.g. 33"
                />
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-muted-foreground">Uninjured</div>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={uninjured}
                  onChange={(e) => setUninjured(e.target.value)}
                  placeholder="e.g. 20"
                />
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-muted-foreground">Unknown</div>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={unknown}
                  onChange={(e) => setUnknown(e.target.value)}
                  placeholder="e.g. 1"
                />
              </div>
            </div>

            {err ? <div className="text-sm font-semibold text-destructive">{err}</div> : null}

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={onSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </SectionShell>
    </div>
  );
}
