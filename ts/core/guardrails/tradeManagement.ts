export interface TradeManagementState {
  beApplied: boolean;
  bePlusApplied: boolean;
  runnerActive: boolean;
}

export const DEFAULT_TM_STATE: TradeManagementState = {
  beApplied: false,
  bePlusApplied: false,
  runnerActive: false
};

// Logic will be added in Guardrails v1.1 implementation
