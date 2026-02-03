// ts/adapters/paperAdapter.ts
import type { ExchangeAdapter, ReduceRequest, StopUpdateRequest } from "./exchange";

function ok() {
  return { ok: true as const };
}

export function makePaperAdapter(): ExchangeAdapter {
  return {
    async reducePosition(req: ReduceRequest) {
      // log only (no real orders)
      process.stdout.write(`[PAPER] reducePosition ${JSON.stringify(req)}\n`);
      return ok();
    },

    async updateStop(req: StopUpdateRequest) {
      process.stdout.write(`[PAPER] updateStop ${JSON.stringify(req)}\n`);
      return ok();
    },
  };
}
