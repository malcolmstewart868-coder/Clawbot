import fs from "node:fs";
import path from "node:path";

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

const STORAGE_DIR = path.resolve(process.cwd(), "storage");
const STATE_FILE = path.join(STORAGE_DIR, "observer-state.json");

const defaultState: ObserverState = {
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

function ensureStorage() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  if (!fs.existsSync(STATE_FILE)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(defaultState, null, 2), "utf8");
  }
}

function readState(): ObserverState {
  ensureStorage();

  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    return JSON.parse(raw) as ObserverState;
  } catch {
    return defaultState;
  }
}

function writeState(state: ObserverState) {
  ensureStorage();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

export function getObserverState(): ObserverState {
  return readState();
}

export function updateObserverState(patch: Partial<ObserverState>) {
  const current = readState();

  const next: ObserverState = {
    ...current,
    ...patch,
    ts: Date.now(),
    engine: {
      ...current.engine,
      ...(patch.engine ?? {}),
    },
    calmstack: {
      ...current.calmstack,
      ...(patch.calmstack ?? {}),
    },
    guardrail: {
      ...current.guardrail,
      ...(patch.guardrail ?? {}),
    },
    position: {
      ...current.position,
      ...(patch.position ?? {}),
    },
    lastAction: patch.lastAction ?? current.lastAction,
  };

  writeState(next);
}

export function setObserverRunning(running: boolean) {
  const current = readState();

  writeState({
    ...current,
    ts: Date.now(),
    engine: {
      ...current.engine,
      running,
    },
  });
}

export function resetObserverState() {
  writeState({
    ...defaultState,
    ts: Date.now(),
  });
}
