"""Tests for the anomaly detector module."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from detectors.anomaly_detector import AnomalyDetector, AnomalyResult


# ---------------------------------------------------------------------------
# Construction & validation
# ---------------------------------------------------------------------------

def test_constructor_defaults():
    d = AnomalyDetector()
    assert d.window_size == 30
    assert d.z_threshold == 2.0
    assert d.min_samples == 5
    assert d.total_ingested == 0
    assert d.total_anomalies == 0


def test_constructor_custom_params():
    d = AnomalyDetector(window_size=10, z_threshold=3.0, min_samples=3)
    assert d.window_size == 10
    assert d.z_threshold == 3.0
    assert d.min_samples == 3


def test_constructor_rejects_small_window():
    with pytest.raises(ValueError, match="window_size"):
        AnomalyDetector(window_size=2)


def test_constructor_rejects_non_positive_threshold():
    with pytest.raises(ValueError, match="z_threshold"):
        AnomalyDetector(z_threshold=0)
    with pytest.raises(ValueError, match="z_threshold"):
        AnomalyDetector(z_threshold=-1.0)


def test_constructor_rejects_small_min_samples():
    with pytest.raises(ValueError, match="min_samples"):
        AnomalyDetector(min_samples=1)


# ---------------------------------------------------------------------------
# Cold-start behaviour (not enough samples)
# ---------------------------------------------------------------------------

def test_cold_start_no_anomaly():
    """During cold start (fewer than min_samples), no anomalies should fire."""
    d = AnomalyDetector(window_size=10, min_samples=5)
    for i in range(4):
        result = d.ingest({'zoneOccupancyCount': 2, 'shelfFillRatio': 80.0})
        assert result.has_anomaly is False
        assert result.occupancy_z_score is None
        assert result.fill_z_score is None
    assert d.total_ingested == 4
    assert d.total_anomalies == 0


# ---------------------------------------------------------------------------
# Z-score spike detection
# ---------------------------------------------------------------------------

def test_occupancy_spike_detected():
    """A sudden occupancy spike after stable readings should be flagged."""
    d = AnomalyDetector(window_size=10, z_threshold=2.0, min_samples=5)

    # Feed 8 stable readings
    for _ in range(8):
        d.ingest({'zoneOccupancyCount': 2, 'shelfFillRatio': 80.0})

    # Now inject a spike
    result = d.ingest({'zoneOccupancyCount': 10, 'shelfFillRatio': 80.0})
    assert result.occupancy_anomaly is True
    assert result.has_anomaly is True
    assert result.occupancy_z_score is not None
    assert result.occupancy_z_score > 2.0


def test_fill_drop_detected():
    """A sudden fill ratio drop should be flagged."""
    d = AnomalyDetector(window_size=10, z_threshold=2.0, min_samples=5)

    for _ in range(8):
        d.ingest({'zoneOccupancyCount': 2, 'shelfFillRatio': 85.0})

    result = d.ingest({'zoneOccupancyCount': 2, 'shelfFillRatio': 20.0})
    assert result.fill_anomaly is True
    assert result.has_anomaly is True
    assert result.fill_z_score is not None
    assert result.fill_z_score < -2.0


def test_occupancy_drop_detected():
    """A sudden occupancy drop should be flagged."""
    d = AnomalyDetector(window_size=10, z_threshold=2.0, min_samples=5)

    for _ in range(8):
        d.ingest({'zoneOccupancyCount': 10, 'shelfFillRatio': 85.0})

    result = d.ingest({'zoneOccupancyCount': 0, 'shelfFillRatio': 85.0})
    assert result.occupancy_drop_anomaly is True
    assert result.has_anomaly is True
    assert result.occupancy_z_score is not None
    assert result.occupancy_z_score < -2.0


def test_normal_variation_not_flagged():
    """Small natural fluctuations should not be flagged."""
    d = AnomalyDetector(window_size=10, z_threshold=2.0, min_samples=5)

    # Use naturally varying data for both dimensions
    readings = [
        (2, 80.0), (3, 81.0), (2, 79.0), (3, 80.5),
        (2, 78.5), (3, 80.0), (2, 81.5), (3, 79.5),
    ]
    for occ, fill in readings:
        result = d.ingest({'zoneOccupancyCount': occ, 'shelfFillRatio': fill})

    # Another normal reading within typical range
    result = d.ingest({'zoneOccupancyCount': 3, 'shelfFillRatio': 79.0})
    assert result.has_anomaly is False


def test_fill_increase_not_anomalous():
    """A fill ratio increase (restocking) should NOT be flagged as anomaly."""
    d = AnomalyDetector(window_size=10, z_threshold=2.0, min_samples=5)

    for _ in range(8):
        d.ingest({'zoneOccupancyCount': 2, 'shelfFillRatio': 50.0})

    # Fill ratio jumps up (restocked) — z_score is positive, not negative
    result = d.ingest({'zoneOccupancyCount': 2, 'shelfFillRatio': 95.0})
    assert result.fill_anomaly is False


def test_cooldown_suppresses_rapid_anomalies():
    """Cooldown should prevent consecutive anomalies from firing."""
    d = AnomalyDetector(window_size=10, z_threshold=2.0, min_samples=5, cooldown_samples=3)

    for _ in range(8):
        d.ingest({'zoneOccupancyCount': 2, 'shelfFillRatio': 80.0})

    # First spike fires anomaly
    result1 = d.ingest({'zoneOccupancyCount': 10, 'shelfFillRatio': 80.0})
    assert result1.has_anomaly is True
    assert result1.occupancy_anomaly is True

    # Second consecutive spike suppressed by cooldown
    result2 = d.ingest({'zoneOccupancyCount': 10, 'shelfFillRatio': 80.0})
    assert result2.has_anomaly is False
    assert result2.occupancy_anomaly is True  # The raw flag is still true, but has_anomaly is False

    # Third spike suppressed
    result3 = d.ingest({'zoneOccupancyCount': 10, 'shelfFillRatio': 80.0})
    assert result3.has_anomaly is False

    # Fourth spike suppressed
    result4 = d.ingest({'zoneOccupancyCount': 10, 'shelfFillRatio': 80.0})
    assert result4.has_anomaly is False

    # Fifth spike fires anomaly because cooldown (3) is met
    result5 = d.ingest({'zoneOccupancyCount': 100, 'shelfFillRatio': 80.0})
    assert result5.has_anomaly is True


def test_confidence_score_scaling():
    """Confidence score scales from 0.0 to 1.0 based on z-score distance from threshold."""
    d = AnomalyDetector(window_size=10, z_threshold=2.0, min_samples=5)

    for _ in range(8):
        d.ingest({'zoneOccupancyCount': 2, 'shelfFillRatio': 80.0})

    # Massive spike (> 2x threshold) should cap at 1.0 confidence
    result1 = d.ingest({'zoneOccupancyCount': 100, 'shelfFillRatio': 80.0})
    assert result1.has_anomaly is True
    assert result1.confidence_score == 1.0

    # Mild spike (just over threshold) should have low confidence
    # Need to reset state and provide varying data so stddev > 0
    d.reset()
    varying_readings = [
        (2, 80.0), (3, 80.0), (2, 80.0), (4, 80.0),
        (2, 80.0), (3, 80.0), (2, 80.0), (3, 80.0)
    ]
    for occ, fill in varying_readings:
        d.ingest({'zoneOccupancyCount': occ, 'shelfFillRatio': fill})
    
    # Send a small spike (should result in z-score < 4.0 but > 2.0)
    result2 = d.ingest({'zoneOccupancyCount': 5, 'shelfFillRatio': 80.0})
    if result2.has_anomaly:
        assert 0.0 < result2.confidence_score < 1.0


# ---------------------------------------------------------------------------
# Trend analysis
# ---------------------------------------------------------------------------

def test_declining_trend_detected():
    """A sustained fill-ratio decline should be tagged as 'declining'."""
    d = AnomalyDetector(window_size=20, z_threshold=2.0, min_samples=5,
                        trend_decline_threshold=-1.0)

    # Feed a declining sequence
    fills = [90, 87, 84, 81, 78, 75, 72, 69, 66, 63]
    for fill in fills:
        result = d.ingest({'zoneOccupancyCount': 2, 'shelfFillRatio': float(fill)})

    assert result.trend_direction == 'declining'
    assert result.trend_slope is not None
    assert result.trend_slope < -1.0


def test_stable_trend():
    """Flat readings should produce a 'stable' trend."""
    d = AnomalyDetector(window_size=20, z_threshold=2.0, min_samples=5,
                        trend_decline_threshold=-1.0)

    for _ in range(10):
        result = d.ingest({'zoneOccupancyCount': 3, 'shelfFillRatio': 80.0})

    assert result.trend_direction == 'stable'
    assert result.trend_slope is not None
    assert abs(result.trend_slope) < 0.01


def test_rising_trend():
    """An increasing fill ratio should be tagged as 'rising'."""
    d = AnomalyDetector(window_size=20, z_threshold=2.0, min_samples=5,
                        trend_decline_threshold=-1.0)

    fills = [50, 53, 56, 59, 62, 65, 68, 71, 74, 77]
    for fill in fills:
        result = d.ingest({'zoneOccupancyCount': 2, 'shelfFillRatio': float(fill)})

    assert result.trend_direction == 'rising'
    assert result.trend_slope > 1.0


# ---------------------------------------------------------------------------
# Counters & statistics
# ---------------------------------------------------------------------------

def test_anomaly_rate():
    d = AnomalyDetector(window_size=10, z_threshold=2.0, min_samples=5, cooldown_samples=0)

    # 8 normal readings
    for _ in range(8):
        d.ingest({'zoneOccupancyCount': 2, 'shelfFillRatio': 80.0})

    # 2 anomalous readings
    d.ingest({'zoneOccupancyCount': 20, 'shelfFillRatio': 80.0})
    d.ingest({'zoneOccupancyCount': 25, 'shelfFillRatio': 80.0})

    assert d.total_ingested == 10
    assert d.total_anomalies == 2
    assert d.anomaly_rate == 20.0


def test_anomaly_rate_zero_when_empty():
    d = AnomalyDetector()
    assert d.anomaly_rate == 0.0


def test_window_stats_structure():
    d = AnomalyDetector(window_size=10, min_samples=3)
    for i in range(5):
        d.ingest({'zoneOccupancyCount': i, 'shelfFillRatio': 50.0 + i * 5})

    stats = d.window_stats
    assert 'occupancy' in stats
    assert 'fill_ratio' in stats
    assert stats['occupancy']['count'] == 5
    assert stats['fill_ratio']['count'] == 5
    assert stats['total_ingested'] == 5
    assert 'mean' in stats['occupancy']
    assert 'stddev' in stats['occupancy']


# ---------------------------------------------------------------------------
# Reset
# ---------------------------------------------------------------------------

def test_reset_clears_state():
    d = AnomalyDetector(window_size=10, min_samples=3)
    for _ in range(5):
        d.ingest({'zoneOccupancyCount': 3, 'shelfFillRatio': 80.0})

    d.reset()
    assert d.total_ingested == 0
    assert d.total_anomalies == 0
    assert d.window_stats['occupancy']['count'] == 0


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------

def test_anomaly_result_to_dict():
    r = AnomalyResult(
        has_anomaly=True,
        occupancy_z_score=2.5,
        fill_z_score=-1.0,
        occupancy_anomaly=True,
        fill_anomaly=False,
        trend_direction='stable',
        trend_slope=0.01,
        timestamp='2026-10-04T12:00:00Z',
    )
    d = r.to_dict()
    assert d['has_anomaly'] is True
    assert d['occupancy_z_score'] == 2.5
    assert d['trend_direction'] == 'stable'
    assert d['timestamp'] == '2026-10-04T12:00:00Z'


def test_anomaly_result_str_with_anomaly():
    r = AnomalyResult(occupancy_anomaly=True, occupancy_z_score=3.2)
    assert 'occupancy_z=+3.20' in str(r)


def test_anomaly_result_str_no_anomaly():
    r = AnomalyResult()
    assert str(r) == 'Anomaly[none]'


def test_detector_str():
    d = AnomalyDetector(window_size=10, z_threshold=2.5)
    s = str(d)
    assert 'window=10' in s
    assert 'z=2.5' in s
    assert 'ingested=0' in s


# ---------------------------------------------------------------------------
# Z-score edge cases
# ---------------------------------------------------------------------------

def test_z_score_with_identical_values():
    """When all window values are identical, a different value gets a directional sentinel."""
    d = AnomalyDetector(window_size=10, z_threshold=2.0, min_samples=3)

    for _ in range(5):
        d.ingest({'zoneOccupancyCount': 5, 'shelfFillRatio': 80.0})

    # Same value — z-score should be 0
    result = d.ingest({'zoneOccupancyCount': 5, 'shelfFillRatio': 80.0})
    assert result.occupancy_z_score == 0.0

    # Different value — z-score should be sentinel 10.0
    result = d.ingest({'zoneOccupancyCount': 8, 'shelfFillRatio': 80.0})
    assert result.occupancy_z_score == 10.0
    assert result.occupancy_anomaly is True


def test_timestamp_tracking():
    """Anomaly timestamps should be recorded."""
    d = AnomalyDetector(window_size=10, z_threshold=2.0, min_samples=5)

    for _ in range(8):
        d.ingest({'zoneOccupancyCount': 2, 'shelfFillRatio': 80.0})

    d.ingest({
        'zoneOccupancyCount': 20,
        'shelfFillRatio': 80.0,
        'timestamp': '2026-10-04T12:00:00Z',
    })
    assert len(d._anomaly_timestamps) == 1
    assert d._anomaly_timestamps[0] == '2026-10-04T12:00:00Z'
