import { getObserverState, resetObserverState, setObserverRunning } from "./observerState";
// ts/api/server.ts

import express, { type Response } from "express";
import cors from "cors";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import {
  getLatestIntelligenceTelemetry as getStoredTelemetry,
  getAuthorityTimeline,
} from "../shared/telemetry/intelligenceTelemetryStore";

  const app = express();
    app.use(
    cors({
    origin: "*",
    methods: ["GET", "POST"],
     })
     );
    app.use(express.json());

const PORT = Number(process.env.API_PORT ?? 3001);

// --- simple in-memory log buffer + SSE clients ---
const logBuf: string[] = [];
const clients = new Set<Response>();

function pushLog(line: string) {
  const clean = String(line).replace(/\s+$/g, "");
  if (!clean) return;

  logBuf.push(clean);
  if (logBuf.length > 300) logBuf.splice(0, logBuf.length - 300);

  const payload = `data: ${JSON.stringify({ line: clean, ts: Date.now() })}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      // ignore dead clients
    }
  }
}

// --- runner process control ---
let runnerProc: ChildProcessWithoutNullStreams | null = null;

function isRunning() {
  return !!runnerProc && runnerProc.exitCode === null;
}

function startRunner() {
  if (isRunning()) {
    pushLog("🟡 runner already running");
    return;
  }

  resetObserverState();

  runnerProc = spawn("npm", ["run", "runner"],
  {cwd: process.cwd(), // start API from /Clawbot/ts so this points at /ts
    shell: true,
    env: process.env,
  });
    
    setObserverRunning(true);

  runnerProc.stdout.on("data", (d) => pushLog(`🟢 ${String(d)}`));
  runnerProc.stderr.on("data", (d) => pushLog(`🔴 ${String(d)}`));

  runnerProc.on("close", (code, signal) => {
  setObserverRunning(false);
  pushLog(`⚪ runner stopped (code ${code ?? "?"}, signal ${signal ?? "?"})`);
  runnerProc = null;
});

  pushLog("🟢 runner started");
}

function stopRunner() {
  if (!isRunning()) {
    pushLog("🟡 runner not running");
    runnerProc = null;
    return;
  }

  // gentle stop first
  runnerProc!.kill("SIGINT");
  pushLog("🟠 stop signal sent (SIGINT)");

  // fallback (in case it ignores SIGINT)
  setTimeout(() => {
    if (isRunning()) {
      runnerProc!.kill("SIGTERM");
      pushLog("🟠 fallback stop sent (SIGTERM)");
    }
  }, 2500);
}

type SseClient = {
  id: number;
  res: import("express").Response;
};

const sseClients: SseClient[] = [];

function sendSseEvent(event: Record<string, unknown>) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    client.res.write(payload);
  }
}

function buildObserverEventPayload() {
  const state = getObserverState?.() ?? getStoredTelemetry?.() ?? {};

  const engine = (state as any).engine ?? {};
  const calmstack = (state as any).calmstack ?? {};
  const guardrail = (state as any).guardrail ?? {};
  const position = (state as any).position ?? {};
  const lastAction = (state as any).lastAction ?? {};
  const supervisor = (state as any).supervisor ?? {
    mode: "SHADOW",
    authorityGranted: false,
    observeOnly: true,
    advisoryOnly: false,
    supervisorNote: "Initialized",
    timestampUtc: new Date().toISOString(),
  };

  return {
    timestamp_utc: supervisor.timestampUtc ?? new Date().toISOString(),
    mode: (state as any).intelligenceMode ?? supervisor.mode ?? "SHADOW",
    symbol: position.symbol ?? "NO_SYMBOL",
    market_state: calmstack.posture ?? "NO_STATE",
    observer_recommendation: calmstack.mode ?? "NO_RECOMMENDATION",
    finalAction: lastAction.type ?? "NO_ACTION",

    state: {
      engine,
      calmstack,
      guardrail,
      position,
      lastAction,
      intelligenceMode: (state as any).intelligenceMode ?? supervisor.mode ?? "SHADOW",
      supervisor,
    },
  };
}

// --- API routes (ALL under /api) ---
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "clawbot-api" });
});

app.get("/api/status", (_req, res) => {
  const telemetry = getStoredTelemetry();

  const supervisor = telemetry ?? {
    mode: "SHADOW",
    authorityGranted: false,
    observeOnly: true,
    advisoryOnly: false,
    supervisorNote: "Initialized",
    timestampUtc: new Date().toISOString(),
  };

  res.json({
    engine_state: "RUNNING",
    mode: supervisor.mode ?? "SHADOW",
    observe_lock: supervisor.observeOnly ?? true,
    timestamp_utc: supervisor.timestampUtc ?? new Date().toISOString(),
  });
});

app.get("/api/observer", (_req, res) => {
  const state = getObserverState();
  const telemetry = getStoredTelemetry();
  const authorityTimeline = getAuthorityTimeline();

          const supervisor= telemetry ?? {
            mode: "SHADOW",
            authorityGranted: false,
            observeOnly: true,
            advisoryOnly: false,
            supervisorNote: "Initialized",
            timestampUtc: new Date().toISOString(),
          };
       res.json({
        ok: true,
        state: {
          ...state,
          intelligenceMode: supervisor.mode,
          supervisor,
          authorityTimeline,
      },
  }),
{}});

// Stream logs/events to the UI (SSE)
app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.flushHeaders?.();

  const clientId = Date.now();

  const client = { id: clientId, res };
  sseClients.push(client);

  res.write(`data: ${JSON.stringify({
    timestamp_utc: new Date().toISOString(),
    mode: "CONNECTED",
    symbol: "SYSTEM",
    market_state: "SSE_READY",
    observer_recommendation: "STREAM_OPEN",
    finalAction: "connected",
  })}\n\n`);

  const interval = setInterval(() => {
    const eventPayload = buildObserverEventPayload();
    res.write(`data: ${JSON.stringify(eventPayload)}\n\n`);
  }, 3000);

  req.on("close", () => {
    clearInterval(interval);
    const index = sseClients.findIndex((c) => c.id === clientId);
    if (index !== -1) sseClients.splice(index, 1);
    res.end();
  });
});

app.post("/api/start", (_req, res) => {
  startRunner();
  res.json({ ok: true, running: isRunning() });
});

app.post("/api/stop", (_req, res) => {
  stopRunner();
  res.json({ ok: true, running: isRunning() });
});

// --- start server ONCE ---
app.listen(PORT, () => {
  console.log(`🟢 API listening on http://localhost:${PORT}`);
  pushLog(`🟢 API listening on http://localhost:${PORT}`);
});
function getLatestIntelligenceTelemetry() {
  throw new Error("Function not implemented.");
}

