import fs from "node:fs";
import path from "node:path";
import type { BlackBoxEvent } from "./types";

export type BlackBoxSummary = {
  file: string;
  generatedAt: number;
  session?: string;
  scenario?: string;

  totals: {
    totalEvents: number;
    pauses: number;
    actionsApplied: number;
    gateEvaluations: number;
    calmstackEvaluations: number;
    intelSnapshots: number;
    sessionChanges: number;
  };

  posture: {
    seen: string[];
    shifts: number;
    last?: string;
  };

  guardrail: {
    allowTradeTrue: number;
    allowTradeFalse: number;
    reasons: Record<string, number>;
  };

  actions: {
    byType: Record<string, number>;
    byReason: Record<string, number>;
    last?: {
      type?: string;
      reason?: string;
      ts: number;
    };
  };

  position: {
    openedEvents: number;
    closedEvents: number;
    maxMark?: number;
    minMark?: number;
    lastKnown?: {
      open?: boolean;
      symbol?: string;
      side?: string;
      entry?: number;
      stop?: number | null;
      mark?: number | null;
    };
  };

  anomalies: string[];
};

function safeReadJsonLine(line: string): BlackBoxEvent | null {
  try {
    return JSON.parse(line) as BlackBoxEvent;
  } catch {
    return null;
  }
}

export function readBlackBoxFile(filePath: string): BlackBoxEvent[] {
  const raw = fs.readFileSync(filePath, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(safeReadJsonLine)
    .filter((v): v is BlackBoxEvent => v !== null);
}

export function summarizeBlackBox(events: BlackBoxEvent[], filePath: string): BlackBoxSummary {
  const postureSeen: string[] = [];
  let postureShifts = 0;
  let lastPosture: string | undefined;

  let pauses = 0;
  let actionsApplied = 0;
  let gateEvaluations = 0;
  let calmstackEvaluations = 0;
  let intelSnapshots = 0;
  let sessionChanges = 0;

  let allowTradeTrue = 0;
  let allowTradeFalse = 0;
  const guardrailReasons: Record<string, number> = {};

  const actionsByType: Record<string, number> = {};
  const actionsByReason: Record<string, number> = {};
  let lastAction: BlackBoxSummary["actions"]["last"];

  let openedEvents = 0;
  let closedEvents = 0;
  let prevOpen: boolean | undefined;
  let maxMark: number | undefined;
  let minMark: number | undefined;
  let lastKnownPosition: BlackBoxSummary["position"]["lastKnown"];

  const anomalies: string[] = [];

  let session: string | undefined;
  let scenario: string | undefined;

  for (const ev of events) {
    if (!session && ev.session) session = ev.session;
    if (!scenario && ev.scenario) scenario = ev.scenario;

    if (ev.type === "paused") pauses++;
    if (ev.type === "action_applied") actionsApplied++;
    if (ev.type === "gate_eval") gateEvaluations++;
    if (ev.type === "calmstack_eval") calmstackEvaluations++;
    if (ev.type === "intel_snapshot") intelSnapshots++;
    if (ev.type === "session_change") sessionChanges++;

    const posture = ev.calmstack?.posture;
    if (posture) {
      if (!postureSeen.includes(posture)) postureSeen.push(posture);
      if (lastPosture && posture !== lastPosture) postureShifts++;
      lastPosture = posture;
    }

    const allowTrade = ev.guardrail?.allowTrade;
    if (allowTrade === true) allowTradeTrue++;
    if (allowTrade === false) allowTradeFalse++;

    const reason = ev.guardrail?.reason;
    if (reason) {
      guardrailReasons[reason] = (guardrailReasons[reason] ?? 0) + 1;
    }

    const actionType = ev.action?.type;
    const actionReason = ev.action?.reason;

    if (actionType) {
      actionsByType[actionType] = (actionsByType[actionType] ?? 0) + 1;
    }
    if (actionReason) {
      actionsByReason[actionReason] = (actionsByReason[actionReason] ?? 0) + 1;
    }
    if (actionType || actionReason) {
      lastAction = {
        type: actionType,
        reason: actionReason,
        ts: ev.ts,
      };
    }

    const pos = ev.position;
    if (pos) {
      if (prevOpen !== undefined && prevOpen !== pos.open) {
        if (pos.open) openedEvents++;
        else closedEvents++;
      }
      prevOpen = pos.open;
      lastKnownPosition = {
        open: pos.open,
        symbol: pos.symbol,
        side: pos.side,
        entry: pos.entry,
        stop: pos.stop,
        mark: pos.mark,
      };

      if (typeof pos.mark === "number") {
        maxMark = maxMark === undefined ? pos.mark : Math.max(maxMark, pos.mark);
        minMark = minMark === undefined ? pos.mark : Math.min(minMark, pos.mark);
      }
    }

    if (ev.type === "action_applied" && !ev.action?.type && !ev.action?.reason) {
      anomalies.push(`Action event at ${ev.ts} had no action payload.`);
    }

    if (ev.type === "gate_eval" && ev.guardrail?.allowTrade === false && !ev.guardrail.reason) {
      anomalies.push(`Blocked gate_eval at ${ev.ts} had no reason.`);
    }

    if (ev.calmstack?.allowEntry === false && (!ev.calmstack.skipReasons || ev.calmstack.skipReasons.length === 0)) {
      anomalies.push(`Calmstack denied entry at ${ev.ts} without skipReasons.`);
    }
  }

  if (events.length === 0) {
    anomalies.push("No black box events found.");
  }

  return {
    file: path.basename(filePath),
    generatedAt: Date.now(),
    session,
    scenario,
    totals: {
      totalEvents: events.length,
      pauses,
      actionsApplied,
      gateEvaluations,
      calmstackEvaluations,
      intelSnapshots,
      sessionChanges,
    },
    posture: {
      seen: postureSeen,
      shifts: postureShifts,
      last: lastPosture,
    },
    guardrail: {
      allowTradeTrue,
      allowTradeFalse,
      reasons: guardrailReasons,
    },
    actions: {
      byType: actionsByType,
      byReason: actionsByReason,
      last: lastAction,
    },
    position: {
      openedEvents,
      closedEvents,
      maxMark,
      minMark,
      lastKnown: lastKnownPosition,
    },
    anomalies,
  };
}

export function writeSummaryReport(summary: BlackBoxSummary, outputPath: string) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2), "utf8");
}
