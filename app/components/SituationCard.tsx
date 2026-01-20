import type { SessionSituation } from "@/lib/sessions";

function fmtDate(d: string | null) {
  if (!d) return "—";
  return d;
}

function fmtTime(t: string | null) {
  if (!t) return "—";
  return t.slice(0, 5); // HH:MM
}

export default function SituationCard({ s }: { s: SessionSituation }) {
  return (
    <div style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Event</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {fmtDate(s.event_date)} • {fmtTime(s.event_time)} {s.timezone ? `(${s.timezone})` : ""}
          </div>

          <div style={{ marginTop: 6, opacity: 0.9 }}>
            <strong>Location:</strong> {s.location || "—"}
          </div>
          <div style={{ marginTop: 4, opacity: 0.9 }}>
            <strong>Type:</strong> {s.situation_type || "—"}
          </div>

          <div style={{ marginTop: 8, opacity: 0.85 }}>
            {s.short_description || "—"}
          </div>
        </div>

        <div style={{ minWidth: 260 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Casualties</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
            <Stat label="Injured" value={s.injured} />
            <Stat label="Fatalities" value={s.fatalities} />
            <Stat label="Uninjured" value={s.uninjured} />
            <Stat label="Unknown" value={s.unknown} />
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.6 }}>
            Updated: {new Date(s.updated_at).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 12, padding: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
