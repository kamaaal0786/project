"""
Credit engine - pure deterministic functions.
No ML dependency. Called from upload pipeline and manual update.
Returns plain dicts for easy JSON serialization.

Now regulation-aware: thresholds come from regulation config when available.
"""
from typing import Optional


def compute_credits(
    earned: float,
    expected: float,
    required: float,
    backlog_credits: float = 0.0,
    regulation_code: Optional[str] = None,
) -> dict:
    """
    Compute credit progress with regulation-aware thresholds.

    - completion_pct = earned / expected * 100 (capped at 100)
    - deficit = max(expected - earned, 0)
    - credit_gap = expected - earned
    - status: ON_TRACK / DEFICIENT / CRITICAL (thresholds from regulation)
    """
    earned = max(float(earned), 0.0)
    expected = max(float(expected), 1.0)  # avoid divide-by-zero
    required = max(float(required), 0.0)
    backlog_credits = max(float(backlog_credits), 0.0)

    completion_pct = min(earned / expected * 100.0, 100.0)
    deficit = max(expected - earned, 0.0)
    credit_gap = expected - earned

    # Get thresholds from regulation config, fallback to defaults
    on_track_pct = 90.0
    deficient_pct = 70.0
    critical_pct = 50.0

    if regulation_code:
        try:
            from app.regulations.engine import get_rules
            rules = get_rules(regulation_code)
            if rules:
                on_track_pct = rules.get("credit_on_track_pct", 90.0)
                deficient_pct = rules.get("credit_deficient_pct", 70.0)
                critical_pct = rules.get("credit_critical_pct", 50.0)
        except ImportError:
            pass

    if completion_pct >= on_track_pct:
        status = 'ON_TRACK'
    elif completion_pct >= deficient_pct:
        status = 'DEFICIENT'
    else:
        status = 'CRITICAL'

    return {
        'earned': round(earned, 2),
        'expected': round(expected, 2),
        'required': round(required, 2),
        'completion_pct': round(completion_pct, 2),
        'deficit': round(deficit, 2),
        'credit_gap': round(credit_gap, 2),
        'backlog_credits': round(backlog_credits, 2),
        'status': status,
    }
