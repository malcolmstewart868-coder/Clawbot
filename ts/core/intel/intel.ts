export type BotMode = "idle" | "running" | "paused" | "halted";

export type TradeLifecycle =
  | "idle"      // no position
  | "armed"     // setup allowed (future use)
  | "entered"   // position opened
  | "managing"  // stops/partials moving
  | "exiting"   // closing in progress
  | "closed";   // just closed (one-tick state)

export type VolBand = "low" | "normal" | "high" | "extreme";

export type VolState = {
  window: number;   // how many TR samples
  atr: number;      // avg true range (rolling)
  atrPct: number;   // atr / price
  band: VolBand;
};

export type IntelState = {
  bot: BotMode;
  trade: TradeLifecycle;
  positionOpen: boolean;
  vol: VolState;
};

export type IntelSnapshot = {
  ts: number;
  ticks: number;
  mode: string;
  exchange: string;
  state: IntelState;
  trade?: any;
};

export type Intel = {
  // increments internal tick counter and returns it
  tick: () => number;

  // snapshot is read-only output (always complete)
  snapshot: (trade?: any) => IntelSnapshot;

  // state writers (single write path)
  setBot: (bot: BotMode) => void;
  setTrade: (trade: TradeLifecycle, positionOpen?: boolean) => void;

  // volatility update (rolling ATR window)
  updateVol: (args: { tr: number; price: number; window?: number }) => VolState;

  // handy getter (optional)
  getState: () => IntelState;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function bandFromAtrPct(atrPct: number): VolBand {
  // simple bands you can tune later
  if (atrPct < 0.0010) return "low";      // < 0.10%
  if (atrPct < 0.0030) return "normal";   // < 0.30%
  if (atrPct < 0.0060) return "high";     // < 0.60%
  return "extreme";
}

export function createIntel(opts: { mode: string; exchange: string }): Intel {
  let ticks = 0;
  let lastTrade: any | undefined = undefined;

  // ✅ single source of truth record
  let state: IntelState = {
    bot: "idle",
    trade: "idle",
    positionOpen: false,
    vol: { window: 14, atr: 0, atrPct: 0, band: "normal" },
  };

  // rolling TR samples
  let trBuf: number[] = [];

  function tick() {
    ticks += 1;
    return ticks;
  }

  function setBot(bot: BotMode) {
    state = { ...state, bot };
  }

  function setTrade(trade: TradeLifecycle, positionOpen?: boolean) {
    const pos =
      typeof positionOpen === "boolean"
        ? positionOpen
        : trade === "entered" || trade === "managing" || trade === "exiting";
    state = { ...state, trade, positionOpen: pos };
  }

  function updateVol(args: { tr: number; price: number; window?: number }): VolState {
    const w = clamp(args.window ?? state.vol.window ?? 14, 5, 200);

    // keep buffer at window size
    trBuf.push(args.tr);
    if (trBuf.length > w) trBuf = trBuf.slice(trBuf.length - w);

    const atr = trBuf.reduce((a, b) => a + b, 0) / trBuf.length;
    const price = Math.max(1e-9, args.price);
    const atrPct = atr / price;

    const vol: VolState = {
      window: w,
      atr,
      atrPct,
      band: bandFromAtrPct(atrPct),
    };

    state = { ...state, vol };
    return vol;
  }

  function getState() {
    return state;
  }

  function snapshot(trade?: any): IntelSnapshot {
    if (trade !== undefined) lastTrade = trade;

    return {
      ts: Date.now(),
      ticks,
      mode: opts.mode,
      exchange: opts.exchange,
      state,
      trade: lastTrade,
    };
  }

  return { tick, snapshot, setBot, setTrade, updateVol, getState };
}
