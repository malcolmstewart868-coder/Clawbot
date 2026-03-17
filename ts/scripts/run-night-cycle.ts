/**
 * CLAWBOT NIGHT CYCLE — OBSERVE ONLY
 */

import fs from "fs";
import path from "path";

import type { ReentryStabilizerState } from "../../src/intelligence/reentryStabilizer";
import { evaluateIntelligence } from "../../src/intelligence/intelligenceEvaluator";
import { adaptIntelligenceToDownstream } from "../../src/intelligence/intelligenceAdapter";
import { superviseIntelligence } from "../../src/intelligence/intelligenceSupervisor";

import { detectVolatility } from "../../src/intelligence/volatilityDetector";
import { stabilizeReentry } from "../../src/intelligence/reentryStabilizer";

import { setIntelligenceMode } from "../../src/intelligence/intelligenceMode";

import {
  controlVolatilityAuthority,
  mapAuthorityStateToIntelligenceMode,
  type VolatilityAuthorityState,
} from "../../src/intelligence/volatilityAuthorityController";

import { publishIntelligenceTelemetry } from "../../src/intelligence/intelligenceTelemetry";

// --- CONFIG ---
const LOG_PATH = path.resolve("logs/overnight.log");
const CYCLE_INTERVAL_MS = 5000; // 5 seconds

// --- HARD LOCK ---
const MODE = "OBSERVE_ONLY";
const EXECUTION_LOCK = true;

// --- STATE ---
let reentryState: ReentryStabilizerState = {
  stableCount: 0,
  unstableCount: 0,
  currentMode: "SHADOW",
};

let authorityState: VolatilityAuthorityState = {
  authorityState: "SHADOW",
  stableCycles: 0,
  unstableCycles: 0,
};

// --- INIT ---
if (!fs.existsSync("logs")) {
  fs.mkdirSync("logs");
}

// Force SHADOW mode
setIntelligenceMode("SHADOW");

// --- LOGGER ---
function log(entry: any) {
  const line = JSON.stringify(entry) + "\n";
  fs.appendFileSync(LOG_PATH, line);
  console.log(line);
}

// --- LAUNCH LOG ---
log({
  timestamp: new Date().toISOString(),
  message: "CLAWBOT NIGHT CYCLE ACTIVE — OBSERVE MODE ENGAGED",
  mode: MODE,
  execution_lock: EXECUTION_LOCK,
});

// --- MAIN LOOP ---
async function runCycle() {
  try {
    // ⚠️ Replace this later with real market feed
    const mockMarket = {
      h1Bias: "BULLISH",
      m15Arm: Math.random() > 0.5,
      m5Trigger: Math.random() > 0.7,
    };

    // --- INTELLIGENCE ---
    const decision = evaluateIntelligence({
      biasAligned: mockMarket.h1Bias === "BULLISH",
      armAligned: mockMarket.m15Arm,
      triggerReady: mockMarket.m5Trigger,
      possibleInvalidation: false,
      structureInvalid: false,
      confidence: Math.random(),
    });

    const packet = adaptIntelligenceToDownstream(decision);

    // --- VOLATILITY ---
    const volatility = detectVolatility({
      rangeExpansion: Math.random() * 2,
      atrRatio: Math.random() * 2,
      sweepFrequency: Math.random() * 2,
      invalidationFrequency: Math.random() * 2,
    });

    const authority = controlVolatilityAuthority({
      volatilityState: volatility.state,
      state: authorityState,
    });

      authorityState = {
  authorityState: authority.nextAuthorityState,
  stableCycles: authority.stableCycles,
  unstableCycles: authority.unstableCycles,
    };

     setIntelligenceMode(
     mapAuthorityStateToIntelligenceMode(authority.nextAuthorityState),
     );

    // --- REENTRY ---
    const reentry = stabilizeReentry({
      volatilityState: volatility.state,
      state: reentryState,
    });

      reentryState = {
      stableCount: reentry.stableCount,
      unstableCount: reentry.unstableCount,
      currentMode: reentry.nextMode,
    };

    // --- SUPERVISOR ---
    const supervisor = superviseIntelligence({
      decision,
      downstreamPacket: packet,
    });

    // --- EXECUTION BLOCK ---
    let finalAction = decision.action;
    let execute = false;

    if (EXECUTION_LOCK) {
      finalAction = "OBSERVE";
      execute = false;

      log({
        timestamp: new Date().toISOString(),
        message: "EXECUTION BLOCKED — OBSERVE MODE ACTIVE",
    });
    }

    // --- LOG CYCLE ---
   log({
  timestamp: new Date().toISOString(),
  mode: MODE,
  h1Bias: mockMarket.h1Bias,
  m15Arm: mockMarket.m15Arm,
  m5Trigger: mockMarket.m5Trigger,

  recommendedAction: finalAction,

  guardrailStatus: supervisor.mode,
  supervisorAuthorityGranted: supervisor.authorityGranted,
  supervisorObserveOnly: supervisor.observeOnly,
  supervisorAdvisoryOnly: supervisor.advisoryOnly,
  supervisorNote: supervisor.supervisorNote,

  volatilityState: volatility.state,
  volatilityScore: volatility.score,
  volatilityReasons: volatility.reasons.map((r) => r.code),

  reentryState: reentry.nextMode,
  reentryStableCount: reentry.stableCount,
  reentryUnstableCount: reentry.unstableCount,
  reentryUpgraded: reentry.upgraded,
  reentryReset: reentry.reset,

  intelligenceMode: mapAuthorityStateToIntelligenceMode(
    authority.nextAuthorityState,
  ),
  authorityState: authority.nextAuthorityState,
  authorityStableCycles: authority.stableCycles,
  authorityUnstableCycles: authority.unstableCycles,
  authorityTransitioned: authority.transitioned,
  authorityReasons: authority.reasons.map((r) => r.code),

  execute: false,
  });

    publishIntelligenceTelemetry({
      intelligenceMode: mapAuthorityStateToIntelligenceMode(
        authority.nextAuthorityState,
      ),
      authorityState: authority.nextAuthorityState,
      authorityStableCycles: authority.stableCycles,
      authorityUnstableCycles: authority.unstableCycles,
      authorityTransitioned: authority.transitioned,

      volatilityState: volatility.state,
      volatilityScore: volatility.score,

      supervisorAuthorityGranted: supervisor.authorityGranted,
      supervisorObserveOnly: supervisor.observeOnly,
      supervisorAdvisoryOnly: supervisor.advisoryOnly,
      supervisorNote: supervisor.supervisorNote,

      recommendedAction: finalAction,
      timestampUtc: new Date().toISOString(),
    });

  } catch (err: any) {
    log({
      timestamp: new Date().toISOString(),
      error: err.message,
    });

    log({
      timestamp: new Date().toISOString(),
      message: "SAFE RESTART INITIATED",
    });
  }
}

// --- LOOP ---
setInterval(runCycle, CYCLE_INTERVAL_MS);

