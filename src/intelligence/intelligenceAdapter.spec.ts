/**
 * Canonical v1 — Clawbot Intelligence-to-Downstream Adapter tests
 *
 * Purpose:
 * Verify intelligence decisions are translated into consistent downstream packets.
 */

import { describe, expect, it } from "vitest";
import { adaptIntelligenceToDownstream } from "./intelligenceAdapter";
import type { IntelligenceDecision } from "./types";

function makeDecision(
  overrides: Partial<IntelligenceDecision> = {},
): IntelligenceDecision {
  return {
    action: "OBSERVE",
    allowEntry: false,
    blockEntry: false,
    reasons: [],
    source: "intelligence-layer",
    timestampUtc: new Date().toISOString(),
    version: "v1",
    ...overrides,
  };
}

describe("adaptIntelligenceToDownstream", () => {
  it("maps OBSERVE to HOLD + OBSERVE posture", () => {
    const packet = adaptIntelligenceToDownstream(
      makeDecision({
        action: "OBSERVE",
      }),
    );

    expect(packet.posture).toBe("OBSERVE");
    expect(packet.entryGate).toBe("HOLD");
    expect(packet.hardBlock).toBe(false);
    expect(packet.tightenLevel).toBe(0);
    expect(packet.possibleInvalidation).toBe(false);
  });

  it("maps OBSERVE_POSSIBLE_INVALIDATION to HOLD + invalidation posture", () => {
    const packet = adaptIntelligenceToDownstream(
      makeDecision({
        action: "OBSERVE_POSSIBLE_INVALIDATION",
      }),
    );

    expect(packet.posture).toBe("OBSERVE_POSSIBLE_INVALIDATION");
    expect(packet.entryGate).toBe("HOLD");
    expect(packet.hardBlock).toBe(false);
    expect(packet.possibleInvalidation).toBe(true);
  });

  it("maps TIGHTEN to HOLD + TIGHTEN posture", () => {
    const packet = adaptIntelligenceToDownstream(
      makeDecision({
        action: "TIGHTEN",
        tightenLevel: 2,
        reasons: [
          {
            code: "TIGHTENING_REQUIRED",
            message: "Conditions require tighter filtering.",
          },
        ],
      }),
    );

    expect(packet.posture).toBe("TIGHTEN");
    expect(packet.entryGate).toBe("HOLD");
    expect(packet.hardBlock).toBe(false);
    expect(packet.tightenLevel).toBe(2);
  });

  it("maps ALLOW_ENTRY to READY + ALLOW", () => {
    const packet = adaptIntelligenceToDownstream(
      makeDecision({
        action: "ALLOW_ENTRY",
        allowEntry: true,
        blockEntry: false,
      }),
    );

    expect(packet.posture).toBe("READY");
    expect(packet.entryGate).toBe("ALLOW");
    expect(packet.hardBlock).toBe(false);
    expect(packet.tightenLevel).toBe(0);
    expect(packet.possibleInvalidation).toBe(false);
  });

  it("maps BLOCK_ENTRY to BLOCK + hardBlock", () => {
    const packet = adaptIntelligenceToDownstream(
      makeDecision({
        action: "BLOCK_ENTRY",
        allowEntry: false,
        blockEntry: true,
      }),
    );

    expect(packet.posture).toBe("OBSERVE");
    expect(packet.entryGate).toBe("BLOCK");
    expect(packet.hardBlock).toBe(true);
    expect(packet.possibleInvalidation).toBe(true);
  });

  it("detects invalidation risk inside TIGHTEN reasons", () => {
    const packet = adaptIntelligenceToDownstream(
      makeDecision({
        action: "TIGHTEN",
        tightenLevel: 1,
        reasons: [
          {
            code: "INVALIDATION_RISK_PRESENT",
            message: "Tightening is elevated because invalidation risk is present.",
          },
        ],
      }),
    );

    expect(packet.possibleInvalidation).toBe(true);
  });

  it("preserves confidence, metadata, and timestamp", () => {
    const timestampUtc = new Date().toISOString();

    const packet = adaptIntelligenceToDownstream(
      makeDecision({
        action: "ALLOW_ENTRY",
        allowEntry: true,
        confidence: 0.88,
        timestampUtc,
        metadata: { scenario: "adapter-test" },
      }),
    );

    expect(packet.confidence).toBe(0.88);
    expect(packet.timestampUtc).toBe(timestampUtc);
    expect(packet.metadata).toEqual({ scenario: "adapter-test" });
    expect(packet.version).toBe("v1");
  });
});