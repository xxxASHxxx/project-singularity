"""Telemetry session statistics tracker.

Tracks cumulative statistics across the edge node's telemetry session:
- Total payloads sent successfully
- Total payloads failed (buffered to DLQ)
- Min/max/avg values for occupancy and fill ratio
- Session duration
- Throughput (payloads per minute)
"""
import datetime
import time
from dataclasses import dataclass, field
from typing import Any, Dict, Optional


@dataclass
class TelemetrySessionStats:
    """Accumulates telemetry statistics for the current edge node session."""

    start_time: float = field(default_factory=time.time)
    total_sent: int = 0
    total_failed: int = 0
    total_bytes_sent: int = 0

    # Occupancy stats
    occ_min: Optional[int] = None
    occ_max: Optional[int] = None
    occ_sum: int = 0

    # Fill ratio stats
    fill_min: Optional[float] = None
    fill_max: Optional[float] = None
    fill_sum: float = 0.0

    # Alert counts
    surge_count: int = 0
    low_stock_count: int = 0

    def record_success(self, payload: Dict[str, Any], payload_bytes: int = 0) -> None:
        """Record a successful telemetry submission."""
        self.total_sent += 1
        self.total_bytes_sent += payload_bytes

        occ = payload.get('zoneOccupancyCount', 0)
        fill = payload.get('shelfFillRatio', 0.0)

        # Occupancy tracking
        if self.occ_min is None or occ < self.occ_min:
            self.occ_min = occ
        if self.occ_max is None or occ > self.occ_max:
            self.occ_max = occ
        self.occ_sum += occ

        # Fill ratio tracking
        if self.fill_min is None or fill < self.fill_min:
            self.fill_min = fill
        if self.fill_max is None or fill > self.fill_max:
            self.fill_max = fill
        self.fill_sum += fill

        # Alert counting
        if payload.get('surgeFlag'):
            self.surge_count += 1
        if payload.get('lowStockFlag'):
            self.low_stock_count += 1

    def record_failure(self) -> None:
        """Record a failed telemetry submission (buffered to DLQ)."""
        self.total_failed += 1

    @property
    def session_duration_seconds(self) -> float:
        """Elapsed seconds since session start."""
        return time.time() - self.start_time

    @property
    def total_samples(self) -> int:
        """Total samples processed (sent + failed)."""
        return self.total_sent + self.total_failed

    @property
    def success_rate(self) -> float:
        """Percentage of successfully sent payloads."""
        if self.total_samples == 0:
            return 100.0
        return round((self.total_sent / self.total_samples) * 100, 1)

    @property
    def throughput_per_minute(self) -> float:
        """Average payloads per minute."""
        duration_min = self.session_duration_seconds / 60
        if duration_min <= 0:
            return 0.0
        return round(self.total_sent / duration_min, 2)

    @property
    def avg_occupancy(self) -> Optional[float]:
        """Average zone occupancy across all samples."""
        if self.total_sent == 0:
            return None
        return round(self.occ_sum / self.total_sent, 2)

    @property
    def avg_fill_ratio(self) -> Optional[float]:
        """Average shelf fill ratio across all samples."""
        if self.total_sent == 0:
            return None
        return round(self.fill_sum / self.total_sent, 2)

    def to_dict(self) -> Dict[str, Any]:
        """Export session stats as a serializable dictionary."""
        duration = self.session_duration_seconds
        h = int(duration // 3600)
        m = int((duration % 3600) // 60)
        s = int(duration % 60)

        return {
            'session_duration': f"{h}h {m}m {s}s" if h > 0 else f"{m}m {s}s",
            'session_duration_seconds': round(duration, 1),
            'total_sent': self.total_sent,
            'total_failed': self.total_failed,
            'success_rate': f"{self.success_rate}%",
            'throughput_per_minute': self.throughput_per_minute,
            'total_bytes_sent': self.total_bytes_sent,
            'occupancy': {
                'min': self.occ_min,
                'max': self.occ_max,
                'avg': self.avg_occupancy,
            },
            'fill_ratio': {
                'min': self.fill_min,
                'max': self.fill_max,
                'avg': self.avg_fill_ratio,
            },
            'alerts': {
                'surge_events': self.surge_count,
                'low_stock_events': self.low_stock_count,
            },
            'started_at': datetime.datetime.fromtimestamp(
                self.start_time, tz=datetime.timezone.utc
            ).isoformat().replace('+00:00', 'Z'),
        }

    def __str__(self) -> str:
        """Human-readable session summary."""
        d = self.to_dict()
        return (
            f"Session Stats: {d['session_duration']} | "
            f"sent={self.total_sent} failed={self.total_failed} ({self.success_rate}%) | "
            f"throughput={self.throughput_per_minute}/min | "
            f"occ=[{self.occ_min}-{self.occ_max}] fill=[{self.fill_min}-{self.fill_max}] | "
            f"surges={self.surge_count} low_stock={self.low_stock_count}"
        )
