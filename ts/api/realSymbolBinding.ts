import { updateSymbolState, ensureObservedSymbol } from "./multiSymbolState";

type MarketSnapshot = {
  symbol: string;
  price: number;
  high: number;
  low: number;
  changePct: number;
  volume: number;
};

type EvaluatedSymbolState = {
  symbol: string;
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
    symbol: string;
    side: string;
    entry: number;
    stop: number;
    mark: number;
  };
  lastAction: {
    type: string;
    reason: string;
  };
  intelligence: {
    bias_state: string;
    bias_strength: string;
    market_state: string;
    truth_state: string;
    volatility_state: string;
    observer_recommendation: string;
    reentry_state: string;
    structure_confirmed: boolean;
  };
  intelligenceMode: string;
  supervisor: {
    mode: string;
    authorityGranted: boolean;
    observeOnly: boolean;
    advisoryOnly: boolean;
    supervisorNote: string;
    timestampUtc: string;
  };
};

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Replace this with your real market adapter when ready.
 * For now this function is the single insertion point for real symbol data.
 */
export async function getLiveMarketSnapshot(symbol: string): Promise<MarketSnapshot> {
  const upper = symbol.toUpperCase();

  if (upper === "EURUSDT") {
    return {
      symbol: upper,
      price: 1.1801,
      high: 1.1804,
      low: 1.1798,
      changePct: -0.01,
      volume: 234.09,
    };
  }

  if (upper === "BTCUSDT") {
    return {
      symbol: upper,
      price: 74762.62,
      high: 74874.93,
      low: 74451.49,
      changePct: -0.09,
      volume: 618,
    };
  }

  return {
    symbol: upper,
    price: 0,
    high: 0,
    low: 0,
    changePct: 0,
    volume: 0,
  };
}

/**
 * This is the real binding seam.
 * Later, replace the internal logic with your actual observer engine's
 * symbol-specific evaluation pipeline.
 */
export async function evaluateLiveSymbol(symbol: string): Promise<EvaluatedSymbolState> {
  const snap = await getLiveMarketSnapshot(symbol);
  const upper = snap.symbol;

  if (upper === "EURUSDT") {
    return {
      symbol: upper,
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
        symbol: upper,
        side: "long",
        entry: 1.1785,
        stop: 1.1768,
        mark: snap.price,
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
      supervisor: {
        mode: "SHADOW",
        authorityGranted: false,
        observeOnly: true,
        advisoryOnly: false,
        supervisorNote: "Initialized",
        timestampUtc: nowIso(),
      },
    };
  }

  if (upper === "BTCUSDT") {
    return {
      symbol: upper,
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
        symbol: upper,
        side: "neutral",
        entry: 0,
        stop: 0,
        mark: snap.price,
      },
      lastAction: {
        type: "scan",
        reason: "watching",
      },
      intelligence: {
        bias_state: "neutral",
        bias_strength: "UNAVAILABLE",
        market_state: "compression",
        truth_state: "Initialized",
        volatility_state: "medium",
        observer_recommendation: "OBSERVE",
        reentry_state: "managing",
        structure_confirmed: true,
      },
      intelligenceMode: "SHADOW",
      supervisor: {
        mode: "SHADOW",
        authorityGranted: false,
        observeOnly: true,
        advisoryOnly: false,
        supervisorNote: "Initialized",
        timestampUtc: nowIso(),
      },
    };
  }

  return {
    symbol: upper,
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
      symbol: upper,
      side: "neutral",
      entry: 0,
      stop: 0,
      mark: snap.price,
    },
    lastAction: {
      type: "scan",
      reason: "watching",
    },
    intelligence: {
      bias_state: "neutral",
      bias_strength: "UNAVAILABLE",
      market_state: "watching",
      truth_state: "Initialized",
      volatility_state: "UNAVAILABLE",
      observer_recommendation: "OBSERVE",
      reentry_state: "waiting",
      structure_confirmed: false,
    },
    intelligenceMode: "SHADOW",
    supervisor: {
      mode: "SHADOW",
      authorityGranted: false,
      observeOnly: true,
      advisoryOnly: false,
      supervisorNote: "Initialized",
      timestampUtc: nowIso(),
    },
  };
}

export async function bindLiveSymbolState(symbol: string): Promise<void> {
  ensureObservedSymbol(symbol);

  const evaluated = await evaluateLiveSymbol(symbol);

  updateSymbolState(symbol, {
    symbol: evaluated.symbol,
    engine: evaluated.engine,
    calmstack: evaluated.calmstack,
    guardrail: evaluated.guardrail,
    position: evaluated.position,
    lastAction: evaluated.lastAction,
    intelligence: evaluated.intelligence,
    intelligenceMode: evaluated.intelligenceMode,
    supervisor: evaluated.supervisor,
  });
}