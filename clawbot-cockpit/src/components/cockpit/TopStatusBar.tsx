import type { RuntimeState } from "../../lib/types/cockpit";

export function TopStatusBar({ runtime }: { runtime?: RuntimeState }) {
  const boxStyle: React.CSSProperties = {
    background: "#111827",
    border: "1px solid #334155",
    borderRadius: 14,
    padding: 12,
    minWidth: 180,
  };

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
      <div style={boxStyle}>ENGINE_STATE: {String(runtime?.engine_state ?? "UNAVAILABLE")}</div>
      <div style={boxStyle}>RUN_MODE: {String(runtime?.mode ?? "UNAVAILABLE")}</div>
      <div style={boxStyle}>OBSERVE_LOCK: {String(runtime?.observe_lock ?? "UNAVAILABLE")}</div>
      <div style={boxStyle}>TIMESTAMP_UTC: {String(runtime?.timestamp_utc ?? "UNAVAILABLE")}</div>
    </div>
  );
}