import type { IntelligenceState } from "../../lib/types/cockpit";

export function IntelligencePanel({ intelligence }: { intelligence?: IntelligenceState }) {
  const panel: React.CSSProperties = {
    background: "#111827",
    border: "1px solid #334155",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  };

  return (
    <div style={panel}>
      <h3 style={{ marginTop: 0 }}>Intelligence State</h3>
      <p>bias_state: {String(intelligence?.bias_state ?? "UNAVAILABLE")}</p>
      <p>bias_strength: {String(intelligence?.bias_strength ?? "UNAVAILABLE")}</p>
      <p>market_state: {String(intelligence?.market_state ?? "UNAVAILABLE")}</p>
      <p>truth_state: {String(intelligence?.truth_state ?? "UNAVAILABLE")}</p>
      <p>volatility_state: {String(intelligence?.volatility_state ?? "UNAVAILABLE")}</p>
      <p>observer_recommendation: {String(intelligence?.observer_recommendation ?? "UNAVAILABLE")}</p>
      <p>reentry_state: {String(intelligence?.reentry_state ?? "UNAVAILABLE")}</p>
      <p>structure_confirmed: {String(intelligence?.structure_confirmed ?? "UNAVAILABLE")}</p>
    </div>
  );
}