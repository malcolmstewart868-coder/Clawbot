/**
 * Canonical v1 — Clawbot Intelligence-to-Downstream Adapter
 *
 * Purpose:
 * Translate Intelligence Layer decisions into safe downstream-facing signals
 * for Calmstack, Guardrails, and eventual execution gating.
 *
 * Status:
 * Shadow-mode safe.
 * This file does NOT modify the live engine.
 */

import type { IntelligenceDecision, IntelligenceReason } from "./types";

export type DownstreamPosture =
  | "OBSERVE"
  | "OBSERVE_POSSIBLE_INVALIDATION"
  | "TIGHTEN"
  | "READY";

export type DownstreamEntryGate = "ALLOW" | "BLOCK" | "HOLD";

export interface DownstreamRestrictionPacket {
  /**
   * Primary downstream posture for Calmstack or other supervisory layers.
   */
  posture: DownstreamPosture;

  /**
   * Entry gate status for execution eligibility.
   * - ALLOW: intelligence permits downstream entry evaluation
   * - BLOCK: intelligence hard-blocks entry
   * - HOLD: remain passive / supervisory
   */
  entryGate: DownstreamEntryGate;

  /**
   * Whether downstream guardrails should treat this as a hard deny.
   */
  hardBlock: boolean;

  /**
   * Tightening severity carried forward for downstream filtering.
   * Range v1: 0..3
   */
  tightenLevel: number;

  /**
   * Whether downstream layers should increase invalidation sensitivity.
   */
  possibleInvalidation: boolean;

  /**
   * Human/machine readable reasoning preserved from intelligence layer.
   */
  reasons: IntelligenceReason[];

  /**
   * Original intelligence action for traceability.
   */
  intelligenceAction: IntelligenceDecision["action"];

  /**
   * Pass-through confidence from intelligence layer.
   */
  confidence?: number;

  /**
   * Timestamp from intelligence decision.
   */
  timestampUtc: string;

  /**
   * Version marker for adapter contract.
   */
  version: string;

  /**
   * Optional metadata for shadow-mode tracing.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Canonical v1 adapter from intelligence decisions to downstream packet.
 */
export function adaptIntelligenceToDownstream(
  decision: IntelligenceDecision,
): DownstreamRestrictionPacket {
  switch (decision.action) {
    case "BLOCK_ENTRY":
      return {
        posture: "OBSERVE",
        entryGate: "BLOCK",
        hardBlock: true,
        tightenLevel: 0,
        possibleInvalidation: true,
        reasons: decision.reasons,
        intelligenceAction: decision.action,
        confidence: decision.confidence,
        timestampUtc: decision.timestampUtc,
        version: "v1",
        metadata: decision.metadata,
      };

    case "ALLOW_ENTRY":
      return {
        posture: "READY",
        entryGate: "ALLOW",
        hardBlock: false,
        tightenLevel: 0,
        possibleInvalidation: false,
        reasons: decision.reasons,
        intelligenceAction: decision.action,
        confidence: decision.confidence,
        timestampUtc: decision.timestampUtc,
        version: "v1",
        metadata: decision.metadata,
      };

    case "TIGHTEN":
      return {
        posture: "TIGHTEN",
        entryGate: "HOLD",
        hardBlock: false,
        tightenLevel: decision.tightenLevel ?? 0,
        possibleInvalidation: decision.reasons.some(
          (r) => r.code === "INVALIDATION_RISK_PRESENT",
        ),
        reasons: decision.reasons,
        intelligenceAction: decision.action,
        confidence: decision.confidence,
        timestampUtc: decision.timestampUtc,
        version: "v1",
        metadata: decision.metadata,
      };

    case "OBSERVE_POSSIBLE_INVALIDATION":
      return {
        posture: "OBSERVE_POSSIBLE_INVALIDATION",
        entryGate: "HOLD",
        hardBlock: false,
        tightenLevel: 0,
        possibleInvalidation: true,
        reasons: decision.reasons,
        intelligenceAction: decision.action,
        confidence: decision.confidence,
        timestampUtc: decision.timestampUtc,
        version: "v1",
        metadata: decision.metadata,
      };

    case "OBSERVE":
    default:
      return {
        posture: "OBSERVE",
        entryGate: "HOLD",
        hardBlock: false,
        tightenLevel: 0,
        possibleInvalidation: false,
        reasons: decision.reasons,
        intelligenceAction: decision.action,
        confidence: decision.confidence,
        timestampUtc: decision.timestampUtc,
        version: "v1",
        metadata: decision.metadata,
      };
  }
}