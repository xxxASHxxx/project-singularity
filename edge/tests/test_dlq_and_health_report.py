"""Tests for DLQ age stats, auto-purge, and enhanced health check report."""
import datetime
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from main import get_dlq_age_stats, purge_old_dlq_entries, preflight_health_check, generate_health_report


# ── DLQ Age Stats ─────────────────────────────────────────────────────────────

def test_dlq_age_stats_empty_file(tmp_path):
    """Returns zero stats when DLQ file doesn't exist."""
    stats = get_dlq_age_stats(log_path=tmp_path / "nonexistent.jsonl")
    assert stats['count'] == 0
    assert stats['oldest'] is None
    assert stats['newest'] is None
    assert stats['total_bytes'] == 0


def test_dlq_age_stats_with_entries(tmp_path):
    """Correctly identifies oldest and newest timestamps."""
    dlq = tmp_path / "failed.jsonl"
    entries = [
        {"deviceId": "e1", "timestamp": "2026-09-20T10:00:00Z", "zoneOccupancyCount": 3, "shelfFillRatio": 50},
        {"deviceId": "e1", "timestamp": "2026-09-22T10:00:00Z", "zoneOccupancyCount": 5, "shelfFillRatio": 30},
        {"deviceId": "e1", "timestamp": "2026-09-21T10:00:00Z", "zoneOccupancyCount": 2, "shelfFillRatio": 70},
    ]
    with open(dlq, 'w') as f:
        for e in entries:
            f.write(json.dumps(e) + '\n')

    stats = get_dlq_age_stats(log_path=dlq)
    assert stats['count'] == 3
    assert stats['oldest'] == "2026-09-20T10:00:00Z"
    assert stats['newest'] == "2026-09-22T10:00:00Z"
    assert stats['total_bytes'] > 0


def test_dlq_age_stats_handles_malformed_json(tmp_path):
    """Gracefully skips malformed JSON lines."""
    dlq = tmp_path / "failed.jsonl"
    with open(dlq, 'w') as f:
        f.write('{"timestamp": "2026-09-20T10:00:00Z"}\n')
        f.write('not valid json\n')
        f.write('{"timestamp": "2026-09-21T10:00:00Z"}\n')

    stats = get_dlq_age_stats(log_path=dlq)
    assert stats['count'] == 3  # counts all non-empty lines
    assert stats['oldest'] == "2026-09-20T10:00:00Z"
    assert stats['newest'] == "2026-09-21T10:00:00Z"


# ── DLQ Purge ─────────────────────────────────────────────────────────────────

def test_purge_removes_old_entries(tmp_path):
    """Purge removes entries older than the cutoff."""
    dlq = tmp_path / "failed.jsonl"
    old_ts = "2026-09-01T10:00:00Z"  # very old
    recent_ts = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')

    entries = [
        {"deviceId": "e1", "timestamp": old_ts, "zoneOccupancyCount": 3, "shelfFillRatio": 50},
        {"deviceId": "e1", "timestamp": recent_ts, "zoneOccupancyCount": 5, "shelfFillRatio": 30},
    ]
    with open(dlq, 'w') as f:
        for e in entries:
            f.write(json.dumps(e) + '\n')

    purged = purge_old_dlq_entries(max_age_hours=24, log_path=dlq)
    assert purged == 1

    # Verify remaining
    with open(dlq, 'r') as f:
        remaining = [line.strip() for line in f if line.strip()]
    assert len(remaining) == 1
    assert json.loads(remaining[0])['timestamp'] == recent_ts


def test_purge_no_old_entries(tmp_path):
    """Purge returns 0 when all entries are recent."""
    dlq = tmp_path / "failed.jsonl"
    recent_ts = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')

    with open(dlq, 'w') as f:
        f.write(json.dumps({"timestamp": recent_ts}) + '\n')

    purged = purge_old_dlq_entries(max_age_hours=24, log_path=dlq)
    assert purged == 0


def test_purge_empty_file(tmp_path):
    """Purge handles non-existent file gracefully."""
    purged = purge_old_dlq_entries(max_age_hours=24, log_path=tmp_path / "nope.jsonl")
    assert purged == 0


# ── Enhanced Health Check (returns dict) ──────────────────────────────────────

def test_health_check_returns_report_dict():
    """Health check now returns a structured report dict, not a bool."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()

    with patch('requests.get', return_value=mock_resp):
        report = preflight_health_check("http://mock-api:8080", max_attempts=1, timeout=2)

    assert isinstance(report, dict)
    assert report['reachable'] is True
    assert report['status_code'] == 200
    assert report['attempts_used'] == 1
    assert len(report['latencies_ms']) == 1
    assert report['avg_latency_ms'] is not None
    assert report['avg_latency_ms'] >= 0


def test_health_check_failure_returns_report():
    """Failed health check returns a report with reachable=False."""
    import requests as req

    with patch('requests.get', side_effect=req.ConnectionError("Connection refused")):
        report = preflight_health_check("http://unreachable:8080", max_attempts=2, timeout=1)

    assert isinstance(report, dict)
    assert report['reachable'] is False
    assert report['attempts_used'] == 2
    assert len(report['latencies_ms']) == 2
    assert report['status_code'] is None


def test_health_check_latency_tracked_on_retry():
    """Health check tracks latency for both failed and successful attempts."""
    import requests as req

    mock_success = MagicMock()
    mock_success.status_code = 200
    mock_success.raise_for_status = MagicMock()

    with patch('requests.get', side_effect=[req.ConnectionError("fail"), mock_success]):
        report = preflight_health_check("http://mock-api:8080", max_attempts=3, timeout=1)

    assert report['reachable'] is True
    assert report['attempts_used'] == 2
    assert len(report['latencies_ms']) == 2  # one fail + one success


# ── Health Report ─────────────────────────────────────────────────────────────

def test_generate_health_report_structure():
    """generate_health_report returns a well-structured diagnostic report."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()

    with patch('requests.get', return_value=mock_resp):
        report = generate_health_report("http://mock-api:8080", timeout=2)

    assert 'version' in report
    assert 'generated_at' in report
    assert 'system' in report
    assert 'python_version' in report['system']
    assert 'platform' in report['system']
    assert 'hostname' in report['system']
    assert 'api_health' in report
    assert report['api_health']['reachable'] is True
    assert 'dlq' in report
    assert 'count' in report['dlq']
