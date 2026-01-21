"use client";

import { useEffect, useState } from "react";
import type { SessionSituation } from "@/lib/sessions";

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

function fmtTime(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return String(v);
}

function Box({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.10)",
        background: "rgba(0,0,0,0.02)",
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 950, marginBottom: 8 }}>
        {title}
      </div>
      {children}
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

export default function SituationCard({
  situation,
}: {
  situation?: SessionSituation | null;
}) {
  const isMobile = useMediaQuery("(max-width: 980px)");

  if (!situation) {
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
        <div style={{ marginTop: 6, fontSize: 12, color: "rgba(0,0,0,0.55)", fontWeight: 700 }}>
          Loading…
        </div>
      </div>
    );
  }

  const s = situation;

  // NOTE: using situation_type as "Event name" until you add a dedicated field
  const eventName = safe(s.situation_type);
  const date = fmtDate(s.event_date);
  const time = fmtTime(s.event_time);
  const tz = safe(s.timezone);
  const location = safe(s.location);
  const description = safe(s.short_description);

  const updatedAt = s.updated_at ? new Date(s.updated_at).toLocaleString() : "—";
  const updatedBy = s.updated_by ? String(s.updated_by) : null;

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
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "320px 1fr 260px",
          gap: 12,
          alignItems: "start",
        }}
      >
        {/* LEFT: Event meta */}
        <Box title="Event">
          <Row k="Event name" v={eventName} />
          <Row k="Date" v={date} />
          <Row k="Time" v={time} />
          <Row k="Time zone" v={tz} />
          <Row k="Location" v={location} />
        </Box>

        {/* MIDDLE: Description */}
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

        {/* RIGHT: Casualties (summary only) */}
        <Box title="Casualties">
          <div style={{ display: "grid", gap: 6 }}>
            <SmallStat label="Injured" value={s.injured} />
            <SmallStat label="Fatalities" value={s.fatalities} />
            <SmallStat label="Uninjured" value={s.uninjured} />
            <SmallStat label="Unknown" value={s.unknown} />
          </div>
        </Box>
      </div>

      {/* Footer: last update */}
      <div
        style={{
          marginTop: 10,
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          fontSize: 11,
          color: "rgba(0,0,0,0.55)",
          fontWeight: 800,
        }}
      >
        <span>Last updated: {updatedAt}</span>
        <span>{updatedBy ? `By: ${updatedBy}` : ""}</span>
      </div>
    </div>
  );
}
