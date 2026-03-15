/**
 * Canonical v1 — Clawbot Intelligence Governed Pipeline
 *
 * Purpose:
 * Run the full governed intelligence flow end-to-end:
 *
 * context
 *   -> evaluateIntelligence()
 *   -> adaptIntelligenceToDownstream()
 *   -> superviseIntelligence()
 *
 * This proves the subsystem works as a governed chain before
 * wiring it into Observer or Cockpit.
 */

import {
  evaluateIntelligence,
  type IntelligenceEvaluationContext,
} from "./intelligenceEvaluator";
import { adaptIntelligenceToDownstream } from "./intelligenceAdapter";
import { superviseIntelligence } from "./intelligenceSupervisor";
import {
  resetIntelligenceMode,
  setIntelligenceMode,
  type IntelligenceMode,
} from "./intelligenceMode";

import { emitIntelligenceTelemetry } from "../shared/telemetry/intelligenceTelemetry";

interface GovernedScenario {
  name: string;
  context: IntelligenceEvaluationContext;
}

const SCENARIOS: GovernedScenario[] = [
  {
    name: "Neutral Market",
    context: {
      biasAligned: false,
      armAligned: false,
      triggerReady: false,
      possibleInvalidation: false,
      structureInvalid: false,
      confidence: 0.42,
      metadata: {
        scenario: "neutral-market",
      },
    },
  },
  {
    name: "Possible Invalidation",
    context: {
      biasAligned: true,
      armAligned: false,
      triggerReady: false,
      possibleInvalidation: true,
      structureInvalid: false,
      confidence: 0.57,
      metadata: {
        scenario: "possible-invalidation",
      },
    },
  },
  {
    name: "Tightening Conditions",
    context: {
      biasAligned: true,
      armAligned: true,
      triggerReady: false,
      possibleInvalidation: false,
      structureInvalid: false,
      tightenLevel: 2,
      confidence: 0.71,
      metadata: {
        scenario: "tightening-conditions",
      },
    },
  },
  {
    name: "Clean Entry Alignment",
    context: {
      biasAligned: true,
      armAligned: true,
      triggerReady: true,
      possibleInvalidation: false,
      structureInvalid: false,
      confidence: 0.88,
      metadata: {
        scenario: "clean-entry-alignment",
      },
    },
  },
  {
    name: "Invalid Structure",
    context: {
      biasAligned: true,
      armAligned: true,
      triggerReady: true,
      possibleInvalidation: true,
      structureInvalid: true,
      tightenLevel: 3,
      confidence: 0.93,
      metadata: {
        scenario: "invalid-structure",
      },
    },
  },
];

const MODES: IntelligenceMode[] = ["SHADOW", "ADVISORY", "ACTIVE"];

function divider(label?: string): void {
  const line = "=".repeat(72);
  if (label) {
    console.log(`\n${line}`);
    console.log(label);
    console.log(line);
    return;
  }
  console.log(`\n${line}`);
}

function printJsonBlock(title: string, value: unknown): void {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
  console.log(JSON.stringify(value, null, 2));
}

function runGovernedScenario(
  mode: IntelligenceMode,
  scenario: GovernedScenario,
): void {
  setIntelligenceMode(mode);

  const decision = evaluateIntelligence(scenario.context);
  const downstreamPacket = adaptIntelligenceToDownstream(decision);
  const supervisorResult = superviseIntelligence({
    decision,
    downstreamPacket,
  });

  emitIntelligenceTelemetry(supervisorResult);
    
  divider(`MODE: ${mode} | SCENARIO: ${scenario.name}`);

  printJsonBlock("INTELLIGENCE DECISION", decision);
  printJsonBlock("DOWNSTREAM PACKET", downstreamPacket);
  printJsonBlock("SUPERVISOR RESULT", supervisorResult);
}

export function runIntelligenceGovernedPipeline(): void {
  resetIntelligenceMode();

  divider("CLAWBOT INTELLIGENCE GOVERNED PIPELINE");
  console.log("Status: SHADOW-SAFE GOVERNED PIPELINE");
  console.log("Effect on live engine: NONE");
  console.log(
    "Flow: evaluateIntelligence -> adaptIntelligenceToDownstream -> superviseIntelligence",
  );

  for (const mode of MODES) {
    for (const scenario of SCENARIOS) {
      runGovernedScenario(mode, scenario);
    }
  }

  resetIntelligenceMode();
  divider("PIPELINE COMPLETE");
  console.log("Intelligence mode reset to SHADOW.");
}

if (require.main === module) {
  runIntelligenceGovernedPipeline();
}