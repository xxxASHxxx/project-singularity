"""Shelf fill ratio detector using SSIM or edge-density fallback."""
import numpy as np
import cv2
from typing import Optional

try:
    from skimage.metrics import structural_similarity as ssim
    _SSIM_AVAILABLE = True
except ImportError:
    _SSIM_AVAILABLE = False


class ShelfDetector:
    """Computes shelf fill ratio by comparing current frame to a reference.
    
    Uses SSIM primary; falls back to edge-density delta if scikit-image
    is not available.
    
    Fill ratio = 100 means identical to the full/calibrated reference.
    Fill ratio = 0 means maximally different (empty shelf).
    """

    def __init__(self, reference_frame: np.ndarray, roi: list):
        """Args:
            reference_frame: BGR frame captured at calibration (full shelf).
            roi: shelf ROI polygon [[x,y], ...]
        """
        self._roi = roi
        self._reference_roi = self._crop_roi(reference_frame)
        self._backend = 'ssim' if _SSIM_AVAILABLE else 'edge_density'
        if not _SSIM_AVAILABLE:
            print("[ShelfDetector] scikit-image not available, using edge-density fallback")

    def _crop_roi(self, frame: np.ndarray) -> np.ndarray:
        """Crop the bounding rect of the polygon ROI from frame."""
        pts = np.array(self._roi, dtype=np.int32)
        x, y, w, h = cv2.boundingRect(pts)
        return frame[y:y+h, x:x+w]

    def compute_fill_ratio(self, current_frame: np.ndarray) -> float:
        """Return fill ratio 0-100."""
        current_roi = self._crop_roi(current_frame)

        # Resize to reference dimensions for comparison
        ref = self._reference_roi
        h, w = ref.shape[:2]
        if current_roi.shape[:2] != (h, w):
            current_roi = cv2.resize(current_roi, (w, h))

        if self._backend == 'ssim':
            return self._ssim_ratio(ref, current_roi)
        return self._edge_density_ratio(ref, current_roi)

    def _ssim_ratio(self, ref: np.ndarray, current: np.ndarray) -> float:
        ref_gray = cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY)
        cur_gray = cv2.cvtColor(current, cv2.COLOR_BGR2GRAY)
        score, _ = ssim(ref_gray, cur_gray, full=True)
        # SSIM ranges -1 to 1; clip to 0-1 and scale to 0-100
        return float(np.clip(score, 0.0, 1.0) * 100.0)

    def _edge_density_ratio(self, ref: np.ndarray, current: np.ndarray) -> float:
        ref_gray = cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY)
        cur_gray = cv2.cvtColor(current, cv2.COLOR_BGR2GRAY)
        ref_edges = cv2.Canny(ref_gray, 100, 200)
        cur_edges = cv2.Canny(cur_gray, 100, 200)
        ref_density = np.count_nonzero(ref_edges)
        cur_density = np.count_nonzero(cur_edges)
        if ref_density == 0:
            return 100.0 if cur_density == 0 else 0.0
        ratio = cur_density / ref_density
        return float(np.clip(ratio, 0.0, 1.0) * 100.0)
