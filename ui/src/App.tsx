import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

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

export default function App() {
  const [data, setData] = useState<ObserverState | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await fetch("http://localhost:3001/api/observer");
      const json = await res.json();
      setData(json.state);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Unable to reach Clawbot Observer API on http://localhost:3001");
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 1000);
    return () => clearInterval(timer);
  }, []);

  const pnl = useMemo(() => {
    if (!data?.position.open) return null;
    const { entry, mark, side } = data.position;
    if (entry == null || mark == null || !side) return null;

    if (side === "long") return mark - entry;
    if (side === "short") return entry - mark;
    return null;
  }, [data]);

  const tradesUsed = useMemo(() => {
    if (!data) return 0;
    return Math.max(0, data.guardrail.maxTrades - data.guardrail.remainingTrades);
  }, [data]);

  const progressPct = useMemo(() => {
    if (!data || data.guardrail.maxTrades <= 0) return 0;
    return (tradesUsed / data.guardrail.maxTrades) * 100;
  }, [data, tradesUsed]);

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>Clawbot Engine Cockpit</h1>
            <p style={styles.subtitle}>
              Live observer feed from http://localhost:3001/api/observer
            </p>
          </div>

          <div style={styles.headerRight}>
            <StatusPill
              label={data?.engine.running ? "ENGINE LIVE" : "ENGINE OFFLINE"}
              tone={data?.engine.running ? "green" : "red"}
            />
            <StatusPill
              label={data?.calmstack.mode ?? "UNKNOWN"}
              tone="blue"
            />
          </div>
        </header>

        {error && <div style={styles.errorBox}>{error}</div>}

        {!data ? (
          <div style={styles.connecting}>Connecting to Clawbot…</div>
        ) : (
          <>
            <section style={styles.heroGrid}>
              <MetricCard
                title="Bot Status"
                value={data.engine.bot}
                tone={data.engine.running ? "green" : "red"}
                subValue={`Trade: ${data.engine.trade}`}
              />
              <MetricCard
                title="Posture"
                value={data.calmstack.posture}
                tone={toneFromPosture(data.calmstack.posture)}
                subValue={`Mode: ${data.calmstack.mode}`}
              />
              <MetricCard
                title="Volatility Band"
                value={data.calmstack.band}
                tone={toneFromBand(data.calmstack.band)}
                subValue={`Allow Entry: ${yesNo(data.calmstack.allowEntry)}`}
              />
              <MetricCard
                title="Guardrail"
                value={data.guardrail.allowTrade ? "TRADE ALLOWED" : "BLOCKED"}
                tone={data.guardrail.allowTrade ? "green" : "red"}
                subValue={`Mode: ${data.guardrail.mode}`}
              />
            </section>

            <section style={styles.mainGrid}>
              <Card title="Position Summary">
                <InfoRow label="Open" value={yesNo(data.position.open)} />
                <InfoRow label="Symbol" value={data.position.symbol ?? "—"} />
                <InfoRow label="Side" value={data.position.side ?? "—"} />
                <InfoRow label="Entry" value={fmtNum(data.position.entry)} />
                <InfoRow label="Stop" value={fmtNum(data.position.stop)} />
                <InfoRow label="Mark" value={fmtNum(data.position.mark)} />
                <InfoRow
                  label="Live P/L"
                  value={pnl == null ? "—" : fmtSigned(pnl)}
                  valueTone={pnl == null ? "neutral" : pnl >= 0 ? "green" : "red"}
                />
              </Card>

              <Card title="Session Guardrails">
                <InfoRow label="Session" value={data.engine.session} />
                <InfoRow label="Max Trades" value={String(data.guardrail.maxTrades)} />
                <InfoRow label="Remaining" value={String(data.guardrail.remainingTrades)} />
                <InfoRow label="Used" value={String(tradesUsed)} />
                <div style={{ marginTop: 18 }}>
                  <div style={styles.progressLabelRow}>
                    <span style={styles.progressLabel}>Trade Capacity Used</span>
                    <span style={styles.progressLabel}>{progressPct.toFixed(0)}%</span>
                  </div>
                  <div style={styles.progressTrack}>
                    <div style={{ ...styles.progressFill, width: `${progressPct}%` }} />
                  </div>
                </div>
              </Card>

              <Card title="Last Action">
                <InfoRow label="Type" value={data.lastAction?.type ?? "none"} />
                <InfoRow label="Reason" value={data.lastAction?.reason ?? "—"} />
              </Card>

              <Card title="Engine State">
                <InfoRow label="Running" value={yesNo(data.engine.running)} />
                <InfoRow label="Bot" value={data.engine.bot} />
                <InfoRow label="Trade" value={data.engine.trade} />
                <InfoRow label="Mode" value={data.calmstack.mode} />
                <InfoRow label="Posture" value={data.calmstack.posture} />
                <InfoRow label="Band" value={data.calmstack.band} />
              </Card>

              <Card title="Skip Reasons">
                {data.calmstack.skipReasons.length === 0 ? (
                  <div style={styles.emptyText}>No active skip reasons.</div>
                ) : (
                  <ul style={styles.reasonList}>
                    {data.calmstack.skipReasons.map((reason) => (
                      <li key={reason} style={styles.reasonItem}>
                        {reason}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Raw Snapshot">
                <pre style={styles.pre}>{JSON.stringify(data, null, 2)}</pre>
              </Card>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={styles.card}>
      <h2 style={styles.cardTitle}>{title}</h2>
      {children}
    </section>
  );
}

function MetricCard({
  title,
  value,
  subValue,
  tone,
}: {
  title: string;
  value: string;
  subValue?: string;
  tone: Tone;
}) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricTitle}>{title}</div>
      <div style={{ ...styles.metricValue, color: toneColor(tone) }}>{value}</div>
      {subValue ? <div style={styles.metricSub}>{subValue}</div> : null}
    </div>
  );
}

function InfoRow({
  label,
  value,
  valueTone = "neutral",
}: {
  label: string;
  value: string;
  valueTone?: Tone | "neutral";
}) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span
        style={{
          ...styles.infoValue,
          color: valueTone === "neutral" ? "#e5e7eb" : toneColor(valueTone),
        }}
      >
        {value}
      </span>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: Tone;
}) {
  return (
    <div
      style={{
        ...styles.pill,
        borderColor: toneColor(tone),
        color: toneColor(tone),
      }}
    >
      {label}
    </div>
  );
}

type Tone = "green" | "red" | "yellow" | "blue";

function toneColor(tone: Tone) {
  switch (tone) {
    case "green":
      return "#22c55e";
    case "red":
      return "#ef4444";
    case "yellow":
      return "#f59e0b";
    case "blue":
      return "#38bdf8";
  }
}

function toneFromPosture(posture: string): Tone {
  const p = posture.toLowerCase();
  if (p === "aggressive") return "green";
  if (p === "defensive") return "yellow";
  return "blue";
}

function toneFromBand(band: string): Tone {
  const b = band.toLowerCase();
  if (b === "extreme") return "red";
  if (b === "high") return "yellow";
  if (b === "normal") return "blue";
  return "green";
}

function yesNo(v: boolean) {
  return v ? "YES" : "NO";
}

function fmtNum(v: number | null | undefined) {
  if (v == null) return "—";
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function fmtSigned(v: number) {
  return v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2);
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, #0f1b3d 0%, #071226 45%, #030712 100%)",
    color: "#e5e7eb",
    fontFamily: "Arial, sans-serif",
    padding: 24,
  },
  shell: {
    maxWidth: 1400,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 24,
    flexWrap: "wrap",
  },
  headerRight: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: 56,
    lineHeight: 1.05,
    fontWeight: 800,
    letterSpacing: -1.5,
  },
  subtitle: {
    marginTop: 12,
    marginBottom: 0,
    color: "#94a3b8",
    fontSize: 18,
  },
  pill: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid",
    fontWeight: 700,
    fontSize: 13,
    background: "rgba(15, 23, 42, 0.65)",
  },
  errorBox: {
    padding: 14,
    borderRadius: 12,
    background: "#7f1d1d",
    color: "#fee2e2",
    marginBottom: 20,
    fontWeight: 700,
  },
  connecting: {
    padding: 24,
    borderRadius: 16,
    background: "#111827",
    border: "1px solid #1f2937",
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
    marginBottom: 20,
  },
  metricCard: {
    background: "rgba(15, 23, 42, 0.88)",
    border: "1px solid #1e293b",
    borderRadius: 18,
    padding: 20,
    boxShadow: "0 12px 30px rgba(0,0,0,0.22)",
  },
  metricTitle: {
    fontSize: 14,
    color: "#94a3b8",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: 700,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: 800,
    lineHeight: 1.1,
    marginBottom: 8,
  },
  metricSub: {
    color: "#cbd5e1",
    fontSize: 14,
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 16,
  },
  card: {
    background: "rgba(15, 23, 42, 0.88)",
    border: "1px solid #1e293b",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 12px 30px rgba(0,0,0,0.22)",
  },
  cardTitle: {
    marginTop: 0,
    marginBottom: 18,
    fontSize: 20,
    fontWeight: 800,
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid rgba(148,163,184,0.12)",
  },
  infoLabel: {
    color: "#94a3b8",
    fontSize: 14,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: 700,
    textAlign: "right",
  },
  progressLabelRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 8,
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 700,
  },
  progressLabel: {
    color: "#94a3b8",
  },
  progressTrack: {
    width: "100%",
    height: 12,
    borderRadius: 999,
    background: "#0f172a",
    overflow: "hidden",
    border: "1px solid #1e293b",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #38bdf8 0%, #22c55e 100%)",
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 14,
  },
  reasonList: {
    margin: 0,
    paddingLeft: 18,
    color: "#e5e7eb",
  },
  reasonItem: {
    marginBottom: 8,
  },
  pre: {
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "#cbd5e1",
    fontSize: 12,
    lineHeight: 1.5,
  },
};
