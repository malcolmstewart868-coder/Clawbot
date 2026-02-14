import { useEffect, useMemo, useRef, useState } from "react";

type StatusPayload = {
  ok: boolean;
  running?: boolean;
  last?: string[];
  pid?: number | null;
  autoRestart?: boolean;
};

type SseState = "LIVE" | "RELINKING" | "OFF";

export default function App() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Live log lines (SSE)
  const [liveLines, setLiveLines] = useState<string[]>([]);
  const [sseState, setSseState] = useState<SseState>("OFF");

  // Auto-scroll behavior
  const [autoScroll, setAutoScroll] = useState(true);
  const logBoxRef = useRef<HTMLPreElement | null>(null);
  const userPausedRef = useRef(false); // true when user scrolls up
  const lastScrollTopRef = useRef(0);

  const running = !!status?.running;

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

  // Keep a small cap so it never grows forever
  const MAX_LIVE = 500;

  function appendLiveLine(line: string) {
    setLiveLines((prev) => {
      const next = [...prev, line];
      if (next.length > MAX_LIVE) next.splice(0, next.length - MAX_LIVE);
      return next;
    });
  }

  // Detect if user scrolled up → pause auto-scroll until they reach bottom again
  function handleLogScroll() {
    const el = logBoxRef.current;
    if (!el) return;

    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;

    // If user moves away from bottom, pause
    if (!atBottom) userPausedRef.current = true;
    // If user returns to bottom, unpause
    if (atBottom) userPausedRef.current = false;

    lastScrollTopRef.current = el.scrollTop;
  }

  // Auto-scroll when new lines arrive (only if enabled and not paused by user)
  useEffect(() => {
    const el = logBoxRef.current;
    if (!el) return;
    if (!autoScroll) return;
    if (userPausedRef.current) return;

    el.scrollTop = el.scrollHeight;
  }, [liveLines, autoScroll]);

  // Initial status load + gentle polling for status (runner state)
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SSE hookup with retry loop
  useEffect(() => {
    let es: EventSource | null = null;
    let alive = true;
    let retryMs = 800;

    const open = () => {
      if (!alive) return;

      setSseState((prev) => (prev === "LIVE" ? "LIVE" : "RELINKING"));

      try {
        es = new EventSource("/api/events");
      } catch (e) {
        // If browser blocks it for any reason, fall back to retry loop
        scheduleRetry();
        return;
      }

      es.onopen = () => {
        if (!alive) return;
        retryMs = 800;
        setSseState("LIVE");
      };

      es.onmessage = (ev) => {
        if (!alive) return;
        // Server sends: { hello: true } OR { line: "..." }
        try {
          const obj = JSON.parse(ev.data || "{}");
          if (obj?.line) appendLiveLine(String(obj.line));
        } catch {
          // ignore
        }
      };

      es.onerror = () => {
        if (!alive) return;
        setSseState("RELINKING");
        try {
          es?.close();
        } catch {
          // ignore
        }
        es = null;
        scheduleRetry();
      };
    };

    const scheduleRetry = () => {
      if (!alive) return;
      setTimeout(() => {
        if (!alive) return;
        // backoff up to 6s
        retryMs = Math.min(Math.floor(retryMs * 1.6), 6000);
        open();
      }, retryMs);
    };

    // start
    setSseState("RELINKING");
    open();

    return () => {
      alive = false;
      setSseState("OFF");
      try {
        es?.close();
      } catch {
        // ignore
      }
      es = null;
    };
  }, []);

  const header = useMemo(() => {
    const apiLabel = status?.ok ? "Linked" : "Checking...";
    const runLabel = running ? "RUNNING" : "STOPPED";
    return `${apiLabel} | Runner: ${runLabel}`;
  }, [status?.ok, running]);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 980 }}>
      <h1>🐾 Clawbot Control Panel</h1>

      <p>
        API: <strong>{status?.ok ? "Linked" : "Checking..."}</strong>
        {"  |  "}
        Runner: <strong>{running ? "RUNNING" : "STOPPED"}</strong>
        {"  |  "}
        Live logs:{" "}
        <strong>
          {sseState === "LIVE" ? "LIVE" : sseState === "RELINKING" ? "RELINKING…" : "OFF"}
        </strong>
      </p>

      {err && (
        <p style={{ color: "crimson" }}>
          Error: <strong>{err}</strong>
        </p>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={start} disabled={loading || running}>
          Start Runner
        </button>
        <button onClick={stop} disabled={loading || !running}>
          Stop Runner
        </button>
        <button onClick={refresh} disabled={loading}>
          Refresh status
        </button>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          Auto-scroll
        </label>

        <button
          onClick={() => {
            setLiveLines([]);
          }}
        >
          Clear logs
        </button>
      </div>

      <h3 style={{ marginTop: 18 }}>Live Logs</h3>
      <pre
        ref={logBoxRef}
        onScroll={handleLogScroll}
        style={{
          background: "#111",
          color: "#eee",
          padding: 12,
          borderRadius: 10,
          minHeight: 220,
          maxHeight: 360,
          overflow: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
        aria-label={header}
        title={header}
      >
        {liveLines.length ? liveLines.join("\n") : "(waiting for log lines…)"}
      </pre>

      <p style={{ opacity: 0.8, marginTop: 8 }}>
        Tip: Scroll up to pause auto-scroll. Scroll back to the bottom to resume.
      </p>
    </div>
  );
}
