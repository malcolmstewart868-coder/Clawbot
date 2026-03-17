/**
 * Authority Engine v1.0 — Volatility-Aware Authority Controller
 *
 * Purpose:
 * Control authority recovery after turbulence using a structured ladder.
 *
 * Ladder:
 * SHADOW -> SCOUT -> CONFIRMED -> EXECUTION_READY
 *
 * Volatility reaction:
 * - UNSTABLE -> force SHADOW
 * - ELEVATED -> cap at SCOUT
 * - NORMAL -> allow staged recovery through stable streaks
 */

import type { VolatilityState } from "./volatilityDetector";

export const AUTHORITY_STATES = [
  "SHADOW",
  "SCOUT",
  "CONFIRMED",
  "EXECUTION_READY",
] as const;

export type AuthorityState = (typeof AUTHORITY_STATES)[number];

export interface VolatilityAuthorityState {
  authorityState: AuthorityState;
  stableCycles: number;
  unstableCycles: number;
}

export interface VolatilityAuthorityInput {
  volatilityState: VolatilityState;
  state: VolatilityAuthorityState;
}

export interface VolatilityAuthorityReason {
  code: string;
  message: string;
}

export interface VolatilityAuthorityResult {
  nextAuthorityState: AuthorityState;
  stableCycles: number;
  unstableCycles: number;
  transitioned: boolean;
  reasons: VolatilityAuthorityReason[];
  timestampUtc: string;
  version: string;
}

export const AUTHORITY_THRESHOLDS = {
  SHADOW_TO_SCOUT: 1,
  SCOUT_TO_CONFIRMED: 3,
  CONFIRMED_TO_EXECUTION_READY: 6,
} as const;

function reason(code: string, message: string): VolatilityAuthorityReason {
  return { code, message };
}

export function mapAuthorityStateToIntelligenceMode(
  authorityState: AuthorityState,
): "SHADOW" | "ADVISORY" | "ACTIVE" {
  switch (authorityState) {
    case "SHADOW":
      return "SHADOW";
    case "SCOUT":
      return "ADVISORY";
    case "CONFIRMED":
      return "ADVISORY";
    case "EXECUTION_READY":
      return "ACTIVE";
    default: {
      const exhaustiveCheck: never = authorityState;
      throw new Error(`Unsupported authority state: ${exhaustiveCheck}`);
    }
  }
}

export function controlVolatilityAuthority(
  input: VolatilityAuthorityInput,
): VolatilityAuthorityResult {
  const { volatilityState, state } = input;

  let nextAuthorityState = state.authorityState;
  let stableCycles = state.stableCycles;
  let unstableCycles = state.unstableCycles;
  let transitioned = false;

  const reasons: VolatilityAuthorityReason[] = [];

  if (volatilityState === "UNSTABLE") {
    nextAuthorityState = "SHADOW";
    stableCycles = 0;
    unstableCycles += 1;
    transitioned = nextAuthorityState !== state.authorityState;

    reasons.push(
      reason(
        "FORCE_SHADOW_UNSTABLE",
        "Volatility is unstable; authority forced to SHADOW.",
      ),
    );

    return {
      nextAuthorityState,
      stableCycles,
      unstableCycles,
      transitioned,
      reasons,
      timestampUtc: new Date().toISOString(),
      version: "v1",
    };
  }

  if (volatilityState === "ELEVATED") {
    stableCycles = 0;
    unstableCycles += 1;

    if (state.authorityState === "CONFIRMED" || state.authorityState === "EXECUTION_READY") {
      nextAuthorityState = "SCOUT";
      transitioned = true;

      reasons.push(
        reason(
          "DOWNGRADE_TO_SCOUT_ELEVATED",
          "Elevated volatility reduces authority to SCOUT.",
        ),
      );
    } else if (state.authorityState === "SCOUT" || state.authorityState === "SHADOW") {
      nextAuthorityState = state.authorityState;

      reasons.push(
        reason(
          "ELEVATED_VOLATILITY_HOLD",
          "Elevated volatility prevents authority escalation.",
        ),
      );
    }

    return {
      nextAuthorityState,
      stableCycles,
      unstableCycles,
      transitioned,
      reasons,
      timestampUtc: new Date().toISOString(),
      version: "v1",
    };
  }

  // NORMAL
  stableCycles += 1;
  unstableCycles = 0;

  reasons.push(
    reason(
      "NORMAL_VOLATILITY_CONFIRMED",
      "Normal volatility confirmed for this cycle.",
    ),
  );

  if (
    state.authorityState === "SHADOW" &&
    stableCycles >= AUTHORITY_THRESHOLDS.SHADOW_TO_SCOUT
  ) {
    nextAuthorityState = "SCOUT";
    transitioned = true;

    reasons.push(
      reason(
        "UPGRADE_TO_SCOUT",
        "Stable conditions support initial recovery to SCOUT.",
      ),
    );
  } else if (
    state.authorityState === "SCOUT" &&
    stableCycles >= AUTHORITY_THRESHOLDS.SCOUT_TO_CONFIRMED
  ) {
    nextAuthorityState = "CONFIRMED";
    transitioned = true;

    reasons.push(
      reason(
        "UPGRADE_TO_CONFIRMED",
        "Stable streak supports recovery to CONFIRMED authority.",
      ),
    );
  } else if (
    state.authorityState === "CONFIRMED" &&
    stableCycles >= AUTHORITY_THRESHOLDS.CONFIRMED_TO_EXECUTION_READY
  ) {
    nextAuthorityState = "EXECUTION_READY";
    transitioned = true;

    reasons.push(
      reason(
        "UPGRADE_TO_EXECUTION_READY",
        "Extended stability supports full authority restoration.",
      ),
    );
  } else {
    reasons.push(
      reason(
        "STABILITY_STREAK_BUILDING",
        "Stable streak is building but next threshold is not yet met.",
      ),
    );
  }

  return {
    nextAuthorityState,
    stableCycles,
    unstableCycles,
    transitioned,
    reasons,
    timestampUtc: new Date().toISOString(),
    version: "v1",
  };
}