/**
 * Canonical v1 — Clawbot Intelligence Mode Controller
 *
 * Purpose:
 * Provide a single central source of truth for intelligence operating mode.
 *
 * Why this matters:
 * During unstable or highly volatile conditions, Clawbot may need to
 * degrade intelligence authority safely:
 *
 * ACTIVE -> ADVISORY -> SHADOW
 *
 * This file gives the system a controlled authority ladder.
 */

export const INTELLIGENCE_MODES = [
  "SHADOW",
  "ADVISORY",
  "ACTIVE",
] as const;

export type IntelligenceMode = (typeof INTELLIGENCE_MODES)[number];

/**
 * Canonical default mode for v1.
 *
 * Start in SHADOW until repeated validation proves the intelligence
 * layer should be allowed to influence downstream posture.
 */
const DEFAULT_INTELLIGENCE_MODE: IntelligenceMode = "SHADOW";

/**
 * In-memory runtime mode store.
 *
 * v1 intentionally keeps this simple and local.
 * Later versions can source from env, config, cockpit controls,
 * or supervisor state.
 */
let currentIntelligenceMode: IntelligenceMode = DEFAULT_INTELLIGENCE_MODE;

/**
 * Returns the current intelligence mode.
 */
export function getIntelligenceMode(): IntelligenceMode {
  return currentIntelligenceMode;
}

/**
 * Sets the current intelligence mode.
 */
export function setIntelligenceMode(mode: IntelligenceMode): IntelligenceMode {
  currentIntelligenceMode = mode;
  return currentIntelligenceMode;
}

/**
 * Resets intelligence mode back to canonical default.
 */
export function resetIntelligenceMode(): IntelligenceMode {
  currentIntelligenceMode = DEFAULT_INTELLIGENCE_MODE;
  return currentIntelligenceMode;
}

/**
 * Whether the provided mode is a valid intelligence mode.
 */
export function isIntelligenceMode(value: unknown): value is IntelligenceMode {
  return (
    typeof value === "string" &&
    (INTELLIGENCE_MODES as readonly string[]).includes(value)
  );
}

/**
 * Safe parser for external input.
 * Falls back to SHADOW if the input is invalid.
 */
export function parseIntelligenceMode(value: unknown): IntelligenceMode {
  return isIntelligenceMode(value) ? value : DEFAULT_INTELLIGENCE_MODE;
}

/**
 * Severity ranking for controlled degradation / escalation.
 *
 * Lower number = less authority
 * Higher number = more authority
 */
export function getIntelligenceModeRank(mode: IntelligenceMode): number {
  switch (mode) {
    case "SHADOW":
      return 0;
    case "ADVISORY":
      return 1;
    case "ACTIVE":
      return 2;
    default: {
      const exhaustiveCheck: never = mode;
      throw new Error(`Unsupported intelligence mode: ${exhaustiveCheck}`);
    }
  }
}

/**
 * Degrade authority by one step.
 *
 * ACTIVE -> ADVISORY
 * ADVISORY -> SHADOW
 * SHADOW -> SHADOW
 */
export function downgradeIntelligenceMode(
  mode: IntelligenceMode,
): IntelligenceMode {
  switch (mode) {
    case "ACTIVE":
      return "ADVISORY";
    case "ADVISORY":
      return "SHADOW";
    case "SHADOW":
      return "SHADOW";
    default: {
      const exhaustiveCheck: never = mode;
      throw new Error(`Unsupported intelligence mode: ${exhaustiveCheck}`);
    }
  }
}

/**
 * Escalate authority by one step.
 *
 * SHADOW -> ADVISORY
 * ADVISORY -> ACTIVE
 * ACTIVE -> ACTIVE
 */
export function upgradeIntelligenceMode(
  mode: IntelligenceMode,
): IntelligenceMode {
  switch (mode) {
    case "SHADOW":
      return "ADVISORY";
    case "ADVISORY":
      return "ACTIVE";
    case "ACTIVE":
      return "ACTIVE";
    default: {
      const exhaustiveCheck: never = mode;
      throw new Error(`Unsupported intelligence mode: ${exhaustiveCheck}`);
    }
  }
}

/**
 * Volatility-safe fallback helper.
 *
 * If turbulence or instability is detected, this helper allows the caller
 * to reduce intelligence authority without shutting the subsystem down.
 */
export function degradeIntelligenceModeOnInstability(
  mode: IntelligenceMode,
  unstable: boolean,
): IntelligenceMode {
  return unstable ? downgradeIntelligenceMode(mode) : mode;
}