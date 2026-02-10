// ts/api/server.ts
import express from "express";
import cors from "cors";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.API_PORT ?? 3001);

// --- simple in-memory log buffer + SSE clients ---
const logBuf: string[] = [];
const clients = new Set<express.Response>();

function pushLog(line: string) {
  const clean = line.replace(/\s+$/g, "");
  if (!clean) return;

  logBuf.push(clean);
  if (logBuf.length > 300) logBuf.splice(0, logBuf.length - 300);

  for (const res of clients) {
    res.write(`data: ${JSON.stringify({ line: clean })}\n\n`);
  }
}

// --- runner process control ---
let runnerProc: ChildProcessWithoutNullStreams | null = null;

function isRunning() {
  return !!runnerProc && !runnerProc.killed;
}

function startRunner() {
  if (isRunning()) {
    pushLog("🟡 runner already running");
    return;
  }

  // IMPORTANT: adjust this command to your real runner entry if needed
  // Example: "npm run runner" from inside /ts
  runnerProc = spawn("npm", ["run", "runner"], {
    cwd: process.cwd(), // should be /Clawbot/ts when you launch server from /ts
    shell: true,
    env: process.env,
  });

  runnerProc.stdout.on("data", (d) => pushLog(`🟢 ${String(d)}`));
  runnerProc.stderr.on("data", (d) => pushLog(`🔴 ${String(d)}`));

  runnerProc.on("close", (code) => {
    pushLog(`⚪ runner stopped (code ${code})`);
    runnerProc = null;
  });

  pushLog("🟢 runner started");
}

function stopRunner() {
  if (!runnerProc) {
    pushLog("🟡 runner not running");
    return;
  }

  // gentle stop
  runnerProc.kill("SIGINT");
  pushLog("🟠 stop signal sent");
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
  res.flushHeaders();

  clients.add(res);

  // send a hello + recent logs
  res.write(`data: ${JSON.stringify({ hello: true })}\n\n`);
  for (const line of logBuf.slice(-20)) {
    res.write(`data: ${JSON.stringify({ line })}\n\n`);
  }

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
