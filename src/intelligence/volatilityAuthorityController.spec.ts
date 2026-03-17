import { describe, expect, it } from "vitest";
import {
  AUTHORITY_THRESHOLDS,
  controlVolatilityAuthority,
  mapAuthorityStateToIntelligenceMode,
  type VolatilityAuthorityState,
} from "./volatilityAuthorityController";

function makeState(
  overrides: Partial<VolatilityAuthorityState> = {},
): VolatilityAuthorityState {
  return {
    authorityState: "SHADOW",
    stableCycles: 0,
    unstableCycles: 0,
    ...overrides,
  };
}

describe("controlVolatilityAuthority", () => {
  it("forces SHADOW on UNSTABLE volatility", () => {
    const result = controlVolatilityAuthority({
      volatilityState: "UNSTABLE",
      state: makeState({
        authorityState: "EXECUTION_READY",
        stableCycles: 5,
      }),
    });

    expect(result.nextAuthorityState).toBe("SHADOW");
    expect(result.stableCycles).toBe(0);
    expect(result.unstableCycles).toBe(1);
  });

  it("caps elevated volatility at SCOUT", () => {
    const result = controlVolatilityAuthority({
      volatilityState: "ELEVATED",
      state: makeState({
        authorityState: "EXECUTION_READY",
      }),
    });

    expect(result.nextAuthorityState).toBe("SCOUT");
  });

  it("upgrades SHADOW to SCOUT on first stable cycle", () => {
    const result = controlVolatilityAuthority({
      volatilityState: "NORMAL",
      state: makeState({
        authorityState: "SHADOW",
        stableCycles: AUTHORITY_THRESHOLDS.SHADOW_TO_SCOUT - 1,
      }),
    });

    expect(result.nextAuthorityState).toBe("SCOUT");
  });

  it("upgrades SCOUT to CONFIRMED after threshold", () => {
    const result = controlVolatilityAuthority({
      volatilityState: "NORMAL",
      state: makeState({
        authorityState: "SCOUT",
        stableCycles: AUTHORITY_THRESHOLDS.SCOUT_TO_CONFIRMED - 1,
      }),
    });

    expect(result.nextAuthorityState).toBe("CONFIRMED");
  });

  it("upgrades CONFIRMED to EXECUTION_READY after threshold", () => {
    const result = controlVolatilityAuthority({
      volatilityState: "NORMAL",
      state: makeState({
        authorityState: "CONFIRMED",
        stableCycles: AUTHORITY_THRESHOLDS.CONFIRMED_TO_EXECUTION_READY - 1,
      }),
    });

    expect(result.nextAuthorityState).toBe("EXECUTION_READY");
  });

  it("builds stable streak under NORMAL conditions", () => {
    const result = controlVolatilityAuthority({
      volatilityState: "NORMAL",
      state: makeState(),
    });

    expect(result.stableCycles).toBe(1);
    expect(result.unstableCycles).toBe(0);
  });

  it("increments unstable streak under ELEVATED conditions", () => {
    const result = controlVolatilityAuthority({
      volatilityState: "ELEVATED",
      state: makeState({
        unstableCycles: 2,
      }),
    });

    expect(result.unstableCycles).toBe(3);
    expect(result.stableCycles).toBe(0);
  });
});

describe("mapAuthorityStateToIntelligenceMode", () => {
  it("maps SHADOW to SHADOW", () => {
    expect(mapAuthorityStateToIntelligenceMode("SHADOW")).toBe("SHADOW");
  });

  it("maps SCOUT to ADVISORY", () => {
    expect(mapAuthorityStateToIntelligenceMode("SCOUT")).toBe("ADVISORY");
  });

  it("maps CONFIRMED to ADVISORY", () => {
    expect(mapAuthorityStateToIntelligenceMode("CONFIRMED")).toBe("ADVISORY");
  });

  it("maps EXECUTION_READY to ACTIVE", () => {
    expect(mapAuthorityStateToIntelligenceMode("EXECUTION_READY")).toBe("ACTIVE");
  });
});