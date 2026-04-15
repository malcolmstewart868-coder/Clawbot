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
  intelligence?: {
    bias_state?: string;
    bias_strength?: number | string;
    market_state?: string;
    truth_state?: string;
    volatility_state?: string;
    observer_recommendation?: string;
    reentry_state?: string;
    structure_confirmed?: boolean;
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

export function ensureObservedSymbol(symbol: string): void {
  if (!symbol) return;

  if (!multiSymbolState.symbols[symbol]) {
    multiSymbolState.symbols[symbol] = {
      symbol,
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
        band: "UNAVAILABLE",
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
        symbol,
        side: "neutral",
        entry: 0,
        stop: 0,
        mark: 0,
      },
      lastAction: {
        type: "scan",
        reason: "watching",
      },
      intelligence: {
        bias_state: "neutral",
        bias_strength: "UNAVAILABLE",
        market_state: "watching",
        truth_state: "Watching",
        volatility_state: "UNAVAILABLE",
        observer_recommendation: "OBSERVE",
        reentry_state: "waiting",
        structure_confirmed: false,
      },
      intelligenceMode: "SHADOW",
      supervisor: fallbackSupervisor(),
    };
  }

  multiSymbolState = {
    ...multiSymbolState,
    observedSymbols: Array.from(new Set([...multiSymbolState.observedSymbols, symbol])),
    timestampUtc: new Date().toISOString(),
  };
}

export function hydrateActiveSymbolFromEngine(
  symbol: string,
  engineState: any
): void {
  if (!symbol) return;

  ensureObservedSymbol(symbol);

  const current = multiSymbolState.symbols[symbol] ?? { symbol };

  const engine = engineState?.engine ?? {};
  const calmstack = engineState?.calmstack ?? {};
  const guardrail = engineState?.guardrail ?? {};
  const position = engineState?.position ?? {};
  const lastAction = engineState?.lastAction ?? {};
  const supervisor = engineState?.supervisor ?? fallbackSupervisor();

  multiSymbolState = {
    ...multiSymbolState,
    activeSymbol: symbol,
    timestampUtc: new Date().toISOString(),
    observedSymbols: Array.from(new Set([...multiSymbolState.observedSymbols, symbol])),
    symbols: {
      ...multiSymbolState.symbols,
      [symbol]: {
        ...current,
        symbol,
        engine: {
          ...current.engine,
          ...engine,
        },
        calmstack: {
          ...current.calmstack,
          ...calmstack,
        },
        guardrail: {
          ...current.guardrail,
          ...guardrail,
        },
        position: {
          ...current.position,
          ...position,
          symbol,
        },
        lastAction: {
          ...current.lastAction,
          ...lastAction,
        },
        intelligence: {
          ...current.intelligence,
          bias_state:
            position?.side ??
            current.intelligence?.bias_state ??
            "UNAVAILABLE",
          bias_strength:
            current.intelligence?.bias_strength ?? "UNAVAILABLE",
          market_state:
            calmstack?.posture ??
            current.intelligence?.market_state ??
            "UNAVAILABLE",
          truth_state:
            supervisor?.supervisorNote ??
            current.intelligence?.truth_state ??
            "UNAVAILABLE",
          volatility_state:
            calmstack?.band ??
            current.intelligence?.volatility_state ??
            "UNAVAILABLE",
          observer_recommendation:
            calmstack?.mode ??
            current.intelligence?.observer_recommendation ??
            "UNAVAILABLE",
          reentry_state:
            engine?.trade ??
            current.intelligence?.reentry_state ??
            "UNAVAILABLE",
          structure_confirmed:
            position?.open ??
            current.intelligence?.structure_confirmed ??
            false,
        },
        intelligenceMode:
          engineState?.intelligenceMode ??
          current.intelligenceMode ??
          "SHADOW",
        supervisor: {
          ...current.supervisor,
          ...supervisor,
        },
      },
    },
  };
}

function fallbackSupervisor() {
  return {
    mode: "SHADOW",
    authorityGranted: false,
    observeOnly: true,
    advisoryOnly: false,
    supervisorNote: "Initialized",
    timestampUtc: new Date().toISOString(),
  };
}

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
      intelligence: {
        bias_state: "long",
        bias_strength: "UNAVAILABLE",
        market_state: "normal",
        truth_state: "Initialized",
        volatility_state: "high",
        observer_recommendation: "MANAGE",
        reentry_state: "managing",
        structure_confirmed: true,
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
        posture: "compression",
        mode: "OBSERVE",
        allowEntry: false,
        band: "medium",
        tradesTaken: 0,
        skipReasons: ["waiting_for_structure"],
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
      intelligence: {
        bias_state: "neutral",
        bias_strength: "UNAVAILABLE",
        market_state: "compression",
        truth_state: "Watching",
        volatility_state: "medium",
        observer_recommendation: "OBSERVE",
        reentry_state: "waiting",
        structure_confirmed: false,
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