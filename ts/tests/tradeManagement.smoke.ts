import {
  evaluateTradeManagement,
  DEFAULT_TM_STATE,
  DEFAULT_TM_PARAMS,
  TradeLike
} from "../core/guardrails/tradeManagement";

function logCase(title: string, actions: any) {
  console.log("\n===", title, "===");
  console.log(JSON.stringify(actions, null, 2));
}

const trade: TradeLike = {
  id: "T1",
  symbol: "TEST",
  side: "long",
  entry: 100,
  initialStop: 90,   // R = 10
  currentStop: 90,
  size: 1
};

const tm0 = { ...DEFAULT_TM_STATE };

// Case 1: price at +1R -> should propose BE
const price1R = 110; // profitR = (110-100)/10 = 1.0
const r1 = evaluateTradeManagement(trade, tm0, price1R, DEFAULT_TM_PARAMS);
logCase("Case 1 (+1R) expected: tp1_partial + be", r1.actions);

// Case 2: price at +1.5R -> should propose BE+ (and maybe BE if not already applied)
const price15R = 115; // profitR = 1.5
const r2 = evaluateTradeManagement(trade, r1.nextState, price15R, DEFAULT_TM_PARAMS);
logCase("Case 2 (+1.5R) expected: be_plus", r2.actions);

// Case 3: runner trail using swing low (long)
const latestStop =
  r2.actions.slice().reverse().find(a => a.newStop !== undefined)?.newStop ?? null;

const swingLow = { price: 115 }; // Define the swing low value as a SwingPoint

const r3 = evaluateTradeManagement(
  { ...trade, currentStop: latestStop },
  r2.nextState,
  118,
  DEFAULT_TM_PARAMS,
  swingLow
);

logCase("Case 3 (runner trail) expected: runner_trail", r3.actions);
