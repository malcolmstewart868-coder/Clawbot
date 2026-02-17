import { makePaperAdapter } from "../adapters/paperAdapter";
import { makeBinanceAdapter } from "../adapters/binanceAdapter";
import type { ExchangeAdapter } from "../adapters/exchange";
import { createIntel } from "../core/intel";

import {
  evaluateTradeManagement,
  DEFAULT_TM_PARAMS,
} from "../core/guardrails/tradeManagement";

import type { TradeLike, TradeManagementState } from "../core/guardrails/tradeManagement";

import { applyTradeManagement } from "./applyTradeManagement";
import { SimTrade } from "./simTrades";
import { buildScenarios, profitR } from "./simTrades";
function emit(event: string, payload: any = {}) {
  console.log(
    JSON.stringify({
      ts: Date.now(),
      event,
      ...payload,
    })
  );
}

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

function toTradeLike(t: any): TradeLike {
  // Ensure side is exactly "long" | "short"
  return { ...t, side: toSide(t.side) };
}

export async function run() { let ticks = 0;

const mode = ((process.env.EXCHANGE ?? "paper").toLowerCase() as "sim" | "paper" | "live");
const intel = createIntel({ mode, exchange: mode });

const hb = setInterval(() => {
  emit("heartbeat",{
    ticks,
    mode: process.env.MODE ?? "sim",
    exchange: (process.env.EXCHANGE ?? "paper").toLowerCase(),
  });
}, 2000);

const stop = () => {
  clearInterval(hb);
  emit("runner_stopped");
  process.exit(0);
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

  const exchange = makeExchange();

  emit("runner_started", { mode: "sim" });

  console.log(`🔧 EXCHANGE=${(process.env.EXCHANGE ?? "paper").toLowerCase()}`);

  const scenarios = buildScenarios();

for (const sc of scenarios) {
  console.log("\n==============================");
  console.log("▶ Scenario:", sc.name);
  console.log("==============================");

  const tm: TradeManagementState = {
    beApplied: false,
    bePlusApplied: false,
    tp1Done: false,
    runnerActive: false,
  };

  for (const mark of sc.marks)
 {
  (sc.trade as SimTrade).mark = mark;

  
ticks++;
intel.tick();

const tradeAny: any = sc.trade;
if (!sc.trade) intel.setState("idle");
const snap = intel.snapshot(tradeAny);

emit("intel", snap);

if (snap.state === "idle") {
  await sleep(150);
  continue;
}

  const t: any = sc.trade;
  const curStop =
    t.curStop ?? t.stop ?? t.sl ?? t.stopLoss ?? null;

  const r = profitR(sc.trade as SimTrade);
  
  const hb = setInterval(() => {
  emit("heartbeat", {
    ts: Date.now(),
    ticks,
    mode: process.env.MODE ?? "sim",
    exchange: (process.env.EXCHANGE ?? "paper").toLowerCase(),
  });
}, 2000);

  emit("tick", {

    scenario: sc.name,
    mark,
    r: Number(r.toFixed(2)),
    curStop,
  });
  const { mark: _m, ...tradeLike } = sc.trade as SimTrade;
  const trade: TradeLike = toTradeLike(tradeLike);

  const result = evaluateTradeManagement(trade, tm, mark, DEFAULT_TM_PARAMS);

  await applyTradeManagement(exchange, trade, result.actions);

  sc.trade.currentStop = trade.currentStop;

 }
// ---- service mode: keep alive after normal run ----
if ((process.env.RUN_FOREVER ?? "0") === "1") {
  emit("idle", { ts: Date.now(), note: "runner alive; waiting" });
  // keep process alive
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await sleep(1000);
  }
}

}
  clearInterval(hb);
  emit("runner_stopped");

}// ---- main entry (so ts-node actually runs the runner) ----
  if (require.main === module) {
  run()
    .then(() => {
      console.log("✅ runner finished");
    })
    .catch((err) => {
      console.error("❌ runner crashed:", err);
      process.exitCode = 1;
    });
  }
