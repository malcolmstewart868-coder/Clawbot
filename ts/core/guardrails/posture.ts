// ts/core/guardrails/posture.ts

export type VolBand = "low" | "normal" | "high" | "extreme";
export type Posture = "aggressive" | "normal" | "defensive";

export function choosePosture(opts: {
  band: VolBand;
  positionOpen: boolean;
}): Posture {
  // If a position is already open, we don't restrict posture here;
  // management logic should continue regardless.
  if (opts.positionOpen) return "normal";

  // Volatility-based posture
  if (opts.band === "extreme") return "defensive";
  if (opts.band === "high") return "normal";
  if (opts.band === "low") return "aggressive";

  return "normal";
}