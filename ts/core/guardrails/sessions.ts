// ts/core/guardrails/sessions.ts
// Minimal session typing + helper used by runner imports.

export type SessionId = string;

export function ymdKeyUtcMinus4(d: Date = new Date()): string {
  // Fixed offset for UTC-4 (Trinidad & Tobago)
  const ms = d.getTime() + -4 * 60 * 60 * 1000;
  const dt = new Date(ms);

  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}