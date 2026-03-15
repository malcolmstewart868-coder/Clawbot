/**
 * Canonical v1 — Clawbot Intelligence Layer evaluator tests
 *
 * Purpose:
 * Verify the standalone evaluator returns valid and stable decisions
 * for the five canonical intelligence behaviors.
 *
 * Notes:
 * - These tests are isolated from the live engine.
 * - They are safe to run before any engine wiring.
 */

import { describe, expect, it } from "vitest";
import {
  evaluateIntelligence,
  type IntelligenceEvaluationContext,
} from "./intelligenceEvaluator";

function makeContext(
  overrides: Partial<IntelligenceEvaluationContext> = {},
): IntelligenceEvaluationContext {
  return {
    biasAligned: false,
    armAligned: false,
    triggerReady: false,
    possibleInvalidation: false,
    structureInvalid: false,
    tightenLevel: 0,
    confidence: 0.5,
    metadata: { test: true },
    ...overrides,
  };
}

describe("evaluateIntelligence", () => {
  it("returns OBSERVE by default when no meaningful alignment exists", () => {
    const decision = evaluateIntelligence(makeContext());

    expect(decision.action).toBe("OBSERVE");
    expect(decision.allowEntry).toBe(false);
    expect(decision.blockEntry).toBe(false);
    expect(decision.tightenLevel).toBeUndefined();
    expect(decision.confidence).toBe(0.5);
    expect(decision.source).toBe("intelligence-layer");
    expect(decision.version).toBe("v1");
    expect(typeof decision.timestampUtc).toBe("string");
    expect(decision.reasons.length).toBeGreaterThan(0);
    expect(decision.reasons.some((r) => r.code === "NO_FULL_ALIGNMENT")).toBe(
      true,
    );
  });

  it("returns OBSERVE_POSSIBLE_INVALIDATION when weakening is present without hard invalid structure", () => {
    const decision = evaluateIntelligence(
      makeContext({
        biasAligned: true,
        possibleInvalidation: true,
      }),
    );

    expect(decision.action).toBe("OBSERVE_POSSIBLE_INVALIDATION");
    expect(decision.allowEntry).toBe(false);
    expect(decision.blockEntry).toBe(false);
    expect(decision.tightenLevel).toBeUndefined();
    expect(
      decision.reasons.some((r) => r.code === "POSSIBLE_INVALIDATION"),
    ).toBe(true);
  });

  it("returns TIGHTEN when tightening pressure exists without hard block", () => {
    const decision = evaluateIntelligence(
      makeContext({
        biasAligned: true,
        armAligned: true,
        triggerReady: false,
        tightenLevel: 2,
      }),
    );

    expect(decision.action).toBe("TIGHTEN");
    expect(decision.allowEntry).toBe(false);
    expect(decision.blockEntry).toBe(false);
    expect(decision.tightenLevel).toBe(2);
    expect(
      decision.reasons.some((r) => r.code === "TIGHTENING_REQUIRED"),
    ).toBe(true);
  });

  it("returns ALLOW_ENTRY only when full clean alignment exists", () => {
    const decision = evaluateIntelligence(
      makeContext({
        biasAligned: true,
        armAligned: true,
        triggerReady: true,
        possibleInvalidation: false,
        structureInvalid: false,
        tightenLevel: 0,
        confidence: 0.84,
      }),
    );

    expect(decision.action).toBe("ALLOW_ENTRY");
    expect(decision.allowEntry).toBe(true);
    expect(decision.blockEntry).toBe(false);
    expect(decision.tightenLevel).toBeUndefined();
    expect(decision.confidence).toBe(0.84);
    expect(
      decision.reasons.some((r) => r.code === "FULL_ALIGNMENT"),
    ).toBe(true);
  });

  it("returns BLOCK_ENTRY when structure is invalid, even if other alignment exists", () => {
    const decision = evaluateIntelligence(
      makeContext({
        biasAligned: true,
        armAligned: true,
        triggerReady: true,
        possibleInvalidation: true,
        structureInvalid: true,
        tightenLevel: 3,
      }),
    );

    expect(decision.action).toBe("BLOCK_ENTRY");
    expect(decision.allowEntry).toBe(false);
    expect(decision.blockEntry).toBe(true);
    expect(
      decision.reasons.some((r) => r.code === "STRUCTURE_INVALID"),
    ).toBe(true);
    expect(
      decision.reasons.some((r) => r.code === "INVALIDATION_CONFIRMED"),
    ).toBe(true);
  });

  it("prioritizes BLOCK_ENTRY over ALLOW_ENTRY", () => {
    const decision = evaluateIntelligence(
      makeContext({
        biasAligned: true,
        armAligned: true,
        triggerReady: true,
        structureInvalid: true,
      }),
    );

    expect(decision.action).toBe("BLOCK_ENTRY");
    expect(decision.blockEntry).toBe(true);
    expect(decision.allowEntry).toBe(false);
  });

  it("prioritizes TIGHTEN over OBSERVE_POSSIBLE_INVALIDATION when tighten level is active", () => {
    const decision = evaluateIntelligence(
      makeContext({
        biasAligned: true,
        possibleInvalidation: true,
        tightenLevel: 1,
      }),
    );

    expect(decision.action).toBe("TIGHTEN");
    expect(decision.tightenLevel).toBe(1);
    expect(
      decision.reasons.some((r) => r.code === "INVALIDATION_RISK_PRESENT"),
    ).toBe(true);
  });

  it("does not allow entry when possible invalidation is active", () => {
    const decision = evaluateIntelligence(
      makeContext({
        biasAligned: true,
        armAligned: true,
        triggerReady: true,
        possibleInvalidation: true,
        tightenLevel: 0,
      }),
    );

    expect(decision.action).not.toBe("ALLOW_ENTRY");
    expect(decision.allowEntry).toBe(false);
  });

  it("normalizes tightenLevel values above range down to 3", () => {
    const decision = evaluateIntelligence(
      makeContext({
        tightenLevel: 99,
      }),
    );

    expect(decision.action).toBe("TIGHTEN");
    expect(decision.tightenLevel).toBe(3);
  });

  it("normalizes tightenLevel values below range up to 0", () => {
    const decision = evaluateIntelligence(
      makeContext({
        tightenLevel: -4,
      }),
    );

    expect(decision.action).toBe("OBSERVE");
    expect(decision.tightenLevel).toBeUndefined();
  });

  it("normalizes confidence values above range down to 1", () => {
    const decision = evaluateIntelligence(
      makeContext({
        confidence: 5,
      }),
    );

    expect(decision.confidence).toBe(1);
  });

  it("normalizes confidence values below range up to 0", () => {
    const decision = evaluateIntelligence(
      makeContext({
        confidence: -2,
      }),
    );

    expect(decision.confidence).toBe(0);
  });

  it("preserves metadata from evaluation context", () => {
    const decision = evaluateIntelligence(
      makeContext({
        metadata: {
          phase: "shadow-mode",
          session: "test-run",
        },
      }),
    );

    expect(decision.metadata).toEqual({
      phase: "shadow-mode",
      session: "test-run",
    });
  });

  it("produces timestampUtc in ISO format", () => {
    const decision = evaluateIntelligence(makeContext());

    expect(() => new Date(decision.timestampUtc)).not.toThrow();
    expect(Number.isNaN(new Date(decision.timestampUtc).getTime())).toBe(false);
  });

  it("includes missing alignment reasons when defaulting to OBSERVE", () => {
    const decision = evaluateIntelligence(
      makeContext({
        biasAligned: false,
        armAligned: false,
        triggerReady: false,
      }),
    );

    expect(decision.action).toBe("OBSERVE");
    expect(
      decision.reasons.some((r) => r.code === "BIAS_NOT_ALIGNED"),
    ).toBe(true);
    expect(
      decision.reasons.some((r) => r.code === "ARM_NOT_ALIGNED"),
    ).toBe(true);
    expect(
      decision.reasons.some((r) => r.code === "TRIGGER_NOT_READY"),
    ).toBe(true);
  });
});