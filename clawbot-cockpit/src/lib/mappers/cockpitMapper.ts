import type { CockpitSnapshot, EventLogItem, ObservedSymbolState } from "../types/cockpit";

function asRecord(value: unknown): Record<string, any> {
  if (value && typeof value === "object") return value as Record<string, any>;
  return {};
}

function firstDefined<T>(...values: T[]): T | undefined {
  return values.find((value) => value !== undefined && value !== null);
}

function buildObservedSymbols(state: Record<string, any>, status: Record<string, any>, observer: Record<string, any>): ObservedSymbolState[] {
  const activeSymbol = firstDefined(
    observer.activeSymbol,
    state.position?.symbol,
    status.symbol,
    "NO_SYMBOL"
  ) as string;

  const observedSymbols = Array.isArray(observer.observedSymbols)
    ? observer.observedSymbols
    : ["EURUSDT", "BTCUSDT"];

  const symbolsMap = asRecord(observer.symbols);

  return observedSymbols.map((symbol: string) => {
    const entry = asRecord(symbolsMap[symbol]);
    const calmstack = asRecord(entry.calmstack);
    const position = asRecord(entry.position);
    const engine = asRecord(entry.engine);

    return {
      symbol,
      bias_state: firstDefined(position.side, symbol === activeSymbol ? "UNAVAILABLE" : "WATCHING"),
      market_state: firstDefined(calmstack.posture, symbol === activeSymbol ? "UNAVAILABLE" : "WATCHING"),
      volatility_state: firstDefined(calmstack.band, "UNAVAILABLE"),
      observer_recommendation: firstDefined(calmstack.mode, symbol === activeSymbol ? "UNAVAILABLE" : "OBSERVE"),
      feed_status: engine.running ? "LIVE" : "STOPPED",
      active: symbol === activeSymbol,
    };
  });
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

    observedSymbols: buildObservedSymbols(state, status, observer),
  };
}

export function mapEventLogItem(data: unknown): EventLogItem {
  const row = asRecord(data);
  const state = asRecord(row.state);
  const calmstack = asRecord(state.calmstack);
  const position = asRecord(state.position);
  const lastAction = asRecord(state.lastAction);
  const supervisor = asRecord(state.supervisor);

  return {
    timestamp_utc: firstDefined(
      row.timestamp_utc,
      row.timestampUtc,
      supervisor.timestampUtc,
      "NO_TIME"
    ) as string,
    mode: firstDefined(
      row.mode,
      row.intelligenceMode,
      state.intelligenceMode,
      supervisor.mode,
      "NO_MODE"
    ) as string,
    symbol: firstDefined(
      row.symbol,
      position.symbol,
      "NO_SYMBOL"
    ) as string,
    market_state: firstDefined(
      row.market_state,
      calmstack.posture,
      "NO_STATE"
    ) as string,
    observer_recommendation: firstDefined(
      row.observer_recommendation,
      calmstack.mode,
      "NO_RECOMMENDATION"
    ) as string,
    finalAction: firstDefined(
      row.finalAction,
      lastAction.type,
      "NO_ACTION"
    ) as string,
    raw: data,
  };
}