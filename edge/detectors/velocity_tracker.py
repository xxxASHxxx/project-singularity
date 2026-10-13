"""Shelf fill depletion velocity tracker and stockout ETA estimator.

Tracks shelf fill ratio over a rolling time window, computes real-time
depletion/replenishment velocity (%/min), forecasts stockout runway (ETA),
and detects accelerated depletion spikes (e.g. flash surges or shelf sweeps).
"""
import time
from collections import deque
from dataclasses import dataclass
from typing import Any, Deque, Dict, Optional, Tuple


@dataclass
class VelocityResult:
    """Result of shelf fill velocity tracking for a telemetry cycle."""

    velocity_pct_per_min: float = 0.0
    stockout_eta_minutes: Optional[float] = None
    is_rapid_depletion: bool = False
    is_restocking: bool = False
    current_fill: float = 0.0
    sample_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to a JSON-safe dictionary."""
        return {
            'velocity_pct_per_min': round(self.velocity_pct_per_min, 2),
            'stockout_eta_minutes': (
                round(self.stockout_eta_minutes, 1)
                if self.stockout_eta_minutes is not None
                else None
            ),
            'is_rapid_depletion': self.is_rapid_depletion,
            'is_restocking': self.is_restocking,
            'current_fill': round(self.current_fill, 2),
            'sample_count': self.sample_count,
        }

    def __str__(self) -> str:
        parts = [f"velocity={self.velocity_pct_per_min:+.2f}%/min"]
        if self.stockout_eta_minutes is not None:
            parts.append(f"ETA={self.stockout_eta_minutes:.1f}m")
        if self.is_rapid_depletion:
            parts.append("RAPID_DEPLETION")
        elif self.is_restocking:
            parts.append("RESTOCKING")
        return f"Velocity[{', '.join(parts)}]"


class VelocityTracker:
    """Sliding-window velocity and stockout estimator.

    Computes ordinary least squares linear regression on timestamped fill ratios
    to produce rate of consumption in percentage points per minute.
    """

    def __init__(
        self,
        window_size: int = 12,
        min_samples: int = 3,
        rapid_threshold: float = 10.0,
        critical_threshold: float = 0.0,
    ):
        """Args:
            window_size: Maximum samples retained in rolling history.
            min_samples: Minimum samples required before emitting non-zero velocity.
            rapid_threshold: Absolute %/min depletion rate that triggers rapid alert.
            critical_threshold: Target fill % used to calculate stockout ETA.
        """
        self.window_size = window_size
        self.min_samples = min_samples
        self.rapid_threshold = abs(rapid_threshold)
        self.critical_threshold = critical_threshold
        self._history: Deque[Tuple[float, float]] = deque(maxlen=window_size)
        self._last_result: Optional[VelocityResult] = None

    def ingest(self, fill_ratio: float, timestamp: Optional[float] = None) -> VelocityResult:
        """Ingest a new fill ratio observation.

        Args:
            fill_ratio: Current shelf fill ratio (0.0 to 100.0).
            timestamp: Epoch timestamp in seconds (default: time.time()).

        Returns:
            VelocityResult containing velocity and stockout ETA.
        """
        ts = time.time() if timestamp is None else float(timestamp)
        fill = float(fill_ratio)
        self._history.append((ts, fill))

        n = len(self._history)
        if n < self.min_samples:
            res = VelocityResult(
                velocity_pct_per_min=0.0,
                stockout_eta_minutes=None,
                is_rapid_depletion=False,
                is_restocking=False,
                current_fill=fill,
                sample_count=n,
            )
            self._last_result = res
            return res

        # Convert timestamps to relative minutes from earliest in window
        t0 = self._history[0][0]
        times_min = [(t - t0) / 60.0 for t, _ in self._history]
        fills = [f for _, f in self._history]

        sum_t = sum(times_min)
        sum_f = sum(fills)
        sum_tf = sum(t * f for t, f in zip(times_min, fills))
        sum_t2 = sum(t * t for t in times_min)

        denom = (n * sum_t2) - (sum_t * sum_t)
        if abs(denom) < 1e-9:
            velocity = 0.0
        else:
            velocity = ((n * sum_tf) - (sum_t * sum_f)) / denom

        # Calculate stockout ETA if depleting and current fill is above critical threshold
        stockout_eta: Optional[float] = None
        # Must have noticeable negative velocity (e.g. faster than -0.1% per min)
        if velocity <= -0.1 and fill > self.critical_threshold:
            remaining_fill = fill - self.critical_threshold
            rate = abs(velocity)
            calculated_eta = remaining_fill / rate
            stockout_eta = round(calculated_eta, 1)

        is_rapid = velocity <= -self.rapid_threshold
        is_restock = velocity >= 5.0

        res = VelocityResult(
            velocity_pct_per_min=round(velocity, 2),
            stockout_eta_minutes=stockout_eta,
            is_rapid_depletion=is_rapid,
            is_restocking=is_restock,
            current_fill=fill,
            sample_count=n,
        )
        self._last_result = res
        return res

    def reset(self) -> None:
        """Clear all historical samples."""
        self._history.clear()
        self._last_result = None

    @property
    def window_stats(self) -> Dict[str, Any]:
        """Diagnostic state summary for health reports."""
        return {
            'window_size': self.window_size,
            'sample_count': len(self._history),
            'min_samples': self.min_samples,
            'rapid_threshold': self.rapid_threshold,
            'critical_threshold': self.critical_threshold,
            'last_result': self._last_result.to_dict() if self._last_result else None,
        }
