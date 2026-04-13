import type { RuntimeState } from "../../lib/types/cockpit";

export function AuthorityPanel({ runtime }: { runtime?: RuntimeState }) {
  const panel: React.CSSProperties = {
    background: "#111827",
    border: "1px solid #334155",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  };

  return (
    <div style={panel}>
      <h3 style={{ marginTop: 0 }}>Authority Panel</h3>
      <p>allowTrade: {String(runtime?.allowTrade ?? "UNAVAILABLE")}</p>
      <p>finalAction: {String(runtime?.finalAction ?? "UNAVAILABLE")}</p>
      <p>block_reason: {String(runtime?.block_reason ?? "UNAVAILABLE")}</p>
      <p>guardrail_status: {String(runtime?.guardrail_status ?? "UNAVAILABLE")}</p>
      <p>safeMode: {String(runtime?.safeMode ?? "UNAVAILABLE")}</p>
      <p>execute: {String(runtime?.execute ?? "UNAVAILABLE")}</p>
    </div>
  );
}