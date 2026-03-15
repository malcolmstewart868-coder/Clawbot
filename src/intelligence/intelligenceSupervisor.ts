/**
 * Canonical v2 — Clawbot Intelligence Supervisor
 *
 * Purpose:
 * Govern whether intelligence output is allowed to influence downstream systems.
 *
 * This version upgrades the supervisor to read the global intelligence mode
 * from the central mode controller instead of requiring mode to be passed in.
 *
 * Modes:
 * - SHADOW: intelligence runs with zero authority
 * - ADVISORY: intelligence produces non-binding downstream recommendations
 * - ACTIVE: intelligence may influence downstream posture
 *
 * Status:
 * Safe supervisory layer.
 * No direct engine wiring is performed here.
 */

import type { IntelligenceDecision } from "./types";
import type { DownstreamRestrictionPacket } from "./intelligenceAdapter";
import { getIntelligenceMode, type IntelligenceMode } from "./intelligenceMode";

export interface IntelligenceSupervisorInput {
  decision: IntelligenceDecision;
  downstreamPacket: DownstreamRestrictionPacket;
}

export interface IntelligenceSupervisorResult {
  mode: IntelligenceMode;

  /**
   * Whether the downstream packet is allowed to influence live posture.
   */
  authorityGranted: boolean;

  /**
   * Whether the packet should only be observed/logged.
   */
  observeOnly: boolean;

  /**
   * Whether the packet is advisory but non-binding.
   */
  advisoryOnly: boolean;

  /**
   * Final supervisor-approved downstream packet.
   * In SHADOW, this remains trace output only.
   * In ADVISORY, this is recommendation output only.
   * In ACTIVE, this may be used downstream.
   */
  downstreamPacket: DownstreamRestrictionPacket;

  /**
   * Human-readable supervisor note.
   */
  supervisorNote: string;

  /**
   * Timestamp for supervisor result.
   */
  timestampUtc: string;

  /**
   * Version marker for supervisor contract.
   */
  version: string;
}

export function superviseIntelligence(
  input: IntelligenceSupervisorInput,
): IntelligenceSupervisorResult {
  const mode = getIntelligenceMode();

  switch (mode) {
    case "SHADOW":
      return {
        mode: "SHADOW",
        authorityGranted: false,
        observeOnly: true,
        advisoryOnly: false,
        downstreamPacket: input.downstreamPacket,
        supervisorNote:
          "Intelligence is running in SHADOW mode; downstream influence is disabled.",
        timestampUtc: new Date().toISOString(),
        version: "v2",
      };

    case "ADVISORY":
      return {
        mode: "ADVISORY",
        authorityGranted: false,
        observeOnly: false,
        advisoryOnly: true,
        downstreamPacket: input.downstreamPacket,
        supervisorNote:
          "Intelligence is running in ADVISORY mode; downstream output is non-binding.",
        timestampUtc: new Date().toISOString(),
        version: "v2",
      };

    case "ACTIVE":
      return {
        mode: "ACTIVE",
        authorityGranted: true,
        observeOnly: false,
        advisoryOnly: false,
        downstreamPacket: input.downstreamPacket,
        supervisorNote:
          "Intelligence is running in ACTIVE mode; downstream influence is authorized.",
        timestampUtc: new Date().toISOString(),
        version: "v2",
      };

    default: {
      const exhaustiveCheck: never = mode;
      throw new Error(`Unsupported intelligence mode: ${exhaustiveCheck}`);
    }
  }
}