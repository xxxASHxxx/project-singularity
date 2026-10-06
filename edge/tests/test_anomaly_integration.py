"""Tests for anomaly detector integration in the telemetry pipeline."""
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from detectors import AnomalyDetector, AnomalyResult
from main import run_diagnostics


# ── AnomalyDetector pipeline integration ─────────────────────────────────────

class TestAnomalyInPipeline:
    """Verify anomaly detection produces correct results on mock-like payloads."""

    def _make_payload(self, occupancy: int, fill: float) -> dict:
        return {
            'deviceId': 'test-node',
            'timestamp': '2026-10-06T12:00:00Z',
            'zoneOccupancyCount': occupancy,
            'shelfFillRatio': fill,
            'surgeFlag': occupancy >= 4,
            'lowStockFlag': fill <= 20.0,
        }

    def test_warmup_period_no_false_positives(self):
        """No anomalies should fire during the cold-start window."""
        detector = AnomalyDetector(window_size=10, min_samples=5)
        results = []
        for i in range(4):  # less than min_samples
            r = detector.ingest(self._make_payload(2, 80.0))
            results.append(r)

        assert all(not r.has_anomaly for r in results)
        assert detector.total_anomalies == 0

    def test_spike_detected_after_warmup(self):
        """A sudden occupancy spike should be flagged after warmup."""
        detector = AnomalyDetector(window_size=10, z_threshold=2.0, min_samples=5)

        # Warm up with stable low occupancy
        for _ in range(8):
            detector.ingest(self._make_payload(2, 80.0))

        # Inject a spike
        result = detector.ingest(self._make_payload(15, 80.0))
        assert result.has_anomaly is True
        assert result.occupancy_anomaly is True
        assert result.occupancy_z_score is not None
        assert result.occupancy_z_score > 2.0

    def test_fill_drop_detected(self):
        """A sudden fill ratio drop should be flagged."""
        detector = AnomalyDetector(window_size=10, z_threshold=2.0, min_samples=5)

        # Stable fill ratio
        for _ in range(8):
            detector.ingest(self._make_payload(3, 80.0))

        # Sharp drop
        result = detector.ingest(self._make_payload(3, 10.0))
        assert result.has_anomaly is True
        assert result.fill_anomaly is True

    def test_mock_sequence_fires_anomaly(self):
        """Running the actual mock sequence through the detector should catch
        the rapid fill-ratio decline pattern."""
        from mock_data import MOCK_SEQUENCE

        detector = AnomalyDetector(window_size=10, z_threshold=1.5, min_samples=5)
        anomaly_count = 0

        for occ, fill in MOCK_SEQUENCE:
            result = detector.ingest(self._make_payload(occ, fill))
            if result.has_anomaly:
                anomaly_count += 1

        # The mock sequence has a big drop from 72% -> 45% -> 30% -> 18%
        # At least one of those should trigger
        assert anomaly_count > 0
        assert detector.total_anomalies == anomaly_count

    def test_anomaly_result_serialization(self):
        """AnomalyResult.to_dict() produces valid JSON-serializable output."""
        detector = AnomalyDetector(window_size=5, min_samples=3)

        for _ in range(4):
            detector.ingest(self._make_payload(3, 80.0))

        result = detector.ingest(self._make_payload(3, 80.0))
        d = result.to_dict()

        # Should be JSON-serializable
        serialized = json.dumps(d)
        parsed = json.loads(serialized)
        assert 'has_anomaly' in parsed
        assert 'occupancy_z_score' in parsed
        assert 'fill_z_score' in parsed

    def test_window_stats_after_ingestion(self):
        """window_stats should reflect ingested sample counts."""
        detector = AnomalyDetector(window_size=20)

        for i in range(10):
            detector.ingest(self._make_payload(i, 90.0 - i * 2))

        stats = detector.window_stats
        assert stats['total_ingested'] == 10
        assert stats['occupancy']['count'] == 10
        assert stats['fill_ratio']['count'] == 10
        assert stats['occupancy']['min'] == 0
        assert stats['occupancy']['max'] == 9

    def test_stable_readings_no_anomalies(self):
        """Perfectly stable readings should never trigger anomalies."""
        detector = AnomalyDetector(window_size=10, min_samples=5)

        for _ in range(20):
            result = detector.ingest(self._make_payload(3, 75.0))

        assert detector.total_anomalies == 0


# ── Diagnostics report ────────────────────────────────────────────────────────

class TestDiagnostics:
    """Verify the --diagnostics output structure."""

    def test_diagnostics_report_structure(self):
        """run_diagnostics() should return all expected subsystem keys."""
        report = run_diagnostics()

        assert 'version' in report
        assert 'generated_at' in report
        assert 'system' in report
        assert 'python_version' in report['system']
        assert 'platform' in report['system']
        assert 'hostname' in report['system']

        # Subsystems
        assert 'dlq' in report
        assert 'heartbeat' in report
        assert 'anomaly_detector' in report
        assert 'logging' in report
        assert 'note' in report

    def test_diagnostics_is_json_serializable(self):
        """The whole diagnostics report should serialize cleanly."""
        report = run_diagnostics()
        serialized = json.dumps(report, indent=2)
        parsed = json.loads(serialized)
        assert parsed['version'] == report['version']

    def test_diagnostics_does_not_hit_network(self):
        """Diagnostics should work even when the network is down."""
        import requests

        # Patch requests.get to raise — diagnostics should never call it
        with patch('requests.get', side_effect=requests.ConnectionError("no network")):
            report = run_diagnostics()

        # If we got here without an exception, it didn't hit the network
        assert report['note'] == 'offline diagnostics — no API health check performed'

    def test_diagnostics_heartbeat_defaults(self):
        """Heartbeat section in diagnostics should show HEALTHY defaults."""
        report = run_diagnostics()
        hb = report['heartbeat']
        assert hb['status'] == 'HEALTHY'
        assert hb['consecutive_failures'] == 0
        assert hb['uptime_ratio'] == 1.0

    def test_diagnostics_anomaly_detector_defaults(self):
        """Anomaly detector section should show zero-state defaults."""
        report = run_diagnostics()
        ad = report['anomaly_detector']
        assert ad['total_ingested'] == 0
        assert ad['total_anomalies'] == 0
        assert ad['anomaly_rate'] == '0.0%'

    def test_diagnostics_logging_section(self):
        """Logging section should report the format and handlers."""
        report = run_diagnostics()
        log_cfg = report['logging']
        assert 'format' in log_cfg
        assert 'level' in log_cfg
        assert 'handlers' in log_cfg
