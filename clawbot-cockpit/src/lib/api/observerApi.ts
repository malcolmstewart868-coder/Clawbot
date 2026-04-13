import type { CockpitSnapshot } from "../types/cockpit";

const API_BASE = "http://localhost:3001";

export async function fetchStatus(): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/status`);
  if (!res.ok) throw new Error(`Status request failed: ${res.status}`);
  return res.json();
}

export async function fetchObserver(): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/observer`);
  if (!res.ok) throw new Error(`Observer request failed: ${res.status}`);
  return res.json();
}

export async function startObserver(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/start`, { method: "POST" });
  if (!res.ok) throw new Error(`Start request failed: ${res.status}`);
}

export async function stopObserver(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/stop`, { method: "POST" });
  if (!res.ok) throw new Error(`Stop request failed: ${res.status}`);
}

export { API_BASE };