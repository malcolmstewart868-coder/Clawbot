import type { TradeLike } from "../core/guardrails/tradeManagement";

export type SimTrade = TradeLike & { mark?: number };

export type Scenario = {
  name: string;
  trade: SimTrade;
  marks: number[];
};

export function profitR(trade: SimTrade): number {
  if (!trade.entry || trade.mark == null) return 0;
  const R = Math.abs(trade.entry - trade.initialStop);
  if (!R) return 0;

  // Signed profitR (positive in profit direction)
  return trade.side === "long"
    ? (trade.mark - trade.entry) / R
    : (trade.entry - trade.mark) / R;
}

export function buildScenarios(): Scenario[] {
  return [
    {
      name: "basic",
      trade: {
        id: "t1",
        symbol: "EURUSDT",
        side: "long",
        entry: 100,
        initialStop: 98,
        currentStop: 98,
        size: 1,
        mark: 100,
      },
      marks: [100, 100.5, 101, 101.5, 102, 102.5],
    },
  ];
}
