import {
  ensureObservedSymbol,
  getMultiSymbolObserverState,
} from "./multiSymbolState";
import { bindLiveSymbolState } from "./realSymbolBinding";

export async function runParallelIntelligenceCycle() {
  const multi = getMultiSymbolObserverState();
  const symbols = multi.observedSymbols.length ? multi.observedSymbols : ["EURUSDT", "BTCUSDT"];

  for (const symbol of symbols) {
    ensureObservedSymbol(symbol);
    await bindLiveSymbolState(symbol);
  }

  return getMultiSymbolObserverState();
}