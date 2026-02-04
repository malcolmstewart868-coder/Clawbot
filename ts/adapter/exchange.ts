// ts/adapters/exchange.ts

export type ReduceRequest = {
  symbol: string;
  side: "buy" | "sell";
  qty: number;
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
  updateStop(req: StopUpdateRequest): Promise<ExchangeOk>; updatteStop(req: StopUpdateRequest): Promise<ExchangeOk>;
}
