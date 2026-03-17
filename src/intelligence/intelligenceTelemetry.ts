import fs from "fs";
import path from "path";

export interface IntelligenceTelemetryPayload {
  intelligenceMode: string;
  authorityState: string;
  authorityStableCycles: number;
  authorityUnstableCycles: number;
  authorityTransitioned: boolean;

  volatilityState: string;
  volatilityScore: number;

  supervisorAuthorityGranted: boolean;
  supervisorObserveOnly: boolean;
  supervisorAdvisoryOnly: boolean;
  supervisorNote: string;

  recommendedAction: string;
  timestampUtc: string;
}

// --- FILE PATH ---
const TELEMETRY_PATH = path.resolve("logs/intelligence.json");

// --- WRITE (ENGINE SIDE) ---
export function publishIntelligenceTelemetry(
  payload: IntelligenceTelemetryPayload,
): void {
  try {
    fs.writeFileSync(
      TELEMETRY_PATH,
      JSON.stringify(payload, null, 2),
    );
  } catch (err) {
    console.error("Telemetry write failed:", err);
  }
}

// --- READ (API / DASHBOARD SIDE) ---
export function getLatestIntelligenceTelemetry(): IntelligenceTelemetryPayload | null {
  try {
    if (!fs.existsSync(TELEMETRY_PATH)) return null;

    const raw = fs.readFileSync(TELEMETRY_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Telemetry read failed:", err);
    return null;
  }
}