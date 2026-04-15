import type { ObservedSymbolState } from "../../lib/types/cockpit";

type Props = {
  symbols: ObservedSymbolState[];
  activeSymbol: string;
  onSelectSymbol: (symbol: string) => void;
};

export function SymbolStrip({ symbols, activeSymbol, onSelectSymbol }: Props) {
  const shell: React.CSSProperties = {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  };

  const cardStyle = (active: boolean): React.CSSProperties => ({
    minWidth: 180,
    padding: 12,
    borderRadius: 14,
    border: active ? "1px solid #3b82f6" : "1px solid #334155",
    background: active ? "#172554" : "#111827",
    cursor: "pointer",
  });

  const label: React.CSSProperties = {
    color: "#94a3b8",
    fontSize: 12,
    marginBottom: 6,
  };

  return (
    <div style={shell}>
      {symbols.map((item) => {
        const active = item.symbol === activeSymbol;
        return (
          <button
            key={item.symbol}
            type="button"
            style={cardStyle(active)}
            onClick={() => onSelectSymbol(item.symbol)}
          >
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{item.symbol}</div>
            <div style={label}>BIAS: {String(item.bias_state ?? "UNAVAILABLE")}</div>
            <div style={label}>STATE: {String(item.market_state ?? "UNAVAILABLE")}</div>
            <div style={label}>VOL: {String(item.volatility_state ?? "UNAVAILABLE")}</div>
            <div style={label}>ACTION: {String(item.observer_recommendation ?? "UNAVAILABLE")}</div>
          </button>
        );
      })}
    </div>
  );
}