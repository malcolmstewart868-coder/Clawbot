export type BlackBoxEventType =
  | "runner_started"
  | "session_change"
  | "intel_snapshot"
  | "gate_eval"
  | "calmstack_eval"
  | "trade_management_eval"
  | "action_applied"
  | "paused"
  | "runner_stopped";

export type BlackBoxEvent = {
  ts: number;
  type: BlackBoxEventType;
  session?: string;
  scenario?: string;

  engine?: {
    bot?: string;
    trade?: string;
    running?: boolean;
  };

  calmstack?: {
    posture?: string;
    mode?: string;
    allowEntry?: boolean;
    band?: string;
    tradesTaken?: number;
    skipReasons?: string[];
  };

  guardrail?: {
    allowTrade?: boolean;
    mode?: string;
    maxTrades?: number;
    remainingTrades?: number;
    reason?: string;
  };

  position?: {
    open?: boolean;
    symbol?: string;
    side?: string;
    entry?: number;
    stop?: number | null;
    mark?: number | null;
  };

  action?: {
    type?: string;
    reason?: string;
  };

  meta?: Record<string, unknown>;
};
