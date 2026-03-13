// ts/core/calmstack/calmstack.ts
import { choosePosture, type Posture, type VolBand } from "../guardrails/posture";
import { createSessionGuardrail, type GuardrailOutput } from "../guardrails/sessionGuardrail";

export type CalmstackMode =
  | "OBSERVE"
  | "PREPARE"
  | "ENTER"
  | "MANAGE"
  | "EXIT"
  | "COOLDOWN_MODE"
  | "LOCKED_OBSERVE";

export type CalmstackInputs = {
  band: VolBand;
  positionOpen: boolean;

  mtfOk: boolean;
  locationOk: boolean;
  displacementOk: boolean;
  uncertaintyClear?: boolean;

  // used by session guardrail cooldown release
  m15ArmId?: string | number | null;

  // optional manual override
  postureOverride?: Posture;
};

export type CalmstackSnapshot = {
  ts: number;
  posture: Posture;
  mode: CalmstackMode;

  tradesTaken: number;
  allowEntry: boolean;

  mtfOk: boolean;
  locationOk: boolean;
  displacementOk: boolean;
  uncertaintyClear: boolean;

  band: VolBand;
  positionOpen: boolean;

  skipReasons: string[];
  guardrail: GuardrailOutput;
};

export function createCalmstackV1(opts?: { maxTradesPerSession?: number }) {
  const session = createSessionGuardrail({ maxTrades: opts?.maxTradesPerSession ?? 2 });

  let skipReasons: string[] = [];

  function step(input: CalmstackInputs): CalmstackSnapshot {
    skipReasons = [];

    const posture =
      input.postureOverride ??
      choosePosture({ band: input.band, positionOpen: input.positionOpen });

    const uncertaintyClear = input.uncertaintyClear ?? true;
    if (!uncertaintyClear) skipReasons.push("Skipped: uncertainty filter (no clarity)");

    const guardrail = session.canTrade();


    if (!input.mtfOk) skipReasons.push("Skipped: MTF Permission Stack not ready");
    if (!input.locationOk) skipReasons.push("Skipped: Location Gate blocked");
    if (!input.displacementOk) skipReasons.push("Skipped: No displacement trigger");
    if (input.band === "extreme") skipReasons.push("Skipped: volatility extreme");

    // Map guardrail READY → calmstack PREPARE
    let mode: CalmstackMode = guardrail.mode === "READY" ? "PREPARE" : guardrail.mode;

    // Allow entry only when guardrail allows + uncertaintyClear
    let allowEntry = guardrail.allowTrade && uncertaintyClear;

    // If locked or cooldown, no entry
    if (guardrail.mode === "LOCKED_OBSERVE" || guardrail.mode === "COOLDOWN_MODE") {
      allowEntry = false;
    }

    // Hard calm rule: defensive posture blocks new entries when flat
    if (!input.positionOpen && posture === "defensive") {
      allowEntry = false;
      skipReasons.push("Skipped: defensive posture");
      mode = guardrail.mode === "COOLDOWN_MODE" ? "COOLDOWN_MODE" : "OBSERVE";
    }

    // If in a position, always MANAGE
    if (input.positionOpen) mode = "MANAGE";

    return {
      ts: Date.now(),
      posture,
      mode,
      tradesTaken: guardrail.maxTrades - guardrail.remainingTrades,
      allowEntry,

      mtfOk: input.mtfOk,
      locationOk: input.locationOk,
      displacementOk: input.displacementOk,
      uncertaintyClear,

      band: input.band,
      positionOpen: input.positionOpen,

      skipReasons,
      guardrail,
    };
  }

  function onTradeTaken() {
    return session.onTradeTaken();
  }

  return { step, onTradeTaken };
}