export interface RiskLimits {
  maxRiskPerTradePct: number;   // e.g. 0.5
  dailyLossLimitPct: number;    // e.g. 1.5
  maxConcurrentTrades: number;
}

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxRiskPerTradePct: 0.5,
  dailyLossLimitPct: 1.5,
  maxConcurrentTrades: 2
};
