"use client";

import { useMemo, useState } from "react";
import type { SessionSituation } from "@/lib/sessions";
import { updateCasualties } from "@/lib/sessions";

function clampNonNeg(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.floor(n));
}

export default function CasualtyEditor({
  situation,
  editable = true,
  onUpdated,
}: {
  situation: SessionSituation;
  editable?: boolean; // default: true
  onUpdated: (s: SessionSituation) => void;
}) {
  const [injured, setInjured] = useState(situation.injured);
  const [fatalities, setFatalities] = useState(situation.fatalities);
  const [uninjured, setUninjured] = useState(situation.uninjured);
  const [unknown, setUnknown] = useState(situation.unknown);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const dirty = useMemo(() => {
    return (
      injured !== situation.injured ||
      fatalities !== situation.fatalities ||
      uninjured !== situation.uninjured ||
      unknown !== situation.unknown
    );
  }, [injured, fatalities, uninjured, unknown, situation]);

  async function save() {
    setMsg(null);
    setSaving(true);
    try {
      const updated = await updateCasualties({
        sessionId: situation.session_id,
        injured: clampNonNeg(injured),
        fatalities: clampNonNeg(fatalities),
        uninjured: clampNonNeg(uninjured),
        unknown: clampNonNeg(unknown),
      });
      onUpdated(updated);
      setMsg("Saved.");
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ fontWeight: 900, fontSize: 14 }}>Update casualties</div>

        <button
          onClick={save}
          disabled={!editable || saving || !dirty}
          style={{
            padding: "8px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.14)",
            background: "rgba(0,0,0,0.03)",
            cursor: !editable || saving || !dirty ? "not-allowed" : "pointer",
            opacity: !editable || saving || !dirty ? 0.6 : 1,
            fontWeight: 900,
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {msg ? (
        <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.65)" }}>
          {msg}
        </div>
      ) : null}

      {!editable ? (
        <div style={{ marginTop: 8, fontSize: 12, fontWeight: 900, color: "rgba(0,0,0,0.55)" }}>
          Read-only
        </div>
      ) : null}

      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Num label="Injured" value={injured} setValue={setInjured} disabled={!editable} />
        <Num label="Fatalities" value={fatalities} setValue={setFatalities} disabled={!editable} />
        <Num label="Uninjured" value={uninjured} setValue={setUninjured} disabled={!editable} />
        <Num label="Unknown" value={unknown} setValue={setUnknown} disabled={!editable} />
      </div>
    </div>
  );
}

function Num({
  label,
  value,
  setValue,
  disabled,
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
  disabled: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(0,0,0,0.70)" }}>{label}</div>
      <input
        type="number"
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(Number(e.target.value))}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.15)",
          opacity: disabled ? 0.6 : 1,
          background: disabled ? "rgba(0,0,0,0.03)" : "white",
        }}
      />
    </div>
  );
}
