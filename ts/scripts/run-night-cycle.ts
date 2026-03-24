/**
 * CLAWBOT NIGHT CYCLE — OBSERVE ONLY
 */
import { emitIntelligenceTelemetry } from "../shared/telemetry/intelligenceTelemetry";
import fs from "fs";
import path from "path";
import { applyAuthorityGate} from "../../src/intelligence/intelligenceAuthorityGate";
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
    // --- SUPERVISOR TELEMETRY ONLY (stable bridge) ---
    const supervisorResult = superviseIntelligence({
      decision: {
        action: "OBSERVE",
        reason: "Night cycle telemetry bridge",
      } as any,
      downstreamPacket: {} as any,
    });

    emitIntelligenceTelemetry(supervisorResult);

    // --- EXECUTION BLOCK ---
    let finalAction = "OBSERVE";
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
      h1Bias: "UNKNOWN",
      m15Arm: false,
      m5Trigger: false,

      recommendedAction: finalAction,

      guardrailStatus: supervisorResult.mode,
      supervisorAuthorityGranted: supervisorResult.authorityGranted,
      supervisorObserveOnly: supervisorResult.observeOnly,
      supervisorAdvisoryOnly: supervisorResult.advisoryOnly,
      supervisorNote: supervisorResult.supervisorNote,

      volatilityState: "UNKNOWN",
      volatilityScore: 0,
      volatilityReasons: [],

      reentryState: "UNKNOWN",
      reentryStableCount: 0,
      reentryUnstableCount: 0,
      reentryUpgraded: false,
      reentryReset: false,

      intelligenceMode: supervisorResult.mode,
      authorityState: "SHADOW",
      authorityStableCycles: 0,
      authorityUnstableCycles: 0,
      authorityTransitioned: false,
      authorityReasons: [],

      execute,
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

