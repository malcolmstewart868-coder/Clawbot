export type HaltReason =
  | "daily-loss-limit"
  | "insufficient-balance"
  | "rate-limit"
  | "auth-error"
  | "manual-halt";

export interface HaltState {
  halted: boolean;
  reason?: HaltReason;
  ts?: number;
}

export function createHalt(
  reason: HaltReason
): HaltState {
  return {
    halted: true,
    reason,
    ts: Date.now()
  };
}
