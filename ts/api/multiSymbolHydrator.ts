import {
  ensureObservedSymbol,
  getMultiSymbolObserverState,
  hydrateActiveSymbolFromEngine,
} from "./multiSymbolState";

// IMPORTANT:
// Replace this import path with the real module you already use in /api/observer
// for the live single-symbol observer snapshot.
import { getObserverState } from "./observerState";

function detectLiveSymbol(liveState: any): string {
  return (
    liveState?.position?.symbol ||
    liveState?.symbol ||
    liveState?.market?.symbol ||
    "EURUSDT"
  );
}

export function syncMultiSymbolStateFromEngine() {
  const liveState = getObserverState?.() ?? {};
  const liveSymbol = detectLiveSymbol(liveState);

  ensureObservedSymbol("EURUSDT");
  ensureObservedSymbol("BTCUSDT");
  ensureObservedSymbol(liveSymbol);

  hydrateActiveSymbolFromEngine(liveSymbol, liveState);

  return getMultiSymbolObserverState();
}