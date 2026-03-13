export type GuardrailMode = "READY" | "LOCKED_OBSERVE" | "COOLDOWN_MODE";

export type GuardrailOutput = {
  allowTrade: boolean;
  mode: GuardrailMode;
  maxTrades: number;
  remainingTrades: number;
  reason?: string;
};

export function createSessionGuardrail(opts?: { maxTrades?: number }) {
  const maxTrades = Math.max(1, Number(opts?.maxTrades ?? 2));
  let tradesTaken = 0;

  function snapshot(): GuardrailOutput {
  const remainingTrades = Math.max(0, maxTrades - tradesTaken);
  const locked = tradesTaken >= maxTrades;

  return {
    allowTrade: !locked,
    mode: locked ? "LOCKED_OBSERVE" : "READY",
    maxTrades,
    remainingTrades,
    reason: locked ? "max trades reached" : undefined,
  };
}

  return {
    snapshot,

    canTrade(): GuardrailOutput {
      return snapshot();
    },

    onTradeTaken(): GuardrailOutput {
      tradesTaken += 1;
      return snapshot();
    },

    resetSession(): GuardrailOutput {
      tradesTaken = 0;
      return snapshot();
    },
  };
}