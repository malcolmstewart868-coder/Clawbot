export type Side = "long" | "short";

export interface TradeLike {
  id: string;
  symbol: string;
  side: Side;
  entry: number;
  initialStop: number;
  currentStop?: number | null;
  size: number; // current open size (units/contracts)
}

export interface TradeManagementState {
  beApplied: boolean;
  bePlusApplied: boolean;
  tp1Done: boolean;
  runnerActive: boolean;
}

export const DEFAULT_TM_STATE: TradeManagementState = {
  beApplied: false,
  bePlusApplied: false,
  tp1Done: false,
  runnerActive: false
};

export interface TradeManagementParams {
  feeBufferR: number; // default 0.05R
  beTriggerR: number; // default 1.0R
  bePlusTriggerR: number; // default 1.5R
  bePlusLockR: number; // default 0.25R
  tp1R: number; // default 1.0R
  tp1ClosePct: number; // default 0.5 (50%)
  runnerTrailBufferR: number; // default 0.5R behind swing
}

export const DEFAULT_TM_PARAMS: TradeManagementParams = {
  feeBufferR: 0.05,
  beTriggerR: 1.0,
  bePlusTriggerR: 1.5,
  bePlusLockR: 0.25,
  tp1R: 1.0,
  tp1ClosePct: 0.5,
  runnerTrailBufferR: 0.5
};

export interface SwingPoint {
  // For long: last confirmed swingLow
  // For short: last confirmed swingHigh
  price: number;
  ts?: number;
}

export type MgmtActionReason =
  | "tp1_partial"
  | "be"
  | "be_plus"
  | "runner_trail";

export interface MgmtAction {
  reason: MgmtActionReason;
  // If defined, executor may move stop to this value (after validation with venue rules).
  newStop?: number;
  // If defined, executor may close this fraction of current position size (0..1).
  closePct?: number;
  // Helpful for logs
  profitR: number;
  oldStop?: number | null;
}

export interface MgmtResult {
  nextState: TradeManagementState;
  actions: MgmtAction[];
  profitR: number;
  R: number;
}

/**
 * 1R = abs(entry - initialStop)
 * profitR is signed so it is positive in profit direction for both long and short.
 */
export function computeR(trade: TradeLike): number {
  return Math.abs(trade.entry - trade.initialStop);
}

export function computeProfitR(trade: TradeLike, currentPrice: number): number {
  const R = computeR(trade);
  if (R === 0) return 0;

  if (trade.side === "long") return (currentPrice - trade.entry) / R;
  return (trade.entry - currentPrice) / R;
}

function tightenStopOnly(
  side: Side,
  currentStop: number | null | undefined,
  proposedStop: number
): number | undefined {
  if (currentStop == null) return proposedStop;

  // long: tighter stop means higher stop
  if (side === "long") return proposedStop > currentStop ? proposedStop : undefined;

  // short: tighter stop means lower stop
  return proposedStop < currentStop ? proposedStop : undefined;
}

function clampPct01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/**
 * Returns management actions (partial close + stop moves) and updated state.
 * This function does NOT place orders; it only returns instructions.
 */
export function evaluateTradeManagement(
  trade: TradeLike,
  tm: TradeManagementState,
  currentPrice: number,
  params: TradeManagementParams = DEFAULT_TM_PARAMS,
  swing?: SwingPoint
): MgmtResult {
  const R = computeR(trade);
  const profitR = computeProfitR(trade, currentPrice);

  const actions: MgmtAction[] = [];
  const oldStop = trade.currentStop ?? null;

  // If R is invalid, do nothing safely.
  if (R <= 0 || !Number.isFinite(R)) {
    return { nextState: tm, actions, profitR, R };
  }

  // --- Block B: TP1 partial + runner creation
  let nextState: TradeManagementState = { ...tm };

  if (!nextState.tp1Done && profitR >= params.tp1R) {
    actions.push({
      reason: "tp1_partial",
      closePct: clampPct01(params.tp1ClosePct),
      profitR,
      oldStop
    });

    nextState.tp1Done = true;
    nextState.runnerActive = true;
  }

  // --- Block C: Apply BE
  // Stop = entry + sign * (feeBufferR * R)
  if (!nextState.beApplied && profitR >= params.beTriggerR) {
    const sign = trade.side === "long" ? +1 : -1;
    const proposed = trade.entry + sign * (params.feeBufferR * R);

    const tightened = tightenStopOnly(trade.side, oldStop, proposed);
    if (tightened !== undefined) {
      actions.push({
        reason: "be",
        newStop: tightened,
        profitR,
        oldStop
      });
      nextState.beApplied = true;
    }
  }

  // --- Block D: Apply BE+
  // Stop = entry + sign * ((bePlusLockR + feeBufferR) * R)
  if (!nextState.bePlusApplied && profitR >= params.bePlusTriggerR) {
    const sign = trade.side === "long" ? +1 : -1;
    const proposed =
      trade.entry + sign * ((params.bePlusLockR + params.feeBufferR) * R);

    // use the most recent stop if we already planned a BE move
    const latestStop =
      actions
        .slice()
        .reverse()
        .find(a => a.newStop !== undefined)?.newStop ?? oldStop;

    const tightened = tightenStopOnly(trade.side, latestStop ?? null, proposed);
    if (tightened !== undefined) {
      actions.push({
        reason: "be_plus",
        newStop: tightened,
        profitR,
        oldStop: latestStop ?? oldStop
      });
      nextState.bePlusApplied = true;
    }
  }

  // --- Block E: Runner trail (swing mode)
  // Only when runner is active and after BE+ trigger level
  if (nextState.runnerActive && profitR >= params.bePlusTriggerR && swing) {
    const latestStop =
      actions
        .slice()
        .reverse()
        .find(a => a.newStop !== undefined)?.newStop ?? oldStop;

    let proposed: number;
    if (trade.side === "long") {
      proposed = swing.price - params.runnerTrailBufferR * R;
    } else {
      proposed = swing.price + params.runnerTrailBufferR * R;
    }

    const tightened = tightenStopOnly(trade.side, latestStop ?? null, proposed);
    if (tightened !== undefined) {
      actions.push({
        reason: "runner_trail",
        newStop: tightened,
        profitR,
        oldStop: latestStop ?? oldStop
      });
    }
  }

  return { nextState, actions, profitR, R };
}
