export type CockpitStreamEvent = {
  timestamp_utc?: string;
  mode?: string;
  symbol?: string;
  market_state?: string;
  observer_recommendation?: string;
  finalAction?: string;
  [key: string]: unknown;
};

type StreamListener = (event: CockpitStreamEvent) => void;

const listeners = new Set<StreamListener>();

export function subscribeTelemetry(listener: StreamListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishTelemetry(event: CockpitStreamEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error("[telemetry] listener error", error);
    }
  }
}

export function normalizeTelemetryEvent(
  eventName: string,
  payload: Record<string, unknown> = {},
): CockpitStreamEvent {
  const timestampUtc =
    typeof payload.timestamp_utc === "string"
      ? payload.timestamp_utc
      : new Date().toISOString();

  const symbol =
    typeof payload.symbol === "string" && payload.symbol.trim().length > 0
      ? payload.symbol.toUpperCase()
      : "SYSTEM";

  const marketState =
    typeof payload.market_state === "string"
      ? payload.market_state
      : typeof payload.state === "string"
        ? payload.state
        : "UNAVAILABLE";

  const recommendation =
    typeof payload.observer_recommendation === "string"
      ? payload.observer_recommendation
      : typeof payload.recommendation === "string"
        ? payload.recommendation
        : eventName.toUpperCase();

  const finalAction =
    typeof payload.finalAction === "string"
      ? payload.finalAction
      : typeof payload.action === "string"
        ? payload.action
        : eventName;

  const mode =
    typeof payload.mode === "string" ? payload.mode : "SHADOW";

  return {
    timestamp_utc: timestampUtc,
    mode,
    symbol,
    market_state: marketState,
    observer_recommendation: recommendation,
    finalAction,
    ...payload,
  };
}