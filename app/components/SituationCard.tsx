"use client";

import { useEffect, useState } from "react";
import type { SessionSituation } from "@/lib/sessions";
import type { Scenario } from "@/lib/scenarios";

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

function Box({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.10)",
        background: "rgba(0,0,0,0.02)",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 950 }}>{title}</div>
      <div style={{ display: "grid", gap: 6 }}>{children}</div>
      {footer ? (
        <div
          style={{
            marginTop: 4,
            paddingTop: 10,
            borderTop: "1px dashed rgba(0,0,0,0.15)",
          }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "110px 1fr",
        gap: 10,
        alignItems: "baseline",
        padding: "4px 0",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(0,0,0,0.55)" }}>
        {k}
      </div>
      <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(0,0,0,0.82)" }}>
        {v}
      </div>
    </div>
  );
}

function SmallStat({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <span style={{ fontSize: 11, fontWeight: 900, color: "rgba(0,0,0,0.55)" }}>
        {label}
      </span>
      <span style={{ fontSize: 12, fontWeight: 900, color: "rgba(0,0,0,0.82)" }}>
        {typeof value === "number" ? value : "—"}
      </span>
    </div>
  );
}

function numOr(prev: number, raw: string) {
  const t = raw.trim();
  if (t === "") return prev;
  const n = Number(t);
  if (!Number.isFinite(n)) return prev;
  return Math.max(0, Math.floor(n));
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 900, color: "rgba(0,0,0,0.62)" }}>
        {label}
      </span>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.15)",
          background: "white",
          fontWeight: 850,
          fontSize: 12,
          outline: "none",
        }}
      />
    </label>
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

  const hasScenarioFallback =
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
      scenario.timezone);

  if (!situation && !hasScenarioFallback) {
    return (
      <div
        style={{
          padding: 14,
          borderRadius: 16,
          border: "1px solid rgba(0,0,0,0.10)",
          background: "white",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 950 }}>Situation</div>
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: "rgba(0,0,0,0.55)",
            fontWeight: 700,
          }}
        >
          Loading…
        </div>
      </div>
    );
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          fontSize: 11,
          color: "rgba(0,0,0,0.55)",
          fontWeight: 850,
        }}
      >
        <span>{updatedAt ? `Last updated: ${updatedAt}` : ""}</span>
        <span>{updatedBy ? `By: ${updatedBy}` : ""}</span>
      </div>
    ) : null;

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        border: "1px solid rgba(0,0,0,0.10)",
        background: "white",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "baseline",
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 950 }}>
          Situation{" "}
          {scenario?.title ? (
            <span style={{ opacity: 0.6 }}>· {scenario.title}</span>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
          {!s ? (
            <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(0,0,0,0.45)" }}>
              Source: <span style={{ fontWeight: 950 }}>Scenario</span>
            </div>
          ) : (
            <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(0,0,0,0.45)" }}>
              Source: <span style={{ fontWeight: 950 }}>Session</span>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "320px 1fr 260px",
          gap: 12,
          alignItems: "start",
        }}
      >
        <Box title="Event">
          <Row k="Event name" v={eventName} />
          <Row k="Date" v={date} />
          <Row k="Time" v={time} />
          <Row k="Time zone" v={tz} />
          <Row k="Location" v={location} />
        </Box>

        <Box title="Event description">
          <div
            style={{
              fontSize: 13,
              color: "rgba(0,0,0,0.82)",
              lineHeight: 1.45,
              whiteSpace: "pre-wrap",
              minHeight: isMobile ? 0 : 74,
            }}
          >
            {description}
          </div>
        </Box>

        <Box title="Casualties" footer={casualtiesFooter}>
          <SmallStat label="Injured" value={injuredVal ?? null} />
          <SmallStat label="Fatalities" value={fatalitiesVal ?? null} />
          <SmallStat label="Uninjured" value={uninjuredVal ?? null} />
          <SmallStat label="Unknown" value={unknownVal ?? null} />

          <details
            open={editOpen}
            onToggle={(e) => setEditOpen((e.target as HTMLDetailsElement).open)}
            style={{ marginTop: 10 }}
          >
            <summary
              style={{
                cursor: "pointer",
                fontWeight: 900,
                fontSize: 12,
                listStyle: "none",
              }}
            >
              Update casualties ▾
            </summary>

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                  gap: 10,
                }}
              >
                <Field label="Injured" value={injured} onChange={setInjured} placeholder="e.g. 2" />
                <Field label="Fatalities" value={fatalities} onChange={setFatalities} placeholder="e.g. 33" />
                <Field label="Uninjured" value={uninjured} onChange={setUninjured} placeholder="e.g. 20" />
                <Field label="Unknown" value={unknown} onChange={setUnknown} placeholder="e.g. 1" />
              </div>

              {err ? (
                <div style={{ fontSize: 12, fontWeight: 900, color: "#b91c1c" }}>{err}</div>
              ) : null}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={onSave}
                  disabled={!onUpdateCasualties || saving}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "white",
                    fontWeight: 950,
                    cursor: !onUpdateCasualties || saving ? "not-allowed" : "pointer",
                    opacity: !onUpdateCasualties || saving ? 0.6 : 1,
                  }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>

                <button
                  onClick={() => setEditOpen(false)}
                  disabled={saving}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "rgba(0,0,0,0.03)",
                    fontWeight: 950,
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </details>
        </Box>
      </div>
    </div>
  );
}
