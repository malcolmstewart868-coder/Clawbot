/**
 * Clawbot Intelligence Telemetry Bridge
 *
 * Purpose:
 * Emit supervisor results so Observer / Cockpit can display
 * intelligence state in real time.
 */

import type { IntelligenceSupervisorResult } from "../../../src/intelligence/intelligenceSupervisor";

import { publishIntelligenceTelemetry } from "../../../src/shared/telemetry/intelligenceTelemetryStore";

export interface IntelligenceTelemetryPayload {
  mode: string;
  authorityGranted: boolean;
  observeOnly: boolean;
  advisoryOnly: boolean;
  supervisorNote: string;
  timestampUtc: string;
}

export function emitIntelligenceTelemetry(
  result: IntelligenceSupervisorResult
): IntelligenceTelemetryPayload {
  const payload: IntelligenceTelemetryPayload = {
    mode: result.mode,
    authorityGranted: result.authorityGranted,
    observeOnly: result.observeOnly,
    advisoryOnly: result.advisoryOnly,
    supervisorNote: result.supervisorNote,
    timestampUtc: result.timestampUtc,
    };
    publishIntelligenceTelemetry(payload);

  console.log("INTELLIGENCE_TELEMETRY", JSON.stringify(payload));

  return payload;
}