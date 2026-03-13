export type ObserverState = {
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

let observerState: ObserverState = {
  ts: Date.now(),
  engine: {
    bot: "idle",
    trade: "idle",
    session: "OFFSESSION",
    running: false,
  },
  calmstack: {
    posture: "unknown",
    mode: "unknown",
    allowEntry: false,
    band: "unknown",
    tradesTaken: 0,
    skipReasons: [],
  },
  guardrail: {
    allowTrade: false,
    mode: "unknown",
    maxTrades: 0,
    remainingTrades: 0,
  },
  position: {
    open: false,
  },
};

export function getObserverState() {
  return observerState;
}

export function updateObserverState(
  patch: Partial<ObserverState>
) {
  observerState = {
    ...observerState,
    ...patch,
    ts: Date.now(),
    engine: {
      ...observerState.engine,
      ...(patch.engine ?? {}),
    },
    calmstack: {
      ...observerState.calmstack,
      ...(patch.calmstack ?? {}),
    },
    guardrail: {
      ...observerState.guardrail,
      ...(patch.guardrail ?? {}),
    },
    position: {
      ...observerState.position,
      ...(patch.position ?? {}),
    },
    lastAction: patch.lastAction ?? observerState.lastAction,
  };
}

export function setObserverRunning(running: boolean) {
  observerState = {
    ...observerState,
    ts: Date.now(),
    engine: {
      ...observerState.engine,
      running,
    },
  };
}