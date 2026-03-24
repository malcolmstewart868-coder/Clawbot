import fs from "fs";
import path from "path";

const STORAGE_PATH = path.resolve(__dirname, "../../storage");

const TELEMETRY_FILE = path.join(STORAGE_PATH, "intelligence-telemetry.json");
const TIMELINE_FILE = path.join(STORAGE_PATH, "authority-timeline.json");

// --- TELEMETRY ---

export function writeTelemetry(data: any) {
  fs.writeFileSync(TELEMETRY_FILE, JSON.stringify(data, null, 2));
}

export function getLastTelemetry(): any | null {
  try {
    const raw = fs.readFileSync(TELEMETRY_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// --- AUTHORITY TIMELINE ---

export function writeAuthorityTimeline(entry: any) {
  let timeline: any[] = [];

  try {
    const raw = fs.readFileSync(TIMELINE_FILE, "utf-8");
    timeline = JSON.parse(raw);
  } catch {
    timeline = [];
  }

  timeline.push(entry);

  fs.writeFileSync(TIMELINE_FILE, JSON.stringify(timeline, null, 2));
}