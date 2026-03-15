  import { updateObserverState } from "../api/observerState";
  import { makePaperAdapter } from "../adapters/paperAdapter";
  import { makeBinanceAdapter } from "../adapters/binanceAdapter";
  import type { ExchangeAdapter } from "../adapters/exchange";

  import { createIntel } from "../core/intel/index";

  import { createCalmstackV1 } from "../core/calmstack";

  import {
  evaluateTradeManagement,
  DEFAULT_TM_PARAMS,
  type TradeLike,
  type TradeManagementState,
  type MgmtAction,
  } from "../core/guardrails/tradeManagement";

  import { applyTradeManagement } from "./applyTradeManagement";
  import { SimTrade, buildScenarios, profitR } from "./simTrades";
  import { entryGateAll } from "../core/guardrails/entryGate";
  import type { Posture } from "../core/guardrails/posture";
  import { getSessionId, nowUtcMinus4, ymdKeyUtcMinus4, type SessionId } from "../core/guardrails/sessions";
  import { BlackBoxRecorder } from "../core/blackbox";

  console.log("🔥 TOP-LEVEL runner.ts loaded");

  function gateActionsByPosture(posture: Posture, actions: MgmtAction[]) {
  if (posture === "aggressive") return actions;

  if (posture === "defensive") {
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

  function inputBandToString(v: unknown) {
  return typeof v === "string" ? v : String(v ?? "unknown");
  }

  export async function run() {
  
  console.log("🧪 run() entered");

  let ticks = 0;

  const blackbox = new BlackBoxRecorder("clawbot-session");

  const calm = createCalmstackV1({ maxTradesPerSession: 2 });

  const exchangeName = (process.env.EXCHANGE ?? "paper").toLowerCase();
  const mode = ((process.env.EXCHANGE ?? "paper").toLowerCase() as "sim" | "paper" | "live");
  const intel = createIntel({ mode, exchange: exchangeName });
  intel.setBot("running"); 
  intel.setTrade("idle", false);

  let activeSession: SessionId = "OFFSESSION";
  let dayKey = ymdKeyUtcMinus4(nowUtcMinus4());

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

  emit("runner_started", { mode });

  blackbox.record({
  ts: Date.now(),
  type: "runner_started",
  engine: {
    bot: "running",
    trade: "idle",
    running: true,
  },
  meta: { mode, exchangeName },
 });

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
  // ---- Session window tracking (UTC−4) ----
  const wall = nowUtcMinus4();
  const nextSession = getSessionId(wall);

  // Daily reset marker (we'll use this when we add daily counters)
  const nextDayKey = ymdKeyUtcMinus4(wall);
  if (nextDayKey !== dayKey) {
  dayKey = nextDayKey;
  // later: reset daily counters here
  emit("day_rollover", { dayKey });
  }

  // Session change → reset per-session trade cap
  if (nextSession !== activeSession) {
  const prev = activeSession;
  activeSession = nextSession;

  // Reset only when entering a real session (and/or when leaving one—your call)
  if (activeSession !== "OFFSESSION") {
   // calm.resetSession();
  }

  emit("session_change", { from: prev, to: activeSession });
  }
  const snap = intel.snapshot(tradeAny);

  const band = snap.state.vol.band;              // VolBand
  const positionOpen: boolean = !!snap.state.positionOpen;

  const cs = calm.step({
  band,
  positionOpen,
  mtfOk: true,          // TODO wire real signal
  locationOk: true,      // TODO wire real signal
  displacementOk: true, // TODO wire real signal
  uncertaintyClear: true,
  m15ArmId: null,
  postureOverride: undefined,
  });

  emit("calmstack_v1", cs);

  blackbox.record({
  ts: Date.now(),
  type: "calmstack_eval",
  session: activeSession,
  scenario: sc.name,
  calmstack: {
    posture: cs.posture,
    mode: cs.mode,
    allowEntry: cs.allowEntry,
    band: String(cs.band ?? band),
    tradesTaken: cs.tradesTaken,
    skipReasons: cs.skipReasons ?? [],
  },
  });

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

  const mtfOk = true;
  const locationOk = true;
  const displacementOk = true;
  const uncertaintyClear = true;


  const gate = entryGateAll({
  mtfOk,
  locationOk,
  displacementOk,
  uncertaintyClear,
  });

  emit("gate_eval", {
    allowTrade: gate.allowTrade,
    //mode: gate.mode,
    reason: gate.reason,
    posture, band, positionOpen, gate });

    blackbox.record({
    ts: Date.now(),
    type: "gate_eval",
    session: activeSession,
    scenario: sc.name,
    guardrail: {
    allowTrade: gate.allowTrade,
    mode: cs.guardrail?.mode ?? "unknown",
    maxTrades: cs.guardrail?.maxTrades ?? 0,
    remainingTrades: cs.guardrail?.remainingTrades ?? 0,
    reason: gate.reason,
    },
    position: {
    open: !!snap.state.positionOpen,
    symbol: snap.trade?.symbol,
    side: snap.trade?.side,
    entry: snap.trade?.entry,
    stop: snap.trade?.currentStop ?? snap.trade?.initialStop ?? null,
    mark: snap.trade?.mark ?? null,
    },
    });

    updateObserverState({
  engine: {
    bot: snap.state.bot,
    trade: snap.state.trade,
    session: activeSession,
    running: true,
  },
  calmstack: {
    posture: cs.posture,
    mode: cs.mode,
    allowEntry: cs.allowEntry,
    band: inputBandToString(cs.band ?? band),
    tradesTaken: cs.tradesTaken,
    skipReasons: cs.skipReasons ?? [],
  },
  guardrail: {
    allowTrade: gate.allowTrade,
    mode: cs.guardrail?.mode ?? "unknown",
    maxTrades: cs.guardrail?.maxTrades ?? 0,
    remainingTrades: cs.guardrail?.remainingTrades ?? 0,
  },
  position: {
    open: !!snap.state.positionOpen,
    symbol: snap.trade?.symbol,
    side: snap.trade?.side,
    entry: snap.trade?.entry,
    stop: snap.trade?.currentStop ?? snap.trade?.initialStop ?? null,
    mark: snap.trade?.mark ?? null,
  },
  });

  if (!gate.allowTrade) {
  emit("paused", { reason: gate.reason, posture, band, positionOpen });

    blackbox.record({
    ts: Date.now(),
    type: "paused",
    session: activeSession,
    scenario: sc.name,
    engine: {
    bot: "paused",
    trade: positionOpen ? "managing" : "idle",
    running: true,
    },
    guardrail: {
    allowTrade: gate.allowTrade,
    reason: gate.reason,
    },
    calmstack: {
    posture,
    mode: cs.mode,
    allowEntry: cs.allowEntry,
    band: String(cs.band ?? band),
    skipReasons: cs.skipReasons ?? [],
    },
    });

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
    band,
    posture,
    actionsIn: result.actions.length,
    actionsOut: gatedActions.length,
  });
  }

  if (gatedActions.length > 0) {
  const last = gatedActions.at(-1);

  if (last) {
    updateObserverState({
      lastAction: {
        type: last.reason ?? "action",
        reason: last.reason,
      },
    });
  }
}

await applyTradeManagement(ex, trade, gatedActions);
const last = gatedActions.at(-1);

    blackbox.record({
    ts: Date.now(),
    type: "action_applied",
    session: activeSession,
    scenario: sc.name,
    action: {
    type: last?.reason ?? "none",
    reason: last?.reason,
    },
    position: {
    open: !!snap.state.positionOpen,
    symbol: snap.trade?.symbol,
    side: snap.trade?.side,
    entry: snap.trade?.entry,
    stop: snap.trade?.currentStop ?? snap.trade?.initialStop ?? null,
    mark: snap.trade?.mark ?? null,
    },
    });

} // closes: for (const mark of sc.marks)
} // closes: for (const sc of scenarios)



  // ---- service mode: keep alive after normal run ----
  if ((process.env.RUN_FOREVER ?? "0") === "1") {
    emit("idle", { ts: Date.now(), note: "runner alive; waiting" });
    while (true) {
      await sleep(1000);
    }
  }

   clearInterval(hb);

   blackbox.record({
    ts: Date.now(),
    type: "runner_stopped",
    engine: {
    bot: "idle",
    trade: "idle",
    running: false,
    },
    meta: {
    file: blackbox.path(),
    },
    });

    emit("runner_stopped");
    } // <- closes run()

   console.log("🔥 bottom entrypoint reached");

   run()
  .then(() => console.log("✅ runner finished"))
  .catch((err) => {
    console.error("❌ runner crashed:", err);
    process.exitCode = 1;
  });
