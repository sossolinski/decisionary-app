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
  editable,
  onUpdated,
}: {
  situation: SessionSituation;
  editable: boolean; // participant: true (tylko casualties), observer: false
  onUpdated: (s: SessionSituation) => void;
}) {
  const [injured, setInjured] = useState<number>(situation.injured);
  const [fatalities, setFatalities] = useState<number>(situation.fatalities);
  const [uninjured, setUninjured] = useState<number>(situation.uninjured);
  const [unknown, setUnknown] = useState<number>(situation.unknown);

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
    <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>Update casualties</div>
        <button
          onClick={save}
          disabled={!editable || saving || !dirty}
          style={{
            padding: "8px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            opacity: !editable || !dirty ? 0.5 : 1,
            cursor: !editable || !dirty ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
        <Num label="Injured" value={injured} setValue={setInjured} disabled={!editable} />
        <Num label="Fatalities" value={fatalities} setValue={setFatalities} disabled={!editable} />
        <Num label="Uninjured" value={uninjured} setValue={setUninjured} disabled={!editable} />
        <Num label="Unknown" value={unknown} setValue={setUnknown} disabled={!editable} />
      </div>

      {msg && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>{msg}</div>}
      {!editable && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.6 }}>Read-only</div>}
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
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{label}</div>
      <input
        type="number"
        min={0}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(Number(e.target.value))}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.15)",
          opacity: disabled ? 0.6 : 1,
        }}
      />
    </label>
  );
}
