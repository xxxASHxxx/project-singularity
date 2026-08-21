"""Unit tests for shelf fill ratio computation — no camera required.

Tests use synthetic numpy frames to validate SSIM/edge-density math.
"""
import sys
from pathlib import Path
import numpy as np
import pytest

# Make edge/ importable
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'edge'))

ROI = [[0, 0], [100, 0], [100, 100], [0, 100]]  # full 100x100 square


def make_white_frame(h=200, w=200):
    return np.ones((h, w, 3), dtype=np.uint8) * 255


def make_black_frame(h=200, w=200):
    return np.zeros((h, w, 3), dtype=np.uint8)


def make_noisy_frame(h=200, w=200, noise=30):
    base = np.ones((h, w, 3), dtype=np.uint8) * 200
    rng = np.random.default_rng(42)
    noise_arr = rng.integers(-noise, noise, (h, w, 3), dtype=np.int16)
    return np.clip(base.astype(np.int16) + noise_arr, 0, 255).astype(np.uint8)


class TestShelfDetectorSSIM:
    """Tests that require scikit-image."""

    def test_identical_frames_return_100(self):
        pytest.importorskip('skimage')
        from detectors.shelf_detector import ShelfDetector
        ref = make_white_frame()
        detector = ShelfDetector(ref, ROI)
        ratio = detector.compute_fill_ratio(make_white_frame())
        assert ratio == pytest.approx(100.0, abs=1.0)

    def test_empty_shelf_returns_low_ratio(self):
        pytest.importorskip('skimage')
        from detectors.shelf_detector import ShelfDetector
        ref = make_white_frame()
        detector = ShelfDetector(ref, ROI)
        ratio = detector.compute_fill_ratio(make_black_frame())
        assert ratio < 30.0, f"Expected < 30, got {ratio}"

    def test_similar_frame_returns_high_ratio(self):
        pytest.importorskip('skimage')
        from detectors.shelf_detector import ShelfDetector
        ref = make_white_frame()
        detector = ShelfDetector(ref, ROI)
        slightly_noisy = make_noisy_frame(noise=10)
        ratio = detector.compute_fill_ratio(slightly_noisy)
        assert ratio > 60.0, f"Expected > 60, got {ratio}"

    def test_ratio_bounded_0_to_100(self):
        pytest.importorskip('skimage')
        from detectors.shelf_detector import ShelfDetector
        ref = make_white_frame()
        detector = ShelfDetector(ref, ROI)
        for frame in [make_white_frame(), make_black_frame(), make_noisy_frame()]:
            ratio = detector.compute_fill_ratio(frame)
            assert 0.0 <= ratio <= 100.0


class TestShelfDetectorEdgeDensity:
    """Tests for edge-density fallback (no scikit-image required)."""

    def _make_detector_with_edge_backend(self, ref_frame):
        from detectors.shelf_detector import ShelfDetector
        d = ShelfDetector(ref_frame, ROI)
        d._backend = 'edge_density'  # force fallback
        return d

    def test_identical_frames_edge_density(self):
        from detectors.shelf_detector import ShelfDetector
        ref = make_white_frame()
        d = self._make_detector_with_edge_backend(ref)
        # White frames have zero edges — identical = 100%
        ratio = d.compute_fill_ratio(make_white_frame())
        assert ratio == pytest.approx(100.0, abs=1.0)

    def test_ratio_bounded_edge_density(self):
        from detectors.shelf_detector import ShelfDetector
        ref = make_noisy_frame(noise=50)
        d = self._make_detector_with_edge_backend(ref)
        for frame in [make_white_frame(), make_black_frame(), make_noisy_frame()]:
            ratio = d.compute_fill_ratio(frame)
            assert 0.0 <= ratio <= 100.0


class TestOccupancyDebounce:
    """Tests for rolling-average surge debounce."""

    def test_surge_fires_after_3_consecutive(self):
        sys.path.insert(0, str(Path(__file__).parent.parent))
        from main import OccupancyDebounce
        d = OccupancyDebounce(surge_threshold=4)
        results = [d.update(5) for _ in range(5)]
        # Surge flag should fire at index 2 (3rd sample at threshold)
        surge_flags = [r[1] for r in results]
        assert not surge_flags[0]
        assert not surge_flags[1]
        assert surge_flags[2]
        assert surge_flags[3]

    def test_no_surge_below_threshold(self):
        sys.path.insert(0, str(Path(__file__).parent.parent))
        from main import OccupancyDebounce
        d = OccupancyDebounce(surge_threshold=4)
        for _ in range(10):
            _, surge = d.update(3)
            assert not surge

    def test_surge_resets_when_drops_below(self):
        sys.path.insert(0, str(Path(__file__).parent.parent))
        from main import OccupancyDebounce
        d = OccupancyDebounce(surge_threshold=4)
        for _ in range(5):
            d.update(6)
        _, surge = d.update(1)  # drops below
        # After dropping, consecutive counter resets — but rolling avg still above
        # The check is: if smoothed < threshold, consecutive resets
        # Let's update a few more below threshold
        for _ in range(5):
            _, surge = d.update(1)
        assert not surge


class TestMockSequence:
    """Tests for mock data sequence."""

    def test_surge_fires_within_60_seconds(self):
        sys.path.insert(0, str(Path(__file__).parent.parent))
        from mock_data import get_mock_sequence
        seq = get_mock_sequence()
        surge_found = False
        for i, payload in enumerate(seq):
            if payload['surgeFlag']:
                surge_found = True
                break
            if i > 20:
                break
        assert surge_found, "No surge flag in mock sequence within 20 samples"

    def test_low_stock_fires_within_60_seconds(self):
        sys.path.insert(0, str(Path(__file__).parent.parent))
        from mock_data import get_mock_sequence
        seq = get_mock_sequence()
        low_stock_found = False
        for i, payload in enumerate(seq):
            if payload['lowStockFlag']:
                low_stock_found = True
                break
            if i > 20:
                break
        assert low_stock_found, "No low-stock flag in mock sequence within 20 samples"

    def test_payload_schema(self):
        sys.path.insert(0, str(Path(__file__).parent.parent))
        from mock_data import get_mock_sequence
        seq = get_mock_sequence()
        payload = next(seq)
        required = {'deviceId', 'timestamp', 'zoneOccupancyCount', 'shelfFillRatio', 'surgeFlag', 'lowStockFlag'}
        assert required.issubset(payload.keys())
        assert isinstance(payload['zoneOccupancyCount'], int)
        assert isinstance(payload['shelfFillRatio'], float)
        assert isinstance(payload['surgeFlag'], bool)
