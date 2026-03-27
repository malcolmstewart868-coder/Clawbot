/**
 * CLAWBOT NIGHT CYCLE — OBSERVE ONLY
 */
import { emitIntelligenceTelemetry } from "../shared/telemetry/intelligenceTelemetry";
import fs from "fs";
import path from "path";
import { applyAuthorityGate } from "../../src/intelligence/intelligenceAuthorityGate";
import type { ReentryStabilizerState } from "../../src/intelligence/reentryStabilizer";

import { superviseIntelligence } from "../../src/intelligence/intelligenceSupervisor";

import { setIntelligenceMode } from "../../src/intelligence/intelligenceMode";
import type { VolatilityAuthorityState } from "../../src/intelligence/volatilityAuthorityController";

// --- CONFIG ---
const LOG_PATH = path.resolve("logs/overnight.log");
const CYCLE_INTERVAL_MS = 5000;

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

let cycleRunning = false;

// --- INIT ---
if (!fs.existsSync("logs")) {
  fs.mkdirSync("logs");
}


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
  if (cycleRunning) {
    log({
      timestamp: new Date().toISOString(),
      message: "CYCLE SKIPPED — PREVIOUS CYCLE STILL RUNNING",
    });
    return;
  }

  cycleRunning = true;

  try {
    const supervisorResult = superviseIntelligence({
      decision: {
        action: "OBSERVE",
        reason: "Night cycle telemetry bridge",
      } as any,
      downstreamPacket: {} as any,
    });

    if (!supervisorResult) {
      throw new Error("supervisorResult missing");
    }

    const gatedResult = applyAuthorityGate({
      candidateAction: "OBSERVE",
      supervisor: {
        authorityGranted: supervisorResult.authorityGranted,
        observeOnly: supervisorResult.observeOnly,
        advisoryOnly: supervisorResult.advisoryOnly,
        supervisorNote: supervisorResult.supervisorNote,
        mode: supervisorResult.mode,
      },
    });

    let finalAction = gatedResult.finalAction;
    let execute = gatedResult.execute;

    if (EXECUTION_LOCK || MODE === "OBSERVE_ONLY") {
      finalAction = "OBSERVE";
      execute = false;

      log({
        timestamp: new Date().toISOString(),
        message: "EXECUTION BLOCKED — OBSERVE MODE ACTIVE",
      });
    }

    emitIntelligenceTelemetry({
      ...supervisorResult,
      authorityGranted: false,
      observeOnly: true,
      advisoryOnly: true,
    });

    log({
      timestamp: new Date().toISOString(),
      mode: MODE,

      h1Bias: "UNKNOWN",
      m15Arm: false,
      m5Trigger: false,

      recommendedAction: gatedResult.finalAction,
      finalAction,

      guardrailStatus: supervisorResult.mode,
      supervisorAuthorityGranted: supervisorResult.authorityGranted,
      supervisorObserveOnly: supervisorResult.observeOnly,
      supervisorAdvisoryOnly: supervisorResult.advisoryOnly,
      supervisorNote: supervisorResult.supervisorNote,

      gateAuthorityGranted: gatedResult.authorityGranted,
      gateReason: gatedResult.gateReason,

      volatilityState: "UNKNOWN",
      volatilityScore: 0,
      volatilityReasons: [],

      reentryState: reentryState.currentMode ?? "UNKNOWN",
      reentryStableCount: reentryState.stableCount ?? 0,
      reentryUnstableCount: reentryState.unstableCount ?? 0,
      reentryUpgraded: false,
      reentryReset: false,

      intelligenceMode: supervisorResult.mode,
      authorityState: authorityState.authorityState,
      authorityStableCycles: authorityState.stableCycles,
      authorityUnstableCycles: authorityState.unstableCycles,
      authorityTransitioned: false,
      authorityReasons: [],

      execute,
    });
  } catch (err: any) {
    log({
      timestamp: new Date().toISOString(),
      error: err?.message ?? String(err),
    });

    log({
      timestamp: new Date().toISOString(),
      message: "SAFE RESTART INITIATED",
    });
  } finally {
    cycleRunning = false;
  }
}

// --- LOOP ---
void runCycle();
setInterval(runCycle, CYCLE_INTERVAL_MS);