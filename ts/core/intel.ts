export type TradeLifecycle =
  | "idle"          // no position
  | "armed"         // setup allowed (future use)
  | "entered"       // position opened
  | "managing"      // in-position, stops/partials moving
  | "exiting"       // closing in progress
  | "closed"        // just closed (one-tick state)
  | "paused";       // bot paused (future use)

export type IntelSnapshot = {
  ts: number;
  state: IntelState;
  ticks: number;
  mode: string;
  exchange: string;

  lifecycle: TradeLifecycle;
  positionOpen: boolean;

  // volatility
  vol: {
    window: number;
    atr: number;        // avg true range (approx)
    atrPct: number;     // atr / price
  };

  trade?: any;
}

