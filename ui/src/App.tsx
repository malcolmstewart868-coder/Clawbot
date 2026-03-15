import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE = "http://localhost:3001";

type ObserverState = {
  ts: number;
  engine: {
    bot: string;
    trade: string;
    session: string;
    running: boolean;
  };
  calmstack: {
    posture: string;
    mode: string;
    allowEntry: boolean;
    band: string;
    tradesTaken: number;
    skipReasons: string[];
  };
  guardrail: {
    allowTrade: boolean;
    mode: string;
    maxTrades: number;
    remainingTrades: number;
  };
  position: {
    open: boolean;
    symbol?: string;
    side?: string;
    entry?: number;
    stop?: number | null;
    mark?: number | null;
  };
  lastAction?: {
    type: string;
    reason?: string;
  };
};

type StatusResponse = {
  ok: boolean;
  running: boolean;
  last: string[];
};

type ObserverResponse = {
  ok: boolean;
  state: ObserverState;
};

type LogEvent = {
  ts: number;
  line: string;
};

function formatTs(ts?: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function formatNumber(v?: number | null) {
  if (v == null || Number.isNaN(v)) return "—";
  return Number(v).toFixed(2);
}

function calcPnL(position: ObserverState["position"]) {
  if (!position.open) return null;
  if (position.entry == null || position.mark == null) return null;

  const entry = Number(position.entry);
  const mark = Number(position.mark);
  if (Number.isNaN(entry) || Number.isNaN(mark)) return null;

  if (position.side === "short") return entry - mark;
  return mark - entry;
}

function badgeClass(value: string) {
  const v = value.toLowerCase();

  if (
    v.includes("running") ||
    v.includes("live") ||
    v.includes("ready") ||
    v.includes("allowed") ||
    v.includes("normal")
  ) {
    return "badge badge-green";
  }

  if (
    v.includes("manage") ||
    v.includes("high") ||
    v.includes("prepare")
  ) {
    return "badge badge-blue";
  }

  if (
    v.includes("pause") ||
    v.includes("blocked") ||
    v.includes("defensive") ||
    v.includes("observe")
  ) {
    return "badge badge-amber";
  }

  return "badge";
}

export default function App() {
  const [observer, setObserver] = useState<ObserverState | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"start" | "stop" | "refresh" | "">("");

  const pnl = useMemo(
    () => (observer ? calcPnL(observer.position) : null),
    [observer]
  );

  async function loadObserver() {
    const res = await fetch(`${API_BASE}/api/observer`);
    if (!res.ok) throw new Error("observer fetch failed");
    const json: ObserverResponse = await res.json();
    setObserver(json.state);
  }

  async function loadStatus() {
    const res = await fetch(`${API_BASE}/api/status`);
    if (!res.ok) throw new Error("status fetch failed");
    const json: StatusResponse = await res.json();
    setStatus(json);
  }

  async function refreshAll() {
    setBusy("refresh");
    try {
      await Promise.all([loadObserver(), loadStatus()]);
      setError("");
    } catch {
      setError("Unable to reach Clawbot Observer API");
    } finally {
      setBusy("");
    }
  }

  async function postAction(path: "/api/start" | "/api/stop", mode: "start" | "stop") {
    setBusy(mode);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error(`${mode} failed`);

      await refreshAll();
    } catch {
      setError(`Unable to ${mode} Clawbot engine`);
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    refreshAll();

    const poller = setInterval(() => {
      Promise.all([loadObserver(), loadStatus()])
        .then(() => setError(""))
        .catch(() => setError("Unable to reach Clawbot Observer API"));
    }, 1500);

    return () => clearInterval(poller);
  }, []);

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/events`);

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);

        if (parsed.last && Array.isArray(parsed.last)) {
          const seeded: LogEvent[] = parsed.last.map((line: string, i: number) => ({
            ts: Date.now() + i,
            line,
          }));
          setLogs(seeded.slice(-40));
          return;
        }

        if (parsed.line) {
          setLogs((prev) => [...prev, { ts: parsed.ts ?? Date.now(), line: parsed.line }].slice(-80));
        }
      } catch {
        // ignore malformed SSE payloads
      }
    };

    es.onerror = () => {
      setError("Live event stream disconnected");
      es.close();
    };

    return () => {
      es.close();
    };
  }, []);

  return (
    <div className="cockpit">
      <div className="hero">
        <h1>Clawbot Engine Cockpit</h1>
        <p>Live observer feed from {API_BASE}/api/observer</p>

        <div className="toolbar">
          <button
            className="action-btn action-start"
            onClick={() => postAction("/api/start", "start")}
            disabled={busy !== ""}
          >
            {busy === "start" ? "Starting..." : "Start Engine"}
          </button>

          <button
            className="action-btn action-stop"
            onClick={() => postAction("/api/stop", "stop")}
            disabled={busy !== ""}
          >
            {busy === "stop" ? "Stopping..." : "Stop Engine"}
          </button>

          <button
            className="action-btn action-refresh"
            onClick={refreshAll}
            disabled={busy !== ""}
          >
            {busy === "refresh" ? "Refreshing..." : "Reconnect / Refresh"}
          </button>
        </div>

        <div className="status-strip">
          <span className={badgeClass(observer?.engine.running ? "running" : "stopped")}>
            {observer?.engine.running ? "ENGINE LIVE" : "ENGINE STOPPED"}
          </span>

          <span className={badgeClass(observer?.calmstack.mode ?? "unknown")}>
            {observer?.calmstack.mode ?? "unknown"}
          </span>

          <span className={badgeClass(observer?.guardrail.allowTrade ? "allowed" : "blocked")}>
            {observer?.guardrail.allowTrade ? "TRADE ALLOWED" : "TRADE BLOCKED"}
          </span>
        </div>

        {error && <div className="alert">{error}</div>}
      </div>

      {!observer ? (
        <div className="loading-card">Connecting to Clawbot...</div>
      ) : (
        <>
          <div className="top-grid">
            <MetricCard
              title="Bot Status"
              value={observer.engine.bot}
              subtitle={`Trade: ${observer.engine.trade}`}
              tone={observer.engine.running ? "green" : "amber"}
            />
            <MetricCard
              title="Posture"
              value={observer.calmstack.posture}
              subtitle={`Mode: ${observer.calmstack.mode}`}
              tone="blue"
            />
            <MetricCard
              title="Volatility Band"
              value={observer.calmstack.band}
              subtitle={`Allow Entry: ${observer.calmstack.allowEntry ? "YES" : "NO"}`}
              tone={observer.calmstack.allowEntry ? "amber" : "red"}
            />
            <MetricCard
              title="Guardrail"
              value={observer.guardrail.allowTrade ? "TRADE ALLOWED" : "BLOCKED"}
              subtitle={`Mode: ${observer.guardrail.mode}`}
              tone={observer.guardrail.allowTrade ? "green" : "red"}
            />
          </div>

          <div className="main-grid">
            <DataCard title="Position Summary">
              <DataRow label="Open" value={observer.position.open ? "YES" : "NO"} />
              <DataRow label="Symbol" value={observer.position.symbol ?? "—"} />
              <DataRow label="Side" value={observer.position.side ?? "—"} />
              <DataRow label="Entry" value={formatNumber(observer.position.entry)} />
              <DataRow label="Stop" value={formatNumber(observer.position.stop)} />
              <DataRow label="Mark" value={formatNumber(observer.position.mark)} />
              <DataRow
                label="Live P/L"
                value={pnl == null ? "—" : `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}`}
                valueClass={pnl == null ? "" : pnl >= 0 ? "value-green" : "value-red"}
              />
            </DataCard>

            <DataCard title="Session Guardrails">
              <DataRow label="Session" value={observer.engine.session} />
              <DataRow label="Max Trades" value={String(observer.guardrail.maxTrades)} />
              <DataRow
                label="Remaining"
                value={String(observer.guardrail.remainingTrades)}
              />
              <DataRow
                label="Used"
                value={String(
                  Math.max(
                    0,
                    observer.guardrail.maxTrades - observer.guardrail.remainingTrades
                  )
                )}
              />

              <div className="progress-wrap">
                <div className="progress-label">
                  <span>Trade Capacity Used</span>
                  <span>
                    {observer.guardrail.maxTrades > 0
                      ? `${Math.round(
                          ((observer.guardrail.maxTrades -
                            observer.guardrail.remainingTrades) /
                            observer.guardrail.maxTrades) *
                            100
                        )}%`
                      : "0%"}
                  </span>
                </div>

                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width:
                        observer.guardrail.maxTrades > 0
                          ? `${Math.max(
                              0,
                              Math.min(
                                100,
                                ((observer.guardrail.maxTrades -
                                  observer.guardrail.remainingTrades) /
                                  observer.guardrail.maxTrades) *
                                  100
                              )
                            )}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
            </DataCard>

            <DataCard title="Last Action">
              <DataRow label="Type" value={observer.lastAction?.type ?? "none"} />
              <DataRow label="Reason" value={observer.lastAction?.reason ?? "—"} />
            </DataCard>

            <DataCard title="Engine State">
              <DataRow label="Running" value={observer.engine.running ? "YES" : "NO"} />
              <DataRow label="Bot" value={observer.engine.bot} />
              <DataRow label="Trade" value={observer.engine.trade} />
              <DataRow label="Mode" value={observer.calmstack.mode} />
              <DataRow label="Posture" value={observer.calmstack.posture} />
              <DataRow label="Band" value={observer.calmstack.band} />
            </DataCard>

            <DataCard title="Skip Reasons">
              {observer.calmstack.skipReasons.length === 0 ? (
                <div className="empty-note">No active skip reasons.</div>
              ) : (
                <ul className="skip-list">
                  {observer.calmstack.skipReasons.map((reason, idx) => (
                    <li key={`${reason}-${idx}`}>{reason}</li>
                  ))}
                </ul>
              )}
            </DataCard>

            <DataCard title="Raw Snapshot">
              <pre className="raw-block">{JSON.stringify(observer, null, 2)}</pre>
            </DataCard>
          </div>

          <div className="log-card">
            <div className="log-header">
              <h2>Event Stream</h2>
              <span className="muted">
                Last update: {formatTs(observer.ts)}
              </span>
            </div>

            <div className="log-body">
              {logs.length === 0 ? (
                <div className="empty-note">Waiting for engine events...</div>
              ) : (
                logs
                  .slice()
                  .reverse()
                  .map((log) => (
                    <div key={`${log.ts}-${log.line}`} className="log-line">
                      <span className="log-ts">{formatTs(log.ts)}</span>
                      <span className="log-text">{log.line}</span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string;
  subtitle: string;
  tone: "green" | "blue" | "amber" | "red";
}) {
  return (
    <div className="metric-card">
      <div className="metric-title">{title}</div>
      <div className={`metric-value metric-${tone}`}>{value}</div>
      <div className="metric-subtitle">{subtitle}</div>
    </div>
  );
}

function DataCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="data-card">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function DataRow({
  label,
  value,
  valueClass = "",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="data-row">
      <span className="data-label">{label}</span>
      <span className={`data-value ${valueClass}`.trim()}>{value}</span>
    </div>
  );
}
