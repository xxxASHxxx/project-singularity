"""Anomaly detector using z-score spike detection and trend analysis.

Watches telemetry streams over a configurable sliding window and flags
statistical outliers — occupancy spikes that don't match recent patterns,
or fill-ratio drops that are steeper than normal variance.

This complements the existing threshold-based alerts (surge_flag, low_stock_flag)
by catching *unusual patterns* even when hard thresholds aren't crossed.

Example:
    detector = AnomalyDetector(window_size=30, z_threshold=2.0)
    for payload in telemetry_stream:
        result = detector.ingest(payload)
        if result.has_anomaly:
            log.warning(f"Anomaly: {result}")
"""
import math
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class AnomalyResult:
    """Result of anomaly detection for a single telemetry sample."""

    has_anomaly: bool = False
    occupancy_z_score: Optional[float] = None
    fill_z_score: Optional[float] = None
    occupancy_anomaly: bool = False
    occupancy_drop_anomaly: bool = False
    fill_anomaly: bool = False
    trend_direction: Optional[str] = None  # 'declining', 'rising', 'stable'
    trend_slope: Optional[float] = None
    timestamp: Optional[str] = None
    confidence_score: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to a JSON-safe dictionary."""
        return {
            'has_anomaly': self.has_anomaly,
            'occupancy_z_score': self.occupancy_z_score,
            'fill_z_score': self.fill_z_score,
            'occupancy_anomaly': self.occupancy_anomaly,
            'occupancy_drop_anomaly': self.occupancy_drop_anomaly,
            'fill_anomaly': self.fill_anomaly,
            'trend_direction': self.trend_direction,
            'trend_slope': self.trend_slope,
            'timestamp': self.timestamp,
            'confidence_score': round(self.confidence_score, 3),
        }

    def __str__(self) -> str:
        parts = []
        if self.occupancy_anomaly:
            parts.append(f"occupancy_z={self.occupancy_z_score:+.2f}")
        if self.occupancy_drop_anomaly:
            parts.append(f"occupancy_drop_z={self.occupancy_z_score:+.2f}")
        if self.fill_anomaly:
            parts.append(f"fill_z={self.fill_z_score:+.2f}")
        if self.trend_direction and self.trend_direction != 'stable':
            parts.append(f"trend={self.trend_direction}(slope={self.trend_slope:.3f})")
        
        base = f"Anomaly[{', '.join(parts)}]" if parts else "Anomaly[none]"
        if self.has_anomaly:
            base += f" (conf={self.confidence_score:.2f})"
        return base


class AnomalyDetector:
    """Sliding-window z-score anomaly detector for telemetry streams.

    Maintains rolling statistics for occupancy count and shelf fill ratio.
    When a new sample's z-score exceeds the configured threshold, it is
    flagged as anomalous. Also computes a simple linear trend over the
    fill-ratio window to detect sustained decline patterns.

    Args:
        window_size: Number of samples in the sliding window (default: 30).
        z_threshold: Z-score threshold for flagging anomalies (default: 2.0).
            Higher values = fewer, more extreme anomalies flagged.
        min_samples: Minimum samples needed before anomaly detection activates
            (default: 5). Prevents false positives during cold start.
        trend_decline_threshold: Slope threshold below which a fill-ratio
            trend is flagged as 'declining' (default: -1.0 %/sample).
    """

    def __init__(
        self,
        window_size: int = 30,
        z_threshold: float = 2.0,
        min_samples: int = 5,
        trend_decline_threshold: float = -1.0,
        cooldown_samples: int = 5,
    ):
        if window_size < 3:
            raise ValueError("window_size must be at least 3")
        if z_threshold <= 0:
            raise ValueError("z_threshold must be positive")
        if min_samples < 2:
            raise ValueError("min_samples must be at least 2")
        if cooldown_samples < 0:
            raise ValueError("cooldown_samples must be non-negative")

        self.window_size = window_size
        self.z_threshold = z_threshold
        self.min_samples = min_samples
        self.trend_decline_threshold = trend_decline_threshold
        self.cooldown_samples = cooldown_samples

        self._occupancy_window: deque = deque(maxlen=window_size)
        self._fill_window: deque = deque(maxlen=window_size)

        # Cumulative counters
        self.total_ingested: int = 0
        self.total_anomalies: int = 0
        self._anomaly_timestamps: List[str] = []
        self._start_time: float = time.time()
        self._samples_since_last_anomaly: int = cooldown_samples

    def ingest(self, payload: Dict[str, Any]) -> AnomalyResult:
        """Process a telemetry payload and return anomaly detection result.

        Args:
            payload: Telemetry dict with keys 'zoneOccupancyCount',
                'shelfFillRatio', and optionally 'timestamp'.

        Returns:
            AnomalyResult with z-scores and anomaly flags.
        """
        occupancy = payload.get('zoneOccupancyCount', 0)
        fill = payload.get('shelfFillRatio', 0.0)
        timestamp = payload.get('timestamp')

        result = AnomalyResult(timestamp=timestamp)

        # Compute z-scores against the current window BEFORE adding the new sample
        if len(self._occupancy_window) >= self.min_samples:
            occ_z = self._z_score(occupancy, self._occupancy_window)
            fill_z = self._z_score(fill, self._fill_window)

            result.occupancy_z_score = round(occ_z, 3) if occ_z is not None else None
            result.fill_z_score = round(fill_z, 3) if fill_z is not None else None

            # Flag anomalies: occupancy spike UP/DOWN or fill drop DOWN
            if occ_z is not None:
                if occ_z > self.z_threshold:
                    result.occupancy_anomaly = True
                elif occ_z < -self.z_threshold:
                    result.occupancy_drop_anomaly = True
            if fill_z is not None and fill_z < -self.z_threshold:
                result.fill_anomaly = True

            # Trend analysis on fill ratio
            slope = self._linear_slope(list(self._fill_window) + [fill])
            if slope is not None:
                result.trend_slope = round(slope, 4)
                if slope <= self.trend_decline_threshold:
                    result.trend_direction = 'declining'
                elif slope >= abs(self.trend_decline_threshold):
                    result.trend_direction = 'rising'
                else:
                    result.trend_direction = 'stable'

        # Now add the sample to the window
        self._occupancy_window.append(occupancy)
        self._fill_window.append(fill)
        self.total_ingested += 1

        # Determine overall anomaly flag
        raw_has_anomaly = result.occupancy_anomaly or result.occupancy_drop_anomaly or result.fill_anomaly
        if raw_has_anomaly:
            z_scores = [abs(z) for z in (result.occupancy_z_score, result.fill_z_score) if z is not None]
            max_z = max(z_scores) if z_scores else 0
            result.confidence_score = min(1.0, (max_z - self.z_threshold) / self.z_threshold) if max_z > self.z_threshold else 0.0

            if self._samples_since_last_anomaly >= self.cooldown_samples:
                result.has_anomaly = True
                self.total_anomalies += 1
                self._samples_since_last_anomaly = 0
                if timestamp:
                    self._anomaly_timestamps.append(timestamp)
            else:
                result.has_anomaly = False
                self._samples_since_last_anomaly += 1
        else:
            self._samples_since_last_anomaly += 1

        return result

    @staticmethod
    def _z_score(value: float, window: deque) -> Optional[float]:
        """Compute z-score of value against the window's mean and stddev."""
        n = len(window)
        if n < 2:
            return None

        mean = sum(window) / n
        variance = sum((x - mean) ** 2 for x in window) / n
        stddev = math.sqrt(variance)

        if stddev == 0:
            # All values identical — any deviation is technically infinite.
            # Return directional sentinel so fill drops get negative z-scores.
            if value == mean:
                return 0.0
            return 10.0 if value > mean else -10.0

        return (value - mean) / stddev

    @staticmethod
    def _linear_slope(values: list) -> Optional[float]:
        """Compute the slope of a simple linear regression over indexed values.

        Uses least-squares fit: slope = Σ((xi - x̄)(yi - ȳ)) / Σ((xi - x̄)²)
        """
        n = len(values)
        if n < 3:
            return None

        x_mean = (n - 1) / 2.0
        y_mean = sum(values) / n

        numerator = sum((i - x_mean) * (y - y_mean) for i, y in enumerate(values))
        denominator = sum((i - x_mean) ** 2 for i in range(n))

        if denominator == 0:
            return 0.0

        return numerator / denominator

    @property
    def anomaly_rate(self) -> float:
        """Percentage of ingested samples that were anomalous."""
        if self.total_ingested == 0:
            return 0.0
        return round((self.total_anomalies / self.total_ingested) * 100, 2)

    @property
    def window_stats(self) -> Dict[str, Any]:
        """Current window statistics for diagnostics."""
        occ_list = list(self._occupancy_window)
        fill_list = list(self._fill_window)

        def _stats(values):
            if not values:
                return {'count': 0, 'mean': None, 'stddev': None, 'min': None, 'max': None}
            n = len(values)
            mean = sum(values) / n
            variance = sum((x - mean) ** 2 for x in values) / n
            return {
                'count': n,
                'mean': round(mean, 2),
                'stddev': round(math.sqrt(variance), 2),
                'min': min(values),
                'max': max(values),
            }

        return {
            'occupancy': _stats(occ_list),
            'fill_ratio': _stats(fill_list),
            'window_size': self.window_size,
            'total_ingested': self.total_ingested,
            'total_anomalies': self.total_anomalies,
            'anomaly_rate': f"{self.anomaly_rate}%",
        }

    def reset(self) -> None:
        """Clear all state and start fresh."""
        self._occupancy_window.clear()
        self._fill_window.clear()
        self.total_ingested = 0
        self.total_anomalies = 0
        self._anomaly_timestamps.clear()
        self._start_time = time.time()
        self._samples_since_last_anomaly = self.cooldown_samples

    def __str__(self) -> str:
        return (
            f"AnomalyDetector[window={self.window_size} z={self.z_threshold} "
            f"ingested={self.total_ingested} anomalies={self.total_anomalies} "
            f"rate={self.anomaly_rate}%]"
        )
