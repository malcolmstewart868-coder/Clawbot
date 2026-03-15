import { describe, expect, it } from "vitest";
import {
  detectVolatility,
  type VolatilityDetectorInput,
} from "./volatilityDetector";

function makeInput(
  overrides: Partial<VolatilityDetectorInput> = {},
): VolatilityDetectorInput {
  return {
    rangeExpansion: 0.5,
    atrRatio: 0.5,
    sweepFrequency: 0.5,
    invalidationFrequency: 0.5,
    spreadStress: 0.5,
    sessionTransition: false,
    metadata: { test: true },
    ...overrides,
  };
}

describe("detectVolatility", () => {
  it("returns NORMAL under calm conditions", () => {
    const result = detectVolatility(
      makeInput({
        rangeExpansion: 0.2,
        atrRatio: 0.3,
        sweepFrequency: 0.2,
        invalidationFrequency: 0.2,
        spreadStress: 0.2,
        sessionTransition: false,
      }),
    );

    expect(result.state).toBe("NORMAL");
    expect(result.score).toBeLessThan(4);
    expect(result.version).toBe("v1");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("returns ELEVATED when score crosses elevated threshold", () => {
    const result = detectVolatility(
      makeInput({
        rangeExpansion: 1.5,
        atrRatio: 1.5,
        sweepFrequency: 1.2,
        invalidationFrequency: 1.0,
        spreadStress: 0.8,
      }),
    );

    expect(result.state).toBe("ELEVATED");
    expect(result.score).toBeGreaterThanOrEqual(4);
    expect(result.score).toBeLessThan(7);
  });

  it("returns UNSTABLE when score crosses unstable threshold", () => {
    const result = detectVolatility(
      makeInput({
        rangeExpansion: 2.5,
        atrRatio: 2.0,
        sweepFrequency: 2.0,
        invalidationFrequency: 2.5,
        spreadStress: 1.5,
        sessionTransition: true,
      }),
    );

    expect(result.state).toBe("UNSTABLE");
    expect(result.score).toBeGreaterThanOrEqual(7);
  });

  it("adds session transition reason when active", () => {
    const result = detectVolatility(
      makeInput({
        sessionTransition: true,
      }),
    );

    expect(
      result.reasons.some(
        (r) => r.code === "SESSION_TRANSITION_TURBULENCE",
      ),
    ).toBe(true);
  });

  it("adds elevated metric reasons when thresholds are crossed", () => {
    const result = detectVolatility(
      makeInput({
        rangeExpansion: 1.6,
        atrRatio: 1.7,
        sweepFrequency: 1.8,
        invalidationFrequency: 1.9,
        spreadStress: 1.6,
      }),
    );

    expect(
      result.reasons.some((r) => r.code === "RANGE_EXPANSION_ELEVATED"),
    ).toBe(true);
    expect(
      result.reasons.some((r) => r.code === "ATR_SPIKE_ELEVATED"),
    ).toBe(true);
    expect(
      result.reasons.some((r) => r.code === "SWEEP_ACTIVITY_ELEVATED"),
    ).toBe(true);
    expect(
      result.reasons.some((r) => r.code === "INVALIDATION_ACTIVITY_ELEVATED"),
    ).toBe(true);
    expect(
      result.reasons.some((r) => r.code === "SPREAD_STRESS_ELEVATED"),
    ).toBe(true);
  });

  it("falls back to a normal reason when no elevated conditions are present", () => {
    const result = detectVolatility(
      makeInput({
        rangeExpansion: 0,
        atrRatio: 0,
        sweepFrequency: 0,
        invalidationFrequency: 0,
        spreadStress: 0,
        sessionTransition: false,
      }),
    );

    expect(result.state).toBe("NORMAL");
    expect(
      result.reasons.some((r) => r.code === "VOLATILITY_NORMAL"),
    ).toBe(true);
  });

  it("normalizes invalid numeric inputs to zero", () => {
    const result = detectVolatility(
      makeInput({
        rangeExpansion: Number.NaN,
        atrRatio: -1,
        sweepFrequency: Number.NaN,
        invalidationFrequency: -5,
        spreadStress: Number.NaN,
      }),
    );

    expect(result.state).toBe("NORMAL");
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("preserves metadata", () => {
    const result = detectVolatility(
      makeInput({
        metadata: {
          phase: "volatility-test",
          scenario: "metadata-check",
        },
      }),
    );

    expect(result.metadata).toEqual({
      phase: "volatility-test",
      scenario: "metadata-check",
    });
  });

  it("returns a valid ISO timestamp", () => {
    const result = detectVolatility(makeInput());

    expect(Number.isNaN(new Date(result.timestampUtc).getTime())).toBe(false);
  });

  it("returns a score rounded to two decimals", () => {
    const result = detectVolatility(
      makeInput({
        rangeExpansion: 1.333,
        atrRatio: 1.777,
        sweepFrequency: 0.666,
        invalidationFrequency: 1.111,
        spreadStress: 0.555,
      }),
    );

    expect(typeof result.score).toBe("number");
    expect(result.score).toBe(Number(result.score.toFixed(2)));
  });
});