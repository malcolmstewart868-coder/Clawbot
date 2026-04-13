import type { MarketState, PositionState, RuntimeState } from "../../lib/types/cockpit";

type Props = {
  runtime?: RuntimeState;
  market?: MarketState;
  positions?: PositionState;
};

export function SessionSummaryPanel({ runtime, market, positions }: Props) {
  const panel: React.CSSProperties = {
    background: "#111827",
    border: "1px solid #334155",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  };

  return (
    <div style={panel}>
      <h3 style={{ marginTop: 0 }}>Session / Position Summary</h3>
      <p>symbol: {String(market?.symbol ?? "UNAVAILABLE")}</p>
      <p>feed_status: {String(market?.feed_status ?? "UNAVAILABLE")}</p>
      <p>price: {String(market?.price ?? "UNAVAILABLE")}</p>
      <p>spread: {String(market?.spread ?? "UNAVAILABLE")}</p>
      <p>session_trade_cap: {String(runtime?.session_trade_cap ?? "UNAVAILABLE")}</p>
      <p>remaining_trades: {String(runtime?.remaining_trades ?? "UNAVAILABLE")}</p>
      <p>open_positions: {String(positions?.open_count ?? "UNAVAILABLE")}</p>
      <p>floating_pnl: {String(positions?.floating_pnl ?? "UNAVAILABLE")}</p>
    </div>
  );
}