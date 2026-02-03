// ts/app/guardrailsExecutor.ts
import { evaluateTradeManagement, DEFAULT_TM_PARAMS } from "../core/guardrails/tradeManagement";
import type { ExchangeAdapter } from "../adapters/exchange";
import type { TradeLike, TradeManagementState } from "../core/guardrails/tradeManagement";
import { makeBinanceAdapter } from "../adapters/binanceAdapter";
import { makePaperAdapter } from "../adapters/paperAdapter";

// ...

const adapter =
  process.env.EXCHANGE === "paper" ? makePaperAdapter() : makeBinanceAdapter();

import { applyTradeManagement } from "./applyTradeManagement";
import { buildScenarios, profitR } from "./simTrades";

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

export async function run() {
  const exchange = makeBinanceAdapter();

  console.log("🟢 Clawbot runner started (SIM MODE)");

  const scenarios = buildScenarios();

  for (const sc of scenarios) {
    console.log("\n==============================");
    console.log("▶ Scenario:", sc.name);
    console.log("==============================");

    // Each scenario simulates time steps
    for (const mark of sc.marks) {
      sc.trade.mark = mark;

      const r = profitR(sc.trade);
      console.log(
        `tick mark=${mark} R=${r.toFixed(2)} curStop=${sc.trade.currentStop ?? "n/a"}`
      );

      // THIS is the key call: guardrails -> executor -> adapter
      await applyTradeManagement(exchange, sc.trade as any, { mark });

      await sleep(250);
    }
  }

  console.log("\n✅ SIM DONE. Runner exiting.");
}

async function startTrading(opts: { exchange: ExchangeAdapter }) {
  // minimal starter: placeholder for the real trading loop
  const { exchange } = opts;
  // no-op for now; ensure the function exists to satisfy callers
  return Promise.resolve();
}

// Keep these reason strings stable — you already used them in the smoke test.
type TMAction = {
  reason: "tp1_partial" | "be" | "be_plus" | "runner_trail";
  closePct?: number;     // 0.5 means close 50%
  newStop?: number;      // new stop level
  profitR: number;
  oldStop: number;
};

export async function applyGuardrailsToTrade(params: {
  trade: TradeLike;
  lastPrice: number;
  adapter: ExchangeAdapter;
  // optional: for journaling
  onLog?: (line: Record<string, unknown>) => void;
  tm?: TradeManagementState;
}): Promise<{ ok: true } | { ok: false; err: string }> {
  const { trade, lastPrice, adapter, onLog, tm = {} as TradeManagementState } = params;

  const result = evaluateTradeManagement(trade, tm, lastPrice, DEFAULT_TM_PARAMS);
  const actions = result.actions as TMAction[];

  for (const a of actions) {
    onLog?.({
      kind: "tm_action",
      symbol: trade.symbol,
      tradeId: trade.id,
      reason: a.reason,
      closePct: a.closePct ?? null,
      newStop: a.newStop ?? null,
      profitR: a.profitR,
      oldStop: a.oldStop,
      ts: Date.now(),
    });

    // 1) partial close
    if (typeof a.closePct === "number" && a.closePct > 0) {
      const qtyToClose = roundQty(trade.size * a.closePct);
      if (qtyToClose > 0) {
        const reduceSide = trade.side === "long" ? "sell" : "buy";
        const r = await adapter.reducePosition({
          symbol: trade.symbol,
          side: reduceSide,
          qty: qtyToClose,
          reason: a.reason,
        });
        if (!r.ok) return { ok: false, err: `reducePosition failed: ${r.err}` };
      }
    }

    // 2) stop update (BE / BE+ / runner trail)
    if (typeof a.newStop === "number" && Number.isFinite(a.newStop)) {
      const r = await adapter.updateStop({
        symbol: trade.symbol,
        stopPrice: a.newStop,
        reason: a.reason,
      });
      if (!r.ok) return { ok: false, err: `updateStop failed: ${r.err}` };

      // Keep local trade state in sync (so next eval uses the updated stop)
      trade.currentStop = a.newStop;
    }
  }

  return { ok: true };
}

function roundQty(q: number): number {
  // basic safe rounding; later we’ll use exchange step sizes
  const r = Math.floor(q * 1000) / 1000;
  return r > 0 ? r : 0;
}
