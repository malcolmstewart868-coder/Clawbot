// ts/adapters/binanceAdapter.ts
import type { ExchangeAdapter, ReduceRequest, StopUpdateRequest, ExchangeOk } from "./exchange";

function ok(): ExchangeOk {
  return { ok: true };
}

// TEMP stub: logs only (no real orders yet)
// Later we will wire Binance API here safely.
export function makeBinanceAdapter(): ExchangeAdapter {
  return {
    async reducePosition(req: ReduceRequest) {
      process.stdout.write(`[BINANCE-STUB] reducePosition ${JSON.stringify(req)}\n`);
      return ok();
    },
    async updateStop(req: StopUpdateRequest) {
      process.stdout.write(`[BINANCE-STUB] updateStop ${JSON.stringify(req)}\n`);
      return ok();
    },
  };
}
