import { useMemo, useState } from "react";
import type { IntelligenceState, MarketState } from "../../lib/types/cockpit";

type Props = {
  market?: MarketState;
  intelligence?: IntelligenceState;
  title: string;
};

function resolveChartSymbol(symbol?: string): string {
  const raw = (symbol ?? "").trim().toUpperCase();

  if (!raw) return "BINANCE:BTCUSDT";

  if (raw.endsWith("USDT")) {
    return `BINANCE:${raw}`;
  }

  if (/^[A-Z]{6}$/.test(raw)) {
    return `OANDA:${raw}`;
  }

  return raw;
}

function mapInterval(tf: string): string {
  switch (tf) {
    case "M5":
      return "5";
    case "M15":
      return "15";
    case "H1":
      return "60";
    case "H4":
      return "240";
    case "D1":
      return "1D";
    default:
      return "60";
  }
}

export function LiveChartPanel({ market, intelligence, title }: Props) {
  const panel: React.CSSProperties = {
    background: "#111827",
    border: "1px solid #334155",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  };

  const chartShell: React.CSSProperties = {
    minHeight: 460,
    borderRadius: 14,
    border: "1px dashed #475569",
    background: "#020617",
    marginTop: 12,
    overflow: "hidden",
  };

  const tfButton = (active: boolean): React.CSSProperties => ({
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #334155",
    background: active ? "#1d4ed8" : "#1e293b",
    color: "#e2e8f0",
    cursor: "pointer",
    fontWeight: 600,
  });

  const availableTimeframes = useMemo(() => {
    const list = market?.timeframes?.length ? market.timeframes : ["H1", "M15", "M5"];
    return list;
  }, [market?.timeframes]);

  const [selectedTf, setSelectedTf] = useState<string>(availableTimeframes[0] ?? "H1");

  const chartSymbol = useMemo(() => resolveChartSymbol(market?.symbol || title), [market?.symbol, title]);
  const interval = useMemo(() => mapInterval(selectedTf), [selectedTf]);

  const chartUrl = useMemo(() => {
    const params = new URLSearchParams({
      symbol: chartSymbol,
      interval,
      theme: "dark",
      hide_top_toolbar: "1",
      hide_legend: "0",
      save_image: "0",
      studies: "",
    });

    return `https://www.tradingview.com/widgetembed/?${params.toString()}`;
  }, [chartSymbol, interval]);

  return (
    <div style={panel}>
      <h2 style={{ marginTop: 0 }}>Live Market Chart Panel</h2>

      <p style={{ color: "#94a3b8", marginBottom: 8 }}>
        Observed Symbol: {String(market?.symbol ?? title ?? "NO_SYMBOL")}
      </p>

      <p style={{ color: "#94a3b8", marginBottom: 8 }}>
        Timeframes: {availableTimeframes.join(" / ")}
      </p>

      <p style={{ color: "#94a3b8", marginBottom: 8 }}>
        Bias: {String(intelligence?.bias_state ?? "UNAVAILABLE")}
      </p>

      <p style={{ color: "#94a3b8", marginBottom: 8 }}>
        Volatility: {String(intelligence?.volatility_state ?? "UNAVAILABLE")}
      </p>

      <p style={{ color: "#94a3b8", marginBottom: 12 }}>
        Recommendation: {String(intelligence?.observer_recommendation ?? "UNAVAILABLE")}
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {availableTimeframes.map((tf) => (
          <button
            key={tf}
            type="button"
            style={tfButton(selectedTf === tf)}
            onClick={() => setSelectedTf(tf)}
          >
            {tf}
          </button>
        ))}
      </div>

      <div style={chartShell}>
        <iframe
          key={`${chartSymbol}-${interval}`}
          src={chartUrl}
          title={`chart-${chartSymbol}-${interval}`}
          style={{ width: "100%", height: 460, border: 0 }}
          allowTransparency={true}
        />
      </div>

      <p style={{ color: "#64748b", fontSize: 13, marginTop: 10, marginBottom: 0 }}>
        Read-only chart surface. No synthetic overlays added in cockpit.
      </p>
    </div>
  );
}