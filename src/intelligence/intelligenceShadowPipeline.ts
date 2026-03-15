/**
 * Clawbot Intelligence Shadow Pipeline
 *
 * Runs the full intelligence pipeline in shadow mode:
 *
 * context
 *   → evaluateIntelligence()
 *   → adaptIntelligenceToDownstream()
 *
 * Prints both layers so we can inspect decisions.
 */

import {
  evaluateIntelligence,
  type IntelligenceEvaluationContext,
} from "./intelligenceEvaluator";

import { adaptIntelligenceToDownstream } from "./intelligenceAdapter";

function runScenario(
  name: string,
  context: IntelligenceEvaluationContext,
) {
  console.log("\n==============================");
  console.log("SCENARIO:", name);
  console.log("==============================");

  const decision = evaluateIntelligence(context);
  const downstream = adaptIntelligenceToDownstream(decision);

  console.log("\nINTELLIGENCE DECISION");
  console.log("---------------------");
  console.log(JSON.stringify(decision, null, 2));

  console.log("\nDOWNSTREAM PACKET");
  console.log("---------------------");
  console.log(JSON.stringify(downstream, null, 2));
}

/**
 * Shadow scenarios
 */

runScenario("Neutral Market", {
  biasAligned: false,
  armAligned: false,
  triggerReady: false,
  possibleInvalidation: false,
  structureInvalid: false,
});

runScenario("Possible Invalidation", {
  biasAligned: true,
  armAligned: false,
  triggerReady: false,
  possibleInvalidation: true,
  structureInvalid: false,
});

runScenario("Tightening Conditions", {
  biasAligned: true,
  armAligned: true,
  triggerReady: false,
  possibleInvalidation: false,
  structureInvalid: false,
  tightenLevel: 2,
});

runScenario("Clean Entry Alignment", {
  biasAligned: true,
  armAligned: true,
  triggerReady: true,
  possibleInvalidation: false,
  structureInvalid: false,
});

runScenario("Invalid Structure", {
  biasAligned: true,
  armAligned: true,
  triggerReady: true,
  possibleInvalidation: true,
  structureInvalid: true,
});