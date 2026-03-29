/**
 * CLAWBOT BINANCE LIVE OBSERVER
 * MODE: LIVE_OBSERVE_INSUFFICIENT_FUNDS
 *
 * Purpose:
 * - Connect to Binance public market data only
 * - Reuse existing intelligence pipeline where possible
 * - Generate full decision intent
 * - Permanently block execution due to insufficient funds
 * - Write structured logs for validation
 *
 * Safety law:
 * - No exchange order call is allowed from this runner
 * - execute must always resolve to false
 * - block_reason must always resolve to INSUFFICIENT_FUNDS
 */

import fs from "fs";
import path from "path";

import { evaluateIntelligence } from "../../src/intelligence/intelligenceEvaluator";
import { adaptIntelligenceToDownstream } from "../../src/intelligence/intelligenceAdapter";
import { superviseIntelligence } from "../../src/intelligence/intelligenceSupervisor";
import { applyAuthorityGate } from "../../src/intelligence/intelligenceAuthorityGate";

import { detectVolatility } from "../../src/intelligence/volatilityDetector";
import {
  stabilizeReentry,
  type ReentryStabilizerState,
} from "../../src/intelligence/reentryStabilizer";

import { setIntelligenceMode } from "../../src/intelligence/intelligenceMode";
import {
  controlVolatilityAuthority,
  mapAuthorityStateToIntelligenceMode,
  type VolatilityAuthorityState,
} from "../../src/intelligence/volatilityAuthorityController";

import { emitIntelligenceTelemetry } from "../shared/telemetry/intelligenceTelemetry";
import {
  evaluateBinanceBias,
  type BinanceBiasMemory,
} from "../../src/binance/binanceBiasEngine";

// -------------------------
// CONFIG
// -------------------------
const MODE = "LIVE_OBSERVE_INSUFFICIENT_FUNDS" as const;
const FEED = "BINANCE_LIVE" as const;
const LOG_PATH = path.resolve("logs/binance_observer.log");
const CYCLE_INTERVAL_MS = 10_000;

const SYMBOLS = ["BTCUSDT", "ETHUSDT"] as const;
const EXECUTION_LOCK = true;
const CAPITAL_AVAILABLE = 0.0;
const BLOCK_REASON = "INSUFFICIENT_FUNDS" as const;

const BINANCE_REST_BASE = "https://api.binance.com";

// -------------------------
// TYPES
// -------------------------
type SymbolCode = (typeof SYMBOLS)[number];

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  trades: number;
};

type TimeframeSnapshot = {
  symbol: SymbolCode;
  h1: Candle[];
  m15: Candle[];
  m5: Candle[];
  lastPrice: number;
};

type SimpleBias = "BULLISH" | "BEARISH" | "NEUTRAL";
type SimpleTrigger = "BUY" | "SELL" | "OBSERVE";

type EngineReadout = {
  h1Bias: SimpleBias;
  m15Arm: boolean;
  m5Trigger: boolean;
  candidateAction: SimpleTrigger;
  reason: string;
};

type RuntimeLogEntry = {
  timestamp_utc: string;
  symbol: SymbolCode;
  mode: typeof MODE;
  feed: typeof FEED;

  h1_bias: SimpleBias | string;
  m15_arm: boolean;
  m5_trigger: boolean;

  volatility_state: string;
  reentry_state: string;
  guardrail_status: string;

  recommended_action: string;
  final_action: string;

  position_size_requested: number;
  capital_required: number;
  capital_available: number;

  execution_allowed: boolean;
  execute: boolean;
  block_reason: string;
  exchange_order_sent: boolean;

  supervisor_authority_granted?: boolean;
  supervisor_observe_only?: boolean;
  supervisor_advisory_only?: boolean;
  supervisor_note?: string;

  gate_authority_granted?: boolean;
  gate_reason?: string;

  intelligence_mode?: string;
  authority_state?: string;

  bias_strength?: number;
  bias_reason?: string;
  bias_fast_sma?: number | null;
  bias_slow_sma?: number | null;
  bias_slope_pct?: number;
  bias_distance_pct?: number;

  log_type?: string;
  volatility_score?: number;

  error?: string;
  message?: string;
};

// -------------------------
// STATE
// -------------------------
let cycleRunning = false;

const reentryStateBySymbol: Record<SymbolCode, ReentryStabilizerState> = {
  BTCUSDT: {
    stableCount: 0,
    unstableCount: 0,
    currentMode: "SHADOW",
  },
  ETHUSDT: {
    stableCount: 0,
    unstableCount: 0,
    currentMode: "SHADOW",
  },
};

const biasMemoryBySymbol: Record<SymbolCode, BinanceBiasMemory> = {
  BTCUSDT: {
    currentBias: "NEUTRAL",
    lastStrength: 0,
    holdCount: 0,
  },
  ETHUSDT: {
    currentBias: "NEUTRAL",
    lastStrength: 0,
    holdCount: 0,
  },
};

const authorityStateBySymbol: Record<SymbolCode, VolatilityAuthorityState> = {
  BTCUSDT: {
    authorityState: "SHADOW",
    stableCycles: 0,
    unstableCycles: 0,
  },
  ETHUSDT: {
    authorityState: "SHADOW",
    stableCycles: 0,
    unstableCycles: 0,
  },
};

// -------------------------
// INIT
// -------------------------
if (!fs.existsSync("logs")) {
  fs.mkdirSync("logs");
}

setIntelligenceMode("SHADOW");

// -------------------------
// LOGGER
// -------------------------
function log(entry: RuntimeLogEntry | Record<string, unknown>): void {
  const line = JSON.stringify(entry) + "\n";
  fs.appendFileSync(LOG_PATH, line);
  console.log(line.trim());
}

// -------------------------
// STARTUP LOGS
// -------------------------
log({
  timestamp_utc: new Date().toISOString(),
  system: "CLAWBOT",
  branch: "clawbot/binance-observer-v1",
  origin: "CLAWBOT_FX_CORE_PRESERVED_V1",
  message: "BINANCE OBSERVER BRANCH INITIALIZED — FX CORE ISOLATED",
});

log({
  timestamp_utc: new Date().toISOString(),
  system: "CLAWBOT",
  mode: MODE,
  feed: FEED,
  symbols: [...SYMBOLS],
  execution_lock: EXECUTION_LOCK,
  capital_available: CAPITAL_AVAILABLE,
  block_reason: BLOCK_REASON,
  message:
    "CLAWBOT LIVE BINANCE OBSERVER ACTIVE — EXECUTION LOCKED (INSUFFICIENT_FUNDS MODE)",
});

// -------------------------
// HELPERS
// -------------------------
function parseKline(row: BinanceKline): Candle {
  return {
    openTime: row[0],
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    closeTime: row[6],
    trades: row[8],
  };
}

async function fetchKlines(
  symbol: SymbolCode,
  interval: "1h" | "15m" | "5m",
  limit: number,
): Promise<Candle[]> {
  const url = `${BINANCE_REST_BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Binance klines fetch failed: ${symbol} ${interval} ${response.status}`);
  }

  const data = (await response.json()) as BinanceKline[];
  return data.map(parseKline);
}

async function getBinanceSnapshot(symbol: SymbolCode): Promise<TimeframeSnapshot> {
  const [h1, m15, m5] = await Promise.all([
    fetchKlines(symbol, "1h", 120),
    fetchKlines(symbol, "15m", 120),
    fetchKlines(symbol, "5m", 120),
  ]);

  const lastPrice = m5[m5.length - 1]?.close ?? 0;

  return {
    symbol,
    h1,
    m15,
    m5,
    lastPrice,
  };
}

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  const total = slice.reduce((sum, value) => sum + value, 0);
  return total / period;
}

function getSimpleReadout(
  snapshot: TimeframeSnapshot,
  h1Bias: SimpleBias,
): EngineReadout {
  const m15Closes = snapshot.m15.map((c) => c.close);
  const m5Closes = snapshot.m5.map((c) => c.close);

  const m15Fast = sma(m15Closes, 9);
  const m15Slow = sma(m15Closes, 21);
  const m5Fast = sma(m5Closes, 5);
  const m5Slow = sma(m5Closes, 13);

  const m15Arm =
    m15Fast !== null &&
    m15Slow !== null &&
    ((h1Bias === "BULLISH" && m15Fast > m15Slow) ||
      (h1Bias === "BEARISH" && m15Fast < m15Slow));

  const m5Trigger =
    m5Fast !== null &&
    m5Slow !== null &&
    ((h1Bias === "BULLISH" && m5Fast > m5Slow) ||
      (h1Bias === "BEARISH" && m5Fast < m5Slow));

  let candidateAction: SimpleTrigger = "OBSERVE";
  if (h1Bias === "BULLISH" && m15Arm && m5Trigger) candidateAction = "BUY";
  if (h1Bias === "BEARISH" && m15Arm && m5Trigger) candidateAction = "SELL";

  const reason =
    candidateAction === "OBSERVE"
      ? "No aligned setup"
      : `Aligned ${candidateAction} setup detected`;

  return {
    h1Bias,
    m15Arm,
    m5Trigger,
    candidateAction,
    reason,
  };
}

function calculateRequestedPositionSize(_symbol: SymbolCode, price: number): number {
  if (price <= 0) return 0;
  const notionalTargetUsd = 100;
  return Number((notionalTargetUsd / price).toFixed(6));
}

function calculateCapitalRequired(positionSize: number, price: number): number {
  return Number((positionSize * price).toFixed(2));
}

function safeString(value: unknown, fallback = "UNKNOWN"): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function toBoolean(value: unknown): boolean {
  return Boolean(value);
}

// -------------------------
// CORE PER-SYMBOL CYCLE
// -------------------------
async function runCycleForSymbol(symbol: SymbolCode): Promise<void> {
  const timestampUtc = new Date().toISOString();

  try {
    const snapshot = await getBinanceSnapshot(symbol);

    const biasResult = evaluateBinanceBias({
      symbol,
      h1Closes: snapshot.h1.map((c) => c.close),
      previous: biasMemoryBySymbol[symbol],
    });

    biasMemoryBySymbol[symbol] = biasResult.updatedMemory;

    const simple = getSimpleReadout(snapshot, biasResult.bias);

    const volatilityResult = detectVolatility({
      h1: snapshot.h1,
      m15: snapshot.m15,
      m5: snapshot.m5,
      symbol,
    } as any);

    const nextReentryResult = stabilizeReentry({
      volatilityState: (volatilityResult as any)?.state ?? "UNKNOWN",
      state: reentryStateBySymbol[symbol],
    } as any);

    reentryStateBySymbol[symbol] = {
      stableCount: nextReentryResult.stableCount ?? reentryStateBySymbol[symbol].stableCount,
      unstableCount:
        nextReentryResult.unstableCount ?? reentryStateBySymbol[symbol].unstableCount,
      currentMode: nextReentryResult.nextMode ?? reentryStateBySymbol[symbol].currentMode,
    };

    const nextReentryState = reentryStateBySymbol[symbol];

    const nextAuthorityResult = controlVolatilityAuthority({
      currentState: authorityStateBySymbol[symbol],
      volatilityState: (volatilityResult as any)?.state ?? "UNKNOWN",
      reentryState: nextReentryState,
    } as any);

    authorityStateBySymbol[symbol] = {
      authorityState:
        nextAuthorityResult.nextAuthorityState ?? authorityStateBySymbol[symbol].authorityState,
      stableCycles:
        nextAuthorityResult.stableCycles ?? authorityStateBySymbol[symbol].stableCycles,
      unstableCycles:
        nextAuthorityResult.unstableCycles ?? authorityStateBySymbol[symbol].unstableCycles,
    };

    const nextAuthorityState = authorityStateBySymbol[symbol];

    const mappedMode = mapAuthorityStateToIntelligenceMode(
      authorityStateBySymbol[symbol].authorityState,
    );
    setIntelligenceMode(mappedMode);

    const intelligenceResult = evaluateIntelligence({
      symbol,
      marketSnapshot: snapshot,
      bias: simple.h1Bias,
      arm: simple.m15Arm,
      trigger: simple.m5Trigger,
      volatility: volatilityResult,
      reentryState: nextReentryState,
      authorityState: nextAuthorityState,
      mode: mappedMode,
    } as any);

    const downstreamPacket = adaptIntelligenceToDownstream(intelligenceResult as any);

    const supervisorResult = superviseIntelligence({
      decision: {
        action: simple.candidateAction,
        reason: simple.reason,
      } as any,
      downstreamPacket,
    });

    const gatedResult = applyAuthorityGate({
      candidateAction: simple.candidateAction,
      supervisor: {
        authorityGranted: supervisorResult.authorityGranted,
        observeOnly: supervisorResult.observeOnly,
        advisoryOnly: supervisorResult.advisoryOnly,
        supervisorNote: supervisorResult.supervisorNote,
        mode: supervisorResult.mode,
      },
    });

    let recommendedAction = gatedResult.finalAction;
    let positionSizeRequested = 0;
    let capitalRequired = 0;

    if (recommendedAction === "BUY" || recommendedAction === "SELL") {
      positionSizeRequested = calculateRequestedPositionSize(symbol, snapshot.lastPrice);
      capitalRequired = calculateCapitalRequired(positionSizeRequested, snapshot.lastPrice);
    }

    let executionAllowed = gatedResult.authorityGranted;
    let execute = gatedResult.execute;
    let blockReason = safeString(gatedResult.gateReason, BLOCK_REASON);
    let exchangeOrderSent = false;
    let finalAction = recommendedAction;

    if (capitalRequired > CAPITAL_AVAILABLE) {
      executionAllowed = false;
      execute = false;
      blockReason = BLOCK_REASON;
      exchangeOrderSent = false;
    }

    if (EXECUTION_LOCK || MODE === "LIVE_OBSERVE_INSUFFICIENT_FUNDS") {
      executionAllowed = false;
      execute = false;
      exchangeOrderSent = false;
      blockReason = BLOCK_REASON;
      finalAction = "OBSERVE";
    }

    emitIntelligenceTelemetry({
      ...supervisorResult,
      authorityGranted: false,
      observeOnly: true,
      advisoryOnly: true,
    });

    const cycleLog: RuntimeLogEntry = {
      log_type: "CYCLE",
      timestamp_utc: timestampUtc,
      symbol,
      mode: MODE,
      feed: FEED,

      h1_bias: simple.h1Bias ?? "UNKNOWN",
      bias_strength: biasResult.strength,
      bias_reason: biasResult.reason,
      bias_fast_sma: biasResult.fastSma,
      bias_slow_sma: biasResult.slowSma,
      bias_slope_pct: biasResult.slopePct,
      bias_distance_pct: biasResult.distancePct,

      m15_arm: simple.m15Arm ?? false,
      m5_trigger: simple.m5Trigger ?? false,

      volatility_state: safeString((volatilityResult as any)?.state),
      volatility_score: Number((volatilityResult as any)?.score ?? 0),
      reentry_state: safeString(nextReentryState?.currentMode),
      guardrail_status: safeString(supervisorResult?.mode),

      recommended_action: safeString(gatedResult?.finalAction, "OBSERVE"),
      final_action: finalAction,

      position_size_requested: positionSizeRequested ?? 0,
      capital_required: capitalRequired ?? 0,
      capital_available: CAPITAL_AVAILABLE,

      execution_allowed: executionAllowed,
      execute,
      block_reason: blockReason,
      exchange_order_sent: exchangeOrderSent,

      supervisor_authority_granted: toBoolean(supervisorResult?.authorityGranted),
      supervisor_observe_only: toBoolean(supervisorResult?.observeOnly),
      supervisor_advisory_only: toBoolean(supervisorResult?.advisoryOnly),
      supervisor_note: safeString(supervisorResult?.supervisorNote, ""),

      gate_authority_granted: toBoolean(gatedResult?.authorityGranted),
      gate_reason: safeString(gatedResult?.gateReason),

      intelligence_mode: safeString(mappedMode),
    
    
      authority_state: safeString(nextAuthorityState?.authorityState),
    };

    log(cycleLog);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    log({
      timestamp_utc: timestampUtc,
      symbol,
      mode: MODE,
      feed: FEED,

      h1_bias: "UNKNOWN",
      m15_arm: false,
      m5_trigger: false,

      volatility_state: "UNKNOWN",
      reentry_state: safeString(reentryStateBySymbol[symbol]?.currentMode),
      guardrail_status: "UNKNOWN",

      recommended_action: "OBSERVE",
      final_action: "OBSERVE",

      position_size_requested: 0,
      capital_required: 0,
      capital_available: CAPITAL_AVAILABLE,

      execution_allowed: false,
      execute: false,
      block_reason: BLOCK_REASON,
      exchange_order_sent: false,

      error: message,
      message: "SAFE RECOVERY INITIATED",
    } satisfies RuntimeLogEntry);

    if (
      message.toLowerCase().includes("fetch") ||
      message.toLowerCase().includes("network") ||
      message.toLowerCase().includes("binance")
    ) {
      log({
        timestamp_utc: new Date().toISOString(),
        symbol,
        mode: MODE,
        feed: FEED,
        h1_bias: "UNKNOWN",
        m15_arm: false,
        m5_trigger: false,
        volatility_state: "UNKNOWN",
        reentry_state: safeString(reentryStateBySymbol[symbol]?.currentMode),
        guardrail_status: "UNKNOWN",
        recommended_action: "OBSERVE",
        final_action: "OBSERVE",
        position_size_requested: 0,
        capital_required: 0,
        capital_available: CAPITAL_AVAILABLE,
        execution_allowed: false,
        execute: false,
        block_reason: BLOCK_REASON,
        exchange_order_sent: false,
        message: "FEED INTERRUPTION — ATTEMPTING RECOVERY",
      } satisfies RuntimeLogEntry);
    }
  }
}

// -------------------------
// MAIN LOOP
// -------------------------
async function runCycle(): Promise<void> {
  if (cycleRunning) {
    return;
  }

  cycleRunning = true;

  try {
    for (const symbol of SYMBOLS) {
      await runCycleForSymbol(symbol);
    }
  } finally {
    cycleRunning = false;
  }
}

void runCycle();
setInterval(() => {
  void runCycle();
}, CYCLE_INTERVAL_MS);