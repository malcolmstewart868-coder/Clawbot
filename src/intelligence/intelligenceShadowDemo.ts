/**
 * Canonical v1 — Clawbot Intelligence Shadow Console
 *
 * Purpose:
 * Safe standalone console runner for the Intelligence Layer.
 *
 * This file allows us to simulate market-state contexts and inspect
 * the resulting intelligence decisions without wiring into the live engine.
 *
 * Status:
 * Shadow-mode only.
 * No impact on Calmstack, Guardrails, Execution, Observer API, or Cockpit runtime.
 */

import {
  evaluateIntelligence,
  type IntelligenceEvaluationContext,
} from "./intelligenceEvaluator";
import type { IntelligenceDecision } from "./types";

interface ShadowScenario {
  name: string;
  description: string;
  context: IntelligenceEvaluationContext;
}

const SHADOW_SCENARIOS: ShadowScenario[] = [
  {
    name: "observe-neutral",
    description:
      "No meaningful structural alignment yet; system should remain passive.",
    context: {
      biasAligned: false,
      armAligned: false,
      triggerReady: false,
      possibleInvalidation: false,
      structureInvalid: false,
      tightenLevel: 0,
      confidence: 0.42,
      metadata: {
        scenario: "observe-neutral",
        phase: "shadow-demo",
      },
    },
  },
  {
    name: "observe-possible-invalidation",
    description:
      "Partial structure exists, but early weakening is present; continue observing with warning posture.",
    context: {
      biasAligned: true,
      armAligned: false,
      triggerReady: false,
      possibleInvalidation: true,
      structureInvalid: false,
      tightenLevel: 0,
      confidence: 0.58,
      metadata: {
        scenario: "observe-possible-invalidation",
        phase: "shadow-demo",
      },
    },
  },
  {
    name: "tighten-filter",
    description:
      "Potential structure exists, but market conditions require stricter tolerance.",
    context: {
      biasAligned: true,
      armAligned: true,
      triggerReady: false,
      possibleInvalidation: false,
      structureInvalid: false,
      tightenLevel: 2,
      confidence: 0.73,
      metadata: {
        scenario: "tighten-filter",
        phase: "shadow-demo",
      },
    },
  },
  {
    name: "allow-entry-clean",
    description:
      "Bias, arm, and trigger are aligned with no active invalidation pressure.",
    context: {
      biasAligned: true,
      armAligned: true,
      triggerReady: true,
      possibleInvalidation: false,
      structureInvalid: false,
      tightenLevel: 0,
      confidence: 0.87,
      metadata: {
        scenario: "allow-entry-clean",
        phase: "shadow-demo",
      },
    },
  },
  {
    name: "block-entry-invalid",
    description:
      "Structure is invalid; entry must be blocked even if some alignment exists.",
    context: {
      biasAligned: true,
      armAligned: true,
      triggerReady: true,
      possibleInvalidation: true,
      structureInvalid: true,
      tightenLevel: 3,
      confidence: 0.91,
      metadata: {
        scenario: "block-entry-invalid",
        phase: "shadow-demo",
      },
    },
  },
];

/**
 * Formats a simple yes/no indicator for console readability.
 */
function yn(value: boolean): string {
  return value ? "YES" : "NO";
}

/**
 * Formats a decision into a readable shadow-console block.
 */
function formatDecisionReport(
  scenario: ShadowScenario,
  decision: IntelligenceDecision,
): string {
  const reasons =
    decision.reasons.length > 0
      ? decision.reasons
          .map((r, index) => `  ${index + 1}. [${r.code}] ${r.message}`)
          .join("\n")
      : "  none";

  const metadata =
    decision.metadata && Object.keys(decision.metadata).length > 0
      ? JSON.stringify(decision.metadata, null, 2)
      : "{}";

  return [
    "",
    "============================================================",
    `SHADOW SCENARIO: ${scenario.name}`,
    "------------------------------------------------------------",
    `Description   : ${scenario.description}`,
    `Action        : ${decision.action}`,
    `Allow Entry   : ${yn(decision.allowEntry)}`,
    `Block Entry   : ${yn(decision.blockEntry)}`,
    `Tighten Level : ${decision.tightenLevel ?? 0}`,
    `Confidence    : ${decision.confidence ?? "n/a"}`,
    `Source        : ${decision.source}`,
    `Version       : ${decision.version ?? "n/a"}`,
    `Timestamp UTC : ${decision.timestampUtc}`,
    "Reasons:",
    reasons,
    "Metadata:",
    metadata,
    "============================================================",
    "",
  ].join("\n");
}

/**
 * Runs all shadow scenarios and prints the resulting intelligence decisions.
 */
export function runIntelligenceShadowDemo(): void {
  console.log("\nClawbot Intelligence Layer — Shadow Console");
  console.log("Mode: SHADOW ONLY");
  console.log("Runtime effect: NONE");
  console.log(
    "Flow: market signal -> intelligence layer -> calmstack -> guardrails -> execution engine -> observer -> cockpit",
  );

  for (const scenario of SHADOW_SCENARIOS) {
    const decision = evaluateIntelligence(scenario.context);
    console.log(formatDecisionReport(scenario, decision));
  }

  console.log("Shadow demo complete.\n");
}

/**
 * Allows direct CLI execution:
 * ts-node --project ts/tsconfig.json src/intelligence/intelligenceShadowDemo.ts
 */
if (require.main === module) {
  runIntelligenceShadowDemo();
}