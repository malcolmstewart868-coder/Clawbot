/**
 * Regulated Awareness Layer (RAL) — Minimal, Governed Schema + Parser (v1.0)
 *
 * README:
 * - Supervisor should call `parseRALOutput()` and treat failsafe as OBSERVE.
 * - This schema enforces restriction-only behavior. On any parse error, default is OBSERVE.
 * - If action is TIGHTEN, tighten_level must be explicitly provided (0–3).
 * - If action is OBSERVE_POSSIBLE_INVALIDATION, invalidation_watch_minutes must be provided (>0).
 *
 * Suggested file path:
 *   src/ral/ralSchema.ts
 */

import { z } from "zod";

// --- Schema Definition ---
const RALSchema = z.object({
  recommended_action: z.enum([
    "OBSERVE",
    "OBSERVE_POSSIBLE_INVALIDATION",
    "TIGHTEN",
  ]),
  tighten_level: z.number().int().min(0).max(3).optional(),
  invalidation_watch_minutes: z.number().int().positive().optional(),
  notes: z.string().max(300).optional(), // short log-friendly notes
});

// --- Type ---
export type RALOutput = z.infer<typeof RALSchema>;

// --- Failsafe Output (Canonical) ---
// Default posture on any error or ambiguity: OBSERVE + strictest tighten level.
export const RAL_FAILSAFE: RALOutput = {
  recommended_action: "OBSERVE",
  tighten_level: 3,
  notes: "RAL output missing/invalid/ambiguous; defaulting to safest posture.",
};

// --- Strict Parsing Helper ---
// Accepts either:
// - an object
// - a JSON string
// Never throws. Always returns a valid RALOutput (failsafe on any failure).
export function parseRALOutput(input: unknown): RALOutput {
  try {
    const obj = typeof input === "string" ? JSON.parse(input) : input;
    const parsed = RALSchema.parse(obj);

    // Rule: if OBSERVE_POSSIBLE_INVALIDATION → invalidation_watch_minutes required (>0)
    if (
      parsed.recommended_action === "OBSERVE_POSSIBLE_INVALIDATION" &&
      (!parsed.invalidation_watch_minutes ||
        parsed.invalidation_watch_minutes <= 0)
    ) {
      return RAL_FAILSAFE;
    }

    // Rule: if TIGHTEN → tighten_level must be explicitly provided (0–3)
    if (
      parsed.recommended_action === "TIGHTEN" &&
      (parsed.tighten_level === undefined || Number.isNaN(parsed.tighten_level))
    ) {
      return RAL_FAILSAFE;
    }

    // Optional: normalize notes length and provide a safe default notes string
    if (!parsed.notes) {
      return { ...parsed, notes: "RAL ok" };
    }

    return parsed;
  } catch {
    return RAL_FAILSAFE;
  }
}