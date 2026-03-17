import { getLatestIntelligenceTelemetry } from "../../src/intelligence/intelligenceTelemetry";

export function getTelemetryHandler(req: any, res: any) {
  const data = getLatestIntelligenceTelemetry();

  if (!data) {
    return res.status(204).json({ message: "No telemetry yet" });
  }

  return res.json(data);
}