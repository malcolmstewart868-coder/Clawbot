/**
 * Canonical v1 — Clawbot Intelligence Layer schema
 *
 * Purpose:
 * Runtime validation for IntelligenceDecision objects.
 *
 * Important:
 * This schema is contract-first and intentionally conservative.
 * It does not yet wire into the engine.
 */

import { z } from "zod";
import { INTELLIGENCE_ACTIONS } from "./types";

export const IntelligenceActionSchema = z.enum(INTELLIGENCE_ACTIONS);

export const IntelligenceSourceSchema = z.enum([
  "intelligence-layer",
  "ral",
  "manual",
  "unknown",
]);

export const IntelligenceReasonSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});

export const IntelligenceDecisionSchema = z
  .object({
    action: IntelligenceActionSchema,

    allowEntry: z.boolean(),
    blockEntry: z.boolean(),

    tightenLevel: z.number().int().min(0).max(3).optional(),
    confidence: z.number().min(0).max(1).optional(),

    reasons: z.array(IntelligenceReasonSchema).default([]),

    source: IntelligenceSourceSchema.default("intelligence-layer"),

    timestampUtc: z.string().datetime(),

    version: z.string().optional(),

    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    /**
     * Canonical action consistency rules for v1
     */

    if (value.action === "BLOCK_ENTRY") {
      if (!value.blockEntry) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["blockEntry"],
          message: "BLOCK_ENTRY requires blockEntry=true",
        });
      }

      if (value.allowEntry) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["allowEntry"],
          message: "BLOCK_ENTRY requires allowEntry=false",
        });
      }
    }

    if (value.action === "ALLOW_ENTRY") {
      if (!value.allowEntry) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["allowEntry"],
          message: "ALLOW_ENTRY requires allowEntry=true",
        });
      }

      if (value.blockEntry) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["blockEntry"],
          message: "ALLOW_ENTRY requires blockEntry=false",
        });
      }
    }

    if (
      value.action === "OBSERVE" ||
      value.action === "OBSERVE_POSSIBLE_INVALIDATION" ||
      value.action === "TIGHTEN"
    ) {
      if (value.allowEntry && value.blockEntry) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["allowEntry"],
          message:
            "Non-terminal intelligence states cannot simultaneously allow and block entry",
        });
      }
    }

    if (value.action !== "TIGHTEN" && value.tightenLevel !== undefined && value.tightenLevel > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tightenLevel"],
        message: "tightenLevel > 0 should only be used with TIGHTEN in canonical v1",
      });
    }
  });

export type IntelligenceActionInput = z.infer<typeof IntelligenceActionSchema>;
export type IntelligenceReasonInput = z.infer<typeof IntelligenceReasonSchema>;
export type IntelligenceDecisionInput = z.infer<typeof IntelligenceDecisionSchema>;

/**
 * Safe parser helper.
 * Returns null on failure instead of throwing.
 */
export function safeParseIntelligenceDecision(
  input: unknown,
): IntelligenceDecisionInput | null {
  const result = IntelligenceDecisionSchema.safeParse(input);
  return result.success ? result.data : null;
}

/**
 * Strict parser helper.
 * Throws if invalid.
 */
export function parseIntelligenceDecision(
  input: unknown,
): IntelligenceDecisionInput {
  return IntelligenceDecisionSchema.parse(input);
}