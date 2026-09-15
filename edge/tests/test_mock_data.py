import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from mock_data import MOCK_SEQUENCE, get_mock_sequence, validate_telemetry_payload


def test_mock_sequence_structure():
    assert len(MOCK_SEQUENCE) == 20
    for occ, fill in MOCK_SEQUENCE:
        assert isinstance(occ, int)
        assert 0 <= occ <= 10
        assert isinstance(fill, float)
        assert 0.0 <= fill <= 100.0


def test_mock_generator_defaults():
    gen = get_mock_sequence(device_id="test-sensor-42")
    first_payload = next(gen)
    assert first_payload["deviceId"] == "test-sensor-42"
    assert first_payload["zoneOccupancyCount"] == 1
    assert first_payload["shelfFillRatio"] == 85.0
    assert first_payload["surgeFlag"] is False
    assert first_payload["lowStockFlag"] is False
    assert first_payload["cycleCount"] == 0
    assert validate_telemetry_payload(first_payload) is True


def test_mock_generator_surge_and_low_stock_triggers():
    gen = get_mock_sequence()
    payloads = [next(gen) for _ in range(12)]

    # At t=25s (sample index 5), occupancy is 6 -> surgeFlag is True
    assert payloads[5]["zoneOccupancyCount"] == 6
    assert payloads[5]["surgeFlag"] is True

    # At t=40s (sample index 8), fill is 18.0 -> lowStockFlag is True
    assert payloads[8]["shelfFillRatio"] == 18.0
    assert payloads[8]["lowStockFlag"] is True


def test_mock_generator_jitter_deterministic():
    gen_jitter1 = get_mock_sequence(jitter=True, seed=123)
    gen_jitter2 = get_mock_sequence(jitter=True, seed=123)

    p1 = next(gen_jitter1)
    p2 = next(gen_jitter2)

    assert p1["shelfFillRatio"] == p2["shelfFillRatio"]
    assert validate_telemetry_payload(p1) is True


def test_validate_telemetry_payload_invalid_cases():
    valid = {
        "deviceId": "node-1",
        "timestamp": "2026-09-15T07:40:00Z",
        "zoneOccupancyCount": 2,
        "shelfFillRatio": 85.5,
        "surgeFlag": False,
        "lowStockFlag": False,
    }
    assert validate_telemetry_payload(valid) is True

    # Missing field
    invalid_missing = valid.copy()
    del invalid_missing["deviceId"]
    assert validate_telemetry_payload(invalid_missing) is False

    # Negative occupancy
    invalid_occ = valid.copy()
    invalid_occ["zoneOccupancyCount"] = -1
    assert validate_telemetry_payload(invalid_occ) is False

    # Out of range fill
    invalid_fill = valid.copy()
    invalid_fill["shelfFillRatio"] = 105.0
    assert validate_telemetry_payload(invalid_fill) is False
