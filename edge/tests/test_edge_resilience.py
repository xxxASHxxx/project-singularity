import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from main import OccupancyDebounce, get_failed_payloads_count, replay_failed_payloads


def test_occupancy_debounce_surge_trigger():
    debounce = OccupancyDebounce(surge_threshold=4, window=5)

    # First sample: count=4 -> smoothed=4, but only 1 consecutive surge -> surge_flag is False
    smoothed, surge = debounce.update(4)
    assert smoothed == 4
    assert surge is False

    # Second sample: count=4 -> 2 consecutive -> False
    smoothed, surge = debounce.update(4)
    assert surge is False

    # Third sample: count=5 -> 3 consecutive -> True!
    smoothed, surge = debounce.update(5)
    assert surge is True

    # Fourth sample: count=0 -> window has [4, 4, 5, 0], avg=3.25, smoothed=3 -> resets consecutive surge
    smoothed, surge = debounce.update(0)
    assert smoothed == 3
    assert surge is False


def test_get_failed_payloads_count(tmp_path):
    log_file = tmp_path / "test_failed.jsonl"
    assert get_failed_payloads_count(log_file) == 0

    log_file.write_text('{"deviceId":"n1"}\n{"deviceId":"n2"}\n', encoding='utf-8')
    assert get_failed_payloads_count(log_file) == 2


def test_replay_failed_payloads_success(tmp_path):
    log_file = tmp_path / "test_failed.jsonl"
    p1 = {"deviceId": "n1", "zoneOccupancyCount": 2}
    p2 = {"deviceId": "n2", "zoneOccupancyCount": 3}
    log_file.write_text(f"{json.dumps(p1)}\n{json.dumps(p2)}\n", encoding='utf-8')

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()

    with patch('requests.post', return_value=mock_resp) as mock_post:
        replayed = replay_failed_payloads("http://mock-api:8080", limit=10, log_path=log_file)
        assert replayed == 2
        assert mock_post.call_count == 2
        # File should now be empty
        assert get_failed_payloads_count(log_file) == 0


def test_replay_failed_payloads_partial_failure(tmp_path):
    log_file = tmp_path / "test_failed.jsonl"
    p1 = {"deviceId": "n1"}
    p2 = {"deviceId": "n2"}
    log_file.write_text(f"{json.dumps(p1)}\n{json.dumps(p2)}\n", encoding='utf-8')

    mock_success = MagicMock()
    mock_success.status_code = 200
    mock_success.raise_for_status = MagicMock()

    mock_fail = MagicMock()
    mock_fail.raise_for_status.side_effect = Exception("Connection refused")

    with patch('requests.post', side_effect=[mock_success, mock_fail]):
        replayed = replay_failed_payloads("http://mock-api:8080", limit=10, log_path=log_file)
        assert replayed == 1
        # 1 remaining in DLQ
        assert get_failed_payloads_count(log_file) == 1
        remaining_content = log_file.read_text(encoding='utf-8').strip()
        assert json.loads(remaining_content)["deviceId"] == "n2"
