/**
 * Volatility Detector v1.1 — Crypto-Tuned
 *
 * Purpose:
 * Detect crypto-native market behavior using:
 * - range expansion vs previous candles
 * - wick-to-body instability
 * - displacement sequences
 * - compression behavior
 *
 * Compatibility:
 * Returns the existing engine states:
 * - NORMAL
 * - ELEVATED
 * - UNSTABLE
 *
 * Also returns crypto labels for richer logging:
 * - COMPRESSION
 * - STRUCTURED
 * - EXPANSION
 */

export const VOLATILITY_STATES = ["NORMAL", "ELEVATED", "UNSTABLE"] as const;
export type VolatilityState = (typeof VOLATILITY_STATES)[number];

export type CryptoVolatilityLabel = "COMPRESSION" | "STRUCTURED" | "EXPANSION";

export interface CandleLike {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface VolatilityReason {
  code: string;
  message: string;
}

export interface VolatilityDetectorInput {
  symbol?: string;
  h1?: CandleLike[];
  m15?: CandleLike[];
  m5?: CandleLike[];
}

export interface VolatilityDetectorResult {
  state: VolatilityState;
  score: number;
  cryptoLabel: CryptoVolatilityLabel;
  reasons: VolatilityReason[];
  timestampUtc: string;
  version: string;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function reason(code: string, message: string): VolatilityReason {
  return { code, message };
}

function candleRange(c: CandleLike): number {
  return Math.max(0, c.high - c.low);
}

function candleBody(c: CandleLike): number {
  return Math.abs(c.close - c.open);
}

function wickToBodyRatio(c: CandleLike): number {
  const body = candleBody(c);
  const range = candleRange(c);

  if (range <= 0) return 0;
  if (body <= 0) return range > 0 ? 3 : 0;

  const wick = Math.max(0, range - body);
  return wick / body;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function getRecent<T>(values: T[] | undefined, count: number): T[] {
  if (!values || values.length === 0) return [];
  return values.slice(-count);
}

function countDisplacementCandles(candles: CandleLike[]): number {
  if (candles.length < 2) return 0;

  const ranges = candles.map(candleRange);
  const avgRange = average(ranges);

  let count = 0;
  for (const c of candles) {
    const body = candleBody(c);
    const range = candleRange(c);
    const bodyDominant = range > 0 ? body / range >= 0.65 : false;
    const expanded = range >= avgRange * 1.35;

    if (bodyDominant && expanded) count += 1;
  }

  return count;
}

function detectCompression(candles: CandleLike[]): boolean {
  if (candles.length < 5) return false;

  const recent = getRecent(candles, 5);
  const prior = candles.slice(-15, -5);

  if (prior.length < 5) return false;

  const recentAvgRange = average(recent.map(candleRange));
  const priorAvgRange = average(prior.map(candleRange));
  const recentAvgWickRatio = average(recent.map(wickToBodyRatio));

  return (
    recentAvgRange <= priorAvgRange * 0.8 &&
    recentAvgWickRatio < 1.2
  );
}

function detectImpulseExpansion(candles: CandleLike[]): boolean {
  if (candles.length < 3) return false;

  const recent = getRecent(candles, 3);
  const ranges = candles.map(candleRange);
  const avgRange = average(ranges);

  let impulseCount = 0;
  for (const c of recent) {
    const range = candleRange(c);
    const body = candleBody(c);
    const bodyDominant = range > 0 ? body / range >= 0.7 : false;

    if (range >= avgRange * 1.6 && bodyDominant) {
      impulseCount += 1;
    }
  }

  return impulseCount >= 2;
}

export function detectVolatility(
  input: VolatilityDetectorInput,
): VolatilityDetectorResult {
  const h1 = input.h1 ?? [];
  const m15 = input.m15 ?? [];
  const m5 = input.m5 ?? [];

  const reasons: VolatilityReason[] = [];

  const m5Recent = getRecent(m5, 10);
  const m15Recent = getRecent(m15, 10);
  const h1Recent = getRecent(h1, 10);

  if (m5Recent.length < 5 || m15Recent.length < 5) {
    return {
      state: "NORMAL",
      score: 0,
      cryptoLabel: "COMPRESSION",
      reasons: [
        reason(
          "INSUFFICIENT_DATA",
          "Not enough candle data to compute crypto volatility reliably.",
        ),
      ],
      timestampUtc: new Date().toISOString(),
      version: "v1.1",
    };
  }

  const m5AvgRange = average(m5Recent.map(candleRange));
  const m15AvgRange = average(m15Recent.map(candleRange));
  const h1AvgRange = average(h1Recent.map(candleRange));

  const latestM5 = m5Recent[m5Recent.length - 1]!;
  const latestM15 = m15Recent[m15Recent.length - 1]!;

  const latestM5Range = candleRange(latestM5);
  const latestM15Range = candleRange(latestM15);

  const m5RangeExpansion = m5AvgRange > 0 ? latestM5Range / m5AvgRange : 1;
  const m15RangeExpansion = m15AvgRange > 0 ? latestM15Range / m15AvgRange : 1;

  const m5WickRatio = wickToBodyRatio(latestM5);
  const m15WickRatio = wickToBodyRatio(latestM15);

  const m5DisplacementCount = countDisplacementCandles(m5Recent);
  const m15DisplacementCount = countDisplacementCandles(m15Recent);

  const compressionDetected = detectCompression(m5);
  const impulseExpansionDetected = detectImpulseExpansion(m5) || detectImpulseExpansion(m15);

  let rawScore = 0;

  // Range expansion scoring
  if (m5RangeExpansion >= 1.15) {
    rawScore += 0.15;
    reasons.push(
      reason("M5_RANGE_EXPANSION", "M5 candle range is expanding versus recent average."),
    );
  }

  if (m5RangeExpansion >= 1.5) {
    rawScore += 0.15;
    reasons.push(
      reason("M5_RANGE_SURGE", "M5 range surge detected."),
    );
  }

  if (m15RangeExpansion >= 1.15) {
    rawScore += 0.15;
    reasons.push(
      reason("M15_RANGE_EXPANSION", "M15 candle range is expanding versus recent average."),
    );
  }

  if (m15RangeExpansion >= 1.45) {
    rawScore += 0.15;
    reasons.push(
      reason("M15_RANGE_SURGE", "M15 range surge detected."),
    );
  }

  // Wick/body instability
  if (m5WickRatio >= 1.5) {
    rawScore += 0.08;
    reasons.push(
      reason("M5_WICK_INSTABILITY", "M5 wick-to-body ratio suggests unstable movement."),
    );
  }

  if (m15WickRatio >= 1.5) {
    rawScore += 0.08;
    reasons.push(
      reason("M15_WICK_INSTABILITY", "M15 wick-to-body ratio suggests unstable movement."),
    );
  }

  // Displacement scoring
  if (m5DisplacementCount >= 2) {
    rawScore += 0.12;
    reasons.push(
      reason("M5_DISPLACEMENT_SEQUENCE", "Multiple M5 displacement candles detected."),
    );
  }

  if (m15DisplacementCount >= 2) {
    rawScore += 0.12;
    reasons.push(
      reason("M15_DISPLACEMENT_SEQUENCE", "Multiple M15 displacement candles detected."),
    );
  }

  // Impulse expansion
  if (impulseExpansionDetected) {
    rawScore += 0.2;
    reasons.push(
      reason("IMPULSE_EXPANSION", "Impulse expansion detected across recent candles."),
    );
  }

  // Compression reduces score
  if (compressionDetected) {
    rawScore -= 0.2;
    reasons.push(
      reason("COMPRESSION_DETECTED", "Recent candle behavior suggests compression."),
    );
  }

  // Gentle H1 contextual influence
  if (h1AvgRange > 0 && m15AvgRange > h1AvgRange * 0.45) {
    rawScore += 0.05;
    reasons.push(
      reason("H1_CONTEXT_ACTIVE", "Lower timeframe movement is large relative to H1 context."),
    );
  }

  const score = clamp01(rawScore);

  let cryptoLabel: CryptoVolatilityLabel = "STRUCTURED";
  let state: VolatilityState = "ELEVATED";

  if (score < 0.28) {
    cryptoLabel = "COMPRESSION";
    state = "NORMAL";
  } else if (score < 0.68) {
    cryptoLabel = "STRUCTURED";
    state = "ELEVATED";
  } else {
    cryptoLabel = "EXPANSION";
    state = "UNSTABLE";
  }

  if (reasons.length === 0) {
    reasons.push(
      reason("DEFAULT_STRUCTURED", "No major instability or compression signal dominated."),
    );
  }

  return {
    state,
    score: Number(score.toFixed(4)),
    cryptoLabel,
    reasons,
    timestampUtc: new Date().toISOString(),
    version: "v1.1",
  };
}