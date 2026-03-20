type Props = {
  observer: {
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
    lastAction?: {
      type: string;
      reason?: string;
    };
  } | null;
};

function toneClass(value: string) {
  const v = value.toLowerCase();

  if (
    v.includes("allow") ||
    v.includes("ready") ||
    v.includes("normal") ||
    v.includes("running") ||
    v.includes("manage")
  ) {
    return "badge badge-green";
  }

  if (
    v.includes("high") ||
    v.includes("prepare") ||
    v.includes("watch")
  ) {
    return "badge badge-blue";
  }

  if (
    v.includes("block") ||
    v.includes("pause") ||
    v.includes("observe") ||
    v.includes("defensive")
  ) {
    return "badge badge-amber";
  }

  return "badge";
}

export default function AuthorityPanel({ observer }: Props) {
  if (!observer) return null;

  const authorityState = observer.guardrail.allowTrade ? "SCOUT" : "SHADOW";
  const intelligenceMode = observer.calmstack.allowEntry ? "ADVISORY" : "SHADOW";
  const recommendedAction =
    observer.lastAction?.type ??
    (observer.guardrail.allowTrade ? "ALLOW_ENTRY" : "OBSERVE");
  const supervisorState = observer.guardrail.mode || "unknown";

  const stableCycles = Math.max(
    0,
    observer.guardrail.maxTrades - observer.guardrail.remainingTrades
  );

  const unstableCycles = Math.max(
    0,
    observer.guardrail.remainingTrades
  );

  return (
    <div className="data-card">
      <h2>Authority Engine</h2>

      <div className="data-row">
        <span className="data-label">Intelligence Mode</span>
        <span className={toneClass(intelligenceMode)}>{intelligenceMode}</span>
      </div>

      <div className="data-row">
        <span className="data-label">Authority State</span>
        <span className={toneClass(authorityState)}>{authorityState}</span>
      </div>

      <div className="data-row">
        <span className="data-label">Stable Cycles</span>
        <span className="data-value">{stableCycles}</span>
      </div>

      <div className="data-row">
        <span className="data-label">Unstable Cycles</span>
        <span className="data-value">{unstableCycles}</span>
      </div>

      <div className="data-row">
        <span className="data-label">Volatility State</span>
        <span className={toneClass(observer.calmstack.band)}>
          {observer.calmstack.band}
        </span>
      </div>

      <div className="data-row">
        <span className="data-label">Supervisor Mode</span>
        <span className={toneClass(supervisorState)}>{supervisorState}</span>
      </div>

      <div className="data-row">
        <span className="data-label">Authority Granted</span>
        <span className="data-value">
          {observer.guardrail.allowTrade ? "true" : "false"}
        </span>
      </div>

      <div className="data-row">
        <span className="data-label">Recommended Action</span>
        <span className="data-value">{recommendedAction}</span>
      </div>
    </div>
  );
}