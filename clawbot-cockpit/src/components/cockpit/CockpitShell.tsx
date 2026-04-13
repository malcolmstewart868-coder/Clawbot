import { useEffect, useMemo, useState } from "react";
import { fetchObserver, fetchStatus, startObserver, stopObserver } from "../../lib/api/observerApi";
import { connectEventStream } from "../../lib/api/eventStream";
import { mapEventLogItem, mapSnapshot } from "../../lib/mappers/cockpitMapper";
import type { CockpitSnapshot, EventLogItem } from "../../lib/types/cockpit";
import { TopStatusBar } from "./TopStatusBar";
import { CommandStrip } from "./CommandStrip";
import { LiveChartPanel } from "../chart/LiveChartPanel";
import { AuthorityPanel } from "../panels/AuthorityPanel";
import { IntelligencePanel } from "../panels/IntelligencePanel";
import { SessionSummaryPanel } from "../panels/SessionSummaryPanel";
import { EventStreamPanel } from "../panels/EventStreamPanel";

export function CockpitShell() {
  const [snapshot, setSnapshot] = useState<CockpitSnapshot>({});
  const [events, setEvents] = useState<EventLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  async function refresh() {
    try {
      setError("");
      const [statusData, observerData] = await Promise.all([fetchStatus(), fetchObserver()]);
      setSnapshot(mapSnapshot(statusData, observerData));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh cockpit");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const close = connectEventStream((data) => {
      const item = mapEventLogItem(data);
      setEvents((prev) => [item, ...prev].slice(0, 50));
    });
    return close;
  }, []);

  const title = useMemo(() => snapshot.market?.symbol ?? "NO_SYMBOL", [snapshot.market?.symbol]);

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", padding: 16 }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <h1 style={{ marginBottom: 8 }}>Clawbot Cockpit v1.0</h1>
        <p style={{ marginTop: 0, color: "#94a3b8" }}>
          Separate frontend. Read-only display layer. Core engine untouched.
        </p>

        <TopStatusBar runtime={snapshot.runtime} />
        <CommandStrip
          onStart={startObserver}
          onStop={stopObserver}
          onRefresh={refresh}
        />

        {loading && <p>Loading cockpit...</p>}
        {error && <p style={{ color: "#fca5a5" }}>{error}</p>}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div>
            <LiveChartPanel market={snapshot.market} intelligence={snapshot.intelligence} title={title} />
            <EventStreamPanel events={events} />
          </div>

          <div>
            <AuthorityPanel runtime={snapshot.runtime} />
            <IntelligencePanel intelligence={snapshot.intelligence} />
            <SessionSummaryPanel
              runtime={snapshot.runtime}
              market={snapshot.market}
              positions={snapshot.positions}
            />
          </div>
        </div>
      </div>
    </div>
  );
}