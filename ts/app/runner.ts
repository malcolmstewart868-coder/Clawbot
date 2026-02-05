import { makePaperAdapter } from "../adapters/paperAdapter";
import { makeBinanceAdapter } from "../adapters/binanceAdapter";
import type { ExchangeAdapter } from "../adapters/exchange";


import type { TradeLike, TradeManagementState } from "../core/guardrails/tradeManagement";

import { applyTradeManagement } from "./applyTradeManagement";
import { buildScenarios, profitR } from "./simTrades";

function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

function makeExchange(): ExchangeAdapter {
  const ex = (process.env.EXCHANGE ?? "paper").toLowerCase();
  return ex === "binance" ? makeBinanceAdapter() : makePaperAdapter();
}

type Side = "long" | "short";

function toSide(v: unknown): Side {
  const s = String(v).toLowerCase();
  return s === "short" ? "short" : "long";
}

function toTradeLike(t: TradeLike): TradeLike {
  // Ensure side is exactly "long" | "short"
  return { ...t, side: toSide(t.side) };
}

export async function run() {
  const exchange = makeExchange();

  console.log("🟢 Clawbot runner started (SIM MODE)");
  console.log(`🔧 EXCHANGE=${(process.env.EXCHANGE ?? "paper").toLowerCase()}`);

  const scenarios = buildScenarios();

  for (const sc of scenarios) {
    console.log("\n==============================");
    console.log("▶ Scenario:", sc.name);
    console.log("==============================");

    // Keep TM state across ticks for THIS scenario/trade
    const tm: TradeManagementState = {
      beApplied: false,
      bePlusApplied: false,
      tp1Done: false,
      runnerActive: false,
    };

    for (const mark of sc.marks) {
      // Update simulated price/mark
      sc.trade.mark = mark;

      const r = profitR(sc.trade);
      console.log(
        `tick mark=${mark} R=${r.toFixed(2)} curStop=${sc.trade.currentStop ?? "n/a"}`
      );

      // Strong typing: TradeLike in, TradeLike out
      const trade: TradeLike = toTradeLike(sc.trade);

      // Guardrails: get actions
      const result = evaluateTradeManagement(trade, tm, mark, DEFAULT_TM_PARAMS);
      const actions = result.actions;

      // Apply actions through adapter + update stop on trade (inside applyTradeManagement)
      await applyTradeManagement(exchange, trade, actions);

      // Keep scenario trade in sync for next tick logs
      sc.trade.currentStop = trade.currentStop;

      await sleep(150);
    }
  }

  console.log("\n✅ SIM DONE. Runner exiting.");
}
