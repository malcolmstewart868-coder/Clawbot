// ts/api/server.ts
import express, { type Response } from "express";
import cors from "cors";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

const app = express();
app.use(cors());
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

  runnerProc = spawn("npm", ["run", "runner"], {
    cwd: process.cwd(), // start API from /Clawbot/ts so this points at /ts
    shell: true,
    env: process.env,
  });

  runnerProc.stdout.on("data", (d) => pushLog(`🟢 ${String(d)}`));
  runnerProc.stderr.on("data", (d) => pushLog(`🔴 ${String(d)}`));

  runnerProc.on("close", (code, signal) => {
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

// --- API routes (ALL under /api) ---
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "clawbot-api" });
});

app.get("/api/status", (_req, res) => {
  res.json({
    ok: true,
    running: isRunning(),
    last: logBuf.slice(-50),
  });
});

// Stream logs/events to the UI (SSE)
app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  clients.add(res);

  // hello + recent logs
  res.write(`data: ${JSON.stringify({ hello: true, last: logBuf.slice(-50) })}\n\n`);

  req.on("close", () => {
    clients.delete(res);
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
