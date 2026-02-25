// ts/core/guardrails/entryGate.ts
// Minimal, restriction-first entry gate.
// If anything is unclear, it should return allowTrade: false.

export type EntryGateInput = {
  mtfOk: boolean;
  locationOk: boolean;
  displacementOk: boolean;
  uncertaintyClear?: boolean; // optional for now
};

export type EntryGateOutput = {
  allowTrade: boolean;
  reason?: string;
};

export function entryGateAll(input: EntryGateInput): EntryGateOutput {
  if (!input.mtfOk) return { allowTrade: false, reason: "entryGate: mtf not aligned" };
  if (!input.locationOk) return { allowTrade: false, reason: "entryGate: location not valid" };
  if (!input.displacementOk) return { allowTrade: false, reason: "entryGate: displacement not confirmed" };
  if (input.uncertaintyClear === false) return { allowTrade: false, reason: "entryGate: uncertainty not clear" };

  return { allowTrade: true };
}