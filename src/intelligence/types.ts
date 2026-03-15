/**
 * Canonical v1 — Clawbot Intelligence Layer types
 *
 * Purpose:
 * Define the stable type contract for pre-execution intelligence decisions.
 *
 * Architectural position:
 * market signal -> intelligence layer -> calmstack -> guardrails -> execution engine -> observer -> cockpit
 *
 * Important:
 * This file is intentionally non-invasive.
 * It does not modify runtime behavior.
 */

export const INTELLIGENCE_ACTIONS = [
  "OBSERVE",
  "OBSERVE_POSSIBLE_INVALIDATION",
  "TIGHTEN",
  "ALLOW_ENTRY",
  "BLOCK_ENTRY",
] as const;

export type IntelligenceAction = (typeof INTELLIGENCE_ACTIONS)[number];

export type IntelligenceSource =
  | "intelligence-layer"
  | "ral"
  | "manual"
  | "unknown";

export interface IntelligenceReason {
  code: string;
  message: string;
}

export interface IntelligenceDecision {
  /**
   * Primary classified system behavior.
   */
  action: IntelligenceAction;

  /**
   * Whether downstream layers may permit entry evaluation.
   * This does NOT force execution.
   * It only signals that entry is not blocked at the intelligence level.
   */
  allowEntry: boolean;

  /**
   * Hard deny from intelligence layer.
   * If true, downstream entry should not proceed.
   */
  blockEntry: boolean;

  /**
   * Optional tightening severity.
   * Expected range for v1: 0-3
   * 0 = no tightening
   * 1 = mild tightening
   * 2 = moderate tightening
   * 3 = strong tightening
   */
  tightenLevel?: number;

  /**
   * Optional confidence score.
   * Expected range for v1: 0-1
   */
  confidence?: number;

  /**
   * Human-readable and machine-usable reasoning.
   */
  reasons: IntelligenceReason[];

  /**
   * Source of the decision object.
   */
  source: IntelligenceSource;

  /**
   * UTC ISO timestamp for when the decision was produced.
   */
  timestampUtc: string;

  /**
   * Optional schema / contract version marker.
   */
  version?: string;

  /**
   * Optional free-form metadata for future compatibility.
   * Keep lightweight and JSON-safe.
   */
  metadata?: Record<string, unknown>;
}