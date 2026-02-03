from __future__ import annotations
from py.core.guardrails.trade_types import Trade
from py.core.guardrails.trade_management import TMParams, TMState, evaluate_trade_management

def run():
    # Example values based on your output:
    # entry=100, initial_stop=90 => R=10
    # BE newStop=100.5 => +0.05R
    # BE+ newStop=103 => +0.3R
    params = TMParams(
        tp1_r=1.0,
        tp1_close_pct=0.5,
        be_offset_r=0.05,
        be_plus_r=1.5,
        be_plus_stop_r=0.3,
        runner_trail_start_r=2.0,
        runner_trail_step_r=0.5,
        runner_trail_lock_r=1.0
    )

    trade = Trade(
        id="t1",
        symbol="TEST",
        side="buy",
        entry=100.0,
        initial_stop=90.0,
        size=1.0,
        current_stop=None
    )
    state = TMState()

    print("=== Case 1 (+1R) expected: tp1_partial + be ===")
    # price at +1R: entry + 10 = 110
    actions = evaluate_trade_management(trade, state, price=110.0, params=params)
    print([a.__dict__ for a in actions])

    print("\n=== Case 2 (+1.5R) expected: be_plus ===")
    # price at +1.5R: entry + 15 = 115
    actions = evaluate_trade_management(trade, state, price=115.0, params=params)
    print([a.__dict__ for a in actions])

    print("\n=== Case 3 (runner trail) expected: runner_trail ===")
    # price at +2.5R: entry + 25 = 125 (should start trailing)
    actions = evaluate_trade_management(trade, state, price=125.0, params=params)
    print([a.__dict__ for a in actions])

if __name__ == "__main__":
    run()
