import { useEffect, useMemo, useState } from "react";
import {
  fetchObserverMulti,
  fetchStatus,
  setObserverActiveSymbol,
  startObserver,
  stopObserver,
} from "../../lib/api/observerApi";
import { connectEventStream } from "../../lib/api/eventStream";
import { mapEventLogItem, mapSnapshot } from "../../lib/mappers/cockpitMapper";
import type { CockpitSnapshot, EventLogItem } from "../../lib/types/cockpit";
import { TopStatusBar } from "./TopStatusBar";
import { CommandStrip } from "./CommandStrip";
import { SymbolStrip } from "./SymbolStrip";
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
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");

  async function refresh() {
    try {
      setError("");

      const [statusData, observerData] = await Promise.all([
        fetchStatus(),
        fetchObserverMulti(),
      ]);

      const mapped = mapSnapshot(statusData, observerData);
      setSnapshot(mapped);

      if (!selectedSymbol) {
        const firstSymbol =
          mapped.market?.symbol ??
          mapped.observedSymbols?.find((s) => s.active)?.symbol ??
          mapped.observedSymbols?.[0]?.symbol ??
          "";

        if (firstSymbol) {
          setSelectedSymbol(firstSymbol);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh cockpit");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectSymbol(symbol: string) {
    try {
      setError("");
      await setObserverActiveSymbol(symbol);
      await refresh();
      setSelectedSymbol(symbol);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to switch active symbol"
      );
    }
  }

  useEffect(() => {
    void refresh();

    const close = connectEventStream((data) => {
      const item = mapEventLogItem(data);
      setEvents((prev) => [item, ...prev].slice(0, 50));
    });

    return close;
  }, []);

  const observedSymbols = snapshot.observedSymbols ?? [];

  const activeSymbol =
    selectedSymbol ||
    observedSymbols.find((s) => s.active)?.symbol ||
    snapshot.market?.symbol ||
    "NO_SYMBOL";

  const selectedSymbolState = useMemo(() => {
    return observedSymbols.find((s) => s.symbol === activeSymbol);
  }, [observedSymbols, activeSymbol]);

  const chartMarket = useMemo(() => {
    if (!selectedSymbolState) return snapshot.market;

    return {
      ...snapshot.market,
      symbol: selectedSymbolState.symbol ?? snapshot.market?.symbol,
      price: selectedSymbolState.price ?? snapshot.market?.price,
      feed_status:
        selectedSymbolState.feed_status ?? snapshot.market?.feed_status,
    };
  }, [snapshot.market, selectedSymbolState]);

  const chartIntelligence = useMemo(() => {
    if (!selectedSymbolState) return snapshot.intelligence;

    return {
      ...snapshot.intelligence,
      bias_state:
        selectedSymbolState.bias_state ?? snapshot.intelligence?.bias_state,
      market_state:
        selectedSymbolState.market_state ?? snapshot.intelligence?.market_state,
      volatility_state:
        selectedSymbolState.volatility_state ??
        snapshot.intelligence?.volatility_state,
      observer_recommendation:
        selectedSymbolState.observer_recommendation ??
        snapshot.intelligence?.observer_recommendation,
    };
  }, [snapshot.intelligence, selectedSymbolState]);

  const chartRuntime = useMemo(() => {
    if (!selectedSymbolState) return snapshot.runtime;

    return {
      ...snapshot.runtime,
      allowTrade:
        selectedSymbolState.allowTrade ?? snapshot.runtime?.allowTrade,
      finalAction:
        selectedSymbolState.finalAction ?? snapshot.runtime?.finalAction,
      guardrail_status:
        selectedSymbolState.guardrail_status ??
        snapshot.runtime?.guardrail_status,
      safeMode: selectedSymbolState.safeMode ?? snapshot.runtime?.safeMode,
      execute: selectedSymbolState.execute ?? snapshot.runtime?.execute,
      remaining_trades:
        selectedSymbolState.remaining_trades ??
        snapshot.runtime?.remaining_trades,
    };
  }, [snapshot.runtime, selectedSymbolState]);

    const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const symbol = String(event.symbol ?? "").toUpperCase();
      return symbol === activeSymbol || symbol === "SYSTEM";
    });
  }, [events, activeSymbol]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#e2e8f0",
        padding: 16,
      }}
    >
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

        <SymbolStrip
          symbols={observedSymbols}
          activeSymbol={activeSymbol}
          onSelectSymbol={handleSelectSymbol}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div>
            <LiveChartPanel
              market={chartMarket}
              intelligence={chartIntelligence}
              title={activeSymbol}
            />
            <EventStreamPanel events={filteredEvents} />
          </div>

          <div>
            <AuthorityPanel runtime={chartRuntime} />
            <IntelligencePanel intelligence={chartIntelligence} />
            <SessionSummaryPanel
              runtime={chartRuntime}
              market={chartMarket}
              positions={{
                ...snapshot.positions,
                open_count:
                  selectedSymbolState?.open_positions ??
                  snapshot.positions?.open_count,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}