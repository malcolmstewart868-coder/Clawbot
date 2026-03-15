import { describe, expect, it } from "vitest";
import {
  REENTRY_THRESHOLDS,
  stabilizeReentry,
  type ReentryStabilizerState,
} from "./reentryStabilizer";

function makeState(
  overrides: Partial<ReentryStabilizerState> = {},
): ReentryStabilizerState {
  return {
    stableCount: 0,
    unstableCount: 0,
    currentMode: "SHADOW",
    ...overrides,
  };
}

describe("stabilizeReentry", () => {
  it("builds stable streak under NORMAL conditions", () => {
    const result = stabilizeReentry({
      volatilityState: "NORMAL",
      state: makeState(),
    });

    expect(result.nextMode).toBe("SHADOW");
    expect(result.stableCount).toBe(1);
    expect(result.unstableCount).toBe(0);
    expect(result.upgraded).toBe(false);
    expect(result.reset).toBe(false);
  });

  it("upgrades SHADOW to ADVISORY after threshold is met", () => {
    const result = stabilizeReentry({
      volatilityState: "NORMAL",
      state: makeState({
        currentMode: "SHADOW",
        stableCount: REENTRY_THRESHOLDS.SHADOW_TO_ADVISORY - 1,
      }),
    });

    expect(result.nextMode).toBe("ADVISORY");
    expect(result.upgraded).toBe(true);
    expect(result.stableCount).toBe(0);
  });

  it("upgrades ADVISORY to ACTIVE after threshold is met", () => {
    const result = stabilizeReentry({
      volatilityState: "NORMAL",
      state: makeState({
        currentMode: "ADVISORY",
        stableCount: REENTRY_THRESHOLDS.ADVISORY_TO_ACTIVE - 1,
      }),
    });

    expect(result.nextMode).toBe("ACTIVE");
    expect(result.upgraded).toBe(true);
    expect(result.stableCount).toBe(0);
  });

  it("does not upgrade ACTIVE further", () => {
    const result = stabilizeReentry({
      volatilityState: "NORMAL",
      state: makeState({
        currentMode: "ACTIVE",
        stableCount: 10,
      }),
    });

    expect(result.nextMode).toBe("ACTIVE");
    expect(result.upgraded).toBe(false);
  });

  it("resets stable streak on ELEVATED volatility", () => {
    const result = stabilizeReentry({
      volatilityState: "ELEVATED",
      state: makeState({
        currentMode: "SHADOW",
        stableCount: 2,
      }),
    });

    expect(result.nextMode).toBe("SHADOW");
    expect(result.stableCount).toBe(0);
    expect(result.unstableCount).toBe(1);
    expect(result.reset).toBe(true);
  });

  it("resets stable streak on UNSTABLE volatility", () => {
    const result = stabilizeReentry({
      volatilityState: "UNSTABLE",
      state: makeState({
        currentMode: "ADVISORY",
        stableCount: 4,
      }),
    });

    expect(result.nextMode).toBe("ADVISORY");
    expect(result.stableCount).toBe(0);
    expect(result.unstableCount).toBe(1);
    expect(result.reset).toBe(true);
  });

  it("preserves and increments unstable streak on repeated turbulence", () => {
    const result = stabilizeReentry({
      volatilityState: "UNSTABLE",
      state: makeState({
        unstableCount: 3,
      }),
    });

    expect(result.unstableCount).toBe(4);
    expect(result.stableCount).toBe(0);
  });

  it("includes upgrade reason when promotion occurs", () => {
    const result = stabilizeReentry({
      volatilityState: "NORMAL",
      state: makeState({
        currentMode: "SHADOW",
        stableCount: REENTRY_THRESHOLDS.SHADOW_TO_ADVISORY - 1,
      }),
    });

    expect(
      result.reasons.some((r) => r.code === "UPGRADE_TO_ADVISORY"),
    ).toBe(true);
  });

  it("includes reset reason when turbulence occurs", () => {
    const result = stabilizeReentry({
      volatilityState: "ELEVATED",
      state: makeState({
        stableCount: 2,
      }),
    });

    expect(
      result.reasons.some((r) => r.code === "STABILITY_RESET"),
    ).toBe(true);
  });

  it("returns version v1 and valid timestamp", () => {
    const result = stabilizeReentry({
      volatilityState: "NORMAL",
      state: makeState(),
    });

    expect(result.version).toBe("v1");
    expect(Number.isNaN(new Date(result.timestampUtc).getTime())).toBe(false);
  });
});