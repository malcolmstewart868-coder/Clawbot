/**
 * Canonical v1 — Clawbot Intelligence Layer evaluator
 *
 * Purpose:
 * Pure standalone evaluator for pre-execution intelligence classification.
 *
 * Status:
 * Shadow-mode safe.
 * This file does NOT wire into the engine.
 *
 * Architectural role:
 * market signal -> intelligence layer -> calmstack -> guardrails -> execution engine -> observer -> cockpit
 */

import {
  type IntelligenceDecision,
  type IntelligenceReason,
} from "./types";
import { parseIntelligenceDecision } from "./intelligenceSchema";

/**
 * Canonical v1 input shape for intelligence evaluation.
 *
 * This is intentionally simple and conservative.
 * It gives us enough structure to classify behavior
 * without coupling to the existing engine internals yet.
 */
export interface IntelligenceEvaluationContext {
  /**
   * True when higher-level directional structure is aligned.
   * Example: H1 bias is valid and stable.
   */
  biasAligned: boolean;

  /**
   * True when mid-level setup is armed.
   * Example: M15 arm conditions are satisfied.
   */
  armAligned: boolean;

  /**
   * True when lower-level trigger is present.
   * Example: M5 trigger conditions are satisfied.
   */
  triggerReady: boolean;

  /**
   * True when current structure shows signs of weakening,
   * uncertainty, or possible invalidation.
   */
  possibleInvalidation: boolean;

  /**
   * True when the setup is clearly invalid or prohibited.
   * This should produce a hard block.
   */
  structureInvalid: boolean;

  /**
   * Optional tightening pressure.
   * 0 = none
   * 1 = mild
   * 2 = moderate
   * 3 = strong
   */
  tightenLevel?: number;

  /**
   * Optional confidence score for upstream signal quality.
   * Normalized 0..1
   */
  confidence?: number;

  /**
   * Optional free-form metadata for traceability in shadow mode.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Helper to build reasoning entries consistently.
 */
function reason(code: string, message: string): IntelligenceReason {
  return { code, message };
}

/**
 * Helper to normalize tighten level for canonical v1.
 */
function normalizeTightenLevel(value?: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  const clamped = Math.max(0, Math.min(3, Math.trunc(value)));
  return clamped;
}

/**
 * Helper to normalize confidence into 0..1 if provided.
 */
function normalizeConfidence(value?: number): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) return undefined;
  return Math.max(0, Math.min(1, value));
}

/**
 * Canonical v1 intelligence evaluation logic.
 *
 * Decision priority:
 * 1. BLOCK_ENTRY
 * 2. ALLOW_ENTRY
 * 3. TIGHTEN
 * 4. OBSERVE_POSSIBLE_INVALIDATION
 * 5. OBSERVE
 *
 * This preserves disciplined classification:
 * - invalid structure hard-blocks first
 * - full alignment may allow downstream entry evaluation
 * - tightening is advisory restriction, not permission
 * - possible invalidation remains observational
 * - default is observe
 */
export function evaluateIntelligence(
  context: IntelligenceEvaluationContext,
): IntelligenceDecision {
  const tightenLevel = normalizeTightenLevel(context.tightenLevel);
  const confidence = normalizeConfidence(context.confidence);
  const reasons: IntelligenceReason[] = [];

  /**
   * 1) Hard block on invalid structure
   */
  if (context.structureInvalid) {
    reasons.push(
      reason(
        "STRUCTURE_INVALID",
        "Structure is invalid; entry must be blocked.",
      ),
    );

    if (context.possibleInvalidation) {
      reasons.push(
        reason(
          "INVALIDATION_CONFIRMED",
          "Possible invalidation has progressed into an invalid structure state.",
        ),
      );
    }

    return parseIntelligenceDecision({
      action: "BLOCK_ENTRY",
      allowEntry: false,
      blockEntry: true,
      confidence,
      reasons,
      source: "intelligence-layer",
      timestampUtc: new Date().toISOString(),
      version: "v1",
      metadata: context.metadata,
    });
  }

  /**
   * 2) Full alignment allows downstream entry evaluation
   *
   * Important:
   * ALLOW_ENTRY does not force execution.
   * It only says the intelligence layer does not block entry.
   */
  if (
    context.biasAligned &&
    context.armAligned &&
    context.triggerReady &&
    !context.possibleInvalidation &&
    tightenLevel === 0
  ) {
    reasons.push(
      reason(
        "FULL_ALIGNMENT",
        "Bias, arm, and trigger are aligned with no active invalidation pressure.",
      ),
    );

    return parseIntelligenceDecision({
      action: "ALLOW_ENTRY",
      allowEntry: true,
      blockEntry: false,
      confidence,
      reasons,
      source: "intelligence-layer",
      timestampUtc: new Date().toISOString(),
      version: "v1",
      metadata: context.metadata,
    });
  }

  /**
   * 3) Tightening state
   *
   * This is used when the setup may still have potential,
   * but conditions require stricter tolerance.
   */
  if (tightenLevel > 0) {
    reasons.push(
      reason(
        "TIGHTENING_REQUIRED",
        `Conditions require tighter filtering at level ${tightenLevel}.`,
      ),
    );

    if (context.possibleInvalidation) {
      reasons.push(
        reason(
          "INVALIDATION_RISK_PRESENT",
          "Tightening is elevated because possible invalidation is present.",
        ),
      );
    }

    if (context.biasAligned || context.armAligned || context.triggerReady) {
      reasons.push(
        reason(
          "PARTIAL_STRUCTURE_PRESENT",
          "Some structural components are present, but not clean enough for unrestricted progression.",
        ),
      );
    }

    return parseIntelligenceDecision({
      action: "TIGHTEN",
      allowEntry: false,
      blockEntry: false,
      tightenLevel,
      confidence,
      reasons,
      source: "intelligence-layer",
      timestampUtc: new Date().toISOString(),
      version: "v1",
      metadata: context.metadata,
    });
  }

  /**
   * 4) Observe possible invalidation
   *
   * This is a warning observation state, not a permission state.
   */
  if (context.possibleInvalidation) {
    reasons.push(
      reason(
        "POSSIBLE_INVALIDATION",
        "Structure shows early signs of weakening or invalidation; continue observing.",
      ),
    );

    if (context.biasAligned || context.armAligned || context.triggerReady) {
      reasons.push(
        reason(
          "PARTIAL_ALIGNMENT_UNSTABLE",
          "Some alignment exists, but the setup is not stable enough to permit entry.",
        ),
      );
    }

    return parseIntelligenceDecision({
      action: "OBSERVE_POSSIBLE_INVALIDATION",
      allowEntry: false,
      blockEntry: false,
      confidence,
      reasons,
      source: "intelligence-layer",
      timestampUtc: new Date().toISOString(),
      version: "v1",
      metadata: context.metadata,
    });
  }

  /**
   * 5) Default observe
   */
  reasons.push(
    reason(
      "NO_FULL_ALIGNMENT",
      "Conditions are incomplete or neutral; continue observing.",
    ),
  );

  if (!context.biasAligned) {
    reasons.push(
      reason(
        "BIAS_NOT_ALIGNED",
        "Higher-level directional structure is not aligned.",
      ),
    );
  }

  if (!context.armAligned) {
    reasons.push(
      reason(
        "ARM_NOT_ALIGNED",
        "Mid-level setup is not armed.",
      ),
    );
  }

  if (!context.triggerReady) {
    reasons.push(
      reason(
        "TRIGGER_NOT_READY",
        "Lower-level trigger condition is not ready.",
      ),
    );
  }

  return parseIntelligenceDecision({
    action: "OBSERVE",
    allowEntry: false,
    blockEntry: false,
    confidence,
    reasons,
    source: "intelligence-layer",
    timestampUtc: new Date().toISOString(),
    version: "v1",
    metadata: context.metadata,
  });
}