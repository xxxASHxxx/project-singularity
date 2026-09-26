"""Tests for the preflight health check feature."""
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from main import preflight_health_check


def test_preflight_health_check_success():
    """Health check returns True when the API responds with 200."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()

    with patch('requests.get', return_value=mock_resp) as mock_get:
        result = preflight_health_check("http://mock-api:8080", max_attempts=1, timeout=2)
        assert result['reachable'] is True
        mock_get.assert_called_once()


def test_preflight_health_check_failure_all_retries():
    """Health check returns False after exhausting all retry attempts."""
    import requests as req

    with patch('requests.get', side_effect=req.ConnectionError("Connection refused")):
        # max_attempts=2 so it retries once then gives up
        result = preflight_health_check("http://unreachable:8080", max_attempts=2, timeout=1)
        assert result['reachable'] is False


def test_preflight_health_check_recovers_on_retry():
    """Health check succeeds on second attempt after first failure."""
    import requests as req

    mock_success = MagicMock()
    mock_success.status_code = 200
    mock_success.raise_for_status = MagicMock()

    with patch('requests.get', side_effect=[req.ConnectionError("fail"), mock_success]):
        result = preflight_health_check("http://mock-api:8080", max_attempts=3, timeout=1)
        assert result['reachable'] is True
