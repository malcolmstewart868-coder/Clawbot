import { describe, expect, it, beforeEach } from "vitest";
import {
  getIntelligenceMode,
  setIntelligenceMode,
  resetIntelligenceMode,
  isIntelligenceMode,
  parseIntelligenceMode,
  getIntelligenceModeRank,
  downgradeIntelligenceMode,
  upgradeIntelligenceMode,
  degradeIntelligenceModeOnInstability,
} from "./intelligenceMode";

describe("intelligenceMode", () => {
  beforeEach(() => {
    resetIntelligenceMode();
  });

  it("defaults to SHADOW", () => {
    expect(getIntelligenceMode()).toBe("SHADOW");
  });

  it("sets and gets intelligence mode", () => {
    setIntelligenceMode("ADVISORY");
    expect(getIntelligenceMode()).toBe("ADVISORY");
  });

  it("resets back to SHADOW", () => {
    setIntelligenceMode("ACTIVE");
    expect(resetIntelligenceMode()).toBe("SHADOW");
    expect(getIntelligenceMode()).toBe("SHADOW");
  });

  it("recognizes valid intelligence modes", () => {
    expect(isIntelligenceMode("SHADOW")).toBe(true);
    expect(isIntelligenceMode("ADVISORY")).toBe(true);
    expect(isIntelligenceMode("ACTIVE")).toBe(true);
  });

  it("rejects invalid intelligence modes", () => {
    expect(isIntelligenceMode("LIVE")).toBe(false);
    expect(isIntelligenceMode("OFF")).toBe(false);
    expect(isIntelligenceMode(123)).toBe(false);
  });

  it("parses valid modes and falls back invalid modes to SHADOW", () => {
    expect(parseIntelligenceMode("ACTIVE")).toBe("ACTIVE");
    expect(parseIntelligenceMode("ADVISORY")).toBe("ADVISORY");
    expect(parseIntelligenceMode("bad-value")).toBe("SHADOW");
  });

  it("returns correct mode ranks", () => {
    expect(getIntelligenceModeRank("SHADOW")).toBe(0);
    expect(getIntelligenceModeRank("ADVISORY")).toBe(1);
    expect(getIntelligenceModeRank("ACTIVE")).toBe(2);
  });

  it("downgrades correctly", () => {
    expect(downgradeIntelligenceMode("ACTIVE")).toBe("ADVISORY");
    expect(downgradeIntelligenceMode("ADVISORY")).toBe("SHADOW");
    expect(downgradeIntelligenceMode("SHADOW")).toBe("SHADOW");
  });

  it("upgrades correctly", () => {
    expect(upgradeIntelligenceMode("SHADOW")).toBe("ADVISORY");
    expect(upgradeIntelligenceMode("ADVISORY")).toBe("ACTIVE");
    expect(upgradeIntelligenceMode("ACTIVE")).toBe("ACTIVE");
  });

  it("degrades on instability", () => {
    expect(degradeIntelligenceModeOnInstability("ACTIVE", true)).toBe("ADVISORY");
    expect(degradeIntelligenceModeOnInstability("ADVISORY", true)).toBe("SHADOW");
    expect(degradeIntelligenceModeOnInstability("SHADOW", true)).toBe("SHADOW");
  });

  it("does not degrade when stable", () => {
    expect(degradeIntelligenceModeOnInstability("ACTIVE", false)).toBe("ACTIVE");
    expect(degradeIntelligenceModeOnInstability("ADVISORY", false)).toBe("ADVISORY");
    expect(degradeIntelligenceModeOnInstability("SHADOW", false)).toBe("SHADOW");
  });
});