"""Unit tests for VelocityTracker and VelocityResult."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from detectors.velocity_tracker import VelocityResult, VelocityTracker


class TestVelocityTracker:
    """Test suite for shelf fill velocity tracking and stockout forecasting."""

    def test_initial_state_under_min_samples(self):
        tracker = VelocityTracker(min_samples=3)
        res1 = tracker.ingest(80.0, timestamp=1000.0)
        assert res1.sample_count == 1
        assert res1.velocity_pct_per_min == 0.0
        assert res1.stockout_eta_minutes is None
        assert not res1.is_rapid_depletion

        res2 = tracker.ingest(78.0, timestamp=1005.0)
        assert res2.sample_count == 2
        assert res2.velocity_pct_per_min == 0.0
        assert res2.stockout_eta_minutes is None

    def test_steady_depletion_velocity_and_eta(self):
        # 3 samples over 120 seconds (2 minutes): 100% -> 90% -> 80% (drop of 10% per min)
        tracker = VelocityTracker(min_samples=3, critical_threshold=0.0)
        tracker.ingest(100.0, timestamp=0.0)
        tracker.ingest(90.0, timestamp=60.0)
        res = tracker.ingest(80.0, timestamp=120.0)

        assert res.sample_count == 3
        # Depleting at -10.0 %/min
        assert res.velocity_pct_per_min == pytest.approx(-10.0, abs=0.2)
        # At 80% with velocity -10%/min, ETA to 0% is 8.0 minutes
        assert res.stockout_eta_minutes == pytest.approx(8.0, abs=0.2)
        assert res.is_rapid_depletion  # -10 <= -10 threshold

    def test_flat_fill_no_depletion(self):
        tracker = VelocityTracker(min_samples=3)
        tracker.ingest(50.0, timestamp=0.0)
        tracker.ingest(50.0, timestamp=30.0)
        res = tracker.ingest(50.0, timestamp=60.0)

        assert res.velocity_pct_per_min == 0.0
        assert res.stockout_eta_minutes is None
        assert not res.is_rapid_depletion
        assert not res.is_restocking

    def test_restocking_detection(self):
        # Fill increases from 20% -> 40% -> 60% over 2 minutes (+20%/min)
        tracker = VelocityTracker(min_samples=3)
        tracker.ingest(20.0, timestamp=0.0)
        tracker.ingest(40.0, timestamp=60.0)
        res = tracker.ingest(60.0, timestamp=120.0)

        assert res.velocity_pct_per_min > 0
        assert res.is_restocking
        assert not res.is_rapid_depletion
        assert res.stockout_eta_minutes is None

    def test_custom_critical_threshold(self):
        # Drop at 5%/min, current fill 30%, critical threshold 10%
        # Remaining: 20%, Rate: 5%/min -> ETA = 4.0 minutes
        tracker = VelocityTracker(min_samples=3, critical_threshold=10.0)
        tracker.ingest(40.0, timestamp=0.0)
        tracker.ingest(35.0, timestamp=60.0)
        res = tracker.ingest(30.0, timestamp=120.0)

        assert res.velocity_pct_per_min == pytest.approx(-5.0, abs=0.1)
        assert res.stockout_eta_minutes == pytest.approx(4.0, abs=0.1)

    def test_sliding_window_eviction(self):
        tracker = VelocityTracker(window_size=3, min_samples=2)
        tracker.ingest(100.0, timestamp=0.0)
        tracker.ingest(90.0, timestamp=60.0)
        tracker.ingest(80.0, timestamp=120.0)
        # 4th sample should evict the 1st sample
        res = tracker.ingest(70.0, timestamp=180.0)
        assert res.sample_count == 3
        assert tracker.window_stats['sample_count'] == 3

    def test_reset(self):
        tracker = VelocityTracker(min_samples=2)
        tracker.ingest(100.0, timestamp=0.0)
        tracker.ingest(90.0, timestamp=60.0)
        assert tracker.window_stats['sample_count'] == 2

        tracker.reset()
        assert tracker.window_stats['sample_count'] == 0
        res = tracker.ingest(80.0, timestamp=120.0)
        assert res.sample_count == 1
        assert res.velocity_pct_per_min == 0.0

    def test_to_dict_and_str(self):
        tracker = VelocityTracker(min_samples=2)
        tracker.ingest(100.0, timestamp=0.0)
        res = tracker.ingest(80.0, timestamp=60.0)

        d = res.to_dict()
        assert 'velocity_pct_per_min' in d
        assert 'stockout_eta_minutes' in d
        assert 'is_rapid_depletion' in d
        assert 'is_restocking' in d
        assert 'current_fill' in d
        assert d['sample_count'] == 2

        s = str(res)
        assert 'Velocity[' in s
        assert '%/min' in s
