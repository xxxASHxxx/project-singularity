"""Unit tests for chaos network failure simulation."""
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
import main


def _sample_payload():
    return {
        'deviceId': 'test-chaos-node',
        'timestamp': '2026-10-13T10:00:00Z',
        'zoneOccupancyCount': 2,
        'shelfFillRatio': 75.0,
        'surgeFlag': False,
        'lowStockFlag': False,
    }


class TestChaosSimulation:
    """Test suite for chaos network drop simulation."""

    def test_post_telemetry_no_chaos(self, tmp_path):
        payload = _sample_payload()
        fake_dlq = tmp_path / 'failed.jsonl'

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {'eventId': 1}
        mock_resp.raise_for_status = MagicMock()

        with patch.object(main, 'FAILED_LOG', fake_dlq):
            with patch('requests.post', return_value=mock_resp):
                res = main.post_telemetry(payload, 'http://mock-api:8080', chaos_rate=0.0)

        assert res == {'eventId': 1}
        assert not fake_dlq.exists()

    def test_post_telemetry_guaranteed_chaos_drop(self, tmp_path):
        payload = _sample_payload()
        fake_dlq = tmp_path / 'failed.jsonl'

        with patch.object(main, 'FAILED_LOG', fake_dlq):
            res = main.post_telemetry(payload, 'http://mock-api:8080', chaos_rate=1.0)

        assert res is None
        assert fake_dlq.exists()
        lines = fake_dlq.read_text(encoding='utf-8').strip().splitlines()
        assert len(lines) == 1
        saved = json.loads(lines[0])
        assert saved['deviceId'] == 'test-chaos-node'

    def test_post_telemetry_chaos_probabilistic(self, tmp_path):
        payload = _sample_payload()
        fake_dlq = tmp_path / 'failed.jsonl'

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {'eventId': 2}
        mock_resp.raise_for_status = MagicMock()

        # When random returns 0.2 (< 0.5), it should drop
        with patch.object(main, 'FAILED_LOG', fake_dlq):
            with patch('random.random', return_value=0.2):
                res_dropped = main.post_telemetry(payload, 'http://mock-api:8080', chaos_rate=0.5)
        assert res_dropped is None

        # When random returns 0.8 (>= 0.5), it should post normally
        with patch.object(main, 'FAILED_LOG', fake_dlq):
            with patch('random.random', return_value=0.8):
                with patch('requests.post', return_value=mock_resp):
                    res_sent = main.post_telemetry(payload, 'http://mock-api:8080', chaos_rate=0.5)
        assert res_sent == {'eventId': 2}
