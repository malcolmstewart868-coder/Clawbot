/**
 * Canonical v1 — Clawbot Re-entry Stabilizer
 *
 * Purpose:
 * Prevent intelligence authority from re-escalating too quickly after
 * unstable market conditions.
 *
 * Why this matters:
 * Without a stabilizer, the system can flap:
 *
 * ACTIVE -> SHADOW -> ACTIVE -> SHADOW
 *
 * The stabilizer requires sustained calm before mode upgrades occur.
 *
 * Status:
 * Shadow-safe.
 * No direct engine wiring is performed here.
 */

import type { IntelligenceMode } from "./intelligenceMode";
import type { VolatilityState } from "./volatilityDetector";

export interface ReentryStabilizerState {
  /**
   * Number of consecutive NORMAL checks.
   */
  stableCount: number;

  /**
   * Number of consecutive non-NORMAL checks.
   */
  unstableCount: number;

  /**
   * Current mode before stabilizer evaluation.
   */
  currentMode: IntelligenceMode;
}

export interface ReentryStabilizerInput {
  constantState: ReentryStabilizerState
  volatility: VolatilityState;
  state: ReentryStabilizerState;
}

export interface ReentryStabilizerReason {
  code: string;
  message: string;
}

export interface ReentryStabilizerResult {
  nextMode: IntelligenceMode;
  stableCount: number;
  unstableCount: number;
  upgraded: boolean;
  reset: boolean;
  reasons: ReentryStabilizerReason[];
  timestampUtc: string;
  version: string;
}

/**
 * Canonical v1 thresholds
 *
 * SHADOW -> ADVISORY requires 3 consecutive NORMAL checks
 * ADVISORY -> ACTIVE requires 5 consecutive NORMAL checks
 *
 * Any ELEVATED or UNSTABLE reading resets the stable streak.
 */
export const REENTRY_THRESHOLDS = {
  SHADOW_TO_ADVISORY: 3,
  ADVISORY_TO_ACTIVE: 5,
} as const;

function reason(code: string, message: string): ReentryStabilizerReason {
  return { code, message };
}

/**
 * Canonical v1 re-entry stabilizer.
 */
export function stabilizeReentry(
  input: ReentryStabilizerInput,
): ReentryStabilizerResult {
  const { volatility, state } = input;

  let stableCount = state.stableCount;
  let unstableCount = state.unstableCount;
  let nextMode = state.currentMode;
  let upgraded = false;
  let reset = false;

  const reasons: ReentryStabilizerReason[] = [];

  if (volatility === "NORMAL") {
    stableCount += 1;
    unstableCount = 0;

    reasons.push(
      reason(
        "STABILITY_CONFIRMED",
        "Normal volatility condition confirmed for this check.",
      ),
    );

    if (
      state.currentMode === "SHADOW" &&
      stableCount >= REENTRY_THRESHOLDS.SHADOW_TO_ADVISORY
    ) {
      nextMode = "ADVISORY";
      upgraded = true;
      stableCount = 0;

      reasons.push(
        reason(
          "UPGRADE_TO_ADVISORY",
          "Sustained calm confirmed; upgrading from SHADOW to ADVISORY.",
        ),
      );
    } else if (
      state.currentMode === "ADVISORY" &&
      stableCount >= REENTRY_THRESHOLDS.ADVISORY_TO_ACTIVE
    ) {
      nextMode = "ACTIVE";
      upgraded = true;
      stableCount = 0;

      reasons.push(
        reason(
          "UPGRADE_TO_ACTIVE",
          "Extended calm confirmed; upgrading from ADVISORY to ACTIVE.",
        ),
      );
    } else {
      reasons.push(
        reason(
          "STABILITY_STREAK_CONTINUES",
          "Calm streak is building but upgrade threshold is not yet met.",
        ),
      );
    }
  } else {
    unstableCount += 1;
    stableCount = 0;
    reset = true;

    reasons.push(
      reason(
        "STABILITY_RESET",
        "Volatility is not normal; stable streak reset.",
      ),
    );

    if (volatility === "ELEVATED") {
      reasons.push(
        reason(
          "ELEVATED_VOLATILITY_PRESENT",
          "Elevated volatility delays authority re-entry.",
        ),
      );
    }

    if (volatility === "UNSTABLE") {
      reasons.push(
        reason(
          "UNSTABLE_VOLATILITY_PRESENT",
          "Unstable volatility blocks authority re-entry.",
        ),
      );
    }
  }

  return {
    nextMode,
    stableCount,
    unstableCount,
    upgraded,
    reset,
    reasons,
    timestampUtc: new Date().toISOString(),
    version: "v1",
  };
}