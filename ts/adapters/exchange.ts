// ts/adapters/exchange.ts

export type ReduceRequest = {
  symbol: string;

  /**
   * For real exchanges: specify exact side + qty.
   * For SIM: you can pass closePct instead (paper/binance-stub will handle it).
   */
  side?: "buy" | "sell";
  qty?: number;

  // SIM convenience: close fraction of position (0..1)
  closePct?: number;

  reason?: string;
};

export type StopUpdateRequest = {
  symbol: string;
  stopPrice: number;
  reason?: string;
};

export type ExchangeOk = { ok: true };

export interface ExchangeAdapter {
  reducePosition(req: ReduceRequest): Promise<ExchangeOk>;
  updateStop(req: StopUpdateRequest): Promise<ExchangeOk>;
}
