import type { EventLogItem } from "../../lib/types/cockpit";

export function EventStreamPanel({ events }: { events: EventLogItem[] }) {
  const panel: React.CSSProperties = {
    background: "#111827",
    border: "1px solid #334155",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  };

  const row: React.CSSProperties = {
    borderBottom: "1px solid #1e293b",
    padding: "10px 0",
  };

  const muted: React.CSSProperties = {
    color: "#94a3b8",
  };

  return (
    <div style={panel}>
      <h3 style={{ marginTop: 0 }}>Event Stream</h3>

      {events.length === 0 ? (
        <p style={muted}>Waiting for SSE events...</p>
      ) : (
        events.map((event, index) => (
          <div key={index} style={row}>
            <div>
              {String(event.timestamp_utc ?? "NO_TIME")} | {String(event.mode ?? "NO_MODE")}
            </div>
            <div>
              {String(event.symbol ?? "NO_SYMBOL")} | {String(event.market_state ?? "NO_STATE")}
            </div>
            <div>
              {String(event.observer_recommendation ?? "NO_RECOMMENDATION")} |{" "}
              {String(event.finalAction ?? "NO_ACTION")}
            </div>
          </div>
        ))
      )}
    </div>
  );
}