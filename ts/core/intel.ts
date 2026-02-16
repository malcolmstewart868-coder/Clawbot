// ts/core/intel.ts

export type IntelState = "idle" | "active";

export type IntelSnapshot = {
  ts: number;
  state: IntelState;
  ticks: number;
  mode: string;
  exchange: string;
  trade?: any;
};

export type Intel = {
  bump: () => number;
  tick: () => number;
  snapshot: (trade?: any) => IntelSnapshot;
  setState: (state: IntelState) => void;
};

export function createIntel(opts: { mode: string; exchange: string }): Intel {
  let ticks = 0;
  let state: IntelState = "idle";
  let lastTrade: any | undefined = undefined;

  function bump() {
    ticks += 1;
    return ticks;
  }

  function tick() {
    return ticks;
  }

  function setState(s: IntelState) {
    state = s;
  }

  function snapshot(trade?: any): IntelSnapshot {
    if (trade !== undefined) {
      lastTrade = trade;
      state = "active";
    }
    return {
      ts: Date.now(),
      state,
      ticks,
      mode: opts.mode,
      exchange: opts.exchange,
      trade: lastTrade,
    };
  }

  return { bump, tick, snapshot, setState };
}
