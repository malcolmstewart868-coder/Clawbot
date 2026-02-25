export { choosePosture } from "./posture";
export type { Posture, VolBand } from "./posture";
export * from "./entryGate";
export * from "./sessions";
export * from "./riskLimits";
export * from "./haltRules";
export * from "./tradeManagement";
// ts/core/guardrails/index.ts

export type TradeLike = {
  symbol?: string;
  entry?: number;
  stop?: number;
  size?: number;
  mark?: number;
};

export type TradeManagementState = {
  tp1Done: boolean;
  runnerActive: boolean;
};
