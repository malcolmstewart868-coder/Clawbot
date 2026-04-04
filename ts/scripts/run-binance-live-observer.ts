import axios from "axios";
import fs from "fs";
import path from "path";
import pino from "pino";

type MarketState =
  | "COMPRESSION"
  | "PULLBACK"
  | "REVERSAL_ATTEMPT"
  | "TREND_CONTINUATION"
  | "UNSTRUCTURED";

type ObserverRecommendation =
  | "OBSERVE"
  | "PREPARE"
  | "SCOUT"
  | "CONFIRM";

type Bias = "BULLISH" | "BEARISH" | "NEUTRAL";

type RuntimeMode =
  | "LIVE_OBSERVE_INSUFFICIENT_FUNDS"
  | "OBSERVE_ONLY"
  | "SAFE_OBSERVER";

type VolatilityLabel = "COMPRESSION" | "NORMAL" | "EXPANSION";

type ReentryState = "ACTIVE" | "INACTIVE";

interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

interface BiasMemoryState {
  currentBias: Bias;
  lastStrength: number;
  holdCount: number;
}

interface BiasResult {
  bias: Bias;
  strength: number;
  holdCount: number;
  emaFast: number;
  emaSlow: number;
}

interface StructureSignals {
  trendContinuationDetected: boolean;
  pullbackDetected: boolean;
  reversalAttemptDetected: boolean;
  compressionDetected: boolean;
  impulseExpansionDetected: boolean;
  m15Aligned: boolean;
  m5Aligned: boolean;
  volatilityLabel: VolatilityLabel;
  reentryState: ReentryState;
  lastRangePct: number;
  avgRangePct10: number;
  wickBodyRatio: number;
  displacementCount: number;
}

interface MarketStateResult {
  marketState: MarketState;
  signals: StructureSignals;
}

interface CycleLog {
  log_type: "CYCLE";
  timestamp_utc: string;
  symbol: string;
  mode: RuntimeMode;
  execute: false;
  block_reason: "INSUFFICIENT_FUNDS";
  market_state: MarketState;
  observer_recommendation: ObserverRecommendation;
  bias: Bias;
  bias_strength: number;
  hold_count: number;
  price: number;
  ema_fast: number;
  ema_slow: number;
  last_range_pct: number;
  avg_range_pct_10: number;
  wick_body_ratio: number;
  displacement_count: number;
  volatility_label: VolatilityLabel;
  reentry_state: ReentryState;
  reentry_stabilization: boolean;
  cooldown_active: boolean;
  m15_aligned: boolean;
  m5_aligned: boolean;
  impulse_expansion_detected: boolean;
  compression_detected: boolean;
  allow_trade: false;
  guardrail_status: "ACTIVE";
}

interface HeartbeatLog {
  log_type: "HEARTBEAT";
  timestamp_utc: string;
  mode: RuntimeMode;
  execute: false;
  block_reason: "INSUFFICIENT_FUNDS";
  symbols: string[];
  polling_ms: number;
  guardrail_status: "ACTIVE";
}

interface ErrorLog {
  log_type: "ERROR";
  timestamp_utc: string;
  mode: RuntimeMode;
  execute: false;
  block_reason: "INSUFFICIENT_FUNDS";
  symbol?: string;
  error_message: string;
}

const BINANCE_BASE_URL =
  process.env.BINANCE_BASE_URL?.trim() || "https://api.binance.com";

const SYMBOLS = (process.env.BINANCE_OBSERVER_SYMBOLS || "BTCUSDT,ETHUSDT")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

const INTERVAL = (process.env.BINANCE_KLINE_INTERVAL || "5m").trim();
const POLLING_MS = Number(process.env.BINANCE_OBSERVER_POLL_MS || 15_000);
const KLINE_LIMIT = Number(process.env.BINANCE_OBSERVER_KLINE_LIMIT || 120);

const MODE: RuntimeMode = "LIVE_OBSERVE_INSUFFICIENT_FUNDS";
const BLOCK_REASON = "INSUFFICIENT_FUNDS" as const;
const EXECUTE = false as const;

const logDate = new Date().toISOString().slice(0, 10);
const logsDir = path.resolve(process.cwd(), "logs");
const logFilePath = path.join(logsDir, `binance_observer_${logDate}.log`);

fs.mkdirSync(logsDir, { recursive: true });

const logFileStream = fs.createWriteStream(logFilePath, {
  flags: "a",
  encoding: "utf8",
});

const logger = pino(
  {
    name: "binance-live-observer",
    level: process.env.LOG_LEVEL || "info",
  },
  pino.multistream([
    { stream: process.stdout },
    { stream: logFileStream },
  ]),
);

function closeLogStream(): void {
  try {
    logFileStream.end();
  } catch {
    // no-op
  }
}

const biasMemory = new Map<string, BiasMemoryState>();

function nowUtc(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round(value: number, digits = 6): number {
  return Number(value.toFixed(digits));
}

function firstOrThrow<T>(items: T[], label: string): T {
  const value = items[0];
  if (value === undefined) {
    throw new Error(`${label} is empty`);
  }
  return value;
}

function lastOrThrow<T>(items: T[], label: string): T {
  const value = items[items.length - 1];
  if (value === undefined) {
    throw new Error(`${label} is empty`);
  }
  return value;
}

function getOrThrow<T>(items: T[], index: number, label: string): T {
  const value = items[index];
  if (value === undefined) {
    throw new Error(`${label}[${index}] is undefined`);
  }
  return value;
}

function parseKlines(raw: unknown[]): Candle[] {
  return raw.map((row: any) => ({
    openTime: toNumber(row[0]),
    open: toNumber(row[1]),
    high: toNumber(row[2]),
    low: toNumber(row[3]),
    close: toNumber(row[4]),
    volume: toNumber(row[5]),
    closeTime: toNumber(row[6]),
  }));
}

async function fetchKlines(symbol: string): Promise<Candle[]> {
  const response = await axios.get(`${BINANCE_BASE_URL}/api/v3/klines`, {
    params: {
      symbol,
      interval: INTERVAL,
      limit: KLINE_LIMIT,
    },
    timeout: 10_000,
  });

  if (!Array.isArray(response.data)) {
    throw new Error(`Unexpected kline response for ${symbol}`);
  }

  return parseKlines(response.data);
}

function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];

  const multiplier = 2 / (period + 1);
  const firstValue = firstOrThrow(values, "ema.values");
  const result: number[] = [firstValue];

  for (let i = 1; i < values.length; i += 1) {
    const currentValue = getOrThrow(values, i, "ema.values");
    const previousEma = getOrThrow(result, i - 1, "ema.result");
    result.push(currentValue * multiplier + previousEma * (1 - multiplier));
  }

  return result;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function getRangePct(candle: Candle): number {
  return candle.close === 0 ? 0 : (candle.high - candle.low) / candle.close;
}

function getBodyPct(candle: Candle): number {
  return candle.close === 0
    ? 0
    : Math.abs(candle.close - candle.open) / candle.close;
}

function getWickBodyRatio(candle: Candle): number {
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  const wick = Math.max(0, range - body);

  if (body === 0) return wick > 0 ? 999 : 0;
  return wick / body;
}

function candleDirection(candle: Candle): number {
  return Math.sign(candle.close - candle.open);
}

function countDisplacementCandles(candles: Candle[]): number {
  const recent = candles.slice(-4);
  const baseline = candles.slice(-14, -4).map(getRangePct);
  const avgRange = mean(baseline);

  return recent.filter((c) => {
    const rangePct = getRangePct(c);
    const bodyPct = getBodyPct(c);
    return rangePct > avgRange * 1.45 && bodyPct > rangePct * 0.55;
  }).length;
}

function detectReentryStabilization(candles: Candle[]): boolean {
  if (candles.length < 6) return false;

  const recent = candles.slice(-3);
  const prior = candles.slice(-6, -3);

  const recentAvgRange = mean(recent.map(getRangePct));
  const priorAvgRange = mean(prior.map(getRangePct));
  const recentWickiness = mean(recent.map(getWickBodyRatio));

  const directionChanges = recent.filter((c, i, arr) => {
    if (i === 0) return false;

    const prev = getOrThrow(arr, i - 1, "detectReentryStabilization.recent");
    const prevDir = candleDirection(prev);
    const currDir = candleDirection(c);

    return prevDir !== 0 && currDir !== 0 && prevDir !== currDir;
  }).length;

  return (
    recentAvgRange > priorAvgRange * 1.15 &&
    recentWickiness > 1.6 &&
    directionChanges >= 1
  );
}

function detectCooldown(candles: Candle[]): boolean {
  const recent = candles.slice(-3).map(getRangePct);
  const prior = candles.slice(-13, -3).map(getRangePct);

  const recentAvg = mean(recent);
  const priorAvg = mean(prior);

  return recentAvg > priorAvg * 1.8;
}

function classifyBias(symbol: string, closes: number[]): BiasResult {
  const fastPeriod = 9;
  const slowPeriod = 21;

  const fastSeries = ema(closes, fastPeriod);
  const slowSeries = ema(closes, slowPeriod);

  const emaFast =
    fastSeries.length > 0 ? lastOrThrow(fastSeries, "classifyBias.fastSeries") : 0;
  const emaSlow =
    slowSeries.length > 0 ? lastOrThrow(slowSeries, "classifyBias.slowSeries") : 0;

  const rawDelta = emaSlow === 0 ? 0 : (emaFast - emaSlow) / emaSlow;
  const strength = clamp(Math.abs(rawDelta) * 1000, 0, 1);

  let proposedBias: Bias = "NEUTRAL";
  const bullishThreshold = 0.0012;
  const bearishThreshold = -0.0012;
  const neutralBand = 0.0005;

  if (rawDelta >= bullishThreshold) proposedBias = "BULLISH";
  else if (rawDelta <= bearishThreshold) proposedBias = "BEARISH";
  else if (Math.abs(rawDelta) <= neutralBand) proposedBias = "NEUTRAL";

  const memory = biasMemory.get(symbol) || {
    currentBias: "NEUTRAL" as Bias,
    lastStrength: 0,
    holdCount: 0,
  };

  let finalBias = memory.currentBias;
  let holdCount = memory.holdCount;

  if (proposedBias === memory.currentBias) {
    finalBias = proposedBias;
    holdCount += 1;
  } else {
    const hysteresisPass =
      (proposedBias === "BULLISH" && rawDelta >= 0.0018) ||
      (proposedBias === "BEARISH" && rawDelta <= -0.0018) ||
      (proposedBias === "NEUTRAL" && Math.abs(rawDelta) <= 0.00035);

    if (hysteresisPass) {
      finalBias = proposedBias;
      holdCount = 1;
    } else {
      finalBias = memory.currentBias;
      holdCount = memory.holdCount + 1;
    }
  }

  biasMemory.set(symbol, {
    currentBias: finalBias,
    lastStrength: strength,
    holdCount,
  });

  return {
    bias: finalBias,
    strength,
    holdCount,
    emaFast,
    emaSlow,
  };
}

function computeStructureSignals(
  candles: Candle[],
  bias: Bias,
): StructureSignals {
  if (candles.length < 14) {
    throw new Error("computeStructureSignals requires at least 14 candles");
  }

  const recent = lastOrThrow(candles, "computeStructureSignals.candles");
  const prev = getOrThrow(
    candles,
    candles.length - 2,
    "computeStructureSignals.candles",
  );
  const prev2 = getOrThrow(
    candles,
    candles.length - 3,
    "computeStructureSignals.candles",
  );

  const last10 = candles.slice(-11, -1);
  if (last10.length === 0) {
    throw new Error("computeStructureSignals.last10 is empty");
  }

  const lastRangePct = getRangePct(recent);
  const avgRangePct10 = mean(last10.map(getRangePct));
  const wickBodyRatio = getWickBodyRatio(recent);
  const displacementCount = countDisplacementCandles(candles);

  const closes = candles.map((c) => c.close);
  const emaFastSeries = ema(closes, 9);
  const emaSlowSeries = ema(closes, 21);

  const m5Fast =
    emaFastSeries.length > 0
      ? lastOrThrow(emaFastSeries, "computeStructureSignals.emaFastSeries")
      : 0;

  const m5Slow =
    emaSlowSeries.length > 0
      ? lastOrThrow(emaSlowSeries, "computeStructureSignals.emaSlowSeries")
      : 0;

  const aggregated3: Candle[] = [];
  for (let i = 0; i < candles.length; i += 3) {
    const slice = candles.slice(i, i + 3);
    if (slice.length < 3) continue;

    const first = firstOrThrow(slice, "computeStructureSignals.slice");
    const last = lastOrThrow(slice, "computeStructureSignals.slice");

    aggregated3.push({
      openTime: first.openTime,
      open: first.open,
      high: Math.max(...slice.map((c) => c.high)),
      low: Math.min(...slice.map((c) => c.low)),
      close: last.close,
      volume: slice.reduce((sum, c) => sum + c.volume, 0),
      closeTime: last.closeTime,
    });
  }

  const m15Closes = aggregated3.map((c) => c.close);
  const m15FastSeries = ema(m15Closes, 5);
  const m15SlowSeries = ema(m15Closes, 8);

  const m15Fast =
    m15FastSeries.length > 0
      ? lastOrThrow(m15FastSeries, "computeStructureSignals.m15FastSeries")
      : 0;

  const m15Slow =
    m15SlowSeries.length > 0
      ? lastOrThrow(m15SlowSeries, "computeStructureSignals.m15SlowSeries")
      : 0;

  const m15Aligned =
    bias === "BULLISH"
      ? m15Fast > m15Slow
      : bias === "BEARISH"
        ? m15Fast < m15Slow
        : false;

  const m5Aligned =
    bias === "BULLISH"
      ? m5Fast > m5Slow
      : bias === "BEARISH"
        ? m5Fast < m5Slow
        : false;

  const reentryActive = detectReentryStabilization(candles);
  const reentryState: ReentryState = reentryActive ? "ACTIVE" : "INACTIVE";

  const impulseExpansionDetected =
  displacementCount >= 1 &&
  lastRangePct > avgRangePct10 * 1.18 &&
  wickBodyRatio > 1.05;

  const volatilityLabel: VolatilityLabel =
    lastRangePct < avgRangePct10 * 0.72
      ? "COMPRESSION"
      : impulseExpansionDetected || lastRangePct > avgRangePct10 * 1.2
        ? "EXPANSION"
        : "NORMAL";

  const biasDirection =
    bias === "BULLISH" ? 1 : bias === "BEARISH" ? -1 : 0;

  const recentDirection = candleDirection(recent);
  const prevDirection = candleDirection(prev);
  const prev2Direction = candleDirection(prev2);

  const trendContinuationDetected =
  displacementCount >= 1 &&
  lastRangePct > avgRangePct10 * 1.05 &&
  wickBodyRatio > 1.0;

 const pullbackDetected =
  !impulseExpansionDetected &&
  displacementCount <= 1 &&
  lastRangePct >= avgRangePct10 * 0.75 &&
  lastRangePct <= avgRangePct10 * 1.15 &&
  (
    (m15Aligned && !m5Aligned) ||
    (m15Aligned && wickBodyRatio >= 0.55) ||
    (!m15Aligned && !m5Aligned && wickBodyRatio >= 0.9 && lastRangePct < avgRangePct10 * 1.05)
  );
  
  const reversalAttemptDetected =
  !impulseExpansionDetected &&
  displacementCount <= 1 &&
  lastRangePct >= avgRangePct10 * 0.9 &&
  wickBodyRatio >= 0.95 &&
  !m15Aligned &&
  !m5Aligned;
  const compressionDetected =
  lastRangePct < avgRangePct10 * 1.05 &&
  wickBodyRatio < 1.6 &&
  displacementCount <= 1;

  return {
    trendContinuationDetected,
    pullbackDetected,
    reversalAttemptDetected,
    compressionDetected,
    impulseExpansionDetected,
    m15Aligned,
    m5Aligned,
    volatilityLabel,
    reentryState,
    lastRangePct,
    avgRangePct10,
    wickBodyRatio,
    displacementCount,
  };
}

function classifyMarketState(candles: Candle[], bias: Bias): MarketStateResult {
  const signals = computeStructureSignals(candles, bias);

  if (signals.trendContinuationDetected) {
    return {
      marketState: "TREND_CONTINUATION",
      signals,
    };
  }

  if (signals.pullbackDetected) {
    return {
      marketState: "PULLBACK",
      signals,
    };
  }

  if (signals.reversalAttemptDetected) {
    return {
      marketState: "REVERSAL_ATTEMPT",
      signals,
    };
  }

  const compressionAllowed =
    signals.compressionDetected &&
    !signals.impulseExpansionDetected &&
    !signals.m15Aligned &&
    !signals.m5Aligned &&
    signals.volatilityLabel !== "EXPANSION" &&
    signals.reentryState !== "ACTIVE";

  if (compressionAllowed) {
    return {
      marketState: "COMPRESSION",
      signals,
    };
  }

  return {
    marketState: "UNSTRUCTURED",
    signals,
  };
}

function mapRecommendation(marketState: MarketState): ObserverRecommendation {
  switch (marketState) {
    case "COMPRESSION":
      return "OBSERVE";
    case "PULLBACK":
      return "PREPARE";
    case "REVERSAL_ATTEMPT":
      return "SCOUT";
    case "TREND_CONTINUATION":
      return "CONFIRM";
    case "UNSTRUCTURED":
    default:
      return "OBSERVE";
  }
}

async function runCycleForSymbol(symbol: string): Promise<void> {
  const candles = await fetchKlines(symbol);

  if (candles.length < 30) {
    throw new Error(`Not enough candles returned for ${symbol}`);
  }

  const closes = candles.map((c) => c.close);
  const latest = lastOrThrow(candles, "runCycleForSymbol.candles");

  const biasData = classifyBias(symbol, closes);
  const marketStateResult = classifyMarketState(candles, biasData.bias);
  const observerRecommendation = mapRecommendation(marketStateResult.marketState);

  const reentryStabilization =
    marketStateResult.signals.reentryState === "ACTIVE";
  const cooldownActive = detectCooldown(candles);

  const cycleLog: CycleLog = {
    log_type: "CYCLE",
    timestamp_utc: nowUtc(),
    symbol,
    mode: MODE,
    execute: EXECUTE,
    block_reason: BLOCK_REASON,
    market_state: marketStateResult.marketState,
    observer_recommendation: observerRecommendation,
    bias: biasData.bias,
    bias_strength: round(biasData.strength, 4),
    hold_count: biasData.holdCount,
    price: latest.close,
    ema_fast: round(biasData.emaFast, 4),
    ema_slow: round(biasData.emaSlow, 4),
    last_range_pct: round(marketStateResult.signals.lastRangePct, 6),
    avg_range_pct_10: round(marketStateResult.signals.avgRangePct10, 6),
    wick_body_ratio: round(marketStateResult.signals.wickBodyRatio, 4),
    displacement_count: marketStateResult.signals.displacementCount,
    volatility_label: marketStateResult.signals.volatilityLabel,
    reentry_state: marketStateResult.signals.reentryState,
    reentry_stabilization: reentryStabilization,
    cooldown_active: cooldownActive,
    m15_aligned: marketStateResult.signals.m15Aligned,
    m5_aligned: marketStateResult.signals.m5Aligned,
    impulse_expansion_detected:
      marketStateResult.signals.impulseExpansionDetected,
    compression_detected: marketStateResult.signals.compressionDetected,
    allow_trade: false,
    guardrail_status: "ACTIVE",
  };

  logger.info(cycleLog);
}

async function runObserver(): Promise<void> {
  logger.info({
    log_type: "LOG_TARGET",
    timestamp_utc: nowUtc(),
    log_file: logFilePath,
  });

  logger.info({
    log_type: "BOOT",
    timestamp_utc: nowUtc(),
    mode: MODE,
    execute: EXECUTE,
    block_reason: BLOCK_REASON,
    symbols: SYMBOLS,
    interval: INTERVAL,
    polling_ms: POLLING_MS,
    kline_limit: KLINE_LIMIT,
    guardrail_status: "ACTIVE",
    note: "CLAWBOT BINANCE OBSERVER ACTIVE — CLEAN RUNTIME RESET ENGAGED",
  });

  while (true) {
    const startedAt = Date.now();

    for (const symbol of SYMBOLS) {
      try {
        await runCycleForSymbol(symbol);
      } catch (error: any) {
        const errorLog: ErrorLog = {
          log_type: "ERROR",
          timestamp_utc: nowUtc(),
          mode: MODE,
          execute: EXECUTE,
          block_reason: BLOCK_REASON,
          symbol,
          error_message:
            error?.message || `Unknown runtime error while processing ${symbol}`,
        };

        logger.error(errorLog);
      }
    }

    const heartbeat: HeartbeatLog = {
      log_type: "HEARTBEAT",
      timestamp_utc: nowUtc(),
      mode: MODE,
      execute: EXECUTE,
      block_reason: BLOCK_REASON,
      symbols: SYMBOLS,
      polling_ms: POLLING_MS,
      guardrail_status: "ACTIVE",
    };

    logger.info(heartbeat);

    const elapsed = Date.now() - startedAt;
    const delay = Math.max(1_000, POLLING_MS - elapsed);
    await sleep(delay);
  }
}

process.on("SIGINT", () => {
  logger.info({
    log_type: "SHUTDOWN",
    timestamp_utc: nowUtc(),
    mode: MODE,
    execute: EXECUTE,
    block_reason: BLOCK_REASON,
    note: "Observer stopped by SIGINT",
  });
  closeLogStream();
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info({
    log_type: "SHUTDOWN",
    timestamp_utc: nowUtc(),
    mode: MODE,
    execute: EXECUTE,
    block_reason: BLOCK_REASON,
    note: "Observer stopped by SIGTERM",
  });
  closeLogStream();
  process.exit(0);
});

runObserver().catch((error: any) => {
  logger.error({
    log_type: "FATAL",
    timestamp_utc: nowUtc(),
    mode: MODE,
    execute: EXECUTE,
    block_reason: BLOCK_REASON,
    error_message: error?.message || "Unknown fatal observer error",
  });
  closeLogStream();
  process.exit(1);
});