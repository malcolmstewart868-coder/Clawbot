import { useEffect, useMemo, useState } from "react";

type StatusPayload = {
  ok: boolean;
  running?: boolean;
  last?: string[];
};

type EventPayload =
  | { hello: true; last?: string[] }
  | { line: string; ts?: number };

export default function App() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try {
      setErr(null);
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as StatusPayload;
      setStatus(data);

      // keep logs aligned with server snapshot (useful if SSE drops)
      if (data.last) setLogs(data.last);
    } catch (e: any) {
      setErr(e?.message || "failed to load status");
    }
  }

  async function start() {
    try {
      setLoading(true);
      setErr(null);
      const res = await fetch("/api/start", { method: "POST" });
      if (!res.ok) throw new Error(`start ${res.status}`);
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "failed to start");
    } finally {
      setLoading(false);
    }
  }

  async function stop() {
    try {
      setLoading(true);
      setErr(null);
      const res = await fetch("/api/stop", { method: "POST" });
      if (!res.ok) throw new Error(`stop ${res.status}`);
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "failed to stop");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();

    // LIVE LOGS via SSE
    const es = new EventSource("/api/events");

    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as EventPayload;

        // hello packet includes recent log snapshot
        if ("hello" in msg && msg.hello) {
          if (msg.last?.length) setLogs(msg.last);
          return;
        }

        // normal line packet
        if ("line" in msg) {
          setLogs((prev) => {
            const next = [...prev, msg.line];
            return next.length > 200 ? next.slice(-200) : next; // cap client log size
          });
        }
      } catch {
        // ignore bad event payloads
      }
    };

    es.onerror = () => {
      // SSE can retry automatically; we just show a soft warning
      setErr((prev) => prev ?? "Live logs disconnected (SSE). Try Refresh.");
    };

    return () => {
      es.close();
    };
  }, []);

  const running = !!status?.running;

  const logText = useMemo(() => {
    return logs.length ? logs.join("\n") : "(no logs yet)";
  }, [logs]);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900 }}>
      <h1>🐾 Clawbot Control Panel</h1>

      <p>
        API: <strong>{status?.ok ? "Connected" : "Checking..."}</strong>
        {"  |  "}
        Runner: <strong>{running ? "RUNNING" : "STOPPED"}</strong>
      </p>

      {err && (
        <p style={{ color: "crimson" }}>
          Error: <strong>{err}</strong>
        </p>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={start} disabled={loading || running}>
          Start Runner
        </button>
        <button onClick={stop} disabled={loading || !running}>
          Stop Runner
        </button>
        <button onClick={refresh} disabled={loading}>
          Refresh
        </button>
      </div>

      <h3 style={{ marginTop: 20 }}>Live Logs</h3>
      <pre
        style={{
          background: "#111",
          color: "#eee",
          padding: 12,
          borderRadius: 8,
          minHeight: 160,
          overflow: "auto",
        }}
      >
        {logText}
      </pre>
    </div>
  );
}
