import type { CockpitSnapshot, EventLogItem } from "../types/cockpit";

function asRecord(value: unknown): Record<string, any> {
  if (value && typeof value === "object") return value as Record<string, any>;
  return {};
}

function firstDefined<T>(...values: T[]): T | undefined {
  return values.find((value) => value !== undefined && value !== null);
}

export function mapSnapshot(statusData: unknown, observerData: unknown): CockpitSnapshot {
  const status = asRecord(statusData);
  const observer = asRecord(observerData);
  const state = asRecord(observer.state);

  const engine = asRecord(state.engine);
  const calmstack = asRecord(state.calmstack);
  const guardrail = asRecord(state.guardrail);
  const position = asRecord(state.position);
  const lastAction = asRecord(state.lastAction);
  const supervisor = asRecord(state.supervisor);

  return {
    runtime: {
      engine_state: firstDefined(status.engine_state, engine.bot, "UNAVAILABLE"),
      mode: firstDefined(status.mode, state.intelligenceMode, supervisor.mode, "UNAVAILABLE"),
      observe_lock: firstDefined(status.observe_lock, supervisor.observeOnly, true),
      timestamp_utc: firstDefined(
        status.timestamp_utc,
        supervisor.timestampUtc,
        new Date().toISOString()
      ),

      allowTrade: firstDefined(guardrail.allowTrade, supervisor.authorityGranted, false),
      finalAction: firstDefined(lastAction.type, "UNAVAILABLE"),
      block_reason: supervisor.observeOnly ? "OBSERVE_ONLY" : "UNAVAILABLE",
      guardrail_status: firstDefined(guardrail.mode, "UNAVAILABLE"),
      safeMode: firstDefined(calmstack.mode, "UNAVAILABLE"),
      execute: firstDefined(supervisor.authorityGranted, false),
      session_trade_cap: firstDefined(guardrail.maxTrades, "UNAVAILABLE"),
      remaining_trades: firstDefined(guardrail.remainingTrades, "UNAVAILABLE"),
    },

    intelligence: {
      bias_state: firstDefined(position.side, "UNAVAILABLE"),
      bias_strength: "UNAVAILABLE",
      market_state: firstDefined(calmstack.posture, "UNAVAILABLE"),
      truth_state: firstDefined(supervisor.supervisorNote, "UNAVAILABLE"),
      volatility_state: firstDefined(calmstack.band, "UNAVAILABLE"),
      observer_recommendation: firstDefined(calmstack.mode, "UNAVAILABLE"),
      reentry_state: firstDefined(engine.trade, "UNAVAILABLE"),
      structure_confirmed: firstDefined(position.open, "UNAVAILABLE"),
    },

    market: {
      symbol: firstDefined(position.symbol, status.symbol, "NO_SYMBOL"),
      feed_status: engine.running ? "LIVE" : "STOPPED",
      price: firstDefined(position.mark, "UNAVAILABLE"),
      spread: "UNAVAILABLE",
      chart_stream: "",
      active_timeframe: "UNAVAILABLE",
      timeframes: ["H1", "M15", "M5"],
      structure_overlay: [],
    },

    positions: {
      open_count: position.open ? 1 : 0,
      floating_pnl: "UNAVAILABLE",
    },
  };
}

export function mapEventLogItem(data: unknown): EventLogItem {
  const row = asRecord(data);

  const state = asRecord(row.state);
  const engine = asRecord(row.engine);
  const calmstack = asRecord(row.calmstack);
  const position = asRecord(row.position);
  const lastAction = asRecord(row.lastAction);
  const supervisor = asRecord(row.supervisor);

  const nestedState = asRecord(state);
  const nestedEngine = asRecord(nestedState.engine);
  const nestedCalmstack = asRecord(nestedState.calmstack);
  const nestedPosition = asRecord(nestedState.position);
  const nestedLastAction = asRecord(nestedState.lastAction);
  const nestedSupervisor = asRecord(nestedState.supervisor);

  return {
    timestamp_utc: firstDefined(
      row.timestamp_utc,
      row.timestampUtc,
      row.ts,
      state.timestamp_utc,
      nestedSupervisor.timestampUtc,
      supervisor.timestampUtc,
      "NO_TIME"
    ) as string,

    mode: firstDefined(
      row.mode,
      row.intelligenceMode,
      state.intelligenceMode,
      nestedSupervisor.mode,
      supervisor.mode,
      "NO_MODE"
    ) as string,

    symbol: firstDefined(
      row.symbol,
      position.symbol,
      state.symbol,
      nestedPosition.symbol,
      "NO_SYMBOL"
    ) as string,

    market_state: firstDefined(
      row.market_state,
      calmstack.posture,
      nestedCalmstack.posture,
      "NO_STATE"
    ) as string,

    observer_recommendation: firstDefined(
      row.observer_recommendation,
      calmstack.mode,
      nestedCalmstack.mode,
      "NO_RECOMMENDATION"
    ) as string,

    finalAction: firstDefined(
      row.finalAction,
      lastAction.type,
      nestedLastAction.type,
      "NO_ACTION"
    ) as string,

    raw: data,
  };
}