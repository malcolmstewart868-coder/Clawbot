export type BinanceBias = "BULLISH" | "BEARISH" | "NEUTRAL";

export type BinanceBiasMemory = {
  currentBias: BinanceBias;
  lastStrength: number;
  holdCount: number;
};

export type BinanceBiasInput = {
  symbol: string;
  h1Closes: number[];
  previous: BinanceBiasMemory;
};

export type BinanceBiasResult = {
  updatedMemory: BinanceBiasMemory;
  bias: BinanceBias;
  strength: number;
  fastSma: number | null;
  slowSma: number | null;
  slopePct: number;
  distancePct: number;
  reason: string;
};

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  const total = slice.reduce((sum, value) => sum + value, 0);
  return total / period;
}

function pctDiff(a: number, b: number): number {
  if (b === 0) return 0;
  return ((a - b) / b) * 100;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Bias Engine v1.0 (Canonical)
 * Binance-only perception layer
 *
 * Laws:
 * - Supports BULLISH / BEARISH / NEUTRAL
 * - Uses strength, not binary direction only
 * - Uses hysteresis so bias does not flip too easily
 */
export function evaluateBinanceBias(input: BinanceBiasInput): BinanceBiasResult {
  const { h1Closes, previous } = input;

  const fastSma = sma(h1Closes, 9);
  const slowSma = sma(h1Closes, 21);

if (fastSma === null || slowSma === null || h1Closes.length < 6) {
  return {
    bias: "NEUTRAL",
    strength: 0,
    fastSma,
    slowSma,
    slopePct: 0,
    distancePct: 0,
    reason: "INSUFFICIENT_H1_DATA",
    updatedMemory: {
      currentBias: "NEUTRAL",
      lastStrength: 0,
      holdCount: 0
    }
  };
}

  const last = h1Closes[h1Closes.length - 1]!;
  const prev5 = h1Closes[h1Closes.length - 6]!;
  const slopePct = pctDiff(last, prev5);
  const distancePct = pctDiff(fastSma, slowSma);

  const upStructure = fastSma > slowSma && slopePct > 0;
  const downStructure = fastSma < slowSma && slopePct < 0;

  const rawStrength = Math.abs(distancePct) * 2 + Math.abs(slopePct) * 1.25;
  const strength = clamp01(rawStrength / 1.5);

  const weakThreshold = 0.22;
  const confirmThreshold = 0.35;
  const flipThreshold = 0.5;

  let nextBias: BinanceBias = "NEUTRAL";
  let reason = "NEUTRAL_RANGE";

  if (upStructure && strength >= confirmThreshold) {
    nextBias = "BULLISH";
    reason = "UP_STRUCTURE_CONFIRMED";
  } else if (downStructure && strength >= confirmThreshold) {
    nextBias = "BEARISH";
    reason = "DOWN_STRUCTURE_CONFIRMED";
  } else if (strength < weakThreshold) {
    nextBias = "NEUTRAL";
    reason = "LOW_STRENGTH_NEUTRAL";
  }

  // Hysteresis / bias memory:
  // keep prior bias unless opposite side is meaningfully strong
  if (previous.currentBias === "BULLISH" && nextBias === "BEARISH" && strength < flipThreshold) {
    nextBias = "NEUTRAL";
    reason = "BULLISH_RELEASE_TO_NEUTRAL";
  }

  if (previous.currentBias === "BEARISH" && nextBias === "BULLISH" && strength < flipThreshold) {
    nextBias = "NEUTRAL";
    reason = "BEARISH_RELEASE_TO_NEUTRAL";
  }

return {
  bias: nextBias,
  strength: Number(strength.toFixed(4)),
  fastSma: Number(fastSma.toFixed(2)),
  slowSma: Number(slowSma.toFixed(2)),
  slopePct: Number(slopePct.toFixed(4)),
  distancePct: Number(distancePct.toFixed(4)),
  reason,
  updatedMemory: {
  currentBias: nextBias,
  lastStrength: strength,
  holdCount: previous.currentBias === nextBias ? previous.holdCount + 1 : 1,
  }
 };
}