// ts/api/server.ts
import express from "express";
import cors from "cors";
import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";

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
  if (logBuf.length > 500) logBuf.splice(0, logBuf.length - 500);

  for (const res of clients) {
    res.write(`data: ${JSON.stringify({ line: clean })}\n\n`);
  }
}

let proc: ChildProcessWithoutNullStreams | null = null;

function isRunning() {
  return !!proc && !proc.killed;
}

function stopRunner() {
  if (!proc) return;
  try {
    proc.kill();
  } catch {}
  proc = null;
}

app.get("/status", (_req, res) => {
  res.json({
    running: isRunning(),
    last: logBuf.slice(-50),
  });
});

// Stream logs/events to the UI
app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  clients.add(res);

  // send a small hello + recent logs
  res.write(`data: ${JSON.stringify({ hello: true })}\n\n`);
  for (const line of logBuf.slice(-25)) {
    res.write(`data: ${JSON.stringify({ line })}\n\n`);
  }

  req.on("close", () => {
    clients.delete(res);
  });
});

app.post("/run/sim", (req, res) => {
  if (isRunning()) {
    return res.status(409).json({ ok: false, reason: "runner already active" });
  }

  const exchange = String(req.body?.exchange ?? "paper").toLowerCase();
  pushLog(`🟢 API: launching SIM runner (exchange=${exchange})`);

  // IMPORTANT: runner lives in ts/app/runner.ts
  // We run it from the /ts folder so relative imports behave.
  proc = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["ts-node", "app/runner.ts"],
    {
      cwd: require("node:path").join(process.cwd(), "ts"),
      env: { ...process.env, EXCHANGE: exchange },
    }
  );

  proc.stdout.on("data", (d) => pushLog(String(d)));
  proc.stderr.on("data", (d) => pushLog(`🔴 ${String(d)}`));

  proc.on("close", (code) => {
    pushLog(`✅ runner ended (code=${code})`);
    proc = null;
  });

  res.status(202).json({ ok: true });
});

app.post("/stop", (_req, res) => {
  if (!isRunning()) return res.json({ ok: true, alreadyStopped: true });
  pushLog("🟡 API: stopping runner");
  stopRunner();
  res.json({ ok: true });
});

// health check FIRST (before listen)
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, name: "clawbot-api" })
);
let runnerProc: import("node:child_process").ChildProcessWithoutNullStreams | null = null;

function startRunner() {
  if (runnerProc) return; // already running

  // from ts/api/server.ts → go up one level into ts/, then app/runner.ts
  runnerProc = spawn("npx", ["ts-node", "app/runner.ts"], {
    cwd: process.cwd(),
    env: process.env,
  });

  runnerProc.stdout.on("data", (d) => pushLog(`🐾 runner: ${d.toString()}`));
  runnerProc.stderr.on("data", (d) => pushLog(`🧯 runner err: ${d.toString()}`));

  runnerProc.on("close", (code) => {
    pushLog(`⏹ runner stopped (code ${code})`);
    runnerProc = null;
  });

  pushLog("▶️ runner started");
}

function stopRunner() {
  if (!runnerProc) return;
  runnerProc.kill("SIGINT"); // gentle stop
  pushLog("🛑 stop signal sent");
}

// listen ONCE
app.listen(PORT, () => {
  console.log(`🟢 API listening on http://localhost:${PORT}`);
});
