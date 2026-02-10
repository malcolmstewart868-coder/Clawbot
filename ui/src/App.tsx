import { useEffect, useRef, useState } from "react";

type StatusPayload = {
  ok: boolean;
  running?: boolean;
  last?: string[];
};

export default function App() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // log handling
  const logRef = useRef<HTMLPreElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // ---------- API calls ----------
  async function refresh() {
    try {
      setErr(null);
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as StatusPayload;
      setStatus(data);
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

  // ---------- lifecycle ----------
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, []);

  // ---------- auto-scroll logs ----------
  useEffect(() => {
    if (!autoScroll) return;
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [status?.last, autoScroll]);

  const running = !!status?.running;

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

      <h3 style={{ marginTop: 20 }}>Recent Logs</h3>

      <pre
        ref={logRef}
        onScroll={() => {
          const el = logRef.current;
          if (!el) return;

          const atBottom =
            Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 5;

          setAutoScroll(atBottom);
        }}
        style={{
          background: "#111",
          color: "#eee",
          padding: 12,
          borderRadius: 8,
          minHeight: 160,
          maxHeight: 320,
          overflow: "auto",
        }}
      >
        {(status?.last && status.last.length)
          ? status.last.join("\n")
          : "(no logs yet)"}
      </pre>
    </div>
  );
}
