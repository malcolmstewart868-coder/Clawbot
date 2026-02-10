import React, { useEffect, useState } from "react";

type StatusRes = {
  ok: boolean;
  running: boolean;
  last?: string[];
};

export default function App() {
  const [connected, setConnected] = useState(false);
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function refreshStatus() {
    try {
      setErr(null);
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error(`Status failed: ${res.status}`);
      const data = (await res.json()) as StatusRes;

      setConnected(true);
      setRunning(!!data.running);
      setLast(Array.isArray(data.last) ? data.last : []);
    } catch (e: any) {
      setConnected(false);
      setErr(e?.message ?? "Unknown error");
    }
  }

  async function post(path: "/api/start" | "/api/stop") {
    try {
      setErr(null);
      const res = await fetch(path, { method: "POST" });

      // If server returns HTML error page, this prevents confusing alerts
      const ct = res.headers.get("content-type") || "";
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body.includes("Cannot")
          ? body.replace(/<[^>]*>/g, "").trim()
          : `Request failed: ${res.status}`);
      }

      if (ct.includes("application/json")) {
        await res.json();
      }

      await refreshStatus();
    } catch (e: any) {
      setErr(e?.message ?? "Unknown error");
    }
  }

  useEffect(() => {
    refreshStatus();
    const t = setInterval(refreshStatus, 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>🐾 Clawbot Control Panel</h1>

      <p>
        Status:{" "}
        <strong>
          {connected ? (running ? "Runner Running" : "Connected (Idle)") : "Disconnected"}
        </strong>
      </p>

      {err && (
        <p style={{ color: "crimson" }}>
          Error: {err}
        </p>
      )}

      <button onClick={() => post("/api/start")} disabled={!connected || running}>
        Start Runner
      </button>

      <button
        style={{ marginLeft: 12 }}
        onClick={() => post("/api/stop")}
        disabled={!connected || !running}
      >
        Stop Runner
      </button>

      <button style={{ marginLeft: 12 }} onClick={refreshStatus}>
        Refresh
      </button>

      <div style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 8 }}>Recent Logs</h3>
        <pre style={{ background: "#111", color: "#ddd", padding: 12, borderRadius: 8, maxHeight: 240, overflow: "auto" }}>
          {last.length ? last.join("\n") : "(no logs yet)"}
        </pre>
      </div>
    </div>
  );
}
