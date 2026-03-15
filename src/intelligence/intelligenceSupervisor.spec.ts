import { beforeEach, describe, expect, it } from "vitest";
import { superviseIntelligence } from "./intelligenceSupervisor";
import { resetIntelligenceMode, setIntelligenceMode } from "./intelligenceMode";
import type { IntelligenceDecision } from "./types";
import type { DownstreamRestrictionPacket } from "./intelligenceAdapter";

function makeDecision(): IntelligenceDecision {
  return {
    action: "OBSERVE",
    allowEntry: false,
    blockEntry: false,
    reasons: [],
    source: "intelligence-layer",
    timestampUtc: new Date().toISOString(),
    version: "v1",
  };
}

function makePacket(): DownstreamRestrictionPacket {
  return {
    posture: "OBSERVE",
    entryGate: "HOLD",
    hardBlock: false,
    tightenLevel: 0,
    possibleInvalidation: false,
    reasons: [],
    intelligenceAction: "OBSERVE",
    timestampUtc: new Date().toISOString(),
    version: "v1",
  };
}

describe("superviseIntelligence", () => {
  beforeEach(() => {
    resetIntelligenceMode();
  });

  it("returns observe-only state in SHADOW mode", () => {
    setIntelligenceMode("SHADOW");

    const result = superviseIntelligence({
      decision: makeDecision(),
      downstreamPacket: makePacket(),
    });

    expect(result.mode).toBe("SHADOW");
    expect(result.authorityGranted).toBe(false);
    expect(result.observeOnly).toBe(true);
    expect(result.advisoryOnly).toBe(false);
    expect(result.version).toBe("v2");
  });

  it("returns advisory-only state in ADVISORY mode", () => {
    setIntelligenceMode("ADVISORY");

    const result = superviseIntelligence({
      decision: makeDecision(),
      downstreamPacket: makePacket(),
    });

    expect(result.mode).toBe("ADVISORY");
    expect(result.authorityGranted).toBe(false);
    expect(result.observeOnly).toBe(false);
    expect(result.advisoryOnly).toBe(true);
    expect(result.version).toBe("v2");
  });

  it("returns active authority in ACTIVE mode", () => {
    setIntelligenceMode("ACTIVE");

    const result = superviseIntelligence({
      decision: makeDecision(),
      downstreamPacket: makePacket(),
    });

    expect(result.mode).toBe("ACTIVE");
    expect(result.authorityGranted).toBe(true);
    expect(result.observeOnly).toBe(false);
    expect(result.advisoryOnly).toBe(false);
    expect(result.version).toBe("v2");
  });

  it("preserves downstream packet", () => {
    setIntelligenceMode("ACTIVE");
    const packet = makePacket();

    const result = superviseIntelligence({
      decision: makeDecision(),
      downstreamPacket: packet,
    });

    expect(result.downstreamPacket).toEqual(packet);
  });

  it("defaults to SHADOW behavior after reset", () => {
    setIntelligenceMode("ACTIVE");
    resetIntelligenceMode();

    const result = superviseIntelligence({
      decision: makeDecision(),
      downstreamPacket: makePacket(),
    });

    expect(result.mode).toBe("SHADOW");
    expect(result.authorityGranted).toBe(false);
    expect(result.observeOnly).toBe(true);
  });
});