from __future__ import annotations
from dataclasses import dataclass
from typing import List, Optional, Dict, Any

from .trade_types import Trade, Action, profit_in_R, risk_R

@dataclass
class TMParams:
    tp1_r: float = 1.0
    tp1_close_pct: float = 0.5
    be_offset_r: float = 0.05      # 0.5R would be 0.5, but your example used 0.05? No: your example is 0.5R (entry 100, stop 90 => R=10, +0.5R=+5 => 105). You had 100.5 so offset was 0.05R. We'll keep it explicit and set it in the test.
    be_plus_r: float = 1.5
    be_plus_stop_r: float = 0.3    # same idea: set explicitly to match your TS test. Example shows +3 on entry 100 -> 103 => 0.3R when R=10.
    runner_trail_start_r: float = 2.0
    runner_trail_step_r: float = 0.5  # move stop each additional 0.5R
    runner_trail_lock_r: float = 1.0  # how much profit to lock once trailing

@dataclass
class TMState:
    did_tp1: bool = False
    did_be: bool = False
    did_be_plus: bool = False
    runner_mode: bool = False
    last_trail_level_r: float = 0.0

def _stop_from_entry(entry: float, r_value: float, side: str, stop_r: float) -> float:
    """
    stop = entry +/- stop_r*R depending on side.
    buy: stop = entry + stop_r*R (locks profit above entry)
    sell: stop = entry - stop_r*R
    """
    if side == "buy":
        return entry + (stop_r * r_value)
    return entry - (stop_r * r_value)

def evaluate_trade_management(
    trade: Trade,
    state: TMState,
    price: float,
    params: TMParams
) -> List[Action]:
    """
    Returns a list of actions that should happen at this price snapshot.
    """
    actions: List[Action] = []

    base_stop = trade.current_stop if trade.current_stop is not None else trade.initial_stop
    r_value = risk_R(trade.entry, trade.initial_stop, trade.side)
    if r_value <= 0:
        return actions

    pr = profit_in_R(trade.entry, trade.initial_stop, trade.side, price)

    # TP1 + BE at +1R
    if (not state.did_tp1) and pr >= params.tp1_r:
        actions.append(Action(
            reason="tp1_partial",
            close_pct=params.tp1_close_pct,
            profit_r=pr,
            old_stop=base_stop
        ))
        state.did_tp1 = True

    if (state.did_tp1 and (not state.did_be)) and pr >= params.tp1_r:
        new_stop = _stop_from_entry(trade.entry, r_value, trade.side, params.be_offset_r)
        old = trade.current_stop if trade.current_stop is not None else trade.initial_stop
        trade.current_stop = new_stop
        actions.append(Action(
            reason="be",
            new_stop=new_stop,
            old_stop=old,
            profit_r=pr
        ))
        state.did_be = True

    # BE+ at +1.5R
    if (not state.did_be_plus) and pr >= params.be_plus_r:
        new_stop = _stop_from_entry(trade.entry, r_value, trade.side, params.be_plus_stop_r)
        old = trade.current_stop if trade.current_stop is not None else trade.initial_stop
        trade.current_stop = new_stop
        actions.append(Action(
            reason="be_plus",
            new_stop=new_stop,
            old_stop=old,
            profit_r=pr
        ))
        state.did_be_plus = True
        state.runner_mode = True

    # Runner trail
    if state.runner_mode and pr >= params.runner_trail_start_r:
        # Determine the trail step "level"
        level = pr - params.runner_trail_start_r
        # how many steps of runner_trail_step_r have we advanced?
        steps = int(level // params.runner_trail_step_r)
        target_level_r = params.runner_trail_start_r + (steps * params.runner_trail_step_r)

        if target_level_r > state.last_trail_level_r:
            # lock runner_trail_lock_r behind current achieved level
            lock_stop_r = target_level_r - params.runner_trail_lock_r
            new_stop = _stop_from_entry(trade.entry, r_value, trade.side, lock_stop_r)
            old = trade.current_stop if trade.current_stop is not None else trade.initial_stop

            # Only tighten stop in the right direction
            if trade.side == "buy":
                should_update = (trade.current_stop is None) or (new_stop > trade.current_stop)
            else:
                should_update = (trade.current_stop is None) or (new_stop < trade.current_stop)

            if should_update:
                trade.current_stop = new_stop
                actions.append(Action(
                    reason="runner_trail",
                    new_stop=new_stop,
                    old_stop=old,
                    profit_r=pr
                ))
                state.last_trail_level_r = target_level_r

    return actions
