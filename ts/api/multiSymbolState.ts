export type SymbolIntelState = {
  symbol: string;
  engine?: {
    bot?: string;
    trade?: string;
    session?: string;
    running?: boolean;
  };
  calmstack?: {
    posture?: string;
    mode?: string;
    allowEntry?: boolean;
    band?: string;
    tradesTaken?: number;
    skipReasons?: string[];
  };
  guardrail?: {
    allowTrade?: boolean;
    mode?: string;
    maxTrades?: number;
    remainingTrades?: number;
  };
  position?: {
    open?: boolean;
    symbol?: string;
    side?: string;
    entry?: number;
    stop?: number;
    mark?: number;
  };
  lastAction?: {
    type?: string;
    reason?: string;
  };
  intelligenceMode?: string;
  supervisor?: {
    mode?: string;
    authorityGranted?: boolean;
    observeOnly?: boolean;
    advisoryOnly?: boolean;
    supervisorNote?: string;
    timestampUtc?: string;
  };
};

export type MultiSymbolObserverState = {
  activeSymbol: string;
  observedSymbols: string[];
  symbols: Record<string, SymbolIntelState>;
  timestampUtc: string;
};

const fallbackSupervisor = () => ({
  mode: "SHADOW",
  authorityGranted: false,
  observeOnly: true,
  advisoryOnly: false,
  supervisorNote: "Initialized",
  timestampUtc: new Date().toISOString(),
});

let multiSymbolState: MultiSymbolObserverState = {
  activeSymbol: "EURUSDT",
  observedSymbols: ["EURUSDT", "BTCUSDT"],
  symbols: {
    EURUSDT: {
      symbol: "EURUSDT",
      engine: {
        bot: "running",
        trade: "managing",
        session: "default",
        running: true,
      },
      calmstack: {
        posture: "normal",
        mode: "MANAGE",
        allowEntry: true,
        band: "high",
        tradesTaken: 0,
        skipReasons: [],
      },
      guardrail: {
        allowTrade: true,
        mode: "READY",
        maxTrades: 2,
        remainingTrades: 2,
      },
      position: {
        open: true,
        symbol: "EURUSDT",
        side: "long",
        entry: 100,
        stop: 98,
        mark: 102.5,
      },
      lastAction: {
        type: "be",
        reason: "be",
      },
      intelligenceMode: "SHADOW",
      supervisor: fallbackSupervisor(),
    },
    BTCUSDT: {
      symbol: "BTCUSDT",
      engine: {
        bot: "running",
        trade: "watching",
        session: "default",
        running: true,
      },
      calmstack: {
        posture: "watching",
        mode: "OBSERVE",
        allowEntry: false,
        band: "medium",
        tradesTaken: 0,
        skipReasons: [],
      },
      guardrail: {
        allowTrade: false,
        mode: "OBSERVE",
        maxTrades: 2,
        remainingTrades: 2,
      },
      position: {
        open: false,
        symbol: "BTCUSDT",
        side: "neutral",
        entry: 0,
        stop: 0,
        mark: 0,
      },
      lastAction: {
        type: "scan",
        reason: "watching",
      },
      intelligenceMode: "SHADOW",
      supervisor: fallbackSupervisor(),
    },
  },
  timestampUtc: new Date().toISOString(),
};

export function getMultiSymbolObserverState(): MultiSymbolObserverState {
  return multiSymbolState;
}

export function setMultiSymbolObserverState(next: MultiSymbolObserverState): void {
  multiSymbolState = next;
}

export function updateSymbolState(symbol: string, patch: Partial<SymbolIntelState>): void {
  const current = multiSymbolState.symbols[symbol] ?? {
    symbol,
    supervisor: fallbackSupervisor(),
  };

  multiSymbolState = {
    ...multiSymbolState,
    timestampUtc: new Date().toISOString(),
    observedSymbols: Array.from(new Set([...multiSymbolState.observedSymbols, symbol])),
    symbols: {
      ...multiSymbolState.symbols,
      [symbol]: {
        ...current,
        ...patch,
        symbol,
      },
    },
  };
}

export function setActiveSymbol(symbol: string): void {
  multiSymbolState = {
    ...multiSymbolState,
    activeSymbol: symbol,
    timestampUtc: new Date().toISOString(),
    observedSymbols: Array.from(new Set([...multiSymbolState.observedSymbols, symbol])),
  };
}