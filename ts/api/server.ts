import { getObserverState, resetObserverState, setObserverRunning } from "./observerState";
// ts/api/server.ts
import { setActiveSymbol } from "./multiSymbolState";


import express, { type Response } from "express";
import cors from "cors";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import {
  getLatestIntelligenceTelemetry as getStoredTelemetry,
  getAuthorityTimeline,
} from "../shared/telemetry/intelligenceTelemetryStore";
import { syncMultiSymbolStateFromEngine } from "./multiSymbolHydrator";
import { runParallelIntelligenceCycle } from "./parallelIntelligenceEngine";

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

function toStreamEvent(payload: any): {
  timestamp_utc: string;
  symbol: string;
  mode: string;
  market_state: string;
  observer_recommendation: string;
  finalAction: string;
  source: "system" | "observer" | "runtime";
} {
  return {
    timestamp_utc: String(
      payload?.timestamp_utc ??
      payload?.timestampUtc ??
      new Date().toISOString()
    ),
    symbol: String(payload?.symbol ?? "NO_SYMBOL").toUpperCase(),
    mode: String(payload?.mode ?? "UNKNOWN").toUpperCase(),
    market_state: String(payload?.market_state ?? "NO_STATE"),
    observer_recommendation: String(
      payload?.observer_recommendation ?? "NO_RECOMMENDATION"
    ),
    finalAction: String(payload?.finalAction ?? "NO_ACTION"),
    source:
      payload?.source === "system" ||
      payload?.source === "observer" ||
      payload?.source === "runtime"
        ? payload.source
        : "observer",
  };
}

async function buildObserverEventPayload() {
  syncMultiSymbolStateFromEngine();
  const multi = await runParallelIntelligenceCycle();

  const activeSymbol = multi.activeSymbol;
  const active = multi.symbols[activeSymbol];
  const calmstack = (active as any).calmstack ?? {};
  const position = (active as any).position ?? {};
  const lastAction = (active as any).lastAction ?? {};
  const supervisor = (active as any).supervisor ?? {
    mode: "SHADOW",
    authorityGranted: false,
    observeOnly: true,
    advisoryOnly: false,
    supervisorNote: "Initialized",
    timestampUtc: new Date().toISOString(),
  };

  return {
    timestamp_utc: supervisor.timestampUtc ?? new Date().toISOString(),
    mode: (active as any).intelligenceMode ?? supervisor.mode ?? "SHADOW",
    symbol: position.symbol ?? multi.activeSymbol ?? "NO_SYMBOL",
    market_state:
      (active as any).intelligence?.market_state ??
      calmstack.posture ??
      "NO_STATE",
    observer_recommendation:
      (active as any).intelligence?.observer_recommendation ??
      calmstack.mode ??
      "NO_RECOMMENDATION",
    finalAction: lastAction.type ?? "NO_ACTION",

    activeSymbol: multi.activeSymbol,
    observedSymbols: multi.observedSymbols,
    symbols: multi.symbols,
    state: active,
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

app.get("/api/observer/multi", async (_req, res) => {
  syncMultiSymbolStateFromEngine();
  const multi = await runParallelIntelligenceCycle();

  res.json({
    ok: true,
    ...multi,
  });
});

app.post("/api/observer/active-symbol", express.json(), (req, res) => {
  const symbol = String(req.body?.symbol ?? "").toUpperCase().trim();

  if (!symbol) {
    return res.status(400).json({ ok: false, error: "symbol is required" });
  }

  setActiveSymbol(symbol);

  return res.json({
    ok: true,
    activeSymbol: symbol,
  });
});

app.get("/api/observer/symbols", async (_req, res) => {
  syncMultiSymbolStateFromEngine();
  const multi = await runParallelIntelligenceCycle();

  res.json({
    ok: true,
    activeSymbol: multi.activeSymbol,
    observedSymbols: multi.observedSymbols,
    symbols: multi.symbols,
  });
});

app.get("/api/observer", (_req, res) => {
  const state = getObserverState();
  const telemetry = getStoredTelemetry();
  const authorityTimeline = getAuthorityTimeline();

  const supervisor = telemetry ?? {
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
  });
});

// Stream logs/events to the UI (SSE)
// Stream logs/events to the UI (SSE)
app.get("/api/events", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.flushHeaders?.();

  const clientId = Date.now();

  const client: SseClient = { id: clientId, res };
  sseClients.push(client);

  const writeEvent = (payload: any) => {
    const eventPayload = toStreamEvent(payload);
    res.write(`data: ${JSON.stringify(eventPayload)}\n\n`);
  };

  // canonical connection event
  writeEvent({
    timestamp_utc: new Date().toISOString(),
    symbol: "SYSTEM",
    mode: "CONNECTED",
    market_state: "SSE_READY",
    observer_recommendation: "STREAM_OPEN",
    finalAction: "connected",
    source: "system",
  });

  // immediate observer event after connection
  try {
  const multi = await buildObserverEventPayload();

  for (const symbol of multi.observedSymbols ?? []) {
    const symbolState = multi.symbols?.[symbol];

    if (!symbolState) continue;

    writeEvent({
      timestamp_utc:
        symbolState.supervisor?.timestampUtc ??
        multi.timestamp_utc ??
        new Date().toISOString(),

      symbol,

      mode:
        symbolState.supervisor?.mode ??
        symbolState.intelligenceMode ??
        "SHADOW",

      market_state:
        symbolState.intelligence?.market_state ??
        symbolState.calmstack?.posture ??
        "NO_STATE",

      observer_recommendation:
        symbolState.intelligence?.observer_recommendation ??
        symbolState.calmstack?.mode ??
        "NO_RECOMMENDATION",

      finalAction:
        symbolState.lastAction?.type ??
        "NO_ACTION",

      source: "observer",
    });
  }
} catch {
  writeEvent({
    timestamp_utc: new Date().toISOString(),
    symbol: "SYSTEM",
    mode: "ERROR",
    market_state: "SSE_ERROR",
    observer_recommendation: "CHECK_BACKEND",
    finalAction: "observe",
    source: "system",
  });
}

  const interval = setInterval(async () => {
    try {
  const multi = await buildObserverEventPayload();

  for (const symbol of multi.observedSymbols ?? []) {
    const symbolState = multi.symbols?.[symbol];

    if (!symbolState) continue;

    writeEvent({
      timestamp_utc:
        symbolState.supervisor?.timestampUtc ??
        multi.timestamp_utc ??
        new Date().toISOString(),

      symbol,

      mode:
        symbolState.supervisor?.mode ??
        symbolState.intelligenceMode ??
        "SHADOW",

      market_state:
        symbolState.intelligence?.market_state ??
        symbolState.calmstack?.posture ??
        "NO_STATE",

      observer_recommendation:
        symbolState.intelligence?.observer_recommendation ??
        symbolState.calmstack?.mode ??
        "NO_RECOMMENDATION",

      finalAction:
        symbolState.lastAction?.type ??
        "NO_ACTION",

      source: "observer",
    });
  }
} catch {
  writeEvent({
    timestamp_utc: new Date().toISOString(),
    symbol: "SYSTEM",
    mode: "ERROR",
    market_state: "SSE_ERROR",
    observer_recommendation: "CHECK_BACKEND",
    finalAction: "observe",
    source: "system",
  });
}
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


