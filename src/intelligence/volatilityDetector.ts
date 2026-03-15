/**
 * Canonical v1 — Clawbot Volatility Detector
 *
 * Purpose:
 * Classify market turbulence into a small, controlled state model:
 *
 * NORMAL
 * ELEVATED
 * UNSTABLE
 *
 * Why this matters:
 * The detector is the first layer of the volatility governor.
 * It should stay simple, deterministic, and easy to test.
 *
 * Status:
 * Shadow-safe.
 * No direct engine wiring is performed here.
 */

export const VOLATILITY_STATES = [
  "NORMAL",
  "ELEVATED",
  "UNSTABLE",
] as const;

export type VolatilityState = (typeof VOLATILITY_STATES)[number];

export interface VolatilityDetectorInput {
  /**
   * Current range expansion relative to expected structure.
   * Suggested normalized scale: 0..n
   */
  rangeExpansion: number;

  /**
   * ATR spike relative to baseline.
   * Suggested normalized scale: 0..n
   */
  atrRatio: number;

  /**
   * Frequency or intensity of liquidity sweeps.
   * Suggested normalized scale: 0..n
   */
  sweepFrequency: number;

  /**
   * Frequency of possible invalidation / structural weakening.
   * Suggested normalized scale: 0..n
   */
  invalidationFrequency: number;

  /**
   * Optional spread / slippage stress indicator.
   * Suggested normalized scale: 0..n
   */
  spreadStress?: number;

  /**
   * Optional session-transition turbulence flag.
   */
  sessionTransition?: boolean;

  /**
   * Optional metadata for tracing.
   */
  metadata?: Record<string, unknown>;
}

export interface VolatilityReason {
  code: string;
  message: string;
}

export interface VolatilityDetectionResult {
  state: VolatilityState;
  score: number;
  reasons: VolatilityReason[];
  timestampUtc: string;
  version: string;
  metadata?: Record<string, unknown>;
}

/**
 * Clamp a numeric value to >= 0.
 */
function normalizeMetric(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, value);
}

function reason(code: string, message: string): VolatilityReason {
  return { code, message };
}

/**
 * Canonical v1 scoring model
 *
 * Weighted score:
 * - range expansion
 * - ATR ratio
 * - sweep frequency
 * - invalidation frequency
 * - spread stress
 * - session transition bump
 *
 * State thresholds:
 * - NORMAL:   score < 4
 * - ELEVATED: score >= 4 and < 7
 * - UNSTABLE: score >= 7
 */
export function detectVolatility(
  input: VolatilityDetectorInput,
): VolatilityDetectionResult {
  const rangeExpansion = normalizeMetric(input.rangeExpansion);
  const atrRatio = normalizeMetric(input.atrRatio);
  const sweepFrequency = normalizeMetric(input.sweepFrequency);
  const invalidationFrequency = normalizeMetric(input.invalidationFrequency);
  const spreadStress = normalizeMetric(input.spreadStress);
  const sessionTransition = Boolean(input.sessionTransition);

  const reasons: VolatilityReason[] = [];

  const score =
    rangeExpansion * 1.2 +
    atrRatio * 1.2 +
    sweepFrequency * 1.0 +
    invalidationFrequency * 1.4 +
    spreadStress * 0.8 +
    (sessionTransition ? 1.0 : 0);

  if (rangeExpansion >= 1.5) {
    reasons.push(
      reason(
        "RANGE_EXPANSION_ELEVATED",
        "Range expansion is elevated relative to expected structure.",
      ),
    );
  }

  if (atrRatio >= 1.5) {
    reasons.push(
      reason(
        "ATR_SPIKE_ELEVATED",
        "ATR is elevated relative to baseline.",
      ),
    );
  }

  if (sweepFrequency >= 1.5) {
    reasons.push(
      reason(
        "SWEEP_ACTIVITY_ELEVATED",
        "Liquidity sweep activity is elevated.",
      ),
    );
  }

  if (invalidationFrequency >= 1.5) {
    reasons.push(
      reason(
        "INVALIDATION_ACTIVITY_ELEVATED",
        "Invalidation frequency is elevated.",
      ),
    );
  }

  if (spreadStress >= 1.5) {
    reasons.push(
      reason(
        "SPREAD_STRESS_ELEVATED",
        "Spread or slippage stress is elevated.",
      ),
    );
  }

  if (sessionTransition) {
    reasons.push(
      reason(
        "SESSION_TRANSITION_TURBULENCE",
        "Session transition turbulence is active.",
      ),
    );
  }

  let state: VolatilityState = "NORMAL";

  if (score >= 7) {
    state = "UNSTABLE";
  } else if (score >= 4) {
    state = "ELEVATED";
  }

  if (reasons.length === 0) {
    reasons.push(
      reason(
        "VOLATILITY_NORMAL",
        "Volatility conditions are within normal operational range.",
      ),
    );
  }

  return {
    state,
    score: Number(score.toFixed(2)),
    reasons,
    timestampUtc: new Date().toISOString(),
    version: "v1",
    metadata: input.metadata,
  };
}