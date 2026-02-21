import { makePaperAdapter } from "../adapters/paperAdapter";
import { makeBinanceAdapter } from "../adapters/binanceAdapter";
import type { ExchangeAdapter } from "../adapters/exchange";

import { createIntel } from "../core/intel/index";

import {
  evaluateTradeManagement,
  DEFAULT_TM_PARAMS,
  type TradeLike,
  type TradeManagementState,
  type MgmtAction,
} from "../core/guardrails/tradeManagement";

import { createCalmstackV1 } from "../core/calmstack/calmstack";


import { applyTradeManagement } from "./applyTradeManagement";
import { SimTrade, buildScenarios, profitR } from "./simTrades";
import { entryGateAll } from "../core/guardrails/entryGate";
import type { Posture } from "../core/guardrails/posture";

function gateActionsByPosture(posture: Posture, actions: MgmtAction[]) {
  if (posture === "aggressive") return actions;

  if (posture === "balanced") {
    // freeze trailing only
    return actions.filter(a => a.reason !== "runner_trail");
  }

  // defensive: pure safety
  return actions.filter(a => a.reason === "be" || a.reason === "be_plus");
}

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
  function chooseVolMode(band: string | undefined, positionOpen: boolean) {
  if (band !== "extreme") return "NORMAL";
  return positionOpen ? "MANAGE_ONLY" : "PAUSE_ENTRIES";
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

const calm = createCalmstackV1({ maxTradesPerSession: 2 });

const exchangeName = (process.env.EXCHANGE ?? "paper").toLowerCase();
const mode = ((process.env.EXCHANGE ?? "paper").toLowerCase() as "sim" | "paper" | "live");
const intel = createIntel({ mode, exchange: exchangeName });
intel.setBot("running"); 
intel.setTrade("idle", false);

let recoveryTicks = 0;

const hb = setInterval(() => {
  emit("heartbeat",{
    ticks,
   });
}, 2000);

const stop = () => {
  clearInterval(hb);
  emit("runner_stopped");
  process.exit(0);
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

  const ex = makeExchange();

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
   let prevPrice: number | null = null;

  for (const mark of sc.marks)
 {
  (sc.trade as SimTrade).mark = mark;
  
// --- VOL FEED (tick-based TR proxy) ---
const price =
  typeof mark === "number"
    ? mark
    : Number((mark as any)?.price ?? (mark as any)?.mark ?? (mark as any)?.last ?? 0);

  if (price > 0) {
  const tr = prevPrice == null ? 0 : Math.abs(price - prevPrice);
  intel.updateVol({ tr, price });  // ✅ ATR + band updates
  prevPrice = price;
}

intel.tick();

const tradeAny: any = sc.trade;

const snap = intel.snapshot(tradeAny);

const band = snap.state.vol.band;              // VolBand
const positionOpen = !!snap.state.positionOpen;

const cs = calm.step({
  band,
  positionOpen,
  mtfOk: false,          // TODO wire real signal
  locationOk: true,      // TODO wire real signal
  displacementOk: false, // TODO wire real signal
  uncertaintyClear: true,
  m15ArmId: null,
  postureOverride: (process.env.INTERNAL_MODE as any) || undefined,
});

emit("calmstack_v1", cs);

const posture = cs.posture;
emit("posture", { posture, band, positionOpen });

emit("intel", snap);

if (!sc.trade) {
  intel.setBot("idle");
  intel.setTrade("idle", false);
  await sleep(150);
  continue;

}
  intel.setTrade(sc.trade ? "managing" : "idle", !!sc.trade);


  const t: any = sc.trade;
  const curStop =
    t.curStop ?? t.stop ?? t.sl ?? t.stopLoss ?? null;

  const r = profitR(sc.trade as SimTrade);
  
    emit("tick", {

    scenario: sc.name,
    mark,
    r: Number(r.toFixed(2)),
    curStop,
  });

  // posture already computed above
  const gate = entryGateAll({ posture, band, positionOpen });

  emit("gate", { posture, band, positionOpen, gate });

  if (!gate.allowAll) {
  emit("paused", { reason: gate.reason, posture, band, positionOpen });

  if (!positionOpen) {
    // ✅ flat: hard stop (no entry attempts)
    intel.setBot("paused");
    intel.setTrade("idle", false); // keep trade lifecycle sane while flat
    await sleep(150);
    continue; // skip eval + actions entirely
  }

  // ✅ in-position: manage-only
  // Keep bot running so BE/TP safety can still execute
  intel.setBot("running");
  intel.setTrade("managing", true);
  // DO NOT continue — allow evaluateTradeManagement to run
}
if (!cs.allowEntry && !positionOpen) {
  emit("paused", { reason: cs.skipReasons[0] ?? "calmstack blocked", cs });
  intel.setBot("paused");
  intel.setTrade("idle", false);
  await sleep(150);
  continue;
}
 // skip evaluateTradeManagement + applyTradeManagement

 // normalize trade shape (strip mark if present)
const raw: any = sc.trade;
let trade: TradeLike;

if (raw && typeof raw === "object" && "mark" in raw) {
  const { mark: _drop, ...rest } = raw;
  trade = toTradeLike(rest);
} else {
  trade = toTradeLike(raw);
}

// mark is the loop variable
const result = evaluateTradeManagement(trade, tm, mark, DEFAULT_TM_PARAMS);
  const gatedActions = gateActionsByPosture(posture, result.actions);

  if (band === "extreme") {
  emit("vol_gate", {
    band: band,
    posture,
    actionsIn: result.actions.length,
    actionsOut: gatedActions.length,
  });
}

await applyTradeManagement(ex, trade, gatedActions);

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
  if (require.main === module) {
   run()
    .then(() => console.log("✅ runner finished"))
    .catch((err) => {
      console.error("❌ runner crashed:", err);
      process.exitCode = 1;
    });}
  }