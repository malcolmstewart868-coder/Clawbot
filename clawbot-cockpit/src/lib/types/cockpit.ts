export type RuntimeState = {
  engine_state?: string;
  mode?: string;
  observe_lock?: boolean | string;
  timestamp_utc?: string;
  allowTrade?: boolean;
  finalAction?: string;
  block_reason?: string;
  guardrail_status?: string;
  safeMode?: boolean | string;
  execute?: boolean;
  session_trade_cap?: number | string;
  remaining_trades?: number | string;
};

export type IntelligenceState = {
  bias_state?: string;
  bias_strength?: number | string;
  market_state?: string;
  truth_state?: string;
  volatility_state?: string;
  observer_recommendation?: string;
  reentry_state?: string;
  structure_confirmed?: boolean | string;
};

export type MarketState = {
  symbol?: string;
  feed_status?: string;
  price?: number | string;
  spread?: number | string;
  chart_stream?: string;
  active_timeframe?: string;
  timeframes?: string[];
  structure_overlay?: string[] | Record<string, unknown>;
};

export type PositionState = {
  open_count?: number;
  floating_pnl?: number | string;
};

export type ObservedSymbolState = {
  symbol: string;
  bias_state?: string;
  market_state?: string;
  volatility_state?: string;
  observer_recommendation?: string;
  feed_status?: string;
  active?: boolean;

  price?: number | string;
  allowTrade?: boolean;
  finalAction?: string;
  guardrail_status?: string;
  safeMode?: string;
  execute?: boolean;
  open_positions?: number;
  remaining_trades?: number | string;
};

export type CockpitSnapshot = {
  runtime?: RuntimeState;
  intelligence?: IntelligenceState;
  market?: MarketState;
  positions?: PositionState;
  observedSymbols?: ObservedSymbolState[];
};

export type EventLogItem = {
  timestamp_utc?: string;
  mode?: string;
  symbol?: string;
  market_state?: string;
  observer_recommendation?: string;
  finalAction?: string;
  raw?: unknown;
};