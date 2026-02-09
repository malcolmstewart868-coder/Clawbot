// ts/adapters/binanceAdapter.ts
import type { ExchangeAdapter, ReduceRequest, StopUpdateRequest, ExchangeOk } from "./exchange";

function ok(): ExchangeOk {
  return { ok: true };
}

/**
 * SAFE STUB:
 * - Does NOT place real orders
 * - Just logs intent
 * Later we’ll wire real Binance calls behind a "LIVE" gate.
 */
export function makeBinanceAdapter(): ExchangeAdapter {
  return {
    async reducePosition(req: ReduceRequest) {
      process.stdout.write(`[BINANCE-STUB] reducePosition ${JSON.stringify(req)}\n`);
      return ok();
    },

    async updateStop(req: StopUpdateRequest) {
      process.stdout.write(`[BINANCE-STUB] updateStop ${JSON.stringify(req)}\n`);
      return ok();
    }
  };
}
