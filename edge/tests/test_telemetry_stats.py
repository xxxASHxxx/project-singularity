"""Tests for TelemetrySessionStats tracker."""
import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from telemetry_stats import TelemetrySessionStats


def _make_payload(occ=3, fill=50.0, surge=False, low_stock=False, anomaly=False):
    return {
        'deviceId': 'test-node',
        'timestamp': '2026-09-25T10:00:00Z',
        'zoneOccupancyCount': occ,
        'shelfFillRatio': fill,
        'surgeFlag': surge,
        'lowStockFlag': low_stock,
        'anomalyFlag': anomaly,
    }


class TestTelemetrySessionStats:
    """Tests for the TelemetrySessionStats dataclass."""

    def test_initial_state(self):
        stats = TelemetrySessionStats()
        assert stats.total_sent == 0
        assert stats.total_failed == 0
        assert stats.total_samples == 0
        assert stats.success_rate == 100.0
        assert stats.avg_occupancy is None
        assert stats.avg_fill_ratio is None
        assert stats.anomaly_count == 0

    def test_record_success(self):
        stats = TelemetrySessionStats()
        payload = _make_payload(occ=5, fill=70.0)
        stats.record_success(payload, payload_bytes=120)

        assert stats.total_sent == 1
        assert stats.total_bytes_sent == 120
        assert stats.occ_min == 5
        assert stats.occ_max == 5
        assert stats.fill_min == 70.0
        assert stats.fill_max == 70.0
        assert stats.avg_occupancy == 5.0
        assert stats.avg_fill_ratio == 70.0

    def test_record_failure(self):
        stats = TelemetrySessionStats()
        stats.record_failure()
        assert stats.total_failed == 1
        assert stats.total_samples == 1
        assert stats.success_rate == 0.0

    def test_multiple_records_track_min_max(self):
        stats = TelemetrySessionStats()
        stats.record_success(_make_payload(occ=2, fill=80.0))
        stats.record_success(_make_payload(occ=8, fill=20.0))
        stats.record_success(_make_payload(occ=4, fill=50.0))

        assert stats.occ_min == 2
        assert stats.occ_max == 8
        assert stats.fill_min == 20.0
        assert stats.fill_max == 80.0
        assert stats.avg_occupancy == pytest.approx(4.67, abs=0.01)
        assert stats.avg_fill_ratio == 50.0

    def test_success_rate_mixed(self):
        stats = TelemetrySessionStats()
        stats.record_success(_make_payload())
        stats.record_success(_make_payload())
        stats.record_failure()

        assert stats.total_samples == 3
        assert stats.success_rate == pytest.approx(66.7, abs=0.1)

    def test_surge_and_low_stock_counting(self):
        stats = TelemetrySessionStats()
        stats.record_success(_make_payload(surge=True, low_stock=False, anomaly=False))
        stats.record_success(_make_payload(surge=True, low_stock=True, anomaly=True))
        stats.record_success(_make_payload(surge=False, low_stock=True, anomaly=True))
        stats.record_success(_make_payload(surge=False, low_stock=False, anomaly=False))

        assert stats.surge_count == 2
        assert stats.low_stock_count == 2
        assert stats.anomaly_count == 2

    def test_to_dict_structure(self):
        stats = TelemetrySessionStats()
        stats.record_success(_make_payload(occ=3, fill=60.0, anomaly=True))
        d = stats.to_dict()

        assert 'session_duration' in d
        assert 'session_duration_seconds' in d
        assert d['total_sent'] == 1
        assert d['total_failed'] == 0
        assert 'occupancy' in d
        assert d['occupancy']['min'] == 3
        assert d['occupancy']['max'] == 3
        assert d['occupancy']['avg'] == 3.0
        assert 'fill_ratio' in d
        assert d['fill_ratio']['min'] == 60.0
        assert 'alerts' in d
        assert d['alerts']['surge_events'] == 0
        assert d['alerts']['low_stock_events'] == 0
        assert d['alerts']['anomaly_events'] == 1
        assert 'started_at' in d

    def test_str_representation(self):
        stats = TelemetrySessionStats()
        stats.record_success(_make_payload(occ=5, fill=40.0, surge=True, anomaly=True))
        s = str(stats)
        assert 'Session Stats' in s
        assert 'sent=1' in s
        assert 'surges=1' in s
        assert 'anomalies=1' in s

    def test_throughput_calculation(self):
        stats = TelemetrySessionStats()
        # Manually set start_time to 60s ago
        stats.start_time = time.time() - 60
        for _ in range(12):
            stats.record_success(_make_payload())

        # 12 payloads in 60s = 12.0/min
        assert stats.throughput_per_minute == pytest.approx(12.0, abs=0.5)

    def test_session_duration(self):
        stats = TelemetrySessionStats()
        stats.start_time = time.time() - 120  # 2 minutes ago
        assert stats.session_duration_seconds >= 119  # allow small timing variance

    def test_record_velocity_tracking(self):
        from detectors.velocity_tracker import VelocityResult
        stats = TelemetrySessionStats()
        res1 = VelocityResult(velocity_pct_per_min=-4.5, stockout_eta_minutes=15.0, is_rapid_depletion=False)
        stats.record_velocity(res1)
        assert stats.latest_velocity == -4.5
        assert stats.latest_stockout_eta == 15.0
        assert stats.peak_depletion_velocity == 4.5
        assert stats.rapid_depletion_count == 0

        res2 = VelocityResult(velocity_pct_per_min=-12.0, stockout_eta_minutes=5.0, is_rapid_depletion=True)
        stats.record_velocity(res2)
        assert stats.latest_velocity == -12.0
        assert stats.latest_stockout_eta == 5.0
        assert stats.peak_depletion_velocity == 12.0
        assert stats.rapid_depletion_count == 1

        d = stats.to_dict()
        assert d['velocity']['latest_pct_per_min'] == -12.0
        assert d['velocity']['peak_depletion_pct_per_min'] == 12.0
        assert d['velocity']['rapid_depletion_events'] == 1
        assert d['velocity']['latest_stockout_eta_min'] == 5.0
        assert 'vel=-12.00%/min' in str(stats)

