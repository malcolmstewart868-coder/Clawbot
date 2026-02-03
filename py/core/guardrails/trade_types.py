from __future__ import annotations
from dataclasses import dataclass
from typing import Literal, Optional, List, Dict, Any

Side = Literal["buy", "sell"]

@dataclass
class Trade:
    id: str
    symbol: str
    side: Side
    entry: float
    initial_stop: float
    size: float
    current_stop: Optional[float] = None

@dataclass
class Action:
    reason: str
    profit_r: float
    old_stop: Optional[float] = None
    new_stop: Optional[float] = None
    close_pct: Optional[float] = None  # e.g. 0.5 means 50%

def risk_R(entry: float, stop: float, side: Side) -> float:
    """
    R distance in price units.
    buy: entry - stop (stop below entry)
    sell: stop - entry (stop above entry)
    """
    if side == "buy":
        return entry - stop
    return stop - entry

def profit_in_R(entry: float, stop: float, side: Side, price: float) -> float:
    """
    Profit in R at a given price.
    buy: (price - entry)/R
    sell: (entry - price)/R
    """
    r = risk_R(entry, stop, side)
    if r <= 0:
        return 0.0
    if side == "buy":
        return (price - entry) / r
    return (entry - price) / r
