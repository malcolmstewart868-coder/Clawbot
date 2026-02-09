// ts/app/applyTradeManagement.ts
import type { ExchangeAdapter } from "../adapters/exchange";
import type { TradeLike } from "../core/guardrails";

export async function applyTradeManagement(
  ex: ExchangeAdapter,
  trade: TradeLike,
  actions: any[]
) {
  // Minimal safe executor: only calls methods if action has the expected shape
  for (const a of actions || []) {
    if (a?.type === "reducePosition" && a?.req) {
      await ex.reducePosition(a.req);
    }
    if (a?.type === "updateStop" && a?.req) {
      await ex.updateStop(a.req);
    }
  }
}
