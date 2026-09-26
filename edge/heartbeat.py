"""Edge Node Heartbeat Monitor.

Tracks API connectivity health with graduated alert levels.
When consecutive failures exceed thresholds, the alert level escalates
from INFO → WARNING → CRITICAL. On recovery, logs the total downtime.
"""
import logging
import time
from dataclasses import dataclass, field
from typing import Optional

log = logging.getLogger('edge.heartbeat')


@dataclass
class HeartbeatMonitor:
    """Monitors API connectivity and escalates alerts on sustained failures.

    Alert levels:
        - HEALTHY:  API is responding normally
        - DEGRADED: 3+ consecutive failures (WARNING)
        - CRITICAL: 10+ consecutive failures (CRITICAL)

    On recovery from DEGRADED or CRITICAL, logs total downtime duration.
    """

    degraded_threshold: int = 3
    critical_threshold: int = 10

    # Internal state
    consecutive_failures: int = field(default=0, repr=False)
    consecutive_successes: int = field(default=0, repr=False)
    total_failures: int = field(default=0, repr=False)
    total_successes: int = field(default=0, repr=False)
    _failure_start_time: Optional[float] = field(default=None, repr=False)
    _last_recovery_downtime: Optional[float] = field(default=None, repr=False)

    @property
    def status(self) -> str:
        """Current health status string."""
        if self.consecutive_failures >= self.critical_threshold:
            return 'CRITICAL'
        elif self.consecutive_failures >= self.degraded_threshold:
            return 'DEGRADED'
        return 'HEALTHY'

    @property
    def is_healthy(self) -> bool:
        return self.consecutive_failures == 0

    @property
    def uptime_ratio(self) -> float:
        """Ratio of successes to total checks (0.0 to 1.0)."""
        total = self.total_successes + self.total_failures
        if total == 0:
            return 1.0
        return round(self.total_successes / total, 4)

    @property
    def last_recovery_downtime_seconds(self) -> Optional[float]:
        """Duration of the most recent downtime episode, or None."""
        return self._last_recovery_downtime

    def record_success(self) -> None:
        """Record a successful API interaction."""
        was_down = self.consecutive_failures > 0
        prev_failures = self.consecutive_failures

        self.consecutive_successes += 1
        self.total_successes += 1
        self.consecutive_failures = 0

        if was_down and self._failure_start_time is not None:
            downtime = time.time() - self._failure_start_time
            self._last_recovery_downtime = round(downtime, 1)
            self._failure_start_time = None

            downtime_str = self._format_duration(downtime)
            log.info(
                f"API RECOVERED after {prev_failures} consecutive failures "
                f"(downtime: {downtime_str})"
            )

    def record_failure(self) -> None:
        """Record a failed API interaction and escalate alerts."""
        if self.consecutive_failures == 0:
            self._failure_start_time = time.time()

        self.consecutive_failures += 1
        self.total_failures += 1
        self.consecutive_successes = 0

        if self.consecutive_failures == self.critical_threshold:
            log.critical(
                f"API CRITICAL: {self.consecutive_failures} consecutive failures — "
                f"edge node is operating in full offline/DLQ mode"
            )
        elif self.consecutive_failures == self.degraded_threshold:
            log.warning(
                f"API DEGRADED: {self.consecutive_failures} consecutive failures — "
                f"connectivity appears unstable"
            )
        elif self.consecutive_failures > self.critical_threshold and self.consecutive_failures % 10 == 0:
            # Periodic reminder every 10 failures after going critical
            elapsed = time.time() - (self._failure_start_time or time.time())
            log.critical(
                f"API still unreachable: {self.consecutive_failures} failures "
                f"over {self._format_duration(elapsed)}"
            )

    def to_dict(self) -> dict:
        """Export current state as a serializable dict."""
        return {
            'status': self.status,
            'consecutive_failures': self.consecutive_failures,
            'consecutive_successes': self.consecutive_successes,
            'total_successes': self.total_successes,
            'total_failures': self.total_failures,
            'uptime_ratio': self.uptime_ratio,
            'last_recovery_downtime_seconds': self._last_recovery_downtime,
        }

    @staticmethod
    def _format_duration(seconds: float) -> str:
        """Format seconds into a human-readable string."""
        if seconds < 60:
            return f"{seconds:.1f}s"
        m = int(seconds // 60)
        s = int(seconds % 60)
        if m < 60:
            return f"{m}m {s}s"
        h = int(m // 60)
        return f"{h}h {m % 60}m"

    def __str__(self) -> str:
        return (
            f"Heartbeat[{self.status}] "
            f"failures={self.consecutive_failures} "
            f"uptime={self.uptime_ratio:.1%}"
        )
