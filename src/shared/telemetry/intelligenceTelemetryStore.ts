import fs from "node:fs";
import path from "node:path";

export interface StoredIntelligenceTelemetryPayload {
  mode: string;
  authorityGranted: boolean;
  observeOnly: boolean;
  advisoryOnly: boolean;
  supervisorNote: string;
  timestampUtc: string;
}

export interface AuthorityTimelineEntry {
  ts: number;
  from: string;
  to: string;
  reason: string;
}

const STORAGE_DIR = path.resolve(process.cwd(), "storage");
const TELEMETRY_FILE = path.join(STORAGE_DIR, "intelligence-telemetry.json");
const TIMELINE_FILE = path.join(STORAGE_DIR, "authority-timeline.json");

function ensureStorage() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  if (!fs.existsSync(TELEMETRY_FILE)) {
    fs.writeFileSync(TELEMETRY_FILE, "null", "utf8");
  }

  if (!fs.existsSync(TIMELINE_FILE)) {
    fs.writeFileSync(TIMELINE_FILE, "[]", "utf8");
  }
}

function readLatestTelemetry(): StoredIntelligenceTelemetryPayload | null {
  ensureStorage();

  try {
    const raw = fs.readFileSync(TELEMETRY_FILE, "utf8");
    return JSON.parse(raw) as StoredIntelligenceTelemetryPayload | null;
  } catch {
    return null;
  }
}

function writeLatestTelemetry(
  payload: StoredIntelligenceTelemetryPayload | null
): void {
  ensureStorage();
  fs.writeFileSync(TELEMETRY_FILE, JSON.stringify(payload, null, 2), "utf8");
}

function readAuthorityTimeline(): AuthorityTimelineEntry[] {
  ensureStorage();

  try {
    const raw = fs.readFileSync(TIMELINE_FILE, "utf8");
    return JSON.parse(raw) as AuthorityTimelineEntry[];
  } catch {
    return [];
  }
}

function writeAuthorityTimeline(entries: AuthorityTimelineEntry[]): void {
  ensureStorage();
  fs.writeFileSync(TIMELINE_FILE, JSON.stringify(entries, null, 2), "utf8");
}

export function publishIntelligenceTelemetry(
  payload: StoredIntelligenceTelemetryPayload
): void {
  const previous = readLatestTelemetry();
  const timeline = readAuthorityTimeline();

  if (previous && previous.mode !== payload.mode) {
    timeline.push({
      ts: Date.now(),
      from: previous.mode,
      to: payload.mode,
      reason: payload.supervisorNote || "Mode transition",
    });
  }

  writeLatestTelemetry(payload);
  writeAuthorityTimeline(timeline.slice(-50));
}

export function getLatestIntelligenceTelemetry(): StoredIntelligenceTelemetryPayload | null {
  return readLatestTelemetry();
}

export function getAuthorityTimeline(): AuthorityTimelineEntry[] {
  return readAuthorityTimeline();
}