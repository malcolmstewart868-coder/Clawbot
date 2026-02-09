// ts/app/applyTradeManagement.ts
import type { ExchangeAdapter } from "../adapters/exchange";
import type { TradeLike, MgmtAction } from "../core/guardrails/tradeManagement";

export async function applyTradeManagement(
  ex: ExchangeAdapter,
  trade: TradeLike,
  actions: MgmtAction[]
) {
  for (const a of actions) {
    if (a.closePct != null) {
      await ex.reducePosition({
        symbol: trade.symbol,
        closePct: a.closePct,
        reason: a.reason
      });
    }

    if (a.newStop != null) {
      // keep local trade in sync for logs and later ticks
      trade.currentStop = a.newStop;

      await ex.updateStop({
        symbol: trade.symbol,
        stopPrice: a.newStop,
        reason: a.reason
      });
    }
  }
}
