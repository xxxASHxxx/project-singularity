"""Tests for the HeartbeatMonitor module."""
import sys
import os
import time
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from heartbeat import HeartbeatMonitor


class TestHeartbeatMonitorBasics:
    """Basic state tracking tests."""

    def test_initial_state_is_healthy(self):
        hb = HeartbeatMonitor()
        assert hb.status == 'HEALTHY'
        assert hb.is_healthy is True
        assert hb.consecutive_failures == 0
        assert hb.uptime_ratio == 1.0

    def test_success_increments_counters(self):
        hb = HeartbeatMonitor()
        hb.record_success()
        hb.record_success()
        assert hb.total_successes == 2
        assert hb.consecutive_successes == 2
        assert hb.is_healthy is True

    def test_failure_increments_counters(self):
        hb = HeartbeatMonitor()
        hb.record_failure()
        assert hb.total_failures == 1
        assert hb.consecutive_failures == 1
        assert hb.consecutive_successes == 0

    def test_success_resets_failure_streak(self):
        hb = HeartbeatMonitor()
        hb.record_failure()
        hb.record_failure()
        assert hb.consecutive_failures == 2
        hb.record_success()
        assert hb.consecutive_failures == 0
        assert hb.is_healthy is True


class TestAlertEscalation:
    """Tests for graduated alert levels."""

    def test_degraded_after_threshold(self):
        hb = HeartbeatMonitor(degraded_threshold=3)
        for _ in range(3):
            hb.record_failure()
        assert hb.status == 'DEGRADED'

    def test_critical_after_threshold(self):
        hb = HeartbeatMonitor(degraded_threshold=3, critical_threshold=10)
        for _ in range(10):
            hb.record_failure()
        assert hb.status == 'CRITICAL'

    def test_recovery_from_degraded(self):
        hb = HeartbeatMonitor(degraded_threshold=3)
        for _ in range(5):
            hb.record_failure()
        assert hb.status == 'DEGRADED'
        hb.record_success()
        assert hb.status == 'HEALTHY'

    def test_recovery_from_critical(self):
        hb = HeartbeatMonitor(degraded_threshold=3, critical_threshold=10)
        for _ in range(15):
            hb.record_failure()
        assert hb.status == 'CRITICAL'
        hb.record_success()
        assert hb.status == 'HEALTHY'

    def test_below_degraded_stays_healthy(self):
        hb = HeartbeatMonitor(degraded_threshold=3)
        hb.record_failure()
        hb.record_failure()
        assert hb.status == 'HEALTHY'


class TestDowntimeTracking:
    """Tests for recovery downtime measurement."""

    def test_downtime_recorded_on_recovery(self):
        hb = HeartbeatMonitor()
        hb._failure_start_time = time.time() - 30  # Simulate 30s of downtime
        hb.consecutive_failures = 5
        hb.record_success()
        assert hb.last_recovery_downtime_seconds is not None
        assert hb.last_recovery_downtime_seconds >= 29  # Allow small timing variance

    def test_no_downtime_when_always_healthy(self):
        hb = HeartbeatMonitor()
        hb.record_success()
        hb.record_success()
        assert hb.last_recovery_downtime_seconds is None


class TestUptimeRatio:
    """Tests for uptime ratio calculation."""

    def test_perfect_uptime(self):
        hb = HeartbeatMonitor()
        for _ in range(10):
            hb.record_success()
        assert hb.uptime_ratio == 1.0

    def test_zero_uptime(self):
        hb = HeartbeatMonitor()
        for _ in range(10):
            hb.record_failure()
        assert hb.uptime_ratio == 0.0

    def test_mixed_uptime(self):
        hb = HeartbeatMonitor()
        for _ in range(7):
            hb.record_success()
        for _ in range(3):
            hb.record_failure()
        assert hb.uptime_ratio == 0.7

    def test_empty_uptime(self):
        hb = HeartbeatMonitor()
        assert hb.uptime_ratio == 1.0


class TestSerialization:
    """Tests for to_dict() and __str__."""

    def test_to_dict_structure(self):
        hb = HeartbeatMonitor()
        hb.record_success()
        hb.record_failure()
        d = hb.to_dict()
        assert 'status' in d
        assert 'consecutive_failures' in d
        assert 'uptime_ratio' in d
        assert 'total_successes' in d
        assert 'total_failures' in d
        assert d['total_successes'] == 1
        assert d['total_failures'] == 1

    def test_str_contains_status(self):
        hb = HeartbeatMonitor()
        s = str(hb)
        assert 'HEALTHY' in s
        assert 'Heartbeat' in s

    def test_str_after_failures(self):
        hb = HeartbeatMonitor(degraded_threshold=2)
        hb.record_failure()
        hb.record_failure()
        s = str(hb)
        assert 'DEGRADED' in s


class TestFormatDuration:
    """Tests for the static duration formatter."""

    def test_seconds(self):
        assert HeartbeatMonitor._format_duration(45.3) == '45.3s'

    def test_minutes(self):
        assert HeartbeatMonitor._format_duration(125) == '2m 5s'

    def test_hours(self):
        assert HeartbeatMonitor._format_duration(3725) == '1h 2m'
